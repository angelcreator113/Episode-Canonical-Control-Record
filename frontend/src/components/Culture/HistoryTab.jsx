/**
 * HistoryTab — How the world remembers (merged Memory + Legacy)
 * Memory types, strength, archives, feuds, nostalgia, capsules, rankings
 */
import { useState, Fragment } from 'react';
import { MEMORY_TYPES, STRENGTH_LEVELS, ARCHIVES, LEGEND_PATHS, FEUD_STAGES, NOSTALGIA_WAVES, CAPSULE_TYPES, RANKING_METRICS } from '../../data/memoryData';

const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:12, marginBottom:6 };
const lbl = { fontSize:10, fontWeight:600, color:'#B8962E', fontFamily:"'DM Mono', monospace", marginBottom:6 };

const SECTIONS = [
  { key: 'how', label: 'How Memory Works' },
  { key: 'archives', label: 'Archives' },
  { key: 'legends', label: 'Legends & Feuds' },
  { key: 'nostalgia', label: 'Nostalgia & Capsules' },
];

export default function HistoryTab({ data }) {
  const [section, setSection] = useState('how');

  return (
    <div>
      {/* Intro */}
      <div style={{ background:'#FAF7F0', border:'1px solid #e8e0d0', borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#555', lineHeight:1.6 }}>
        <strong style={{ color:'#B8962E' }}>Memory is power.</strong> Who controls the archive controls the history. What gets remembered shapes what happens next. This tab defines how the LalaVerse processes its past.
      </div>

      {/* Section toggle */}
      <div style={{ display:'flex', gap:4, marginBottom:20 }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} style={{
            padding:'6px 14px', fontSize:10, fontWeight:600, fontFamily:"'DM Mono', monospace",
            borderRadius:6, border:'1px solid #e8e0d0', cursor:'pointer',
            background: section === s.key ? '#2C2C2C' : '#fff',
            color: section === s.key ? '#fff' : '#888',
          }}>{s.label}</button>
        ))}
      </div>

      {/* HOW MEMORY WORKS */}
      {section === 'how' && (
        <div>
          <div style={lbl}>MEMORY TYPES — What Gets Remembered</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:8, marginBottom:24 }}>
            {(data.MEMORY_TYPES || MEMORY_TYPES).map(m => (
              <div key={m.type} style={card}>
                <div style={{ fontSize:13, fontWeight:700 }}>{m.icon} {m.type}</div>
                <p style={{ fontSize:11, color:'#666', margin:'4px 0', lineHeight:1.4 }}>{m.created}</p>
                <div style={{ background:'#f8f7f4', borderRadius:6, padding:'6px 8px', marginTop:6 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>HOW IT'S REFERENCED</div>
                  <p style={{ fontSize:10, color:'#555', margin:'2px 0', fontStyle:'italic' }}>{m.referenced}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={lbl}>STRENGTH LEVELS — How Long It Lasts</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
            {(data.STRENGTH_LEVELS || STRENGTH_LEVELS).map(s => (
              <div key={s.level} style={{ ...card, borderTop:`3px solid ${s.color}`, textAlign:'center' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:s.color, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{s.level}</div>
                <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{s.name}</div>
                <div style={{ fontSize:10, color:s.color, fontWeight:600, marginTop:2 }}>{s.lifespan}</div>
                <p style={{ fontSize:10, color:'#666', margin:'6px 0 0', lineHeight:1.4 }}>{s.example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARCHIVES */}
      {section === 'archives' && (
        <div>
          <div style={lbl}>INSTITUTIONAL ARCHIVES — Who Controls the Record</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
            {(data.ARCHIVES || ARCHIVES).map(a => (
              <div key={a.name} style={{ ...card, borderLeft:`4px solid ${a.accent}` }}>
                <div style={{ fontSize:14, fontWeight:700, color:a.accent }}>{a.name}</div>
                <div style={{ fontSize:10, color:'#888', marginTop:2 }}>Maintained by: {a.maintained}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                  <div>
                    <div style={{ fontSize:9, fontWeight:600, color:'#16a34a' }}>WHAT IT TRACKS</div>
                    <p style={{ fontSize:10, color:'#666', margin:'2px 0', lineHeight:1.4 }}>{a.tracks}</p>
                  </div>
                  <div>
                    <div style={{ fontSize:9, fontWeight:600, color:'#dc2626' }}>WHAT IT LEAVES OUT</div>
                    <p style={{ fontSize:10, color:'#666', margin:'2px 0', lineHeight:1.4 }}>{a.leaves_out}</p>
                  </div>
                </div>
                <div style={{ background:'#f8f7f4', borderRadius:6, padding:'6px 8px', marginTop:8 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>WHO CONTROLS THE NARRATIVE</div>
                  <p style={{ fontSize:10, color:'#555', margin:'2px 0', fontStyle:'italic' }}>{a.control}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...lbl, marginTop:24 }}>INFLUENCE RANKINGS — How Impact Is Measured</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
            {(data.RANKING_METRICS || RANKING_METRICS).map(r => (
              <div key={r.metric} style={card}>
                <div style={{ fontSize:12, fontWeight:700 }}>{r.metric}</div>
                <p style={{ fontSize:10, color:'#666', margin:'4px 0' }}>{r.measures}</p>
                <div style={{ fontSize:9, color:'#888' }}>Measured by: {r.measured_by}</div>
                <div style={{ fontSize:9, color:'#dc2626', marginTop:4, fontStyle:'italic' }}>Misses: {r.misses}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEGENDS & FEUDS */}
      {section === 'legends' && (
        <div>
          <div style={lbl}>PATHS TO LEGENDARY STATUS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:24 }}>
            {(data.LEGEND_PATHS || LEGEND_PATHS).map(l => (
              <div key={l.path} style={card}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>{l.path}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1, background:'#e8f5e9', borderRadius:6, padding:6 }}>
                    <div style={{ fontSize:8, fontWeight:700, color:'#2e7d32' }}>REQUIRES</div>
                    <p style={{ fontSize:10, color:'#555', margin:'2px 0' }}>{l.requires}</p>
                  </div>
                  <div style={{ flex:1, background:'#ffebee', borderRadius:6, padding:6 }}>
                    <div style={{ fontSize:8, fontWeight:700, color:'#c62828' }}>COSTS</div>
                    <p style={{ fontSize:10, color:'#555', margin:'2px 0' }}>{l.costs}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={lbl}>HISTORICAL FEUDS — How Rivalries Evolve</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {(data.FEUD_STAGES || FEUD_STAGES).map((f, i, a) => (
              <Fragment key={f.stage}>
                <div style={{ ...card, borderTop:`3px solid ${f.color}`, flex:'1 1 180px', minWidth:180, marginBottom:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:f.color }}>{f.stage}</div>
                  <p style={{ fontSize:10, color:'#666', margin:'4px 0', lineHeight:1.4 }}>{f.looks}</p>
                  <div style={{ fontSize:9, color:'#888' }}>{f.attention}</div>
                </div>
                {i < a.length - 1 && <span style={{ fontSize:18, color:'#ccc' }}>→</span>}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* NOSTALGIA & CAPSULES */}
      {section === 'nostalgia' && (
        <div>
          <div style={lbl}>NOSTALGIA WAVES — When the Past Returns</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:24 }}>
            {(data.NOSTALGIA_WAVES || NOSTALGIA_WAVES).map(n => (
              <div key={n.type} style={card}>
                <div style={{ fontSize:13, fontWeight:700 }}>{n.type}</div>
                <p style={{ fontSize:10, color:'#666', margin:'4px 0', lineHeight:1.4 }}>{n.returns}</p>
                <div style={{ background:'#f8f7f4', borderRadius:6, padding:'6px 8px', marginTop:4 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>THE GAP</div>
                  <p style={{ fontSize:10, color:'#555', margin:'2px 0', fontStyle:'italic' }}>{n.gap}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={lbl}>TIME CAPSULES — Retrospectives That Rewrite History</div>
          {(data.CAPSULE_TYPES || CAPSULE_TYPES).map(c => (
            <div key={c.type} style={{ ...card, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700 }}>{c.type}</span>
                <span style={{ fontSize:9, color:'#888' }}>{c.made_by}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                <div style={{ background:'#e8f5e9', borderRadius:6, padding:6 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#2e7d32' }}>INCLUDED</div>
                  <p style={{ fontSize:10, color:'#555', margin:'2px 0' }}>{c.included}</p>
                </div>
                <div style={{ background:'#ffebee', borderRadius:6, padding:6 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#c62828' }}>LEFT OUT</div>
                  <p style={{ fontSize:10, color:'#555', margin:'2px 0' }}>{c.left_out}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
