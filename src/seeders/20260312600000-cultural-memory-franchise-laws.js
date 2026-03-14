'use strict';

/**
 * The Cultural Memory System — Doc 08 · v1.0 · March 2026
 * franchise_law · always_inject
 *
 * 11 entries:
 *   1.  Types of Cultural Memories
 *   2.  Memory Strength Levels
 *   3.  Cultural Archives
 *   4.  Anniversary Effects
 *   5.  Nostalgia Waves
 *   6.  Cultural Legends
 *   7.  Historical Feuds
 *   8.  Cultural Time Capsules
 *   9.  Living History — How Characters Reference the Past
 *   10. Cultural Influence Rankings
 *   11. Memory Is Power (core principle)
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('franchise_knowledge', [
      /* ─── 01 · Types of Cultural Memories ─── */
      {
        title: 'Types of Cultural Memories',
        content: JSON.stringify({
          summary: 'Memories are classified into six categories. Each category has different cultural weight, different lifespan expectations, and different ways it gets referenced when the world looks back.',
          memory_types: [
            { type: 'Historic Fashion Moment', created_by: 'A designer debut or outfit appearance that changes what fashion is allowed to be in LalaVerse', example: 'A revolutionary silhouette at Velvet Season. An award show look that gets discussed at every Velvet Season that follows.', referenced_later: '"That look is giving Velvet Season \'22 revolution energy."', story_potential: 'The designer who made it. The creator who wore it. The two people who argued about whether it was brilliant or derivative.' },
            { type: 'Viral Internet Moment', created_by: 'A post that broke the platform — escaped every cluster, reached every feed, became everyone\'s shorthand', example: 'A dance challenge that spread worldwide. A comedian\'s meme that every creator copied for a month.', referenced_later: 'The format gets revived years later. Creators credit it without knowing its origin.', story_potential: 'The creator who made it anonymously. The creator who got credited for it instead. The original post that nobody can find anymore.' },
            { type: 'Legendary Collaboration', created_by: 'An unexpected partnership between creators who shouldn\'t fit together — the combination produces something neither could alone', example: 'A luxury fashion designer partnering with a street style creator. A beauty founder and a musician.', referenced_later: 'The collaboration becomes the before-and-after for both creators\' careers. Referenced when discussing career pivots.', story_potential: 'The negotiation that almost didn\'t happen. The thing neither creator will say publicly about what making it cost.' },
            { type: 'Cultural Scandal', created_by: 'A major controversy that shook the world — not just the immediate audience, but the entire ecosystem', example: 'Leaked messages. Cheating scandal. A brand betrayal that cost thousands of people money.', referenced_later: '"This drama is bigger than the Creator Cruise scandal." The benchmark for every subsequent drama.', story_potential: 'The people who knew before it became public. The ones who stayed silent. The ones who broke the story and why that night.' },
            { type: 'Industry Breakthrough', created_by: 'A moment that changed what an industry is capable of — a technology, a technique, a platform', example: 'A beauty lab inventing a new cosmetic technology. A creator launching a platform that changed how content is distributed.', referenced_later: 'Referenced when explaining where the current standard came from. The founder often not named.', story_potential: 'Who got credit. Who did the work. The distance between those two answers.' },
            { type: 'Award Moment', created_by: 'A win or snub at a major awards show that shifts the status hierarchy in a lasting way', example: 'A newcomer winning Creator of the Year. A legendary designer receiving a lifetime honor. The snub that everyone still discusses.', referenced_later: 'The award season that followed was never the same. The winner or the snubbed creator became a reference point.', story_potential: 'The vote that almost went the other way. The creator in the audience who found out she lost from the presenter\'s mouth.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 02 · Memory Strength Levels ─── */
      {
        title: 'Memory Strength Levels',
        content: JSON.stringify({
          summary: 'Not all events are remembered equally. The strength level determines how long a memory persists, how often it gets referenced, and whether it becomes part of LalaVerse\'s permanent record.',
          levels: [
            { level: 1, name: 'Trending Moment', lifespan: '1–2 weeks', referenced: 'While trending — then essentially gone', elevates: 'Going viral is not enough. A trending moment requires volume without depth.', example: 'A meme that everyone used for two weeks. Nobody can remember it six months later.' },
            { level: 2, name: 'Cultural Moment', lifespan: '1–2 years', referenced: 'Within the industry that produced it — the community remembers even when the outside world doesn\'t', elevates: 'Requires cross-cluster spread. The moment has to escape its origin industry.', example: 'A famous collaboration that defined a season. The creators\' audiences overlap now because of it.' },
            { level: 3, name: 'Historic Event', lifespan: 'Many years — carried in conversation as shared reference', referenced: '"Remember when..." — the phrasing assumes shared memory', elevates: 'Requires impact that changed behavior. Not just what people watched — what people did differently after.', example: 'A legendary award win that reset who was at the top of a category for the next decade.' },
            { level: 4, name: 'Mythic Moment', lifespan: 'Permanent — part of LalaVerse\'s origin story', referenced: 'Cited as foundation — "before/after" language. Referenced without explanation because everyone knows.', elevates: 'Requires cultural paradigm shift. The moment that makes the thing that came before it feel impossible to return to.', example: 'The fashion revolution that made the previous aesthetic unwearable overnight. Or the scandal that changed what the audience will tolerate.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 03 · Cultural Archives ─── */
      {
        title: 'Cultural Archives',
        content: JSON.stringify({
          summary: 'LalaVerse maintains institutional archives of important events. These archives are maintained by specific media networks and cultural institutions — and who controls the archive controls the memory.',
          archives: [
            { archive: 'The Velvet Archive', maintained_by: 'Velvet City institutions + The Velvet Report', tracks: 'Runway collections, style revolutions, designer legacies, Atelier Circuit history', leaves_out: 'Street style, underground fashion, everything that didn\'t receive an invitation', narrative_control: 'The designers with the longest relationships with Velvet City institutions. What got archived is what they valued.' },
            { archive: 'Glow Archives', maintained_by: 'The Glow Institute + Glow Gazette', tracks: 'Cosmetic innovations, viral beauty trends, technique origins, Glow Honors history', leaves_out: 'Salon-level invention — the techniques that started in Glow District that didn\'t get attributed', narrative_control: 'The beauty brands with the longest advertising relationships with the Glow Gazette. The brand that funded the archive owns the story.' },
            { archive: 'The Creator Chronicle', maintained_by: 'Creator Harbor community + the Creator Conservatory', tracks: 'Influencer milestones, viral moments, creator economy breakthroughs, platform history', leaves_out: 'The creators who built significant audiences but never received institutional recognition', narrative_control: 'Whoever was prominent in Creator Harbor when the Chronicle was being written. First-mover advantage in the documentation.' },
            { archive: 'The Whisper Ledger', maintained_by: 'The Whisper Wire', tracks: 'Feuds, breakups, public controversies, cancelled creators, apology records', leaves_out: 'Everything that settled out of the public view — the private resolutions that didn\'t generate engagement', narrative_control: 'The Whisper Wire\'s editors. The most dangerous archive — it preserves what everyone wanted to forget.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 04 · Anniversary Effects ─── */
      {
        title: 'Anniversary Effects',
        content: JSON.stringify({
          summary: 'Important events get remembered annually. Media networks repost. Audiences re-engage. Characters who were involved are asked to comment. The anniversary creates a second wave of cultural conversation around the original event.',
          anniversary_types: [
            { type: 'Fashion collection anniversary', who_reengages: 'The designer, the creator who wore the pieces, the fashion critics who covered it originally', surfaced: 'The original coverage, behind-the-scenes content that didn\'t release at the time, the collection\'s influence on what came after', story: 'The designer who has changed enough that the anniversary is an uncomfortable mirror. The collection she would do differently now.' },
            { type: 'Viral moment anniversary', who_reengages: 'The creator who made it, everyone who built on it, the audience that was there', surfaced: 'The original post, the context that the viral spread removed, the creator\'s version of what it actually meant', story: 'The creator who went viral for something she didn\'t intend. Five years later, still being asked about it.' },
            { type: 'Scandal anniversary', who_reengages: 'Media outlets covering it again, the people involved if they\'re still active', surfaced: 'The original reporting, the response, what changed or didn\'t change after', story: 'The creator who has moved on being pulled back. The apology that looks different from a year away. The person who was accused who was actually innocent.' },
            { type: 'Award show anniversary', who_reengages: 'The winners, the snubbed nominees, the industry that voted', surfaced: 'The voting breakdown if it was revealed, the acceptance speech, what each winner built after the win', story: 'The snub that still stings. The winner who peaked that night. Both of them being asked about it annually.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'cultural-calendar']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 05 · Nostalgia Waves ─── */
      {
        title: 'Nostalgia Waves',
        content: JSON.stringify({
          summary: 'Older trends return. The revival is never identical to the original — it carries the weight of the intervening years, the knowledge that it ended before, and the question of whether this time is different.',
          nostalgia_types: [
            { type: 'Aesthetic revival', returns: 'Retro fashion or beauty look from a previous era in LalaVerse', driven_by: 'Younger creators who weren\'t there for the original — the aesthetic arrives to them as fresh', original_reaction: 'The creator who originated it either resurfaces with the revival or watches it happen without her', story_in_gap: 'The revival erases the original context. What the aesthetic meant the first time is not what it means now.' },
            { type: 'Format revival', returns: 'A content format or challenge that went dormant returning', driven_by: 'Algorithm changes that reward the old format, or a major creator adopting it unironically', original_reaction: 'The creator who built their early audience on the format suddenly relevant again', story_in_gap: 'She has to decide: participate and claim the origin, or let it happen without her.' },
            { type: 'Creator comeback', returns: 'A creator who went quiet or was cancelled returning to the Feed', driven_by: 'The creator themselves, often with a different framing of who they are now', original_reaction: 'Former collaborators, former rivals, the audience that was there before', story_in_gap: 'The people who defended her when it mattered. The people who didn\'t. Who gets her first post-comeback content.' },
            { type: 'Cultural moment revival', returns: 'A reference to a historic event that makes it newly relevant', driven_by: 'Something happening now that mirrors something that happened before', original_reaction: 'The people who were part of the original event re-entering the conversation', story_in_gap: 'The moment felt different the first time. The revival proves it was the template.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 06 · Cultural Legends ─── */
      {
        title: 'Cultural Legends',
        content: JSON.stringify({
          summary: 'Some creators become legendary figures — their stories preserved in cultural memory, their names used as shorthand, their careers studied by the generation that follows. Legendary status is conferred by the culture, not claimed by the creator.',
          paths_to_legend: [
            { path: 'Inventing a major trend', requires: 'First mover on something that escaped origin cluster and became platform-wide', costs: 'Credit — the trend often gets attributed to whoever amplified it, not who invented it', preserved: 'The Creator Chronicle, if the documentation happened fast enough. The Archivist, if it didn\'t.' },
            { path: 'Surviving a defining controversy', requires: 'Coming back after a significant public fall — stronger, more specific, more honest than before', costs: 'Privacy. The recovery is always more exposed than the original person was before the fall.', preserved: 'The Whisper Ledger has both versions. The survivor controls neither.' },
            { path: 'Building a lasting institution', requires: 'Creating something that outlasts the personal content — a brand, a school, a platform, a methodology', costs: 'The individual identity, which gets absorbed into the institutional one. She becomes the founder.', preserved: 'The institution itself. What she built is the archive.' },
            { path: 'Defining an era', requires: 'A period of culture that the entire ecosystem organized around — named after the person, referenced by year', costs: 'The weight of being the reference point. Every creator who came after is compared to her.', preserved: 'Every archive simultaneously. Era-defining figures appear in every archive because every industry intersects with an era.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 07 · Historical Feuds ─── */
      {
        title: 'Historical Feuds',
        content: JSON.stringify({
          summary: 'Certain rivalries become part of LalaVerse history — not just a current story but a permanent reference. The feud outlasts both careers and continues to be discussed when neither party is currently relevant.',
          timeline_stages: [
            { stage: 'Year 1: Origin', looks_like: 'The initial conflict — often misread as minor at the time. The audience doesn\'t yet know this is the beginning.', attention: 'The immediate followers of each party', preserved: 'Screenshots. There are always screenshots.' },
            { stage: 'Year 2–3: Escalation', looks_like: 'The feud becomes public narrative — media coverage, audience sides, event proximity moments at Velvet Season or Starlight Awards', attention: 'The entire industry — this is entertainment with stakes', preserved: 'The Whisper Ledger coverage. Every outlet has a take. The takes become the history.' },
            { stage: 'Year 5+: Legacy', looks_like: 'The feud is historical — referenced to explain current events, taught as example, invoked whenever similar situations arise', attention: 'Cultural commentators, industry analysts, anyone explaining how LalaVerse works', preserved: 'The narrative that survived — not necessarily the accurate one. The one that made better content.' },
            { stage: 'Post-resolution (if it ends)', looks_like: 'The reconciliation, ignored alliance, or professional distance — all three land differently', attention: 'Everyone who picked a side. They feel robbed of the ending they were promised.', preserved: 'The reconciliation post. Or the notable absence of one.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'relationship-engine', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 08 · Cultural Time Capsules ─── */
      {
        title: 'Cultural Time Capsules',
        content: JSON.stringify({
          summary: 'Every few years LalaVerse reflects on past eras. Media networks compile retrospectives. The culture looks back and decides what mattered.',
          capsule_types: [
            { type: 'Top Trends of the Decade', made_by: 'Trend Telescope + Creator Chronicle', included: 'The trends with the highest viral spread and longest cultural lifespan', left_out: 'Trends that spread in specific communities without reaching platform-wide scale', story_vs_truth: 'The decade had one dominant aesthetic. The retrospective says it was unanimous. There were three years of real disagreement before the consensus formed.' },
            { type: 'Creator Legacy Rankings', made_by: 'The Velvet Report + Glow Gazette + Pop Prism (each in their lane)', included: 'Creators with the most measurable cultural impact — awards, trend origination, platform growth', left_out: 'Creators who built deep community impact without the measurable metrics', story_vs_truth: 'The ranking rewards the creators who were most visible. The most influential creators are sometimes the ones the ranking missed.' },
            { type: 'Defining Scandals', made_by: 'The Whisper Ledger\'s retrospective issue', included: 'The controversies that changed creator behavior, platform policy, or audience expectations', left_out: 'The accusations that were later found to be false — the ledger preserves those too, with less prominence', story_vs_truth: 'The scandal that felt enormous in the moment. The retrospective reveals what actually changed and what didn\'t.' },
            { type: 'The Year in Fashion / Beauty', made_by: 'Velvet Archive + Glow Archives annual compilation', included: 'The collections, looks, and techniques that defined the year\'s aesthetic', left_out: 'The underground aesthetics that influenced the mainstream without being credited', story_vs_truth: 'The Year in Fashion is a story told by the people who were invited. The year had other stories.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 09 · Living History — How Characters Reference the Past ─── */
      {
        title: 'Living History — How Characters Reference the Past',
        content: JSON.stringify({
          summary: 'The Cultural Memory System gives characters language for the world\'s history. References make LalaVerse feel deep and lived-in — the past is always present in how characters describe the present.',
          reference_types: [
            { type: 'Era comparison', example: '"This aesthetic is pure Velvet Season \'22 energy."', narrative_function: 'Establishes that LalaVerse has a documented past — the world is old enough to have eras that can be evoked.' },
            { type: 'Event benchmark', example: '"This drama is bigger than the Creator Cruise scandal."', narrative_function: 'Calibrates the scale of a current event against a historical one — the reference tells you how serious this is.' },
            { type: 'Creator as verb', example: '"She pulled a [legendary creator name]." — meaning she did something that creator is famous for doing.', narrative_function: 'The creator has become language. Cultural shorthand. That is what legendary status looks like from the inside.' },
            { type: 'Archive citation', example: '"The Velvet Archive has her first collection documented. You can trace the whole evolution."', narrative_function: 'The archive is legible to characters — they can access history. They don\'t have to take anyone\'s word for it.' },
            { type: 'Nostalgia invocation', example: '"This trend is giving 2018 Glow Week vibes." / "That\'s vintage Creator Harbor energy."', narrative_function: 'Years are reference points. The culture has a timeline. Characters know where they are in it.' },
            { type: 'Anniversary acknowledgment', example: '"It\'s been five years since the Starlight Awards meltdown. Every outlet is running retrospectives."', narrative_function: 'The past is active — it returns on schedule. The anniversary is content. Memory is a system.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-personality']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 10 · Cultural Influence Rankings ─── */
      {
        title: 'Cultural Influence Rankings',
        content: JSON.stringify({
          summary: 'Historical impact can be measured. These rankings determine who gets Legendary status — and who gets forgotten.',
          metrics: [
            { metric: 'Trends started', measures: 'How many cultural movements originated with this creator and can be traced back to them', measured_by: 'The Creator Chronicle + Trend Telescope archives', misses: 'Trends that originated with the creator but were credited to the amplifier. Invisible origin stories.' },
            { metric: 'Awards won', measures: 'Formal institutional recognition across career — Starlight, Style Crown, Glow Honors, Viral Impact', measured_by: 'The award shows\' own records', misses: 'Creators who were consistently snubbed by the institutions while shaping the culture those institutions cover.' },
            { metric: 'Collaborations created', measures: 'How many significant partnerships this creator was central to — joint launches, brand creations, mentor relationships', measured_by: 'Creator Chronicle + Velvet Archive cross-reference', misses: 'The collaborations that happened privately and shaped careers without a public record.' },
            { metric: 'Cultural references generated', measures: 'How often this creator is used as shorthand by other creators — named as influence, cited as origin, used as comparison', measured_by: 'Language itself. How often the name appears in subsequent content.', misses: 'The creators who influenced without being named — the founders of aesthetics that the culture absorbed and forgot to credit.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── Memory Is Power (core principle) ─── */
      {
        title: 'Memory Is Power — Core Principle',
        content: JSON.stringify({
          summary: 'Who controls the archive controls the history. Who names the era controls what the era means. Who gets credited for the trend controls the legacy.',
          rule: 'LalaVerse has been documenting itself since it began. Some of that documentation is accurate. Some of it is the story that made better content. The difference between those two things is where the most interesting characters live.',
          instruction: 'The story engine reads this document before generating any scene involving cultural history, past events being referenced, anniversaries, archive content, nostalgia waves, or any moment where the world\'s memory of something shapes what a character does next.'
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'world-studio', 'social-timeline', 'character-registry']),
        source_document: 'cultural-memory-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'cultural-memory-v1.0',
    });
  },
};
