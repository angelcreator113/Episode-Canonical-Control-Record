import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { platformLabel, atHandle } from './feed/feedConstants';
import SuggestedPairs from '../components/SuggestedPairs/SuggestedPairs';
import RelationshipDrift from '../components/RelationshipDrift/RelationshipDrift';
import PairStoryline from '../components/SuggestedPairs/PairStoryline';

/* ── Pulse Relationship Map ──────────────────────────────────────────────────
 * SVG canvas showing influencer-to-influencer relationships.
 * Follows existing RelationshipEngine.jsx architecture:
 *   - Circular nodes, handle as label
 *   - Color ring = current feed_state
 *   - Line colors by type
 *   - Click node → show entangled characters
 * ────────────────────────────────────────────────────────────────────────── */

const STATE_RING = {
  rising:        '#22c55e',
  peaking:       '#eab308',
  plateauing:    '#9ca3af',
  controversial: '#f59e0b',
  cancelled:     '#ef4444',
  reinventing:   '#a855f7',
  gone_dark:     '#4b5563',
  posthumous:    '#d4789a',
};

// The 17 kinds of social_profile_relationships, the table The Pulse reads:
// since Task #3115 this map edits it, so a change here changes The Pulse.
// Keep in step with src/utils/relationshipKinds.js and the route's EDGE_STYLES.
const REL_TYPES = [
  { value: 'collab',         label: 'Collab',         stroke: '#22c55e', dash: null },
  { value: 'bestie',         label: 'Bestie',         stroke: '#16a34a', dash: null },
  { value: 'mentor',         label: 'Mentor',         stroke: '#3b82f6', dash: null },
  { value: 'management',     label: 'Management',     stroke: '#0ea5e9', dash: '2,4' },
  { value: 'family',         label: 'Family',         stroke: '#6366f1', dash: null },
  { value: 'couple',         label: 'Couple',         stroke: '#ec4899', dash: null },
  { value: 'situationship',  label: 'Situationship',  stroke: '#f472b6', dash: '4,4' },
  { value: 'ex',             label: 'Ex',             stroke: '#db2777', dash: '8,4' },
  { value: 'baby_daddy',     label: 'Baby daddy',     stroke: '#be185d', dash: null },
  { value: 'baby_mama',      label: 'Baby mama',      stroke: '#be185d', dash: null },
  { value: 'rival',          label: 'Rival',          stroke: '#f97316', dash: null },
  { value: 'feud',           label: 'Feud',           stroke: '#ef4444', dash: '6,4' },
  { value: 'shade',          label: 'Shade',          stroke: '#f59e0b', dash: '6,4' },
  { value: 'former_friends', label: 'Former friends', stroke: '#ef4444', dash: '8,4' },
  { value: 'copycat',        label: 'Copycat',        stroke: '#a855f7', dash: '4,4' },
  { value: 'secret_link',    label: 'Secret link',    stroke: '#9ca3af', dash: '2,4' },
  { value: 'orbit',          label: 'Orbit',          stroke: '#9ca3af', dash: null, arrow: true },
];

const EDGE_STYLES = Object.fromEntries(REL_TYPES.map((t) => [t.value, t]));

// The kinds a character can be caught in the middle of (src/utils/relationshipKinds.js CONFLICT_KINDS).
const CONFLICT_TYPES = ['feud', 'shade', 'former_friends'];

const NODE_R = 28;
const LEGEND_ITEMS = REL_TYPES.map((t) => ({ type: t.value, label: t.label, color: t.stroke, dash: Boolean(t.dash) }));

function simpleForceLayout(nodes, edges, width, height) {
  // Simple circular layout with force displacement
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const n = nodes.length;
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    node.x = cx + radius * Math.cos(angle);
    node.y = cy + radius * Math.sin(angle);
  });
  // Simple repulsion (2 passes)
  for (let iter = 0; iter < 30; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 80) {
          const force = (80 - dist) * 0.3;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[j].x += fx;
          nodes[j].y += fy;
          nodes[i].x -= fx;
          nodes[i].y -= fy;
        }
      }
    }
    // Pull toward edges
    for (const edge of edges) {
      const a = nodes.find(n => n.id === edge.source);
      const b = nodes.find(n => n.id === edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > 200) {
        const force = (dist - 200) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.x += fx; a.y += fy;
        b.x -= fx; b.y -= fy;
      }
    }
  }
  return nodes;
}

export default function FeedRelationshipMap() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entangled, setEntangled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [activeTypes, setActiveTypes] = useState(null); // null = all
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [ripplesMsg, setRipplesMsg] = useState(null);
  const [generatingRipples, setGeneratingRipples] = useState(false);
  // The relationship whose storyline seed is open (idea 4, PR 3).
  const [storylineFor, setStorylineFor] = useState(null);

  // Create state
  const [profiles, setProfiles] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [formA, setFormA] = useState('');
  const [formB, setFormB] = useState('');
  const [formType, setFormType] = useState('collab');
  const [createMsg, setCreateMsg] = useState(null);

  // The active show's Pulse closeness for each pair, read only (Task 3072).
  const { showId, loaded: showLoaded } = useActiveShow();

  const loadCanvas = useCallback(async () => {
    if (!showLoaded) return;
    try {
      const res = await api.get('/api/v1/feed-relationships/canvas', { params: showId ? { show_id: showId } : {} });
      const { nodes: rawNodes, edges: rawEdges } = res.data || {};
      if (rawNodes?.length) {
        simpleForceLayout(rawNodes, rawEdges || [], dimensions.w, dimensions.h);
      }
      setNodes(rawNodes || []);
      setEdges(rawEdges || []);
    } catch (err) {
      console.warn('[FeedRelMap] load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [dimensions, showId, showLoaded]);

  useEffect(() => { loadCanvas(); }, [loadCanvas]);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({ w: container.clientWidth, h: Math.max(500, container.clientHeight) });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNodeClick = async (node) => {
    setSelected(node);
    try {
      const res = await api.get(`/api/v1/entanglements/profiles/${node.id}/orbit`);
      setEntangled(res.data?.orbit || []);
    } catch {
      setEntangled([]);
    }
  };

  // Load profiles for dropdowns
  const loadProfiles = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/feed-relationships/profiles');
      setProfiles(res.data?.profiles || []);
    } catch (err) {
      console.warn('[FeedRelMap] profiles load error:', err.message);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleCreate = async () => {
    if (!formA || !formB || formA === formB) return;
    setCreateMsg(null);
    try {
      await api.post('/api/v1/feed-relationships', {
        influencer_a_id: Number(formA),
        influencer_b_id: Number(formB),
        relationship_type: formType,
        is_public: true,
      });
      setCreateMsg({ text: 'Relationship created', ok: true });
      setFormA(''); setFormB(''); setFormType('collab');
      loadCanvas();
    } catch (err) {
      setCreateMsg({ text: err.response?.data?.error || 'Create failed', ok: false });
    }
  };

  // Zoom handlers
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(3, Math.max(0.3, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // left click only
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Generate ripples for selected relationship
  const generateRipples = async (relId) => {
    setGeneratingRipples(true);
    setRipplesMsg(null);
    try {
      const res = await api.post(`/api/v1/feed-relationships/${relId}/generate-ripples`);
      const flags = res.data?.flags || [];
      if (flags.length === 0) {
        setRipplesMsg('No characters caught in the middle.');
      } else {
        setRipplesMsg(`${flags.length} character(s) caught in the middle:\n${flags.map(f => `- ${f.character_name}: ${f.flag}`).join('\n')}`);
      }
    } catch (err) {
      setRipplesMsg(err.response?.data?.error || 'Ripple generation failed');
    } finally {
      setGeneratingRipples(false);
    }
  };

  // Export relationship map as PNG
  const exportMapPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.w * 2;
    canvas.height = dimensions.h * 2;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.download = 'feed-relationship-map.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28,
          fontWeight: 600,
          color: '#1a1a1a',
          margin: 0,
        }}>
          Pulse Relationship Map
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: '#888',
          marginTop: 4,
        }}>
          Pulse profile to Pulse profile: the relationships The Pulse reads — click a node to see entangled characters
        </p>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 16,
        padding: '8px 14px',
        background: '#fdf8fa',
        borderRadius: 8,
        border: '1px solid #f0e8ec',
        alignItems: 'center',
      }}>
        {LEGEND_ITEMS.map(item => (
          <div
            key={item.type}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              opacity: !activeTypes || activeTypes.has(item.type) ? 1 : 0.35,
            }}
            onClick={() => {
              setActiveTypes(prev => {
                if (!prev) { const s = new Set([item.type]); return s; }
                const s = new Set(prev);
                if (s.has(item.type)) { s.delete(item.type); return s.size === 0 ? null : s; }
                s.add(item.type);
                return s;
              });
            }}
          >
            <svg width={24} height={2}>
              <line
                x1={0} y1={1} x2={24} y2={1}
                stroke={item.color}
                strokeWidth={2}
                strokeDasharray={item.dash ? '4,3' : undefined}
              />
            </svg>
            <span style={{ fontSize: 11, color: '#666', fontFamily: "'DM Mono', monospace" }}>
              {item.label}
            </span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>
          {activeTypes ? `${activeTypes.size} filter${activeTypes.size !== 1 ? 's' : ''}` : 'all'}
        </span>
      </div>

      {/* Search + toggle bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search handles or names…"
          style={{
            flex: 1, maxWidth: 280, padding: '6px 12px', fontSize: 12,
            border: '1px solid #e8d5e0', borderRadius: 6, outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#888', cursor: 'pointer' }}>
          <input type="checkbox" checked={showLabels} onChange={() => setShowLabels(v => !v)} />
          Edge labels
        </label>
        {activeTypes && (
          <button
            onClick={() => setActiveTypes(null)}
            style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #e8d5e0', borderRadius: 6, background: '#fff', color: '#888', cursor: 'pointer' }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <button
          onClick={() => setCreateOpen(v => !v)}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            border: '1px solid #d1d5db', borderRadius: 6,
            background: createOpen ? '#f3f4f6' : '#fff', color: '#374151',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {createOpen ? '✕ Close' : '+ Add Relationship'}
        </button>
        <button
          onClick={exportMapPNG}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', color: '#374151',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Export PNG
        </button>
        {createMsg && (
          <span style={{ fontSize: 11, color: createMsg.ok ? '#16a34a' : '#dc2626', fontFamily: "'DM Sans', sans-serif" }}>
            {createMsg.text}
          </span>
        )}
      </div>

      {/* Suggested pairs: who should know each other, for Evoni to keep (idea 4) */}
      <SuggestedPairs onKept={loadCanvas} />
      <RelationshipDrift onFixed={loadCanvas} />

      {/* Create relationship form */}
      {createOpen && (
        <div style={{
          marginBottom: 16, padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Pulse profile A</label>
            <select
              value={formA}
              onChange={e => setFormA(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, minWidth: 180, background: '#fff' }}
            >
              <option value="">Select…</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{atHandle(p.handle)} — {p.display_name || platformLabel(p.platform)}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Relationship</label>
            <select
              value={formType}
              onChange={e => setFormType(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, minWidth: 140, background: '#fff' }}
            >
              {REL_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Pulse profile B</label>
            <select
              value={formB}
              onChange={e => setFormB(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, minWidth: 180, background: '#fff' }}
            >
              <option value="">Select…</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{atHandle(p.handle)} — {p.display_name || platformLabel(p.platform)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!formA || !formB || formA === formB}
            style={{
              padding: '6px 18px', fontSize: 12, fontWeight: 600,
              border: 'none', borderRadius: 6,
              background: (!formA || !formB || formA === formB) ? '#d1d5db' : '#2563eb',
              color: '#fff', cursor: (!formA || !formB || formA === formB) ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Create
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        {/* SVG Canvas */}
        <div style={{
          flex: 1,
          background: '#fff',
          border: '1px solid #e8d5e0',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
              Loading Pulse relationships...
            </div>
          ) : nodes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#aaa', fontSize: 14, fontStyle: 'italic' }}>
              No Pulse relationships yet. Create relationships between Pulse profiles to see the map.
            </div>
          ) : (
            <>
            {/* Zoom controls */}
            <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8d5e0', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8d5e0', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <button onClick={resetView} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #e8d5e0', background: '#fff', cursor: 'pointer', fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}>Reset</button>
              <span style={{ fontSize: 10, color: '#888', alignSelf: 'center', marginLeft: 4, fontFamily: "'DM Mono', monospace" }}>{Math.round(zoom * 100)}%</span>
            </div>
            <svg
              ref={svgRef}
              width={dimensions.w}
              height={dimensions.h}
              viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
              style={{ display: 'block', cursor: isPanning ? 'grabbing' : 'grab' }}
              onWheel={handleWheel}
              onMouseDown={(e) => { if (e.target === svgRef.current || e.target.tagName === 'svg') handleMouseDown(e); }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges (filtered) */}
              {edges.filter(e => !activeTypes || activeTypes.has(e.type)).map(edge => {
                const a = nodes.find(n => n.id === edge.source);
                const b = nodes.find(n => n.id === edge.target);
                if (!a || !b) return null;
                const st = EDGE_STYLES[edge.type] || EDGE_STYLES.orbit;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                // Dim edges not matching search
                const q = searchQ.toLowerCase();
                const matchesSearch = !q || (a.handle || '').toLowerCase().includes(q) || (b.handle || '').toLowerCase().includes(q)
                  || (a.display_name || '').toLowerCase().includes(q) || (b.display_name || '').toLowerCase().includes(q);
                return (
                  <g key={edge.id} opacity={matchesSearch ? 0.7 : 0.15}>
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={st.stroke}
                      strokeWidth={1.5}
                      strokeDasharray={st.dash || undefined}
                      markerEnd={st.arrow ? 'url(#arrowhead)' : undefined}
                    />
                    {showLabels && (
                      <text x={mx} y={my - 4} textAnchor="middle" fontSize={8} fontFamily="'DM Mono', monospace" fill={st.stroke} opacity={0.9}>
                        {(edge.type || '').replace(/_/g, ' ')}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes (filtered) */}
              {nodes.map(node => {
                const ringColor = STATE_RING[node.state] || '#ddd';
                const isSelected = selected?.id === node.id;
                const q = searchQ.toLowerCase();
                const matchesSearch = !q || (node.handle || '').toLowerCase().includes(q) || (node.display_name || '').toLowerCase().includes(q);
                return (
                  <g
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    style={{ cursor: 'pointer' }}
                    opacity={matchesSearch ? 1 : 0.2}
                  >
                    {/* State ring */}
                    <circle
                      cx={node.x} cy={node.y} r={NODE_R + 3}
                      fill="none" stroke={ringColor} strokeWidth={3}
                      opacity={isSelected ? 1 : 0.6}
                    />
                    {/* Node body */}
                    <circle
                      cx={node.x} cy={node.y} r={NODE_R}
                      fill={isSelected ? '#fdf4f9' : '#fff'}
                      stroke={isSelected ? '#d4789a' : '#e8d5e0'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    {/* Handle text */}
                    <text
                      x={node.x} y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9}
                      fontFamily="'DM Mono', monospace"
                      fontWeight={500}
                      fill="#555"
                    >
                      @{(node.handle || '').slice(0, 10)}
                    </text>
                    {/* Display name below */}
                    <text
                      x={node.x} y={node.y + NODE_R + 14}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="'DM Sans', sans-serif"
                      fill="#888"
                    >
                      {(node.display_name || '').slice(0, 16)}
                    </text>
                  </g>
                );
              })}
              </g>
            </svg>
            </>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 280,
            background: '#fff',
            border: '1px solid #e8d5e0',
            borderRadius: 12,
            padding: 16,
            alignSelf: 'flex-start',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 18,
              fontWeight: 600,
              color: '#1a1a1a',
              marginBottom: 4,
            }}>
              {atHandle(selected.handle)}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              {selected.display_name} · {platformLabel(selected.platform)}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
              textTransform: 'uppercase',
              background: STATE_RING[selected.state] ? `${STATE_RING[selected.state]}22` : '#f5f5f5',
              color: STATE_RING[selected.state] || '#999',
              border: `1px solid ${STATE_RING[selected.state] || '#ddd'}44`,
              marginBottom: 12,
            }}>
              {selected.state || 'unknown'}
            </div>

            {/* Connections */}
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#aaa',
              marginBottom: 8,
              marginTop: 8,
            }}>
              Relationships
            </div>
            {edges
              .filter(e => e.source === selected.id || e.target === selected.id)
              .map(e => {
                const otherId = e.source === selected.id ? e.target : e.source;
                const other = nodes.find(n => n.id === otherId);
                const isConflict = e.is_conflict ?? CONFLICT_TYPES.includes(e.type);
                return (
                  <div key={e.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    fontSize: 12,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: (EDGE_STYLES[e.type]?.stroke) || '#ccc',
                      flexShrink: 0,
                    }} />
                    <span style={{ color: '#555' }}>{other?.handle ? `${atHandle(other.handle)}` : '?'}</span>
                    <span style={{
                      fontSize: 10,
                      color: '#aaa',
                      fontFamily: "'DM Mono', monospace",
                      marginLeft: 'auto',
                    }}>
                      {e.type?.replace(/_/g, ' ')}
                    </span>
                    {e.closeness != null && (
                      <span
                        data-testid="frm-closeness"
                        title="Closeness in The Pulse at the show's present (read only)"
                        style={{ fontSize: 10, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}
                      >
                        {Math.round(e.closeness * 100)}% close
                      </span>
                    )}
                    {e.seedable && showId && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setStorylineFor(e.id); }}
                        title="Suggest a Pulse storyline between these two"
                        aria-label={`Storyline with ${other?.handle ? atHandle(other.handle) : 'this creator'}`}
                        style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4,
                          border: '1px solid #B8962E44', background: '#FAF7F0',
                          color: '#7a5f1a', cursor: 'pointer', fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Storyline
                      </button>
                    )}
                    {isConflict && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); generateRipples(e.id); }}
                        disabled={generatingRipples}
                        title="Find characters caught in the middle"
                        style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4,
                          border: '1px solid #f59e0b44', background: '#fdf8e8',
                          color: '#8a6010', cursor: 'pointer', fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Ripples
                      </button>
                    )}
                  </div>
                );
              })
            }
            {storylineFor != null && edges.some(e => e.id === storylineFor && (e.source === selected.id || e.target === selected.id)) && (
              <PairStoryline key={storylineFor} relationshipId={storylineFor} showId={showId} onClose={() => setStorylineFor(null)} />
            )}
            {ripplesMsg && (
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 6,
                background: '#fdf8e8', border: '1px solid #f0d89044',
                fontSize: 11, color: '#8a6010', lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {ripplesMsg}
                <button onClick={() => setRipplesMsg(null)} style={{
                  float: 'right', background: 'none', border: 'none',
                  color: '#8a6010', cursor: 'pointer', fontSize: 12,
                }}>✕</button>
              </div>
            )}

            {/* Entangled characters */}
            {entangled.length > 0 && (
              <>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#aaa',
                  marginBottom: 8,
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #f0e8ec',
                }}>
                  Entangled Characters
                </div>
                {entangled.map(e => (
                  <div key={e.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '3px 0',
                    fontSize: 12,
                    color: '#555',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#d4789a',
                      flexShrink: 0,
                    }} />
                    {e.character?.selected_name || e.character?.display_name || 'Unknown'}
                    <span style={{
                      fontSize: 10,
                      color: '#aaa',
                      marginLeft: 'auto',
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {e.intensity}
                    </span>
                  </div>
                ))}
              </>
            )}

            <button
              onClick={() => { setSelected(null); setEntangled([]); }}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '6px 0',
                background: '#f5f0f3',
                border: '1px solid #e8d5e0',
                borderRadius: 6,
                fontSize: 11,
                color: '#888',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
