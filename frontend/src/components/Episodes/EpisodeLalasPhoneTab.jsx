// frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, MessageCircle, ListChecks } from 'lucide-react';
import api from '../../services/api';
import EpisodePhoneMissionsTab from './EpisodePhoneMissionsTab';
import PhonePreviewMode from '../PhonePreviewMode';
import { isIcon, isScreen } from '../../lib/overlayUtils';
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
 *
 * Two panes (Task #1994, step C3 of doctrine rule 16): on the left, the same
 * phone Producer Mode draws, embedded and tappable (PhonePreviewMode
 * `embedded`), fed only from this tab's own read-only GETs and given
 * playthrough={null}, so tapping saves nothing; on the right, the content
 * above. Preview Phone (Play through) stays the explicit, saving path.
 * Editing happens in Phone Studio, which + Add screen and Edit tap zones
 * link to.
 *
 * Evoni's Episode mock (2026-10-06): the right pane is "Lala's Phone in
 * this episode", a row per screen with its state; a row picks the screen
 * the phone shows ("Showing: …"). Screens carry no beat or approval, so the
 * mock's beat and Approved / Draft are not shown.
 */

// The phone's one rule for screens and icons (lib/overlayUtils isScreen /
// isIcon), the same as Producer Mode's: this tab used to count only category
// 'phone' as a screen, so a screen Producer Mode showed could be missing here
// (Evoni, 2026-10-07, one system).

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

// GET /api/v1/ui-overlays/:showId/frame — the show's phone skin, custom frame
// and image-fit defaults (read-only; the same response usePhonePlayback reads).
export async function getPhoneFrameApi(showId) {
  const { data } = await api.get(`/api/v1/ui-overlays/${showId}/frame`);
  return data || {};
}

// The screens the embedded phone plays: the same filter the Preview Phone
// path applies (usePhonePlayback: generated, with an image).
export function playablePhoneScreens(overlays) {
  return (overlays || []).filter(o => o && o.generated && o.url);
}

export function splitPhoneOverlays(overlays) {
  const phone = (overlays || []).filter(isScreen);
  const icons = (overlays || []).filter(isIcon);
  return {
    screens: phone.filter(o => o.generated),
    missingScreens: phone.filter(o => !o.generated),
    icons: icons.filter(o => o.generated),
    missingIcons: icons.filter(o => !o.generated),
  };
}

// The content zone that draws a feed moment of each phone_screen_type
// (ScreenContentRenderer: DMThreadRenderer keeps 'dm', NotificationsRenderer
// keeps 'notification'). No zone draws the other types (post, story, live,
// ui_interaction), so those moments belong to no screen yet (#2855).
export const MOMENT_ZONE_TYPES = { dm: 'dm_thread', notification: 'notifications' };

// The playable screen a feed moment belongs to: the first one with a content
// zone that draws its type (the home screen first, as the phone opens there),
// or null when no screen on this phone draws it.
export function screenForMoment(moment, screens) {
  const zoneType = MOMENT_ZONE_TYPES[moment?.phone_screen_type];
  if (!zoneType) return null;
  const draws = s => Array.isArray(s?.content_zones) && s.content_zones.some(z => z?.content_type === zoneType);
  const list = screens || [];
  return list.find(s => s.is_home && draws(s)) || list.find(draws) || null;
}

function countBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const k = item?.[key] || 'other';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function EpisodeLalasPhoneTab({ episode, onPreview, previewError = null }) {
  const showId = episode?.show_id || episode?.showId || episode?.show?.id;
  const episodeId = episode?.id;

  const [overlays, setOverlays] = useState([]);
  const [overlaysLoading, setOverlaysLoading] = useState(true);
  const [overlaysError, setOverlaysError] = useState(null);
  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(true);
  const [momentsError, setMomentsError] = useState(null);
  // Producer Mode's default skin until /frame answers (UIOverlaysTab).
  const [frame, setFrame] = useState({ skin: 'rosegold', frameUrl: null, globalFit: undefined });

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
      const f = await getPhoneFrameApi(showId);
      setFrame({
        skin: f.phone_skin || 'rosegold',
        frameUrl: f.frame_url || null,
        globalFit: f.global_fit || undefined,
      });
    } catch (err) {
      // The phone still draws with the default skin and no custom frame.
      console.error('[EpisodeLalasPhoneTab] phone frame load failed:', err);
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
  const playable = playablePhoneScreens(overlays);
  const firstScreen = playable.find(s => s.is_home) || playable[0] || null;
  const studioPath = showId ? `/shows/${showId}/world?tab=overlays-tab` : null;
  // The screen the phone shows: a row picks it (Evoni's Episode mock,
  // 2026-10-06: "Showing: Invitation · Beat 3"); the home screen first.
  const [shownId, setShownId] = useState(null);
  const shown = playable.find(s => (s.asset_id || s.id) === shownId) || firstScreen;
  const shownKey = shown ? (shown.asset_id || shown.id) : 'none';

  return (
    <div className="lalas-phone-tab">
      <div className="lalas-phone-panes">
        {/* ── Left: the phone itself, embedded and non-saving ── */}
        <aside className="lalas-phone-device-pane" aria-label="Phone">
          {overlaysLoading && <div className="lalas-phone-muted">Loading the phone…</div>}
          {!overlaysLoading && overlaysError && (
            <div className="lalas-phone-muted">The phone can&apos;t be drawn until its screens load.</div>
          )}
          {!overlaysLoading && !overlaysError && (
            <>
              <PhonePreviewMode
                key={`${playable.map(s => s.id).join('|')}#${shownKey}`}
                embedded
                screens={playable}
                initialScreen={shown}
                phoneSkin={frame.skin}
                customFrameUrl={frame.frameUrl}
                globalFit={frame.globalFit}
                playthrough={null}
                missions={[]}
                showId={showId}
                episodeId={episodeId}
              />
              {playable.length === 0 ? (
                <p className="lalas-phone-device-hint">
                  No screens yet. Build them in{' '}
                  {studioPath ? <Link to={studioPath}>Producer Mode → Lala&apos;s Phone</Link> : <>Producer Mode → Lala&apos;s Phone</>}.
                </p>
              ) : (
                <>
                  <p className="lalas-phone-showing" data-testid="lalas-phone-showing">
                    Showing: {shown?.name || 'the phone'}
                  </p>
                  <p className="lalas-phone-device-hint">Tap to try it. Nothing here is saved.</p>
                </>
              )}
            </>
          )}
        </aside>

        <div className="lalas-phone-content-pane">
          {/* ── Lala's Phone in this episode: one row per screen ── */}
          <section className="lalas-phone-card" aria-labelledby="lalas-phone-on-phone">
            <div className="lalas-phone-card-head">
              <h2 id="lalas-phone-on-phone" className="lalas-phone-title">Lala&apos;s Phone in this episode</h2>
              {studioPath && (
                <Link to={studioPath} className="lalas-phone-add">+ Add screen</Link>
              )}
            </div>
            <p className="lalas-phone-subtitle">
              One phone, scoped to this episode. Screens are built in Producer Mode → Lala&apos;s Phone. A screen marked &ldquo;this episode&rdquo; is this episode&apos;s own: its invitation, or a per-episode screen made for it.
            </p>
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
                    No phone screens are generated for this show yet. Screens are built in Producer Mode → Lala's Phone.
                  </div>
                ) : (
                  <ul className="lalas-phone-screens">
                    {screens.map(s => {
                      const key = s.asset_id || s.id;
                      const taps = Array.isArray(s.screen_links) ? s.screen_links.length : 0;
                      const zones = Array.isArray(s.content_zones) ? s.content_zones.length : 0;
                      const canShow = Boolean(s.url);
                      const isShown = shown && (shown.asset_id || shown.id) === key;
                      return (
                        <li key={key} className={`lalas-phone-screen${isShown ? ' is-shown' : ''}`}>
                          <button
                            type="button"
                            className="lalas-phone-screen-btn"
                            onClick={() => setShownId(key)}
                            disabled={!canShow}
                            aria-pressed={Boolean(isShown)}
                            title={canShow ? `Show ${s.name} on the phone` : 'No image yet'}
                          >
                            <span className="lalas-phone-thumb">
                              {s.url ? <img src={s.url} alt="" loading="lazy" /> : null}
                            </span>
                            <span className="lalas-phone-screen-body">
                              <span className="lalas-phone-screen-name">
                                {s.name}
                                {s.is_home && <span className="lalas-phone-badge">HOME</span>}
                                {s.is_episode_override && (
                                  <span
                                    className="lalas-phone-badge lalas-phone-badge-override"
                                    title="This episode's own version of the screen, replacing the show default"
                                  >
                                    THIS EPISODE
                                  </span>
                                )}
                              </span>
                              <span className="lalas-phone-screen-source">
                                Screen · {s.is_episode_override ? 'this episode' : 'show default'}
                              </span>
                              <span className="lalas-phone-screen-meta">
                                {taps} tap {taps === 1 ? 'zone' : 'zones'} · {zones} content {zones === 1 ? 'zone' : 'zones'}
                              </span>
                            </span>
                            <span className="lalas-phone-state">Ready</span>
                          </button>
                        </li>
                      );
                    })}
                    {missingScreens.map(s => (
                      <li key={s.id} className="lalas-phone-screen is-missing">
                        <div className="lalas-phone-screen-btn" aria-disabled="true">
                          <span className="lalas-phone-thumb" />
                          <span className="lalas-phone-screen-body">
                            <span className="lalas-phone-screen-name">{s.name}</span>
                            <span className="lalas-phone-screen-source">Screen · not generated yet</span>
                          </span>
                          <span className="lalas-phone-state is-missing">To build</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="lalas-phone-card-links">
              {studioPath && <Link to={studioPath} className="lalas-phone-link">Edit tap zones</Link>}
              <button
                type="button"
                className="lalas-phone-link"
                onClick={onPreview}
                disabled={!onPreview || !showId}
                title="Play through every screen; taps are saved"
              >
                <Play size={13} aria-hidden="true" /> Play through
              </button>
            </div>
            {/* Why Play did not open; it used to fail silently (Evoni, 2026-10-07). */}
            {previewError && <p className="lalas-phone-error" role="alert" data-testid="lalas-phone-play-error">{previewError}</p>}
          </section>

          {/* ── Feed moments persisted for this episode ── */}
          <section className="lalas-phone-card" aria-labelledby="lalas-phone-moments">
            <h3 id="lalas-phone-moments" className="lalas-phone-section-title">
              <MessageCircle size={14} aria-hidden="true" /> Feed and messages
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
                  {moments.map(m => {
                    const type = m.phone_screen_type || 'other';
                    const body = (
                      <>
                        <span className="lalas-phone-moment-type">{type}</span>
                        {m.trigger_handle && <span className="lalas-phone-moment-handle">{m.trigger_handle}</span>}
                        <span className="lalas-phone-moment-text">
                          {m.screen_content || m.lala_line || m.trigger_action || '—'}
                        </span>
                      </>
                    );
                    // A moment opens the screen that draws it (#2855); one no
                    // screen draws says so instead of doing nothing.
                    const target = screenForMoment(m, playable);
                    if (!target) {
                      return (
                        <li key={m.id} className="lalas-phone-moment is-unplaced">
                          {body}
                          <span className="lalas-phone-moment-note">
                            No screen on this phone shows {type} moments yet.{' '}
                            {studioPath && <Link to={studioPath}>Build one in Producer Mode → Lala&apos;s Phone</Link>}
                          </span>
                        </li>
                      );
                    }
                    const key = target.asset_id || target.id;
                    const isShown = Boolean(shown && (shown.asset_id || shown.id) === key);
                    return (
                      <li key={m.id} className={`lalas-phone-moment-item${isShown ? ' is-shown' : ''}`}>
                        <button
                          type="button"
                          className="lalas-phone-moment lalas-phone-moment-btn"
                          onClick={() => setShownId(key)}
                          aria-pressed={isShown}
                          title={`Show ${target.name} on the phone`}
                        >
                          {body}
                          <span className="lalas-phone-moment-screen">on {target.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {/* ── Requirements: deferred until beats exist ── */}
          <section className="lalas-phone-card" aria-labelledby="lalas-phone-reqs">
            <h3 id="lalas-phone-reqs" className="lalas-phone-section-title">
              <ListChecks size={14} aria-hidden="true" /> What this episode needs from the phone
            </h3>
            <div className="lalas-phone-deferred" role="note" data-testid="lalas-phone-deferred">
              Requirements appear once beats exist. Scripts don&apos;t instantiate the episode&apos;s
              beats yet, so nothing is listed here, and no screen is placed on a beat.
            </div>
          </section>

          {/* ── Missions: a section, not the whole tab ── */}
          <section className="lalas-phone-card" aria-label="Missions">
            <EpisodePhoneMissionsTab episode={episode} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default EpisodeLalasPhoneTab;
