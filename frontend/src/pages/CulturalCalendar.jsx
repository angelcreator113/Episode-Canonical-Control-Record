import React, { useState, useEffect, useCallback } from 'react';
import './CulturalCalendar.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList } from '../components/EditItemModal';
import PushToBrain from '../components/PushToBrain';

/* ═══════════════════════════════════════════════════════════════════════
   CulturalCalendar.jsx — LalaVerse Cultural & Social Systems v2.0
   ═══════════════════════════════════════════════════════════════════════
   franchise_law · always_inject
   24 major events · 13 micro events · 5 icon birthdays
   + Celebrity Hierarchy · Social Algorithm · Drama Mechanics · Famous 25
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Design Palette ─────────────────────────────────────────────────────
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

const CAT_COLORS = {
  fashion:       { bg: '#fdf2f6', border: T.rose,   text: '#9c3d62' },
  beauty:        { bg: '#f6f0fc', border: T.orchid,  text: '#6b4d8a' },
  entertainment: { bg: '#eef6fb', border: T.steel,   text: '#3d6e8a' },
  lifestyle:     { bg: '#f0faf5', border: T.mint,    text: '#3a7d60' },
  community:     { bg: '#fdf8ee', border: T.gold,    text: '#8a7030' },
  technology:    { bg: '#fcf0e8', border: T.amber,   text: '#7a5a30' },
};

const SEVERITY_LABEL = { critical: '★★★', high: '★★', medium: '★', low: '·' };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ─── Tabs ──────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'timeline',  label: 'Timeline' },
  { id: 'awards',    label: 'Awards' },
  { id: 'micro',     label: 'Feed Events' },
];

/* ─── Celebrity & Creator Hierarchy (6 Tiers) ──────────────────────── */
const CELEBRITY_HIERARCHY = [
  { tier: 1, name: 'Cultural Icons',    followers: '10M+',     color: T.gold,
    desc: 'Platform-defining figures. Define trends. Headline global events. Their opinion reshapes the Feed.' },
  { tier: 2, name: 'Industry Titans',   followers: '5M–10M',   color: T.rose,
    desc: 'Major designers, beauty founders, entertainment stars. Shape industry direction. Sponsor major events.' },
  { tier: 3, name: 'Major Influencers', followers: '1M–5M',    color: T.orchid,
    desc: 'Fashion creators, lifestyle influencers. Move culture at scale. Front row at everything.' },
  { tier: 4, name: 'Rising Creators',   followers: '100K–1M',  color: T.steel,
    desc: 'Viral creators, niche experts. The dangerous tier — where careers accelerate or collapse.' },
  { tier: 5, name: 'Micro Creators',    followers: '10K–100K', color: T.mint,
    desc: 'Niche community creators. Deep trust, narrow reach. Brands court them for authenticity.' },
  { tier: 6, name: 'Everyday Creators', followers: '0–10K',    color: T.amber,
    desc: 'Local personalities, hobby creators. The origin of culture. Everything starts here.' },
];

/* ─── Fashion Industry Hierarchy (5 Tiers) ─────────────────────────── */
const FASHION_TIERS = [
  { tier: 1, name: 'Legendary Designers', color: T.gold,
    desc: 'Couture houses, global designers, style icons who define the culture.',
    examples: 'Control trends. Headline Velvet Season. Dominate the Atelier Circuit.' },
  { tier: 2, name: 'Fashion Houses', color: T.rose,
    desc: 'Large clothing companies, luxury labels, established brands.',
    examples: 'Influence seasonal aesthetics. Sponsor major events.' },
  { tier: 3, name: 'Stylists', color: T.orchid,
    desc: 'Image creators who work with celebrities, influencers, and campaigns.',
    examples: 'They decide what the Tier 1s wear. Their aesthetic becomes canon.' },
  { tier: 4, name: 'Fashion Creators', color: T.steel,
    desc: 'Online fashion influencers, outfit creators, style bloggers.',
    examples: 'Move product. Create desire. Tier 1s watch them for taste signals.' },
  { tier: 5, name: 'Street Style Icons', color: T.mint,
    desc: 'Emerging trendsetters, often discovered during Outfit Games and Style Market.',
    examples: 'Before the trend is a trend, it\'s on their back.' },
];

/* ─── Beauty Industry Ecosystem (5 Tiers) ──────────────────────────── */
const BEAUTY_TIERS = [
  { tier: 1, name: 'Beauty Empires', color: T.gold,
    desc: 'Major cosmetics and skincare companies that define the category.',
    examples: 'Their launches become cultural events. Glow Week belongs to them.' },
  { tier: 2, name: 'Beauty Labs', color: T.rose,
    desc: 'Innovation companies developing ingredients, formulas, and tools.',
    examples: 'Emerging brands partner with them to establish credibility.' },
  { tier: 3, name: 'Salon Owners', color: T.orchid,
    desc: 'Local beauty powerhouses — lash studios, nail salons, skin clinics.',
    examples: 'The look starts in their chair before it\'s on the Feed.' },
  { tier: 4, name: 'Beauty Creators', color: T.steel,
    desc: 'Makeup artists, skincare influencers, tutorial creators.',
    examples: 'Their reviews move product. Brands court them constantly.' },
  { tier: 5, name: 'Beauty Students', color: T.mint,
    desc: 'Emerging talent, often discovered during Glow Week.',
    examples: 'One viral moment changes everything.' },
];

/* ─── Social Algorithm System (4 Forces) ───────────────────────────── */
const ALGORITHM_FORCES = [
  { name: 'Engagement Energy', icon: '⚡', color: T.rose,
    measuredBy: 'Comments, shares, saves — active signals',
    effect: 'High engagement = higher distribution',
    storyHook: 'A post that sparks argument spreads further than one that gets likes.' },
  { name: 'Trend Alignment', icon: '🎯', color: T.orchid,
    measuredBy: 'Connection to current cultural events',
    effect: 'Event-aligned content gets boosted during that event',
    storyHook: 'Posting off-cycle gets buried.' },
  { name: 'Creator Momentum', icon: '🔄', color: T.steel,
    measuredBy: 'Consistency of posting cadence',
    effect: 'Consistent accounts gain algorithmic favor',
    storyHook: 'A creator who disappears for two weeks loses ground another creator took.' },
  { name: 'Network Clusters', icon: '🔗', color: T.mint,
    measuredBy: 'Fashion, beauty, entertainment, fitness circles',
    effect: 'Content boosted within relevant community',
    storyHook: 'A post that breaks its cluster and enters a new one is a cultural moment.' },
];

/* ─── Social Drama Mechanics (5 Types) ─────────────────────────────── */
const DRAMA_MECHANICS = [
  { type: 'Breakups', icon: '💔', color: T.rose,
    trigger: 'Relationship splits going public',
    feedEffect: 'Massive attention spike — audiences choose sides',
    storyThread: 'Who knew before the post. Who pretended to be surprised.' },
  { type: 'Feuds', icon: '⚔️', color: T.amber,
    trigger: 'Creator disagreements — public or leaked',
    feedEffect: 'Viral debates, ratio wars, fan armies mobilizing',
    storyThread: 'What started it privately vs. what the public sees.' },
  { type: 'Public Apologies', icon: '🕊️', color: T.steel,
    trigger: 'Controversy leading to accountability post',
    feedEffect: 'Curiosity + judgment + counter-commentary',
    storyThread: 'Whether the apology is real or strategic is always the subtext.' },
  { type: 'Rivalries', icon: '🏆', color: T.gold,
    trigger: 'Competitors pursuing the same space',
    feedEffect: 'Fans organize, comparisons trend',
    storyThread: 'The rivalry the audience invented vs. the relationship they actually have.' },
  { type: 'Scandals', icon: '🔥', color: T.orchid,
    trigger: 'Leaks, rumors, accusations',
    feedEffect: 'Feed-dominating — pushes everything else out',
    storyThread: 'What is true, what is exaggerated, who benefits from the timing.' },
];

/* ─── Award Systems (4 Major Shows — Doc 02) ──────────────────────── */
const AWARD_SHOWS = [
  { name: 'Starlight Awards', month: 'November', icon: '✨', color: T.gold,
    desc: 'The main event. Creator recognition across all categories.',
    categories: [
      'Creator of the Year', 'Fashion Icon', 'Beauty Innovator',
      'Storyteller of the Year', 'Breakout Creator', 'Entrepreneur of the Year',
    ] },
  { name: 'Style Crown Awards', month: 'March', icon: '👑', color: T.rose,
    desc: 'Fashion industry recognition.',
    categories: [
      'Best Stylist', 'Best Outfit Creator', 'Best Designer',
      'Best Brand Collaboration', 'Street Style Icon of the Year',
    ] },
  { name: 'Glow Honors', month: 'September', icon: '🌟', color: T.orchid,
    desc: 'Beauty creator recognition.',
    categories: [
      'Best Makeup Artist', 'Best Skincare Creator', 'Best Beauty Brand',
      'Best Tutorial Series', 'Glow Innovator of the Year',
    ] },
  { name: 'Viral Impact Awards', month: 'July', icon: '🚀', color: T.steel,
    desc: 'Internet culture, viral moments, meme-ability.',
    categories: [
      'Most Viral Moment', 'Funniest Creator', 'Most Influential Post',
      'Best Comeback', 'Community Builder of the Year',
    ] },
];

/* ─── Gossip Media Networks (5 Outlets — with Power column) ────────── */
const MEDIA_STYLE_COLORS = {
  editorial:      { bg: '#fce8ef', text: '#9c3d62' },
  'review-driven': { bg: '#ece4f6', text: '#6b4d8a' },
  gossip:         { bg: '#fdf3dc', text: '#8a7030' },
  trending:       { bg: '#dff0fa', text: '#3d6e8a' },
  analytical:     { bg: '#e3f5ec', text: '#3a7d60' },
};

const GOSSIP_MEDIA = [
  { name: 'The Velvet Report', focus: 'Fashion & luxury culture', style: 'editorial',
    covers: 'Velvet Season, Atelier Circuit, Tier 1–2 fashion news',
    power: 'Being ignored by Velvet Report is its own story.',
    color: { bg: '#fdf2f6', text: '#9c3d62' } },
  { name: 'Glow Gazette', focus: 'Beauty industry', style: 'review-driven',
    covers: 'Glow Week, beauty brand launches, salon trend reports',
    power: 'A Glow Gazette review can make or break a product launch.',
    color: { bg: '#f6f0fc', text: '#6b4d8a' } },
  { name: 'The Whisper Wire', focus: 'Celebrity & influencer gossip', style: 'gossip',
    covers: 'Relationship drama, feuds, who unfollowed who',
    power: 'The Whisper Wire always knows. The question is when they publish.',
    color: { bg: '#fdf8ee', text: '#8a7030' } },
  { name: 'Pop Prism', focus: 'Entertainment & pop culture', style: 'trending',
    covers: 'Music creators, viral moments, Cloud Carnival',
    power: 'Pop Prism decides what becomes a cultural reference point.',
    color: { bg: '#eef6fb', text: '#3d6e8a' } },
  { name: 'Trend Telescope', focus: 'Trend forecasting', style: 'analytical',
    covers: 'Trend Summit coverage, upcoming aesthetics, emerging creators',
    power: 'Being predicted by Trend Telescope before you peak is the signal.',
    color: { bg: '#f0faf5', text: '#3a7d60' } },
];

/* ─── The 25 Most Famous Characters ────────────────────────────────── */
const FAMOUS_CHARACTERS = [
  { rank: 1,  title: 'The Style Queen',         role: 'Defines what is fashionable. Her opinion reshapes the Feed.', icon: '👑', color: T.rose },
  { rank: 2,  title: 'The Glow Guru',           role: 'Defines beauty standards. Her recommendations sell out in hours.', icon: '✨', color: T.orchid },
  { rank: 3,  title: 'The Creator King',         role: 'Represents success culture. Entrepreneurs model themselves on him.', icon: '🎯', color: T.gold },
  { rank: 4,  title: 'The Trend Oracle',         role: 'Predicts cultural shifts before they happen. Always right, always cryptic.', icon: '🔮', color: T.orchid },
  { rank: 5,  title: 'The Fashion Rebel',        role: 'Breaks every rule the Style Queen sets. The counterculture anchor.', icon: '⚡', color: T.rose },
  { rank: 6,  title: 'The Beauty Scientist',     role: 'Makes beauty intellectual. Evidence-based, not aspirational.', icon: '🔬', color: T.mint },
  { rank: 7,  title: 'The Street Style Icon',    role: 'Lives at the origin of trends before they have names.', icon: '🌆', color: T.amber },
  { rank: 8,  title: 'The Meme Monarch',         role: 'Turns every cultural moment into a joke that outlasts the moment.', icon: '😂', color: T.steel },
  { rank: 9,  title: 'The Nightlife Queen',      role: 'Controls what happens after midnight in LalaVerse.', icon: '🌙', color: T.orchid },
  { rank: 10, title: 'The Viral Comedian',       role: 'Makes the platform laugh. Laughter is its own kind of power.', icon: '🎭', color: T.steel },
  { rank: 11, title: 'The Wellness Prophet',     role: 'The counter-narrative to hustle culture. Rest as resistance.', icon: '🧘', color: T.mint },
  { rank: 12, title: 'The Design Genius',        role: 'Solves problems beautifully. Aesthetics and function together.', icon: '✏️', color: T.amber },
  { rank: 13, title: 'The Pop Star Creator',     role: 'Crosses music and content. Two audiences become one.', icon: '🎵', color: T.rose },
  { rank: 14, title: 'The Gossip Empress',       role: 'Knows everything. Shares it strategically. Never wrong.', icon: '👄', color: T.gold },
  { rank: 15, title: 'The Digital Mogul',        role: 'Built an empire from content. The proof that it\'s possible.', icon: '💎', color: T.gold },
  { rank: 16, title: 'The Travel Queen',         role: 'Makes the world feel accessible and aspirational simultaneously.', icon: '✈️', color: T.steel },
  { rank: 17, title: 'The Fitness Titan',        role: 'Physical transformation as identity. The body as project.', icon: '💪', color: T.mint },
  { rank: 18, title: 'The Chef Creator',         role: 'Food as culture, not just content. Elevates the everyday.', icon: '🍳', color: T.amber },
  { rank: 19, title: 'The Art Visionary',        role: 'Makes the platform take beauty seriously.', icon: '🎨', color: T.orchid },
  { rank: 20, title: 'The Photographer Legend',  role: 'Documents LalaVerse. Everything important is in their archive.', icon: '📸', color: T.steel },
  { rank: 21, title: 'The Music Architect',      role: 'Builds sonic worlds, not just songs.', icon: '🎧', color: T.rose },
  { rank: 22, title: 'The Storytelling Master',  role: 'Narrative above everything. Makes content feel like literature.', icon: '📖', color: T.orchid },
  { rank: 23, title: 'The Culture Commentator',  role: 'Names what everyone is feeling but hasn\'t articulated yet.', icon: '🗣️', color: T.gold },
  { rank: 24, title: 'The Creator Mentor',       role: 'Grows other creators. Legacy through multiplication.', icon: '🤝', color: T.mint },
  { rank: 25, title: 'The Fashion Archivist',    role: 'Preserves what the Feed forgets. Memory as power.', icon: '📚', color: T.amber },
];

/* ─── Birthday Templates (5 Icons) ─────────────────────────────────── */
const BIRTHDAY_TEMPLATES = [
  { name: 'The Style Queen',  icon: '👑', community: 'Fashion',
    desc: 'Themed outfit posts across the Feed. Her aesthetic becomes a challenge.' },
  { name: 'The Glow Guru',    icon: '✨', community: 'Beauty',
    desc: 'Tutorial tributes honoring her techniques. Beauty creators compete.' },
  { name: 'The Creator King',  icon: '🎯', community: 'Entrepreneur',
    desc: 'Mentorship content. Creators share how he influenced their path.' },
  { name: 'The Icon Twins',    icon: '♊', community: 'All Communities',
    desc: 'Two legendary influencers born the same day. The annual debate: which one is greater?' },
  { name: 'The Founder Day',   icon: '🌟', community: 'Platform-wide',
    desc: 'Celebrates LalaVerse\'s creation. Every creator participates.' },
];

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const DEFAULTS = {
  CELEBRITY_HIERARCHY, FASHION_TIERS, BEAUTY_TIERS,
  ALGORITHM_FORCES, DRAMA_MECHANICS, AWARD_SHOWS,
  GOSSIP_MEDIA, FAMOUS_CHARACTERS, BIRTHDAY_TEMPLATES,
};

export default function CulturalCalendar() {
  const [tab, setTab]             = useState('timeline');
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editItem, setEditItem]   = useState(null);
  const [shows, setShows]         = useState([]);
  const [spawning, setSpawning]   = useState(null);
  const [spawnResult, setSpawnResult] = useState(null);

  const { data, updateItem, addItem, removeItem, saving } = usePageData('cultural_calendar', DEFAULTS);

  // Fetch shows for event creation
  useEffect(() => {
    fetch('/api/v1/shows').then(r => r.json()).then(d => setShows(d.data || [])).catch(() => {});
  }, []);

  // Create world event from calendar event
  const handleCreateEvent = async (calendarEvent) => {
    const showId = shows[0]?.id;
    if (!showId) { alert('No show found — create a show first'); return; }
    setSpawning(calendarEvent.id);
    setSpawnResult(null);
    try {
      const res = await fetch(`/api/v1/calendar/events/${calendarEvent.id}/auto-spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id: showId, event_count: 1, max_guests: 6 }),
      });
      const data = await res.json();
      if (data.success) {
        setSpawnResult({ type: 'success', message: `Created "${data.data.events[0]?.name}" with host and guest list — check Events Library` });
      } else {
        setSpawnResult({ type: 'error', message: data.error || 'Failed to create event' });
      }
    } catch (err) {
      setSpawnResult({ type: 'error', message: err.message });
    }
    setSpawning(null);
  };

  /* ── Fetch events from API ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/calendar/events?event_type=lalaverse_cultural');
        const data = await res.json();
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        console.error('[CulturalCalendar] fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Group events by month for timeline ── */
  const byMonth = useCallback(() => {
    const map = {};
    MONTHS.forEach((_, i) => { map[i] = []; });
    events.forEach(ev => {
      if (ev.is_micro_event) return;
      const d = new Date(ev.start_datetime);
      const m = d.getUTCMonth();
      if (map[m]) map[m].push(ev);
    });
    return map;
  }, [events]);

  const microEvents = events.filter(e => e.is_micro_event);
  const majorEvents = events.filter(e => !e.is_micro_event);

  const toggle = id => setExpandedId(prev => (prev === id ? null : id));

  /* ── Render ── */
  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div className="cc-shell">
      <header className="cc-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>Cultural Calendar</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saving && <span className="eim-saving">Saving…</span>}
            <PushToBrain pageName="cultural_calendar" data={data} />
          </span>
        </div>
        <p>LalaVerse Cultural & Social Systems — franchise_law · always_inject</p>
        <nav className="cc-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`cc-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="cc-content">
        {spawnResult && (
          <div style={{ padding: '10px 16px', margin: '0 0 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: spawnResult.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: spawnResult.type === 'success' ? '#2e7d32' : '#c62828',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{spawnResult.message}</span>
            <button onClick={() => setSpawnResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}
        {loading && <div className="cc-loading">Loading cultural events…</div>}

        {!loading && tab === 'timeline' && (
          <TimelineView byMonth={byMonth()} toggle={toggle}
            expandedId={expandedId} majorCount={majorEvents.length}
            microCount={microEvents.length} totalCount={events.length} data={data}
            onCreateEvent={handleCreateEvent} spawning={spawning} />
        )}
        {!loading && tab === 'hierarchy' && <HierarchyView />}
        {!loading && tab === 'industries' && <IndustriesView />}
        {!loading && tab === 'awards'     && <AwardsView />}
        {!loading && tab === 'media'      && <MediaView />}
        {!loading && tab === 'algorithm'  && <AlgorithmView />}
        {!loading && tab === 'micro'      && (
          <MicroView events={microEvents} toggle={toggle} expandedId={expandedId}
            onCreateEvent={handleCreateEvent} spawning={spawning} />
        )}
        {!loading && tab === 'famous'     && <FamousView />}
      </div>

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

/* ═══════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function Stat({ n, label, color }) {
  return (
    <div className="cc-stat">
      <span className="cc-stat-number" style={{ color }}>{n}</span>
      <span className="cc-stat-label">{label}</span>
    </div>
  );
}

function EventCard({ ev, expanded, toggle, onCreateEvent }) {
  const cat = CAT_COLORS[ev.cultural_category] || CAT_COLORS.community;
  const sev = SEVERITY_LABEL[ev.severity_level] || '';
  const activities = Array.isArray(ev.activities) ? ev.activities : [];
  const phrases    = Array.isArray(ev.phrases) ? ev.phrases : [];

  return (
    <div
      className="cc-event-card"
      style={{ background: cat.bg, borderLeftColor: cat.border }}
      onClick={() => toggle(ev.id)}
    >
      <div className="cc-event-top">
        <span className="cc-event-title">{ev.title}</span>
        {sev && <span className="cc-event-severity">{sev}</span>}
      </div>
      {ev.cultural_category && (
        <span className="cc-event-cat" style={{ background: cat.bg, color: cat.text }}>
          {ev.cultural_category}
        </span>
      )}
      {ev.what_world_knows && <p className="cc-event-desc">{ev.what_world_knows}</p>}
      {expanded && (
        <div className="cc-event-expanded">
          {ev.what_only_we_know && <p className="cc-event-secret">{ev.what_only_we_know}</p>}
          {activities.length > 0 && (
            <div className="cc-event-tags">
              {activities.map((a, i) => <span key={i} className="cc-event-tag">{a}</span>)}
            </div>
          )}
          {phrases.length > 0 && (
            <div className="cc-event-phrases">
              {phrases.map((p, i) => <span key={i} className="cc-phrase">{p}</span>)}
            </div>
          )}
          {onCreateEvent && (
            <button
              className="cc-event-create-btn"
              onClick={(e) => { e.stopPropagation(); onCreateEvent(ev); }}
            >
              🎉 Create Event from This
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TierPanel({ title, icon, tiers, constantKey }) {
  return (
    <div className="cc-industry-panel">
      <h3 className="cc-industry-title">{icon} {title}</h3>
      <EditableList constantKey={constantKey} defaults={tiers} label={`Add ${title} Tier`}>
        {(t) => (
        <div className="cc-tier">
          <div className="cc-tier-badge" style={{ background: t.color }}>{t.tier}</div>
          <div className="cc-tier-info">
            <h4>{t.name}</h4>
            <p>{t.desc}</p>
            {t.examples && <span className="cc-tier-examples">{t.examples}</span>}
            {t.followers && (
              <span className="cc-tier-examples">{t.followers} followers</span>
            )}
          </div>
        </div>
        )}
      </EditableList>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TIMELINE VIEW
   ═══════════════════════════════════════════════════════════════════════ */

function TimelineView({ byMonth, toggle, expandedId, majorCount, microCount, totalCount, data, onCreateEvent, spawning }) {
  return (
    <>
      <div className="cc-stats">
        <Stat n={majorCount} label="Major Events" color={T.rose} />
        <Stat n={microCount} label="Micro Events" color={T.orchid} />
        <Stat n={totalCount} label="Total Events" color={T.steel} />
        <Stat n={(data.CELEBRITY_HIERARCHY || CELEBRITY_HIERARCHY).length} label="Status Tiers" color={T.gold} />
        <Stat n={(data.FAMOUS_CHARACTERS || FAMOUS_CHARACTERS).length} label="Famous Icons" color={T.amber} />
      </div>
      <div className="cc-timeline-grid">
        {MONTHS.map((m, i) => (
          <div className="cc-month-cell" key={i}>
            <div className="cc-month-label">{m}</div>
            <div className="cc-month-events">
              {byMonth[i] && byMonth[i].length > 0 ? (
                byMonth[i].map(ev => (
                  <EventCard key={ev.id} ev={ev} expanded={expandedId === ev.id} toggle={toggle} onCreateEvent={onCreateEvent} />
                ))
              ) : (
                <div className="cc-month-empty">No major events</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HIERARCHY VIEW — Celebrity & Creator 6-Tier System
   ═══════════════════════════════════════════════════════════════════════ */

function HierarchyView() {
  return (
    <>
      <h2 className="cc-section-title">Celebrity & Creator Hierarchy</h2>
      <p className="cc-section-desc">
        The social ecosystem operates in six status tiers based on follower count.
        Where a character sits determines what they can access, who notices them, and what cultural events mean for their arc.
      </p>
      <div className="cc-hierarchy-grid">
        <EditableList constantKey="CELEBRITY_HIERARCHY" defaults={CELEBRITY_HIERARCHY} label="Add Tier">
          {(h) => (
          <div className="cc-hierarchy-card" style={{ borderTopColor: h.color }}>
            <div className="cc-hierarchy-header">
              <span className="cc-hierarchy-badge" style={{ background: h.color }}>
                Tier {h.tier}
              </span>
              <span className="cc-hierarchy-followers" style={{ color: h.color }}>
                {h.followers}
              </span>
            </div>
            <h3 className="cc-hierarchy-name">{h.name}</h3>
            <p className="cc-hierarchy-desc">{h.desc}</p>
          </div>
          )}
        </EditableList>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INDUSTRIES VIEW — Fashion + Beauty Tier Panels
   ═══════════════════════════════════════════════════════════════════════ */

function IndustriesView() {
  return (
    <>
      <h2 className="cc-section-title">Industry Hierarchies</h2>
      <p className="cc-section-desc">
        Power structures within Fashion and Beauty industries. Where a character sits determines access, visibility, and arc.
      </p>
      <div className="cc-industries">
        <TierPanel title="Fashion Industry" icon="👗" tiers={FASHION_TIERS} constantKey="FASHION_TIERS" />
        <TierPanel title="Beauty Industry" icon="💄" tiers={BEAUTY_TIERS} constantKey="BEAUTY_TIERS" />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   AWARDS VIEW — Four Major Shows
   ═══════════════════════════════════════════════════════════════════════ */

function AwardsView() {
  return (
    <>
      <h2 className="cc-section-title">Award Systems</h2>
      <p className="cc-section-desc">
        Four major award shows, each with its own culture, politics, and snubs the Feed argues about for weeks.
      </p>
      <div className="cc-awards-grid">
        <EditableList constantKey="AWARD_SHOWS" defaults={AWARD_SHOWS} label="Add Award Show">
          {(show) => (
          <div className="cc-award-card">
            <div className="cc-award-header">
              <h3 style={{ color: show.color }}>{show.icon} {show.name}</h3>
              <div className="cc-award-meta">
                <span className="cc-award-month">{show.month}</span>
                <span>·</span>
                <span>{(show.categories || []).length} categories</span>
              </div>
              <p className="cc-award-desc">{show.desc}</p>
            </div>
            <div className="cc-award-categories">
              {(show.categories || []).map(c => (
                <div className="cc-award-category" key={c} style={{ borderLeftColor: show.color }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
          )}
        </EditableList>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MEDIA VIEW — Gossip Outlets with Power Column
   ═══════════════════════════════════════════════════════════════════════ */

function MediaView() {
  return (
    <>
      <h2 className="cc-section-title">Gossip Media Networks</h2>
      <p className="cc-section-desc">
        Five outlets cover all major events and drama. Every character has a relationship to these outlets.
      </p>
      <div className="cc-media-grid">
        <EditableList constantKey="GOSSIP_MEDIA" defaults={GOSSIP_MEDIA} label="Add Outlet">
          {(m) => {
          const styleColor = MEDIA_STYLE_COLORS[m.style] || {};
          return (
            <div className="cc-media-card">
              <h3 style={{ color: (m.color || {}).text }}>{m.name}</h3>
              <span className="cc-media-style" style={{ background: styleColor.bg, color: styleColor.text }}>
                {m.style}
              </span>
              <p className="cc-media-desc"><strong>Focus:</strong> {m.focus}</p>
              <div className="cc-media-focus">
                <strong>Covers:</strong> {m.covers}
              </div>
              <div className="cc-media-power">
                <em>{m.power}</em>
              </div>
            </div>
          );
          }}
        </EditableList>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ALGORITHM VIEW — Social Algorithm Forces + Drama Mechanics
   ═══════════════════════════════════════════════════════════════════════ */

function AlgorithmView() {
  return (
    <>
      {/* ── ALGORITHM FORCES ── */}
      <h2 className="cc-section-title">Social Algorithm System</h2>
      <p className="cc-section-desc">
        Content visibility is shaped by four forces. The story engine reads these when determining what characters see, what goes viral, and what gets buried.
      </p>
      <div className="cc-algo-grid">
        <EditableList constantKey="ALGORITHM_FORCES" defaults={ALGORITHM_FORCES} label="Add Force">
          {(f) => (
          <div className="cc-algo-card" style={{ borderTopColor: f.color }}>
            <div className="cc-algo-icon" style={{ color: f.color }}>{f.icon}</div>
            <h3 className="cc-algo-name">{f.name}</h3>
            <div className="cc-algo-row">
              <span className="cc-algo-label">Measured by</span>
              <span className="cc-algo-value">{f.measuredBy}</span>
            </div>
            <div className="cc-algo-row">
              <span className="cc-algo-label">Effect</span>
              <span className="cc-algo-value">{f.effect}</span>
            </div>
            <div className="cc-algo-hook">{f.storyHook}</div>
          </div>
          )}
        </EditableList>
      </div>

      {/* ── DRAMA MECHANICS ── */}
      <h2 className="cc-section-title" style={{ marginTop: 40 }}>Social Drama Mechanics</h2>
      <p className="cc-section-desc">
        Drama drives viral engagement. These situations consistently generate feed spikes — the algorithm amplifies them because engagement is extreme.
      </p>
      <div className="cc-drama-grid">
        <EditableList constantKey="DRAMA_MECHANICS" defaults={DRAMA_MECHANICS} label="Add Drama Type">
          {(d) => (
          <div className="cc-drama-card" style={{ borderLeftColor: d.color }}>
            <div className="cc-drama-header">
              <span className="cc-drama-icon">{d.icon}</span>
              <h4 className="cc-drama-type">{d.type}</h4>
            </div>
            <div className="cc-drama-row">
              <span className="cc-drama-label">Trigger</span>
              <span className="cc-drama-value">{d.trigger}</span>
            </div>
            <div className="cc-drama-row">
              <span className="cc-drama-label">Feed Effect</span>
              <span className="cc-drama-value">{d.feedEffect}</span>
            </div>
            <div className="cc-drama-thread">
              <span className="cc-drama-label">Story Thread</span>
              <em>{d.storyThread}</em>
            </div>
          </div>
          )}
        </EditableList>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MICRO VIEW — Floating Events + Birthdays
   ═══════════════════════════════════════════════════════════════════════ */

function MicroView({ events: microEvents, toggle, expandedId, onCreateEvent, spawning }) {
  return (
    <>
      <h2 className="cc-section-title">Micro Events</h2>
      <p className="cc-micro-intro">
        13 micro events happen frequently throughout the year. They are not anchored to a specific month — they fire when the cultural moment is right. They create viral Feed moments and short-duration story pressure.
      </p>

      {microEvents.length > 0 ? (
        <div className="cc-micro-grid">
          {microEvents.map(ev => (
            <EventCard key={ev.id} ev={ev} expanded={expandedId === ev.id} toggle={toggle} onCreateEvent={onCreateEvent} />
          ))}
        </div>
      ) : (
        <div className="cc-micro-grid">
          {['Beauty Battles','Creator Roast Night','Street Style Marathon',
            'Creator Speed Dating','Fashion Mystery Box','Midnight Music Festival',
            'The Great Glow-Up Challenge','Creator Charity Week','Creator Talent Show',
            'Community Build Week','Virtual Travel Festival','Artist Residency Month',
            'Design Lab Week',
          ].map(name => (
            <div className="cc-micro-card" key={name}>
              <h4>{name}</h4>
              <p>Floating event — fires when the cultural moment is right.</p>
            </div>
          ))}
        </div>
      )}

      {/* ── BIRTHDAYS ── */}
      <div className="cc-birthdays-section">
        <h3 className="cc-birthdays-title">🎂 Major Icon Birthdays</h3>
        <p className="cc-birthdays-desc">
          Certain characters become cultural icons. Their birthdays become mini-events that organize the Feed for days.
          Dates assigned when icon characters are generated.
        </p>
        <div className="cc-birthday-grid">
          <EditableList constantKey="BIRTHDAY_TEMPLATES" defaults={BIRTHDAY_TEMPLATES} label="Add Birthday">
            {(b) => (
            <div className="cc-birthday-card">
              <div className="cc-birthday-icon">{b.icon}</div>
              <h4>{b.name}</h4>
              <p><strong>{b.community}</strong></p>
              <p>{b.desc}</p>
            </div>
            )}
          </EditableList>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FAMOUS 25 VIEW — Character Placeholder Grid
   ═══════════════════════════════════════════════════════════════════════ */

function FamousView() {
  return (
    <>
      <h2 className="cc-section-title">The 25 Most Famous Characters</h2>
      <p className="cc-section-desc">
        These figures shape the culture of LalaVerse. All placeholders — names assigned when characters are generated through the Character Registry.
      </p>
      <div className="cc-famous-grid">
        <EditableList constantKey="FAMOUS_CHARACTERS" defaults={FAMOUS_CHARACTERS} label="Add Character">
          {(c) => (
          <div className="cc-famous-card" style={{ borderTopColor: c.color }}>
            <div className="cc-famous-rank" style={{ color: c.color }}>#{c.rank}</div>
            <div className="cc-famous-icon">{c.icon}</div>
            <h4 className="cc-famous-title">{c.title}</h4>
            <p className="cc-famous-role">{c.role}</p>
          </div>
          )}
        </EditableList>
      </div>
    </>
  );
}
