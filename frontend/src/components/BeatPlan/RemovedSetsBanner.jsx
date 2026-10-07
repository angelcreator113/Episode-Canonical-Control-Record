/**
 * D2 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): "a one-click
 * 'Move my beats to…' for an episode whose beats point at removed sets
 * (choose replacements per removed set)." Lists the removed sets the
 * episode still uses (GET /episodes/:id/removed-sets), a replacement choice
 * for each from the show's library, and one button that moves them all
 * (POST /episodes/:id/move-removed-sets). Shown on the Scenes tab (the
 * Beat Plan re-plans only since S9 d); renders nothing when no removed set
 * is used.
 *
 * Only sets a beat still uses are listed (Evoni, 2026-10-07): the bar said
 * "Some beats point at…" on an episode whose beats all had live scenes,
 * because other leftovers (an old location link, a scene row) also count
 * as uses. Those no longer raise it; the location links are dropped on the
 * server (sceneSetUsesService.dropRemovedSetLinks).
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { fetchAllSceneSets } from '../../lib/fetchAllPages';
import './BeatPlanParts.css';

export default function RemovedSetsBanner({ episodeId, showId, onMoved }) {
  const [removed, setRemoved] = useState([]);
  const [library, setLibrary] = useState([]);
  const [choice, setChoice] = useState({});
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/removed-sets`);
      const sets = Array.isArray(res.data?.data) ? res.data.data : [];
      setRemoved(sets.filter((s) => Array.isArray(s.beats) && s.beats.length > 0));
    } catch (err) {
      console.error('[RemovedSets] load failed:', err);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!removed.length || !showId) return;
    // Every set, not the first 200 (lib/fetchAllPages).
    fetchAllSceneSets(api, showId)
      .then(({ items }) => setLibrary(items))
      .catch((err) => console.error('[RemovedSets] library load failed:', err));
  }, [removed.length, showId]);

  if (!removed.length) return null;
  const ready = removed.every((s) => choice[s.scene_set_id]);

  const move = async () => {
    setMoving(true);
    setError(null);
    try {
      await api.post(`/api/v1/episodes/${episodeId}/move-removed-sets`, {
        moves: removed.map((s) => ({ from: s.scene_set_id, to: choice[s.scene_set_id] })),
      });
      setChoice({});
      await load();
      onMoved?.();
    } catch (err) {
      console.error('[RemovedSets] move failed:', err);
      setError(err.response?.data?.error || 'Could not move the beats');
    }
    setMoving(false);
  };

  return (
    <section className="removed-sets-banner" data-testid="removed-sets-banner" role="alert">
      <p className="removed-sets-title">Some beats point at scene sets you removed. Move them to…</p>
      <ul className="removed-sets-list">
        {removed.map((s) => (
          <li key={s.scene_set_id}>
            <span>{s.name}{s.beats?.length ? ` (beats ${s.beats.join(', ')})` : ''}</span>
            <select
              aria-label={`Replacement for ${s.name}`}
              value={choice[s.scene_set_id] || ''}
              onChange={(e) => setChoice((c) => ({ ...c, [s.scene_set_id]: e.target.value }))}
            >
              <option value="">Choose a set…</option>
              {library.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
      {error && <p className="removed-sets-error">{error}</p>}
      <button type="button" className="removed-sets-move" disabled={!ready || moving} onClick={move}>
        {moving ? 'Moving…' : 'Move my beats'}
      </button>
    </section>
  );
}
