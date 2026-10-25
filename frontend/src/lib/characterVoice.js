/**
 * Character voices that learn (Evoni, 2026-10-25): every character's voice
 * learns from the lines she approves and the edits she makes. Small learned
 * rules apply by themselves (Undo takes one back); bigger ones wait for her
 * Approve. Voices grow over the season: a rule grown out of is "superseded"
 * and kept, with the episode it came from. The book and the show share one
 * voice per character; each rule and line says where it holds: gameplay,
 * cutscene or narration.
 *
 * /api/v1/voice. Until the database update has run the server answers 409
 * (or 404 while the routes are not there yet); the pages then say so plainly
 * (VOICE_LEARN_NOT_READY) and nothing else breaks.
 */
import api from '../services/api';

const BASE = '/api/v1/voice';

export const VOICE_LEARN_NOT_READY = "Learned voices aren't switched on yet: the database update that adds them hasn't run.";

/** Whether a request failed because the voice tables (or routes) are not there yet. */
export const isVoiceNotReady = (err) => [404, 409].includes(err?.response?.status);

export const voiceApi = {
  character: (characterKey) => api.get(`${BASE}/characters/${encodeURIComponent(characterKey)}`).then((r) => r.data),
  approve: (id) => api.post(`${BASE}/rules/${id}/approve`).then((r) => r.data),
  dismiss: (id) => api.post(`${BASE}/rules/${id}/dismiss`).then((r) => r.data),
  undo: (id) => api.post(`${BASE}/rules/${id}/undo`).then((r) => r.data),
  learn: (characterKey) => api.post(`${BASE}/learn/${encodeURIComponent(characterKey)}`).then((r) => r.data),
  signal: (body) => api.post(`${BASE}/signals`, body).then((r) => r.data),
  speakers: (episodeId) => api.get(`${BASE}/speakers`, { params: { episodeId } }).then((r) => (Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : [])),
  episodeRules: (episodeId) => api.get(`${BASE}/episode/${episodeId}/rules`).then((r) => (Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : [])),
};

export const VOICE_CONTEXTS = [
  { key: 'gameplay', label: 'Gameplay' },
  { key: 'cutscene', label: 'Cutscene' },
  { key: 'narration', label: 'Narration' },
];
export const contextLabel = (key) => VOICE_CONTEXTS.find((c) => c.key === key)?.label || null;

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
// Her names (lib/scriptSpeaker HERS, and the show's long name): one voice, 'justawoman'.
const HER_KEYS = new Set(['justawoman', 'prime', 'me', 'jawihp', 'justawomaninherprime']);
export const HER_KEY = 'justawoman';
export const isHerKey = (v) => HER_KEYS.has(norm(v));

/**
 * The voice key of a registry character: 'justawoman' for her, 'lala' for
 * Lala, else the registry slug (character_key), or the name as a slug.
 */
export function voiceKeyOf(character) {
  if (!character) return null;
  const key = character.character_key || null;
  if (isHerKey(key) || isHerKey(character.display_name) || isHerKey(character.selected_name)) return HER_KEY;
  if (norm(key) === 'lala' || norm(character.display_name) === 'lala') return 'lala';
  if (key) return key;
  const name = character.display_name || character.selected_name || '';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || null;
}

/** Whether something tagged `context` shows under the filter (null context holds everywhere). */
export const inContext = (item, filter) => !filter || filter === 'all' || !item?.context || item.context === filter;

const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

/**
 * The rules as the page shows them: waiting (major, proposed), applied by
 * themselves (small, active and auto_applied), approved (active), and grown
 * out of (superseded), oldest episode first. Dismissed ones are not shown.
 */
export function groupRules(rules = [], filter = 'all') {
  const list = (Array.isArray(rules) ? rules : []).filter((r) => r && inContext(r, filter));
  return {
    waiting: list.filter((r) => r.status === 'proposed').sort(newest),
    autoApplied: list.filter((r) => r.status === 'active' && r.auto_applied).sort(newest),
    active: list.filter((r) => r.status === 'active' && !r.auto_applied).sort(newest),
    earlier: list.filter((r) => r.status === 'superseded')
      .sort((a, b) => (Number(a.from_episode_number) || 0) - (Number(b.from_episode_number) || 0) || newest(b, a)),
  };
}

/** The newest lines first, `limit` of them. */
export function newestLines(lines = [], filter = 'all', limit = 8) {
  return (Array.isArray(lines) ? lines : []).filter((l) => l && inContext(l, filter)).sort(newest).slice(0, limit);
}

const countOf = (v) => (Array.isArray(v) ? v.length : Number(v) || 0);
const rulesWord = (n) => (n === 1 ? 'rule' : 'rules');

/** "2 new rules: 1 applied, 1 waiting for you" from a learn answer. */
export function learnSummary(result) {
  const applied = countOf(result?.applied);
  const waiting = countOf(result?.proposed);
  const total = applied + waiting;
  if (!total) return 'Nothing new to learn yet.';
  return `${total} new ${rulesWord(total)}: ${applied} applied, ${waiting} waiting for you`;
}

/** Where a line came from, as words. */
export const SOURCE_LABELS = { approved: 'Approved', edited: 'Your edit', rewrite: 'Rewrite you kept', book: 'Book' };

/** "Episode 4 · beat 6" or null. */
export function whereLine(line) {
  const parts = [];
  if (line?.episode_number != null) parts.push(`Episode ${line.episode_number}`);
  if (line?.beat_number != null) parts.push(`beat ${line.beat_number}`);
  return parts.length ? parts.join(' · ') : null;
}
