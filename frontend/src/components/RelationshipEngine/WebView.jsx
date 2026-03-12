/**
 * WebView — D3 force-directed relationship graph
 * Prime Studios · LalaVerse
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { T, EDGE_COLOR, NODE_R, roleColor, initials } from './tokens';
import { Spinner, Pill } from './primitives';

/* ─── D3 force‐simulation hook ────────────────────────────────────── */
function useD3(svgRef, nodes, edges, onNodeClick, onEdgeHover, lastDrag, focusId) {
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;
    let dead = false, sim = null, ro = null;

    const raf = requestAnimationFrame(() => {
      if (dead || !svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      const { width: W, height: H } = svgRef.current.getBoundingClientRect();
      const w = W || 900, h = H || 600;
      const g = svg.append('g');

      svg.call(
        d3.zoom().scaleExtent([0.25, 3]).on('zoom', e => g.attr('transform', e.transform))
      );

      /* arrow markers */
      const defs = svg.append('defs');
      [...new Set(edges.map(e => e.type))].forEach(type => {
        const col = EDGE_COLOR[type] || '#94a3b8';
        defs.append('marker').attr('id', `a-${type}`)
          .attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0)
          .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', col).attr('opacity', 0.7);
      });

      /* group centers */
      const gc = { real_world: { x: w * .22, y: h * .3 }, online: { x: w * .78, y: h * .3 }, created: { x: w * .5, y: h * .72 } };
      const dc = { x: w / 2, y: h / 2 };
      const sn = nodes.map((n, i) => {
        const gp = gc[n.group] || dc;
        const a = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
        return { ...n, x: gp.x + Math.cos(a) * 90, y: gp.y + Math.sin(a) * 90 };
      });
      const nm = Object.fromEntries(sn.map(n => [n.id, n]));
      const se = edges.map(e => ({ ...e, source: nm[e.from], target: nm[e.to] })).filter(e => e.source && e.target);

      /* simulation */
      sim = d3.forceSimulation(sn)
        .force('link', d3.forceLink(se).id(dd => dd.id).distance(e => e.strength >= 4 ? 160 : 120).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-380))
        .force('center', d3.forceCenter(w / 2, h / 2))
        .force('collision', d3.forceCollide().radius(dd => (NODE_R[dd.role_type] || 24) + 16))
        .alphaDecay(0.05).velocityDecay(0.6);

      /* edges */
      const lines = g.append('g').attr('role', 'list').attr('aria-label', 'Relationship edges')
        .selectAll('line').data(se).join('line')
        .attr('stroke', e => EDGE_COLOR[e.type] || '#94a3b8').attr('stroke-width', 1.5).attr('stroke-opacity', 0.5)
        .attr('marker-end', e => `url(#a-${e.type})`).attr('class', 'rw-edge')
        .on('mouseenter', (ev, e) => onEdgeHover(e, ev))
        .on('mouseleave', () => onEdgeHover(null, null));

      /* nodes */
      const ngs = g.append('g').attr('role', 'list').attr('aria-label', 'Character nodes')
        .selectAll('g').data(sn).join('g')
        .attr('class', 'rw-node-g').attr('role', 'listitem').attr('tabindex', '0')
        .attr('aria-label', dd => dd.label)
        .call(d3.drag()
          .on('start', (ev, dd) => { if (!ev.active) sim.alphaTarget(0.15).restart(); dd.fx = dd.x; dd.fy = dd.y; })
          .on('drag', (ev, dd) => { dd.fx = ev.x; dd.fy = ev.y; })
          .on('end', (ev, dd) => { if (!ev.active) sim.alphaTarget(0); dd.fx = null; dd.fy = null; lastDrag.current = Date.now(); }))
        .on('click', (ev, dd) => { ev.stopPropagation(); onNodeClick(dd); })
        .on('keydown', (ev, dd) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onNodeClick(dd); } });

      ngs.append('circle').attr('r', dd => (NODE_R[dd.role_type] || 24) + 8).attr('fill', dd => roleColor(dd.role_type)).attr('opacity', 0.06);
      ngs.append('circle').attr('r', dd => NODE_R[dd.role_type] || 24).attr('fill', T.white).attr('stroke', dd => roleColor(dd.role_type)).attr('stroke-width', 1.5);
      ngs.append('text').attr('class', 'rw-node-label').attr('text-anchor', 'middle')
        .attr('dy', dd => (NODE_R[dd.role_type] || 24) + 15).attr('fill', T.inkMid).text(dd => dd.label);
      ngs.append('text').attr('class', 'rw-node-initials').attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('fill', dd => roleColor(dd.role_type)).text(dd => initials(dd.label));

      const r = dd => NODE_R[dd.role_type] || 24;

      /* focus highlighting */
      function focus(fid) {
        if (!fid) { ngs.style('opacity', 1); lines.style('opacity', 0.5); return; }
        const conn = new Set([fid]);
        se.forEach(e => {
          const s = typeof e.source === 'object' ? e.source.id : e.source;
          const t = typeof e.target === 'object' ? e.target.id : e.target;
          if (s === fid) conn.add(t);
          if (t === fid) conn.add(s);
        });
        ngs.style('opacity', dd => conn.has(dd.id) ? 1 : 0.08);
        lines.style('opacity', e => {
          const s = typeof e.source === 'object' ? e.source.id : e.source;
          const t = typeof e.target === 'object' ? e.target.id : e.target;
          return (s === fid || t === fid) ? 0.9 : 0.04;
        });
      }
      focus(focusId);

      /* tick */
      sim.on('tick', () => {
        lines.each(function (e) {
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / dist, uy = dy / dist;
          d3.select(this)
            .attr('x1', e.source.x + ux * r(e.source))
            .attr('y1', e.source.y + uy * r(e.source))
            .attr('x2', e.target.x - ux * (r(e.target) + 8))
            .attr('y2', e.target.y - uy * (r(e.target) + 8));
        });
        ngs.attr('transform', dd => `translate(${dd.x},${dd.y})`);
      });

      /* resize observer */
      let rt = null;
      ro = new ResizeObserver(es => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          for (const entry of es) {
            const { width: nw, height: nh } = entry.contentRect;
            if (nw > 0 && nh > 0 && sim) {
              sim.force('center', d3.forceCenter(nw / 2, nh / 2));
              sim.alpha(0.15).restart();
            }
          }
        }, 200);
      });
      ro.observe(svgRef.current);
    });

    return () => { dead = true; cancelAnimationFrame(raf); if (sim) sim.stop(); if (ro) ro.disconnect(); };
  }, [nodes, edges, onNodeClick, onEdgeHover, lastDrag, focusId]);
}

/* ═══════════════════════════════════════════════════════════════════════
   WebView
   ═══════════════════════════════════════════════════════════════════════ */
export default function WebView({ navigate }) {
  const svgRef   = useRef(null);
  const lastDrag = useRef(0);

  const [nds, setNds]   = useState([]);
  const [eds, setEds]   = useState([]);
  const [wl, setWl]     = useState(true);
  const [err, setErr]   = useState(null);
  const [sel, setSel]   = useState(null);
  const [hovE, setHovE] = useState(null);
  const [tip, setTip]   = useState(null);
  const [filt, setFilt] = useState('all');

  /* fetch data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWl(true);
      try {
        const r = await fetch('/api/v1/memories/relationship-map');
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) { setNds(d.nodes || []); setEds(d.edges || []); }
      } catch {
        if (!cancelled) setErr('Could not load relationship data.');
      } finally {
        if (!cancelled) setWl(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onNodeClick = useCallback(n => {
    if (Date.now() - lastDrag.current < 200) return;
    setSel(p => p?.id === n.id ? null : n);
  }, []);
  const onEdgeHover = useCallback((e, ev) => {
    setHovE(e);
    if (ev) setTip({ x: ev.clientX, y: ev.clientY });
  }, []);

  const vn = useMemo(() => filt === 'all' ? nds : nds.filter(n => n.group === filt), [nds, filt]);
  const ve = useMemo(() => {
    const ids = new Set(vn.map(n => n.id));
    return eds.filter(e => ids.has(e.from) && ids.has(e.to));
  }, [eds, vn]);

  useD3(svgRef, vn, ve, onNodeClick, onEdgeHover, lastDrag, sel?.id);

  if (wl) return <Spinner />;

  const filters = ['all', 'real_world', 'online', 'created'];
  const filterLabel = { all: 'All', real_world: 'Real World', online: 'Online', created: 'Created' };

  return (
    <div className="re-webview" role="region" aria-label="Relationship web graph">
      {/* filter bar */}
      <div className="re-webview-bar">
        <span className="re-webview-stats">{nds.length} nodes · {eds.length} edges</span>
        <div className="re-webview-filters" role="tablist" aria-label="Filter by group">
          {filters.map(f => (
            <button key={f} role="tab" aria-selected={filt === f}
              className={`re-webview-filter ${filt === f ? 'is-active' : ''}`}
              onClick={() => setFilt(f)}>
              {filterLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {/* graph */}
      <div className="re-webview-canvas">
        {err && <div className="re-webview-error" role="alert">{err}</div>}
        <svg ref={svgRef} className="rw-svg" aria-label="Relationship force graph"
          onClick={() => { setSel(null); setHovE(null); }} />

        {/* hinge note */}
        <div className="re-webview-hinge">
          <span className="re-webview-hinge-dot" />
          JustAWoman → Lala is one-way. Lala doesn't know she was built.
        </div>

        {/* node info panel */}
        {sel && (
          <div className="re-webview-info re-fade-in" role="dialog" aria-label={`Character: ${sel.label}`}>
            <div className="re-accent-bar" />
            <div className="re-webview-info-body">
              <button onClick={() => setSel(null)} className="re-close-btn" aria-label="Close panel">×</button>
              <div className="re-webview-info-name">{sel.label}</div>
              <div className="re-webview-info-role" style={{ color: roleColor(sel.role_type) }}>{sel.role_type}</div>
              {sel.bio && <div className="re-webview-info-bio">{sel.bio}</div>}
              <button onClick={() => navigate('/character-registry')} className="cg-btn-secondary re-webview-info-link">
                Open Character →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* edge tooltip */}
      {hovE && tip && (
        <div className="re-webview-tooltip" role="tooltip" style={{ left: tip.x + 10, top: tip.y - 6 }}>
          <div className="re-webview-tooltip-header">
            <span>{hovE.from}</span>
            <span style={{ color: EDGE_COLOR[hovE.type] || T.inkFaint }}>
              {hovE.direction === 'two_way' ? '↔' : '→'}
            </span>
            <span>{hovE.to}</span>
            <Pill color={EDGE_COLOR[hovE.type] || T.inkDim}>{hovE.type}</Pill>
          </div>
          {hovE.from_knows && <div className="re-webview-tooltip-detail">{hovE.from_knows}</div>}
          {!hovE.to_knows && hovE.direction === 'one_way' && (
            <div className="re-webview-tooltip-unaware">{hovE.to} is unaware.</div>
          )}
        </div>
      )}
    </div>
  );
}
