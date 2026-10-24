/**
 * TreeView — banded SVG relationship tree: Lala in her own band, then each
 * person by role (tokens BANDS). A band with more people than fit across
 * the screen wraps onto more rows (Evoni's phone, 2026-10-24: twelve
 * people in one band were squeezed into 375px and their names ran
 * together), so the drawing is drawn at the screen's width and its text
 * stays its own size. Drag (mouse or finger) pans, the buttons and the
 * wheel zoom.
 * Prime Studios · LalaVerse
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { T, BANDS, bandOf, TENSION, roleColor, roleBg, cname, initials, typeLabel, humanize } from './tokens';

export default function TreeView({ chars, rels, lalaId, selChar, onRelClick, onCharClick }) {
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
        if (w > 0 && h > 0) setDims({ w, h: Math.max(w < 600 ? 420 : 480, h) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layers = useMemo(() => {
    const m = {};
    chars.forEach(c => { const k = bandOf(c, lalaId); (m[k] = m[k] || []).push(c); });
    return m;
  }, [chars, lalaId]);
  const bands = BANDS.filter(b => (layers[b.key] || []).length);
  const lks  = bands.map(b => b.key);
  // One person needs about MIN_SPACE across (circle, badge, a name); a band
  // holds as many per row as fit and wraps the rest onto further rows.
  const MIN_SPACE = 96, ROW_H = 96, HEAD = 40;
  const wide = dims.w >= 900;
  const svgW = dims.w;
  const perRow = Math.max(2, Math.floor((svgW - 24) / MIN_SPACE));
  const bandRows = lks.map(k => Math.max(1, Math.ceil((layers[k] || []).length / perRow)));
  const needH = bandRows.map(r => HEAD + r * ROW_H + 12);
  const needSum = needH.reduce((a, b) => a + b, 0) + 24;
  // On a wide screen a tree that fits stretches its bands to fill the box,
  // as before; a taller one, or any tree on a phone, sets its own height
  // (decided by a fixed size, not the box's, so the two never chase).
  const fill = wide && needSum <= 600;
  const grow = fill ? Math.max(1, (dims.h - 24) / (needSum - 24)) : 1;
  const bandH = needH.map(h => h * grow);
  const bandY = bandH.map((_, i) => bandH.slice(0, i).reduce((a, b) => a + b, 0));
  const svgH = bandH.reduce((a, b) => a + b, 0) + 24;
  const drawH = fill ? Math.max(svgH, dims.h) : Math.max(svgH, wide ? 600 : 440);
  const ownHeight = !fill;

  const npos = useMemo(() => {
    const p = {};
    lks.forEach((lk, li) => {
      const cs = layers[lk] || [];
      cs.forEach((c, ci) => {
        const row = Math.floor(ci / perRow);
        const inRow = Math.min(perRow, cs.length - row * perRow);
        const sp = svgW / (inRow + 1);
        // Rows sit in the middle of a stretched band.
        const top = bandY[li] + (bandH[li] - needH[li]) / 2;
        p[c.id] = { x: sp * ((ci % perRow) + 1), y: top + HEAD + row * ROW_H + ROW_H * 0.38, c, lk };
      });
    });
    return p;
  }, [layers, lks.join('|'), svgW, perRow, bandY.join('|'), bandH.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const v = p || { x: 0, y: 0, w: svgW, h: drawH };
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const f = dir > 0 ? .78 : 1.28;
    const nw = Math.min(svgW * 3, Math.max(300, v.w * f));
    const nh = Math.min(drawH * 3, Math.max(200, v.h * f));
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

  const VIEW = vb || { x: 0, y: 0, w: svgW, h: drawH };
  // Drawn at the screen's width, the text is its own size; zoomed out, it
  // grows by the zoom so it still reads at 12px or more.
  const k = Math.max(1, VIEW.w / dims.w, VIEW.h / drawH);
  const fs = n => n * k;
  // A name fits the space each person has in a row (about 7px a letter);
  // a long one shortens to the first name, then to an ellipsis.
  const fitChars = Math.max(6, Math.floor((svgW / (Math.min(perRow, 12) + 1)) / 7.5 / k));
  const nodeName = c => {
    const n = cname(c);
    if (n.length <= fitChars) return n;
    const f = n.split(/\s+/)[0];
    return f.length <= fitChars ? f : f.slice(0, fitChars - 1) + '…';
  };

  const handleWheel = e => { e.preventDefault(); zoom(e.deltaY > 0 ? -1 : 1); };

  /* attach wheel listener with { passive: false } so preventDefault works */
  useEffect(() => {
    const el = ref.current?.querySelector('svg');
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });

  // Pointer events: a mouse drag and a finger drag pan the same way.
  const handlePointerDown = e => {
    if (e.target.closest('.ni')) return;
    setPan(true);
    ps.current = { x: e.clientX, y: e.clientY, vb: vb || { x: 0, y: 0, w: svgW, h: drawH } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = e => {
    if (!pan || !ps.current) return;
    const dx = (e.clientX - ps.current.x) * (ps.current.vb.w / dims.w);
    const dy = (e.clientY - ps.current.y) * (ps.current.vb.h / drawH);
    setVb({ x: ps.current.vb.x - dx, y: ps.current.vb.y - dy, w: ps.current.vb.w, h: ps.current.vb.h });
  };
  const endPan = () => { setPan(false); ps.current = null; };

  return (
    <div ref={ref} className="re-tree-wrap" role="region" aria-label="Relationship tree" style={ownHeight ? { minHeight: drawH } : undefined}>
      {/* zoom controls */}
      <div className="re-tree-zoom" role="toolbar" aria-label="Zoom controls">
        {[['＋', 1, 'Zoom in'], ['－', -1, 'Zoom out'], ['⟲', 0, 'Reset zoom']].map(([l, d, label]) => (
          <button key={l} onClick={() => d === 0 ? setVb(null) : zoom(d)} className="re-tree-zoom-btn" aria-label={label}>
            {l}
          </button>
        ))}
      </div>

      <svg width={dims.w} height={drawH}
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMin meet"
        className="re-tree-svg"
        style={{ cursor: pan ? 'grabbing' : 'grab', touchAction: 'none', ...(ownHeight ? { height: drawH } : {}) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onPointerLeave={endPan}
        role="img"
        aria-label={`Tree showing ${chars.length} characters and ${rels.length} relationships`}>

        <defs>
          <filter id="ns" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodOpacity={0.08} />
          </filter>
        </defs>

        {/* layer bands */}
        {bands.map((cfg, li) => {
          const lk = cfg.key;
          return (
            <g key={lk}>
              <rect x={VIEW.x - 60} y={bandY[li]} width={svgW + 120} height={bandH[li]} fill={cfg.color} opacity={.04} />
              <text x={VIEW.x + 14} y={bandY[li] + 22} fill={cfg.color} opacity={.8}
                style={{ fontSize: fs(12), fontFamily: T.font, fontWeight: 600, letterSpacing: '0.08em' }}>
                {cfg.label.toUpperCase()}
              </text>
              {li > 0 && <line x1={VIEW.x - 60} y1={bandY[li]} x2={svgW + 60} y2={bandY[li]} stroke={cfg.color} strokeOpacity={.12} strokeDasharray="6,5" />}
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
              role="button" aria-label={`${cname(e.from.c)} to ${cname(e.to.c)}: ${typeLabel(e.r)}`}>
              {/* a wide invisible stroke: an edge a finger can hit */}
              <path d={epath(e.from, e.to, pi, pt)} fill="none" stroke="transparent" strokeWidth={16} />
              <path d={epath(e.from, e.to, pi, pt)} fill="none" stroke={tc}
                strokeWidth={hov ? 2.5 : conn ? 2 : 1} opacity={dim ? .06 : hov ? .9 : .35}
                strokeDasharray={e.r.tension_state === 'fractured' ? '4,3' : e.r.tension_state === 'simmering' ? '8,4' : 'none'} />
              {(hov || conn) && (
                <text x={(e.from.x + e.to.x) / 2}
                  y={Math.abs(e.from.y - e.to.y) > 10
                    ? (e.from.y + e.to.y) / 2 - 8
                    : e.from.y - Math.min(55, Math.abs(e.to.x - e.from.x) * .22) - 5}
                  textAnchor="middle" fill={tc}
                  style={{ fontSize: fs(12), fontFamily: T.fontMono, fontWeight: 500, letterSpacing: '0.02em' }}>
                  {typeLabel(e.r)}{e.r.stage ? ` · ${humanize(e.r.stage)}` : e.r.tension_state ? ` · ${humanize(e.r.tension_state)}` : ''}
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
              {/* a 44px target for a finger */}
              <circle r={22} fill="transparent" />
              {(isSel || isHov) && <circle r={nr + 10} fill={rc} opacity={isSel ? .1 : .05} />}
              <circle r={nr} fill={isDim ? T.paper : T.white} stroke={rc} strokeWidth={isSel ? 2 : 1.5} opacity={isDim ? .15 : 1} filter="url(#ns)" />
              <circle r={nr - 3} fill={isDim ? 'none' : rb} opacity={isDim ? 0 : .35} />
              <text textAnchor="middle" dominantBaseline="central" fill={isDim ? T.inkFaint : rc}
                opacity={isDim ? .15 : 1} style={{ fontSize: fs(12), fontFamily: T.font, fontWeight: 600, letterSpacing: '0.04em' }}>
                {initials(cname(pos.c))}
              </text>
              <text y={nr + fs(15)} textAnchor="middle" fill={isDim ? T.inkFaint : T.inkMid}
                opacity={isDim ? .1 : 1} style={{ fontSize: fs(12), fontFamily: T.fontBody, fontWeight: 600 }}>
                {nodeName(pos.c)}
              </text>
              {!isDim && relCnt > 0 && (
                <g transform={`translate(${nr + fs(2)},${-nr - fs(2)})`}>
                  <circle r={fs(8)} fill={rc} stroke={T.white} strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="central" fill={T.white} style={{ fontSize: fs(12), fontWeight: 700 }}>{relCnt}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* how to move it (the counts are in the page's sub-header) */}
      <div className="re-tree-status">Zoom with the buttons · drag to pan</div>
    </div>
  );
}
