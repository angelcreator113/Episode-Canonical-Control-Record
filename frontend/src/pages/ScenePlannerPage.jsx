import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import SceneBriefConfirm from '../components/SceneBriefConfirm';
import { sceneSetThumb, sceneSetPath } from '../utils/sceneSets';
import './ScenePlannerPage.css';

const BEAT_NAMES = [
  'Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1',
  'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop',
  'Reminder/Deadline', 'Event Travel', 'Event Outcome',
  'Deliverable Creation', 'Recap Panel', 'Cliffhanger',
];

const SHOT_LABELS = {
  establishing: 'Establishing', medium: 'Medium', close: 'Close',
  tracking: 'Tracking', cutaway: 'Cutaway', transition: 'Transition',
};

const ROLE_LABELS = { home: 'Home', closet: 'Closet', event: 'Event', extra: 'Extra' };
const fmtType = (t) => String(t || '').toLowerCase().split('_').filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// L11 (Evoni, 2026-10-02, §8(hh)): "A beat whose set or angle Evoni chose is
// marked 'Chosen by you' and is never replaced by a re-plan or by location
// changes, like a locked beat."
function ChosenBadge({ beat, className }) {
  if (!beat.chosen_by_user) return null;
  return <span className={className} data-testid={`beat-chosen-${beat.beat_number}`}>Chosen by you</span>;
}

// L11: "shows the episode's locations at its top, each linking to its set
// in Scene Sets." From GET /episodes/:id/locations.
function LocationsStrip({ locations, showId }) {
  if (!locations?.length || !showId) return null;
  return (
    <nav className="beat-plan-locations" aria-label="This episode's locations" data-testid="beat-plan-locations">
      <span className="beat-plan-locations-label">Locations</span>
      {locations.map((l) => (
        <Link key={`${l.role}-${l.scene_set_id}`} className="beat-plan-location" to={sceneSetPath(showId, l.scene_set_id)}>
          {l.role === 'extra' && l.name ? l.name : ROLE_LABELS[l.role] || l.role}: {l.scene_set?.name || 'Scene set'}
        </Link>
      ))}
    </nav>
  );
}

// ─── MISSING ANGLE ────────────────────────────────────────────────────────────
// L4 (Evoni, 2026-10-02; Q19, §8(hh)): "A missing angle shows a specific
// action: 'Entrance angle missing — Upload image / Generate angle'."
// beat.location.missing comes from GET /episode-brief/:id/plan.

// L10 (§8(hh)): at a set the episode's event has a finished look on
// (beat.location.look), these make the dressed angle, from the look.

function MissingAngle({ beat, busy, onUpload, onGenerate }) {
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
const beatImage = (beat) => beat.location?.angle?.still_image_url || beat.location?.look?.image_url || beat.sceneSet?.base_still_url || null;
const isDressed = (beat) => beat.location?.angle?.dressed?.status === 'complete';

// ─── BEAT CARD ────────────────────────────────────────────────────────────────

function BeatCard({ beat, index, onLock, onEdit, missingProps }) {
  return (
    <div className={`scene-planner-card ${beat.locked ? 'locked' : ''}`}>
      <div className="scene-planner-card-image">
        {beatImage(beat) ? (
          <img src={beatImage(beat)} alt={beat.sceneSet?.name || ''} />
        ) : (
          <div className="scene-planner-card-placeholder">✦</div>
        )}
        <div className="scene-planner-card-number">{index + 1}</div>
        {beat.locked && <div className="scene-planner-card-lock">Locked</div>}
        {!beat.locked && beat.chosen_by_user && <ChosenBadge beat={beat} className="scene-planner-card-chosen" />}
        {beat.ai_suggested && !beat.locked && !beat.chosen_by_user && <div className="scene-planner-card-ai">AI</div>}
      </div>

      <div className="scene-planner-card-body">
        <p className="scene-planner-card-beat-name">{beat.beat_name || BEAT_NAMES[index]}</p>
        <p className="scene-planner-card-scene-name">{beat.sceneSet?.name || 'No scene assigned'}</p>

        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
          {isDressed(beat) && <span className="scene-planner-card-tag dressed" data-testid={`beat-dressed-tag-${beat.beat_number}`}>Event look</span>}
        </div>

        {beat.emotional_intent && (
          <p className="scene-planner-card-intent">{beat.emotional_intent}</p>
        )}

        <MissingAngle beat={beat} {...missingProps} />

        <div className="scene-planner-card-actions">
          <button className="scene-planner-card-edit" onClick={() => onEdit(beat)} disabled={beat.locked}
            title={beat.locked ? 'Unlock this beat to edit it' : undefined}>Edit</button>
          <button
            className={`scene-planner-card-lock-btn ${beat.locked ? 'is-locked' : ''}`}
            onClick={() => onLock(beat)}
          >
            {beat.locked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BEAT ROW ─────────────────────────────────────────────────────────────────

function BeatRow({ beat, index, onLock, onEdit, missingProps }) {
  return (
    <div className={`scene-planner-row ${beat.locked ? 'locked' : ''}`}>
      <div className="scene-planner-row-number">{index + 1}</div>

      <div className="scene-planner-row-beat">
        <p className="scene-planner-row-beat-name">{beat.beat_name || BEAT_NAMES[index]}</p>
        <p className="scene-planner-row-transition">
          {beat.transition_in && beat.transition_in !== 'none' ? `→ ${beat.transition_in}` : ''}
        </p>
      </div>

      <div className="scene-planner-row-scene">
        <p className="scene-planner-row-scene-name">{beat.sceneSet?.name || '— No scene —'}</p>
        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
          {isDressed(beat) && <span className="scene-planner-card-tag dressed">Event look</span>}
          {beat.chosen_by_user
            ? <ChosenBadge beat={beat} className="scene-planner-card-tag chosen" />
            : beat.ai_suggested && <span className="scene-planner-card-tag angle">AI</span>}
        </div>
      </div>

      <div className="scene-planner-row-intent">
        <p>{beat.emotional_intent || '—'}</p>
        <MissingAngle beat={beat} {...missingProps} />
      </div>

      <div className="scene-planner-row-actions">
        <button className="scene-planner-btn primary" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => onEdit(beat)}
          disabled={beat.locked} title={beat.locked ? 'Unlock this beat to edit it' : undefined}>Edit</button>
        <button
          className={`scene-planner-card-lock-btn ${beat.locked ? 'is-locked' : ''}`}
          onClick={() => onLock(beat)}
        >
          {beat.locked ? '🔒' : '🔓'}
        </button>
      </div>
    </div>
  );
}

// ─── BEAT EDITOR ──────────────────────────────────────────────────────────────
// B2 (Evoni, 2026-10-02): the beats' Edit buttons did nothing. They open
// this editor, which saves through PUT /episode-brief/:episodeId/plan/:beat
// (a locked beat is refused there, and its Edit is disabled here).
// L11 (§8(hh)): it lists the show's whole library (searchable, with
// thumbnails and angles, like the Place picker), the episode's own sets
// first. A set or angle changed here is sent with `chosen: true`: the beat
// is "Chosen by you", and a set not yet linked joins the episode's
// locations. "Let the plan choose again" sends `chosen: false`.

function BeatEditor({ beat, library, linkedIds, onSave, onRelease, onCancel, saving }) {
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

// ─── BRIEF PANEL ──────────────────────────────────────────────────────────────

function BriefPanel({ brief, onUpdate, onGenerate, generating }) {
  const [values, setValues] = useState({
    arc_number: brief?.arc_number || '',
    position_in_arc: brief?.position_in_arc || '',
    episode_archetype: brief?.episode_archetype || '',
    narrative_purpose: brief?.narrative_purpose || '',
    designed_intent: brief?.designed_intent || 'pass',
    forward_hook: brief?.forward_hook || '',
  });

  return (
    <div className="scene-planner-brief">
      <h3 className="scene-planner-brief-title">
        Episode Brief
        {brief?.status === 'locked' && <span className="scene-planner-brief-locked">LOCKED</span>}
      </h3>

      <div className="scene-planner-brief-grid">
        <div className="scene-planner-field">
          <label>Arc Number (1-3)</label>
          <input type="number" min="1" max="3" value={values.arc_number}
            onChange={e => setValues(v => ({ ...v, arc_number: e.target.value }))} />
        </div>
        <div className="scene-planner-field">
          <label>Position in Arc (1-8)</label>
          <input type="number" min="1" max="8" value={values.position_in_arc}
            onChange={e => setValues(v => ({ ...v, position_in_arc: e.target.value }))} />
        </div>
      </div>

      <div className="scene-planner-brief-grid">
        <div className="scene-planner-field">
          <label>Episode Archetype</label>
          <select value={values.episode_archetype}
            onChange={e => setValues(v => ({ ...v, episode_archetype: e.target.value }))}>
            <option value="">Select...</option>
            {['Trial','Temptation','Breakdown','Redemption','Showcase','Rising','Pressure','Cliffhanger']
              .map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="scene-planner-field">
          <label>Designed Intent</label>
          <select value={values.designed_intent}
            onChange={e => setValues(v => ({ ...v, designed_intent: e.target.value }))}>
            {['slay','pass','safe','fail'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div className="scene-planner-field" style={{ marginBottom: 12 }}>
        <label>Narrative Purpose</label>
        <textarea value={values.narrative_purpose}
          onChange={e => setValues(v => ({ ...v, narrative_purpose: e.target.value }))}
          rows={2} placeholder="What does this episode do for the season story?" />
      </div>

      <div className="scene-planner-field" style={{ marginBottom: 16 }}>
        <label>Forward Hook</label>
        <textarea value={values.forward_hook}
          onChange={e => setValues(v => ({ ...v, forward_hook: e.target.value }))}
          rows={2} placeholder="What question is left unresolved at episode end?" />
      </div>

      <div className="scene-planner-brief-actions">
        <button className="scene-planner-btn primary" onClick={() => onUpdate(values)}>
          Save Brief
        </button>
        <button className="scene-planner-btn primary" onClick={onGenerate} disabled={generating}>
          {generating ? '⏳ Generating...' : '✦ Generate Scene Plan'}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ScenePlannerPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState('storyboard');
  const [brief, setBrief] = useState(null);
  const [plan, setPlan] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingBeat, setEditingBeat] = useState(null);
  const [library, setLibrary] = useState(null);
  const [locations, setLocations] = useState({ locations: [], show_id: null });
  const [savingBeat, setSavingBeat] = useState(false);
  const [angleBusy, setAngleBusy] = useState(null); // beat number
  const [angleBrief, setAngleBrief] = useState(null); // { beat, setId, angleId, name }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [briefRes, planRes] = await Promise.all([
        api.get(`/api/v1/episode-brief/${episodeId}`),
        api.get(`/api/v1/episode-brief/${episodeId}/plan`),
      ]);
      setBrief(briefRes.data.data);
      setPlan(planRes.data.data || []);
      setReadiness(planRes.data.readiness || null);
    } catch (err) {
      console.error('[BeatPlan] load failed:', err);
      showToast('Failed to load the beat plan', 'error');
    } finally {
      setLoading(false);
    }
    // The episode's locations (L11), for the strip and the editor; a failed
    // read leaves the page without them.
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/locations`);
      const data = res.data?.data || {};
      setLocations({ locations: data.locations || [], show_id: data.show_id || null });
      return data.show_id || null;
    } catch (err) {
      console.error('[BeatPlan] locations load failed:', err);
      return null;
    }
  }, [episodeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpdateBrief = async (values) => {
    try {
      const res = await api.put(`/api/v1/episode-brief/${episodeId}`, values);
      setBrief(res.data.data);
      showToast('Brief saved');
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/generate-plan`);
      showToast(`Scene plan generated — ${res.data.data.length} beats mapped`);
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async (beat) => {
    try {
      await api.post(`/api/v1/episode-brief/${episodeId}/plan/${beat.beat_number}/lock`);
      await fetchAll();
    } catch {
      showToast('Lock failed', 'error');
    }
  };

  // L11: the show's library: its own sets and the sets with no show (GET
  // /scene-sets returns every show's), the episode's linked sets first.
  const handleEdit = async (beat) => {
    setEditingBeat(beat);
    if (library !== null) return;
    const showId = locations.show_id || await fetchAll();
    if (!showId) { setLibrary([]); return; }
    try {
      const res = await api.get(`/api/v1/scene-sets?show_id=${showId}&limit=200`);
      setLibrary((res.data?.data || []).filter((x) => x && x.id && (x.show_id === showId || !x.show_id)));
    } catch (err) {
      console.error('[BeatPlan] scene sets load failed:', err);
      showToast(err.response?.data?.error || 'Could not load the scene sets', 'error');
      setLibrary([]);
    }
  };

  const linkedIds = new Set(locations.locations.map((l) => l.scene_set_id));
  const orderedLibrary = library === null ? null : [...library].sort((a, b) =>
    (linkedIds.has(a.id) ? 0 : 1) - (linkedIds.has(b.id) ? 0 : 1)
    || String(a.name || '').localeCompare(String(b.name || '')));

  const handleSaveBeat = async (values) => {
    setSavingBeat(true);
    try {
      const res = await api.put(`/api/v1/episode-brief/${episodeId}/plan/${editingBeat.beat_number}`, values);
      const added = res.data?.location?.added ? res.data.location : null;
      const setName = added && library?.find((x) => x.id === values.scene_set_id)?.name;
      showToast(added
        ? `Beat ${editingBeat.beat_number} saved; “${setName || 'the set'}” joined the episode's locations as ${added.role === 'extra' ? 'an extra' : `its ${added.role}`}`
        : `Beat ${editingBeat.beat_number} saved`);
      setEditingBeat(null);
      await fetchAll();
    } catch (err) {
      console.error('[BeatPlan] beat save failed:', err);
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSavingBeat(false);
    }
  };

  const handleReleaseBeat = async () => {
    setSavingBeat(true);
    try {
      await api.put(`/api/v1/episode-brief/${episodeId}/plan/${editingBeat.beat_number}`, { chosen: false });
      showToast(`Beat ${editingBeat.beat_number} is the plan's to choose again`);
      setEditingBeat(null);
      await fetchAll();
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

  const handleUploadAngle = async (beat, file) => {
    setAngleBusy(beat.beat_number);
    try {
      const { setId, angleId } = await ensureAngle(beat);
      const form = new FormData();
      form.append('images', file);
      const url = beat.location?.look ? `${dressedPath(angleId)}/upload` : `/api/v1/scene-sets/${setId}/angles/${angleId}/upload`;
      await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`Beat ${beat.beat_number}: image uploaded`);
    } catch (err) {
      console.error('[ScenePlanner] angle upload failed:', err);
      showToast(err.response?.data?.error || err.message || 'Upload failed', 'error');
    } finally {
      setAngleBusy(null);
      await fetchAll();
    }
  };

  const handleGenerateAngle = async (beat) => {
    setAngleBusy(beat.beat_number);
    try {
      const target = await ensureAngle(beat);
      setAngleBrief({ beat, ...target, dressed: Boolean(beat.location?.look) });
    } catch (err) {
      console.error('[ScenePlanner] angle create failed:', err);
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
      console.error('[ScenePlanner] angle generate failed:', err);
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setAngleBusy(null);
      await fetchAll();
    }
  };

  const cancelGenerateAngle = async () => {
    setAngleBrief(null);
    setAngleBusy(null);
    await fetchAll();
  };

  const missingProps = { onUpload: handleUploadAngle, onGenerate: handleGenerateAngle };

  const handleLockAll = async () => {
    try {
      await api.post(`/api/v1/episode-brief/${episodeId}/plan/lock-all`);
      showToast('All beats locked — ready for script generation');
      await fetchAll();
    } catch {
      showToast('Lock all failed', 'error');
    }
  };

  const lockedCount = plan.filter(b => b.locked).length;
  const allLocked = plan.length > 0 && lockedCount === plan.length;

  return (
    <div className="scene-planner">
      {toast && <div className={`scene-planner-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="scene-planner-header">
        <div>
          <h1 className="scene-planner-title">Beat Plan</h1>
          <p className="scene-planner-subtitle">
            Map scenes to beats → generates a grounded script
            {plan.length > 0 && ` · ${lockedCount}/${plan.length} beats locked`}
          </p>
          {/* L5, Q21 (Evoni, 2026-10-02, §8(hh)): flagged, never blocking. */}
          {readiness && readiness.total > 0 && (
            <p className={`scene-planner-readiness${readiness.ready < readiness.total ? ' is-short' : ''}`} data-testid="planner-readiness">
              {readiness.ready === readiness.total
                ? `Every beat has its image (${readiness.total}/${readiness.total}).`
                : `${readiness.ready}/${readiness.total} beats have their image; still needed: beat${readiness.not_ready.length === 1 ? '' : 's'} ${readiness.not_ready.map((b) => b.beat_number).join(', ')}. Planning and writing can go on.`}
            </p>
          )}
        </div>

        <div className="scene-planner-actions">
          <div className="scene-planner-view-toggle">
            {['storyboard', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`scene-planner-view-btn ${view === v ? 'active' : ''}`}>
                {v === 'storyboard' ? '⊞ Board' : '≡ List'}
              </button>
            ))}
          </div>

          {plan.length > 0 && !allLocked && (
            <button className="scene-planner-btn lock" onClick={handleLockAll}>
              🔒 Lock All
            </button>
          )}

          {allLocked && (
            <button className="scene-planner-btn success"
              onClick={() => navigate(`/episodes/${episodeId}/script-writer`)}>
              ✦ Generate Script →
            </button>
          )}
        </div>
      </div>

      <LocationsStrip locations={locations.locations} showId={locations.show_id} />

      {!loading && (
        <BriefPanel brief={brief} onUpdate={handleUpdateBrief}
          onGenerate={handleGenerate} generating={generating} />
      )}

      {loading && <p className="scene-planner-loading">Loading...</p>}

      {!loading && plan.length === 0 && (
        <div className="scene-planner-empty">
          <div className="scene-planner-empty-icon">✦</div>
          <p className="scene-planner-empty-title">No scene plan yet</p>
          <p className="scene-planner-empty-text">
            Fill in the Episode Brief above, then click Generate Scene Plan.
            AI will map all 14 beats to your available scene sets.
          </p>
        </div>
      )}

      {angleBrief && (
        <SceneBriefConfirm
          setId={angleBrief.setId}
          angleId={angleBrief.angleId}
          title={`Generate the ${angleBrief.name.toLowerCase()} angle for beat ${angleBrief.beat.beat_number}`}
          note={angleBrief.dressed ? "Made from the event's look: the same dressed room, from this angle." : null}
          requestBrief={angleBrief.dressed ? (body) => api.post(`${dressedPath(angleBrief.angleId)}/brief`, { overrides: body.overrides }) : null}
          onConfirm={(overrides) => confirmGenerateAngle(overrides)}
          onCancel={cancelGenerateAngle}
        />
      )}

      {editingBeat && (
        <BeatEditor key={editingBeat.beat_number} beat={editingBeat} library={orderedLibrary} linkedIds={linkedIds}
          onSave={handleSaveBeat} onRelease={handleReleaseBeat} onCancel={() => setEditingBeat(null)} saving={savingBeat} />
      )}

      {!loading && plan.length > 0 && (
        view === 'storyboard' ? (
          <div className="scene-planner-storyboard">
            {plan.map((beat, i) => (
              <BeatCard key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={handleEdit}
                missingProps={{ ...missingProps, busy: angleBusy === beat.beat_number }} />
            ))}
          </div>
        ) : (
          <div className="scene-planner-list">
            {plan.map((beat, i) => (
              <BeatRow key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={handleEdit}
                missingProps={{ ...missingProps, busy: angleBusy === beat.beat_number }} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
