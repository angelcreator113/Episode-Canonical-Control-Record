/**
 * The episode's Scenes tab: the one scene workspace (Evoni's ruling L12
 * and answer L12a, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L12. "The episode's Scenes tab is the one scene workspace. Top: a status
 *   bar (beats with images, beats locked, and the next step). Then the
 *   episode's Locations with role, thumbnail and angle count, and Edit
 *   locations. Then the 14 beats as one list grouped by location, each row
 *   showing its angle image, beat name, set and angle, its badges (Locked,
 *   Chosen by you) and the missing-image actions; tapping a row edits it in
 *   place (a bottom sheet at phone width). A beat with a chosen angle is
 *   that beat's scene for the timeline: no separate 'Use in Episode' step
 *   and no separate Episode Scenes list. The Beat Plan page remains as a
 *   full-screen link."
 *   L12a. "'Open in Studio' moves onto each beat's row in the new Scenes
 *   tab; existing untied scenes show once under 'Older scenes' until
 *   removed."
 *
 * The beats come from GET /episode-brief/:id/plan (which also brings each
 * beat's scene row up to date and gives its scene_id); the editor and the
 * missing-image actions are the Beat Plan's (components/BeatPlan). The
 * feed moment warning (§8(w) P5, Task #2216) and Edit locations (L6) stay.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Film, Loader, AlertTriangle, Clapperboard, Trash2 } from 'lucide-react';
import apiClient from '../../services/api';
import EpisodeLocationsStep from '../EpisodeLocationsStep';
import {
  ROLE_LABELS, SHOT_LABELS, fmtType, ChosenBadge, MissingAngle, BeatEditor, beatImage, beatImageLabel, beatSetName, isDressed,
} from '../BeatPlan/BeatPlanParts';
import useBeatActions from '../BeatPlan/useBeatActions';
import { sceneSetPath } from '../../utils/sceneSets';
import usePlanRefresh from '../BeatPlan/usePlanRefresh';
import RemovedSetsBanner from '../BeatPlan/RemovedSetsBanner';
import OpenInSceneSets from '../OpenInSceneSets';
import './EpisodeScenesTab.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Track 6 CP5 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// The workspace's fetch sites (L12 retired the scene-set picker, the angle
// suggestions and "Use in Episode", with their helpers).
export const listEpisodeScenesApi = (episodeId) =>
  apiClient.get(`${API_BASE}/episodes/${episodeId}/scenes`);
export const deleteSceneApi = (sceneId) =>
  apiClient.delete(`${API_BASE}/scenes/${sceneId}`);
export const getEpisodePlanApi = (episodeId) =>
  apiClient.get(`${API_BASE}/episode-brief/${episodeId}/plan`);
export const toggleBeatLockApi = (episodeId, beatNumber) =>
  apiClient.post(`${API_BASE}/episode-brief/${episodeId}/plan/${beatNumber}/lock`);
export const lockAllBeatsApi = (episodeId) =>
  apiClient.post(`${API_BASE}/episode-brief/${episodeId}/plan/lock-all`);
// The episode's locations with their roles (L6; Evoni, 2026-10-02)
export const getEpisodeLocationsApi = (episodeId) =>
  apiClient.get(`${API_BASE}/episodes/${episodeId}/locations`);
export const saveEpisodeLocationsApi = (episodeId, locations) =>
  apiClient.put(`${API_BASE}/episodes/${episodeId}/locations`, { locations });
export const retryFeedMomentsApi = (episodeId) =>
  apiClient.post(`${API_BASE}/episode-brief/${episodeId}/feed-moments/retry`);

// "3", "3 and 7", "3, 7 and 12"
const listBeats = (beats) => (beats.length < 2
  ? String(beats[0])
  : `${beats.slice(0, -1).join(', ')} and ${beats[beats.length - 1]}`);

const locationLabel = (l) => (l.role === 'extra' && l.name ? l.name : ROLE_LABELS[l.role] || l.role);

/**
 * The beats grouped by location: the episode's locations in their order,
 * then other sets a beat uses, then beats with no location. Empty groups
 * are left out.
 */
export function groupBeats(plan, locations) {
  const groups = [];
  const byKey = new Map();
  const group = (key, title) => {
    if (!byKey.has(key)) {
      const g = { key, title, beats: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    return byKey.get(key);
  };
  for (const l of locations || []) group(l.scene_set_id, `${locationLabel(l)}: ${l.scene_set?.name || 'Scene set'}`);
  const rest = [];
  for (const beat of [...(plan || [])].sort((a, b) => a.beat_number - b.beat_number)) {
    if (beat.scene_set_id && byKey.has(beat.scene_set_id)) byKey.get(beat.scene_set_id).beats.push(beat);
    else rest.push(beat);
  }
  for (const beat of rest) {
    (beat.scene_set_id ? group(beat.scene_set_id, beat.sceneSet?.name || 'Scene set') : group('none', 'No location')).beats.push(beat);
  }
  return groups.filter((g) => g.beats.length > 0);
}

/**
 * S9 (a) (Evoni, 2026-10-02; §8(hh)): "an accurate background summary,
 * such as 12 ready · 2 need attention". readiness is planReadiness's, which
 * counts a beat at a removed set, a missing zone or a missing base.
 */
export function statusText(readiness, total) {
  if (!total) return 'No beats yet';
  if (!readiness) return `${total} ${total === 1 ? 'beat' : 'beats'}`;
  const issues = (readiness.not_ready || []).length;
  if (!issues) return `All ${readiness.total} backgrounds ready`;
  return `${readiness.ready} ready · ${issues} ${issues === 1 ? 'needs' : 'need'} attention`;
}

/**
 * S9 (b): where a beat's background comes from. A beat whose zone is
 * missing but shows a stand-in picture (the set's base, or the event's
 * look) says so: "The Glasshouse · Front missing (reference: Inside)".
 */
export function whereText(beat) {
  const set = beatSetName(beat, 'No location');
  const missing = beat.location?.missing;
  const label = beatImageLabel(beat);
  if (missing) {
    const what = `${set} · ${missing.name || missing.label || 'View'} missing`;
    if (!beatImage(beat)) return what;
    const view = label ? label.split(' · ').slice(1).join(' · ') : '';
    return `${what} (reference: ${view || 'set image'})`;
  }
  if (label) return label;
  const angle = beat.location?.angle;
  return `${set}${angle ? ` · ${angle.name || angle.label}` : beat.angle_label ? ` · ${beat.angle_label}` : ''}`;
}

/** The status bar's next step (L12): plan, images, locks, then the script. */
export function nextStep(plan, readiness) {
  const total = plan.length;
  if (!total) return { kind: 'plan', text: 'Make the beat plan' };
  if (readiness && readiness.ready < readiness.total) {
    const beats = (readiness.not_ready || []).map((b) => b.beat_number);
    return { kind: 'images', text: `Add the missing images: ${beats.length === 1 ? 'beat' : 'beats'} ${listBeats(beats)}` };
  }
  if (plan.some((b) => !b.locked)) return { kind: 'lock', text: 'Lock the beats' };
  return { kind: 'script', text: 'Write the script' };
}

const EpisodeScenesTab = ({ episode, onToast, sourceEvent = null }) => {
  const episodeId = episode?.id;

  const [plan, setPlan] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [showIssues, setShowIssues] = useState(false);
  // S9 (b): one location expanded at a time; story order unless grouped;
  // one beat's Details open at a time.
  const [openLocation, setOpenLocation] = useState(null);
  const [grouped, setGrouped] = useState(false);
  const [openDetails, setOpenDetails] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [locations, setLocations] = useState({ locations: [], show_id: null });
  const [olderScenes, setOlderScenes] = useState([]);

  // Beats whose feed moment was not saved at generation (§8(w) P5, Task #2216)
  const [feedMomentCheck, setFeedMomentCheck] = useState({ missing: [], error: null });
  // Retry for just those beats (Task #2220): { running, note } — note is a plain-words outcome
  const [feedMomentRetry, setFeedMomentRetry] = useState({ running: false, note: null });

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
  }, [onToast]);

  const loadPlan = useCallback(async () => {
    if (!episodeId) return;
    try {
      const res = await getEpisodePlanApi(episodeId);
      const data = res.data || {};
      setPlan(Array.isArray(data.data) ? data.data : []);
      setReadiness(data.readiness || null);
      setFeedMomentCheck({
        missing: Array.isArray(data.feed_moment_missing) ? data.feed_moment_missing : [],
        error: data.feed_moment_check_error || null,
      });
    } catch (err) {
      console.error('Failed to load the beats:', err);
      setFeedMomentCheck({ missing: [], error: err.message || 'request failed' });
    } finally {
      setLoadingPlan(false);
    }
  }, [episodeId]);

  const loadLocations = useCallback(async () => {
    if (!episodeId) return null;
    try {
      const res = await getEpisodeLocationsApi(episodeId);
      const data = res.data?.data && !Array.isArray(res.data.data) ? res.data.data : {};
      const next = { locations: data.locations || [], show_id: data.show_id || episode?.show_id || null, editable: data.editable };
      setLocations(next);
      return next.show_id;
    } catch (err) {
      console.error('Failed to load the episode locations:', err);
      return episode?.show_id || null;
    }
  }, [episodeId, episode?.show_id]);

  // L12a: scenes made before scenes followed the beats.
  const loadOlderScenes = useCallback(async () => {
    if (!episodeId) return;
    try {
      const res = await listEpisodeScenesApi(episodeId);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setOlderScenes(list.filter((s) => s && s.id && !s.scene_plan_id));
    } catch (err) {
      console.error('Failed to load the older scenes:', err);
    }
  }, [episodeId]);

  const reload = useCallback(async () => {
    await Promise.all([loadPlan(), loadLocations(), loadOlderScenes()]);
  }, [loadPlan, loadLocations, loadOlderScenes]);

  useEffect(() => { reload(); }, [reload]);

  // Display bug 3 (Evoni, 2026-10-02): re-read while a beat's image is still generating.
  usePlanRefresh(plan, loadPlan);

  // Refetch when the window regains focus (e.g. an angle was made in Scene Sets)
  useEffect(() => {
    const handleFocus = () => { reload(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reload]);

  const linkedIds = new Set(locations.locations.map((l) => l.scene_set_id));
  const beats = useBeatActions({
    episodeId, showToast: toast, reload, showId: locations.show_id || episode?.show_id || null, loadShowId: loadLocations, linkedIds, fromLabel: 'Scenes tab',
  });

  // Re-run the save for the missing beats only, then refresh the warning
  const retryFeedMoments = async () => {
    if (!episodeId || feedMomentRetry.running) return;
    setFeedMomentRetry({ running: true, note: null });
    let note;
    try {
      const res = await retryFeedMomentsApi(episodeId);
      const { saved = 0, failed = [] } = res.data?.data || {};
      const savedBeats = feedMomentCheck.missing.filter((b) => !failed.some((f) => Number(f.beat_number) === b));
      if (failed.length === 0) {
        note = saved > 0 ? `Saved the feed moment for ${savedBeats.length === 1 ? 'beat' : 'beats'} ${listBeats(savedBeats)}.` : 'Nothing needed saving.';
      } else {
        const failedBeats = failed.map((f) => Number(f.beat_number));
        note = `${saved > 0 ? `Saved ${saved} of ${saved + failed.length}. ` : ''}Still not saved for ${failedBeats.length === 1 ? 'beat' : 'beats'} ${listBeats(failedBeats)}: ${failed[0].error}`;
      }
    } catch (err) {
      console.error('Failed to retry feed moments:', err);
      note = `Could not retry the feed moments: ${err.response?.data?.error || err.message || 'request failed'}`;
    }
    await loadPlan();
    setFeedMomentRetry({ running: false, note });
  };

  // Edit locations (L6): the same step as Start Episode, while the episode
  // is a draft. A changed home, closet or event takes its unlocked plan
  // beats with it; locked and chosen beats stay (Q16, L11).
  const [locationsEdit, setLocationsEdit] = useState(null);
  const [savingLocations, setSavingLocations] = useState(false);
  const openLocations = async () => {
    try {
      const res = await getEpisodeLocationsApi(episodeId);
      const data = res.data?.data || {};
      if (data.editable === false) {
        toast('This episode is accepted; its locations are fixed.', 'error');
        return;
      }
      setLocationsEdit({ locations: data.locations || [], angleGaps: data.angle_gaps || [] });
    } catch (err) {
      console.error('Failed to load episode locations:', err);
      toast(err.response?.data?.error || 'Could not load the episode locations', 'error');
    }
  };
  const saveLocations = async (next) => {
    setSavingLocations(true);
    try {
      await saveEpisodeLocationsApi(episodeId, next);
      setLocationsEdit(null);
      toast('Locations saved', 'success');
      await reload();
    } catch (err) {
      console.error('Failed to save episode locations:', err);
      toast(err.response?.data?.error || 'Could not save the locations', 'error');
    } finally {
      setSavingLocations(false);
    }
  };

  const lockAll = async () => {
    try {
      await lockAllBeatsApi(episodeId);
      toast('All beats locked — ready for the script', 'success');
      await loadPlan();
    } catch (err) {
      console.error('Failed to lock the beats:', err);
      toast(err.response?.data?.error || 'Could not lock the beats', 'error');
    }
  };

  // S9 (b, d): a beat is locked and unlocked from its Details here.
  const toggleLock = async (beat) => {
    try {
      await toggleBeatLockApi(episodeId, beat.beat_number);
      toast(beat.locked ? `Beat ${beat.beat_number} unlocked` : `Beat ${beat.beat_number} locked`, 'success');
      await loadPlan();
    } catch (err) {
      console.error('Failed to change the beat lock:', err);
      toast(err.response?.data?.error || 'Could not change the lock', 'error');
    }
  };

  const removeOlderScene = async (scene) => {
    try {
      await deleteSceneApi(scene.id);
      setOlderScenes((prev) => prev.filter((s) => s.id !== scene.id));
      toast('Scene removed', 'info');
    } catch (err) {
      console.error('Failed to delete scene:', err);
      toast(err.response?.data?.error || 'Could not remove the scene', 'error');
    }
  };

  const showId = locations.show_id || episode?.show_id || null;
  const total = plan.length;
  const locked = plan.filter((b) => b.locked).length;
  const issues = readiness?.not_ready || [];
  const step = nextStep(plan, readiness);
  const groups = groupBeats(plan, locations.locations);
  const storyOrder = [...plan].sort((a, b) => a.beat_number - b.beat_number);
  const editingNumber = beats.editingBeat?.beat_number ?? null;

  return (
    <div className="est-container est-workspace">
      {feedMomentCheck.missing.length > 0 && (
        <div className="est-warning" role="alert">
          <AlertTriangle size={16} className="est-warning-icon" />
          <p>
            Lala's phone moment was not saved for {feedMomentCheck.missing.length === 1 ? 'beat' : 'beats'}{' '}
            {listBeats(feedMomentCheck.missing)}, so {feedMomentCheck.missing.length === 1 ? 'that beat has' : 'those beats have'} no
            feed moment.
          </p>
          <button
            type="button"
            className="est-btn est-btn-outline est-btn-sm est-warning-action"
            onClick={retryFeedMoments}
            disabled={feedMomentRetry.running}
          >
            {feedMomentRetry.running ? <><Loader size={13} className="est-spin" /> Retrying…</> : 'Retry feed moments'}
          </button>
        </div>
      )}
      {feedMomentRetry.note && (
        <p className="est-warning-note" role="status">{feedMomentRetry.note}</p>
      )}
      {feedMomentCheck.error && (
        <div className="est-warning" role="alert">
          <AlertTriangle size={16} className="est-warning-icon" />
          <p>Could not check whether this episode's feed moments were saved: {feedMomentCheck.error}</p>
        </div>
      )}

      {/* ===== Status bar (L12; S9 a: what needs attention) ===== */}
      <div className="est-status" data-testid="est-status">
        <div className="est-status-counts">
          <span className="est-status-count" data-testid="est-status-images">
            {total ? `Backgrounds: ${statusText(readiness, total)}` : 'No beats yet'}
          </span>
          {issues.length > 0 && (
            <button type="button" className="est-btn est-btn-outline est-btn-sm" aria-expanded={showIssues}
              onClick={() => setShowIssues((v) => !v)} data-testid="est-review-issues">
              {showIssues ? 'Hide issues' : 'Review issues'}
            </button>
          )}
          {total > 0 && <span className="est-status-count" data-testid="est-status-locked">{locked}/{total} locked</span>}
        </div>
        <div className="est-status-next" data-testid="est-status-next">
          <span className="est-status-next-label">Next:</span>{' '}
          {step.kind === 'plan' && <Link to={`/episodes/${episodeId}/plan`}>{step.text}</Link>}
          {step.kind === 'images' && <span>{step.text}</span>}
          {step.kind === 'lock' && (
            <button type="button" className="est-btn est-btn-primary est-btn-sm" onClick={lockAll} data-testid="est-lock-all">{step.text}</button>
          )}
          {step.kind === 'script' && <Link to={`/episodes/${episodeId}/script-writer`}>{step.text}</Link>}
        </div>
        <div className="est-status-links">
          <Link className="est-btn est-btn-outline est-btn-sm" to={`/episodes/${episodeId}/plan`} data-testid="est-open-beat-plan">
            <Film size={14} /> Beat Plan (full screen)
          </Link>
          <Link className="est-btn est-btn-outline est-btn-sm" to={`/studio/timeline?episode_id=${episodeId}`}>
            <Clapperboard size={14} /> Timeline
          </Link>
        </div>
      </div>

      {/* D2: the removed sets' repair, "Move my beats to…". Always in view
          when the episode uses a removed set (a beat, a location, a scene or
          its event), never behind Review issues; nothing otherwise. */}
      <RemovedSetsBanner key={`removed-${plan.map((b) => b.scene_set_id).join(',')}`} episodeId={episodeId} showId={showId} onMoved={reload} />

      {/* S9 (a): each beat that needs attention, with its fix. */}
      {showIssues && issues.length > 0 && (
        <section className="est-issues" aria-label="Needs attention" data-testid="est-issues">
          <h3 className="est-issues-title">Needs attention</h3>
          <ul className="est-issues-list">
            {issues.map((item) => (
              <li key={item.beat_number} className="est-issue" data-testid={`est-issue-${item.beat_number}`}>
                <span className="est-issue-text">Beat {item.beat_number} · {item.beat_name} — {item.text}</span>
                {item.fix?.kind === 'scene_set' && (
                  <OpenInSceneSets showId={showId} setId={item.fix.scene_set_id} zone={item.fix.zone || null} fromLabel="Scenes tab" className="est-issue-action" />
                )}
                {item.fix?.kind === 'locations' && (
                  <button type="button" className="est-btn est-btn-outline est-btn-sm" onClick={openLocations}>Edit locations</button>
                )}
                {item.fix?.kind === 'removed_set' && <span className="est-issue-hint">choose its replacement in Move my beats</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Locations: a compact strip (L12; S9 b) ===== */}
      <section className="est-section est-section-compact" data-testid="est-locations">
        <div className="est-location-strip" data-testid="est-location-strip">
          <MapPin size={15} className="est-location-strip-icon" aria-hidden="true" />
          {locations.locations.length === 0 ? (
            <span className="est-empty-hint">No locations yet.</span>
          ) : locations.locations.map((l) => (
            <button
              key={`${l.role}-${l.scene_set_id}`} type="button"
              className={`est-location-chip${openLocation === l.scene_set_id ? ' is-open' : ''}`}
              aria-expanded={openLocation === l.scene_set_id}
              onClick={() => setOpenLocation((cur) => (cur === l.scene_set_id ? null : l.scene_set_id))}
              data-testid={`est-location-chip-${l.scene_set_id}`}
            >{`${locationLabel(l)} · ${l.scene_set?.name || 'Scene set'}`}</button>
          ))}
          <button className="est-btn est-btn-outline est-btn-sm" onClick={openLocations} data-testid="est-edit-locations">
            Edit locations
          </button>
        </div>
        {(() => {
          const l = locations.locations.find((x) => x.scene_set_id === openLocation);
          if (!l) return null;
          const views = l.angle_count ?? 0;
          return (
            <div className="est-location-detail" data-testid={`est-location-detail-${l.scene_set_id}`}>
              {l.scene_set?.base_still_url
                ? <img className="est-location-thumb" src={l.scene_set.base_still_url} alt="" />
                : <span className="est-location-thumb is-empty" aria-hidden="true"><MapPin size={16} /></span>}
              <span className="est-location-text">
                <span className="est-location-name">{l.scene_set?.name || 'Scene set'}</span>
                <span className="est-location-meta">{views ? `Base image and ${views} more ${views === 1 ? 'view' : 'views'}` : 'Base image only'}</span>
                <span className="est-location-links">
                  {showId && <Link to={sceneSetPath(showId, l.scene_set_id)}>Open in Scene Sets</Link>}
                  {l.role === 'event' && sourceEvent?.id && (sourceEvent.show_id || showId) && (
                    <Link to={`/shows/${sourceEvent.show_id || showId}/events/${sourceEvent.id}`}>Open Event Package</Link>
                  )}
                </span>
              </span>
            </div>
          );
        })()}
        {locationsEdit && (
          <EpisodeLocationsStep
            showId={showId}
            title="Episode locations"
            confirmLabel="Save locations"
            initial={locationsEdit.locations}
            angleGaps={locationsEdit.angleGaps}
            busy={savingLocations}
            onConfirm={saveLocations}
            onCancel={() => setLocationsEdit(null)}
          />
        )}
      </section>

      {/* ===== The beats, in story order (S9 b; grouped by location as an option, L12) ===== */}
      <section className="est-section" data-testid="est-beats">
        <div className="est-section-header">
          <div className="est-section-title">
            <Film size={18} />
            <h3>Beats</h3>
            <span className="est-count">{total}</span>
          </div>
          {total > 0 && (
            <label className="est-group-toggle">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
              Group by location
            </label>
          )}
        </div>
        {loadingPlan ? (
          <div className="est-loading">Loading the beats…</div>
        ) : total === 0 ? (
          <p className="est-empty-hint">No beat plan yet. <Link to={`/episodes/${episodeId}/plan`}>Make the beat plan</Link> to map the 14 beats to the locations.</p>
        ) : (grouped ? groups : [{ key: 'story', title: null, beats: storyOrder }]).map((g) => (
          <div key={g.key} className={g.title ? 'est-beat-group' : 'est-beat-story'} data-testid={`est-group-${g.key}`}>
            {g.title && <h4 className="est-beat-group-title">{g.title}</h4>}
            <ul className="est-beats">
              {g.beats.map((beat) => {
                const n = beat.beat_number;
                const img = beatImage(beat);
                const reference = Boolean(beat.location?.missing && img);
                const editing = editingNumber === n;
                const detailsOpen = openDetails === n;
                const change = () => { if (!beat.locked) beats.openEditor(beat); };
                return (
                  <li key={beat.id || n} className={`est-beat${beat.locked ? ' is-locked' : ''}${editing ? ' is-editing' : ''}`}>
                    <div className="est-beat-main" data-testid={`est-beat-${n}`}>
                      <span className="est-beat-thumb-wrap">
                        {img
                          ? <img className={`est-beat-thumb${reference ? ' is-reference' : ''}`} src={img} alt="" />
                          : <span className="est-beat-thumb is-empty" data-testid={`est-thumb-missing-${n}`}>Missing</span>}
                        {reference && <span className="est-reference-tag" data-testid={`est-reference-${n}`}>Reference</span>}
                      </span>
                      <span className="est-beat-text">
                        <span className="est-beat-name"><span className="est-beat-num">{n}</span> {beat.beat_name}</span>
                        {beat.scene_context && <span className="est-beat-story" data-testid={`est-story-${n}`}>{beat.scene_context}</span>}
                        <span className="est-beat-where" data-testid={`est-where-${n}`}>{whereText(beat)}</span>
                      </span>
                    </div>
                    <div className="est-beat-side">
                      <MissingAngle beat={beat} {...beats.missingPropsFor(beat)} />
                      <button type="button" className="est-btn est-btn-primary est-btn-sm" onClick={change} disabled={beat.locked}
                        aria-label={`Change background for beat ${n}`}
                        title={beat.locked ? 'Locked: unlock it in Details to change it' : undefined}>
                        Change background
                      </button>
                      <button type="button" className="est-btn est-btn-outline est-btn-sm" aria-expanded={detailsOpen}
                        aria-label={`Details for beat ${n}`} onClick={() => setOpenDetails((cur) => (cur === n ? null : n))}>
                        Details
                      </button>
                    </div>
                    {detailsOpen && (
                      <div className="est-beat-details" data-testid={`est-details-${n}`}>
                        {beat.shot_type && <p>Shot: {SHOT_LABELS[beat.shot_type] || fmtType(beat.shot_type)}</p>}
                        {beat.emotional_intent && <p>Emotional intent: {beat.emotional_intent}</p>}
                        {beat.chosen_by_user && (
                          <p><ChosenBadge beat={beat} className="est-badge is-chosen" /> A re-plan or a location change leaves this beat as it is.</p>
                        )}
                        {isDressed(beat) && <p><span className="est-badge is-dressed">Event look</span> The background is dressed for the event.</p>}
                        <div className="est-beat-details-actions">
                          <button type="button" className="est-btn est-btn-outline est-btn-sm" onClick={() => toggleLock(beat)}>
                            {beat.locked ? 'Unlock' : 'Lock'}
                          </button>
                          {beat.scene_id && (
                            <Link className="est-btn est-btn-outline est-btn-sm" to={`/studio/scene/${beat.scene_id}`} data-testid={`est-studio-${n}`}>
                              Open in Studio
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                    {editing && (
                      <div className="est-beat-sheet" data-testid="est-beat-sheet">
                        <button type="button" className="est-sheet-backdrop" aria-label="Close the beat editor" onClick={beats.closeEditor} />
                        <div className="est-sheet-body">
                          <BeatEditor key={n} beat={beats.editingBeat} library={beats.library} linkedIds={linkedIds}
                            onSave={beats.saveBeat} onRelease={beats.releaseBeat} onCancel={beats.closeEditor} saving={beats.savingBeat} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* ===== Older scenes (L12a) ===== */}
      {olderScenes.length > 0 && (
        <section className="est-section est-older" data-testid="est-older-scenes">
          <div className="est-section-header">
            <div className="est-section-title">
              <Clapperboard size={18} />
              <h3>Older scenes</h3>
              <span className="est-count">{olderScenes.length}</span>
            </div>
          </div>
          <p className="est-empty-hint">
            Made before the scenes followed the beats. They stay on the Timeline until you remove them.
          </p>
          <ul className="est-older-list">
            {olderScenes.map((scene) => (
              <li key={scene.id} className="est-older-scene" data-testid={`est-older-${scene.id}`}>
                {scene.background_url
                  ? <img className="est-beat-thumb" src={scene.background_url} alt="" />
                  : <span className="est-beat-thumb is-empty" aria-hidden="true">No image</span>}
                <span className="est-older-title">{scene.title || `Scene ${scene.scene_number}`}</span>
                <Link className="est-btn est-btn-outline est-btn-sm" to={`/studio/scene/${scene.id}`}>Open in Studio</Link>
                <button type="button" className="est-btn-icon est-btn-danger" onClick={() => removeOlderScene(scene)}
                  aria-label={`Remove ${scene.title || 'this scene'}`} data-testid={`est-older-remove-${scene.id}`}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
};

export default EpisodeScenesTab;
