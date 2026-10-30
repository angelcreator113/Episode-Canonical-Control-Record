/**
 * Voice from footage (Voice plan V2; Evoni, 2026-10-30): the Files page's
 * calls to /api/v1/voice-footage. Admin only on the server; off (404)
 * unless VOICE_FROM_FOOTAGE=on. The work is done by the footage-only
 * worker; these only read the status and queue Prepare Voice.
 */
import api from '../services/api';

const base = (episodeId) => `/api/v1/voice-footage/${encodeURIComponent(episodeId)}`;

export const voiceFootageApi = {
  /**
   * { [clipId]: { status, attempt, error, needs_action, waiting_for_retry } },
   * or null when voice from footage is off or not for this person (404/403).
   */
  status: (episodeId) => api.get(`${base(episodeId)}/status`).then(
    (r) => r?.data?.data || {},
    (err) => {
      const code = err?.response?.status;
      if (code === 404 || code === 403 || code === 401) return null;
      throw err;
    },
  ),
  /** Prepare Voice for one clip: resolves the clip's job. */
  prepare: (episodeId, clipId) => api.post(`${base(episodeId)}/clips/${encodeURIComponent(clipId)}/prepare`).then((r) => r?.data?.data),
};

/** Lanes whose footage is prepared (Lala, for now; the server decides). */
export const voiceLane = (performer) => String(performer || '').toLowerCase() === 'lala';

/**
 * The clip card's voice line: { tone, text, canPrepare }. job: the clip's
 * latest job, or undefined when it has none.
 */
export function voiceLine(job) {
  if (!job || job.status === 'cancelled') return { tone: 'none', text: 'Voice not prepared yet', canPrepare: true };
  if (job.status === 'queued') {
    return { tone: 'wait', text: job.waiting_for_retry ? "Lala's voice: trying again shortly" : "Lala's voice: waiting for the voice worker", canPrepare: false };
  }
  if (job.status === 'running') return { tone: 'busy', text: "Preparing Lala's voice…", canPrepare: false };
  if (job.status === 'succeeded') return { tone: 'ok', text: 'Voice ready for Voice Studio', canPrepare: false };
  return { tone: 'bad', text: `Voice not prepared: ${job.error || 'it failed.'}`, canPrepare: true };
}
