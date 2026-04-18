/**
 * SocialSystems — Archetypes + Legends/Society + Rules + Trends
 * Merges: InfluencerSystems + Legends from Infrastructure + Society from Calendar
 */
import { useState, Fragment } from 'react';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';
import PushToBrain from '../components/PushToBrain';
import { ARCHETYPES, RELATIONSHIP_TYPES, ECONOMY_STREAMS, FASHION_TREND_STAGES, BEAUTY_TREND_STAGES, MOMENTUM_WAVES, INFLUENCE_FORCES, LEGACY_SIGNALS, INFLUENCER_DEFAULTS } from '../data/influencerData';
import { CELEBRITY_HIERARCHY, FASHION_TIERS, BEAUTY_TIERS, ALGORITHM_FORCES, DRAMA_MECHANICS, GOSSIP_MEDIA, FAMOUS_CHARACTERS, AWARD_SHOWS, CALENDAR_DEFAULTS } from '../data/calendarData';

const LEGENDARY_GROUPS = [
  { group: 'Fashion Icons', icon: '👗', color: '#d4789a', roles: [
    { role: 'The Style Queen', fn: 'Defines what is fashionable this season', signature: 'Her opinion reshapes the Feed overnight' },
    { role: 'Dazzle Muse', fn: 'The living embodiment of Dazzle District\'s aesthetic', signature: 'Every Dazzle Season moment is built around her' },
    { role: 'The Runway Architect', fn: 'Designs the shows that define the Atelier Circuit', signature: 'Their runway is the reference point for the year' },
    { role: 'Street Style Sovereign', fn: 'Bridges street style and high fashion', signature: 'Discovered at Style Market, now front row at every show' },
    { role: 'The Fashion Archivist', fn: 'Documents and preserves fashion history', signature: 'The ultimate authority on what actually happened' },
  ]},
  { group: 'Beauty Legends', icon: '✨', color: '#a889c8', roles: [
    { role: 'The Glow Guru', fn: 'Defines beauty standards — recommendations sell out in hours', signature: 'The beauty world waits for her review' },
    { role: 'Skin Scientist', fn: 'Makes skincare evidence-based and aspirational', signature: 'Translates beauty lab science into the Feed\'s language' },
    { role: 'The Makeup Oracle', fn: 'Predicts beauty trends before they surface', signature: 'The look she posts in January becomes March\'s trend' },
    { role: 'Lash Empress', fn: 'Rules the lash and eye beauty space', signature: 'Started in Radiance Row salons' },
    { role: 'The Aesthetic Alchemist', fn: 'Combines beauty, fashion, and art', signature: 'Impossible to copy because the source is interior life' },
  ]},
  { group: 'Creator Economy', icon: '💰', color: '#c9a84c', roles: [
    { role: 'The Creator King', fn: 'Represents success culture', signature: 'Every Dream Market launch is compared to his' },
    { role: 'The Digital Mogul', fn: 'Built an empire from content', signature: 'The creator who became a corporation' },
    { role: 'The Brand Builder', fn: 'Turns creator identity into brand equity', signature: 'The difference between creator and business, visible' },
    { role: 'The Collab Queen', fn: 'Creates partnerships nobody saw coming', signature: 'Her collab announcements trend before the product exists' },
    { role: 'The Community Architect', fn: 'Built the most loyal audience', signature: 'Her community is a movement, not a following' },
  ]},
  { group: 'Entertainment Stars', icon: '🎤', color: '#b89060', roles: [
    { role: 'The Viral Comedian', fn: 'Makes the platform laugh', signature: 'The meme that defined the year was hers' },
    { role: 'The Music Architect', fn: 'Builds sonic worlds, not just songs', signature: 'Her sound lives in half the Feed\'s content' },
    { role: 'The Nightlife Queen', fn: 'Controls what happens after midnight', signature: 'Her guest list is the event' },
    { role: 'The Performance Icon', fn: 'Elevates creator content to performance art', signature: 'Live videos feel like theater' },
    { role: 'The Stage Rebel', fn: 'Breaks every entertainment convention', signature: 'The performance nobody can explain' },
  ]},
  { group: 'Lifestyle', icon: '🌿', color: '#6bba9a', roles: [
    { role: 'The Travel Queen', fn: 'Makes the world accessible and aspirational', signature: 'Her location tags become destinations' },
    { role: 'The Fitness Titan', fn: 'Physical transformation as identity', signature: 'The workout that trended' },
    { role: 'The Wellness Prophet', fn: 'Counter-narrative to hustle culture', signature: 'Permission structure for a generation' },
    { role: 'The Food Visionary', fn: 'Food as culture, not just content', signature: 'The recipe that became a cultural moment' },
    { role: 'The Adventure Creator', fn: 'Makes risk look beautiful', signature: 'Content nobody else would make' },
  ]},
  { group: 'Commentators', icon: '📝', color: '#7ab3d4', roles: [
    { role: 'The Culture Analyst', fn: 'Makes sense of what\'s happening in real time', signature: 'Analysis drops within hours — always definitive' },
    { role: 'The Trend Oracle', fn: 'Predicts cultural shifts — always right, always cryptic', signature: 'The post from six months ago that predicted this' },
    { role: 'The Social Philosopher', fn: 'Asks questions the platform avoids', signature: 'The thread that stopped the Feed' },
    { role: 'The Media Critic', fn: 'Holds media networks accountable', signature: 'The only creator gossip outlets fear' },
    { role: 'The Gossip Empress', fn: 'Knows everything, shares strategically', signature: 'She knew before the announcement' },
  ]},
  { group: 'Visionaries', icon: '🎨', color: '#d4789a', roles: [
    { role: 'The Art Visionary', fn: 'Makes the platform take beauty seriously', signature: 'Made people forget they were on social media' },
    { role: 'The Photography Legend', fn: 'Documents LalaVerse', signature: 'The image that became the year\'s icon' },
    { role: 'The Design Genius', fn: 'Solves problems beautifully', signature: 'The product that felt inevitable' },
    { role: 'The Storytelling Master', fn: 'Makes content feel like literature', signature: 'The series everyone finished in one sitting' },
    { role: 'The Visual Poet', fn: 'Creates images that operate like poetry', signature: 'One post, everyone had a different interpretation' },
  ]},
  { group: 'Rising Icons', icon: '🚀', color: '#c9a84c', roles: [
    { role: 'The Breakout Creator', fn: 'The name everyone learned this year', signature: 'Unknown in January. Nominee in November.' },
    { role: 'The New Wave Designer', fn: 'Bringing the next aesthetic', signature: 'Style Market discovery. Atelier Circuit in two years.' },
    { role: 'The Beauty Prodigy', fn: 'Doing things that shouldn\'t be possible at her age', signature: 'Found during Glow Week' },
    { role: 'The Street Innovator', fn: 'Rewriting what street style means', signature: 'The look everyone copied' },
    { role: 'The Viral Wildcard', fn: 'Nobody predicted her', signature: 'The post that broke the Feed. Twice.' },
  ]},
  { group: 'Cultural Legends', icon: '🏆', color: '#a889c8', roles: [
    { role: 'The Legacy Builder', fn: 'Everything she built outlasted the platforms', signature: 'The creator other creators cite' },
    { role: 'The Creator Mentor', fn: 'Grows other creators — legacy through multiplication', signature: 'Her roster is longer than most brand portfolios' },
    { role: 'The Platform Pioneer', fn: 'Was there before the platform was what it is', signature: 'Posts from before the algorithm knew what to do' },
    { role: 'The Trend Historian', fn: 'Documents where trends actually came from', signature: 'The correction post that credited the right person' },
    { role: 'The Culture Keeper', fn: 'Preserves what LalaVerse was', signature: 'The archive that breaks hearts when found' },
  ]},
  { group: 'Global Icons', icon: '🌐', color: '#6bba9a', roles: [
    { role: 'The Digital Empress', fn: 'Operates across every platform — omnipresent', signature: 'Exists everywhere and loses nothing in translation' },
    { role: 'The Internet Prince', fn: 'Male cultural icon who transcends categories', signature: 'His aesthetic is referenced by every tier' },
    { role: 'The Fashion Empress', fn: 'Total fashion authority', signature: 'When she and the Style Queen agree, the trend is over' },
    { role: 'The Glow Queen', fn: 'Total beauty authority', signature: 'The face and the formula. Both.' },
    { role: 'The Creator Icon', fn: 'What a creator can become in LalaVerse', signature: 'The answer to what this platform makes possible' },
  ]},
];

const TABS = [
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'legends', label: 'Legends & Society' },
  { key: 'rules', label: 'Social Rules' },
  { key: 'trends', label: 'Trends' },
];

const tb = (a) => ({ padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:"'DM Mono', monospace", background: a?'#2C2C2C':'transparent', color: a?'#fff':'#888', border:'none', borderRadius:'6px 6px 0 0', cursor:'pointer' });
const card = { background:'#fff', border:'1px solid #eee', borderRadius:8, padding:14, marginBottom:8 };
const lbl = { fontSize:10, fontWeight:600, color:'#B8962E', fontFamily:"'DM Mono', monospace", marginBottom:6 };

export default function SocialSystems() {
  const [tab, setTab] = useState('archetypes');
  const [editItem, setEditItem] = useState(null);
  const { data: isData, updateItem: isUpdate, addItem: isAdd, removeItem: isRemove, saving: isSaving } = usePageData('influencer_systems', INFLUENCER_DEFAULTS);
  const { data: ccData, updateItem: ccUpdate, addItem: ccAdd, removeItem: ccRemove, saving: ccSaving } = usePageData('cultural_calendar', CALENDAR_DEFAULTS);
  const [openLegend, setOpenLegend] = useState('Fashion Icons');
  const [expandedArch, setExpandedArch] = useState(null);

  const saving = isSaving || ccSaving;

  return (
    <PageEditContext.Provider value={{ data: tab === 'legends' ? { ...isData, ...ccData, LEGENDARY_GROUPS } : isData, setEditItem, removeItem: isRemove }}>
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', margin:0 }}>Social Systems</h1>
          <p style={{ fontSize:12, color:'#888', margin:'4px 0 0' }}>Archetypes, legends, relationships, economy, trends — the rules of the LalaVerse</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {saving && <span style={{ fontSize:11, color:'#B8962E' }}>Saving...</span>}
          <PushToBrain pageName="influencer_systems" data={isData} />
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e8e0d0' }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tb(tab===t.key)}>{t.label}</button>)}
      </div>

      {/* ARCHETYPES */}
      {tab === 'archetypes' && (
        <div>
          <p style={{ fontSize:12, color:'#666', marginBottom:16, lineHeight:1.5 }}>Every major creator tends to fall into one of these 15 patterns. The tension between two archetypes in the same person is often the story.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
            {(isData.ARCHETYPES || ARCHETYPES).map(a => (
              <div key={a.num} onClick={() => setExpandedArch(expandedArch===a.num ? null : a.num)} style={{ ...card, borderTop:`3px solid ${a.color}`, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:a.color, fontFamily:"'DM Mono', monospace", fontWeight:700 }}>{a.num}</span>
                  <span style={{ fontSize:16 }}>{a.icon}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginTop:4 }}>{a.name}</div>
                <p style={{ fontSize:11, color:'#666', margin:'4px 0 0', lineHeight:1.4 }}>{a.content}</p>
                {expandedArch === a.num && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #f0f0f0' }}>
                    <div style={{ fontSize:10, color:'#B8962E', fontWeight:600 }}>AUDIENCE EFFECT</div>
                    <p style={{ fontSize:11, color:'#555', margin:'2px 0 6px' }}>{a.audience}</p>
                    <div style={{ fontSize:10, color:'#B8962E', fontWeight:600 }}>NARRATIVE FUNCTION</div>
                    <p style={{ fontSize:11, color:'#555', margin:'2px 0 0', fontStyle:'italic' }}>{a.narrative}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEGENDS & SOCIETY */}
      {tab === 'legends' && (
        <div>
          {/* 50 Legends */}
          <div style={lbl}>THE 50 LEGENDARY INFLUENCERS</div>
          <p style={{ fontSize:12, color:'#666', marginBottom:12 }}>The most powerful cultural figures in LalaVerse. All placeholders — names assigned through Character Registry.</p>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
            {LEGENDARY_GROUPS.map(g => (
              <button key={g.group} onClick={() => setOpenLegend(g.group)} style={{ padding:'4px 10px', fontSize:10, borderRadius:12, border:`1px solid ${openLegend===g.group ? g.color : '#e8e0d0'}`, background:openLegend===g.group ? g.color+'15' : '#fff', color:openLegend===g.group ? g.color : '#666', cursor:'pointer', fontWeight:600 }}>
                {g.icon} {g.group}
              </button>
            ))}
          </div>
          {LEGENDARY_GROUPS.filter(g => g.group === openLegend).map(g => (
            <div key={g.group} style={{ display:'grid', gap:6 }}>
              {g.roles.map(r => (
                <div key={r.role} style={{ ...card, borderLeft:`3px solid ${g.color}` }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{r.role} <span style={{ fontSize:10, color:'#aaa' }}>[placeholder]</span></div>
                  <p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{r.fn}</p>
                  <p style={{ fontSize:11, color:'#888', fontStyle:'italic', margin:0 }}>"{r.signature}"</p>
                </div>
              ))}
            </div>
          ))}

          {/* Celebrity Hierarchy */}
          <div style={{ ...lbl, marginTop:28 }}>CELEBRITY HIERARCHY</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8 }}>
            {(ccData.CELEBRITY_HIERARCHY || CELEBRITY_HIERARCHY).map(h => (
              <div key={h.tier} style={{ ...card, borderTop:`3px solid ${h.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:h.color }}>Tier {h.tier}</span>
                  <span style={{ fontSize:10, color:'#888' }}>{h.followers}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:700, marginTop:2 }}>{h.name}</div>
                <p style={{ fontSize:10, color:'#666', margin:'4px 0 0', lineHeight:1.4 }}>{h.desc}</p>
              </div>
            ))}
          </div>

          {/* Famous 25 */}
          <div style={{ ...lbl, marginTop:28 }}>THE 25 MOST FAMOUS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:6 }}>
            {(ccData.FAMOUS_CHARACTERS || FAMOUS_CHARACTERS).map(c => (
              <div key={c.rank} style={{ ...card, borderTop:`2px solid ${c.color}`, padding:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:c.color }}>#{c.rank}</span>
                  <span style={{ fontSize:14 }}>{c.icon}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:700, marginTop:2 }}>{c.title}</div>
                <p style={{ fontSize:10, color:'#666', margin:'2px 0 0' }}>{c.role}</p>
              </div>
            ))}
          </div>

          {/* Media Outlets */}
          <div style={{ ...lbl, marginTop:28 }}>GOSSIP MEDIA NETWORKS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
            {(ccData.GOSSIP_MEDIA || GOSSIP_MEDIA).map(m => (
              <div key={m.name} style={{ ...card, background:m.color.bg }}>
                <div style={{ fontSize:13, fontWeight:700, color:m.color.text }}>{m.name}</div>
                <div style={{ fontSize:10, color:'#888' }}>{m.focus} · {m.style}</div>
                <p style={{ fontSize:11, color:'#555', margin:'4px 0', lineHeight:1.4 }}>{m.covers}</p>
                <p style={{ fontSize:10, color:'#666', fontStyle:'italic', margin:0 }}>{m.power}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOCIAL RULES */}
      {tab === 'rules' && (
        <div>
          <div style={lbl}>RELATIONSHIP TYPES</div>
          {(isData.RELATIONSHIP_TYPES || RELATIONSHIP_TYPES).map(r => (
            <div key={r.type} style={{ ...card, borderLeft:`3px solid ${r.color}` }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{r.icon} {r.type}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
                <div><div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>LOOKS LIKE</div><p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{r.looksLike}</p></div>
                <div><div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>CREATES</div><p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{r.creates}</p></div>
                <div><div style={{ fontSize:9, fontWeight:600, color:'#B8962E' }}>BREAKS</div><p style={{ fontSize:11, color:'#666', margin:'2px 0' }}>{r.breaks}</p></div>
              </div>
              <p style={{ fontSize:11, color:'#888', fontStyle:'italic', marginTop:6 }}>{r.storyBreaks}</p>
            </div>
          ))}

          <div style={{ ...lbl, marginTop:28 }}>CREATOR ECONOMY</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
            {(isData.ECONOMY_STREAMS || ECONOMY_STREAMS).map(e => (
              <div key={e.stream} style={{ ...card, borderTop:`3px solid ${e.color}` }}>
                <div style={{ fontSize:16 }}>{e.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, marginTop:2 }}>{e.stream}</div>
                <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{e.what}</p>
                <div style={{ fontSize:10, color:'#888' }}>{e.who}</div>
                <p style={{ fontSize:10, color:'#555', fontStyle:'italic', margin:'4px 0 0' }}>{e.narrative}</p>
              </div>
            ))}
          </div>

          <div style={{ ...lbl, marginTop:28 }}>INFLUENCE FORCES</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
            {(isData.INFLUENCE_FORCES || INFLUENCE_FORCES).map(f => (
              <div key={f.force} style={{ ...card, borderTop:`3px solid ${f.color}` }}>
                <div style={{ fontSize:20, color:f.color }}>{f.icon}</div>
                <div style={{ fontSize:13, fontWeight:700, marginTop:2 }}>{f.force}</div>
                <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{f.definition}</p>
                <div style={{ fontSize:9, fontWeight:600, color:'#16a34a' }}>BUILT BY: <span style={{ fontWeight:400, color:'#666' }}>{f.built}</span></div>
                <div style={{ fontSize:9, fontWeight:600, color:'#dc2626', marginTop:2 }}>DESTROYED BY: <span style={{ fontWeight:400, color:'#666' }}>{f.destroys}</span></div>
              </div>
            ))}
          </div>

          <div style={{ ...lbl, marginTop:28 }}>LEGACY SIGNALS</div>
          {(isData.LEGACY_SIGNALS || LEGACY_SIGNALS).map(l => (
            <div key={l.signal} style={{ ...card, borderLeft:`3px solid ${l.color}` }}>
              <div style={{ fontSize:13, fontWeight:700 }}>{l.icon} {l.signal}</div>
              <p style={{ fontSize:11, color:'#666', margin:'4px 0' }}>{l.looksLike}</p>
              <p style={{ fontSize:11, color:'#888', fontStyle:'italic', margin:0 }}>{l.story}</p>
            </div>
          ))}
        </div>
      )}

      {/* TRENDS */}
      {tab === 'trends' && (
        <div>
          <div style={lbl}>FASHION TREND ENGINE — 5 STAGES</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {(isData.FASHION_TREND_STAGES || FASHION_TREND_STAGES).map((s, i, a) => (
              <Fragment key={s.stage}>
                <div style={{ ...card, borderTop:`3px solid ${s.color}`, flex:'1 1 140px', minWidth:140 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:s.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{s.stage}</div>
                  <div style={{ fontSize:12, fontWeight:700, marginTop:4 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{s.who}</div>
                  <p style={{ fontSize:10, color:'#555', fontStyle:'italic', margin:'4px 0 0' }}>{s.story}</p>
                </div>
                {i < a.length - 1 && <span style={{ fontSize:18, color:'#ccc' }}>→</span>}
              </Fragment>
            ))}
          </div>

          <div style={lbl}>BEAUTY TREND ENGINE — 4 STAGES</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            {(isData.BEAUTY_TREND_STAGES || BEAUTY_TREND_STAGES).map((s, i, a) => (
              <Fragment key={s.stage}>
                <div style={{ ...card, borderTop:`3px solid ${s.color}`, flex:'1 1 160px', minWidth:160 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:s.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{s.stage}</div>
                  <div style={{ fontSize:12, fontWeight:700, marginTop:4 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{s.where}</div>
                  <p style={{ fontSize:10, color:'#555', fontStyle:'italic', margin:'4px 0 0' }}>{s.story}</p>
                </div>
                {i < a.length - 1 && <span style={{ fontSize:18, color:'#ccc' }}>→</span>}
              </Fragment>
            ))}
          </div>

          <div style={lbl}>MOMENTUM WAVES</div>
          {(isData.MOMENTUM_WAVES || MOMENTUM_WAVES).map(m => (
            <div key={m.event} style={{ ...card, borderLeft:`3px solid ${m.color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700 }}>{m.icon} {m.event}</span>
                <span style={{ fontSize:10, color:m.color }}>{m.duration}</span>
              </div>
              <div style={{ fontSize:11, color:'#666', marginTop:4 }}>{m.feedEffect}</div>
              <p style={{ fontSize:11, color:'#888', fontStyle:'italic', margin:'4px 0 0' }}>{m.permanent}</p>
            </div>
          ))}

          <div style={{ ...lbl, marginTop:28 }}>ALGORITHM & DRAMA</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:6 }}>ALGORITHM FORCES</div>
              {(ccData.ALGORITHM_FORCES || ALGORITHM_FORCES).map(f => (
                <div key={f.name} style={{ ...card, borderTop:`2px solid ${f.color}`, padding:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{f.icon} {f.name}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{f.measuredBy}</div>
                  <p style={{ fontSize:10, color:'#555', fontStyle:'italic', margin:'2px 0 0' }}>{f.storyHook}</p>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:6 }}>DRAMA MECHANICS</div>
              {(ccData.DRAMA_MECHANICS || DRAMA_MECHANICS).map(d => (
                <div key={d.type} style={{ ...card, borderLeft:`2px solid ${d.color}`, padding:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{d.icon} {d.type}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{d.trigger}</div>
                  <p style={{ fontSize:10, color:'#555', fontStyle:'italic', margin:'2px 0 0' }}>{d.storyThread}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editItem && <EditItemModal item={editItem.item} title={`Edit ${editItem.key}`} onSave={(updated) => { if (editItem.index === -1) isAdd(editItem.key, updated); else isUpdate(editItem.key, editItem.index, updated); setEditItem(null); }} onCancel={() => setEditItem(null)} />}
    </div>
    </PageEditContext.Provider>
  );
}
