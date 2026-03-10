/**
 * assistant-speak-route.js
 * POST /api/v1/memories/assistant-speak
 *
 * Receives { text } from AppAssistant.jsx,
 * proxies to ElevenLabs TTS, streams audio/mpeg back to the browser.
 *
 * Add to your memories router (or wherever assistant-command lives):
 *   const speakRoute = require('./assistant-speak-route');
 *   router.post('/assistant-speak', speakRoute);
 *
 * Required env vars (already in your .env checklist):
 *   ELEVENLABS_API_KEY
 *   ELEVENLABS_VOICE_ID
 */

const fetch = require('node-fetch');

const ELEVENLABS_URL = (voiceId) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

module.exports = async function assistantSpeak(req, res) {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.error('[assistant-speak] Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID');
    return res.status(500).json({ error: 'TTS not configured' });
  }

  try {
    const elRes = await fetch(ELEVENLABS_URL(voiceId), {
      method: 'POST',
      headers: {
        'xi-api-key':    apiKey,
        'Content-Type':  'application/json',
        'Accept':        'audio/mpeg',
      },
      body: JSON.stringify({
        text:           text.trim(),
        model_id:       'eleven_turbo_v2',
        voice_settings: {
          stability:         0.45,
          similarity_boost:  0.80,
          style:             0.20,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error('[assistant-speak] ElevenLabs error:', elRes.status, errText);
      return res.status(502).json({ error: 'ElevenLabs TTS failed', detail: errText });
    }

    // Stream the audio back — browser creates a Blob URL from this
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    elRes.body.pipe(res);

  } catch (err) {
    console.error('[assistant-speak] Unexpected error:', err);
    res.status(500).json({ error: 'Internal TTS error' });
  }
};
