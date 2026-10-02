/**
 * A beat's actions, shared by the Beat Plan page and the episode's Scenes
 * tab (Evoni's ruling L12, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 * editing a beat (B2) with the show's library (L11), handing a chosen beat
 * back to the plan, and the missing-image actions (L4, Q19), which make
 * the dressed angle at a set the episode's event has a look on (L10).
 *
 * options: episodeId; showToast(msg, type); reload() (re-reads the plan);
 * showId (the episode's show, for the library) or loadShowId() when it is
 * not known yet; linkedIds (the episode's location set ids).
 * Returns the state and handlers, and `dialogs`: the cost-first confirm
 * (S2) for a generated angle, rendered by the page.
 */
import { useState } from 'react';
import api from '../../services/api';
import SceneBriefConfirm from '../SceneBriefConfirm';

export default function useBeatActions({ episodeId, showToast, reload, showId = null, loadShowId = null, linkedIds = new Set() }) {
  const [editingBeat, setEditingBeat] = useState(null);
  const [library, setLibrary] = useState(null);
  const [savingBeat, setSavingBeat] = useState(false);
  const [angleBusy, setAngleBusy] = useState(null); // beat number
  const [angleBrief, setAngleBrief] = useState(null); // { beat, setId, angleId, name, dressed }

  // L11: the show's library: its own sets and the sets with no show (GET
  // /scene-sets returns every show's), the episode's linked sets first.
  const openEditor = async (beat) => {
    setEditingBeat(beat);
    if (library !== null) return;
    const show = showId || (loadShowId ? await loadShowId() : null);
    if (!show) { setLibrary([]); return; }
    try {
      const res = await api.get(`/api/v1/scene-sets?show_id=${show}&limit=200`);
      setLibrary((res.data?.data || []).filter((x) => x && x.id && (x.show_id === show || !x.show_id)));
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

  // The missing angle (Q19): the angle the beat asks for, created when it
  // does not exist yet; an unlocked beat is pointed at it.
  const ensureAngle = async (beat) => {
    const missing = beat.location.missing;
    const setId = beat.scene_set_id;
    let angleId = missing.angle_id;
    let label = missing.label;
    const name = missing.name || 'New angle';
    if (!angleId) {
      const res = await api.post(`/api/v1/scene-sets/${setId}/angles`, {
        angle_label: label || 'OTHER',
        angle_name: name || 'New angle',
        angle_kind: missing.kinds?.[0] || missing.kind || null,
        beat_affinity: [beat.beat_number],
      });
      angleId = res.data?.data?.id;
      label = res.data?.data?.angle_label || label;
      if (!angleId) throw new Error('The angle was not created');
    }
    if (!beat.locked && label && beat.angle_label !== label) {
      await api.put(`/api/v1/episode-brief/${episodeId}/plan/${beat.beat_number}`, { angle_label: label });
    }
    return { setId, angleId, name };
  };

  // L10: at the look's set the image is the dressed angle, stored per look.
  const dressedPath = (angleId) => `/api/v1/episode-brief/${episodeId}/dressed-angles/${angleId}`;

  const uploadAngle = async (beat, file) => {
    setAngleBusy(beat.beat_number);
    try {
      const { setId, angleId } = await ensureAngle(beat);
      const form = new FormData();
      form.append('images', file);
      const url = beat.location?.look ? `${dressedPath(angleId)}/upload` : `/api/v1/scene-sets/${setId}/angles/${angleId}/upload`;
      await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`Beat ${beat.beat_number}: image uploaded`);
    } catch (err) {
      console.error('[BeatPlan] angle upload failed:', err);
      showToast(err.response?.data?.error || err.message || 'Upload failed', 'error');
    } finally {
      setAngleBusy(null);
      await reload();
    }
  };

  const generateAngle = async (beat) => {
    setAngleBusy(beat.beat_number);
    try {
      const target = await ensureAngle(beat);
      setAngleBrief({ beat, ...target, dressed: Boolean(beat.location?.look) });
    } catch (err) {
      console.error('[BeatPlan] angle create failed:', err);
      showToast(err.response?.data?.error || err.message || 'Could not create the angle', 'error');
      setAngleBusy(null);
    }
  };

  const confirmGenerateAngle = async (overrides) => {
    const { beat, setId, angleId, dressed } = angleBrief;
    setAngleBrief(null);
    try {
      await api.post(dressed ? `${dressedPath(angleId)}/generate` : `/api/v1/scene-sets/${setId}/angles/${angleId}/generate`, { overrides });
      showToast(`Beat ${beat.beat_number}: ${dressed ? 'dressing the angle from the event\'s look' : 'generating the angle'}`);
    } catch (err) {
      console.error('[BeatPlan] angle generate failed:', err);
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setAngleBusy(null);
      await reload();
    }
  };

  const cancelGenerateAngle = async () => {
    setAngleBrief(null);
    setAngleBusy(null);
    await reload();
  };

  const missingPropsFor = (beat) => ({ onUpload: uploadAngle, onGenerate: generateAngle, busy: angleBusy === beat.beat_number });

  const dialogs = angleBrief ? (
    <SceneBriefConfirm
      setId={angleBrief.setId}
      angleId={angleBrief.angleId}
      title={`Generate the ${angleBrief.name.toLowerCase()} angle for beat ${angleBrief.beat.beat_number}`}
      note={angleBrief.dressed ? "Made from the event's look: the same dressed room, from this angle." : null}
      requestBrief={angleBrief.dressed ? (body) => api.post(`${dressedPath(angleBrief.angleId)}/brief`, { overrides: body.overrides }) : null}
      onConfirm={(overrides) => confirmGenerateAngle(overrides)}
      onCancel={cancelGenerateAngle}
    />
  ) : null;

  return {
    editingBeat, openEditor, closeEditor, library: orderedLibrary, savingBeat, saveBeat, releaseBeat,
    missingPropsFor, dialogs,
  };
}
