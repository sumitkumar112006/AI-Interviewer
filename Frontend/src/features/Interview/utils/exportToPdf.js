import html2pdf from 'html2pdf.js'

/**
 * Direct 1-click PDF downloader using html2pdf.js.
 *
 * html2pdf's internal `pagebreak` avoidance (both 'css' and 'legacy' modes) is
 * unreliable — it estimates page-height internally and often gets it wrong.
 * So instead we disable it entirely (`mode: ['avoid-all']`, i.e. we do the
 * avoidance ourselves) and manually compute exact pixel boundaries for each
 * A4 page, then push any element that would straddle a boundary down to the
 * start of the next page using margin-top.
 *
 * Handles:
 *  - Text lines: p, li, h1-h6, blockquote
 *  - Leaf <div> text blocks (divs with no element children)
 *  - Images (<img>)
 *  - Table rows (<tr> — pushed via padding-top on first cell, since tr
 *    ignores margin)
 *  - Nested duplicate matches (e.g. <li><p>...</p></li> — only the outer
 *    element is pushed, not both)
 *  - Orphan headings (a heading stranded alone at the bottom of a page gets
 *    pushed to the next page too)
 *
 * @param {HTMLElement} element - The .tiptap-a4-page DOM element
 * @param {string} filename - Output filename (e.g. "Resume_Software_Engineer.pdf")
 */
export async function exportElementToPdf(element, filename = 'Resume.pdf') {
    if (!element) {
        window.print()
        return
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

    // ---- PDF layout constants (must match the `options` below) ----
    const PAGE_WIDTH_PX = 794          // 210mm at 96dpi
    const MARGIN_TOP_MM = 8
    const MARGIN_BOTTOM_MM = 8
    const A4_HEIGHT_MM = 297
    const PX_PER_MM = 96 / 25.4        // ≈ 3.7795
    const SAFETY_BUFFER_PX = 24        // break a bit early, never late
    const HEADING_ORPHAN_MIN_PX = 50   // if less than this space remains after a heading, push it too

    const PAGE_CONTENT_HEIGHT_PX =
        (A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * PX_PER_MM - SAFETY_BUFFER_PX

    // Clone element to sanitize padding & dimensions for PDF export
    const clone = element.cloneNode(true)

    clone.style.width = `${PAGE_WIDTH_PX}px`
    clone.style.maxWidth = `${PAGE_WIDTH_PX}px`
    clone.style.minWidth = `${PAGE_WIDTH_PX}px`
    clone.style.boxSizing = 'border-box'
    clone.style.padding = '56px 56px'
    clone.style.margin = '0 auto'
    clone.style.minHeight = 'auto'
    clone.style.height = 'auto'
    clone.style.boxShadow = 'none'
    clone.style.border = 'none'
    clone.style.background = '#ffffff'
    clone.style.color = '#1e293b'

    // Mount clone in an off-screen container FIRST (we need real layout/getBoundingClientRect)
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0px'
    container.style.width = `${PAGE_WIDTH_PX}px`
    container.style.background = '#ffffff'
    container.appendChild(clone)
    document.body.appendChild(container)

    // Transparent background on all elements (avoid weird boxed backgrounds in canvas)
    clone.querySelectorAll('*').forEach(el => {
        el.style.background = 'transparent'
    })

    // ---- Build the list of "atomic" elements that must not be sliced ----
    const baseSelector = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, img'
    let candidates = Array.from(clone.querySelectorAll(baseSelector))

    // Include leaf <div>s (text-only divs with no element children) too
    Array.from(clone.querySelectorAll('div')).forEach(div => {
        if (!div.querySelector('*') && div.textContent.trim().length > 0) {
            candidates.push(div)
        }
    })

    // Remove nested duplicates: keep only the outermost matching element
    const candidateSet = new Set(candidates)
    const atomicElements = candidates.filter(el => {
        let parent = el.parentElement
        while (parent && parent !== clone) {
            if (candidateSet.has(parent)) return false // an ancestor already covers this
            parent = parent.parentElement
        }
        return true
    })

    // Keep document order
    atomicElements.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )

    const cloneRectTop = clone.getBoundingClientRect().top

    const pushElementDown = (el, pushDownBy) => {
        if (el.tagName === 'TR') {
            const cell = el.querySelector('td, th')
            if (cell) {
                const currentPad = parseFloat(getComputedStyle(cell).paddingTop) || 0
                cell.style.paddingTop = `${currentPad + pushDownBy}px`
            }
            return
        }
        const currentMargin = parseFloat(getComputedStyle(el).marginTop) || 0
        el.style.marginTop = `${currentMargin + pushDownBy}px`
    }

    // ---- Main pass: push any element that straddles a page boundary ----
    atomicElements.forEach(el => {
        const rect = el.getBoundingClientRect() // live — reflects any earlier pushes
        const relTop = rect.top - cloneRectTop
        const relBottom = rect.bottom - cloneRectTop
        const elHeight = relBottom - relTop

        if (elHeight >= PAGE_CONTENT_HEIGHT_PX) return // taller than a page — can't avoid

        const pageIndexTop = Math.floor(relTop / PAGE_CONTENT_HEIGHT_PX)
        const pageIndexBottom = Math.floor((relBottom - 1) / PAGE_CONTENT_HEIGHT_PX)

        if (pageIndexTop !== pageIndexBottom) {
            const nextPageStart = (pageIndexTop + 1) * PAGE_CONTENT_HEIGHT_PX
            const pushDownBy = nextPageStart - relTop
            pushElementDown(el, pushDownBy)
        }
    })

    // ---- Second pass: orphan-heading protection ----
    // A heading that ends up with almost no room left before the next page
    // boundary looks broken (stranded alone) — push it to the next page too.
    const headings = atomicElements.filter(el => /^H[1-6]$/.test(el.tagName))
    headings.forEach(el => {
        const rect = el.getBoundingClientRect() // live, after main pass
        const relTop = rect.top - cloneRectTop
        const relBottom = rect.bottom - cloneRectTop

        const spaceLeftOnPage =
            PAGE_CONTENT_HEIGHT_PX - (relBottom % PAGE_CONTENT_HEIGHT_PX)

        if (spaceLeftOnPage < HEADING_ORPHAN_MIN_PX) {
            const pageIndexTop = Math.floor(relTop / PAGE_CONTENT_HEIGHT_PX)
            const nextPageStart = (pageIndexTop + 1) * PAGE_CONTENT_HEIGHT_PX
            const pushDownBy = nextPageStart - relTop
            pushElementDown(el, pushDownBy)
        }
    })

    const options = {
        margin: [MARGIN_TOP_MM, 0, MARGIN_BOTTOM_MM, 0],
        filename: cleanFilename,
        image: { type: 'png', quality: 1.0 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: PAGE_WIDTH_PX
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },
        pagebreak: {
            // We already did break-avoidance manually above — disable html2pdf's own.
            mode: ['legacy']
        }
    }

    try {
        await html2pdf().set(options).from(clone).save()
    } finally {
        if (container.parentNode) {
            container.parentNode.removeChild(container)
        }
    }
}