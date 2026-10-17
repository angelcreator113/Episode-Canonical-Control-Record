/**
 * Production › Scenes: the scene workspace (Evoni's Production mock,
 * 2026-10-17). Left, the episode's scenes in story order (the 14 beats of
 * its plan) with each one's picture, location, length and status. Middle,
 * the chosen scene: its linked clip playing (the cut-out when the green was
 * removed), else its picture; below, its location's angles, and picking one
 * makes it the scene's angle. Right, the scene's details (location, type,
 * time of day, shot, the director's note, which saves) and quick actions.
 *
 * Reads: the plan (GET /episode-brief/:id/plan), the clips
 * (GET /episode-clips/:id; a clip is linked to a scene in Files), and the
 * chosen scene's set with its angles (GET /scene-sets/:id). Writes go
 * through the plan's routes (PUT /plan/:beat, POST /plan/:beat/lock).
 * The full plan editor stays one tab over, on Beat Plan.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clapperboard, Lock, LockOpen, Film, FolderOpen, Pencil, MapPin, Clock, Sun, Plus, ImageOff, CircleCheck, Circle, Save,
} from 'lucide-react';
import api from '../../services/api';
import { rawClipsApi, clipLength } from '../../lib/rawClipsApi';
import { beatImage, beatSetName, fmtType, SHOT_LABELS } from '../BeatPlan/BeatPlanParts';
import { sceneSetPath } from '../../utils/sceneSets';
import './EpisodeSceneWorkspace.css';

export const getPlanApi = (episodeId) => api.get(`/api/v1/episode-brief/${episodeId}/plan`);
export const getSceneSetApi = (setId) => api.get(`/api/v1/scene-sets/${setId}`);
export const saveBeatApi = (episodeId, beatNumber, body) => api.put(`/api/v1/episode-brief/${episodeId}/plan/${beatNumber}`, body);
export const toggleLockApi = (episodeId, beatNumber) => api.post(`/api/v1/episode-brief/${episodeId}/plan/${beatNumber}/lock`);

/** A scene's clips, newest first; the playable source of one (the cut-out when there is one). */
export const clipsFor = (clips, beatNumber) => (clips || [])
  .filter((c) => Number(c.beat_number) === Number(beatNumber))
  .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
export const clipSource = (clip) => clip?.url_cutout || clip?.url_raw || null;

/** A scene's length: its linked clips added up, in seconds; null when none has a length. */
export function sceneSeconds(clips, beatNumber) {
  const total = clipsFor(clips, beatNumber).reduce((n, c) => n + (Number(c.duration_seconds) || 0), 0);
  return total > 0 ? total : null;
}

const angleImage = (a) => a?.still_image_url || a?.thumbnail_url || null;
const angleName = (a) => a?.angle_name || a?.angle_label || 'Angle';

export default function EpisodeSceneWorkspace({ episode, onOpenTab, onToast }) {
  const episodeId = episode?.id;
  const showId = episode?.show_id || episode?.showId || null;
  const [plan, setPlan] = useState([]);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sets, setSets] = useState({});
  // Which of a scene's clips plays: the choice belongs to the scene it was made on.
  const [clipPick, setClipPick] = useState({ beat: null, index: 0 });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const toast = useCallback((msg, type = 'info') => { if (onToast) onToast(msg, type); }, [onToast]);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      const [planRes, clipRows] = await Promise.all([
        getPlanApi(episodeId),
        Promise.resolve().then(() => rawClipsApi.list(episodeId)).catch((err) => { console.error('[Scenes] clips load failed:', err); return []; }),
      ]);
      const beats = Array.isArray(planRes?.data?.data) ? [...planRes.data.data].sort((a, b) => a.beat_number - b.beat_number) : [];
      setPlan(beats);
      setClips(Array.isArray(clipRows) ? clipRows : []);
      setSelected((cur) => (cur && beats.some((b) => b.beat_number === cur) ? cur : beats[0]?.beat_number ?? null));
      setError(null);
    } catch (err) {
      console.error('[Scenes] plan load failed:', err);
      setError('Could not load the scenes.');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  const beat = useMemo(() => plan.find((b) => b.beat_number === selected) || null, [plan, selected]);
  const set = beat?.scene_set_id ? sets[beat.scene_set_id] : null;

  // The chosen scene's location, with its angles (read once per set).
  useEffect(() => {
    const id = beat?.scene_set_id;
    if (!id || sets[id]) return undefined;
    let live = true;
    getSceneSetApi(id)
      .then((res) => { if (live) setSets((s) => ({ ...s, [id]: res?.data?.data || {} })); })
      .catch((err) => { console.error('[Scenes] scene set load failed:', err); if (live) setSets((s) => ({ ...s, [id]: {} })); });
    return () => { live = false; };
  }, [beat?.scene_set_id, sets]);

  useEffect(() => { setNote(beat?.director_note || ''); }, [beat?.beat_number, beat?.director_note]);

  const sceneClips = clipsFor(clips, selected);
  const clipIndex = clipPick.beat === selected ? clipPick.index : 0;
  const clip = sceneClips[clipIndex] || sceneClips[0] || null;
  const angles = Array.isArray(set?.angles) ? set.angles : [];
  const chosenAngle = angles.find((a) => a.angle_label && a.angle_label === beat?.angle_label) || null;
  const picture = beat ? (angleImage(chosenAngle) || beatImage(beat)) : null;

  const linkedCount = new Set(clips.map((c) => Number(c.beat_number)).filter(Boolean)).size;
  const totalSeconds = plan.reduce((n, b) => n + (sceneSeconds(clips, b.beat_number) || 0), 0);

  const saveBeat = async (body, done) => {
    if (!beat) return;
    if (beat.locked) { toast('This scene is locked. Unlock it to change it.', 'error'); return; }
    setSaving(true);
    try {
      await saveBeatApi(episodeId, beat.beat_number, body);
      toast(done, 'success');
      await load();
    } catch (err) {
      console.error('[Scenes] save failed:', err);
      toast(err?.response?.data?.error || 'Could not save the scene.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async () => {
    if (!beat) return;
    setSaving(true);
    try {
      await toggleLockApi(episodeId, beat.beat_number);
      toast(beat.locked ? `Scene ${beat.beat_number} unlocked` : `Scene ${beat.beat_number} locked`, 'success');
      await load();
    } catch (err) {
      console.error('[Scenes] lock failed:', err);
      toast(err?.response?.data?.error || 'Could not change the lock.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="esw-note">Loading scenes…</p>;
  if (error) return <p className="esw-error" role="alert">{error}</p>;
  if (!plan.length) {
    return (
      <div className="esw-empty">
        <Clapperboard size={36} aria-hidden />
        <p>This episode has no scenes yet. Its scenes come from the beat plan.</p>
        <button type="button" className="esw-btn is-primary" onClick={() => onOpenTab?.('beatplan')}>Open the Beat Plan</button>
      </div>
    );
  }

  return (
    <div className="esw">
      {/* The scenes */}
      <section className="esw-card esw-list" aria-label="Scenes">
        <header className="esw-card-head">
          <h3 className="esw-card-title"><Clapperboard size={18} aria-hidden /> Scenes</h3>
          <span className="esw-count">{linkedCount} of {plan.length} with a clip{totalSeconds ? ` · ${clipLength(totalSeconds)}` : ''}</span>
        </header>
        <ol className="esw-scenes">
          {plan.map((b) => {
            const img = beatImage(b);
            const secs = sceneSeconds(clips, b.beat_number);
            const hasClip = clipsFor(clips, b.beat_number).length > 0;
            return (
              <li key={b.beat_number}>
                <button type="button" className={`esw-scene${b.beat_number === selected ? ' is-on' : ''}`} onClick={() => setSelected(b.beat_number)}
                  aria-current={b.beat_number === selected ? 'true' : undefined} data-testid={`esw-scene-${b.beat_number}`}>
                  <span className="esw-scene-img">
                    {img ? <img src={img} alt="" loading="lazy" /> : <ImageOff size={18} aria-hidden />}
                    {secs && <span className="esw-scene-len">{clipLength(secs)}</span>}
                  </span>
                  <span className="esw-scene-text">
                    <span className="esw-scene-name">{String(b.beat_number).padStart(2, '0')} {b.beat_name || `Beat ${b.beat_number}`}</span>
                    <span className="esw-scene-where">{beatSetName(b, 'No location')}</span>
                  </span>
                  <span className="esw-scene-marks">
                    {hasClip && <Film size={14} aria-label="Has a clip" />}
                    {b.locked ? <CircleCheck size={18} className="is-locked" aria-label="Locked" /> : <Circle size={18} aria-label="Not locked" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The chosen scene */}
      <section className="esw-card esw-stage" aria-label={`Scene ${beat?.beat_number}`}>
        <div className="esw-player">
          {clip ? (
            <video key={clipSource(clip)} src={clipSource(clip)} controls playsInline data-testid="esw-video" className={clip.url_cutout ? 'is-cutout' : ''} />
          ) : picture ? (
            <img src={picture} alt={`Scene ${beat.beat_number}`} data-testid="esw-picture" />
          ) : (
            <div className="esw-player-empty"><ImageOff size={28} aria-hidden /><span>No picture or clip yet</span></div>
          )}
        </div>
        {sceneClips.length > 1 && (
          <div className="esw-clip-pick" role="group" aria-label="Clips for this scene">
            {sceneClips.map((c, i) => (
              <button key={c.id} type="button" className={i === clipIndex ? 'is-on' : ''} aria-pressed={i === clipIndex} onClick={() => setClipPick({ beat: selected, index: i })}>
                {c.label || `Clip ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {!clip && (
          <p className="esw-hint">
            No clip linked to this scene. <button type="button" className="esw-link" onClick={() => onOpenTab?.('files')}>Link one in Files</button>
          </p>
        )}

        <div className="esw-angles-head">
          <h3 className="esw-card-title">Angles</h3>
          {set?.id && showId && <Link className="esw-link" to={sceneSetPath(showId, set.id)}><Pencil size={13} aria-hidden /> Open in Scene Sets</Link>}
        </div>
        {!beat?.scene_set_id ? (
          <p className="esw-note">This scene has no location yet. Choose one on the Beat Plan.</p>
        ) : !set ? (
          <p className="esw-note">Loading angles…</p>
        ) : (
          <ul className="esw-angles">
            {angles.map((a) => {
              const on = a.angle_label && a.angle_label === beat.angle_label;
              return (
                <li key={a.id}>
                  <button type="button" className={`esw-angle${on ? ' is-on' : ''}`} aria-pressed={on} disabled={saving || on}
                    onClick={() => saveBeat({ angle_label: a.angle_label, chosen: true }, `Scene ${beat.beat_number}: ${angleName(a)}`)}>
                    <span className="esw-angle-img">{angleImage(a) ? <img src={angleImage(a)} alt="" loading="lazy" /> : <ImageOff size={18} aria-hidden />}</span>
                    <span className="esw-angle-name">{angleName(a)}</span>
                  </button>
                </li>
              );
            })}
            {showId && (
              <li>
                <Link className="esw-angle is-add" to={sceneSetPath(showId, set.id, { from: `/episodes/${episodeId}?tab=scenes`, fromLabel: 'Production' })}>
                  <span className="esw-angle-img"><Plus size={22} aria-hidden /></span>
                  <span className="esw-angle-name">Add angle</span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Details and quick actions */}
      <aside className="esw-side">
        <section className="esw-card" aria-label="Scene details">
          <header className="esw-card-head">
            <h3 className="esw-card-title">Scene details</h3>
            <span className="esw-count">Scene {beat?.beat_number} of {plan.length}</span>
          </header>
          <dl className="esw-details">
            <div><dt>Scene</dt><dd>{beat?.beat_name || `Beat ${beat?.beat_number}`}</dd></div>
            <div><dt><MapPin size={13} aria-hidden /> Location</dt><dd>{beat ? beatSetName(beat, 'None yet') : '—'}</dd></div>
            <div><dt>Scene type</dt><dd>{fmtType(set?.scene_type || beat?.sceneSet?.scene_type) || '—'}</dd></div>
            <div><dt><Sun size={13} aria-hidden /> Time of day</dt><dd>{fmtType(set?.time_of_day) || '—'}</dd></div>
            <div><dt>Shot</dt><dd>{SHOT_LABELS[beat?.shot_type] || fmtType(beat?.shot_type) || '—'}</dd></div>
            <div><dt><Clock size={13} aria-hidden /> Length</dt><dd>{clipLength(sceneSeconds(clips, selected)) || 'No clip yet'}</dd></div>
          </dl>
          <label className="esw-note-label" htmlFor="esw-note">Director's note</label>
          <textarea id="esw-note" className="esw-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={saving || beat?.locked}
            placeholder={beat?.locked ? 'Unlock the scene to edit its note' : 'What this scene needs on camera'} />
          <button type="button" className="esw-btn" disabled={saving || beat?.locked || note === (beat?.director_note || '')}
            onClick={() => saveBeat({ director_note: note.trim() || null }, `Scene ${beat.beat_number}: note saved`)}>
            <Save size={14} aria-hidden /> Save note
          </button>
        </section>

        <section className="esw-card" aria-label="Quick actions">
          <h3 className="esw-card-title">Quick actions</h3>
          <div className="esw-actions">
            <button type="button" className="esw-action" onClick={toggleLock} disabled={saving} data-testid="esw-lock">
              {beat?.locked ? <LockOpen size={20} aria-hidden /> : <Lock size={20} aria-hidden />}
              {beat?.locked ? 'Unlock scene' : 'Lock scene'}
            </button>
            <button type="button" className="esw-action" onClick={() => onOpenTab?.('files')}><FolderOpen size={20} aria-hidden /> Link a clip</button>
            <button type="button" className="esw-action" onClick={() => onOpenTab?.('beatplan')}><Pencil size={20} aria-hidden /> Edit on Beat Plan</button>
            <Link className="esw-action" to={`/episodes/${episodeId}/timeline`}><Clapperboard size={20} aria-hidden /> Open timeline</Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
