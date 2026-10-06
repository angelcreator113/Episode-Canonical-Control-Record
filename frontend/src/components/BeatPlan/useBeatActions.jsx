/**
 * A beat's actions, shared by the Beat Plan page and the episode's Scenes
 * tab (Evoni's ruling L12, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 * editing a beat (B2) with the show's library (L11) and handing a chosen
 * beat back to the plan. A missing image's action is "Open in Scene Sets →"
 * (S8, §8(dd)); no image work happens here.
 *
 * options: episodeId; showToast(msg, type); reload() (re-reads the plan);
 * showId (the episode's show, for the library) or loadShowId() when it is
 * not known yet; linkedIds (the episode's location set ids); fromLabel
 * (the page's name, for Scene Sets' way back).
 * Returns the state and handlers.
 */
import { useState } from 'react';
import api from '../../services/api';
import { fetchAllSceneSets } from '../../lib/fetchAllPages';

export default function useBeatActions({ episodeId, showToast, reload, showId = null, loadShowId = null, linkedIds = new Set(), fromLabel = null }) {
  const [editingBeat, setEditingBeat] = useState(null);
  const [library, setLibrary] = useState(null);
  const [savingBeat, setSavingBeat] = useState(false);

  // L11: the show's library: its own sets and the sets with no show (GET
  // /scene-sets returns every show's), the episode's linked sets first.
  const openEditor = async (beat) => {
    setEditingBeat(beat);
    if (library !== null) return;
    const show = showId || (loadShowId ? await loadShowId() : null);
    if (!show) { setLibrary([]); return; }
    try {
      // Every set, not the first 200 (lib/fetchAllPages).
      const { items } = await fetchAllSceneSets(api, show);
      setLibrary(items.filter((x) => x && x.id && (x.show_id === show || !x.show_id)));
    } catch (err) {
      console.error('[BeatPlan] scene sets load failed:', err);
      showToast(err.response?.data?.error || 'Could not load the scene sets', 'error');
      setLibrary([]);
    }
  };
  const closeEditor = () => setEditingBeat(null);

  const orderedLibrary = library === null ? null : [...library].sort((a, b) =>
    (linkedIds.has(a.id) ? 0 : 1) - (linkedIds.has(b.id) ? 0 : 1)
    || String(a.name || '').localeCompare(String(b.name || '')));

  const saveBeat = async (values) => {
    setSavingBeat(true);
    try {
      const res = await api.put(`/api/v1/episode-brief/${episodeId}/plan/${editingBeat.beat_number}`, values);
      const added = res.data?.location?.added ? res.data.location : null;
      const setName = added && library?.find((x) => x.id === values.scene_set_id)?.name;
      showToast(added
        ? `Beat ${editingBeat.beat_number} saved; “${setName || 'the set'}” joined the episode's locations as ${added.role === 'extra' ? 'an extra' : `its ${added.role}`}`
        : `Beat ${editingBeat.beat_number} saved`);
      setEditingBeat(null);
      await reload();
    } catch (err) {
      console.error('[BeatPlan] beat save failed:', err);
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSavingBeat(false);
    }
  };

  const releaseBeat = async () => {
    setSavingBeat(true);
    try {
      await api.put(`/api/v1/episode-brief/${episodeId}/plan/${editingBeat.beat_number}`, { chosen: false });
      showToast(`Beat ${editingBeat.beat_number} is the plan's to choose again`);
      setEditingBeat(null);
      await reload();
    } catch (err) {
      console.error('[BeatPlan] beat release failed:', err);
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSavingBeat(false);
    }
  };

  // S8 (Evoni, 2026-10-02; §8(dd)): a missing angle's only action is
  // "Open in Scene Sets →" on its set and zone; the Beat Plan and the Scenes
  // tab no longer create, upload or generate angles.
  const missingPropsFor = () => ({ showId, fromLabel });

  return {
    editingBeat, openEditor, closeEditor, library: orderedLibrary, savingBeat, saveBeat, releaseBeat,
    missingPropsFor,
  };
}
