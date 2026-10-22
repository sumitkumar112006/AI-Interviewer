# ATS Resume Link Extraction Module

Production-grade ATS (Applicant Tracking System) link-extraction module for Node.js and Express backends. Recovers hidden hyperlinks embedded behind anchor text (e.g. "Portfolio", "GitHub", "LinkedIn") in PDF link annotations and Word DOCX relationships, alongside visible plain text URLs.

---

## Features

- **PDF Link Annotation Extraction**: Uses `pdfjs-dist` (legacy build) to inspect every page for `Link` annotations (`http`, `https`, `mailto:`, `tel:`). Reconstructs anchor text by calculating exact overlap between annotation bounding boxes (`rect`) and text content baseline transforms (`tx, ty`) with a small 2px tolerance.
- **DOCX Relationship Extraction**: Uses `mammoth.convertToHtml` and `cheerio` to parse `<a href>` tags and extract hyperlinks and anchor text cleanly without brittle regular expressions.
- **Visible Text URL Recovery**: Robust regex extraction for directly typed URLs (with or without protocol schemes), email addresses, and international phone numbers. Filters out common false-positive tech stack names (e.g. `React.js`, `Node.js`, `Next.js`) and academic degree abbreviations (`B.Tech`, `M.Tech`).
- **Normalization & Deduplication**: Canonicalizes links (normalizing protocol to `https://`, stripping `www.`, removing trailing slashes and punctuation like sentence-ending periods). Prioritizes annotation source over raw plain text.
- **Smart Link Classification**: Categorizes links into:
  - `github`
  - `linkedin`
  - `leetcode`
  - `codeforces`
  - `codechef`
  - `hackerrank`
  - `kaggle`
  - `twitter`
  - `medium`
  - `email`
  - `phone`
  - `portfolio` (personal site, portfolio hosting, or anchor text hints)
  - `others`
- **Edge Case Protection**:
  - **Canva / Figma Flattened PDFs**: When a PDF has 0 link annotations, sets `linksMayBeMissing: true` and includes a descriptive warning.
  - **Shortened URLs**: Automatically un-shortens links (`bit.ly`, `tinyurl.com`, `t.co`, etc.) using `fetch(..., { method: 'HEAD', redirect: 'follow' })` with a 3-second timeout.
  - **Corrupt File Safety**: Never throws on corrupt or malformed files; returns a structured error object.
  - **Empty Anchor / Icon Links**: Gracefully falls back to domain-based classification.

---

## Installation

Install required dependencies:

```bash
npm install pdfjs-dist mammoth cheerio multer
npm install --save-dev jest
```

---

## Programmatic Usage (ES Modules)

```javascript
import { parseResumeLinks } from './src/services/linkExtractor.js';
// or in CommonJS: const { parseResumeLinks } = require('./src/services/linkExtractor.js');

// From a file path:
const result = await parseResumeLinks('/path/to/resume.pdf', 'application/pdf');

// Or from an in-memory buffer (e.g., from Multer):
const result = await parseResumeLinks(req.file.buffer, req.file.mimetype);

console.log(result);
```

### Output Shape

```json
{
  "links": {
    "github": "https://github.com/sumitkumar112006",
    "linkedin": "https://linkedin.com/in/sumit-kumar-48998b345",
    "leetcode": null,
    "codeforces": null,
    "codechef": null,
    "hackerrank": null,
    "kaggle": null,
    "twitter": null,
    "medium": null,
    "portfolio": "https://freelance-portfolio-sepia-one.vercel.app",
    "email": "amitk839170@gmail.com",
    "phone": "+916207919163",
    "others": [
      "https://ai-interviewer-silk.vercel.app"
    ]
  },
  "rawLinks": [
    {
      "text": "GitHub",
      "url": "https://github.com/sumitkumar112006",
      "type": "github",
      "source": "annotation",
      "page": 1
    },
    {
      "text": "LinkedIn",
      "url": "https://linkedin.com/in/sumit-kumar-48998b345",
      "type": "linkedin",
      "source": "annotation",
      "page": 1
    },
    {
      "text": "Portfolio",
      "url": "https://freelance-portfolio-sepia-one.vercel.app",
      "type": "portfolio",
      "source": "annotation",
      "page": 1
    },
    {
      "text": "amitk839170@gmail.com",
      "url": "mailto:amitk839170@gmail.com",
      "type": "email",
      "source": "annotation",
      "page": 1
    },
    {
      "text": "+91 62079 19163",
      "url": "tel:+916207919163",
      "type": "phone",
      "source": "text"
    }
  ],
  "warnings": []
}
```

---

## Express Route: `POST /api/resume/links`

Mounted under `/api/resume/links` using `multer.memoryStorage()`:

```bash
curl -X POST http://localhost:3000/api/resume/links \
  -F "resume=@/path/to/resume.pdf"
```

### Route Implementation Example

```javascript
import express from 'express';
import multer from 'multer';
import { parseResumeLinks } from './src/services/linkExtractor.js';
// or: const { parseResumeLinks } = require('./src/services/linkExtractor.js');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/links', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a resume file under "resume".' });
  }

  const result = await parseResumeLinks(req.file.buffer, req.file.mimetype);

  if (result.error) {
    return res.status(422).json(result);
  }

  return res.status(200).json(result);
});

export default router;
```

---

## Running Unit Tests

Run the complete 26-test suite using Jest:

```bash
npm test
```
