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
import './RelationshipEngine.css';

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

function charLayer(c) {
  if (c.universe === 'lalaverse' || c.layer === 'lalaverse') return 'lalaverse';
  if (c.universe === 'series-2' || c.layer === 'series-2') return 'series-2';
  return 'real-world';
}

function layerCompatible(a, b) {
  return charLayer(a) === charLayer(b);
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
function useD3RelationshipGraph(svgRef, nodes, edges, onNodeClick, onEdgeHover, lastDragRef, d3Ready, selectedNodeId) {
  useEffect(() => {
    const d3 = window.d3;
    if (!d3Ready || !d3 || !svgRef.current || !nodes.length) return;

    let cancelled = false;
    let sim = null;
    let resizeObserver = null;

    // Defer one frame so the CSS layout is fully settled before reading dimensions
    const raf = requestAnimationFrame(() => {
      if (cancelled || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect  = svgRef.current.getBoundingClientRect();
    const width  = rect.width  || 900;
    const height = rect.height || 600;

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

    // Group positions for pre-layout clustering
    const groupCenters = {
      'real_world': { x: width * 0.25, y: height * 0.3 },
      'online':     { x: width * 0.75, y: height * 0.3 },
      'created':    { x: width * 0.5,  y: height * 0.7 },
    };
    const defaultCenter = { x: width / 2, y: height / 2 };

    // Clone for D3 mutation — pre-position by group for faster settling
    const simNodes = nodes.map((n, i) => {
      const gc = groupCenters[n.group] || defaultCenter;
      const angle = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
      const spread = 80 + Math.random() * 40;
      return { ...n, x: gc.x + Math.cos(angle) * spread, y: gc.y + Math.sin(angle) * spread };
    });
    const nodeMap  = Object.fromEntries(simNodes.map(n => [n.id, n]));
    const simEdges = edges.map(e => ({
      ...e,
      source: nodeMap[e.from],
      target: nodeMap[e.to],
    })).filter(e => e.source && e.target);

    // Force simulation — faster settling with clustering
    sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id(d => d.id)
        .distance(e => {
          if (e.note === 'franchise_hinge') return 220;
          if (e.strength >= 4) return 160;
          return 120;
        }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (NODE_RADIUS[d.role_type] || 24) + 14))
      // Clustering forces — pull nodes toward their group region
      .force('clusterX', d3.forceX(d => (groupCenters[d.group] || defaultCenter).x).strength(0.08))
      .force('clusterY', d3.forceY(d => (groupCenters[d.group] || defaultCenter).y).strength(0.08))
      .alphaDecay(0.05)
      .velocityDecay(0.6);

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
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.15).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; lastDragRef.current = Date.now(); })
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

    // Focus highlight — dim unconnected nodes/edges when a node is selected
    function applyFocus(focusId) {
      if (!focusId) {
        nodeGs.style('opacity', 1);
        edgeLines.style('opacity', e => e.note === 'franchise_hinge' ? 1 : 0.55);
        return;
      }
      const connectedIds = new Set([focusId]);
      simEdges.forEach(e => {
        const srcId = typeof e.source === 'object' ? e.source.id : e.source;
        const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
        if (srcId === focusId) connectedIds.add(tgtId);
        if (tgtId === focusId) connectedIds.add(srcId);
      });
      nodeGs.style('opacity', d => connectedIds.has(d.id) ? 1 : 0.12);
      edgeLines.style('opacity', e => {
        const srcId = typeof e.source === 'object' ? e.source.id : e.source;
        const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
        return (srcId === focusId || tgtId === focusId) ? 0.85 : 0.06;
      }).attr('stroke-width', e => {
        const srcId = typeof e.source === 'object' ? e.source.id : e.source;
        const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
        return (srcId === focusId || tgtId === focusId) ? 3 : 1;
      });
    }
    applyFocus(selectedNodeId);

    // Watch for container resize — debounced re-center
    let resizeTimer = null;
    resizeObserver = new ResizeObserver(entries => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && sim) {
            sim.force('center', d3.forceCenter(w / 2, h / 2));
            sim.alpha(0.15).restart();
          }
        }
      }, 200);
    });
    resizeObserver.observe(svgRef.current);

    }); // end requestAnimationFrame

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (sim) sim.stop();
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [nodes, edges, onNodeClick, onEdgeHover, lastDragRef, d3Ready, selectedNodeId]);
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Server error (${res.status})`;
        throw new Error(msg);
      }
      const data = await res.json();
      setCandidates(prev => [...(data.candidates || []), ...prev]);
      showToast(`Generated ${data.count} candidate(s)`, 'success');
      setGenModalOpen(false);
      setView('candidates');
    } catch (err) { showToast(err.message || 'AI generation failed', 'error'); }
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

  // View-specific title + subtitle for center header
  const viewLabels = {
    tree:       { title: 'Family Tree',        sub: `${filteredCharacters.length} characters · ${filteredRelationships.length} relationships` },
    web:        { title: 'Relationship Web',   sub: 'D3 force-directed graph' },
    candidates: { title: 'Proposed Seeds',     sub: `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} pending review` },
    list:       { title: 'Relationship List',  sub: `${filteredRelationships.length} confirmed` },
  };
  const currentLabel = viewLabels[view] || viewLabels.tree;

  return (
    <div className="cg-shell">
      {/* Toast layer */}
      <div className="cg-toastContainer">
        {toasts.map(t => (
          <div key={t.id} className={`cg-toast is-${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* ── Sticky Top Bar ──────────────────────────────────────────── */}
      <header className="cg-topbar">
        <div className="cg-topbar-left">
          <h1 className="cg-pageTitle">Relationships</h1>
          {registries.length > 1 && (
            <select
              className="cg-registrySelect"
              value={activeRegistry || ''}
              onChange={e => setActiveRegistry(e.target.value)}
            >
              {registries.map(r => (
                <option key={r.id} value={r.id}>{r.title || r.name || r.id}</option>
              ))}
            </select>
          )}
        </div>

        {/* Stepper / Tabs */}
        <div className="cg-stepper">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`cg-stepBtn ${view === t.key ? 'is-active' : ''}`}
              onClick={() => setView(t.key)}
            >
              {t.label}
              {t.count > 0 && <span className="cg-stepCount">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="cg-topbar-actions">
          <button className="cg-btnPrimary" onClick={() => setAddModalOpen(true)}>+ Add</button>
          <button className="cg-btnSecondary" onClick={() => setGenModalOpen(true)}>✨ Generate</button>
        </div>
      </header>

      {/* ── 3-Column Body ───────────────────────────────────────────── */}
      <div className="cg-body">

        {/* ── LEFT: World Ecosystem ─────────────────────────────────── */}
        {view !== 'web' && (
          <aside className="cg-left">
            <div className="cg-panel">
              <div className="cg-panelHeader">
                <h2 className="cg-panelTitle">World Ecosystem</h2>
                <span className="cg-panelCount">{filteredCharacters.length}</span>
              </div>

              {/* Layer filters inside the panel */}
              <div className="cg-layerFilters">
                <button
                  className={`cg-filterPill ${layerFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setLayerFilter('all')}
                >All</button>
                {Object.entries(LAYER_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`cg-filterPill ${layerFilter === key ? 'is-active' : ''}`}
                    onClick={() => setLayerFilter(key)}
                    style={layerFilter === key ? { borderColor: cfg.color, color: cfg.color } : {}}
                  >
                    <span className="cg-filterDot" style={{ background: cfg.color }} />
                    {cfg.label.split('·')[0].trim()}
                    <span className="cg-filterCount">{(layers[key] || []).length}</span>
                  </button>
                ))}
              </div>

              {/* Character cards */}
              <div className="cg-worldList">
                {filteredCharacters.map(c => (
                  <button
                    key={c.id}
                    className={`cg-worldCard ${selectedChar?.id === c.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedChar(prev => prev?.id === c.id ? null : c);
                      setSelectedRel(null); setDrawerOpen(false);
                    }}
                  >
                    <div className="cg-worldCard-stripe" style={{ background: TYPE_COLORS[c.role_type] || T.slate }} />
                    <span className="cg-worldCard-icon">{c.icon || '◈'}</span>
                    <div className="cg-worldCard-info">
                      <div className="cg-worldCard-name">{charName(c)}</div>
                      <div className="cg-worldCard-role">{c.role_type || 'unknown'}</div>
                    </div>
                    <span className={`cg-badge is-${c.role_type === 'protagonist' || c.role_type === 'special' ? 'balanced' : 'oversat'}`}>
                      {c.role_type || '?'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ── CENTER: Main Canvas ───────────────────────────────────── */}
        <main className="cg-main">
          {/* Main header with title + toolbar */}
          <div className="cg-mainHeader">
            <div className="cg-mainHeader-info">
              <h2 className="cg-mainTitle">{currentLabel.title}</h2>
              <div className="cg-mainSub">{currentLabel.sub}</div>
            </div>
            <div className="cg-toolbar">
              {view === 'candidates' && candidates.length > 0 && (
                <button className="cg-toolBtn" onClick={() => setGenModalOpen(true)}>
                  ✨ Regenerate
                </button>
              )}
              {view === 'list' && (
                <button className="cg-toolBtn" onClick={() => setView('candidates')}>
                  View Seeds →
                </button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="cg-mainContent">
            <div className="cg-mainContent-inner">
              {view === 'web' ? (
                <WebView navigate={navigate} />
              ) : loading ? (
                <div className="cg-loading">
                  <div className="cg-spinner" />
                  Loading tree data...
                </div>
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
          </div>
        </main>

        {/* ── RIGHT: Inspector / Preview ────────────────────────────── */}
        {view !== 'web' && (
          <aside className="cg-right">
            {drawerOpen && selectedRel ? (
              <InspectorPanel
                rel={selectedRel}
                onClose={() => { setDrawerOpen(false); setSelectedRel(null); }}
                onUpdate={updates => updateRelationship(selectedRel.id, updates)}
                onDelete={() => deleteRelationship(selectedRel.id)}
              />
            ) : (
              <div className="cg-inspector">
                <div className="cg-inspectorHeader">
                  <h3 className="cg-inspectorTitle">Inspector</h3>
                </div>
                <div className="cg-inspectorEmpty">
                  <span className="cg-inspectorEmpty-icon">🔍</span>
                  <div className="cg-inspectorEmpty-text">
                    Select a relationship to inspect
                  </div>
                </div>
              </div>
            )}
          </aside>
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

  const lastDragRef = useRef(0);

  const handleNodeClick = useCallback(node => {
    // Ignore clicks that immediately follow a drag
    if (Date.now() - lastDragRef.current < 200) return;
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

  // Filter — memoize so new array refs are only created when data/filter actually change
  const visibleNodes = useMemo(
    () => filter === 'all' ? nodes : nodes.filter(n => n.group === filter),
    [nodes, filter]
  );
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map(n => n.id));
    return edges.filter(e => ids.has(e.from) && ids.has(e.to));
  }, [edges, visibleNodes]);

  // Render D3
  useD3RelationshipGraph(svgRef, visibleNodes, visibleEdges, handleNodeClick, handleEdgeHover, lastDragRef, d3Loaded, selectedNode?.id);

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
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="rw-legend" style={{
      maxHeight: collapsed ? 32 : 300,
      overflow: 'hidden',
      transition: 'max-height 0.25s ease',
      cursor: 'pointer',
    }} onClick={() => setCollapsed(c => !c)}>
      <div className="rw-legend-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
        Legend
      </div>
      {!collapsed && (
        <>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div key={type} className="rw-legend-item">
              <div className="rw-legend-line" style={{ background: color }} />
              <span>{type}</span>
            </div>
          ))}
          <div className="rw-legend-divider" />
          <div className="rw-legend-item"><span className="rw-legend-arrow">→</span><span>one-way (unaware)</span></div>
          <div className="rw-legend-item"><span className="rw-legend-arrow">↔</span><span>two-way</span></div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TREE VIEW — Improved layered visualization with zoom, hover, focus
// ════════════════════════════════════════════════════════════════════════
function TreeView({ characters, relationships, layers, layerFilter, selectedChar, onSelectRel, onSelectChar }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 1200, h: 700 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [viewBox, setViewBox] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setDims({ w: width, h: Math.max(500, height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layerKeys = layerFilter === 'all'
    ? ['real-world', 'lalaverse', 'series-2']
    : [layerFilter];

  // Calculate dynamic dimensions based on character count
  const maxCharsInLayer = Math.max(1, ...layerKeys.map(lk => (layers[lk] || []).length));
  const svgW = Math.max(dims.w, maxCharsInLayer * 120 + 80);
  const bandH = Math.max(200, dims.h / (layerKeys.length + 0.3));
  const svgH = bandH * layerKeys.length + 60;

  const nodePositions = useMemo(() => {
    const pos = {};
    layerKeys.forEach((lk, li) => {
      const chars = layers[lk] || [];
      const bandY = bandH * li + bandH * 0.55;
      const spacing = svgW / (chars.length + 1);
      chars.forEach((c, ci) => {
        pos[c.id] = { x: spacing * (ci + 1), y: bandY, char: c, layer: lk };
      });
    });
    return pos;
  }, [characters, layers, layerFilter, svgW, bandH]);

  const edges = useMemo(() => {
    return relationships.filter(
      r => nodePositions[r.character_id_a] && nodePositions[r.character_id_b]
    ).map(r => ({
      rel: r,
      from: nodePositions[r.character_id_a],
      to: nodePositions[r.character_id_b],
    }));
  }, [relationships, nodePositions]);

  // Connections for selected character — highlight those edges
  const selectedConns = useMemo(() => {
    if (!selectedChar) return new Set();
    const ids = new Set();
    relationships.forEach(r => {
      if (r.character_id_a === selectedChar.id || r.character_id_b === selectedChar.id) {
        ids.add(r.character_id_a);
        ids.add(r.character_id_b);
      }
    });
    return ids;
  }, [selectedChar, relationships]);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => {
      const vb = prev || { x: 0, y: 0, w: svgW, h: svgH };
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const nw = Math.min(svgW * 3, Math.max(300, vb.w * factor));
      const nh = Math.min(svgH * 3, Math.max(200, vb.h * factor));
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, [svgW, svgH]);

  // Pan with mouse drag
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.tree-interactive')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, vb: viewBox || { x: 0, y: 0, w: svgW, h: svgH } };
  }, [viewBox, svgW, svgH]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning || !panStart.current) return;
    const dx = (e.clientX - panStart.current.x) * (panStart.current.vb.w / dims.w);
    const dy = (e.clientY - panStart.current.y) * (panStart.current.vb.h / dims.h);
    setViewBox({
      x: panStart.current.vb.x - dx,
      y: panStart.current.vb.y - dy,
      w: panStart.current.vb.w,
      h: panStart.current.vb.h,
    });
  }, [isPanning, dims]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const vb = viewBox || { x: 0, y: 0, w: svgW, h: svgH };

  // Calculate curved path for edges to avoid overlap
  const edgePath = useCallback((from, to, idx, total) => {
    if (Math.abs(from.y - to.y) > 10) {
      // Cross-layer: use a gentle S-curve
      const midY = (from.y + to.y) / 2;
      const offset = total > 1 ? (idx - (total - 1) / 2) * 30 : 0;
      return `M${from.x},${from.y} C${from.x + offset},${midY} ${to.x - offset},${midY} ${to.x},${to.y}`;
    }
    // Same layer: arc above
    const dx = to.x - from.x;
    const dist = Math.abs(dx);
    const arcH = Math.min(80, dist * 0.3) + (idx * 15);
    const midX = (from.x + to.x) / 2;
    const midY = from.y - arcH;
    return `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`;
  }, []);

  // Group edges by pair for offset calculation
  const edgePairCounts = useMemo(() => {
    const counts = {};
    edges.forEach(e => {
      const key = [e.from.char.id, e.to.char.id].sort().join('-');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [edges]);

  const edgePairIndex = {};

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 5,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'rgba(250,247,240,0.9)', borderRadius: 8, padding: 4,
        border: `1px solid ${T.border}`, boxShadow: T.shadow,
      }}>
        <button onClick={() => setViewBox(prev => {
          const vb = prev || { x: 0, y: 0, w: svgW, h: svgH };
          const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
          const nw = vb.w * 0.8, nh = vb.h * 0.8;
          return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
        })} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, borderRadius: 4 }}
          title="Zoom in">+</button>
        <button onClick={() => setViewBox(prev => {
          const vb = prev || { x: 0, y: 0, w: svgW, h: svgH };
          const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
          const nw = Math.min(svgW * 3, vb.w * 1.25), nh = Math.min(svgH * 3, vb.h * 1.25);
          return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
        })} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, borderRadius: 4 }}
          title="Zoom out">−</button>
        <button onClick={() => setViewBox(null)}
          style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, borderRadius: 4 }}
          title="Reset view">⟲</button>
      </div>

      <svg
        width={dims.w} height={dims.h}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ display: 'block', background: T.parchment, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Layer bands */}
        {layerKeys.map((lk, li) => {
          const cfg = LAYER_CONFIG[lk];
          return (
            <g key={lk}>
              <rect x={vb.x - 50} y={bandH * li} width={svgW + 100} height={bandH}
                fill={cfg.color} opacity={0.04} />
              <text x={vb.x + 16} y={bandH * li + 28} fill={cfg.color} opacity={0.55}
                style={{ fontSize: 12, fontFamily: T.fontMono, fontWeight: 700, letterSpacing: '0.06em' }}>
                {cfg.label.toUpperCase()}
              </text>
              <line x1={vb.x - 50} y1={bandH * (li + 1)} x2={svgW + 50} y2={bandH * (li + 1)}
                stroke={cfg.color} strokeOpacity={0.12} strokeDasharray="8,6" />
            </g>
          );
        })}

        {/* Edges — curved paths */}
        {edges.map((e, i) => {
          const pairKey = [e.from.char.id, e.to.char.id].sort().join('-');
          const pairTotal = edgePairCounts[pairKey] || 1;
          edgePairIndex[pairKey] = (edgePairIndex[pairKey] || 0) + 1;
          const pairIdx = edgePairIndex[pairKey] - 1;

          const tensionColor = e.rel.tension_state && TENSION_COLORS[e.rel.tension_state]
            ? TENSION_COLORS[e.rel.tension_state].text : T.slate;

          const isConnected = selectedChar && (
            e.rel.character_id_a === selectedChar.id || e.rel.character_id_b === selectedChar.id
          );
          const isDimmed = selectedChar && !isConnected;
          const isHovered = hoveredEdge === i;

          return (
            <g key={i} className="tree-interactive"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectRel(e.rel)}
              onMouseEnter={() => setHoveredEdge(i)}
              onMouseLeave={() => setHoveredEdge(null)}
            >
              <path
                d={edgePath(e.from, e.to, pairIdx, pairTotal)}
                fill="none"
                stroke={tensionColor}
                strokeWidth={isHovered ? 3 : isConnected ? 2.5 : 1.5}
                opacity={isDimmed ? 0.12 : isHovered ? 0.9 : 0.45}
                strokeDasharray={e.rel.tension_state === 'fractured' ? '4,3' : 'none'}
              />
              {/* Edge label only shown on hover or when connected to selected */}
              {(isHovered || isConnected) && (
                <text
                  x={(e.from.x + e.to.x) / 2}
                  y={Math.abs(e.from.y - e.to.y) > 10
                    ? (e.from.y + e.to.y) / 2 - 8
                    : e.from.y - Math.min(60, Math.abs(e.to.x - e.from.x) * 0.25) - 6
                  }
                  textAnchor="middle" fill={tensionColor}
                  style={{ fontSize: 9, fontFamily: T.fontMono, fontWeight: 600 }}
                >
                  {e.rel.relationship_type}
                  {e.rel.tension_state ? ` · ${e.rel.tension_state}` : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {Object.entries(nodePositions).map(([cId, pos]) => {
          const isSelected = selectedChar?.id === cId;
          const isConnected = selectedConns.has(cId);
          const isDimmed = selectedChar && !isSelected && !isConnected;
          const isHovered = hoveredNode === cId;
          const typeColor = TYPE_COLORS[pos.char.role_type] || T.slate;
          const r = isSelected ? 24 : isHovered ? 22 : 18;

          return (
            <g key={cId} transform={`translate(${pos.x}, ${pos.y})`}
              className="tree-interactive"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectChar(pos.char)}
              onMouseEnter={() => setHoveredNode(cId)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Selection glow */}
              {(isSelected || isHovered) && (
                <circle r={r + 8} fill={typeColor} opacity={isSelected ? 0.12 : 0.06} />
              )}
              {/* Main circle */}
              <circle r={r} fill={isDimmed ? '#f0ede8' : T.white}
                stroke={typeColor}
                strokeWidth={isSelected ? 3 : 2}
                opacity={isDimmed ? 0.4 : 1}
              />
              {/* Initials */}
              <text textAnchor="middle" dominantBaseline="central"
                fill={isDimmed ? T.slate : typeColor}
                opacity={isDimmed ? 0.3 : 1}
                style={{ fontSize: r > 20 ? 13 : 11, fontFamily: T.font, fontWeight: 700 }}>
                {charName(pos.char).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </text>
              {/* Name label */}
              <text y={r + 16} textAnchor="middle" fill={isDimmed ? T.slate : T.ink}
                opacity={isDimmed ? 0.25 : 1}
                style={{ fontSize: 10, fontFamily: T.font, fontWeight: 600 }}>
                {charName(pos.char).length > 18 ? charName(pos.char).slice(0, 16) + '…' : charName(pos.char)}
              </text>
              {/* Role bar */}
              <rect x={-14} y={r + 22} width={28} height={2.5} rx={1.25}
                fill={typeColor} opacity={isDimmed ? 0.1 : 0.5} />
              {/* Connection count badge */}
              {!isDimmed && (() => {
                const count = relationships.filter(r => r.character_id_a === cId || r.character_id_b === cId).length;
                return count > 0 ? (
                  <g transform={`translate(${r - 2}, ${-r + 2})`}>
                    <circle r={8} fill={typeColor} />
                    <text textAnchor="middle" dominantBaseline="central" fill={T.white}
                      style={{ fontSize: 8, fontWeight: 700 }}>{count}</text>
                  </g>
                ) : null;
              })()}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredNode && nodePositions[hoveredNode] && (() => {
          const pos = nodePositions[hoveredNode];
          const c = pos.char;
          const rels = relationships.filter(r => r.character_id_a === hoveredNode || r.character_id_b === hoveredNode);
          const tooltipW = 180;
          const tooltipH = 50 + rels.length * 14;
          const tx = pos.x + 30;
          const ty = pos.y - tooltipH / 2;
          return (
            <g transform={`translate(${tx}, ${ty})`} style={{ pointerEvents: 'none' }}>
              <rect width={tooltipW} height={tooltipH} rx={6} fill="rgba(250,247,240,0.95)"
                stroke={T.border} strokeWidth={1} filter="url(#treeShadow)" />
              <text x={10} y={20} fill={T.ink} style={{ fontSize: 12, fontFamily: T.font, fontWeight: 700 }}>
                {charName(c)}
              </text>
              <text x={10} y={34} fill={TYPE_COLORS[c.role_type] || T.slate}
                style={{ fontSize: 10, fontFamily: T.fontMono, fontWeight: 600 }}>
                {c.role_type} · {rels.length} connection{rels.length !== 1 ? 's' : ''}
              </text>
              {rels.slice(0, 4).map((r, ri) => {
                const other = r.character_id_a === hoveredNode ? r.character_b_name : r.character_a_name;
                return (
                  <text key={ri} x={10} y={50 + ri * 14} fill={T.inkLight}
                    style={{ fontSize: 9, fontFamily: T.font }}>
                    {r.relationship_type} → {other || '?'}
                  </text>
                );
              })}
              {rels.length > 4 && (
                <text x={10} y={50 + 4 * 14} fill={T.slate}
                  style={{ fontSize: 9, fontFamily: T.fontMono }}>
                  +{rels.length - 4} more…
                </text>
              )}
            </g>
          );
        })()}

        {/* SVG filter for tooltip shadow */}
        <defs>
          <filter id="treeShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
          </filter>
        </defs>
      </svg>

      {/* Bottom stats bar */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 16, padding: '6px 16px',
        background: 'rgba(250,247,240,0.92)', borderRadius: 20,
        border: `1px solid ${T.border}`, fontSize: 11, fontFamily: T.fontMono,
        color: T.inkLight, boxShadow: T.shadow,
      }}>
        <span>{characters.length} characters</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{relationships.length} relationships</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CANDIDATE VIEW
// ════════════════════════════════════════════════════════════════════════
function CandidateView({ candidates, onConfirm, onDismiss }) {
  if (candidates.length === 0) {
    return (
      <div className="cg-empty">
        <span className="cg-emptyIcon">✨</span>
        <h3 className="cg-emptyTitle">No Proposed Seeds Yet</h3>
        <p className="cg-emptyText">
          Let the AI analyse your character registry and suggest new relationships
          with tension states, LalaVerse mirrors, and career echoes.
        </p>
        <div className="cg-emptySteps">
          <div className="cg-emptyStep">
            <span className="cg-emptyStepNum">1</span>
            Select a world
          </div>
          <div className="cg-emptyStep">
            <span className="cg-emptyStepNum">2</span>
            Generate seeds
          </div>
          <div className="cg-emptyStep">
            <span className="cg-emptyStepNum">3</span>
            Confirm or dismiss
          </div>
        </div>
        {/* Skeleton preview cards */}
        <div className="cg-skeletonGrid">
          {[1, 2, 3].map(i => (
            <div key={i} className="cg-skeletonCard">
              <div className="cg-skeletonLine short" />
              <div className="cg-skeletonLine full" />
              <div className="cg-skeletonLine medium" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="cg-seedGrid">
      {candidates.map(c => (
        <div key={c.id} className="cg-seedCard">
          <div className="cg-seedStripe" />
          <div className="cg-seedBody">
            <div className="cg-seedTop">
              <div className="cg-seedNames">
                <span className="cg-seedName">{c.character_a_name || 'Character A'}</span>
                <span className="cg-seedArrow">↔</span>
                <span className="cg-seedName">{c.character_b_name || 'Character B'}</span>
              </div>
              <span className="cg-seedMeta">{c.connection_mode}</span>
            </div>
            <div className="cg-seedType">{c.relationship_type}</div>
            {c.situation && <p className="cg-seedSituation">{c.situation}</p>}
            <div className="cg-seedPills">
              {c.tension_state && (
                <span className={`cg-pill cg-badge is-${c.tension_state}`}>
                  {c.tension_state}
                </span>
              )}
              {c.connection_mode && (
                <span className="cg-pill" style={{ background: '#ede9fe', color: '#4c1d95' }}>{c.connection_mode}</span>
              )}
              {c.pain_point_category && (
                <span className="cg-pill" style={{ background: '#fce7f3', color: '#831843' }}>{c.pain_point_category}</span>
              )}
            </div>
            {c.lala_mirror && (
              <div className="cg-seedMirror">
                <strong style={{ color: T.lavender }}>Mirror:</strong> {c.lala_mirror}
              </div>
            )}
            {c.career_echo_potential && (
              <div className="cg-seedMirror">
                <strong style={{ color: T.gold }}>Career Echo:</strong> {c.career_echo_potential}
              </div>
            )}
            <div className="cg-seedActions">
              <button className="cg-btnConfirm" onClick={() => onConfirm(c.id)}>✓ Confirm</button>
              <button className="cg-btnDismiss" onClick={() => onDismiss(c.id)}>✕ Dismiss</button>
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
      <div className="cg-empty">
        <span className="cg-emptyIcon">📋</span>
        <h3 className="cg-emptyTitle">No Confirmed Relationships</h3>
        <p className="cg-emptyText">
          Confirm candidate seeds or manually add relationships to populate this list.
        </p>
      </div>
    );
  }
  return (
    <div className="cg-tableWrap">
      <table className="cg-table">
        <thead>
          <tr>
            <th>Character A</th>
            <th>Type</th>
            <th>Character B</th>
            <th>Mode</th>
            <th>Tension</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map(r => (
            <tr key={r.id} onClick={() => onSelect(r)}>
              <td>{r.character_a_name}</td>
              <td><span className="cg-pill" style={{ background: '#f3f4f6', color: '#374151' }}>{r.relationship_type}</span></td>
              <td>{r.character_b_name}</td>
              <td>{r.connection_mode}</td>
              <td>
                {r.tension_state && (
                  <span className={`cg-pill cg-badge is-${r.tension_state}`}>
                    {r.tension_state}
                  </span>
                )}
              </td>
              <td>{r.status}</td>
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
// INSPECTOR PANEL (right column)
// ════════════════════════════════════════════════════════════════════════
function InspectorPanel({ rel, onClose, onUpdate, onDelete }) {
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
    <div className="cg-inspector">
      <div className="cg-inspectorHeader">
        <h3 className="cg-inspectorTitle">Relationship Detail</h3>
        <button className="cg-closeBtn" onClick={onClose}>✕</button>
      </div>
      <div className="cg-inspectorBody">
        {/* Characters display */}
        <div className="cg-inspectorChars">
          <div className="cg-inspectorCharBox">
            <span className="cg-inspectorCharIcon">{rel.character_a_icon || '◈'}</span>
            <span className="cg-inspectorCharName">{rel.character_a_name}</span>
            {rel.character_a_type && (
              <span className="cg-pill" style={{ background: (TYPE_COLORS[rel.character_a_type] || T.slate) + '22', color: TYPE_COLORS[rel.character_a_type] || T.slate }}>
                {rel.character_a_type}
              </span>
            )}
          </div>
          <span className="cg-inspectorArrow">↔</span>
          <div className="cg-inspectorCharBox">
            <span className="cg-inspectorCharIcon">{rel.character_b_icon || '◈'}</span>
            <span className="cg-inspectorCharName">{rel.character_b_name}</span>
            {rel.character_b_type && (
              <span className="cg-pill" style={{ background: (TYPE_COLORS[rel.character_b_type] || T.slate) + '22', color: TYPE_COLORS[rel.character_b_type] || T.slate }}>
                {rel.character_b_type}
              </span>
            )}
          </div>
        </div>

        {editing ? (
          <div className="cg-editForm">
            <label className="cg-formLabel">Relationship Type</label>
            <input className="cg-formInput" value={form.relationship_type}
              onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))} />
            <label className="cg-formLabel">Connection Mode</label>
            <select className="cg-formSelect" value={form.connection_mode}
              onChange={e => setForm(f => ({ ...f, connection_mode: e.target.value }))}>
              {CONNECTION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <label className="cg-formLabel">Status</label>
            <select className="cg-formSelect" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="cg-formLabel">Tension State</label>
            <select className="cg-formSelect" value={form.tension_state}
              onChange={e => setForm(f => ({ ...f, tension_state: e.target.value }))}>
              <option value="">None</option>
              {TENSION_STATES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="cg-formLabel">Pain Point Category</label>
            <input className="cg-formInput" value={form.pain_point_category}
              onChange={e => setForm(f => ({ ...f, pain_point_category: e.target.value }))}
              placeholder="e.g. identity, trust, loyalty..." />
            <label className="cg-formLabel">Situation</label>
            <textarea className="cg-formInput" style={{ minHeight: 60 }} value={form.situation}
              onChange={e => setForm(f => ({ ...f, situation: e.target.value }))} />
            <label className="cg-formLabel">Lala Mirror</label>
            <textarea className="cg-formInput" style={{ minHeight: 60 }} value={form.lala_mirror}
              onChange={e => setForm(f => ({ ...f, lala_mirror: e.target.value }))} />
            <label className="cg-formLabel">Career Echo Potential</label>
            <textarea className="cg-formInput" style={{ minHeight: 60 }} value={form.career_echo_potential}
              onChange={e => setForm(f => ({ ...f, career_echo_potential: e.target.value }))} />
            <label className="cg-formLabel">Lala Connection</label>
            <select className="cg-formSelect" value={form.lala_connection}
              onChange={e => setForm(f => ({ ...f, lala_connection: e.target.value }))}>
              {LALA_CONNECTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <label className="cg-formLabel">Notes</label>
            <textarea className="cg-formInput" style={{ minHeight: 60 }} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <div className="cg-formActions">
              <button className="cg-btnPrimary" onClick={handleSave}>Save</button>
              <button className="cg-btnGhost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
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
            <div className="cg-formActions">
              <button className="cg-btnPrimary" onClick={() => setEditing(true)}>Edit</button>
              <button className="cg-btnDanger" onClick={onDelete}>Delete</button>
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
    <div className="cg-fieldGroup">
      <div className="cg-fieldLabel">{label}</div>
      <div className="cg-fieldValue">{value}</div>
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
    <div className="cg-overlay" onClick={onClose}>
      <div className="cg-modal" onClick={e => e.stopPropagation()}>
        <div className="cg-modalHeader">
          <h3 className="cg-modalTitle">Add Relationship</h3>
          <button className="cg-closeBtn" onClick={onClose}>✕</button>
        </div>
        <div className="cg-modalBody">
          <label className="cg-formLabel">Character A</label>
          <select className="cg-formSelect" value={form.character_id_a}
            onChange={e => setForm(f => ({ ...f, character_id_a: e.target.value }))}>
            <option value="">Select character...</option>
            {characters.map(c => <option key={c.id} value={c.id}>{charName(c)} ({c.role_type})</option>)}
          </select>

          <label className="cg-formLabel">Character B {charA && <span className="cg-formHint">— showing {charLayer(charA)} layer only</span>}</label>
          <select className="cg-formSelect" value={form.character_id_b}
            onChange={e => setForm(f => ({ ...f, character_id_b: e.target.value }))}>
            <option value="">Select character...</option>
            {compatibleB.map(c =>
              <option key={c.id} value={c.id}>{charName(c)} ({c.role_type})</option>
            )}
          </select>

          <label className="cg-formLabel">Relationship Type</label>
          <div className="cg-presetRow">
            {REL_PRESETS.map(p => (
              <button key={p}
                className={`cg-presetBtn${form.relationship_type === p.toLowerCase() ? ' is-active' : ''}`}
                onClick={() => setForm(f => ({ ...f, relationship_type: p.toLowerCase() }))}>{p}</button>
            ))}
          </div>
          <input className="cg-formInput" value={form.relationship_type}
            onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
            placeholder="Or type custom..." />

          <div className="cg-formGrid">
            <div>
              <label className="cg-formLabel">Connection Mode</label>
              <select className="cg-formSelect" value={form.connection_mode}
                onChange={e => setForm(f => ({ ...f, connection_mode: e.target.value }))}>
                {CONNECTION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="cg-formLabel">Status</label>
              <select className="cg-formSelect" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <label className="cg-formLabel">Tension State</label>
          <select className="cg-formSelect" value={form.tension_state}
            onChange={e => setForm(f => ({ ...f, tension_state: e.target.value }))}>
            <option value="">None</option>
            {TENSION_STATES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="cg-formLabel">Situation (optional)</label>
          <textarea className="cg-formInput" style={{ minHeight: 60 }} value={form.situation}
            onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
            placeholder="Describe the dynamic between them..." />

          <label className="cg-formLabel">Notes (optional)</label>
          <textarea className="cg-formInput" style={{ minHeight: 50 }} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="cg-modalFooter">
          <button className="cg-btnGhost" onClick={onClose}>Cancel</button>
          <button className={`cg-btnPrimary${valid ? '' : ' is-disabled'}`}
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
    <div className="cg-overlay" onClick={onClose}>
      <div className="cg-modal cg-modal--narrow" onClick={e => e.stopPropagation()}>
        <div className="cg-modalHeader">
          <h3 className="cg-modalTitle">✨ Generate Candidates</h3>
          <button className="cg-closeBtn" onClick={onClose}>✕</button>
        </div>
        <div className="cg-modalBody">
          <p className="cg-modalDesc">
            Claude will analyse your character registry and suggest <strong>3–5 new relationships</strong> with
            tension states, LalaVerse mirrors, and career echoes.
          </p>
          <label className="cg-formLabel">Focus Character (optional)</label>
          <select className="cg-formSelect" value={focusChar}
            onChange={e => setFocusChar(e.target.value)}>
            <option value="">Any character</option>
            {characters.map(c => <option key={c.id} value={c.id}>{charName(c)}</option>)}
          </select>
        </div>
        <div className="cg-modalFooter">
          <button className="cg-btnGhost" onClick={onClose}>Cancel</button>
          <button className={`cg-btnGenerate${generating ? ' is-generating' : ''}`}
            disabled={generating} onClick={() => onGenerate(focusChar || null)}>
            {generating ? 'Generating...' : '✨ Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}


