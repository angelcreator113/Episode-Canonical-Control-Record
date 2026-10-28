/**
 * Her learned reading pace (Evoni, 2026-10-28), for the Script tab and the
 * teleprompter. Works it out from this episode's takes (lib/learnedPace),
 * puts this episode's figures with the show's others (kept on the show,
 * lib/readingPaceApi; a copy on this device), and saves them again when
 * her takes change. `use` is her switch: 'mine' or 'standard'.
 *
 * clips: the episode's raw clips when the caller has them (the
 * teleprompter); undefined, and the hook loads them itself.
 * Returns { pace, episodePace, use, setUse, active, text, beatTimes }:
 * `active` is what the estimates take (lib/scriptRuntime lineWpm), null
 * for the standard one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { rawClipsApi } from '../lib/rawClipsApi';
import { readingPaceApi, readLocalPace, writeLocalPace } from '../lib/readingPaceApi';
import { learnedPace, combinePace, withEpisode, activePace, paceText, PERFORMER } from '../lib/learnedPace';

// The beat's script lines: `raw` when it is a list (a teleprompter beat), else `lines` (lib/learnedPace).
const linesOf = (b) => (Array.isArray(b?.raw) ? b.raw : Array.isArray(b?.lines) ? b.lines : []);
const beatsKey = (beats) => (Array.isArray(beats) ? beats : []).map((b) => `${b?.number}\u0002${linesOf(b).map(String).join('\n')}`).join('\u0001');
const sameRatios = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

export default function useReadingPace({ showId = null, episodeId = null, beats = [], clips = undefined, performer = PERFORMER } = {}) {
  const [stored, setStored] = useState(() => readLocalPace(showId));
  const [ownClips, setOwnClips] = useState(null);
  const loadedClips = clips !== undefined ? clips : ownClips;

  // The show's kept pace (this device's copy until it comes).
  useEffect(() => {
    setStored(readLocalPace(showId));
    if (!showId) return undefined;
    let live = true;
    Promise.resolve().then(() => readingPaceApi.get(showId))
      .then((data) => { if (live && data && typeof data === 'object' && !Array.isArray(data)) { setStored(data); writeLocalPace(showId, data); } })
      .catch((err) => console.error('[readingPace] the show\'s pace could not be loaded; using this device\'s copy:', err));
    return () => { live = false; };
  }, [showId]);

  // The episode's takes, when the caller has not got them.
  useEffect(() => {
    if (clips !== undefined || !episodeId) return undefined;
    let live = true;
    Promise.resolve().then(() => rawClipsApi.list(episodeId))
      .then((rows) => { if (live) setOwnClips(Array.isArray(rows) ? rows : []); })
      .catch((err) => console.error('[readingPace] the takes could not be loaded to learn your pace:', err));
    return () => { live = false; };
  }, [clips, episodeId]);

  const key = beatsKey(beats);
  const episodePace = useMemo(
    () => (loadedClips ? learnedPace(beats, loadedClips, { performer }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, loadedClips, performer],
  );

  const mine = stored?.[performer] || {};
  const use = mine.use === 'standard' ? 'standard' : 'mine';
  const entries = useMemo(
    () => (episodePace && episodeId ? withEpisode(mine.episodes || {}, episodeId, episodePace) : (mine.episodes || {})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [episodePace, episodeId, stored, performer],
  );
  const pace = useMemo(() => combinePace(entries), [entries]);

  // Her takes changed this episode's figures: keep them on the show.
  const sentRef = useRef(null);
  useEffect(() => {
    if (!episodePace || !episodeId) return;
    const before = mine.episodes?.[episodeId]?.ratios || [];
    if (sameRatios(before, episodePace.ratios)) return;
    const sending = `${showId}|${episodeId}|${JSON.stringify(episodePace.ratios)}`;
    if (sentRef.current === sending) return;
    sentRef.current = sending;
    const local = { ...(stored || {}), [performer]: { use, episodes: withEpisode(mine.episodes || {}, episodeId, episodePace) } };
    writeLocalPace(showId, local);
    if (!showId) { setStored(local); return; }
    Promise.resolve().then(() => readingPaceApi.save(showId, { performer, episode_id: String(episodeId), ratios: episodePace.ratios, takes: episodePace.takesUsed }))
      .then((data) => { setStored(data); writeLocalPace(showId, data); })
      .catch((err) => { console.error('[readingPace] your pace was not saved to the show; kept on this device:', err); setStored(local); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodePace, episodeId, showId]);

  const setUse = (next) => {
    const value = next === 'standard' ? 'standard' : 'mine';
    const local = { ...(stored || {}), [performer]: { episodes: mine.episodes || {}, use: value } };
    setStored(local);
    writeLocalPace(showId, local);
    if (!showId) return;
    Promise.resolve().then(() => readingPaceApi.save(showId, { performer, use: value }))
      .then((data) => { setStored(data); writeLocalPace(showId, data); })
      .catch((err) => console.error('[readingPace] the switch was not saved to the show; kept on this device:', err));
  };

  return {
    pace, episodePace, use, setUse,
    active: activePace(pace, use),
    text: paceText(pace),
    beatTimes: episodePace?.beatTimes || {},
  };
}
