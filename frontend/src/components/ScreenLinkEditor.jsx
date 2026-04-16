/**
 * ScreenLinkEditor — Draw tap zones on a phone screen overlay, assign targets, upload icon images.
 *
 * Props:
 *   screenUrl       — URL of the screen image to draw zones on
 *   links           — array of { id, x, y, w, h, target, label, icon_url }  (% based positions)
 *   screenTypes     — SCREEN_TYPES array for target picker dropdown
 *   onSave(links)   — callback to persist updated links
 *   onUploadIcon(linkId, file) — callback to upload icon image for a zone
 *   readOnly        — if true, hide editing controls (used in preview mode)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Upload, Link2, Save, X, Move, GripVertical, Pin } from 'lucide-react';

const ZONE_COLORS = ['#d4789a', '#a889c8', '#c9a84c', '#6bba9a', '#7ab3d4', '#b89060', '#e06060', '#60b0e0'];

export default function ScreenLinkEditor({ screenUrl, links = [], screenTypes = [], generatedScreenKeys, iconOverlays = [], onSave, onUploadIcon, readOnly = false, compact = false }) {
  const [zones, setZones] = useState(links);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, origX, origY }
  const containerRef = useRef(null);
  const iconInputRef = useRef(null);
  const uploadingLinkId = useRef(null);

  useEffect(() => { setZones(links); setIsDirty(false); }, [links]);

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
    if (readOnly || dragging) return;
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

  const drawRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const sel = selectedZone ? zones.find(z => z.id === selectedZone) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Screen with overlay zones */}
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
          maxWidth: compact ? 200 : 320,
          margin: '0 auto',
          aspectRatio: '9/19.5',
          borderRadius: 12,
          touchAction: 'none',
          overflow: 'hidden',
          cursor: readOnly ? 'default' : 'crosshair',
          userSelect: 'none',
          border: '1px solid #e8e0d0',
        }}
      >
        {screenUrl ? (
          <img src={screenUrl} alt="Screen" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} draggable={false} />
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
            onPointerDown={(e) => !readOnly && handleZoneDragStart(e, zone)}
            onClick={(e) => { e.stopPropagation(); setSelectedZone(zone.id); }}
            style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              width: `${zone.w}%`, height: `${zone.h}%`,
              border: `2px solid ${selectedZone === zone.id ? '#B8962E' : ZONE_COLORS[i % ZONE_COLORS.length]}`,
              borderRadius: 6,
              background: selectedZone === zone.id ? 'rgba(184,150,46,0.15)' : 'rgba(255,255,255,0.08)',
              cursor: readOnly ? 'pointer' : 'move',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {zone.icon_url ? (
              <img src={zone.icon_url} alt={zone.label || zone.target} style={{ width: '80%', height: '80%', maxWidth: 64, maxHeight: 64, objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
            ) : (
              <span style={{ fontSize: 7, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: 2 }}>
                {zone.label || zone.target || '?'}
              </span>
            )}
          </div>
        ))}

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
      </div>

      {/* Zone list + editor */}
      {!readOnly && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              TAP ZONES ({zones.length})
            </span>
            {isDirty && (
              <button onClick={handleSave} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none',
                borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, minHeight: 36,
              }}>
                <Save size={12} /> Save Links
              </button>
            )}
          </div>

          {zones.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '12px 0', lineHeight: 1.6 }}>
              Draw rectangles on the screen to create tap zones. Each zone links to another screen.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'min(400px, 35vh)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                  {zone.icon_url && <img src={zone.icon_url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain' }} />}
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
                              {st.icon} {st.label}{hasImage ? ' \u2713' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {/* Icon picker — choose from existing icon overlays or upload */}
                    <div>
                      {iconOverlays.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
                            USE ICON OVERLAY ({iconOverlays.length})
                          </div>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
                            gap: 6, maxHeight: 200, overflowY: 'auto', padding: 2,
                            WebkitOverflowScrolling: 'touch',
                          }}>
                            {iconOverlays.map(ico => (
                              <button
                                key={ico.id}
                                onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { icon_url: ico.url, icon_overlay_id: ico.id }); }}
                                title={ico.name}
                                style={{
                                  width: '100%', aspectRatio: '1/1', borderRadius: 8,
                                  border: zone.icon_url === ico.url ? '2px solid #B8962E' : '1px solid #e0d9ce',
                                  background: zone.icon_url === ico.url ? '#fdf8ee' : '#fff',
                                  cursor: 'pointer', padding: 4,
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                  transition: 'border-color 0.15s',
                                }}
                              >
                                <img src={ico.url} alt={ico.name} style={{ width: '100%', flex: 1, objectFit: 'contain', borderRadius: 4 }} draggable={false} />
                                <span style={{ fontSize: 7, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', lineHeight: 1 }}>
                                  {(ico.name || '').replace(/\s*Icon$/i, '')}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleIconUpload(zone.id)}
                          style={{
                            padding: '8px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e0d9ce',
                            borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#7ab3d4',
                            display: 'flex', alignItems: 'center', gap: 4, minHeight: 36,
                          }}
                        >
                          <Upload size={12} /> {zone.icon_url ? 'Replace' : 'Upload Custom'}
                        </button>
                        {zone.icon_url && (
                          <>
                            <img src={zone.icon_url} alt="icon" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', border: '1px solid #eee' }} />
                            <button
                              onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { icon_url: null }); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, fontSize: 11 }}
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}
                        <span style={{ fontSize: 11, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                          {Math.round(zone.x)}%, {Math.round(zone.y)}%
                        </span>
                      </div>
                    </div>
                    {/* Zone size controls */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>Width</span>
                          <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(zone.w)}%</span>
                        </div>
                        <input type="range" min={3} max={50} value={Math.round(zone.w)} onChange={e => updateZone(zone.id, { w: parseInt(e.target.value) })}
                          style={{ width: '100%', height: 4, cursor: 'pointer' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>Height</span>
                          <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(zone.h)}%</span>
                        </div>
                        <input type="range" min={3} max={50} value={Math.round(zone.h)} onChange={e => updateZone(zone.id, { h: parseInt(e.target.value) })}
                          style={{ width: '100%', height: 4, cursor: 'pointer' }} />
                      </div>
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
