import { adminOnlyMessage } from '../utils/authGroups';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { sceneSetPath } from '../utils/sceneSets';
import {
  SHOT_LABELS, ROLE_LABELS, ChosenBadge, MissingAngle, beatImage, beatImageLabel, beatSetName, isDressed,
} from '../components/BeatPlan/BeatPlanParts';
import usePlanRefresh from '../components/BeatPlan/usePlanRefresh';
import './ScenePlannerPage.css';

const BEAT_NAMES = [
  'Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1',
  'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop',
  'Reminder/Deadline', 'Event Travel', 'The Event',
  'Fashion Challenge', 'Recap Panel', 'Cliffhanger',
];

// L11: "shows the episode's locations at its top, each linking to its set
// in Scene Sets." From GET /episodes/:id/locations.
// Each link brings Evoni back here (eighth audit, the S8 way back).
function LocationsStrip({ locations, showId, episodeId }) {
  if (!locations?.length || !showId) return null;
  return (
    <nav className="beat-plan-locations" aria-label="This episode's locations" data-testid="beat-plan-locations">
      <span className="beat-plan-locations-label">Locations</span>
      {locations.map((l) => (
        <Link key={`${l.role}-${l.scene_set_id}`} className="beat-plan-location" to={sceneSetPath(showId, l.scene_set_id, episodeId ? { from: `/episodes/${episodeId}/plan`, fromLabel: 'Scene planner' } : {})}>
          {l.role === 'extra' && l.name ? l.name : ROLE_LABELS[l.role] || l.role}: {l.scene_set?.name || 'Scene set'}
        </Link>
      ))}
    </nav>
  );
}

// ─── WHAT THE LAST RE-PLAN CHANGED ────────────────────────────────────────────
//
// Gap 2 (Evoni, 2026-11-25): POST generate-plan answers with `plan_changes`,
// which names the beats whose generated fields changed and says whether each
// one carries saved work. It is INFORMATION, not a fault: the plan saved, the
// scenes and the operator's own writing were kept, and nothing here asks for a
// decision. So it follows the readiness line's register (L5, Q21: "flagged,
// never blocking") and never role="alert" or an error colour.
//
// It is stored nowhere — the response is the only copy — so this notice lives
// in the page's own state and is gone on a reload or a navigation. It says
// "in this plan" rather than pretending to be a record.
const CHANGE_LABELS = {
  scene_set_id: 'Location changed',
  operator_fields_kept: 'Your wording kept',
};

/** The entry for one beat, with the names resolved where they genuinely are. */
function changeFor(report, beat) {
  if (!report?.changes?.length || !beat) return null;
  const n = Number(beat.beat_number);
  const found = report.changes.find((c) => Number(c.beat_number) === n);
  if (!found) return null;
  const changed = Array.isArray(found.changed) ? found.changed : [];
  // "Was showing" is the plan that was on screen when Generate was pressed —
  // what she was looking at, not a stored history of the row. Null when the
  // beat had no set, was not on screen, or its set cannot be named.
  const was = report.wasShowing?.get(n) || null;
  // "Now" comes from the read THIS generation made, captured when the notice
  // was built — never from live plan state. So a later background refresh, or
  // another writer's change, is never attributed to this generation; and when
  // that read failed there is no "now" at all rather than a stale one.
  const now = report.nowShowing ? (report.nowShowing.get(n) || null) : null;
  return {
    beat_number: n,
    changed,
    has_saved_work: Boolean(found.has_saved_work),
    was,
    now,
    // Shown only when both names are known AND they differ: identical names
    // are not a meaningful old-to-new transition, whatever the server reported.
    comparable: Boolean(was && now && was !== now),
    moved: changed.includes('scene_set_id'),
  };
}

/** The tag beside "Chosen by you" and "Event look", in both views. */
function ChangedBadges({ change }) {
  if (!change?.changed.length) return null;
  return change.changed.filter((f) => CHANGE_LABELS[f]).map((f) => (
    <span
      key={f}
      className="scene-planner-card-tag changed"
      data-testid={`beat-changed-${change.beat_number}`}
      title={f === 'scene_set_id' && change.comparable ? `Was showing: ${change.was}` : undefined}
    >
      {CHANGE_LABELS[f]}
    </span>
  ));
}

function PlanChangesNotice({ report, plan, episodeId }) {
  if (!report?.changes?.length) return null;
  const byBeat = new Map(plan.map((b) => [Number(b.beat_number), b]));
  const entries = report.changes
    .map((c) => changeFor(report, byBeat.get(Number(c.beat_number)) || { beat_number: c.beat_number }))
    .filter(Boolean)
    .sort((a, b) => a.beat_number - b.beat_number);
  if (!entries.length) return null;
  const moved = entries.filter((e) => e.moved);
  const kept = entries.filter((e) => e.changed.includes('operator_fields_kept'));
  const withWork = entries.filter((e) => e.has_saved_work);
  const list = (es) => es.map((e) => e.beat_number).join(', ');
  return (
    <div className="scene-planner-plan-changes" role="status" data-testid="planner-plan-changes">
      <p className="scene-planner-plan-changes-head">
        {moved.length > 0 && `Beat${moved.length === 1 ? '' : 's'} ${list(moved)} changed location in this plan. `}
        {kept.length > 0 && `Beat${kept.length === 1 ? '' : 's'} ${list(kept)} kept your wording.`}
      </p>
      {/* The preservation claim is made ONLY where has_saved_work establishes
          there is work to preserve. has_saved_work false means the server
          found no live tied scene with an image and no director note, feed
          moment or script lines — so there may be no saved scene at all, and
          saying one was kept would assert something the contract does not. */}
      {withWork.length > 0 && (
        <p className="scene-planner-plan-changes-work" data-testid="planner-plan-changes-work">
          Beat{withWork.length === 1 ? '' : 's'} {list(withWork)} {withWork.length === 1 ? 'has' : 'have'} saved
          work, which was kept — worth checking it still fits.
        </p>
      )}
      {/* The POST and the plan read that follows it are separate results. The
          re-plan saved either way — that is what the 200 means — but without a
          successful read there are no updated details to compare against, so
          none are shown and the page says so. It never says the save failed. */}
      {report.reread === false && (
        <p className="scene-planner-plan-changes-stale" data-testid="planner-plan-changes-stale">
          The new plan was saved. Its updated details couldn&apos;t be loaded, so what is shown
          below may be out of date.
        </p>
      )}
      <ul className="scene-planner-plan-changes-list">
        {moved.map((e) => (
          <li key={e.beat_number} data-testid={`planner-plan-change-${e.beat_number}`}>
            Beat {e.beat_number}
            {e.comparable ? ` — was showing ${e.was}, now ${e.now}` : ''}
          </li>
        ))}
      </ul>
      <Link to={scenesPath(episodeId)}>Check them on the Beat Plan →</Link>
    </div>
  );
}

// ─── BEAT CARD ────────────────────────────────────────────────────────────────

// S9 (d) (Evoni, 2026-10-02; §8(hh)): "the Beat Plan page keeps
// re-planning only, and every per-beat change happens in Scenes." A beat's
// missing image is a status here; it is changed on Scenes › Plan.
const scenesPath = (episodeId) => `/episodes/${episodeId}?tab=beatplan`;
const BeatStatus = ({ beat }) => <MissingAngle beat={beat} statusOnly />;
function ChangeInScenes({ episodeId, className }) {
  return <Link className={className} to={scenesPath(episodeId)}>Change on the Beat Plan →</Link>;
}

// Beat 11 (The Event) plays an animated piece of the episode's short
// story (Evoni, 2026-10-15; docs/CANON.md). Cut on the Stories page.
function Beat11Piece({ beat, piece }) {
  if (beat.beat_number !== 11 || !piece?.text) return null;
  return (
    <div className="scene-planner-beat11" data-testid="beat11-piece">
      <p className="scene-planner-beat11-label">From the short story · for animation</p>
      <p className="scene-planner-beat11-text">{piece.text}</p>
      {piece.why && <p className="scene-planner-beat11-why">Leaves them asking: {piece.why}</p>}
    </div>
  );
}

function BeatCard({ beat, index, episodeId, beat11, change }) {
  return (
    <div className={`scene-planner-card ${beat.locked ? 'locked' : ''}`} data-testid={`beat-card-${beat.beat_number}`}>
      <div className="scene-planner-card-image">
        {beatImage(beat) ? (
          <img src={beatImage(beat)} alt={beatImageLabel(beat) || beat.sceneSet?.name || ''} />
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
        <p className="scene-planner-card-scene-name">{beatSetName(beat)}</p>
        {beatImageLabel(beat) && (
          <p className="scene-planner-card-image-label" data-testid={`beat-image-label-${beat.beat_number}`}>{beatImageLabel(beat)}</p>
        )}

        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
          {isDressed(beat) && <span className="scene-planner-card-tag dressed" data-testid={`beat-dressed-tag-${beat.beat_number}`}>Event look</span>}
          <ChangedBadges change={change} />
        </div>

        {beat.emotional_intent && (
          <p className="scene-planner-card-intent">{beat.emotional_intent}</p>
        )}

        <Beat11Piece beat={beat} piece={beat11} />

        <BeatStatus beat={beat} />

        <div className="scene-planner-card-actions">
          <ChangeInScenes episodeId={episodeId} className="scene-planner-card-change" />
        </div>
      </div>
    </div>
  );
}

// ─── BEAT ROW ─────────────────────────────────────────────────────────────────

function BeatRow({ beat, index, episodeId, beat11, change }) {
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
        <p className="scene-planner-row-scene-name">{beatSetName(beat, '— No scene —')}</p>
        {beatImageLabel(beat) && <p className="scene-planner-card-image-label">{beatImageLabel(beat)}</p>}
        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
          {isDressed(beat) && <span className="scene-planner-card-tag dressed">Event look</span>}
          {beat.chosen_by_user
            ? <ChosenBadge beat={beat} className="scene-planner-card-tag chosen" />
            : beat.ai_suggested && <span className="scene-planner-card-tag angle">AI</span>}
          <ChangedBadges change={change} />
        </div>
      </div>

      <div className="scene-planner-row-intent">
        <p>{beat.emotional_intent || '—'}</p>
        <Beat11Piece beat={beat} piece={beat11} />
        <BeatStatus beat={beat} />
      </div>

      <div className="scene-planner-row-actions">
        {beat.locked && <span className="scene-planner-card-tag lock">Locked</span>}
        <ChangeInScenes episodeId={episodeId} className="scene-planner-card-change" />
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
  const [view, setView] = useState('storyboard');
  const [brief, setBrief] = useState(null);
  const [plan, setPlan] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [locations, setLocations] = useState({ locations: [], show_id: null });
  const [beat11, setBeat11] = useState(null);   // the short story's beat 11 piece

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // What the last re-plan changed (Gap 2). Its own state, so a background
  // refresh (usePlanRefresh) re-reads the plan without erasing the notice.
  const [planChanges, setPlanChanges] = useState(null);
  // The newest generation wins, as the newest read does below: an older POST
  // answer never shows its notice against a plan it did not produce.
  const genSeq = useRef(0);
  // The plan as the last SUCCESSFUL read left it, and a count of those reads.
  // A generation compares the count across its own re-read to tell a read that
  // worked from one that failed — the POST's 200 says nothing about the read.
  const planRef = useRef([]);
  const planReadOk = useRef(0);

  // The newest read of the brief and plan wins: an older answer or failure
  // never replaces a newer one.
  const loadSeq = useRef(0);
  const fetchAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [briefRes, planRes] = await Promise.all([
        api.get(`/api/v1/episode-brief/${episodeId}`),
        api.get(`/api/v1/episode-brief/${episodeId}/plan`),
      ]);
      if (seq === loadSeq.current) {
        setBrief(briefRes.data.data);
        planRef.current = planRes.data.data || [];
        planReadOk.current += 1;
        setPlan(planRes.data.data || []);
        setReadiness(planRes.data.readiness || null);
        setLoadFailed(false);
      }
    } catch (err) {
      console.error('[BeatPlan] load failed:', err);
      if (seq === loadSeq.current) {
        // Said on the page, with Retry: a failed read is not "no plan yet", and
        // Generate is not offered in answer to it. A plan from an earlier read
        // stays below, said to be possibly out of date (Evoni, 2026-11-12).
        setLoadFailed(true);
        showToast('Failed to load the beat plan', 'error');
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
    // The short story's beat 11 piece (book-from-show); a failed read
    // leaves beat 11 without it.
    try {
      const res = await api.get(`/api/v1/book-from-show/episodes/${episodeId}/beat11`);
      setBeat11(res.data?.excerpt || null);
    } catch (err) {
      console.error('[BeatPlan] beat 11 piece load failed:', err);
    }
    // The episode's locations (L11), for the strip; a failed
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

  // Display bug 3: re-read while a beat's image is still generating.
  usePlanRefresh(plan, fetchAll);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpdateBrief = async (values) => {
    try {
      const res = await api.put(`/api/v1/episode-brief/${episodeId}`, values);
      setBrief(res.data.data);
      showToast('Brief saved');
    } catch (err) {
      showToast(adminOnlyMessage(err) || err.response?.data?.error || 'Save failed', 'error');
    }
  };

  const handleGenerate = async () => {
    const seq = ++genSeq.current;
    // Captured before the call: the plan that is on screen right now is the
    // only honest source for "was showing". beatSetName gives null rather
    // than a placeholder when a beat has no set or its set cannot be named,
    // and an unresolved name is left out instead of invented.
    const wasShowing = new Map(plan.map((b) => [Number(b.beat_number), beatSetName(b, null)]));
    // A new attempt drops the previous notice at once, so nothing stale is on
    // screen while this one runs, or afterwards if it fails.
    setPlanChanges(null);
    setGenerating(true);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/generate-plan`);
      showToast(`Scene plan generated — ${res.data.data.length} beats mapped`);
      const okBefore = planReadOk.current;
      await fetchAll();
      // Two separate results: the POST saved the plan (that is what its 200
      // means) and the read that follows either worked or did not. Only a read
      // that worked supplies the updated names; a failed one leaves `now`
      // unknown rather than stale. A 409 (PLAN_OUTPUT_INVALID,
      // PLAN_BEAT_UNAVAILABLE) never reaches here: it throws, nothing was
      // written, and the error toast below is the whole answer.
      if (seq === genSeq.current) {
        const changes = Array.isArray(res.data?.plan_changes) ? res.data.plan_changes : [];
        const reread = planReadOk.current > okBefore;
        // Captured now, from this generation's own read, so a later refresh or
        // another writer's change is never shown as part of this generation.
        const nowShowing = reread
          ? new Map(planRef.current.map((b) => [Number(b.beat_number), beatSetName(b, null)]))
          : null;
        setPlanChanges(changes.length ? { changes, wasShowing, nowShowing, reread } : null);
      }
    } catch (err) {
      showToast(adminOnlyMessage(err) || err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="scene-planner">
      {toast && <div className={`scene-planner-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="scene-planner-header">
        <div>
          <h1 className="scene-planner-title">Beat Plan</h1>
          <p className="scene-planner-subtitle">
            Make and re-make the plan: each beat mapped to a location
          </p>
          {plan.length > 0 && (
            <p className="scene-planner-scope" data-testid="beat-plan-scope">
              A re-plan keeps locked and chosen beats. Change a beat&apos;s background, lock or unlock it on{' '}
              <Link to={scenesPath(episodeId)}>Scenes › Plan</Link>.
            </p>
          )}
          {/* L5, Q21 (Evoni, 2026-10-02, §8(hh)): flagged, never blocking. */}
          {readiness && readiness.total > 0 && (
            <p className={`scene-planner-readiness${readiness.ready < readiness.total ? ' is-short' : ''}`} data-testid="planner-readiness">
              {readiness.ready === readiness.total
                ? `Every beat has its image (${readiness.total}/${readiness.total}).`
                : `${readiness.ready}/${readiness.total} beats have their image; still needed: beat${readiness.not_ready.length === 1 ? '' : 's'} ${readiness.not_ready.map((b) => b.beat_number).join(', ')}. Planning and writing can go on. `}
              {readiness.ready < readiness.total && <Link to={scenesPath(episodeId)}>Fix them on the Beat Plan →</Link>}
            </p>
          )}
          <PlanChangesNotice report={planChanges} plan={plan} episodeId={episodeId} />
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

        </div>
      </div>

      <LocationsStrip locations={locations.locations} showId={locations.show_id} episodeId={episodeId} />

      {!loading && loadFailed && (
        <div className="scene-planner-empty" role="alert" data-testid="beat-plan-load-failed">
          <p className="scene-planner-empty-title">{plan.length > 0 ? "Couldn't refresh the beat plan" : "Couldn't load the beat plan"}</p>
          <p className="scene-planner-empty-text">
            {plan.length > 0
              ? "The plan below is from the last successful load and may be out of date. Nothing was changed."
              : "The brief and the plan didn't load. Nothing was changed."}
          </p>
          <button type="button" className="scene-planner-btn primary" onClick={() => { setLoading(true); fetchAll(); }}>Retry</button>
        </div>
      )}

      {!loading && !loadFailed && (
        <BriefPanel brief={brief} onUpdate={handleUpdateBrief}
          onGenerate={handleGenerate} generating={generating} />
      )}

      {loading && <p className="scene-planner-loading">Loading...</p>}

      {!loading && !loadFailed && plan.length === 0 && (
        <div className="scene-planner-empty">
          <div className="scene-planner-empty-icon">✦</div>
          <p className="scene-planner-empty-title">No scene plan yet</p>
          <p className="scene-planner-empty-text">
            Fill in the Episode Brief above, then click Generate Scene Plan.
            AI will map all 14 beats to your available scene sets.
          </p>
        </div>
      )}


      {!loading && plan.length > 0 && (
        view === 'storyboard' ? (
          <div className="scene-planner-storyboard">
            {plan.map((beat, i) => (
              <BeatCard key={beat.id || i} beat={beat} index={i} episodeId={episodeId} beat11={beat11}
                change={changeFor(planChanges, beat)} />
            ))}
          </div>
        ) : (
          <div className="scene-planner-list">
            {plan.map((beat, i) => (
              <BeatRow key={beat.id || i} beat={beat} index={i} episodeId={episodeId} beat11={beat11}
                change={changeFor(planChanges, beat)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
