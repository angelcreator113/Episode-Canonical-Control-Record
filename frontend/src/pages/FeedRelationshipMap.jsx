import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/* ── Feed Relationship Map ──────────────────────────────────────────────────
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

const EDGE_STYLES = {
  beef:             { stroke: '#ef4444', dash: '6,4' },
  collab:           { stroke: '#22c55e', dash: null },
  silent_alliance:  { stroke: '#9ca3af', dash: '2,4' },
  mentor:           { stroke: '#3b82f6', dash: null },
  orbit:            { stroke: '#9ca3af', dash: null, arrow: true },
  public_shade:     { stroke: '#f59e0b', dash: '6,4' },
  copy_cat:         { stroke: '#a855f7', dash: '4,4' },
  former_friends:   { stroke: '#ef4444', dash: '8,4' },
  competitors:      { stroke: '#f97316', dash: null },
};

const NODE_R = 28;
const LEGEND_ITEMS = [
  { type: 'beef', label: 'Beef', color: '#ef4444', dash: true },
  { type: 'collab', label: 'Collab', color: '#22c55e' },
  { type: 'mentor', label: 'Mentor', color: '#3b82f6' },
  { type: 'silent_alliance', label: 'Silent Alliance', color: '#9ca3af', dash: true },
  { type: 'orbit', label: 'Orbit', color: '#9ca3af' },
  { type: 'former_friends', label: 'Former Friends', color: '#ef4444', dash: true },
];

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
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });

  const loadCanvas = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/feed-relationships/canvas');
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
  }, [dimensions]);

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
          Feed Relationship Map
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: '#888',
          marginTop: 4,
        }}>
          Influencer-to-influencer connections — click a node to see entangled characters
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
      }}>
        {LEGEND_ITEMS.map(item => (
          <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      </div>

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
              Loading feed relationships...
            </div>
          ) : nodes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#aaa', fontSize: 14, fontStyle: 'italic' }}>
              No feed relationships yet. Create relationships between social profiles to see the map.
            </div>
          ) : (
            <svg
              ref={svgRef}
              width={dimensions.w}
              height={dimensions.h}
              viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
              style={{ display: 'block' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map(edge => {
                const a = nodes.find(n => n.id === edge.source);
                const b = nodes.find(n => n.id === edge.target);
                if (!a || !b) return null;
                const style = EDGE_STYLES[edge.type] || EDGE_STYLES.orbit;
                return (
                  <line
                    key={edge.id}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={style.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={style.dash || undefined}
                    markerEnd={style.arrow ? 'url(#arrowhead)' : undefined}
                    opacity={0.7}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const ringColor = STATE_RING[node.state] || '#ddd';
                const isSelected = selected?.id === node.id;
                return (
                  <g
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    style={{ cursor: 'pointer' }}
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
            </svg>
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
              @{selected.handle}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              {selected.display_name} · {selected.platform}
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
                    <span style={{ color: '#555' }}>{other?.handle ? `@${other.handle}` : '?'}</span>
                    <span style={{
                      fontSize: 10,
                      color: '#aaa',
                      fontFamily: "'DM Mono', monospace",
                      marginLeft: 'auto',
                    }}>
                      {e.type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })
            }

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
