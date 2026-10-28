/**
 * Saving takes while they record (Evoni, 2026-10-28), for the teleprompter
 * and the phone that records behind the glass: one lib/liveUpload per take,
 * fed by useTakeRecorder's `listener`. Pass `listener` to useTakeRecorder;
 * begin a take with rec.begin({ tag: { filename, fields } }).
 *
 *   episodeId   where the takes go (no episode: nothing is uploaded live)
 *   onState(takeId, state)  the upload as Retry needs it, after every part
 *               (keep it with the take: meta.upload), null when it is gone
 *
 * Returns { listener, finish(takeId, recording, finished), settled(takeId),
 * abort(takeId), forget(takeId), info(takeId) }: finish at Stop, settled
 * before Save (so a take is never uploaded twice: Save waits for the parts
 * still going up), abort on Discard or Retake, forget once saved, info for
 * "Saved while recording: 92%".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLiveUpload } from '../lib/liveUpload';
import { takeExtension } from '../lib/teleprompterLines';

export default function useLiveUpload({ episodeId = null, onState, create = createLiveUpload } = {}) {
  const takesRef = useRef(new Map()); // takeId → controller
  const finishRef = useRef(new Map()); // takeId → finish() promise
  const [infos, setInfos] = useState({});
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const episodeRef = useRef(episodeId);
  episodeRef.current = episodeId;

  const listener = useMemo(() => ({
    onStart: (id, { type, tag } = {}) => {
      const ep = episodeRef.current;
      if (!ep || !tag?.fields?.performer) return;
      const ext = takeExtension(type);
      const filename = tag.filename ? `${tag.filename}.${ext}` : `take.${ext}`;
      const ctl = create({
        episodeId: ep, filename, contentType: type || 'video/webm', fields: tag.fields,
        onState: (st) => onStateRef.current?.(id, st),
        onChange: (snap) => setInfos((m) => ({ ...m, [id]: snap })),
      });
      takesRef.current.set(id, ctl);
    },
    onChunk: (id, _seq, blob) => { takesRef.current.get(id)?.push(blob); },
    // Stopped: no upload starts now (a take shorter than a part goes up whole at Save).
    onStop: (id) => { takesRef.current.get(id)?.stop(); },
    onDiscard: (id) => {
      const ctl = takesRef.current.get(id);
      if (!ctl) return;
      takesRef.current.delete(id);
      finishRef.current.delete(id);
      ctl.abort().catch((err) => console.error('[useLiveUpload] upload not thrown away:', err));
    },
  }), [create]);

  /** At Stop: the last parts go up. Resolves the state for Save, or null (Save uploads it whole). */
  const finish = useCallback((takeId, recording, finished) => {
    if (finishRef.current.has(takeId)) return finishRef.current.get(takeId);
    const ctl = takesRef.current.get(takeId);
    if (!ctl) return Promise.resolve(null);
    const p = ctl.finish(recording, finished).catch((err) => {
      console.error('[useLiveUpload] finishing the upload failed; Save sends the rest:', err);
      return ctl.state;
    });
    finishRef.current.set(takeId, p);
    return p;
  }, []);

  /** Waits for the parts still going up for this take (none: at once). */
  const settled = useCallback((takeId) => finishRef.current.get(takeId) || Promise.resolve(null), []);

  const abort = useCallback((takeId) => listener.onDiscard(takeId), [listener]);

  /** Saved: forgets the take's upload without throwing it away (it is the clip now). */
  const forget = useCallback((takeId) => {
    takesRef.current.get(takeId)?.detach();
    takesRef.current.delete(takeId);
    finishRef.current.delete(takeId);
  }, []);

  const info = useCallback((takeId) => (takeId ? infos[takeId] || null : null), [infos]);

  // Leaving: the parts stop going up, but nothing is thrown away (Retry carries on).
  useEffect(() => () => { takesRef.current.forEach((ctl) => ctl.detach()); }, []);

  return { listener, finish, settled, abort, forget, info };
}
