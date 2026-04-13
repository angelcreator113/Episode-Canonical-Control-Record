/**
 * Cultural Memory System Data — Doc 08 · v1.0
 * Memory Types, Strength Levels, Archives, Anniversaries, Nostalgia,
 * Legends, Feuds, Time Capsules, Living History, Influence Rankings
 */

export const MEMORY_TYPES = [
  { type: 'Historic Fashion Moment', created: 'A designer debut or outfit appearance that changes what fashion is allowed to be in LalaVerse', example: 'A revolutionary silhouette at Dazzle Season. An award show look that gets discussed at every Dazzle Season that follows.', referenced: '"That look is giving Dazzle Season \'22 revolution energy."', story: 'The designer who made it. The creator who wore it. The two people who argued about whether it was brilliant or derivative.', icon: '👗' },
  { type: 'Viral Internet Moment', created: 'A post that broke the platform — escaped every cluster, reached every feed, became everyone\'s shorthand', example: 'A dance challenge that spread worldwide. A comedian\'s meme that every creator copied for a month.', referenced: 'The format gets revived years later. Creators credit it without knowing its origin.', story: 'The creator who made it anonymously. The creator who got credited for it instead. The original post that nobody can find anymore.', icon: '🌐' },
  { type: 'Legendary Collaboration', created: 'An unexpected partnership between creators who shouldn\'t fit together — the combination produces something neither could alone', example: 'A luxury fashion designer partnering with a street style creator. A beauty founder and a musician.', referenced: 'The collaboration becomes the before-and-after for both creators\' careers.', story: 'The negotiation that almost didn\'t happen. The thing neither creator will say publicly about what making it cost.', icon: '🤝' },
  { type: 'Cultural Scandal', created: 'A major controversy that shook the world — not just the immediate audience, but the entire ecosystem', example: 'Leaked messages. Cheating scandal. A brand betrayal that cost thousands of people money.', referenced: '"This drama is bigger than the Creator Cruise scandal." The benchmark for every subsequent drama.', story: 'The people who knew before it became public. The ones who stayed silent. The ones who broke the story and why that night.', icon: '💥' },
  { type: 'Industry Breakthrough', created: 'A moment that changed what an industry is capable of — a technology, a technique, a platform', example: 'A beauty lab inventing a new cosmetic technology. A creator launching a platform that changed how content is distributed.', referenced: 'Referenced when explaining where the current standard came from. The founder often not named.', story: 'Who got credit. Who did the work. The distance between those two answers.', icon: '🔬' },
  { type: 'Award Moment', created: 'A win or snub at a major awards show that shifts the status hierarchy in a lasting way', example: 'A newcomer winning Creator of the Year. A legendary designer receiving a lifetime honor. The snub that everyone still discusses.', referenced: 'The award season that followed was never the same.', story: 'The vote that almost went the other way. The creator in the audience who found out she lost from the presenter\'s mouth.', icon: '🏆' },
];

export const STRENGTH_LEVELS = [
  { level: 1, name: 'Trending Moment', lifespan: '1-2 weeks', color: '#8a8a9a', referenced: 'While trending — then essentially gone', elevates: 'Going viral is not enough. A trending moment requires volume without depth.', example: 'A meme that everyone used for two weeks. Nobody can remember it six months later.' },
  { level: 2, name: 'Cultural Moment', lifespan: '1-2 years', color: '#7ab3d4', referenced: 'Within the industry that produced it — the community remembers even when the outside world doesn\'t', elevates: 'Requires cross-cluster spread. The moment has to escape its origin industry.', example: 'A famous collaboration that defined a season.' },
  { level: 3, name: 'Historic Event', lifespan: 'Many years', color: '#c9a84c', referenced: '"Remember when..." — the phrasing assumes shared memory', elevates: 'Requires impact that changed behavior. Not just what people watched — what people did differently after.', example: 'A legendary award win that reset who was at the top of a category for the next decade.' },
  { level: 4, name: 'Mythic Moment', lifespan: 'Permanent', color: '#b89060', referenced: 'Cited as foundation — "before/after" language. Referenced without explanation because everyone knows.', elevates: 'Requires cultural paradigm shift. The moment that makes the thing that came before it feel impossible to return to.', example: 'The fashion revolution that made the previous aesthetic unwearable overnight.' },
];

export const ARCHIVES = [
  { name: 'The Dazzle Archive', maintained: 'Dazzle District institutions + The Dazzle Report', tracks: 'Runway collections, style revolutions, designer legacies, Atelier Circuit history', leaves_out: 'Street style, underground fashion, everything that didn\'t receive an invitation', control: 'The designers with the longest relationships with Dazzle District institutions. What got archived is what they valued.', accent: '#d4789a' },
  { name: 'Glow Archives', maintained: 'The Radiance Institute + Glow Gazette', tracks: 'Cosmetic innovations, viral beauty trends, technique origins, Glow Honors history', leaves_out: 'Salon-level invention — the techniques that started in Radiance Row that didn\'t get attributed', control: 'The beauty brands with the longest advertising relationships with the Glow Gazette.', accent: '#a889c8' },
  { name: 'The Creator Chronicle', maintained: 'Maverick Harbor community + the Creator Conservatory', tracks: 'Influencer milestones, viral moments, creator economy breakthroughs, platform history', leaves_out: 'The creators who built significant audiences but never received institutional recognition', control: 'Whoever was prominent in Maverick Harbor when the Chronicle was being written.', accent: '#7ab3d4' },
  { name: 'The Whisper Ledger', maintained: 'The Whisper Wire', tracks: 'Feuds, breakups, public controversies, cancelled creators, apology records', leaves_out: 'Everything that settled out of the public view — the private resolutions that didn\'t generate engagement', control: 'The Whisper Wire\'s editors. The most dangerous archive — it preserves what everyone wanted to forget.', accent: '#c05050' },
];

export const ANNIVERSARIES = [
  { type: 'Fashion collection anniversary', who: 'The designer, the creator who wore the pieces, the fashion critics who covered it originally', surfaced: 'The original coverage, behind-the-scenes content that didn\'t release at the time, the collection\'s influence on what came after', story: 'The designer who has changed enough that the anniversary is an uncomfortable mirror.' },
  { type: 'Viral moment anniversary', who: 'The creator who made it, everyone who built on it, the audience that was there', surfaced: 'The original post, the context that the viral spread removed, the creator\'s version of what it actually meant', story: 'The creator who went viral for something she didn\'t intend. Five years later, still being asked about it.' },
  { type: 'Scandal anniversary', who: 'Media outlets covering it again, the people involved if they\'re still active', surfaced: 'The original reporting, the response, what changed or didn\'t change after', story: 'The creator who has moved on being pulled back. The apology that looks different from a year away.' },
  { type: 'Award show anniversary', who: 'The winners, the snubbed nominees, the industry that voted', surfaced: 'The voting breakdown if it was revealed, the acceptance speech, what each winner built after the win', story: 'The snub that still stings. The winner who peaked that night. Both of them being asked about it annually.' },
];

export const NOSTALGIA_WAVES = [
  { type: 'Aesthetic revival', returns: 'Retro fashion or beauty look from a previous era in LalaVerse', driven: 'Younger creators who weren\'t there for the original', original_reaction: 'The creator who originated it either resurfaces with the revival or watches it happen without her', gap: 'The revival erases the original context. What the aesthetic meant the first time is not what it means now.' },
  { type: 'Format revival', returns: 'A content format or challenge that went dormant returning', driven: 'Algorithm changes that reward the old format, or a major creator adopting it unironically', original_reaction: 'The creator who built their early audience on the format suddenly relevant again', gap: 'She has to decide: participate and claim the origin, or let it happen without her.' },
  { type: 'Creator comeback', returns: 'A creator who went quiet or was cancelled returning to the Feed', driven: 'The creator themselves, often with a different framing of who they are now', original_reaction: 'Former collaborators, former rivals, the audience that was there before', gap: 'The people who defended her when it mattered. The people who didn\'t. Who gets her first post-comeback content.' },
  { type: 'Cultural moment revival', returns: 'A reference to a historic event that makes it newly relevant', driven: 'Something happening now that mirrors something that happened before', original_reaction: 'The people who were part of the original event re-entering the conversation', gap: 'The moment felt different the first time. The revival proves it was the template.' },
];

export const LEGEND_PATHS = [
  { path: 'Inventing a major trend', requires: 'First mover on something that escaped origin cluster and became platform-wide', costs: 'Credit — the trend often gets attributed to whoever amplified it, not who invented it', preserved: 'The Creator Chronicle, if the documentation happened fast enough.' },
  { path: 'Surviving a defining controversy', requires: 'Coming back after a significant public fall — stronger, more specific, more honest than before', costs: 'Privacy. The recovery is always more exposed than the original person was before the fall.', preserved: 'The Whisper Ledger has both versions. The survivor controls neither.' },
  { path: 'Building a lasting institution', requires: 'Creating something that outlasts the personal content — a brand, a school, a platform, a methodology', costs: 'The individual identity, which gets absorbed into the institutional one. She becomes the founder.', preserved: 'The institution itself. What she built is the archive.' },
  { path: 'Defining an era', requires: 'A period of culture that the entire ecosystem organized around — named after the person, referenced by year', costs: 'The weight of being the reference point. Every creator who came after is compared to her.', preserved: 'Every archive simultaneously. Era-defining figures appear in every archive because every industry intersects with an era.' },
];

export const FEUD_STAGES = [
  { stage: 'Year 1: Origin', looks: 'The initial conflict — often misread as minor at the time.', attention: 'The immediate followers of each party', preserved: 'Screenshots. There are always screenshots.', color: '#7ab3d4' },
  { stage: 'Year 2-3: Escalation', looks: 'The feud becomes public narrative — media coverage, audience sides, event proximity moments', attention: 'The entire industry — this is entertainment with stakes', preserved: 'The Whisper Ledger coverage. Every outlet has a take. The takes become the history.', color: '#c9a84c' },
  { stage: 'Year 5+: Legacy', looks: 'The feud is historical — referenced to explain current events, invoked whenever similar situations arise', attention: 'Cultural commentators, industry analysts, anyone explaining how LalaVerse works', preserved: 'The narrative that survived — not necessarily the accurate one. The one that made better content.', color: '#b89060' },
  { stage: 'Post-resolution', looks: 'The reconciliation, ignored alliance, or professional distance — all three land differently', attention: 'Everyone who picked a side. They feel robbed of the ending they were promised.', preserved: 'The reconciliation post. Or the notable absence of one.', color: '#6bba9a' },
];

export const CAPSULE_TYPES = [
  { type: 'Top Trends of the Decade', made_by: 'Trend Telescope + Creator Chronicle', included: 'Trends with the highest viral spread and longest cultural lifespan', left_out: 'Trends that spread in specific communities without reaching platform-wide scale', truth: 'The decade had one dominant aesthetic. The retrospective says it was unanimous. There were three years of real disagreement.' },
  { type: 'Creator Legacy Rankings', made_by: 'Dazzle Report + Glow Gazette + Pop Prism', included: 'Creators with the most measurable cultural impact', left_out: 'Creators who built deep community impact without the measurable metrics', truth: 'The ranking rewards the creators who were most visible. The most influential are sometimes the ones the ranking missed.' },
  { type: 'Defining Scandals', made_by: 'The Whisper Ledger\'s retrospective issue', included: 'Controversies that changed creator behavior, platform policy, or audience expectations', left_out: 'Accusations that were later found to be false — the ledger preserves those too, with less prominence', truth: 'The scandal that felt enormous in the moment. The retrospective reveals what actually changed and what didn\'t.' },
  { type: 'The Year in Fashion / Beauty', made_by: 'Dazzle Archive + Glow Archives annual compilation', included: 'Collections, looks, and techniques that defined the year\'s aesthetic', left_out: 'Underground aesthetics that influenced the mainstream without being credited', truth: 'The Year in Fashion is a story told by the people who were invited. The year had other stories.' },
];

export const REFERENCE_TYPES = [
  { type: 'Era comparison', example: '"This aesthetic is pure Dazzle Season \'22 energy."', function_: 'Establishes that LalaVerse has a documented past — the world is old enough to have eras.' },
  { type: 'Event benchmark', example: '"This drama is bigger than the Creator Cruise scandal."', function_: 'Calibrates the scale of a current event against a historical one.' },
  { type: 'Creator as verb', example: '"She pulled a [legendary creator name]."', function_: 'The creator has become language. Cultural shorthand.' },
  { type: 'Archive citation', example: '"The Dazzle Archive has her first collection documented."', function_: 'The archive is legible to characters — they can access history.' },
  { type: 'Nostalgia invocation', example: '"This trend is giving 2018 Glow Week vibes."', function_: 'Years are reference points. The culture has a timeline.' },
  { type: 'Anniversary acknowledgment', example: '"It\'s been five years since the Starlight Awards meltdown."', function_: 'The past is active — it returns on schedule. Memory is a system.' },
];

export const RANKING_METRICS = [
  { metric: 'Trends started', measures: 'How many cultural movements originated with this creator', measured_by: 'The Creator Chronicle + Trend Telescope archives', misses: 'Trends credited to the amplifier, not the inventor. Invisible origin stories.' },
  { metric: 'Awards won', measures: 'Formal institutional recognition — Starlight, Style Crown, Glow Honors, Viral Impact', measured_by: 'The award shows\' own records', misses: 'Creators consistently snubbed by institutions while shaping the culture those institutions cover.' },
  { metric: 'Collaborations created', measures: 'Significant partnerships — joint launches, brand creations, mentor relationships', measured_by: 'Creator Chronicle + Dazzle Archive cross-reference', misses: 'Private collaborations that shaped careers without a public record.' },
  { metric: 'Cultural references generated', measures: 'How often this creator is used as shorthand — named as influence, cited as origin', measured_by: 'Language itself. How often the name appears in subsequent content.', misses: 'Creators who influenced without being named — the culture absorbed and forgot to credit.' },
];

export const MEMORY_DEFAULTS = {
  MEMORY_TYPES, STRENGTH_LEVELS, ARCHIVES, ANNIVERSARIES, NOSTALGIA_WAVES,
  LEGEND_PATHS, FEUD_STAGES, CAPSULE_TYPES, REFERENCE_TYPES, RANKING_METRICS,
};
