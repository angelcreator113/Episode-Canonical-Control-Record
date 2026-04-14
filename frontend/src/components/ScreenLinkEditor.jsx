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
import { Plus, Trash2, Upload, Link2, Save, X, Move, GripVertical } from 'lucide-react';

const ZONE_COLORS = ['#d4789a', '#a889c8', '#c9a84c', '#6bba9a', '#7ab3d4', '#b89060', '#e06060', '#60b0e0'];

export default function ScreenLinkEditor({ screenUrl, links = [], screenTypes = [], onSave, onUploadIcon, readOnly = false }) {
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

  const getRelativePos = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Drawing new zones
  const handleMouseDown = (e) => {
    if (readOnly || dragging) return;
    // Ignore if clicking on an existing zone
    if (e.target.closest('[data-zone-id]')) return;
    const pos = getRelativePos(e);
    setDrawing(true);
    setDrawStart(pos);
    setDrawCurrent(pos);
    setSelectedZone(null);
  };

  const handleMouseMove = (e) => {
    if (dragging) {
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
    setDrawCurrent(getRelativePos(e));
  };

  const handleMouseUp = () => {
    if (dragging) {
      setDragging(null);
      return;
    }
    if (!drawing || !drawStart || !drawCurrent) { setDrawing(false); return; }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size threshold — ignore tiny accidental clicks
    if (w > 3 && h > 3) {
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
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* Screen with overlay zones */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (drawing) handleMouseUp(); if (dragging) setDragging(null); }}
        style={{
          position: 'relative',
          width: 260,
          flexShrink: 0,
          aspectRatio: '9/16',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: readOnly ? 'default' : drawing ? 'crosshair' : 'crosshair',
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
            onMouseDown={(e) => !readOnly && handleZoneDragStart(e, zone)}
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
              <img src={zone.icon_url} alt={zone.label || zone.target} style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
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
            <span style={{ fontSize: 10, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              TAP ZONES ({zones.length})
            </span>
            {isDirty && (
              <button onClick={handleSave} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 600, border: 'none',
                borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Save size={10} /> Save Links
              </button>
            )}
          </div>

          {zones.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '12px 0', lineHeight: 1.6 }}>
              Draw rectangles on the screen to create tap zones. Each zone links to another screen.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {zones.map((zone, i) => (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                style={{
                  padding: '6px 8px',
                  background: selectedZone === zone.id ? '#fdf8ee' : '#fff',
                  border: `1px solid ${selectedZone === zone.id ? '#B8962E' : '#eee'}`,
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: selectedZone === zone.id ? 6 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: ZONE_COLORS[i % ZONE_COLORS.length], flexShrink: 0 }} />
                  {zone.icon_url && <img src={zone.icon_url} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'contain' }} />}
                  <span style={{ fontWeight: 600, flex: 1 }}>{zone.label || zone.target || 'Untitled'}</span>
                  <span style={{ fontSize: 9, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
                    {zone.target ? `→ ${zone.target}` : 'no target'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2 }}>
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Expanded editor for selected zone */}
                {selectedZone === zone.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid #f0ece4' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        value={zone.label || ''}
                        onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                        placeholder="Label (e.g. Messages)"
                        style={{ flex: 1, padding: '4px 6px', border: '1px solid #e0d9ce', borderRadius: 4, fontSize: 11 }}
                      />
                      <select
                        value={zone.target || ''}
                        onChange={(e) => {
                          const t = screenTypes.find(s => s.key === e.target.value);
                          updateZone(zone.id, { target: e.target.value, label: zone.label || t?.label || '' });
                        }}
                        style={{ padding: '4px 6px', border: '1px solid #e0d9ce', borderRadius: 4, fontSize: 11, minWidth: 100 }}
                      >
                        <option value="">— Target —</option>
                        {screenTypes.map(st => (
                          <option key={st.key} value={st.key}>{st.icon} {st.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        onClick={() => handleIconUpload(zone.id)}
                        style={{
                          padding: '3px 8px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
                          borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#7ab3d4',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <Upload size={10} /> {zone.icon_url ? 'Replace Icon' : 'Upload Icon'}
                      </button>
                      {zone.icon_url && (
                        <img src={zone.icon_url} alt="icon" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', border: '1px solid #eee' }} />
                      )}
                      <span style={{ fontSize: 9, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                        {Math.round(zone.x)}%, {Math.round(zone.y)}% — {Math.round(zone.w)}x{Math.round(zone.h)}
                      </span>
                    </div>
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
