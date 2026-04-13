/**
 * DreamMap.jsx — Interactive LalaVerse Map
 *
 * 5 cities positioned to spell D·R·E·A·M
 * Each city zone shows venue pins with scene set thumbnails.
 * Pan/zoom via mouse wheel + drag. Click venue → detail panel.
 *
 * Props:
 *   locations    — array of WorldLocation objects (with sceneSets, events, childLocations)
 *   profiles     — array of { city, count } for feed profile distribution
 *   onSelectLocation(loc) — callback when a venue pin is clicked
 *   lalaPosition — { locationId } for Lala's current story position
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ── DREAM City Definitions ──────────────────────────────────────────────────
const DREAM_CITIES = [
  {
    letter: 'D', key: 'dazzle_district', name: 'Dazzle District',
    subtitle: 'Fashion & Luxury', icon: '👗',
    color: '#d4789a', lightColor: '#fdf2f6',
    culture: 'Couture houses, runway shows, designer studios. Every sidewalk is a runway.',
    x: 0, y: 0,
  },
  {
    letter: 'R', key: 'radiance_row', name: 'Radiance Row',
    subtitle: 'Beauty & Wellness', icon: '✨',
    color: '#a889c8', lightColor: '#f6f0fc',
    culture: 'Skincare labs, salons, beauty schools. Reinvention is the local religion.',
    x: 220, y: 0,
  },
  {
    letter: 'E', key: 'echo_park', name: 'Echo Park',
    subtitle: 'Entertainment & Nightlife', icon: '🎵',
    color: '#c9a84c', lightColor: '#fdf8ee',
    culture: 'Music studios, comedy clubs, creator houses. Something here becomes a meme by morning.',
    x: 440, y: 0,
  },
  {
    letter: 'A', key: 'ascent_tower', name: 'Ascent Tower',
    subtitle: 'Tech & Innovation', icon: '🔮',
    color: '#6bba9a', lightColor: '#e8f5ee',
    culture: 'Digital platforms, creator economy tools, startups. Building the tools everyone uses.',
    x: 660, y: 0,
  },
  {
    letter: 'M', key: 'maverick_harbor', name: 'Maverick Harbor',
    subtitle: 'Creator Economy & Counter-culture', icon: '⚓',
    color: '#7ab3d4', lightColor: '#eef6fb',
    culture: 'Content houses, podcast networks, underground scenes. Fame is suspicious here.',
    x: 880, y: 0,
  },
];

// ── Letter path data for each DREAM letter ──────────────────────────────────
// Each letter is drawn as a stylized zone shape (simplified SVG paths)
const LETTER_PATHS = {
  D: 'M 20 10 L 20 150 L 80 150 Q 160 150 160 80 Q 160 10 80 10 Z',
  R: 'M 20 10 L 20 150 M 20 10 L 100 10 Q 140 10 140 45 Q 140 80 100 80 L 20 80 M 80 80 L 140 150',
  E: 'M 120 10 L 20 10 L 20 80 L 100 80 M 20 80 L 20 150 L 120 150',
  A: 'M 10 150 L 80 10 L 150 150 M 45 80 L 115 80',
  M: 'M 20 150 L 20 10 L 80 80 L 140 10 L 140 150',
};

// ── Venue pin positions within each letter zone ─────────────────────────────
// Positions are relative to the letter zone's origin
function getVenuePinsForLetter(letter) {
  const pins = {
    D: [
      { x: 50, y: 40, label: 'Runway Quarter' },
      { x: 90, y: 80, label: 'Boutique Row' },
      { x: 60, y: 120, label: 'Atelier Circle' },
      { x: 110, y: 50, label: 'Design Studios' },
    ],
    R: [
      { x: 50, y: 30, label: 'Salon Strip' },
      { x: 100, y: 45, label: 'Glow Labs' },
      { x: 40, y: 80, label: 'Beauty Schools' },
      { x: 90, y: 120, label: 'Spa Quarter' },
    ],
    E: [
      { x: 50, y: 30, label: 'Music Row' },
      { x: 80, y: 75, label: 'Comedy Quarter' },
      { x: 40, y: 120, label: 'Club District' },
      { x: 100, y: 130, label: 'Neon Strip' },
    ],
    A: [
      { x: 80, y: 30, label: 'Innovation Hub' },
      { x: 45, y: 80, label: 'Startup Alley' },
      { x: 115, y: 80, label: 'Platform HQ' },
      { x: 80, y: 130, label: 'Incubator Row' },
    ],
    M: [
      { x: 30, y: 40, label: 'Creator Studios' },
      { x: 80, y: 60, label: 'Collab Space' },
      { x: 130, y: 40, label: 'Podcast Row' },
      { x: 50, y: 120, label: 'Underground' },
      { x: 110, y: 120, label: 'Harbor Docks' },
    ],
  };
  return pins[letter] || [];
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  container: {
    position: 'relative',
    width: '100%',
    height: 520,
    background: '#FAF7F0',
    borderRadius: 12,
    border: '1px solid #e8e0d0',
    overflow: 'hidden',
    cursor: 'grab',
    userSelect: 'none',
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: '12px 16px',
    background: 'linear-gradient(180deg, rgba(250,247,240,0.95) 0%, rgba(250,247,240,0) 100%)',
    zIndex: 10, pointerEvents: 'none',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  controls: {
    position: 'absolute', bottom: 12, right: 12,
    display: 'flex', gap: 4, zIndex: 10,
  },
  controlBtn: {
    width: 32, height: 32, borderRadius: 8,
    background: '#fff', border: '1px solid #e8e0d0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 16, color: '#2C2C2C',
  },
  legend: {
    position: 'absolute', bottom: 12, left: 12,
    display: 'flex', gap: 8, zIndex: 10,
    background: 'rgba(255,255,255,0.9)', borderRadius: 8,
    padding: '6px 10px', border: '1px solid #e8e0d0',
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#666',
  },
  tooltip: {
    position: 'absolute', zIndex: 20,
    background: '#fff', borderRadius: 10,
    padding: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    border: '1px solid #e8e0d0', maxWidth: 280,
    pointerEvents: 'auto',
  },
};

export default function DreamMap({
  locations = [],
  profiles = [],
  onSelectLocation,
  lalaPosition,
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 40, y: 60, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPin, setHoveredPin] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // Group locations by city
  const locationsByCity = useMemo(() => {
    const map = {};
    DREAM_CITIES.forEach(c => { map[c.key] = []; });
    locations.forEach(loc => {
      const cityKey = (loc.city || '').toLowerCase().replace(/ /g, '_');
      // Match by key or by name
      const match = DREAM_CITIES.find(c =>
        c.key === cityKey ||
        c.name.toLowerCase() === (loc.city || '').toLowerCase()
      );
      if (match) map[match.key].push(loc);
    });
    return map;
  }, [locations]);

  // Profile counts by city
  const profilesByCity = useMemo(() => {
    const map = {};
    DREAM_CITIES.forEach(c => { map[c.key] = 0; });
    profiles.forEach(p => {
      if (map[p.city] !== undefined) map[p.city] = p.count;
    });
    return map;
  }, [profiles]);

  // ── Pan handling ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('[data-pin]') || e.target.closest('[data-city]')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }, [transform]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // ── Zoom handling ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale + delta)),
    }));
  }, []);

  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.2) }));
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale - 0.2) }));
  const resetView = () => setTransform({ x: 40, y: 60, scale: 1 });

  // Attach wheel listener with passive: false
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      style={{ ...S.container, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header overlay */}
      <div style={S.header}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: '#B8962E', letterSpacing: 2 }}>
          THE LALAVERSE
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#999' }}>
          {locations.length} locations · {profiles.reduce((s, p) => s + p.count, 0)} creators
        </span>
      </div>

      {/* Zoom controls */}
      <div style={S.controls}>
        <button style={S.controlBtn} onClick={zoomIn} title="Zoom in">+</button>
        <button style={S.controlBtn} onClick={zoomOut} title="Zoom out">-</button>
        <button style={{ ...S.controlBtn, fontSize: 12 }} onClick={resetView} title="Reset">
          <span style={{ fontFamily: "'DM Mono', monospace" }}>1:1</span>
        </button>
      </div>

      {/* Legend */}
      <div style={S.legend}>
        <div style={S.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B8962E' }} />
          <span>Venue</span>
        </div>
        <div style={S.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7ab3d4' }} />
          <span>Scene Set</span>
        </div>
        <div style={S.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4789a', border: '2px solid #fff', boxShadow: '0 0 0 1px #d4789a' }} />
          <span>Lala</span>
        </div>
      </div>

      {/* Map canvas */}
      <svg
        style={{
          width: '100%', height: '100%',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          transition: dragging ? 'none' : 'transform 0.15s ease-out',
        }}
        viewBox="0 0 1100 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Connection lines between cities */}
        {DREAM_CITIES.slice(0, -1).map((city, i) => {
          const next = DREAM_CITIES[i + 1];
          return (
            <line
              key={`conn-${i}`}
              x1={city.x + 80} y1={85}
              x2={next.x + 80} y2={85}
              stroke="#e8e0d0" strokeWidth={1.5} strokeDasharray="6 4"
            />
          );
        })}

        {/* City zones */}
        {DREAM_CITIES.map((city) => {
          const cityLocs = locationsByCity[city.key] || [];
          const profileCount = profilesByCity[city.key] || 0;
          const isSelected = selectedCity === city.key;
          const venuePins = getVenuePinsForLetter(city.letter);

          return (
            <g key={city.key} transform={`translate(${city.x}, ${city.y})`}>
              {/* Letter background shape */}
              <path
                d={LETTER_PATHS[city.letter]}
                fill={isSelected ? city.color + '20' : city.lightColor}
                stroke={city.color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                data-city={city.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCity(isSelected ? null : city.key);
                }}
              />

              {/* City label */}
              <text
                x={80} y={175}
                textAnchor="middle"
                style={{
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                  fill: city.color, cursor: 'pointer',
                }}
                data-city={city.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCity(isSelected ? null : city.key);
                }}
              >
                {city.name}
              </text>
              <text x={80} y={188} textAnchor="middle" style={{ fontSize: 8, fill: '#999', fontFamily: "'DM Mono', monospace" }}>
                {city.subtitle}
              </text>

              {/* Stats badges */}
              <g transform="translate(40, 195)">
                {cityLocs.length > 0 && (
                  <g>
                    <rect x={0} y={0} width={36} height={14} rx={4} fill={city.color + '15'} />
                    <text x={18} y={10} textAnchor="middle" style={{ fontSize: 8, fill: city.color, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                      {cityLocs.length} loc
                    </text>
                  </g>
                )}
                {profileCount > 0 && (
                  <g transform={`translate(${cityLocs.length > 0 ? 40 : 0}, 0)`}>
                    <rect x={0} y={0} width={30} height={14} rx={4} fill={city.color + '15'} />
                    <text x={15} y={10} textAnchor="middle" style={{ fontSize: 8, fill: city.color, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                      {profileCount}
                    </text>
                  </g>
                )}
              </g>

              {/* Venue pins inside letter shape */}
              {venuePins.map((pin, pi) => {
                // Match to actual location if one exists
                const matchedLoc = cityLocs[pi] || null;
                const hasSceneSet = matchedLoc?.sceneSets?.length > 0;
                const isLalaHere = lalaPosition?.locationId && matchedLoc?.id === lalaPosition.locationId;
                const pinId = `${city.key}-${pi}`;

                return (
                  <g
                    key={pi}
                    transform={`translate(${pin.x}, ${pin.y})`}
                    data-pin={pinId}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPin({ ...pin, city, matchedLoc, pinId, screenX: city.x + pin.x, screenY: city.y + pin.y })}
                    onMouseLeave={() => setHoveredPin(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (matchedLoc && onSelectLocation) onSelectLocation(matchedLoc);
                    }}
                  >
                    {/* Scene set indicator (square behind pin) */}
                    {hasSceneSet && (
                      <rect x={-6} y={-6} width={12} height={12} rx={2}
                        fill="#7ab3d4" opacity={0.3} />
                    )}

                    {/* Pin dot */}
                    <circle r={matchedLoc ? 5 : 3}
                      fill={matchedLoc ? city.color : city.color + '40'}
                      stroke="#fff" strokeWidth={1.5}
                    />

                    {/* Lala marker */}
                    {isLalaHere && (
                      <>
                        <circle r={9} fill="none" stroke="#d4789a" strokeWidth={1.5}
                          strokeDasharray="3 2">
                          <animate attributeName="r" from="8" to="14" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        <text y={-12} textAnchor="middle" style={{ fontSize: 8, fill: '#d4789a', fontWeight: 700 }}>LALA</text>
                      </>
                    )}

                    {/* Pin label (only when zoomed in enough or city selected) */}
                    {(isSelected || transform.scale > 1.3) && (
                      <text x={8} y={3}
                        style={{ fontSize: 7, fill: '#666', fontFamily: "'DM Mono', monospace" }}>
                        {matchedLoc?.name || pin.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Extra location pins for locations beyond the default pin count */}
              {cityLocs.slice(venuePins.length).map((loc, i) => {
                const angle = ((i + venuePins.length) / (cityLocs.length)) * Math.PI * 2;
                const px = 80 + Math.cos(angle) * 50;
                const py = 80 + Math.sin(angle) * 40;
                return (
                  <circle
                    key={`extra-${i}`}
                    cx={px} cy={py} r={3}
                    fill={city.color + '60'}
                    stroke="#fff" strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    data-pin={`${city.key}-extra-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectLocation) onSelectLocation(loc);
                    }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredPin && (
        <div style={{
          ...S.tooltip,
          left: Math.min(
            (hoveredPin.screenX * transform.scale + transform.x + 20),
            (containerRef.current?.clientWidth || 800) - 290
          ),
          top: Math.min(
            (hoveredPin.screenY * transform.scale + transform.y - 10),
            (containerRef.current?.clientHeight || 500) - 180
          ),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>{hoveredPin.city.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>
                {hoveredPin.matchedLoc?.name || hoveredPin.label}
              </div>
              <div style={{ fontSize: 10, color: hoveredPin.city.color, fontFamily: "'DM Mono', monospace" }}>
                {hoveredPin.city.name}
              </div>
            </div>
          </div>

          {hoveredPin.matchedLoc ? (
            <>
              {hoveredPin.matchedLoc.description && (
                <p style={{ fontSize: 11, color: '#666', margin: '4px 0 8px', lineHeight: 1.4 }}>
                  {hoveredPin.matchedLoc.description.slice(0, 120)}{hoveredPin.matchedLoc.description.length > 120 ? '...' : ''}
                </p>
              )}

              {/* Scene set thumbnails */}
              {hoveredPin.matchedLoc.sceneSets?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                    SCENE SETS ({hoveredPin.matchedLoc.sceneSets.length})
                  </div>
                  <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
                    {hoveredPin.matchedLoc.sceneSets.slice(0, 3).map(ss => (
                      <div key={ss.id} style={{ width: 56, flexShrink: 0 }}>
                        {ss.base_still_url ? (
                          <img src={ss.base_still_url} alt={ss.name}
                            style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} />
                        ) : (
                          <div style={{ width: 56, height: 36, borderRadius: 4, background: '#f0eee8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#aaa' }}>
                            No img
                          </div>
                        )}
                        <div style={{ fontSize: 8, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ss.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events at location */}
              {hoveredPin.matchedLoc.events?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
                    EVENTS ({hoveredPin.matchedLoc.events.length})
                  </div>
                  {hoveredPin.matchedLoc.events.slice(0, 2).map(ev => (
                    <div key={ev.id} style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                      {ev.name} · <span style={{ color: '#999' }}>{ev.event_type}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 9, color: '#B8962E', marginTop: 8, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                Click to view details
              </div>
            </>
          ) : (
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
              No location created yet — add one in the Locations tab
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { DREAM_CITIES };
