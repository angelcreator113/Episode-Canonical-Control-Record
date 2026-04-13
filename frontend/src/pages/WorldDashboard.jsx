/**
 * WorldDashboard — Setup Progress + World State + Tensions
 * Merges: WorldSetupGuide + UniverseWorldStatePage
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const SETUP_STEPS = [
  { num: 1, key: 'infrastructure', icon: '🏗️', title: 'World Foundation', route: '/world-foundation', description: 'Define the DREAM cities, companies, universities, and legendary figures.', feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'] },
  { num: 2, key: 'influencer', icon: '⭐', title: 'Social Systems', route: '/social-systems', description: 'How influence works — archetypes, relationships, economy, trends.', feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'] },
  { num: 3, key: 'calendar', icon: '📅', title: 'Culture & Events', route: '/culture-events', description: 'The yearly rhythm — events, awards, micro events that auto-spawn world events.', feeds: ['Events Library', 'Feed activity', 'Episode planning'] },
  { num: 4, key: 'memory', icon: '📜', title: 'Cultural Memory', route: '/culture-events', description: 'How the world remembers — legends, feuds, archives. Gives depth.', feeds: ['Character dialogue', 'Feed posts', 'Story depth'] },
  { num: 5, key: 'locations', icon: '📍', title: 'Locations & Venues', route: '/world-foundation?tab=locations', description: 'The map — venues, properties, scene sets. Events need venues.', feeds: ['Event venues', 'Scene Sets', 'HOME_BASE'] },
  { num: 6, key: 'feed', icon: '👥', title: 'Generate Feed', route: null, description: 'Create Lala\'s social world — influencers, rivals, friends.', feeds: ['Event hosts', 'Guest lists', 'Social drama'] },
  { num: 7, key: 'events', icon: '🎉', title: 'Create World Events', route: '/culture-events', description: 'Calendar events auto-spawn world events with hosts and guest lists.', feeds: ['Episode injection', 'Scene creation'] },
];

const TABS = [
  { key: 'setup', label: 'Setup Progress' },
  { key: 'state', label: 'World State' },
  { key: 'tensions', label: 'Tensions' },
];

const tb = (a) => ({ padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:"'DM Mono', monospace", background:a?'#2C2C2C':'transparent', color:a?'#fff':'#888', border:'none', borderRadius:'6px 6px 0 0', cursor:'pointer' });
const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:14, marginBottom:8 };
const inputStyle = { padding:'7px 10px', borderRadius:6, border:'1px solid #e0d9ce', fontSize:12, width:'100%', boxSizing:'border-box' };

export default function WorldDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('setup');
  const [toast, setToast] = useState(null);
  const flash = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // Setup status
  const [status, setStatus] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);

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

  // Check setup status — safe fetch that returns null on 404/error
  const safeFetch = async (url) => {
    try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
    catch { return null; }
  };

  useEffect(() => {
    (async () => {
      const checks = {};
      const infra = await safeFetch(`${API}/page-data/world_infrastructure`);
      checks.infrastructure = infra?.data && Object.keys(infra.data).length > 0;
      const infl = await safeFetch(`${API}/page-data/influencer_systems`);
      checks.influencer = infl?.data && Object.keys(infl.data).length > 0;
      const cal = await safeFetch(`${API}/calendar/events?event_type=lalaverse_cultural`);
      checks.calendar = (cal?.events || []).length > 0;
      const mem = await safeFetch(`${API}/page-data/cultural_memory`);
      checks.memory = mem?.data && Object.keys(mem.data).length > 0;
      const loc = await safeFetch(`${API}/world/locations`);
      checks.locations = (loc?.locations || []).length > 0;
      const feed = await safeFetch(`${API}/social-profiles?feed_layer=lalaverse&limit=1`);
      checks.feed = (feed?.count || 0) > 0;
      const ss = await safeFetch(`${API}/shows`);
      const sid = (ss?.data || [])[0]?.id;
      if (sid) { const ev = await safeFetch(`${API}/world/${sid}/events?status=draft`); checks.events = (ev?.events || []).length > 0; }
      else checks.events = false;
      setStatus(checks); setStatusLoading(false);
    })();
  }, []);

  // Load state data
  const loadSnapshots = useCallback(async () => { setSnapLoading(true); try { const r = await fetch(`${API}/world/state/snapshots`); const d = await r.json(); setSnapshots(d.snapshots||[]); } catch(e){console.error(e);} finally{setSnapLoading(false);} }, []);
  const loadTimeline = useCallback(async () => { setTlLoading(true); try { const r = await fetch(`${API}/world/state/timeline`); const d = await r.json(); setTimelineEvents(d.events||[]); } catch(e){console.error(e);} finally{setTlLoading(false);} }, []);
  const loadTensions = useCallback(async () => { setTensionLoading(true); try { const r = await fetch(`${API}/world/tension-scanner`); const d = await r.json(); setTensionPairs(d.pairs||[]); } catch(e){console.error(e);} finally{setTensionLoading(false);} }, []);

  useEffect(() => { if (tab==='state') { loadSnapshots(); loadTimeline(); } if (tab==='tensions') loadTensions(); }, [tab]);

  const saveSnapshot = async () => {
    try { await fetch(`${API}/world/state/snapshots`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ snapshot_label:snapForm.snapshot_label, world_facts:snapForm.world_facts?snapForm.world_facts.split('\n').filter(Boolean):[], active_threads:snapForm.active_threads?snapForm.active_threads.split('\n').filter(Boolean):[] }) }); flash('Snapshot saved'); setSnapForm({snapshot_label:'',world_facts:'',active_threads:''}); loadSnapshots(); } catch { flash('Failed','error'); }
  };

  const saveTimelineEvent = async () => {
    try { await fetch(`${API}/world/state/timeline`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(tlForm) }); flash('Event added'); setTlForm({event_name:'',event_description:'',event_type:'plot',impact_level:'moderate',story_date:''}); loadTimeline(); } catch { flash('Failed','error'); }
  };

  const deleteTimelineEvent = async (id) => {
    try { await fetch(`${API}/world/state/timeline/${id}`, { method:'DELETE' }); flash('Deleted'); loadTimeline(); } catch { flash('Failed','error'); }
  };

  const proposeTensionScene = async (pair) => {
    try { const r = await fetch(`${API}/world/create-tension-proposal`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({char_a_id:pair.char_a_id,char_b_id:pair.char_b_id}) }); const d = await r.json(); if (d.proposal) navigate('/story-evaluation', {state:{sceneProposal:d.proposal}}); else flash('Could not generate','error'); } catch { flash('Failed','error'); }
  };

  const completedCount = Object.values(status).filter(Boolean).length;

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', margin:0 }}>World Dashboard</h1>
          <p style={{ fontSize:12, color:'#888', margin:'4px 0 0' }}>Setup progress, current world state, and character tensions</p>
        </div>
        {!statusLoading && <div style={{ fontSize:28, fontWeight:700, color:completedCount===7?'#16a34a':'#B8962E' }}>{completedCount}/7</div>}
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e8e0d0' }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tb(tab===t.key)}>{t.label}</button>)}
      </div>

      {/* SETUP */}
      {tab === 'setup' && (
        <div>
          <div style={{ background:'#eee', borderRadius:8, height:8, marginBottom:24, overflow:'hidden' }}>
            <div style={{ background:completedCount===7?'#16a34a':'#B8962E', height:'100%', width:`${(completedCount/7)*100}%`, borderRadius:8, transition:'width 0.3s' }} />
          </div>
          <div style={{ background:'#FAF7F0', border:'1px solid #e8e0d0', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:12, color:'#555', lineHeight:1.6 }}>
            <strong style={{ color:'#B8962E' }}>How it connects:</strong> Foundation defines the world → Social Systems govern behavior → Culture & Events creates yearly events → Memory gives depth → Locations are where things happen → Feed profiles are the people → Events are the story moments.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {SETUP_STEPS.map(step => {
              const done = status[step.key];
              return (
                <div key={step.key} onClick={() => step.route && navigate(step.route)} style={{ ...card, borderColor:done?'#d4edda':'#eee', cursor:step.route?'pointer':'default' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:done?'#d4edda':'#FAF7F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, border:`2px solid ${done?'#16a34a':'#e8e0d0'}` }}>
                      {done ? '✓' : step.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:'#B8962E' }}>STEP {step.num}</span>
                        <span style={{ fontWeight:600, fontSize:13, color:'#2C2C2C' }}>{step.title}</span>
                        {done && <span style={{ fontSize:9, padding:'2px 6px', background:'#d4edda', color:'#166534', borderRadius:4, fontWeight:600 }}>DONE</span>}
                      </div>
                      <p style={{ fontSize:11, color:'#666', margin:'0 0 4px', lineHeight:1.5 }}>{step.description}</p>
                      <div style={{ fontSize:10, color:'#888' }}><strong style={{ color:'#B8962E' }}>Feeds:</strong> {step.feeds.join(' · ')}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
