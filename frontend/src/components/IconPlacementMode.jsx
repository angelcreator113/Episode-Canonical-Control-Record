/**
 * IconPlacementMode — Place and arrange icons directly on the phone screen.
 *
 * Replaces the old draw-on-preview ScreenLinkEditor for icon placement.
 * Users tap the phone screen to place icons, drag to reposition, and
 * resize with controls. Icons are stored as screen_links on the overlay.
 *
 * Props:
 *   links            — current screen_links array
 *   iconOverlays     — available icon overlays to place
 *   onSave(links)    — callback to persist
 *   screenTypes      — for target picker
 *   generatedScreenKeys — set of screen keys that have images
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, X, Pin, Move } from 'lucide-react';

export default function IconPlacementMode({ links = [], iconOverlays = [], onSave, screenTypes = [], generatedScreenKeys }) {
  const [zones, setZones] = useState(links);
  const [selectedId, setSelectedId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingPos, setPendingPos] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const containerRef = useRef(null);

  // Sync when links prop changes (switching screens)
  useEffect(() => {
    setZones(links);
    setIsDirty(false);
    setSelectedId(null);
    setShowPicker(false);
  }, [links]);

  const getRelativePos = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  // Tap empty area → open icon picker at that position
  const handleTap = (e) => {
    if (dragging) return;
    if (e.target.closest('[data-icon-id]')) return;
    const pos = getRelativePos(e);
    setPendingPos(pos);
    setShowPicker(true);
    setSelectedId(null);
  };

  // Pick icon from grid → place at pending position
  const handlePickIcon = (ico) => {
    if (!pendingPos) return;
    const newZone = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: pendingPos.x - 5, // center the 10% default size
      y: pendingPos.y - 5,
      w: 10,
      h: 8,
      target: '',
      label: (ico.name || '').replace(/\s*Icon$/i, ''),
      icon_url: ico.url,
      icon_overlay_id: ico.id,
    };
    setZones(prev => [...prev, newZone]);
    setSelectedId(newZone.id);
    setShowPicker(false);
    setPendingPos(null);
    setIsDirty(true);
  };

  // Drag to reposition
  const handleDragStart = (e, zone) => {
    e.stopPropagation();
    e.preventDefault();
    if (containerRef.current?.setPointerCapture) {
      try { containerRef.current.setPointerCapture(e.pointerId); } catch {}
    }
    const pos = getRelativePos(e);
    setDragging({ id: zone.id, startX: pos.x, startY: pos.y, origX: zone.x, origY: zone.y });
    setSelectedId(zone.id);
  };

  const handleDragMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    setZones(prev => prev.map(z => z.id === dragging.id ? {
      ...z,
      x: Math.max(0, Math.min(100 - z.w, dragging.origX + (pos.x - dragging.startX))),
      y: Math.max(0, Math.min(100 - z.h, dragging.origY + (pos.y - dragging.startY))),
    } : z));
    setIsDirty(true);
  };

  const handleDragEnd = (e) => {
    if (e?.target?.releasePointerCapture && e?.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    setDragging(null);
  };

  const updateZone = (id, changes) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...changes } : z));
    setIsDirty(true);
  };

  const removeZone = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedId === id) setSelectedId(null);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onSave) onSave(zones);
    setIsDirty(false);
  };

  const selected = selectedId ? zones.find(z => z.id === selectedId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Instructions */}
      <div style={{ fontSize: 12, color: '#888', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: '4px 0' }}>
        Tap the screen to place an icon. Drag to move.
      </div>

      {/* Phone screen overlay — icons are placed directly here */}
      <div
        ref={containerRef}
        onClick={handleTap}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        style={{
          position: 'relative',
          width: '100%', maxWidth: 340,
          margin: '0 auto',
          aspectRatio: '9/19.5',
          borderRadius: 16,
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          border: '2px dashed #B8962E40',
          background: 'rgba(0,0,0,0.02)',
          cursor: 'crosshair',
        }}
      >
        {/* Placed icons */}
        {zones.map(zone => (
          <div
            key={zone.id}
            data-icon-id={zone.id}
            onPointerDown={(e) => handleDragStart(e, zone)}
            onClick={(e) => { e.stopPropagation(); setSelectedId(zone.id); setShowPicker(false); }}
            style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              width: `${zone.w}%`, height: `${zone.h}%`,
              cursor: dragging?.id === zone.id ? 'grabbing' : 'grab',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              border: selectedId === zone.id ? '2px solid #B8962E' : '1px solid transparent',
              background: selectedId === zone.id ? 'rgba(184,150,46,0.1)' : 'transparent',
              transition: selectedId === zone.id ? 'none' : 'border-color 0.15s',
              zIndex: dragging?.id === zone.id ? 10 : 2,
            }}
          >
            {zone.icon_url ? (
              <img src={zone.icon_url} alt={zone.label || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(184,150,46,0.15)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#B8962E' }}>
                {zone.label || '?'}
              </div>
            )}
            {/* Delete button on selected */}
            {selectedId === zone.id && (
              <button
                onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}
                style={{
                  position: 'absolute', top: -8, right: -8,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#dc2626', border: '2px solid #fff', color: '#fff',
                  fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 11,
                }}
              >×</button>
            )}
          </div>
        ))}

        {/* Tap position indicator */}
        {pendingPos && showPicker && (
          <div style={{
            position: 'absolute',
            left: `${pendingPos.x}%`, top: `${pendingPos.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #B8962E',
            background: 'rgba(184,150,46,0.2)',
            pointerEvents: 'none', zIndex: 5,
          }} />
        )}
      </div>

      {/* Icon picker — shows when tapping the screen */}
      {showPicker && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              PICK AN ICON
            </span>
            <button onClick={() => { setShowPicker(false); setPendingPos(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          {iconOverlays.length > 0 ? (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
              gap: 6, maxHeight: 180, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}>
              {iconOverlays.map(ico => (
                <button
                  key={ico.id}
                  onClick={() => handlePickIcon(ico)}
                  title={ico.name}
                  style={{
                    width: '100%', aspectRatio: '1/1', borderRadius: 8,
                    border: '1px solid #e0d9ce', background: '#fff',
                    cursor: 'pointer', padding: 4,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}
                >
                  <img src={ico.url} alt={ico.name} style={{ width: '100%', flex: 1, objectFit: 'contain', borderRadius: 4 }} draggable={false} />
                  <span style={{ fontSize: 7, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', lineHeight: 1 }}>
                    {(ico.name || '').replace(/\s*Icon$/i, '')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#999', padding: '12px 0', textAlign: 'center' }}>
              No icon overlays uploaded yet. Create icons first.
            </div>
          )}
        </div>
      )}

      {/* Selected icon controls */}
      {selected && !showPicker && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selected.icon_url && <img src={selected.icon_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', border: '1px solid #eee' }} />}
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{selected.label || 'Untitled'}</span>
            <button onClick={() => removeZone(selected.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
              <Trash2 size={16} />
            </button>
          </div>

          {/* Label + Target */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              value={selected.label || ''}
              onChange={(e) => updateZone(selected.id, { label: e.target.value })}
              placeholder="Label"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 100 }}
            />
            <select
              value={selected.target || ''}
              onChange={(e) => updateZone(selected.id, { target: e.target.value })}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 100 }}
            >
              <option value="">— Target —</option>
              {screenTypes.map(st => (
                <option key={st.key} value={st.key}>
                  {st.icon} {st.label}{generatedScreenKeys?.has(st.key) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>Width</span>
                <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(selected.w)}%</span>
              </div>
              <input type="range" min={3} max={30} value={Math.round(selected.w)} onChange={e => updateZone(selected.id, { w: parseInt(e.target.value) })}
                style={{ width: '100%', height: 4, cursor: 'pointer' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>Height</span>
                <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(selected.h)}%</span>
              </div>
              <input type="range" min={3} max={30} value={Math.round(selected.h)} onChange={e => updateZone(selected.id, { h: parseInt(e.target.value) })}
                style={{ width: '100%', height: 4, cursor: 'pointer' }} />
            </div>
          </div>

          {/* Pin toggle */}
          <button
            onClick={() => updateZone(selected.id, { persistent: !selected.persistent })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              padding: '8px 12px', fontSize: 12, fontWeight: 600,
              border: `1px solid ${selected.persistent ? '#B8962E' : '#e0d9ce'}`,
              borderRadius: 6, cursor: 'pointer', minHeight: 36,
              background: selected.persistent ? '#fdf8ee' : '#fff',
              color: selected.persistent ? '#B8962E' : '#888',
            }}
          >
            <Pin size={12} /> {selected.persistent ? 'Pinned — shows on all screens' : 'Pin to all screens'}
          </button>
        </div>
      )}

      {/* Save button */}
      {isDirty && (
        <button
          onClick={handleSave}
          style={{
            padding: '12px 16px', fontSize: 14, fontWeight: 600, border: 'none',
            borderRadius: 8, background: '#B8962E', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
            width: '100%',
          }}
        >
          <Save size={16} /> Save Icon Placement
        </button>
      )}

      {/* Summary */}
      <div style={{ fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace", textAlign: 'center' }}>
        {zones.length} icon{zones.length !== 1 ? 's' : ''} placed
      </div>
    </div>
  );
}
