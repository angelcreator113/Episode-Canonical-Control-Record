// ─────────────────────────────────────────────────────────────────────────────
// alexa-amber-skill/index.js
//
// Alexa skill Lambda for Prime Studios — lets you talk to Amber via voice.
//
// THIS IS A SEPARATE AWS LAMBDA DEPLOYMENT.
// It is NOT part of the Express app. It does not run inside the main server.
// It calls your production API over HTTPS.
//
// ── DEPLOYMENT STEPS ─────────────────────────────────────────────────────────
//
// 1. ALEXA DEVELOPER CONSOLE (developer.amazon.com)
//    - Create a new Custom skill
//    - Set invocation name: "prime studios"
//      (user says: "Alexa, open prime studios")
//    - Add these intents (via JSON editor or Interaction Model builder):
//      * AskAmberIntent — slots: {query} (AMAZON.SearchQuery)
//        Sample utterances:
//          "ask amber {query}"
//          "amber {query}"
//          "what does amber say about {query}"
//          "tell me about {query}"
//      * MorningBriefingIntent
//        Sample utterances:
//          "morning briefing"
//          "what's happening"
//          "fill me in"
//          "catch me up"
//      * NovelStatusIntent
//        Sample utterances:
//          "what does the novel need"
//          "how is the novel"
//          "novel status"
//          "how's the writing going"
//      * BuildStatusIntent
//        Sample utterances:
//          "what's in the build queue"
//          "what should I build next"
//          "build status"
//      * AMAZON.HelpIntent (built-in)
//      * AMAZON.StopIntent (built-in)
//      * AMAZON.CancelIntent (built-in)
//    - Save and build the interaction model
//
// 2. AWS LAMBDA
//    - Create a new Lambda function (Node.js 20.x runtime)
//    - Upload this file (or zip it: `zip -r function.zip index.js`)
//    - Set environment variables:
//        PRIME_STUDIOS_API=https://your-production-api-url.com
//        PRIME_STUDIOS_API_KEY=your_jwt_or_api_key (optional, for auth)
//    - Set handler to: index.handler
//    - Add an Alexa Skills Kit trigger (paste your skill ID)
//
// 3. CONNECT SKILL TO LAMBDA
//    - In the Alexa Developer Console, go to Endpoint
//    - Select "AWS Lambda ARN"
//    - Paste your Lambda function ARN in the Default Region field
//    - Save
//
// 4. TEST
//    - Use the Alexa simulator in the developer console
//    - Say: "Alexa, open prime studios"
//    - Then: "morning briefing" or "ask amber how the novel is going"
//
// ── HOW IT WORKS ─────────────────────────────────────────────────────────────
// User: "Alexa, ask Prime Studios what the novel needs right now"
// Alexa: routes to AskAmberIntent with query = "what the novel needs right now"
// Lambda: hits /api/v1/memories/assistant-command with that query
// Amber: reads franchise knowledge + system state, responds in her voice
// Alexa: speaks Amber's response out loud
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');
const http  = require('http');

const API_BASE = process.env.PRIME_STUDIOS_API || 'https://api.primepisodes.com';
const API_KEY  = process.env.PRIME_STUDIOS_API_KEY || '';
const IS_HTTPS = API_BASE.startsWith('https');

// ── Hit Prime Studios API ─────────────────────────────────────────────────────
function callPrimeStudios(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length':  Buffer.byteLength(payload),
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      },
    };

    const lib = IS_HTTPS ? https : http;
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── GET request for greeting ──────────────────────────────────────────────────
function getGreeting() {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + '/api/v1/amber/greeting?page=alexa');
    const lib = IS_HTTPS ? https : http;
    lib.get({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      headers:  API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {},
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

// ── Alexa response helpers ────────────────────────────────────────────────────
function speak(text, endSession = true) {
  // Clean text for Alexa — remove markdown, emoji, non-ASCII
  const clean = text
    .replace(/[*_#`~]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();

  return {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: clean },
      shouldEndSession: endSession,
    },
  };
}

function speakAndListen(text) {
  return {
    ...speak(text, false),
    response: {
      ...speak(text, false).response,
      reprompt: {
        outputSpeech: { type: 'PlainText', text: 'Is there anything else?' },
      },
      shouldEndSession: false,
    },
  };
}

// ── Intent handlers ───────────────────────────────────────────────────────────
async function handleMorningBriefing() {
  try {
    const data = await getGreeting();
    return speak(data.greeting || 'The system is quiet. Everything is waiting for you.');
  } catch {
    return speak('I could not reach Prime Studios right now. Check your connection.');
  }
}

async function handleAskAmber(query) {
  if (!query) return speak('What would you like to ask Amber?');
  try {
    const data = await callPrimeStudios('/api/v1/memories/assistant-command', {
      message: query,
      history: [],
      context: { source: 'alexa', currentPage: 'alexa' },
    });
    const reply = data.reply || 'I processed that but have no response.';
    return speak(reply);
  } catch {
    return speak('I could not reach Amber right now.');
  }
}

async function handleNovelStatus() {
  return handleAskAmber(
    'What does the novel need right now? How many days since we last wrote? What is the current arc stage?'
  );
}

async function handleBuildStatus() {
  return handleAskAmber(
    'What is next in the build queue? What has been waiting the longest for a decision?'
  );
}

// ── Main Lambda handler ───────────────────────────────────────────────────────
exports.handler = async (event) => {
  const requestType = event.request.type;
  const intentName  = event.request.intent?.name;

  // Launch request — user opened the skill
  if (requestType === 'LaunchRequest') {
    return speakAndListen(
      'Prime Studios is connected. You can ask for your morning briefing, novel status, build queue, or ask Amber anything directly.'
    );
  }

  if (requestType === 'IntentRequest') {
    switch (intentName) {
      case 'MorningBriefingIntent':
        return await handleMorningBriefing();

      case 'AskAmberIntent': {
        const query = event.request.intent.slots?.query?.value || '';
        return await handleAskAmber(query);
      }

      case 'NovelStatusIntent':
        return await handleNovelStatus();

      case 'BuildStatusIntent':
        return await handleBuildStatus();

      case 'AMAZON.HelpIntent':
        return speakAndListen(
          'You can say: morning briefing, novel status, build queue, or ask Amber followed by your question.'
        );

      case 'AMAZON.CancelIntent':
      case 'AMAZON.StopIntent':
        return speak('Prime Studios standing by.');

      default:
        return speak('I did not understand that. Try asking for your morning briefing or novel status.');
    }
  }

  if (requestType === 'SessionEndedRequest') {
    return { version: '1.0', response: {} };
  }

  return speak('Something unexpected happened.');
};
