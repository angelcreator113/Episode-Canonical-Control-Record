/**
 * The Beat Plan's shared pieces: the beat editor, the missing-image
 * actions, the badges and the beat's picture. Used by the Beat Plan page
 * (ScenePlannerPage) and the episode's Scenes tab, the one scene workspace
 * (Evoni's ruling L12, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 */
import { useState } from 'react';
import { sceneSetThumb } from '../../utils/sceneSets';
import './BeatPlanParts.css';

export const SHOT_LABELS = {
  establishing: 'Establishing', medium: 'Medium', close: 'Close',
  tracking: 'Tracking', cutaway: 'Cutaway', transition: 'Transition',
};

export const ROLE_LABELS = { home: 'Home', closet: 'Closet', event: 'Event', extra: 'Extra' };
export const fmtType = (t) => String(t || '').toLowerCase().split('_').filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// L11 (Evoni, 2026-10-02, §8(hh)): "A beat whose set or angle Evoni chose is
// marked 'Chosen by you' and is never replaced by a re-plan or by location
// changes, like a locked beat."
export function ChosenBadge({ beat, className }) {
  if (!beat.chosen_by_user) return null;
  return <span className={className} data-testid={`beat-chosen-${beat.beat_number}`}>Chosen by you</span>;
}

// ─── MISSING ANGLE ────────────────────────────────────────────────────────────
// L4 (Evoni, 2026-10-02; Q19, §8(hh)): "A missing angle shows a specific
// action: 'Entrance angle missing — Upload image / Generate angle'."
// beat.location.missing comes from GET /episode-brief/:id/plan.

// L10 (§8(hh)): at a set the episode's event has a finished look on
// (beat.location.look), these make the dressed angle, from the look.

export function MissingAngle({ beat, busy, onUpload, onGenerate }) {
  const missing = beat.location?.missing;
  const dressed = beat.location?.angle?.dressed;
  const n = beat.beat_number;
  if (!missing) {
    if (dressed?.status === 'generating') return <p className="scene-planner-dressed-note" data-testid={`beat-dressed-${n}`}>Dressing this angle from the event's look…</p>;
    return null;
  }
  return (
    <div className="scene-planner-missing" data-testid={`beat-missing-${n}`}>
      <span className="scene-planner-missing-text">{missing.text}</span>
      {beat.location?.look && (
        <span className="scene-planner-missing-look" data-testid={`beat-missing-look-${n}`}>
          {dressed?.status === 'generating' ? 'Dressing it from the event\'s look…'
            : dressed?.status === 'failed' ? `The dressed version failed${dressed.error ? `: ${dressed.error}` : ''}. Try again:`
              : 'Made from the event\'s look:'}
        </span>
      )}
      <span className="scene-planner-missing-actions">
        <label className={`scene-planner-missing-btn${busy ? ' is-busy' : ''}`}>
          Upload image
          <input type="file" accept="image/*" hidden disabled={busy} aria-label={`Upload image for beat ${n}`}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(beat, f); }} />
        </label>
        <button type="button" className="scene-planner-missing-btn" disabled={busy}
          onClick={() => onGenerate(beat)} data-testid={`beat-generate-angle-${n}`}>Generate angle</button>
      </span>
    </div>
  );
}

// The beat's picture: its angle's image (the dressed one at the look's set,
// L10), else the event's look on its set, else the set's base image.
export const beatImage = (beat) => beat.location?.angle?.still_image_url || beat.location?.look?.image_url || beat.sceneSet?.base_still_url || null;
export const isDressed = (beat) => beat.location?.angle?.dressed?.status === 'complete';

// ─── BEAT EDITOR ──────────────────────────────────────────────────────────────
// B2 (Evoni, 2026-10-02): the beats' Edit buttons did nothing. They open
// this editor, which saves through PUT /episode-brief/:episodeId/plan/:beat
// (a locked beat is refused there, and its Edit is disabled here).
// L11 (§8(hh)): it lists the show's whole library (searchable, with
// thumbnails and angles, like the Place picker), the episode's own sets
// first. A set or angle changed here is sent with `chosen: true`: the beat
// is "Chosen by you", and a set not yet linked joins the episode's
// locations. "Let the plan choose again" sends `chosen: false`.

export function BeatEditor({ beat, library, linkedIds, onSave, onRelease, onCancel, saving }) {
  const [values, setValues] = useState({
    scene_set_id: beat.scene_set_id || '',
    angle_label: beat.angle_label || '',
    shot_type: beat.shot_type || '',
    emotional_intent: beat.emotional_intent || '',
  });
  const [search, setSearch] = useState('');
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pickSet = (id) => setValues((v) => (v.scene_set_id === id ? v : { ...v, scene_set_id: id, angle_label: '' }));

  const q = search.trim().toLowerCase();
  const sets = (library || []).filter((x) => !q || [x.name, fmtType(x.scene_type), x.scene_type]
    .some((v) => v && String(v).toLowerCase().includes(q)));
  const chosen = (library || []).find((x) => x.id === values.scene_set_id);
  const angles = (chosen?.angles || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const angleLabels = [...new Set(angles.map((a) => a.angle_label).filter(Boolean))];
  const addsSet = Boolean(values.scene_set_id) && !linkedIds.has(values.scene_set_id);

  const save = () => {
    const body = {
      scene_set_id: values.scene_set_id || null,
      angle_label: values.angle_label.trim() || null,
      shot_type: values.shot_type || null,
      emotional_intent: values.emotional_intent.trim() || null,
    };
    if (body.scene_set_id !== (beat.scene_set_id || null) || body.angle_label !== (beat.angle_label || null)) body.chosen = true;
    onSave(body);
  };

  return (
    <div className="scene-planner-editor" data-testid="beat-editor">
      <p className="scene-planner-editor-title">Edit beat {beat.beat_number}: {beat.beat_name}</p>
      {beat.chosen_by_user && (
        <p className="scene-planner-editor-chosen">
          Chosen by you: a re-plan or a location change leaves this beat as it is.{' '}
          <button type="button" className="scene-planner-editor-link" onClick={onRelease} disabled={saving}>Let the plan choose again</button>
        </p>
      )}
      <div className="scene-planner-editor-field">Scene set
        <input aria-label="Search scene sets" placeholder="Search by name or type" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="beat-editor-sets" role="listbox" aria-label="Scene sets">
        {library === null && <p className="scene-planner-editor-note">Loading the show's scene sets…</p>}
        {library !== null && library.length === 0 && (
          <p className="scene-planner-editor-note">This show has no scene sets yet: create one in Scene Sets.</p>
        )}
        {sets.map((x) => {
          const thumb = sceneSetThumb(x);
          const on = values.scene_set_id === x.id;
          return (
            <button key={x.id} type="button" role="option" aria-selected={on} className={`beat-editor-set${on ? ' is-on' : ''}`}
              onClick={() => pickSet(x.id)} disabled={saving} data-testid={`beat-set-option-${x.id}`}>
              {thumb
                ? <img className="beat-editor-set-thumb" src={thumb} alt="" />
                : <span className="beat-editor-set-thumb is-empty" aria-hidden="true">No image</span>}
              <span className="beat-editor-set-text">
                <span className="beat-editor-set-name">{x.name}</span>
                <span className="beat-editor-set-meta">
                  {fmtType(x.scene_type)}{linkedIds.has(x.id) ? ' · In this episode' : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {values.scene_set_id && (
        <button type="button" className="scene-planner-editor-link" onClick={() => pickSet('')} disabled={saving}>No scene</button>
      )}
      {addsSet && (
        <p className="scene-planner-editor-note" data-testid="beat-editor-adds">
          Not in this episode yet: saving adds it to the episode's locations.
        </p>
      )}
      {chosen && angles.length > 0 && (
        <div className="beat-editor-angles" role="group" aria-label={`Angles of ${chosen.name}`}>
          {angles.map((a) => (
            <button key={a.id} type="button" className={`beat-editor-angle${values.angle_label === a.angle_label ? ' is-on' : ''}`}
              onClick={() => setValues((v) => ({ ...v, angle_label: a.angle_label || '' }))} disabled={saving}
              data-testid={`beat-angle-${a.id}`}>
              {a.still_image_url
                ? <img src={a.still_image_url} alt="" />
                : <span className="beat-editor-set-thumb is-empty" aria-hidden="true">No image</span>}
              <span className="beat-editor-angle-name">{a.angle_name || a.angle_label}</span>
            </button>
          ))}
        </div>
      )}
      <label className="scene-planner-editor-field">Angle
        <input aria-label="Angle" list="scene-planner-angles" value={values.angle_label} onChange={set('angle_label')} placeholder="e.g. WIDE" />
        <datalist id="scene-planner-angles">{angleLabels.map((l) => <option key={l} value={l} />)}</datalist>
      </label>
      <label className="scene-planner-editor-field">Shot
        <select aria-label="Shot" value={values.shot_type} onChange={set('shot_type')}>
          <option value="">Not set</option>
          {Object.entries(SHOT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <label className="scene-planner-editor-field">Emotional intent
        <textarea aria-label="Emotional intent" rows={2} value={values.emotional_intent} onChange={set('emotional_intent')} />
      </label>
      <div className="scene-planner-editor-actions">
        <button className="scene-planner-btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="scene-planner-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
