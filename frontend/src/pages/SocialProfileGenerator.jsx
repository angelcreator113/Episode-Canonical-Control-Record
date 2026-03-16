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
  const [displayCounts,setDisplayCounts] = useState({total:0,generated:0,finalized:0,crossed:0,archived:0});
  const [crossoverCount,setCrossoverCount] = useState(0);
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
  // View mode: 'feed' (grid), 'timeline' (social posts), 'follows' (follow graph)
  const [feedView,setFeedView] = useState('grid');
  const [detailTab,setDetailTab] = useState('profile');
  const [regenerating,setRegenerating] = useState(false);
  const [crossingPreview,setCrossingPreview] = useState(null);
  const [sceneContext,setSceneContext] = useState(null);
  const [exporting,setExporting] = useState(false);
  const [followStats,setFollowStats] = useState(null);
  // Feed Automation
  const [autoStatus,setAutoStatus] = useState(null);
  const [autoHistory,setAutoHistory] = useState([]);
  const [autoRunning,setAutoRunning] = useState(false);
  const [layerStatus,setLayerStatus] = useState(null);
  // Auto-Generate state
  const [autoGenCount,setAutoGenCount] = useState(5);
  const [autoGenRunning,setAutoGenRunning] = useState(false);
  const [autoGenProgress,setAutoGenProgress] = useState(null);
  const [showManualSpark,setShowManualSpark] = useState(false);
  const [previewSparks,setPreviewSparks] = useState(null);
  const [previewLoading,setPreviewLoading] = useState(false);
  // Advanced Filters
  const [showFilters,setShowFilters] = useState(false);
  const [filterArchetypes,setFilterArchetypes] = useState([]);
  const [filterPlatforms,setFilterPlatforms] = useState([]);
  const [filterCategory,setFilterCategory] = useState('');
  const [filterRelevanceMin,setFilterRelevanceMin] = useState('');
  const [filterRelevanceMax,setFilterRelevanceMax] = useState('');
  const [filterAdultContent,setFilterAdultContent] = useState(null);
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
      if(filterArchetypes.length)qs.set('archetype',filterArchetypes.join(','));
      if(filterPlatforms.length)qs.set('platform',filterPlatforms.join(','));
      if(filterCategory.trim())qs.set('content_category',filterCategory.trim());
      if(filterRelevanceMin!=='')qs.set('relevance_min',filterRelevanceMin);
      if(filterRelevanceMax!=='')qs.set('relevance_max',filterRelevanceMax);
      if(filterAdultContent!==null)qs.set('adult_content',filterAdultContent.toString());
      const res=await fetch(`${API}?${qs}`,{headers:authHeaders()});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`Server error (${res.status})`);}
      const data=await res.json();
      setProfiles(data.profiles||[]);
      if(data.pagination){setTotalPages(data.pagination.totalPages||1);setTotalCount(data.pagination.total||0);}
      if(data.statusCounts)setStatusCounts(data.statusCounts);
      if(data.displayCounts)setDisplayCounts(data.displayCounts);
      else if(data.statusCounts)setDisplayCounts(data.statusCounts);
      setCrossoverCount(data.crossoverCount||0);
    } catch(err){setError(err.message);}
    finally{setLoading(false);}
  },[filterStatus,search,sortBy,page,feedLayer,filterArchetypes,filterPlatforms,filterCategory,filterRelevanceMin,filterRelevanceMax,filterAdultContent]);

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
    es.addEventListener('profile_generating',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,current:d.current,total:d.total,status:'processing'}));}catch{}});
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

  const startJobPolling = (id,total)=>{localStorage.setItem('spg_active_job',id);setActiveJob({id,status:'pending',total:total||0,completed:0,failed:0});connectJobSSE(id);};
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

  // ── Regenerate profile ────────────────────────────────────────────
  const regenerateProfile = async (id, overrides={})=>{
    setRegenerating(true);setError(null);
    try{
      const res=await fetch(`${API}/${id}/regenerate`,{method:'POST',headers:authHeaders(),body:JSON.stringify({...overrides,character_context:protagonist.context,character_key:protagonist.key})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Regeneration failed');
      setProfiles(p=>p.map(x=>x.id===id?data.profile:x));
      if(selected?.id===id)setSelected(data.profile);
      showToast('Profile regenerated');
    }catch(err){setError(err.message);}
    finally{setRegenerating(false);}
  };

  // ── Crossing preview ────────────────────────────────────────────
  const loadCrossingPreview = async (id)=>{
    try{
      const res=await fetch(`${API}/${id}/crossing-preview`,{method:'POST',headers:authHeaders()});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Preview failed');
      setCrossingPreview(data.preview);
    }catch(err){setError(err.message);}
  };

  // ── Scene context ───────────────────────────────────────────────
  const loadSceneContext = async (id)=>{
    try{
      const res=await fetch(`${API}/${id}/scene-context`,{headers:authHeaders()});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Failed to load scene context');
      setSceneContext(data.context);
    }catch(err){setError(err.message);}
  };

  const copySceneContext = ()=>{
    if(!sceneContext)return;
    navigator.clipboard.writeText(sceneContext).then(()=>showToast('Scene context copied')).catch(()=>setError('Failed to copy'));
  };

  // ── Export ──────────────────────────────────────────────────────
  const exportProfiles = async (format)=>{
    setExporting(true);
    try{
      const qs=new URLSearchParams({format,feed_layer:feedLayer});
      if(filterStatus)qs.set('status',filterStatus);
      const res=await fetch(`${API}/export?${qs}`,{headers:authHeaders()});
      if(!res.ok)throw new Error('Export failed');
      if(format==='csv'){
        const blob=await res.blob();
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='feed-profiles.csv';a.click();URL.revokeObjectURL(url);
      }else{
        const data=await res.json();
        const blob=new Blob([JSON.stringify(data.profiles,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='feed-profiles.json';a.click();URL.revokeObjectURL(url);
      }
      showToast(`Exported as ${format.toUpperCase()}`);
    }catch(err){setError(err.message);}
    finally{setExporting(false);}
  };

  // ── Follow stats ───────────────────────────────────────────────
  const loadFollowStats = async ()=>{
    try{
      const res=await fetch(`${API}/follow-engine/stats`,{headers:authHeaders()});
      const data=await res.json();
      setFollowStats(data);
    }catch{}
  };

  // ── Feed Automation helpers ──────────────────────────────────────────
  const SCHED_API = '/api/v1/feed-scheduler';
  const loadAutoStatus = async ()=>{
    try{
      const [statusRes,histRes,layerRes]=await Promise.all([
        fetch(`${SCHED_API}/status`,{headers:authHeaders()}),
        fetch(`${SCHED_API}/history?limit=5`,{headers:authHeaders()}),
        fetch(`${SCHED_API}/layer-status`,{headers:authHeaders()}),
      ]);
      setAutoStatus(await statusRes.json());
      const hd=await histRes.json();
      setAutoHistory(hd.history||[]);
      setLayerStatus((await layerRes.json()).layers||null);
    }catch{}
  };

  const toggleScheduler = async (action)=>{
    try{
      await fetch(`${SCHED_API}/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()}});
      await loadAutoStatus();
    }catch{}
  };

  const runAutoNow = async ()=>{
    setAutoRunning(true);
    try{
      await fetch(`${SCHED_API}/run-now`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()}});
      await loadAutoStatus();
      await loadProfiles();
      showToast('Automation cycle complete','success');
    }catch(e){showToast('Cycle failed: '+e.message,'error');}
    finally{setAutoRunning(false);}
  };

  const fillOneProfile = async (layer)=>{
    setAutoRunning(true);
    try{
      const res=await fetch(`${SCHED_API}/fill-one`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({feed_layer:layer})});
      const data=await res.json();
      if(data.profile){showToast(`Created @${data.profile.handle}`,'success');await loadProfiles();await loadAutoStatus();}
      else showToast(data.error||'Failed','error');
    }catch(e){showToast(e.message,'error');}
    finally{setAutoRunning(false);}
  };

  const updateAutoConfig = async (updates)=>{
    try{
      await fetch(`${SCHED_API}/config`,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(updates)});
      await loadAutoStatus();
    }catch{}
  };

  // ── Auto-Generate (background job — continues even if you leave the page) ──
  const runAutoGenerate = async ()=>{
    setAutoGenRunning(true);setAutoGenProgress(null);setError(null);
    try{
      const res=await fetch(`${SCHED_API}/auto-generate-job`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({feed_layer:feedLayer,count:autoGenCount})});
      const data=await res.json();
      if(!res.ok){throw new Error(data.error||'Failed to start auto-generation');}
      // Track via the existing bulk-job SSE infrastructure (activeJob bar handles all progress)
      startJobPolling(data.job_id, autoGenCount);
      showToast(`Auto-generating ${autoGenCount} profile(s) in background — you can leave this page`,'success');
    }catch(err){setError(err.message);}
    finally{setAutoGenRunning(false);}
  };

  const previewAutoSparks = async ()=>{
    setPreviewLoading(true);setPreviewSparks(null);
    try{
      const res=await fetch(`${SCHED_API}/preview-sparks`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({feed_layer:feedLayer,count:autoGenCount})});
      const data=await res.json();if(data.sparks)setPreviewSparks(data.sparks);else setError(data.error||'Preview failed');
    }catch(err){setError(err.message);}
    finally{setPreviewLoading(false);}
  };

  const fp = p=>p?.full_profile||p||{};
  const feedCap = feedLayer==='lalaverse'?200:443;
  // Use statusCounts.total (native layer only) for cap display; fallback to totalCount minus crossovers
  const nativeTotal = statusCounts.total != null ? statusCounts.total : Math.max(0, totalCount - crossoverCount);
  const stats = { total:nativeTotal, generated:statusCounts.generated, finalized:statusCounts.finalized, crossed:statusCounts.crossed };
  // Use displayCounts (native + crossover) for tab badges so they match the grid
  const tabCounts = displayCounts;

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
                <button key={p.key} onClick={()=>{setProtagonist(p);setFeedLayer(p.key==='lala'?'lalaverse':'real_world');setPage(1);}} style={{padding:'5px 12px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
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
          <button onClick={()=>{setFeedLayer('real_world');setPage(1);setProtagonist(PROTAGONISTS[0]);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='real_world'?C.blue:'transparent',color:feedLayer==='real_world'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            JustAWoman's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='real_world'?`${stats.total}/${feedCap}`:''}</span>
          </button>
          <button onClick={()=>{setFeedLayer('lalaverse');setPage(1);setProtagonist(PROTAGONISTS[1]);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='lalaverse'?C.lavender:'transparent',color:feedLayer==='lalaverse'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            Lala's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='lalaverse'?`${nativeTotal}/${feedCap}`:''}</span>
          </button>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:20,alignItems:'center'}}>
          {feedLayer==='lalaverse'&&crossoverCount>0?(
            <>
              {/* Lala's Feed: show combined total, then native/cap, then shared */}
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:22,fontWeight:700,color:C.lavender,lineHeight:1}}>{nativeTotal+crossoverCount}</span>
                <span style={{fontSize:12,color:C.inkLight}}>Profiles</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,paddingLeft:12,borderLeft:`1px solid ${C.border}`}}>
                <span style={{fontSize:16,fontWeight:700,color:C.lavender,lineHeight:1}}>{nativeTotal}</span>
                <span style={{fontSize:11,color:C.inkLight}}>/ {feedCap} native</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:16,fontWeight:700,color:C.blue,lineHeight:1}}>{crossoverCount}</span>
                <span style={{fontSize:11,color:C.inkLight}}>shared</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,paddingLeft:12,borderLeft:`1px solid ${C.border}`}}>
                <span style={{fontSize:16,fontWeight:700,color:C.inkMid,lineHeight:1}}>{stats.generated||0}</span>
                <span style={{fontSize:11,color:C.inkLight}}>Generated</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:16,fontWeight:700,color:'#2d7a50',lineHeight:1}}>{tabCounts.finalized||0}</span>
                <span style={{fontSize:11,color:C.inkLight}}>Finalized</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:16,fontWeight:700,color:C.pink,lineHeight:1}}>{tabCounts.crossed||0}</span>
                <span style={{fontSize:11,color:C.inkLight}}>Crossed</span>
              </div>
            </>
          ):(
            <>
              {[['Profiles',stats.total,stats.total>=feedCap?'#c0392b':stats.total>=(feedCap-23)?'#e67e22':C.blue],['Generated',stats.generated,C.inkMid],['Finalized',stats.finalized,'#2d7a50'],['Crossed',stats.crossed,C.pink]].map(([label,val,color])=>(
                <div key={label} style={{display:'flex',alignItems:'baseline',gap:6}}>
                  <span style={{fontSize:22,fontWeight:700,color,lineHeight:1}}>{val||0}</span>
                  <span style={{fontSize:12,color:C.inkLight}}>{label==='Profiles'?`/ ${feedCap}`:label}</span>
                </div>
              ))}
            </>
          )}
          {stats.total>=feedCap&&<span style={{fontSize:11,fontWeight:600,color:'#c0392b',background:'#fde8e8',padding:'2px 8px',borderRadius:4}}>Cap reached</span>}
          {stats.total>=(feedCap-23)&&stats.total<feedCap&&<span style={{fontSize:11,fontWeight:600,color:'#e67e22',background:'#fef3e0',padding:'2px 8px',borderRadius:4}}>{feedCap-stats.total} remaining</span>}
        </div>
      </div>

      {/* ── Job Banner ──────────────────────────────────────────── */}
      {activeJob && (
        <div style={{background:activeJob.status==='completed'?'#e8f5ee':activeJob.status==='failed'?'#fde8e8':C.lavLight,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',alignItems:'center',gap:12,fontSize:13}}>
          <span style={{flex:1,color:activeJob.status==='completed'?'#2d7a50':activeJob.status==='failed'?'#8a2020':C.inkMid}}>
            {activeJob.status==='processing'&&<>⟳ Generating… {(activeJob.completed||0)+(activeJob.failed||0)}/{activeJob.total||0} processed{activeJob.completed>0?` (${activeJob.completed} created)`:''}{activeJob.failed>0?`, ${activeJob.failed} failed`:''}</>}
            {activeJob.status==='pending'&&<>⟳ Job queued — waiting to start…</>}
            {activeJob.status==='completed'&&<>✓ Generation complete — {activeJob.completed}/{activeJob.total} profiles created{activeJob.failed>0?` (${activeJob.failed} failed)`:''}</>}
            {activeJob.status==='cancelled'&&<>⊘ Job cancelled — {activeJob.completed||0}/{activeJob.total||0} generated</>}
            {activeJob.status==='failed'&&<>✕ Job failed{activeJob.error_message?`: ${activeJob.error_message}`:''}</>}
          </span>
          {['processing','pending'].includes(activeJob.status)&&(
            <div style={{width:200,height:4,background:C.border,borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:activeJob.failed>0?`linear-gradient(90deg,${C.lavender},#e67e22)`:C.lavender,transition:'width 0.5s',width:`${activeJob.total?(((activeJob.completed||0)+(activeJob.failed||0))/activeJob.total)*100:0}%`}}/>
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
        {/* ── Auto-Generate Bar ──────────────────────────────── */}
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'16px 24px'}}>
          {/* Primary: Auto-Generate */}
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em'}}>
              Auto-Generate
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:'4px 8px',border:`1px solid ${C.border}`}}>
              {[1,3,5,10,15,20].map(n=>(
                <button key={n} onClick={()=>setAutoGenCount(n)} disabled={autoGenRunning} style={{
                  padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:700,border:'none',cursor:autoGenRunning?'not-allowed':'pointer',
                  background:autoGenCount===n?C.lavender:'transparent',color:autoGenCount===n?'#fff':C.inkLight,transition:'all 0.15s',
                }}>{n}</button>
              ))}
              <span style={{fontSize:11,color:C.inkLight,marginLeft:2}}>profiles</span>
            </div>
            <button onClick={previewAutoSparks} disabled={previewLoading||autoGenRunning} style={{padding:'7px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,border:`1px solid ${C.border}`,background:'transparent',color:C.inkMid,cursor:previewLoading?'wait':'pointer'}}>
              {previewLoading?<><Spinner/> Previewing…</>:'Preview Sparks'}
            </button>
            <button onClick={runAutoGenerate} disabled={autoGenRunning} style={{
              padding:'8px 22px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,border:'none',
              cursor:autoGenRunning?'not-allowed':'pointer',
              background:autoGenRunning?C.border:stats.total>=feedCap?'#c0392b':C.lavender,
              color:autoGenRunning?C.inkLight:'#fff',
              display:'flex',alignItems:'center',gap:6,transition:'all 0.15s',
            }}>
              {autoGenRunning?<><Spinner/> Generating…</>:stats.total>=feedCap?`Generate ${autoGenCount} (cap exceeded)`:`Generate ${autoGenCount} Creators`}
            </button>
            <span style={{fontSize:11,color:C.inkLight,marginLeft:'auto'}}>AI generates handles, vibes, and full profiles automatically</span>
          </div>

          {/* Auto-Gen Progress */}
          {autoGenProgress && autoGenRunning && (
            <div style={{marginTop:12,padding:14,background:C.surfaceAlt,borderRadius:C.radiusSm,border:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,color:C.ink}}>Generating {autoGenProgress.current}/{autoGenProgress.total}…</span>
                {autoGenProgress.spark?.handle && <span style={{fontSize:12,color:C.lavender,fontWeight:600}}>{autoGenProgress.spark.handle}</span>}
              </div>
              <div style={{height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,background:`linear-gradient(90deg,${C.lavender},${C.pink})`,transition:'width 0.5s',width:`${autoGenProgress.total?(autoGenProgress.current/autoGenProgress.total)*100:0}%`}}/>
              </div>
              {autoGenProgress.created?.length>0&&(
                <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
                  {autoGenProgress.created.map((p,i)=>(
                    <span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#eef7ec',color:'#22c55e',fontWeight:600}}>{p.handle||p.display_name||`Profile #${i+1}`}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spark Preview */}
          {previewSparks && !autoGenRunning && (
            <div style={{marginTop:12,padding:14,background:C.surfaceAlt,borderRadius:C.radiusSm,border:`1px solid ${C.lavender}30`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:C.ink}}>Spark Preview — {previewSparks.length} creators the AI would generate</span>
                <button onClick={()=>setPreviewSparks(null)} style={{fontSize:11,color:C.inkLight,background:'transparent',border:'none',cursor:'pointer'}}>Dismiss</button>
              </div>
              <div style={{display:'grid',gap:8}}>
                {previewSparks.map((spark,i)=>(
                  <div key={i} style={{padding:'10px 14px',background:C.surface,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.ink}}>{spark.handle}</span>
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.blueLight,color:C.blue,fontWeight:600}}>{spark.platform}</span>
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.lavLight,color:C.lavender,fontWeight:600}}>{spark.archetype?.replace(/_/g,' ')}</span>
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.pinkLight,color:C.pink,fontWeight:600}}>{spark.follower_tier}</span>
                      </div>
                      <div style={{fontSize:12,color:C.inkMid,lineHeight:1.4}}>{spark.vibe_sentence}</div>
                      {spark.advanced_context && Object.values(spark.advanced_context).some(v=>v) && (
                        <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                          {Object.entries(spark.advanced_context).filter(([,v])=>v).map(([k,v])=>(
                            <span key={k} style={{fontSize:10,color:C.inkLight}}>{k.replace('_hint','')}: {v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Spark toggle */}
          <button onClick={()=>setShowManualSpark(!showManualSpark)} style={{marginTop:10,background:'none',border:'none',cursor:'pointer',fontSize:12,color:C.inkLight,display:'flex',alignItems:'center',gap:4,padding:'4px 0'}}>
            <span style={{transition:'transform 0.2s',display:'inline-block',transform:showManualSpark?'rotate(90deg)':'none'}}>▸</span>
            Manual Spark
            <span style={{color:C.inkLight,opacity:0.6,fontSize:11}}>— type a specific creator yourself</span>
          </button>

          {/* Manual Spark Form (collapsed by default) */}
          {showManualSpark && (
            <div style={{marginTop:10,padding:14,background:C.surfaceAlt,borderRadius:C.radiusSm,border:`1px solid ${C.border}`}}>
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
                <button onClick={generateProfile} disabled={generating||!handle.trim()||!vibe.trim()||(feedLayer==='lalaverse'&&!lvCity)} style={{
                  padding:'9px 20px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,border:'none',cursor:generating||!handle.trim()||!vibe.trim()?'not-allowed':'pointer',
                  background:generating||!handle.trim()||!vibe.trim()?C.border:C.lavender,color:generating||!handle.trim()||!vibe.trim()?C.inkLight:'#fff',
                  display:'flex',alignItems:'center',gap:6,transition:'all 0.15s',
                }}>
                  {generating?<><Spinner/> Generating…</>:'Generate'}
                </button>
              </div>
              {/* Advanced toggle */}
              <button onClick={()=>setShowAdvanced(!showAdvanced)} style={{marginTop:10,background:'none',border:'none',cursor:'pointer',fontSize:12,color:C.inkLight,display:'flex',alignItems:'center',gap:4,padding:'4px 0'}}>
                <span style={{transition:'transform 0.2s',display:'inline-block',transform:showAdvanced?'rotate(90deg)':'none'}}>▸</span>
                Advanced Context
                <span style={{color:C.inkLight,opacity:0.6,fontSize:11}}>— optional hints for AI</span>
              </button>
              {showAdvanced && (
                <div style={{marginTop:10,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,padding:'14px',background:C.surface,borderRadius:C.radiusSm,border:`1px solid ${C.border}`}}>
                  {[['Location','location_hint','e.g. Atlanta, London'],['Follower Range','follower_hint','e.g. 50K-100K'],['Relationship','relationship_hint','e.g. ex of @handle'],['Drama','drama_hint','e.g. cheating scandal'],['Aesthetic','aesthetic_hint','e.g. clean girl, y2k'],['Revenue','revenue_hint','e.g. brand deals only']].map(([label,key,ph])=>(
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
                const cnt=s?(tabCounts[s]||0):tabCounts.total;
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
            {/* View mode switcher */}
            <div style={{display:'flex',gap:2,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:2,border:`1px solid ${C.border}`,marginLeft:8}}>
              {[['grid','Grid'],['timeline','Timeline'],['follows','Follows'],['automation','Automation']].map(([k,l])=>(
                <button key={k} onClick={()=>{setFeedView(k);if(k==='follows')loadFollowStats();if(k==='automation')loadAutoStatus();}} style={{padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',
                  background:feedView===k?C.lavender:'transparent',color:feedView===k?'#fff':C.inkLight,transition:'all 0.15s'}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              {/* Export dropdown */}
              <div style={{position:'relative'}}>
                <button onClick={()=>document.getElementById('feed-export-menu')?.classList.toggle('open')} disabled={exporting} style={{padding:'6px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`}}>
                  {exporting?'Exporting…':'Export'}
                </button>
                <div id="feed-export-menu" style={{display:'none',position:'absolute',top:'calc(100% + 4px)',right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusSm,boxShadow:C.shadowMd,zIndex:100,minWidth:120,overflow:'hidden'}}>
                  <button onClick={()=>{exportProfiles('csv');document.getElementById('feed-export-menu')?.classList.remove('open');}} style={{width:'100%',padding:'8px 14px',textAlign:'left',fontSize:12,border:'none',background:'transparent',color:C.ink,cursor:'pointer'}}>Export CSV</button>
                  <button onClick={()=>{exportProfiles('json');document.getElementById('feed-export-menu')?.classList.remove('open');}} style={{width:'100%',padding:'8px 14px',textAlign:'left',fontSize:12,border:'none',background:'transparent',color:C.ink,cursor:'pointer'}}>Export JSON</button>
                </div>
              </div>
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

          {/* Advanced Filters toggle + panel */}
          <div style={{borderBottom:`1px solid ${C.border}`,padding:'0 24px'}}>
            <button onClick={()=>setShowFilters(f=>!f)} style={{padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',background:'transparent',color:C.lavender,border:'none',display:'flex',alignItems:'center',gap:4}}>
              {showFilters?'Hide':'Show'} Advanced Filters
              {(filterArchetypes.length+filterPlatforms.length+(filterCategory?1:0)+(filterRelevanceMin!==''?1:0)+(filterRelevanceMax!==''?1:0)+(filterAdultContent!==null?1:0))>0&&
                <span style={{fontSize:9,background:C.lavender,color:'#fff',borderRadius:8,padding:'0 5px',marginLeft:2}}>{filterArchetypes.length+filterPlatforms.length+(filterCategory?1:0)+(filterRelevanceMin!==''?1:0)+(filterRelevanceMax!==''?1:0)+(filterAdultContent!==null?1:0)}</span>}
            </button>
            {showFilters&&(
              <div style={{padding:'10px 0 14px',display:'flex',flexDirection:'column',gap:10}}>
                {/* Archetypes */}
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Archetype</label>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                    {Object.entries(ARCHETYPE_LABELS).map(([k,v])=>{
                      const active=filterArchetypes.includes(k);
                      return <button key={k} onClick={()=>setFilterArchetypes(prev=>active?prev.filter(a=>a!==k):[...prev,k])} style={{padding:'4px 10px',borderRadius:12,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.15s',background:active?C.lavLight:'transparent',color:active?C.lavender:C.inkLight,border:`1.5px solid ${active?C.lavender:C.border}`}}>{v}</button>;
                    })}
                  </div>
                </div>
                {/* Platforms */}
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Platform</label>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                    {['instagram','tiktok','youtube','twitter','onlyfans'].map(p=>{
                      const active=filterPlatforms.includes(p);
                      return <button key={p} onClick={()=>setFilterPlatforms(prev=>active?prev.filter(x=>x!==p):[...prev,p])} style={{padding:'4px 10px',borderRadius:12,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.15s',background:active?C.blueLight:'transparent',color:active?C.blue:C.inkLight,border:`1.5px solid ${active?C.blue:C.border}`,textTransform:'capitalize'}}>{p}</button>;
                    })}
                  </div>
                </div>
                {/* Category + Relevance + Adult Content row */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Content Category</label>
                    <input value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} placeholder="e.g. fitness, beauty" style={{padding:'5px 10px',borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,width:160}}/>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Relevance Score</label>
                    <div style={{display:'flex',gap:4,alignItems:'center'}}>
                      <input type="number" min="0" max="10" step="0.1" value={filterRelevanceMin} onChange={e=>setFilterRelevanceMin(e.target.value)} placeholder="Min" style={{padding:'5px 8px',borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,width:60}}/>
                      <span style={{fontSize:11,color:C.inkLight}}>to</span>
                      <input type="number" min="0" max="10" step="0.1" value={filterRelevanceMax} onChange={e=>setFilterRelevanceMax(e.target.value)} placeholder="Max" style={{padding:'5px 8px',borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,width:60}}/>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Adult Content</label>
                    <div style={{display:'flex',gap:2}}>
                      {[{label:'All',val:null},{label:'Yes',val:true},{label:'No',val:false}].map(opt=>(
                        <button key={String(opt.val)} onClick={()=>setFilterAdultContent(opt.val)} style={{padding:'4px 10px',borderRadius:12,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.15s',background:filterAdultContent===opt.val?C.pinkLight:'transparent',color:filterAdultContent===opt.val?C.pink:C.inkLight,border:`1.5px solid ${filterAdultContent===opt.val?C.pink:C.border}`}}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={()=>{setFilterArchetypes([]);setFilterPlatforms([]);setFilterCategory('');setFilterRelevanceMin('');setFilterRelevanceMax('');setFilterAdultContent(null);}} style={{padding:'5px 12px',borderRadius:C.radiusSm,fontSize:11,fontWeight:600,cursor:'pointer',background:'transparent',color:C.pink,border:`1px solid ${C.pink}40`}}>Clear Filters</button>
                </div>
              </div>
            )}
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
            {/* ── GRID VIEW ── */}
            {!loading&&profiles.length>0&&feedView==='grid' && (
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
                      style={{background:C.surface,borderRadius:C.radius,border:`2px solid ${isActive?C.lavender:isChecked?C.lavender+'80':(feedLayer==='lalaverse'&&p.feed_layer==='real_world')?C.blue+'60':C.border}`,cursor:'pointer',overflow:'hidden',boxShadow:isActive?C.shadowMd:C.shadow,transition:'all 0.15s',position:'relative'}}>
                      <div style={{height:3,background:(feedLayer==='lalaverse'&&p.feed_layer==='real_world')?`linear-gradient(90deg,${C.blue},${C.lavender})`:`linear-gradient(90deg,${C.pink},${C.lavender})`}}/>
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
                          {p.registry_character_id&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:'#eef0fb',color:'#6366f1'}} title="Linked to registry character">Registry</span>}
                          {p.adult_content_present&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:'#fde8e8',color:C.pink}}>18+</span>}
                          {feedLayer==='lalaverse'&&p.feed_layer==='real_world'&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:C.blueLight,color:C.blue}} title="From JustAWoman's Feed — Lala follows this account">◈ Following</span>}
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

            {/* ── TIMELINE VIEW — simulated social feed ── */}
            {!loading&&profiles.length>0&&feedView==='timeline' && (
              <div style={{maxWidth:560,margin:'0 auto',display:'flex',flexDirection:'column',gap:16,marginBottom:16}}>
                {profiles.map(p=>{
                  const d=fp(p);
                  const captions=p.sample_captions||d.sample_captions||[];
                  const comments=p.sample_comments||d.sample_comments||[];
                  const pinned=p.pinned_post||d.pinned_post;
                  const sc=p.current_state&&FEED_STATE_CONFIG[p.current_state];
                  const score=p.lala_relevance_score??d.lala_relevance_score??0;
                  return (
                    <div key={p.id} style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:C.shadow}}>
                      {/* Post header */}
                      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${C.border}`}}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.pink},${C.lavender})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:700,flexShrink:0}}>
                          {(p.handle||'').replace('@','').charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:14,fontWeight:700,color:C.ink,cursor:'pointer'}} onClick={()=>setSelected(p)}>{p.display_name||d.display_name||p.handle}</span>
                            {sc&&<span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:8,background:sc.bg,color:sc.color}}>{sc.label}</span>}
                          </div>
                          <div style={{fontSize:12,color:C.inkLight}}>{p.handle} · {p.platform} · {p.follower_count_approx||d.follower_count_approx}{feedLayer==='lalaverse'&&p.feed_layer==='real_world'&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:C.blueLight,color:C.blue}}>◈ Following</span>}</div>
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:score>=7?C.lavender:score>=4?C.blue:C.inkLight}}>✦{score}</span>
                      </div>
                      {/* Post body — pinned post or first caption */}
                      <div style={{padding:'14px 16px'}}>
                        <div style={{fontSize:13,color:C.ink,lineHeight:1.7,marginBottom:10,whiteSpace:'pre-wrap'}}>
                          {pinned||captions[0]||p.vibe_sentence||''}
                        </div>
                        {/* Aesthetic tags */}
                        {(d.aesthetic_dna?.vibe_tags||[]).length>0&&(
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                            {(d.aesthetic_dna?.vibe_tags||[]).map((t,i)=>(
                              <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:C.lavLight,color:C.lavender}}>#{t.replace(/\s/g,'')}</span>
                            ))}
                          </div>
                        )}
                        {/* Engagement mock */}
                        <div style={{display:'flex',gap:16,fontSize:11,color:C.inkLight,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                          <span>{d.platform_metrics?.avg_likes||'—'} likes</span>
                          <span>{d.platform_metrics?.avg_comments||'—'} comments</span>
                          <span>{p.engagement_rate||d.engagement_rate||''}</span>
                        </div>
                      </div>
                      {/* Comments preview */}
                      {comments.length>0&&(
                        <div style={{padding:'0 16px 12px'}}>
                          {comments.slice(0,2).map((c,i)=>(
                            <div key={i} style={{fontSize:12,color:C.inkMid,lineHeight:1.5,padding:'4px 0',borderTop:i===0?`1px solid ${C.border}`:'none'}}>
                              <span style={{fontWeight:600,color:C.ink,marginRight:6}}>fan_{i+1}</span>{c}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Quick actions */}
                      <div style={{padding:'8px 16px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8}}>
                        <button onClick={()=>setSelected(p)} style={{fontSize:11,color:C.lavender,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>View Full Profile</button>
                        <button onClick={()=>{loadSceneContext(p.id);setSelected(p);setDetailTab('scene');}} style={{fontSize:11,color:C.blue,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Use in Scene</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── FOLLOWS VIEW — who follows whom and why ── */}
            {!loading&&feedView==='follows' && (
              <div style={{maxWidth:800,margin:'0 auto'}}>
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Follow Engine Overview</div>
                  {followStats?(
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.lavender}}>{followStats.total_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Total Profiles</div>
                      </div>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:'#2d7a50'}}>{followStats.followed_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Followed by Someone</div>
                      </div>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.pink}}>{followStats.unfollowed_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Unfollowed</div>
                      </div>
                    </div>
                  ):(
                    <div style={{textAlign:'center',padding:20,color:C.inkLight,fontSize:13}}>Loading follow stats...</div>
                  )}
                  {followStats?.character_follows&&(
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Follows per Character</div>
                      {followStats.character_follows.map(cf=>{
                        const charProfile=followStats.character_profiles?.[cf.character_key];
                        return (
                          <div key={cf.character_key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,marginBottom:6}}>
                            <span style={{fontSize:18,color:cf.character_key==='justawoman'?C.blue:C.lavender}}>{cf.character_key==='justawoman'?'◈':'✦'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,color:C.ink,fontSize:13}}>{charProfile?.name||cf.character_key}</div>
                              <div style={{fontSize:11,color:C.inkLight}}>Threshold: {charProfile?.threshold}</div>
                            </div>
                            <span style={{fontSize:20,fontWeight:700,color:C.lavender}}>{cf.count}</span>
                            <span style={{fontSize:11,color:C.inkLight}}>follows</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {followStats?.character_profiles&&(
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Top Affinities</div>
                      {Object.entries(followStats.character_profiles).map(([key,cp])=>(
                        <div key={key} style={{marginBottom:12}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:6}}>{cp.name}</div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {cp.top_categories?.map(c=>(
                              <span key={c.category} style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{c.category} ({Math.round(c.weight*100)}%)</span>
                            ))}
                          </div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                            {cp.top_archetypes?.map(a=>(
                              <span key={a.archetype} style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>{ARCHETYPE_LABELS[a.archetype]||a.archetype} ({Math.round(a.weight*100)}%)</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Per-profile follow indicators */}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {profiles.map(p=>{
                    const d=fp(p);
                    const followers=p.followers||[];
                    return (
                      <div key={p.id} onClick={()=>setSelected(p)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',background:C.surface,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,cursor:'pointer'}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.ink,minWidth:120}}>{p.handle}</span>
                        <span style={{fontSize:11,color:C.inkLight,flex:1}}>{p.display_name||d.display_name||''}</span>
                        <div style={{display:'flex',gap:4}}>
                          {PROTAGONISTS.map(pr=>{
                            const f=followers.find(fl=>fl.character_key===pr.key);
                            return (
                              <span key={pr.key} style={{fontSize:13,padding:'2px 8px',borderRadius:8,
                                background:f?pr.key==='justawoman'?C.blueLight:C.lavLight:C.surfaceAlt,
                                color:f?pr.key==='justawoman'?C.blue:C.lavender:C.border,
                                fontWeight:f?700:400}}>
                                {pr.icon} {f?'follows':'—'}
                                {f?.follow_probability!=null&&<span style={{fontSize:9,marginLeft:3}}>{Math.round(f.follow_probability*100)}%</span>}
                              </span>
                            );
                          })}
                          {/* Show count of additional dynamic character followers */}
                          {(()=>{const protagonistKeys=new Set(PROTAGONISTS.map(p=>p.key));const dynFollowers=followers.filter(f=>!protagonistKeys.has(f.character_key));return dynFollowers.length>0?(
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#e8f5e9',color:'#2e7d32',fontWeight:600}}>+{dynFollowers.length} more</span>
                          ):null;})()}
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:C.lavender}}>✦{p.lala_relevance_score??0}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── AUTOMATION VIEW — scheduler controls ── */}
            {feedView==='automation' && (
              <div style={{maxWidth:900,margin:'0 auto'}}>
                {/* Scheduler Status */}
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Feed Automation</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>toggleScheduler(autoStatus?.running?'stop':'start')} style={{padding:'6px 16px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:autoStatus?.running?'#ef4444':'#22c55e',color:'#fff'}}>
                        {autoStatus?.running?'Stop Scheduler':'Start Scheduler'}
                      </button>
                      <button onClick={runAutoNow} disabled={autoRunning} style={{padding:'6px 16px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${C.lavender}`,background:'transparent',color:C.lavender,opacity:autoRunning?0.5:1}}>
                        {autoRunning?'Running…':'Run Cycle Now'}
                      </button>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:16}}>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:autoStatus?.running?'#eef7ec':'#fde8e8',border:`1px solid ${autoStatus?.running?'#c3e6cb':'#f5c6cb'}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:autoStatus?.running?'#22c55e':'#ef4444'}}>{autoStatus?.running?'Active':'Stopped'}</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Scheduler</div>
                    </div>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.lavender}}>{autoStatus?.interval_hours||4}h</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Interval</div>
                    </div>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{autoStatus?.history_count||0}</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Runs Logged</div>
                    </div>
                    {autoStatus?.last_run&&(
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.ink}}>{new Date(autoStatus.last_run).toLocaleString()}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Last Run</div>
                      </div>
                    )}
                  </div>

                  {/* Layer fill status */}
                  {layerStatus&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Layer Fill Status</div>
                      {Object.entries(layerStatus).map(([layer,ls])=>(
                        <div key={layer} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:12,fontWeight:700,color:C.ink}}>{layer==='real_world'?"JustAWoman's Feed":"Lala's Feed"}</span>
                            <span style={{fontSize:12,color:C.inkLight}}>{ls.total}/{ls.cap} ({ls.fill_pct}%)</span>
                          </div>
                          <div style={{height:8,borderRadius:4,background:C.surfaceAlt,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,background:layer==='real_world'?C.blue:C.lavender,width:`${ls.fill_pct}%`,transition:'width 0.3s'}}/>
                          </div>
                          <div style={{display:'flex',gap:12,marginTop:4}}>
                            <span style={{fontSize:10,color:C.inkLight}}>Generated: {ls.breakdown?.generated||0}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>Finalized: {ls.breakdown?.finalized||0}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>Crossed: {ls.breakdown?.crossed||0}</span>
                            <button onClick={()=>fillOneProfile(layer)} disabled={autoRunning||ls.remaining<=0} style={{fontSize:10,color:C.lavender,background:'transparent',border:'none',cursor:'pointer',fontWeight:700,marginLeft:'auto',opacity:autoRunning?0.5:1}}>
                              + Fill One
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sub-agent toggles */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Sub-Agents</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                      {[
                        {key:'auto_fill_enabled',label:'Auto-Fill',desc:'Generate profiles to fill caps'},
                        {key:'auto_finalize_enabled',label:'Auto-Finalize',desc:'Lock high-relevance profiles'},
                        {key:'auto_relate_enabled',label:'Auto-Relate',desc:'Link relationships automatically'},
                        {key:'auto_follow_enabled',label:'Auto-Follow',desc:'Assign followers to new profiles'},
                        {key:'auto_cross_enabled',label:'Auto-Cross',desc:'Flag profiles ready for crossing'},
                      ].map(a=>{
                        const enabled=autoStatus?.config?.[a.key]!==false;
                        return (
                          <div key={a.key} onClick={()=>updateAutoConfig({[a.key]:!enabled})} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:C.radiusSm,background:enabled?'#eef7ec':C.surfaceAlt,border:`1px solid ${enabled?'#c3e6cb':C.border}`,cursor:'pointer',transition:'all 0.15s'}}>
                            <div style={{width:14,height:14,borderRadius:3,background:enabled?'#22c55e':C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff'}}>{enabled?'✓':''}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:C.ink}}>{a.label}</div>
                              <div style={{fontSize:10,color:C.inkLight}}>{a.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Config sliders */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Batch Size (per run)</label>
                      <select value={autoStatus?.config?.batch_size||5} onChange={e=>updateAutoConfig({batch_size:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[1,2,3,5,8,10,15,20].map(n=><option key={n} value={n}>{n} profiles</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Finalize Threshold</label>
                      <select value={autoStatus?.config?.finalize_threshold||7} onChange={e=>updateAutoConfig({finalize_threshold:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[5,6,7,8,9,10].map(n=><option key={n} value={n}>Relevance &ge; {n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Cross Threshold</label>
                      <select value={autoStatus?.config?.cross_threshold||9} onChange={e=>updateAutoConfig({cross_threshold:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[7,8,9,10].map(n=><option key={n} value={n}>Relevance &ge; {n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Run History */}
                {autoHistory.length>0&&(
                  <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Recent Runs</div>
                    {autoHistory.map((run,i)=>(
                      <div key={i} style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,marginBottom:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.ink}}>{new Date(run.ran_at).toLocaleString()}</span>
                          <span style={{fontSize:11,color:C.inkLight}}>{run.duration_ms}ms</span>
                        </div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#eef7ec',color:'#22c55e'}}>+{run.summary?.profiles_created||0} created</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{run.summary?.profiles_finalized||0} finalized</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>{run.summary?.relationships_created||0} linked</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.pinkLight,color:C.pink}}>{run.summary?.profiles_flagged||0} crossing-ready</span>
                          {run.errors>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#fde8e8',color:'#ef4444'}}>{run.errors} errors</span>}
                        </div>
                        {run.layer_status&&(
                          <div style={{display:'flex',gap:16,marginTop:6}}>
                            <span style={{fontSize:10,color:C.inkLight}}>Real World: {run.layer_status.real_world?.count}/{run.layer_status.real_world?.cap}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>LalaVerse: {run.layer_status.lalaverse?.count}/{run.layer_status.lalaverse?.cap}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
              onFinalize={finalizeProfile} onCross={crossProfile} onEdit={editProfile} onDelete={deleteProfile} onRefresh={loadProfiles}
              onRegenerate={regenerateProfile} regenerating={regenerating}
              onLoadCrossingPreview={loadCrossingPreview} crossingPreview={crossingPreview} setCrossingPreview={setCrossingPreview}
              onLoadSceneContext={loadSceneContext} sceneContext={sceneContext} setSceneContext={setSceneContext} onCopySceneContext={copySceneContext}
              detailTab={detailTab} setDetailTab={setDetailTab}/>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}#feed-export-menu.open{display:block!important}`}</style>
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
function DetailPanel({ profile, fp: d, onClose, onFinalize, onCross, onEdit, onDelete, onRefresh,
  onRegenerate, regenerating, onLoadCrossingPreview, crossingPreview, setCrossingPreview,
  onLoadSceneContext, sceneContext, setSceneContext, onCopySceneContext, detailTab, setDetailTab }) {
  const p = profile;
  const [editing,setEditing] = useState(false);
  const [draft,setDraft]     = useState({});
  const [followers,setFollowers] = useState(p.followers||[]);
  const [followLoading,setFollowLoading] = useState(null);

  useEffect(()=>{setFollowers(p.followers||[]);setSceneContext(null);setCrossingPreview(null);},[profile?.id]);

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
              {p.feed_layer==='real_world'&&followers.some(f=>f.character_key==='lala')&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:C.blueLight,color:C.blue}}>◈ From JustAWoman's Feed — Lala follows</span>}
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
              {p.status==='finalized'&&<button onClick={()=>{onLoadCrossingPreview(p.id);setDetailTab('crossing');}} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:C.lavLight,color:C.lavender,border:'none',cursor:'pointer'}}>⚡ Cross Into World</button>}
              {p.status==='crossed'&&<span style={{fontSize:11,color:C.lavender,fontWeight:600}}>✦ Crossed {p.crossed_at?`on ${new Date(p.crossed_at).toLocaleDateString()}`:''}</span>}
              <button onClick={()=>onRegenerate(p.id)} disabled={regenerating} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.blue,border:`1px solid ${C.blue}40`,cursor:regenerating?'not-allowed':'pointer'}}>
                {regenerating?'Regenerating…':'↻ Regenerate'}
              </button>
              <button onClick={startEdit} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>✎ Edit</button>
              <button onClick={()=>onDelete(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.pink,border:`1px solid ${C.pinkMid}`,cursor:'pointer'}}>✕ Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Detail tabs */}
      <div style={{display:'flex',gap:2,padding:'12px 20px 0',borderBottom:`1px solid ${C.border}`,background:C.surfaceAlt}}>
        {[['profile','Profile'],['intel','Intel'],['network','Network'],['scene','Scene'],['crossing','Crossing']].map(([k,l])=>(
          <button key={k} onClick={()=>{setDetailTab(k);if(k==='scene'&&!sceneContext)onLoadSceneContext(p.id);if(k==='crossing'&&!crossingPreview&&p.status!=='crossed')onLoadCrossingPreview(p.id);}} style={{
            padding:'8px 14px',fontSize:12,fontWeight:detailTab===k?700:500,cursor:'pointer',border:'none',borderBottom:`2px solid ${detailTab===k?C.lavender:'transparent'}`,
            background:'transparent',color:detailTab===k?C.lavender:C.inkLight,marginBottom:-1,transition:'all 0.15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {(detailTab==='profile') && (
        <>
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
                <div>
                  <Section title="Content Persona"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.content_persona||d.content_persona}</div></Section>
                  <Section title="Real Signal"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.real_signal||d.real_signal}</div></Section>
                  <Section title="Posting Voice"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.posting_voice||d.posting_voice}</div></Section>
                  <Section title="Comment Energy"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.comment_energy||d.comment_energy}</div></Section>
                  {p.adult_content_present&&<Section title="Adult Content"><Field label="Type" value={p.adult_content_type||d.adult_content_type}/><Field label="Framing" value={p.adult_content_framing||d.adult_content_framing}/></Section>}
                </div>
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

          {/* Followers */}
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
              {/* Dynamic character followers (not protagonists) */}
              {(()=>{const protagonistKeys=new Set(PROTAGONISTS.map(p=>p.key));const dynFollowers=followers.filter(f=>!protagonistKeys.has(f.character_key));return dynFollowers.map(f=>(
                <span key={f.character_key} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,
                  border:`1.5px solid ${C.border}`,background:'#e8f5e9',color:'#2e7d32',display:'inline-flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:14}}>👤</span> {f.character_name||f.character_key} follows
                  {f.follow_probability!=null&&<span style={{fontSize:10,opacity:0.7}}>{Math.round(f.follow_probability*100)}%</span>}
                </span>
              ));})()}
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
                    <div style={{fontSize:11,color:C.inkMid,fontStyle:'italic',marginBottom:m.lala_seed?4:0}}>{m.protagonist_reaction||m.justawoman_reaction}</div>
                    {m.lala_seed&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>✦ Lala Seed — {m.lala_seed_reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── INTEL TAB — creator intel, aesthetic, revenue, known associates, controversies ── */}
      {detailTab==='intel' && (
        <div style={{padding:'16px 20px'}}>
          {/* Creator Intel Grid */}
          <Section title="Creator Intel">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
              {[
                ['📊','Post Frequency',p.post_frequency||d.post_frequency],
                ['💬','Engagement Rate',p.engagement_rate||d.engagement_rate],
                ['📍','Location',p.geographic_base||d.geographic_base],
                ['🎂','Age Range',p.age_range||d.age_range],
                ['💍','Relationship',p.relationship_status||d.relationship_status],
                ['🤝','Collab Style',p.collab_style||d.collab_style],
                ['📈','Tier Detail',p.influencer_tier_detail||d.influencer_tier_detail],
              ].filter(([,,v])=>v).map(([icon,label,val])=>(
                <div key={label} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>{icon} {label}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{val}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Aesthetic DNA */}
          {(d.aesthetic_dna&&Object.keys(d.aesthetic_dna).length>0)&&(
            <Section title="Aesthetic DNA">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {d.aesthetic_dna.visual_style&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Visual Style</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.visual_style}</div></div>}
                {d.aesthetic_dna.color_palette&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Color Palette</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.color_palette}</div></div>}
                {d.aesthetic_dna.editing_style&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,gridColumn:'1/-1'}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Editing Style</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.editing_style}</div></div>}
              </div>
              {(d.aesthetic_dna.vibe_tags||[]).length>0&&(
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:8}}>
                  {d.aesthetic_dna.vibe_tags.map((t,i)=>(
                    <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:C.lavLight,color:C.lavender}}>#{t.replace(/\s/g,'')}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Revenue Streams */}
          {(p.revenue_streams||d.revenue_streams||[]).length>0&&(
            <Section title="Revenue Streams">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.revenue_streams||d.revenue_streams||[]).map((r,i)=>(
                  <div key={i} style={{padding:'6px 10px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12,color:C.ink}}>{typeof r==='string'?r:r.source||JSON.stringify(r)}</div>
                ))}
              </div>
            </Section>
          )}

          {/* Brand Partnerships */}
          {(p.brand_partnerships||d.brand_partnerships||[]).length>0&&(
            <Section title="Brand Partnerships">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.brand_partnerships||d.brand_partnerships||[]).map((bp,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12}}>
                    <span style={{fontWeight:600,color:C.ink}}>{bp.brand||'Unknown'}</span>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontSize:10,color:C.inkLight}}>{bp.type}</span>
                      {bp.visible===false&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:C.pinkLight,color:C.pink}}>hidden</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Audience Demographics */}
          {(d.audience_demographics&&Object.keys(d.audience_demographics).length>0)&&(
            <Section title="Audience Demographics">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {d.audience_demographics.primary_age&&<Field label="Primary Age" value={d.audience_demographics.primary_age}/>}
                {d.audience_demographics.gender_split&&<Field label="Gender Split" value={d.audience_demographics.gender_split}/>}
                {d.audience_demographics.psychographic&&<div style={{gridColumn:'1/-1'}}><Field label="Psychographic" value={d.audience_demographics.psychographic}/></div>}
              </div>
              {(d.audience_demographics.top_audience_locations||[]).length>0&&(
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
                  {d.audience_demographics.top_audience_locations.map((loc,i)=>(
                    <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>📍 {loc}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Controversy History */}
          {(p.controversy_history||d.controversy_history||[]).length>0&&(
            <Section title="Controversy History">
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(p.controversy_history||d.controversy_history||[]).map((ch,i)=>{
                  const sevColor={minor:'#2d7a50',moderate:'#8a6010',major:'#c45858',career_threatening:'#8a2020'}[ch.severity]||C.inkMid;
                  return (
                    <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sevColor}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:10,fontWeight:700,color:sevColor,textTransform:'uppercase'}}>{ch.severity}</span>
                        {ch.date_approx&&<span style={{fontSize:10,color:C.inkLight}}>{ch.date_approx}</span>}
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:ch.resolved?'#e8f5ee':'#fde8e8',color:ch.resolved?'#2d7a50':'#8a2020',marginLeft:'auto'}}>{ch.resolved?'resolved':'ongoing'}</span>
                      </div>
                      <div style={{fontSize:12,color:C.ink,marginBottom:4}}>{ch.event}</div>
                      {ch.narrative_potential&&<div style={{fontSize:11,color:C.lavender,fontStyle:'italic'}}>{ch.narrative_potential}</div>}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Mirror Fields (JustAWoman) */}
          {d.justawoman_mirror&&Object.keys(d.justawoman_mirror).length>0&&(
            <Section title="JustAWoman Mirror">
              <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.pinkLight,border:`1px solid ${C.pink}40`}}>
                {Object.entries(d.justawoman_mirror).filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.pink,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{k.replace(/_/g,' ')}</div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{v}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── NETWORK TAB — known associates and relationships ── */}
      {detailTab==='network' && (
        <div style={{padding:'16px 20px'}}>
          {/* Known Associates */}
          {(p.known_associates||d.known_associates||[]).length>0&&(
            <Section title="Known Associates">
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {(p.known_associates||d.known_associates||[]).map((a,i)=>(
                  <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.ink}}>{a.handle}</div>
                      <div style={{fontSize:11,color:C.inkMid}}>{a.description}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                      <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{(a.relationship_type||'').replace(/_/g,' ')}</span>
                      {a.drama_level!=null&&<span style={{fontSize:10,color:a.drama_level>=7?C.pink:a.drama_level>=4?'#e67e22':C.inkLight}}>Drama: {a.drama_level}/10</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sample Comments */}
          {((p.sample_comments||d.sample_comments)||[]).length>0&&(
            <Section title="Comment Section">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.sample_comments||d.sample_comments||[]).map((c,i)=>(
                  <div key={i} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12,color:C.inkMid,lineHeight:1.5}}>
                    <span style={{fontWeight:600,color:C.ink,marginRight:6}}>@user_{i+1}</span>{c}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Book Relevance */}
          {(p.book_relevance||d.book_relevance||[]).length>0&&(
            <Section title="Book Relevance">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.book_relevance||d.book_relevance||[]).map((r,i)=>(
                  <div key={i} style={{padding:'6px 10px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`,fontSize:12,color:C.inkMid}}>✦ {r}</div>
                ))}
              </div>
            </Section>
          )}

          {(p.known_associates||d.known_associates||[]).length===0&&(p.sample_comments||d.sample_comments||[]).length===0&&(
            <div style={{textAlign:'center',padding:40,color:C.inkLight,fontSize:13}}>No network data available for this profile.</div>
          )}
        </div>
      )}

      {/* ── SCENE TAB — scene context for story engine injection ── */}
      {detailTab==='scene' && (
        <div style={{padding:'16px 20px'}}>
          <Section title="Scene Context">
            <div style={{fontSize:12,color:C.inkLight,marginBottom:12}}>Voice-safe formatted context for story engine injection. Author-knowledge fields are withheld.</div>
            {sceneContext?(
              <>
                <div style={{padding:'14px 16px',borderRadius:C.radiusSm,background:'#1a1625',color:'#d4d0e0',fontFamily:"'DM Mono', monospace",fontSize:11,lineHeight:1.7,whiteSpace:'pre-wrap',overflowX:'auto',maxHeight:400,overflowY:'auto',marginBottom:12}}>
                  {sceneContext}
                </div>
                <button onClick={onCopySceneContext} style={{padding:'8px 18px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,background:C.lavender,color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  Copy to Clipboard
                </button>
              </>
            ):(
              <div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading scene context...</div>
            )}
          </Section>
        </div>
      )}

      {/* ── CROSSING TAB — preview what crossing creates ── */}
      {detailTab==='crossing' && (
        <div style={{padding:'16px 20px'}}>
          {p.status==='crossed'?(
            <div style={{textAlign:'center',padding:30}}>
              <div style={{fontSize:18,fontWeight:700,color:C.lavender,marginBottom:8}}>✦ Already Crossed</div>
              <div style={{fontSize:13,color:C.inkMid}}>This profile was crossed into the story world{p.crossed_at?` on ${new Date(p.crossed_at).toLocaleDateString()}`:''}</div>
            </div>
          ):crossingPreview?(
            <>
              <Section title="Crossing Preview">
                <div style={{fontSize:12,color:C.inkLight,marginBottom:12}}>This is what will be created in the Character Registry when you cross this profile.</div>
                <div style={{padding:'16px',borderRadius:C.radius,background:C.surfaceAlt,border:`2px dashed ${C.lavender}40`}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <Field label="Character Key" value={crossingPreview.character_key}/>
                    <Field label="Display Name" value={crossingPreview.display_name}/>
                    <Field label="Role Type" value={crossingPreview.role_type}/>
                    <Field label="Status" value={crossingPreview.status}/>
                    <div style={{gridColumn:'1/-1'}}><Field label="Description" value={crossingPreview.description}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Core Desire" value={crossingPreview.core_desire}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Core Wound" value={crossingPreview.core_wound}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Personality" value={crossingPreview.personality}/></div>
                  </div>
                </div>
              </Section>

              {crossingPreview.timeline_event&&(
                <Section title="Timeline Event">
                  <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:4}}>{crossingPreview.timeline_event.event_name}</div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:4}}>{crossingPreview.timeline_event.event_description}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:crossingPreview.timeline_event.impact_level==='major'?C.pinkLight:C.blueLight,color:crossingPreview.timeline_event.impact_level==='major'?C.pink:C.blue}}>
                      {crossingPreview.timeline_event.impact_level} impact
                    </span>
                  </div>
                </Section>
              )}

              {p.status==='finalized'&&(
                <button onClick={()=>onCross(p.id)} style={{width:'100%',padding:'12px',borderRadius:C.radiusSm,fontSize:14,fontWeight:700,background:C.lavender,color:'#fff',border:'none',cursor:'pointer',marginTop:8}}>
                  ⚡ Confirm Crossing Into World
                </button>
              )}
              {p.status!=='finalized'&&(
                <div style={{textAlign:'center',padding:12,fontSize:12,color:C.inkLight}}>Profile must be finalized before crossing.</div>
              )}
            </>
          ):(
            <div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading crossing preview...</div>
          )}

          {/* Crossing pathway info */}
          {(p.crossing_trigger||d.crossing_trigger)&&(
            <div style={{marginTop:16}}>
              <Section title="Crossing Pathway">
                <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Trigger</div>
                  <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:8}}>{p.crossing_trigger||d.crossing_trigger}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Mechanism</div>
                  <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.crossing_mechanism||d.crossing_mechanism}</div>
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
