/**
 * RelationshipEngine.jsx
 * Prime Studios · LalaVerse
 * Editorial Fashion Intelligence — fully modernized
 * Palette: #d4789a rose · #7ab3d4 steel · #a889c8 orchid
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/v1';

/* ─── tokens ─────────────────────────────────────────────────────────── */
const T = {
  rose:       '#d4789a',
  roseDeep:   '#b85a7c',
  roseFog:    '#fdf2f6',
  steel:      '#7ab3d4',
  steelFog:   '#eef6fb',
  orchid:     '#a889c8',
  orchidDeep: '#8a66b0',
  orchidFog:  '#f3effa',
  ink:        '#0f0c14',
  inkMid:     '#3d3548',
  inkDim:     '#7a7088',
  inkFaint:   '#b8b0c8',
  white:      '#ffffff',
  paper:      '#faf9fc',
  rule:       '#e8e4f0',
  ruleLight:  '#f0edf8',
  shadow:     '0 1px 3px rgba(15,12,20,.06), 0 4px 16px rgba(15,12,20,.08)',
  shadowUp:   '0 -1px 3px rgba(15,12,20,.04), 0 8px 32px rgba(15,12,20,.12)',
  r:          '3px',
  rMd:        '8px',
  rLg:        '14px',
  font:       "'Syne', 'Helvetica Neue', sans-serif",
  fontBody:   "'DM Sans', 'Segoe UI', sans-serif",
  fontMono:   "'JetBrains Mono', 'Fira Code', monospace",
};

/* ─── role palette ───────────────────────────────────────────────────── */
const ROLE = {
  protagonist: { color: T.steel,  bg: T.steelFog  },
  pressure:    { color: T.rose,   bg: T.roseFog   },
  mirror:      { color: T.orchid, bg: T.orchidFog },
  support:     { color: '#6bba9a', bg: '#edf7f2'  },
  shadow:      { color: '#b89060', bg: '#f7f0e8'  },
  special:     { color: '#c9a84c', bg: '#fdf7e6'  },
};
const roleColor  = r => (ROLE[r] || ROLE.shadow).color;
const roleBg     = r => (ROLE[r] || ROLE.shadow).bg;

const TENSION = {
  calm:      { color: '#3a7a50', bg: '#eaf5ee', border: '#b0d8be' },
  simmering: { color: '#8a5f10', bg: '#fdf6e3', border: '#e8d090' },
  volatile:  { color: '#a02020', bg: '#fdeaea', border: '#e8a8a8' },
  fractured: { color: '#6a30a0', bg: '#f3eafa', border: '#c8a8e8' },
  healing:   { color: '#1a5080', bg: '#e8f3fa', border: '#a0c8e8' },
};

const LAYER = {
  'real-world': { label: 'Real World',   short: 'RW', color: T.steel  },
  'lalaverse':  { label: 'LalaVerse',    short: 'LV', color: T.orchid },
  'series-2':   { label: 'Series 2',     short: 'S2', color: T.rose   },
};

const EDGE_COLOR = {
  romantic:      T.rose,
  familial:      '#6bba9a',
  mirror:        T.orchid,
  support:       '#6bba9a',
  shadow:        '#94a3b8',
  transactional: '#c9a84c',
  creation:      T.orchid,
  pressure:      T.rose,
};

const NODE_R = { special:36, protagonist:36, pressure:28, mirror:24, support:20, shadow:20 };

const CONN_MODES   = ['IRL','Online Only','Passing','Professional','One-sided'];
const STATUSES     = ['Active','Past','One-sided','Complicated'];
const TENSIONS     = ['calm','simmering','volatile','fractured','healing'];
const LALA_CONN    = [
  { v:'none',              l:'No connection' },
  { v:'knows_lala',        l:'Knows Lala directly' },
  { v:'through_justwoman', l:'Through JustAWoman (unaware)' },
  { v:'interacts_content', l:'Interacts with content' },
  { v:'unaware',           l:'Completely unaware' },
];
const REL_PRESETS = [
  'Sister','Brother','Mother','Father','Husband','Wife',
  'Best Friend','Friend','Collaborator','Rival','Mentor','Manager','Stylist','Fan',
];

/* ─── tiny helpers ───────────────────────────────────────────────────── */
const cname = c => c.selected_name || c.display_name || c.character_key || '?';
const clayer = c => {
  if (c.universe==='lalaverse'||c.layer==='lalaverse') return 'lalaverse';
  if (c.universe==='series-2' ||c.layer==='series-2')  return 'series-2';
  return 'real-world';
};
const initials = s => s.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const compatible = (a, b) => clayer(a) === clayer(b);

function useToast() {
  const [toasts, set] = useState([]);
  const show = useCallback((msg, type='info') => {
    const id = Date.now();
    set(p => [...p, { id, msg, type }]);
    setTimeout(() => set(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return { toasts, show };
}

/* ─── D3 graph hook (unchanged logic, new colours) ───────────────────── */
function useD3(svgRef, nodes, edges, onNodeClick, onEdgeHover, lastDrag, d3Ok, focusId) {
  useEffect(() => {
    const d3 = window.d3;
    if (!d3Ok || !d3 || !svgRef.current || !nodes.length) return;
    let dead = false, sim = null, ro = null;
    const raf = requestAnimationFrame(() => {
      if (dead || !svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      const { width: W, height: H } = svgRef.current.getBoundingClientRect();
      const w = W||900, h = H||600;
      const g = svg.append('g');
      svg.call(d3.zoom().scaleExtent([0.25,3]).on('zoom', e => g.attr('transform', e.transform)));
      const defs = svg.append('defs');
      [...new Set(edges.map(e=>e.type))].forEach(type => {
        const col = EDGE_COLOR[type]||'#94a3b8';
        defs.append('marker').attr('id',`a-${type}`)
          .attr('viewBox','0 -5 10 10').attr('refX',10).attr('refY',0)
          .attr('markerWidth',5).attr('markerHeight',5).attr('orient','auto')
          .append('path').attr('d','M0,-5L10,0L0,5').attr('fill',col).attr('opacity',0.7);
      });
      const gc = { real_world:{x:w*.22,y:h*.3}, online:{x:w*.78,y:h*.3}, created:{x:w*.5,y:h*.72} };
      const dc = {x:w/2,y:h/2};
      const sn = nodes.map((n,i)=>{ const g=gc[n.group]||dc; const a=(i/Math.max(1,nodes.length))*2*Math.PI; return{...n,x:g.x+Math.cos(a)*90,y:g.y+Math.sin(a)*90}; });
      const nm = Object.fromEntries(sn.map(n=>[n.id,n]));
      const se = edges.map(e=>({...e,source:nm[e.from],target:nm[e.to]})).filter(e=>e.source&&e.target);
      sim = d3.forceSimulation(sn)
        .force('link',d3.forceLink(se).id(d=>d.id).distance(e=>e.strength>=4?160:120).strength(0.4))
        .force('charge',d3.forceManyBody().strength(-380))
        .force('center',d3.forceCenter(w/2,h/2))
        .force('collision',d3.forceCollide().radius(d=>(NODE_R[d.role_type]||24)+16))
        .alphaDecay(0.05).velocityDecay(0.6);
      const lines = g.append('g').selectAll('line').data(se).join('line')
        .attr('stroke',e=>EDGE_COLOR[e.type]||'#94a3b8').attr('stroke-width',1.5).attr('stroke-opacity',0.5)
        .attr('marker-end',e=>`url(#a-${e.type})`).style('cursor','pointer')
        .on('mouseenter',(ev,e)=>onEdgeHover(e,ev)).on('mouseleave',()=>onEdgeHover(null,null));
      const ngs = g.append('g').selectAll('g').data(sn).join('g').style('cursor','pointer')
        .call(d3.drag()
          .on('start',(ev,d)=>{if(!ev.active)sim.alphaTarget(0.15).restart();d.fx=d.x;d.fy=d.y;})
          .on('drag',(ev,d)=>{d.fx=ev.x;d.fy=ev.y;})
          .on('end',(ev,d)=>{if(!ev.active)sim.alphaTarget(0);d.fx=null;d.fy=null;lastDrag.current=Date.now();}))
        .on('click',(ev,d)=>{ev.stopPropagation();onNodeClick(d);});
      ngs.append('circle').attr('r',d=>(NODE_R[d.role_type]||24)+8).attr('fill',d=>roleColor(d.role_type)).attr('opacity',0.06);
      ngs.append('circle').attr('r',d=>NODE_R[d.role_type]||24).attr('fill',T.white).attr('stroke',d=>roleColor(d.role_type)).attr('stroke-width',1.5);
      ngs.append('text').attr('text-anchor','middle').attr('dy',d=>(NODE_R[d.role_type]||24)+15)
        .attr('fill',T.inkMid).style('font-size','10px').style('font-family',T.fontBody).style('font-weight','600').text(d=>d.label);
      ngs.append('text').attr('text-anchor','middle').attr('dy','0.35em')
        .attr('fill',d=>roleColor(d.role_type)).style('font-size','11px').style('font-family',T.font).style('font-weight','700')
        .text(d=>initials(d.label));
      const r = d => NODE_R[d.role_type]||24;
      function focus(fid) {
        if(!fid){ngs.style('opacity',1);lines.style('opacity',0.5);return;}
        const conn=new Set([fid]);
        se.forEach(e=>{const s=typeof e.source==='object'?e.source.id:e.source,t=typeof e.target==='object'?e.target.id:e.target;if(s===fid)conn.add(t);if(t===fid)conn.add(s);});
        ngs.style('opacity',d=>conn.has(d.id)?1:0.08);
        lines.style('opacity',e=>{const s=typeof e.source==='object'?e.source.id:e.source,t=typeof e.target==='object'?e.target.id:e.target;return(s===fid||t===fid)?0.9:0.04;});
      }
      focus(focusId);
      sim.on('tick',()=>{
        lines
          .attr('x1',e=>{const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y,d=Math.sqrt(dx*dx+dy*dy)||1;return e.source.x+(dx/d)*r(e.source);})
          .attr('y1',e=>{const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y,d=Math.sqrt(dx*dx+dy*dy)||1;return e.source.y+(dy/d)*r(e.source);})
          .attr('x2',e=>{const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y,d=Math.sqrt(dx*dx+dy*dy)||1;return e.target.x-(dx/d)*(r(e.target)+8);})
          .attr('y2',e=>{const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y,d=Math.sqrt(dx*dx+dy*dy)||1;return e.target.y-(dy/d)*(r(e.target)+8);});
        ngs.attr('transform',d=>`translate(${d.x},${d.y})`);
      });
      let rt=null;
      ro=new ResizeObserver(es=>{clearTimeout(rt);rt=setTimeout(()=>{for(const e of es){const{width:nw,height:nh}=e.contentRect;if(nw>0&&nh>0&&sim){sim.force('center',d3.forceCenter(nw/2,nh/2));sim.alpha(0.15).restart();}}},200);});
      ro.observe(svgRef.current);
    });
    return()=>{dead=true;cancelAnimationFrame(raf);if(sim)sim.stop();if(ro)ro.disconnect();};
  },[nodes,edges,onNodeClick,onEdgeHover,lastDrag,d3Ok,focusId]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════ */
export default function RelationshipEngine() {
  const navigate = useNavigate();
  const { toasts, show: toast } = useToast();

  const [loading, setLoading]     = useState(true);
  const [chars, setChars]         = useState([]);
  const [rels, setRels]           = useState([]);
  const [cands, setCands]         = useState([]);
  const [layers, setLayers]       = useState({});
  const [regs, setRegs]           = useState([]);
  const [reg, setReg]             = useState(null);
  const [tab, setTab]             = useState('tree');
  const [lf, setLf]               = useState('all');   // layer filter
  const [selChar, setSelChar]     = useState(null);
  const [selRel, setSelRel]       = useState(null);
  const [panel, setPanel]         = useState(false);
  const [addOpen, setAddOpen]     = useState(false);
  const [genOpen, setGenOpen]     = useState(false);
  const [genning, setGenning]     = useState(false);
  const [genFam, setGenFam]       = useState(false);
  const [famData, setFamData]     = useState(null);

  /* ── registries ─────────────────────────────────────────────────── */
  useEffect(()=>{
    (async()=>{
      try {
        const r = await fetch(`${API}/character-registry/registries`);
        const d = await r.json();
        const rs = d.registries||d||[];
        setRegs(Array.isArray(rs)?rs:[]);
        if(rs.length) setReg(rs[0].id);
      } catch { toast('Failed to load registries','error'); }
    })();
  },[]);

  /* ── tree ───────────────────────────────────────────────────────── */
  const fetchTree = useCallback(async(id)=>{
    if(!id) return;
    setLoading(true);
    try {
      const [tr,pr] = await Promise.all([
        fetch(`${API}/relationships/tree/${id}`).then(r=>r.json()),
        fetch(`${API}/relationships/pending`).then(r=>r.json()),
      ]);
      setChars(tr.characters||[]);
      setRels((tr.relationships||[]).filter(r=>r.confirmed));
      setLayers(tr.layers||{});
      setCands(pr.candidates||[]);
    } catch { toast('Failed to load tree','error'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ if(reg){ fetchTree(reg); setFamData(null); } },[reg,fetchTree]);

  const fetchFam = useCallback(async(id)=>{
    try { const r=await fetch(`${API}/relationships/family-tree/${id}`); setFamData(await r.json()); }
    catch { toast('Failed to load family tree','error'); }
  },[]);
  useEffect(()=>{ if(tab==='family'&&reg&&!famData) fetchFam(reg); },[tab,reg,famData,fetchFam]);

  /* ── actions ────────────────────────────────────────────────────── */
  const confirm  = async id => { try{ await fetch(`${API}/relationships/confirm/${id}`,{method:'POST'}); toast('Confirmed','success'); fetchTree(reg); } catch{ toast('Failed','error'); }};
  const dismiss  = async id => { try{ await fetch(`${API}/relationships/dismiss/${id}`,{method:'DELETE'}); setCands(p=>p.filter(c=>c.id!==id)); } catch{ toast('Failed','error'); }};
  const del      = async id => { if(!window.confirm('Delete?')) return; try{ await fetch(`${API}/relationships/${id}`,{method:'DELETE'}); setRels(p=>p.filter(r=>r.id!==id)); setPanel(false); setSelRel(null); toast('Deleted','info'); } catch{ toast('Failed','error'); }};
  const generate = async (focId=null) => {
    setGenning(true);
    try {
      const b={registry_id:reg}; if(focId) b.focus_character_id=focId;
      const r=await fetch(`${API}/relationships/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Error');}
      const d=await r.json(); setCands(p=>[...(d.candidates||[]),...p]); toast(`${d.count} candidate(s) generated`,'success'); setGenOpen(false); setTab('candidates');
    } catch(e){ toast(e.message,'error'); }
    finally{ setGenning(false); }
  };
  const addRel   = async fd => { try{ await fetch(`${API}/relationships`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fd,confirmed:true})}); toast('Created','success'); setAddOpen(false); fetchTree(reg); } catch{ toast('Failed','error'); }};
  const genFamFn = async()=>{
    setGenFam(true);
    try{
      const r=await fetch(`${API}/relationships/generate-family`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registry_id:reg})});
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Error');}
      const d=await r.json(); toast(`${d.count} family bond(s) generated`,'success'); fetchFam(reg); fetchTree(reg);
    }catch(e){toast(e.message,'error');}finally{setGenFam(false);}
  };
  const updateFamRole = async(id,u)=>{ try{ await fetch(`${API}/relationships/${id}/family`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(u)}); toast('Updated','success'); fetchFam(reg); fetchTree(reg); }catch{ toast('Failed','error'); }};
  const updateRel     = async(id,u)=>{ try{ await fetch(`${API}/relationships/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(u)}); toast('Updated','success'); fetchTree(reg); }catch{ toast('Failed','error'); }};

  /* ── derived ─────────────────────────────────────────────────────── */
  const layerMap    = useMemo(()=>{ const m={}; for(const[k,cs] of Object.entries(layers)) for(const c of cs) m[c.id]=k; return m; },[layers]);
  const filtChars   = useMemo(()=>lf==='all'?chars:(layers[lf]||[]),[chars,layers,lf]);
  const filtRels    = useMemo(()=>{ const ids=new Set(filtChars.map(c=>c.id)); return rels.filter(r=>ids.has(r.character_id_a)||ids.has(r.character_id_b)); },[filtChars,rels]);

  const TABS = [
    { k:'tree',       ico:'◎', label:'Tree' },
    { k:'family',     ico:'⬡', label:'Family' },
    { k:'web',        ico:'⊛', label:'Web' },
    { k:'candidates', ico:'◈', label:'Seeds', badge: cands.length },
    { k:'list',       ico:'≡', label:'List' },
  ];

  const subline = {
    tree:       `${filtChars.length} characters · ${filtRels.length} relationships`,
    family:     `${famData?.total_family||0} family · ${famData?.total_romantic||0} romantic`,
    web:        'Force-directed map',
    candidates: `${cands.length} pending review`,
    list:       `${filtRels.length} confirmed`,
  }[tab]||'';

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:T.paper, fontFamily:T.fontBody, color:T.ink }}>

      {/* ── Google Fonts ─────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius:3px; }
        button { font-family: ${T.fontBody}; }
        select, input, textarea { font-family: ${T.fontBody}; }
      `}</style>

      {/* ── Toast tray ───────────────────────────────────────────── */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none' }}>
        {toasts.map(t=>(
          <div key={t.id} style={{
            padding:'9px 14px', borderRadius:T.r, fontSize:12, fontWeight:600, letterSpacing:'0.01em',
            background: t.type==='error'?'#fdeaea':t.type==='success'?'#eaf5ee':T.orchidFog,
            color: t.type==='error'?'#a02020':t.type==='success'?'#2d7a50':T.orchidDeep,
            border:`1px solid ${t.type==='error'?'#e8a8a8':t.type==='success'?'#b0d8be':T.orchid+'40'}`,
            boxShadow:T.shadow, animation:'fadeUp .2s ease', pointerEvents:'auto',
          }}>{t.msg}</div>
        ))}
      </div>

      {/* ══ TOP BAR ══════════════════════════════════════════════════ */}
      <header style={{
        display:'flex', alignItems:'stretch', height:56,
        background:T.white, borderBottom:`1.5px solid ${T.rule}`,
        flexShrink:0, position:'relative', zIndex:20,
      }}>
        {/* wordmark */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 24px', borderRight:`1px solid ${T.rule}`, gap:10, minWidth:200 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:T.rose }}/>
          <span style={{ fontFamily:T.font, fontSize:14, fontWeight:800, letterSpacing:'0.06em', color:T.ink, textTransform:'uppercase' }}>
            Relationships
          </span>
          {regs.length>1 && (
            <select value={reg||''} onChange={e=>setReg(e.target.value)}
              style={{ marginLeft:4, fontSize:11, border:'none', background:'transparent', color:T.inkDim, cursor:'pointer', outline:'none' }}>
              {regs.map(r=><option key={r.id} value={r.id}>{r.title||r.name}</option>)}
            </select>
          )}
        </div>

        {/* tab rail */}
        <nav style={{ display:'flex', flex:1, alignItems:'stretch' }}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'0 20px',
              border:'none', borderBottom: tab===t.k ? `2px solid ${T.orchid}` : '2px solid transparent',
              background:'transparent', cursor:'pointer', fontSize:12, fontWeight:600,
              color: tab===t.k ? T.orchid : T.inkDim,
              letterSpacing:'0.03em', transition:'all .15s', position:'relative',
            }}>
              <span style={{ fontFamily:T.font, fontSize:13, opacity: tab===t.k?1:0.6 }}>{t.ico}</span>
              {t.label}
              {t.badge>0 && (
                <span style={{ background:T.rose, color:T.white, borderRadius:10, fontSize:9, padding:'1px 5px', fontWeight:700, minWidth:16, textAlign:'center' }}>{t.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* actions */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 20px', borderLeft:`1px solid ${T.rule}` }}>
          <Btn variant="ghost" onClick={()=>setAddOpen(true)}>+ Add</Btn>
          <Btn variant="primary" onClick={()=>setGenOpen(true)}>◈ Generate</Btn>
        </div>
      </header>

      {/* ══ BODY ═════════════════════════════════════════════════════ */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── LEFT: character sidebar ─────────────────────────────── */}
        {tab!=='web' && (
          <aside style={{
            width:232, flexShrink:0, display:'flex', flexDirection:'column',
            background:T.white, borderRight:`1.5px solid ${T.rule}`, overflow:'hidden',
          }}>
            {/* layer filter */}
            <div style={{ padding:'14px 16px 10px', borderBottom:`1px solid ${T.ruleLight}` }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:T.inkFaint, textTransform:'uppercase', marginBottom:8 }}>World Layer</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <LFBtn active={lf==='all'} onClick={()=>setLf('all')} count={chars.length}>All</LFBtn>
                {Object.entries(LAYER).map(([k,cfg])=>(
                  <LFBtn key={k} active={lf===k} onClick={()=>setLf(k)} count={(layers[k]||[]).length} dot={cfg.color}>{cfg.label}</LFBtn>
                ))}
              </div>
            </div>

            {/* character list */}
            <div style={{ flex:1, overflowY:'auto', padding:'10px 10px' }}>
              {filtChars.length===0 && !loading && (
                <div style={{ padding:'32px 8px', textAlign:'center', color:T.inkFaint, fontSize:12 }}>No characters</div>
              )}
              {filtChars.map(c=>{
                const lk  = layerMap[c.id];
                const lc  = lk && LAYER[lk];
                const rc  = roleColor(c.role_type);
                const act = selChar?.id===c.id;
                return (
                  <button key={c.id} onClick={()=>{ setSelChar(p=>p?.id===c.id?null:c); setSelRel(null); setPanel(false); }}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:9, padding:'7px 8px',
                      borderRadius:T.rMd, cursor:'pointer', border:'none', marginBottom:2,
                      background: act ? T.orchidFog : 'transparent',
                      transition:'background .12s',
                    }}
                    onMouseEnter={e=>{ if(!act) e.currentTarget.style.background=T.paper; }}
                    onMouseLeave={e=>{ if(!act) e.currentTarget.style.background='transparent'; }}
                  >
                    {/* avatar */}
                    <div style={{
                      width:30, height:30, borderRadius:'50%', flexShrink:0,
                      background: act ? rc+'18' : T.paper,
                      border:`1.5px solid ${act?rc:T.rule}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:T.font, fontSize:10, fontWeight:700, color:rc,
                    }}>{initials(cname(c))}</div>
                    <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:act?T.ink:T.inkMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cname(c)}</div>
                      <div style={{ fontSize:10, color:T.inkFaint, marginTop:1, textTransform:'capitalize' }}>{c.role_type||'—'}</div>
                    </div>
                    {lc && <div style={{ width:5, height:5, borderRadius:'50%', background:lc.color, flexShrink:0 }}/>}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* ── CENTER: canvas ──────────────────────────────────────── */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* sub-header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 20px', borderBottom:`1px solid ${T.rule}`,
            background:T.white, flexShrink:0,
          }}>
            <div>
              <span style={{ fontFamily:T.font, fontSize:13, fontWeight:700, letterSpacing:'0.04em', color:T.ink }}>
                {{tree:'Tree',family:'Family',web:'Web',candidates:'Seeds',list:'List'}[tab]}
              </span>
              <span style={{ fontSize:11, color:T.inkDim, marginLeft:10, fontFamily:T.fontMono }}>{subline}</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {tab==='candidates' && cands.length>0 && <Btn variant="ghost" onClick={()=>setGenOpen(true)}>◈ Regenerate</Btn>}
              {tab==='family' && <Btn variant="ghost" onClick={genFamFn} disabled={genFam}>{genFam?'Generating…':'⬡ Auto-Generate Family'}</Btn>}
            </div>
          </div>

          {/* view */}
          <div style={{ flex:1, overflow:'auto', position:'relative' }}>
            {tab==='web' ? <WebView navigate={navigate}/> :
             loading     ? <Spinner/> :
             tab==='tree'       ? <TreeView chars={filtChars} rels={filtRels} layers={layers} lf={lf} selChar={selChar} onRelClick={r=>{setSelRel(r);setPanel(true);}} onCharClick={setSelChar}/> :
             tab==='family'     ? <FamilyView data={famData} genning={genFam} onGenerate={genFamFn} onUpdateRole={updateFamRole} onRelClick={r=>{setSelRel(r);setPanel(true);}}/> :
             tab==='candidates' ? <CandidateView cands={cands} onConfirm={confirm} onDismiss={dismiss}/> :
             <ListView rels={filtRels} onSelect={r=>{setSelRel(r);setPanel(true);}}/>
            }
          </div>
        </main>

        {/* ── RIGHT: inspector ────────────────────────────────────── */}
        {tab!=='web' && (
          <aside style={{
            width:300, flexShrink:0, display:'flex', flexDirection:'column',
            background:T.white, borderLeft:`1.5px solid ${T.rule}`, overflow:'hidden',
          }}>
            {panel && selRel
              ? <Inspector rel={selRel} onClose={()=>{setPanel(false);setSelRel(null);}} onUpdate={u=>updateRel(selRel.id,u)} onDelete={()=>del(selRel.id)}/>
              : (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:24, textAlign:'center', color:T.inkFaint }}>
                  <div style={{ fontFamily:T.font, fontSize:28, opacity:.2, letterSpacing:'0.06em' }}>◈</div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.inkDim }}>Select a relationship</div>
                  <div style={{ fontSize:11, lineHeight:1.6 }}>Click any edge in the tree or any row in the list to inspect it here</div>
                  {selChar && (
                    <div style={{ marginTop:16, padding:'10px 14px', borderRadius:T.rMd, background:T.orchidFog, border:`1px solid ${T.orchid}30`, width:'100%' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.orchid }}>{cname(selChar)}</div>
                      <div style={{ fontSize:11, color:T.inkDim, marginTop:2 }}>
                        {filtRels.filter(r=>r.character_id_a===selChar.id||r.character_id_b===selChar.id).length} connections
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          </aside>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {addOpen && <AddModal chars={chars} onAdd={addRel} onClose={()=>setAddOpen(false)}/>}
      {genOpen && <GenModal chars={chars} genning={genning} onGenerate={generate} onClose={()=>setGenOpen(false)}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */
function Btn({ variant='ghost', onClick, disabled, children, style={} }) {
  const base = { display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:T.r, fontSize:12, fontWeight:600, cursor:disabled?'not-allowed':'pointer', transition:'all .15s', border:'none', letterSpacing:'0.02em', opacity:disabled?.55:1 };
  const variants = {
    primary: { background:T.orchid, color:T.white },
    ghost:   { background:'transparent', color:T.inkDim, border:`1px solid ${T.rule}` },
    rose:    { background:T.rose, color:T.white },
    outline: { background:'transparent', color:T.orchid, border:`1px solid ${T.orchid}` },
  };
  return <button onClick={disabled?undefined:onClick} style={{...base,...variants[variant],...style}}>{children}</button>;
}

function LFBtn({ active, onClick, count, dot, children }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:7, padding:'5px 8px', borderRadius:T.r, border:'none',
      cursor:'pointer', fontSize:11, fontWeight:active?700:500, textAlign:'left',
      background: active ? T.orchidFog : 'transparent',
      color: active ? T.orchid : T.inkDim,
      transition:'all .12s',
    }}>
      {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:dot, flexShrink:0 }}/>}
      <span style={{ flex:1 }}>{children}</span>
      <span style={{ fontFamily:T.fontMono, fontSize:10, color:active?T.orchid:T.inkFaint }}>{count}</span>
    </button>
  );
}

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:T.inkFaint }}>
      <span style={{ width:18, height:18, border:`2px solid ${T.rule}`, borderTopColor:T.orchid, borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }}/>
      <span style={{ fontSize:12, fontWeight:500 }}>Loading…</span>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:T.inkFaint, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:12, color:T.inkMid, lineHeight:1.65 }}>{value}</div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:T.inkFaint, textTransform:'uppercase', marginBottom:4, marginTop:12 }}>{children}</div>;
}

function Input({ value, onChange, placeholder, multiline }) {
  const s = { width:'100%', padding:'7px 10px', borderRadius:T.r, border:`1px solid ${T.rule}`, fontSize:12, color:T.ink, background:T.paper, resize:'vertical', outline:'none', boxSizing:'border-box', transition:'border-color .15s' };
  const focus = e => e.target.style.borderColor = T.orchid;
  const blur  = e => e.target.style.borderColor = T.rule;
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} style={{...s,minHeight:64}} onFocus={focus} onBlur={blur}/>
    : <input    value={value} onChange={onChange} placeholder={placeholder} style={s} onFocus={focus} onBlur={blur}/>;
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} style={{ width:'100%', padding:'7px 10px', borderRadius:T.r, border:`1px solid ${T.rule}`, fontSize:12, color:T.ink, background:T.paper, outline:'none', cursor:'pointer' }}>
      {children}
    </select>
  );
}

function Pill({ children, color, bg }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700, color, background:bg||color+'18', letterSpacing:'0.04em' }}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   WEB VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function WebView({ navigate }) {
  const svgRef = useRef(null);
  const [nodes,setNodes]=[useState([]),[]][0]; const setNodes2 = useState([])[1];
  const [nds,setNds]         = useState([]);
  const [eds,setEds]         = useState([]);
  const [wl,setWl]           = useState(true);
  const [err,setErr]         = useState(null);
  const [sel,setSel]         = useState(null);
  const [hovE,setHovE]       = useState(null);
  const [tip,setTip]         = useState(null);
  const [filt,setFilt]       = useState('all');
  const [d3ok,setD3ok]       = useState(!!window.d3);
  const lastDrag             = useRef(0);

  useEffect(()=>{
    if(window.d3){setD3ok(true);return;}
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    s.onload=()=>setD3ok(true);s.onerror=()=>setErr('D3 failed to load.');
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    (async()=>{
      setWl(true);
      try{ const r=await fetch('/api/v1/memories/relationship-map'); if(!r.ok)throw new Error(); const d=await r.json(); setNds(d.nodes||[]); setEds(d.edges||[]); }
      catch{ setErr('Could not load relationship data.'); }
      finally{ setWl(false); }
    })();
  },[]);

  const onNodeClick = useCallback(n=>{ if(Date.now()-lastDrag.current<200)return; setSel(p=>p?.id===n.id?null:n); },[]);
  const onEdgeHover = useCallback((e,ev)=>{ setHovE(e); if(ev)setTip({x:ev.clientX,y:ev.clientY}); },[]);

  const vn = useMemo(()=>filt==='all'?nds:nds.filter(n=>n.group===filt),[nds,filt]);
  const ve = useMemo(()=>{ const ids=new Set(vn.map(n=>n.id)); return eds.filter(e=>ids.has(e.from)&&ids.has(e.to)); },[eds,vn]);

  useD3(svgRef,vn,ve,onNodeClick,onEdgeHover,lastDrag,d3ok,sel?.id);

  if(wl) return <Spinner/>;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', position:'relative' }}>
      {/* filter bar */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderBottom:`1px solid ${T.rule}`, background:T.white, flexShrink:0 }}>
        <span style={{ fontFamily:T.fontMono, fontSize:11, color:T.inkFaint }}>{nds.length} nodes · {eds.length} edges</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {['all','real_world','online','created'].map(f=>(
            <button key={f} onClick={()=>setFilt(f)} style={{
              padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
              background:filt===f?T.orchidFog:'transparent', color:filt===f?T.orchid:T.inkDim,
            }}>{f==='all'?'All':f==='real_world'?'Real World':f==='online'?'Online':'Created'}</button>
          ))}
        </div>
      </div>

      {/* graph */}
      <div style={{ flex:1, position:'relative' }}>
        {err && <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', background:'#fdeaea', color:'#a02020', padding:'7px 14px', borderRadius:T.r, fontSize:12, border:'1px solid #e8a8a8' }}>{err}</div>}
        {d3ok
          ? <svg ref={svgRef} style={{ width:'100%', height:'100%', display:'block', background:T.paper }} onClick={()=>{setSel(null);setHovE(null);}}/>
          : <Spinner/>
        }
        {/* hinge note */}
        <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', background:T.white, border:`1px solid ${T.rule}`, borderRadius:20, padding:'5px 14px', fontSize:10, fontFamily:T.fontMono, color:T.inkFaint, display:'flex', alignItems:'center', gap:6, boxShadow:T.shadow }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:T.rose }}/>
          JustAWoman → Lala is one-way. Lala doesn't know she was built.
        </div>
        {/* node panel */}
        {sel && (
          <div style={{ position:'absolute', top:12, right:12, width:240, background:T.white, borderRadius:T.rLg, boxShadow:T.shadowUp, border:`1px solid ${T.rule}`, overflow:'hidden', animation:'fadeUp .18s ease' }}>
            <div style={{ height:2, background:`linear-gradient(90deg,${T.rose},${T.orchid})` }}/>
            <div style={{ padding:'12px 14px' }}>
              <button onClick={()=>setSel(null)} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:T.inkFaint, fontSize:14 }}>×</button>
              <div style={{ fontFamily:T.font, fontSize:13, fontWeight:700, color:T.ink }}>{sel.label}</div>
              <div style={{ fontSize:10, color:roleColor(sel.role_type), fontWeight:600, marginBottom:8, marginTop:2 }}>{sel.role_type}</div>
              {sel.bio && <div style={{ fontSize:11, color:T.inkMid, lineHeight:1.55, marginBottom:10 }}>{sel.bio}</div>}
              <button onClick={()=>navigate('/character-registry')} style={{ width:'100%', padding:'6px', borderRadius:T.r, fontSize:11, fontWeight:600, background:T.orchidFog, color:T.orchid, border:`1px solid ${T.orchid}40`, cursor:'pointer' }}>
                Open Character →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* edge tooltip */}
      {hovE && tip && (
        <div style={{ position:'fixed', left:tip.x+10, top:tip.y-6, background:T.white, border:`1px solid ${T.rule}`, borderRadius:T.rMd, boxShadow:T.shadowUp, padding:'9px 12px', fontSize:11, maxWidth:260, zIndex:9999, pointerEvents:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontWeight:700, color:T.ink, marginBottom:4, flexWrap:'wrap' }}>
            <span>{hovE.from}</span>
            <span style={{ color:EDGE_COLOR[hovE.type]||T.inkFaint }}>{hovE.direction==='two_way'?'↔':'→'}</span>
            <span>{hovE.to}</span>
            <Pill color={EDGE_COLOR[hovE.type]||T.inkDim}>{hovE.type}</Pill>
          </div>
          {hovE.from_knows && <div style={{ color:T.inkMid, fontSize:10 }}>{hovE.from_knows}</div>}
          {!hovE.to_knows && hovE.direction==='one_way' && <div style={{ color:T.rose, fontSize:10, fontStyle:'italic', marginTop:3 }}>{hovE.to} is unaware.</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TREE VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function TreeView({ chars, rels, layers, lf, selChar, onRelClick, onCharClick }) {
  const ref  = useRef(null);
  const [dims,setDims]     = useState({w:1200,h:680});
  const [hovN,setHovN]     = useState(null);
  const [hovE,setHovE]     = useState(null);
  const [vb,setVb]         = useState(null);
  const [pan,setPan]       = useState(false);
  const ps = useRef(null);

  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const ro=new ResizeObserver(es=>{for(const e of es){const{width:w,height:h}=e.contentRect;if(w>0&&h>0)setDims({w,h:Math.max(480,h)});}});
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  const lks   = lf==='all'?['real-world','lalaverse','series-2']:[lf];
  const maxC  = Math.max(1,...lks.map(k=>(layers[k]||[]).length));
  const svgW  = Math.max(dims.w, maxC*130+80);
  const bH    = Math.max(200, dims.h/(lks.length+0.25));
  const svgH  = bH*lks.length+60;

  const npos = useMemo(()=>{
    const p={};
    lks.forEach((lk,li)=>{
      const cs=layers[lk]||[];
      const by=bH*li+bH*.55;
      const sp=svgW/(cs.length+1);
      cs.forEach((c,ci)=>{p[c.id]={x:sp*(ci+1),y:by,c,lk};});
    });
    return p;
  },[chars,layers,lf,svgW,bH]);

  const edgesD = useMemo(()=>rels.filter(r=>npos[r.character_id_a]&&npos[r.character_id_b]).map(r=>({r,from:npos[r.character_id_a],to:npos[r.character_id_b]})),[rels,npos]);
  const conns  = useMemo(()=>{if(!selChar)return new Set();const s=new Set();rels.forEach(r=>{if(r.character_id_a===selChar.id||r.character_id_b===selChar.id){s.add(r.character_id_a);s.add(r.character_id_b);}});return s;},[selChar,rels]);

  const zoom = dir => setVb(p=>{const v=p||{x:0,y:0,w:svgW,h:svgH};const cx=v.x+v.w/2,cy=v.y+v.h/2;const f=dir>0?.78:1.28;const nw=Math.min(svgW*3,Math.max(300,v.w*f)),nh=Math.min(svgH*3,Math.max(200,v.h*f));return{x:cx-nw/2,y:cy-nh/2,w:nw,h:nh};});

  const pairC={},pairI={};
  edgesD.forEach(e=>{const k=[e.from.c.id,e.to.c.id].sort().join('-');pairC[k]=(pairC[k]||0)+1;});

  const epath=(from,to,idx,total)=>{
    if(Math.abs(from.y-to.y)>10){const mY=(from.y+to.y)/2,off=total>1?(idx-(total-1)/2)*28:0;return`M${from.x},${from.y} C${from.x+off},${mY} ${to.x-off},${mY} ${to.x},${to.y}`;}
    const dX=to.x-from.x,dist=Math.abs(dX),arc=Math.min(70,dist*.28)+(idx*14);
    return`M${from.x},${from.y} Q${(from.x+to.x)/2},${from.y-arc} ${to.x},${to.y}`;
  };

  const VIEW = vb||{x:0,y:0,w:svgW,h:svgH};

  return (
    <div ref={ref} style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative' }}>
      {/* zoom */}
      <div style={{ position:'absolute', top:10, right:10, zIndex:5, display:'flex', flexDirection:'column', gap:2, background:T.white, borderRadius:T.rMd, padding:3, border:`1px solid ${T.rule}`, boxShadow:T.shadow }}>
        {[['＋',1],['－',-1],['⟲',0]].map(([l,d])=>(
          <button key={l} onClick={()=>d===0?setVb(null):zoom(d)} style={{ width:26, height:26, border:'none', background:'none', cursor:'pointer', fontSize:13, borderRadius:4, color:T.inkMid, fontWeight:700, fontFamily:T.font }}>
            {l}
          </button>
        ))}
      </div>

      <svg width={dims.w} height={dims.h} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        style={{ display:'block', background:T.paper, cursor:pan?'grabbing':'grab' }}
        onWheel={e=>{e.preventDefault();zoom(e.deltaY>0?-1:1);}}
        onMouseDown={e=>{if(e.target.closest('.ni'))return;setPan(true);ps.current={x:e.clientX,y:e.clientY,vb:vb||{x:0,y:0,w:svgW,h:svgH}};}}
        onMouseMove={e=>{if(!pan||!ps.current)return;const dx=(e.clientX-ps.current.x)*(ps.current.vb.w/dims.w),dy=(e.clientY-ps.current.y)*(ps.current.vb.h/dims.h);setVb({x:ps.current.vb.x-dx,y:ps.current.vb.y-dy,w:ps.current.vb.w,h:ps.current.vb.h});}}
        onMouseUp={()=>{setPan(false);ps.current=null;}} onMouseLeave={()=>{setPan(false);ps.current=null;}}>

        <defs>
          <filter id="ns" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="3" floodOpacity={0.08}/></filter>
        </defs>

        {/* layer bands */}
        {lks.map((lk,li)=>{
          const cfg=LAYER[lk];
          return (
            <g key={lk}>
              <rect x={VIEW.x-60} y={bH*li} width={svgW+120} height={bH} fill={cfg.color} opacity={.03}/>
              <text x={VIEW.x+18} y={bH*li+26} fill={cfg.color} opacity={.45}
                style={{fontSize:10,fontFamily:T.font,fontWeight:800,letterSpacing:'0.1em'}}>
                {cfg.label.toUpperCase()} · {cfg.short}
              </text>
              {li>0 && <line x1={VIEW.x-60} y1={bH*li} x2={svgW+60} y2={bH*li} stroke={cfg.color} strokeOpacity={.12} strokeDasharray="6,5"/>}
            </g>
          );
        })}

        {/* edges */}
        {edgesD.map((e,i)=>{
          const pk=[e.from.c.id,e.to.c.id].sort().join('-');
          const pt=pairC[pk]||1; pairI[pk]=(pairI[pk]||0)+1; const pi=pairI[pk]-1;
          const tc=e.r.tension_state&&TENSION[e.r.tension_state]?TENSION[e.r.tension_state].color:T.inkFaint;
          const conn=selChar&&(e.r.character_id_a===selChar.id||e.r.character_id_b===selChar.id);
          const dim=selChar&&!conn; const hov=hovE===i;
          return (
            <g key={i} className="ni" style={{cursor:'pointer'}} onClick={()=>onRelClick(e.r)} onMouseEnter={()=>setHovE(i)} onMouseLeave={()=>setHovE(null)}>
              <path d={epath(e.from,e.to,pi,pt)} fill="none" stroke={tc}
                strokeWidth={hov?2.5:conn?2:1} opacity={dim?.06:hov?.9:.35}
                strokeDasharray={e.r.tension_state==='fractured'?'4,3':e.r.tension_state==='simmering'?'8,4':'none'}/>
              {(hov||conn) && (
                <text x={(e.from.x+e.to.x)/2}
                  y={Math.abs(e.from.y-e.to.y)>10?(e.from.y+e.to.y)/2-8:e.from.y-Math.min(55,Math.abs(e.to.x-e.from.x)*.22)-5}
                  textAnchor="middle" fill={tc} style={{fontSize:9,fontFamily:T.fontMono,fontWeight:500,letterSpacing:'0.04em'}}>
                  {e.r.relationship_type}{e.r.tension_state?` · ${e.r.tension_state}`:''}
                </text>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {Object.entries(npos).map(([cId,pos])=>{
          const isSel=selChar?.id===cId,isConn=conns.has(cId),isDim=selChar&&!isSel&&!isConn,isHov=hovN===cId;
          const rc=roleColor(pos.c.role_type); const rb=roleBg(pos.c.role_type);
          const nr=isSel?26:isHov?23:18;
          const relCnt=rels.filter(r=>r.character_id_a===cId||r.character_id_b===cId).length;
          return (
            <g key={cId} transform={`translate(${pos.x},${pos.y})`} className="ni"
              style={{cursor:'pointer'}} onClick={()=>onCharClick(pos.c)}
              onMouseEnter={()=>setHovN(cId)} onMouseLeave={()=>setHovN(null)}>
              {(isSel||isHov) && <circle r={nr+10} fill={rc} opacity={isSel?.1:.05}/>}
              <circle r={nr} fill={isDim?T.paper:T.white} stroke={rc} strokeWidth={isSel?2:1.5} opacity={isDim?.15:1} filter="url(#ns)"/>
              <circle r={nr-3} fill={isDim?'none':rb} opacity={isDim?0:.35}/>
              <text textAnchor="middle" dominantBaseline="central" fill={isDim?T.inkFaint:rc}
                opacity={isDim?.15:1} style={{fontSize:nr>20?12:10,fontFamily:T.font,fontWeight:700,letterSpacing:'0.04em'}}>
                {initials(cname(pos.c))}
              </text>
              <text y={nr+15} textAnchor="middle" fill={isDim?T.inkFaint:T.inkMid}
                opacity={isDim?.1:1} style={{fontSize:9.5,fontFamily:T.fontBody,fontWeight:600}}>
                {cname(pos.c).length>16?cname(pos.c).slice(0,14)+'…':cname(pos.c)}
              </text>
              {!isDim && relCnt>0 && (
                <g transform={`translate(${nr-3},${-nr+3})`}>
                  <circle r={7} fill={rc}/>
                  <text textAnchor="middle" dominantBaseline="central" fill={T.white} style={{fontSize:8,fontWeight:700}}>{relCnt}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* bottom rule */}
      <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:10, padding:'4px 12px', background:'rgba(255,255,255,.9)', borderRadius:20, border:`1px solid ${T.rule}`, fontSize:10, fontFamily:T.fontMono, color:T.inkFaint, boxShadow:T.shadow }}>
        <span>{chars.length} characters</span><span>·</span><span>{rels.length} relationships</span><span>·</span><span>Scroll to zoom · drag to pan</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FAMILY VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function FamilyView({ data, genning, onGenerate, onUpdateRole, onRelClick }) {
  const [editId,setEditId]   = useState(null);
  const [editRole,setEditRole] = useState('');
  if(!data) return <Spinner/>;
  const {characters=[],family_bonds=[],romantic_bonds=[]}=data;
  const seen=new Set();
  const bonds=[...family_bonds,...romantic_bonds].filter(b=>{if(seen.has(b.id))return false;seen.add(b.id);return true;});
  const connIds=new Set();bonds.forEach(b=>{connIds.add(b.character_id_a);connIds.add(b.character_id_b);});
  const unconn=characters.filter(c=>!connIds.has(c.id));

  if(!bonds.length) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, padding:40, textAlign:'center' }}>
      <div style={{ fontFamily:T.font, fontSize:40, opacity:.15, letterSpacing:'0.06em' }}>⬡</div>
      <div style={{ fontFamily:T.font, fontSize:16, fontWeight:700, color:T.ink }}>No Family Bonds Yet</div>
      <div style={{ fontSize:13, color:T.inkDim, maxWidth:320, lineHeight:1.75 }}>Let AI analyze your characters and build family connections — parents, siblings, spouses, extended family.</div>
      <Btn variant="primary" onClick={onGenerate} disabled={genning}>{genning?'Generating…':'⬡ Auto-Generate Family Tree'}</Btn>
    </div>
  );

  const bondColor = b => {
    const r=b.family_role||'';
    if(r.includes('wife')||r.includes('husband')||r.includes('spouse')||b.is_romantic) return T.rose;
    if(b.is_blood_relation) return T.orchid;
    return T.steel;
  };

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', height:'100%' }}>
      {/* legend */}
      <div style={{ display:'flex', gap:14, marginBottom:20, alignItems:'center' }}>
        {[[T.orchid,'Blood'],[T.rose,'Romantic/Married'],[T.steel,'Step/Other']].map(([c,l])=>(
          <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:T.inkDim }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>
            {l}
          </span>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {bonds.map(b=>{
          const col=bondColor(b);
          const nA=b.character_a_name||b.character_a_selected||'?';
          const nB=b.character_b_name||b.character_b_selected||'?';
          return (
            <div key={b.id} onClick={()=>onRelClick(b)}
              style={{ display:'flex', alignItems:'stretch', background:T.white, borderRadius:T.rMd, border:`1px solid ${T.rule}`, cursor:'pointer', overflow:'hidden', transition:'border-color .15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=col} onMouseLeave={e=>e.currentTarget.style.borderColor=T.rule}>
              <div style={{ width:3, flexShrink:0, background:col }}/>
              <div style={{ flex:1, padding:'10px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{nA}</span>
                  <span style={{ fontSize:11, color:T.inkFaint }}>→</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{nB}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {editId===b.id ? (
                    <div style={{ display:'flex', gap:5 }} onClick={e=>e.stopPropagation()}>
                      <input value={editRole} onChange={e=>setEditRole(e.target.value)} placeholder="mother, cousin…" autoFocus
                        style={{ padding:'3px 8px', fontSize:11, border:`1px solid ${T.rule}`, borderRadius:T.r, outline:'none', width:140 }}
                        onKeyDown={e=>{ if(e.key==='Enter'&&editRole.trim()){onUpdateRole(b.id,{family_role:editRole.trim()});setEditId(null);} if(e.key==='Escape')setEditId(null); }}/>
                      <Btn variant="outline" onClick={()=>{onUpdateRole(b.id,{family_role:editRole.trim()});setEditId(null);}} style={{ padding:'3px 8px', fontSize:10 }}>Save</Btn>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize:10, fontWeight:700, color:col, textTransform:'uppercase', letterSpacing:'0.06em' }}>{b.family_role||b.relationship_type||'—'}</span>
                      <button onClick={e=>{e.stopPropagation();setEditId(b.id);setEditRole(b.family_role||'');}} style={{ fontSize:10, color:T.inkFaint, background:'none', border:'none', cursor:'pointer', padding:'0 4px' }}>edit</button>
                    </>
                  )}
                </div>
                {b.conflict_summary && <div style={{ fontSize:11, color:T.inkDim, marginTop:4, lineHeight:1.5 }}>{b.conflict_summary}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {unconn.length>0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:T.inkFaint, textTransform:'uppercase', marginBottom:8 }}>Not In Family Tree · {unconn.length}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {unconn.map(c=><span key={c.id} style={{ padding:'3px 10px', borderRadius:10, background:T.paper, fontSize:11, color:T.inkDim, border:`1px solid ${T.rule}` }}>{c.display_name||c.selected_name}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CANDIDATE VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function CandidateView({ cands, onConfirm, onDismiss }) {
  if(!cands.length) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, padding:40, textAlign:'center' }}>
      <div style={{ fontFamily:T.font, fontSize:36, opacity:.15 }}>◈</div>
      <div style={{ fontFamily:T.font, fontSize:16, fontWeight:700, color:T.ink }}>No Proposed Seeds</div>
      <div style={{ fontSize:13, color:T.inkDim, maxWidth:320, lineHeight:1.7 }}>Let AI analyse your registry and suggest relationships with tension states, LalaVerse mirrors, and career echoes.</div>
    </div>
  );

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14, padding:'20px 24px', alignContent:'start' }}>
      {cands.map(c=>{
        const tc=c.tension_state&&TENSION[c.tension_state];
        return (
          <div key={c.id} style={{ background:T.white, borderRadius:T.rLg, border:`1px solid ${T.rule}`, overflow:'hidden', boxShadow:T.shadow, animation:'fadeUp .2s ease' }}>
            {/* top accent */}
            <div style={{ height:2, background:`linear-gradient(90deg,${T.rose},${T.orchid})` }}/>
            <div style={{ padding:'14px 16px' }}>
              {/* names */}
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontFamily:T.font, fontSize:13, fontWeight:700, color:T.ink }}>{c.character_a_name||'Character A'}</span>
                <span style={{ color:T.orchid, fontSize:14 }}>↔</span>
                <span style={{ fontFamily:T.font, fontSize:13, fontWeight:700, color:T.ink }}>{c.character_b_name||'Character B'}</span>
              </div>
              {/* type */}
              <div style={{ fontSize:10, fontWeight:700, color:T.orchid, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{c.relationship_type}</div>
              {/* situation */}
              {c.situation && <p style={{ fontSize:12, color:T.inkMid, lineHeight:1.65, marginBottom:10 }}>{c.situation}</p>}
              {/* pills */}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                {tc && <Pill color={tc.color} bg={tc.bg}>{c.tension_state}</Pill>}
                {c.connection_mode && <Pill color={T.steel} bg={T.steelFog}>{c.connection_mode}</Pill>}
                {c.pain_point_category && <Pill color={T.rose} bg={T.roseFog}>{c.pain_point_category}</Pill>}
              </div>
              {/* meta */}
              {c.lala_mirror && <div style={{ fontSize:11, color:T.inkMid, marginBottom:4 }}><span style={{ color:T.orchid, fontWeight:700 }}>Mirror · </span>{c.lala_mirror}</div>}
              {c.career_echo_potential && <div style={{ fontSize:11, color:T.inkMid, marginBottom:12 }}><span style={{ color:'#b89060', fontWeight:700 }}>Echo · </span>{c.career_echo_potential}</div>}
              {/* actions */}
              <div style={{ display:'flex', gap:8, borderTop:`1px solid ${T.ruleLight}`, paddingTop:10, marginTop:4 }}>
                <Btn variant="primary" onClick={()=>onConfirm(c.id)} style={{ flex:1, justifyContent:'center' }}>✓ Confirm</Btn>
                <Btn variant="ghost" onClick={()=>onDismiss(c.id)}>✕</Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LIST VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function ListView({ rels, onSelect }) {
  if(!rels.length) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, padding:40, textAlign:'center' }}>
      <div style={{ fontFamily:T.font, fontSize:32, opacity:.12 }}>≡</div>
      <div style={{ fontFamily:T.font, fontSize:15, fontWeight:700, color:T.ink }}>No Confirmed Relationships</div>
      <div style={{ fontSize:12, color:T.inkDim }}>Confirm candidate seeds or add manually</div>
    </div>
  );

  return (
    <div style={{ padding:'0', overflowY:'auto', height:'100%' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead style={{ position:'sticky', top:0, zIndex:2 }}>
          <tr style={{ background:T.paper, borderBottom:`1.5px solid ${T.rule}` }}>
            {['Character A','Type','Character B','Mode','Tension','Status'].map(h=>(
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:9, fontWeight:700, color:T.inkFaint, textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:T.font }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rels.map((r,i)=>{
            const tc=r.tension_state&&TENSION[r.tension_state];
            return (
              <tr key={r.id} onClick={()=>onSelect(r)}
                style={{ borderBottom:`1px solid ${T.ruleLight}`, cursor:'pointer', transition:'background .1s', background:i%2?T.white:T.paper }}
                onMouseEnter={e=>e.currentTarget.style.background=T.orchidFog}
                onMouseLeave={e=>e.currentTarget.style.background=i%2?T.white:T.paper}>
                <td style={{ padding:'9px 14px', fontWeight:600, color:T.ink }}>{r.character_a_name}</td>
                <td style={{ padding:'9px 14px' }}><Pill color={T.orchid}>{r.relationship_type}</Pill></td>
                <td style={{ padding:'9px 14px', fontWeight:600, color:T.ink }}>{r.character_b_name}</td>
                <td style={{ padding:'9px 14px', color:T.inkDim }}>{r.connection_mode}</td>
                <td style={{ padding:'9px 14px' }}>{tc&&<Pill color={tc.color} bg={tc.bg}>{r.tension_state}</Pill>}</td>
                <td style={{ padding:'9px 14px', color:T.inkDim }}>{r.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSPECTOR
   ═══════════════════════════════════════════════════════════════════════ */
function Inspector({ rel, onClose, onUpdate, onDelete }) {
  const [edit,setEdit] = useState(false);
  const [f,setF]       = useState({ relationship_type:rel.relationship_type||'', connection_mode:rel.connection_mode||'IRL', lala_connection:rel.lala_connection||'none', status:rel.status||'Active', tension_state:rel.tension_state||'', pain_point_category:rel.pain_point_category||'', situation:rel.situation||'', lala_mirror:rel.lala_mirror||'', career_echo_potential:rel.career_echo_potential||'', notes:rel.notes||'', family_role:rel.family_role||'', conflict_summary:rel.conflict_summary||'', source_knows:rel.source_knows||'', target_knows:rel.target_knows||'', reader_knows:rel.reader_knows||'' });
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* header */}
      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.rule}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontFamily:T.font, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:T.inkFaint }}>Detail</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:T.inkFaint, lineHeight:1 }}>×</button>
        </div>
        {/* character pair */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'10px', background:T.paper, borderRadius:T.rMd, border:`1px solid ${T.ruleLight}` }}>
          {[rel.character_a_name, rel.character_b_name].map((nm,i)=>(
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:T.orchidFog, border:`1.5px solid ${T.orchid}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.font, fontSize:11, fontWeight:700, color:T.orchid, margin:'0 auto 4px' }}>
                {initials(nm||'?')}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:T.ink, maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
            </div>
          ))}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ color:T.orchid, fontSize:16, fontWeight:700 }}>↔</span>
            {rel.tension_state && TENSION[rel.tension_state] && (
              <Pill color={TENSION[rel.tension_state].color} bg={TENSION[rel.tension_state].bg}>{rel.tension_state}</Pill>
            )}
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {edit ? (
          <>
            <Label>Relationship Type</Label><Input value={f.relationship_type} onChange={set('relationship_type')}/>
            <Label>Connection Mode</Label><Select value={f.connection_mode} onChange={set('connection_mode')}>{CONN_MODES.map(m=><option key={m} value={m}>{m}</option>)}</Select>
            <Label>Status</Label><Select value={f.status} onChange={set('status')}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select>
            <Label>Tension State</Label><Select value={f.tension_state} onChange={set('tension_state')}><option value="">None</option>{TENSIONS.map(t=><option key={t} value={t}>{t}</option>)}</Select>
            <Label>Pain Point</Label><Input value={f.pain_point_category} onChange={set('pain_point_category')} placeholder="identity, loyalty, trust…"/>
            <Label>Situation</Label><Input value={f.situation} onChange={set('situation')} multiline/>
            <Label>Family Role</Label><Input value={f.family_role} onChange={set('family_role')} placeholder="mother, brother…"/>
            <Label>Conflict Summary</Label><Input value={f.conflict_summary} onChange={set('conflict_summary')} multiline/>
            <div style={{ height:1, background:T.rule, margin:'14px 0 4px' }}/>
            <Label>{rel.character_a_name||'A'} knows</Label><Input value={f.source_knows} onChange={set('source_knows')} multiline/>
            <Label>{rel.character_b_name||'B'} knows</Label><Input value={f.target_knows} onChange={set('target_knows')} multiline/>
            <Label>Reader knows</Label><Input value={f.reader_knows} onChange={set('reader_knows')} multiline/>
            <div style={{ height:1, background:T.rule, margin:'14px 0 4px' }}/>
            <Label>Lala Mirror</Label><Input value={f.lala_mirror} onChange={set('lala_mirror')} multiline/>
            <Label>Career Echo</Label><Input value={f.career_echo_potential} onChange={set('career_echo_potential')} multiline/>
            <Label>Lala Connection</Label><Select value={f.lala_connection} onChange={set('lala_connection')}>{LALA_CONN.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</Select>
            <Label>Notes</Label><Input value={f.notes} onChange={set('notes')} multiline/>
          </>
        ) : (
          <>
            <Field label="Type" value={rel.relationship_type}/>
            <Field label="Mode" value={rel.connection_mode}/>
            <Field label="Status" value={rel.status}/>
            <Field label="Pain Point" value={rel.pain_point_category}/>
            <Field label="Situation" value={rel.situation}/>
            <Field label="Family Role" value={rel.family_role}/>
            <Field label="Conflict" value={rel.conflict_summary}/>
            {(rel.source_knows||rel.target_knows||rel.reader_knows) && <div style={{ height:1, background:T.ruleLight, margin:'10px 0' }}/>}
            <Field label={`${rel.character_a_name||'A'} knows`} value={rel.source_knows}/>
            <Field label={`${rel.character_b_name||'B'} knows`} value={rel.target_knows}/>
            <Field label="Reader knows" value={rel.reader_knows}/>
            {(rel.lala_mirror||rel.career_echo_potential) && <div style={{ height:1, background:T.ruleLight, margin:'10px 0' }}/>}
            <Field label="Lala Mirror" value={rel.lala_mirror}/>
            <Field label="Career Echo" value={rel.career_echo_potential}/>
            <Field label="Notes" value={rel.notes}/>
          </>
        )}
      </div>

      {/* footer */}
      <div style={{ padding:'10px 16px', borderTop:`1px solid ${T.rule}`, display:'flex', gap:8, flexShrink:0 }}>
        {edit ? (
          <>
            <Btn variant="primary" onClick={()=>{onUpdate(f);setEdit(false);}} style={{ flex:1, justifyContent:'center' }}>Save</Btn>
            <Btn variant="ghost" onClick={()=>setEdit(false)}>Cancel</Btn>
          </>
        ) : (
          <>
            <Btn variant="outline" onClick={()=>setEdit(true)} style={{ flex:1, justifyContent:'center' }}>Edit</Btn>
            <Btn variant="ghost" onClick={onDelete} style={{ color:T.rose, borderColor:T.rose+'40' }}>Delete</Btn>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ADD MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function AddModal({ chars, onAdd, onClose }) {
  const [f,setF] = useState({ character_id_a:'', character_id_b:'', relationship_type:'', connection_mode:'IRL', status:'Active', tension_state:'', situation:'' });
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));
  const charA = chars.find(c=>c.id===f.character_id_a);
  const bOpts = chars.filter(c=>c.id!==f.character_id_a&&(!charA||compatible(charA,c)));
  const valid = f.character_id_a && f.character_id_b && f.relationship_type;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,12,20,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={onClose}>
      <div style={{ background:T.white, borderRadius:T.rLg, boxShadow:'0 20px 60px rgba(15,12,20,.25)', width:'100%', maxWidth:500, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
        <div style={{ height:2, background:`linear-gradient(90deg,${T.rose},${T.orchid})` }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:`1px solid ${T.rule}` }}>
          <span style={{ fontFamily:T.font, fontSize:14, fontWeight:700, letterSpacing:'0.04em' }}>Add Relationship</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:T.inkFaint }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {[['Character A','character_id_a',chars],['Character B','character_id_b',bOpts]].map(([label,key,opts])=>(
            <div key={key}>
              <Label>{label}</Label>
              <Select value={f[key]} onChange={set(key)}>
                <option value="">Select…</option>
                {opts.map(c=><option key={c.id} value={c.id}>{cname(c)} · {c.role_type}</option>)}
              </Select>
            </div>
          ))}
          <Label>Relationship Type</Label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {REL_PRESETS.map(p=>(
              <button key={p} onClick={()=>setF(fr=>({...fr,relationship_type:p.toLowerCase()}))} style={{
                padding:'3px 9px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                background:f.relationship_type===p.toLowerCase()?T.orchid:T.paper,
                color:f.relationship_type===p.toLowerCase()?T.white:T.inkDim, transition:'all .12s',
              }}>{p}</button>
            ))}
          </div>
          <input value={f.relationship_type} onChange={set('relationship_type')} placeholder="Or type custom…"
            style={{ width:'100%', padding:'7px 10px', borderRadius:T.r, border:`1px solid ${T.rule}`, fontSize:12, color:T.ink, background:T.paper, outline:'none', boxSizing:'border-box' }}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:2 }}>
            <div><Label>Mode</Label><Select value={f.connection_mode} onChange={set('connection_mode')}>{CONN_MODES.map(m=><option key={m} value={m}>{m}</option>)}</Select></div>
            <div><Label>Status</Label><Select value={f.status} onChange={set('status')}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <Label>Tension State</Label>
          <Select value={f.tension_state} onChange={set('tension_state')}><option value="">None</option>{TENSIONS.map(t=><option key={t} value={t}>{t}</option>)}</Select>
          <Label>Situation</Label>
          <Input value={f.situation} onChange={set('situation')} placeholder="Describe the dynamic…" multiline/>
        </div>
        <div style={{ padding:'12px 20px', borderTop:`1px solid ${T.rule}`, display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>valid&&onAdd(f)} disabled={!valid}>Create</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   GENERATE MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function GenModal({ chars, genning, onGenerate, onClose }) {
  const [focus,setFocus] = useState('');
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,12,20,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={onClose}>
      <div style={{ background:T.white, borderRadius:T.rLg, boxShadow:'0 20px 60px rgba(15,12,20,.25)', width:'100%', maxWidth:400, overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
        <div style={{ height:2, background:`linear-gradient(90deg,${T.orchid},${T.rose})` }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:`1px solid ${T.rule}` }}>
          <span style={{ fontFamily:T.font, fontSize:14, fontWeight:700 }}>◈ Generate Seeds</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:T.inkFaint }}>×</button>
        </div>
        <div style={{ padding:'16px 20px' }}>
          <p style={{ fontSize:13, color:T.inkMid, lineHeight:1.75, marginBottom:14 }}>
            Claude will analyse your registry and propose <strong>3–5 relationship candidates</strong> with tension states, LalaVerse mirrors, and career echoes.
          </p>
          <Label>Focus Character (optional)</Label>
          <Select value={focus} onChange={e=>setFocus(e.target.value)}>
            <option value="">Any character</option>
            {chars.map(c=><option key={c.id} value={c.id}>{cname(c)}</option>)}
          </Select>
        </div>
        <div style={{ padding:'12px 20px', borderTop:`1px solid ${T.rule}`, display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>onGenerate(focus||null)} disabled={genning}>{genning?'Generating…':'◈ Generate'}</Btn>
        </div>
      </div>
    </div>
  );
}