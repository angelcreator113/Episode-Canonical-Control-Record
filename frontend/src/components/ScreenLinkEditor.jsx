/**
 * ScreenLinkEditor — Draw tap zones on a phone screen overlay, assign targets, upload icon images.
 *
 * Props:
 *   screenUrl       — URL of the screen image to draw zones on
 *   links           — array of { id, x, y, w, h, target, label, icon_urls }  (% based positions)
 *   screenTypes     — SCREEN_TYPES array for target picker dropdown
 *   onSave(links)   — callback to persist updated links
 *   onUploadIcon(linkId, file) — callback to upload icon image for a zone
 *   readOnly        — if true, hide editing controls (used in preview mode)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Upload, Link2, Save, X, Move, GripVertical, Pin, Check, Eye, EyeOff, Ruler, Info } from 'lucide-react';
import { getScreenImageStyle } from './PhoneHub';

const ZONE_COLORS = ['#d4789a', '#a889c8', '#c9a84c', '#6bba9a', '#7ab3d4', '#b89060', '#e06060', '#60b0e0'];

// Normalize legacy icon_url (string) to icon_urls (array) for backward compat
const getIconUrls = (zone) => {
  if (zone.icon_urls?.length) return zone.icon_urls;
  if (zone.icon_url) return [zone.icon_url];
  return [];
};

export default function ScreenLinkEditor({ screen, screenUrl, links = [], screenTypes = [], generatedScreenKeys, iconOverlays = [], globalFit, customFrameUrl, phoneSkin, onSave, onUploadIcon, readOnly = false, compact = false }) {
  const resolvedScreenUrl = screen?.url || screenUrl;
  const imageStyle = screen
    ? getScreenImageStyle(screen, globalFit)
    : { width: '100%', height: '100%', objectFit: 'cover' };
  const [zones, setZones] = useState(links);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, origX, origY }
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const MIGRATION_KEY = 'screenLinkEditor.migrationDismissed.v1';
  const [migrationDismissed, setMigrationDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MIGRATION_KEY) || '{}'); } catch { return {}; }
  });
  const containerRef = useRef(null);
  const iconInputRef = useRef(null);
  const uploadingLinkId = useRef(null);

  useEffect(() => { setZones(links); setIsDirty(false); }, [links]);

  const editingDisabled = readOnly || preview;
  const screenKey = screen?.id || resolvedScreenUrl || 'unknown';
  const showMigrationNotice = !readOnly && links.length > 0 && !migrationDismissed[screenKey];
  const dismissMigration = () => {
    const next = { ...migrationDismissed, [screenKey]: true };
    setMigrationDismissed(next);
    try { localStorage.setItem(MIGRATION_KEY, JSON.stringify(next)); } catch {}
  };

  // Unified position getter — works for mouse, touch, and pointer events
  const getRelativePos = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Drawing new zones — works for mouse and touch via pointer capture
  const handlePointerDown = (e) => {
    if (editingDisabled || dragging) return;
    if (e.target.closest('[data-zone-id]')) return;
    e.preventDefault();
    // Capture pointer so we keep getting events even if finger moves fast
    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch {}
    }
    const pos = getRelativePos(e);
    setDrawing(true);
    setDrawStart(pos);
    setDrawCurrent(pos);
    setSelectedZone(null);
  };

  const handlePointerMove = (e) => {
    if (dragging) {
      e.preventDefault();
      const pos = getRelativePos(e);
      setZones(prev => prev.map(z => z.id === dragging.id ? {
        ...z,
        x: Math.max(0, Math.min(100 - z.w, dragging.origX + (pos.x - dragging.startX))),
        y: Math.max(0, Math.min(100 - z.h, dragging.origY + (pos.y - dragging.startY))),
      } : z));
      setIsDirty(true);
      return;
    }
    if (!drawing) return;
    e.preventDefault();
    setDrawCurrent(getRelativePos(e));
  };

  const handlePointerUp = (e) => {
    // Release pointer capture
    if (e?.target?.releasePointerCapture && e?.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    if (dragging) {
      setDragging(null);
      return;
    }
    if (!drawing || !drawStart || !drawCurrent) { setDrawing(false); return; }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size threshold — ignore tiny accidental clicks (5% min)
    if (w > 5 && h > 5) {
      const newZone = {
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
        target: '',
        label: '',
        icon_url: null,
        icon_urls: [],
      };
      setZones(prev => [...prev, newZone]);
      setSelectedZone(newZone.id);
      setIsDirty(true);
    }

    setDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handleZoneDragStart = (e, zone) => {
    e.stopPropagation();
    e.preventDefault();
    if (containerRef.current?.setPointerCapture) {
      try { containerRef.current.setPointerCapture(e.pointerId); } catch {}
    }
    const pos = getRelativePos(e);
    setDragging({ id: zone.id, startX: pos.x, startY: pos.y, origX: zone.x, origY: zone.y });
    setSelectedZone(zone.id);
  };

  const updateZone = (id, changes) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...changes } : z));
    setIsDirty(true);
  };

  const removeZone = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedZone === id) setSelectedZone(null);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onSave) onSave(zones);
    setIsDirty(false);
  };

  const handleIconUpload = (linkId) => {
    uploadingLinkId.current = linkId;
    iconInputRef.current?.click();
  };

  const handleIconFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingLinkId.current) return;
    if (onUploadIcon) {
      await onUploadIcon(uploadingLinkId.current, file);
    }
    if (iconInputRef.current) iconInputRef.current.value = '';
    uploadingLinkId.current = null;
  };

  // Add a default zone (alternative to drawing — better for mobile)
  const addDefaultZone = () => {
    const newZone = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: 25, y: 30, w: 20, h: 15,
      target: '', label: '', icon_url: null, icon_urls: [],
    };
    setZones(prev => [...prev, newZone]);
    setSelectedZone(newZone.id);
    setIsDirty(true);
  };

  const drawRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const sel = selectedZone ? zones.find(z => z.id === selectedZone) : null;

  // Deduplicate icon overlays by URL to avoid showing the same image multiple times
  const uniqueIcons = iconOverlays.filter((ico, idx, arr) => arr.findIndex(i => i.url === ico.url) === idx);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPreview(p => !p)} title={preview ? 'Exit preview' : 'Preview'} style={toolbarBtnStyle(preview)}>
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
            {preview ? 'Exit Preview' : 'Preview'}
          </button>
          <button type="button" onClick={() => setShowSafeArea(s => !s)} title="Toggle safe-area guides" style={toolbarBtnStyle(showSafeArea)}>
            <Ruler size={12} />
            {showSafeArea ? 'Hide Guides' : 'Show Guides'}
          </button>
        </div>
      )}

      {showMigrationNotice && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fdf8ee', border: '1px solid #e6d9b8', fontSize: 12, color: '#6b5a28', lineHeight: 1.5 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: '#B8962E' }} />
          <div style={{ flex: 1 }}>The editor now matches the phone&rsquo;s exact dimensions. Existing zones may need to be repositioned — drag into place, then Save.</div>
          <button type="button" onClick={dismissMigration} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8962E', padding: 2, flexShrink: 0 }}><X size={14} /></button>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: compact ? 220 : 300, margin: '0 auto', padding: '10px 8px 14px', background: '#1a1a2e', borderRadius: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)', border: '2px solid rgba(0,0,0,0.4)', position: 'relative' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!drawing && !dragging) return; /* captured pointers don't fire leave */ }}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '9/19.5',
          borderRadius: 20,
          touchAction: 'none',
          overflow: 'hidden',
          cursor: editingDisabled ? 'default' : 'crosshair',
          userSelect: 'none',
          border: '2px solid #0a0a14',
          background: '#000',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.4)',
        }}
      >
        {resolvedScreenUrl ? (
          <img src={resolvedScreenUrl} alt="Screen" style={{ ...imageStyle, pointerEvents: 'none' }} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#f5f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 11 }}>
            No screen image
          </div>
        )}

        {/* Existing zones */}
        {zones.map((zone, i) => (
          <div
            key={zone.id}
            data-zone-id={zone.id}
            onPointerDown={(e) => !editingDisabled && handleZoneDragStart(e, zone)}
            onClick={(e) => { e.stopPropagation(); if (!preview) setSelectedZone(zone.id); }}
            style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              width: `${zone.w}%`, height: `${zone.h}%`,
              border: preview ? 'none' : `2px solid ${selectedZone === zone.id ? '#B8962E' : ZONE_COLORS[i % ZONE_COLORS.length]}`,
              borderRadius: 6,
              background: preview ? 'transparent' : (selectedZone === zone.id ? 'rgba(184,150,46,0.15)' : 'rgba(255,255,255,0.08)'),
              cursor: editingDisabled ? 'default' : 'move',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {(() => {
              const icons = getIconUrls(zone);
              if (icons.length > 0) {
                const maxPx = 64;
                const iconSize = Math.min(maxPx, Math.max(16, maxPx / Math.ceil(Math.sqrt(icons.length))));
                return (
                  <div style={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '90%', height: '90%', pointerEvents: 'none' }}>
                    {icons.map((url, idx) => (
                      <img key={idx} src={url} alt="" style={{ width: iconSize, height: iconSize, objectFit: 'contain', borderRadius: 2 }} draggable={false} />
                    ))}
                  </div>
                );
              }
              return (
                <span style={{ fontSize: 9, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.7)', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: 2, lineHeight: 1.2 }}>
                  {zone.label || zone.target || '?'}
                </span>
              );
            })()}
          </div>
        ))}

        {/* Draw instruction overlay — shown when no zones exist and not drawing */}
        {!readOnly && zones.length === 0 && !drawing && screenUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)', pointerEvents: 'none',
          }}>
            <div style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
              textAlign: 'center', lineHeight: 1.4,
            }}>
              Draw a rectangle to<br />create a tap zone
            </div>
          </div>
        )}

        {/* Drawing preview */}
        {drawRect && drawRect.w > 1 && drawRect.h > 1 && (
          <div style={{
            position: 'absolute',
            left: `${drawRect.x}%`, top: `${drawRect.y}%`,
            width: `${drawRect.w}%`, height: `${drawRect.h}%`,
            border: '2px dashed #B8962E',
            borderRadius: 6,
            background: 'rgba(184,150,46,0.1)',
            pointerEvents: 'none',
          }} />
        )}

        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: '28%', height: 18, borderRadius: 9, background: '#000', zIndex: 6, border: '1.5px solid #333', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: '30%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.35)', zIndex: 6, pointerEvents: 'none' }} />

        {showSafeArea && !preview && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '7%', border: '1px dashed rgba(220,180,60,0.9)', background: 'rgba(220,180,60,0.08)', pointerEvents: 'none', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(220,180,60,1)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>notch area</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3.5%', border: '1px dashed rgba(220,180,60,0.9)', background: 'rgba(220,180,60,0.08)', pointerEvents: 'none', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(220,180,60,1)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>home indicator</div>
          </>
        )}
      </div>
      </div>

      {/* Zone list + editor */}
      {!readOnly && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              TAP ZONES ({zones.length})
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addDefaultZone} style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
                borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#888',
                display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
              }}>
                <Plus size={12} /> Add
              </button>
              {isDirty && (
                <button onClick={handleSave} style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none',
                  borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
                }}>
                  <Save size={12} /> Save
                </button>
              )}
            </div>
          </div>

          {zones.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '12px 0', lineHeight: 1.6 }}>
              Draw rectangles on the screen to create tap zones. Each zone links to another screen.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(!compact ? { maxHeight: 'min(400px, 35vh)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {}) }}>
            {zones.map((zone, i) => (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                style={{
                  padding: '10px 12px',
                  background: selectedZone === zone.id ? '#fdf8ee' : '#fff',
                  border: `1px solid ${selectedZone === zone.id ? '#B8962E' : '#eee'}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedZone === zone.id ? 8 : 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[i % ZONE_COLORS.length], flexShrink: 0 }} />
                  {zone.persistent && <Pin size={11} color="#B8962E" style={{ flexShrink: 0 }} />}
                  {getIconUrls(zone).slice(0, 3).map((url, idx) => (
                    <img key={idx} src={url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', marginLeft: idx > 0 ? -4 : 0 }} />
                  ))}
                  {getIconUrls(zone).length > 3 && <span style={{ fontSize: 9, color: '#aaa' }}>+{getIconUrls(zone).length - 3}</span>}
                  <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.label || zone.target || 'Untitled'}</span>
                  <span style={{ fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {zone.target ? `→ ${zone.target}` : 'no target'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded editor for selected zone */}
                {selectedZone === zone.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid #f0ece4' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        value={zone.label || ''}
                        onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                        placeholder="Label (e.g. Messages)"
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 120 }}
                      />
                      <select
                        value={zone.target || ''}
                        onChange={(e) => {
                          const t = screenTypes.find(s => s.key === e.target.value);
                          updateZone(zone.id, { target: e.target.value, label: zone.label || t?.label || '' });
                        }}
                        style={{ padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 120, flex: 1 }}
                      >
                        <option value="">— Target —</option>
                        {screenTypes.map(st => {
                          const hasImage = generatedScreenKeys?.has(st.key);
                          return (
                            <option key={st.key} value={st.key}>
                              {st.label}{hasImage ? ' \u2713' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {/* Position & Size — all slider-based for mobile friendliness */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                      {[
                        { label: 'X', key: 'x', max: () => 100 - zone.w },
                        { label: 'Y', key: 'y', max: () => 100 - zone.h },
                        { label: 'W', key: 'w', max: () => 100 - zone.x },
                        { label: 'H', key: 'h', max: () => 100 - zone.y },
                      ].map(s => (
                        <div key={s.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                            <span style={{ fontSize: 10, color: '#888', fontFamily: "'DM Mono', monospace" }}>{s.label}</span>
                            <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(zone[s.key])}%</span>
                          </div>
                          <input type="range" min={s.key === 'w' || s.key === 'h' ? 5 : 0} max={s.max()}
                            value={Math.round(zone[s.key])}
                            onChange={e => updateZone(zone.id, { [s.key]: parseInt(e.target.value) })}
                            style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: '#B8962E' }} />
                        </div>
                      ))}
                    </div>
                    {/* Icons — multi-select picker */}
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {getIconUrls(zone).map((url, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', border: '1px solid #eee' }} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = getIconUrls(zone).filter(u => u !== url);
                                updateZone(zone.id, { icon_urls: updated, icon_url: updated[0] || null });
                              }}
                              style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                            >×</button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleIconUpload(zone.id)}
                          style={{
                            padding: '6px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
                            borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#7ab3d4',
                            display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
                          }}
                        >
                          <Upload size={12} /> Upload
                        </button>
                        {uniqueIcons.length > 0 && (
                          <button
                            onClick={() => setShowIconPicker(!showIconPicker)}
                            style={{
                              padding: '6px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
                              borderRadius: 6, background: showIconPicker ? '#fdf8ee' : '#fff', cursor: 'pointer',
                              color: showIconPicker ? '#B8962E' : '#888',
                              display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
                            }}
                          >
                            Icons ({uniqueIcons.length})
                          </button>
                        )}
                        {getIconUrls(zone).length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { icon_urls: [], icon_url: null }); }}
                            style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626', minHeight: 32 }}
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      {showIconPicker && uniqueIcons.length > 0 && (
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                          gap: 6, marginTop: 6, maxHeight: 200, overflowY: 'auto', padding: 2,
                        }}>
                          {uniqueIcons.map(ico => {
                            const isSelected = getIconUrls(zone).includes(ico.url);
                            return (
                              <button
                                key={ico.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = getIconUrls(zone);
                                  const updated = isSelected
                                    ? current.filter(u => u !== ico.url)
                                    : [...current, ico.url];
                                  updateZone(zone.id, { icon_urls: updated, icon_url: updated[0] || null });
                                }}
                                title={ico.name}
                                style={{
                                  position: 'relative',
                                  width: '100%', aspectRatio: '1/1', borderRadius: 8,
                                  border: isSelected ? '2px solid #B8962E' : '1px solid #e0d9ce',
                                  background: isSelected ? '#fdf8ee' : '#fff',
                                  cursor: 'pointer', padding: 6,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <img src={ico.url} alt={ico.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 3 }} draggable={false} />
                                {isSelected && (
                                  <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, background: '#B8962E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Check size={10} color="#fff" strokeWidth={3} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {/* Persistent toggle — pin icon to show on all screens */}
                    <button
                      onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { persistent: !zone.persistent }); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        border: `1px solid ${zone.persistent ? '#B8962E' : '#e0d9ce'}`,
                        borderRadius: 6, cursor: 'pointer', minHeight: 36,
                        background: zone.persistent ? '#fdf8ee' : '#fff',
                        color: zone.persistent ? '#B8962E' : '#888',
                        width: '100%',
                      }}
                    >
                      <Pin size={12} /> {zone.persistent ? 'Pinned — shows on all screens' : 'Pin to all screens'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFileChange} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}

function toolbarBtnStyle(active) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', fontSize: 11, fontWeight: 600,
    border: `1px solid ${active ? '#B8962E' : '#e0d9ce'}`,
    borderRadius: 6,
    background: active ? '#fdf8ee' : '#fff',
    color: active ? '#B8962E' : '#666',
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 0.3,
    minHeight: 30,
  };
}
