import { sanitizeResumeHtml, parseAndSanitizeSnippet } from './sanitizeResumeHtml'

/**
 * Normalizes text for resilient comparisons (collapses whitespace, removes non-breaking spaces).
 */
function normalizeForDiff(str) {
    if (!str || typeof str !== 'string') return ''
    return str
        .replace(/&nbsp;/g, ' ')
        .replace(/[\u00a0\s]+/g, ' ')
        .trim()
}

/**
 * Escapes HTML characters for safe injection.
 */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/**
 * Determines whether an HTML fragment represents an entire full resume document
 * or just a targeted section/snippet.
 */
function checkIsFullResume(html, doc, oldHtmlLength) {
    if (!html || !doc) return false
    const text = (doc.body?.textContent || '').toLowerCase()
    const headings = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4'))
    
    // Check for major section headings
    const sectionKeywords = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'technical skills', 'work history']
    const matchedSections = sectionKeywords.filter(k => text.includes(k))
    
    const hasNameOrHeader = Boolean(doc.body.querySelector('h1')) || headings.length >= 3
    
    // It is a full document ONLY if it has at least 3 distinct resume sections AND headings AND length >= 60% of old resume
    const isSufficientLength = oldHtmlLength > 0 ? (html.length / oldHtmlLength >= 0.6) : html.length > 700
    return (matchedSections.length >= 3 && hasNameOrHeader && isSufficientLength)
}

/**
 * Extracts inner content from new snippet (strips outer block tags if single element).
 */
function extractInnerSnippetHtml(html) {
    if (!html) return ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const children = Array.from(doc.body.children)
    if (children.length === 1 && (children[0].tagName === 'P' || children[0].tagName === 'LI')) {
        return children[0].innerHTML
    }
    return html.replace(/^<p>|<\/p>$/gi, '').trim()
}

/**
 * TrackUpdatePart - Core Diff Tracker for KIVI AI Assistant & TipTap Viewport
 *
 * Prioritizes EXACT Target Text matching on leaf nodes (li, p, h1-6) so only the
 * targeted line or bullet point is modified, without disturbing the rest of the section.
 *
 * @param {string} oldResumeHtml - Current HTML content from TipTap editor
 * @param {string|boolean} updatedResume - Full updated HTML or section snippet from LLM
 * @param {string|null} [explicitTargetText] - Explicit target text identified by LLM
 * @returns {Object} Structured diff descriptor
 */
export function TrackUpdatePart(oldResumeHtml = '', updatedResume = '', explicitTargetText = null) {
    if (!updatedResume || updatedResume === false || typeof updatedResume !== 'string') {
        return {
            hasChanges: false,
            isFullDocument: false,
            changeType: 'none',
            sectionName: null,
            targetText: null,
            replacementHtml: null,
            diffPreviewHtml: oldResumeHtml,
            mergedFullResumeHtml: oldResumeHtml,
            oldFullResumeHtml: oldResumeHtml
        }
    }

    const cleanOldHtml = sanitizeResumeHtml(oldResumeHtml)
    const cleanUpdated = parseAndSanitizeSnippet(updatedResume)

    if (!cleanUpdated) {
        return {
            hasChanges: false,
            isFullDocument: false,
            changeType: 'none',
            sectionName: null,
            targetText: null,
            replacementHtml: null,
            diffPreviewHtml: cleanOldHtml,
            mergedFullResumeHtml: cleanOldHtml,
            oldFullResumeHtml: cleanOldHtml
        }
    }

    const parser = new DOMParser()
    const oldDoc = parser.parseFromString(cleanOldHtml, 'text/html')
    const newDoc = parser.parseFromString(cleanUpdated, 'text/html')
    const diffDoc = parser.parseFromString(cleanOldHtml, 'text/html')
    const mergedDoc = parser.parseFromString(cleanOldHtml, 'text/html')

    const isFullDoc = checkIsFullResume(cleanUpdated, newDoc, cleanOldHtml.length)

    // ── Case 1: Full Document Output ──────────────────────────────────────────
    if (isFullDoc) {
        return {
            hasChanges: true,
            isFullDocument: true,
            changeType: 'full_document',
            sectionName: null,
            targetText: explicitTargetText || null,
            replacementHtml: cleanUpdated,
            diffPreviewHtml: cleanUpdated,
            mergedFullResumeHtml: cleanUpdated,
            oldFullResumeHtml: cleanOldHtml
        }
    }

    // ── Case 2: Targeted Line / Bullet / Section Replacement ───────────────────
    // Collect all leaf/content nodes across old, diff, and merged documents
    const oldNodes = Array.from(oldDoc.body.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6'))
    const diffNodes = Array.from(diffDoc.body.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6'))
    const mergedNodes = Array.from(mergedDoc.body.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6'))

    let bestMatchIndex = -1
    let bestMatchScore = 0

    // Priority 1: Match by explicit target text
    if (explicitTargetText && explicitTargetText.trim()) {
        const normTarget = normalizeForDiff(explicitTargetText).toLowerCase()
        const strippedTarget = normTarget.replace(/^[•\-\*\d\.]+\s*/, '').trim()

        oldNodes.forEach((node, idx) => {
            const nodeText = normalizeForDiff(node.textContent).toLowerCase()
            const strippedNodeText = nodeText.replace(/^[•\-\*\d\.]+\s*/, '').trim()

            if (nodeText === normTarget || strippedNodeText === strippedTarget) {
                if (bestMatchScore < 100) {
                    bestMatchScore = 100
                    bestMatchIndex = idx
                }
            } else if (nodeText.includes(normTarget) || strippedNodeText.includes(strippedTarget)) {
                const score = 80 - Math.min(20, Math.abs(nodeText.length - normTarget.length) / 5)
                if (score > bestMatchScore) {
                    bestMatchScore = score
                    bestMatchIndex = idx
                }
            } else if (normTarget.includes(nodeText) || strippedTarget.includes(strippedNodeText)) {
                if (nodeText.length >= 10) {
                    const score = 70
                    if (score > bestMatchScore) {
                        bestMatchScore = score
                        bestMatchIndex = idx
                    }
                }
            }
        })
    }

    // Priority 2: Match by Category Keyword Prefix (e.g. <strong>AI & ML APIs:</strong>)
    if (bestMatchIndex === -1) {
        const categoryMatch = cleanUpdated.match(/<strong>\s*([^:<]+?)\s*:?\s*<\/strong>/i)
        const categoryPrefix = categoryMatch ? categoryMatch[1].trim().toLowerCase() : ''

        if (categoryPrefix && categoryPrefix.length >= 3) {
            oldNodes.forEach((node, idx) => {
                const nodeText = normalizeForDiff(node.textContent).toLowerCase()
                if (nodeText.includes(categoryPrefix)) {
                    if (bestMatchScore < 75) {
                        bestMatchScore = 75
                        bestMatchIndex = idx
                    }
                }
            })
        }
    }

    // Priority 3: Match by Section Heading (ONLY if new snippet is an entire section with heading)
    const newHeadingEl = newDoc.body.querySelector('h1, h2, h3, h4, h5, h6')
    const newHeadingText = newHeadingEl ? normalizeForDiff(newHeadingEl.textContent).toLowerCase() : ''

    if (bestMatchIndex === -1 && newHeadingText) {
        const oldChildren = Array.from(oldDoc.body.children)
        const diffOldChildren = Array.from(diffDoc.body.children)
        const mergedOldChildren = Array.from(mergedDoc.body.children)

        let matchedOldHeadingIndex = -1
        oldChildren.forEach((child, idx) => {
            if (/^H[1-6]$/i.test(child.tagName)) {
                const hText = normalizeForDiff(child.textContent).toLowerCase()
                if (hText === newHeadingText || hText.includes(newHeadingText) || newHeadingText.includes(hText)) {
                    if (matchedOldHeadingIndex === -1) {
                        matchedOldHeadingIndex = idx
                    }
                }
            }
        })

        if (matchedOldHeadingIndex !== -1) {
            const sectionNodes = [oldChildren[matchedOldHeadingIndex]]
            const diffSectionNodes = [diffOldChildren[matchedOldHeadingIndex]]
            const mergedSectionNodes = [mergedOldChildren[matchedOldHeadingIndex]]

            let endIdx = matchedOldHeadingIndex + 1
            while (endIdx < oldChildren.length) {
                const nextChild = oldChildren[endIdx]
                if (/^H[1-6]$/i.test(nextChild.tagName)) break
                sectionNodes.push(nextChild)
                diffSectionNodes.push(diffOldChildren[endIdx])
                mergedSectionNodes.push(mergedOldChildren[endIdx])
                endIdx++
            }

            const nonHeadingDiffNodes = diffSectionNodes.slice(1)
            const nonHeadingMergedNodes = mergedSectionNodes.slice(1)
            const nonHeadingNewNodes = Array.from(newDoc.body.children).filter(nc => !/^H[1-6]$/i.test(nc.tagName))
            const effectiveNewNodes = nonHeadingNewNodes.length > 0 ? nonHeadingNewNodes : Array.from(newDoc.body.children)

            // Merged doc: Keep section heading, replace old non-heading nodes with new content
            const mergedHeading = mergedSectionNodes[0]
            if (mergedHeading && mergedHeading.parentNode) {
                const frag = mergedDoc.createDocumentFragment()
                effectiveNewNodes.forEach(nc => frag.appendChild(nc.cloneNode(true)))
                if (mergedSectionNodes.length > 1) {
                    mergedHeading.parentNode.insertBefore(frag, mergedSectionNodes[1])
                    for (let i = 1; i < mergedSectionNodes.length; i++) {
                        mergedSectionNodes[i]?.remove()
                    }
                } else if (mergedHeading.nextSibling) {
                    mergedHeading.parentNode.insertBefore(frag, mergedHeading.nextSibling)
                } else {
                    mergedHeading.parentNode.appendChild(frag)
                }
            }

            // Diff doc: Keep section heading, add struck-through old content + highlighted new content
            const diffHeading = diffSectionNodes[0]
            if (diffHeading && diffHeading.parentNode) {
                const diffFrag = diffDoc.createDocumentFragment()
                nonHeadingDiffNodes.forEach(node => {
                    const clone = node.cloneNode(true)
                    if (clone.tagName === 'UL' || clone.tagName === 'OL') {
                        clone.querySelectorAll('li').forEach(li => {
                            li.innerHTML = `<del class="kivi-diff-del">${li.innerHTML}</del>`
                        })
                        diffFrag.appendChild(clone)
                    } else {
                        const p = diffDoc.createElement('p')
                        p.innerHTML = `<del class="kivi-diff-del">${clone.innerHTML}</del>`
                        diffFrag.appendChild(p)
                    }
                })

                effectiveNewNodes.forEach(nc => {
                    const clone = nc.cloneNode(true)
                    if (clone.tagName === 'UL' || clone.tagName === 'OL') {
                        clone.querySelectorAll('li').forEach(li => {
                            li.innerHTML = `<ins class="kivi-diff-ins">${li.innerHTML}</ins>`
                        })
                        diffFrag.appendChild(clone)
                    } else {
                        const p = diffDoc.createElement('p')
                        p.innerHTML = `<ins class="kivi-diff-ins">${clone.innerHTML}</ins>`
                        diffFrag.appendChild(p)
                    }
                })

                if (diffSectionNodes.length > 1) {
                    diffHeading.parentNode.insertBefore(diffFrag, diffSectionNodes[1])
                    for (let i = 1; i < diffSectionNodes.length; i++) {
                        diffSectionNodes[i]?.remove()
                    }
                } else if (diffHeading.nextSibling) {
                    diffHeading.parentNode.insertBefore(diffFrag, diffHeading.nextSibling)
                } else {
                    diffHeading.parentNode.appendChild(diffFrag)
                }
            }

            const diffPreviewHtml = sanitizeResumeHtml(diffDoc.body.innerHTML)
            const mergedFullResumeHtml = sanitizeResumeHtml(mergedDoc.body.innerHTML)

            return {
                hasChanges: true,
                isFullDocument: false,
                changeType: 'section_replace',
                sectionName: oldChildren[matchedOldHeadingIndex].textContent.trim(),
                targetText: explicitTargetText || sectionNodes.map(n => n.textContent).join(' '),
                replacementHtml: cleanUpdated,
                diffPreviewHtml: diffPreviewHtml || mergedFullResumeHtml,
                mergedFullResumeHtml,
                oldFullResumeHtml: cleanOldHtml
            }
        }
    }

    // ── Apply targeted line/bullet point replacement on matched leaf node ──
    if (bestMatchIndex !== -1 && bestMatchIndex < oldNodes.length) {
        const oldTargetNode = oldNodes[bestMatchIndex]
        const diffTargetNode = diffNodes[bestMatchIndex]
        const mergedTargetNode = mergedNodes[bestMatchIndex]

        const innerNewSnippet = extractInnerSnippetHtml(cleanUpdated)
        const isListItem = oldTargetNode.tagName === 'LI'

        // 1. Merged Doc (Clean replacement for Accept)
        if (mergedTargetNode && mergedTargetNode.parentNode) {
            if (isListItem) {
                // If the replacement is a single line, replace innerHTML of that specific LI
                mergedTargetNode.innerHTML = innerNewSnippet
            } else {
                // For paragraph, replace with new paragraph nodes or innerHTML
                const frag = mergedDoc.createDocumentFragment()
                const newChildren = Array.from(newDoc.body.children)
                if (newChildren.length > 0) {
                    newChildren.forEach(nc => frag.appendChild(nc.cloneNode(true)))
                    mergedTargetNode.parentNode.insertBefore(frag, mergedTargetNode)
                    mergedTargetNode.remove()
                } else {
                    mergedTargetNode.innerHTML = innerNewSnippet
                }
            }
        }

        // 2. Diff Doc (Strikethrough Old + Green New ONLY on that specific node)
        if (diffTargetNode && diffTargetNode.parentNode) {
            const oldInner = diffTargetNode.innerHTML
            if (isListItem) {
                // For a list item: Show old line struck-through, new line highlighted right in that LI (or two consecutive LIs)
                const newLi = diffDoc.createElement('li')
                newLi.innerHTML = `<ins class="kivi-diff-ins">${innerNewSnippet}</ins>`
                diffTargetNode.innerHTML = `<del class="kivi-diff-del">${oldInner}</del>`
                if (diffTargetNode.nextSibling) {
                    diffTargetNode.parentNode.insertBefore(newLi, diffTargetNode.nextSibling)
                } else {
                    diffTargetNode.parentNode.appendChild(newLi)
                }
            } else {
                // For a paragraph: Show old paragraph struck-through, new paragraph highlighted
                const newP = diffDoc.createElement('p')
                newP.innerHTML = `<ins class="kivi-diff-ins">${innerNewSnippet}</ins>`
                diffTargetNode.innerHTML = `<del class="kivi-diff-del">${oldInner}</del>`
                if (diffTargetNode.nextSibling) {
                    diffTargetNode.parentNode.insertBefore(newP, diffTargetNode.nextSibling)
                } else {
                    diffTargetNode.parentNode.appendChild(newP)
                }
            }
        }

        const mergedFullResumeHtml = sanitizeResumeHtml(mergedDoc.body.innerHTML)
        const diffPreviewHtml = sanitizeResumeHtml(diffDoc.body.innerHTML)
        const targetText = oldTargetNode.textContent.trim()

        return {
            hasChanges: true,
            isFullDocument: false,
            changeType: 'line_replace',
            sectionName: null,
            targetText,
            replacementHtml: cleanUpdated,
            diffPreviewHtml: diffPreviewHtml || mergedFullResumeHtml,
            mergedFullResumeHtml,
            oldFullResumeHtml: cleanOldHtml
        }
    }

    // Fallback: If no node matched, return clean merged
    const mergedFullResumeHtml = sanitizeResumeHtml(mergedDoc.body.innerHTML)
    const diffPreviewHtml = sanitizeResumeHtml(diffDoc.body.innerHTML)

    return {
        hasChanges: true,
        isFullDocument: false,
        changeType: 'insert',
        sectionName: null,
        targetText: explicitTargetText || null,
        replacementHtml: cleanUpdated,
        diffPreviewHtml: diffPreviewHtml || cleanUpdated,
        mergedFullResumeHtml: mergedFullResumeHtml || cleanUpdated,
        oldFullResumeHtml: cleanOldHtml
    }
}


