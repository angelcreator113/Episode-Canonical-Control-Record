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
import { T, EDGE_COLOR, NODE_R, roleColor, roleLabel, initials, cname, sideName, typeLabel, humanize, isRomance, isFamily } from './tokens';
import { Pill } from './primitives';

/** The kind of line a relationship draws (EDGE_COLOR's keys). */
export function edgeKind(r) {
  if (isRomance(r)) return 'romantic';
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

/* ─── labels ───────────────────────────────────────────────────────── */
const LABEL_MAX = 16;
/** A node's name under it: clipped when long; the full name on hover, focus or when picked. */
export const shortLabel = (name, max = LABEL_MAX) => {
  const t = String(name || '');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const nodeR = dd => NODE_R[dd.role_type] || 24;

/*
 * The D3 force graph. The layout is built once per set of people and pairs;
 * picking a person only restyles it (focusId), so the graph does not jump
 * and re-settle on every tap. Handlers are read through a ref, so a new
 * callback from the page does not rebuild it either.
 */
function useD3(svgRef, nodes, edges, handlers, focusId) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const focusRef = useRef(focusId);
  focusRef.current = focusId;
  const graphRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return undefined;
    let dead = false, sim = null, ro = null, rt = null;
    const on = name => (...args) => handlersRef.current[name]?.(...args);

    const raf = requestAnimationFrame(() => {
      if (dead || !svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      const box = svgRef.current.getBoundingClientRect();
      const size = { w: box.width || 900, h: box.height || 600 };
      // Beside a wide graph the person card sits on the right (240px): the
      // layout keeps clear of it, so a picked person is never under it.
      const room = () => size.w - (size.w > 700 ? 260 : 0);
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

      // Start everyone on an ellipse across the whole canvas, not a small
      // ring in the middle, so the settled graph uses the space it has.
      const sn = nodes.map((n, i) => {
        const a = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
        return { ...n, x: room() / 2 + Math.cos(a) * room() * 0.36, y: size.h / 2 + Math.sin(a) * size.h * 0.34 };
      });
      const nm = Object.fromEntries(sn.map(n => [n.id, n]));
      const se = edges.map(e => ({ ...e, source: nm[e.from], target: nm[e.to] })).filter(e => e.source && e.target);

      /* simulation: spacing grows with the canvas (a third of its short side), so
         a hub with many ties (Lala) does not pull everyone into the middle */
      const spread = () => Math.max(110, Math.min(280, Math.min(room(), size.h) * 0.36));
      // A name takes room too: the collision radius covers its label.
      const labelRoom = dd => Math.max(nodeR(dd) + 18, shortLabel(dd.label).length * 3.6 + 6);
      sim = d3.forceSimulation(sn)
        .force('link', d3.forceLink(se).id(dd => dd.id).distance(spread).strength(0.12))
        .force('charge', d3.forceManyBody().strength(() => -spread() * 4.5))
        .force('x', d3.forceX(room() / 2).strength(0.03))
        .force('y', d3.forceY(size.h / 2).strength(0.06))
        .force('collision', d3.forceCollide().radius(labelRoom))
        .alphaDecay(0.05).velocityDecay(0.6);

      /* edges */
      const lines = g.append('g').attr('role', 'list').attr('aria-label', 'Relationship edges')
        .selectAll('line').data(se).join('line')
        .attr('stroke', e => EDGE_COLOR[e.type] || '#94a3b8').attr('stroke-width', 1.5).attr('stroke-opacity', 0.5)
        .attr('marker-end', e => `url(#a-${e.type})`).attr('class', 'rw-edge')
        .style('cursor', 'pointer')
        .on('mouseenter', (ev, e) => on('onEdgeHover')(e, ev))
        .on('mouseleave', () => on('onEdgeHover')(null, null))
        .on('click', (ev, e) => { ev.stopPropagation(); on('onEdgeClick')(e); });
      // A wide invisible line over each edge: one a finger can tap.
      const hits = g.append('g').selectAll('line').data(se).join('line')
        .attr('stroke', 'transparent').attr('stroke-width', 18).style('cursor', 'pointer')
        .on('click', (ev, e) => { ev.stopPropagation(); on('onEdgeClick')(e); });

      /* nodes */
      const ngs = g.append('g').attr('role', 'list').attr('aria-label', 'Character nodes')
        .selectAll('g').data(sn).join('g')
        .attr('class', 'rw-node-g').attr('role', 'listitem').attr('tabindex', '0')
        .attr('aria-label', dd => dd.label).attr('data-id', dd => dd.id)
        .call(d3.drag()
          .on('start', (ev, dd) => { if (!ev.active) sim.alphaTarget(0.15).restart(); dd.fx = dd.x; dd.fy = dd.y; dd.moved = false; })
          .on('drag', (ev, dd) => { dd.fx = ev.x; dd.fy = ev.y; dd.moved = true; })
          // Only a real drag swallows the click after it: a tap (no move) still opens the person.
          .on('end', (ev, dd) => { if (!ev.active) sim.alphaTarget(0); dd.fx = null; dd.fy = null; if (dd.moved) on('onDragEnd')(); }))
        .on('click', (ev, dd) => { ev.stopPropagation(); on('onNodeClick')(dd); })
        .on('keydown', (ev, dd) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); on('onNodeClick')(dd); } });

      ngs.append('circle').attr('r', dd => Math.max(22, nodeR(dd) + 8)).attr('fill', dd => roleColor(dd.role_type)).attr('opacity', 0.06);
      ngs.append('circle').attr('class', 'rw-node-ring').attr('r', nodeR).attr('fill', T.white).attr('stroke', dd => roleColor(dd.role_type)).attr('stroke-width', 1.5);
      const labels = ngs.append('text').attr('class', 'rw-node-label').attr('text-anchor', 'middle')
        .attr('dy', dd => nodeR(dd) + 15).attr('fill', T.inkMid)
        // A pale outline keeps a name readable where it crosses a line.
        .attr('paint-order', 'stroke').attr('stroke', T.white).attr('stroke-width', 3).attr('stroke-linejoin', 'round')
        .text(dd => shortLabel(dd.label));
      ngs.append('title').text(dd => dd.label);
      ngs.append('text').attr('class', 'rw-node-initials').attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('fill', dd => roleColor(dd.role_type)).text(dd => initials(dd.label));

      // Hovering or tabbing to someone shows their whole name, on top.
      const showFull = (el, dd, full) => {
        d3.select(el).select('.rw-node-label').text(full ? dd.label : shortLabel(dd.label));
        if (full) d3.select(el).raise();
      };
      ngs.on('mouseenter focus', function (ev, dd) { showFull(this, dd, true); })
        .on('mouseleave blur', function (ev, dd) { showFull(this, dd, String(dd.id) === String(focusRef.current)); });

      const sid = x => String(typeof x === 'object' && x ? x.id : x);
      /* focus highlighting: a restyle only */
      function focus(fid) {
        const f = fid == null ? null : String(fid);
        labels.text(dd => (f && String(dd.id) === f ? dd.label : shortLabel(dd.label)));
        ngs.classed('is-focus', dd => !!f && String(dd.id) === f);
        ngs.select('.rw-node-ring').attr('stroke-width', dd => (f && String(dd.id) === f ? 3 : 1.5));
        if (!f) { ngs.style('opacity', 1); lines.style('opacity', 0.5); return; }
        const conn = new Set([f]);
        se.forEach(e => {
          if (sid(e.source) === f) conn.add(sid(e.target));
          if (sid(e.target) === f) conn.add(sid(e.source));
        });
        ngs.style('opacity', dd => (conn.has(String(dd.id)) ? 1 : 0.08));
        lines.style('opacity', e => (sid(e.source) === f || sid(e.target) === f ? 0.9 : 0.04));
        ngs.filter(dd => String(dd.id) === f).raise();
      }
      graphRef.current = { focus };
      focus(focusRef.current);

      /* tick: everyone stays inside the canvas */
      sim.on('tick', () => {
        sn.forEach(dd => {
          const m = nodeR(dd) + 8;
          dd.x = Math.max(m, Math.min(room() - m, dd.x));
          dd.y = Math.max(m, Math.min(size.h - m - 18, dd.y));
        });
        hits.attr('x1', e => e.source.x).attr('y1', e => e.source.y).attr('x2', e => e.target.x).attr('y2', e => e.target.y);
        lines.each(function (e) {
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / dist, uy = dy / dist;
          d3.select(this)
            .attr('x1', e.source.x + ux * nodeR(e.source))
            .attr('y1', e.source.y + uy * nodeR(e.source))
            .attr('x2', e.target.x - ux * (nodeR(e.target) + 8))
            .attr('y2', e.target.y - uy * (nodeR(e.target) + 8));
        });
        ngs.attr('transform', dd => `translate(${dd.x},${dd.y})`);
      });

      /* resize: the forces follow the canvas */
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(es => {
          clearTimeout(rt);
          rt = setTimeout(() => {
            for (const entry of es) {
              const { width: nw, height: nh } = entry.contentRect;
              if (nw > 0 && nh > 0 && sim && (Math.abs(nw - size.w) > 1 || Math.abs(nh - size.h) > 1)) {
                size.w = nw; size.h = nh;
                sim.force('x', d3.forceX(room() / 2).strength(0.03)).force('y', d3.forceY(nh / 2).strength(0.06));
                sim.alpha(0.2).restart();
              }
            }
          }, 200);
        });
        ro.observe(svgRef.current);
      }
    });

    return () => {
      dead = true; cancelAnimationFrame(raf); clearTimeout(rt);
      if (sim) sim.stop(); if (ro) ro.disconnect();
      graphRef.current = null;
    };
  }, [svgRef, nodes, edges]);

  // A new focus restyles the graph already drawn.
  useEffect(() => { graphRef.current?.focus(focusId); }, [focusId]);
}

/* ═══════════════════════════════════════════════════════════════════════
   WebView
   ═══════════════════════════════════════════════════════════════════════ */
export default function WebView({ chars = [], rels = [], lalaId = null, selectedId = null, navigate, onRelClick }) {
  const svgRef   = useRef(null);
  const lastDrag = useRef(0);

  const { nodes: nds, edges: eds } = useMemo(() => buildWeb(chars, rels, lalaId), [chars, rels, lalaId]);
  // The person the page has picked (e.g. the character page's "View full
  // map", ?char=…&tab=web) starts picked here; a tap picks another.
  const [selId, setSelId] = useState(selectedId);
  useEffect(() => { setSelId(selectedId); }, [selectedId]);
  const sel = selId == null ? null : nds.find(n => String(n.id) === String(selId)) || null;
  const [hovE, setHovE] = useState(null);
  const [tip, setTip]   = useState(null);

  const onNodeClick = useCallback(n => {
    if (Date.now() - lastDrag.current < 200) return;
    setSelId(p => (p != null && String(p) === String(n.id) ? null : n.id));
  }, []);
  const onEdgeHover = useCallback((e, ev) => {
    setHovE(e);
    if (ev) setTip({ x: ev.clientX, y: ev.clientY });
  }, []);
  const onEdgeClick = e => { setHovE(null); onRelClick?.(e.rel); };
  const onDragEnd = () => { lastDrag.current = Date.now(); };

  useD3(svgRef, nds, eds, { onNodeClick, onEdgeHover, onEdgeClick, onDragEnd }, sel?.id ?? null);

  const selRels = sel ? eds.filter(e => e.from === sel.id || e.to === sel.id) : [];

  return (
    <div className="re-webview" role="region" aria-label="Relationship web graph">
      <div className="re-webview-bar">
        <span className="re-webview-stats">{nds.length} people · {eds.length} connections · tap a person or a line</span>
      </div>

      <div className="re-webview-canvas">
        {nds.length === 0 && <div className="re-webview-error" role="status">No one in Lala&rsquo;s world yet.</div>}
        <svg ref={svgRef} className="rw-svg" aria-label="Relationship force graph"
          onClick={() => { setSelId(null); setHovE(null); }} />

        {/* person panel: a card beside the graph, a sheet across the bottom on a phone */}
        {sel && (
          <div className="re-webview-info re-fade-in" role="dialog" aria-label={`Character: ${sel.label}`}>
            <div className="re-accent-bar" />
            <div className="re-webview-info-body">
              <button onClick={() => setSelId(null)} className="re-close-btn" aria-label="Close panel">×</button>
              <div className="re-webview-info-name">{sel.label}</div>
              <div className="re-webview-info-role" style={{ color: roleColor(sel.role_type) }}>{roleLabel(sel.char, lalaId)}</div>
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
