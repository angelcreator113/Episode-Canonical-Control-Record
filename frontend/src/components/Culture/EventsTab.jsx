/**
 * EventsTab — DREAM city events + micro events
 * Shows cultural calendar events grouped by city or month
 */
import React, { useState, useMemo } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CAT_COLORS = {
  fashion: { bg:'#fdf2f6', border:'#d4789a', text:'#9c3d62' },
  beauty: { bg:'#f6f0fc', border:'#a889c8', text:'#6b4d8a' },
  entertainment: { bg:'#eef6fb', border:'#7ab3d4', text:'#3d6e8a' },
  lifestyle: { bg:'#f0faf5', border:'#6bba9a', text:'#3a7d60' },
  community: { bg:'#fdf8ee', border:'#c9a84c', text:'#8a7030' },
  technology: { bg:'#fcf0e8', border:'#b89060', text:'#7a5a30' },
};

const DREAM_CITIES = [
  { key: 'dazzle_district', name: 'Dazzle District', letter: 'D', color: '#d4789a', icon: '👗', categories: ['fashion'] },
  { key: 'radiance_row', name: 'Radiance Row', letter: 'R', color: '#a889c8', icon: '✨', categories: ['beauty'] },
  { key: 'echo_park', name: 'Echo Park', letter: 'E', color: '#c9a84c', icon: '🎵', categories: ['entertainment', 'music'] },
  { key: 'ascent_tower', name: 'Ascent Tower', letter: 'A', color: '#6bba9a', icon: '🔮', categories: ['technology'] },
  { key: 'maverick_harbor', name: 'Maverick Harbor', letter: 'M', color: '#7ab3d4', icon: '⚓', categories: ['lifestyle', 'community'] },
];

function getCityForEvent(ev) {
  if (ev.lalaverse_district) return DREAM_CITIES.find(c => c.name === ev.lalaverse_district) || null;
  const cat = (ev.cultural_category || '').toLowerCase();
  return DREAM_CITIES.find(c => c.categories.includes(cat)) || null;
}

const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:12, marginBottom:6 };
const lbl = { fontSize:10, fontWeight:600, color:'#B8962E', fontFamily:"'DM Mono', monospace", marginBottom:6 };

function EventCard({ ev, city, expanded, onToggle, onCreateEvent, onDelete }) {
  const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
  return (
    <div onClick={onToggle} style={{ background:cat.bg, borderLeft:`3px solid ${city?.color || cat.border}`, borderRadius:6, padding:'8px 10px', marginBottom:4, cursor:'pointer', fontSize:11 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600, color:'#2C2C2C' }}>{ev.title}</span>
        {city && <span style={{ fontSize:8, fontWeight:700, color:city.color, fontFamily:"'DM Mono', monospace" }}>{city.letter}</span>}
      </div>
      {ev.start_datetime && !expanded && <div style={{ fontSize:9, color:'#999' }}>{MONTHS[new Date(ev.start_datetime).getUTCMonth()]}</div>}
      {expanded && (
        <div style={{ marginTop:6 }}>
          {city && <div style={{ fontSize:9, color:city.color, fontWeight:600, marginBottom:2 }}>{city.icon} {city.name}</div>}
          {ev.what_world_knows && <p style={{ fontSize:10, color:'#666', margin:'2px 0', lineHeight:1.4 }}>{ev.what_world_knows}</p>}
          {ev.location_name && <div style={{ fontSize:9, color:'#888' }}>📍 {ev.location_name}</div>}
          {ev.start_datetime && <div style={{ fontSize:9, color:'#888' }}>📅 {new Date(ev.start_datetime).toLocaleDateString('en-US', { month:'long', day:'numeric' })}</div>}
          <div style={{ display:'flex', gap:4, marginTop:6 }}>
            <button onClick={(e)=>{e.stopPropagation();onCreateEvent(ev);}} style={{ padding:'4px 10px', fontSize:9, fontWeight:600, background:'#2C2C2C', color:'#fff', border:'none', borderRadius:4, cursor:'pointer' }}>Create World Event</button>
            <button onClick={(e)=>{e.stopPropagation();if(confirm(`Delete "${ev.title}"?`))onDelete(ev.id);}} style={{ padding:'4px 10px', fontSize:9, fontWeight:600, background:'#fff', color:'#dc2626', border:'1px solid #fecaca', borderRadius:4, cursor:'pointer' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsTab({ events, loading, onCreateEvent, onDelete }) {
  const [calView, setCalView] = useState('city');
  const [expandedId, setExpandedId] = useState(null);

  const majorEvents = events.filter(e => !e.is_micro_event);
  const microEvents = events.filter(e => e.is_micro_event);

  const byMonth = useMemo(() => {
    const map = {}; MONTHS.forEach((_,i) => { map[i] = []; });
    majorEvents.forEach(ev => { const m = new Date(ev.start_datetime).getUTCMonth(); if (map[m]) map[m].push(ev); });
    return map;
  }, [majorEvents]);

  if (loading) return <div style={{ textAlign:'center', color:'#999', padding:40 }}>Loading events...</div>;

  return (
    <div>
      {/* Header: stats + view toggle */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:4 }}>
          {DREAM_CITIES.map(c => {
            const count = majorEvents.filter(ev => getCityForEvent(ev)?.key === c.key).length;
            return (
              <div key={c.key} style={{ textAlign:'center', padding:'6px 12px', background:c.color+'10', borderRadius:6, border:`1px solid ${c.color}20` }}>
                <div style={{ fontSize:16, fontWeight:900, color:c.color, fontFamily:"'DM Mono', monospace" }}>{c.letter}</div>
                <div style={{ fontSize:18, fontWeight:700, color:c.color }}>{count}</div>
              </div>
            );
          })}
          <div style={{ textAlign:'center', padding:'6px 12px', background:'#f8f8f8', borderRadius:6 }}>
            <div style={{ fontSize:10, color:'#888', fontFamily:"'DM Mono', monospace" }}>TOTAL</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#2C2C2C' }}>{events.length}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['city','month'].map(v => (
            <button key={v} onClick={() => setCalView(v)} style={{ padding:'5px 12px', fontSize:10, fontWeight:600, fontFamily:"'DM Mono', monospace", borderRadius:6, border:'1px solid #e8e0d0', background: calView===v ? '#2C2C2C' : '#fff', color: calView===v ? '#fff' : '#888', cursor:'pointer' }}>
              By {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* BY CITY */}
      {calView === 'city' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:24 }}>
          {DREAM_CITIES.map(city => {
            const cityEvents = majorEvents.filter(ev => getCityForEvent(ev)?.key === city.key);
            return (
              <div key={city.key}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, paddingBottom:6, borderBottom:`2px solid ${city.color}` }}>
                  <span style={{ fontSize:14 }}>{city.icon}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#2C2C2C' }}>{city.name}</div>
                    <div style={{ fontSize:9, color:'#999' }}>{cityEvents.length} events</div>
                  </div>
                </div>
                {cityEvents.length > 0 ? cityEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} city={city} expanded={expandedId===ev.id} onToggle={() => setExpandedId(expandedId===ev.id ? null : ev.id)} onCreateEvent={onCreateEvent} onDelete={onDelete} />
                )) : <div style={{ fontSize:10, color:'#ccc', padding:'8px 0' }}>No events yet</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* BY MONTH */}
      {calView === 'month' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:24 }}>
          {MONTHS.map((m, i) => (
            <div key={i} style={{ minHeight:80 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#2C2C2C', marginBottom:4, fontFamily:"'DM Mono', monospace" }}>{m}</div>
              {(byMonth[i]||[]).length > 0 ? (byMonth[i]||[]).map(ev => (
                <EventCard key={ev.id} ev={ev} city={getCityForEvent(ev)} expanded={expandedId===ev.id} onToggle={() => setExpandedId(expandedId===ev.id ? null : ev.id)} onCreateEvent={onCreateEvent} onDelete={onDelete} />
              )) : <div style={{ fontSize:10, color:'#ccc' }}>—</div>}
            </div>
          ))}
        </div>
      )}

      {/* MICRO EVENTS */}
      {microEvents.length > 0 && (
        <div>
          <div style={lbl}>MICRO EVENTS ({microEvents.length})</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:6 }}>
            {microEvents.map(ev => {
              const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
              const city = getCityForEvent(ev);
              return (
                <div key={ev.id} style={{ background:cat.bg, borderLeft:`2px solid ${city?.color || cat.border}`, borderRadius:6, padding:'8px 10px', fontSize:11 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontWeight:600 }}>{ev.title}</span>
                    {city && <span style={{ fontSize:8, fontWeight:700, color:city.color }}>{city.letter}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
