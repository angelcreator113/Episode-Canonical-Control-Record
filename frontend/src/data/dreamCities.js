/**
 * DREAM Cities — Unified LalaVerse Geography
 * D·R·E·A·M = Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor
 * Shared across World Foundation, Social Systems, Feed, Events
 */

export const DREAM_CITIES = [
  {
    key: 'dazzle_district', letter: 'D', name: 'Dazzle District',
    icon: '👗', subtitle: 'Fashion & Luxury',
    color: '#d4789a', lightColor: '#fdf2f6',
    capitalOf: 'Fashion',
    famousFor: 'Couture houses, runway shows, designer studios, high-end boutiques',
    majorEvents: ['Velvet Season', 'Atelier Circuit', 'Style Crown Awards'],
    whoLivesHere: 'Designers, stylists, fashion photographers, luxury influencers',
    energy: 'Elegant, high-status, trend-setting. Every sidewalk is a runway.',
    culture: 'Fashion capital of the LalaVerse. Polished curators dominate. Brand deals are currency.',
  },
  {
    key: 'radiance_row', letter: 'R', name: 'Radiance Row',
    icon: '✨', subtitle: 'Beauty & Wellness',
    color: '#a889c8', lightColor: '#f6f0fc',
    capitalOf: 'Beauty',
    famousFor: 'Skincare labs, salons, beauty schools, product launch spaces',
    majorEvents: ['Glow Week', 'Glow Honors Awards'],
    whoLivesHere: 'Makeup artists, skincare experts, beauty founders, lash and nail artists',
    energy: 'Experimental, aesthetic, transformation culture. Reinvention is the local religion.',
    culture: 'Beauty & wellness heartland. Experimental, aesthetic, transformation culture.',
  },
  {
    key: 'echo_park', letter: 'E', name: 'Echo Park',
    icon: '🎵', subtitle: 'Entertainment & Nightlife',
    color: '#c9a84c', lightColor: '#fdf8ee',
    capitalOf: 'Entertainment',
    famousFor: 'Music studios, comedy clubs, creator houses, nightlife venues',
    majorEvents: ['Neon Nights', 'Soundwave Nights', 'Cloud Carnival'],
    whoLivesHere: 'Musicians, comedians, entertainers, party influencers',
    energy: 'Chaotic, loud, viral culture. Something happens here that becomes a meme by morning.',
    culture: 'Entertainment & nightlife hub. Chaotic, loud, viral culture.',
  },
  {
    key: 'ascent_tower', letter: 'A', name: 'Ascent Tower',
    icon: '🔮', subtitle: 'Tech & Innovation',
    color: '#6bba9a', lightColor: '#e8f5ee',
    capitalOf: 'Tech and startups',
    famousFor: 'Digital platforms, creator economy tools, startup founders, incubators',
    majorEvents: ['Dream Market', 'Trend Summit'],
    whoLivesHere: 'Developers, entrepreneurs, product designers, platform architects',
    energy: 'Futuristic, ambitious. The city building the tools everyone else uses.',
    culture: 'Tech & innovation district. Futuristic, ambitious.',
  },
  {
    key: 'maverick_harbor', letter: 'M', name: 'Maverick Harbor',
    icon: '⚓', subtitle: 'Creator Economy & Counter-culture',
    color: '#7ab3d4', lightColor: '#eef6fb',
    capitalOf: 'Influencer culture',
    famousFor: 'Creator studios, content houses, podcast networks, collab spaces',
    majorEvents: ['Creator Camp', 'Creator Cruise departures'],
    whoLivesHere: 'Influencers, vloggers, digital entrepreneurs, talent managers',
    energy: 'Collaborative, entrepreneurial, anti-algorithm. Fame is suspicious here.',
    culture: 'Creator economy & counter-culture. Collaborative, entrepreneurial.',
  },
];

export const UNIVERSITIES = [
  { name: 'The Dazzle Academy', city: 'Dazzle District', icon: '🎓', color: '#d4789a', specialization: "World's top fashion school", programs: ['Fashion design', 'Styling', 'Fashion photography', 'Fashion journalism'], significance: 'Graduates often debut during the Atelier Circuit. A Dazzle Academy degree is a Tier 1 credential.' },
  { name: 'The Radiance Institute', city: 'Radiance Row', icon: '🔬', color: '#a889c8', specialization: 'Most prestigious beauty academy', programs: ['Makeup artistry', 'Skincare science', 'Cosmetic formulation', 'Aesthetic treatments'], significance: 'Graduates dominate Glow Week. The Radiance Institute and the beauty industry are inseparable.' },
  { name: 'The Creator Conservatory', city: 'Maverick Harbor', icon: '🎬', color: '#7ab3d4', specialization: 'Content creation and media', programs: ['Storytelling', 'Video production', 'Social media strategy', 'Branding'], significance: 'The school that legitimized being a creator. Graduates become influencers who cite it.' },
  { name: 'Ascent Tech Institute', city: 'Ascent Tower', icon: '💻', color: '#6bba9a', specialization: 'Technology and innovation', programs: ['Digital product design', 'Social platform engineering', 'AI and media tools'], significance: 'Many founders of major LalaVerse platforms came from here. The architecture of the world.' },
];

export const CORPORATIONS = [
  { name: 'Dazzle House', icon: '👗', industry: 'Luxury fashion', color: '#d4789a', knownFor: 'Couture collections, high-status events, collaborations with top creators', power: 'Controls what high fashion means. Who they invite to shows is a power signal.', storyPotential: 'The creator Dazzle House ignores. The designer they finally recognize. The collaboration that changes everything.' },
  { name: 'Glow Labs', icon: '🧪', industry: 'Beauty', color: '#a889c8', knownFor: 'Skincare breakthroughs, viral beauty products, innovation-first positioning', power: 'Makes beauty credible. Their product recommendations become canon.', storyPotential: 'The formula that went wrong. The creator they dropped. The product that made a career.' },
  { name: 'Nova Studios', icon: '🎬', industry: 'Entertainment', color: '#c9a84c', knownFor: 'Creator shows, music projects, comedy series, content production', power: 'Produces the content that defines the entertainment tier of LalaVerse.', storyPotential: "The deal that changed a creator's trajectory. The show they cancelled. The artist they made." },
  { name: 'Dream Market Collective', icon: '🏪', industry: 'Creator economy', color: '#7ab3d4', knownFor: 'Digital shops, creator launches, marketplace infrastructure', power: 'The platform creators use to sell. They take a cut of everything.', storyPotential: 'The fee increase nobody announced. The creator who built around them and then had to leave.' },
  { name: 'Pulse Media Network', icon: '📡', industry: 'Talent and media', color: '#b89060', knownFor: 'Talent management, influencer partnerships, brand matchmaking', power: 'The middleman between creators and brands. Enormous invisible power.', storyPotential: 'The contract clause nobody read. The creator who left and went independent. The manager who knew too much.' },
];

export const WORLD_LAYERS = [
  { layer: 'Creators', icon: '👤', color: '#d4789a', whatItDoes: 'Produce content, build audiences, represent cultural values', feedsInto: 'Cultural events — they attend, participate, get excluded' },
  { layer: 'Cultural events', icon: '📅', color: '#a889c8', whatItDoes: 'Organize the year, create shared experiences, generate pressure', feedsInto: 'Media networks — who covers what determines who wins' },
  { layer: 'Media networks', icon: '📡', color: '#c9a84c', whatItDoes: 'Amplify moments, create narrative, control memory', feedsInto: 'Algorithms — what gets covered gets boosted' },
  { layer: 'Algorithms', icon: '⚙️', color: '#7ab3d4', whatItDoes: 'Determine what is seen, who grows, what dies', feedsInto: 'Communities — the audience the algorithm builds shapes belief' },
  { layer: 'Communities', icon: '👥', color: '#6bba9a', whatItDoes: 'Create demand, validate identity, generate new trends', feedsInto: 'Back to Creators — communities make creators, not the other way around' },
];
