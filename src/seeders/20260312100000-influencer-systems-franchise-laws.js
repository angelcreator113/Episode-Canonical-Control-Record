'use strict';

/**
 * Seeder: LalaVerse Influencer Systems & Mechanics — Franchise Laws v1.0
 * ─────────────────────────────────────────────────────────────────────────
 * Ingests Doc 03 reference data as franchise_knowledge entries:
 *   - The 15 Influencer Personality Archetypes
 *   - The Social Relationship Graph (5 types)
 *   - The Creator Economy System (6 income streams)
 *   - The Fashion Trend Engine (5 stages)
 *   - The Beauty Trend Engine (4 stages)
 *   - Cultural Momentum Waves (5 event types)
 *   - Social Influence Power (3 forces)
 *   - Cultural Legacy (5 signals)
 *
 * All entries: category=franchise_law, always_inject=true, severity=critical
 * Idempotent: deletes previous influencer-systems entries before re-seeding.
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const src = 'influencer-systems-v1.0';

    // Clear previous entries for idempotency
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: src,
    });

    const entries = [

      // ─── THE 15 INFLUENCER PERSONALITY ARCHETYPES ─────────────────────

      {
        title: 'The 15 Influencer Personality Archetypes',
        content: `Every major creator tends to fall into one of these patterns. They shape how audiences behave, what content spreads, and what a creator's presence means in LalaVerse. A creator can carry more than one archetype — the tension between two archetypes in the same person is often the story.

01 THE MAIN CHARACTER: Content — Relationship stories, glow-ups, emotional monologues, life updates as episodes. Audience Effect — Followers feel like they're watching someone's life unfold in real time. Narrative Function — The character the audience is emotionally invested in. Their choices matter.

02 THE TRENDSETTER: Content — Outfit reveals, experimental looks, aesthetic shifts before they're mainstream. Audience Effect — Starts fashion waves — the audience finds out they were early after the fact. Narrative Function — First adopter. Signals what's coming. Gets credit or gets copied.

03 THE BEAUTY ORACLE: Content — Skincare routines, makeup trends, beauty reviews, technique breakdowns. Audience Effect — Influences product sales and redefines beauty standards. Narrative Function — Authority figure. When she says something is over, it's over.

04 THE HUSTLE MOGUL: Content — Business advice, income transparency, motivational content, launch documentation. Audience Effect — Promotes entrepreneurship culture — followers build things. Narrative Function — The proof it's possible. Also: the cautionary tale when the hustle isn't real.

05 THE ENTERTAINER: Content — Comedy, skits, memes, reaction content, viral formats. Audience Effect — Drives platform engagement — the reason people open the app. Narrative Function — Releases tension. The comic relief that's sometimes the most honest voice.

06 THE DRAMA MAGNET: Content — Arguments, callouts, response videos, receipts. Audience Effect — Creates viral gossip cycles — the audience arrives for the drama. Narrative Function — Catalyst. Things happen around them. Often not by accident.

07 THE RELATABLE FRIEND: Content — Daily life, parenting struggles, honest confessions, low-production realness. Audience Effect — Builds deep audience trust — feels like someone the audience actually knows. Narrative Function — The emotional anchor. When she says something matters, the audience believes her.

08 THE LUXURY ICON: Content — Designer fashion, exotic travel, exclusive parties, aspirational lifestyle. Audience Effect — Creates aspiration and envy simultaneously. Narrative Function — Represents what some characters want to become and others want to destroy.

09 THE EDUCATOR: Content — Tutorials, explainers, knowledge threads, skill breakdowns. Audience Effect — Builds authority and credibility — the audience learns from them. Narrative Function — The expert. Influence comes from competence, not charisma.

10 THE COMMENTATOR: Content — Reaction videos, social commentary, cultural analysis. Audience Effect — Shapes public opinion — gives the audience language for what they're feeling. Narrative Function — Names things. Once she names something, everyone uses her language.

11 THE CONNECTOR: Content — Collaborations, group events, social gatherings, network content. Audience Effect — Creates network clusters — audiences overlap and merge. Narrative Function — The bridge. Makes things happen between people who wouldn't otherwise meet.

12 THE ARCHIVIST: Content — Fashion archives, nostalgia posts, cultural memory content. Audience Effect — Defines legacy — decides what gets remembered. Narrative Function — The historian. Controls the narrative of what mattered.

13 THE REBEL: Content — Controversial opinions, experimental art, anti-trend content. Audience Effect — Creates counterculture movements — the alternative to the mainstream. Narrative Function — The one who says what everyone else is afraid to. Sometimes right. Sometimes destructive.

14 THE WELLNESS GUIDE: Content — Routines, therapy talk, mindfulness, rest content, boundary content. Audience Effect — Influences self-care culture — permission structure for slowing down. Narrative Function — The counter-narrative. Makes the platform feel less like a race for a moment.

15 THE VIRAL WILDCARD: Content — Random viral moments, chaotic posts, unpredictable formats. Audience Effect — Creates unexpected trends — the audience never knows what's coming. Narrative Function — The chaos agent. Breaks patterns. Impossible to predict or copy.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['archetypes', 'creator_behavior', 'personality', 'content_type', 'audience']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── THE SOCIAL RELATIONSHIP GRAPH ────────────────────────────────

      {
        title: 'The Social Relationship Graph — Five Types',
        content: `Creators are connected through five relationship types. These connections create stories, drama, and collaborations. Every relationship type has its own narrative metabolism — what it produces, what it costs, what happens when it breaks.

COLLABORATORS: What It Looks Like — Joint product launches, shared videos, recurring appearances together. What It Creates — Audience overlap, shared credibility, creative momentum. What Breaks It — Creative differences, audience feedback turning negative, one outgrowing the other. Story When It Breaks — Whose audience was it really? The collaboration becomes a retrospective.

RIVALS: What It Looks Like — Competing in the same space — fashion designers, beauty brands, lifestyle niches. What It Creates — Fan armies, comparison culture, the audience choosing sides. What Breaks It — One wins decisively, or both lose to a third party who arrived while they were focused on each other. Story When It Breaks — The rivalry that defined both of them disappears and they don't know who they are without it.

MENTORS: What It Looks Like — Experienced creators guiding newer ones — career advice, industry access, introductions. What It Creates — Legacy lines — the mentor's influence lives in the student's work. What Breaks It — Student surpasses the mentor publicly, or mentor feels ownership over student's success. Story When It Breaks — Was it mentorship or was it control? The student has to answer that publicly.

FRIENDS: What It Looks Like — Travel groups, party crews, mutual appearances, public social alignment. What It Creates — Social circles, shared audiences, the feeling of an inner world the audience glimpses. What Breaks It — Falling out over something the audience doesn't fully know, or one friend getting cancelled. Story When It Breaks — The friendship post that disappeared. Everyone noticed. Nobody asked directly.

ROMANTIC: What It Looks Like — Influencer couples — public or slow-burn reveals, shared content, relationship milestones. What It Creates — Massive audience attention — the audience is emotionally invested. What Breaks It — Breakup, cheating allegation, one partner's controversy contaminating the other. Story When It Breaks — The post where she stopped tagging him. Three days before the announcement.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['relationships', 'collaborators', 'rivals', 'mentors', 'friends', 'romantic', 'social_graph']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── THE CREATOR ECONOMY SYSTEM ───────────────────────────────────

      {
        title: 'The Creator Economy System — Six Income Streams',
        content: `Creators generate income through multiple streams. How a creator earns reveals who they are — what they're willing to do, what they protect, and what they're pretending not to need.

BRAND COLLABORATIONS: Partnerships with companies to promote products — fashion, beauty, lifestyle, tech. Who Uses It — Every tier uses it. Quality of brand signals tier level. Narrative Weight — The brand deal she took that didn't fit tells you what she needed that month.

CREATOR SHOPS: Personal storefronts — clothing, digital products, merchandise. Who Uses It — Tier 3–6. The entrepreneurial layer of the creator economy. Narrative Weight — What she sells reveals what she thinks her audience values about her.

MEMBERSHIP COMMUNITIES: Fans pay for exclusive access — behind-the-scenes, private discussions. Who Uses It — Tier 2–4. Requires deep audience trust. Narrative Weight — Who's in the paid community and what they're getting is always more interesting than the public content.

EVENT APPEARANCES: Festivals, award shows, industry panels, brand activations. Who Uses It — Tier 1–3. Invitation is the signal. Narrative Weight — Which events she attended, which she skipped, which she was not invited to.

DIGITAL PRODUCTS: Courses, presets, templates, educational content. Who Uses It — Tier 3–6. Knowledge monetized. Narrative Weight — The course she released when the content stopped working. The pivot.

PAY-FOR-ATTENTION: DM access, CashApp tipping, direct financial relationships with audience members. Who Uses It — Any tier — but rarely discussed publicly. Narrative Weight — The money is agreement. He is agreeing with something she already knew. This is JustAWoman's world specifically.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['economy', 'income', 'brand_deals', 'monetization', 'creator_shops']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── THE FASHION TREND ENGINE ─────────────────────────────────────

      {
        title: 'The Fashion Trend Engine — Five Stages',
        content: `Fashion spreads through a five-stage cycle in LalaVerse. Where a character sits in this cycle determines whether they're a leader, a follower, or someone who missed it entirely.

STAGE 1 — UNDERGROUND: Who — Tier 5–6 creators experimenting, street style icons. Feed Behavior — Invisible to most of the Feed — too niche to surface. Story Moment — The character who found it here and didn't tell anyone. That decision is the story.

STAGE 2 — RISING: Who — Micro-creators adopting and spreading the aesthetic. Feed Behavior — Starting to appear in interest clusters. Story Moment — The moment it could still be yours if you moved fast enough.

STAGE 3 — MAINSTREAM: Who — Tier 3–4 major influencers adopting. Feed Behavior — Algorithm starts pushing it — suddenly everywhere. Story Moment — The creators who were early watch it get credited to someone else.

STAGE 4 — SATURATION: Who — Everyone — trend has no owner left. Feed Behavior — Feed oversaturated — engagement dropping on trend content. Story Moment — The trend becomes invisible by being everywhere. The early adopter moves on.

STAGE 5 — REPLACEMENT: Who — New underground trend emerging as the old one dies. Feed Behavior — Saturation content drops; new aesthetic starts appearing at the edges. Story Moment — Back to Stage 1. But now the cycle is faster than it was before.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['fashion', 'trends', 'trend_cycle', 'underground', 'mainstream', 'saturation']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── THE BEAUTY TREND ENGINE ──────────────────────────────────────

      {
        title: 'The Beauty Trend Engine — Four Stages',
        content: `Beauty trends spread differently from fashion — they originate in professional spaces before they reach the Feed. The distance between invention and adoption is the story.

STAGE 1 — SALON DISCOVERY: Where — Professionals invent techniques — lash studios, skin clinics, nail artists. Story Moment — The technique exists but has no name yet. The artist who invented it is anonymous.

STAGE 2 — CREATOR DEMONSTRATION: Where — Beauty influencers show tutorials — often before the product exists commercially. Story Moment — The tutorial that went viral before the brand caught up. The creator who made the brand.

STAGE 3 — PRODUCT LAUNCH: Where — Brands formalize the technique into a product and release it. Story Moment — The brand that took the salon artist's technique and sold it back to her audience.

STAGE 4 — VIRAL ADOPTION: Where — Trend spreads across feeds — everyone doing their version. Story Moment — The technique now belongs to nobody. The Glow Gazette writes the history wrong.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['beauty', 'trends', 'salon', 'product_launch', 'viral_adoption']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── CULTURAL MOMENTUM WAVES ──────────────────────────────────────

      {
        title: 'Cultural Momentum Waves — Five Event Types',
        content: `Some moments cause massive global attention — they dominate the Feed and reshape what's possible for every character in range.

AWARD WINS: Feed Effect — Immediate career trajectory jump. Every brand reassesses. Duration — 1–2 weeks of peak attention. What It Changes Permanently — The winner's tier. They move up. The snubbed nominee's relationship to the institution.

VIRAL SCANDALS: Feed Effect — Feed dominance — pushes everything else out. Duration — 3–7 days peak, residual for months. What It Changes Permanently — The creator's public identity. Before-scandal and after-scandal are different people.

CELEBRITY COLLABORATIONS: Feed Effect — Audience crossover — both creators gain from the other's reach. Duration — 2 weeks of collab momentum. What It Changes Permanently — Proof of legitimacy for the lower-tier creator. Association as currency.

SURPRISE PARTNERSHIPS: Feed Effect — The reveal is the content — speculation, reaction, analysis. Duration — 1 week of reaction content. What It Changes Permanently — Market positioning. What this brand thinks of this creator, made public.

PLATFORM CHANGES: Feed Effect — Entire creator class responds — some gain, most scramble. Duration — Ongoing — creeping anxiety. What It Changes Permanently — Who built on the platform vs. who built the audience. The platform can change. The audience moves.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['momentum', 'viral', 'awards', 'scandals', 'collaborations', 'platform']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── SOCIAL INFLUENCE POWER ───────────────────────────────────────

      {
        title: 'Social Influence Power — Three Forces',
        content: `Influence grows through three forces. A creator who is strong in all three is nearly unstoppable. A creator who is strong in only one is always vulnerable.

REACH: Definition — Follower count — the size of the audience that can see the message. How It's Built — Consistent content, viral moments, algorithm favor, collabs. What Destroys It — Platform changes, account bans, audience aging out of the platform.

AUTHORITY: Definition — Trust and expertise — the audience believes what this creator says. How It's Built — Accuracy, consistency between public and private, track record of being right. What Destroys It — Being caught wrong publicly, scandal that breaks authenticity, paid content that betrays trust.

CULTURAL IMPACT: Definition — The ability to start trends — when this creator moves, the culture moves with them. How It's Built — Being early, being right, being bold at the right moment. What Destroys It — Becoming predictable, being copied so widely your origin point is forgotten, staying too long.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['influence', 'reach', 'authority', 'cultural_impact', 'power']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
        injection_count: 0,
        last_injected_at: null,
        created_at: now,
        updated_at: now,
      },

      // ─── CULTURAL LEGACY ──────────────────────────────────────────────

      {
        title: 'Cultural Legacy — Five Signals',
        content: `Some creators become permanent cultural icons. This status is rare and irreversible — it outlasts the platform, the trend cycle, and the creator's active posting period.

DEFINING A MAJOR TREND: What It Looks Like — The trend is permanently associated with their name even after saturation. Story Implication — They became the reference. Everyone who comes after is compared to them.

WINNING MULTIPLE AWARDS: What It Looks Like — Starlight Awards across multiple years or categories. Story Implication — Institution recognition. The culture agreed, in public, on the record.

INFLUENCING ENTIRE INDUSTRIES: What It Looks Like — Other creators structure their careers around what this person built. Story Implication — The mentor relationship at scale. Their influence is anonymous — everywhere and invisible.

SURVIVING A MAJOR CONTROVERSY: What It Looks Like — Coming back after being cancelled — stronger, more authentic, more trusted. Story Implication — The audience learned something about who they are in the crisis. So did the creator.

BECOMING A REFERENCE POINT: What It Looks Like — The culture cites them to explain other things — 'she's the new [legacy creator]'. Story Implication — Canonized. The archivist doesn't need to preserve them. The culture already did.`,
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['legacy', 'icons', 'cultural_canon', 'awards', 'controversy']),
        source_document: src,
        source_version: '1.0',
        extracted_by: 'document_ingestion',
        status: 'active',
        review_note: 'Ingested from Influencer Systems Doc 03 v1.0 — March 2026',
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
      source_document: 'influencer-systems-v1.0',
    });
  },
};
