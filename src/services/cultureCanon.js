'use strict';

/**
 * The Culture and Society pages' lists, for the writers (Evoni, 2026-10-18:
 * "yes start fix 3"; the world-level audit found the award shows, the
 * gossip media and the celebrity hierarchy were shown on the pages and read
 * by no writer but Amber).
 *
 * Each list is Evoni's: the one she saved (page_content cultural_calendar /
 * AWARD_SHOWS, GOSSIP_MEDIA, CELEBRITY_HIERARCHY, read as usePageData reads
 * it: a saved list replaces the defaults, even an empty one), else the
 * page's defaults (frontend/src/data/calendarData.js, the fields the writers
 * use copied below; tests/unit/services/cultureCanon.test.js keeps the copy
 * the same). A failed read logs and uses the defaults.
 *
 *   loadCultureList(db, key)  the list for AWARD_SHOWS | GOSSIP_MEDIA |
 *     CELEBRITY_HIERARCHY
 *   awardShowsBlock(list, monthName)  the seasonal-event generator's: the
 *     year's award shows by month, this month's marked ('' for none)
 *   gossipMediaBlock(list)  the post and message drafters': the outlets a
 *     post may name ('' for none)
 *   hierarchyBlock(list)  the Feed profile writers': the celebrity tiers by
 *     follower count ('' for none)
 *
 * The World and Society pages' lists for the Feed profile writers (Evoni,
 * 2026-10-18: "yes start the profile writer lists"): UNIVERSITIES and
 * CORPORATIONS (page_content world_infrastructure, defaults
 * frontend/src/data/dreamCities.js) and ECONOMY_STREAMS (influencer_systems,
 * defaults frontend/src/data/influencerData.js), loaded the same way.
 *
 *   schoolsBlock(list, cityName)  the schools, theirs first; a creator may
 *     have trained at one, most did not ('' for none)
 *   companiesBlock(list)  the companies a creator may work with ('' for none)
 *   economyBlock(list)  how creators make money, by tier ('' for none)
 *   profileWorldBlock(db, cityName)  the four for a LalaVerse profile: the
 *     hierarchy, the schools, the companies and the economy
 *
 * The trends and archives for the post and message drafters (Evoni,
 * 2026-10-18: "yes start the trends and archives for the post drafter"):
 * FASHION_TREND_STAGES, BEAUTY_TREND_STAGES and MOMENTUM_WAVES
 * (influencer_systems) and ARCHIVES (cultural_memory, defaults
 * frontend/src/data/memoryData.js). Kept short: the drafter writes most
 * posts, so a line costs on every one.
 *
 *   trendsBlock(lists)  { fashion, beauty, waves, archives } as a few lines
 *     a post may lean on ('' for none)
 */

// Where each list is saved, and the field that names an item.
const LISTS = Object.freeze({
  AWARD_SHOWS: { page: 'cultural_calendar', name: 'name' },
  GOSSIP_MEDIA: { page: 'cultural_calendar', name: 'name' },
  CELEBRITY_HIERARCHY: { page: 'cultural_calendar', name: 'name' },
  UNIVERSITIES: { page: 'world_infrastructure', name: 'name' },
  CORPORATIONS: { page: 'world_infrastructure', name: 'name' },
  ECONOMY_STREAMS: { page: 'influencer_systems', name: 'stream' },
  FASHION_TREND_STAGES: { page: 'influencer_systems', name: 'name' },
  BEAUTY_TREND_STAGES: { page: 'influencer_systems', name: 'name' },
  MOMENTUM_WAVES: { page: 'influencer_systems', name: 'event' },
  ARCHIVES: { page: 'cultural_memory', name: 'name' },
});

const DEFAULTS = Object.freeze({
  AWARD_SHOWS: [
    { name: 'Starlight Awards', month: 'November', desc: 'The main event. Creator recognition across all categories.', categories: ['Creator of the Year', 'Fashion Icon', 'Beauty Innovator', 'Storyteller of the Year', 'Breakout Creator', 'Entrepreneur of the Year'] },
    { name: 'Style Crown Awards', month: 'March', desc: 'Fashion industry recognition.', categories: ['Best Stylist', 'Best Outfit Creator', 'Best Designer', 'Best Brand Collaboration', 'Street Style Icon of the Year'] },
    { name: 'Glow Honors', month: 'September', desc: 'Beauty creator recognition.', categories: ['Best Makeup Artist', 'Best Skincare Creator', 'Best Beauty Brand', 'Best Tutorial Series', 'Glow Innovator of the Year'] },
    { name: 'Viral Impact Awards', month: 'July', desc: 'Internet culture, viral moments, meme-ability.', categories: ['Most Viral Moment', 'Funniest Creator', 'Most Influential Post', 'Best Comeback', 'Community Builder of the Year'] },
  ],
  GOSSIP_MEDIA: [
    { name: 'The Dazzle Report', focus: 'Fashion & luxury culture', covers: 'Dazzle Season, Atelier Circuit, Tier 1-2 fashion news', power: 'Being ignored by the Dazzle Report is its own story.' },
    { name: 'Glow Gazette', focus: 'Beauty industry', covers: 'Glow Week, beauty brand launches, salon trend reports', power: 'A Glow Gazette review can make or break a product launch.' },
    { name: 'The Whisper Wire', focus: 'Celebrity & influencer gossip', covers: 'Relationship drama, feuds, who unfollowed who', power: 'The Whisper Wire always knows. The question is when they publish.' },
    { name: 'Pop Prism', focus: 'Entertainment & pop culture', covers: 'Music creators, viral moments, Cloud Carnival', power: 'Pop Prism decides what becomes a cultural reference point.' },
    { name: 'Trend Telescope', focus: 'Trend forecasting', covers: 'Trend Summit coverage, upcoming aesthetics, emerging creators', power: 'Being predicted by Trend Telescope before you peak is the signal.' },
  ],
  CELEBRITY_HIERARCHY: [
    { tier: 1, name: 'Cultural Icons', followers: '10M+', desc: 'Platform-defining figures. Define trends. Headline global events. Their opinion reshapes the Feed.' },
    { tier: 2, name: 'Industry Titans', followers: '5M-10M', desc: 'Major designers, beauty founders, entertainment stars. Shape industry direction. Sponsor major events.' },
    { tier: 3, name: 'Major Influencers', followers: '1M-5M', desc: 'Fashion creators, lifestyle influencers. Move culture at scale. Front row at everything.' },
    { tier: 4, name: 'Rising Creators', followers: '100K-1M', desc: 'Viral creators, niche experts. The dangerous tier — where careers accelerate or collapse.' },
    { tier: 5, name: 'Micro Creators', followers: '10K-100K', desc: 'Niche community creators. Deep trust, narrow reach. Brands court them for authenticity.' },
    { tier: 6, name: 'Everyday Creators', followers: '0-10K', desc: 'Local personalities, hobby creators. The origin of culture. Everything starts here.' },
  ],
  UNIVERSITIES: [
    { name: 'The Dazzle Academy', city: 'Dazzle District', specialization: "World's top fashion school", programs: ['Fashion design', 'Styling', 'Fashion photography', 'Fashion journalism'], significance: 'Graduates often debut during the Atelier Circuit. A Dazzle Academy degree is a Tier 1 credential.' },
    { name: 'The Radiance Institute', city: 'Radiance Row', specialization: 'Most prestigious beauty academy', programs: ['Makeup artistry', 'Skincare science', 'Cosmetic formulation', 'Aesthetic treatments'], significance: 'Graduates dominate Glow Week. The Radiance Institute and the beauty industry are inseparable.' },
    { name: 'The Creator Conservatory', city: 'Maverick Harbor', specialization: 'Content creation and media', programs: ['Storytelling', 'Video production', 'Social media strategy', 'Branding'], significance: 'The school that legitimized being a creator. Graduates become influencers who cite it.' },
    { name: 'Ascent Tech Institute', city: 'Ascent Tower', specialization: 'Technology and innovation', programs: ['Digital product design', 'Social platform engineering', 'AI and media tools'], significance: 'Many founders of major LalaVerse platforms came from here. The architecture of the world.' },
  ],
  CORPORATIONS: [
    { name: 'Dazzle House', industry: 'Luxury fashion', knownFor: 'Couture collections, high-status events, collaborations with top creators', power: 'Controls what high fashion means. Who they invite to shows is a power signal.' },
    { name: 'Glow Labs', industry: 'Beauty', knownFor: 'Skincare breakthroughs, viral beauty products, innovation-first positioning', power: 'Makes beauty credible. Their product recommendations become canon.' },
    { name: 'Nova Studios', industry: 'Entertainment', knownFor: 'Creator shows, music projects, comedy series, content production', power: 'Produces the content that defines the entertainment tier of LalaVerse.' },
    { name: 'Dream Market Collective', industry: 'Creator economy', knownFor: 'Digital shops, creator launches, marketplace infrastructure', power: 'The platform creators use to sell. They take a cut of everything.' },
    { name: 'Pulse Media Network', industry: 'Talent and media', knownFor: 'Talent management, influencer partnerships, brand matchmaking', power: 'The middleman between creators and brands. Enormous invisible power.' },
  ],
  ECONOMY_STREAMS: [
    { stream: 'Brand Collaborations', what: 'Partnerships with companies to promote products — fashion, beauty, lifestyle, tech', who: 'Every tier uses it. Quality of brand signals tier level.' },
    { stream: 'Creator Shops', what: 'Personal storefronts — clothing, digital products, merchandise', who: 'Tier 3-6. The entrepreneurial layer of the creator economy.' },
    { stream: 'Membership Communities', what: 'Fans pay for exclusive access — behind-the-scenes, private discussions', who: 'Tier 2-4. Requires deep audience trust.' },
    { stream: 'Event Appearances', what: 'Festivals, award shows, industry panels, brand activations', who: 'Tier 1-3. Invitation is the signal.' },
    { stream: 'Digital Products', what: 'Courses, presets, templates, educational content', who: 'Tier 3-6. Knowledge monetized.' },
    { stream: 'Pay-for-Attention', what: 'DM access, Prime Coin tipping, direct financial relationships with audience members (the LalaVerse pays in Prime Coins)', who: 'Any tier — but rarely discussed publicly.' },
  ],
  FASHION_TREND_STAGES: [
    { stage: 1, name: 'Underground' }, { stage: 2, name: 'Rising' }, { stage: 3, name: 'Mainstream' },
    { stage: 4, name: 'Saturation' }, { stage: 5, name: 'Replacement' },
  ],
  BEAUTY_TREND_STAGES: [
    { stage: 1, name: 'Salon Discovery' }, { stage: 2, name: 'Creator Demonstration' }, { stage: 3, name: 'Product Launch' }, { stage: 4, name: 'Viral Adoption' },
  ],
  MOMENTUM_WAVES: [
    { event: 'Award Wins', feedEffect: 'Immediate career trajectory jump. Every brand reassesses.' },
    { event: 'Viral Scandals', feedEffect: 'Feed dominance — pushes everything else out.' },
    { event: 'Celebrity Collaborations', feedEffect: 'Audience crossover — both creators gain from the other\'s reach.' },
    { event: 'Surprise Partnerships', feedEffect: 'The reveal is the content — speculation, reaction, analysis.' },
    { event: 'Platform Changes', feedEffect: 'Entire creator class responds — some gain, most scramble.' },
  ],
  ARCHIVES: [
    { name: 'The Dazzle Archive', tracks: 'Runway collections, style revolutions, designer legacies, Atelier Circuit history' },
    { name: 'Glow Archives', tracks: 'Cosmetic innovations, viral beauty trends, technique origins, Glow Honors history' },
    { name: 'The Creator Chronicle', tracks: 'Influencer milestones, viral moments, creator economy breakthroughs, platform history' },
    { name: 'The Whisper Ledger', tracks: 'Feuds, breakups, public controversies, cancelled creators, apology records' },
  ],
});

const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const sentence = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

async function loadCultureList(db, key) {
  const list = LISTS[key];
  if (!list) throw new Error(`Unknown culture list: ${key}`);
  if (db?.PageContent) {
    try {
      const row = await db.PageContent.findOne({ where: { page_name: list.page, constant_key: key }, attributes: ['data'] });
      if (row && Array.isArray(row.data)) return row.data.filter((item) => item && text(item[list.name]));
    } catch (err) {
      console.error(`[cultureCanon] the saved ${key} could not be read; using the defaults:`, err.message);
    }
  }
  return DEFAULTS[key];
}

function awardShowsBlock(list, monthName) {
  const shows = (list || []).filter((s) => text(s?.name));
  if (!shows.length) return '';
  const line = (s) => {
    const cats = (Array.isArray(s.categories) ? s.categories : []).map(text).filter(Boolean);
    return `- ${text(s.name)}${text(s.month) ? ` (${text(s.month)})` : ''}${text(s.desc) ? `: ${text(s.desc)}` : ''}${cats.length ? ` Categories: ${cats.join(', ')}.` : ''}`;
  };
  const now = shows.filter((s) => text(s.month).toLowerCase() === String(monthName).toLowerCase());
  return `THE LALAVERSE'S AWARD SHOWS (each in its own month; never put one in another month or invent another award show):
${shows.map(line).join('\n')}
${now.length ? `This month is ${now.map((s) => text(s.name)).join(' and ')}: unless it already exists, one of the events is it, by that name.` : `No award show falls in ${monthName}.`}
`;
}

function gossipMediaBlock(list) {
  const outlets = (list || []).filter((o) => text(o?.name));
  if (!outlets.length) return '';
  return `The LalaVerse's gossip and media outlets (a post may name one where it fits; there are no others):
${outlets.map((o) => `- ${text(o.name)}${text(o.focus) ? `: ${text(o.focus)}` : ''}${text(o.covers) ? `; covers ${text(o.covers)}` : ''}${text(o.power) ? `. ${sentence(text(o.power))}` : ''}`).join('\n')}
`;
}

function hierarchyBlock(list) {
  const tiers = (list || []).filter((t) => text(t?.name));
  if (!tiers.length) return '';
  return `\nTHE LALAVERSE'S CELEBRITY HIERARCHY (where a creator stands follows their follower count; their profile agrees with where they stand; these are standings, not the follower_tier values):
${tiers.map((t) => `- ${text(t.name)}${text(t.followers) ? ` (${text(t.followers)} followers)` : ''}${text(t.desc) ? `: ${text(t.desc)}` : ''}`).join('\n')}
`;
}

const words = (v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

function schoolsBlock(list, cityName = null) {
  const schools = (list || []).filter((u) => text(u?.name));
  if (!schools.length) return '';
  const home = text(cityName).toLowerCase();
  const ordered = [...schools.filter((u) => home && text(u.city).toLowerCase() === home), ...schools.filter((u) => !home || text(u.city).toLowerCase() !== home)];
  return `\nTHE LALAVERSE'S SCHOOLS (a creator may have trained at one, most did not; never invent another):
${ordered.map((u) => `- ${text(u.name)}${text(u.city) ? ` (${text(u.city)})` : ''}${text(u.specialization) ? `: ${text(u.specialization)}` : ''}${words(u.programs).length ? `; programs: ${words(u.programs).join(', ')}` : ''}${text(u.significance) ? `. ${sentence(text(u.significance))}` : ''}`).join('\n')}
`;
}

function companiesBlock(list) {
  const companies = (list || []).filter((c) => text(c?.name));
  if (!companies.length) return '';
  return `\nTHE LALAVERSE'S BIG COMPANIES (a creator may work with, be signed to or have a deal with one where it fits; most have none):
${companies.map((c) => `- ${text(c.name)}${text(c.industry) ? ` (${text(c.industry)})` : ''}${text(c.knownFor) ? `: ${text(c.knownFor)}` : ''}${text(c.power) ? `. ${sentence(text(c.power))}` : ''}`).join('\n')}
`;
}

function economyBlock(list) {
  const streams = (list || []).filter((e) => text(e?.stream));
  if (!streams.length) return '';
  return `\nHOW LALAVERSE CREATORS MAKE MONEY (what they earn from fits where they stand):
${streams.map((e) => `- ${text(e.stream)}${text(e.what) ? `: ${text(e.what)}` : ''}${text(e.who) ? `. ${sentence(text(e.who))}` : ''}`).join('\n')}
`;
}

const byStage = (list) => [...list].sort((a, b) => (Number(a.stage) || 0) - (Number(b.stage) || 0));

function trendsBlock({ fashion = [], beauty = [], waves = [], archives = [] } = {}) {
  const names = (list, field = 'name') => (list || []).map((x) => text(x?.[field])).filter(Boolean);
  const lines = [];
  if (names(fashion).length) lines.push(`- A fashion trend moves: ${names(byStage(fashion)).join(' → ')}. A post can catch one early, ride it or be tired of it.`);
  if (names(beauty).length) lines.push(`- A beauty trend moves: ${names(byStage(beauty)).join(' → ')}.`);
  const w = (waves || []).filter((x) => text(x?.event));
  if (w.length) lines.push(`- What moves a career: ${w.map((x) => `${text(x.event)}${text(x.feedEffect) ? ` (${lowerFirst(text(x.feedEffect).split(/\.\s/)[0].replace(/\.$/, ''))})` : ''}`).join('; ')}.`);
  const a = (archives || []).filter((x) => text(x?.name));
  if (a.length) lines.push(`- What the LalaVerse remembers, and where: ${a.map((x) => `${text(x.name)}${text(x.tracks) ? ` (${lowerFirst(text(x.tracks))})` : ''}`).join('; ')}. A post may look back ("so Dazzle Season '22").`);
  return lines.length ? `The LalaVerse's culture (a post may lean on it where it fits; most posts need none of it):\n${lines.join('\n')}\n` : '';
}

/** The trends and archives, each Evoni's saved list or the page's. */
async function loadTrends(db) {
  return {
    fashion: await loadCultureList(db, 'FASHION_TREND_STAGES'),
    beauty: await loadCultureList(db, 'BEAUTY_TREND_STAGES'),
    waves: await loadCultureList(db, 'MOMENTUM_WAVES'),
    archives: await loadCultureList(db, 'ARCHIVES'),
  };
}

/** The hierarchy, schools, companies and economy for a LalaVerse profile writer; cityName (a DREAM city name or key) puts its schools first. */
async function profileWorldBlock(db, cityName = null) {
  const city = cityName ? String(cityName).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) : null;
  return hierarchyBlock(await loadCultureList(db, 'CELEBRITY_HIERARCHY'))
    + schoolsBlock(await loadCultureList(db, 'UNIVERSITIES'), city)
    + companiesBlock(await loadCultureList(db, 'CORPORATIONS'))
    + economyBlock(await loadCultureList(db, 'ECONOMY_STREAMS'));
}

module.exports = {
  DEFAULTS, LISTS, loadCultureList, awardShowsBlock, gossipMediaBlock, hierarchyBlock, schoolsBlock, companiesBlock, economyBlock, profileWorldBlock,
  trendsBlock, loadTrends,
};
