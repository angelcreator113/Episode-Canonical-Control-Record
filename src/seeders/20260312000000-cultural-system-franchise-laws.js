'use strict';

/**
 * Seeder: LalaVerse Cultural System — Franchise Laws
 * ─────────────────────────────────────────────────────────────────────────
 * Ingests the cultural system reference data as franchise_knowledge entries:
 *   - Fashion Industry Hierarchy (5 tiers)
 *   - Beauty Industry Ecosystem (5 tiers)
 *   - Award Systems (4 shows)
 *   - Gossip Media Networks (5 outlets)
 *   - Story Engine Integration rules
 *
 * All entries: category=franchise_law, always_inject=true, severity=critical
 * Idempotent: deletes previous cultural-system entries before re-seeding.
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const src = 'cultural-system-v1.0';

    // Clear previous cultural system entries for idempotency
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: src,
    });

    const entries = [

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
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
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
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── AWARD SYSTEMS ────────────────────────────────────────────────

      {
        title: 'LalaVerse Award Systems — Four Major Shows',
        content: `Four major award shows. Each has its own culture, politics, and snubs that the Feed argues about for weeks.

STARLIGHT AWARDS — The main event. Creator recognition across all categories.
Categories: Creator of the Year, Fashion Creator of the Year, Beauty Creator of the Year, Breakout Creator, Storyteller of the Year, Entrepreneur of the Year.

STYLE CROWN AWARDS — Fashion creators and industry figures only.
Categories: Best Stylist, Best Outfit Creator, Best Designer, Best Brand Collaboration, Street Style Icon of the Year.

GLOW HONORS — Beauty industry recognition.
Categories: Best Makeup Artist, Best Skincare Creator, Best Beauty Brand, Best Tutorial Series, Glow Innovator of the Year.

VIRAL IMPACT AWARDS — Internet culture, viral moments, meme-ability.
Categories: Most Viral Moment, Funniest Creator, Most Influential Post, Best Comeback, Community Builder of the Year.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['awards', 'starlight_awards', 'style_crown', 'glow_honors', 'viral_impact']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── GOSSIP MEDIA NETWORKS ────────────────────────────────────────

      {
        title: 'Gossip Media Networks — Five Outlets',
        content: `Five outlets cover all major events and drama. Every character in LalaVerse has a relationship to these outlets — some court them, some fear them, some have been destroyed by them.

THE VELVET REPORT — Fashion and luxury culture. Covers Velvet Season, Atelier Circuit front row reporting, Tier 1 and Tier 2 fashion news, luxury brand editorial.

GLOW GAZETTE — Beauty culture and product launches. Covers Glow Week, beauty brand launch reviews, salon trend reports, beauty creator profiles.

THE WHISPER WIRE — Celebrity and influencer gossip. Covers relationship drama and reveals, influencer feuds and callouts, who unfollowed who and why, Creator Cruise fallout reporting.

POP PRISM — Entertainment and pop culture. Covers music creator coverage, viral creator moments, Soundwave Nights reporting, Cloud Carnival coverage.

TREND TELESCOPE — Trend forecasting and cultural prediction. Covers Trend Summit, next-year predictions, emerging creator spotlights, aesthetic shift documentation.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['media', 'gossip', 'press', 'feed']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── STORY ENGINE INTEGRATION RULES ───────────────────────────────

      {
        title: 'Cultural Calendar — Story Engine Integration',
        content: `ALWAYS INJECT: The cultural calendar is franchise_law with always_inject=true. The story engine reads it before generating any scene involving creator culture, brand deals, industry events, fashion, beauty, or social media behavior in LalaVerse. A character's attendance or absence from any event is a character statement — never background noise.

AUTOMATIC STORY PRESSURE: Every major event generates a pressure wave. When a calendar event fires, the system asks for every character in range:
• Is this character in the industry tier that participates in this event?
• Did they attend, skip, crash, or get excluded?
• Who did they see there? Who saw them?
• What did their attendance or absence signal to the Feed?
• How does this event touch their Deep Profile dimensions?

THE ATELIER CIRCUIT — SPECIAL STATUS: The Atelier Circuit (August) is the largest fashion event of the year. Front row placement is tracked as a power metric. Every fashion-tier character's position is logged as a story event. The gap between where a character expected to be seated and where they were actually seated is always a story.

STARLIGHT AWARDS — SPECIAL STATUS: The Starlight Awards (November) are the most significant recognition event. Nominations and wins change career trajectory. Snubs generate weeks of Feed pressure. Speeches become cultural reference points. Red carpet fashion rivals the Atelier Circuit. Every character has a relationship to the Starlights — as nominee, winner, snubbed, presenter, audience, or watcher from home.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_engine', 'scene_generation', 'character_behavior', 'feed']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
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

Birthday dates are assigned when the icon characters are generated. Until then, these are template events in the cultural calendar.`,
        category: 'franchise_law',
        severity: 'important',
        always_inject: false,
        applies_to: JSON.stringify(['birthdays', 'icons', 'cultural_moments']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── MICRO EVENTS REFERENCE ───────────────────────────────────────

      {
        title: 'Micro Events — Recurring Cultural Moments',
        content: `Nine micro events happen frequently throughout the year. They are not anchored to a specific month — they fire when the cultural moment is right. They create viral Feed moments and short-duration story pressure.

THE OUTFIT GAMES: Fashion competition moments — anyone can enter, anyone can win, anyone can be humiliated.
BEAUTY BATTLES: Head-to-head beauty creator challenges. The loser loses followers. The winner gains a story.
PET PARADE: Lower stakes, high warmth, unexpected visibility for otherwise serious characters.
DESIGN DUELS: Smaller design competitions previewing the October Design Duel. Testing ground for emerging talent.
CREATOR ROAST NIGHT: Public roasting. Everything is jokes until someone goes too far.
STYLE SWITCH CHALLENGE: Creators swap aesthetics. Reveals who is a persona and who is actually themselves.
MAKEOVER MARATHON: Extended transformation content — not just beauty, but identity.
INFLUENCER SPEED DATING: Rapid-fire collab pitches. Alliances form fast.
FASHION MYSTERY BOX CHALLENGE: Style from a mystery selection. Constraint reveals true taste.`,
        category: 'franchise_law',
        severity: 'important',
        always_inject: true,
        applies_to: JSON.stringify(['micro_events', 'feed', 'story_pressure']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Cultural System v1.0 — March 2026',
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
      source_document: 'cultural-system-v1.0',
    });
  },
};
