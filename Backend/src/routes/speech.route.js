const express = require('express');
const router = express.Router();
const speechController = require('../controller/speech.controller');

// Support both GET (for direct <audio src="...">) and POST (for large text payloads)
router.get('/synthesize', speechController.synthesize);
router.post('/synthesize', speechController.synthesize);

module.exports = router;
