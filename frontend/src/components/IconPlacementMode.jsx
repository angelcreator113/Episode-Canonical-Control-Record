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
import { Grid3x3, Save, Trash2, X, Pin } from 'lucide-react';
import PhoneFrame from './phone/PhoneFrame';
import ScreenContentRenderer from './ScreenContentRenderer';

const HOME_GRID = {
  columns: 4,
  originX: 8,
  originY: 14,
  stepX: 21,
  stepY: 14,
  width: 12,
  height: 9,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getGridSlot(index) {
  const col = index % HOME_GRID.columns;
  const row = Math.floor(index / HOME_GRID.columns);
  return {
    x: HOME_GRID.originX + (col * HOME_GRID.stepX),
    y: HOME_GRID.originY + (row * HOME_GRID.stepY),
  };
}

function snapZoneToGrid(zone) {
  const col = Math.round((zone.x - HOME_GRID.originX) / HOME_GRID.stepX);
  const row = Math.round((zone.y - HOME_GRID.originY) / HOME_GRID.stepY);
  const maxCol = HOME_GRID.columns - 1;
  const maxRow = 5;
  return {
    ...zone,
    x: clamp(HOME_GRID.originX + (clamp(col, 0, maxCol) * HOME_GRID.stepX), 0, 100 - zone.w),
    y: clamp(HOME_GRID.originY + (clamp(row, 0, maxRow) * HOME_GRID.stepY), 0, 100 - zone.h),
  };
}

function normalizeIconZone(zone, index) {
  const slot = getGridSlot(index);
  return {
    ...zone,
    w: HOME_GRID.width,
    h: HOME_GRID.height,
    x: clamp(slot.x, 0, 100 - HOME_GRID.width),
    y: clamp(slot.y, 0, 100 - HOME_GRID.height),
  };
}

export default function IconPlacementMode({
  links = [],
  iconOverlays = [],
  onSave,
  screenTypes = [],
  generatedScreenKeys,
  screenUrl,
  phoneSkin = 'rosegold',
  customFrameUrl,
  // Read-only context: existing content zones to render behind the icon
  // placement layer so creators see where wardrobe grids / feeds /
  // world map sit. Mirror of the screen-link ghosts in ContentZoneEditor.
  contentZones = [],
  showId,
}) {
  const [zones, setZones] = useState(links);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [pendingPos, setPendingPos] = useState(null);
  // Target chosen in the picker popup so placement and linking happen in
  // one step. Persists across picker opens within a session so placing a
  // row of icons into the same screen doesn't require re-selecting it.
  const [pendingTarget, setPendingTarget] = useState('');
  const [dragging, setDragging] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [gridSnap, setGridSnap] = useState(() => {
    try {
      return localStorage.getItem('phone_hub_icon_grid_snap') !== '0';
    } catch {
      return true;
    }
  });
  const containerRef = useRef(null);

  // Sync when links prop changes (switching screens)
  useEffect(() => {
    setZones(links);
    setIsDirty(false);
    setSelectedId(null);
    setSelectedIds(new Set());
    setShowPicker(false);
  }, [links]);

  useEffect(() => {
    try {
      localStorage.setItem('phone_hub_icon_grid_snap', gridSnap ? '1' : '0');
    } catch {}
  }, [gridSnap]);

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
    setSelectedIds(new Set());
  };

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

  const selectSingle = useCallback((id) => {
    setSelectedId(id);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelected = useCallback((id) => {
    setSelectedId(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
  }, []);

  const handleZoneClick = useCallback((e, id) => {
    e.stopPropagation();
    setShowPicker(false);
    if (multiSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
      toggleSelected(id);
      return;
    }
    selectSingle(id);
  }, [multiSelectMode, selectSingle, toggleSelected]);

  // Pick icon from grid → place at pending position, with the target chosen
  // in the same popup so placement and linking are one action instead of two.
  const handlePickIcon = (ico) => {
    if (!pendingPos) return;
    const nextIndex = zones.length;
    const placedZone = normalizeIconZone({
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: pendingPos.x - (HOME_GRID.width / 2),
      y: pendingPos.y - (HOME_GRID.height / 2),
      w: HOME_GRID.width,
      h: HOME_GRID.height,
      target: pendingTarget || '',
      label: (ico.name || '').replace(/\s*Icon$/i, ''),
      icon_url: ico.url,
      icon_overlay_id: ico.id,
    }, nextIndex);
    const newZone = gridSnap ? placedZone : { ...placedZone, x: clamp(placedZone.x, 0, 100 - placedZone.w), y: clamp(placedZone.y, 0, 100 - placedZone.h) };
    setZones(prev => [...prev, newZone]);
    setSelectedId(newZone.id);
    setSelectedIds(new Set([newZone.id]));
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
    const activeIds = isSelected(zone.id) ? Array.from(selectedIds) : [zone.id];
    const originById = Object.fromEntries(
      zones
        .filter(z => activeIds.includes(z.id))
        .map(z => [z.id, { x: z.x, y: z.y }])
    );
    setDragging({ ids: activeIds, startX: pos.x, startY: pos.y, originById });
    if (!isSelected(zone.id)) selectSingle(zone.id);
  };

  const handleDragMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    const deltaX = pos.x - dragging.startX;
    const deltaY = pos.y - dragging.startY;
    setZones(prev => prev.map(z => {
      if (!dragging.ids.includes(z.id)) return z;
      const origin = dragging.originById[z.id];
      return {
        ...z,
        x: Math.max(0, Math.min(100 - z.w, origin.x + deltaX)),
        y: Math.max(0, Math.min(100 - z.h, origin.y + deltaY)),
      };
    }));
    setIsDirty(true);
  };

  const handleDragEnd = (e) => {
    if (e?.target?.releasePointerCapture && e?.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    if (dragging && gridSnap) {
      setZones(prev => prev.map(z => dragging.ids.includes(z.id) ? snapZoneToGrid(z) : z));
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
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  };

  const removeSelected = () => {
    if (!selectedIds.size) return;
    setZones(prev => prev.filter(z => !selectedIds.has(z.id)));
    clearSelection();
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onSave) onSave(zones);
    setIsDirty(false);
  };

  const handleAutoLayout = () => {
    setZones(prev => prev.map((zone, index) => normalizeIconZone(zone, index)));
    setIsDirty(true);
  };

  const applyToSelected = (updater) => {
    if (!selectedIds.size) return;
    setZones(prev => updater(prev));
    setIsDirty(true);
  };

  const handleMakeRow = () => {
    const selectedZones = zones.filter(zone => selectedIds.has(zone.id)).sort((a, b) => a.x - b.x);
    if (selectedZones.length < 2) return;
    const averageY = selectedZones.reduce((sum, zone) => sum + zone.y, 0) / selectedZones.length;
    const startX = clamp(Math.min(...selectedZones.map(zone => zone.x)), 0, 100 - HOME_GRID.width);
    const updates = new Map(selectedZones.map((zone, index) => [zone.id, {
      x: clamp(startX + (index * HOME_GRID.stepX), 0, 100 - zone.w),
      y: clamp(averageY, 0, 100 - zone.h),
    }]));
    applyToSelected(prev => prev.map(zone => selectedIds.has(zone.id) ? { ...zone, ...updates.get(zone.id) } : zone));
  };

  const handleMakeColumn = () => {
    const selectedZones = zones.filter(zone => selectedIds.has(zone.id)).sort((a, b) => a.y - b.y);
    if (selectedZones.length < 2) return;
    const averageX = selectedZones.reduce((sum, zone) => sum + zone.x, 0) / selectedZones.length;
    const startY = clamp(Math.min(...selectedZones.map(zone => zone.y)), 0, 100 - HOME_GRID.height);
    const updates = new Map(selectedZones.map((zone, index) => [zone.id, {
      x: clamp(averageX, 0, 100 - zone.w),
      y: clamp(startY + (index * HOME_GRID.stepY), 0, 100 - zone.h),
    }]));
    applyToSelected(prev => prev.map(zone => selectedIds.has(zone.id) ? { ...zone, ...updates.get(zone.id) } : zone));
  };

  const handleSnapSelected = () => {
    applyToSelected(prev => prev.map(zone => selectedIds.has(zone.id) ? snapZoneToGrid(zone) : zone));
  };

  const selected = selectedId ? zones.find(z => z.id === selectedId) : null;
  const selectionCount = selectedIds.size;
  const showBatchActions = selectionCount > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Instructions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#888', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: '4px 0' }}>
          Tap the screen to place an icon. Drag to move.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setMultiSelectMode(v => !v);
              if (multiSelectMode) clearSelection();
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', fontSize: 11, fontWeight: 700,
              border: `1px solid ${multiSelectMode ? '#B8962E' : '#e8e0d0'}`,
              borderRadius: 8,
              background: multiSelectMode ? '#fdf8ee' : '#fff',
              color: multiSelectMode ? '#B8962E' : '#6B6557',
              cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
              minHeight: 36,
            }}
          >
            <Grid3x3 size={13} /> {multiSelectMode ? 'Multi Select On' : 'Multi Select'}
          </button>
          <button
            type="button"
            onClick={() => setGridSnap(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', fontSize: 11, fontWeight: 700,
              border: `1px solid ${gridSnap ? '#B8962E' : '#e8e0d0'}`,
              borderRadius: 8,
              background: gridSnap ? '#fdf8ee' : '#fff',
              color: gridSnap ? '#B8962E' : '#6B6557',
              cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
              minHeight: 36,
            }}
          >
            <Grid3x3 size={13} /> {gridSnap ? 'Snap On' : 'Snap Off'}
          </button>
          <button
            type="button"
            onClick={handleAutoLayout}
            disabled={zones.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', fontSize: 11, fontWeight: 700,
              border: '1px solid #e8e0d0',
              borderRadius: 8,
              background: '#fff',
              color: zones.length === 0 ? '#b8b1a5' : '#6B6557',
              cursor: zones.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Mono', monospace",
              minHeight: 36,
            }}
          >
            <Grid3x3 size={13} /> Auto Layout
          </button>
        </div>
      </div>

      {/* Phone screen overlay — icons are placed directly inside shared phone chrome. */}
      <div style={{ width: '100%', maxWidth: 300, margin: '0 auto' }}>
      <PhoneFrame skin={phoneSkin} customFrameUrl={customFrameUrl}>
      <div
        ref={containerRef}
        onClick={handleTap}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          background: 'rgba(0,0,0,0.02)',
          cursor: 'crosshair',
        }}
      >
        {screenUrl ? (
          <img
            src={screenUrl}
            alt="Screen"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
              zIndex: 0,
            }}
            draggable={false}
          />
        ) : null}
        {/* Read-only preview of the screen's content zones. Sits between
            the screen image and the icon-placement layer so creators see
            wardrobe grids / feeds / world map and don't drop icons over
            them. Mirror of the symmetric preview in ScreenLinkEditor. */}
        {contentZones.length > 0 && (
          <ScreenContentRenderer
            zones={contentZones}
            showId={showId}
            interactive={false}
          />
        )}
        {gridSnap && (
          <>
            {Array.from({ length: 24 }).map((_, index) => {
              const slot = getGridSlot(index);
              return (
                <div
                  key={`grid-${index}`}
                  style={{
                    position: 'absolute',
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${HOME_GRID.width}%`,
                    height: `${HOME_GRID.height}%`,
                    border: '1px dashed rgba(184, 150, 46, 0.18)',
                    borderRadius: 8,
                    background: 'rgba(184, 150, 46, 0.03)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Placed icons */}
        {zones.map(zone => (
          <div
            key={zone.id}
            data-icon-id={zone.id}
            onPointerDown={(e) => handleDragStart(e, zone)}
            onClick={(e) => handleZoneClick(e, zone.id)}
            style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              width: `${zone.w}%`, height: `${zone.h}%`,
              cursor: dragging?.id === zone.id ? 'grabbing' : 'grab',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              border: isSelected(zone.id) ? '2px solid #B8962E' : '1px solid transparent',
              background: isSelected(zone.id) ? 'rgba(184,150,46,0.1)' : 'transparent',
              transition: isSelected(zone.id) ? 'none' : 'border-color 0.15s',
              zIndex: dragging?.ids?.includes(zone.id) ? 10 : 2,
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
            {selectedId === zone.id && !showBatchActions && (
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
      </PhoneFrame>
      </div>

      {/* Icon picker — shows when tapping the screen. Surfaces both the icon
          grid and a target-screen dropdown so placement and linking are a
          single action. Target is optional and can be changed later from
          the selected-icon panel below. */}
      {showPicker && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              PICK AN ICON + WHERE IT OPENS
            </span>
            <button onClick={() => { setShowPicker(false); setPendingPos(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em', marginBottom: 4, textTransform: 'uppercase' }}>
              Opens screen
            </label>
            <select
              value={pendingTarget}
              onChange={(e) => setPendingTarget(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, background: '#fff' }}
            >
              <option value="">— No target (set later) —</option>
              {screenTypes.map(st => (
                <option key={st.key} value={st.key}>
                  {st.icon} {st.label}{generatedScreenKeys?.has(st.key) ? ' ✓' : ''}
                </option>
              ))}
            </select>
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

      {showBatchActions && !showPicker && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              {selectionCount} ICONS SELECTED
            </span>
            <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4, display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <button onClick={handleMakeRow} style={batchBtnStyle}>Make Row</button>
            <button onClick={handleMakeColumn} style={batchBtnStyle}>Make Column</button>
            <button onClick={handleSnapSelected} style={batchBtnStyle}>Snap Selected</button>
            <button onClick={removeSelected} style={{ ...batchBtnStyle, color: '#B84D2E', borderColor: '#f3c5b8' }}>Delete Selected</button>
          </div>
          <div style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
            Ctrl/Cmd-click icons, or turn on Multi Select, then drag a selected icon to move the whole group.
          </div>
        </div>
      )}

      {/* Selected icon controls */}
      {selected && !showPicker && !showBatchActions && (
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

          {gridSnap && (
            <button
              type="button"
              onClick={() => updateZone(selected.id, snapZoneToGrid(selected))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '8px 12px', fontSize: 12, fontWeight: 600,
                border: '1px solid #e0d9ce', borderRadius: 6,
                background: '#fff', color: '#6B6557', cursor: 'pointer', minHeight: 36,
              }}
            >
              <Grid3x3 size={12} /> Snap this icon to grid
            </button>
          )}

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

const batchBtnStyle = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  border: '1px solid #e8e0d0',
  borderRadius: 8,
  background: '#fff',
  color: '#6B6557',
  cursor: 'pointer',
  fontFamily: "'DM Mono', monospace",
  minHeight: 36,
};
