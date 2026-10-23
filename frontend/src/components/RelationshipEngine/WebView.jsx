/**
 * WebView — D3 force-directed relationship graph
 * Prime Studios · LalaVerse
 *
 * It draws the page's own people and relationships (character_relationships,
 * the cast's confirmed pairs), so the Web shows the same pairs as every
 * other tab; it used to read the old /memories/relationship-map, which
 * carried other pairs.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { T, EDGE_COLOR, NODE_R, roleColor, initials, cname, sideName, typeLabel, humanize, isLoveInterest, isFamily } from './tokens';
import { Pill } from './primitives';

/** The kind of line a relationship draws (EDGE_COLOR's keys). */
export function edgeKind(r) {
  if (isLoveInterest(r)) return 'romantic';
  if (isFamily(r)) return 'familial';
  if (['volatile', 'fractured', 'simmering'].includes(r.tension_state)) return 'pressure';
  if (r.connection_mode === 'Professional') return 'transactional';
  return 'support';
}

/** Nodes and edges for the graph: one node per person, one edge per relationship. */
export function buildWeb(chars, rels, lalaId = null) {
  const charById = Object.fromEntries((chars || []).map(c => [c.id, c]));
  const nodes = (chars || []).map(c => ({
    id: c.id, label: cname(c),
    role_type: lalaId && String(c.id) === String(lalaId) ? 'special' : c.role_type,
    bio: c.description || c.personality || null, char: c,
  }));
  const edges = (rels || [])
    .filter(r => charById[r.character_id_a] && charById[r.character_id_b])
    .map(r => ({
      id: r.id, from: r.character_id_a, to: r.character_id_b, type: edgeKind(r), rel: r,
      fromName: sideName(r, 'a', charById), toName: sideName(r, 'b', charById),
      label: typeLabel(r), stage: r.stage || null, from_knows: r.source_knows || null,
    }));
  return { nodes, edges };
}

/* ─── D3 force‐simulation hook ────────────────────────────────────── */
function useD3(svgRef, nodes, edges, onNodeClick, onEdgeHover, onEdgeClick, lastDrag, focusId) {
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
        .style('cursor', 'pointer')
        .on('mouseenter', (ev, e) => onEdgeHover(e, ev))
        .on('mouseleave', () => onEdgeHover(null, null))
        .on('click', (ev, e) => { ev.stopPropagation(); onEdgeClick(e); });
      // A wide invisible line over each edge: one a finger can tap.
      const hits = g.append('g').selectAll('line').data(se).join('line')
        .attr('stroke', 'transparent').attr('stroke-width', 18).style('cursor', 'pointer')
        .on('click', (ev, e) => { ev.stopPropagation(); onEdgeClick(e); });

      /* nodes */
      const ngs = g.append('g').attr('role', 'list').attr('aria-label', 'Character nodes')
        .selectAll('g').data(sn).join('g')
        .attr('class', 'rw-node-g').attr('role', 'listitem').attr('tabindex', '0')
        .attr('aria-label', dd => dd.label)
        .call(d3.drag()
          .on('start', (ev, dd) => { if (!ev.active) sim.alphaTarget(0.15).restart(); dd.fx = dd.x; dd.fy = dd.y; dd.moved = false; })
          .on('drag', (ev, dd) => { dd.fx = ev.x; dd.fy = ev.y; dd.moved = true; })
          // Only a real drag swallows the click after it: a tap (no move) still opens the person.
          .on('end', (ev, dd) => { if (!ev.active) sim.alphaTarget(0); dd.fx = null; dd.fy = null; if (dd.moved) lastDrag.current = Date.now(); }))
        .on('click', (ev, dd) => { ev.stopPropagation(); onNodeClick(dd); })
        .on('keydown', (ev, dd) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onNodeClick(dd); } });

      ngs.append('circle').attr('r', dd => Math.max(22, (NODE_R[dd.role_type] || 24) + 8)).attr('fill', dd => roleColor(dd.role_type)).attr('opacity', 0.06);
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
        hits.attr('x1', e => e.source.x).attr('y1', e => e.source.y).attr('x2', e => e.target.x).attr('y2', e => e.target.y);
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
  }, [nodes, edges, onNodeClick, onEdgeHover, onEdgeClick, lastDrag, focusId]);
}

/* ═══════════════════════════════════════════════════════════════════════
   WebView
   ═══════════════════════════════════════════════════════════════════════ */
export default function WebView({ chars = [], rels = [], lalaId = null, navigate, onRelClick }) {
  const svgRef   = useRef(null);
  const lastDrag = useRef(0);

  const { nodes: nds, edges: eds } = useMemo(() => buildWeb(chars, rels, lalaId), [chars, rels, lalaId]);
  const [sel, setSel]   = useState(null);
  const [hovE, setHovE] = useState(null);
  const [tip, setTip]   = useState(null);

  const onNodeClick = useCallback(n => {
    if (Date.now() - lastDrag.current < 200) return;
    setSel(p => p?.id === n.id ? null : n);
  }, []);
  const onEdgeHover = useCallback((e, ev) => {
    setHovE(e);
    if (ev) setTip({ x: ev.clientX, y: ev.clientY });
  }, []);
  const onEdgeClick = useCallback(e => { setHovE(null); onRelClick?.(e.rel); }, [onRelClick]);

  useD3(svgRef, nds, eds, onNodeClick, onEdgeHover, onEdgeClick, lastDrag, sel?.id);

  const selRels = sel ? eds.filter(e => e.from === sel.id || e.to === sel.id) : [];

  return (
    <div className="re-webview" role="region" aria-label="Relationship web graph">
      <div className="re-webview-bar">
        <span className="re-webview-stats">{nds.length} people · {eds.length} connections · tap a person or a line</span>
      </div>

      <div className="re-webview-canvas">
        {nds.length === 0 && <div className="re-webview-error" role="status">No one in Lala&rsquo;s world yet.</div>}
        <svg ref={svgRef} className="rw-svg" aria-label="Relationship force graph"
          onClick={() => { setSel(null); setHovE(null); }} />

        {/* person panel: a card beside the graph, a sheet across the bottom on a phone */}
        {sel && (
          <div className="re-webview-info re-fade-in" role="dialog" aria-label={`Character: ${sel.label}`}>
            <div className="re-accent-bar" />
            <div className="re-webview-info-body">
              <button onClick={() => setSel(null)} className="re-close-btn" aria-label="Close panel">×</button>
              <div className="re-webview-info-name">{sel.label}</div>
              <div className="re-webview-info-role" style={{ color: roleColor(sel.role_type) }}>{humanize(sel.char?.role_type) || '—'}</div>
              {sel.bio && <div className="re-webview-info-bio">{sel.bio}</div>}
              {selRels.length > 0 && (
                <ul className="re-webview-info-rels">
                  {selRels.map(e => (
                    <li key={e.id}>
                      <button type="button" onClick={() => onRelClick?.(e.rel)}>
                        {e.from === sel.id ? e.toName : e.fromName} · {e.label}{e.stage ? ` · ${humanize(e.stage)}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => navigate(`/character/${sel.id}`)} className="cg-btn-secondary re-webview-info-link">
                Open {sel.label} →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* edge tooltip */}
      {hovE && tip && (
        <div className="re-webview-tooltip" role="tooltip" style={{ left: tip.x + 10, top: tip.y - 6 }}>
          <div className="re-webview-tooltip-header">
            <span>{hovE.fromName}</span>
            <span style={{ color: EDGE_COLOR[hovE.type] || T.inkFaint }}>↔</span>
            <span>{hovE.toName}</span>
            <Pill color={EDGE_COLOR[hovE.type] || T.inkDim}>{hovE.label}</Pill>
          </div>
          {hovE.stage && <div className="re-webview-tooltip-detail">{humanize(hovE.stage)}</div>}
          {hovE.from_knows && <div className="re-webview-tooltip-detail">{hovE.from_knows}</div>}
        </div>
      )}
    </div>
  );
}
