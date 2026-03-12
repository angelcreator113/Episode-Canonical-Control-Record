/**
 * TreeView — layer-stratified SVG relationship tree
 * Prime Studios · LalaVerse
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { T, LAYER, TENSION, EDGE_COLOR, roleColor, roleBg, cname, initials } from './tokens';

export default function TreeView({ chars, rels, layers, lf, selChar, onRelClick, onCharClick }) {
  const ref = useRef(null);
  const [dims, setDims]   = useState({ w: 1200, h: 680 });
  const [hovN, setHovN]   = useState(null);
  const [hovE, setHovE]   = useState(null);
  const [vb, setVb]       = useState(null);
  const [pan, setPan]     = useState(false);
  const ps = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) {
        const { width: w, height: h } = e.contentRect;
        if (w > 0 && h > 0) setDims({ w, h: Math.max(480, h) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lks  = lf === 'all' ? ['real-world', 'lalaverse', 'series-2'] : [lf];
  const maxC = Math.max(1, ...lks.map(k => (layers[k] || []).length));
  const svgW = Math.max(dims.w, maxC * 130 + 80);
  const bH   = Math.max(200, dims.h / (lks.length + 0.25));
  const svgH = bH * lks.length + 60;

  const npos = useMemo(() => {
    const p = {};
    lks.forEach((lk, li) => {
      const cs = layers[lk] || [];
      const by = bH * li + bH * .55;
      const sp = svgW / (cs.length + 1);
      cs.forEach((c, ci) => { p[c.id] = { x: sp * (ci + 1), y: by, c, lk }; });
    });
    return p;
  }, [chars, layers, lf, svgW, bH]);

  const edgesD = useMemo(() =>
    rels.filter(r => npos[r.character_id_a] && npos[r.character_id_b])
      .map(r => ({ r, from: npos[r.character_id_a], to: npos[r.character_id_b] })),
    [rels, npos]
  );

  const conns = useMemo(() => {
    if (!selChar) return new Set();
    const s = new Set();
    rels.forEach(r => {
      if (r.character_id_a === selChar.id || r.character_id_b === selChar.id) {
        s.add(r.character_id_a);
        s.add(r.character_id_b);
      }
    });
    return s;
  }, [selChar, rels]);

  const relCountMap = useMemo(() => {
    const m = {};
    rels.forEach(r => {
      m[r.character_id_a] = (m[r.character_id_a] || 0) + 1;
      m[r.character_id_b] = (m[r.character_id_b] || 0) + 1;
    });
    return m;
  }, [rels]);

  const zoom = dir => setVb(p => {
    const v = p || { x: 0, y: 0, w: svgW, h: svgH };
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const f = dir > 0 ? .78 : 1.28;
    const nw = Math.min(svgW * 3, Math.max(300, v.w * f));
    const nh = Math.min(svgH * 3, Math.max(200, v.h * f));
    return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
  });

  const pairC = {}, pairI = {};
  edgesD.forEach(e => {
    const k = [e.from.c.id, e.to.c.id].sort().join('-');
    pairC[k] = (pairC[k] || 0) + 1;
  });

  const epath = (from, to, idx, total) => {
    if (Math.abs(from.y - to.y) > 10) {
      const mY = (from.y + to.y) / 2;
      const off = total > 1 ? (idx - (total - 1) / 2) * 28 : 0;
      return `M${from.x},${from.y} C${from.x + off},${mY} ${to.x - off},${mY} ${to.x},${to.y}`;
    }
    const dist = Math.abs(to.x - from.x);
    const arc = Math.min(70, dist * .28) + (idx * 14);
    return `M${from.x},${from.y} Q${(from.x + to.x) / 2},${from.y - arc} ${to.x},${to.y}`;
  };

  const VIEW = vb || { x: 0, y: 0, w: svgW, h: svgH };

  const handleWheel = e => { e.preventDefault(); zoom(e.deltaY > 0 ? -1 : 1); };

  /* attach wheel listener with { passive: false } so preventDefault works */
  useEffect(() => {
    const el = ref.current?.querySelector('svg');
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });

  const handleMouseDown = e => {
    if (e.target.closest('.ni')) return;
    setPan(true);
    ps.current = { x: e.clientX, y: e.clientY, vb: vb || { x: 0, y: 0, w: svgW, h: svgH } };
  };
  const handleMouseMove = e => {
    if (!pan || !ps.current) return;
    const dx = (e.clientX - ps.current.x) * (ps.current.vb.w / dims.w);
    const dy = (e.clientY - ps.current.y) * (ps.current.vb.h / dims.h);
    setVb({ x: ps.current.vb.x - dx, y: ps.current.vb.y - dy, w: ps.current.vb.w, h: ps.current.vb.h });
  };
  const endPan = () => { setPan(false); ps.current = null; };

  return (
    <div ref={ref} className="re-tree-wrap" role="region" aria-label="Relationship tree">
      {/* zoom controls */}
      <div className="re-tree-zoom" role="toolbar" aria-label="Zoom controls">
        {[['＋', 1, 'Zoom in'], ['－', -1, 'Zoom out'], ['⟲', 0, 'Reset zoom']].map(([l, d, label]) => (
          <button key={l} onClick={() => d === 0 ? setVb(null) : zoom(d)} className="re-tree-zoom-btn" aria-label={label}>
            {l}
          </button>
        ))}
      </div>

      <svg width={dims.w} height={dims.h}
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        className="re-tree-svg"
        style={{ cursor: pan ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        role="img"
        aria-label={`Tree showing ${chars.length} characters and ${rels.length} relationships`}>

        <defs>
          <filter id="ns" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodOpacity={0.08} />
          </filter>
        </defs>

        {/* layer bands */}
        {lks.map((lk, li) => {
          const cfg = LAYER[lk];
          return (
            <g key={lk}>
              <rect x={VIEW.x - 60} y={bH * li} width={svgW + 120} height={bH} fill={cfg.color} opacity={.03} />
              <text x={VIEW.x + 18} y={bH * li + 26} fill={cfg.color} opacity={.45}
                style={{ fontSize: 10, fontFamily: T.font, fontWeight: 800, letterSpacing: '0.1em' }}>
                {cfg.label.toUpperCase()} · {cfg.short}
              </text>
              {li > 0 && <line x1={VIEW.x - 60} y1={bH * li} x2={svgW + 60} y2={bH * li} stroke={cfg.color} strokeOpacity={.12} strokeDasharray="6,5" />}
            </g>
          );
        })}

        {/* edges */}
        {edgesD.map((e, i) => {
          const pk = [e.from.c.id, e.to.c.id].sort().join('-');
          const pt = pairC[pk] || 1;
          pairI[pk] = (pairI[pk] || 0) + 1;
          const pi = pairI[pk] - 1;
          const tc = e.r.tension_state && TENSION[e.r.tension_state] ? TENSION[e.r.tension_state].color : T.inkFaint;
          const conn = selChar && (e.r.character_id_a === selChar.id || e.r.character_id_b === selChar.id);
          const dim = selChar && !conn;
          const hov = hovE === i;
          return (
            <g key={i} className="ni" style={{ cursor: 'pointer' }} tabIndex={0}
              onClick={() => onRelClick(e.r)}
              onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onRelClick(e.r); } }}
              onMouseEnter={() => setHovE(i)} onMouseLeave={() => setHovE(null)}
              role="button" aria-label={`${cname(e.from.c)} to ${cname(e.to.c)}: ${e.r.relationship_type || 'relationship'}`}>
              <path d={epath(e.from, e.to, pi, pt)} fill="none" stroke={tc}
                strokeWidth={hov ? 2.5 : conn ? 2 : 1} opacity={dim ? .06 : hov ? .9 : .35}
                strokeDasharray={e.r.tension_state === 'fractured' ? '4,3' : e.r.tension_state === 'simmering' ? '8,4' : 'none'} />
              {(hov || conn) && (
                <text x={(e.from.x + e.to.x) / 2}
                  y={Math.abs(e.from.y - e.to.y) > 10
                    ? (e.from.y + e.to.y) / 2 - 8
                    : e.from.y - Math.min(55, Math.abs(e.to.x - e.from.x) * .22) - 5}
                  textAnchor="middle" fill={tc}
                  style={{ fontSize: 9, fontFamily: T.fontMono, fontWeight: 500, letterSpacing: '0.04em' }}>
                  {e.r.relationship_type}{e.r.tension_state ? ` · ${e.r.tension_state}` : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {Object.entries(npos).map(([cId, pos]) => {
          const isSel = selChar?.id === cId;
          const isConn = conns.has(cId);
          const isDim = selChar && !isSel && !isConn;
          const isHov = hovN === cId;
          const rc = roleColor(pos.c.role_type);
          const rb = roleBg(pos.c.role_type);
          const nr = isSel ? 26 : isHov ? 23 : 18;
          const relCnt = relCountMap[cId] || 0;
          return (
            <g key={cId} transform={`translate(${pos.x},${pos.y})`} className="ni"
              style={{ cursor: 'pointer' }} tabIndex={0}
              onClick={() => onCharClick(pos.c)}
              onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onCharClick(pos.c); } }}
              onMouseEnter={() => setHovN(cId)} onMouseLeave={() => setHovN(null)}
              role="button" aria-label={`${cname(pos.c)}, ${pos.c.role_type || 'unknown'}, ${relCnt} connections`}>
              {(isSel || isHov) && <circle r={nr + 10} fill={rc} opacity={isSel ? .1 : .05} />}
              <circle r={nr} fill={isDim ? T.paper : T.white} stroke={rc} strokeWidth={isSel ? 2 : 1.5} opacity={isDim ? .15 : 1} filter="url(#ns)" />
              <circle r={nr - 3} fill={isDim ? 'none' : rb} opacity={isDim ? 0 : .35} />
              <text textAnchor="middle" dominantBaseline="central" fill={isDim ? T.inkFaint : rc}
                opacity={isDim ? .15 : 1} style={{ fontSize: nr > 20 ? 12 : 10, fontFamily: T.font, fontWeight: 700, letterSpacing: '0.04em' }}>
                {initials(cname(pos.c))}
              </text>
              <text y={nr + 15} textAnchor="middle" fill={isDim ? T.inkFaint : T.inkMid}
                opacity={isDim ? .1 : 1} style={{ fontSize: 9.5, fontFamily: T.fontBody, fontWeight: 600 }}>
                {cname(pos.c).length > 16 ? cname(pos.c).slice(0, 14) + '…' : cname(pos.c)}
              </text>
              {!isDim && relCnt > 0 && (
                <g transform={`translate(${nr - 3},${-nr + 3})`}>
                  <circle r={7} fill={rc} />
                  <text textAnchor="middle" dominantBaseline="central" fill={T.white} style={{ fontSize: 8, fontWeight: 700 }}>{relCnt}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* status bar */}
      <div className="re-tree-status">
        <span>{chars.length} characters</span><span>·</span>
        <span>{rels.length} relationships</span><span>·</span>
        <span>Scroll to zoom · drag to pan</span>
      </div>
    </div>
  );
}
