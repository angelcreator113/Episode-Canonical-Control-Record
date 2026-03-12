import React, { useState } from 'react';
import './WorldInfrastructure.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';

/* ═══════════════════════════════════════════════════
   DATA CONSTANTS — Doc 04 · v1.0
   ═══════════════════════════════════════════════════ */

const CITIES = [
  { name: 'Velvet City',    icon: '🏛️', capitalOf: 'Fashion',            color: '#d4789a', famousFor: 'Couture houses, runway shows, designer studios, high-end boutiques',                majorEvents: ['Velvet Season', 'Atelier Circuit'],              whoLivesHere: 'Designers, stylists, fashion photographers, luxury influencers',               energy: 'Elegant, high-status, trend-setting. Every sidewalk is a runway.' },
  { name: 'Glow District',  icon: '✨', capitalOf: 'Beauty',             color: '#a889c8', famousFor: 'Skincare labs, salons, beauty schools, product launch spaces',                     majorEvents: ['Glow Week', 'Glow Honors Awards'],               whoLivesHere: 'Makeup artists, skincare experts, beauty founders, lash and nail artists',     energy: 'Experimental, aesthetic, transformation culture. Reinvention is the local religion.' },
  { name: 'Pulse City',     icon: '🎵', capitalOf: 'Entertainment',      color: '#c9a84c', famousFor: 'Music studios, comedy clubs, creator houses, nightlife venues',                     majorEvents: ['Neon Nights', 'Soundwave Nights'],               whoLivesHere: 'Musicians, comedians, entertainers, party influencers',                        energy: 'Chaotic, loud, viral culture. Something happens here that becomes a meme by morning.' },
  { name: 'Creator Harbor', icon: '⚓', capitalOf: 'Influencer culture', color: '#7ab3d4', famousFor: 'Creator studios, content houses, podcast networks, collab spaces',                  majorEvents: ['Creator Camp', 'Creator Cruise departures'],     whoLivesHere: 'Influencers, vloggers, digital entrepreneurs, talent managers',                energy: 'Collaborative, entrepreneurial. The city that runs on content and deals.' },
  { name: 'Horizon City',   icon: '🔮', capitalOf: 'Tech and startups',  color: '#6bba9a', famousFor: 'Digital platforms, creator economy tools, startup founders, incubators',             majorEvents: ['Dream Market', 'Trend Summit'],                  whoLivesHere: 'Developers, entrepreneurs, product designers, platform architects',            energy: 'Futuristic, ambitious. The city building the tools everyone else uses.' },
];

const UNIVERSITIES = [
  { name: 'The Velvet Academy',       city: 'Velvet City',    icon: '🎓', color: '#d4789a', specialization: "World's top fashion school",           programs: ['Fashion design', 'Styling', 'Fashion photography', 'Fashion journalism'],                      significance: 'Graduates often debut during the Atelier Circuit. A Velvet Academy degree is a Tier 1 credential.' },
  { name: 'The Glow Institute',       city: 'Glow District',  icon: '🔬', color: '#a889c8', specialization: 'Most prestigious beauty academy',      programs: ['Makeup artistry', 'Skincare science', 'Cosmetic formulation', 'Aesthetic treatments'],         significance: 'Graduates dominate Glow Week. The Glow Institute and the beauty industry are inseparable.' },
  { name: 'The Creator Conservatory', city: 'Creator Harbor', icon: '🎬', color: '#7ab3d4', specialization: 'Content creation and media',           programs: ['Storytelling', 'Video production', 'Social media strategy', 'Branding'],                      significance: 'The school that legitimized being a creator. Graduates become influencers who cite it.' },
  { name: 'Horizon Tech Institute',   city: 'Horizon City',   icon: '💻', color: '#6bba9a', specialization: 'Technology and innovation',             programs: ['Digital product design', 'Social platform engineering', 'AI and media tools'],                 significance: 'Many founders of major LalaVerse platforms came from here. The architecture of the world.' },
];

const CORPORATIONS = [
  { name: 'Velvet House',            icon: '👗', industry: 'Luxury fashion',    color: '#d4789a', knownFor: 'Couture collections, high-status events, collaborations with top creators',    power: 'Controls what high fashion means. Who they invite to shows is a power signal.',                                    storyPotential: 'The creator Velvet House ignores. The designer they finally recognize. The collaboration that changes everything.' },
  { name: 'Glow Labs',               icon: '🧪', industry: 'Beauty',           color: '#a889c8', knownFor: 'Skincare breakthroughs, viral beauty products, innovation-first positioning',   power: 'Makes beauty credible. Their product recommendations become canon.',                                               storyPotential: 'The formula that went wrong. The creator they dropped. The product that made a career.' },
  { name: 'Nova Studios',            icon: '🎬', industry: 'Entertainment',    color: '#c9a84c', knownFor: 'Creator shows, music projects, comedy series, content production',             power: 'Produces the content that defines the entertainment tier of LalaVerse.',                                           storyPotential: "The deal that changed a creator's trajectory. The show they cancelled. The artist they made." },
  { name: 'Dream Market Collective', icon: '🏪', industry: 'Creator economy',  color: '#7ab3d4', knownFor: 'Digital shops, creator launches, marketplace infrastructure',                  power: 'The platform creators use to sell. They take a cut of everything.',                                                storyPotential: 'The fee increase nobody announced. The creator who built around them and then had to leave.' },
  { name: 'Pulse Media Network',     icon: '📡', industry: 'Talent and media', color: '#b89060', knownFor: 'Talent management, influencer partnerships, brand matchmaking',                 power: 'The middleman between creators and brands. Enormous invisible power.',                                             storyPotential: 'The contract clause nobody read. The creator who left and went independent. The manager who knew too much.' },
];

const LEGENDARY_GROUPS = [
  {
    group: 'Fashion Icons', icon: '👗', color: '#d4789a',
    roles: [
      { role: 'The Style Queen',       fn: 'Defines what is fashionable this season and what is over',                      signature: 'Her opinion reshapes the Feed overnight' },
      { role: 'Velvet Muse',           fn: "The living embodiment of Velvet City's aesthetic",                               signature: 'Every Velvet Season moment is built around her presence or absence' },
      { role: 'The Runway Architect',  fn: 'Designs the shows that define the Atelier Circuit',                             signature: 'Their runway is the reference point for the year' },
      { role: 'Street Style Sovereign', fn: 'Bridges street style and high fashion',                                        signature: 'Discovered at Style Market, now front row at every show' },
      { role: 'The Fashion Archivist', fn: 'Documents and preserves fashion history in LalaVerse',                          signature: 'The ultimate authority on what actually happened vs. what people remember' },
    ],
  },
  {
    group: 'Beauty Legends', icon: '✨', color: '#a889c8',
    roles: [
      { role: 'The Glow Guru',         fn: 'Defines beauty standards — her recommendations sell out in hours',              signature: 'The beauty world waits for her review before celebrating a launch' },
      { role: 'Skin Scientist',         fn: 'Makes skincare evidence-based and aspirational simultaneously',                signature: "Translates beauty lab science into the Feed's language" },
      { role: 'The Makeup Oracle',      fn: 'Predicts beauty trends before they surface publicly',                          signature: 'The look she posts in January becomes the look everyone does in March' },
      { role: 'Lash Empress',           fn: 'Rules the lash and eye beauty space absolutely',                               signature: 'Started in Glow District salons — the Velvet Academy equivalent in beauty' },
      { role: 'The Aesthetic Alchemist', fn: 'Combines beauty, fashion, and art into a singular visual language',           signature: 'Impossible to copy because the source is a specific interior life' },
    ],
  },
  {
    group: 'Creator Economy Leaders', icon: '💰', color: '#c9a84c',
    roles: [
      { role: 'The Creator King',       fn: 'Represents success culture — entrepreneurs model themselves on him',           signature: 'Every Dream Market launch is compared to his first product drop' },
      { role: 'The Digital Mogul',       fn: "Built an empire from content — the proof that it's possible",                  signature: 'The creator who became a corporation' },
      { role: 'The Brand Builder',       fn: 'Turns creator identity into lasting brand equity',                             signature: 'The difference between a creator and a business, made visible' },
      { role: 'The Collaboration Queen', fn: 'Creates win-win partnerships nobody else saw coming',                          signature: 'Her collab announcements trend before the product exists' },
      { role: 'The Community Architect', fn: 'Built the most loyal audience in LalaVerse',                                   signature: 'Her community is a movement, not a following' },
    ],
  },
  {
    group: 'Entertainment Stars', icon: '🎤', color: '#b89060',
    roles: [
      { role: 'The Viral Comedian',   fn: "Makes the platform laugh — laughter is its own kind of power",                   signature: 'The meme that defined the year was hers' },
      { role: 'The Music Architect',  fn: 'Builds sonic worlds, not just songs',                                             signature: "Her sound lives in the background of half the Feed's content" },
      { role: 'The Nightlife Queen',  fn: 'Controls what happens after midnight in LalaVerse',                               signature: 'Her guest list is the event' },
      { role: 'The Performance Icon', fn: 'Elevates creator content to performance art',                                     signature: 'The only creator whose live videos feel like theater' },
      { role: 'The Stage Rebel',      fn: 'Breaks every entertainment convention and gets celebrated for it',                signature: 'The performance everyone talks about that nobody can explain' },
    ],
  },
  {
    group: 'Lifestyle Influencers', icon: '🌿', color: '#6bba9a',
    roles: [
      { role: 'The Travel Queen',     fn: 'Makes the world feel accessible and aspirational simultaneously',                 signature: 'Her location tags become destinations' },
      { role: 'The Fitness Titan',    fn: 'Physical transformation as identity — the body as a project',                     signature: 'The workout that trended. The physique that became a goal.' },
      { role: 'The Wellness Prophet', fn: 'The counter-narrative to hustle culture — rest as resistance',                    signature: 'Permission structure for an entire generation' },
      { role: 'The Food Visionary',   fn: 'Food as culture, not just content — elevates the everyday',                       signature: 'The recipe that became a cultural moment' },
      { role: 'The Adventure Creator', fn: 'Makes risk look beautiful — extreme experiences as lifestyle content',           signature: 'The content nobody else would make because they were afraid' },
    ],
  },
  {
    group: 'Cultural Commentators', icon: '📝', color: '#7ab3d4',
    roles: [
      { role: 'The Culture Analyst',    fn: "Makes sense of what's happening in real time",                                  signature: 'Her analysis drops within hours of any major event — always definitive' },
      { role: 'The Trend Oracle',       fn: 'Predicts cultural shifts before they happen — always right, always cryptic',    signature: 'The post from six months ago that predicted exactly this' },
      { role: 'The Social Philosopher', fn: 'Asks the questions the platform usually avoids',                                signature: 'The thread that stopped the Feed for a day' },
      { role: 'The Media Critic',       fn: 'Holds the media networks accountable — including Whisper Wire',                 signature: 'The only creator the gossip outlets are afraid of' },
      { role: 'The Gossip Empress',     fn: 'Knows everything — shares it strategically, never wrong',                       signature: 'She knew before the announcement. She always knows.' },
    ],
  },
  {
    group: 'Creative Visionaries', icon: '🎨', color: '#d4789a',
    roles: [
      { role: 'The Art Visionary',       fn: 'Makes the platform take beauty seriously as an intellectual pursuit',          signature: 'The piece that made people forget they were on social media' },
      { role: 'The Photography Legend',  fn: 'Documents LalaVerse — everything important is in their archive',               signature: "The image from the Atelier Circuit that became the year's icon" },
      { role: 'The Design Genius',       fn: 'Solves problems beautifully — aesthetics and function together',               signature: 'The product that felt inevitable after she made it' },
      { role: 'The Storytelling Master', fn: 'Narrative above everything — makes content feel like literature',               signature: 'The series that everyone finished in one sitting' },
      { role: 'The Visual Poet',         fn: 'Creates images and videos that operate like poetry — compressed meaning',      signature: 'One post. Everyone had a different interpretation. All of them were right.' },
    ],
  },
  {
    group: 'Rising Icons', icon: '🚀', color: '#c9a84c',
    roles: [
      { role: 'The Breakout Creator',   fn: 'The name everyone learned this year',                                           signature: 'Unknown in January. Starlight Award nominee in November.' },
      { role: 'The New Wave Designer',  fn: 'Bringing the next aesthetic before the industry catches up',                    signature: 'Style Market discovery. Atelier Circuit in two years.' },
      { role: 'The Beauty Prodigy',     fn: "Doing things in beauty that shouldn't be possible at her age",                  signature: "Found during Glow Week. The Glow Gazette couldn't stop writing about her." },
      { role: 'The Street Innovator',   fn: 'Rewriting what street style means right now',                                   signature: 'The look everyone copied. She was already wearing something else.' },
      { role: 'The Viral Wildcard',     fn: "Nobody predicted her. Nobody can predict what she'll do next.",                  signature: 'The post that broke the Feed. Twice.' },
    ],
  },
  {
    group: 'Cultural Legends', icon: '🏆', color: '#a889c8',
    roles: [
      { role: 'The Legacy Builder',  fn: 'Everything she built outlasted the platforms it was built on',                     signature: 'The creator other creators cite when asked who inspired them' },
      { role: 'The Creator Mentor',  fn: 'Grows other creators — legacy through multiplication',                             signature: 'The roster of creators she launched is longer than most brand portfolios' },
      { role: 'The Platform Pioneer', fn: 'Was there before the platform was what it is now',                                signature: 'The posts that exist from before the algorithm knew what to do with her' },
      { role: 'The Trend Historian', fn: 'Documents where trends actually came from',                                        signature: 'The correction post. The one that credited the right person. Finally.' },
      { role: 'The Culture Keeper',  fn: 'Preserves what LalaVerse was before it became what it is',                          signature: "The archive that breaks people's hearts when they find it" },
    ],
  },
  {
    group: 'Global Icons', icon: '🌐', color: '#6bba9a',
    roles: [
      { role: 'The Digital Empress',  fn: 'Operates across every platform simultaneously — omnipresent',                     signature: 'The only creator who exists everywhere at once and loses nothing in translation' },
      { role: 'The Internet Prince',  fn: 'Male cultural icon who transcends every category',                                signature: "His aesthetic is referenced by every tier — he didn't create it but he defined it" },
      { role: 'The Fashion Empress',  fn: 'The female equivalent of total fashion authority',                                signature: 'When she and the Style Queen agree, the trend is already over' },
      { role: 'The Glow Queen',       fn: 'Total beauty authority — Glow Guru and Beauty Oracle combined',                   signature: 'The face and the formula. Both.' },
      { role: 'The Creator Icon',     fn: 'The single figure who represents what a creator can become in LalaVerse',         signature: 'The answer to the question: what does this platform make possible?' },
    ],
  },
];

const WORLD_LAYERS = [
  { layer: 'Creators',        icon: '👤', color: '#d4789a', whatItDoes: 'Produce content, build audiences, represent cultural values',       feedsInto: 'Cultural events — they attend, participate, get excluded' },
  { layer: 'Cultural events', icon: '📅', color: '#a889c8', whatItDoes: 'Organize the year, create shared experiences, generate pressure',   feedsInto: 'Media networks — who covers what determines who wins' },
  { layer: 'Media networks',  icon: '📡', color: '#c9a84c', whatItDoes: 'Amplify moments, create narrative, control memory',                 feedsInto: 'Algorithms — what gets covered gets boosted' },
  { layer: 'Algorithms',      icon: '⚙️', color: '#7ab3d4', whatItDoes: 'Determine what is seen, who grows, what dies',                      feedsInto: 'Communities — the audience the algorithm builds shapes belief' },
  { layer: 'Communities',     icon: '👥', color: '#6bba9a', whatItDoes: 'Create demand, validate identity, generate new trends',             feedsInto: 'Back to Creators — communities make creators, not the other way around' },
];

const TABS = [
  { key: 'cities',       label: 'Cities' },
  { key: 'universities', label: 'Universities' },
  { key: 'corporations', label: 'Corporations' },
  { key: 'legends',      label: 'The 50 Legends' },
  { key: 'loop',         label: 'The Loop' },
];

const DEFAULTS = {
  CITIES, UNIVERSITIES, CORPORATIONS, LEGENDARY_GROUPS, WORLD_LAYERS,
};

/* ═══════════════════════════════════════════════════
   VIEW COMPONENTS
   ═══════════════════════════════════════════════════ */

/* 01 — Cities */
function CitiesView() {
  const [expanded, setExpanded] = useState(null);
  return (
    <div>
      <h2 className="wi-section-title">The City System — Global Cultural Capitals</h2>
      <p className="wi-section-desc">Where a character lives or travels to is a character statement. Different cities are centers of influence for specific industries.</p>
      <div className="wi-city-grid">
        <EditableList constantKey="CITIES" defaults={CITIES} label="Add City">
          {(c) => (
          <div
            className={`wi-city-card${expanded === c.name ? ' expanded' : ''}`}
            style={{ borderTopColor: c.color }}
            onClick={() => setExpanded(expanded === c.name ? null : c.name)}
          >
            <div className="wi-city-header">
              <span className="wi-city-icon">{c.icon}</span>
              <span className="wi-city-capital" style={{ color: c.color }}>{c.capitalOf}</span>
            </div>
            <h3 className="wi-city-name">{c.name}</h3>
            <p className="wi-city-famous">{c.famousFor}</p>
            {expanded === c.name && (
              <div className="wi-city-detail">
                <div className="wi-city-row">
                  <span className="wi-city-label">Major Events</span>
                  <div className="wi-city-tags">
                    {c.majorEvents.map((e) => <span key={e} className="wi-city-tag" style={{ background: c.color + '18', color: c.color }}>{e}</span>)}
                  </div>
                </div>
                <div className="wi-city-row">
                  <span className="wi-city-label">Who Lives Here</span>
                  <p className="wi-city-text">{c.whoLivesHere}</p>
                </div>
                <div className="wi-city-row">
                  <span className="wi-city-label">Energy</span>
                  <p className="wi-city-energy"><em>{c.energy}</em></p>
                </div>
              </div>
            )}
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

/* 02 — Universities */
function UniversitiesView() {
  return (
    <div>
      <h2 className="wi-section-title">The University System</h2>
      <p className="wi-section-desc">These schools produce the next generation of creators and industry leaders. Where a character went to school — or didn't — is part of their identity.</p>
      <div className="wi-uni-list">
        <EditableList constantKey="UNIVERSITIES" defaults={UNIVERSITIES} label="Add University">
          {(u) => (
          <div className="wi-uni-card" style={{ borderLeftColor: u.color }}>
            <div className="wi-uni-header">
              <span className="wi-uni-icon">{u.icon}</span>
              <div>
                <h3 className="wi-uni-name">{u.name}</h3>
                <span className="wi-uni-city" style={{ color: u.color }}>{u.city} · {u.specialization}</span>
              </div>
            </div>
            <div className="wi-uni-programs">
              {u.programs.map((p) => <span key={p} className="wi-uni-tag" style={{ background: u.color + '15', color: u.color }}>{p}</span>)}
            </div>
            <p className="wi-uni-sig"><em>{u.significance}</em></p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

/* 03 — Corporations */
function CorporationsView() {
  const [expanded, setExpanded] = useState(null);
  return (
    <div>
      <h2 className="wi-section-title">Major Corporations & Brands</h2>
      <p className="wi-section-desc">These companies shape the economy of LalaVerse. They hold power, employ creators, and make the decisions that change the landscape.</p>
      <div className="wi-corp-grid">
        <EditableList constantKey="CORPORATIONS" defaults={CORPORATIONS} label="Add Corporation">
          {(c) => (
          <div
            className={`wi-corp-card${expanded === c.name ? ' expanded' : ''}`}
            style={{ borderTopColor: c.color }}
            onClick={() => setExpanded(expanded === c.name ? null : c.name)}
          >
            <div className="wi-corp-header">
              <span className="wi-corp-icon">{c.icon}</span>
              <span className="wi-corp-industry" style={{ color: c.color }}>{c.industry}</span>
            </div>
            <h3 className="wi-corp-name">{c.name}</h3>
            <p className="wi-corp-known">{c.knownFor}</p>
            {expanded === c.name && (
              <div className="wi-corp-detail">
                <div className="wi-corp-row">
                  <span className="wi-corp-label">Power</span>
                  <p className="wi-corp-text">{c.power}</p>
                </div>
                <div className="wi-corp-row">
                  <span className="wi-corp-label">Story Potential</span>
                  <p className="wi-corp-story"><em>{c.storyPotential}</em></p>
                </div>
              </div>
            )}
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

/* 04 — The 50 Legends */
function LegendsView() {
  const { data } = usePageEdit();
  const groups = data.LEGENDARY_GROUPS || LEGENDARY_GROUPS;
  const [openGroup, setOpenGroup] = useState(groups[0].group);
  return (
    <div>
      <h2 className="wi-section-title">The 50 Legendary Influencers</h2>
      <p className="wi-section-desc">The most powerful cultural figures in LalaVerse. All placeholders — names assigned through the Character Registry. These are the gravity wells the story orbits around.</p>

      <div className="wi-legend-groups">
        <EditableList constantKey="LEGENDARY_GROUPS" defaults={LEGENDARY_GROUPS} label="Add Group">
          {(g) => (
          <button
            className={`wi-legend-group-btn${openGroup === g.group ? ' active' : ''}`}
            style={openGroup === g.group ? { background: g.color + '15', color: g.color, borderColor: g.color } : {}}
            onClick={() => setOpenGroup(g.group)}
          >
            <span>{g.icon}</span> {g.group} <span className="wi-legend-count">5</span>
          </button>
          )}
        </EditableList>
      </div>

      {groups.filter((g) => g.group === openGroup).map((g) => (
        <div key={g.group} className="wi-legend-roles">
          {(g.roles || []).map((r) => (
            <div key={r.role} className="wi-legend-card" style={{ borderLeftColor: g.color }}>
              <h4 className="wi-legend-role">{r.role} <span className="wi-legend-placeholder">[placeholder]</span></h4>
              <p className="wi-legend-fn">{r.fn}</p>
              <p className="wi-legend-sig"><em>"{r.signature}"</em></p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* 05 — The Loop */
function LoopView() {
  const { data } = usePageEdit();
  const items = data.WORLD_LAYERS || WORLD_LAYERS;
  return (
    <div>
      <h2 className="wi-section-title">How the Entire World Connects</h2>
      <p className="wi-section-desc">The infrastructure of LalaVerse operates as a single interconnected system.</p>

      <div className="wi-loop-pipeline">
        <EditableList constantKey="WORLD_LAYERS" defaults={WORLD_LAYERS} label="Add Layer">
          {(l, idx) => (
            <>
              <div className="wi-loop-stage" style={{ borderTopColor: l.color }}>
                <span className="wi-loop-icon">{l.icon}</span>
                <h4 className="wi-loop-layer">{l.layer}</h4>
                <p className="wi-loop-does">{l.whatItDoes}</p>
                <div className="wi-loop-feeds">
                  <span className="wi-loop-label">Feeds Into</span>
                  <p className="wi-loop-into">{l.feedsInto}</p>
                </div>
              </div>
              {idx < items.length - 1 && <span className="wi-loop-arrow">→</span>}
            </>
          )}
        </EditableList>
      </div>

      <div className="wi-loop-summary">
        <h4 className="wi-loop-summary-title">THE LOOP</h4>
        <p className="wi-loop-summary-text">
          Creators influence cultural events. Cultural events get covered by media networks. Media networks are amplified by algorithms. Algorithms build communities. Communities create the demand that makes creators. <strong>The loop completes and accelerates.</strong>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

const VIEWS = { cities: CitiesView, universities: UniversitiesView, corporations: CorporationsView, legends: LegendsView, loop: LoopView };

export default function WorldInfrastructure() {
  const [tab, setTab] = useState('cities');
  const [editItem, setEditItem] = useState(null);
  const { data, updateItem, addItem, removeItem, saving } = usePageData('world_infrastructure', DEFAULTS);
  const View = VIEWS[tab];

  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div className="wi-shell">
      <header className="wi-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>World Infrastructure</h1>
          {saving && <span className="eim-saving">Saving…</span>}
        </div>
        <p>Cities · Universities · Corporations · 50 Legendary Influencers · The Loop — Doc 04 · v1.0</p>
        <nav className="wi-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`wi-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="wi-content">
        <View />
      </main>

      {editItem && (
        <EditItemModal
          item={editItem.item}
          title={`Edit ${editItem.key.replace(/_/g, ' ')}`}
          onSave={(updated) => {
            if (editItem.index === -1) addItem(editItem.key, updated);
            else updateItem(editItem.key, editItem.index, updated);
            setEditItem(null);
          }}
          onCancel={() => setEditItem(null)}
        />
      )}
    </div>
    </PageEditContext.Provider>
  );
}
