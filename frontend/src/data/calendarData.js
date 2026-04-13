/**
 * Cultural Calendar & Society Data
 * Celebrity Hierarchy, Industry Tiers, Algorithm, Drama, Media, Awards, Famous 25
 */

const T = {
  rose: '#d4789a', steel: '#7ab3d4', orchid: '#a889c8',
  gold: '#c9a84c', mint: '#6bba9a', amber: '#b89060',
};

export const CELEBRITY_HIERARCHY = [
  { tier: 1, name: 'Cultural Icons', followers: '10M+', color: T.gold, desc: 'Platform-defining figures. Define trends. Headline global events. Their opinion reshapes the Feed.' },
  { tier: 2, name: 'Industry Titans', followers: '5M-10M', color: T.rose, desc: 'Major designers, beauty founders, entertainment stars. Shape industry direction. Sponsor major events.' },
  { tier: 3, name: 'Major Influencers', followers: '1M-5M', color: T.orchid, desc: 'Fashion creators, lifestyle influencers. Move culture at scale. Front row at everything.' },
  { tier: 4, name: 'Rising Creators', followers: '100K-1M', color: T.steel, desc: 'Viral creators, niche experts. The dangerous tier — where careers accelerate or collapse.' },
  { tier: 5, name: 'Micro Creators', followers: '10K-100K', color: T.mint, desc: 'Niche community creators. Deep trust, narrow reach. Brands court them for authenticity.' },
  { tier: 6, name: 'Everyday Creators', followers: '0-10K', color: T.amber, desc: 'Local personalities, hobby creators. The origin of culture. Everything starts here.' },
];

export const FASHION_TIERS = [
  { tier: 1, name: 'Legendary Designers', color: T.gold, desc: 'Couture houses, global designers, style icons who define the culture.', examples: 'Control trends. Headline Velvet Season. Dominate the Atelier Circuit.' },
  { tier: 2, name: 'Fashion Houses', color: T.rose, desc: 'Large clothing companies, luxury labels, established brands.', examples: 'Influence seasonal aesthetics. Sponsor major events.' },
  { tier: 3, name: 'Stylists', color: T.orchid, desc: 'Image creators who work with celebrities, influencers, and campaigns.', examples: 'They decide what the Tier 1s wear. Their aesthetic becomes canon.' },
  { tier: 4, name: 'Fashion Creators', color: T.steel, desc: 'Online fashion influencers, outfit creators, style bloggers.', examples: 'Move product. Create desire. Tier 1s watch them for taste signals.' },
  { tier: 5, name: 'Street Style Icons', color: T.mint, desc: 'Emerging trendsetters, often discovered during Outfit Games and Style Market.', examples: 'Before the trend is a trend, it\'s on their back.' },
];

export const BEAUTY_TIERS = [
  { tier: 1, name: 'Beauty Empires', color: T.gold, desc: 'Major cosmetics and skincare companies that define the category.', examples: 'Their launches become cultural events. Glow Week belongs to them.' },
  { tier: 2, name: 'Beauty Labs', color: T.rose, desc: 'Innovation companies developing ingredients, formulas, and tools.', examples: 'Emerging brands partner with them to establish credibility.' },
  { tier: 3, name: 'Salon Owners', color: T.orchid, desc: 'Local beauty powerhouses — lash studios, nail salons, skin clinics.', examples: 'The look starts in their chair before it\'s on the Feed.' },
  { tier: 4, name: 'Beauty Creators', color: T.steel, desc: 'Makeup artists, skincare influencers, tutorial creators.', examples: 'Their reviews move product. Brands court them constantly.' },
  { tier: 5, name: 'Beauty Students', color: T.mint, desc: 'Emerging talent, often discovered during Glow Week.', examples: 'One viral moment changes everything.' },
];

export const ALGORITHM_FORCES = [
  { name: 'Engagement Energy', icon: '⚡', color: T.rose, measuredBy: 'Comments, shares, saves — active signals', effect: 'High engagement = higher distribution', storyHook: 'A post that sparks argument spreads further than one that gets likes.' },
  { name: 'Trend Alignment', icon: '🎯', color: T.orchid, measuredBy: 'Connection to current cultural events', effect: 'Event-aligned content gets boosted during that event', storyHook: 'Posting off-cycle gets buried.' },
  { name: 'Creator Momentum', icon: '🔄', color: T.steel, measuredBy: 'Consistency of posting cadence', effect: 'Consistent accounts gain algorithmic favor', storyHook: 'A creator who disappears for two weeks loses ground another creator took.' },
  { name: 'Network Clusters', icon: '🔗', color: T.mint, measuredBy: 'Fashion, beauty, entertainment, fitness circles', effect: 'Content boosted within relevant community', storyHook: 'A post that breaks its cluster and enters a new one is a cultural moment.' },
];

export const DRAMA_MECHANICS = [
  { type: 'Breakups', icon: '💔', color: T.rose, trigger: 'Relationship splits going public', feedEffect: 'Massive attention spike — audiences choose sides', storyThread: 'Who knew before the post. Who pretended to be surprised.' },
  { type: 'Feuds', icon: '⚔️', color: T.amber, trigger: 'Creator disagreements — public or leaked', feedEffect: 'Viral debates, ratio wars, fan armies mobilizing', storyThread: 'What started it privately vs. what the public sees.' },
  { type: 'Public Apologies', icon: '🕊️', color: T.steel, trigger: 'Controversy leading to accountability post', feedEffect: 'Curiosity + judgment + counter-commentary', storyThread: 'Whether the apology is real or strategic is always the subtext.' },
  { type: 'Rivalries', icon: '🏆', color: T.gold, trigger: 'Competitors pursuing the same space', feedEffect: 'Fans organize, comparisons trend', storyThread: 'The rivalry the audience invented vs. the relationship they actually have.' },
  { type: 'Scandals', icon: '🔥', color: T.orchid, trigger: 'Leaks, rumors, accusations', feedEffect: 'Feed-dominating — pushes everything else out', storyThread: 'What is true, what is exaggerated, who benefits from the timing.' },
];

export const AWARD_SHOWS = [
  { name: 'Starlight Awards', month: 'November', icon: '✨', color: T.gold, desc: 'The main event. Creator recognition across all categories.', categories: ['Creator of the Year', 'Fashion Icon', 'Beauty Innovator', 'Storyteller of the Year', 'Breakout Creator', 'Entrepreneur of the Year'] },
  { name: 'Style Crown Awards', month: 'March', icon: '👑', color: T.rose, desc: 'Fashion industry recognition.', categories: ['Best Stylist', 'Best Outfit Creator', 'Best Designer', 'Best Brand Collaboration', 'Street Style Icon of the Year'] },
  { name: 'Glow Honors', month: 'September', icon: '🌟', color: T.orchid, desc: 'Beauty creator recognition.', categories: ['Best Makeup Artist', 'Best Skincare Creator', 'Best Beauty Brand', 'Best Tutorial Series', 'Glow Innovator of the Year'] },
  { name: 'Viral Impact Awards', month: 'July', icon: '🚀', color: T.steel, desc: 'Internet culture, viral moments, meme-ability.', categories: ['Most Viral Moment', 'Funniest Creator', 'Most Influential Post', 'Best Comeback', 'Community Builder of the Year'] },
];

export const GOSSIP_MEDIA = [
  { name: 'The Dazzle Report', focus: 'Fashion & luxury culture', style: 'editorial', covers: 'Dazzle Season, Atelier Circuit, Tier 1-2 fashion news', power: 'Being ignored by the Dazzle Report is its own story.', color: { bg: '#fdf2f6', text: '#9c3d62' } },
  { name: 'Glow Gazette', focus: 'Beauty industry', style: 'review-driven', covers: 'Glow Week, beauty brand launches, salon trend reports', power: 'A Glow Gazette review can make or break a product launch.', color: { bg: '#f6f0fc', text: '#6b4d8a' } },
  { name: 'The Whisper Wire', focus: 'Celebrity & influencer gossip', style: 'gossip', covers: 'Relationship drama, feuds, who unfollowed who', power: 'The Whisper Wire always knows. The question is when they publish.', color: { bg: '#fdf8ee', text: '#8a7030' } },
  { name: 'Pop Prism', focus: 'Entertainment & pop culture', style: 'trending', covers: 'Music creators, viral moments, Cloud Carnival', power: 'Pop Prism decides what becomes a cultural reference point.', color: { bg: '#eef6fb', text: '#3d6e8a' } },
  { name: 'Trend Telescope', focus: 'Trend forecasting', style: 'analytical', covers: 'Trend Summit coverage, upcoming aesthetics, emerging creators', power: 'Being predicted by Trend Telescope before you peak is the signal.', color: { bg: '#f0faf5', text: '#3a7d60' } },
];

export const FAMOUS_CHARACTERS = [
  { rank: 1, title: 'The Style Queen', role: 'Defines what is fashionable. Her opinion reshapes the Feed.', icon: '👑', color: T.rose },
  { rank: 2, title: 'The Glow Guru', role: 'Defines beauty standards. Her recommendations sell out in hours.', icon: '✨', color: T.orchid },
  { rank: 3, title: 'The Creator King', role: 'Represents success culture. Entrepreneurs model themselves on him.', icon: '🎯', color: T.gold },
  { rank: 4, title: 'The Trend Oracle', role: 'Predicts cultural shifts before they happen. Always right, always cryptic.', icon: '🔮', color: T.orchid },
  { rank: 5, title: 'The Fashion Rebel', role: 'Breaks every rule the Style Queen sets. The counterculture anchor.', icon: '⚡', color: T.rose },
  { rank: 6, title: 'The Beauty Scientist', role: 'Makes beauty intellectual. Evidence-based, not aspirational.', icon: '🔬', color: T.mint },
  { rank: 7, title: 'The Street Style Icon', role: 'Lives at the origin of trends before they have names.', icon: '🌆', color: T.amber },
  { rank: 8, title: 'The Meme Monarch', role: 'Turns every cultural moment into a joke that outlasts the moment.', icon: '😂', color: T.steel },
  { rank: 9, title: 'The Nightlife Queen', role: 'Controls what happens after midnight in LalaVerse.', icon: '🌙', color: T.orchid },
  { rank: 10, title: 'The Viral Comedian', role: 'Makes the platform laugh. Laughter is its own kind of power.', icon: '🎭', color: T.steel },
  { rank: 11, title: 'The Wellness Prophet', role: 'The counter-narrative to hustle culture. Rest as resistance.', icon: '🧘', color: T.mint },
  { rank: 12, title: 'The Design Genius', role: 'Solves problems beautifully. Aesthetics and function together.', icon: '✏️', color: T.amber },
  { rank: 13, title: 'The Pop Star Creator', role: 'Crosses music and content. Two audiences become one.', icon: '🎵', color: T.rose },
  { rank: 14, title: 'The Gossip Empress', role: 'Knows everything. Shares it strategically. Never wrong.', icon: '👄', color: T.gold },
  { rank: 15, title: 'The Digital Mogul', role: 'Built an empire from content. The proof that it\'s possible.', icon: '💎', color: T.gold },
  { rank: 16, title: 'The Travel Queen', role: 'Makes the world feel accessible and aspirational simultaneously.', icon: '✈️', color: T.steel },
  { rank: 17, title: 'The Fitness Titan', role: 'Physical transformation as identity. The body as project.', icon: '💪', color: T.mint },
  { rank: 18, title: 'The Chef Creator', role: 'Food as culture, not just content. Elevates the everyday.', icon: '🍳', color: T.amber },
  { rank: 19, title: 'The Art Visionary', role: 'Makes the platform take beauty seriously.', icon: '🎨', color: T.orchid },
  { rank: 20, title: 'The Photographer Legend', role: 'Documents LalaVerse. Everything important is in their archive.', icon: '📸', color: T.steel },
  { rank: 21, title: 'The Music Architect', role: 'Builds sonic worlds, not just songs.', icon: '🎧', color: T.rose },
  { rank: 22, title: 'The Storytelling Master', role: 'Narrative above everything. Makes content feel like literature.', icon: '📖', color: T.orchid },
  { rank: 23, title: 'The Culture Commentator', role: 'Names what everyone is feeling but hasn\'t articulated yet.', icon: '🗣️', color: T.gold },
  { rank: 24, title: 'The Creator Mentor', role: 'Grows other creators. Legacy through multiplication.', icon: '🤝', color: T.mint },
  { rank: 25, title: 'The Fashion Archivist', role: 'Preserves what the Feed forgets. Memory as power.', icon: '📚', color: T.amber },
];

export const BIRTHDAY_TEMPLATES = [
  { name: 'The Style Queen', icon: '👑', community: 'Fashion', desc: 'Themed outfit posts across the Feed. Her aesthetic becomes a challenge.' },
  { name: 'The Glow Guru', icon: '✨', community: 'Beauty', desc: 'Tutorial tributes honoring her techniques. Beauty creators compete.' },
  { name: 'The Creator King', icon: '🎯', community: 'Entrepreneur', desc: 'Mentorship content. Creators share how he influenced their path.' },
  { name: 'The Icon Twins', icon: '♊', community: 'All Communities', desc: 'Two legendary influencers born the same day. The annual debate: which one is greater?' },
  { name: 'The Founder Day', icon: '🌟', community: 'Platform-wide', desc: 'Celebrates LalaVerse\'s creation. Every creator participates.' },
];

export const CALENDAR_DEFAULTS = {
  CELEBRITY_HIERARCHY, FASHION_TIERS, BEAUTY_TIERS,
  ALGORITHM_FORCES, DRAMA_MECHANICS, AWARD_SHOWS,
  GOSSIP_MEDIA, FAMOUS_CHARACTERS, BIRTHDAY_TEMPLATES,
};
