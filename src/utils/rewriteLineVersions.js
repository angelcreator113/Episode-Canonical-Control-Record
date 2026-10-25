'use strict';

/**
 * Rewrite line: three versions, each from a different angle (Evoni,
 * 2026-10-25: "When I ask the script to rewrite it's basically writing the
 * same thing."). The prompt, the reply's parse and the must-differ check
 * for POST /api/v1/episode-brief/:episodeId/rewrite-line. No network, no
 * database: the route makes the call.
 */

// The three angles, in the order the Script tab shows them.
const ANGLES = [
  { key: 'tighter', label: 'Tighter', brief: 'about half the length of the original, same meaning.' },
  { key: 'punchier', label: 'Punchier', brief: 'more energy and a stronger opening.' },
  { key: 'new', label: 'New angle', brief: 'a different way into the same moment: a question, a confession or a joke.' },
];

// The Script tab's direction chips (key: what the model is told).
const DIRECTIONS = {
  shorter: { label: 'Shorter', guide: 'Shorter: cut it to the fewest words that still land.' },
  punchier: { label: 'Punchier', guide: 'Punchier: more energy, a strong first word, active verbs, no warm-up.' },
  funnier: { label: 'Funnier', guide: 'Funnier: a light joke, a twist or a playful exaggeration, still in character.' },
  emotional: { label: 'More emotional', guide: 'More emotional: let the feeling under the line show, what it costs and what it means to her.' },
  lala: { label: 'More Lala', guide: 'More Lala: lean into the Lala world, confident, glamorous, a little dramatic, quotable.' },
  surprise: { label: 'Surprise me', guide: 'Surprise me: an unexpected route that is still true to the character, a reversal, an image or a callback.' },
};

const INSTRUCTION_MAX = 300;
const VOICE_SAMPLES_MAX = 8;
const VOICE_SAMPLE_CHARS = 300;
const VOICE_RULES_MAX = 12;
// A version sharing more than this share of the original's words is too close.
const TOO_CLOSE = 0.6;

// The speakers that are her (JustAWoman in her own voice).
const HER = new Set(['me', 'prime', 'justawoman', 'jawihp']);
const isHer = (speaker) => HER.has(String(speaker || '').trim().toLowerCase());

const STOPWORDS = new Set(`a an the and or but if so of to in on at by for with from up down out off over into onto about as than then that this these those there here
i me my mine myself you your yours yourself we us our ours he him his she her hers it its they them their theirs
is am are was were be been being do does did doing have has had having will would shall should can could may might must
not no nor just very too also only own same such each both all any some more most other what which who whom whose when where why how
let lets let's i'm i've i'll i'd you're you've you'll you'd we're we've we'll it's that's there's what's don't doesn't didn't can't won't isn't aren't wasn't weren't
oh ok okay yes yeah gonna gotta wanna like really now again ever even still get got go going went come came`.split(/\s+/));
// Show terms a rewrite keeps, so they do not count as copied words.
const SHOW_TERMS = new Set(['bestie', 'besties', 'lala', 'lala\'s', 'prime', 'justawoman', 'jawihp', 'coin', 'coins', 'closet', 'episode', 'dream', 'feed', 'login', 'styling', 'adventures']);

/** The spoken words of a line: no speaker prefix, no direction, no surrounding quotes. */
function spokenWords(line) {
  let s = String(line ?? '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^([A-Z][\w .'’-]{0,40}?)(\s*\([^)]*\))?\s*:\s*(.*)$/);
  if (m && !/^(http|https)$/i.test(m[1])) s = m[3];
  s = s.replace(/^\([^)]*\)\s*/, '');
  const q = s.match(/^["“](.*)["”]$/);
  if (q) s = q[1];
  return s.trim();
}

/**
 * The words that count for "the same line": lowercased word tokens minus
 * stopwords, numbers, proper nouns (a capital not opening a sentence) and
 * show terms.
 */
function contentWords(text) {
  const words = new Set();
  const re = /[A-Za-z0-9][A-Za-z0-9'’]*/g;
  const s = String(text || '');
  let m;
  while ((m = re.exec(s)) !== null) {
    const tok = m[0].replace(/’/g, '\'');
    const before = s.slice(0, m.index).trimEnd();
    const opensSentence = before === '' || /[.!?…"“(—-]$/.test(before);
    if (/\d/.test(tok)) continue;
    if (/^[A-Z]/.test(tok) && !opensSentence && tok !== 'I' && !/^I'/.test(tok)) continue;
    const low = tok.toLowerCase().replace(/'s$/, '');
    if (STOPWORDS.has(tok.toLowerCase()) || STOPWORDS.has(low) || SHOW_TERMS.has(low) || low.length < 2) continue;
    words.add(low);
  }
  return words;
}

const normal = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * How much of the original a version reuses: the share of the original's
 * content words found in it (0..1). A version with the same words as the
 * original is 1. An original with fewer than three content words is judged
 * by its whole text only (a short "Hi besties." has nothing to measure).
 */
function overlap(original, version) {
  const a = spokenWords(original);
  const b = spokenWords(version);
  if (normal(a) === normal(b)) return 1;
  const ow = contentWords(a);
  if (ow.size < 3) return 0;
  const vw = contentWords(b);
  let shared = 0;
  for (const w of ow) if (vw.has(w)) shared += 1;
  return shared / ow.size;
}
const tooClose = (original, version) => overlap(original, version) > TOO_CLOSE;

// An angle named by the model, matched to ours; `i` is its place as a fallback.
function angleFor(name, i) {
  const n = String(name || '').toLowerCase();
  if (/tight|short|half/.test(n)) return ANGLES[0].label;
  if (/punch|energ/.test(n)) return ANGLES[1].label;
  if (/angle|new|question|confess|joke/.test(n)) return ANGLES[2].label;
  return ANGLES[Math.min(i, ANGLES.length - 1)].label;
}

const cleanText = (t) => spokenWords(String(t ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ')).slice(0, 600).trim();

/**
 * The versions in a reply: strict JSON {versions:[{angle,text}]}, the same in
 * a code fence or with words around it, or, failing JSON, one version per
 * line ("Tighter: …", "1. …"). Returns [{ angle, text }], possibly empty.
 */
function parseVersions(raw) {
  const text = String(raw || '').trim();
  const unfenced = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let data = null;
  let jsonErr = null;
  for (const candidate of [unfenced, (unfenced.match(/\{[\s\S]*\}/) || [])[0], (unfenced.match(/\[[\s\S]*\]/) || [])[0]]) {
    if (!candidate) continue;
    try { data = JSON.parse(candidate); jsonErr = null; break; } catch (err) { jsonErr = err; data = null; }
  }
  // Not JSON any way: read it line by line, and say so.
  if (jsonErr && text) console.warn('[RewriteLine] reply was not JSON; reading it line by line:', jsonErr.message);
  const list = Array.isArray(data) ? data : Array.isArray(data?.versions) ? data.versions : null;
  let out = [];
  if (list) {
    out = list.map((v, i) => (typeof v === 'string'
      ? { angle: angleFor('', i), text: cleanText(v) }
      : { angle: angleFor(v?.angle, i), text: cleanText(v?.text ?? v?.line ?? '') }));
  } else {
    const lines = unfenced.split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l && !/^[{}[\],]+$/.test(l) && !/^"?versions"?\s*:/i.test(l) && !/^```/.test(l));
    out = lines.map((l, i) => {
      const labelled = l.match(/^(?:[-*•]\s*|\d+[.)]\s*)?\**\s*(tighter|punchier|new angle)\s*\**\s*[:—–-]\s*(.+)$/i);
      if (labelled) return { angle: angleFor(labelled[1], i), text: cleanText(labelled[2]) };
      return { angle: angleFor('', i), text: cleanText(l.replace(/^(?:[-*•]\s*|\d+[.)]\s*)/, '')) };
    });
  }
  const seen = new Set();
  return out.filter((v) => {
    if (!v.text || /^[{}[\]"]/.test(v.text) && /[{}]/.test(v.text)) return false;
    const k = normal(v.text);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, ANGLES.length);
}

/** The Show Brain rules for a rewrite: voice and character first, at most 12. */
function voiceRulesFor(rules) {
  const voice = (r) => (/voice|lala|jawihp|justawoman|character|speak|dialogue|tone/i.test(`${r?.title || ''} ${r?.category || ''}`) ? 0 : 1);
  return [...(rules || [])]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => voice(a.r) - voice(b.r) || a.i - b.i)
    .slice(0, VOICE_RULES_MAX)
    .map(({ r }) => {
      try { const c = JSON.parse(r.content); return `${r.title}: ${c.summary || c.rule || ''}`; } catch { return r.title; } // silent-ok: a rule's content may be plain text; its title stands
    });
}

function speakerVoice(speaker) {
  if (speaker === 'Lala') return 'Write as Lala: confident, short, punchy, calls people "bestie", slightly dramatic, always positive. At most 2 sentences.';
  if (isHer(speaker)) return 'Write as JAWIHP (Prime, JustAWoman in her own voice): warm, direct, addresses "besties", reacts naturally, community-focused.';
  return `Write naturally for ${speaker}.`;
}

/**
 * The prompt. `retry`: the angles to write again, with the versions that
 * came back too close.
 */
function buildPrompt({ line, speaker, beatName, beatContext, beatLines = [], voiceRules = [], voiceSamples = [], direction = null, instruction = '', retry = null }) {
  const angles = retry ? ANGLES.filter((a) => retry.angles.includes(a.label)) : ANGLES;
  const whose = speaker === 'Lala' ? "Lala's other lines in this episode" : isHer(speaker) ? 'her other lines in this episode' : `${speaker}'s other lines in this episode`;
  const parts = [];
  parts.push(`You are rewriting one line of dialogue for "Styling Adventures with Lala." Write ${angles.length === 1 ? 'one new version' : `${angles.length === 3 ? 'THREE' : angles.length} new versions`} of it${angles.length > 1 ? ', each from a different angle' : ''}.`);
  if (voiceRules.length) parts.push(`SHOW BRAIN VOICE RULES (the most relevant):\n${voiceRules.join('\n')}`);
  parts.push([`SPEAKER: ${speaker}`, `BEAT: ${beatName || 'Unknown'}`, beatContext ? `EMOTIONAL CONTEXT: ${beatContext}` : null].filter(Boolean).join('\n'));
  if (beatLines.length) {
    parts.push(`THE BEAT AS IT STANDS (keep the rewrite consistent with it; do not repeat what other lines already say):\n${beatLines.map((l) => (l === line ? `>> ${l}   <- the line to rewrite` : `   ${l}`)).join('\n')}`);
  }
  if (voiceSamples.length) {
    parts.push(`HOW THIS SPEAKER SOUNDS: write like these, ${whose} (style examples only; do not copy them):\n${voiceSamples.map((s) => `- ${s}`).join('\n')}`);
  }
  parts.push(`ORIGINAL LINE: ${line}`);
  parts.push(speakerVoice(speaker));
  parts.push(`THE ANGLES:\n${angles.map((a, i) => `${i + 1}. "${a.label}": ${a.brief}`).join('\n')}`);
  if (direction || instruction) {
    const d = [];
    if (direction && DIRECTIONS[direction]) d.push(`DIRECTION: ${DIRECTIONS[direction].guide}`);
    if (instruction) d.push(`HER NOTE ON HOW TO REWRITE IT: "${instruction}"`);
    d.push(`Every version follows ${direction && instruction ? 'the direction and her note' : direction ? 'this direction' : 'her note'}, and the versions still differ from each other.`);
    parts.push(d.join('\n'));
  }
  parts.push([
    'EACH VERSION MUST BE DIFFERENT FROM THE ORIGINAL:',
    '- Open differently from the original: not the same first words.',
    '- Use a different sentence structure.',
    "- Reuse no more than about a third of the original's words (names, numbers, places and show terms excepted).",
    '- Keep the facts: the coins, the names, the event and what happens stay the same.',
    angles.length > 1 ? '- The versions differ from each other too.' : null,
  ].filter(Boolean).join('\n'));
  if (retry) {
    parts.push(`YOUR LAST VERSIONS FOR THESE ANGLES WERE TOO CLOSE TO THE ORIGINAL:\n${retry.previous.map((v) => `- ${v.angle}: "${v.text}"`).join('\n')}\nWrite bolder versions: change the opening, the structure and most of the words; keep the facts.`);
  }
  parts.push(`Return ONLY strict JSON, no code fences, no commentary:\n{"versions":[${angles.map((a) => `{"angle":"${a.label}","text":"..."}`).join(',')}]}\nEach "text" is the spoken words only: no speaker name, no surrounding quotes.`);
  return parts.join('\n\n');
}

/**
 * Checks the request body. Returns { error } or { value } with the
 * direction, instruction and voice samples cleaned.
 */
function readRewriteOptions(body = {}) {
  const { direction, instruction, voiceSamples } = body;
  let dir = null;
  if (direction !== undefined && direction !== null && direction !== '') {
    if (typeof direction !== 'string' || !Object.prototype.hasOwnProperty.call(DIRECTIONS, direction)) {
      return { error: `direction must be one of: ${Object.keys(DIRECTIONS).join(', ')}` };
    }
    dir = direction;
  }
  let note = '';
  if (instruction !== undefined && instruction !== null) {
    if (typeof instruction !== 'string') return { error: 'instruction must be text' };
    note = instruction.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
    if (note.length > INSTRUCTION_MAX) return { error: `instruction must be at most ${INSTRUCTION_MAX} characters` };
  }
  let samples = [];
  if (voiceSamples !== undefined && voiceSamples !== null) {
    if (!Array.isArray(voiceSamples)) return { error: 'voiceSamples must be a list of lines' };
    if (voiceSamples.length > VOICE_SAMPLES_MAX) return { error: `voiceSamples takes at most ${VOICE_SAMPLES_MAX} lines` };
    for (const s of voiceSamples) {
      if (typeof s !== 'string') return { error: 'voiceSamples must be a list of lines' };
      if (s.length > VOICE_SAMPLE_CHARS) return { error: `each voice sample must be at most ${VOICE_SAMPLE_CHARS} characters` };
    }
    samples = voiceSamples.map((s) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').trim()).filter(Boolean);
  }
  return { value: { direction: dir, instruction: note, voiceSamples: samples } };
}

module.exports = {
  ANGLES, DIRECTIONS, INSTRUCTION_MAX, VOICE_SAMPLES_MAX, VOICE_SAMPLE_CHARS, VOICE_RULES_MAX, TOO_CLOSE,
  spokenWords, contentWords, overlap, tooClose, parseVersions, voiceRulesFor, buildPrompt, readRewriteOptions, isHer,
};
