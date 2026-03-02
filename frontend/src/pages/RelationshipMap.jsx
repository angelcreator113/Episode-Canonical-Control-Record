import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RelationshipWeb.css';

// ── Constants ─────────────────────────────────────────────────────────
const API = '/api/v1';

const CONNECTION_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];

const LALA_CONNECTIONS = [
  { value: 'none',               label: 'No Lala connection' },
  { value: 'knows_lala',         label: 'Knows Lala directly' },
  { value: 'through_justwoman',  label: 'Knows JustAWoman, unaware of Lala' },
  { value: 'interacts_content',  label: 'Interacts with Lala content (unknowingly)' },
  { value: 'unaware',            label: 'Completely unaware of Lala' },
];

const STATUSES = ['Active', 'Past', 'One-sided', 'Complicated'];

const REL_PRESETS = [
  'Sister', 'Brother', 'Mother', 'Father',
  'Husband', 'Wife', 'Boyfriend', 'Girlfriend',
  'Best Friend', 'Friend', 'Acquaintance',
  'Stylist', 'Designer', 'Brand Contact',
  'Manager', 'Collaborator', 'Mentor',
  'Rival', 'Inspiration', 'Fan',
];

const TYPE_COLORS = {
  pressure:    '#ef4444',
  mirror:      '#a855f7',
  support:     '#14b8a6',
  shadow:      '#f97316',
  special:     '#C9A84C',
  protagonist: '#3b82f6',
};

const MODE_COLORS = {
  'IRL':           { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  'Online Only':   { bg: '#ede9fe', text: '#4c1d95', border: '#8b5cf6' },
  'Passing':       { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
  'Professional':  { bg: '#dbeafe', text: '#1e3a8a', border: '#60a5fa' },
  'One-sided':     { bg: '#fce7f3', text: '#831843', border: '#ec4899' },
};

const STATUS_COLORS = {
  'Active':      { bg: '#dcfce7', text: '#14532d', border: '#22c55e' },
  'Past':        { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' },
  'One-sided':   { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  'Complicated': { bg: '#fee2e2', text: '#7f1d1d', border: '#f87171' },
};

const GOLD = '#C9A84C';
const DARK = '#0d0b09';

// ── D3 Graph Constants ────────────────────────────────────────────────
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

const GRAPH_TYPE_COLORS = {
  special:     '#C6A85E',
  pressure:    '#e07070',
  mirror:      '#a78bfa',
  support:     '#34d399',
  shadow:      '#94a3b8',
  protagonist: '#0d9488',
};

const GROUP_LABELS = {
  real_world: 'Real World',
  online:     'Online',
  created:    'Created',
};

const NODE_RADIUS = {
  special:     36,
  protagonist: 36,
  pressure:    28,
  mirror:      24,
  support:     20,
  shadow:      20,
};

// ── D3 force simulation hook ──────────────────────────────────────────
function useD3RelationshipGraph(svgRef, nodes, edges, onNodeClick, onEdgeHover) {
  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width  = svgRef.current.clientWidth  || 900;
    const height = svgRef.current.clientHeight || 600;

    const container = svg.append('g').attr('class', 'rw-container');

    // Store zoom for auto-fit
    const zoomBehavior = d3.zoom().scaleExtent([0.1, 2.5])
      .on('zoom', (event) => container.attr('transform', event.transform));
    svg.call(zoomBehavior);

    const defs = svg.append('defs');
    const edgeTypes = [...new Set(edges.map(e => e.type))];
    edgeTypes.forEach(type => {
      const color = EDGE_COLORS[type] || '#94a3b8';
      defs.append('marker').attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color).attr('opacity', 0.8);
    });

    const simNodes = nodes.map(n => ({ ...n }));
    const nodeMap  = Object.fromEntries(simNodes.map(n => [n.id, n]));
    const simEdges = edges.map(e => ({
      ...e, source: nodeMap[e.from], target: nodeMap[e.to],
    })).filter(e => e.source && e.target);

    const sim = d3.forceSimulation(simNodes)
      .velocityDecay(0.45)
      .force('link', d3.forceLink(simEdges).id(d => d.id)
        .distance(e => e.note === 'franchise_hinge' ? 220 : e.strength >= 4 ? 160 : 120)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(d => (NODE_RADIUS[d.role_type] || 24) + 12))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03));

    const edgeGroup = container.append('g').attr('class', 'rw-edges');
    const edgeLines = edgeGroup.selectAll('line').data(simEdges).join('line')
      .attr('class', 'rw-edge')
      .attr('stroke', e => EDGE_COLORS[e.type] || '#94a3b8')
      .attr('stroke-width', e => e.strength >= 5 ? 2.5 : e.strength >= 3 ? 1.8 : 1.2)
      .attr('stroke-opacity', e => e.note === 'franchise_hinge' ? 1 : 0.55)
      .attr('marker-end', e => `url(#arrow-${e.type})`)
      .attr('marker-start', e => e.direction === 'two_way' ? `url(#arrow-${e.type})` : null)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, e) => onEdgeHover(e, event))
      .on('mouseleave', () => onEdgeHover(null, null));

    const nodeGroup = container.append('g').attr('class', 'rw-nodes');
    const nodeGs = nodeGroup.selectAll('g').data(simNodes).join('g')
      .attr('class', 'rw-node-g').style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.08).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); /* keep d.fx/d.fy — pin node where dropped */ })
      )
      .on('click', (event, d) => { event.stopPropagation(); onNodeClick(d); });

    nodeGs.filter(d => d.id === 'justawoman' || d.id === 'lala')
      .append('circle').attr('r', d => (NODE_RADIUS[d.role_type] || 24) + 6)
      .attr('fill', 'none').attr('stroke', d => GRAPH_TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('stroke-width', 1).attr('stroke-opacity', 0.3).attr('stroke-dasharray', '4 3');

    nodeGs.append('circle').attr('r', d => NODE_RADIUS[d.role_type] || 24)
      .attr('fill', '#ffffff').attr('stroke', d => GRAPH_TYPE_COLORS[d.role_type] || '#94a3b8').attr('stroke-width', 2.5);

    nodeGs.append('circle').attr('r', d => (NODE_RADIUS[d.role_type] || 24) - 2)
      .attr('fill', d => GRAPH_TYPE_COLORS[d.role_type] || '#94a3b8').attr('opacity', 0.08);

    nodeGs.append('text').attr('text-anchor', 'middle')
      .attr('dy', d => (NODE_RADIUS[d.role_type] || 24) + 16)
      .attr('class', 'rw-node-label').attr('fill', '#2d2b27').text(d => d.label);

    nodeGs.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('class', 'rw-node-initials')
      .attr('fill', d => GRAPH_TYPE_COLORS[d.role_type] || '#94a3b8')
      .text(d => d.label.split(' ').map(w => w[0]).join('').slice(0, 2));

    const pad = 50;
    sim.on('tick', () => {
      // Clamp nodes within bounds
      simNodes.forEach(d => {
        const r = NODE_RADIUS[d.role_type] || 24;
        if (!d.fx) d.x = Math.max(r + pad, Math.min(width - r - pad, d.x));
        if (!d.fy) d.y = Math.max(r + pad, Math.min(height - r - pad, d.y));
      });

      edgeLines
        .attr('x1', e => { const r=NODE_RADIUS[e.source.role_type]||24, dx=e.target.x-e.source.x, dy=e.target.y-e.source.y, dist=Math.sqrt(dx*dx+dy*dy)||1; return e.source.x+(dx/dist)*r; })
        .attr('y1', e => { const r=NODE_RADIUS[e.source.role_type]||24, dx=e.target.x-e.source.x, dy=e.target.y-e.source.y, dist=Math.sqrt(dx*dx+dy*dy)||1; return e.source.y+(dy/dist)*r; })
        .attr('x2', e => { const r=(NODE_RADIUS[e.target.role_type]||24)+8, dx=e.target.x-e.source.x, dy=e.target.y-e.source.y, dist=Math.sqrt(dx*dx+dy*dy)||1; return e.target.x-(dx/dist)*r; })
        .attr('y2', e => { const r=(NODE_RADIUS[e.target.role_type]||24)+8, dx=e.target.x-e.source.x, dy=e.target.y-e.source.y, dist=Math.sqrt(dx*dx+dy*dy)||1; return e.target.y-(dy/dist)*r; });
      nodeGs.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Auto-fit zoom ONLY on initial load (not after drag interactions)
    let hasAutoFitted = false;
    sim.on('end', () => {
      if (hasAutoFitted || !simNodes.length) return;
      hasAutoFitted = true;
      const xs = simNodes.map(d => d.x);
      const ys = simNodes.map(d => d.y);
      const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60;
      const y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60;
      const bw = x1 - x0, bh = y1 - y0;
      const scale = Math.min(width / bw, height / bh, 1.5);
      const tx = (width - bw * scale) / 2 - x0 * scale;
      const ty = (height - bh * scale) / 2 - y0 * scale;
      svg.transition().duration(600)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => sim.stop();
  }, [nodes, edges, onNodeClick, onEdgeHover]);
}

// ── Graph sub-components ──────────────────────────────────────────────
function EdgeTooltip({ edge, position }) {
  if (!edge) return null;
  const edgeColor = EDGE_COLORS[edge.type] || '#94a3b8';
  return (
    <div className="rw-tooltip" style={{ left: position?.x + 16, top: position?.y - 8 }}>
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
      {edge.note && <div className="rw-tooltip-note">{edge.note.replace(/_/g, ' ')}</div>}
    </div>
  );
}

function CharacterPanel({ node, edges, onNavigate, onClose }) {
  if (!node) return null;
  const typeColor = GRAPH_TYPE_COLORS[node.role_type] || '#94a3b8';
  const outgoing = edges.filter(e => e.from === node.id);
  const incoming = edges.filter(e => e.to === node.id);
  return (
    <div className="rw-panel">
      <button className="rw-panel-close" onClick={onClose}>×</button>
      <div className="rw-panel-header" style={{ borderLeftColor: typeColor }}>
        <div className="rw-panel-name">{node.label}</div>
        <div className="rw-panel-type" style={{ color: typeColor }}>
          {node.role_type} · {GROUP_LABELS[node.group] || node.group}
        </div>
      </div>
      {node.bio && <div className="rw-panel-bio">{node.bio}</div>}
      {outgoing.length > 0 && (
        <div className="rw-panel-section">
          <div className="rw-panel-section-label">Knows about →</div>
          {outgoing.map((e, i) => (
            <div key={i} className="rw-panel-relation">
              <span className="rw-panel-relation-target" style={{ color: EDGE_COLORS[e.type] }}>{e.to}</span>
              <span className="rw-panel-relation-desc">{e.from_feels}</span>
            </div>
          ))}
        </div>
      )}
      {incoming.filter(e => e.direction === 'one_way').length > 0 && (
        <div className="rw-panel-section">
          <div className="rw-panel-section-label rw-unaware-label">Unaware of ←</div>
          {incoming.filter(e => e.direction === 'one_way').map((e, i) => (
            <div key={i} className="rw-panel-relation rw-panel-relation-unaware">
              <span className="rw-panel-relation-target">{e.from}</span>
              <span className="rw-panel-relation-desc rw-unaware">
                {e.from} has a connection to {node.label} that {node.label} knows nothing about.
              </span>
            </div>
          ))}
        </div>
      )}
      <button className="rw-panel-nav-btn" style={{ borderColor: typeColor, color: typeColor }}
        onClick={() => onNavigate(node)}>
        Open Character Home →
      </button>
    </div>
  );
}

function GraphLegend() {
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
      <div className="rw-legend-item"><span className="rw-legend-arrow">→</span><span>one-way (unaware)</span></div>
      <div className="rw-legend-item"><span className="rw-legend-arrow">↔</span><span>two-way</span></div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function charDisplayName(c) {
  return c?.selected_name || c?.display_name || 'Unknown';
}

function getCharName(rel, side) {
  if (side === 'a') return rel.character_a_selected || rel.character_a_name || '?';
  return rel.character_b_selected || rel.character_b_name || '?';
}

function otherCharId(rel, focusId) {
  return rel.character_id_a === focusId ? rel.character_id_b : rel.character_id_a;
}

// ── Sub-components ─────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: type === 'error' ? '#fee2e2' : '#f0fdf4',
      border: `1px solid ${type === 'error' ? '#f87171' : '#86efac'}`,
      color: type === 'error' ? '#7f1d1d' : '#14532d',
      padding: '10px 18px', borderRadius: 8,
      fontFamily: 'system-ui, sans-serif', fontSize: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{type === 'error' ? '✕' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
}

function Badge({ label, colorSet }) {
  if (!colorSet) return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 99,
      background: '#f3f4f6', color: '#374151',
      border: '1px solid #d1d5db',
    }}>{label}</span>
  );
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 99,
      background: colorSet.bg, color: colorSet.text,
      border: `1px solid ${colorSet.border}`,
    }}>{label}</span>
  );
}

function LalaDot({ lala_connection }) {
  if (!lala_connection || lala_connection === 'none') return null;
  const label = LALA_CONNECTIONS.find(l => l.value === lala_connection)?.label || lala_connection;
  return (
    <span title={label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: GOLD, fontWeight: 500,
    }}>
      ◈ Lala
    </span>
  );
}

function TypeBar({ type }) {
  const color = TYPE_COLORS[type] || '#9ca3af';
  return (
    <span style={{
      display: 'inline-block', width: 3, height: 14,
      borderRadius: 2, background: color,
      flexShrink: 0,
    }} />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function RelationshipMap() {
  const navigate = useNavigate();

  // ── View toggle: 'map' (CRUD cards) or 'web' (D3 graph) ─────────────
  const [view, setView] = useState('map');

  // ── Map (CRUD) state ─────────────────────────────────────────────────
  const [characters, setCharacters]     = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [editRel, setEditRel]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);

  // ── Graph (D3) state ─────────────────────────────────────────────────
  const svgRef = useRef(null);
  const [graphNodes, setGraphNodes]         = useState([]);
  const [graphEdges, setGraphEdges]         = useState([]);
  const [selectedNode, setSelectedNode]     = useState(null);
  const [hoveredEdge, setHoveredEdge]       = useState(null);
  const [tooltipPos, setTooltipPos]         = useState(null);
  const [graphFilter, setGraphFilter]       = useState('all');
  const [d3Loaded, setD3Loaded]             = useState(!!window.d3);
  const [nameToId, setNameToId]             = useState({});
  const [graphLoading, setGraphLoading]     = useState(false);
  const [graphError, setGraphError]         = useState(null);

  // form state
  const emptyForm = {
    character_id_a:  '',
    character_id_b:  '',
    relationship_type: '',
    relTypeCustom:   '',
    connection_mode: 'IRL',
    lala_connection: 'none',
    status:          'Active',
    notes:           '',
  };
  const [form, setForm] = useState(emptyForm);

  // ── fetch ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, rRes] = await Promise.all([
        fetch(`${API}/character-registry/registries`).then(r => r.json()),
        fetch(`${API}/relationships`).then(r => r.json()),
      ]);

      // Characters live nested inside registries
      const allChars = [];
      (cRes.registries || []).forEach(reg => {
        (reg.characters || reg.registry_characters || []).forEach(c => allChars.push(c));
      });
      setCharacters(allChars);
      setRelationships(rRes.relationships || []);
    } catch (e) {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── D3 loader ────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.d3) { setD3Loaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    script.onload = () => setD3Loaded(true);
    script.onerror = () => setGraphError('Could not load D3.');
    document.head.appendChild(script);
  }, []);

  // ── Load graph data when switching to web view ───────────────────────
  useEffect(() => {
    if (view !== 'web') return;
    loadGraphData();
    loadCharacterMap();
  }, [view]);

  async function loadGraphData() {
    setGraphLoading(true);
    setGraphError(null);
    try {
      const res = await fetch(`${API}/memories/relationship-map`);
      if (!res.ok) throw new Error('Failed to load relationship map');
      const data = await res.json();
      setGraphNodes(data.nodes || []);
      setGraphEdges(data.edges || []);
    } catch {
      setGraphError('Could not load graph data.');
    } finally {
      setGraphLoading(false);
    }
  }

  async function loadCharacterMap() {
    try {
      const res = await fetch(`${API}/character-registry/registries`);
      if (!res.ok) return;
      const data = await res.json();
      const registries = data.registries || data;
      const map = {};
      (Array.isArray(registries) ? registries : []).forEach(reg => {
        (reg.characters || []).forEach(c => {
          const name = (c.selected_name || c.display_name || '').toLowerCase().trim();
          if (name && c.id) map[name] = c.id;
        });
      });
      setNameToId(map);
    } catch { /* non-critical */ }
  }

  // ── Graph handlers ───────────────────────────────────────────────────
  const handleNodeClick = useCallback(node => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  const handleEdgeHover = useCallback((edge, event) => {
    setHoveredEdge(edge);
    if (event) setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  const handleNavigateToCharacter = useCallback(node => {
    const key = (node.label || '').toLowerCase().trim();
    const charId = nameToId[key];
    if (charId) navigate(`/character-registry?character=${charId}`);
    else navigate('/character-registry?view=world');
  }, [navigate, nameToId]);

  // ── Filtered graph data ──────────────────────────────────────────────
  const visibleGraphNodes = graphFilter === 'all'
    ? graphNodes
    : graphNodes.filter(n => n.group === graphFilter);
  const visibleGraphNodeIds = new Set(visibleGraphNodes.map(n => n.id));
  const visibleGraphEdges = graphEdges.filter(
    e => visibleGraphNodeIds.has(e.from) && visibleGraphNodeIds.has(e.to)
  );

  // ── Run D3 simulation ───────────────────────────────────────────────
  useD3RelationshipGraph(svgRef, visibleGraphNodes, visibleGraphEdges, handleNodeClick, handleEdgeHover);

  // ── toast ────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type });
  }

  // ── filtered relationships for selected character ─────────────────────
  const visibleRelationships = selectedChar
    ? relationships.filter(
        r => r.character_id_a === selectedChar.id || r.character_id_b === selectedChar.id
      )
    : relationships;

  // ── save (create or update) ───────────────────────────────────────────
  async function handleSave() {
    const relType = form.relationship_type === '__custom__'
      ? form.relTypeCustom.trim()
      : form.relationship_type.trim();

    if (!relType) return showToast('Relationship type is required', 'error');

    if (!editRel && (!form.character_id_a || !form.character_id_b)) {
      return showToast('Both characters are required', 'error');
    }

    const payload = {
      relationship_type: relType,
      connection_mode:  form.connection_mode,
      lala_connection:  form.lala_connection,
      status:           form.status,
      notes:            form.notes,
    };

    if (!editRel) {
      payload.character_id_a = form.character_id_a;
      payload.character_id_b = form.character_id_b;
    }

    const url    = editRel ? `${API}/relationships/${editRel.id}` : `${API}/relationships`;
    const method = editRel ? 'PUT' : 'POST';

    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'Save failed', 'error');

      showToast(editRel ? 'Relationship updated' : 'Relationship added');
      setShowForm(false);
      setEditRel(null);
      setForm(emptyForm);
      fetchAll();
    } catch (e) {
      showToast('Save failed', 'error');
    }
  }

  async function handleDelete(relId) {
    try {
      await fetch(`${API}/relationships/${relId}`, { method: 'DELETE' });
      showToast('Relationship removed');
      fetchAll();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  }

  function openEdit(rel) {
    setForm({
      character_id_a:  rel.character_id_a,
      character_id_b:  rel.character_id_b,
      relationship_type: rel.relationship_type,
      relTypeCustom:   '',
      connection_mode: rel.connection_mode,
      lala_connection: rel.lala_connection,
      status:          rel.status,
      notes:           rel.notes || '',
    });
    setEditRel(rel);
    setShowForm(true);
  }

  // ── styles ────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh',
      background: '#faf9f7',
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      color: '#1c1917',
    },
    header: {
      background: '#fff',
      borderBottom: '1px solid #e5e0d8',
      padding: '20px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    headerTitle: {
      fontSize: 20, fontWeight: 700, color: DARK,
      fontFamily: "'Cormorant Garamond', serif",
      letterSpacing: '-0.3px', margin: 0,
    },
    headerSub: { fontSize: 13, color: '#78716c', margin: 0 },
    addBtn: {
      background: GOLD, color: '#fff',
      border: 'none', borderRadius: 8,
      padding: '9px 18px', fontSize: 14, fontWeight: 600,
      cursor: 'pointer', letterSpacing: '0.2px',
    },
    layout: {
      display: 'flex', gap: 0,
      maxWidth: 1200, margin: '0 auto',
    },
    sidebar: {
      width: 240, flexShrink: 0,
      borderRight: '1px solid #e5e0d8',
      background: '#fff',
      minHeight: 'calc(100vh - 65px)',
      overflowY: 'auto',
    },
    sidebarTitle: {
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#78716c',
      padding: '18px 16px 8px',
      fontFamily: "'DM Mono', monospace",
    },
    sidebarItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 16px', cursor: 'pointer',
      background: active ? '#fef9ec' : 'transparent',
      borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
      fontSize: 13,
      color: active ? DARK : '#57534e',
      fontWeight: active ? 600 : 400,
      transition: 'background 0.1s',
    }),
    main: {
      flex: 1, padding: '28px 32px',
    },
    sectionLabel: {
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#78716c',
      marginBottom: 16,
      fontFamily: "'DM Mono', monospace",
    },
    relCard: {
      background: '#fff', border: '1px solid #e5e0d8',
      borderRadius: 10, padding: '16px 20px',
      marginBottom: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
    },
    relCardTop: {
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 8,
    },
    relNames: {
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 14, fontWeight: 600, color: DARK,
      flexWrap: 'wrap',
    },
    relType: {
      display: 'inline-block',
      fontSize: 12, fontWeight: 600,
      color: GOLD,
      padding: '1px 0',
    },
    relMeta: {
      display: 'flex', flexWrap: 'wrap', gap: 6,
      alignItems: 'center',
    },
    relActions: {
      display: 'flex', gap: 8, alignItems: 'center',
    },
    editBtn: {
      background: 'transparent', border: `1px solid ${GOLD}`,
      color: GOLD, borderRadius: 6,
      padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    },
    delBtn: {
      background: 'transparent', border: '1px solid #fca5a5',
      color: '#ef4444', borderRadius: 6,
      padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    },
    notes: {
      fontSize: 12, color: '#78716c',
      fontStyle: 'italic', marginTop: 2,
      fontFamily: "'Lora', serif",
    },
    // form modal
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.25)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    modal: {
      background: '#fff', borderRadius: 12,
      width: '100%', maxWidth: 520,
      maxHeight: '90vh', overflowY: 'auto',
      padding: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    },
    modalTitle: {
      fontSize: 17, fontWeight: 700, color: DARK,
      fontFamily: "'Cormorant Garamond', serif",
      marginBottom: 20,
    },
    fieldGroup: { marginBottom: 16 },
    label: {
      display: 'block', fontSize: 12, fontWeight: 600,
      color: '#57534e', marginBottom: 5, letterSpacing: '0.03em',
      fontFamily: "'DM Mono', monospace",
    },
    input: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
    },
    select: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
    },
    textarea: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
      fontFamily: "'Lora', serif",
      resize: 'vertical', minHeight: 72,
    },
    formActions: {
      display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24,
    },
    cancelBtn: {
      background: 'transparent', border: '1px solid #d1cbc3',
      color: '#57534e', borderRadius: 7,
      padding: '9px 20px', fontSize: 13, cursor: 'pointer',
    },
    saveBtn: {
      background: GOLD, color: '#fff',
      border: 'none', borderRadius: 7,
      padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    emptyState: {
      textAlign: 'center', padding: '60px 20px',
      color: '#78716c',
    },
    emptyIcon: { fontSize: 36, marginBottom: 12, opacity: 0.4 },
    emptyTitle: { fontSize: 15, fontWeight: 600, color: '#44403c', marginBottom: 6 },
    emptyDesc: { fontSize: 13 },
    divider: {
      fontSize: 14, color: '#9ca3af', fontWeight: 400, margin: '0 4px',
    },
  };

  // ── render ────────────────────────────────────────────────────────────
  const tabStyle = (active) => ({
    padding: '7px 18px', fontSize: 13, fontWeight: active ? 600 : 400,
    borderRadius: 8, cursor: 'pointer',
    background: active ? '#fef9ec' : 'transparent',
    border: active ? `1px solid ${GOLD}` : '1px solid transparent',
    color: active ? '#92400e' : '#78716c',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s',
  });

  return (
    <div style={view === 'web' ? { display: 'flex', flexDirection: 'column', height: '100vh', background: '#FAF8F4', fontFamily: "'DM Sans', sans-serif", color: '#1a1917', overflow: 'hidden' } : S.page}>

      {/* Header */}
      <div style={view === 'web'
        ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #e8e5df', background: '#FAF8F4', flexShrink: 0, gap: 16, flexWrap: 'wrap' }
        : S.header}>
        <div style={view === 'web' ? { display: 'flex', alignItems: 'center', gap: 16 } : S.headerLeft}>
          <p style={S.headerTitle}>Relationship Map</p>
          {view === 'map' && (
            <p style={S.headerSub}>
              {relationships.length} relationship{relationships.length !== 1 ? 's' : ''} across {characters.length} characters
            </p>
          )}
          {view === 'web' && (
            <span style={{ fontSize: 12, color: '#9c9890' }}>
              {graphNodes.length} characters · {graphEdges.length} connections
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#f5f3ef', borderRadius: 10, padding: 3 }}>
            <button type="button" style={tabStyle(view === 'map')} onClick={() => setView('map')}>
              Map
            </button>
            <button type="button" style={tabStyle(view === 'web')} onClick={() => setView('web')}>
              Web
            </button>
          </div>

          {view === 'map' && (
            <button style={S.addBtn} onClick={() => {
              setEditRel(null);
              setForm(emptyForm);
              setShowForm(true);
            }}>
              + Add Relationship
            </button>
          )}

          {view === 'web' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'real_world', 'online', 'created'].map(f => (
                <button key={f} type="button"
                  className={`rw-filter-pill ${graphFilter === f ? 'active' : ''}`}
                  onClick={() => setGraphFilter(f)}>
                  {f === 'all' ? 'All' : GROUP_LABELS[f] || f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAP VIEW (CRUD cards) ═══ */}
      {view === 'map' && (
        <>
          <div style={S.layout}>
            {/* Sidebar — character list */}
            <div style={S.sidebar}>
              <div style={S.sidebarTitle}>Characters</div>
              <div
                style={S.sidebarItem(!selectedChar)}
                onClick={() => setSelectedChar(null)}
              >
                <span style={{ fontSize: 15 }}>◎</span>
                <span>All relationships</span>
              </div>
              {characters.map(c => {
                const relCount = relationships.filter(
                  r => r.character_id_a === c.id || r.character_id_b === c.id
                ).length;
                return (
                  <div
                    key={c.id}
                    style={S.sidebarItem(selectedChar?.id === c.id)}
                    onClick={() => setSelectedChar(c)}
                  >
                    <TypeBar type={c.role_type} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {charDisplayName(c)}
                    </span>
                    {relCount > 0 && (
                      <span style={{ fontSize: 11, color: '#a8a29e', flexShrink: 0 }}>{relCount}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Main content */}
            <div style={S.main}>
              {loading ? (
                <div style={S.emptyState}>
                  <div style={S.emptyIcon}>⟳</div>
                  <div style={S.emptyTitle}>Loading…</div>
                </div>
              ) : visibleRelationships.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={S.emptyIcon}>◈</div>
                  <div style={S.emptyTitle}>
                    {selectedChar ? `No relationships for ${charDisplayName(selectedChar)} yet` : 'No relationships yet'}
                  </div>
                  <div style={S.emptyDesc}>
                    Add the first relationship to start mapping the world of LalaVerse.
                  </div>
                </div>
              ) : (
                <>
                  <div style={S.sectionLabel}>
                    {selectedChar ? `${charDisplayName(selectedChar)}'s Relationships` : 'All Relationships'}
                    &nbsp;·&nbsp;{visibleRelationships.length}
                  </div>

                  {visibleRelationships.map(rel => (
                    <div key={rel.id} style={S.relCard}>
                      <div style={S.relCardTop}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={S.relNames}>
                            <span>{getCharName(rel, 'a')}</span>
                            <span style={S.divider}>—</span>
                            <span>{getCharName(rel, 'b')}</span>
                            <span style={{ marginLeft: 4 }}>
                              <span style={S.relType}>{rel.relationship_type}</span>
                            </span>
                          </div>
                          <div style={S.relMeta}>
                            <Badge label={rel.connection_mode} colorSet={MODE_COLORS[rel.connection_mode]} />
                            <Badge label={rel.status} colorSet={STATUS_COLORS[rel.status]} />
                            <LalaDot lala_connection={rel.lala_connection} />
                          </div>
                          {rel.notes && <div style={S.notes}>"{rel.notes}"</div>}
                        </div>
                        <div style={S.relActions}>
                          <button style={S.editBtn} onClick={() => openEdit(rel)}>Edit</button>
                          <button style={S.delBtn} onClick={() => handleDelete(rel.id)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Add / Edit Modal */}
          {showForm && (
            <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditRel(null); } }}>
              <div style={S.modal}>
                <div style={S.modalTitle}>
                  {editRel ? 'Edit Relationship' : 'Add Relationship'}
                </div>

                {!editRel && (
                  <>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Character A</label>
                      <select style={S.select} value={form.character_id_a}
                        onChange={e => setForm(f => ({ ...f, character_id_a: e.target.value }))}>
                        <option value="">Select character…</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{charDisplayName(c)}</option>)}
                      </select>
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Character B</label>
                      <select style={S.select} value={form.character_id_b}
                        onChange={e => setForm(f => ({ ...f, character_id_b: e.target.value }))}>
                        <option value="">Select character…</option>
                        {characters.filter(c => c.id !== form.character_id_a)
                          .map(c => <option key={c.id} value={c.id}>{charDisplayName(c)}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div style={S.fieldGroup}>
                  <label style={S.label}>Relationship Type</label>
                  <select style={S.select}
                    value={REL_PRESETS.includes(form.relationship_type) ? form.relationship_type : (form.relationship_type ? '__custom__' : '')}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '__custom__') setForm(f => ({ ...f, relationship_type: '__custom__' }));
                      else setForm(f => ({ ...f, relationship_type: v, relTypeCustom: '' }));
                    }}>
                    <option value="">Select type…</option>
                    {REL_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {(form.relationship_type === '__custom__' ||
                    (!REL_PRESETS.includes(form.relationship_type) && form.relationship_type && form.relationship_type !== '__custom__')) && (
                    <input style={{ ...S.input, marginTop: 8 }}
                      placeholder="e.g. Brand ambassador, Ghostwriter…"
                      value={form.relTypeCustom || (form.relationship_type !== '__custom__' ? form.relationship_type : '')}
                      onChange={e => setForm(f => ({ ...f, relTypeCustom: e.target.value, relationship_type: '__custom__' }))}
                    />
                  )}
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>How They Know Each Other</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CONNECTION_MODES.map(m => (
                      <button key={m} type="button"
                        onClick={() => setForm(f => ({ ...f, connection_mode: m }))}
                        style={{
                          padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          border: form.connection_mode === m ? `2px solid ${GOLD}` : '1px solid #d1cbc3',
                          background: form.connection_mode === m ? '#fef9ec' : '#faf9f7',
                          color: form.connection_mode === m ? '#92400e' : '#57534e',
                        }}>{m}</button>
                    ))}
                  </div>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Connection to Lala</label>
                  <select style={S.select} value={form.lala_connection}
                    onChange={e => setForm(f => ({ ...f, lala_connection: e.target.value }))}>
                    {LALA_CONNECTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Relationship Status</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {STATUSES.map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm(f => ({ ...f, status: s }))}
                        style={{
                          padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          border: form.status === s ? `2px solid ${STATUS_COLORS[s]?.border || GOLD}` : '1px solid #d1cbc3',
                          background: form.status === s ? (STATUS_COLORS[s]?.bg || '#fef9ec') : '#faf9f7',
                          color: form.status === s ? (STATUS_COLORS[s]?.text || DARK) : '#57534e',
                        }}>{s}</button>
                    ))}
                  </div>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Notes (optional)</label>
                  <textarea style={S.textarea}
                    placeholder="Context, backstory, how this relationship affects the narrative…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <div style={S.formActions}>
                  <button style={S.cancelBtn} onClick={() => { setShowForm(false); setEditRel(null); setForm(emptyForm); }}>Cancel</button>
                  <button style={S.saveBtn} onClick={handleSave}>{editRel ? 'Save Changes' : 'Add Relationship'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ WEB VIEW (D3 graph) ═══ */}
      {view === 'web' && (
        <>
          {graphError && <div className="rw-error-banner">{graphError}</div>}

          <div className="rw-canvas-wrapper">
            {graphLoading ? (
              <div className="rw-loading">
                <div className="rw-loading-ring" />
                <span>Mapping the world…</span>
              </div>
            ) : d3Loaded ? (
              <svg ref={svgRef} className="rw-svg"
                onClick={() => { setSelectedNode(null); setHoveredEdge(null); }} />
            ) : (
              <div className="rw-loading">
                <div className="rw-loading-ring" />
                <span>Loading graph engine…</span>
              </div>
            )}

            <GraphLegend />

            {selectedNode && (
              <CharacterPanel
                node={selectedNode}
                edges={graphEdges}
                onNavigate={handleNavigateToCharacter}
                onClose={() => setSelectedNode(null)}
              />
            )}

            <div className="rw-hinge-callout">
              <span className="rw-hinge-dot" />
              JustAWoman → Lala is one-way. Lala doesn't know she was built.
            </div>
          </div>

          <EdgeTooltip edge={hoveredEdge} position={tooltipPos} />
        </>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
