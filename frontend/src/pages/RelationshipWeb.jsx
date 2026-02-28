import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './RelationshipWeb.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const TYPE_COLORS = {
  special:     '#C6A85E',
  pressure:    '#e07070',
  mirror:      '#a78bfa',
  support:     '#34d399',
  shadow:      '#94a3b8',
  protagonist: '#0d9488',
};

const EDGE_COLORS = {
  romantic:     '#e07070',
  familial:     '#34d399',
  mirror:       '#a78bfa',
  support:      '#34d399',
  shadow:       '#94a3b8',
  transactional:'#f59e0b',
  creation:     '#C6A85E',
  pressure:     '#e07070',
};

const GROUP_LABELS = {
  real_world: 'Real World',
  online:     'Online',
  created:    'Created',
};

// Node sizes by role importance
const NODE_RADIUS = {
  special:     36,
  protagonist: 36,
  pressure:    28,
  mirror:      24,
  support:     20,
  shadow:      20,
};

// ─── D3 force simulation (vanilla D3 via CDN) ─────────────────────────────────
// D3 is loaded from CDN in the main HTML — window.d3 is available
function useD3RelationshipGraph(svgRef, nodes, edges, onNodeClick, onEdgeHover) {
  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width  = svgRef.current.clientWidth  || 900;
    const height = svgRef.current.clientHeight || 600;

    // ── Zoom container ──────────────────────────────────────────────────────
    const container = svg.append('g').attr('class', 'rw-container');

    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 2.5])
        .on('zoom', (event) => {
          container.attr('transform', event.transform);
        })
    );

    // ── Arrow markers ───────────────────────────────────────────────────────
    const defs = svg.append('defs');

    // One marker per edge type for colored arrows
    const edgeTypes = [...new Set(edges.map((e) => e.type))];
    edgeTypes.forEach((type) => {
      const color = EDGE_COLORS[type] || '#94a3b8';
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.8);
    });

    // ── Clone nodes/edges for simulation (D3 mutates them) ─────────────────
    const simNodes = nodes.map((n) => ({ ...n }));
    const nodeMap  = Object.fromEntries(simNodes.map((n) => [n.id, n]));

    const simEdges = edges.map((e) => ({
      ...e,
      source: nodeMap[e.from],
      target: nodeMap[e.to],
    })).filter((e) => e.source && e.target);

    // ── Force simulation ────────────────────────────────────────────────────
    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges)
        .id((d) => d.id)
        .distance((e) => {
          // Franchise hinge gets more space
          if (e.note === 'franchise_hinge') return 220;
          if (e.strength >= 4) return 160;
          return 120;
        })
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => (NODE_RADIUS[d.role_type] || 24) + 12));

    // ── Draw edges ──────────────────────────────────────────────────────────
    const edgeGroup = container.append('g').attr('class', 'rw-edges');

    const edgeLines = edgeGroup.selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('class', 'rw-edge')
      .attr('stroke', (e) => EDGE_COLORS[e.type] || '#94a3b8')
      .attr('stroke-width', (e) => e.strength >= 5 ? 2.5 : e.strength >= 3 ? 1.8 : 1.2)
      .attr('stroke-opacity', (e) => e.note === 'franchise_hinge' ? 1 : 0.55)
      .attr('stroke-dasharray', (e) => e.direction === 'one_way' ? '0' : '0')
      .attr('marker-end', (e) => `url(#arrow-${e.type})`)
      // Two-way edges also get marker-start
      .attr('marker-start', (e) => e.direction === 'two_way' ? `url(#arrow-${e.type})` : null)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, e) => onEdgeHover(e, event))
      .on('mouseleave', () => onEdgeHover(null, null));

    // ── Draw nodes ──────────────────────────────────────────────────────────
    const nodeGroup = container.append('g').attr('class', 'rw-nodes');

    const nodeGs = nodeGroup.selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'rw-node-g')
      .style('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      });

    // Outer glow ring for franchise hinge characters
    nodeGs.filter((d) => d.id === 'justawoman' || d.id === 'lala')
      .append('circle')
      .attr('r', (d) => (NODE_RADIUS[d.role_type] || 24) + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '4 3');

    // Main node circle
    nodeGs.append('circle')
      .attr('r', (d) => NODE_RADIUS[d.role_type] || 24)
      .attr('fill', '#ffffff')
      .attr('stroke', (d) => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('stroke-width', 2.5);

    // Type color fill (soft)
    nodeGs.append('circle')
      .attr('r', (d) => (NODE_RADIUS[d.role_type] || 24) - 2)
      .attr('fill', (d) => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('opacity', 0.08);

    // Node label
    nodeGs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (NODE_RADIUS[d.role_type] || 24) + 16)
      .attr('class', 'rw-node-label')
      .attr('fill', '#2d2b27')
      .text((d) => d.label);

    // Node initials (inside circle)
    nodeGs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('class', 'rw-node-initials')
      .attr('fill', (d) => TYPE_COLORS[d.role_type] || '#94a3b8')
      .text((d) => d.label.split(' ').map((w) => w[0]).join('').slice(0, 2));

    // ── Tick ────────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      // Offset edge endpoints to stop at node radius
      edgeLines
        .attr('x1', (e) => {
          const r = NODE_RADIUS[e.source.role_type] || 24;
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return e.source.x + (dx / dist) * r;
        })
        .attr('y1', (e) => {
          const r = NODE_RADIUS[e.source.role_type] || 24;
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return e.source.y + (dy / dist) * r;
        })
        .attr('x2', (e) => {
          const r = (NODE_RADIUS[e.target.role_type] || 24) + 8;
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return e.target.x - (dx / dist) * r;
        })
        .attr('y2', (e) => {
          const r = (NODE_RADIUS[e.target.role_type] || 24) + 8;
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return e.target.y - (dy / dist) * r;
        });

      nodeGs.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, edges, onNodeClick, onEdgeHover]);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function EdgeTooltip({ edge, position }) {
  if (!edge) return null;

  const edgeColor = EDGE_COLORS[edge.type] || '#94a3b8';

  return (
    <div
      className="rw-tooltip"
      style={{ left: position?.x + 16, top: position?.y - 8 }}
    >
      <div className="rw-tooltip-header" style={{ borderColor: edgeColor }}>
        <span className="rw-tooltip-from">{edge.from}</span>
        <span className="rw-tooltip-arrow" style={{ color: edgeColor }}>
          {edge.direction === 'two_way' ? '↔' : '→'}
        </span>
        <span className="rw-tooltip-to">{edge.to}</span>
        <span className="rw-tooltip-type" style={{ color: edgeColor }}>{edge.type}</span>
      </div>

      {edge.from_knows && (
        <div className="rw-tooltip-section">
          <div className="rw-tooltip-label">{edge.from} knows</div>
          <div className="rw-tooltip-text">{edge.from_knows}</div>
        </div>
      )}
      {edge.to_knows && (
        <div className="rw-tooltip-section">
          <div className="rw-tooltip-label">{edge.to} knows</div>
          <div className="rw-tooltip-text">{edge.to_knows}</div>
        </div>
      )}
      {!edge.to_knows && edge.direction === 'one_way' && (
        <div className="rw-tooltip-section rw-tooltip-unaware">
          <div className="rw-tooltip-label">{edge.to} knows</div>
          <div className="rw-tooltip-text rw-unaware">Nothing. Unaware this connection exists.</div>
        </div>
      )}
      {edge.note && (
        <div className="rw-tooltip-note">{edge.note.replace(/_/g, ' ')}</div>
      )}
    </div>
  );
}

// ─── Character detail panel ───────────────────────────────────────────────────
function CharacterPanel({ node, edges, onNavigate, onClose, typeColors }) {
  if (!node) return null;

  const typeColor = TYPE_COLORS[node.role_type] || '#94a3b8';

  // Find all edges involving this character
  const outgoing = edges.filter((e) => e.from === node.id);
  const incoming = edges.filter((e) => e.to   === node.id);

  return (
    <div className="rw-panel">
      <button className="rw-panel-close" onClick={onClose}>×</button>

      <div className="rw-panel-header" style={{ borderLeftColor: typeColor }}>
        <div className="rw-panel-name">{node.label}</div>
        <div className="rw-panel-type" style={{ color: typeColor }}>
          {node.role_type} · {GROUP_LABELS[node.group] || node.group}
        </div>
      </div>

      {node.bio && (
        <div className="rw-panel-bio">{node.bio}</div>
      )}

      {outgoing.length > 0 && (
        <div className="rw-panel-section">
          <div className="rw-panel-section-label">Knows about →</div>
          {outgoing.map((e, i) => (
            <div key={i} className="rw-panel-relation">
              <span className="rw-panel-relation-target" style={{ color: EDGE_COLORS[e.type] }}>
                {e.to}
              </span>
              <span className="rw-panel-relation-desc">{e.from_feels}</span>
            </div>
          ))}
        </div>
      )}

      {incoming.filter((e) => e.direction === 'one_way').length > 0 && (
        <div className="rw-panel-section">
          <div className="rw-panel-section-label rw-unaware-label">Unaware of ←</div>
          {incoming.filter((e) => e.direction === 'one_way').map((e, i) => (
            <div key={i} className="rw-panel-relation rw-panel-relation-unaware">
              <span className="rw-panel-relation-target">{e.from}</span>
              <span className="rw-panel-relation-desc rw-unaware">
                {e.from} has a connection to {node.label} that {node.label} knows nothing about.
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        className="rw-panel-nav-btn"
        style={{ borderColor: typeColor, color: typeColor }}
        onClick={() => onNavigate(node)}
      >
        Open Character Home →
      </button>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="rw-legend">
      <div className="rw-legend-title">Connections</div>
      {Object.entries(EDGE_COLORS).map(([type, color]) => (
        <div key={type} className="rw-legend-item">
          <div className="rw-legend-line" style={{ background: color }} />
          <span>{type}</span>
        </div>
      ))}
      <div className="rw-legend-divider" />
      <div className="rw-legend-item">
        <span className="rw-legend-arrow">→</span>
        <span>one-way (unaware)</span>
      </div>
      <div className="rw-legend-item">
        <span className="rw-legend-arrow">↔</span>
        <span>two-way</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RelationshipWeb() {
  const navigate = useNavigate();
  const svgRef   = useRef(null);

  const [nodes, setNodes]               = useState([]);
  const [edges, setEdges]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredEdge, setHoveredEdge]   = useState(null);
  const [tooltipPos, setTooltipPos]     = useState(null);
  const [filter, setFilter]             = useState('all'); // all | real_world | online | created
  const [d3Loaded, setD3Loaded]         = useState(!!window.d3);
  const [nameToId, setNameToId]         = useState({}); // name→UUID map for character home nav

  // ── Load D3 from CDN if not already present ───────────────────────────────
  useEffect(() => {
    if (window.d3) { setD3Loaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    script.onload = () => setD3Loaded(true);
    script.onerror = () => setError('Could not load D3. Check your network connection.');
    document.head.appendChild(script);
  }, []);

  // ── Load relationship data + character name→ID map ────────────────────────
  useEffect(() => {
    loadRelationships();
    loadCharacterMap();
  }, []);

  async function loadRelationships() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/memories/relationship-map`);
      if (!res.ok) throw new Error('Failed to load relationship map');
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (e) {
      setError('Could not load relationships. Using local data.');
      // The backend seed data handles this — but if backend is down entirely,
      // we show the error state rather than crashing
    } finally {
      setLoading(false);
    }
  }

  async function loadCharacterMap() {
    // Build a name→UUID map from all registries so "Open Character Home" works
    try {
      const res = await fetch(`${API_BASE}/character-registry/registries`);
      if (!res.ok) return;
      const data = await res.json();
      const registries = data.registries || data;
      const map = {};
      (Array.isArray(registries) ? registries : []).forEach((reg) => {
        (reg.characters || []).forEach((c) => {
          const name = (c.selected_name || c.display_name || '').toLowerCase().trim();
          if (name && c.id) map[name] = c.id;
        });
      });
      setNameToId(map);
    } catch {
      // Non-critical — panel "Open Character Home" will fall back to /world
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node) => {
    setSelectedNode((prev) => prev?.id === node.id ? null : node);
  }, []);

  const handleEdgeHover = useCallback((edge, event) => {
    setHoveredEdge(edge);
    if (event) {
      setTooltipPos({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleNavigateToCharacter = useCallback((node) => {
    // Resolve node label to character UUID via the pre-loaded name map
    const key = (node.label || '').toLowerCase().trim();
    const charId = nameToId[key];
    if (charId) {
      navigate(`/character-registry?character=${charId}`);
    } else {
      // Fallback: navigate to world view
      navigate('/character-registry?view=world');
    }
  }, [navigate, nameToId]);

  // ── Filter nodes/edges ────────────────────────────────────────────────────
  const visibleNodes = filter === 'all'
    ? nodes
    : nodes.filter((n) => n.group === filter);

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  const visibleEdges = edges.filter(
    (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
  );

  // ── Render graph ──────────────────────────────────────────────────────────
  useD3RelationshipGraph(svgRef, visibleNodes, visibleEdges, handleNodeClick, handleEdgeHover);

  if (loading) {
    return (
      <div className="rw-loading">
        <div className="rw-loading-ring" />
        <span>Mapping the world…</span>
      </div>
    );
  }

  return (
    <div className="rw-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rw-header">
        <div className="rw-header-left">
          <button className="rw-btn-back" onClick={() => navigate('/character-registry?view=world')}>
            ← World View
          </button>
          <div className="rw-title">Relationship Web</div>
          <div className="rw-subtitle">
            {nodes.length} characters · {edges.length} connections ·{' '}
            {edges.filter((e) => e.direction === 'one_way').length} one-way
          </div>
        </div>

        {/* Filter pills */}
        <div className="rw-filter-bar">
          {['all', 'real_world', 'online', 'created'].map((f) => (
            <button
              key={f}
              className={`rw-filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : GROUP_LABELS[f] || f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rw-error-banner">{error}</div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="rw-canvas-wrapper">
        {d3Loaded ? (
          <svg
            ref={svgRef}
            className="rw-svg"
            onClick={() => { setSelectedNode(null); setHoveredEdge(null); }}
          />
        ) : (
          <div className="rw-loading">
            <div className="rw-loading-ring" />
            <span>Loading graph engine…</span>
          </div>
        )}

        {/* Legend */}
        <Legend />

        {/* Character panel */}
        {selectedNode && (
          <CharacterPanel
            node={selectedNode}
            edges={edges}
            onNavigate={handleNavigateToCharacter}
            onClose={() => setSelectedNode(null)}
            typeColors={TYPE_COLORS}
          />
        )}

        {/* Franchise hinge callout */}
        <div className="rw-hinge-callout">
          <span className="rw-hinge-dot" />
          JustAWoman → Lala is one-way. Lala doesn't know she was built.
        </div>
      </div>

      {/* Edge tooltip */}
      <EdgeTooltip edge={hoveredEdge} position={tooltipPos} />
    </div>
  );
}
