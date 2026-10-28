/**
 * Voice Studio (B2; Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 7):
 * the page's calls to the B1 services at /api/v1/voice-studio/:episodeId.
 * Every write sends what the page read, so a change made elsewhere since is
 * refused by the server (409) and nothing is written:
 *   - tying and approving send script_revision (the saved script the page shows);
 *   - approving sends the take's latest revision and the approval the page
 *     saw at the line (expected_approval_id, null for none);
 *   - re-confirming sends each approval with the line's context the page showed.
 * The server is the only judge of a line and an approval's state; nothing
 * here decides one.
 */
import api from '../services/api';
import { voiceExtension } from './voiceClipsApi';

const base = (episodeId) => `/api/v1/voice-studio/${encodeURIComponent(episodeId)}`;
const data = (r) => r?.data?.data;
// A request holding a recording that exists only in this tab never wipes the
// session or retries a file by itself (api.js keepSession).
const KEEP = { keepSession: true, timeout: 0 };

let statusOnce = null;
/** Whether Voice Studio is switched on on this server (asked once per page load); false when off or unreachable. */
export function voiceStudioOn() {
  statusOnce ||= api.get('/api/v1/voice-studio/status').then(() => true, (err) => {
    if (err?.response?.status !== 404) console.error('[voiceStudio] status check failed:', err?.message);
    return false;
  });
  return statusOnce;
}
/** For tests. */
export const resetVoiceStudioStatus = () => { statusOnce = null; };

export const voiceStudioApi = {
  view: (episodeId) => api.get(`${base(episodeId)}/studio`).then(data),
  history: (episodeId) => api.get(`${base(episodeId)}/approvals/history`).then(data),

  /** A recording or an uploaded file as a source. take: { blob | file, type }. */
  uploadSource: (episodeId, { blob, file, type }, kind) => {
    const form = new FormData();
    if (file) form.append('audio', file, file.name);
    else form.append('audio', blob, `voice-take${voiceExtension(type || blob?.type)}`);
    form.append('kind', kind);
    return api.post(`${base(episodeId)}/sources`, form, KEEP).then(data);
  },
  createTake: (episodeId, sourceId, label = null) =>
    api.post(`${base(episodeId)}/candidates`, { source_asset_id: sourceId, label }, KEEP).then(data),
  revise: (episodeId, candidateId, settings) =>
    api.post(`${base(episodeId)}/candidates/${candidateId}/revisions`, settings).then(data),
  tie: (episodeId, candidateId, { scriptRevision, beatNumber, lineIndex }) =>
    api.post(`${base(episodeId)}/candidates/${candidateId}/associate`, { script_revision: scriptRevision, beat_number: beatNumber, line_index: lineIndex }, KEEP).then(data),
  approve: (episodeId, candidateId, { revisionId, scriptRevision, expectedApprovalId }) =>
    api.post(`${base(episodeId)}/candidates/${candidateId}/approve`, {
      candidate_revision_id: revisionId, script_revision: scriptRevision, expected_approval_id: expectedApprovalId ?? null,
    }).then(data),
  resolve: (episodeId, approvalId, { scriptRevision, lineIndex, expectedApprovalId }) =>
    api.post(`${base(episodeId)}/approvals/${approvalId}/resolve`, {
      script_revision: scriptRevision, line_index: lineIndex, expected_approval_id: expectedApprovalId ?? null,
    }).then(data),
  revoke: (episodeId, approvalId) => api.post(`${base(episodeId)}/approvals/${approvalId}/revoke`, {}).then(data),
  reconfirm: (episodeId, scriptRevision, items) =>
    api.post(`${base(episodeId)}/reconfirm`, { script_revision: scriptRevision, items }).then(data),
  removeTake: (episodeId, candidateId) => api.delete(`${base(episodeId)}/candidates/${candidateId}`).then(data),
};

/** The kinds of refusal a page offers "Reload" for: what it read is out of date. */
const STALE = new Set(['SCRIPT_CHANGED', 'SCRIPT_REVISION_REQUIRED', 'APPROVAL_CHANGED', 'NOT_LATEST_REVISION', 'SEGMENT_REPLACED']);

const MESSAGES = {
  SCRIPT_CHANGED: 'The script was saved since this page loaded, so nothing was changed. Reload to see the lines as they are now.',
  SCRIPT_REVISION_REQUIRED: 'This page is out of date, so nothing was changed. Reload, then try again.',
  APPROVAL_CHANGED: 'Another approval was made for this line since this page loaded, so nothing was changed. Reload to see it before approving.',
  NOT_LATEST_REVISION: "This take's trim or level was changed since this page loaded, so nothing was approved. Reload and approve its current version.",
  LINE_HAS_UNRESOLVED_APPROVAL: 'This line holds an approval whose line moved or is ambiguous. Confirm where that one belongs, or withdraw it, first.',
  NOT_ASSOCIATED: 'Tie the take to its line before approving it.',
  NOT_BOUND: "This take's line changed, so it was not approved. Tie it to the line again.",
  PRIME_LINE: "Prime's lines use her own take, not a voice take.",
  NOT_DIALOGUE: 'Only spoken lines take a voice take.',
  DUPLICATE_BEAT: 'The script has two beats with this number, so lines in it cannot be tied safely. Fix the beat numbers in the Script tab.',
  NO_SUCH_LINE: 'That line is no longer in the script. Reload.',
  BAD_TYPE: "That file type can't be used. Use an audio file (.m4a, .mp3, .wav, .webm, .ogg, .opus, .aac).",
  NO_AUDIO: 'That file has no audio in it.',
  UNREADABLE: "That file isn't audio the server can read.",
  NO_DURATION: 'That file has no length the server can read.',
  TOO_LONG: 'That take is too long (10 minutes at most).',
  NO_FILE: 'No audio was sent. Try again.',
  VOICE_STUDIO_OFF: "Voice Studio isn't switched on here.",
  AUTH_GROUP_REQUIRED: 'Voice Studio is for admins only. Sign in with an admin account to record, review or approve takes.',
  NOT_FOUND: 'That take or approval is no longer there. Reload.',
};

/**
 * What to tell the person, from a failed request: { message, code, stale,
 * offline, sessionExpired }. Unknown codes show the server's own words.
 */
export function explainError(err, fallback = 'Something went wrong. Nothing was changed.') {
  const res = err?.response;
  const body = res?.data || {};
  const code = body.code || null;
  if (err?.sessionExpired) {
    return { code: 'SESSION', message: 'Your sign-in ended. Sign in again in another tab, then try again here: what you recorded is still on this page.', stale: false, offline: false, sessionExpired: true };
  }
  if (!res) {
    return { code: 'OFFLINE', message: "Couldn't reach the server, so nothing was saved. Check the connection and try again: what you recorded is still on this page.", stale: false, offline: true, sessionExpired: false };
  }
  if (res.status === 413) return { code: 'TOO_BIG', message: 'That file is too big to upload.', stale: false, offline: false, sessionExpired: false };
  let message = MESSAGES[code] || body.error || fallback;
  // The server's words name why the line no longer binds (moved, words changed…).
  if (code === 'NOT_BOUND' && body.error) message = `${body.error} Nothing was approved.`;
  return { code, message, stale: STALE.has(code), offline: false, sessionExpired: false };
}
