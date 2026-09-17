const speechService = require('../services/speech.service');

async function synthesize(req, res) {
  try {
    const text = req.body?.text || req.query?.text;
    const voice = req.body?.voice || req.query?.voice || 'candidate';
    const gender = req.body?.gender || req.query?.gender || 'female';
    const rate = req.body?.rate || req.query?.rate || '-3%';
    const pitch = req.body?.pitch || req.query?.pitch || '+0Hz';

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const audioBuffer = await speechService.synthesizeSpeech({
      text,
      voice,
      gender,
      rate,
      pitch
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    });

    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error('Speech synthesis error:', error);
    return res.status(500).json({
      error: 'Failed to synthesize speech',
      message: error.message
    });
  }
}

module.exports = {
  synthesize
};
