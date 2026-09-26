/**
 * PhoneDevice — the drawing of Lala's Phone: frame and skin (or a custom
 * frame image), the screen image or the live map, the screen's content
 * zones, its tap zones, the home screen's persistent icons, the name
 * overlay and the back button.
 *
 * Extracted unchanged from PhoneHub (Task #1983, step C1 of doctrine rule
 * 16, docs/DESIGN_DOCTRINE.md): PhoneHub renders it for Producer Mode.
 * It owns no state and fetches nothing itself; the caller passes the
 * screen, the navigation callbacks and the frame's load/error handlers.
 *
 * Preview Phone draws through it too (Task #1990, step C2), with three
 * optional props that default to Producer Mode's behaviour:
 *   tapLayer           — a node the caller renders inside the screen area in
 *                        place of the tap zones and persistent icons, so the
 *                        Preview keeps its own runtime (conditions, missions,
 *                        playthrough, back, home). Rendered on every screen,
 *                        generated or not.
 *   episodeId          — passed to ScreenContentRenderer.
 *   contentInteractive — passed to ScreenContentRenderer as `interactive`.
 *
 * `icons` (Task #2005, doctrine rule 17) is the show's icon overlays. A tap
 * zone placed from an icon draws that icon's current image, looked up by key,
 * so an image change never leaves a placement stale.
 *
 * `highlightIconKey` (Task #2008) outlines the zones that resolve to that
 * icon, persistent icons included, and marks them `data-highlighted`. PhoneHub
 * passes the selected icon's key; without it nothing is outlined.
 */
import ScreenContentRenderer from '../ScreenContentRenderer';
import PhoneFrame from './PhoneFrame';
import PhoneMapView, { isMapScreen } from './PhoneMapView';
import { getScreenImageStyle } from './phoneStyle';
import { resolveZoneIcon, resolveZoneIconKey } from '../../lib/overlayUtils';

// The selected icon's placements are outlined (doctrine rule 17, Task #2008).
const HIGHLIGHT_STYLE = { outline: '2px solid #B8962E', outlineOffset: 1, boxShadow: '0 0 0 4px rgba(184,150,46,0.3)' };
const isHighlighted = (link, icons, key) => !!key && resolveZoneIconKey(link, icons) === key;

// Renders interactive tap zone overlays on the phone screen
function ScreenLinkOverlay({ links = [], icons = [], onNavigate, highlightIconKey }) {
  if (!links.length || !onNavigate) return null;
  return (
    <>
      {links.map(link => (
        <div
          key={link.id}
          onClick={(e) => {
            e.stopPropagation();
            if (link.target) onNavigate(link.target);
          }}
          title={link.label || link.target}
          data-highlighted={isHighlighted(link, icons, highlightIconKey) || undefined}
          style={{
            ...(isHighlighted(link, icons, highlightIconKey) ? HIGHLIGHT_STYLE : null),
            position: 'absolute',
            left: `${link.x}%`, top: `${link.y}%`,
            width: `${link.w}%`, height: `${link.h}%`,
            cursor: link.target ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
            transition: 'background 0.15s',
            zIndex: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {resolveZoneIcon(link, icons) && (
            <img
              src={resolveZoneIcon(link, icons)}
              alt={link.label || link.target}
              style={{ width: '92%', height: '92%', objectFit: 'contain', pointerEvents: 'none' }}
              draggable={false}
            />
          )}
        </div>
      ))}
    </>
  );
}

// Renders persistent icons (from home screen) that stay visible on all screens
function PersistentOverlay({ links = [], icons = [], onNavigate, highlightIconKey }) {
  if (!links.length || !onNavigate) return null;
  return (
    <>
      {links.map(link => (
        <div
          key={link.id}
          onClick={(e) => {
            e.stopPropagation();
            if (link.target) onNavigate(link.target);
          }}
          title={link.label || link.target}
          data-highlighted={isHighlighted(link, icons, highlightIconKey) || undefined}
          style={{
            ...(isHighlighted(link, icons, highlightIconKey) ? HIGHLIGHT_STYLE : null),
            position: 'absolute',
            left: `${link.x}%`, top: `${link.y}%`,
            width: `${link.w}%`, height: `${link.h}%`,
            cursor: link.target ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
            zIndex: 4,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {resolveZoneIcon(link, icons) && (
            <img
              src={resolveZoneIcon(link, icons)}
              alt={link.label || link.target}
              style={{ width: '92%', height: '92%', objectFit: 'contain', pointerEvents: 'none' }}
              draggable={false}
            />
          )}
        </div>
      ))}
    </>
  );
}

export default function PhoneDevice({
  skin,
  customFrameUrl,
  useCustomFrame,
  onCustomFrameLoad,
  onCustomFrameError,
  phoneScreen,
  activeScreen,
  firstScreen,
  persistentLinks = [],
  globalFit,
  onNavigate,
  navigationHistory = [],
  onBack,
  tapLayer,
  episodeId,
  contentInteractive = false,
  icons = [],
  highlightIconKey = null,
}) {
  return (
      <PhoneFrame
        skin={skin}
        customFrameUrl={useCustomFrame ? customFrameUrl : null}
        onCustomFrameLoad={onCustomFrameLoad}
        onCustomFrameError={onCustomFrameError}
      >
        {phoneScreen && (isMapScreen(phoneScreen) || phoneScreen.url) ? (
          <>
            {/* Map screens render the live World Foundation map as their
                base layer (image + city pins) instead of the uploaded
                screen image. Falls back to the uploaded image if WF has
                no map image set yet. Regular screens render the upload. */}
            {isMapScreen(phoneScreen) ? (
              <div style={{ position: 'absolute', inset: 0 }}>
                <PhoneMapView
                  showId={activeScreen.show_id}
                  fallbackImageUrl={phoneScreen.url}
                />
              </div>
            ) : (
              <img
                src={phoneScreen.url}
                alt={phoneScreen.name}
                style={getScreenImageStyle(phoneScreen, globalFit)}
              />
            )}
            <ScreenContentRenderer
              zones={activeScreen.content_zones || activeScreen.metadata?.content_zones || []}
              showId={activeScreen.show_id}
              screenMeta={activeScreen.metadata}
              interactive={contentInteractive}
              episodeId={episodeId}
            />
            {!tapLayer && (
              <ScreenLinkOverlay links={activeScreen.screen_links || activeScreen.metadata?.screen_links || []} icons={icons} onNavigate={onNavigate} highlightIconKey={highlightIconKey} />
            )}
            {/* Persistent icons from home screen — show on non-home screens
                except the Map, which is meant to be a full-bleed canvas
                where home-screen icons would just clutter the world view. */}
            {!tapLayer && activeScreen.id !== firstScreen?.id && persistentLinks.length > 0 && !isMapScreen(phoneScreen) && (
              <PersistentOverlay links={persistentLinks} icons={icons} onNavigate={onNavigate} highlightIconKey={highlightIconKey} />
            )}
          </>
        ) : useCustomFrame ? (
          <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{phoneScreen ? 'Not generated' : 'Select a screen'}</span>
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#555',
          }}>
            <span style={{ fontSize: 32 }}>📱</span>
            <span style={{ fontSize: 11, marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
              {phoneScreen ? 'Not generated yet' : 'Select a screen'}
            </span>
          </div>
        )}

        {tapLayer}

        {/* Back button for navigation — position shifts when Dynamic Island is present */}
        {navigationHistory.length > 0 && onBack && (
          <button onClick={onBack} style={{
            position: 'absolute',
            top: useCustomFrame ? 6 : 38,
            left: useCustomFrame ? 6 : 8,
            zIndex: 10,
            padding: '3px 8px', fontSize: 9, fontWeight: 700, border: 'none',
            borderRadius: 10, background: 'rgba(0,0,0,0.5)', color: '#fff',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}>← Back</button>
        )}

        {/* Screen name overlay — built-in frame only (custom frames often have their own chrome) */}
        {!useCustomFrame && phoneScreen && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            padding: '20px 12px 10px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{phoneScreen.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Mono', monospace" }}>
              {phoneScreen.beat || phoneScreen.description?.slice(0, 40)}
            </div>
          </div>
        )}
      </PhoneFrame>
  );
}
