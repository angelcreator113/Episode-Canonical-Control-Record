import React, { useState } from 'react';
import './InfluencerSystems.css';

/* ═══════════════════════════════════════════════════════════════════════
   InfluencerSystems.jsx — Doc 03 · v1.0
   ═══════════════════════════════════════════════════════════════════════
   franchise_law · always_inject
   15 Personality Archetypes · Social Relationship Graph · Creator Economy
   Fashion Trend Engine · Beauty Trend Engine · Momentum Waves
   Social Influence Power · Cultural Legacy
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Design Palette (shared with Cultural Calendar) ─────────────────────
const T = {
  rose:   '#d4789a',
  steel:  '#7ab3d4',
  orchid: '#a889c8',
  gold:   '#c9a84c',
  mint:   '#6bba9a',
  amber:  '#b89060',
  bg:     '#faf9fc',
  text:   '#0f0c14',
  muted:  '#7a7088',
  border: '#e8e4f0',
};

/* ─── Tabs ──────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'archetypes',    label: 'Archetypes' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'economy',       label: 'Economy' },
  { id: 'fashion-trend', label: 'Fashion Trends' },
  { id: 'beauty-trend',  label: 'Beauty Trends' },
  { id: 'momentum',      label: 'Momentum' },
  { id: 'influence',     label: 'Influence' },
  { id: 'legacy',        label: 'Legacy' },
];

/* ─── 01 · The 15 Influencer Personality Archetypes ────────────────── */
const ARCHETYPES = [
  { num: '01', name: 'The Main Character', icon: '🎬', color: T.rose,
    content: 'Relationship stories, glow-ups, emotional monologues, life updates as episodes',
    audience: 'Followers feel like they\'re watching someone\'s life unfold in real time',
    narrative: 'The character the audience is emotionally invested in. Their choices matter.' },
  { num: '02', name: 'The Trendsetter', icon: '✨', color: T.gold,
    content: 'Outfit reveals, experimental looks, aesthetic shifts before they\'re mainstream',
    audience: 'Starts fashion waves — the audience finds out they were early after the fact',
    narrative: 'First adopter. Signals what\'s coming. Gets credit or gets copied.' },
  { num: '03', name: 'The Beauty Oracle', icon: '🔮', color: T.orchid,
    content: 'Skincare routines, makeup trends, beauty reviews, technique breakdowns',
    audience: 'Influences product sales and redefines beauty standards',
    narrative: 'Authority figure. When she says something is over, it\'s over.' },
  { num: '04', name: 'The Hustle Mogul', icon: '💰', color: T.amber,
    content: 'Business advice, income transparency, motivational content, launch documentation',
    audience: 'Promotes entrepreneurship culture — followers build things',
    narrative: 'The proof it\'s possible. Also: the cautionary tale when the hustle isn\'t real.' },
  { num: '05', name: 'The Entertainer', icon: '🎭', color: T.steel,
    content: 'Comedy, skits, memes, reaction content, viral formats',
    audience: 'Drives platform engagement — the reason people open the app',
    narrative: 'Releases tension. The comic relief that\'s sometimes the most honest voice.' },
  { num: '06', name: 'The Drama Magnet', icon: '🔥', color: T.rose,
    content: 'Arguments, callouts, response videos, receipts',
    audience: 'Creates viral gossip cycles — the audience arrives for the drama',
    narrative: 'Catalyst. Things happen around them. Often not by accident.' },
  { num: '07', name: 'The Relatable Friend', icon: '💛', color: T.gold,
    content: 'Daily life, parenting struggles, honest confessions, low-production realness',
    audience: 'Builds deep audience trust — feels like someone the audience actually knows',
    narrative: 'The emotional anchor. When she says something matters, the audience believes her.' },
  { num: '08', name: 'The Luxury Icon', icon: '💎', color: T.orchid,
    content: 'Designer fashion, exotic travel, exclusive parties, aspirational lifestyle',
    audience: 'Creates aspiration and envy simultaneously',
    narrative: 'Represents what some characters want to become and others want to destroy.' },
  { num: '09', name: 'The Educator', icon: '📚', color: T.mint,
    content: 'Tutorials, explainers, knowledge threads, skill breakdowns',
    audience: 'Builds authority and credibility — the audience learns from them',
    narrative: 'The expert. Influence comes from competence, not charisma.' },
  { num: '10', name: 'The Commentator', icon: '🗣️', color: T.steel,
    content: 'Reaction videos, social commentary, cultural analysis',
    audience: 'Shapes public opinion — gives the audience language for what they\'re feeling',
    narrative: 'Names things. Once she names something, everyone uses her language.' },
  { num: '11', name: 'The Connector', icon: '🔗', color: T.mint,
    content: 'Collaborations, group events, social gatherings, network content',
    audience: 'Creates network clusters — audiences overlap and merge',
    narrative: 'The bridge. Makes things happen between people who wouldn\'t otherwise meet.' },
  { num: '12', name: 'The Archivist', icon: '📖', color: T.amber,
    content: 'Fashion archives, nostalgia posts, cultural memory content',
    audience: 'Defines legacy — decides what gets remembered',
    narrative: 'The historian. Controls the narrative of what mattered.' },
  { num: '13', name: 'The Rebel', icon: '⚡', color: T.rose,
    content: 'Controversial opinions, experimental art, anti-trend content',
    audience: 'Creates counterculture movements — the alternative to the mainstream',
    narrative: 'The one who says what everyone else is afraid to. Sometimes right. Sometimes destructive.' },
  { num: '14', name: 'The Wellness Guide', icon: '🧘', color: T.mint,
    content: 'Routines, therapy talk, mindfulness, rest content, boundary content',
    audience: 'Influences self-care culture — permission structure for slowing down',
    narrative: 'The counter-narrative. Makes the platform feel less like a race for a moment.' },
  { num: '15', name: 'The Viral Wildcard', icon: '🎲', color: T.orchid,
    content: 'Random viral moments, chaotic posts, unpredictable formats',
    audience: 'Creates unexpected trends — the audience never knows what\'s coming',
    narrative: 'The chaos agent. Breaks patterns. Impossible to predict or copy.' },
];

/* ─── 02 · The Social Relationship Graph (5 Types) ─────────────────── */
const RELATIONSHIP_TYPES = [
  { type: 'Collaborators', icon: '🤝', color: T.steel,
    looksLike: 'Joint product launches, shared videos, recurring appearances together',
    creates: 'Audience overlap, shared credibility, creative momentum',
    breaks: 'Creative differences, audience feedback turning negative, one outgrowing the other',
    storyBreaks: 'Whose audience was it really? The collaboration becomes a retrospective.' },
  { type: 'Rivals', icon: '⚔️', color: T.rose,
    looksLike: 'Competing in the same space — fashion designers, beauty brands, lifestyle niches',
    creates: 'Fan armies, comparison culture, the audience choosing sides',
    breaks: 'One wins decisively, or both lose to a third party who arrived while they were focused on each other',
    storyBreaks: 'The rivalry that defined both of them disappears and they don\'t know who they are without it.' },
  { type: 'Mentors', icon: '🎓', color: T.gold,
    looksLike: 'Experienced creators guiding newer ones — career advice, industry access, introductions',
    creates: 'Legacy lines — the mentor\'s influence lives in the student\'s work',
    breaks: 'Student surpasses the mentor publicly, or mentor feels ownership over student\'s success',
    storyBreaks: 'Was it mentorship or was it control? The student has to answer that publicly.' },
  { type: 'Friends', icon: '💛', color: T.mint,
    looksLike: 'Travel groups, party crews, mutual appearances, public social alignment',
    creates: 'Social circles, shared audiences, the feeling of an inner world the audience glimpses',
    breaks: 'Falling out over something the audience doesn\'t fully know, or one friend getting cancelled',
    storyBreaks: 'The friendship post that disappeared. Everyone noticed. Nobody asked directly.' },
  { type: 'Romantic', icon: '💕', color: T.orchid,
    looksLike: 'Influencer couples — public or slow-burn reveals, shared content, relationship milestones',
    creates: 'Massive audience attention — the audience is emotionally invested',
    breaks: 'Breakup, cheating allegation, one partner\'s controversy contaminating the other',
    storyBreaks: 'The post where she stopped tagging him. Three days before the announcement.' },
];

/* ─── 03 · The Creator Economy System (6 Income Streams) ───────────── */
const ECONOMY_STREAMS = [
  { stream: 'Brand Collaborations', icon: '🏷️', color: T.gold,
    what: 'Partnerships with companies to promote products — fashion, beauty, lifestyle, tech',
    who: 'Every tier uses it. Quality of brand signals tier level.',
    narrative: 'The brand deal she took that didn\'t fit tells you what she needed that month.' },
  { stream: 'Creator Shops', icon: '🛍️', color: T.rose,
    what: 'Personal storefronts — clothing, digital products, merchandise',
    who: 'Tier 3–6. The entrepreneurial layer of the creator economy.',
    narrative: 'What she sells reveals what she thinks her audience values about her.' },
  { stream: 'Membership Communities', icon: '🔐', color: T.orchid,
    what: 'Fans pay for exclusive access — behind-the-scenes, private discussions',
    who: 'Tier 2–4. Requires deep audience trust.',
    narrative: 'Who\'s in the paid community and what they\'re getting is always more interesting than the public content.' },
  { stream: 'Event Appearances', icon: '🎪', color: T.steel,
    what: 'Festivals, award shows, industry panels, brand activations',
    who: 'Tier 1–3. Invitation is the signal.',
    narrative: 'Which events she attended, which she skipped, which she was not invited to.' },
  { stream: 'Digital Products', icon: '📦', color: T.mint,
    what: 'Courses, presets, templates, educational content',
    who: 'Tier 3–6. Knowledge monetized.',
    narrative: 'The course she released when the content stopped working. The pivot.' },
  { stream: 'Pay-for-Attention', icon: '💸', color: T.amber,
    what: 'DM access, CashApp tipping, direct financial relationships with audience members',
    who: 'Any tier — but rarely discussed publicly.',
    narrative: 'The money is agreement. He is agreeing with something she already knew.' },
];

/* ─── 04 · The Fashion Trend Engine (5 Stages) ─────────────────────── */
const FASHION_TREND_STAGES = [
  { stage: 1, name: 'Underground', color: T.orchid,
    who: 'Tier 5–6 creators experimenting, street style icons',
    feed: 'Invisible to most of the Feed — too niche to surface',
    story: 'The character who found it here and didn\'t tell anyone. That decision is the story.' },
  { stage: 2, name: 'Rising', color: T.mint,
    who: 'Micro-creators adopting and spreading the aesthetic',
    feed: 'Starting to appear in interest clusters',
    story: 'The moment it could still be yours if you moved fast enough.' },
  { stage: 3, name: 'Mainstream', color: T.gold,
    who: 'Tier 3–4 major influencers adopting',
    feed: 'Algorithm starts pushing it — suddenly everywhere',
    story: 'The creators who were early watch it get credited to someone else.' },
  { stage: 4, name: 'Saturation', color: T.rose,
    who: 'Everyone — trend has no owner left',
    feed: 'Feed oversaturated — engagement dropping on trend content',
    story: 'The trend becomes invisible by being everywhere. The early adopter moves on.' },
  { stage: 5, name: 'Replacement', color: T.steel,
    who: 'New underground trend emerging as the old one dies',
    feed: 'Saturation content drops; new aesthetic starts appearing at the edges',
    story: 'Back to Stage 1. But now the cycle is faster than it was before.' },
];

/* ─── 05 · The Beauty Trend Engine (4 Stages) ──────────────────────── */
const BEAUTY_TREND_STAGES = [
  { stage: 1, name: 'Salon Discovery', color: T.orchid,
    where: 'Professionals invent techniques — lash studios, skin clinics, nail artists',
    story: 'The technique exists but has no name yet. The artist who invented it is anonymous.' },
  { stage: 2, name: 'Creator Demonstration', color: T.mint,
    where: 'Beauty influencers show tutorials — often before the product exists commercially',
    story: 'The tutorial that went viral before the brand caught up. The creator who made the brand.' },
  { stage: 3, name: 'Product Launch', color: T.gold,
    where: 'Brands formalize the technique into a product and release it',
    story: 'The brand that took the salon artist\'s technique and sold it back to her audience.' },
  { stage: 4, name: 'Viral Adoption', color: T.rose,
    where: 'Trend spreads across feeds — everyone doing their version',
    story: 'The technique now belongs to nobody. The Glow Gazette writes the history wrong.' },
];

/* ─── 06 · Cultural Momentum Waves (5 Event Types) ─────────────────── */
const MOMENTUM_WAVES = [
  { event: 'Award Wins', icon: '🏆', color: T.gold,
    feedEffect: 'Immediate career trajectory jump. Every brand reassesses.',
    duration: '1–2 weeks of peak attention',
    permanent: 'The winner\'s tier. They move up. The snubbed nominee\'s relationship to the institution.' },
  { event: 'Viral Scandals', icon: '🔥', color: T.rose,
    feedEffect: 'Feed dominance — pushes everything else out.',
    duration: '3–7 days peak, residual for months',
    permanent: 'The creator\'s public identity. Before-scandal and after-scandal are different people.' },
  { event: 'Celebrity Collaborations', icon: '🤝', color: T.steel,
    feedEffect: 'Audience crossover — both creators gain from the other\'s reach.',
    duration: '2 weeks of collab momentum',
    permanent: 'Proof of legitimacy for the lower-tier creator. Association as currency.' },
  { event: 'Surprise Partnerships', icon: '🎁', color: T.orchid,
    feedEffect: 'The reveal is the content — speculation, reaction, analysis.',
    duration: '1 week of reaction content',
    permanent: 'Market positioning. What this brand thinks of this creator, made public.' },
  { event: 'Platform Changes', icon: '⚙️', color: T.amber,
    feedEffect: 'Entire creator class responds — some gain, most scramble.',
    duration: 'Ongoing — creeping anxiety',
    permanent: 'Who built on the platform vs. who built the audience. The platform can change. The audience moves.' },
];

/* ─── 07 · Social Influence Power (3 Forces) ───────────────────────── */
const INFLUENCE_FORCES = [
  { force: 'Reach', icon: '📡', color: T.steel,
    definition: 'Follower count — the size of the audience that can see the message',
    built: 'Consistent content, viral moments, algorithm favor, collabs',
    destroys: 'Platform changes, account bans, audience aging out of the platform' },
  { force: 'Authority', icon: '🏛️', color: T.gold,
    definition: 'Trust and expertise — the audience believes what this creator says',
    built: 'Accuracy, consistency between public and private, track record of being right',
    destroys: 'Being caught wrong publicly, scandal that breaks authenticity, paid content that betrays trust' },
  { force: 'Cultural Impact', icon: '🌊', color: T.orchid,
    definition: 'The ability to start trends — when this creator moves, the culture moves with them',
    built: 'Being early, being right, being bold at the right moment',
    destroys: 'Becoming predictable, being copied so widely your origin point is forgotten, staying too long' },
];

/* ─── 08 · Cultural Legacy (5 Signals) ─────────────────────────────── */
const LEGACY_SIGNALS = [
  { signal: 'Defining a Major Trend', icon: '🌟', color: T.gold,
    looksLike: 'The trend is permanently associated with their name even after saturation',
    story: 'They became the reference. Everyone who comes after is compared to them.' },
  { signal: 'Winning Multiple Awards', icon: '🏆', color: T.rose,
    looksLike: 'Starlight Awards across multiple years or categories',
    story: 'Institution recognition. The culture agreed, in public, on the record.' },
  { signal: 'Influencing Entire Industries', icon: '🏗️', color: T.steel,
    looksLike: 'Other creators structure their careers around what this person built',
    story: 'The mentor relationship at scale. Their influence is anonymous — everywhere and invisible.' },
  { signal: 'Surviving a Major Controversy', icon: '🔥', color: T.amber,
    looksLike: 'Coming back after being cancelled — stronger, more authentic, more trusted',
    story: 'The audience learned something about who they are in the crisis. So did the creator.' },
  { signal: 'Becoming a Reference Point', icon: '📌', color: T.orchid,
    looksLike: 'The culture cites them to explain other things — \'she\'s the new [legacy creator]\'',
    story: 'Canonized. The archivist doesn\'t need to preserve them. The culture already did.' },
];

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function InfluencerSystems() {
  const [tab, setTab] = useState('archetypes');

  return (
    <div className="is-shell">
      <header className="is-header">
        <h1>Influencer Systems & Mechanics</h1>
        <p>Doc 03 — franchise_law · always_inject — Archetypes, relationships, economy, trends, momentum, influence, legacy</p>
        <nav className="is-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`is-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="is-content">
        {tab === 'archetypes'    && <ArchetypesView />}
        {tab === 'relationships' && <RelationshipsView />}
        {tab === 'economy'       && <EconomyView />}
        {tab === 'fashion-trend' && <FashionTrendView />}
        {tab === 'beauty-trend'  && <BeautyTrendView />}
        {tab === 'momentum'      && <MomentumView />}
        {tab === 'influence'     && <InfluenceView />}
        {tab === 'legacy'        && <LegacyView />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   01 · ARCHETYPES VIEW — 15 Personality Archetypes
   ═══════════════════════════════════════════════════════════════════════ */

function ArchetypesView() {
  const [expanded, setExpanded] = useState(null);
  return (
    <>
      <h2 className="is-section-title">The 15 Influencer Personality Archetypes</h2>
      <p className="is-section-desc">
        Every major creator tends to fall into one of these patterns. A creator can carry more than one archetype — the tension between two archetypes in the same person is often the story.
      </p>
      <div className="is-archetype-grid">
        {ARCHETYPES.map(a => (
          <div
            className={`is-archetype-card${expanded === a.num ? ' expanded' : ''}`}
            key={a.num}
            style={{ borderTopColor: a.color }}
            onClick={() => setExpanded(expanded === a.num ? null : a.num)}
          >
            <div className="is-archetype-header">
              <span className="is-archetype-num" style={{ color: a.color }}>{a.num}</span>
              <span className="is-archetype-icon">{a.icon}</span>
            </div>
            <h3 className="is-archetype-name">{a.name}</h3>
            <p className="is-archetype-content"><strong>Content:</strong> {a.content}</p>
            {expanded === a.num && (
              <div className="is-archetype-detail">
                <div className="is-archetype-row">
                  <span className="is-archetype-label">Audience Effect</span>
                  <span>{a.audience}</span>
                </div>
                <div className="is-archetype-row">
                  <span className="is-archetype-label">Narrative Function</span>
                  <em>{a.narrative}</em>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   02 · RELATIONSHIPS VIEW — Social Relationship Graph
   ═══════════════════════════════════════════════════════════════════════ */

function RelationshipsView() {
  return (
    <>
      <h2 className="is-section-title">The Social Relationship Graph</h2>
      <p className="is-section-desc">
        Creators are connected through five relationship types. Every relationship type has its own narrative metabolism — what it produces, what it costs, what happens when it breaks.
      </p>
      <div className="is-rel-list">
        {RELATIONSHIP_TYPES.map(r => (
          <div className="is-rel-card" key={r.type} style={{ borderLeftColor: r.color }}>
            <div className="is-rel-header">
              <span className="is-rel-icon">{r.icon}</span>
              <h3 className="is-rel-type">{r.type}</h3>
            </div>
            <div className="is-rel-grid">
              <div className="is-rel-cell">
                <span className="is-rel-label">What It Looks Like</span>
                <p>{r.looksLike}</p>
              </div>
              <div className="is-rel-cell">
                <span className="is-rel-label">What It Creates</span>
                <p>{r.creates}</p>
              </div>
              <div className="is-rel-cell">
                <span className="is-rel-label">What Breaks It</span>
                <p>{r.breaks}</p>
              </div>
            </div>
            <div className="is-rel-story">
              <span className="is-rel-label">Story When It Breaks</span>
              <em>{r.storyBreaks}</em>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   03 · ECONOMY VIEW — Creator Economy System
   ═══════════════════════════════════════════════════════════════════════ */

function EconomyView() {
  return (
    <>
      <h2 className="is-section-title">The Creator Economy System</h2>
      <p className="is-section-desc">
        Creators generate income through multiple streams. How a creator earns reveals who they are — what they're willing to do, what they protect, and what they're pretending not to need.
      </p>
      <div className="is-economy-grid">
        {ECONOMY_STREAMS.map(e => (
          <div className="is-economy-card" key={e.stream} style={{ borderTopColor: e.color }}>
            <div className="is-economy-icon">{e.icon}</div>
            <h3 className="is-economy-name">{e.stream}</h3>
            <p className="is-economy-what">{e.what}</p>
            <div className="is-economy-meta">
              <span className="is-economy-label">Who</span>
              <span>{e.who}</span>
            </div>
            <div className="is-economy-narrative">
              <em>{e.narrative}</em>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   04 · FASHION TREND VIEW — 5-Stage Cycle
   ═══════════════════════════════════════════════════════════════════════ */

function FashionTrendView() {
  return (
    <>
      <h2 className="is-section-title">The Fashion Trend Engine</h2>
      <p className="is-section-desc">
        Fashion spreads through a five-stage cycle. Where a character sits in this cycle determines whether they're a leader, a follower, or someone who missed it entirely.
      </p>
      <div className="is-trend-pipeline">
        {FASHION_TREND_STAGES.map((s, i) => (
          <React.Fragment key={s.stage}>
            <div className="is-trend-stage" style={{ borderTopColor: s.color }}>
              <div className="is-trend-badge" style={{ background: s.color }}>{s.stage}</div>
              <h3 className="is-trend-name">{s.name}</h3>
              <div className="is-trend-row">
                <span className="is-trend-label">Who</span>
                <span>{s.who}</span>
              </div>
              <div className="is-trend-row">
                <span className="is-trend-label">Feed</span>
                <span>{s.feed}</span>
              </div>
              <div className="is-trend-story"><em>{s.story}</em></div>
            </div>
            {i < FASHION_TREND_STAGES.length - 1 && (
              <div className="is-trend-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   05 · BEAUTY TREND VIEW — 4-Stage Cycle
   ═══════════════════════════════════════════════════════════════════════ */

function BeautyTrendView() {
  return (
    <>
      <h2 className="is-section-title">The Beauty Trend Engine</h2>
      <p className="is-section-desc">
        Beauty trends spread differently from fashion — they originate in professional spaces before they reach the Feed. The distance between invention and adoption is the story.
      </p>
      <div className="is-trend-pipeline is-trend-pipeline--beauty">
        {BEAUTY_TREND_STAGES.map((s, i) => (
          <React.Fragment key={s.stage}>
            <div className="is-trend-stage" style={{ borderTopColor: s.color }}>
              <div className="is-trend-badge" style={{ background: s.color }}>{s.stage}</div>
              <h3 className="is-trend-name">{s.name}</h3>
              <div className="is-trend-row">
                <span className="is-trend-label">Where</span>
                <span>{s.where}</span>
              </div>
              <div className="is-trend-story"><em>{s.story}</em></div>
            </div>
            {i < BEAUTY_TREND_STAGES.length - 1 && (
              <div className="is-trend-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   06 · MOMENTUM VIEW — Cultural Momentum Waves
   ═══════════════════════════════════════════════════════════════════════ */

function MomentumView() {
  return (
    <>
      <h2 className="is-section-title">Cultural Momentum Waves</h2>
      <p className="is-section-desc">
        Some moments cause massive global attention — they dominate the Feed and reshape what's possible for every character in range.
      </p>
      <div className="is-momentum-list">
        {MOMENTUM_WAVES.map(m => (
          <div className="is-momentum-card" key={m.event} style={{ borderLeftColor: m.color }}>
            <div className="is-momentum-header">
              <span className="is-momentum-icon">{m.icon}</span>
              <h3 className="is-momentum-event">{m.event}</h3>
              <span className="is-momentum-duration" style={{ color: m.color }}>{m.duration}</span>
            </div>
            <div className="is-momentum-body">
              <div className="is-momentum-row">
                <span className="is-momentum-label">Feed Effect</span>
                <span>{m.feedEffect}</span>
              </div>
              <div className="is-momentum-permanent">
                <span className="is-momentum-label">What It Changes Permanently</span>
                <em>{m.permanent}</em>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   07 · INFLUENCE VIEW — Social Influence Power (3 Forces)
   ═══════════════════════════════════════════════════════════════════════ */

function InfluenceView() {
  return (
    <>
      <h2 className="is-section-title">Social Influence Power</h2>
      <p className="is-section-desc">
        Influence grows through three forces. A creator who is strong in all three is nearly unstoppable. A creator who is strong in only one is always vulnerable.
      </p>
      <div className="is-influence-grid">
        {INFLUENCE_FORCES.map(f => (
          <div className="is-influence-card" key={f.force} style={{ borderTopColor: f.color }}>
            <div className="is-influence-icon" style={{ color: f.color }}>{f.icon}</div>
            <h3 className="is-influence-name">{f.force}</h3>
            <p className="is-influence-def">{f.definition}</p>
            <div className="is-influence-row">
              <span className="is-influence-label">How It's Built</span>
              <span>{f.built}</span>
            </div>
            <div className="is-influence-row is-influence-destroys">
              <span className="is-influence-label">What Destroys It</span>
              <span>{f.destroys}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   08 · LEGACY VIEW — Cultural Legacy Signals
   ═══════════════════════════════════════════════════════════════════════ */

function LegacyView() {
  return (
    <>
      <h2 className="is-section-title">Cultural Legacy</h2>
      <p className="is-section-desc">
        Some creators become permanent cultural icons. This status is rare and irreversible — it outlasts the platform, the trend cycle, and the creator's active posting period.
      </p>
      <div className="is-legacy-list">
        {LEGACY_SIGNALS.map(l => (
          <div className="is-legacy-card" key={l.signal} style={{ borderLeftColor: l.color }}>
            <div className="is-legacy-header">
              <span className="is-legacy-icon">{l.icon}</span>
              <h3 className="is-legacy-signal">{l.signal}</h3>
            </div>
            <p className="is-legacy-looks">{l.looksLike}</p>
            <div className="is-legacy-story">
              <em>{l.story}</em>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
