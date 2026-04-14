/**
 * AwardsMediaTab — Awards, media outlets, algorithm, drama
 * The power structures that cover and amplify cultural events
 */
import React from 'react';
import { AWARD_SHOWS, GOSSIP_MEDIA, ALGORITHM_FORCES, DRAMA_MECHANICS } from '../../data/calendarData';

const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:12, marginBottom:6 };
const lbl = { fontSize:10, fontWeight:600, color:'#B8962E', fontFamily:"'DM Mono', monospace", marginBottom:6 };

export default function AwardsMediaTab({ data }) {
  return (
    <div>
      {/* Intro */}
      <div style={{ background:'#FAF7F0', border:'1px solid #e8e0d0', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:12, color:'#555', lineHeight:1.6 }}>
        <strong style={{ color:'#B8962E' }}>How events become stories:</strong> Award shows create momentum. Media outlets control the narrative. The algorithm decides who sees what. Drama mechanics drive engagement. Together, they determine which events matter and which get forgotten.
      </div>

      {/* AWARD SHOWS */}
      <div style={lbl}>AWARD SHOWS</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:28 }}>
        {(data.AWARD_SHOWS || AWARD_SHOWS).map(s => (
          <div key={s.name} style={{ ...card, borderTop:`3px solid ${s.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:15, fontWeight:700, color:s.color }}>{s.icon} {s.name}</span>
              <span style={{ fontSize:10, color:'#888', fontFamily:"'DM Mono', monospace" }}>{s.month}</span>
            </div>
            <p style={{ fontSize:11, color:'#666', margin:'6px 0 8px' }}>{s.desc}</p>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {s.categories.map(c => <span key={c} style={{ fontSize:9, padding:'2px 8px', background:s.color+'12', color:s.color, borderRadius:10, fontWeight:600 }}>{c}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* MEDIA OUTLETS */}
      <div style={lbl}>MEDIA OUTLETS — Who Controls the Narrative</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8, marginBottom:28 }}>
        {(data.GOSSIP_MEDIA || GOSSIP_MEDIA).map(m => (
          <div key={m.name} style={{ ...card, background:m.color.bg, borderBottom:`2px solid ${m.color.text}30` }}>
            <div style={{ fontSize:13, fontWeight:700, color:m.color.text }}>{m.name}</div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{m.focus}</div>
            <div style={{ fontSize:9, padding:'2px 6px', background:m.color.text+'15', color:m.color.text, borderRadius:3, display:'inline-block', marginTop:4, fontWeight:600 }}>{m.style}</div>
            <p style={{ fontSize:10, color:'#555', margin:'6px 0 0', fontStyle:'italic', lineHeight:1.4 }}>{m.power}</p>
          </div>
        ))}
      </div>

      {/* ALGORITHM + DRAMA side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div>
          <div style={lbl}>ALGORITHM FORCES</div>
          <p style={{ fontSize:11, color:'#666', marginBottom:8 }}>What determines visibility on the Feed.</p>
          {(data.ALGORITHM_FORCES || ALGORITHM_FORCES).map(f => (
            <div key={f.name} style={{ ...card, borderLeft:`3px solid ${f.color}` }}>
              <div style={{ fontSize:12, fontWeight:700 }}>{f.icon} {f.name}</div>
              <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{f.measuredBy}</div>
              <div style={{ fontSize:10, color:'#555', marginTop:4 }}>{f.effect}</div>
              <p style={{ fontSize:10, color:'#888', fontStyle:'italic', margin:'4px 0 0' }}>{f.storyHook}</p>
            </div>
          ))}
        </div>
        <div>
          <div style={lbl}>DRAMA MECHANICS</div>
          <p style={{ fontSize:11, color:'#666', marginBottom:8 }}>What drives viral engagement.</p>
          {(data.DRAMA_MECHANICS || DRAMA_MECHANICS).map(d => (
            <div key={d.type} style={{ ...card, borderLeft:`3px solid ${d.color}` }}>
              <div style={{ fontSize:12, fontWeight:700 }}>{d.icon} {d.type}</div>
              <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{d.trigger}</div>
              <div style={{ fontSize:10, color:'#555', marginTop:4 }}>{d.feedEffect}</div>
              <p style={{ fontSize:10, color:'#888', fontStyle:'italic', margin:'4px 0 0' }}>{d.storyThread}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
