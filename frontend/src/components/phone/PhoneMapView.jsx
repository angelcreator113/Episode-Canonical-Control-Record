/**
 * PhoneMapView — the canonical "live map" view for the phone Map screen.
 *
 * Reads everything from the same sources the World Foundation page uses, so
 * editing on /world-foundation flows straight to the phone:
 *   - Map background image: GET /api/v1/world/map           ({ url })
 *   - City positions:       GET /api/v1/world/map/positions ({ positions })
 *   - Locations:            GET /api/v1/world/locations
 *   - Show profile/events:  /api/v1/social-profiles, /api/v1/calendar/events
 *
 * Pins are city-level (DREAM_CITIES). On top of basic pins, adds:
 *   - ⭐ glow on the city Lala lives in (her main profile's home_location_id)
 *   - bigger pin on cities containing frequent venues
 *   - animated pulse ring on cities that host calendar events
 *   - district name labels
 *   - tap-to-popup with city subtitle + location count
 *   - dashed story path through cities of episode events, in order
 *
 * Two render modes:
 *   - default (showBackground = true): renders the WF map image as background;
 *     used as a full phone screen.
 *   - showBackground = false: renders pins only on a transparent surface;
 *     used when slotted inside a content zone over an existing background.
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import { DREAM_CITIES } from '../../data/dreamCities';

export default function PhoneMapView({
  showId,
  episodeId,
  config = {},
  showBackground = true,
  fallbackImageUrl = null,
}) {
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [positions, setPositions] = useState({});
  const [locations, setLocations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  // Image's natural aspect ratio (W / H). Used to size the inner stage so
  // the whole map shows (letterboxed) on a tall phone screen instead of
  // being cropped by object-fit: cover. Pins live inside this same stage,
  // so their % coordinates stay aligned with what creators positioned on
  // World Foundation.
  const [imgAspect, setImgAspect] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/v1/world/map').catch(() => ({ data: {} })),
      api.get('/api/v1/world/map/positions').catch(() => ({ data: { positions: {} } })),
      api.get('/api/v1/world/locations').catch(() => ({ data: { locations: [] } })),
      showId
        ? api.get(`/api/v1/social-profiles?show_id=${showId}`).catch(() => ({ data: {} }))
        : Promise.resolve({ data: {} }),
      showId
        ? api.get(`/api/v1/calendar/events?series_id=${showId}`).catch(() => ({ data: { events: [] } }))
        : Promise.resolve({ data: { events: [] } }),
    ]).then(([mapRes, posRes, locRes, profRes, evRes]) => {
      if (cancelled) return;
      setMapImageUrl(mapRes.data?.url || null);
      setPositions(posRes.data?.positions || {});
      setLocations(locRes.data?.locations || []);
      const profs = profRes.data?.data || profRes.data?.profiles || [];
      setProfile(profs.find(p => p.home_location_id) || profs[0] || null);
      setEvents(evRes.data?.events || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [showId]);

  const cityKeyOf = (loc) => {
    if (!loc?.city) return null;
    return DREAM_CITIES.find(c =>
      c.key === loc.city
      || c.name.toLowerCase() === loc.city.toLowerCase()
      || c.key === loc.city.toLowerCase().replace(/\s+/g, '_')
    )?.key || null;
  };

  const locsByCity = new Map();
  locations.forEach(loc => {
    const k = cityKeyOf(loc);
    if (!k) return;
    if (!locsByCity.has(k)) locsByCity.set(k, []);
    locsByCity.get(k).push(loc);
  });

  const homeLoc = profile?.home_location_id ? locations.find(l => l.id === profile.home_location_id) : null;
  const homeCityKey = homeLoc ? cityKeyOf(homeLoc) : null;

  const eventCityKeys = new Set();
  events.forEach(ev => {
    const loc = locations.find(l => l.id === ev.location_id);
    const k = loc ? cityKeyOf(loc) : null;
    if (k) eventCityKeys.add(k);
  });

  const frequentCityKeys = new Set();
  (profile?.frequent_venues || []).forEach(vid => {
    const loc = locations.find(l => l.id === vid);
    const k = loc ? cityKeyOf(loc) : null;
    if (k) frequentCityKeys.add(k);
  });

  const passes = (city) => {
    if (config.only === 'homes' && city.key !== homeCityKey) return false;
    if (config.district && city.key !== config.district && city.name.toLowerCase() !== config.district.toLowerCase()) return false;
    return true;
  };

  const visible = DREAM_CITIES
    .filter(passes)
    .map(city => ({ city, pos: positions[city.key] }))
    .filter(({ pos }) => pos && typeof pos.x === 'number' && typeof pos.y === 'number');

  const pathPoints = config.show_path !== false
    ? events
        .map(ev => {
          const loc = locations.find(l => l.id === ev.location_id);
          const k = loc ? cityKeyOf(loc) : null;
          return k && positions[k] ? positions[k] : null;
        })
        .filter(Boolean)
    : [];

  // Background image: prefer WF map image when allowed; fall back to caller's
  // image (e.g. the phone screen's uploaded background) when WF has no map.
  const bgUrl = showBackground ? (mapImageUrl || fallbackImageUrl) : null;

  // Outer container fills the phone screen; inner "stage" sizes itself to the
  // image's aspect ratio (or 1:1 fallback before the image loads). The stage
  // hosts both the image AND the pins, so pins use the same % coordinate
  // space as the image — switching from cover to a "fit whole map" layout
  // doesn't drift pins.
  const stageStyle = imgAspect
    ? {
        position: 'relative',
        width: '100%', maxHeight: '100%',
        aspectRatio: String(imgAspect),
        // When the image is wider than the phone screen (almost always), the
        // 100% width sets the stage width and aspectRatio derives the height.
        // When the image happens to be taller than the phone, maxHeight clamps
        // and width auto-adjusts.
      }
    : {
        position: 'relative', width: '100%', height: '100%',
      };

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      overflow: 'hidden',
      // Soft dark backdrop fills the letterbox area above/below the map so
      // empty space reads as intentional sky rather than blank screen.
      background: bgUrl ? '#0e0a18' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={stageStyle}>
      {bgUrl && (
        <img
          src={bgUrl}
          alt="Map"
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth;
            const h = e.currentTarget.naturalHeight;
            if (w && h) setImgAspect(w / h);
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', pointerEvents: 'none',
          }}
          draggable={false}
        />
      )}

      {loading ? null : (
        <>
          {pathPoints.length > 1 && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
              viewBox="0 0 100 100" preserveAspectRatio="none"
            >
              <polyline
                points={pathPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="rgba(242, 201, 76, 0.85)"
                strokeWidth="0.6" strokeDasharray="1.5 1"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          )}

          {visible.map(({ city, pos }) => {
            const isHome = city.key === homeCityKey;
            const isFrequent = frequentCityKeys.has(city.key);
            const hasEvent = eventCityKeys.has(city.key);
            const count = (locsByCity.get(city.key) || []).length;
            const sizeBase = isHome ? 30 : isFrequent ? 26 : 22;
            return (
              <button
                key={city.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveKey(activeKey === city.key ? null : city.key); }}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: sizeBase, height: sizeBase, padding: 0,
                  borderRadius: '50%',
                  background: isHome
                    ? 'linear-gradient(135deg, #f9d976, #c9a84c)'
                    : `${city.color}E6`,
                  border: `2px solid ${isHome ? '#fff' : 'rgba(255,255,255,0.85)'}`,
                  boxShadow: isHome
                    ? '0 0 10px rgba(249, 217, 118, 0.7), 0 1px 4px rgba(0,0,0,0.4)'
                    : '0 1px 4px rgba(0,0,0,0.4)',
                  fontSize: isHome ? 13 : 11,
                  fontWeight: 800,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: activeKey === city.key ? 10 : 5,
                  fontFamily: "'DM Mono', monospace",
                }}
                title={city.name}
              >
                {hasEvent && (
                  <span aria-hidden style={{
                    position: 'absolute', inset: -5, borderRadius: '50%',
                    border: `2px solid ${city.color}`,
                    animation: 'phone-map-pulse 1.4s ease-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}
                {isHome ? '⭐' : (city.letter || city.icon || '📍')}
                {count > 0 && (
                  <span style={{
                    position: 'absolute', bottom: -3, right: -3,
                    minWidth: 13, height: 13,
                    padding: '0 3px', borderRadius: 7,
                    background: 'rgba(20,16,28,0.92)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff', fontSize: 7, lineHeight: 1, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{count}</span>
                )}
              </button>
            );
          })}

          {config.show_districts !== false && visible.map(({ city, pos }) => (
            <div
              key={`label-${city.key}`}
              style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, calc(50% + 14px))',
                fontFamily: "'DM Mono', monospace",
                fontSize: 6, fontWeight: 800, letterSpacing: 0.5,
                color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                textTransform: 'uppercase', pointerEvents: 'none',
                whiteSpace: 'nowrap', zIndex: 1,
              }}
            >
              {city.name}
            </div>
          ))}

          {activeKey && (() => {
            const v = visible.find(x => x.city.key === activeKey);
            if (!v) return null;
            const locs = locsByCity.get(v.city.key) || [];
            return (
              <div style={{
                position: 'absolute',
                left: `${v.pos.x}%`, top: `${v.pos.y}%`,
                transform: 'translate(-50%, calc(-100% - 16px))',
                minWidth: 110, maxWidth: 180,
                padding: '6px 8px',
                background: 'rgba(20, 16, 28, 0.95)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 6,
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                color: '#fff',
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.2, marginBottom: 2 }}>{v.city.name}</div>
                {v.city.subtitle && (
                  <div style={{ fontSize: 6, color: v.city.color, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>
                    {v.city.subtitle}
                  </div>
                )}
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3 }}>
                  {locs.length} location{locs.length === 1 ? '' : 's'}
                </div>
              </div>
            );
          })()}

          {!visible.length && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
              fontFamily: "'DM Mono', monospace", fontSize: 9,
              color: 'rgba(255,255,255,0.85)',
              textAlign: 'center',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>
              {Object.keys(positions).length ? 'No cities match filter' : 'Place pins on /world-foundation'}
            </div>
          )}
        </>
      )}
      </div>

      <style>{`
        @keyframes phone-map-pulse {
          0%   { transform: scale(0.85); opacity: 0.9; }
          70%  { transform: scale(1.6);  opacity: 0; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// True when this screen should auto-render the live world map instead of
// its uploaded image. Strict name match against a small set of conventions
// so it doesn't accidentally swallow screens like "Mind Map" or "Sitemap".
export function isMapScreen(screen) {
  const name = (screen?.name || '').toLowerCase().trim();
  return name === 'map' || name === 'world map' || name === 'world-map' || name === 'the map';
}
