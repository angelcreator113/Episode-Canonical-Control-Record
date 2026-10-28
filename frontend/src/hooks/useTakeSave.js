/**
 * Saving a new Voice Studio take for a line (B2; shared with the
 * Teleprompter in B2b): source → take → tie, each step once. A retry carries
 * on from the step that failed and never uploads the audio twice. The take
 * is never approved here: approval is a separate step in Voice Studio.
 *
 * save(start, line) → one of
 *   { status: 'tied' }
 *   { status: 'untied', reason: 'line_changed' }          saved, not tied: the line changed since it was recorded
 *   { status: 'untied', reason: 'refused', error }       saved, not tied: the server refused the tie (stale script, no such line)
 *   { status: 'refused', error }                         the file itself was refused; trying again cannot help
 *   { status: 'failed', error, done: 'take' | 'source' | null }   press again to carry on (pending is kept)
 * start: { kind: 'recorded' | 'uploaded', media, contextHash? }; line:
 * { scriptRevision, beatNumber, lineIndex, contextHash? } (the line as shown
 * now; a start whose contextHash differs is saved but left untied).
 * error: explainError's { code, message, stale, ... }.
 */
import { useCallback, useState } from 'react';
import { voiceStudioApi, explainError } from '../lib/voiceStudioApi';

// A file the server refused as a file: another try with the same file cannot help.
export const FILE_REFUSED = new Set(['BAD_TYPE', 'NO_AUDIO', 'UNREADABLE', 'NO_DURATION', 'TOO_LONG', 'TOO_BIG', 'NO_FILE']);

export default function useTakeSave(episodeId) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async (start, line) => {
    let p = start;
    setPending(p);
    setBusy(true);
    try {
      if (!p.sourceId) {
        const out = await voiceStudioApi.uploadSource(episodeId, p.media, p.kind);
        p = { ...p, sourceId: out.source.id };
        setPending(p);
      }
      if (!p.candidateId) {
        const out = await voiceStudioApi.createTake(episodeId, p.sourceId);
        p = { ...p, candidateId: out.candidate.id };
        setPending(p);
      }
      // Tied only to the line it was recorded for: if another line is here now, it waits untied.
      if (p.contextHash && line.contextHash && p.contextHash !== line.contextHash) {
        setPending(null);
        return { status: 'untied', reason: 'line_changed' };
      }
      try {
        await voiceStudioApi.tie(episodeId, p.candidateId, { scriptRevision: line.scriptRevision, beatNumber: line.beatNumber, lineIndex: line.lineIndex });
      } catch (err) {
        const e = explainError(err);
        if (e.stale || e.code === 'NO_SUCH_LINE' || e.code === 'DUPLICATE_BEAT') {
          console.error('[useTakeSave] the take was saved but not tied:', e.code || err?.message);
          setPending(null);
          return { status: 'untied', reason: 'refused', error: e };
        }
        throw err;
      }
      setPending(null);
      return { status: 'tied' };
    } catch (err) {
      console.error('[useTakeSave] saving the take failed:', err?.message || err);
      const e = explainError(err, 'The take was not saved.');
      if (FILE_REFUSED.has(e.code)) {
        setPending(null);
        return { status: 'refused', error: e };
      }
      return { status: 'failed', error: e, done: p.candidateId ? 'take' : p.sourceId ? 'source' : null };
    } finally {
      setBusy(false);
    }
  }, [episodeId]);

  const clear = useCallback(() => setPending(null), []);
  return { pending, busy, save, clear };
}
