import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3002/api/v1';

/* ── colour palettes per layer ── */
const PALETTE = {
  real_world: {
    bg: '#1a1512', node: '#d4a56a', nodeBorder: '#8b6914',
    edge: '#c49a6c', text: '#e8d5b7', accent: '#f0c674',
    panelBg: '#2a2118', panelBorder: '#5a4628',
  },
  lalaverse: {
    bg: '#0f1029', node: '#7b68ee', nodeBorder: '#4b0082',
    edge: '#9370db', text: '#c9b8ff', accent: '#ffd700',
    panelBg: '#1a1040', panelBorder: '#4b3d8f',
  },
};

const REL_COLOURS = {
  romantic: '#e74c7b', friendship: '#4ecdc4', rivalry: '#e67e22',
  mentor: '#3498db', serves: '#9b59b6', sibling: '#2ecc71',
  unknown: '#95a5a6', family: '#e8b86d', betrayal: '#c0392b',
};

const STATUS_DOT = { active: '#2ecc71', dormant: '#7f8c8d', broken: '#e74c3c', secret: '#9b59b6' };

export default function RelationshipMap() {
  const [searchParams] = useSearchParams();
  const showId = searchParams.get('show_id') || '';

  const [layer, setLayer] = useState('real_world');
  const [rels, setRels] = useState([]);
  const [selected, setSelected] = useState(null);   // { type:'node'|'edge', data }
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const svgRef = useRef(null);
  const dragging = useRef(null);

  const P = PALETTE[layer];

  /* ── fetch ── */
  const load = useCallback(() => {
    let url = `${API}/relationships?layer=${layer}`;
    if (showId) url += `&show_id=${showId}`;
    fetch(url).then(r => r.json()).then(setRels).catch(console.error);
  }, [layer, showId]);
  useEffect(load, [load]);

  /* ── unique character nodes ── */
  const nodes = useCallback(() => {
    const map = {};
    rels.forEach(r => {
      if (!map[r.source_name]) map[r.source_name] = { name: r.source_name, x: r.source_x || 200 + Math.random()*400, y: r.source_y || 100 + Math.random()*300 };
      if (!map[r.target_name]) map[r.target_name] = { name: r.target_name, x: r.target_x || 200 + Math.random()*400, y: r.target_y || 100 + Math.random()*300 };
    });
    return Object.values(map);
  }, [rels]);

  /* ── drag handlers ── */
  const onMouseDown = (e, name) => { e.stopPropagation(); dragging.current = name; };
  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svg = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    setRels(prev => prev.map(r => {
      const u = { ...r };
      if (r.source_name === dragging.current) { u.source_x = svg.x; u.source_y = svg.y; }
      if (r.target_name === dragging.current) { u.target_x = svg.x; u.target_y = svg.y; }
      return u;
    }));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  /* ── save positions ── */
  const savePositions = () => {
    const positions = rels.map(r => ({ id: r.id, source_x: r.source_x, source_y: r.source_y, target_x: r.target_x, target_y: r.target_y }));
    fetch(`${API}/relationships/positions`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ positions }) });
  };

  /* ── seed ── */
  const seed = () => fetch(`${API}/relationships/seed/book1`, { method:'POST' }).then(load);

  /* ── add relationship ── */
  const submit = () => {
    fetch(`${API}/relationships`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, layer }) })
      .then(() => { setAdding(false); setForm({}); load(); });
  };

  /* ── delete ── */
  const deleteSelected = () => {
    if (!selected || selected.type !== 'edge') return;
    fetch(`${API}/relationships/${selected.data.id}`, { method:'DELETE' }).then(() => { setSelected(null); load(); });
  };

  const n = nodes();

  return (
    <div style={{ height:'100vh', overflow:'hidden', background: P.bg, color: P.text, fontFamily:'Inter, sans-serif', display:'flex', flexDirection:'column' }}>
      {/* toolbar */}
      <div style={{ display:'flex', gap:8, padding:'10px 16px', background: P.panelBg, borderBottom:`1px solid ${P.panelBorder}`, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={() => setLayer(layer === 'real_world' ? 'lalaverse' : 'real_world')}
          style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${P.accent}`, background:'transparent', color: P.accent, cursor:'pointer', fontWeight:600 }}>
          {layer === 'real_world' ? '🌍 Real World' : '✦ LalaVerse'}
        </button>
        <button onClick={() => setAdding(true)} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${P.nodeBorder}`, background:'transparent', color: P.text, cursor:'pointer' }}>+ Add</button>
        <button onClick={savePositions} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${P.nodeBorder}`, background:'transparent', color: P.text, cursor:'pointer' }}>💾 Save Layout</button>
        <button onClick={seed} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${P.nodeBorder}`, background:'transparent', color: P.text, cursor:'pointer' }}>🌱 Seed Book 1</button>
        {selected?.type === 'edge' && <button onClick={deleteSelected} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e74c3c', background:'transparent', color:'#e74c3c', cursor:'pointer' }}>🗑 Delete</button>}
        <span style={{ marginLeft:'auto', fontSize:12, opacity:.6 }}>{rels.length} relationships · {n.length} characters</span>
      </div>

      {/* canvas */}
      <svg ref={svgRef} style={{ flex:1 }} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onClick={() => setSelected(null)}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d={`M0,0 L8,3 L0,6`} fill={P.edge} /></marker>
        </defs>

        {/* edges */}
        {rels.map(r => {
          const s = n.find(x => x.name === r.source_name);
          const t = n.find(x => x.name === r.target_name);
          if (!s || !t) return null;
          const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2 - 30;
          const col = REL_COLOURS[r.relationship_type] || P.edge;
          return (
            <g key={r.id} onClick={e => { e.stopPropagation(); setSelected({ type:'edge', data: r }); }} style={{ cursor:'pointer' }}>
              <path d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`} stroke={col} strokeWidth={selected?.data?.id === r.id ? 3 : 1.5} fill="none"
                markerEnd={r.direction !== 'both' ? 'url(#arrow)' : undefined} opacity={.8} />
              <text x={mx} y={my - 6} textAnchor="middle" fill={col} fontSize={10} fontWeight={600}>{r.label || r.relationship_type}</text>
              {r.status !== 'active' && <circle cx={mx + 30} cy={my - 10} r={4} fill={STATUS_DOT[r.status] || '#999'} />}
            </g>
          );
        })}

        {/* nodes */}
        {n.map(nd => (
          <g key={nd.name} onMouseDown={e => onMouseDown(e, nd.name)} onClick={e => { e.stopPropagation(); setSelected({ type:'node', data: nd }); }} style={{ cursor:'grab' }}>
            <circle cx={nd.x} cy={nd.y} r={28} fill={P.panelBg} stroke={selected?.data?.name === nd.name ? P.accent : P.nodeBorder} strokeWidth={2} />
            <text x={nd.x} y={nd.y + 4} textAnchor="middle" fill={P.node} fontSize={11} fontWeight={600}>{nd.name.length > 10 ? nd.name.slice(0,9)+'…' : nd.name}</text>
          </g>
        ))}
      </svg>

      {/* detail panel */}
      {selected?.type === 'edge' && (
        <div style={{ position:'absolute', right:16, top:60, width:280, background: P.panelBg, border:`1px solid ${P.panelBorder}`, borderRadius:8, padding:16, zIndex:10 }}>
          <h4 style={{ margin:'0 0 8px', color: P.accent }}>{selected.data.source_name} → {selected.data.target_name}</h4>
          <p style={{ margin:4, fontSize:13 }}><b>Type:</b> {selected.data.relationship_type}</p>
          <p style={{ margin:4, fontSize:13 }}><b>Label:</b> {selected.data.label}</p>
          <p style={{ margin:4, fontSize:13 }}><b>Status:</b> <span style={{ color: STATUS_DOT[selected.data.status] }}>{selected.data.status}</span></p>
          <p style={{ margin:4, fontSize:13 }}><b>Intensity:</b> {'★'.repeat(selected.data.intensity)}{'☆'.repeat(5 - selected.data.intensity)}</p>
          {selected.data.subtext && <p style={{ margin:4, fontSize:12, opacity:.7 }}>{selected.data.subtext}</p>}
          {layer === 'lalaverse' && <>
            {selected.data.source_knows && <p style={{ margin:4, fontSize:12 }}>🔮 <b>Source knows:</b> {selected.data.source_knows}</p>}
            {selected.data.target_knows && <p style={{ margin:4, fontSize:12 }}>🔮 <b>Target knows:</b> {selected.data.target_knows}</p>}
            {selected.data.reader_knows && <p style={{ margin:4, fontSize:12 }}>📖 <b>Reader knows:</b> {selected.data.reader_knows}</p>}
          </>}
        </div>
      )}

      {selected?.type === 'node' && (
        <div style={{ position:'absolute', right:16, top:60, width:240, background: P.panelBg, border:`1px solid ${P.panelBorder}`, borderRadius:8, padding:16, zIndex:10 }}>
          <h4 style={{ margin:'0 0 8px', color: P.accent }}>{selected.data.name}</h4>
          <p style={{ fontSize:13 }}>Connections: {rels.filter(r => r.source_name === selected.data.name || r.target_name === selected.data.name).length}</p>
        </div>
      )}

      {/* add modal */}
      {adding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:20 }}
          onClick={() => setAdding(false)}>
          <div style={{ background: P.panelBg, border:`1px solid ${P.panelBorder}`, borderRadius:12, padding:24, width:360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 16px', color: P.accent }}>New Relationship ({layer === 'real_world' ? 'Real World' : 'LalaVerse'})</h3>
            {['source_name','target_name','relationship_type','direction','label','subtext','status','intensity'].map(f => (
              <input key={f} placeholder={f} value={form[f]||''} onChange={e => setForm({...form, [f]: e.target.value})}
                style={{ display:'block', width:'100%', marginBottom:8, padding:'6px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${P.panelBorder}`, borderRadius:4, color: P.text, boxSizing:'border-box' }} />
            ))}
            {layer === 'lalaverse' && ['source_knows','target_knows','reader_knows'].map(f => (
              <textarea key={f} placeholder={f} value={form[f]||''} onChange={e => setForm({...form, [f]: e.target.value})} rows={2}
                style={{ display:'block', width:'100%', marginBottom:8, padding:'6px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${P.panelBorder}`, borderRadius:4, color: P.text, boxSizing:'border-box', resize:'vertical' }} />
            ))}
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={submit} style={{ flex:1, padding:'8px 0', borderRadius:6, border:'none', background: P.accent, color:'#000', fontWeight:600, cursor:'pointer' }}>Create</button>
              <button onClick={() => setAdding(false)} style={{ flex:1, padding:'8px 0', borderRadius:6, border:`1px solid ${P.panelBorder}`, background:'transparent', color: P.text, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
