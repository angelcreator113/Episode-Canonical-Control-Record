/**
 * RelationshipEngine.jsx — Unified Relationship Hub
 *
 * Merges the former RelationshipMap / RelationshipWeb (D3 force graph)
 * with the Relationship Engine (three-layer tree, AI candidates, list).
 *
 * Four tabs:
 *   🌳 Tree        — SVG three-layer family tree (Real World → LalaVerse → Mirror)
 *   🕸️ Web         — D3 force-directed relationship graph
 *   ✨ Candidates  — AI-generated candidate cards with confirm/dismiss
 *   📋 List        — Simple table of confirmed relationships
 *
 * Plus:  character sidebar, detail drawer, add-relationship modal,
 *        generate-candidates modal, filter bar, toast system.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RelationshipWeb.css';

const API = '/api/v1';

// ── Design Tokens ──────────────────────────────────────────────────────
const T = {
  parchment:  '#FAF7F0',
  gold:       '#C9A84C',
  goldDark:   '#b0922e',
  ink:        '#1C1814',
  inkLight:   '#4a4540',
  lavender:   '#8b6db5',
  blush:      '#d4607a',
  slate:      '#64748b',
  white:      '#ffffff',
  border:     '#e8e4dd',
  borderFocus:'#C9A84C',
  shadow:     '0 2px 12px rgba(0,0,0,.08)',
  shadowLg:   '0 8px 32px rgba(0,0,0,.12)',
  radius:     '10px',
  radiusSm:   '6px',
  font:       "'DM Sans', 'Segoe UI', sans-serif",
  fontSerif:  "'Cormorant Garamond', 'Lora', Georgia, serif",
  fontMono:   "'DM Mono', 'Fira Code', monospace",
};

// ── Role-type colours ──────────────────────────────────────────────────
const TYPE_COLORS = {
  protagonist: '#3b82f6',
  pressure:    '#ef4444',
  mirror:      '#a855f7',
  support:     '#14b8a6',
  shadow:      '#f97316',
  special:     '#C9A84C',
};

const TENSION_COLORS = {
  calm:      { bg: '#dcfce7', text: '#14532d' },
  simmering: { bg: '#fef9c3', text: '#713f12' },
  volatile:  { bg: '#fee2e2', text: '#7f1d1d' },
  fractured: { bg: '#fce7f3', text: '#831843' },
  healing:   { bg: '#dbeafe', text: '#1e3a8a' },
};

const CONNECTION_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];
const LALA_CONNECTIONS = [
  { value: 'none',              label: 'No connection' },
  { value: 'knows_lala',        label: 'Knows Lala directly' },
  { value: 'through_justwoman', label: 'Knows JustAWoman (unaware of Lala)' },
  { value: 'interacts_content', label: 'Interacts with Lala content' },
  { value: 'unaware',           label: 'Completely unaware' },
];
const STATUSES = ['Active', 'Past', 'One-sided', 'Complicated'];
const TENSION_STATES = ['calm', 'simmering', 'volatile', 'fractured', 'healing'];
const REL_PRESETS = [
  'Sister', 'Brother', 'Mother', 'Father', 'Husband', 'Wife',
  'Boyfriend', 'Girlfriend', 'Best Friend', 'Friend', 'Acquaintance',
  'Stylist', 'Designer', 'Brand Contact', 'Manager', 'Collaborator',
  'Mentor', 'Rival', 'Inspiration', 'Fan', 'Ex-Partner', 'Therapist',
];

const LAYER_CONFIG = {
  'real-world': { label: 'Real World · JustAWoman', color: '#3b82f6', y: 0 },
  'lalaverse':  { label: 'LalaVerse',               color: '#a855f7', y: 1 },
  'series-2':   { label: 'Mirror · Series 2',       color: '#C9A84C', y: 2 },
};

// ── D3 Web View constants ──────────────────────────────────────────────
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

const NODE_RADIUS = {
  special:     36,
  protagonist: 36,
  pressure:    28,
  mirror:      24,
  support:     20,
  shadow:      20,
};

// ── Helpers ────────────────────────────────────────────────────────────
function charName(c) {
  return c.selected_name || c.display_name || c.character_key || '???';
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

// ════════════════════════════════════════════════════════════════════════
// D3 FORCE GRAPH HOOK (for Web tab)
// ════════════════════════════════════════════════════════════════════════
function useD3RelationshipGraph(svgRef, nodes, edges, onNodeClick, onEdgeHover) {
  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width  = svgRef.current.clientWidth  || 900;
    const height = svgRef.current.clientHeight || 600;

    const container = svg.append('g').attr('class', 'rw-container');
    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 2.5])
        .on('zoom', (event) => container.attr('transform', event.transform))
    );

    // Arrow markers per edge type
    const defs = svg.append('defs');
    const edgeTypes = [...new Set(edges.map(e => e.type))];
    edgeTypes.forEach(type => {
      const color = EDGE_COLORS[type] || '#94a3b8';
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color).attr('opacity', 0.8);
    });

    // Clone for D3 mutation
    const simNodes = nodes.map(n => ({ ...n }));
    const nodeMap  = Object.fromEntries(simNodes.map(n => [n.id, n]));
    const simEdges = edges.map(e => ({
      ...e,
      source: nodeMap[e.from],
      target: nodeMap[e.to],
    })).filter(e => e.source && e.target);

    // Force simulation
    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id(d => d.id)
        .distance(e => {
          if (e.note === 'franchise_hinge') return 220;
          if (e.strength >= 4) return 160;
          return 120;
        }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (NODE_RADIUS[d.role_type] || 24) + 12));

    // Edges
    const edgeGroup = container.append('g').attr('class', 'rw-edges');
    const edgeLines = edgeGroup.selectAll('line')
      .data(simEdges).join('line')
      .attr('class', 'rw-edge')
      .attr('stroke', e => EDGE_COLORS[e.type] || '#94a3b8')
      .attr('stroke-width', e => e.strength >= 5 ? 2.5 : e.strength >= 3 ? 1.8 : 1.2)
      .attr('stroke-opacity', e => e.note === 'franchise_hinge' ? 1 : 0.55)
      .attr('stroke-dasharray', '0')
      .attr('marker-end', e => `url(#arrow-${e.type})`)
      .attr('marker-start', e => e.direction === 'two_way' ? `url(#arrow-${e.type})` : null)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, e) => onEdgeHover(e, event))
      .on('mouseleave', () => onEdgeHover(null, null));

    // Nodes
    const nodeGroup = container.append('g').attr('class', 'rw-nodes');
    const nodeGs = nodeGroup.selectAll('g')
      .data(simNodes).join('g')
      .attr('class', 'rw-node-g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('click', (event, d) => { event.stopPropagation(); onNodeClick(d); });

    // Glow for franchise hinge
    nodeGs.filter(d => d.id === 'justawoman' || d.id === 'lala')
      .append('circle')
      .attr('r', d => (NODE_RADIUS[d.role_type] || 24) + 6)
      .attr('fill', 'none')
      .attr('stroke', d => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('stroke-width', 1).attr('stroke-opacity', 0.3).attr('stroke-dasharray', '4 3');

    nodeGs.append('circle')
      .attr('r', d => NODE_RADIUS[d.role_type] || 24)
      .attr('fill', '#ffffff')
      .attr('stroke', d => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('stroke-width', 2.5);

    nodeGs.append('circle')
      .attr('r', d => (NODE_RADIUS[d.role_type] || 24) - 2)
      .attr('fill', d => TYPE_COLORS[d.role_type] || '#94a3b8')
      .attr('opacity', 0.08);

    nodeGs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => (NODE_RADIUS[d.role_type] || 24) + 16)
      .attr('class', 'rw-node-label').attr('fill', '#2d2b27')
      .text(d => d.label);

    nodeGs.append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('class', 'rw-node-initials')
      .attr('fill', d => TYPE_COLORS[d.role_type] || '#94a3b8')
      .text(d => d.label.split(' ').map(w => w[0]).join('').slice(0, 2));

    // Tick
    sim.on('tick', () => {
      edgeLines
        .attr('x1', e => { const r = NODE_RADIUS[e.source.role_type] || 24; const dx = e.target.x - e.source.x; const dy = e.target.y - e.source.y; const dist = Math.sqrt(dx*dx+dy*dy)||1; return e.source.x+(dx/dist)*r; })
        .attr('y1', e => { const r = NODE_RADIUS[e.source.role_type] || 24; const dx = e.target.x - e.source.x; const dy = e.target.y - e.source.y; const dist = Math.sqrt(dx*dx+dy*dy)||1; return e.source.y+(dy/dist)*r; })
        .attr('x2', e => { const r = (NODE_RADIUS[e.target.role_type] || 24)+8; const dx = e.target.x - e.source.x; const dy = e.target.y - e.source.y; const dist = Math.sqrt(dx*dx+dy*dy)||1; return e.target.x-(dx/dist)*r; })
        .attr('y2', e => { const r = (NODE_RADIUS[e.target.role_type] || 24)+8; const dx = e.target.x - e.source.x; const dy = e.target.y - e.source.y; const dist = Math.sqrt(dx*dx+dy*dy)||1; return e.target.y-(dy/dist)*r; });
      nodeGs.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, edges, onNodeClick, onEdgeHover]);
}

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════
export default function RelationshipEngine() {
  const navigate = useNavigate();

  // ── Engine state (Tree / Candidates / List) ──────────────────────────
  const [loading, setLoading]             = useState(true);
  const [characters, setCharacters]       = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [candidates, setCandidates]       = useState([]);
  const [layers, setLayers]               = useState({});
  const [registries, setRegistries]       = useState([]);
  const [activeRegistry, setActiveRegistry] = useState(null);

  // UI state
  const [view, setView]                   = useState('tree');   // tree | web | candidates | list
  const [layerFilter, setLayerFilter]     = useState('all');
  const [selectedChar, setSelectedChar]   = useState(null);
  const [selectedRel, setSelectedRel]     = useState(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen]   = useState(false);
  const [genModalOpen, setGenModalOpen]   = useState(false);
  const [generating, setGenerating]       = useState(false);

  // Toast
  const { toasts, show: showToast } = useToast();

  // ── Fetch registries on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/character-registry/registries`);
        const data = await res.json();
        const regs = data.registries || data || [];
        setRegistries(Array.isArray(regs) ? regs : []);
        if (regs.length > 0) setActiveRegistry(regs[0].id);
      } catch {
        showToast('Failed to load registries', 'error');
      }
    })();
  }, []);

  // ── Fetch tree data when registry changes ────────────────────────────
  const fetchTree = useCallback(async (regId) => {
    if (!regId) return;
    setLoading(true);
    try {
      const [treeRes, pendingRes] = await Promise.all([
        fetch(`${API}/relationships/tree/${regId}`).then(r => r.json()),
        fetch(`${API}/relationships/pending`).then(r => r.json()),
      ]);
      setCharacters(treeRes.characters || []);
      setRelationships(treeRes.relationships?.filter(r => r.confirmed) || []);
      setLayers(treeRes.layers || {});
      setCandidates(pendingRes.candidates || []);
    } catch {
      showToast('Failed to load tree data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeRegistry) fetchTree(activeRegistry);
  }, [activeRegistry, fetchTree]);

  // ── Actions ──────────────────────────────────────────────────────────
  const confirmCandidate = async (id) => {
    try {
      const res = await fetch(`${API}/relationships/confirm/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast('Relationship confirmed!', 'success');
      fetchTree(activeRegistry);
    } catch { showToast('Failed to confirm', 'error'); }
  };

  const dismissCandidate = async (id) => {
    try {
      const res = await fetch(`${API}/relationships/dismiss/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Candidate dismissed', 'info');
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch { showToast('Failed to dismiss', 'error'); }
  };

  const deleteRelationship = async (id) => {
    if (!window.confirm('Delete this relationship?')) return;
    try {
      const res = await fetch(`${API}/relationships/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Relationship deleted', 'info');
      setRelationships(prev => prev.filter(r => r.id !== id));
      setDrawerOpen(false); setSelectedRel(null);
    } catch { showToast('Failed to delete', 'error'); }
  };

  const generateCandidates = async (focusCharId = null) => {
    setGenerating(true);
    try {
      const body = { registry_id: activeRegistry };
      if (focusCharId) body.focus_character_id = focusCharId;
      const res = await fetch(`${API}/relationships/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCandidates(prev => [...(data.candidates || []), ...prev]);
      showToast(`Generated ${data.count} candidate(s)`, 'success');
      setGenModalOpen(false);
      setView('candidates');
    } catch { showToast('AI generation failed', 'error'); }
    finally { setGenerating(false); }
  };

  const addRelationship = async (formData) => {
    try {
      const res = await fetch(`${API}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, confirmed: true }),
      });
      if (!res.ok) throw new Error();
      showToast('Relationship created!', 'success');
      setAddModalOpen(false);
      fetchTree(activeRegistry);
    } catch { showToast('Failed to create relationship', 'error'); }
  };

  const updateRelationship = async (id, updates) => {
    try {
      const res = await fetch(`${API}/relationships/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      showToast('Updated', 'success');
      fetchTree(activeRegistry);
    } catch { showToast('Failed to update', 'error'); }
  };

  // ── Filter helpers ───────────────────────────────────────────────────
  const filteredCharacters = useMemo(() => {
    if (layerFilter === 'all') return characters;
    return layers[layerFilter] || [];
  }, [characters, layers, layerFilter]);

  const filteredRelationships = useMemo(() => {
    const charIds = new Set(filteredCharacters.map(c => c.id));
    return relationships.filter(
      r => charIds.has(r.character_id_a) || charIds.has(r.character_id_b)
    );
  }, [filteredCharacters, relationships]);

  // ── View tabs config ─────────────────────────────────────────────────
  const TABS = [
    { key: 'tree',       label: '🌳 Tree' },
    { key: 'web',        label: '🕸️ Web' },
    { key: 'candidates', label: '✨ Candidates', count: candidates.length },
    { key: 'list',       label: '📋 List' },
  ];

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.page}>
      {/* Toast layer */}
      <div style={styles.toastContainer}>
        {toasts.map(t => (
          <div key={t.id} style={{
            ...styles.toast,
            background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#dbeafe',
            color: t.type === 'error' ? '#7f1d1d' : t.type === 'success' ? '#14532d' : '#1e3a8a',
          }}>{t.message}</div>
        ))}
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={styles.title}>Relationships</h1>
          {registries.length > 1 && (
            <select
              style={styles.select}
              value={activeRegistry || ''}
              onChange={e => setActiveRegistry(e.target.value)}
            >
              {registries.map(r => (
                <option key={r.id} value={r.id}>{r.title || r.name || r.id}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{ ...styles.tabBtn, ...(view === t.key ? styles.tabBtnActive : {}) }}
            >
              {t.label}
              {t.count > 0 && <span style={styles.badge}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.btnPrimary} onClick={() => setAddModalOpen(true)}>+ Add</button>
          <button style={styles.btnSecondary} onClick={() => setGenModalOpen(true)}>✨ Generate</button>
        </div>
      </div>

      {/* ── Filter bar (hidden on Web tab — it uses its own filters) ── */}
      {view !== 'web' && (
        <div style={styles.filterBar}>
          <button
            onClick={() => setLayerFilter('all')}
            style={{ ...styles.filterBtn, ...(layerFilter === 'all' ? styles.filterActive : {}) }}
          >All Layers</button>
          {Object.entries(LAYER_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setLayerFilter(key)}
              style={{
                ...styles.filterBtn,
                ...(layerFilter === key ? { ...styles.filterActive, borderColor: cfg.color, color: cfg.color } : {}),
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block', marginRight: 6 }} />
              {cfg.label}
              <span style={styles.filterCount}>{(layers[key] || []).length}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main content area ───────────────────────────────────────── */}
      <div style={styles.mainArea}>
        {/* Character sidebar (hidden on Web tab — it has its own panel) */}
        {view !== 'web' && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>Characters ({filteredCharacters.length})</div>
            <div style={styles.sidebarList}>
              {filteredCharacters.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChar(prev => prev?.id === c.id ? null : c);
                    setSelectedRel(null); setDrawerOpen(false);
                  }}
                  style={{
                    ...styles.charCard,
                    ...(selectedChar?.id === c.id ? styles.charCardActive : {}),
                    borderLeft: `3px solid ${TYPE_COLORS[c.role_type] || T.slate}`,
                  }}
                >
                  <span style={styles.charIcon}>{c.icon || '◈'}</span>
                  <div>
                    <div style={styles.charName}>{charName(c)}</div>
                    <div style={styles.charRole}>{c.role_type || 'unknown'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main view */}
        <div style={styles.mainView}>
          {view === 'web' ? (
            <WebView navigate={navigate} />
          ) : loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />Loading tree data...</div>
          ) : view === 'tree' ? (
            <TreeView
              characters={filteredCharacters}
              relationships={filteredRelationships}
              layers={layers}
              layerFilter={layerFilter}
              selectedChar={selectedChar}
              onSelectRel={rel => { setSelectedRel(rel); setDrawerOpen(true); }}
              onSelectChar={setSelectedChar}
            />
          ) : view === 'candidates' ? (
            <CandidateView candidates={candidates} onConfirm={confirmCandidate} onDismiss={dismissCandidate} />
          ) : (
            <ListView relationships={filteredRelationships} onSelect={rel => { setSelectedRel(rel); setDrawerOpen(true); }} />
          )}
        </div>

        {/* Detail drawer (not shown on Web tab) */}
        {drawerOpen && selectedRel && view !== 'web' && (
          <DetailDrawer
            rel={selectedRel}
            onClose={() => { setDrawerOpen(false); setSelectedRel(null); }}
            onUpdate={updates => updateRelationship(selectedRel.id, updates)}
            onDelete={() => deleteRelationship(selectedRel.id)}
          />
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {addModalOpen && (
        <AddRelationshipModal characters={characters} onAdd={addRelationship} onClose={() => setAddModalOpen(false)} />
      )}
      {genModalOpen && (
        <GenerateModal characters={characters} generating={generating} onGenerate={generateCandidates} onClose={() => setGenModalOpen(false)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// WEB VIEW — D3 force-directed relationship graph
// (Previously the standalone RelationshipWeb component)
// ════════════════════════════════════════════════════════════════════════
function WebView({ navigate }) {
  const svgRef = useRef(null);

  const [nodes, setNodes]               = useState([]);
  const [edges, setEdges]               = useState([]);
  const [webLoading, setWebLoading]     = useState(true);
  const [error, setError]               = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredEdge, setHoveredEdge]   = useState(null);
  const [tooltipPos, setTooltipPos]     = useState(null);
  const [filter, setFilter]             = useState('all');
  const [d3Loaded, setD3Loaded]         = useState(!!window.d3);
  const [nameToId, setNameToId]         = useState({});

  // Load D3 from CDN if needed
  useEffect(() => {
    if (window.d3) { setD3Loaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    script.onload = () => setD3Loaded(true);
    script.onerror = () => setError('Could not load D3.');
    document.head.appendChild(script);
  }, []);

  useEffect(() => { loadRelationships(); loadCharacterMap(); }, []);

  async function loadRelationships() {
    setWebLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/memories/relationship-map`);
      if (!res.ok) throw new Error('Failed to load relationship map');
      const data = await res.json();
      setNodes(data.nodes || []); setEdges(data.edges || []);
    } catch { setError('Could not load web data.'); }
    finally { setWebLoading(false); }
  }

  async function loadCharacterMap() {
    try {
      const res = await fetch(`${API}/character-registry/registries`);
      if (!res.ok) return;
      const data = await res.json();
      const regs = data.registries || data;
      const map = {};
      (Array.isArray(regs) ? regs : []).forEach(reg => {
        (reg.characters || []).forEach(c => {
          const name = (c.selected_name || c.display_name || '').toLowerCase().trim();
          if (name && c.id) map[name] = c.id;
        });
      });
      setNameToId(map);
    } catch { /* non-critical */ }
  }

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
    navigate(charId ? `/character-registry?character=${charId}` : '/character-registry?view=world');
  }, [navigate, nameToId]);

  // Filter
  const visibleNodes = filter === 'all' ? nodes : nodes.filter(n => n.group === filter);
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

  // Render D3
  useD3RelationshipGraph(svgRef, visibleNodes, visibleEdges, handleNodeClick, handleEdgeHover);

  if (webLoading) {
    return (
      <div className="rw-loading">
        <div className="rw-loading-ring" /><span>Mapping the world…</span>
      </div>
    );
  }

  return (
    <div className="rw-page" style={{ height: '100%', background: 'transparent' }}>
      {/* Sub-header with stats + filter */}
      <div className="rw-header" style={{ background: 'transparent', borderBottom: `1px solid ${T.border}` }}>
        <div className="rw-header-left">
          <div className="rw-subtitle">
            {nodes.length} characters · {edges.length} connections ·{' '}
            {edges.filter(e => e.direction === 'one_way').length} one-way
          </div>
        </div>
        <div className="rw-filter-bar">
          {['all', 'real_world', 'online', 'created'].map(f => (
            <button
              key={f}
              className={`rw-filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >{f === 'all' ? 'All' : GROUP_LABELS[f] || f}</button>
          ))}
        </div>
      </div>

      {error && <div className="rw-error-banner">{error}</div>}

      {/* Canvas */}
      <div className="rw-canvas-wrapper" style={{ flex: 1 }}>
        {d3Loaded ? (
          <svg
            ref={svgRef}
            className="rw-svg"
            onClick={() => { setSelectedNode(null); setHoveredEdge(null); }}
          />
        ) : (
          <div className="rw-loading">
            <div className="rw-loading-ring" /><span>Loading graph engine…</span>
          </div>
        )}

        <WebLegend />

        {selectedNode && (
          <WebCharacterPanel
            node={selectedNode}
            edges={edges}
            onNavigate={handleNavigateToCharacter}
            onClose={() => setSelectedNode(null)}
          />
        )}

        <div className="rw-hinge-callout">
          <span className="rw-hinge-dot" />
          JustAWoman → Lala is one-way. Lala doesn't know she was built.
        </div>
      </div>

      <WebEdgeTooltip edge={hoveredEdge} position={tooltipPos} />
    </div>
  );
}

// ── Web sub-components ─────────────────────────────────────────────────
function WebEdgeTooltip({ edge, position }) {
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

function WebCharacterPanel({ node, edges, onNavigate, onClose }) {
  const typeColor = TYPE_COLORS[node.role_type] || '#94a3b8';
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
      <button
        className="rw-panel-nav-btn"
        style={{ borderColor: typeColor, color: typeColor }}
        onClick={() => onNavigate(node)}
      >Open Character Home →</button>
    </div>
  );
}

function WebLegend() {
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

// ════════════════════════════════════════════════════════════════════════
// TREE VIEW — SVG three-layer visualization
// ════════════════════════════════════════════════════════════════════════
function TreeView({ characters, relationships, layers, layerFilter, selectedChar, onSelectRel, onSelectChar }) {
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (el) setDims({ w: el.clientWidth, h: Math.max(500, el.clientHeight) });
  }, [characters]);

  const nodePositions = useMemo(() => {
    const pos = {};
    const layerKeys = layerFilter === 'all'
      ? ['real-world', 'lalaverse', 'series-2']
      : [layerFilter];
    const bandH = dims.h / (layerKeys.length + 0.5);
    layerKeys.forEach((lk, li) => {
      const chars = layers[lk] || [];
      const bandY = bandH * (li + 0.5);
      const spacing = dims.w / (chars.length + 1);
      chars.forEach((c, ci) => {
        pos[c.id] = { x: spacing * (ci + 1), y: bandY, char: c, layer: lk };
      });
    });
    return pos;
  }, [characters, layers, layerFilter, dims]);

  const edges = useMemo(() => {
    return relationships.filter(
      r => nodePositions[r.character_id_a] && nodePositions[r.character_id_b]
    ).map(r => ({
      rel: r,
      from: nodePositions[r.character_id_a],
      to: nodePositions[r.character_id_b],
    }));
  }, [relationships, nodePositions]);

  const layerKeys = layerFilter === 'all'
    ? ['real-world', 'lalaverse', 'series-2']
    : [layerFilter];
  const bandH = dims.h / (layerKeys.length + 0.5);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} width={dims.w} height={dims.h} style={{ display: 'block', background: T.parchment }}>
        {layerKeys.map((lk, li) => {
          const cfg = LAYER_CONFIG[lk];
          return (
            <g key={lk}>
              <rect x={0} y={bandH * li} width={dims.w} height={bandH} fill={cfg.color} opacity={0.04} />
              <text x={16} y={bandH * li + 24} fill={cfg.color} opacity={0.6}
                style={{ fontSize: 13, fontFamily: T.fontMono, fontWeight: 600 }}>
                {cfg.label.toUpperCase()}
              </text>
              <line x1={0} y1={bandH * (li + 1)} x2={dims.w} y2={bandH * (li + 1)}
                stroke={cfg.color} strokeOpacity={0.15} strokeDasharray="6,4" />
            </g>
          );
        })}
        {edges.map((e, i) => {
          const tensionColor = e.rel.tension_state && TENSION_COLORS[e.rel.tension_state]
            ? TENSION_COLORS[e.rel.tension_state].text : T.slate;
          const midX = (e.from.x + e.to.x) / 2;
          const midY = (e.from.y + e.to.y) / 2;
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => onSelectRel(e.rel)}>
              <line x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
                stroke={tensionColor} strokeWidth={2} opacity={0.5} />
              <text x={midX} y={midY - 6} textAnchor="middle" fill={tensionColor}
                style={{ fontSize: 10, fontFamily: T.fontMono }}>
                {e.rel.relationship_type}
              </text>
            </g>
          );
        })}
        {Object.entries(nodePositions).map(([cId, pos]) => {
          const isSelected = selectedChar?.id === cId;
          const typeColor = TYPE_COLORS[pos.char.role_type] || T.slate;
          return (
            <g key={cId} transform={`translate(${pos.x}, ${pos.y})`}
              style={{ cursor: 'pointer' }} onClick={() => onSelectChar(pos.char)}>
              {isSelected && <circle r={28} fill={typeColor} opacity={0.15} />}
              <circle r={20} fill={T.white} stroke={typeColor} strokeWidth={isSelected ? 3 : 2} />
              <text textAnchor="middle" dominantBaseline="central" style={{ fontSize: 14 }}>
                {pos.char.icon || '◈'}
              </text>
              <text y={32} textAnchor="middle" fill={T.ink}
                style={{ fontSize: 11, fontFamily: T.font, fontWeight: 500 }}>
                {charName(pos.char).length > 14 ? charName(pos.char).slice(0, 12) + '…' : charName(pos.char)}
              </text>
              <rect x={-16} y={38} width={32} height={3} rx={1.5} fill={typeColor} opacity={0.6} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CANDIDATE VIEW
// ════════════════════════════════════════════════════════════════════════
function CandidateView({ candidates, onConfirm, onDismiss }) {
  if (candidates.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: 40 }}>✨</span>
        <p style={{ color: T.inkLight, fontFamily: T.font }}>
          No pending candidates. Click <strong>Generate</strong> to create AI suggestions.
        </p>
      </div>
    );
  }
  return (
    <div style={styles.candidateGrid}>
      {candidates.map(c => (
        <div key={c.id} style={styles.candidateCard}>
          <div style={{ ...styles.candidateStripe, background: `linear-gradient(135deg, ${T.lavender}, ${T.blush})` }} />
          <div style={styles.candidateBody}>
            <div style={styles.candidateNames}>
              <span style={styles.candidateCharName}>{c.character_a_name || 'Character A'}</span>
              <span style={styles.candidateArrow}>↔</span>
              <span style={styles.candidateCharName}>{c.character_b_name || 'Character B'}</span>
            </div>
            <div style={styles.candidateType}>{c.relationship_type}</div>
            {c.situation && <p style={styles.candidateSituation}>{c.situation}</p>}
            <div style={styles.pillRow}>
              {c.tension_state && (
                <span style={{ ...styles.pill, background: TENSION_COLORS[c.tension_state]?.bg || '#f3f4f6', color: TENSION_COLORS[c.tension_state]?.text || '#374151' }}>
                  {c.tension_state}
                </span>
              )}
              {c.connection_mode && <span style={{ ...styles.pill, background: '#ede9fe', color: '#4c1d95' }}>{c.connection_mode}</span>}
              {c.pain_point_category && <span style={{ ...styles.pill, background: '#fce7f3', color: '#831843' }}>{c.pain_point_category}</span>}
            </div>
            {c.lala_mirror && (
              <div style={styles.candidateMirror}>
                <span style={{ color: T.lavender, fontWeight: 600 }}>Mirror:</span> {c.lala_mirror}
              </div>
            )}
            {c.career_echo_potential && (
              <div style={styles.candidateMirror}>
                <span style={{ color: T.gold, fontWeight: 600 }}>Career Echo:</span> {c.career_echo_potential}
              </div>
            )}
            <div style={styles.candidateActions}>
              <button style={styles.confirmBtn} onClick={() => onConfirm(c.id)}>✓ Confirm</button>
              <button style={styles.dismissBtn} onClick={() => onDismiss(c.id)}>✕ Dismiss</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ════════════════════════════════════════════════════════════════════════
function ListView({ relationships, onSelect }) {
  if (relationships.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: 40 }}>📋</span>
        <p style={{ color: T.inkLight }}>No confirmed relationships yet.</p>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', padding: 16 }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Character A</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Character B</th>
            <th style={styles.th}>Mode</th>
            <th style={styles.th}>Tension</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map(r => (
            <tr key={r.id} style={styles.tr} onClick={() => onSelect(r)}>
              <td style={styles.td}>{r.character_a_name}</td>
              <td style={styles.td}><span style={{ ...styles.pill, background: '#f3f4f6' }}>{r.relationship_type}</span></td>
              <td style={styles.td}>{r.character_b_name}</td>
              <td style={styles.td}>{r.connection_mode}</td>
              <td style={styles.td}>
                {r.tension_state && (
                  <span style={{ ...styles.pill, background: TENSION_COLORS[r.tension_state]?.bg || '#f3f4f6', color: TENSION_COLORS[r.tension_state]?.text || '#374151' }}>
                    {r.tension_state}
                  </span>
                )}
              </td>
              <td style={styles.td}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════
function DetailDrawer({ rel, onClose, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    relationship_type: rel.relationship_type || '',
    connection_mode: rel.connection_mode || 'IRL',
    lala_connection: rel.lala_connection || 'none',
    status: rel.status || 'Active',
    tension_state: rel.tension_state || '',
    pain_point_category: rel.pain_point_category || '',
    situation: rel.situation || '',
    lala_mirror: rel.lala_mirror || '',
    career_echo_potential: rel.career_echo_potential || '',
    notes: rel.notes || '',
  });

  const handleSave = () => { onUpdate(form); setEditing(false); };

  return (
    <div style={styles.drawer}>
      <div style={styles.drawerHeader}>
        <h3 style={styles.drawerTitle}>Relationship Detail</h3>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div style={styles.drawerBody}>
        <div style={styles.drawerChars}>
          <div style={styles.drawerCharBox}>
            <span style={{ fontSize: 20 }}>{rel.character_a_icon || '◈'}</span>
            <span style={styles.drawerCharName}>{rel.character_a_name}</span>
            <span style={{ ...styles.pill, background: (TYPE_COLORS[rel.character_a_type] || T.slate) + '22', color: TYPE_COLORS[rel.character_a_type] || T.slate }}>
              {rel.character_a_type}
            </span>
          </div>
          <span style={styles.drawerArrow}>↔</span>
          <div style={styles.drawerCharBox}>
            <span style={{ fontSize: 20 }}>{rel.character_b_icon || '◈'}</span>
            <span style={styles.drawerCharName}>{rel.character_b_name}</span>
            <span style={{ ...styles.pill, background: (TYPE_COLORS[rel.character_b_type] || T.slate) + '22', color: TYPE_COLORS[rel.character_b_type] || T.slate }}>
              {rel.character_b_type}
            </span>
          </div>
        </div>

        {editing ? (
          <div style={styles.editForm}>
            <label style={styles.label}>Relationship Type</label>
            <input style={styles.input} value={form.relationship_type}
              onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))} />
            <label style={styles.label}>Connection Mode</label>
            <select style={styles.select} value={form.connection_mode}
              onChange={e => setForm(f => ({ ...f, connection_mode: e.target.value }))}>
              {CONNECTION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <label style={styles.label}>Status</label>
            <select style={styles.select} value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={styles.label}>Tension State</label>
            <select style={styles.select} value={form.tension_state}
              onChange={e => setForm(f => ({ ...f, tension_state: e.target.value }))}>
              <option value="">None</option>
              {TENSION_STATES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={styles.label}>Pain Point Category</label>
            <input style={styles.input} value={form.pain_point_category}
              onChange={e => setForm(f => ({ ...f, pain_point_category: e.target.value }))}
              placeholder="e.g. identity, trust, loyalty..." />
            <label style={styles.label}>Situation</label>
            <textarea style={{ ...styles.input, minHeight: 60 }} value={form.situation}
              onChange={e => setForm(f => ({ ...f, situation: e.target.value }))} />
            <label style={styles.label}>Lala Mirror</label>
            <textarea style={{ ...styles.input, minHeight: 60 }} value={form.lala_mirror}
              onChange={e => setForm(f => ({ ...f, lala_mirror: e.target.value }))} />
            <label style={styles.label}>Career Echo Potential</label>
            <textarea style={{ ...styles.input, minHeight: 60 }} value={form.career_echo_potential}
              onChange={e => setForm(f => ({ ...f, career_echo_potential: e.target.value }))} />
            <label style={styles.label}>Lala Connection</label>
            <select style={styles.select} value={form.lala_connection}
              onChange={e => setForm(f => ({ ...f, lala_connection: e.target.value }))}>
              {LALA_CONNECTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <label style={styles.label}>Notes</label>
            <textarea style={{ ...styles.input, minHeight: 60 }} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={styles.btnPrimary} onClick={handleSave}>Save</button>
              <button style={styles.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={styles.readFields}>
            <Field label="Type" value={rel.relationship_type} />
            <Field label="Mode" value={rel.connection_mode} />
            <Field label="Status" value={rel.status} />
            <Field label="Tension" value={rel.tension_state} />
            <Field label="Pain Point" value={rel.pain_point_category} />
            <Field label="Situation" value={rel.situation} />
            <Field label="Lala Mirror" value={rel.lala_mirror} />
            <Field label="Career Echo" value={rel.career_echo_potential} />
            <Field label="Lala Connection"
              value={LALA_CONNECTIONS.find(l => l.value === rel.lala_connection)?.label || rel.lala_connection} />
            <Field label="Notes" value={rel.notes} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={styles.btnPrimary} onClick={() => setEditing(true)}>Edit</button>
              <button style={styles.btnDanger} onClick={onDelete}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ADD RELATIONSHIP MODAL
// ════════════════════════════════════════════════════════════════════════
function AddRelationshipModal({ characters, onAdd, onClose }) {
  const [form, setForm] = useState({
    character_id_a: '', character_id_b: '',
    relationship_type: '', connection_mode: 'IRL',
    lala_connection: 'none', status: 'Active',
    tension_state: '', situation: '', notes: '',
  });

  const valid = form.character_id_a && form.character_id_b
    && form.character_id_a !== form.character_id_b && form.relationship_type;

  // Filter Character B list to same-layer only
  const charA = characters.find(c => c.id === form.character_id_a);
  const compatibleB = characters.filter(c => {
    if (c.id === form.character_id_a) return false;
    if (!charA) return true; // no A selected yet, show all
    return layerCompatible(charA, c);
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Add Relationship</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <label style={styles.label}>Character A</label>
          <select style={styles.select} value={form.character_id_a}
            onChange={e => setForm(f => ({ ...f, character_id_a: e.target.value }))}>
            <option value="">Select character...</option>
            {characters.map(c => <option key={c.id} value={c.id}>{charName(c)} ({c.role_type})</option>)}
          </select>

          <label style={styles.label}>Character B {charA && <span style={{ fontSize: 11, color: T.slate, fontWeight: 400 }}>— showing {charLayer(charA)} layer only</span>}</label>
          <select style={styles.select} value={form.character_id_b}
            onChange={e => setForm(f => ({ ...f, character_id_b: e.target.value }))}>
            <option value="">Select character...</option>
            {compatibleB.map(c =>
              <option key={c.id} value={c.id}>{charName(c)} ({c.role_type})</option>
            )}
          </select>

          <label style={styles.label}>Relationship Type</label>
          <div style={styles.presetRow}>
            {REL_PRESETS.map(p => (
              <button key={p} style={{
                ...styles.presetBtn,
                ...(form.relationship_type === p.toLowerCase() ? { background: T.gold, color: T.white } : {}),
              }} onClick={() => setForm(f => ({ ...f, relationship_type: p.toLowerCase() }))}>{p}</button>
            ))}
          </div>
          <input style={styles.input} value={form.relationship_type}
            onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
            placeholder="Or type custom..." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={styles.label}>Connection Mode</label>
              <select style={styles.select} value={form.connection_mode}
                onChange={e => setForm(f => ({ ...f, connection_mode: e.target.value }))}>
                {CONNECTION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Status</label>
              <select style={styles.select} value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <label style={styles.label}>Tension State</label>
          <select style={styles.select} value={form.tension_state}
            onChange={e => setForm(f => ({ ...f, tension_state: e.target.value }))}>
            <option value="">None</option>
            {TENSION_STATES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={styles.label}>Situation (optional)</label>
          <textarea style={{ ...styles.input, minHeight: 60 }} value={form.situation}
            onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
            placeholder="Describe the dynamic between them..." />

          <label style={styles.label}>Notes (optional)</label>
          <textarea style={{ ...styles.input, minHeight: 50 }} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button style={{ ...styles.btnPrimary, opacity: valid ? 1 : 0.5 }}
            disabled={!valid} onClick={() => onAdd(form)}>Create Relationship</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// GENERATE MODAL
// ════════════════════════════════════════════════════════════════════════
function GenerateModal({ characters, generating, onGenerate, onClose }) {
  const [focusChar, setFocusChar] = useState('');
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>✨ Generate Candidates</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <p style={{ color: T.inkLight, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Claude will analyse your character registry and suggest <strong>3–5 new relationships</strong> with
            tension states, LalaVerse mirrors, and career echoes.
          </p>
          <label style={styles.label}>Focus Character (optional)</label>
          <select style={styles.select} value={focusChar}
            onChange={e => setFocusChar(e.target.value)}>
            <option value="">Any character</option>
            {characters.map(c => <option key={c.id} value={c.id}>{charName(c)}</option>)}
          </select>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button style={{
            ...styles.btnPrimary,
            background: `linear-gradient(135deg, ${T.lavender}, ${T.blush})`,
            opacity: generating ? 0.6 : 1,
          }} disabled={generating} onClick={() => onGenerate(focusChar || null)}>
            {generating ? 'Generating...' : '✨ Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════
const styles = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100%',
    fontFamily: T.font, background: T.parchment, color: T.ink,
  },
  toastContainer: {
    position: 'fixed', top: 16, right: 16, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  toast: {
    padding: '10px 18px', borderRadius: T.radiusSm,
    fontSize: 13, fontWeight: 500, boxShadow: T.shadow,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: `1px solid ${T.border}`,
    background: T.white, flexWrap: 'wrap', gap: 12,
  },
  title: {
    fontSize: 22, fontWeight: 700, fontFamily: T.fontSerif, color: T.ink, margin: 0,
  },
  tabBtn: {
    padding: '6px 14px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
    background: T.white, color: T.inkLight, fontFamily: T.font, fontSize: 13,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
  },
  tabBtnActive: { background: T.gold, color: T.white, borderColor: T.gold },
  badge: {
    background: T.blush, color: T.white, borderRadius: 10,
    fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 4,
  },
  btnPrimary: {
    padding: '8px 18px', border: 'none', borderRadius: T.radiusSm,
    background: T.gold, color: T.white, fontFamily: T.font, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  },
  btnSecondary: {
    padding: '8px 18px', border: `1px solid ${T.lavender}`, borderRadius: T.radiusSm,
    background: T.white, color: T.lavender, fontFamily: T.font, fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 18px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
    background: 'transparent', color: T.inkLight, fontFamily: T.font, fontSize: 13, cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 18px', border: '1px solid #fee2e2', borderRadius: T.radiusSm,
    background: '#fee2e2', color: '#7f1d1d', fontFamily: T.font, fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
  filterBar: {
    display: 'flex', gap: 8, padding: '10px 24px',
    borderBottom: `1px solid ${T.border}`, background: T.white, flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '5px 12px', border: `1px solid ${T.border}`, borderRadius: 20,
    background: T.white, color: T.inkLight, fontFamily: T.font, fontSize: 12,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
  },
  filterActive: { borderColor: T.gold, color: T.gold, fontWeight: 600 },
  filterCount: { fontSize: 11, fontFamily: T.fontMono, opacity: 0.7, marginLeft: 4 },
  mainArea: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 220, borderRight: `1px solid ${T.border}`, background: T.white,
    display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
  },
  sidebarHeader: {
    padding: '12px 14px', fontSize: 12, fontWeight: 700, fontFamily: T.fontMono,
    textTransform: 'uppercase', color: T.slate, letterSpacing: '0.05em',
    borderBottom: `1px solid ${T.border}`,
  },
  sidebarList: { flex: 1, overflowY: 'auto', padding: '8px 8px' },
  charCard: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
    border: 'none', background: 'transparent', borderRadius: T.radiusSm,
    cursor: 'pointer', textAlign: 'left', fontFamily: T.font, transition: 'all 0.12s',
  },
  charCardActive: { background: '#f5f0e8' },
  charIcon: { fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 },
  charName: { fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3 },
  charRole: { fontSize: 11, color: T.slate, textTransform: 'capitalize' },
  mainView: { flex: 1, overflow: 'auto', position: 'relative' },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 12, color: T.inkLight, fontSize: 14, padding: 16,
  },
  spinner: {
    width: 32, height: 32, border: `3px solid ${T.border}`,
    borderTopColor: T.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 12, textAlign: 'center', padding: 16,
  },
  candidateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: 16 },
  candidateCard: {
    borderRadius: T.radius, overflow: 'hidden', border: `1px solid ${T.border}`,
    background: T.white, boxShadow: T.shadow, transition: 'box-shadow 0.15s',
  },
  candidateStripe: { height: 4 },
  candidateBody: { padding: 16 },
  candidateNames: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  candidateCharName: { fontSize: 14, fontWeight: 700, color: T.ink },
  candidateArrow: { fontSize: 16, color: T.slate },
  candidateType: {
    fontSize: 15, fontWeight: 700, color: T.lavender, marginBottom: 6,
    fontFamily: T.fontSerif, textTransform: 'capitalize',
  },
  candidateSituation: { fontSize: 13, color: T.inkLight, lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' },
  pillRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill: { padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, fontFamily: T.fontMono, whiteSpace: 'nowrap' },
  candidateMirror: { fontSize: 12, lineHeight: 1.5, color: T.inkLight, marginBottom: 4 },
  candidateActions: {
    display: 'flex', gap: 8, marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12,
  },
  confirmBtn: {
    flex: 1, padding: '7px 12px', border: 'none', borderRadius: T.radiusSm,
    background: '#dcfce7', color: '#14532d', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  dismissBtn: {
    flex: 1, padding: '7px 12px', border: 'none', borderRadius: T.radiusSm,
    background: '#fee2e2', color: '#7f1d1d', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: T.font, fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700,
    fontFamily: T.fontMono, textTransform: 'uppercase', color: T.slate,
    borderBottom: `2px solid ${T.border}`, letterSpacing: '0.04em',
  },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  td: { padding: '10px 12px', borderBottom: `1px solid ${T.border}` },
  drawer: {
    width: 360, borderLeft: `1px solid ${T.border}`, background: T.white,
    display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    boxShadow: '-4px 0 16px rgba(0,0,0,.06)',
  },
  drawerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderBottom: `1px solid ${T.border}`,
  },
  drawerTitle: { fontSize: 16, fontWeight: 700, fontFamily: T.fontSerif, margin: 0 },
  drawerBody: { flex: 1, overflowY: 'auto', padding: 18 },
  drawerChars: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 8,
  },
  drawerCharBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 },
  drawerCharName: { fontSize: 13, fontWeight: 700, color: T.ink, textAlign: 'center' },
  drawerArrow: { fontSize: 20, color: T.slate, flexShrink: 0 },
  closeBtn: { border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: T.slate, padding: 4 },
  editForm: { display: 'flex', flexDirection: 'column', gap: 4 },
  readFields: {},
  fieldLabel: {
    fontSize: 11, fontWeight: 700, fontFamily: T.fontMono, textTransform: 'uppercase',
    color: T.slate, marginBottom: 2, letterSpacing: '0.04em',
  },
  fieldValue: { fontSize: 14, color: T.ink, lineHeight: 1.5, marginBottom: 4 },
  label: {
    fontSize: 12, fontWeight: 600, color: T.inkLight, marginBottom: 4, marginTop: 8,
    fontFamily: T.font, display: 'block',
  },
  input: {
    width: '100%', padding: '8px 12px', border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm, fontSize: 14, fontFamily: T.font, color: T.ink,
    background: T.white, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  },
  select: {
    width: '100%', padding: '8px 12px', border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm, fontSize: 14, fontFamily: T.font, color: T.ink,
    background: T.white, outline: 'none', boxSizing: 'border-box',
  },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  presetBtn: {
    padding: '4px 10px', border: `1px solid ${T.border}`, borderRadius: 14,
    background: T.white, color: T.inkLight, fontFamily: T.font, fontSize: 12,
    cursor: 'pointer', transition: 'all 0.12s',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: T.white, borderRadius: T.radius, maxWidth: 580,
    width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: T.shadowLg, overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, fontFamily: T.fontSerif, margin: 0 },
  modalBody: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '12px 20px', borderTop: `1px solid ${T.border}`,
  },
};
