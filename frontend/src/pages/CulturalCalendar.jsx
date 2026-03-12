/* ─────────────────────────────────────────────────────────────
   CulturalCalendar.jsx — The Cultural System of the World
   A Canonical Social & Industry Calendar v1.0
   ───────────────────────────────────────────────────────────── */
import { useState, useEffect, useMemo, useCallback } from 'react';
import './CulturalCalendar.css';

const API = '/api/v1';

/* ═══════════════════════════════════════════════════════════
   PALETTE  (mirrors RelationshipEngine / WorldStudio tokens)
   ═══════════════════════════════════════════════════════════ */
const T = {
  rose: '#d4789a', roseDeep: '#b85a7c', roseFog: '#fdf2f6',
  steel: '#7ab3d4', steelDeep: '#5a93b4', steelFog: '#eef6fb',
  orchid: '#a889c8', orchidDeep: '#8a66b0', orchidFog: '#f3effa',
  gold: '#c9a84c', goldFog: '#fdf7e6',
  mint: '#6bba9a', mintFog: '#edf7f2',
  amber: '#b89060', amberFog: '#f7f0e8',
  ink: '#0f0c14', inkMid: '#3d3548', inkDim: '#7a7088', inkFaint: '#b8b0c8',
  paper: '#faf9fc', rule: '#e8e4f0',
};

/* ─── Category → color mapping ─── */
const CAT_COLORS = {
  fashion:         { c: T.rose,       bg: T.roseFog   },
  beauty:          { c: T.orchid,     bg: T.orchidFog  },
  lifestyle:       { c: T.steel,      bg: T.steelFog   },
  entrepreneur:    { c: T.gold,       bg: T.goldFog    },
  music:           { c: T.mint,       bg: T.mintFog    },
  nightlife:       { c: T.orchidDeep, bg: T.orchidFog  },
  awards:          { c: T.gold,       bg: T.goldFog    },
  creative:        { c: T.mint,       bg: T.mintFog    },
  creator_economy: { c: T.steel,      bg: T.steelFog   },
};

const SEVERITY_LABEL = {
  major:         '★',
  largest_event: '★★★ LARGEST',
  awards_peak:   '★★★ PEAK',
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const TABS = [
  { key: 'timeline',   label: 'Timeline'    },
  { key: 'industries', label: 'Industries'  },
  { key: 'awards',     label: 'Awards'      },
  { key: 'media',      label: 'Media'       },
  { key: 'micro',      label: 'Micro Events'},
];

/* ═══════════════════════════════════════════════════════════
   CANONICAL REFERENCE DATA  (franchise_law · always_inject)
   ═══════════════════════════════════════════════════════════ */

const FASHION_TIERS = [
  { tier: 1, title: 'Legendary Designers',  desc: 'The untouchable names. Their word is fashion law.',                      ex: 'Think Chanel, Valentino — but LalaVerse originals.'      },
  { tier: 2, title: 'Established Houses',   desc: 'Major brands with seasonal shows and global reach.',                    ex: 'Fashion Week headliners with loyal followings.'           },
  { tier: 3, title: 'Rising Labels',        desc: 'Independent designers making noise. Hungry and bold.',                  ex: 'Pop-up shows, viral drops, influencer collabs.'           },
  { tier: 4, title: 'Influencer Brands',    desc: 'Creator-led lines. Powered by followers, not fashion school.',          ex: 'Merch-to-brand pipelines, TikTok-first launches.'         },
  { tier: 5, title: 'Street Style Icons',   desc: 'No brand. Just taste. The ones who get photographed.',                  ex: 'Fan-favorite characters with iconic looks.'               },
];

const BEAUTY_TIERS = [
  { tier: 1, title: 'Beauty Empires',       desc: 'Mega-brands with global distribution and celebrity partnerships.',      ex: 'Think Fenty, Rare Beauty — but LalaVerse originals.'      },
  { tier: 2, title: 'Cult Brands',          desc: 'Indie darlings with devoted communities.',                              ex: 'Skincare obsessives, clean beauty evangelists.'            },
  { tier: 3, title: 'Influencer Lines',     desc: 'Creator-launched beauty brands riding their platform.',                 ex: 'YouTube-to-Sephora pipelines.'                            },
  { tier: 4, title: 'Beauty Editors',       desc: 'The tastemakers. They review, rank, and destroy.',                      ex: 'Magazine editors, blog queens, TikTok reviewers.'         },
  { tier: 5, title: 'Beauty Students',      desc: "Up-and-comers learning the craft. Tomorrow's empire builders.",         ex: 'MUA apprentices, cosmetology students, beauty school grads.' },
];

const AWARD_SHOWS = [
  {
    name: 'The Starlight Awards', month: 'November', peak: true,
    desc: 'The biggest night in the LalaVerse. Fashion, beauty, content, and cultural impact — all judged.',
    categories: ['Designer of the Year','Beauty Brand of the Year','Best Digital Content Creator','Cultural Moment of the Year','Most Iconic Look','Best New Voice','Legend Award (Lifetime Achievement)'],
  },
  {
    name: 'The Style Crown Awards', month: 'March',
    desc: 'Focused on fashion excellence. Presented during Bloom Festival.',
    categories: ['Best Collection','Breakthrough Designer','Most Daring Look','Best Use of Color','Street Style Icon Award'],
  },
  {
    name: 'The Glow Honors', month: 'September',
    desc: 'Beauty-focused awards. Innovation, artistry, and influence.',
    categories: ['Best New Product','Beauty Innovator','Makeup Look of the Year','Skincare Breakthrough','Community Choice Award'],
  },
  {
    name: 'Viral Impact Awards', month: 'July',
    desc: 'Digital-first awards for virality, engagement, and cultural relevance.',
    categories: ['Most Viral Moment','Best Brand Partnership','Creator of the Year','Best Campaign','Community Builder Award'],
  },
];

const GOSSIP_MEDIA = [
  { name: 'The Velvet Report', style: 'Highbrow',   desc: 'Polished, insider-tone. Like Vogue meets Page Six.',         focus: 'Industry gossip, designer feuds, award predictions.'      },
  { name: 'Glow Gazette',     style: 'Enthusiast',  desc: 'Think Allure meets Buzzfeed. Beauty-first.',                 focus: 'Product reviews, beauty drama, glow-ups and glow-downs.'  },
  { name: 'The Whisper Wire',  style: 'Anonymous',   desc: 'Blinds, leaks, and speculation. DeuxMoi energy.',            focus: 'Relationship rumors, career moves, backstage chaos.'      },
  { name: 'Pop Prism',        style: 'Gen Z',       desc: 'TikTok-native. Fast, chaotic, screenshot-heavy.',            focus: 'Viral moments, creator beef, ranking everything.'         },
  { name: 'Trend Telescope',  style: 'Analytical',  desc: 'The Business of Fashion, but make it LalaVerse.',            focus: 'Trend forecasting, market analysis, industry shifts.'     },
];

const BIRTHDAY_TEMPLATES = [
  { icon: '👑', title: 'The Style Queen',  desc: 'Fashion icon birthday — industry tributes, collection drops, street named after her for a day.' },
  { icon: '✨', title: 'The Glow Guru',    desc: 'Beauty maven birthday — limited edition product, masterclass, fan pilgrimage to her first salon.' },
  { icon: '🎬', title: 'The Creator King', desc: 'Content creator birthday — 24-hour livestream, collab drops, fans recreate his most viral looks.' },
  { icon: '💫', title: 'The Icon Twins',   desc: 'Twin birthday — city-wide split theme, fans choose a side, joint party that always goes wrong.' },
];

const MEDIA_STYLE_COLORS = {
  Highbrow:   { c: T.roseDeep,   bg: T.roseFog   },
  Enthusiast: { c: T.orchid,     bg: T.orchidFog  },
  Anonymous:  { c: T.inkDim,     bg: '#f0edf8'    },
  'Gen Z':    { c: T.steelDeep,  bg: T.steelFog   },
  Analytical: { c: T.amber,      bg: T.amberFog   },
};

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function CulturalCalendar() {
  const [tab, setTab]           = useState('timeline');
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);   // event id

  /* ─── fetch cultural calendar events ─── */
  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    fetch(`${API}/calendar/events?event_type=lalaverse_cultural`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        const rows = Array.isArray(data) ? data : data.events || data.data || [];
        setEvents(rows);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  /* ─── derived data ─── */
  const { majorEvents, microEvents, monthMap } = useMemo(() => {
    const major = [];
    const micro = [];
    const mMap  = {};
    MONTHS.forEach((_, i) => { mMap[i] = []; });

    events.forEach(ev => {
      if (ev.is_micro_event) {
        micro.push(ev);
      } else {
        major.push(ev);
        if (ev.start_datetime) {
          const m = new Date(ev.start_datetime).getMonth();
          if (mMap[m]) mMap[m].push(ev);
        }
      }
    });
    return { majorEvents: major, microEvents: micro, monthMap: mMap };
  }, [events]);

  const toggle = useCallback((id) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  /* ─── render ─── */
  return (
    <div className="cc-shell">
      {/* Header */}
      <div className="cc-header">
        <h1>The Cultural Calendar</h1>
        <p>A Canonical Social &amp; Industry Calendar — {majorEvents.length} major events · {microEvents.length} micro events · {AWARD_SHOWS.length} award shows</p>
        <div className="cc-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`cc-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="cc-content">
        {loading ? (
          <div className="cc-loading">Loading cultural calendar…</div>
        ) : (
          <>
            {tab === 'timeline'   && <TimelineView monthMap={monthMap} expanded={expanded} toggle={toggle} microEvents={microEvents} />}
            {tab === 'industries' && <IndustriesView />}
            {tab === 'awards'     && <AwardsView />}
            {tab === 'media'      && <MediaView />}
            {tab === 'micro'      && <MicroView microEvents={microEvents} expanded={expanded} toggle={toggle} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TIMELINE VIEW — 12-month grid
   ═══════════════════════════════════════════════════════════ */
function TimelineView({ monthMap, expanded, toggle, microEvents }) {
  const totalEvents = Object.values(monthMap).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      {/* Stats */}
      <div className="cc-stats">
        <Stat n={totalEvents} label="Major Events" color={T.rose} />
        <Stat n={microEvents.length} label="Micro Events" color={T.orchid} />
        <Stat n={AWARD_SHOWS.length} label="Award Shows" color={T.gold} />
        <Stat n={GOSSIP_MEDIA.length} label="Media Outlets" color={T.steel} />
      </div>

      {/* Grid */}
      <div className="cc-timeline-grid">
        {MONTHS.map((name, i) => (
          <div className="cc-month-cell" key={name}>
            <div className="cc-month-label">{name}</div>
            <div className="cc-month-events">
              {monthMap[i].length === 0 ? (
                <div className="cc-month-empty">No events this month</div>
              ) : (
                monthMap[i].map(ev => (
                  <EventCard key={ev.id} ev={ev} expanded={expanded === ev.id} onToggle={() => toggle(ev.id)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Stat pill ─── */
function Stat({ n, label, color }) {
  return (
    <div className="cc-stat">
      <div className="cc-stat-number" style={{ color }}>{n}</div>
      <div className="cc-stat-label">{label}</div>
    </div>
  );
}

/* ─── Event card ─── */
function EventCard({ ev, expanded, onToggle }) {
  const cat   = CAT_COLORS[ev.cultural_category] || { c: T.inkDim, bg: '#f0edf8' };
  const sev   = SEVERITY_LABEL[ev.severity_level];
  const acts  = Array.isArray(ev.activities) ? ev.activities : [];
  const phr   = Array.isArray(ev.phrases) ? ev.phrases : [];

  return (
    <div
      className="cc-event-card"
      style={{ background: cat.bg, borderLeftColor: cat.c }}
      onClick={onToggle}
    >
      <div className="cc-event-top">
        <span className="cc-event-title">{ev.title}</span>
        {sev && <span className="cc-event-severity">{sev}</span>}
      </div>

      {ev.cultural_category && (
        <span className="cc-event-cat" style={{ color: cat.c, background: `${cat.c}18` }}>
          {ev.cultural_category.replace(/_/g, ' ')}
        </span>
      )}

      <div className="cc-event-desc">{ev.what_world_knows}</div>

      {expanded && (
        <div className="cc-event-expanded">
          {ev.what_only_we_know && (
            <div className="cc-event-secret">🔒 {ev.what_only_we_know}</div>
          )}

          {acts.length > 0 && (
            <div className="cc-event-tags">
              {acts.map((a, i) => <span key={i} className="cc-event-tag">{a}</span>)}
            </div>
          )}

          {phr.length > 0 && (
            <div className="cc-event-phrases">
              {phr.map((p, i) => <span key={i} className="cc-phrase">{p}</span>)}
            </div>
          )}

          {ev.district && (
            <div style={{ fontSize: 11, color: T.inkDim, marginTop: 6 }}>
              📍 {ev.district}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INDUSTRIES VIEW — Fashion + Beauty tier pyramids
   ═══════════════════════════════════════════════════════════ */
function IndustriesView() {
  return (
    <>
      <h2 className="cc-section-title">Industry Hierarchies</h2>
      <p className="cc-section-desc">
        The LalaVerse operates on a strict but fluid social hierarchy.
        Characters rise, fall, and collide across these tiers — creating natural story tension.
      </p>

      <div className="cc-industries">
        <TierPanel
          title="Fashion Industry"
          icon="👗"
          tiers={FASHION_TIERS}
          color={T.rose}
        />
        <TierPanel
          title="Beauty Ecosystem"
          icon="💄"
          tiers={BEAUTY_TIERS}
          color={T.orchid}
        />
      </div>
    </>
  );
}

function TierPanel({ title, icon, tiers, color }) {
  return (
    <div className="cc-industry-panel">
      <div className="cc-industry-title" style={{ color }}>
        <span>{icon}</span> {title}
      </div>
      {tiers.map(t => (
        <div className="cc-tier" key={t.tier}>
          <div className="cc-tier-badge" style={{ background: color, opacity: 1 - (t.tier - 1) * 0.12 }}>
            {t.tier}
          </div>
          <div className="cc-tier-info">
            <h4>{t.title}</h4>
            <p>{t.desc}</p>
            <span className="cc-tier-examples">{t.ex}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AWARDS VIEW
   ═══════════════════════════════════════════════════════════ */
function AwardsView() {
  return (
    <>
      <h2 className="cc-section-title">Award Systems</h2>
      <p className="cc-section-desc">
        Four major award shows define cultural validation in the LalaVerse.
        Winners gain momentum. Snubs fuel rivalries. Speeches go viral.
      </p>

      <div className="cc-awards-grid">
        {AWARD_SHOWS.map(aw => (
          <div className="cc-award-card" key={aw.name}>
            <div className="cc-award-header" style={aw.peak ? { background: 'linear-gradient(135deg, #fdf7e6, #fdf2f6)' } : undefined}>
              <h3 style={aw.peak ? { color: T.gold } : undefined}>{aw.name}</h3>
              <div className="cc-award-meta">
                <span className="cc-award-month">{aw.month}</span>
                {aw.peak && <span style={{ fontSize: 11, color: T.gold }}>★★★ PEAK EVENT</span>}
              </div>
              <div className="cc-award-desc">{aw.desc}</div>
            </div>
            <div className="cc-award-categories">
              {aw.categories.map((cat, i) => (
                <div className="cc-award-category" key={i}>{cat}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MEDIA VIEW
   ═══════════════════════════════════════════════════════════ */
function MediaView() {
  return (
    <>
      <h2 className="cc-section-title">Gossip Media Networks</h2>
      <p className="cc-section-desc">
        Five outlets shape public perception across the LalaVerse.
        Every event is filtered through their lens — each with a distinct voice and agenda.
      </p>

      <div className="cc-media-grid">
        {GOSSIP_MEDIA.map(m => {
          const sc = MEDIA_STYLE_COLORS[m.style] || { c: T.inkDim, bg: '#f0edf8' };
          return (
            <div className="cc-media-card" key={m.name}>
              <h3>{m.name}</h3>
              <span className="cc-media-style" style={{ color: sc.c, background: sc.bg }}>
                {m.style}
              </span>
              <div className="cc-media-desc">{m.desc}</div>
              <div className="cc-media-focus">{m.focus}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MICRO EVENTS + BIRTHDAYS VIEW
   ═══════════════════════════════════════════════════════════ */
function MicroView({ microEvents, expanded, toggle }) {
  return (
    <>
      <h2 className="cc-section-title">Micro Events</h2>
      <p className="cc-micro-intro">
        Floating cultural moments with no fixed date. They can fire at any time —
        triggered by character actions, audience energy, or story momentum.
        Use these to break routine and inject chaos.
      </p>

      {microEvents.length > 0 ? (
        <div className="cc-micro-grid">
          {microEvents.map(ev => {
            const cat = CAT_COLORS[ev.cultural_category] || { c: T.inkDim, bg: '#f0edf8' };
            const isOpen = expanded === ev.id;
            return (
              <div
                className="cc-micro-card"
                key={ev.id}
                style={{ borderTop: `3px solid ${cat.c}` }}
                onClick={() => toggle(ev.id)}
              >
                <h4>{ev.title}</h4>
                <p>{ev.what_world_knows}</p>
                {isOpen && ev.what_only_we_know && (
                  <div className="cc-event-secret"  style={{ marginTop: 8 }}>🔒 {ev.what_only_we_know}</div>
                )}
                {isOpen && Array.isArray(ev.activities) && ev.activities.length > 0 && (
                  <div className="cc-event-tags" style={{ marginTop: 8 }}>
                    {ev.activities.map((a, i) => <span key={i} className="cc-event-tag">{a}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cc-empty">No micro events found. Run the cultural calendar seeder first.</div>
      )}

      {/* Birthdays */}
      <div className="cc-birthdays-section">
        <h3 className="cc-birthdays-title">Icon Birthday Templates</h3>
        <p className="cc-birthdays-desc">
          Major birthday events for cultural icons. Dates assigned when the icon characters are generated.
        </p>
        <div className="cc-birthday-grid">
          {BIRTHDAY_TEMPLATES.map(b => (
            <div className="cc-birthday-card" key={b.title}>
              <div className="cc-birthday-icon">{b.icon}</div>
              <h4>{b.title}</h4>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
