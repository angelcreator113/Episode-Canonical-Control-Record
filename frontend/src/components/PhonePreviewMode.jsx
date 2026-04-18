/**
 * PhonePreviewMode — Full-screen interactive phone simulator overlay
 * ScreenFlowMap — Visual diagram of screen connections
 */
import { useState, useCallback, useEffect, useMemo, Fragment } from 'react';
import { X, ChevronLeft, Wifi, Signal, BatteryFull, RotateCcw, Target, CheckCircle2, Circle } from 'lucide-react';
import { getScreenImageStyle, PHONE_SKINS } from '../components/PhoneHub';
import { filterZones, applyActions, actionsForZone, evaluateMissions, applyMissionRewards } from '../lib/phoneRuntime';

const TOKENS = { parchment: '#FAF7F0', gold: '#B8962E', ink: '#2C2C2C' };
const MONO = "'DM Mono', monospace";
const PROSE = "'Lora', serif";
const TRANSITION_MS = 300;

function getLinks(screen) {
  return screen?.screen_links || screen?.metadata?.screen_links || [];
}

/**
 * PhonePreviewMode — walk the phone end-to-end.
 *
 * Two modes:
 *   - Author mode (default): in-memory state, resets when the overlay closes.
 *     Used by the editor for quick preview.
 *   - Player mode: pass `playthrough` — a server-backed state object from the
 *     `usePhonePlaythrough(episodeId)` hook. State persists across sessions,
 *     taps hit the server-side evaluator, and the reset button clears the
 *     DB row in place. Same evaluator runs on both sides.
 */
export default function PhonePreviewMode({ screens = [], initialScreen, onClose, globalFit, phoneSkin = 'midnight', playthrough = null, missions = [] }) {
  const skin = PHONE_SKINS.find(s => s.key === phoneSkin) || PHONE_SKINS[0];
  const [activeScreen, setActiveScreen] = useState(initialScreen || screens[0] || null);
  const [history, setHistory] = useState([]);
  const [slideDir, setSlideDir] = useState(null); // 'left' | 'right' | null
  const [animating, setAnimating] = useState(false);
  // ── Phone runtime state ──
  // In author mode, these drive the evaluator directly (in-memory).
  // In player mode, we mirror the server-returned `playthrough.state` object so
  // the evaluator still has something to read between taps; the real writes go
  // through `playthrough.tap()` which returns the updated state.
  const [state, setStateRaw] = useState({});
  const [visitedScreens, setVisitedScreensRaw] = useState(() => new Set());
  const [toasts, setToasts] = useState([]);
  const [episodeComplete, setEpisodeComplete] = useState(false);
  // Track mission ids that have already fired rewards this session so we don't
  // re-fire them on every subsequent tap. In player mode the server owns this;
  // we also keep a local copy for instant UI.
  const [completedMissionIds, setCompletedMissionIds] = useState([]);
  // Transient celebration banner — populated when a mission newly completes.
  // Cleared after the banner's display window.
  const [celebrations, setCelebrations] = useState([]);

  // Hydrate from playthrough whenever it changes (covers initial load + tap responses).
  useEffect(() => {
    if (!playthrough?.state) return;
    setStateRaw(playthrough.state.state_flags || {});
    setVisitedScreensRaw(new Set(playthrough.state.visited_screens || []));
    setEpisodeComplete(Boolean(playthrough.state.completed_at));
    setCompletedMissionIds(playthrough.state.completed_mission_ids || []);
  }, [playthrough?.state]);

  const evalContext = useMemo(() => ({ state, visitedScreens }), [state, visitedScreens]);
  // Progress for each mission relative to the current state. Read-only — we
  // just display it. Completed missions bubble up in-order.
  const missionProgress = useMemo(() => evaluateMissions(missions, evalContext), [missions, evalContext]);
  const [showMissions, setShowMissions] = useState(false);
  const visibleMissions = missionProgress.filter(m => m.progress.active && (m.mission.is_active !== false));
  const completedCount = visibleMissions.filter(m => m.progress.is_complete).length;

  const resetState = useCallback(async () => {
    if (playthrough?.reset) {
      await playthrough.reset();  // server wipes + returns new state, useEffect re-hydrates
    } else {
      setStateRaw({});
      setVisitedScreensRaw(new Set());
      setCompletedMissionIds([]);
    }
    setToasts([]);
    setCelebrations([]);
    setEpisodeComplete(false);
    setHistory([]);
    setActiveScreen(initialScreen || screens[0] || null);
  }, [initialScreen, screens, playthrough]);

  // Queue a celebration banner per newly-completed mission; auto-clears after 3s.
  const celebrate = useCallback((missionsJustDone) => {
    if (!missionsJustDone || !missionsJustDone.length) return;
    const stamped = missionsJustDone.map((m, i) => ({ ...m, id: `${m.id}-${Date.now()}-${i}` }));
    setCelebrations(prev => [...prev, ...stamped]);
  }, []);

  useEffect(() => {
    if (celebrations.length === 0) return;
    const t = setTimeout(() => setCelebrations(prev => prev.slice(1)), 3000);
    return () => clearTimeout(t);
  }, [celebrations]);

  const findScreen = useCallback((key) => {
    if (!key) return null;
    const k = key.toLowerCase();
    // Exact match first, then fall back to name match
    return screens.find(s => (s.id || '').toLowerCase() === k)
      || screens.find(s => (s.name || '').toLowerCase() === k);
  }, [screens]);

  const navigateTo = useCallback((targetKey, direction = 'left') => {
    const target = findScreen(targetKey);
    if (!target || animating) return;
    setSlideDir(direction);
    setAnimating(true);
    if (direction === 'left') setHistory(h => [...h, activeScreen]);
    setTimeout(() => {
      setActiveScreen(target);
      // Track every screen the user lands on so `visited:<id>` conditions can fire.
      // In player mode the server also tracks this; we still update locally for
      // immediate UI feedback between taps.
      setVisitedScreensRaw(prev => {
        const next = new Set(prev);
        if (target.id) next.add(target.id);
        return next;
      });
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [findScreen, activeScreen, animating]);

  /**
   * The single entry point for tapping a zone. In author mode we run actions
   * locally through applyActions; in player mode we delegate to the server via
   * playthrough.tap() which runs the SAME evaluator and persists the result.
   * Either way, the returned effects (navigate/toasts/completeEpisode) drive
   * the same UI updates.
   */
  const handleZoneTap = useCallback(async (zone) => {
    if (playthrough?.tap && zone.id) {
      // Player mode — server executes (zone actions + mission rewards). The
      // response already contains any reward-merged effects plus the list of
      // missions that newly completed this tap. useEffect re-hydrates state.
      const result = await playthrough.tap(zone.id);
      const effects = result?.effects;
      if (effects?.toasts?.length) {
        setToasts(prev => [...prev, ...effects.toasts.map((t, i) => ({ ...t, id: Date.now() + i }))]);
      }
      // result shape comes from the route: { state, effects, newly_completed_missions }.
      // The playthrough hook only returns { state, effects }, so we pull from its
      // cached state if the hook was extended. For now, celebrate via state diff:
      // completed_mission_ids grows → the new ones are the newly-completed.
      if (result?.state?.completed_mission_ids) {
        const prev = new Set(completedMissionIds);
        const added = result.state.completed_mission_ids.filter(id => !prev.has(id));
        if (added.length) {
          const justDone = added
            .map(id => missions.find(m => m.id === id))
            .filter(Boolean)
            .map(m => ({ id: m.id, name: m.name }));
          celebrate(justDone);
        }
      }
      if (effects?.navigate) navigateTo(effects.navigate, 'left');
      return;
    }

    // Author mode — in-memory. Implicit defaults apply (no actions → navigate target).
    // We also run mission reward evaluation so authors can see the full loop
    // in preview without needing to wire an episode.
    const actions = actionsForZone(zone);
    // Stage mutations into a local copy of state so mission evaluation after
    // the zone action sees the new flags (React state updates are async).
    const stagedState = { ...state };
    const stagedVisited = new Set(visitedScreens);
    if (zone.id && zone.target) stagedVisited.add(zone.target);
    const writer = {
      setState: (k, v) => { stagedState[k] = v; },
      markEpisodeComplete: () => setEpisodeComplete(true),
    };
    const effects = applyActions(actions, evalContext, writer);
    // Now evaluate missions against stagedState and fire rewards for newly-complete ones.
    const missionCtx = { state: stagedState, visitedScreens: stagedVisited };
    const rewardResult = applyMissionRewards({
      missions,
      prevCompletedIds: completedMissionIds,
      context: missionCtx,
      writer,
    });
    // Commit staged flags to React state in one update.
    setStateRaw(stagedState);
    if (rewardResult.newlyCompletedIds.length) {
      setCompletedMissionIds(prev => [...prev, ...rewardResult.newlyCompletedIds]);
      celebrate(rewardResult.newlyCompletedMissions);
    }
    // Merge reward effects into the primary effects collection.
    const allToasts = [...effects.toasts, ...rewardResult.effects.toasts];
    if (allToasts.length) {
      setToasts(prev => [...prev, ...allToasts.map((t, i) => ({ ...t, id: Date.now() + i }))]);
    }
    if (rewardResult.effects.completeEpisode) setEpisodeComplete(true);
    const finalNavigate = effects.navigate || rewardResult.effects.navigate;
    if (finalNavigate) navigateTo(finalNavigate, 'left');
  }, [evalContext, navigateTo, playthrough, state, visitedScreens, missions, completedMissionIds, celebrate]);

  // Auto-dismiss toasts after 2.5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 2500);
    return () => clearTimeout(timer);
  }, [toasts]);

  const goBack = useCallback(() => {
    if (!history.length || animating) return;
    setSlideDir('right');
    setAnimating(true);
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setTimeout(() => {
      setActiveScreen(prev);
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [history, animating]);

  const goHome = useCallback(() => {
    const home = initialScreen || screens[0];
    if (!home || animating) return;
    setSlideDir('right');
    setAnimating(true);
    setHistory([]);
    setTimeout(() => {
      setActiveScreen(home);
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [initialScreen, screens, animating]);

  // ESC key handler
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const trail = history.map(s => s?.name || s?.beat || s?.id || '?');
    if (activeScreen) trail.push(activeScreen.name || activeScreen.beat || activeScreen.id || '?');
    return trail;
  }, [history, activeScreen]);

  // Filter zones through the evaluator — locked zones don't render at all in player view
  // (they're invisible until their condition becomes true). Editor "author view" would
  // show them dimmed; that's a PR2 concern.
  const allLinks = getLinks(activeScreen);
  const { visible: links } = filterZones(allLinks, evalContext);

  const slideTransform = slideDir === 'left'
    ? 'translateX(-100%)' : slideDir === 'right'
    ? 'translateX(100%)' : 'translateX(0)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Close button */}
      <button onClick={onClose} title="Close (ESC)" style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
        padding: '8px 14px', cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 12,
      }}>
        <span style={{ opacity: 0.6 }}>ESC</span>
        <X size={16} />
      </button>

      {/* Reset button — wipes in-memory state + visited + history so authors can replay from scratch */}
      <button onClick={resetState} title="Reset playthrough" style={{
        position: 'absolute', top: 16, right: 92, zIndex: 10,
        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
        padding: '8px 12px', cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 12,
      }}>
        <RotateCcw size={14} /> Reset
      </button>

      {/* Mission progress chip — shows live count vs total completed. Click to expand
          into a panel listing each objective with its state. Only renders when the
          host passed a non-empty missions array. */}
      {visibleMissions.length > 0 && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
          <button
            onClick={() => setShowMissions(s => !s)}
            style={{
              background: 'rgba(184,150,46,0.85)', border: 'none', borderRadius: 8,
              padding: '8px 12px', cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
            }}
          >
            <Target size={14} /> {completedCount}/{visibleMissions.length}
          </button>
          {showMissions && (
            <div style={{
              marginTop: 6,
              background: 'rgba(20,20,30,0.95)', backdropFilter: 'blur(8px)',
              borderRadius: 10, padding: 10,
              width: 280, maxHeight: 400, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              border: '1px solid rgba(184,150,46,0.3)',
            }}>
              {visibleMissions.map(({ mission, progress }) => (
                <div key={mission.id} style={{ padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {progress.is_complete
                      ? <CheckCircle2 size={14} color={TOKENS.gold} />
                      : <Circle size={14} color="rgba(255,255,255,0.4)" />}
                    <span style={{ fontFamily: PROSE, fontSize: 13, fontWeight: 700, color: progress.is_complete ? TOKENS.gold : '#fff', flex: 1 }}>
                      {mission.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: MONO }}>
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                  {progress.objectives.map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 20, marginBottom: 2 }}>
                      {o.complete
                        ? <CheckCircle2 size={10} color={TOKENS.gold} />
                        : <Circle size={10} color="rgba(255,255,255,0.3)" />}
                      <span style={{ fontSize: 11, color: o.complete ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)', fontFamily: MONO, textDecoration: o.complete ? 'line-through' : 'none' }}>
                        {o.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast stack — show_toast actions land here. Auto-dismisses every 2.5s. */}
      {toasts.length > 0 && (
        <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 11, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
          {toasts.slice(0, 3).map(t => (
            <div key={t.id} style={{
              padding: '10px 16px', borderRadius: 8,
              background: t.tone === 'error' ? '#7a1a1a' : t.tone === 'warning' ? '#7a5a1a' : t.tone === 'success' ? '#1a5a3a' : '#2a2a4a',
              color: '#fff', fontSize: 13, fontFamily: PROSE,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              maxWidth: 320, textAlign: 'center',
            }}>{t.text}</div>
          ))}
        </div>
      )}

      {/* Mission-complete celebration — transient gold banner per newly-done mission.
          Stack up to 3 at a time (we auto-dismiss after 3s each). */}
      {celebrations.length > 0 && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 12,
          display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
        }}>
          {celebrations.slice(0, 3).map(c => (
            <div key={c.id} style={{
              padding: '16px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg, #B8962E, #d4b96a)', color: '#fff',
              fontFamily: PROSE, textAlign: 'center',
              boxShadow: '0 12px 40px rgba(184,150,46,0.5), 0 0 0 2px rgba(255,255,255,0.2) inset',
              animation: 'mission-pop 0.35s cubic-bezier(0.18, 1.2, 0.4, 1)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: MONO, opacity: 0.85 }}>
                ★ MISSION COMPLETE
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>
                {c.name}
              </div>
            </div>
          ))}
          <style>{`
            @keyframes mission-pop {
              0%   { opacity: 0; transform: scale(0.7) translateY(-8px); }
              70%  { opacity: 1; transform: scale(1.04) translateY(0); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Episode-complete banner */}
      {episodeComplete && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 11,
          padding: '14px 24px', borderRadius: 12,
          background: 'linear-gradient(135deg, #B8962E, #8a6c1d)', color: '#fff',
          fontSize: 14, fontFamily: PROSE, fontWeight: 700,
          boxShadow: '0 8px 32px rgba(184,150,46,0.4)',
        }}>Episode complete</div>
      )}

      {/* Phone device */}
      <div style={{
        width: 320, background: skin.body, borderRadius: 40,
        padding: '14px 10px', position: 'relative',
        boxShadow: `0 12px 48px ${skin.shadow}, inset 0 1px 0 ${skin.accent}`,
      }}>
        {/* Notch */}
        <div style={{
          width: 90, height: 7, borderRadius: 4,
          background: skin.notch, margin: '0 auto 6px',
        }} />

        {/* Screen area */}
        <div style={{
          width: '100%', aspectRatio: '9/19.5', borderRadius: 24,
          overflow: 'hidden', position: 'relative',
          background: activeScreen?.url ? '#000' : 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)',
        }}>
          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 16px', background: 'linear-gradient(rgba(0,0,0,0.4), transparent)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: MONO }}>9:41</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Signal size={11} color="#fff" />
              <Wifi size={11} color="#fff" />
              <BatteryFull size={11} color="#fff" />
            </div>
          </div>

          {/* Back button */}
          {history.length > 0 && (
            <button onClick={goBack} style={{
              position: 'absolute', top: 26, left: 8, zIndex: 6,
              background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 12,
              padding: '4px 8px', cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', gap: 2,
              backdropFilter: 'blur(4px)', fontSize: 10, fontWeight: 700,
            }}>
              <ChevronLeft size={12} /> Back
            </button>
          )}

          {/* Screen content with slide transition */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: slideDir ? slideTransform : 'translateX(0)',
            transition: slideDir ? `transform ${TRANSITION_MS}ms ease-in-out` : 'none',
          }}>
            {activeScreen?.url ? (
              <img
                src={activeScreen.url}
                alt={activeScreen.name}
                style={getScreenImageStyle(activeScreen, globalFit)}
                draggable={false}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#555',
              }}>
                <span style={{ fontSize: 36 }}>📱</span>
                <span style={{ fontSize: 11, marginTop: 8, fontFamily: MONO }}>
                  {activeScreen ? 'No image' : 'No screen'}
                </span>
              </div>
            )}

            {/* opens_screen navigation — if this screen type auto-opens another screen, show a tap target */}
            {activeScreen?.opens_screen && (
              <div
                onClick={(e) => { e.stopPropagation(); navigateTo(activeScreen.opens_screen, 'left'); }}
                style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                title={`Opens ${activeScreen.opens_screen}`}
              />
            )}

            {/* Tap zone hotspots */}
            {links.map(link => ( /* onClick below routes through phoneRuntime; preview + runtime share one tap path */
              <div
                key={link.id}
                onClick={(e) => { e.stopPropagation(); handleZoneTap(link); }}
                title={link.label || link.target}
                style={{
                  position: 'absolute',
                  left: `${link.x}%`, top: `${link.y}%`,
                  width: `${link.w}%`, height: `${link.h}%`,
                  cursor: link.target ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, zIndex: 3, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {link.icon_url && (
                  <img src={link.icon_url} alt={link.label || ''} draggable={false}
                    style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Home button bar */}
        <div
          onClick={goHome}
          title="Home"
          style={{
            width: 44, height: 5, borderRadius: 3,
            background: skin.btn, margin: '8px auto 0', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        />
      </div>

      {/* Screen name */}
      {activeScreen && (
        <div style={{
          marginTop: 12, textAlign: 'center', color: '#fff',
          fontFamily: PROSE, fontSize: 15, fontWeight: 600,
        }}>
          {activeScreen.name || activeScreen.beat || activeScreen.id}
        </div>
      )}

      {/* Breadcrumb trail */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.45)',
        flexWrap: 'wrap', justifyContent: 'center', maxWidth: 360, padding: '0 12px',
      }}>
        {breadcrumbs.map((name, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}>{'>'}</span>}
            <span style={i === breadcrumbs.length - 1 ? { color: TOKENS.gold, fontWeight: 600 } : {}}>
              {name}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   ScreenFlowMap — Visual diagram of screen connections
   ────────────────────────────────────────────── */

function ScreenFlowMap({ screens = [], onSelectScreen, selectedScreen }) {
  // Only show screens that have images
  const nodes = useMemo(() => screens.filter(s => s.url), [screens]);
  const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
  const nodeW = 80, nodeH = 56, gapX = 40, gapY = 50;
  const padX = 30, padY = 30;

  // Position map for each screen
  const positions = useMemo(() => {
    const map = {};
    nodes.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      map[s.id || s.beat || s.name] = {
        x: padX + col * (nodeW + gapX),
        y: padY + row * (nodeH + gapY),
        screen: s,
      };
    });
    return map;
  }, [nodes, cols]);

  // Build edges from screen_links AND opens_screen
  const edges = useMemo(() => {
    const result = [];
    const findNode = (key) => {
      if (!key) return null;
      const k = key.toLowerCase();
      return nodes.find(n => (n.id || '').toLowerCase() === k)
        || nodes.find(n => (n.name || '').toLowerCase() === k);
    };
    nodes.forEach(s => {
      const fromKey = s.id || s.beat || s.name;
      const from = positions[fromKey];
      if (!from) return;

      // Edges from screen_links (tap zones)
      const links = getLinks(s);
      links.forEach(link => {
        if (!link.target) return;
        const targetScreen = findNode(link.target);
        if (!targetScreen) return;
        const toKey = targetScreen.id || targetScreen.beat || targetScreen.name;
        const to = positions[toKey];
        if (!to) return;
        result.push({ from, to, label: link.label });
      });

      // Edge from opens_screen (icon→screen link)
      if (s.opens_screen) {
        const targetScreen = findNode(s.opens_screen);
        if (targetScreen) {
          const toKey = targetScreen.id || targetScreen.beat || targetScreen.name;
          const to = positions[toKey];
          if (to) result.push({ from, to, label: 'opens', dashed: true });
        }
      }
    });
    return result;
  }, [nodes, positions]);

  const totalRows = Math.ceil(nodes.length / cols);
  const svgW = padX * 2 + cols * (nodeW + gapX) - gapX;
  const svgH = padY * 2 + totalRows * (nodeH + gapY) - gapY;

  if (!nodes.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#888', fontFamily: MONO, fontSize: 12 }}>
        No screens with images to map.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', background: TOKENS.ink, borderRadius: 12, padding: 8 }}>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Connection lines */}
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={edge.from.x + nodeW / 2} y1={edge.from.y + nodeH / 2}
            x2={edge.to.x + nodeW / 2} y2={edge.to.y + nodeH / 2}
            stroke={edge.dashed ? '#a889c8' : TOKENS.gold} strokeWidth={1.5} opacity={0.5}
            strokeDasharray={edge.dashed ? '4 3' : undefined}
            markerEnd="url(#arrowhead)"
          />
        ))}
        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={TOKENS.gold} opacity="0.6" />
          </marker>
        </defs>
        {/* Screen nodes */}
        {nodes.map(s => {
          const key = s.id || s.beat || s.name;
          const pos = positions[key];
          if (!pos) return null;
          const isSelected = selectedScreen && (selectedScreen.id || selectedScreen.beat) === (s.id || s.beat);
          return (
            <g key={key} style={{ cursor: 'pointer' }} onClick={() => onSelectScreen?.(s)}>
              <rect
                x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6}
                fill="#1a1a2e"
                stroke={isSelected ? TOKENS.gold : 'rgba(255,255,255,0.15)'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <image
                href={s.url} x={pos.x + 2} y={pos.y + 2}
                width={nodeW - 4} height={nodeH - 14}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`inset(0 round 4px)`}
              />
              <text
                x={pos.x + nodeW / 2} y={pos.y + nodeH - 3}
                textAnchor="middle" fill="#ccc"
                fontSize={8} fontFamily={MONO}
              >
                {(s.name || s.beat || key).slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export { ScreenFlowMap };
