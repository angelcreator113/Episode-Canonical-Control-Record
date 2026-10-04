/**
 * WorldDashboard — World State + Tensions (the LalaVerse hub's State tab)
 * Merges: UniverseWorldStatePage. Its Setup Progress moved to the hub's
 * Overview as components/WorldSetupProgress (2026-10-04).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { tabFromSearch } from '../utils/worldRedirects';

const API = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Track 6 CP7 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 7 helpers covering 7 explicit-endpoint fetch sites on /world/* (snapshots,
// timeline, tension-scanner, create-tension-proposal).
export const listSnapshotsApi = () => apiClient.get(`${API}/world/state/snapshots`);
export const listTimelineApi = () => apiClient.get(`${API}/world/state/timeline`);
export const getTensionScannerApi = () => apiClient.get(`${API}/world/tension-scanner`);
export const createSnapshotApi = (payload) =>
  apiClient.post(`${API}/world/state/snapshots`, payload);
export const createTimelineEventApi = (payload) =>
  apiClient.post(`${API}/world/state/timeline`, payload);
export const deleteTimelineEventApi = (id) =>
  apiClient.delete(`${API}/world/state/timeline/${id}`);
export const createTensionProposalApi = (payload) =>
  apiClient.post(`${API}/world/create-tension-proposal`, payload);

const TABS = [
  { key: 'state', label: 'World State' },
  { key: 'tensions', label: 'Tensions' },
];

const tb = (a) => ({ padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:"'DM Mono', monospace", background:a?'#2C2C2C':'transparent', color:a?'#fff':'#888', border:'none', borderRadius:'6px 6px 0 0', cursor:'pointer' });
const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:14, marginBottom:8 };
const inputStyle = { padding:'7px 10px', borderRadius:6, border:'1px solid #e0d9ce', fontSize:12, width:'100%', boxSizing:'border-box' };

export default function WorldDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => tabFromSearch(TABS, 'state', undefined, 'sub'));
  const [toast, setToast] = useState(null);
  const flash = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // World state
  const [snapshots, setSnapshots] = useState([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapForm, setSnapForm] = useState({ snapshot_label:'', world_facts:'', active_threads:'' });
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlForm, setTlForm] = useState({ event_name:'', event_description:'', event_type:'plot', impact_level:'moderate', story_date:'' });

  // Tensions
  const [tensionPairs, setTensionPairs] = useState([]);
  const [tensionLoading, setTensionLoading] = useState(false);

  // Load state data
  const loadSnapshots = useCallback(async () => { setSnapLoading(true); try { const r = await listSnapshotsApi(); setSnapshots(r.data?.snapshots||[]); } catch(e){console.error(e);} finally{setSnapLoading(false);} }, []);
  const loadTimeline = useCallback(async () => { setTlLoading(true); try { const r = await listTimelineApi(); setTimelineEvents(r.data?.events||[]); } catch(e){console.error(e);} finally{setTlLoading(false);} }, []);
  const loadTensions = useCallback(async () => { setTensionLoading(true); try { const r = await getTensionScannerApi(); setTensionPairs(r.data?.pairs||[]); } catch(e){console.error(e);} finally{setTensionLoading(false);} }, []);

  useEffect(() => { if (tab==='state') { loadSnapshots(); loadTimeline(); } if (tab==='tensions') loadTensions(); }, [tab]);

  const saveSnapshot = async () => {
    try { await createSnapshotApi({ snapshot_label:snapForm.snapshot_label, world_facts:snapForm.world_facts?snapForm.world_facts.split('\n').filter(Boolean):[], active_threads:snapForm.active_threads?snapForm.active_threads.split('\n').filter(Boolean):[] }); flash('Snapshot saved'); setSnapForm({snapshot_label:'',world_facts:'',active_threads:''}); loadSnapshots(); } catch { flash('Failed','error'); }
  };

  const saveTimelineEvent = async () => {
    try { await createTimelineEventApi(tlForm); flash('Event added'); setTlForm({event_name:'',event_description:'',event_type:'plot',impact_level:'moderate',story_date:''}); loadTimeline(); } catch { flash('Failed','error'); }
  };

  const deleteTimelineEvent = async (id) => {
    try { await deleteTimelineEventApi(id); flash('Deleted'); loadTimeline(); } catch { flash('Failed','error'); }
  };

  const proposeTensionScene = async (pair) => {
    try { const r = await createTensionProposalApi({char_a_id:pair.char_a_id,char_b_id:pair.char_b_id}); if (r.data?.proposal) navigate('/story-evaluation', {state:{sceneProposal:r.data.proposal}}); else flash('Could not generate','error'); } catch { flash('Failed','error'); }
  };

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding: embedded ? 0 : '24px 20px' }}>
      {/* Header; inside the LalaVerse hub the tab is the heading */}
      <div style={{ display:'flex', justifyContent: embedded ? 'flex-end' : 'space-between', alignItems:'flex-start', marginBottom: embedded ? 8 : 20 }}>
        {!embedded && <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', margin:0 }}>World Dashboard</h1>
          <p style={{ fontSize:12, color:'#888', margin:'4px 0 0' }}>Current world state and character tensions</p>
        </div>}
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e8e0d0' }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tb(tab===t.key)}>{t.label}</button>)}
      </div>

      {/* WORLD STATE */}
      {tab === 'state' && (
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, margin:'0 0 12px' }}>State Snapshots</h2>
          <div style={{ ...card, background:'#FAF7F0', border:'1px solid #e8e0d0' }}>
            <input style={inputStyle} placeholder="Snapshot Label *" value={snapForm.snapshot_label} onChange={e=>setSnapForm(p=>({...p,snapshot_label:e.target.value}))} />
            <textarea style={{...inputStyle,marginTop:6,resize:'vertical'}} rows={2} placeholder="World Facts (one per line)" value={snapForm.world_facts} onChange={e=>setSnapForm(p=>({...p,world_facts:e.target.value}))} />
            <textarea style={{...inputStyle,marginTop:6,resize:'vertical'}} rows={2} placeholder="Active Threads (one per line)" value={snapForm.active_threads} onChange={e=>setSnapForm(p=>({...p,active_threads:e.target.value}))} />
            <button onClick={saveSnapshot} disabled={!snapForm.snapshot_label} style={{ marginTop:8, padding:'6px 14px', fontSize:11, fontWeight:600, background:'#2C2C2C', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>Save Snapshot</button>
          </div>
          {snapLoading ? <div style={{color:'#999',textAlign:'center',padding:20}}>Loading...</div> : snapshots.map(s => (
            <div key={s.id} style={card}>
              <div style={{fontWeight:600,fontSize:13}}>{s.snapshot_label}</div>
              <div style={{fontSize:10,color:'#888'}}>Position: {s.timeline_position||'—'}</div>
              {s.world_facts?.length>0 && <div style={{marginTop:4}}>{s.world_facts.map((f,i)=><span key={i} style={{fontSize:10,background:'#f0eee8',borderRadius:3,padding:'1px 5px',marginRight:3}}>{f}</span>)}</div>}
              {s.active_threads?.length>0 && <div style={{marginTop:3}}>{s.active_threads.map((t,i)=><span key={i} style={{fontSize:10,background:'#e8edf5',borderRadius:3,padding:'1px 5px',marginRight:3}}>{t}</span>)}</div>}
            </div>
          ))}

          <h2 style={{ fontSize:15, fontWeight:700, margin:'24px 0 12px' }}>Timeline Events</h2>
          <div style={{ ...card, background:'#FAF7F0', border:'1px solid #e8e0d0' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <input style={inputStyle} placeholder="Event Name *" value={tlForm.event_name} onChange={e=>setTlForm(p=>({...p,event_name:e.target.value}))} />
              <input style={inputStyle} placeholder="Story Date" value={tlForm.story_date} onChange={e=>setTlForm(p=>({...p,story_date:e.target.value}))} />
              <select style={inputStyle} value={tlForm.event_type} onChange={e=>setTlForm(p=>({...p,event_type:e.target.value}))}>
                <option value="plot">Plot</option><option value="backstory">Backstory</option><option value="world">World</option><option value="character">Character</option><option value="relationship">Relationship</option>
              </select>
              <select style={inputStyle} value={tlForm.impact_level} onChange={e=>setTlForm(p=>({...p,impact_level:e.target.value}))}>
                <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option><option value="catastrophic">Catastrophic</option>
              </select>
            </div>
            <textarea style={{...inputStyle,marginTop:6,resize:'vertical'}} rows={2} placeholder="Description" value={tlForm.event_description} onChange={e=>setTlForm(p=>({...p,event_description:e.target.value}))} />
            <button onClick={saveTimelineEvent} disabled={!tlForm.event_name} style={{ marginTop:8, padding:'6px 14px', fontSize:11, fontWeight:600, background:'#2C2C2C', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>Add Event</button>
          </div>
          {tlLoading ? <div style={{color:'#999',textAlign:'center',padding:20}}>Loading...</div> : timelineEvents.map(ev => (
            <div key={ev.id} style={{...card,display:'flex',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{ev.impact_level==='catastrophic'?'🔥':ev.impact_level==='major'?'⚠️':'•'} {ev.event_name}</div>
                <div style={{fontSize:10,color:'#888'}}>{ev.event_type} · {ev.impact_level}{ev.story_date?` · ${ev.story_date}`:''}</div>
                {ev.event_description && <div style={{fontSize:11,color:'#666',marginTop:2}}>{ev.event_description}</div>}
              </div>
              <button onClick={()=>deleteTimelineEvent(ev.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:14}}>x</button>
            </div>
          ))}
        </div>
      )}

      {/* TENSIONS */}
      {tab === 'tensions' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={{margin:0,fontSize:15,fontWeight:700}}>Character Tension Scanner</h2>
            <button onClick={loadTensions} disabled={tensionLoading} style={{padding:'6px 14px',fontSize:11,fontWeight:600,background:'#FAF7F0',border:'1px solid #e8e0d0',borderRadius:6,cursor:'pointer'}}>{tensionLoading?'Scanning...':'Rescan'}</button>
          </div>
          {tensionLoading ? <div style={{textAlign:'center',color:'#999',padding:40}}>Scanning...</div> : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:10}}>
              {tensionPairs.map((p,i) => (
                <div key={i} style={card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontWeight:700,fontSize:13}}>{p.char_a_name} <span style={{color:'#c44'}}>⚡</span> {p.char_b_name}</span>
                    <span style={{fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:10,background:p.tension_state==='Explosive'?'#fee':p.tension_state==='Simmering'?'#fff3e0':'#f5f5f5',color:p.tension_state==='Explosive'?'#c44':p.tension_state==='Simmering'?'#e65100':'#666'}}>{p.tension_state}</span>
                  </div>
                  <div style={{fontSize:11,color:'#888',marginTop:4}}>{p.relationship_type}{p.is_romantic?' · 💕':''}</div>
                  {p.conflict_summary && <div style={{fontSize:11,color:'#666',marginTop:4,lineHeight:1.4}}>{p.conflict_summary}</div>}
                  <button onClick={()=>proposeTensionScene(p)} style={{marginTop:8,padding:'5px 12px',fontSize:10,fontWeight:600,background:'#2C2C2C',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Propose Scene</button>
                </div>
              ))}
              {tensionPairs.length===0 && <div style={{color:'#999',gridColumn:'1/-1',textAlign:'center',padding:40}}>No high-tension pairs found.</div>}
            </div>
          )}
        </div>
      )}

      {toast && <div style={{position:'fixed',bottom:24,right:24,padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:600,zIndex:9999,background:toast.type==='error'?'#fee':'#e8f5e9',color:toast.type==='error'?'#c44':'#2e7d32',border:`1px solid ${toast.type==='error'?'#fcc':'#c8e6c9'}`}}>{toast.msg}</div>}
    </div>
  );
}
