// frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Play, MessageCircle, ListChecks } from 'lucide-react';
import api from '../../services/api';
import EpisodePhoneMissionsTab from './EpisodePhoneMissionsTab';
import './EpisodeLalasPhoneTab.css';

/**
 * EpisodeLalasPhoneTab — Production → Phone (issue #1908).
 *
 * Presents Lala's phone for one episode: the Preview Phone action, what is
 * on the phone today (screens and icons from the Phone Hub, feed moments
 * persisted for this episode), a deferred notice where beat-derived
 * requirements will go, and the episode's missions as one section.
 *
 * Read-only apart from the missions section, which is the unchanged
 * EpisodePhoneMissionsTab (is_active toggles + MissionEditor).
 *
 * Deliberately NOT fetched here: GET /api/v1/episodes/:id/phone-state.
 * That route's loadOrCreateState creates a playthrough row on read, so a
 * tab view would write. The preview overlay (usePhonePlayback) owns it.
 */

// Same phone-family split the Phone Hub (UIOverlaysTab) uses: 'phone' is a
// screen, 'phone_icon' / 'icon' are home-screen icons; anything else is a
// non-phone UI overlay and is not shown here.
const ICON_CATEGORIES = new Set(['phone_icon', 'icon']);

// ── Module-scope API helpers (existing routes, unchanged) ──

// GET /api/v1/ui-overlays/:showId?episode_id= — show screens merged with
// this episode's overrides (uiOverlayRoutes GET /:showId).
export async function listEpisodePhoneOverlaysApi(showId, episodeId) {
  const { data } = await api.get(
    `/api/v1/ui-overlays/${showId}?episode_id=${encodeURIComponent(episodeId)}`,
  );
  return data?.data || [];
}

// GET /api/v1/feed-enhanced/:showId/moments/:episodeId — persisted
// FeedMoment rows; ScreenContentRenderer's DM and notification content
// zones read the same route.
export async function listEpisodeFeedMomentsApi(showId, episodeId) {
  const { data } = await api.get(`/api/v1/feed-enhanced/${showId}/moments/${episodeId}`);
  return data?.data || [];
}

export function splitPhoneOverlays(overlays) {
  const phone = (overlays || []).filter(o => o && (o.category || 'phone') === 'phone');
  const icons = (overlays || []).filter(o => o && ICON_CATEGORIES.has(o.category));
  return {
    screens: phone.filter(o => o.generated),
    missingScreens: phone.filter(o => !o.generated),
    icons: icons.filter(o => o.generated),
    missingIcons: icons.filter(o => !o.generated),
  };
}

function countBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const k = item?.[key] || 'other';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function EpisodeLalasPhoneTab({ episode, onPreview }) {
  const showId = episode?.show_id || episode?.showId || episode?.show?.id;
  const episodeId = episode?.id;

  const [overlays, setOverlays] = useState([]);
  const [overlaysLoading, setOverlaysLoading] = useState(true);
  const [overlaysError, setOverlaysError] = useState(null);
  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(true);
  const [momentsError, setMomentsError] = useState(null);

  const load = useCallback(async () => {
    if (!showId || !episodeId) {
      setOverlaysLoading(false);
      setMomentsLoading(false);
      return;
    }
    setOverlaysLoading(true);
    setMomentsLoading(true);
    setOverlaysError(null);
    setMomentsError(null);
    try {
      setOverlays(await listEpisodePhoneOverlaysApi(showId, episodeId));
    } catch (err) {
      console.error('[EpisodeLalasPhoneTab] overlays load failed:', err);
      setOverlaysError(err?.response?.data?.error || err.message);
    } finally {
      setOverlaysLoading(false);
    }
    try {
      setMoments(await listEpisodeFeedMomentsApi(showId, episodeId));
    } catch (err) {
      console.error('[EpisodeLalasPhoneTab] feed moments load failed:', err);
      setMomentsError(err?.response?.data?.error || err.message);
    } finally {
      setMomentsLoading(false);
    }
  }, [showId, episodeId]);

  useEffect(() => { load(); }, [load]);

  const { screens, missingScreens, icons, missingIcons } = splitPhoneOverlays(overlays);
  const homeScreen = screens.find(s => s.is_home) || null;
  const momentTypes = countBy(moments, 'phone_screen_type');

  return (
    <div className="lalas-phone-tab">
      {/* ── Header + preview ── */}
      <header className="lalas-phone-header">
        <div className="lalas-phone-header-text">
          <h2 className="lalas-phone-title">
            <Smartphone size={18} aria-hidden="true" /> Lala&apos;s Phone
          </h2>
          <p className="lalas-phone-subtitle">
            What&apos;s on Lala&apos;s phone for this episode, and what the episode needs from it.
          </p>
        </div>
        <button
          type="button"
          className="lalas-phone-preview-btn"
          onClick={onPreview}
          disabled={!onPreview || !showId}
          title="Preview Phone"
        >
          <Play size={14} aria-hidden="true" /> Preview Phone
        </button>
      </header>

      {/* ── On the phone ── */}
      <section className="lalas-phone-section" aria-labelledby="lalas-phone-on-phone">
        <h3 id="lalas-phone-on-phone" className="lalas-phone-section-title">On the phone</h3>
        {overlaysLoading && <div className="lalas-phone-muted">Loading phone screens…</div>}
        {overlaysError && <div className="lalas-phone-error">Error: {overlaysError}</div>}
        {!overlaysLoading && !overlaysError && (
          <>
            <div className="lalas-phone-stats">
              <span className="lalas-phone-pill">{screens.length} screens</span>
              <span className="lalas-phone-pill">{icons.length} icons</span>
              {homeScreen && <span className="lalas-phone-pill">Home: {homeScreen.name}</span>}
              {(missingScreens.length > 0 || missingIcons.length > 0) && (
                <span className="lalas-phone-pill lalas-phone-pill-warn">
                  {missingScreens.length + missingIcons.length} not generated yet
                </span>
              )}
            </div>
            {screens.length === 0 ? (
              <div className="lalas-phone-empty">
                No phone screens are generated for this show yet. Screens are built in the Phone Hub.
              </div>
            ) : (
              <ul className="lalas-phone-screens">
                {screens.map(s => {
                  const taps = Array.isArray(s.screen_links) ? s.screen_links.length : 0;
                  const zones = Array.isArray(s.content_zones) ? s.content_zones.length : 0;
                  return (
                    <li key={s.asset_id || s.id} className="lalas-phone-screen">
                      <div className="lalas-phone-thumb">
                        {s.url ? <img src={s.url} alt="" loading="lazy" /> : null}
                      </div>
                      <div className="lalas-phone-screen-name">
                        {s.name}
                        {s.is_home && <span className="lalas-phone-badge">HOME</span>}
                      </div>
                      <div className="lalas-phone-screen-meta">
                        {taps} tap {taps === 1 ? 'zone' : 'zones'} · {zones} content {zones === 1 ? 'zone' : 'zones'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ── Feed moments persisted for this episode ── */}
      <section className="lalas-phone-section" aria-labelledby="lalas-phone-moments">
        <h3 id="lalas-phone-moments" className="lalas-phone-section-title">
          <MessageCircle size={14} aria-hidden="true" /> Feed moments
        </h3>
        {momentsLoading && <div className="lalas-phone-muted">Loading feed moments…</div>}
        {momentsError && <div className="lalas-phone-error">Error: {momentsError}</div>}
        {!momentsLoading && !momentsError && moments.length === 0 && (
          <div className="lalas-phone-empty">No feed moments are saved for this episode.</div>
        )}
        {!momentsLoading && !momentsError && moments.length > 0 && (
          <>
            <div className="lalas-phone-stats">
              {Object.entries(momentTypes).map(([type, n]) => (
                <span key={type} className="lalas-phone-pill">{n} {type}</span>
              ))}
            </div>
            <ul className="lalas-phone-moments">
              {moments.map(m => (
                <li key={m.id} className="lalas-phone-moment">
                  <span className="lalas-phone-moment-type">{m.phone_screen_type || 'other'}</span>
                  {m.trigger_handle && <span className="lalas-phone-moment-handle">{m.trigger_handle}</span>}
                  <span className="lalas-phone-moment-text">
                    {m.screen_content || m.lala_line || m.trigger_action || '—'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Requirements: deferred until beats exist ── */}
      <section className="lalas-phone-section" aria-labelledby="lalas-phone-reqs">
        <h3 id="lalas-phone-reqs" className="lalas-phone-section-title">
          <ListChecks size={14} aria-hidden="true" /> What this episode needs from the phone
        </h3>
        <div className="lalas-phone-deferred" role="note" data-testid="lalas-phone-deferred">
          Requirements appear once beats exist. Scripts don&apos;t instantiate the episode&apos;s
          beats yet, so nothing is listed here.
        </div>
      </section>

      {/* ── Missions: a section, not the whole tab ── */}
      <section className="lalas-phone-section" aria-label="Missions">
        <EpisodePhoneMissionsTab episode={episode} />
      </section>
    </div>
  );
}

export default EpisodeLalasPhoneTab;
