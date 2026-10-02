import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { sceneSetPath } from '../utils/sceneSets';
import {
  SHOT_LABELS, ROLE_LABELS, ChosenBadge, MissingAngle, BeatEditor, beatImage, isDressed,
} from '../components/BeatPlan/BeatPlanParts';
import useBeatActions from '../components/BeatPlan/useBeatActions';
import './ScenePlannerPage.css';

const BEAT_NAMES = [
  'Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1',
  'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop',
  'Reminder/Deadline', 'Event Travel', 'Event Outcome',
  'Deliverable Creation', 'Recap Panel', 'Cliffhanger',
];

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
  const [locations, setLocations] = useState({ locations: [], show_id: null });

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

  // B2, L4, L10, L11: the beat's actions, shared with the Scenes tab (L12).
  const linkedIds = new Set(locations.locations.map((l) => l.scene_set_id));
  const beats = useBeatActions({
    episodeId, showToast, reload: fetchAll, showId: locations.show_id, loadShowId: fetchAll, linkedIds,
  });

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

      {beats.dialogs}

      {beats.editingBeat && (
        <BeatEditor key={beats.editingBeat.beat_number} beat={beats.editingBeat} library={beats.library} linkedIds={linkedIds}
          onSave={beats.saveBeat} onRelease={beats.releaseBeat} onCancel={beats.closeEditor} saving={beats.savingBeat} />
      )}

      {!loading && plan.length > 0 && (
        view === 'storyboard' ? (
          <div className="scene-planner-storyboard">
            {plan.map((beat, i) => (
              <BeatCard key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={beats.openEditor}
                missingProps={beats.missingPropsFor(beat)} />
            ))}
          </div>
        ) : (
          <div className="scene-planner-list">
            {plan.map((beat, i) => (
              <BeatRow key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={beats.openEditor}
                missingProps={beats.missingPropsFor(beat)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
