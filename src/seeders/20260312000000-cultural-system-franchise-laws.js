'use strict';

/**
 * Seeder: LalaVerse Cultural System — Franchise Laws v2.0
 * ─────────────────────────────────────────────────────────────────────────
 * Ingests the cultural system reference data as franchise_knowledge entries:
 *   - Celebrity & Creator Hierarchy (6 tiers) — NEW
 *   - Fashion Industry Hierarchy (5 tiers)
 *   - Beauty Industry Ecosystem (5 tiers)
 *   - Social Algorithm System (4 forces) — NEW
 *   - Social Drama Mechanics (5 types) — NEW
 *   - Award Systems (4 shows, updated categories)
 *   - Gossip Media Networks (5 outlets, with power column)
 *   - Story Engine Integration rules
 *   - The 25 Most Famous Characters — NEW
 *   - Major Cultural Birthdays (5 icons)
 *   - Micro Events (13 floating events)
 *
 * All entries: category=franchise_law, always_inject=true, severity=critical
 * Idempotent: deletes previous cultural-system entries before re-seeding.
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const src = 'cultural-system-v2.0';

    // Clear previous cultural system entries for idempotency (both v1.0 and v2.0)
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'cultural-system-v1.0',
    });
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: src,
    });

    const entries = [

      // ─── CELEBRITY & CREATOR HIERARCHY (6 TIERS) ──────────────────────

      {
        title: 'Celebrity & Creator Hierarchy — 6 Status Tiers',
        content: `The social ecosystem operates in status tiers. Where a character sits determines what they can access, who notices them, and what cultural events mean for their arc.

TIER 1 — CULTURAL ICONS (10M+ followers): Platform-defining figures. Define trends. Headline global events. Appear at Starlight Awards. Their opinion reshapes the Feed.

TIER 2 — INDUSTRY TITANS (5M–10M followers): Major designers, beauty founders, entertainment stars. Shape industry direction. Sponsor major events.

TIER 3 — MAJOR INFLUENCERS (1M–5M followers): Fashion creators, lifestyle influencers. Move culture at scale. Front row at everything.

TIER 4 — RISING CREATORS (100K–1M followers): Viral creators, niche experts. The dangerous tier — where careers accelerate or collapse.

TIER 5 — MICRO CREATORS (10K–100K followers): Niche community creators. Deep trust, narrow reach. Brands court them for authenticity.

TIER 6 — EVERYDAY CREATORS (0–10K followers): Local personalities, hobby creators. The origin of culture. Everything starts here.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['celebrity', 'creator', 'social_status', 'hierarchy', 'followers']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── FASHION INDUSTRY HIERARCHY ───────────────────────────────────

      {
        title: 'Fashion Industry Hierarchy — Complete',
        content: `Five tiers define power in LalaVerse's fashion world. Where a character sits determines what they can access, who notices them, and what the Atelier Circuit and Velvet Season mean for their arc.

TIER 1 — LEGENDARY DESIGNERS: Couture houses, global designers, style icons who define the culture. Control trends. Headline Velvet Season. Dominate the Atelier Circuit. Their opinion is law.

TIER 2 — FASHION HOUSES: Large clothing companies, luxury labels, established brands. Influence seasonal aesthetics. Sponsor major events. Front row at every show.

TIER 3 — STYLISTS: Image creators who work with celebrities, influencers, and campaigns. The invisible power. They decide what the Tier 1s wear. Their aesthetic becomes canon.

TIER 4 — FASHION CREATORS: Online fashion influencers, outfit creators, style bloggers. Move product. Create desire. The Tier 1s watch them for street-level taste signals.

TIER 5 — STREET STYLE ICONS: Emerging trendsetters, often discovered during Outfit Games and Style Market. The origin point of culture. Before the trend is a trend, it's on their back.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['fashion', 'atelier_circuit', 'velvet_season', 'outfit_games', 'style_market']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── BEAUTY INDUSTRY ECOSYSTEM ────────────────────────────────────

      {
        title: 'Beauty Industry Ecosystem — Complete',
        content: `Five tiers define power in LalaVerse's beauty world. Glow Week is where careers are made. The Glow Honors are where they're recognized.

TIER 1 — BEAUTY EMPIRES: Major cosmetics and skincare companies that define the category. Set the product agenda. Their launches become cultural events. Glow Week belongs to them.

TIER 2 — BEAUTY LABS: Innovation companies developing ingredients, formulas, and tools. The science behind the beauty. Emerging brands partner with them to establish credibility.

TIER 3 — SALON OWNERS: Local beauty powerhouses — lash studios, nail salons, skin clinics. Ground-level trend creation. The look starts in their chair before it's on the Feed.

TIER 4 — BEAUTY CREATORS: Makeup artists, skincare influencers, tutorial creators. Translate beauty trends into desire. Their reviews move product. Brands court them constantly.

TIER 5 — BEAUTY STUDENTS: Emerging talent, often discovered during Glow Week. The next generation watching everyone above them. One viral moment changes everything.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['beauty', 'glow_week', 'glow_honors']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── SOCIAL ALGORITHM SYSTEM ──────────────────────────────────────

      {
        title: 'Social Algorithm System — Four Forces',
        content: `Content visibility is shaped by four forces. The story engine reads these when determining what characters see, what goes viral, and what gets buried.

ENGAGEMENT ENERGY: Measured by comments, shares, saves — active signals. High engagement = higher distribution. A post that sparks argument spreads further than one that gets likes.

TREND ALIGNMENT: Measured by connection to current cultural events. Event-aligned content gets boosted during that event. Glow Week content trends during Glow Week. Posting off-cycle gets buried.

CREATOR MOMENTUM: Measured by consistency of posting cadence. Consistent accounts gain algorithmic favor. A creator who disappears for two weeks loses ground another creator took.

NETWORK CLUSTERS: Measured by fashion, beauty, entertainment, fitness circles. Content boosted within relevant community. A post that breaks its cluster and enters a new one is a cultural moment.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['algorithm', 'feed', 'social_media', 'content_visibility', 'viral']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── SOCIAL DRAMA MECHANICS ───────────────────────────────────────

      {
        title: 'Social Drama Mechanics — Five Types',
        content: `Drama drives viral engagement. These situations consistently generate feed spikes — the algorithm amplifies them because engagement is extreme.

BREAKUPS: Relationship splits going public. Massive attention spike — audiences choose sides. Story thread: Who knew before the post. Who pretended to be surprised.

FEUDS: Creator disagreements — public or leaked. Viral debates, ratio wars, fan armies mobilizing. Story thread: What started it privately vs. what the public sees.

PUBLIC APOLOGIES: Controversy leading to accountability post. Curiosity + judgment + counter-commentary. Story thread: Whether the apology is real or strategic is always the subtext.

RIVALRIES: Competitors pursuing the same space. Fans organize, comparisons trend. Story thread: The rivalry the audience invented vs. the relationship they actually have.

SCANDALS: Leaks, rumors, accusations. Feed-dominating — pushes everything else out. Story thread: What is true, what is exaggerated, who benefits from the timing.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['drama', 'feed', 'social_media', 'viral', 'conflict']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── AWARD SYSTEMS ────────────────────────────────────────────────

      {
        title: 'LalaVerse Award Systems — Four Major Shows',
        content: `Four major award shows. Each has its own culture, politics, and snubs that the Feed argues about for weeks.

STARLIGHT AWARDS (November) — The main event. Creator recognition across all categories.
Categories: Creator of the Year, Fashion Icon, Beauty Innovator, Storyteller of the Year, Breakout Creator, Entrepreneur of the Year.

STYLE CROWN AWARDS (March) — Fashion industry recognition.
Categories: Best Stylist, Best Outfit Creator, Best Designer, Best Brand Collaboration, Street Style Icon of the Year.

GLOW HONORS (September) — Beauty creator recognition.
Categories: Best Makeup Artist, Best Skincare Creator, Best Beauty Brand, Best Tutorial Series, Glow Innovator of the Year.

VIRAL IMPACT AWARDS (July) — Internet culture, viral moments, meme-ability.
Categories: Most Viral Moment, Funniest Creator, Most Influential Post, Best Comeback, Community Builder of the Year.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['awards', 'starlight_awards', 'style_crown', 'glow_honors', 'viral_impact']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── GOSSIP MEDIA NETWORKS ────────────────────────────────────────

      {
        title: 'Gossip Media Networks — Five Outlets',
        content: `Five outlets cover all major events and drama. Every character in LalaVerse has a relationship to these outlets — some court them, some fear them, some have been destroyed by them.

THE VELVET REPORT — Focus: Fashion and luxury culture. Covers: Velvet Season, Atelier Circuit, Tier 1–2 fashion news. Power: Being ignored by Velvet Report is its own story.

GLOW GAZETTE — Focus: Beauty industry. Covers: Glow Week, beauty brand launches, salon trend reports. Power: A Glow Gazette review can make or break a product launch.

THE WHISPER WIRE — Focus: Celebrity and influencer gossip. Covers: Relationship drama, feuds, who unfollowed who. Power: The Whisper Wire always knows. The question is when they publish.

POP PRISM — Focus: Entertainment and pop culture. Covers: Music creators, viral moments, Cloud Carnival. Power: Pop Prism decides what becomes a cultural reference point.

TREND TELESCOPE — Focus: Trend forecasting. Covers: Trend Summit coverage, upcoming aesthetics, emerging creators. Power: Being predicted by Trend Telescope before you peak is the signal.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['media', 'gossip', 'press', 'feed']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── STORY ENGINE INTEGRATION RULES ───────────────────────────────

      {
        title: 'Cultural Calendar — Story Engine Integration',
        content: `ALWAYS INJECT: The cultural calendar is franchise_law with always_inject=true. The story engine reads it before generating any scene involving creator culture, algorithm behavior, drama events, or award seasons in LalaVerse. A character's attendance or absence from any event is a character statement — never background noise.

AUTOMATIC STORY PRESSURE: Every major event generates a pressure wave. When a calendar event fires, the system asks for every character in range:
• Is this character in the celebrity/creator tier that participates in this event?
• Did they attend, skip, crash, or get excluded?
• Who did they see there? Who saw them?
• What did their attendance or absence signal to the Feed?
• How does this event touch their Deep Profile dimensions?
• What drama type might this event trigger (breakup, feud, rivalry, scandal)?

THE ATELIER CIRCUIT — SPECIAL STATUS: The Atelier Circuit (August) is the largest fashion event of the year. Front row placement is tracked as a power metric. Every fashion-tier character's position is logged as a story event. The gap between where a character expected to be seated and where they were actually seated is always a story.

STARLIGHT AWARDS — SPECIAL STATUS: The Starlight Awards (November) are the most significant recognition event. Nominations and wins change career trajectory. Snubs generate weeks of Feed pressure. Speeches become cultural reference points. Red carpet fashion rivals the Atelier Circuit. Every character has a relationship to the Starlights — as nominee, winner, snubbed, presenter, audience, or watcher from home.

ALGORITHM AWARENESS: The social algorithm shapes what characters see and what goes viral. Engagement energy, trend alignment, creator momentum, and network clusters all determine content distribution. The story engine factors these when generating Feed reactions to events.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_engine', 'scene_generation', 'character_behavior', 'feed', 'algorithm']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── THE 25 MOST FAMOUS CHARACTERS ────────────────────────────────

      {
        title: 'The 25 Most Famous Characters — Cultural Icons',
        content: `These figures shape the culture of LalaVerse. All placeholders — names assigned when characters are generated through the Character Registry.

1. THE STYLE QUEEN — Defines what is fashionable. Her opinion reshapes the Feed.
2. THE GLOW GURU — Defines beauty standards. Her recommendations sell out in hours.
3. THE CREATOR KING — Represents success culture. Entrepreneurs model themselves on him.
4. THE TREND ORACLE — Predicts cultural shifts before they happen. Always right, always cryptic.
5. THE FASHION REBEL — Breaks every rule the Style Queen sets. The counterculture anchor.
6. THE BEAUTY SCIENTIST — Makes beauty intellectual. Evidence-based, not aspirational.
7. THE STREET STYLE ICON — Lives at the origin of trends before they have names.
8. THE MEME MONARCH — Turns every cultural moment into a joke that outlasts the moment.
9. THE NIGHTLIFE QUEEN — Controls what happens after midnight in LalaVerse.
10. THE VIRAL COMEDIAN — Makes the platform laugh. Laughter is its own kind of power.
11. THE WELLNESS PROPHET — The counter-narrative to hustle culture. Rest as resistance.
12. THE DESIGN GENIUS — Solves problems beautifully. Aesthetics and function together.
13. THE POP STAR CREATOR — Crosses music and content. Two audiences become one.
14. THE GOSSIP EMPRESS — Knows everything. Shares it strategically. Never wrong.
15. THE DIGITAL MOGUL — Built an empire from content. The proof that it's possible.
16. THE TRAVEL QUEEN — Makes the world feel accessible and aspirational simultaneously.
17. THE FITNESS TITAN — Physical transformation as identity. The body as project.
18. THE CHEF CREATOR — Food as culture, not just content. Elevates the everyday.
19. THE ART VISIONARY — Makes the platform take beauty seriously.
20. THE PHOTOGRAPHER LEGEND — Documents LalaVerse. Everything important is in their archive.
21. THE MUSIC ARCHITECT — Builds sonic worlds, not just songs.
22. THE STORYTELLING MASTER — Narrative above everything. Makes content feel like literature.
23. THE CULTURE COMMENTATOR — Names what everyone is feeling but hasn't articulated yet.
24. THE CREATOR MENTOR — Grows other creators. Legacy through multiplication.
25. THE FASHION ARCHIVIST — Preserves what the Feed forgets. Memory as power.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['characters', 'famous', 'icons', 'cultural_figures', 'placeholders']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── MAJOR ICON BIRTHDAYS ─────────────────────────────────────────

      {
        title: 'Major Birthdays — Cultural Icon Events',
        content: `Certain characters in LalaVerse become cultural icons. Their birthdays become mini-events that organize the Feed for days. These are not personal celebrations — they are cultural rituals.

THE STYLE QUEEN (Fashion): Themed outfit posts across the Feed. Her aesthetic becomes a challenge. Characters who align with her gain visibility.

THE GLOW GURU (Beauty): Tutorial tributes honoring her techniques. Beauty creators compete to produce the best tribute content.

THE CREATOR KING (Entrepreneur): Mentorship content. Creators share how he influenced their path. Aspiration and gratitude dominate the Feed.

THE ICON TWINS (All Communities): Two legendary influencers born the same day. Fan edits, nostalgic posts, and the annual debate: which one is greater?

THE FOUNDER DAY (Platform-wide): Celebrates LalaVerse's creation. Every creator participates. The platform's origin story retold annually.

Birthday dates are assigned when the icon characters are generated. Until then, these are template events in the cultural calendar.`,
        category: 'franchise_law',
        severity: 'important',
        always_inject: false,
        applies_to: JSON.stringify(['birthdays', 'icons', 'cultural_moments', 'founder_day']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── MICRO EVENTS REFERENCE ───────────────────────────────────────

      {
        title: 'Micro Events — Recurring Cultural Moments',
        content: `Thirteen micro events happen frequently throughout the year. They are not anchored to a specific month — they fire when the cultural moment is right. They create viral Feed moments and short-duration story pressure.

BEAUTY BATTLES: Head-to-head beauty challenges. The audience votes. The loser loses followers publicly.
CREATOR ROAST NIGHT: Public roasting. Everything is jokes until someone goes too far.
STREET STYLE MARATHON: Extended street style documentation — the week's best looks ranked publicly.
CREATOR SPEED DATING: Rapid-fire collab pitches. Alliances form fast. Some are regretted faster.
FASHION MYSTERY BOX: Style looks from a mystery selection. Constraint reveals true taste — or lack of it.
MIDNIGHT MUSIC FESTIVAL: Late-night music culture moment. A different side of LalaVerse emerges after midnight.
THE GREAT GLOW-UP CHALLENGE: Extended transformation content — identity, not just beauty.
CREATOR CHARITY WEEK: Vulnerability and values exposed. Who shows up and who performatively shows up.
CREATOR TALENT SHOW: Skills outside the usual content lane. Surprises change how audiences see creators.
COMMUNITY BUILD WEEK: Collaborative content between otherwise competing creators. Forced proximity events.
VIRTUAL TRAVEL FESTIVAL: Digital travel content — who can make home feel like elsewhere.
ARTIST RESIDENCY MONTH: Creators slow down and make something intentional. The antidote to the content grind.
DESIGN LAB WEEK: Experimental design projects and innovation challenges. Where new ideas are tested publicly.`,
        category: 'franchise_law',
        severity: 'important',
        always_inject: true,
        applies_to: JSON.stringify(['micro_events', 'feed', 'story_pressure']),
        source_document: src,
        source_version: '2.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System Doc 02 v2.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('franchise_knowledge', entries);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'cultural-system-v2.0',
    });
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'cultural-system-v1.0',
    });
  },
};
