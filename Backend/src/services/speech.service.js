const crypto = require('crypto');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// In-memory buffer cache for high-speed voice streaming
const audioCache = new Map();
const MAX_CACHE_SIZE = 200;

const VOICE_PRESETS = {
  interviewer: 'en-US-ChristopherNeural',  // Deep, authoritative, senior tech lead
  candidate: 'en-US-JennyNeural',          // Articulate, expressive, human candidate
  lead: 'en-US-BrianNeural',               // Executive tech architect
  coach: 'en-US-AriaNeural',               // Clear, encouraging AI coach
  male: 'en-US-ChristopherNeural',
  female: 'en-US-JennyNeural'
};

/**
 * Clean and enrich text with human conversational pacing & correct technical pronunciations
 */
function prepareConversationalText(rawText) {
  if (!rawText) return '';

  let text = String(rawText).trim();

  // 1. Technical acronym pronunciation smoothing
  text = text
    .replace(/\bATS\b/g, 'A.T.S.')
    .replace(/\bAPI\b/g, 'A.P.I.')
    .replace(/\bAPIs\b/g, 'A.P.I.s')
    .replace(/\bSQS\b/g, 'S.Q.S.')
    .replace(/\bFIFO\b/g, 'F.I.F.O.')
    .replace(/\bDLQ\b/g, 'Dead-Letter Queue')
    .replace(/\bJD\b/g, 'job description')
    .replace(/\bK8s\b/g, 'Kubernetes')
    .replace(/\bSQL\b/g, 'S.Q.L.')
    .replace(/\bPostgreSQL\b/g, 'Postgres Q.L.')
    .replace(/\bSDE-2\b/g, 'S.D.E. two')
    .replace(/\b50k\b/gi, '50 thousand')
    .replace(/\b60k\b/gi, '60 thousand')
    .replace(/\b200 OK\b/g, '200 O.K.')
    .replace(/\bTLS 1\.3\b/g, 'T.L.S. one point three')
    .replace(/\bAES-256\b/g, 'A.E.S. 256');

  // 2. Add natural breathing micro-pauses (dashes and ellipses create authentic speech cadence)
  text = text
    .replace(/["“”]/g, '')
    .replace(/,\s*/g, ', ... ')
    .replace(/\.\s+/g, '. — ')
    .replace(/;\s*/g, '; ... ')
    .replace(/:\s*/g, ': ... ');

  return text;
}

/**
 * Synthesize neural speech audio buffer with Microsoft Neural Voice
 */
async function synthesizeSpeech({ text, voice = 'candidate', gender = 'female', rate = '-3%', pitch = '+0Hz' }) {
  const cleanText = prepareConversationalText(text);
  if (!cleanText) {
    throw new Error('No text provided for speech synthesis');
  }

  const selectedVoice = VOICE_PRESETS[voice] || VOICE_PRESETS[gender] || VOICE_PRESETS.candidate;

  // Check cache key
  const cacheKey = crypto.createHash('md5').update(`${selectedVoice}:${rate}:${pitch}:${cleanText}`).digest('hex');
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  const tts = new MsEdgeTTS();
  await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(cleanText, {
    pitch,
    rate,
    volume: '+0%'
  });

  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', err => reject(err));
  });

  // Store in cache (evict oldest if full)
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = audioCache.keys().next().value;
    audioCache.delete(firstKey);
  }
  audioCache.set(cacheKey, buffer);

  return buffer;
}

module.exports = {
  synthesizeSpeech,
  prepareConversationalText,
  VOICE_PRESETS
};
