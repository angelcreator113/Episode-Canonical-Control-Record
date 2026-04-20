/**
 * ContentZoneEditor — Draw content zones on a screen template and bind live data.
 *
 * Similar to ScreenLinkEditor but for data rendering instead of navigation.
 * Users draw rectangles on the screen image, then assign a content type and
 * configuration (which profile, how many posts, etc.) to each zone.
 *
 * Props:
 *   screenUrl         — URL of the screen template image
 *   zones             — array of { id, x, y, w, h, content_type, content_config }
 *   showId            — current show ID (for profile/data pickers)
 *   onSave(zones)     — callback to persist updated zones
 *   readOnly          — if true, hide editing controls
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, X, Layers, Eye, EyeOff } from 'lucide-react';
import { CONTENT_TYPES, CONTENT_TYPE_MAP } from './ScreenContentRenderer';
import ConditionRow from './phone-editor/ConditionRow';
import api from '../services/api';

const ZONE_COLORS = ['#e8a0b4', '#b8a9d4', '#7ab3d4', '#a8d5a2', '#c9a84c', '#6bba9a', '#e06060', '#b89060'];

export default function ContentZoneEditor({ screenUrl, zones = [], showId, onSave, onAiFillZone, readOnly = false, compact = false }) {
  const [localZones, setLocalZones] = useState(zones);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => { setLocalZones(zones); setIsDirty(false); }, [zones]);

  // Load social profiles for picker dropdowns
  useEffect(() => {
    if (!showId) return;
    setProfilesLoading(true);
    api.get(`/api/v1/social-profiles?show_id=${showId}`)
      .then(r => setProfiles(r.data?.data || r.data?.profiles || []))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [showId]);

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

  // Drawing — works for mouse and touch via pointer capture
  const handlePointerDown = (e) => {
    if (readOnly) return;
    if (e.target.closest('[data-zone-id]')) return;
    e.preventDefault();
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
    if (!drawing) return;
    e.preventDefault();
    setDrawCurrent(getRelativePos(e));
  };

  const handlePointerUp = (e) => {
    if (e?.target?.releasePointerCapture && e?.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    if (!drawing || !drawStart || !drawCurrent) { setDrawing(false); return; }
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    if (w > 3 && h > 3) {
      const newZone = {
        id: `cz-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
        content_type: '',
        content_config: {},
      };
      setLocalZones(prev => [...prev, newZone]);
      setSelectedZone(newZone.id);
      setIsDirty(true);
    }

    setDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const updateZone = (id, changes) => {
    setLocalZones(prev => prev.map(z => z.id === id ? { ...z, ...changes } : z));
    setIsDirty(true);
  };

  const removeZone = (id) => {
    setLocalZones(prev => prev.filter(z => z.id !== id));
    if (selectedZone === id) setSelectedZone(null);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onSave) onSave(localZones);
    setIsDirty(false);
  };

  const drawRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const sel = selectedZone ? localZones.find(z => z.id === selectedZone) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Screen with content zones */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!drawing) return; }}
        style={{
          position: 'relative',
          width: '100%', maxWidth: compact ? 240 : 320,
          margin: '0 auto',
          touchAction: 'none',
          aspectRatio: '9/16',
          borderRadius: 12, overflow: 'hidden',
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

        {/* Existing content zones */}
        {localZones.map((zone, i) => {
          const typeMeta = CONTENT_TYPE_MAP[zone.content_type];
          return (
            <div
              key={zone.id}
              data-zone-id={zone.id}
              onClick={(e) => { e.stopPropagation(); setSelectedZone(zone.id); }}
              style={{
                position: 'absolute',
                left: `${zone.x}%`, top: `${zone.y}%`,
                width: `${zone.w}%`, height: `${zone.h}%`,
                border: `2px ${zone.content_type ? 'solid' : 'dashed'} ${selectedZone === zone.id ? '#B8962E' : ZONE_COLORS[i % ZONE_COLORS.length]}`,
                borderRadius: 4,
                background: selectedZone === zone.id ? 'rgba(184,150,46,0.15)' : 'rgba(255,255,255,0.05)',
                cursor: readOnly ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 7, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: 2, lineHeight: 1.2 }}>
                {typeMeta ? `${typeMeta.icon} ${typeMeta.label}` : zone.content_type || '?'}
              </span>
            </div>
          );
        })}

        {/* Drawing preview */}
        {drawRect && drawRect.w > 1 && drawRect.h > 1 && (
          <div style={{
            position: 'absolute',
            left: `${drawRect.x}%`, top: `${drawRect.y}%`,
            width: `${drawRect.w}%`, height: `${drawRect.h}%`,
            border: '2px dashed #B8962E',
            borderRadius: 4,
            background: 'rgba(184,150,46,0.1)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Zone list + config editor */}
      {!readOnly && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
              CONTENT ZONES ({localZones.length})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {isDirty && (
                <button onClick={handleSave} style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none',
                  borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, minHeight: 36,
                }}>
                  <Save size={12} /> Save
                </button>
              )}
            </div>
          </div>

          {localZones.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '12px 0', lineHeight: 1.6 }}>
              Draw rectangles on the screen to create content zones. Each zone renders live show data (posts, profiles, DMs, etc.) on top of your template.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'min(360px, 35vh)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {localZones.map((zone, i) => {
              const typeMeta = CONTENT_TYPE_MAP[zone.content_type];
              const isSelected = selectedZone === zone.id;
              return (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  style={{
                    padding: '10px 12px',
                    background: isSelected ? '#fdf8ee' : '#fff',
                    border: `1px solid ${isSelected ? '#B8962E' : '#eee'}`,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {/* Zone header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isSelected ? 8 : 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[i % ZONE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeMeta ? `${typeMeta.icon} ${typeMeta.label}` : zone.content_type || 'Unassigned'}
                    </span>
                    <span style={{ fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                      {Math.round(zone.x)}%,{Math.round(zone.y)}%
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Expanded config for selected zone */}
                  {isSelected && (
                    <ZoneConfigPanel
                      zone={zone}
                      profiles={profiles}
                      profilesLoading={profilesLoading}
                      onUpdate={(changes) => updateZone(zone.id, changes)}
                      onAiFillZone={onAiFillZone}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Zone configuration panel — type picker + type-specific config fields ──
function ZoneConfigPanel({ zone, profiles, profilesLoading, onUpdate, onAiFillZone }) {
  const config = zone.content_config || {};
  // Inline AI proposal — keyed per-zone so each zone has its own review surface.
  const [aiProposal, setAiProposal] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const runAiFill = async () => {
    if (!onAiFillZone || !zone.id || aiBusy) return;
    setAiBusy(true);
    try {
      const data = await onAiFillZone(zone.id);
      if (data?.proposal?.content_config) setAiProposal(data.proposal);
    } finally {
      setAiBusy(false);
    }
  };

  const handleTypeChange = (content_type) => {
    onUpdate({ content_type, content_config: {} });
  };

  const handleConfigChange = (key, value) => {
    onUpdate({ content_config: { ...config, [key]: value } });
  };

  // Group content types for the picker
  const groups = {};
  for (const ct of CONTENT_TYPES) {
    if (!groups[ct.group]) groups[ct.group] = [];
    groups[ct.group].push(ct);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid #f0ece4' }}>
      {/* AI fill — proposes a content_config based on show context. Inline review:
          preview the proposal, Apply → merge into content_config, Discard → clear. */}
      {onAiFillZone && zone.content_type && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: '#fdf8ee', border: '1px solid #e6d9b8', borderRadius: 8 }}>
          {!aiProposal && (
            <button
              onClick={(e) => { e.stopPropagation(); runAiFill(); }}
              disabled={aiBusy}
              title="Let AI propose a content config based on the show's characters + recent beats"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', fontSize: 11, fontWeight: 700,
                border: 'none', borderRadius: 6,
                background: aiBusy ? '#e0d9ce' : '#B8962E', color: '#fff',
                cursor: aiBusy ? 'wait' : 'pointer',
                fontFamily: "'DM Mono', monospace", letterSpacing: 0.3,
                alignSelf: 'flex-start',
              }}
            >
              {aiBusy ? '✨ Thinking…' : '✨ AI fill'}
            </button>
          )}
          {aiProposal && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                AI PROPOSAL
              </div>
              {aiProposal.content_preview && (
                <div style={{ fontSize: 12, color: '#6b5a28', lineHeight: 1.45, fontFamily: "'Lora', serif" }}>
                  {aiProposal.content_preview}
                </div>
              )}
              <pre style={{ fontSize: 10, color: '#6b5a28', fontFamily: "'DM Mono', monospace", margin: 0, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', background: '#fff', padding: 6, borderRadius: 4, border: '1px solid #e6d9b8' }}>
                {JSON.stringify(aiProposal.content_config, null, 2)}
              </pre>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setAiProposal(null); }}
                  style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#666', fontFamily: "'DM Mono', monospace" }}
                >Discard</button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ content_config: { ...(zone.content_config || {}), ...aiProposal.content_config } });
                    setAiProposal(null);
                  }}
                  style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 5, background: '#B8962E', color: '#fff', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
                >Apply</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Content type picker */}
      <div>
        <label style={labelStyle}>
          CONTENT TYPE
        </label>
        <select
          value={zone.content_type || ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          style={fieldStyle}
        >
          <option value="">— Select type —</option>
          {Object.entries(groups).map(([group, types]) => (
            <optgroup key={group} label={group.charAt(0).toUpperCase() + group.slice(1)}>
              {types.map(ct => (
                <option key={ct.key} value={ct.key}>{ct.icon} {ct.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Type-specific config fields */}
      {zone.content_type && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Profile picker — for profile_header, profile_stats */}
          {['profile_header', 'profile_stats'].includes(zone.content_type) && (
            <div>
              <label style={labelStyle}>PROFILE</label>
              {profilesLoading ? (
                <div style={{ fontSize: 10, color: '#999', padding: '6px 0', fontFamily: "'DM Mono', monospace" }}>Loading profiles...</div>
              ) : profiles.length === 0 ? (
                <div style={{ fontSize: 10, color: '#b45309', padding: '6px 0' }}>No social profiles found for this show</div>
              ) : (
                <select
                  value={config.profile_id || ''}
                  onChange={(e) => handleConfigChange('profile_id', e.target.value ? parseInt(e.target.value) : null)}
                  style={fieldStyle}
                >
                  <option value="">— Select profile —</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>@{p.handle} — {p.display_name || p.creator_name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Max items — for lists (feed, DMs, notifications, comments, stories, wardrobe) */}
          {['feed_posts', 'dm_thread', 'notifications', 'comments_list', 'story_ring', 'wardrobe_grid'].includes(zone.content_type) && (
            <div>
              <label style={labelStyle}>MAX ITEMS</label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.max_items || ''}
                onChange={(e) => handleConfigChange('max_items', parseInt(e.target.value) || undefined)}
                placeholder="e.g. 5"
                style={fieldStyle}
              />
            </div>
          )}

          {/* Grid columns — for wardrobe grid */}
          {zone.content_type === 'wardrobe_grid' && (
            <div>
              <label style={labelStyle}>COLUMNS</label>
              <input
                type="number"
                min={2}
                max={5}
                value={config.columns || ''}
                onChange={(e) => handleConfigChange('columns', parseInt(e.target.value) || undefined)}
                placeholder="3"
                style={fieldStyle}
              />
            </div>
          )}

          {/* Outfit index — for outfit card */}
          {zone.content_type === 'outfit_card' && (
            <div>
              <label style={labelStyle}>OUTFIT # (0-based)</label>
              <input
                type="number"
                min={0}
                value={config.outfit_index ?? ''}
                onChange={(e) => handleConfigChange('outfit_index', parseInt(e.target.value) || 0)}
                placeholder="0"
                style={fieldStyle}
              />
            </div>
          )}

          {/* Wardrobe price — currency + font styling. Values come from the
              screen's asset metadata, so there's no data source to pick. */}
          {zone.content_type === 'wardrobe_price' && (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>CURRENCY</label>
                  <select
                    value={config.currency || 'USD'}
                    onChange={(e) => handleConfigChange('currency', e.target.value)}
                    style={fieldStyle}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>SIZE</label>
                  <input
                    type="number"
                    min={6}
                    max={32}
                    value={config.font_size || ''}
                    onChange={(e) => handleConfigChange('font_size', parseInt(e.target.value) || undefined)}
                    placeholder="14"
                    style={fieldStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>COLOR</label>
                  <input
                    type="color"
                    value={config.color || '#ffffff'}
                    onChange={(e) => handleConfigChange('color', e.target.value)}
                    style={{ ...fieldStyle, padding: 2, height: 28 }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Wardrobe brand — font styling only. Brand text comes from asset metadata. */}
          {zone.content_type === 'wardrobe_brand' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>SIZE</label>
                <input
                  type="number"
                  min={6}
                  max={24}
                  value={config.font_size || ''}
                  onChange={(e) => handleConfigChange('font_size', parseInt(e.target.value) || undefined)}
                  placeholder="11"
                  style={fieldStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>COLOR</label>
                <input
                  type="color"
                  value={config.color || '#ffffff'}
                  onChange={(e) => handleConfigChange('color', e.target.value)}
                  style={{ ...fieldStyle, padding: 2, height: 28 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>CASE</label>
                <select
                  value={config.uppercase === false ? 'mixed' : 'upper'}
                  onChange={(e) => handleConfigChange('uppercase', e.target.value === 'upper')}
                  style={fieldStyle}
                >
                  <option value="upper">UPPER</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          )}

          {/* Custom text config */}
          {zone.content_type === 'custom_text' && (
            <>
              <div>
                <label style={labelStyle}>TEXT</label>
                <input
                  value={config.text || ''}
                  onChange={(e) => handleConfigChange('text', e.target.value)}
                  placeholder="Enter text..."
                  style={fieldStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>SIZE</label>
                  <input
                    type="number"
                    min={4}
                    max={24}
                    value={config.font_size || ''}
                    onChange={(e) => handleConfigChange('font_size', parseInt(e.target.value) || undefined)}
                    placeholder="8"
                    style={fieldStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>COLOR</label>
                  <input
                    type="color"
                    value={config.color || '#ffffff'}
                    onChange={(e) => handleConfigChange('color', e.target.value)}
                    style={{ ...fieldStyle, padding: 2, height: 28 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>FONT</label>
                  <select
                    value={config.font || 'sans'}
                    onChange={(e) => handleConfigChange('font', e.target.value)}
                    style={fieldStyle}
                  >
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Mono</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Background color — for any zone */}
          <div>
            <label style={labelStyle}>ZONE BG (optional)</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="color"
                value={config.bg ? config.bg.replace(/rgba?\([^)]+\)/, '#000000') : '#000000'}
                onChange={(e) => handleConfigChange('bg', e.target.value + '80')}
                style={{ width: 28, height: 24, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', padding: 1 }}
              />
              <input
                value={config.bg || ''}
                onChange={(e) => handleConfigChange('bg', e.target.value)}
                placeholder="rgba(0,0,0,0.4)"
                style={{ ...fieldStyle, flex: 1 }}
              />
              {config.bg && (
                <button onClick={() => handleConfigChange('bg', undefined)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 10 }}>
                  <X size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visibility conditions — empty array means always visible (implicit default).
          Shares the exact schema used by tap zones, so the same evaluator gates both.
          Content items inside the zone are filtered separately per-renderer. */}
      <div style={{ borderTop: '1px dashed #f0ece4', paddingTop: 8, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={labelStyle}>
            VISIBLE WHEN {Array.isArray(zone.conditions) && zone.conditions.length > 0 ? `(${zone.conditions.length})` : '— always'}
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = [...(zone.conditions || []), { key: '', op: 'eq', value: true }];
              onUpdate({ conditions: next });
            }}
            style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#666', fontFamily: "'DM Mono', monospace" }}
          >+ condition</button>
        </div>
        {(zone.conditions || []).map((cond, ci) => (
          <ConditionRow
            key={ci}
            condition={cond}
            onChange={(nextCond) => {
              const next = [...(zone.conditions || [])];
              next[ci] = nextCond;
              onUpdate({ conditions: next });
            }}
            onRemove={() => {
              const next = (zone.conditions || []).filter((_, i) => i !== ci);
              onUpdate({ conditions: next.length ? next : undefined });
            }}
          />
        ))}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: '#888',
  fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
  letterSpacing: 0.5, display: 'block', marginBottom: 4,
};

const fieldStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #e0d9ce',
  borderRadius: 6, fontSize: 13, minHeight: 36, boxSizing: 'border-box',
};
