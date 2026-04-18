/**
 * SocialProfileGenerator.jsx — The Feed
 * Prime Studios · JustAWoman's real-world online ecosystem
 *
 * Refactored for Prime Studios light theme:
 *   #d4789a (pink) · #7ab3d4 (blue) · #a889c8 (lavender)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import FeedBulkImport from '../components/FeedBulkImport';
import ProfileCard from './feed/ProfileCard';
import { DetailPanel, FeedStatePicker } from './feed/ProfileDetailPanel';
import { ProfileComparison, LalaReactions, FeedTimeline, RelationshipWeb } from './feed/FeedEnhancements';
import FeedViewContent from './feed/FeedViews';

// Local Spinner — avoid named import that fails during code-splitting
function Spinner() {
  return <span style={{display:'inline-block',width:14,height:14,border:'2px solid #eee',borderTopColor:'#a889c8',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>;
}

import {
  API, SCHED_API, C, PLATFORMS, ARCHETYPE_LABELS, STATUS_LABELS, STATUS_COLORS,
  FEED_STATE_CONFIG, LALAVERSE_CITIES, LALA_RELATIONSHIPS, CAREER_PRESSURES,
  PROTAGONISTS, lalaClass, fp, authHeaders,
} from './feed/feedConstants';

function FeedPagination({ page, totalPages, loading, setPage }) {
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
}

function ExportDropdown({ exporting, onExport }) {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    if(!open)return;
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[open]);
  return (
    <div style={{position:'relative'}} ref={ref}>
      <button onClick={()=>setOpen(!open)} disabled={exporting} style={{padding:'6px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`}}>
        {exporting?'Exporting…':'Export'}
      </button>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusSm,boxShadow:C.shadowMd,zIndex:100,minWidth:120,overflow:'hidden'}}>
          <button onClick={()=>{onExport('csv');setOpen(false);}} style={{width:'100%',padding:'8px 14px',textAlign:'left',fontSize:12,border:'none',background:'transparent',color:C.ink,cursor:'pointer'}}>Export CSV</button>
          <button onClick={()=>{onExport('json');setOpen(false);}} style={{width:'100%',padding:'8px 14px',textAlign:'left',fontSize:12,border:'none',background:'transparent',color:C.ink,cursor:'pointer'}}>Export JSON</button>
        </div>
      )}
    </div>
  );
}

// lalaClass, authHeaders imported from ./feed/feedConstants

// ══════════════════════════════════════════════════════════════════════
export default function SocialProfileGenerator({ embedded=false, worldTag, defaultFeedLayer, showId, onNavigateToTab }) {
  const [profiles,setProfiles]   = useState([]);
  const [selected,setSelected]   = useState(null);
  const [reactionsProfile,setReactionsProfile] = useState(null);
  const [loading,setLoading]     = useState(false);
  const [generating,setGenerating] = useState(false);
  const [error,setError]         = useState(null);
  const [filterStatus,setFilterStatus] = useState(null);
  const [view,setView]           = useState('feed');
  const [protagonist,setProtagonist] = useState(defaultFeedLayer === 'lalaverse' ? PROTAGONISTS[1] : PROTAGONISTS[0]);
  const [page,setPage]           = useState(1);
  const [totalPages,setTotalPages] = useState(1);
  const [totalCount,setTotalCount] = useState(0);
  const [statusCounts,setStatusCounts] = useState({total:0,generated:0,finalized:0,crossed:0,archived:0});
  const [displayCounts,setDisplayCounts] = useState({total:0,generated:0,finalized:0,crossed:0,archived:0});
  const [crossoverCount,setCrossoverCount] = useState(0);
  const PAGE_SIZE = 24;
  const [search,setSearch]       = useState('');
  const [debouncedSearch,setDebouncedSearch] = useState('');
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
  // autoGenProgress removed — job banner handles all progress display via SSE
  const [showManualSpark,setShowManualSpark] = useState(false);
  const [showAutoGenBar,setShowAutoGenBar] = useState(false);
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
  const [filterCelebrityTier,setFilterCelebrityTier] = useState('');
  const [filterFollowMotivation,setFilterFollowMotivation] = useState('');
  // Diversity Dashboard
  const [diversityData,setDiversityData] = useState(null);
  const [diversityLoading,setDiversityLoading] = useState(false);
  // Moments Timeline
  const [momentsData,setMomentsData] = useState(null);
  const [momentsLoading,setMomentsLoading] = useState(false);
  // Relationship Suggestions
  const [suggestions,setSuggestions] = useState(null);
  const [suggestionsLoading,setSuggestionsLoading] = useState(false);
  // Templates
  const [templates,setTemplates] = useState([]);
  const [templateName,setTemplateName] = useState('');
  // LalaVerse Feed layer
  const [feedLayer,setFeedLayer] = useState(defaultFeedLayer || 'real_world');
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
      if(debouncedSearch.trim())qs.set('search',debouncedSearch.trim());
      qs.set('sort',sortBy);qs.set('page',pg);qs.set('limit',PAGE_SIZE);
      qs.set('feed_layer',feedLayer);
      if(filterArchetypes.length)qs.set('archetype',filterArchetypes.join(','));
      if(filterPlatforms.length)qs.set('platform',filterPlatforms.join(','));
      if(filterCategory.trim())qs.set('content_category',filterCategory.trim());
      if(filterRelevanceMin!=='')qs.set('relevance_min',filterRelevanceMin);
      if(filterRelevanceMax!=='')qs.set('relevance_max',filterRelevanceMax);
      if(filterAdultContent!==null)qs.set('adult_content',filterAdultContent.toString());
      if(filterCelebrityTier)qs.set('celebrity_tier',filterCelebrityTier);
      if(filterFollowMotivation)qs.set('follow_motivation',filterFollowMotivation);
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
  },[filterStatus,debouncedSearch,sortBy,page,feedLayer,filterArchetypes,filterPlatforms,filterCategory,filterRelevanceMin,filterRelevanceMax,filterAdultContent,filterCelebrityTier,filterFollowMotivation]);

  useEffect(()=>{loadProfiles();},[loadProfiles]);

  // Load JustAWoman's locked record for Lala's Feed pinned card
  useEffect(()=>{
    if(feedLayer!=='lalaverse'){setJustAwomanProfile(null);return;}
    fetch(`${API}?feed_layer=lalaverse&search=justawoman&limit=1`,{headers:authHeaders()})
      .then(r=>{if(!r.ok)throw new Error();return r.json();})
      .then(d=>{const jw=(d.profiles||[]).find(p=>p.is_justawoman_record);setJustAwomanProfile(jw||null);})
      .catch(()=>{setJustAwomanProfile(null);});
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
    es.addEventListener('status',e=>{try{const d=JSON.parse(e.data);const job=d.job||d;let s=job.status||'pending';
      // Detect stuck jobs: if status is still processing but error_message is set and no progress made, treat as failed
      if(s==='processing'&&job.error_message&&(job.completed||0)===0&&(job.failed||0)===0){s='failed';}
      setActiveJob(p=>({...p,id:jobId,status:s,completed:job.completed??p?.completed??0,failed:job.failed??p?.failed??0,total:job.total??p?.total??0,error_message:job.error_message||p?.error_message}));if(['completed','failed','cancelled'].includes(s)){localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();}}catch{}});
    es.addEventListener('started',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,...d,status:'processing'}));}catch{}});
    es.addEventListener('profile_generating',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,current:d.current,total:d.total,status:'processing'}));}catch{}});
    es.addEventListener('profile_complete',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,completed:d.completed,total:d.total,status:'processing'}));}catch{}});
    es.addEventListener('profile_failed',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,completed:d.completed,failed:d.failed,total:d.total,status:'processing',lastError:d.error||p?.lastError}));}catch{}});
    es.addEventListener('cancelled',()=>{setActiveJob(p=>p?{...p,status:'cancelled'}:p);localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();});
    es.addEventListener('done',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,...d,status:'completed'}));}catch{}localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();});
    // Listen for job_error (custom named event from backend — NOT the built-in EventSource error)
    es.addEventListener('job_error',e=>{try{const d=JSON.parse(e.data);setActiveJob(p=>({...p,status:'failed',error_message:d.error||'Unknown error'}));localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();}catch{}});
    es.addEventListener('error',()=>{es.close();sseRef.current=null;sseRetryTimer.current=setTimeout(async()=>{sseRetryTimer.current=null;try{const res=await fetch(`${API}/bulk/jobs/${jobId}`,{headers:authHeaders()});const d=await res.json();if(d.job){
      // Detect stuck: processing with error_message but 0 progress
      const isStuck=d.job.status==='processing'&&d.job.error_message&&(d.job.completed||0)===0&&(d.job.failed||0)===0;
      if(isStuck){setActiveJob({...d.job,status:'failed'});localStorage.removeItem('spg_active_job');loadProfiles();}
      else{setActiveJob(d.job);if(['completed','failed','cancelled'].includes(d.job.status)){localStorage.removeItem('spg_active_job');loadProfiles();}else{connectJobSSE(jobId);}}
    }}catch{}},3000);});
    // Safety-net: if still pending after 4s, poll REST to catch missed SSE events
    const pendingFallback=setTimeout(async()=>{try{const res=await fetch(`${API}/bulk/jobs/${jobId}`,{headers:authHeaders()});const d=await res.json();if(d.job&&d.job.status!=='pending'){setActiveJob(prev=>{if(prev?.status==='pending')return{...prev,...d.job};return prev;});if(['completed','failed','cancelled'].includes(d.job.status)){localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();}}}catch{}},4000);
    // Safety-net: if stuck at 0 progress for 2 minutes, poll REST to detect dead jobs
    const stuckFallback=setTimeout(async()=>{try{const res=await fetch(`${API}/bulk/jobs/${jobId}`,{headers:authHeaders()});const d=await res.json();if(d.job){if(['completed','failed','cancelled'].includes(d.job.status)){setActiveJob(d.job);localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();}else if((d.job.completed||0)===0&&(d.job.failed||0)===0&&d.job.error_message){setActiveJob({...d.job,status:'failed'});localStorage.removeItem('spg_active_job');es.close();sseRef.current=null;loadProfiles();}}}catch{}},120000);
    const origClose=es.close.bind(es);es.close=()=>{clearTimeout(pendingFallback);clearTimeout(stuckFallback);origClose();};
  },[loadProfiles]);

  useEffect(()=>{
    const saved=localStorage.getItem('spg_active_job');
    if(saved){fetch(`${API}/bulk/jobs/${saved}`,{headers:authHeaders()}).then(r=>r.json()).then(d=>{if(d.job){
      // Detect stuck jobs on reconnect: processing with error_message but 0 progress
      const isStuck=d.job.status==='processing'&&d.job.error_message&&(d.job.completed||0)===0&&(d.job.failed||0)===0;
      if(isStuck){setActiveJob({...d.job,status:'failed'});localStorage.removeItem('spg_active_job');}
      else{setActiveJob(d.job);if(!['completed','failed','cancelled'].includes(d.job.status))connectJobSSE(saved);else localStorage.removeItem('spg_active_job');}
    }}).catch(()=>{});}
    return()=>{if(sseRef.current){sseRef.current.close();sseRef.current=null;}if(sseRetryTimer.current){clearTimeout(sseRetryTimer.current);sseRetryTimer.current=null;}if(searchTimer.current)clearTimeout(searchTimer.current);if(toastTimer.current)clearTimeout(toastTimer.current);};
  },[connectJobSSE]);

  const startJobPolling = (id,total)=>{localStorage.setItem('spg_active_job',id);setActiveJob({id,status:'pending',total:total||0,completed:0,failed:0});connectJobSSE(id);};
  const dismissJob = ()=>{setActiveJob(null);localStorage.removeItem('spg_active_job');if(sseRef.current){sseRef.current.close();sseRef.current=null;}};
  const cancelJob = async()=>{if(!activeJob?.id)return;setCancellingJob(true);try{const res=await fetch(`${API}/bulk/jobs/${activeJob.id}/cancel`,{method:'POST',headers:authHeaders()});if(!res.ok){const d=await res.json().catch(()=>({}));if(d.error&&/already/.test(d.error)){try{const jr=await fetch(`${API}/bulk/jobs/${activeJob.id}`,{headers:authHeaders()});const jd=await jr.json();if(jd.job){setActiveJob(jd.job);localStorage.removeItem('spg_active_job');loadProfiles();}}catch{}}}}catch{}finally{setCancellingJob(false);}};

  const showToast = (message,type='success')=>{clearTimeout(toastTimer.current);setToast({message,type});toastTimer.current=setTimeout(()=>setToast(null),4000);};

  // Fetch full profile (with all follower fields) when selecting
  const selectProfile = async (profile)=>{
    if(!profile){setSelected(null);return;}
    if(selected?.id===profile.id){setSelected(null);return;}
    setSelected(profile); // show immediately with partial data
    try{
      const res=await fetch(`${API}/${profile.id}`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();if(d.profile)setSelected(d.profile);}
      else{showToast('Failed to load full profile details','error');}
    }catch(err){showToast('Failed to load profile: '+err.message,'error');}
  };

  const changeFilter = s=>{setFilterStatus(s);setPage(1);setSelectedIds(new Set());};
  const changeSort   = s=>{setSortBy(s);setPage(1);};
  const handleSearch = val=>{setSearch(val);clearTimeout(searchTimer.current);searchTimer.current=setTimeout(()=>{setDebouncedSearch(val);setPage(1);},400);};

  // ── Bulk helpers ───────────────────────────────────────────────────
  const toggleSelect = id=>{setSelectAllPages(false);setSelectedIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});};
  const clearSelection = ()=>{setSelectedIds(new Set());setSelectAllPages(false);setBulkMode(false);};
  const getBulkIds = async()=>{
    if(!selectAllPages)return[...selectedIds];
    const allIds=[];let pg=1;
    while(true){const qs=new URLSearchParams();if(filterStatus)qs.set('status',filterStatus);if(feedLayer)qs.set('feed_layer',feedLayer);if(search.trim())qs.set('search',search.trim());qs.set('sort',sortBy);qs.set('page',pg);qs.set('limit',100);const res=await fetch(`${API}?${qs}`,{headers:authHeaders()});const d=await res.json();const batch=(d.profiles||[]).map(p=>p.id);allIds.push(...batch);if(batch.length<100||allIds.length>=(d.pagination?.total||d.total||0))break;pg++;}
    return allIds;
  };
  const runBulk = async(ids,endpoint)=>{const results=[];for(let i=0;i<ids.length;i+=100){const chunk=ids.slice(i,i+100);const res=await fetch(`${API}/${endpoint}`,{method:'POST',headers:authHeaders(),body:JSON.stringify({ids:chunk})});const d=await res.json();if(!res.ok)throw new Error(d.error);results.push(d);}return results;};
  const bulkOp = async(endpoint,confirmMsg,onDone)=>{const ids=await getBulkIds();if(!ids.length)return;if(!window.confirm(confirmMsg.replace('$n',selectAllPages?`all ${statusCounts.total}`:ids.length)))return;try{const r=await runBulk(ids,endpoint);onDone(r);setSelectedIds(new Set());setSelectAllPages(false);setPage(1);loadProfiles();}catch(err){setError(err.message);}};

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
      setSelected(data.profile);setHandle('');setVibe('');setAdvFields({location_hint:'',follower_hint:'',relationship_hint:'',drama_hint:'',aesthetic_hint:'',revenue_hint:''});setShowAdvanced(false);setPage(1);
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
      if(!res.ok)throw new Error('Failed to load follow stats');
      const data=await res.json();
      setFollowStats(data);
    }catch(err){console.warn('loadFollowStats:',err.message);}
  };

  // ── Feed Automation helpers ──────────────────────────────────────────
  // SCHED_API imported from ./feed/feedConstants
  const schedSSERef = useRef(null);

  // Connect to scheduler SSE when automation tab is active
  useEffect(()=>{
    if(feedView!=='automation')return;
    const es=new EventSource(`${SCHED_API}/events`);
    schedSSERef.current=es;
    es.addEventListener('connected',e=>{try{setAutoStatus(JSON.parse(e.data));}catch{}});
    es.addEventListener('cycle_start',()=>{setAutoRunning(true);});
    es.addEventListener('cycle_complete',e=>{try{const d=JSON.parse(e.data);showToast(`Cycle complete: ${d.summary?.profiles_created||0} created`);loadAutoStatus();loadProfiles();}catch{}});
    es.addEventListener('cycle_end',()=>{setAutoRunning(false);});
    es.addEventListener('cycle_error',e=>{try{const d=JSON.parse(e.data);showToast('Cycle error: '+d.error,'error');}catch{}setAutoRunning(false);});
    es.onerror=()=>{es.close();schedSSERef.current=null;};
    return()=>{es.close();schedSSERef.current=null;};
  },[feedView]);
  const loadAutoStatus = async ()=>{
    try{
      const [statusRes,histRes,layerRes]=await Promise.all([
        fetch(`${SCHED_API}/status`,{headers:authHeaders()}),
        fetch(`${SCHED_API}/history?limit=5`,{headers:authHeaders()}),
        fetch(`${SCHED_API}/layer-status`,{headers:authHeaders()}),
      ]);
      if(statusRes.ok)setAutoStatus(await statusRes.json());
      if(histRes.ok){const hd=await histRes.json();setAutoHistory(hd.history||[]);}
      if(layerRes.ok)setLayerStatus((await layerRes.json()).layers||null);
    }catch(err){console.warn('loadAutoStatus:',err.message);}
  };

  const toggleScheduler = async (action)=>{
    try{
      const res=await fetch(`${SCHED_API}/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()}});
      if(!res.ok){const e=await res.json().catch(()=>({}));showToast(e.error||'Scheduler action failed','error');}
      await loadAutoStatus();
    }catch(err){showToast('Scheduler action failed: '+err.message,'error');}
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
      const res=await fetch(`${SCHED_API}/config`,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(updates)});
      if(!res.ok){const e=await res.json().catch(()=>({}));showToast(e.error||'Config update failed','error');}
      await loadAutoStatus();
    }catch(err){showToast('Config update failed: '+err.message,'error');}
  };

  // ── Auto-Generate (background job — continues even if you leave the page) ──
  const runAutoGenerate = async ()=>{
    setAutoGenRunning(true);setError(null);
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

  // ── Diversity Dashboard loader ────────────────────────────────────
  const loadDiversity = async ()=>{
    setDiversityLoading(true);
    try{
      const res=await fetch(`${API}/analytics/composition?feed_layer=${feedLayer}`,{headers:authHeaders()});
      if(!res.ok)throw new Error('Failed to load analytics');
      const data=await res.json();
      setDiversityData(data);
    }catch(err){console.warn('loadDiversity:',err.message);}
    finally{setDiversityLoading(false);}
  };

  // ── Moments Timeline loader ─────────────────────────────────────
  const loadMoments = async ()=>{
    setMomentsLoading(true);
    try{
      const res=await fetch(`${API}/moments/timeline?feed_layer=${feedLayer}&limit=50`,{headers:authHeaders()});
      if(!res.ok)throw new Error('Failed to load moments');
      const data=await res.json();
      setMomentsData(data);
    }catch(err){console.warn('loadMoments:',err.message);}
    finally{setMomentsLoading(false);}
  };

  // ── Relationship Suggestions loader ─────────────────────────────
  const loadSuggestions = async ()=>{
    setSuggestionsLoading(true);
    try{
      const res=await fetch(`${API}/relationships/suggestions?feed_layer=${feedLayer}&limit=20`,{headers:authHeaders()});
      if(!res.ok)throw new Error('Failed to load suggestions');
      const data=await res.json();
      setSuggestions(data);
    }catch(err){console.warn('loadSuggestions:',err.message);}
    finally{setSuggestionsLoading(false);}
  };

  const acceptSuggestion = async (sourceId,targetId,relType)=>{
    try{
      const res=await fetch(`${API}/relationships/suggestions/accept`,{method:'POST',headers:authHeaders(),body:JSON.stringify({source_id:sourceId,target_id:targetId,relationship_type:relType})});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Accept failed');}
      showToast('Relationship created');
      loadSuggestions();
    }catch(err){setError(err.message);}
  };

  // ── Templates loader ────────────────────────────────────────────
  const loadTemplates = async ()=>{
    try{const res=await fetch(`${API}/templates`,{headers:authHeaders()});if(!res.ok)throw new Error('Failed to load templates');const d=await res.json();setTemplates(d.templates||[]);}catch(err){console.warn('loadTemplates:',err.message);}
  };

  const saveAsTemplate = async (profileId)=>{
    const name=prompt('Template name:');
    if(!name)return;
    try{
      await fetch(`${API}/templates`,{method:'POST',headers:authHeaders(),body:JSON.stringify({profile_id:profileId,name})});
      showToast('Template saved');
      loadTemplates();
    }catch(err){setError(err.message);}
  };

  const deleteTemplate = async (templateId)=>{
    try{const res=await fetch(`${API}/templates/${templateId}`,{method:'DELETE',headers:authHeaders()});if(!res.ok)throw new Error('Delete failed');setTemplates(t=>t.filter(x=>x.id!==templateId));}catch(err){showToast('Delete template failed: '+err.message,'error');}
  };

  // ── Crossing Approval ───────────────────────────────────────────
  const approveForCrossing = async (id,notes)=>{
    try{
      const res=await fetch(`${API}/${id}/approve`,{method:'POST',headers:authHeaders(),body:JSON.stringify({approval_notes:notes||''})});
      const d=await res.json();
      if(!res.ok)throw new Error(d.error);
      setProfiles(p=>p.map(x=>x.id===id?d.profile:x));
      if(selected?.id===id)setSelected(d.profile);
      showToast('Approved for crossing');
    }catch(err){setError(err.message);}
  };

  const rejectCrossing = async (id,reason)=>{
    try{
      const res=await fetch(`${API}/${id}/reject-crossing`,{method:'POST',headers:authHeaders(),body:JSON.stringify({rejection_reason:reason||''})});
      const d=await res.json();
      if(!res.ok)throw new Error(d.error);
      setProfiles(p=>p.map(x=>x.id===id?d.profile:x));
      if(selected?.id===id)setSelected(d.profile);
      showToast('Crossing rejected');
    }catch(err){setError(err.message);}
  };

  // fp imported from ./feed/feedConstants
  const feedCap = feedLayer==='lalaverse'?200:443;
  // Use statusCounts.total (native layer only) for cap display; fallback to totalCount minus crossovers
  const nativeTotal = statusCounts.total != null ? statusCounts.total : Math.max(0, totalCount - crossoverCount);
  const stats = { total:nativeTotal, generated:statusCounts.generated, finalized:statusCounts.finalized, crossed:statusCounts.crossed };
  // Use displayCounts (native + crossover) for tab badges so they match the grid
  const tabCounts = displayCounts;

  const paginationProps = { page, totalPages, loading, setPage };

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="spg-page" style={{display:'flex',flexDirection:'column',...(embedded?{flex:'1 1 auto',minHeight:0}:{minHeight:'100vh'}),background:C.surfaceAlt,fontFamily:C.font}}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="spg-header" style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'16px 24px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:14}}>
          <div>
            <div className="spg-header-title" style={{fontSize:18,fontWeight:700,color:C.ink,marginBottom:2}}>📱 The Feed <span style={{fontSize:12,fontWeight:600,color:C.pink,background:'#f9e4ec',padding:'2px 8px',borderRadius:4,marginLeft:6,verticalAlign:'middle',letterSpacing:'0.3px'}}>{protagonist.icon} {protagonist.context.name}</span></div>
            <div className="spg-header-sub" style={{fontSize:13,color:C.inkLight}}>Parasocial Creator Profiles — {protagonist.context.name === 'Lala' ? "Lala's inherited digital world" : "JustAWoman's real-world online ecosystem"}</div>
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
            {view==='feed' && (
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>setView('timeline')} style={{padding:'5px 10px',borderRadius:C.radiusSm,fontSize:10,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>Story Mode</button>
                <button onClick={()=>setView('compare')} style={{padding:'5px 10px',borderRadius:C.radiusSm,fontSize:10,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>Compare</button>
                <button onClick={()=>setView('web')} style={{padding:'5px 10px',borderRadius:C.radiusSm,fontSize:10,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>Web</button>
              </div>
            )}
          </div>
        </div>
        {/* Feed layer switcher — hidden when embedded with a locked layer */}
        {!(embedded && defaultFeedLayer) && <div className="spg-feed-switcher" style={{display:'flex',gap:4,marginBottom:12,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:3,border:`1px solid ${C.border}`,alignSelf:'flex-start'}}>
          <button onClick={()=>{setFeedLayer('real_world');setPage(1);setProtagonist(PROTAGONISTS[0]);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='real_world'?C.blue:'transparent',color:feedLayer==='real_world'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            JustAWoman's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='real_world'?`${stats.total}/${feedCap}`:''}</span>
          </button>
          <button onClick={()=>{setFeedLayer('lalaverse');setPage(1);setProtagonist(PROTAGONISTS[1]);}} style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
            background:feedLayer==='lalaverse'?C.lavender:'transparent',color:feedLayer==='lalaverse'?'#fff':C.inkLight,transition:'all 0.15s'}}>
            Lala's Feed <span style={{fontSize:10,fontWeight:600,opacity:0.8,marginLeft:4}}>{feedLayer==='lalaverse'?`${nativeTotal}/${feedCap}`:''}</span>
          </button>
        </div>}

        {/* Stats */}
        <div className="spg-stats-row" style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
          {feedLayer==='lalaverse'&&crossoverCount>0?(
            <>
              {/* Lala's Feed: show combined total, then native/cap, then shared */}
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span className="spg-stat-number-lg" style={{fontSize:22,fontWeight:700,color:C.lavender,lineHeight:1}}>{nativeTotal+crossoverCount}</span>
                <span className="spg-stat-label" style={{fontSize:12,color:C.inkLight}}>Profiles</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,paddingLeft:12,borderLeft:`1px solid ${C.border}`}}>
                <span className="spg-stat-number" style={{fontSize:16,fontWeight:700,color:C.lavender,lineHeight:1}}>{nativeTotal}</span>
                <span className="spg-stat-label" style={{fontSize:11,color:C.inkLight}}>/ {feedCap} native</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span className="spg-stat-number" style={{fontSize:16,fontWeight:700,color:C.blue,lineHeight:1}}>{crossoverCount}</span>
                <span className="spg-stat-label" style={{fontSize:11,color:C.inkLight}}>shared</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,paddingLeft:12,borderLeft:`1px solid ${C.border}`}}>
                <span className="spg-stat-number" style={{fontSize:16,fontWeight:700,color:C.inkMid,lineHeight:1}}>{stats.generated||0}</span>
                <span className="spg-stat-label" style={{fontSize:11,color:C.inkLight}}>Generated</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span className="spg-stat-number" style={{fontSize:16,fontWeight:700,color:'#2d7a50',lineHeight:1}}>{tabCounts.finalized||0}</span>
                <span className="spg-stat-label" style={{fontSize:11,color:C.inkLight}}>Finalized</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span className="spg-stat-number" style={{fontSize:16,fontWeight:700,color:C.pink,lineHeight:1}}>{tabCounts.crossed||0}</span>
                <span className="spg-stat-label" style={{fontSize:11,color:C.inkLight}}>Crossed</span>
              </div>
            </>
          ):(
            <>
              {[['Profiles',stats.total,stats.total>=feedCap?'#c0392b':stats.total>=(feedCap-23)?'#e67e22':C.blue],['Generated',stats.generated,C.inkMid],['Finalized',stats.finalized,'#2d7a50'],['Crossed',stats.crossed,C.pink]].map(([label,val,color])=>(
                <div key={label} style={{display:'flex',alignItems:'baseline',gap:6}}>
                  <span className="spg-stat-number-lg" style={{fontSize:22,fontWeight:700,color,lineHeight:1}}>{val||0}</span>
                  <span className="spg-stat-label" style={{fontSize:12,color:C.inkLight}}>{label==='Profiles'?`/ ${feedCap}`:label}</span>
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
        <div className="spg-job-banner-wrap" style={{background:activeJob.status==='completed'?'#e8f5ee':activeJob.status==='failed'?'#fde8e8':C.lavLight,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',alignItems:'center',gap:12,fontSize:13}}>
          <span style={{flex:1,color:activeJob.status==='completed'?'#2d7a50':activeJob.status==='failed'?'#8a2020':C.inkMid}}>
            {activeJob.status==='processing'&&<>⟳ Generating… {(activeJob.completed||0)+(activeJob.failed||0)}/{activeJob.total||0} processed{activeJob.completed>0?` (${activeJob.completed} created)`:''}{activeJob.failed>0?<>, {activeJob.failed} failed{activeJob.lastError?<span style={{fontSize:11,color:'#c0392b',marginLeft:4}}>({activeJob.lastError})</span>:null}</>:null}</>}
            {activeJob.status==='pending'&&<>⟳ Job queued — waiting to start…</>}
            {activeJob.status==='completed'&&<>✓ Generation complete — {activeJob.completed}/{activeJob.total} profiles created{activeJob.failed>0?<> ({activeJob.failed} failed{activeJob.lastError?<span style={{fontSize:11,color:'#c0392b',marginLeft:4}}>— {activeJob.lastError}</span>:null})</>:null}</>}
            {activeJob.status==='cancelled'&&<>⊘ Job cancelled — {activeJob.completed||0}/{activeJob.total||0} generated</>}
            {activeJob.status==='failed'&&<>✕ Job failed{activeJob.error_message?`: ${activeJob.error_message}`:''}</>}
          </span>
          {['processing','pending'].includes(activeJob.status)&&(
            <div className="spg-job-progress-inline" style={{width:200,height:4,background:C.border,borderRadius:2,overflow:'hidden'}}>
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
        <FeedBulkImport onDone={()=>{setView('feed');setPage(1);}} characterContext={protagonist.context} characterKey={protagonist.key} feedLayer={feedLayer} onJobStarted={jobId=>{setView('feed');startJobPolling(jobId);}}/>
      )}

      {/* ── Enhanced Views ───────────────────────────────── */}
      {view==='timeline' && (
        <div>
          <button onClick={()=>setView('feed')} style={{margin:'12px 16px',padding:'5px 12px',borderRadius:C.radiusSm,fontSize:11,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>← Back to Feed</button>
          <FeedTimeline profiles={profiles} onSelectProfile={p=>{ setSelected(p); setView('feed'); }} />
        </div>
      )}
      {view==='compare' && (
        <ProfileComparison profiles={profiles} onClose={()=>setView('feed')} />
      )}
      {view==='web' && (
        <div>
          <button onClick={()=>setView('feed')} style={{margin:'12px 16px',padding:'5px 12px',borderRadius:C.radiusSm,fontSize:11,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>← Back to Feed</button>
          <RelationshipWeb profiles={profiles} onSelectProfile={p=>{ setSelected(p); setView('feed'); }} />
        </div>
      )}

      {view==='feed' && <>
        {/* ── Auto-Generate Bar ──────────────────────────────── */}
        <div className="spg-autogen-bar" style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:stats.total>0&&!activeJob?'0':'16px 24px'}}>
          {/* Collapsed toggle when profiles exist and no active job */}
          {stats.total>0&&!activeJob&&(
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 24px'}}>
              <button onClick={()=>setShowAutoGenBar(s=>!s)} style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:C.inkLight,padding:'4px 0'}}>
                <span style={{transition:'transform 0.2s',display:'inline-block',transform:showAutoGenBar?'rotate(90deg)':'none'}}>▸</span>
                {showAutoGenBar?'Hide':'More'} Options
              </button>
              {!showAutoGenBar&&<button onClick={()=>{setAutoGenCount(5);runAutoGenerate();}} disabled={autoGenRunning||!!activeJob||stats.total>=feedCap} style={{
                padding:'6px 18px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,border:'none',
                cursor:autoGenRunning||stats.total>=feedCap?'not-allowed':'pointer',
                background:stats.total>=feedCap?C.border:C.lavender,color:stats.total>=feedCap?C.inkLight:'#fff',
              }}>
                {stats.total>=feedCap?'Cap Reached':'+ Generate 5'}
              </button>}
              <span style={{marginLeft:'auto',fontSize:11,color:stats.total>=feedCap?'#c0392b':C.inkLight}}>{stats.total}/{feedCap}</span>
            </div>
          )}
          {(stats.total===0||activeJob||showAutoGenBar)&&<div style={{padding:stats.total>0&&!activeJob?'0 24px 16px':'0'}}>
          {/* Primary: Auto-Generate */}
          <div className="spg-autogen-row" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
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
            <button onClick={runAutoGenerate} disabled={autoGenRunning||stats.total>=feedCap} style={{
              padding:'8px 22px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,border:'none',
              cursor:autoGenRunning||stats.total>=feedCap?'not-allowed':'pointer',
              opacity:stats.total>=feedCap&&!autoGenRunning?0.5:1,
              background:autoGenRunning?C.border:stats.total>=feedCap?'#c0392b':C.lavender,
              color:autoGenRunning?C.inkLight:'#fff',
              display:'flex',alignItems:'center',gap:6,transition:'all 0.15s',
            }}>
              {autoGenRunning?<><Spinner/> Generating…</>:stats.total>=feedCap?`Cap Reached (${feedCap}/${feedCap})`:`Generate ${autoGenCount} Creators`}
            </button>
            <span style={{fontSize:11,color:C.inkLight,marginLeft:'auto'}}>AI generates handles, vibes, and full profiles automatically</span>
          </div>

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
                  {[['Location','location_hint','e.g. Atlanta, London'],['Follower Range','follower_hint','e.g. 50K-100K'],['Relationship','relationship_hint','e.g. ex of @handle'],['Drama','drama_hint','e.g. cheating scandal'],['Aesthetic','aesthetic_hint','e.g. clean girl, y2k'],['Revenue','revenue_hint','e.g. brand deals only'],['Celebrity Tier','celebrity_tier_hint','accessible, selective, exclusive, untouchable'],['Follow Motivation','follow_motivation_hint','aspiration, envy, competition, entertainment'],['Beauty Factor','beauty_hint','e.g. 8/10 — effortless LA pretty'],['Lifestyle','lifestyle_hint','e.g. claims luxury, actually broke']].map(([label,key,ph])=>(
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
        </div>}
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          {/* Toolbar */}
          <div className="spg-toolbar" style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',flexShrink:0}}>
            {/* Status filters */}
            <div className="spg-filter-tabs" style={{display:'flex',gap:4}}>
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
            <div className="spg-view-tabs" style={{display:'flex',gap:2,background:C.surfaceAlt,borderRadius:C.radiusSm,padding:2,border:`1px solid ${C.border}`,marginLeft:8}}>
              {[['grid','Grid'],['timeline','Timeline'],['follows','Follows'],['moments','Moments'],['dashboard','Dashboard'],['graph','Graph'],['templates','Templates'],['automation','Automation']].filter(([k])=>{
                // Progressive disclosure: hide advanced tabs until feed has enough profiles
                if(stats.total<5&&['moments','dashboard','graph','templates'].includes(k))return false;
                return true;
              }).map(([k,l])=>(
                <button key={k} onClick={()=>{setFeedView(k);if(k==='follows')loadFollowStats();if(k==='automation')loadAutoStatus();if(k==='dashboard')loadDiversity();if(k==='moments')loadMoments();if(k==='graph')loadSuggestions();if(k==='templates')loadTemplates();}} style={{padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',
                  background:feedView===k?C.lavender:'transparent',color:feedView===k?'#fff':C.inkLight,transition:'all 0.15s'}}>
                  {l}
                </button>
              ))}
            </div>
            <div className="spg-toolbar-controls" style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              {/* Export dropdown */}
              <ExportDropdown exporting={exporting} onExport={exportProfiles}/>
              <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Search handle or name…" style={{padding:'6px 12px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,width:200,minWidth:0,flex:'1 1 120px'}}/>
              <select value={sortBy} onChange={e=>changeSort(e.target.value)} style={{padding:'6px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,background:C.surface}}>
                <option value="score">Score ↓</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="handle">Handle A–Z</option>
              </select>
              <button onClick={()=>{const e=!bulkMode;setBulkMode(e);setSelectedIds(new Set());if(e)setSelected(null);}} style={{padding:'6px 12px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',
                background:bulkMode?'#fef2f2':'transparent',color:bulkMode?'#dc2626':C.inkLight,
                border:`1.5px solid ${bulkMode?'#fecaca':C.border}`}}>
                {bulkMode?'✕ Exit Select Mode':'☐ Select Multiple'}
              </button>
            </div>
          </div>

          {/* Advanced Filters toggle + panel */}
          <div className="spg-filters-bar" style={{borderBottom:`1px solid ${C.border}`,padding:'0 24px'}}>
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
                  <button onClick={()=>{setFilterArchetypes([]);setFilterPlatforms([]);setFilterCategory('');setFilterRelevanceMin('');setFilterRelevanceMax('');setFilterAdultContent(null);setFilterCelebrityTier('');setFilterFollowMotivation('');}} style={{padding:'5px 12px',borderRadius:C.radiusSm,fontSize:11,fontWeight:600,cursor:'pointer',background:'transparent',color:C.pink,border:`1px solid ${C.pink}40`}}>Clear Filters</button>
                </div>
                {/* Celebrity Tier + Follow Motivation */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Celebrity Tier</label>
                    <div style={{display:'flex',gap:2}}>
                      {['','accessible','selective','exclusive','untouchable'].map(t=>(
                        <button key={t} onClick={()=>setFilterCelebrityTier(t)} style={{padding:'4px 8px',borderRadius:12,fontSize:10,fontWeight:600,cursor:'pointer',background:filterCelebrityTier===t?(t==='untouchable'?'#fef3c7':C.lavLight):'transparent',color:filterCelebrityTier===t?(t==='untouchable'?'#92400e':C.lavender):C.inkLight,border:`1.5px solid ${filterCelebrityTier===t?C.lavender:C.border}`}}>{t||'All'}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:0.5}}>Follow Motivation</label>
                    <div style={{display:'flex',gap:2,flexWrap:'wrap'}}>
                      {['','aspiration','inspiration','entertainment','competition','envy','relatability','hate_follow'].map(m=>(
                        <button key={m} onClick={()=>setFilterFollowMotivation(m)} style={{padding:'4px 8px',borderRadius:12,fontSize:10,fontWeight:600,cursor:'pointer',background:filterFollowMotivation===m?(m==='envy'?'#fde8e8':C.lavLight):'transparent',color:filterFollowMotivation===m?(m==='envy'?'#9d174d':C.lavender):C.inkLight,border:`1.5px solid ${filterFollowMotivation===m?C.lavender:C.border}`}}>{m?m.replace('_',' '):'All'}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bulk action bar — prominent when active */}
          {bulkMode && (
            <div className="spg-bulk-bar" style={{background:'#FAF7F0',borderBottom:'2px solid #B8962E',padding:'12px 24px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button onClick={()=>setSelectedIds(new Set(profiles.map(p=>p.id)))} style={{...sBtnSm,background:'#fff',border:'1px solid #B8962E',color:'#B8962E'}}>☑ Select Page ({profiles.length})</button>
                {totalCount>profiles.length&&<button onClick={()=>setSelectAllPages(true)} style={{...sBtnSm,background:'#fff',border:'1px solid #B8962E',color:'#B8962E'}}>☑ Select All {totalCount}</button>}
              </div>
              {(selectedIds.size>0||selectAllPages) ? (
                <>
                  <div style={{padding:'4px 12px',background:'#B8962E',color:'#fff',borderRadius:20,fontSize:12,fontWeight:700}}>
                    {selectAllPages?`All ${totalCount}`:selectedIds.size} selected
                  </div>
                  <div style={{height:20,width:1,background:'#ddd'}}/>
                  <span style={{fontSize:11,color:'#888'}}>Choose action:</span>
                  <div style={{display:'flex',gap:6}}>
                    <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/finalize','Finalize $n profile(s)? They will be marked as reviewed and ready for the story.',r=>{const t=r.reduce((a,d)=>a+(d.finalized||0),0);showToast(`✅ Finalized ${t} profile(s) — they can now host events and appear in episodes`);})} style={{...sBtnSm,background:'#d4edda',color:'#155724',fontWeight:700,padding:'6px 14px'}}>✓ Finalize</button>
                    <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/cross','Cross $n profile(s) into the story world? They will be marked as active story characters.',r=>{const t=r.reduce((a,d)=>a+(d.crossed||0),0);showToast(`✦ Crossed ${t} profile(s) into the story`);})} style={{...sBtnSm,background:'#e8daff',color:'#5b21b6',fontWeight:700,padding:'6px 14px'}}>✦ Cross</button>
                    <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/archive','Archive $n profile(s)? They will be hidden but not deleted.',r=>{const t=r.reduce((a,d)=>a+(d.archived||0),0);showToast(`▪ Archived ${t} profile(s)`);})} style={{...sBtnSm,padding:'6px 14px'}}>▪ Archive</button>
                    <button disabled={!selectedIds.size&&!selectAllPages} onClick={()=>bulkOp('bulk/delete','⚠️ Permanently delete $n profile(s)? This cannot be undone.',r=>{const t=r.reduce((a,d)=>a+(d.deleted||0),0);showToast(`🗑️ Deleted ${t} profile(s)`,'warn');})} style={{...sBtnSm,color:'#dc2626',border:'1px solid #fecaca',padding:'6px 14px'}}>✕ Delete</button>
                  </div>
                </>
              ) : (
                <span style={{fontSize:12,color:'#B8962E',fontStyle:'italic'}}>Click profiles to select them, then choose an action</span>
              )}
            </div>
          )}

          <div className="spg-content-area" style={{flex:1,padding:'16px 24px',overflowY:'auto'}}>
            <FeedPagination {...paginationProps}/>
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
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',gap:16,textAlign:'center',maxWidth:480,margin:'0 auto'}}>
                <div style={{fontSize:48,opacity:0.15}}>📱</div>
                {search ? (
                  <>
                    <div style={{fontSize:15,fontWeight:600,color:C.ink}}>No matching creators</div>
                    <div style={{fontSize:13,color:C.inkLight}}>Try a different search term</div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:18,fontWeight:700,color:C.ink}}>
                      {feedLayer==='lalaverse'?"Lala's Feed is empty":"JustAWoman's Feed is empty"}
                    </div>
                    <div style={{fontSize:13,color:C.inkMid,lineHeight:1.6}}>
                      {feedLayer==='lalaverse'
                        ?'Generate the parasocial creators that populate Lala\'s inherited digital world. The AI builds full profiles — handles, vibes, metrics, and narrative tension.'
                        :'Generate the creators JustAWoman watches, follows, envies, and obsesses over. Each profile is a full parasocial character with metrics, voice, and story potential.'}
                    </div>
                    <button onClick={()=>{setAutoGenCount(5);runAutoGenerate();}} disabled={autoGenRunning||!!activeJob} style={{
                      padding:'12px 32px',borderRadius:C.radiusSm,fontSize:14,fontWeight:700,border:'none',
                      cursor:autoGenRunning||activeJob?'not-allowed':'pointer',
                      background:autoGenRunning||activeJob?C.border:C.lavender,color:autoGenRunning||activeJob?C.inkLight:'#fff',
                      display:'flex',alignItems:'center',gap:8,transition:'all 0.15s',
                    }}>
                      {autoGenRunning||activeJob?<><Spinner/> Generating…</>:'✦ Generate First 5 Creators'}
                    </button>
                    <div style={{fontSize:11,color:C.inkLight,marginTop:4}}>or use the Auto-Generate bar above for more options</div>
                  </>
                )}
              </div>
            )}
            {/* ── GRID VIEW ── */}
            {!loading&&profiles.length>0&&feedView==='grid' && (
              <div className="spg-card-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14,marginBottom:16}}>
                {profiles.map(p=>(
                  <ProfileCard key={p.id} profile={p} selected={selected} feedLayer={feedLayer}
                    bulkMode={bulkMode} isChecked={selectAllPages||selectedIds.has(p.id)}
                    onSelect={selectProfile} onToggle={toggleSelect}/>
                ))}
              </div>
            )}


            {/* ── View tabs (Timeline, Follows, Moments, etc.) ── */}
            <FeedViewContent
              feedView={feedView} loading={loading} profiles={profiles} feedLayer={feedLayer}
              selected={selected} setSelected={setSelected} selectProfile={selectProfile} setDetailTab={setDetailTab}
              followStats={followStats} momentsData={momentsData} momentsLoading={momentsLoading}
              diversityData={diversityData} diversityLoading={diversityLoading}
              suggestions={suggestions} suggestionsLoading={suggestionsLoading}
              loadSuggestions={loadSuggestions} acceptSuggestion={acceptSuggestion}
              templates={templates} deleteTemplate={deleteTemplate} saveAsTemplate={saveAsTemplate}
              loadSceneContext={loadSceneContext}
              autoStatus={autoStatus} autoRunning={autoRunning} autoHistory={autoHistory}
              layerStatus={layerStatus} toggleScheduler={toggleScheduler} runAutoNow={runAutoNow}
              updateAutoConfig={updateAutoConfig} showToast={showToast} setAutoRunning={setAutoRunning}
            />

            <FeedPagination {...paginationProps}/>
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
            {/* Quick action: Create Event + show existing events */}
            {showId && selected && feedLayer === 'lalaverse' && (
              <div id="profile-event-bar" style={{padding:'10px 16px',background:'#FAF7F0',borderBottom:'1px solid #e8e0d0'}}>
                {/* Load existing events for this profile on mount */}
                <ProfileEventSection
                  profileId={selected.id}
                  profileName={selected.display_name||selected.handle}
                  showId={showId}
                  showToast={showToast}
                  onNavigateToEvent={(ev)=>{
                    setSelected(null);
                    if (onNavigateToTab) {
                      onNavigateToTab('feed-events', ev);
                    } else {
                      const url = new URL(window.location);
                      url.searchParams.set('tab', 'feed-events');
                      if (ev?.id) url.searchParams.set('eventId', ev.id);
                      window.history.pushState({}, '', url);
                      window.location.reload();
                    }
                  }}
                />
              </div>
            )}
            <DetailPanel profile={selected} fp={fp(selected)} onClose={()=>setSelected(null)}
              onFinalize={finalizeProfile} onCross={crossProfile} onEdit={editProfile} onDelete={deleteProfile} onRefresh={loadProfiles}
              onRegenerate={regenerateProfile} regenerating={regenerating}
              onLoadCrossingPreview={loadCrossingPreview} crossingPreview={crossingPreview} setCrossingPreview={setCrossingPreview}
              onLoadSceneContext={loadSceneContext} sceneContext={sceneContext} setSceneContext={setSceneContext} onCopySceneContext={copySceneContext}
              detailTab={detailTab} setDetailTab={setDetailTab}
              onApprove={approveForCrossing} onRejectCrossing={rejectCrossing} onSaveAsTemplate={saveAsTemplate}
              onReactions={()=>setReactionsProfile(selected)}/>
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

      {/* Lala's Reactions Modal */}
      {reactionsProfile && createPortal(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setReactionsProfile(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'90vw',maxWidth:560,maxHeight:'85vh',overflow:'auto',boxShadow:'0 16px 48px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <LalaReactions profile={reactionsProfile} showId={showId} onClose={()=>setReactionsProfile(null)} />
          </div>
        </div>,
        document.body
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}#feed-export-menu.open{display:block!important}`}</style>
    </div>
  );
}

// ── Shared button style for bulk bar ──────────────────────────────────
const sBtnSm = { padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.inkMid };

// ── ProfileEventSection — shows existing events + create button ──
function ProfileEventSection({ profileId, profileName, showId, showToast, onNavigateToEvent }) {
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId || !showId) return;
    fetch(`/api/v1/world/${showId}/events`)
      .then(r => r.json())
      .then(d => {
        const all = d.events || d.success && d.events || [];
        const hosted = all.filter(ev => {
          const auto = ev.canon_consequences?.automation;
          return auto?.host_profile_id === profileId;
        });
        setEvents(hosted);
      })
      .catch(() => setEvents([]));
  }, [profileId, showId]);

  const createEvent = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/v1/world/${showId}/events/from-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, event_template: 'Event' }),
      });
      const d = await res.json();
      if (d.success) {
        setEvents(prev => [...(prev || []), d.event]);
        showToast(`Event created for ${profileName}`);
        // Navigate directly to the event for editing
        if (d.event && onNavigateToEvent) onNavigateToEvent(d.event);
      } else {
        showToast(d.error || 'Failed', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setCreating(false);
  };

  if (events === null) return <div style={{ fontSize: 11, color: '#999' }}>Loading events...</div>;

  return (
    <div>
      {/* Existing events */}
      {events.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 6 }}>Events Hosted ({events.length})</div>
          {events.map(ev => (
            <div key={ev.id} style={{ background: '#fff', border: '1px solid #d4edda', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#2C2C2C', marginBottom: 2 }}>{ev.name}</div>
              <div style={{ fontSize: 10, color: '#666', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>⭐ {ev.prestige || 5}</span>
                <span style={{ padding: '0 4px', borderRadius: 3, background: ev.status === 'used' ? '#d4edda' : '#fef3c7', fontSize: 9 }}>{ev.status}</span>
                {ev.location_hint && <span>📍 {ev.location_hint.slice(0, 30)}</span>}
              </div>
              <button onClick={() => onNavigateToEvent(ev)} style={{ marginTop: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #B8962E', background: 'transparent', color: '#B8962E', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
              >
                {ev.status === 'draft' ? 'Complete in Feed Events →' : 'View in Events Library →'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create button */}
      <button onClick={createEvent} disabled={creating} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #B8962E', background: 'transparent', color: '#B8962E', fontWeight: 600, fontSize: 11, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
        {creating ? '⏳ Creating...' : `🎭 Create Event Hosted by ${profileName}`}
      </button>
    </div>
  );
}

// Spinner imported from ./feed/FeedViews

// ── Page button ───────────────────────────────────────────────────────
function PageBtn({ children, disabled, onClick }) {
  return <button disabled={disabled} onClick={onClick} style={{padding:'5px 10px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,border:`1px solid ${C.border}`,background:'transparent',color:disabled?C.border:C.inkMid,cursor:disabled?'not-allowed':'pointer'}}>{children}</button>;
}

// FeedStatePicker + DetailPanel extracted to ./feed/ProfileDetailPanel.jsx
// (end of file)
