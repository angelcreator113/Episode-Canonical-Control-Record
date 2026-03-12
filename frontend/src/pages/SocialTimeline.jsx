import React, { useState } from 'react';
import './SocialTimeline.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, EditToolbar, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';

/* ══════════════════════════════════════════════
   Data Constants — Doc 05 · Social Timeline v1.0
   ══════════════════════════════════════════════ */

const TIMELINE_LAYERS = [
  { layer: 1, name: 'Personal Circle',  weight: '~30 %', contains: 'People a character personally knows — friends, family, coworkers, collaborators', narrative: 'Creates emotional realism. Baby announcements. Relationship updates. Everyday life.' },
  { layer: 2, name: 'Interest Clusters', weight: '~30 %', contains: 'Communities the character engages with — fashion, beauty, fitness, entrepreneurship, gaming, nightlife', narrative: 'Tells you who a character is by what they\'ve trained the algorithm to show them.' },
  { layer: 3, name: 'Cultural Moments',  weight: '~20 %', contains: 'Content tied to global events — Velvet Season, Glow Week, Starlight Awards', narrative: 'The world pressing in. A character who ignores it is making a choice.' },
  { layer: 4, name: 'Viral Waves',       weight: '~20 %', contains: 'Posts spreading rapidly — dances, memes, scandals, celebrity moments', narrative: 'The feed\'s unconscious. You cannot opt out of what the network decides everyone sees.' }
];

const VIRAL_STAGES = [
  { stage: 1, name: 'Seed',            audience: "Creator's followers only",               happening: 'Post is published to a small audience. Engagement is early and genuine.',             story: "The post that should have gone viral but didn't. Or the one nobody expected to escape." },
  { stage: 2, name: 'Cluster Spread',  audience: 'Related communities via algorithm push',  happening: 'Strong engagement signals push content beyond its origin cluster.',                   story: 'The moment a creator realizes their post is escaping. Either a gift or a problem.' },
  { stage: 3, name: 'Platform Spread', audience: 'The entire platform',                     happening: "Content escapes its niche — it's no longer about the original audience.",             story: "The comments change. People who don't know the creator have strong opinions anyway." },
  { stage: 4, name: 'Cultural Moment', audience: 'The network as shared cultural entity',    happening: 'The post becomes a reference point. Everyone has seen it.',                           story: "Virality is not neutral. It's a new identity imposed faster than it can be defended." }
];

const ENGAGEMENT_SIGNALS = [
  { type: 'Comments',           strength: 'Strong', looks: 'Responses — argument, praise, questions', tells: 'People have a feeling strong enough to say something',               story: '200 comments and 50 likes is more dangerous than 5 000 likes.' },
  { type: 'Shares',             strength: 'Strong', looks: 'Forwarding to stories, DMs, other platforms', tells: 'Content is worth staking personal reputation on',              story: "Sharing says: I want this associated with me. Or: I want everyone to see this problem." },
  { type: 'Saves',              strength: 'Strong', looks: 'Bookmarking — private signal',             tells: 'Content has lasting value beyond the scroll',                       story: 'Saves are invisible to everyone but the algorithm. The most honest signal.' },
  { type: 'Replies in threads', strength: 'Strong', looks: 'Extended engagement — conversation continues', tells: 'Post generated enough energy to sustain a conversation',      story: "A thread that won't die is either a community or a crisis." },
  { type: 'Passive views',      strength: 'Weak',   looks: 'Video plays without action',               tells: 'Awareness, not investment',                                         story: 'High views, low engagement: everyone saw it and nobody cared enough to respond.' },
  { type: 'Quick likes',        strength: 'Weak',   looks: 'Tap and scroll',                            tells: 'Minimal positive signal — polite acknowledgment',                   story: 'The like that means nothing. The creator knows the difference.' }
];

const DRAMA_TRIGGERS = [
  { trigger: 'Accusations (sent or received)', pattern: 'Immediate spike — sides form instantly',                     duration: '3–7 days, residual for weeks',                  cost: 'Association with the accusation, regardless of outcome.' },
  { trigger: 'Breakups going public',          pattern: 'Sustained high engagement — audience emotionally invested',  duration: '1–2 weeks, reference for months',               cost: 'Privacy. The relationship becomes content.' },
  { trigger: 'Creator feuds',                  pattern: 'Escalating — each response adds a new spike',               duration: 'Ongoing while both parties engage',             cost: 'Energy, time, and being known primarily for the conflict.' },
  { trigger: 'Apology videos',                 pattern: 'Initial spike + second spike from response content',         duration: '1 week minimum',                                cost: 'She will be measured against the apology for years.' },
  { trigger: 'Subtweet / vague post',          pattern: 'Speculation spike — the audience does the work',             duration: '2–4 days',                                      cost: 'Plausible deniability. The audience fills in the name. Sometimes incorrectly.' }
];

const CULTURAL_OVERRIDES = [
  { event: 'Velvet Season',    dates: 'Sep 1–20',  override: 'Fashion posts increase 300 %. Designer content dominates.',                            buried: 'Beauty content, lifestyle content, entertainment.',             choice: 'Riding the wave, conspicuous absence, or deliberate counter-programming.' },
  { event: 'Glow Week',        dates: 'Apr 1–14',  override: 'Beauty tutorials trend. Salons explode. Product launches time for this window.',       buried: 'Fashion posts lose reach. Non-beauty content drops.',           choice: 'Launching a beauty product off-cycle is a real risk.' },
  { event: 'Starlight Awards', dates: 'Nov 1–20',  override: 'Commentary, coverage, predictions, reactions — the entire Feed is about the awards.',  buried: "Anything that isn't awards-adjacent loses reach for two weeks.", choice: 'Every creator has a position on the Starlights.' },
  { event: 'Atelier Circuit',  dates: 'Aug 1–22',  override: 'Runway content, designer reveals — the highest-status two weeks.',                     buried: 'Everything outside fashion. The blackout window.',              choice: "The invitation is the content. Who got invited. Who didn't." },
  { event: 'Cloud Carnival',   dates: 'Dec 1–20',  override: 'Celebration content, party footage, year-end reflection, launches.',                   buried: 'Anything heavy. Controversy gets buried — or saved for January.', choice: 'December 21 is the Grand Drop. Every major creator has a strategy.' }
];

const TREND_STEPS = [
  { step: 1, who: 'Tier 5–6 micro creators',                   signal: 'The trend exists but has no name. Just something a few people are doing.',     story: 'The character who finds it here. Share it or protect it.' },
  { step: 2, who: 'Tier 4–5 rising creators',                   signal: 'Getting traction in niche clusters. Still feels like a secret.',               story: 'The early adopters who will later argue about who had it first.' },
  { step: 3, who: 'Tier 3–4 major influencers',                 signal: 'Algorithm starts pushing it. The trend escapes its origin cluster.',            story: "Waited for validation — safe, but she'll never be credited as early." },
  { step: 4, who: 'Tier 1–2 cultural icons',                    signal: 'The trend is now culture. Original creators often invisible.',                  story: 'The erasure. Who gets remembered vs. who did it first.' },
  { step: 5, who: 'Everyone — the trend has no owner',          signal: 'Engagement drops. Being on-trend now means being behind.',                     story: 'Held on too long, or moved on at exactly the right moment.' },
  { step: 6, who: 'New Tier 5–6 origin forming',                signal: 'The cycle resets. Faster than last time.',                                     story: 'Recognized Step 6 while everyone else was still in Step 5.' }
];

const MOMENTUM_ACTIONS = [
  { action: 'Consistent posting',               effect: 'Steady momentum accumulation',                          story: 'Shows up every day while everyone else waits for inspiration.' },
  { action: 'Going viral',                       effect: 'Momentum spike — algorithm favor increases',            story: 'The spike creates pressure. Maintain it or lose more than you gained.' },
  { action: 'Collaborating',                     effect: 'Momentum shared and amplified between both creators',   story: 'The collab that made one and cost the other. Or made both.' },
  { action: 'Participating in cultural events',  effect: 'Event-aligned boost during the event window',           story: 'At the Atelier Circuit vs. posting from home. Both choices are visible.' },
  { action: 'Disappearing (going silent)',       effect: 'Momentum decay — faster than expected',                 story: "Two weeks off. She came back to a different Feed. The algorithm didn't wait." },
  { action: 'Controversy',                       effect: 'Momentum spike — unpredictable direction',              story: "High momentum during the crisis. The question is who she is when it's over." },
  { action: 'Posting off-cycle',                 effect: 'Reduced reach — algorithm deprioritizes',               story: 'The creative decision that cost her. Or made her distinctive by contrast.' }
];

const INFLUENCE_CLUSTERS = [
  { cluster: 'Fashion',         members: 'Designers, stylists, fashion influencers, photographers, runway models',          dynamics: 'Hierarchy obsession. Tier matters. Velvet City access is the currency.',                  cross: 'Contaminates beauty, entertainment, fitness.' },
  { cluster: 'Beauty',          members: 'Makeup artists, skincare creators, beauty founders, salon owners',                dynamics: 'Product loyalty is tribal. The Glow Gazette review is the arbiter.',                      cross: 'Contaminates fashion, wellness, entertainment.' },
  { cluster: 'Entertainment',   members: 'Musicians, comedians, actors turned creators, nightlife',                         dynamics: 'Virality is the metric. Being funny matters more than being polished.',                   cross: 'Contaminates fashion, dance, meme culture.' },
  { cluster: 'Creator Economy', members: 'Entrepreneurs, course creators, digital product sellers, business influencers',   dynamics: 'Income transparency culture. Proof of earnings is content.',                              cross: 'Contaminates every cluster.' },
  { cluster: 'Wellness',        members: 'Mental health creators, fitness influencers, nutritionists, rest culture',        dynamics: 'Authenticity pressure. Any gap between message and behavior is a scandal.',               cross: 'Contaminates beauty, entertainment, fashion.' }
];

const SHOCK_EVENTS = [
  { event: 'Celebrity breakup (major pair)',       dominance: '3–7 days peak, 2–4 weeks residual', resets: "Every creator's relationship content is re-evaluated",                 opportunity: 'The Gossip Empress. The Culture Commentator. Every creator who was silent now has audience questions.' },
  { event: 'Major scandal (Tier 1–2)',             dominance: '5–10 days peak, months residual',   resets: 'The reputation of everyone adjacent — who knew, who stayed silent',    opportunity: 'Creators who were quietly competing with the scandal creator. The field just opened.' },
  { event: 'Surprise collaboration',               dominance: '1–2 weeks of reaction content',     resets: "Assumed incompatibility between the two creators' audiences",          opportunity: 'Everyone between them. The collaboration creates a new category by accident.' },
  { event: 'Unexpected award win',                 dominance: '1 week of recalibration',            resets: 'The previous understanding of who was at the top',                     opportunity: "The snubbed creator. The winner's trajectory for the next 12 months." },
  { event: 'Platform policy change',               dominance: 'Ongoing — creeping, not shocking',   resets: "Every creator's current content strategy viability",                   opportunity: "Creators who diversified early. Builders who own their audience." }
];

const CULTURAL_MEMORY = [
  { type: 'Drama',          lifespan: '1–3 days active',                    memory: 'Becomes a reference point for future drama of the same type',      story: "'Remember the Velvet Season meltdown?' — three years later, still the benchmark." },
  { type: 'Trends',         lifespan: '1–2 weeks active',                   memory: 'The trend gets a name — naming preserves it',                      story: 'Who named it becomes part of the myth. Usually not who started it.' },
  { type: 'Events',         lifespan: '1 month of Feed saturation',         memory: "The event's key moments become iconic images or quotes",            story: 'The photo from the Atelier Circuit that defines the decade.' },
  { type: 'Feuds',          lifespan: 'Variable — while both are active',   memory: "When the feud ends, it's immediately archived and analyzed",        story: 'What they fought about will be written about when both careers are over.' },
  { type: 'Iconic moments', lifespan: 'Permanent',                          memory: 'When culture starts using them as shorthand',                       story: "'She pulled a [creator name]' — the moment that became a verb." }
];

const CROSS_INDUSTRY = [
  { origin: 'Fashion',             influences: 'Beauty, Fitness, Entertainment',  example: 'A runway aesthetic from the Atelier Circuit becomes the makeup trend of the season.' },
  { origin: 'Beauty',              influences: 'Fashion, Wellness, Fitness',      example: 'A skincare ingredient goes from the Glow Institute to wellness. Everywhere in 30 days.' },
  { origin: 'Music / Entertainment', influences: 'Fashion, Dance, Meme culture', example: 'A music video starts a fashion trend. The outfit becomes a Halloween costume. The lyric becomes a caption.' },
  { origin: 'Creator Economy',     influences: 'All clusters',                   example: 'Income transparency starts in entrepreneurship and spreads to every cluster.' },
  { origin: 'Wellness',            influences: 'Beauty, Entertainment, Fashion',  example: 'A rest culture moment makes burnout content go viral. Fashion responds with comfort aesthetic.' }
];

const ENGINE_QUESTIONS = [
  'What layer of the Feed is this content landing in — personal circle, interest cluster, cultural moment, or viral wave?',
  'What stage of viral spread is this post at — seed, cluster, platform, or cultural moment?',
  'What engagement signals is this generating — strong (comments, shares, saves) or weak (views, likes)?',
  'Is this happening during a cultural event override — and is the content aligned or deliberately counter-programmed?',
  'What cluster is this content in, and which clusters does it have the potential to contaminate?',
  "What is this creator's momentum score before this post — and how does this post change it?",
  'Does this moment have the weight to become cultural memory, or does it die in 48 hours?'
];

const ENGINE_CORE_RULE = "THE FEED IS ALWAYS WATCHING. No post in LalaVerse exists in isolation. Every piece of content enters a living system with rules, memory, and momentum. The characters who understand this build empires. The characters who don't get used by the system instead of using it.";

const DEFAULTS = {
  TIMELINE_LAYERS, VIRAL_STAGES, ENGAGEMENT_SIGNALS, DRAMA_TRIGGERS,
  CULTURAL_OVERRIDES, TREND_STEPS, MOMENTUM_ACTIONS, INFLUENCE_CLUSTERS,
  SHOCK_EVENTS, CULTURAL_MEMORY, CROSS_INDUSTRY, ENGINE_QUESTIONS, ENGINE_CORE_RULE,
};

/* ═══════════════════
   Tab definitions
   ═══════════════════ */
const TABS = [
  { key: 'layers',       label: 'Layers' },
  { key: 'viral',        label: 'Viral Spread' },
  { key: 'engagement',   label: 'Engagement' },
  { key: 'drama',        label: 'Drama' },
  { key: 'events',       label: 'Events' },
  { key: 'trends',       label: 'Trend Waves' },
  { key: 'momentum',     label: 'Momentum' },
  { key: 'clusters',     label: 'Clusters' },
  { key: 'shocks',       label: 'Shocks' },
  { key: 'memory',       label: 'Memory' },
  { key: 'crossIndustry', label: 'Cross-Industry' },
  { key: 'engine',       label: 'Engine' }
];

/* ═══════════════════
   Tab Renderers
   ═══════════════════ */

function TabLayers() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Every character's Feed is built from four blended layers. The layer a post lives in determines its narrative weight.</p>
      <div className="st-card-grid st-cols-2">
        <EditableList constantKey="TIMELINE_LAYERS" defaults={TIMELINE_LAYERS} label="Add Layer">
          {(l) => (
          <div className="st-card">
            <div className="st-card-header">
              <span className="st-badge st-badge-rose">Layer {l.layer}</span>
              <span className="st-card-title">{l.name}</span>
              <span className="st-badge st-badge-steel">{l.weight}</span>
            </div>
            <p className="st-card-body"><strong>Contains:</strong> {l.contains}</p>
            <p className="st-card-body st-muted">{l.narrative}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabViral() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Content spreads through four stages. The distance between Stage 1 and Stage 4 is the story of how something becomes culture.</p>
      <div className="st-card-grid st-cols-2">
        <EditableList constantKey="VIRAL_STAGES" defaults={VIRAL_STAGES} label="Add Stage">
          {(s) => (
          <div className="st-card">
            <div className="st-card-header">
              <span className="st-badge st-badge-orchid">Stage {s.stage}</span>
              <span className="st-card-title">{s.name}</span>
            </div>
            <p className="st-card-body"><strong>Who sees it:</strong> {s.audience}</p>
            <p className="st-card-body"><strong>What's happening:</strong> {s.happening}</p>
            <p className="st-card-body st-muted">{s.story}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabEngagement() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Not all engagement is equal. The kind of engagement determines how far content travels.</p>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Strength</th>
              <th>Looks Like</th>
              <th>Tells the Algorithm</th>
              <th>Story Implication</th>
            </tr>
          </thead>
          <tbody>
            <EditableList constantKey="ENGAGEMENT_SIGNALS" defaults={ENGAGEMENT_SIGNALS} label="Add Signal">
              {(s) => (
              <tr>
                <td className="st-cell-label">{s.type}</td>
                <td><span className={`st-badge ${s.strength === 'Strong' ? 'st-badge-mint' : 'st-badge-muted'}`}>{s.strength}</span></td>
                <td>{s.looks}</td>
                <td>{s.tells}</td>
                <td className="st-muted">{s.story}</td>
              </tr>
              )}
            </EditableList>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabDrama() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Drama posts receive extra algorithmic amplification. The system does not distinguish between good and bad attention — only volume.</p>
      <div className="st-card-grid st-cols-1">
        <EditableList constantKey="DRAMA_TRIGGERS" defaults={DRAMA_TRIGGERS} label="Add Trigger">
          {(d) => (
          <div className="st-card st-card-wide">
            <div className="st-card-header">
              <span className="st-badge st-badge-rose">{d.trigger}</span>
              <span className="st-badge st-badge-amber">{d.duration}</span>
            </div>
            <p className="st-card-body"><strong>Pattern:</strong> {d.pattern}</p>
            <p className="st-card-body st-muted"><strong>Cost:</strong> {d.cost}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabEvents() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Major events temporarily reshape the entire Feed. Event-aligned content gets boosted; off-topic content gets suppressed.</p>
      <div className="st-card-grid st-cols-1">
        <EditableList constantKey="CULTURAL_OVERRIDES" defaults={CULTURAL_OVERRIDES} label="Add Event">
          {(e) => (
          <div className="st-card st-card-wide">
            <div className="st-card-header">
              <span className="st-badge st-badge-gold">{e.event}</span>
              <span className="st-badge st-badge-steel">{e.dates}</span>
            </div>
            <p className="st-card-body"><strong>Override:</strong> {e.override}</p>
            <p className="st-card-body"><strong>Buried:</strong> {e.buried}</p>
            <p className="st-card-body st-muted"><strong>Character choice:</strong> {e.choice}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabTrends() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Trends spread through creator tiers in a predictable pattern. Where a trend is in its cycle tells you what it means for every character who touches it.</p>
      <div className="st-steps">
        <EditableList constantKey="TREND_STEPS" defaults={TREND_STEPS} label="Add Step">
          {(t) => (
          <div className="st-step-row">
            <div className="st-step-num">{t.step}</div>
            <div className="st-step-body">
              <div className="st-step-who">{t.who}</div>
              <div className="st-step-signal">{t.signal}</div>
              <div className="st-step-story st-muted">{t.story}</div>
            </div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabMomentum() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Creators build and lose momentum over time. Momentum determines how easily their posts spread — it's the compound interest of the Feed.</p>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Effect</th>
              <th>Story Implication</th>
            </tr>
          </thead>
          <tbody>
            <EditableList constantKey="MOMENTUM_ACTIONS" defaults={MOMENTUM_ACTIONS} label="Add Action">
              {(m) => (
              <tr>
                <td className="st-cell-label">{m.action}</td>
                <td>{m.effect}</td>
                <td className="st-muted">{m.story}</td>
              </tr>
              )}
            </EditableList>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabClusters() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">LalaVerse contains defined social clusters. Cross-cluster contamination is how culture spreads beyond its origin industry.</p>
      <div className="st-card-grid st-cols-1">
        <EditableList constantKey="INFLUENCE_CLUSTERS" defaults={INFLUENCE_CLUSTERS} label="Add Cluster">
          {(c) => (
          <div className="st-card st-card-wide">
            <div className="st-card-header">
              <span className="st-badge st-badge-orchid">{c.cluster}</span>
            </div>
            <p className="st-card-body"><strong>Members:</strong> {c.members}</p>
            <p className="st-card-body"><strong>Dynamics:</strong> {c.dynamics}</p>
            <p className="st-card-body st-muted"><strong>Cross-influence:</strong> {c.cross}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabShocks() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Massive events shake the entire network, dominate feeds for days, and reset the context for everything that follows.</p>
      <div className="st-card-grid st-cols-1">
        <EditableList constantKey="SHOCK_EVENTS" defaults={SHOCK_EVENTS} label="Add Shock Event">
          {(s) => (
          <div className="st-card st-card-wide">
            <div className="st-card-header">
              <span className="st-badge st-badge-rose">{s.event}</span>
              <span className="st-badge st-badge-amber">{s.dominance}</span>
            </div>
            <p className="st-card-body"><strong>Resets:</strong> {s.resets}</p>
            <p className="st-card-body st-muted"><strong>Opportunity:</strong> {s.opportunity}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabMemory() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Major events become part of LalaVerse history. The Feed has a memory, and that memory has power.</p>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Active Lifespan</th>
              <th>Enters Cultural Memory</th>
              <th>Story Implication</th>
            </tr>
          </thead>
          <tbody>
            <EditableList constantKey="CULTURAL_MEMORY" defaults={CULTURAL_MEMORY} label="Add Memory Type">
              {(m) => (
              <tr>
                <td className="st-cell-label">{m.type}</td>
                <td>{m.lifespan}</td>
                <td>{m.memory}</td>
                <td className="st-muted">{m.story}</td>
              </tr>
              )}
            </EditableList>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabCrossIndustry() {
  return (
    <div className="st-tab-content">
      <p className="st-intro">Industries influence each other. The most powerful cultural moments happen when an idea crosses cluster boundaries.</p>
      <div className="st-card-grid st-cols-1">
        <EditableList constantKey="CROSS_INDUSTRY" defaults={CROSS_INDUSTRY} label="Add Cross-Industry">
          {(c) => (
          <div className="st-card st-card-wide">
            <div className="st-card-header">
              <span className="st-badge st-badge-gold">{c.origin}</span>
              <span className="st-card-arrow">→</span>
              <span className="st-card-subtitle">{c.influences}</span>
            </div>
            <p className="st-card-body st-muted">{c.example}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabEngine() {
  const { data } = usePageEdit();
  const questions = data.ENGINE_QUESTIONS || ENGINE_QUESTIONS;
  const coreRule = data.ENGINE_CORE_RULE || ENGINE_CORE_RULE;
  return (
    <div className="st-tab-content">
      <p className="st-intro">The Social Timeline Engine is not background — it is active narrative infrastructure. Before generating any Feed scene, the story engine asks:</p>
      <ol className="st-engine-questions">
        {questions.map((q, i) => (
          <li key={i} className="st-engine-q">{q}</li>
        ))}
      </ol>
      <blockquote className="st-core-rule">{coreRule}</blockquote>
    </div>
  );
}

const TAB_RENDERERS = {
  layers: TabLayers,
  viral: TabViral,
  engagement: TabEngagement,
  drama: TabDrama,
  events: TabEvents,
  trends: TabTrends,
  momentum: TabMomentum,
  clusters: TabClusters,
  shocks: TabShocks,
  memory: TabMemory,
  crossIndustry: TabCrossIndustry,
  engine: TabEngine
};

/* ═══════════════════
   Main Component
   ═══════════════════ */

export default function SocialTimeline() {
  const [activeTab, setActiveTab] = useState('layers');
  const [editItem, setEditItem] = useState(null);
  const { data, updateItem, addItem, removeItem, saving, editMode, setEditMode } = usePageData('social_timeline', DEFAULTS);
  const Renderer = TAB_RENDERERS[activeTab];

  return (
    <PageEditContext.Provider value={{ data, editMode, setEditItem, removeItem }}>
    <div className="st-page">
      <header className="st-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="st-title">The Social Timeline Engine</h1>
          <EditToolbar editMode={editMode} setEditMode={setEditMode} saving={saving} />
        </div>
        <p className="st-subtitle">Doc 05 · v1.0 · March 2026 — How the Feed works, spreads, amplifies, and remembers</p>
      </header>

      <nav className="st-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`st-tab ${activeTab === t.key ? 'st-tab-active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="st-panel" role="tabpanel">
        {Renderer && <Renderer />}
      </section>

      <footer className="st-footer">
        Source: <em>social-timeline-v1.0</em> · franchise_law · always_inject
      </footer>

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
