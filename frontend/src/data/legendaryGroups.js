/**
 * The fifty legendary roles of the LalaVerse in ten groups (moved out of
 * pages/SocialSystems.jsx, 2026-10-06, so the Society front page can read
 * them too). All are placeholders: a role gets its name through the
 * Character Registry.
 */
export const LEGENDARY_GROUPS = [
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
