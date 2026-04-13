/**
 * CultureEvents — Calendar + Memory + Legacy
 * Merges: CulturalCalendar (events) + CulturalMemory
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList } from '../components/EditItemModal';
import PushToBrain from '../components/PushToBrain';
import { AWARD_SHOWS, BIRTHDAY_TEMPLATES, CALENDAR_DEFAULTS } from '../data/calendarData';
import { MEMORY_TYPES, STRENGTH_LEVELS, ARCHIVES, ANNIVERSARIES, NOSTALGIA_WAVES, LEGEND_PATHS, FEUD_STAGES, CAPSULE_TYPES, REFERENCE_TYPES, RANKING_METRICS, MEMORY_DEFAULTS } from '../data/memoryData';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_COLORS = {
  fashion: { bg:'#fdf2f6', border:'#d4789a', text:'#9c3d62' },
  beauty: { bg:'#f6f0fc', border:'#a889c8', text:'#6b4d8a' },
  entertainment: { bg:'#eef6fb', border:'#7ab3d4', text:'#3d6e8a' },
  lifestyle: { bg:'#f0faf5', border:'#6bba9a', text:'#3a7d60' },
  community: { bg:'#fdf8ee', border:'#c9a84c', text:'#8a7030' },
  technology: { bg:'#fcf0e8', border:'#b89060', text:'#7a5a30' },
};

// DREAM city mapping for events
const DREAM_EVENT_CITIES = [
  { key: 'dazzle_district', name: 'Dazzle District', letter: 'D', color: '#d4789a', categories: ['fashion'] },
  { key: 'radiance_row', name: 'Radiance Row', letter: 'R', color: '#a889c8', categories: ['beauty'] },
  { key: 'echo_park', name: 'Echo Park', letter: 'E', color: '#c9a84c', categories: ['entertainment', 'music'] },
  { key: 'ascent_tower', name: 'Ascent Tower', letter: 'A', color: '#6bba9a', categories: ['technology'] },
  { key: 'maverick_harbor', name: 'Maverick Harbor', letter: 'M', color: '#7ab3d4', categories: ['lifestyle', 'community'] },
];

function getCityForEvent(ev) {
  if (ev.lalaverse_district) return DREAM_EVENT_CITIES.find(c => c.name === ev.lalaverse_district) || null;
  const cat = (ev.cultural_category || '').toLowerCase();
  return DREAM_EVENT_CITIES.find(c => c.categories.includes(cat)) || null;
}

const TABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'memory', label: 'Memory' },
  { key: 'legacy', label: 'Legacy' },
];

const tb = (a) => ({ padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:"'DM Mono', monospace", background:a?'#2C2C2C':'transparent', color:a?'#fff':'#888', border:'none', borderRadius:'6px 6px 0 0', cursor:'pointer' });
const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:14, marginBottom:8 };
const lbl = { fontSize:10, fontWeight:600, color:'#B8962E', fontFamily:"'DM Mono', monospace", marginBottom:6 };

export default function CultureEvents() {
  const [tab, setTab] = useState('calendar');
  const [editItem, setEditItem] = useState(null);
  const { data: ccData, saving: ccSaving } = usePageData('cultural_calendar', CALENDAR_DEFAULTS);
  const { data: cmData, saving: cmSaving } = usePageData('cultural_memory', MEMORY_DEFAULTS);

  // Calendar events from API
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [shows, setShows] = useState([]);
  const [spawnResult, setSpawnResult] = useState(null);
  const [spawning, setSpawning] = useState(null);
  const [calView, setCalView] = useState('city');

  useEffect(() => { fetch('/api/v1/shows').then(r=>r.json()).then(d=>setShows(d.data||[])).catch(()=>{}); }, []);

  useEffect(() => {
    fetch('/api/v1/calendar/events?event_type=lalaverse_cultural')
      .then(r=>r.json()).then(d=>setEvents(d.events||[]))
      .catch(e=>console.error(e)).finally(()=>setLoading(false));
  }, []);

  const handleCreateEvent = async (ev) => {
    const showId = shows[0]?.id;
    if (!showId) { alert('No show found'); return; }
    setSpawning(ev.id);
    try {
      const res = await fetch(`/api/v1/calendar/events/${ev.id}/auto-spawn`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ show_id:showId, event_count:1, max_guests:6 }) });
      const d = await res.json();
      if (d.success) setSpawnResult({ type:'success', message:`Created "${d.data.events[0]?.name}" — check Events Library` });
      else setSpawnResult({ type:'error', message:d.error||'Failed' });
    } catch (e) { setSpawnResult({ type:'error', message:e.message }); }
    setSpawning(null);
  };

  const handleDelete = async (id) => {
    try { await fetch(`/api/v1/calendar/events/${id}`, { method:'DELETE' }); setEvents(p=>p.filter(e=>e.id!==id)); setSpawnResult({ type:'success', message:'Deleted' }); }
    catch { setSpawnResult({ type:'error', message:'Delete failed' }); }
  };

  const byMonth = useMemo(() => {
    const map = {}; MONTHS.forEach((_,i) => { map[i] = []; });
    events.filter(e=>!e.is_micro_event).forEach(ev => { const m = new Date(ev.start_datetime).getUTCMonth(); if (map[m]) map[m].push(ev); });
    return map;
  }, [events]);

  const microEvents = events.filter(e => e.is_micro_event);
  const saving = ccSaving || cmSaving;

  return (
    <PageEditContext.Provider value={{ data: tab === 'memory' || tab === 'legacy' ? cmData : ccData, setEditItem, removeItem: () => {} }}>
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', margin:0 }}>Culture & Events</h1>
          <p style={{ fontSize:12, color:'#888', margin:'4px 0 0' }}>The cultural calendar, how events are remembered, and what becomes legend</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {saving && <span style={{ fontSize:11, color:'#B8962E' }}>Saving...</span>}
          <PushToBrain pageName="cultural_calendar" data={ccData} />
          <PushToBrain pageName="cultural_memory" data={cmData} />
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e8e0d0' }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tb(tab===t.key)}>{t.label}</button>)}
      </div>

      {spawnResult && (
        <div style={{ padding:'10px 16px', marginBottom:12, borderRadius:8, fontSize:13, fontWeight:600, background:spawnResult.type==='success'?'#e8f5e9':'#ffebee', color:spawnResult.type==='success'?'#2e7d32':'#c62828', display:'flex', justifyContent:'space-between' }}>
          <span>{spawnResult.message}</span>
          <button onClick={()=>setSpawnResult(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16 }}>x</button>
        </div>
      )}

      {/* CALENDAR TAB */}
      {tab === 'calendar' && (
        <div>
          {/* Stats + view toggle */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ display:'flex', gap:12 }}>
              {[['Major', events.filter(e=>!e.is_micro_event).length, '#d4789a'], ['Micro', microEvents.length, '#a889c8'], ['Total', events.length, '#7ab3d4']].map(([l,n,c]) => (
                <div key={l} style={{ ...card, textAlign:'center', padding:'10px 20px', marginBottom:0 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:c }}>{n}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={() => setCalView('month')} style={{ padding:'5px 12px', fontSize:10, fontWeight:600, fontFamily:"'DM Mono', monospace", borderRadius:6, border:'1px solid #e8e0d0', background: calView==='month' ? '#2C2C2C' : '#fff', color: calView==='month' ? '#fff' : '#888', cursor:'pointer' }}>By Month</button>
              <button onClick={() => setCalView('city')} style={{ padding:'5px 12px', fontSize:10, fontWeight:600, fontFamily:"'DM Mono', monospace", borderRadius:6, border:'1px solid #e8e0d0', background: calView==='city' ? '#2C2C2C' : '#fff', color: calView==='city' ? '#fff' : '#888', cursor:'pointer' }}>By City</button>
            </div>
          </div>

          {loading ? <div style={{ textAlign:'center', color:'#999', padding:40 }}>Loading events...</div> : (
            <>
              {/* BY CITY VIEW */}
              {calView === 'city' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10, marginBottom:24 }}>
                  {DREAM_EVENT_CITIES.map(city => {
                    const cityEvents = events.filter(ev => !ev.is_micro_event && getCityForEvent(ev)?.key === city.key);
                    return (
                      <div key={city.key} style={{ minHeight:100 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, paddingBottom:6, borderBottom:`2px solid ${city.color}` }}>
                          <span style={{ fontSize:16, fontWeight:900, color:city.color, fontFamily:"'DM Mono', monospace" }}>{city.letter}</span>
                          <span style={{ fontSize:11, fontWeight:700, color:'#2C2C2C' }}>{city.name}</span>
                          <span style={{ fontSize:9, color:'#999', marginLeft:'auto' }}>{cityEvents.length}</span>
                        </div>
                        {cityEvents.length > 0 ? cityEvents.map(ev => {
                          const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
                          return (
                            <div key={ev.id} onClick={()=>setExpandedId(expandedId===ev.id?null:ev.id)} style={{ background:cat.bg, borderLeft:`3px solid ${city.color}`, borderRadius:6, padding:'6px 8px', marginBottom:4, cursor:'pointer', fontSize:11 }}>
                              <div style={{ fontWeight:600, color:'#2C2C2C' }}>{ev.title}</div>
                              {ev.start_datetime && <div style={{ fontSize:9, color:'#999' }}>{MONTHS[new Date(ev.start_datetime).getUTCMonth()]}</div>}
                              {expandedId === ev.id && (
                                <div style={{ marginTop:6 }}>
                                  {ev.what_world_knows && <p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{ev.what_world_knows}</p>}
                                  {ev.location_name && <div style={{ fontSize:9, color:'#888' }}>📍 {ev.location_name}</div>}
                                  <div style={{ display:'flex', gap:4, marginTop:4 }}>
                                    <button onClick={(e)=>{e.stopPropagation();handleCreateEvent(ev);}} style={{ padding:'3px 8px', fontSize:9, fontWeight:600, background:'#e8f5e9', color:'#2e7d32', border:'1px solid #c8e6c9', borderRadius:4, cursor:'pointer' }}>Create Event</button>
                                    <button onClick={(e)=>{e.stopPropagation();if(confirm(`Delete "${ev.title}"?`))handleDelete(ev.id);}} style={{ padding:'3px 8px', fontSize:9, fontWeight:600, background:'#ffebee', color:'#c62828', border:'1px solid #ffcdd2', borderRadius:4, cursor:'pointer' }}>Delete</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }) : <div style={{ fontSize:10, color:'#ccc', padding:'4px 0' }}>No events</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BY MONTH VIEW */}
              {calView === 'month' && (
              <div>
              <div style={lbl}>TIMELINE</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:24 }}>
                {MONTHS.map((m, i) => (
                  <div key={i} style={{ minHeight:80 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#2C2C2C', marginBottom:4, fontFamily:"'DM Mono', monospace" }}>{m}</div>
                    {(byMonth[i]||[]).length > 0 ? (byMonth[i]||[]).map(ev => {
                      const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
                      const city = getCityForEvent(ev);
                      return (
                        <div key={ev.id} onClick={()=>setExpandedId(expandedId===ev.id?null:ev.id)} style={{ background:cat.bg, borderLeft:`3px solid ${cat.border}`, borderRadius:6, padding:'6px 8px', marginBottom:4, cursor:'pointer', fontSize:11 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontWeight:600, color:'#2C2C2C' }}>{ev.title}</span>
                            {city && <span style={{ fontSize:8, fontWeight:700, color:city.color, fontFamily:"'DM Mono', monospace" }}>{city.letter}</span>}
                          </div>
                          {expandedId === ev.id && (
                            <div style={{ marginTop:6 }}>
                              {city && <div style={{ fontSize:9, color:city.color, fontWeight:600, marginBottom:2 }}>{city.name}</div>}
                              {ev.what_world_knows && <p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{ev.what_world_knows}</p>}
                              {ev.location_name && <div style={{ fontSize:9, color:'#888' }}>📍 {ev.location_name}</div>}
                              <div style={{ display:'flex', gap:4, marginTop:4 }}>
                                <button onClick={(e)=>{e.stopPropagation();handleCreateEvent(ev);}} style={{ padding:'3px 8px', fontSize:9, fontWeight:600, background:'#e8f5e9', color:'#2e7d32', border:'1px solid #c8e6c9', borderRadius:4, cursor:'pointer' }}>Create Event</button>
                                <button onClick={(e)=>{e.stopPropagation();if(confirm(`Delete "${ev.title}"?`))handleDelete(ev.id);}} style={{ padding:'3px 8px', fontSize:9, fontWeight:600, background:'#ffebee', color:'#c62828', border:'1px solid #ffcdd2', borderRadius:4, cursor:'pointer' }}>Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }) : <div style={{ fontSize:10, color:'#ccc', padding:'4px 0' }}>—</div>}
                  </div>
                ))}
              </div>
              </div>
              )}

              {/* Awards */}
              <div style={lbl}>AWARD SHOWS</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8, marginBottom:24 }}>
                {(ccData.AWARD_SHOWS || AWARD_SHOWS).map(s => (
                  <div key={s.name} style={card}>
                    <div style={{ fontSize:13, fontWeight:700, color:s.color }}>{s.icon} {s.name}</div>
                    <div style={{ fontSize:10, color:'#888' }}>{s.month} · {s.categories.length} categories</div>
                    <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{s.desc}</p>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                      {s.categories.map(c => <span key={c} style={{ fontSize:9, padding:'1px 5px', background:s.color+'12', color:s.color, borderRadius:3 }}>{c}</span>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Micro events */}
              <div style={lbl}>MICRO EVENTS ({microEvents.length})</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:6 }}>
                {microEvents.length > 0 ? microEvents.map(ev => {
                  const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
                  return (
                    <div key={ev.id} style={{ background:cat.bg, borderLeft:`2px solid ${cat.border}`, borderRadius:6, padding:'8px 10px', fontSize:11 }}>
                      <div style={{ fontWeight:600 }}>{ev.title}</div>
                      {ev.what_world_knows && <p style={{ fontSize:10, color:'#666', margin:'2px 0 0' }}>{ev.what_world_knows}</p>}
                    </div>
                  );
                }) : <div style={{ fontSize:11, color:'#999' }}>No micro events loaded yet.</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* MEMORY TAB */}
      {tab === 'memory' && (
        <div>
          <div style={lbl}>MEMORY TYPES</div>
          <p style={{ fontSize:12, color:'#666', marginBottom:12 }}>Memories are classified into six categories with different cultural weight and lifespan.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:8, marginBottom:24 }}>
            {(cmData.MEMORY_TYPES || MEMORY_TYPES).map(m => (
              <div key={m.type} style={card}>
                <div style={{ fontSize:13, fontWeight:700 }}>{m.icon} {m.type}</div>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600, marginTop:4 }}>WHAT CREATES IT</div>
                <p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{m.created}</p>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600 }}>HOW IT'S REFERENCED</div>
                <p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{m.referenced}</p>
              </div>
            ))}
          </div>

          <div style={lbl}>STRENGTH LEVELS</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
            {(cmData.STRENGTH_LEVELS || STRENGTH_LEVELS).map(s => (
              <div key={s.level} style={{ ...card, borderLeft:`3px solid ${s.color}`, flex:'1 1 200px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:22, height:22, borderRadius:'50%', background:s.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{s.level}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{s.name}</span>
                  <span style={{ fontSize:10, color:'#888', marginLeft:'auto' }}>{s.lifespan}</span>
                </div>
                <p style={{ fontSize:11, color:'#666', margin:'6px 0 0' }}>{s.example}</p>
              </div>
            ))}
          </div>

          <div style={lbl}>ARCHIVES</div>
          <div style={{ background:'#FAF7F0', border:'1px solid #e8e0d0', borderRadius:8, padding:'12px 16px', marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:12, color:'#B8962E' }}>Memory Is Power</div>
            <p style={{ fontSize:11, color:'#555', margin:'4px 0 0' }}>Who controls the archive controls the history. Who names the era controls what the era means.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8 }}>
            {(cmData.ARCHIVES || ARCHIVES).map(a => (
              <div key={a.name} style={{ ...card, borderTop:`3px solid ${a.accent}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:a.accent }}>{a.name}</div>
                <div style={{ fontSize:10, color:'#888' }}>Maintained by: {a.maintained}</div>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600, marginTop:6 }}>TRACKS</div>
                <p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{a.tracks}</p>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600 }}>LEAVES OUT</div>
                <p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{a.leaves_out}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEGACY TAB */}
      {tab === 'legacy' && (
        <div>
          <div style={lbl}>PATHS TO LEGENDARY STATUS</div>
          {(cmData.LEGEND_PATHS || LEGEND_PATHS).map(l => (
            <div key={l.path} style={card}>
              <div style={{ fontSize:13, fontWeight:700 }}>{l.path}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:6 }}>
                <div><span style={{ fontSize:9, padding:'1px 6px', background:'#e8f5e9', color:'#2e7d32', borderRadius:3, fontWeight:600 }}>Requires</span><p style={{ fontSize:10, color:'#666', margin:'4px 0' }}>{l.requires}</p></div>
                <div><span style={{ fontSize:9, padding:'1px 6px', background:'#ffebee', color:'#c62828', borderRadius:3, fontWeight:600 }}>Costs</span><p style={{ fontSize:10, color:'#666', margin:'4px 0' }}>{l.costs}</p></div>
                <div><span style={{ fontSize:9, padding:'1px 6px', background:'#e3f2fd', color:'#1565c0', borderRadius:3, fontWeight:600 }}>Preserved</span><p style={{ fontSize:10, color:'#666', margin:'4px 0' }}>{l.preserved}</p></div>
              </div>
            </div>
          ))}

          <div style={{ ...lbl, marginTop:28 }}>HISTORICAL FEUDS — 4 STAGES</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(cmData.FEUD_STAGES || FEUD_STAGES).map((f, i, a) => (
              <React.Fragment key={f.stage}>
                <div style={{ ...card, borderLeft:`3px solid ${f.color}` }}>
                  <div style={{ fontSize:13, fontWeight:700, color:f.color }}>{f.stage}</div>
                  <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{f.looks}</p>
                  <div style={{ fontSize:10, color:'#888' }}>Attention: {f.attention}</div>
                </div>
                {i < a.length - 1 && <div style={{ textAlign:'center', color:'#ccc', fontSize:16 }}>↓</div>}
              </React.Fragment>
            ))}
          </div>

          <div style={{ ...lbl, marginTop:28 }}>NOSTALGIA WAVES</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8 }}>
            {(cmData.NOSTALGIA_WAVES || NOSTALGIA_WAVES).map(n => (
              <div key={n.type} style={card}>
                <div style={{ fontSize:13, fontWeight:700 }}>{n.type}</div>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600, marginTop:4 }}>WHAT RETURNS</div>
                <p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{n.returns}</p>
                <div style={{ fontSize:10, color:'#B8962E', fontWeight:600 }}>STORY IN THE GAP</div>
                <p style={{ fontSize:10, color:'#555', margin:'2px 0', fontStyle:'italic' }}>{n.gap}</p>
              </div>
            ))}
          </div>

          <div style={{ ...lbl, marginTop:28 }}>TIME CAPSULES</div>
          {(cmData.CAPSULE_TYPES || CAPSULE_TYPES).map(c => (
            <div key={c.type} style={card}>
              <div style={{ fontSize:13, fontWeight:700 }}>{c.type}</div>
              <div style={{ fontSize:10, color:'#888' }}>Compiled by: {c.made_by}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                <div><div style={{ fontSize:9, fontWeight:600, color:'#16a34a' }}>INCLUDED</div><p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{c.included}</p></div>
                <div><div style={{ fontSize:9, fontWeight:600, color:'#dc2626' }}>LEFT OUT</div><p style={{ fontSize:10, color:'#666', margin:'2px 0' }}>{c.left_out}</p></div>
              </div>
            </div>
          ))}

          <div style={{ ...lbl, marginTop:28 }}>INFLUENCE RANKINGS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8 }}>
            {(cmData.RANKING_METRICS || RANKING_METRICS).map(r => (
              <div key={r.metric} style={card}>
                <div style={{ fontSize:13, fontWeight:700 }}>{r.metric}</div>
                <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{r.measures}</p>
                <div style={{ fontSize:10, color:'#888' }}>Measured by: {r.measured_by}</div>
                <div style={{ fontSize:10, color:'#dc2626', marginTop:4 }}>Misses: {r.misses}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editItem && <EditItemModal item={editItem.item} title={`Edit ${editItem.key}`} onSave={() => setEditItem(null)} onCancel={() => setEditItem(null)} />}
    </div>
    </PageEditContext.Provider>
  );
}
