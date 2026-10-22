const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseResumeLinks } = require('../services/linkExtractor.js');

const router = express.Router();

// Memory storage keeps file buffers in memory for high-performance extraction
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    const isPdf = ext === '.pdf' || mime === 'application/pdf';
    const isDocx = ext === '.docx' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword';

    if (isPdf || isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX resume files are supported.'));
    }
  }
});

/**
 * POST /api/resume/links
 * Upload a resume (PDF or DOCX) and recover all visible and hidden hyperlink annotations.
 * Field name: 'resume'
 */
router.post('/links', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Resume file is required. Please upload a PDF or DOCX file under field name "resume".'
      });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Extract links using linkExtractor module
    const result = await parseResumeLinks(buffer, mimetype || originalname);

    if (result.error) {
      return res.status(422).json({
        message: 'Could not extract links from provided resume file.',
        ...result
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error extracting resume links:', err);
    return res.status(500).json({
      error: 'An unexpected internal error occurred while processing the resume.',
      details: err.message
    });
  }
});

module.exports = router;
