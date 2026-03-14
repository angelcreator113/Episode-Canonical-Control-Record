/**
 * SocialProfileGenerator.jsx — The Feed
 * Prime Studios · JustAWoman's real-world online ecosystem
 *
 * Refactored for Prime Studios light theme:
 *   #d4789a (pink) · #7ab3d4 (blue) · #a889c8 (lavender)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import FeedBulkImport from '../components/FeedBulkImport';

const API = '/api/v1/social-profiles';

// ── Prime Studios Design Tokens ────────────────────────────────────────
const C = {
  pink:       '#d4789a',
  pinkLight:  '#fce8f0',
  pinkMid:    '#f0b8cc',
  blue:       '#7ab3d4',
  blueLight:  '#e8f3fa',
  lavender:   '#a889c8',
  lavLight:   '#ede6f7',
  ink:        '#1a1625',
  inkMid:     '#4a3f5c',
  inkLight:   '#7a6e8a',
  surface:    '#ffffff',
  surfaceAlt: '#faf8fc',
  border:     '#ede8f5',
  shadow:     '0 2px 16px rgba(168,137,200,0.10)',
  shadowMd:   '0 6px 32px rgba(168,137,200,0.15)',
  radius:     '12px',
  radiusSm:   '8px',
  font:       "'DM Sans', 'Segoe UI', sans-serif",
};

const PLATFORMS = [
  { value:'instagram', label:'Instagram' },
  { value:'tiktok',   label:'TikTok' },
  { value:'youtube',  label:'YouTube' },
  { value:'twitter',  label:'Twitter / X' },
  { value:'onlyfans', label:'OnlyFans' },
  { value:'twitch',   label:'Twitch' },
  { value:'substack', label:'Substack' },
  { value:'multi',    label:'Multi-Platform' },
];

const ARCHETYPE_LABELS = {
  polished_curator:  'Polished Curator',
  messy_transparent: 'Messy Transparent',
  soft_life:         'Soft Life',
  explicitly_paid:   'Explicitly Paid',
  overnight_rise:    'Overnight Rise',
  cautionary:        'Cautionary',
  the_peer:          'The Peer',
  the_watcher:       'The Watcher',
  chaos_creator:     'Chaos Creator',
  community_builder: 'Community Builder',
};

const STATUS_LABELS = {
  draft:'Draft', generated:'Generated', finalized:'Finalized', crossed:'Crossed', archived:'Archived',
};

const STATUS_COLORS = {
  draft:     { bg:'#f0f0f5',     color:'#6b6a80' },
  generated: { bg:C.blueLight,  color:'#1e4a7a' },
  finalized: { bg:'#e8f5ee',    color:'#2d7a50' },
  crossed:   { bg:C.lavLight,   color:'#5c2d8a' },
  archived:  { bg:'#f0ede6',    color:'#6b6560' },
};

const FEED_STATE_CONFIG = {
  rising:        { label:'Rising',        color:'#4a8a3c', bg:'#eef7ec' },
  peaking:       { label:'Peaking',       color:'#8a6010', bg:'#fdf8e8' },
  plateauing:    { label:'Plateauing',    color:'#6b6a80', bg:'#f0f0f5' },
  controversial: { label:'Controversial', color:'#8a4410', bg:'#fdf0e8' },
  cancelled:     { label:'Cancelled',     color:'#8a2020', bg:'#fde8e8' },
  gone_dark:     { label:'Gone Dark',     color:'#444',    bg:'#eee' },
  rebuilding:    { label:'Rebuilding',    color:'#1e4a7a', bg:C.blueLight },
  crossed:       { label:'Crossed',       color:'#5c2d8a', bg:C.lavLight },
};

const LALAVERSE_CITIES = [
  { value:'nova_prime',  label:'Nova Prime', desc:'Fashion & Aspiration' },
  { value:'velour_city', label:'Velour City', desc:'Music & Culture' },
  { value:'the_drift',   label:'The Drift', desc:'Underground & Anti-Algorithm' },
  { value:'solenne',     label:'Solenne', desc:'Luxury & Soft Life' },
  { value:'cascade_row', label:'Cascade Row', desc:'Commerce & Hustle' },
];

const LALA_RELATIONSHIPS = [
  { value:'mutual_unaware', label:'Mutual Unaware' },
  { value:'one_sided',      label:'Lala watches them' },
  { value:'aware',          label:'Both aware' },
  { value:'direct',         label:'Know each other' },
  { value:'competitive',    label:'Active competition' },
];

const CAREER_PRESSURES = [
  { value:'ahead',          label:'Ahead of Lala' },
  { value:'level',          label:'Level with Lala' },
  { value:'behind',         label:'Behind Lala' },
  { value:'different_lane', label:'Different lane' },
];

const PROTAGONISTS = [
  {
    key:'justawoman', label:'Book 1 · JustAWoman', icon:'◈',
    context: {
      name:'JustAWoman',
      description:'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
      wound:'She does everything right and the right room has not found her yet.',
      goal:'To be legendary.', audience:'Besties',
      detail:'She posts for women. Men show up with their wallets and something in her responds.',
    },
  },
  {
    key:'lala', label:'Book 2 · Lala', icon:'✦',
    context: {
      name:'Lala',
      description:'Born from JustAWoman\'s world but building her own. Young, sharp, digitally native.',
      wound:'She inherited her mother\'s ambition but not her patience.',
      goal:'To become something that can\'t be copied.',
      audience:'The generation that learned to perform before they learned to feel',
      detail:'The line between consuming and creating dissolved before she noticed.',
    },
  },
];

function lalaClass(score) { return score>=7?'high':score>=4?'mid':'low'; }
function getToken() { return localStorage.getItem('authToken')||localStorage.getItem('token')||sessionStorage.getItem('token'); }
function authHeaders() { const t=getToken(); return t?{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}:{'Content-Type':'application/json'}; }

// ══════════════════════════════════════════════════════════════════════
export default function SocialProfileGenerator({ embedded=false, worldTag }) {
  const [profiles,setProfiles]   = useState([]);
  const [selected,setSelected]   = useState(null);
  const [loading,setLoading]     = useState(false);
  const [generating,setGenerating] = useState(false);
  const [error,setError]         = useState(null);
  const [filterStatus,setFilterStatus] = useState(null);
  const [view,setView]           = useState('feed');
  const [protagonist,setProtagonist] = useState(PROTAGONISTS[0]);
  const [page,setPage]           = useState(1);
  const [totalPages,setTotalPages] = useState(1);
  const [totalCount,setTotalCount] = useState(0);
  const [statusCounts,setStatusCounts] = useState({total:0,generated:0,finalized:0,crossed:0,archived:0});
  const PAGE_SIZE = 24;
  const [search,setSearch]       = useState('');
  const [sortBy,setSortBy]       = useState('score');
  const searchTimer = useRef(null);
  const [bulkMode,setBulkMode]   = useState(false);
  const [selectedIds,setSelectedIds] = useState(new Set());
  const [selectAllPages,setSelectAllPages] = useState(false);
  const [toast,setToast]         = useState(null);
  const toastTimer = useRef(null);
  const [handle,setHandle]       = useState('');
  const [platform,setPlatform]   = useState('instagram');
  const [vibe,setVibe]           = useState('');
  const [showAdvanced,setShowAdvanced] = useState(false);
  const [advFields,setAdvFields] = useState({location_hint:'',follower_hint:'',relationship_hint:'',drama_hint:'',aesthetic_hint:'',revenue_hint:''});
  const [activeJob,setActiveJob] = useState(null);
  // LalaVerse Feed layer
  const [feedLayer,setFeedLayer] = useState('real_world');
  const [lvCity,setLvCity]       = useState('');
  const [lvRelationship,setLvRelationship] = useState('mutual_unaware');
  const [lvPressure,setLvPressure] = useState('level');
  const [justAwomanProfile,setJustAwomanProfile] = useState(null);

  // ── Load profiles ──────────────────────────────────────────────────
  const loadProfiles = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const pg=targetPage||page;
      const qs=new URLSearchParams();
      if(filterStatus)qs.set('status',filterStatus);
      if(search.trim())qs.set('search',search.trim());
      qs.set('sort',sortBy);qs.set('page',pg);qs.set('limit',PAGE_SIZE);
      qs.set('feed_layer',feedLayer);
      const res=await fetch(`${API}?${qs}`,{headers:authHeaders()});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`Server error (${res.status})`);}
      const data=await res.json();
      setProfiles(data.profiles||[]);
      if(data.pagination){setTotalPages(data.pagination.totalPages||1);setTotalCount(data.pagination.total||0);}
      if(data.statusCounts)setStatusCounts(data.statusCounts);
    } catch(err){setError(err.message);}
    finally{setLoading(false);}
  },[filterStatus,search,sortBy,page,feedLayer]);

  useEffect(()=>{loadProfiles();},[loadProfiles]);

  // Load JustAWoman's locked record for Lala's Feed pinned card
  useEffect(()=>{
    if(feedLayer!=='lalaverse'){setJustAwomanProfile(null);return;}
    fetch(`${API}?feed_layer=lalaverse&search=justawoman&limit=1`,{headers:authHeaders()})
      .then(r=>r.json())
      .then(d=>{const jw=(d.profiles||[]).find(p=>p.is_justawoman_record);setJustAwomanProfile(jw||null);})
      .catch(()=>{});
  },[feedLayer]);

  // ── SSE job tracking ───────────────────────────────────────────────
  const sseRef = useRef(null);
  const sseRetryTimer = useRef(null);
  const [cancellingJob,setCancellingJob] = useState(false);

  const connectJobSSE = useCallback((jobId)=>{
    if(sseRef.current){sseRef.current.close();sseRef.current=null;}
    if(sseRetryTimer.current){clearTimeout(sseRetryTimer.current);sseRetryTimer.current=null;}
    const es=new EventSource(`${API}/bulk/jobs/${jobId}/stream`);
    sseRef.current=es;
    es.addEventListener('connected',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,...d,id:jobId}));}catch{}});
    es.addEventListener('started',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,...d,status:'processing'}));}catch{}});
    es.addEventListener('profile_complete',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,completed:d.completed,total:d.total,status:'processing'}));}catch{}});
    es.addEventListener('profile_failed',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,completed:d.completed,failed:d.failed,total:d.total,status:'processing'}));}catch{}});
    es.addEventListener('cancelled',()=>{setActiveJob(p=>p?{...p,status:'cancelled'}:p);localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();});
    es.addEventListener('done',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,...d,status:'completed'}));}catch{}localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();});
    es.addEventListener('error',()=>{es.close();sseRef.current=null;sseRetryTimer.current=setTimeout(async()=>{sseRetryTimer.current=null;try{const res=await fetch(`${API}/bulk/jobs/${jobId}`,{headers:authHeaders()});const d=await res.json();if(d.job){setActiveJob(d.job);if(['completed','failed','cancelled'].includes(d.job.status)){localStorage.removeItem('spg_active_job');loadProfiles();}else{connectJobSSE(jobId);}}}catch{}},3000);});
  },[loadProfiles]);

  useEffect(()=>{
    const saved=localStorage.getItem('spg_active_job');
    if(saved){fetch(`${API}/bulk/jobs/${saved}`,{headers:authHeaders()}).then(r=>r.json()).then(d=>{if(d.job){setActiveJob(d.job);if(!['completed','failed','cancelled'].includes(d.job.status))connectJobSSE(saved);else localStorage.removeItem('spg_active_job');}}).catch(()=>{});}
    return()=>{if(sseRef.current){sseRef.current.close();sseRef.current=null;}if(sseRetryTimer.current){clearTimeout(sseRetryTimer.current);sseRetryTimer.current=null;}};
  },[connectJobSSE]);

  const startJobPolling = id=>{localStorage.setItem('spg_active_job',id);setActiveJob({id,status:'pending',total:0,completed:0,failed:0});connectJobSSE(id);};
  const dismissJob = ()=>{setActiveJob(null);localStorage.removeItem('spg_active_job');if(sseRef.current){sseRef.current.close();sseRef.current=null;}};
  const cancelJob = async()=>{if(!activeJob?.id)return;setCancellingJob(true);try{await fetch(`${API}/bulk/jobs/${activeJob.id}/cancel`,{method:'POST',headers:authHeaders()});}catch{}finally{setCancellingJob(false);}};

  const showToast = (message,type='success')=>{clearTimeout(toastTimer.current);setToast({message,type});toastTimer.current=setTimeout(()=>setToast(null),4000);};

  const changeFilter = s=>{setFilterStatus(s);setPage(1);setSelectedIds(new Set());};
  const changeSort   = s=>{setSortBy(s);setPage(1);};
  const handleSearch = val=>{setSearch(val);clearTimeout(searchTimer.current);searchTimer.current=setTimeout(()=>setPage(1),400);};

  // ── Bulk helpers ───────────────────────────────────────────────────
  const toggleSelect = id=>{setSelectAllPages(false);setSelectedIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});};
  const clearSelection = ()=>{setSelectedIds(new Set());setSelectAllPages(false);setBulkMode(false);};
  const getBulkIds = async()=>{
    if(!selectAllPages)return[...selectedIds];
    const allIds=[];let pg=1;
    while(true){const qs=new URLSearchParams();if(filterStatus)qs.set('status',filterStatus);if(search.trim())qs.set('search',search.trim());qs.set('sort',sortBy);qs.set('page',pg);qs.set('limit',100);const res=await fetch(`${API}?${qs}`,{headers:authHeaders()});const d=await res.json();const batch=(d.profiles||[]).map(p=>p.id);allIds.push(...batch);if(batch.length<100||allIds.length>=(d.total||0))break;pg++;}
    return allIds;
  };
  const runBulk = async(ids,endpoint)=>{const results=[];for(let i=0;i<ids.length;i+=100){const chunk=ids.slice(i,i+100);const res=await fetch(`${API}/${endpoint}`,{method:'POST',headers:authHeaders(),body:JSON.stringify({ids:chunk})});const d=await res.json();if(!res.ok)throw new Error(d.error);results.push(d);}return results;};
  const bulkOp = async(endpoint,confirmMsg,onDone)=>{const ids=await getBulkIds();if(!ids.length)return;if(!window.confirm(confirmMsg.replace('$n',selectAllPages?`all ${statusCounts.total}`:ids.length)))return;try{const r=await runBulk(ids,endpoint);onDone(r);setSelectedIds(new Set());setSelectAllPages(false);loadProfiles();}catch(err){setError(err.message);}};

  // ── Generate ───────────────────────────────────────────────────────
  const generateProfile = async()=>{
    if(!handle.trim()||!vibe.trim())return;
    setGenerating(true);setError(null);
    try{
      const hasAdv=Object.values(advFields).some(v=>v);
      const lvFields=feedLayer==='lalaverse'?{feed_layer:'lalaverse',city:lvCity,lala_relationship:lvRelationship,career_pressure:lvPressure}:{feed_layer:'real_world'};
      const res=await fetch(`${API}/generate`,{method:'POST',headers:authHeaders(),body:JSON.stringify({handle:handle.trim(),platform,vibe_sentence:vibe.trim(),character_context:protagonist.context,character_key:protagonist.key,...lvFields,...(hasAdv?{advanced_context:advFields}:{})})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Generation failed');
      setSelected(data.profile);setHandle('');setVibe('');setAdvFields({location_hint:'',follower_hint:'',relationship_hint:'',drama_hint:'',aesthetic_hint:'',revenue_hint:''});setShowAdvanced(false);setPage(1);loadProfiles(1);
    }catch(err){setError(err.message);}
    finally{setGenerating(false);}
  };

  const finalizeProfile = async id=>{try{const res=await fetch(`${API}/${id}/finalize`,{method:'POST',headers:authHeaders()});const d=await res.json();if(!res.ok)throw new Error(d.error);setProfiles(p=>p.map(x=>x.id===id?d.profile:x));if(selected?.id===id)setSelected(d.profile);}catch(err){setError(err.message);}};
  const crossProfile   = async id=>{try{const res=await fetch(`${API}/${id}/cross`,{method:'POST',headers:authHeaders(),body:JSON.stringify({})});const d=await res.json();if(!res.ok)throw new Error(d.error);setProfiles(p=>p.map(x=>x.id===id?d.profile:x));if(selected?.id===id)setSelected(d.profile);}catch(err){setError(err.message);}};
  const editProfile    = async(id,updates)=>{try{const res=await fetch(`${API}/${id}`,{method:'PUT',headers:authHeaders(),body:JSON.stringify(updates)});const d=await res.json();if(!res.ok)throw new Error(d.error);setProfiles(p=>p.map(x=>x.id===id?d.profile:x));if(selected?.id===id)setSelected(d.profile);}catch(err){setError(err.message);}};
  const deleteProfile  = async id=>{if(!window.confirm('Delete this profile permanently?'))return;try{const res=await fetch(`${API}/${id}`,{method:'DELETE',headers:authHeaders()});const d=await res.json();if(!res.ok)throw new Error(d.error);setProfiles(p=>p.filter(x=>x.id!==id));if(selected?.id===id)setSelected(null);}catch(err){setError(err.message);}};

  const fp = p=>p?.full_profile||p||{};
  const feedCap = feedLayer==='lalaverse'?200:443;
  const stats = { total:statusCounts.total||totalCount, generated:statusCounts.generated, finalized:statusCounts.finalized, crossed:statusCounts.crossed };

  const Pagination = ()=>{
    if(loading||totalPages<=1)return null;
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 0',fontSize:13}}>
        <PageBtn disabled={page<=1} onClick={()=>setPage(1)}>«</PageBtn>
        <PageBtn disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹ Prev</PageBtn>
        <span style={{color:C.inkLight,fontSize:12}}>Page {page} of {totalPages}</span>
        <PageBtn disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next ›</PageBtn>
        <PageBtn disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>»</PageBtn>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',...(embedded?{flex:1,minHeight:0}:{minHeight:'100vh'}),background:C.surfaceAlt,fontFamily:C.font}}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'16px 24px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:14}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.ink,marginBottom:2}}>📱 The Feed <span style={{fontSize:12,fontWeight:600,color:C.pink,background:'#f9e4ec',padding:'2px 8px',borderRadius:4,marginLeft:6,verticalAlign:'middle',letterSpacing:'0.3px'}}>{protagonist.icon} {protagonist.context.name}</span></div>
            <div style={{fontSize:13,color:C.inkLight}}>Parasocial Creator Profiles — {protagonist.context.name === 'Lala' ? "Lala's inherited digital world" : "JustAWoman's real-world online ecosystem"}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {/* Protagonist switcher — hidden when embedded in WorldStudio */}
            {!embedded && <div style={{display:'flex',gap:4,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:3,border:`1px solid ${C.border}`}}>
              {PROTAGONISTS.map(p=>(
                <button key={p.key} onClick={()=>setProtagonist(p)} style={{padding:'5px 12px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
                  background:protagonist.key===p.key?C.lavender:'transparent',
                  color:protagonist.key===p.key?'#fff':C.inkLight,transition:'all 0.15s'}}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>}
            <button onClick={()=>setView(view==='feed'?'bulk':'feed')} style={{padding:'7px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>
              {view==='feed'?'⊞ Bulk Import':'← Back to Feed'}
            </button>
          </div>
        </div>
        {/* Feed layer switcher */}
        <div style={{display:'flex',gap:4,marginBottom:12,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:3,border:`1px solid ${C.border}`,alignSelf:'flex-start'}}>
          <button onClick={()=>{setFeedLayer('real_world');setPage(1);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='real_world'?C.blue:'transparent',color:feedLayer==='real_world'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            JustAWoman's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='real_world'?`${stats.total}/${feedCap}`:''}</span>
          </button>
          <button onClick={()=>{setFeedLayer('lalaverse');setPage(1);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='lalaverse'?C.lavender:'transparent',color:feedLayer==='lalaverse'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            Lala's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='lalaverse'?`${stats.total}/${feedCap}`:''}</span>
          </button>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:20,alignItems:'center'}}>
          {[['Profiles',stats.total,stats.total>=feedCap?'#c0392b':stats.total>=(feedCap-23)?'#e67e22':feedLayer==='lalaverse'?C.lavender:C.blue],['Finalized',stats.finalized,'#2d7a50'],['Crossed',stats.crossed,C.pink]].map(([label,val,color])=>(
            <div key={label} style={{display:'flex',alignItems:'baseline',gap:6}}>
              <span style={{fontSize:22,fontWeight:700,color,lineHeight:1}}>{val||0}</span>
              <span style={{fontSize:12,color:C.inkLight}}>{label==='Profiles'?`/ ${feedCap}`:label}</span>
            </div>
          ))}
          {stats.total>=feedCap&&<span style={{fontSize:11,fontWeight:600,color:'#c0392b',background:'#fde8e8',padding:'2px 8px',borderRadius:4}}>Cap reached</span>}
          {stats.total>=(feedCap-23)&&stats.total<feedCap&&<span style={{fontSize:11,fontWeight:600,color:'#e67e22',background:'#fef3e0',padding:'2px 8px',borderRadius:4}}>{feedCap-stats.total} remaining</span>}
        </div>
      </div>

      {/* ── Job Banner ──────────────────────────────────────────── */}
      {activeJob && (
        <div style={{background:activeJob.status==='completed'?'#e8f5ee':activeJob.status==='failed'?'#fde8e8':C.lavLight,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',alignItems:'center',gap:12,fontSize:13}}>
          <span style={{flex:1,color:activeJob.status==='completed'?'#2d7a50':activeJob.status==='failed'?'#8a2020':C.inkMid}}>
            {activeJob.status==='processing'&&<>⟳ Generating… {activeJob.completed||0}/{activeJob.total||0} done{activeJob.failed>0?`, ${activeJob.failed} failed`:''}</>}
            {activeJob.status==='pending'&&<>⟳ Job queued — waiting to start…</>}
            {activeJob.status==='completed'&&<>✓ Import complete — {activeJob.completed}/{activeJob.total} profiles generated</>}
            {activeJob.status==='cancelled'&&<>⊘ Job cancelled — {activeJob.completed||0}/{activeJob.total||0} generated</>}
            {activeJob.status==='failed'&&<>✕ Job failed{activeJob.error_message?`: ${activeJob.error_message}`:''}</>}
          </span>
          {['processing','pending'].includes(activeJob.status)&&(
            <div style={{width:200,height:4,background:C.border,borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:C.lavender,transition:'width 0.5s',width:`${activeJob.total?((activeJob.completed||0)/activeJob.total)*100:0}%`}}/>
            </div>
          )}
          {['processing','pending'].includes(activeJob.status)&&(
            <button onClick={cancelJob} disabled={cancellingJob} style={{padding:'4px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.pink,border:`1px solid ${C.pinkMid}`,cursor:'pointer'}}>{cancellingJob?'Cancelling…':'✕ Cancel'}</button>
          )}
          {['completed','failed','cancelled'].includes(activeJob.status)&&(
            <button onClick={dismissJob} style={{padding:'4px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkLight,border:`1px solid ${C.border}`,cursor:'pointer'}}>Dismiss</button>
          )}
        </div>
      )}

      {/* ── Bulk Import View ─────────────────────────────────── */}
      {view==='bulk' && (
        <FeedBulkImport onDone={()=>{setView('feed');setPage(1);loadProfiles(1);}} characterContext={protagonist.context} characterKey={protagonist.key} onJobStarted={jobId=>{setView('feed');startJobPolling(jobId);}}/>
      )}

      {view==='feed' && <>
        {/* ── Spark Form ──────────────────────────────────────── */}
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'16px 24px'}}>
          <div style={{fontSize:12,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
            ✦ New Creator Spark
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:140}}>
              <label style={{fontSize:11,fontWeight:600,color:C.inkLight}}>Handle</label>
              <input value={handle} onChange={e=>setHandle(e.target.value)} disabled={generating} placeholder="@username" style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font,outline:'none'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:140}}>
              <label style={{fontSize:11,fontWeight:600,color:C.inkLight}}>Platform</label>
              <select value={platform} onChange={e=>setPlatform(e.target.value)} disabled={generating} style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font}}>
                {PLATFORMS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:200}}>
              <label style={{fontSize:11,fontWeight:600,color:C.inkLight}}>Vibe</label>
              <input value={vibe} onChange={e=>setVibe(e.target.value)} disabled={generating} placeholder="One sentence — who is this creator?" style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font,outline:'none'}}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&generateProfile()}/>
            </div>
            <button onClick={generateProfile} disabled={generating||!handle.trim()||!vibe.trim()} style={{
              padding:'9px 20px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,border:'none',cursor:generating||!handle.trim()||!vibe.trim()?'not-allowed':'pointer',
              background:generating||!handle.trim()||!vibe.trim()?C.border:C.lavender,
              color:generating||!handle.trim()||!vibe.trim()?C.inkLight:'#fff',
              display:'flex',alignItems:'center',gap:6,transition:'all 0.15s',
            }}>
              {generating?<><Spinner/> Generating…</>:'✦ Generate'}
            </button>
          </div>

          {/* Advanced toggle */}
          <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{marginTop:10,background:'none',border:'none',cursor:'pointer',fontSize:12,color:C.inkLight,display:'flex',alignItems:'center',gap:4,padding:'4px 0'}}>
            <span style={{transition:'transform 0.2s',display:'inline-block',transform:showAdvanced?'rotate(90deg)':'none'}}>▸</span>
            Advanced Context
            <span style={{color:C.inkLight,opacity:0.6,fontSize:11}}>— optional hints for AI</span>
          </button>
          {showAdvanced && (
            <div style={{marginTop:10,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,padding:'14px',background:C.surfaceAlt,borderRadius:C.radiusSm,border:`1px solid ${C.border}`}}>
              {[['📍 Location','location_hint','e.g. Atlanta, London'],['👥 Follower Range','follower_hint','e.g. 50K-100K'],['💔 Relationship','relationship_hint','e.g. ex of @handle'],['🔥 Drama','drama_hint','e.g. cheating scandal'],['🎨 Aesthetic','aesthetic_hint','e.g. clean girl, y2k'],['💰 Revenue','revenue_hint','e.g. brand deals only']].map(([label,key,ph])=>(
                <div key={key} style={{display:'flex',flexDirection:'column',gap:3}}>
                  <label style={{fontSize:11,fontWeight:600,color:C.inkLight}}>{label}</label>
                  <input value={advFields[key]} onChange={e=>setAdvFields(f=>({...f,[key]:e.target.value}))} disabled={generating} placeholder={ph} style={{padding:'6px 10px',borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font}}/>
                </div>
              ))}
            </div>
          )}
          {/* LalaVerse-specific fields */}
          {feedLayer==='lalaverse'&&(
            <div style={{marginTop:12,display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:180}}>
                <label style={{fontSize:11,fontWeight:600,color:C.lavender}}>City</label>
                <select value={lvCity} onChange={e=>setLvCity(e.target.value)} disabled={generating} style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.lavender}40`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font}}>
                  <option value="">Select city...</option>
                  {LALAVERSE_CITIES.map(c=><option key={c.value} value={c.value}>{c.label} — {c.desc}</option>)}
                </select>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:160}}>
                <label style={{fontSize:11,fontWeight:600,color:C.lavender}}>Lala's Relationship</label>
                <select value={lvRelationship} onChange={e=>setLvRelationship(e.target.value)} disabled={generating} style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.lavender}40`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font}}>
                  {LALA_RELATIONSHIPS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:140}}>
                <label style={{fontSize:11,fontWeight:600,color:C.lavender}}>Career Pressure</label>
                <select value={lvPressure} onChange={e=>setLvPressure(e.target.value)} disabled={generating} style={{padding:'8px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.lavender}40`,fontSize:13,color:C.ink,background:C.surface,fontFamily:C.font}}>
                  {CAREER_PRESSURES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
          )}
          {error && <div style={{color:C.pink,marginTop:8,fontSize:12}}>{error}</div>}
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          {/* Toolbar */}
          <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',flexShrink:0}}>
            {/* Status filters */}
            <div style={{display:'flex',gap:4}}>
              {[null,'generated','finalized','crossed','archived'].map(s=>{
                const cnt=s?(statusCounts[s]||0):statusCounts.total;
                const isActive=filterStatus===s;
                return (
                  <button key={s||'all'} onClick={()=>changeFilter(s)} style={{padding:'5px 12px',borderRadius:14,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',
                    background:isActive?C.lavLight:'transparent',color:isActive?C.lavender:C.inkLight,
                    border:`1.5px solid ${isActive?C.lavender:'transparent'}`}}>
                    {s?STATUS_LABELS[s]:'All'}
                    {cnt>0&&<span style={{marginLeft:4,fontSize:10,background:isActive?C.lavender:C.border,color:isActive?'#fff':C.inkLight,borderRadius:8,padding:'0 5px'}}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Search handle or name…" style={{padding:'6px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,width:200}}/>
              <select value={sortBy} onChange={e=>changeSort(e.target.value)} style={{padding:'6px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,background:C.surface}}>
                <option value="score">Score ↓</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="handle">Handle A–Z</option>
              </select>
              <button onClick={()=>{const e=!bulkMode;setBulkMode(e);setSelectedIds(new Set());if(e)setSelected(null);}} style={{padding:'6px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',
                background:bulkMode?C.lavLight:'transparent',color:bulkMode?C.lavender:C.inkLight,
                border:`1.5px solid ${bulkMode?C.lavender:C.border}`}}>
                {bulkMode?'✕ Cancel':'☐ Select'}
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {bulkMode && (
            <div style={{background:C.lavLight,borderBottom:`1px solid ${C.lavender}40`,padding:'8px 24px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',flexShrink:0}}>
              <button onClick={()=>setSelectedIds(new Set(profiles.map(p=>p.id)))} style={sBtnSm}>Select Page ({profiles.length})</button>
              {totalCount>profiles.length&&<button onClick={()=>setSelectAllPages(true)} style={sBtnSm}>Select All {totalCount}</button>}
              {(selectedIds.size>0||selectAllPages)&&<span style={{fontSize:12,color:C.lavender,fontWeight:700}}>{selectAllPages?`All ${totalCount}`:selectedIds.size} selected</span>}
              <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/finalize','Finalize $n profile(s)?',r=>{const t=r.reduce((a,d)=>a+(d.finalized||0),0);showToast(`Finalized ${t} profile(s)`);})} style={{...sBtnSm,background:'#e8f5ee',color:'#2d7a50'}}>✓ Finalize</button>
                <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/cross','Cross $n profile(s) into the story world?',r=>{const t=r.reduce((a,d)=>a+(d.crossed||0),0);showToast(`Crossed ${t} profile(s)`);})} style={{...sBtnSm,background:C.lavLight,color:C.lavender}}>✦ Cross</button>
                <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/archive','Archive $n profile(s)?',r=>{const t=r.reduce((a,d)=>a+(d.archived||0),0);showToast(`Archived ${t} profile(s)`);})} style={sBtnSm}>▪ Archive</button>
                <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/delete','Permanently delete $n profile(s)? This cannot be undone.',r=>{const t=r.reduce((a,d)=>a+(d.deleted||0),0);showToast(`Deleted ${t} profile(s)`,'warn');})} style={{...sBtnSm,color:C.pink}}>✕ Delete</button>
              </div>
            </div>
          )}

          <div style={{flex:1,padding:'16px 24px',overflowY:'auto'}}>
            <Pagination/>
            {/* JustAWoman's pinned record — Lala's Feed only */}
            {feedLayer==='lalaverse'&&justAwomanProfile&&page===1&&!search&&(
              <div style={{background:C.surface,borderRadius:C.radius,border:`2px solid ${C.pink}`,marginBottom:16,overflow:'hidden',boxShadow:C.shadowMd}}>
                <div style={{height:3,background:`linear-gradient(90deg,${C.pink},${C.lavender})`}}/>
                <div style={{padding:'14px 18px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <span style={{fontSize:16,fontWeight:700,color:C.ink}}>@justawoman</span>
                      <span style={{fontSize:12,color:C.inkMid,marginLeft:8}}>{justAwomanProfile.display_name}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10,background:C.pinkLight,color:C.pink}}>Locked</span>
                  </div>
                  <div style={{fontSize:12,color:C.lavender,fontWeight:600,fontStyle:'italic',marginBottom:6}}>The one she doesn't know she's becoming</div>
                  <div style={{fontSize:13,color:C.inkMid,lineHeight:1.6,marginBottom:10}}>{justAwomanProfile.content_persona}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.pinkLight,color:C.pink}}>mega</span>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:'#fdf8e8',color:'#8a6010'}}>Peaking</span>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>ahead</span>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>multi-platform</span>
                  </div>
                </div>
              </div>
            )}
            {loading && <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,gap:10,color:C.inkLight}}><Spinner/> Loading profiles…</div>}
            {!loading&&profiles.length===0 && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,gap:12,textAlign:'center'}}>
                <div style={{fontSize:40,opacity:0.2}}>📱</div>
                <div style={{fontSize:15,fontWeight:600,color:C.ink}}>{search?'No matching creators':'No creators yet'}</div>
                <div style={{fontSize:13,color:C.inkLight}}>{search?'Try a different search term':'Enter a handle, platform, and vibe above to generate a creator profile'}</div>
              </div>
            )}
            {!loading&&profiles.length>0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14,marginBottom:16}}>
                {profiles.map(p=>{
                  const d=fp(p);
                  const isChecked=selectAllPages||selectedIds.has(p.id);
                  const isActive=selected?.id===p.id;
                  const sc=p.current_state&&FEED_STATE_CONFIG[p.current_state];
                  const stc=STATUS_COLORS[p.status]||STATUS_COLORS.draft;
                  const score=p.lala_relevance_score??d.lala_relevance_score??0;
                  const lc=lalaClass(score);
                  return (
                    <div key={p.id} onClick={()=>bulkMode?toggleSelect(p.id):setSelected(selected?.id===p.id?null:p)}
                      style={{background:C.surface,borderRadius:C.radius,border:`2px solid ${isActive?C.lavender:isChecked?C.lavender+'80':C.border}`,cursor:'pointer',overflow:'hidden',boxShadow:isActive?C.shadowMd:C.shadow,transition:'all 0.15s',position:'relative'}}>
                      {/* Top accent bar */}
                      <div style={{height:3,background:`linear-gradient(90deg,${C.pink},${C.lavender})`}}/>
                      {/* Checkbox */}
                      {bulkMode && (
                        <div style={{position:'absolute',top:10,right:10,width:20,height:20,borderRadius:5,border:`2px solid ${isChecked?C.lavender:C.border}`,background:isChecked?C.lavender:C.surface,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700}}>
                          {isChecked?'✓':''}
                        </div>
                      )}
                      <div style={{padding:'12px 14px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:4,gap:6}}>
                          <span style={{fontSize:14,fontWeight:700,color:C.ink}}>{p.handle}</span>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                            {sc&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10,background:sc.bg,color:sc.color}}>{sc.label}</span>}
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10,background:stc.bg,color:stc.color}}>{STATUS_LABELS[p.status]||p.status}</span>
                          </div>
                        </div>
                        {(p.display_name||d.display_name)&&<div style={{fontSize:12,color:C.inkMid,marginBottom:2}}>{p.display_name||d.display_name}</div>}
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:8,background:C.blueLight,color:C.blue}}>{p.platform}</span>
                          {(p.archetype||d.archetype)&&<span style={{fontSize:10,color:C.inkLight}}>{ARCHETYPE_LABELS[p.archetype||d.archetype]||p.archetype||d.archetype}</span>}
                          {p.adult_content_present&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:'#fde8e8',color:C.pink}}>18+</span>}
                        </div>
                        <div style={{fontSize:12,color:C.inkMid,lineHeight:1.5,marginBottom:8,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                          {p.content_persona||d.content_persona||p.vibe_sentence}
                        </div>
                        {(p.geographic_cluster||p.engagement_rate)&&(
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                            {p.geographic_cluster&&<span style={{fontSize:10,color:C.inkLight}}>📍 {p.geographic_cluster}</span>}
                            {p.engagement_rate&&<span style={{fontSize:10,color:C.inkLight}}>💬 {p.engagement_rate}</span>}
                          </div>
                        )}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span style={{fontSize:11,color:C.inkLight}}>{p.follower_count_approx||d.follower_count_approx||'—'}</span>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            {p.followers?.length>0&&(
                              <div style={{display:'flex',gap:3}}>
                                {p.followers.map(f=>(
                                  <span key={f.character_key} title={`${f.character_name} follows`} style={{fontSize:14,color:f.character_key==='justawoman'?C.blue:C.lavender}}>{f.character_key==='justawoman'?'◈':'✦'}</span>
                                ))}
                              </div>
                            )}
                            <div style={{display:'flex',alignItems:'center',gap:3}}>
                              <div style={{width:40,height:3,borderRadius:2,background:C.border,overflow:'hidden'}}>
                                <div style={{height:'100%',borderRadius:2,background:lc==='high'?C.lavender:lc==='mid'?C.blue:C.inkLight,width:`${score*10}%`}}/>
                              </div>
                              <span style={{fontSize:10,fontWeight:700,color:lc==='high'?C.lavender:lc==='mid'?C.blue:C.inkLight}}>✦{score}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination/>
          </div>
        </div>
      </>}

      {/* Detail side panel */}
      {selected && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9998,display:'flex',justifyContent:'flex-end'}}>
          {/* Backdrop — click to close */}
          <div onClick={()=>setSelected(null)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.25)',backdropFilter:'blur(2px)',cursor:'pointer'}}/>
          {/* Panel */}
          <div style={{position:'relative',width:'min(520px,90vw)',height:'100%',background:C.surface,boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',overflowY:'auto',animation:'slideInRight 0.2s ease-out'}}>
            <DetailPanel profile={selected} fp={fp(selected)} onClose={()=>setSelected(null)}
              onFinalize={finalizeProfile} onCross={crossProfile} onEdit={editProfile} onDelete={deleteProfile} onRefresh={loadProfiles}/>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && createPortal(
        <div onClick={()=>setToast(null)} style={{position:'fixed',bottom:24,right:24,zIndex:9999,padding:'12px 18px',borderRadius:C.radiusSm,fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:C.shadowMd,
          background:toast.type==='error'?'#fde8e8':toast.type==='warn'?'#fdf8e8':'#e8f5ee',
          color:toast.type==='error'?'#8a2020':toast.type==='warn'?'#8a6010':'#2d7a50',
          border:`1px solid ${toast.type==='error'?C.pinkMid:toast.type==='warn'?'#f0d890':'#b6dfc8'}`}}>
          {toast.message}
        </div>,
        document.body
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}

// ── Shared button style for bulk bar ──────────────────────────────────
const sBtnSm = { padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.inkMid };

// ── Spinner ───────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{width:14,height:14,border:`2px solid ${C.lavender}40`,borderTopColor:C.lavender,borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}/>;
}

// ── Page button ───────────────────────────────────────────────────────
function PageBtn({ children, disabled, onClick }) {
  return <button disabled={disabled} onClick={onClick} style={{padding:'5px 10px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,border:`1px solid ${C.border}`,background:'transparent',color:disabled?C.border:C.inkMid,cursor:disabled?'not-allowed':'pointer'}}>{children}</button>;
}

// ── Feed State Picker ─────────────────────────────────────────────────
function FeedStatePicker({ profile, onStateChange }) {
  const [open,setOpen]   = useState(false);
  const [saving,setSaving] = useState(false);
  const current = profile.current_state;
  const cfg     = current?FEED_STATE_CONFIG[current]:null;
  const changeState = async newState=>{
    if(newState===current||saving)return;
    setSaving(true);
    try{await fetch(`${API}/${profile.id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify({current_state:newState})});onStateChange?.();}
    catch(err){console.error('State change failed:',err);}
    finally{setSaving(false);setOpen(false);}
  };
  return (
    <div style={{position:'relative'}}>
      <button onClick={e=>{e.stopPropagation();setOpen(!open);}} style={{padding:'4px 12px',borderRadius:12,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',
        background:cfg?cfg.bg:C.border,color:cfg?cfg.color:C.inkLight}}>
        {cfg?cfg.label:'Set State'} ▾
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusSm,boxShadow:C.shadowMd,zIndex:100,minWidth:140,overflow:'hidden'}}>
          {Object.entries(FEED_STATE_CONFIG).map(([s,sc])=>(
            <button key={s} onClick={e=>{e.stopPropagation();changeState(s);}} disabled={saving} style={{width:'100%',padding:'7px 12px',textAlign:'left',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:s===current?sc.bg:'transparent',color:sc.color,display:'block'}}>{sc.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════
function DetailPanel({ profile, fp: d, onClose, onFinalize, onCross, onEdit, onDelete, onRefresh }) {
  const p = profile;
  const [editing,setEditing] = useState(false);
  const [draft,setDraft]     = useState({});
  const [followers,setFollowers] = useState(p.followers||[]);
  const [followLoading,setFollowLoading] = useState(null);

  useEffect(()=>{setFollowers(p.followers||[]);},[profile?.id]);

  const score = p.lala_relevance_score??d.lala_relevance_score??0;
  const lc    = lalaClass(score);
  const lColor = lc==='high'?C.lavender:lc==='mid'?C.blue:C.inkLight;

  const startEdit = ()=>{
    setDraft({ handle:p.handle||'', display_name:p.display_name||d.display_name||'', platform:p.platform||'', vibe_sentence:p.vibe_sentence||'', content_persona:p.content_persona||d.content_persona||'', real_signal:p.real_signal||d.real_signal||'', posting_voice:p.posting_voice||d.posting_voice||'', comment_energy:p.comment_energy||d.comment_energy||'', parasocial_function:p.parasocial_function||d.parasocial_function||'', emotional_activation:d.emotional_activation||p.emotional_activation||'', watch_reason:d.watch_reason||p.watch_reason||'', what_it_costs_her:d.what_it_costs_her||p.what_it_costs_her||'', current_trajectory:p.current_trajectory||d.current_trajectory||'', pinned_post:p.pinned_post||d.pinned_post||'' });
    setEditing(true);
  };

  const toggleFollow = async protag=>{
    setFollowLoading(protag.key);
    try{
      const isF=followers.some(f=>f.character_key===protag.key);
      if(isF){await fetch(`${API}/${p.id}/followers/${protag.key}`,{method:'DELETE',headers:authHeaders()});setFollowers(prev=>prev.filter(f=>f.character_key!==protag.key));}
      else{const res=await fetch(`${API}/${p.id}/followers`,{method:'POST',headers:authHeaders(),body:JSON.stringify({character_key:protag.key,character_name:protag.context.name})});const dt=await res.json();if(dt.follower)setFollowers(prev=>[...prev,dt.follower]);}
      if(onRefresh)onRefresh();
    }catch(err){console.error('Follow toggle error:',err);}
    finally{setFollowLoading(null);}
  };

  const Section = ({title,children})=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6,paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>{title}</div>
      {children}
    </div>
  );
  const Field = ({label,value})=>value?(<div style={{marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:C.inkLight,marginBottom:2}}>{label}</div><div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{value}</div></div>):null;
  const inp=(label,key,multi)=>(
    <div style={{marginBottom:8}}>
      <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{label}</div>
      {multi?<textarea value={draft[key]||''} onChange={e=>setDraft(f=>({...f,[key]:e.target.value}))} rows={3} style={{width:'100%',padding:'7px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,resize:'vertical',fontFamily:C.font,boxSizing:'border-box'}}/>
            :<input value={draft[key]||''} onChange={e=>setDraft(f=>({...f,[key]:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,boxSizing:'border-box'}}/>}
    </div>
  );

  return (
    <div style={{minHeight:'100%'}}>
      {/* Accent bar */}
      <div style={{height:4,background:`linear-gradient(90deg,${C.pink},${C.lavender},${C.blue})`}}/>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.ink,marginBottom:2}}>{p.handle}</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              {(p.display_name||d.display_name)&&<span style={{fontSize:13,color:C.inkMid}}>{p.display_name||d.display_name}</span>}
              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{p.platform}</span>
              {(p.archetype||d.archetype)&&<span style={{fontSize:11,color:C.inkLight}}>{ARCHETYPE_LABELS[p.archetype||d.archetype]||p.archetype||d.archetype}</span>}
              {p.adult_content_present&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:'#fde8e8',color:C.pink}}>18+ Content</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.inkLight,lineHeight:1,flexShrink:0}}>×</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <FeedStatePicker profile={p} onStateChange={onRefresh}/>
          {editing?(
            <>
              <button onClick={()=>{onEdit(p.id,draft);setEditing(false);}} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:'none',cursor:'pointer'}}>✓ Save</button>
              <button onClick={()=>setEditing(false)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>Cancel</button>
            </>
          ):(
            <>
              {p.status==='generated'&&<button onClick={()=>onFinalize(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:'none',cursor:'pointer'}}>✓ Finalize</button>}
              {p.status==='finalized'&&<button onClick={()=>onCross(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:C.lavLight,color:C.lavender,border:'none',cursor:'pointer'}}>⚡ Cross Into World</button>}
              {p.status==='crossed'&&<span style={{fontSize:11,color:C.lavender,fontWeight:600}}>✦ Crossed {p.crossed_at?`on ${new Date(p.crossed_at).toLocaleDateString()}`:''}</span>}
              <button onClick={startEdit} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>✎ Edit</button>
              <button onClick={()=>onDelete(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.pink,border:`1px solid ${C.pinkMid}`,cursor:'pointer'}}>✕ Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {editing ? (
          <div style={{gridColumn:'1/-1'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px'}}>
              {inp('Handle','handle')}{inp('Display Name','display_name')}{inp('Platform','platform')}{inp('Vibe Sentence','vibe_sentence')}
            </div>
            {inp('Content Persona','content_persona',true)}{inp('Real Signal','real_signal',true)}{inp('Posting Voice','posting_voice',true)}{inp('Comment Energy','comment_energy',true)}{inp('Parasocial Function','parasocial_function',true)}{inp('Emotional Activation','emotional_activation',true)}{inp('Why She Watches','watch_reason',true)}{inp('What It Costs Her','what_it_costs_her',true)}{inp('Trajectory','current_trajectory')}{inp('Pinned Post','pinned_post',true)}
          </div>
        ) : (
          <>
            {/* Left column */}
            <div>
              <Section title="Content Persona"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.content_persona||d.content_persona}</div></Section>
              <Section title="Real Signal"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.real_signal||d.real_signal}</div></Section>
              <Section title="Posting Voice"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.posting_voice||d.posting_voice}</div></Section>
              <Section title="Comment Energy"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.comment_energy||d.comment_energy}</div></Section>
              {p.adult_content_present&&<Section title="Adult Content"><Field label="Type" value={p.adult_content_type||d.adult_content_type}/><Field label="Framing" value={p.adult_content_framing||d.adult_content_framing}/></Section>}
            </div>
            {/* Right column */}
            <div>
              <Section title="Parasocial Function">
                <div style={{fontSize:13,color:C.inkMid,lineHeight:1.7,marginBottom:8}}>{p.parasocial_function||d.parasocial_function}</div>
                <Field label="Emotional Activation" value={d.emotional_activation||p.emotional_activation}/>
                <Field label="Why She Watches" value={d.watch_reason||p.watch_reason}/>
                <Field label="What It Costs Her" value={d.what_it_costs_her||p.what_it_costs_her}/>
              </Section>
              <Section title="Trajectory">
                <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>{p.current_trajectory||d.current_trajectory}</div>
                <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.trajectory_detail||d.trajectory_detail}</div>
              </Section>
              <Section title="Lala Relevance">
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{flex:1,height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:3,background:lColor,width:`${score*10}%`,transition:'width 0.5s'}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:lColor,flexShrink:0}}>{score}/10</span>
                </div>
                <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.lala_relevance_reason||d.lala_relevance_reason}</div>
              </Section>
            </div>
          </>
        )}
      </div>

      {/* Followers section */}
      <div style={{padding:'0 20px 16px'}}>
        <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Character Followers</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {PROTAGONISTS.map(protag=>{
            const isF=followers.some(f=>f.character_key===protag.key);
            const fd=followers.find(f=>f.character_key===protag.key);
            const isL=followLoading===protag.key;
            return (
              <button key={protag.key} onClick={()=>toggleFollow(protag)} disabled={isL} style={{
                padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,cursor:'pointer',border:`1.5px solid ${isF?C.lavender:C.border}`,
                background:isF?C.lavLight:'transparent',color:isF?C.lavender:C.inkMid,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:16}}>{protag.icon}</span>
                {isL?'…':isF?`${protag.context.name} follows`:`Add ${protag.context.name}`}
                {fd?.follow_probability!=null&&<span style={{fontSize:10,opacity:0.7}}>{Math.round(fd.follow_probability*100)}%</span>}
              </button>
            );
          })}
        </div>
        {followers.length>0&&(
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {followers.map(f=>(
              <div key={f.character_key} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:f.follow_context?4:0}}>
                  <span style={{fontSize:15,color:f.character_key==='justawoman'?C.blue:C.lavender}}>{f.character_key==='justawoman'?'◈':'✦'}</span>
                  <span style={{fontWeight:700,color:C.ink}}>{f.character_name}</span>
                  {f.auto_generated&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:C.blueLight,color:C.blue}}>auto</span>}
                  {f.follow_motivation&&<span style={{fontSize:10,color:C.inkLight,marginLeft:'auto'}}>{f.follow_motivation.replace('_',' ')}</span>}
                </div>
                {f.follow_context&&<div style={{color:C.inkMid,lineHeight:1.5,paddingLeft:22}}>{f.follow_context}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pinned post */}
      {(p.pinned_post||d.pinned_post)&&(
        <div style={{padding:'0 20px 16px'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Pinned Post</div>
          <div style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.pink}`,fontSize:13,color:C.inkMid,lineHeight:1.6}}>
            <span style={{fontSize:11,fontWeight:700,color:C.pink,marginRight:6}}>📌</span>{p.pinned_post||d.pinned_post}
          </div>
        </div>
      )}

      {/* Sample captions */}
      {((p.sample_captions||d.sample_captions)||[]).length>0&&(
        <div style={{padding:'0 20px 16px'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Sample Captions</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {(p.sample_captions||d.sample_captions||[]).map((c,i)=>(
              <div key={i} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,borderLeft:`3px solid ${C.lavender}`,fontSize:12,color:C.inkMid,lineHeight:1.6}}>{c}</div>
            ))}
          </div>
        </div>
      )}

      {/* Moment log */}
      {((p.moment_log||d.moment_log)||[]).length>0&&(
        <div style={{padding:'0 20px 16px'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Moment Log</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {(p.moment_log||d.moment_log||[]).map((m,i)=>(
              <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.lavender,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>{m.moment_type} · {m.platform_format}</div>
                <div style={{fontSize:12,color:C.ink,marginBottom:4}}>{m.description}</div>
                <div style={{fontSize:11,color:C.inkMid,fontStyle:'italic',marginBottom:m.lala_seed?4:0}}>{m.justawoman_reaction}</div>
                {m.lala_seed&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>✦ Lala Seed — {m.lala_seed_reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creator intel */}
      {(p.post_frequency||d.post_frequency||p.engagement_rate||d.engagement_rate||p.geographic_base||d.geographic_base)&&(
        <div style={{padding:'0 20px 16px'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Creator Intel</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
            {[
              ['📊','Post Frequency',p.post_frequency||d.post_frequency],
              ['💬','Engagement Rate',p.engagement_rate||d.engagement_rate],
              ['📍','Location',p.geographic_base||d.geographic_base],
              ['🎂','Age Range',p.age_range||d.age_range],
              ['💍','Relationship',p.relationship_status||d.relationship_status],
              ['🤝','Collab Style',p.collab_style||d.collab_style],
            ].filter(([,,v])=>v).map(([icon,label,val])=>(
              <div key={label} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>{icon} {label}</div>
                <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crossing pathway */}
      {(p.crossing_trigger||d.crossing_trigger)&&(
        <div style={{padding:'0 20px 16px'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>World Crossing</div>
          <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`}}>
            <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Crossing Trigger</div>
            <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:8}}>{p.crossing_trigger||d.crossing_trigger}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Mechanism</div>
            <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.crossing_mechanism||d.crossing_mechanism}</div>
          </div>
        </div>
      )}
    </div>
  );
}
