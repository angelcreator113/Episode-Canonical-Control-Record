/**
 * DreamMap.jsx — Interactive LalaVerse World Map
 *
 * Rendered world map image with interactive city zone hotspots.
 * Pan/zoom via mouse wheel + drag. Click zones → location details.
 *
 * Props:
 *   locations       — array of WorldLocation objects (with sceneSets, events)
 *   profiles        — array of { city, count } for feed profile distribution
 *   onSelectLocation(loc) — callback when a location pin is clicked
 *   lalaPosition    — { locationId } for Lala's current position
 *   mapImageUrl     — custom map image URL (optional, falls back to default)
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ── DREAM City Zone Definitions ─────────────────────────────────────────────
// Positions are % of the map image (x%, y%) for each city zone center
const DREAM_CITIES = [
  {
    key: 'dazzle_district', letter: 'D', name: 'Dazzle District',
    subtitle: 'Fashion & Luxury', icon: '👗',
    color: '#d4789a', glow: 'rgba(212,120,154,0.3)',
    // Top-left area — pink blossom district with modern buildings
    x: 18, y: 32,
    pins: [
      { x: 12, y: 22, label: 'Runway Quarter' },
      { x: 22, y: 28, label: 'Boutique Row' },
      { x: 15, y: 40, label: 'Atelier Circle' },
      { x: 24, y: 38, label: 'Dazzle Academy' },
    ],
  },
  {
    key: 'radiance_row', letter: 'R', name: 'Radiance Row',
    subtitle: 'Beauty & Wellness', icon: '✨',
    color: '#a889c8', glow: 'rgba(168,137,200,0.3)',
    // Center-left — the glowing purple tower area
    x: 42, y: 25,
    pins: [
      { x: 38, y: 18, label: 'Salon Strip' },
      { x: 45, y: 22, label: 'Glow Labs HQ' },
      { x: 40, y: 32, label: 'Radiance Institute' },
      { x: 48, y: 30, label: 'Spa Quarter' },
    ],
  },
  {
    key: 'echo_park', letter: 'E', name: 'Echo Park',
    subtitle: 'Entertainment & Nightlife', icon: '🎵',
    color: '#c9a84c', glow: 'rgba(201,168,76,0.3)',
    // Center — the main tower/entertainment complex
    x: 52, y: 38,
    pins: [
      { x: 48, y: 42, label: 'Music Row' },
      { x: 55, y: 35, label: 'Comedy Quarter' },
      { x: 50, y: 48, label: 'Club District' },
      { x: 58, y: 42, label: 'Nova Studios' },
    ],
  },
  {
    key: 'ascent_tower', letter: 'A', name: 'Ascent Tower',
    subtitle: 'Tech & Innovation', icon: '🔮',
    color: '#6bba9a', glow: 'rgba(107,186,154,0.3)',
    // Right side — the tall white tower district
    x: 72, y: 22,
    pins: [
      { x: 68, y: 18, label: 'Innovation Hub' },
      { x: 75, y: 15, label: 'Ascent Tech Institute' },
      { x: 70, y: 28, label: 'Startup Alley' },
      { x: 78, y: 25, label: 'Platform HQ' },
    ],
  },
  {
    key: 'maverick_harbor', letter: 'M', name: 'Maverick Harbor',
    subtitle: 'Creator Economy & Counter-culture', icon: '⚓',
    color: '#7ab3d4', glow: 'rgba(122,179,212,0.3)',
    // Bottom-right — the harbor/dock area
    x: 82, y: 55,
    pins: [
      { x: 78, y: 50, label: 'Creator Studios' },
      { x: 85, y: 48, label: 'Podcast Row' },
      { x: 80, y: 60, label: 'The Underground' },
      { x: 88, y: 58, label: 'Harbor Docks' },
    ],
  },
];

// Default map — gradient placeholder until real image is uploaded
const DEFAULT_MAP_GRADIENT = `linear-gradient(135deg,
  #e8d5b7 0%, #c4a87c 15%, #8fb8d4 30%,
  #7a9cb8 45%, #9b8ec4 55%, #c4a87c 70%,
  #8fb8d4 85%, #6a9bb5 100%)`;

export default function DreamMap({
  locations = [],
  profiles = [],
  onSelectLocation,
  lalaPosition,
  mapImageUrl,
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredCity, setHoveredCity] = useState(null);
  const [hoveredPin, setHoveredPin] = useState(null);
  const [activeCity, setActiveCity] = useState(null);

  // ── Edit mode: drag cities to reposition ──
  const [editMode, setEditMode] = useState(false);
  const [cityPositions, setCityPositions] = useState({});
  const [draggingCity, setDraggingCity] = useState(null);
  const [positionsDirty, setPositionsDirty] = useState(false);

  // Load saved positions
  useEffect(() => {
    fetch('/api/v1/world/map/positions').then(r => r.json()).then(d => {
      if (d.positions && Object.keys(d.positions).length > 0) setCityPositions(d.positions);
    }).catch(() => {});
  }, []);

  // Get effective position for a city (saved override or default)
  const getCityPos = useCallback((city) => {
    if (cityPositions[city.key]) return cityPositions[city.key];
    return { x: city.x, y: city.y };
  }, [cityPositions]);

  // Handle city drag
  const onCityDragStart = useCallback((e, cityKey) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingCity(cityKey);
  }, []);

  const onCityDragMove = useCallback((e) => {
    if (!draggingCity || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Convert mouse position to % of container, accounting for pan/zoom
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = ((rawX - transform.x) / transform.scale / rect.width) * 100;
    const y = ((rawY - transform.y) / transform.scale / rect.height) * 100;
    setCityPositions(prev => ({ ...prev, [draggingCity]: { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) } }));
    setPositionsDirty(true);
  }, [draggingCity, transform]);

  const onCityDragEnd = useCallback(() => {
    setDraggingCity(null);
  }, []);

  // Save positions
  const savePositions = useCallback(async () => {
    try {
      await fetch('/api/v1/world/map/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: cityPositions }),
      });
      setPositionsDirty(false);
    } catch (err) {
      console.warn('[DreamMap] save positions failed:', err?.message);
    }
  }, [cityPositions]);

  // Reset to defaults
  const resetPositions = useCallback(() => {
    setCityPositions({});
    setPositionsDirty(true);
  }, []);

  // Group locations by city
  const locationsByCity = useMemo(() => {
    const map = {};
    DREAM_CITIES.forEach(c => { map[c.key] = []; });
    locations.forEach(loc => {
      const cityKey = (loc.city || '').toLowerCase().replace(/ /g, '_');
      const match = DREAM_CITIES.find(c =>
        c.key === cityKey || c.name.toLowerCase() === (loc.city || '').toLowerCase()
      );
      if (match) map[match.key].push(loc);
    });
    return map;
  }, [locations]);

  // Profile counts
  const profilesByCity = useMemo(() => {
    const map = {};
    DREAM_CITIES.forEach(c => { map[c.key] = 0; });
    profiles.forEach(p => { if (map[p.city] !== undefined) map[p.city] = p.count; });
    return map;
  }, [profiles]);

  // ── Pan ──
  const onMouseDown = useCallback((e) => {
    if (draggingCity) return;
    if (e.target.closest('[data-pin]') || e.target.closest('[data-zone]')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }, [transform, draggingCity]);

  const onMouseMove = useCallback((e) => {
    if (draggingCity) { onCityDragMove(e); return; }
    if (!dragging) return;
    setTransform(p => ({ ...p, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
  }, [dragging, dragStart, draggingCity, onCityDragMove]);

  const onMouseUp = useCallback(() => {
    if (draggingCity) { onCityDragEnd(); return; }
    setDragging(false);
  }, [draggingCity, onCityDragEnd]);

  // ── Zoom ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setTransform(p => ({ ...p, scale: Math.max(0.5, Math.min(4, p.scale + (e.deltaY > 0 ? -0.1 : 0.1))) }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(4, p.scale + 0.3) }));
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.3) }));
  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div style={{ position: 'relative' }}>
      {/* Map container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative', width: '100%', height: 560,
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid #e8e0d0',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          background: '#1a2a3a',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Map image layer */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
          transition: dragging ? 'none' : 'transform 0.15s ease-out',
        }}>
          {mapImageUrl ? (
            <img
              src={mapImageUrl}
              alt="LalaVerse DREAM Map"
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              draggable={false}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: DEFAULT_MAP_GRADIENT,
              position: 'relative',
            }}>
              {/* Water texture overlay */}
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 60%, rgba(100,160,200,0.4) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 70%, rgba(100,160,200,0.3) 0%, transparent 50%)' }} />
              {/* Land masses */}
              <div style={{ position: 'absolute', left: '5%', top: '15%', width: '35%', height: '55%', background: 'radial-gradient(ellipse, rgba(200,180,140,0.6) 0%, rgba(180,160,120,0.3) 60%, transparent 80%)', borderRadius: '40%' }} />
              <div style={{ position: 'absolute', left: '35%', top: '10%', width: '40%', height: '50%', background: 'radial-gradient(ellipse, rgba(190,170,130,0.5) 0%, rgba(170,150,110,0.3) 60%, transparent 80%)', borderRadius: '30%' }} />
              <div style={{ position: 'absolute', left: '60%', top: '20%', width: '35%', height: '60%', background: 'radial-gradient(ellipse, rgba(180,200,160,0.4) 0%, rgba(160,180,140,0.2) 60%, transparent 80%)', borderRadius: '35%' }} />
              {/* Upload prompt */}
              <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 11, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                Upload your rendered DREAM map below
              </div>
            </div>
          )}

          {/* City zone hotspots */}
          {DREAM_CITIES.map(city => {
            const cityLocs = locationsByCity[city.key] || [];
            const profCount = profilesByCity[city.key] || 0;
            const isActive = activeCity === city.key;
            const isHovered = hoveredCity === city.key;
            const pos = getCityPos(city);
            const isDragging = draggingCity === city.key;

            return (
              <div key={city.key}>
                {/* City zone circle */}
                <div
                  data-zone={city.key}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`, top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isActive ? 140 : 100, height: isActive ? 140 : 100,
                    borderRadius: '50%',
                    background: editMode ? (isDragging ? city.color + '40' : city.glow) : isActive ? city.glow : isHovered ? city.glow : 'rgba(255,255,255,0.08)',
                    border: `2px ${editMode ? 'dashed' : 'solid'} ${isActive || editMode ? city.color : isHovered ? city.color + '80' : 'rgba(255,255,255,0.15)'}`,
                    cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                    transition: isDragging ? 'none' : 'all 0.25s ease',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    zIndex: isDragging ? 20 : isActive ? 5 : 2,
                  }}
                  onMouseEnter={() => !editMode && setHoveredCity(city.key)}
                  onMouseLeave={() => setHoveredCity(null)}
                  onMouseDown={(e) => { if (editMode) onCityDragStart(e, city.key); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editMode) return;
                    setActiveCity(isActive ? null : city.key);
                  }}
                >
                  <span style={{ fontSize: isActive ? 22 : 18 }}>{city.icon}</span>
                  <span style={{
                    fontSize: 18, fontWeight: 900, color: '#fff',
                    fontFamily: "'DM Mono', monospace",
                    textShadow: `0 0 12px ${city.color}, 0 2px 4px rgba(0,0,0,0.5)`,
                    lineHeight: 1,
                  }}>{city.letter}</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: 0.5, marginTop: 2,
                    opacity: isActive || isHovered ? 1 : 0.7,
                  }}>{city.name.toUpperCase()}</span>

                  {/* Stats badges */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                    {cityLocs.length > 0 && (
                      <span style={{ fontSize: 7, padding: '1px 4px', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 3, fontWeight: 600 }}>
                        {cityLocs.length} loc
                      </span>
                    )}
                    {profCount > 0 && (
                      <span style={{ fontSize: 7, padding: '1px 4px', background: 'rgba(0,0,0,0.5)', color: city.color, borderRadius: 3, fontWeight: 600 }}>
                        {profCount} creators
                      </span>
                    )}
                  </div>
                </div>

                {/* Location pins — shown when city is active */}
                {isActive && city.pins.map((pin, pi) => {
                  const matchedLoc = cityLocs[pi] || null;
                  const hasSceneSet = matchedLoc?.sceneSets?.length > 0;
                  const isLalaHere = lalaPosition?.locationId && matchedLoc?.id === lalaPosition.locationId;
                  const isPinHovered = hoveredPin === `${city.key}-${pi}`;

                  return (
                    <div
                      key={pi}
                      data-pin={`${city.key}-${pi}`}
                      style={{
                        position: 'absolute',
                        left: `${pin.x}%`, top: `${pin.y}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: isPinHovered ? 10 : 3,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHoveredPin(`${city.key}-${pi}`)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (matchedLoc && onSelectLocation) onSelectLocation(matchedLoc);
                      }}
                    >
                      {/* Pin marker */}
                      <div style={{
                        width: matchedLoc ? 14 : 10,
                        height: matchedLoc ? 14 : 10,
                        borderRadius: hasSceneSet ? 3 : '50%',
                        background: matchedLoc ? city.color : city.color + '60',
                        border: '2px solid #fff',
                        boxShadow: `0 0 8px ${city.glow}, 0 2px 6px rgba(0,0,0,0.3)`,
                        transition: 'all 0.15s',
                        transform: isPinHovered ? 'scale(1.4)' : 'scale(1)',
                      }} />

                      {/* Lala pulse */}
                      {isLalaHere && (
                        <div style={{
                          position: 'absolute', top: -6, left: -6,
                          width: 26, height: 26, borderRadius: '50%',
                          border: '2px solid #d4789a',
                          animation: 'dreamMapPulse 1.5s infinite',
                        }} />
                      )}

                      {/* Pin label */}
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: 4, whiteSpace: 'nowrap',
                        fontSize: 8, fontWeight: 600, color: '#fff',
                        fontFamily: "'DM Mono', monospace",
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                        opacity: isPinHovered ? 1 : 0.8,
                      }}>
                        {matchedLoc?.name || pin.label}
                      </div>

                      {/* Scene set thumbnail on hover */}
                      {isPinHovered && matchedLoc?.sceneSets?.length > 0 && (
                        <div style={{
                          position: 'absolute', bottom: '100%', left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: 8, display: 'flex', gap: 3,
                          background: 'rgba(0,0,0,0.8)', borderRadius: 6,
                          padding: 4, border: `1px solid ${city.color}40`,
                        }}>
                          {matchedLoc.sceneSets.slice(0, 2).map(ss => (
                            <div key={ss.id}>
                              {ss.base_still_url ? (
                                <img src={ss.base_still_url} alt={ss.name}
                                  style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 3 }} />
                              ) : (
                                <div style={{ width: 48, height: 32, borderRadius: 3, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#666' }}>
                                  No img
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Extra location pins beyond defaults */}
                {isActive && cityLocs.slice(city.pins.length).map((loc, i) => {
                  const angle = ((i + city.pins.length) / Math.max(cityLocs.length, 1)) * Math.PI * 2;
                  const px = city.x + Math.cos(angle) * 8;
                  const py = city.y + Math.sin(angle) * 6;
                  return (
                    <div
                      key={`extra-${i}`}
                      data-pin={`${city.key}-extra-${i}`}
                      style={{
                        position: 'absolute',
                        left: `${px}%`, top: `${py}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 8, height: 8, borderRadius: '50%',
                        background: city.color + '80',
                        border: '1.5px solid #fff',
                        cursor: 'pointer', zIndex: 3,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectLocation) onSelectLocation(loc);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Header overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
          zIndex: 10, pointerEvents: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: '#B8962E', letterSpacing: 3 }}>
              THE LALAVERSE
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {locations.length} locations · {profiles.reduce((s, p) => s + p.count, 0)} creators · 5 cities
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {DREAM_CITIES.map(c => (
              <span key={c.key} style={{
                fontSize: 16, fontWeight: 900, color: c.color,
                fontFamily: "'DM Mono', monospace",
                textShadow: `0 0 8px ${c.glow}`,
                opacity: activeCity === c.key ? 1 : 0.5,
              }}>{c.letter}</span>
            ))}
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
          {[
            { label: '+', fn: zoomIn },
            { label: '−', fn: zoomOut },
            { label: '1:1', fn: resetView },
          ].map(b => (
            <button key={b.label} onClick={b.fn} style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: b.label === '1:1' ? 10 : 16,
              fontFamily: "'DM Mono', monospace",
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}>{b.label}</button>
          ))}
        </div>

        {/* Edit mode controls */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
          {editMode ? (
            <>
              <button onClick={() => { savePositions(); setEditMode(false); }} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                background: positionsDirty ? '#16a34a' : 'rgba(0,0,0,0.6)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}>Save Positions</button>
              <button onClick={resetPositions} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#ff8888',
                border: '1px solid rgba(255,100,100,0.3)',
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}>Reset</button>
              <button onClick={() => { setCityPositions({}); setEditMode(false); setPositionsDirty(false); }} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#aaa',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              background: 'rgba(0,0,0,0.6)', color: '#B8962E',
              border: '1px solid rgba(184,150,46,0.3)',
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              backdropFilter: 'blur(4px)',
            }}>Edit Positions</button>
          )}
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div style={{
            position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(184,150,46,0.9)', borderRadius: 8,
            padding: '6px 16px', color: '#fff', fontSize: 11,
            fontFamily: "'DM Mono', monospace", fontWeight: 600,
            zIndex: 10, whiteSpace: 'nowrap',
          }}>
            Drag cities to reposition them on the map
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 10,
          display: 'flex', gap: 10,
          background: 'rgba(0,0,0,0.6)', borderRadius: 8,
          padding: '6px 12px', backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {[
            { shape: 'circle', color: '#B8962E', label: 'Venue' },
            { shape: 'pulse', color: '#d4789a', label: 'Lala' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Mono', monospace" }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: l.shape === 'square' ? 2 : '50%',
                background: l.color,
                boxShadow: l.shape === 'pulse' ? `0 0 6px ${l.color}` : 'none',
              }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* City sidebar — shown when a city is active */}
        {activeCity && (() => {
          const city = DREAM_CITIES.find(c => c.key === activeCity);
          const cityLocs = locationsByCity[activeCity] || [];
          const profCount = profilesByCity[activeCity] || 0;
          return (
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
              borderLeft: `2px solid ${city.color}40`,
              zIndex: 15, overflowY: 'auto',
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: city.color, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                    {city.icon} {city.letter} — {city.subtitle.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {city.name}
                  </div>
                </div>
                <button onClick={() => setActiveCity(null)} style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
                  color: '#999', fontSize: 14, cursor: 'pointer', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>x</button>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: city.color }}>{cityLocs.length}</div>
                  <div style={{ fontSize: 8, color: '#888', fontFamily: "'DM Mono', monospace" }}>LOCATIONS</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: city.color }}>{profCount}</div>
                  <div style={{ fontSize: 8, color: '#888', fontFamily: "'DM Mono', monospace" }}>CREATORS</div>
                </div>
              </div>

              {/* Location list */}
              {cityLocs.length > 0 ? cityLocs.map(loc => (
                <div
                  key={loc.id}
                  onClick={() => onSelectLocation && onSelectLocation(loc)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: 10, marginBottom: 6,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{loc.name}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>
                    {loc.location_type}{loc.venue_type ? ` · ${loc.venue_type}` : ''}
                  </div>
                  {loc.sceneSets?.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                      {loc.sceneSets.slice(0, 3).map(ss => (
                        <div key={ss.id}>
                          {ss.base_still_url ? (
                            <img src={ss.base_still_url} alt={ss.name}
                              style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
                          ) : (
                            <div style={{ width: 44, height: 28, borderRadius: 4, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#555' }}>
                              {ss.scene_type || 'set'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {loc.events?.length > 0 && (
                    <div style={{ fontSize: 9, color: city.color, marginTop: 4, fontWeight: 600 }}>
                      {loc.events.length} event{loc.events.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )) : (
                <div style={{ color: '#666', fontSize: 11, textAlign: 'center', padding: 20 }}>
                  No locations in {city.name} yet
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes dreamMapPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export { DREAM_CITIES };
