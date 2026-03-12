'use strict';

/**
 * The Social Timeline Engine — Doc 05 · v1.0 · March 2026
 * franchise_law · always_inject
 *
 * 12 entries:
 *   1.  The Four Layers of the Timeline
 *   2.  The Viral Spread System
 *   3.  Engagement Energy
 *   4.  Drama Amplification
 *   5.  Cultural Event Overrides
 *   6.  Trend Waves Through Creator Tiers
 *   7.  Creator Momentum
 *   8.  Network Influence Clusters
 *   9.  Social Shock Events
 *   10. Cultural Memory
 *   11. Cross-Industry Influence
 *   12. How the Story Engine Uses This System
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('franchise_knowledge', [
      /* ─── 01 · Four Layers ─── */
      {
        title: 'The Four Layers of the Timeline',
        content: JSON.stringify({
          summary: "Every character's Feed is built from four blended layers. Understanding which layer content comes from tells you what it means narratively.",
          layers: [
            { layer: 1, name: 'Personal Circle',   feedWeight: '~30%', contains: 'People a character personally knows — friends, family, coworkers, collaborators', narrativeFunction: 'Creates emotional realism. Baby announcements. Relationship updates. Everyday life. The things that make the Feed feel like a world and not a performance.' },
            { layer: 2, name: 'Interest Clusters',  feedWeight: '~30%', contains: 'Communities the character engages with — fashion, beauty, fitness, entrepreneurship, gaming, nightlife', narrativeFunction: "Tells you who a character is by what they've trained the algorithm to show them. The clusters reveal identity before the character says a word." },
            { layer: 3, name: 'Cultural Moments',   feedWeight: '~20%', contains: 'Content tied to global events — Velvet Season, Glow Week, Starlight Awards, any calendar event', narrativeFunction: 'The world pressing in. During Glow Week, beauty posts dominate. A character who ignores it is making a choice.' },
            { layer: 4, name: 'Viral Waves',        feedWeight: '~20%', contains: 'Posts spreading rapidly across the network — dances, memes, scandals, celebrity moments', narrativeFunction: "The feed's unconscious. These posts appear whether you follow the creator or not. You cannot opt out of what the network has decided everyone sees." }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'feed_scenes', 'character_interactions']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 02 · Viral Spread ─── */
      {
        title: 'The Viral Spread System',
        content: JSON.stringify({
          summary: 'Content spreads through four stages. The distance between Stage 1 and Stage 4 is the story of how something becomes culture.',
          stages: [
            { stage: 1, name: 'Seed',             whoSeesIt: "Creator's followers only",               whatsHappening: 'Post is published to a small audience. Engagement is early and genuine.',                       storyMoment: "The post that should have gone viral but didn't. Or the one that nobody expected to escape its audience." },
            { stage: 2, name: 'Cluster Spread',    whoSeesIt: 'Related communities via algorithm push',  whatsHappening: 'Strong engagement signals cause the system to push content beyond its origin cluster.',          storyMoment: 'The moment a creator realizes their post is escaping. Either a gift or a problem.' },
            { stage: 3, name: 'Platform Spread',   whoSeesIt: 'The entire platform',                    whatsHappening: "Content escapes its niche. It's no longer about the original audience — it's about everyone.",   storyMoment: "The comments section changes. People who don't know the creator, don't care about the context, and have strong opinions anyway." },
            { stage: 4, name: 'Cultural Moment',   whoSeesIt: 'The network as a shared cultural entity', whatsHappening: 'The post becomes a reference point. Everyone has seen it.',                                     storyMoment: "Virality is not neutral. It's a new identity imposed faster than any identity can be defended." }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'viral_moments', 'feed_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 03 · Engagement Energy ─── */
      {
        title: 'Engagement Energy',
        content: JSON.stringify({
          summary: 'The algorithm measures energy signals — not all engagement is equal. The kind of engagement determines how far content travels.',
          signals: [
            { type: 'Comments',          strength: 'Strong', looksLike: 'Responses — argument, praise, questions, reactions',             tellsAlgorithm: 'People have a feeling strong enough to say something',                                storyImplication: 'A post with 200 comments and 50 likes is more dangerous than one with 5000 likes. Comments mean stakes.' },
            { type: 'Shares',            strength: 'Strong', looksLike: 'Forwarding to stories, direct messages, other platforms',        tellsAlgorithm: 'The content is worth staking personal reputation on by sharing',                       storyImplication: "When someone shares, they're saying: I want this associated with me. Or: I want everyone to see this problem." },
            { type: 'Saves',             strength: 'Strong', looksLike: 'Bookmarking for later — private signal',                         tellsAlgorithm: 'The content has lasting value beyond the scroll',                                      storyImplication: 'Saves are invisible to everyone but the algorithm. The most honest signal.' },
            { type: 'Replies in threads', strength: 'Strong', looksLike: 'Extended engagement — the conversation continues',              tellsAlgorithm: 'The post generated enough energy to sustain a conversation',                           storyImplication: "A thread that won't die is either a community or a crisis." },
            { type: 'Passive views',     strength: 'Weak',   looksLike: 'Video plays without any action',                                tellsAlgorithm: 'Awareness, not investment',                                                           storyImplication: 'High views, low engagement is its own story: everyone saw it and nobody cared enough to respond.' },
            { type: 'Quick likes',       strength: 'Weak',   looksLike: 'Tap and scroll',                                                tellsAlgorithm: 'Minimal positive signal — polite acknowledgment',                                     storyImplication: 'The like that means nothing. The creator knows the difference.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'feed_scenes', 'algorithm_behavior']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 04 · Drama Amplification ─── */
      {
        title: 'Drama Amplification',
        content: JSON.stringify({
          summary: 'Drama posts receive extra algorithmic amplification because engagement spikes are extreme. The system does not distinguish between good attention and bad attention — only volume.',
          triggers: [
            { trigger: 'Accusations (sent or received)', pattern: 'Immediate spike — sides form instantly',                     duration: '3–7 days, residual for weeks',                  cost: 'Association with the accusation, regardless of outcome. Being cleared is quieter than being accused.' },
            { trigger: 'Breakups going public',           pattern: 'Sustained high engagement — audience emotionally invested', duration: '1–2 weeks, cultural reference point for months', cost: 'Privacy. The relationship becomes content whether or not that was the intention.' },
            { trigger: 'Creator feuds',                   pattern: 'Escalating — each response adds a new spike',              duration: 'Ongoing for as long as both parties engage',    cost: 'Energy, time, and the distortion of being known primarily for the conflict.' },
            { trigger: 'Apology videos',                  pattern: 'Initial spike + second spike from response content',        duration: '1 week minimum',                                cost: 'The standard is set publicly. She will be measured against the apology for years.' },
            { trigger: 'Subtweet / vague post',           pattern: 'Speculation spike — the audience does the work',            duration: '2–4 days',                                      cost: 'Plausible deniability. The audience fills in the name. Sometimes incorrectly.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'drama_scenes', 'feed_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 05 · Cultural Event Overrides ─── */
      {
        title: 'Cultural Event Overrides',
        content: JSON.stringify({
          summary: 'Major events temporarily reshape the entire Feed. During these windows, event-aligned content gets boosted and off-topic content gets suppressed.',
          events: [
            { event: 'Velvet Season (Sept 1–20)',    override: 'Fashion posts increase 300%. Designer content dominates.',                                               buried: 'Beauty content, lifestyle content, entertainment — temporarily irrelevant.',              characterChoice: 'Posting fashion content = riding the wave. Posting nothing = conspicuous absence. Posting off-topic = deliberate counter-programming.' },
            { event: 'Glow Week (Apr 1–14)',         override: 'Beauty tutorials trend. Salons explode in visibility. Product launches time for this window.',            buried: 'Fashion posts lose reach. Non-beauty content drops in engagement.',                        characterChoice: "The creator who launches a beauty product off-cycle is taking a real risk. Or doesn't know." },
            { event: 'Starlight Awards (Nov 1–20)',  override: 'Commentary, coverage, prediction, reaction — the entire Feed becomes about the awards.',                  buried: 'Anything that isn\'t awards-adjacent loses reach for two weeks.',                          characterChoice: 'Every creator has a position on the Starlight Awards. The ones who claim not to care are lying.' },
            { event: 'Atelier Circuit (Aug 1–22)',   override: 'Runway content, designer reveals, fashion week aesthetic — the highest-status two weeks.',                buried: 'Everything outside fashion. This is the blackout window for beauty and entertainment.',    characterChoice: "The invitation is the content. Who got invited. Who didn't. Who was photographed. Who was seated where." },
            { event: 'Cloud Carnival (Dec 1–20)',    override: 'Celebration content, party footage, year-end reflection, launches.',                                      buried: 'Anything heavy. Controversy in December gets buried — or saved deliberately for January.', characterChoice: 'December 21 is the Grand Drop. Every major creator has a strategy for the last ten days.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'cultural_calendar', 'feed_scenes', 'algorithm_behavior']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 06 · Trend Waves ─── */
      {
        title: 'Trend Waves Through Creator Tiers',
        content: JSON.stringify({
          summary: 'Trends spread through creator tiers in a predictable pattern. Understanding where a trend is in its cycle tells you what it means for every character who touches it.',
          steps: [
            { step: 1, who: 'Tier 5–6 micro creators experimenting at the edges',                  signal: 'The trend exists but has no name. Just something a few people are doing.',                      storyOpportunity: 'The character who finds it here. The choice: share it or protect it.' },
            { step: 2, who: 'Tier 4–5 rising creators adopting and contextualizing',                signal: 'Getting traction in niche clusters. Still feels like a secret.',                                storyOpportunity: 'The early adopters who will later argue about who had it first.' },
            { step: 3, who: 'Tier 3–4 major influencers amplifying',                                signal: 'Algorithm starts pushing it. The trend escapes its origin cluster.',                            storyOpportunity: "The creator who waited for validation before moving. Safe, but she'll never be credited as early." },
            { step: 4, who: 'Tier 1–2 cultural icons endorsing or inadvertently amplifying',        signal: 'The trend is now culture. The original creators are often invisible.',                          storyOpportunity: 'The erasure. Who gets remembered vs. who did it first.' },
            { step: 5, who: 'Everyone — the trend has no owner left',                                signal: 'Engagement drops. Being on-trend now means being behind.',                                     storyOpportunity: 'The creator who held on too long. The one who moved on at exactly the right moment.' },
            { step: 6, who: 'New Tier 5–6 origin already forming',                                  signal: 'The cycle resets. Faster than last time.',                                                     storyOpportunity: 'The character who recognized Step 6 while everyone else was still in Step 5.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'trend_engine', 'feed_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 07 · Creator Momentum ─── */
      {
        title: 'Creator Momentum',
        content: JSON.stringify({
          summary: "Creators build and lose momentum scores over time. Momentum determines how easily their posts spread — it's the compound interest of the Feed.",
          actions: [
            { action: 'Consistent posting',                 effect: 'Steady momentum accumulation',                                     storyImplication: 'The creator who shows up every day while everyone else waits for inspiration.' },
            { action: 'Going viral',                        effect: 'Momentum spike — algorithm favor increases significantly',          storyImplication: 'The spike creates pressure. Maintain it or lose more than you gained.' },
            { action: 'Collaborating',                      effect: 'Momentum shared and amplified between both creators',               storyImplication: 'The collab that made one creator and cost the other. Or made both.' },
            { action: 'Participating in cultural events',   effect: 'Event-aligned momentum boost during the event window',              storyImplication: 'The creator at the Atelier Circuit vs. the one posting from home. Both choices are visible.' },
            { action: 'Disappearing (going silent)',        effect: 'Momentum decay — faster than most creators expect',                 storyImplication: "Two weeks off. She came back to a different Feed. The algorithm didn't wait." },
            { action: 'Controversy',                        effect: 'Momentum spike — but unpredictable direction',                      storyImplication: 'High momentum during the crisis. The question is who she is when it\'s over.' },
            { action: 'Posting off-cycle',                  effect: 'Reduced reach — algorithm deprioritizes non-event content',          storyImplication: 'The creative decision that cost her. Or the one that made her distinctive by contrast.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'character_profiles', 'feed_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 08 · Network Influence Clusters ─── */
      {
        title: 'Network Influence Clusters',
        content: JSON.stringify({
          summary: 'LalaVerse contains defined social clusters. Clusters influence each other — cross-cluster contamination is how culture spreads beyond its origin industry.',
          clusters: [
            { cluster: 'Fashion Cluster',         members: 'Designers, stylists, fashion influencers, fashion photographers, runway models',                    dynamics: 'Hierarchy obsession. Tier matters. Access to Velvet City events is the currency.',                              crossInfluence: 'Fashion trends contaminate beauty (new makeup to match the aesthetic), entertainment (fashion becomes costume), and fitness (athleisure moments).' },
            { cluster: 'Beauty Cluster',          members: 'Makeup artists, skincare creators, beauty founders, salon owners, lash and nail artists',           dynamics: 'Product loyalty is tribal. The Glow Gazette review is the arbiter.',                                            crossInfluence: 'Beauty trends contaminate fashion (skin-as-accessory moments), wellness (ingredient science as self-care), and entertainment (transformation as narrative).' },
            { cluster: 'Entertainment Cluster',   members: 'Musicians, comedians, actors turned creators, variety content, nightlife',                           dynamics: 'Virality is the metric. Being funny matters more than being polished.',                                         crossInfluence: 'Entertainment trends contaminate fashion (performer aesthetic), beauty (stage makeup going street), and every cluster via meme culture.' },
            { cluster: 'Creator Economy Cluster', members: 'Entrepreneurs, course creators, digital product sellers, business influencers',                     dynamics: 'Income transparency culture. Proof of earnings is content.',                                                    crossInfluence: 'Business trends contaminate every cluster — every creator is eventually asked about their income.' },
            { cluster: 'Wellness Cluster',        members: 'Mental health creators, fitness influencers, nutritionists, rest culture advocates',                dynamics: 'Authenticity pressure. Any gap between message and behavior is a scandal.',                                     crossInfluence: 'Wellness trends contaminate beauty (ingredient anxiety), entertainment (mental health disclosure as content), and the creator economy (burnout narrative).' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'character_profiles', 'cultural_dynamics']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 09 · Social Shock Events ─── */
      {
        title: 'Social Shock Events',
        content: JSON.stringify({
          summary: 'Sometimes massive events shake the entire network. These events dominate feeds for days and reset the context for everything that follows.',
          events: [
            { event: 'Celebrity breakup (major pair)',             dominance: '3–7 days peak, 2–4 weeks residual',  resets: "Every creator's relationship content is re-evaluated against this",                                        opportunity: 'The Gossip Empress. The Culture Commentator. Every creator who was silent about their own relationship now has audience questions.' },
            { event: 'Major scandal (Tier 1–2)',                   dominance: '5–10 days peak, months of residual', resets: 'The reputation of everyone adjacent — who knew, who stayed silent, who spoke first',                        opportunity: 'The creators who were quietly competing with the scandal creator. The field just opened.' },
            { event: 'Surprise collaboration (unexpected pairing)', dominance: '1–2 weeks of reaction content',     resets: "The assumed incompatibility between the two creators' audiences",                                          opportunity: 'Everyone in the niche between them. The collaboration creates a new category by accident.' },
            { event: 'Unexpected award win',                       dominance: '1 week of recalibration',            resets: 'The previous understanding of who was at the top of each category',                                        opportunity: "The snubbed creator. The audience redirection. The winner's trajectory for the next 12 months." },
            { event: 'Platform policy change',                     dominance: 'Ongoing — creeping, not shocking',   resets: "The viability of every creator's current content strategy",                                                opportunity: "Creators who diversified early. Creators on platforms the policy doesn't affect. Builders who own their audience." }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'drama_scenes', 'feed_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 10 · Cultural Memory ─── */
      {
        title: 'Cultural Memory',
        content: JSON.stringify({
          summary: 'Major events become part of LalaVerse history. Future creators reference them. The Feed has a memory, and that memory has power.',
          types: [
            { type: 'Drama',          lifespan: '1–3 days active',             entersCulturalMemory: 'The drama becomes a reference point for future drama of the same type',           storyImplication: "'Remember the Velvet Season meltdown?' — three years later, still the benchmark." },
            { type: 'Trends',         lifespan: '1–2 weeks active',            entersCulturalMemory: 'The trend gets a name — naming it preserves it',                                  storyImplication: 'Who named it becomes part of the myth. Usually not who started it.' },
            { type: 'Events',         lifespan: '1 month of Feed saturation',  entersCulturalMemory: "The event's key moments become iconic images or quotes",                          storyImplication: 'The photo from the Atelier Circuit that defines the decade.' },
            { type: 'Feuds',          lifespan: 'Variable — as long as both parties are active', entersCulturalMemory: "When the feud ends, it's immediately archived and analyzed",       storyImplication: 'The thing they fought about will be written about when both careers are over.' },
            { type: 'Iconic moments', lifespan: 'Permanent',                   entersCulturalMemory: 'When the culture starts using them as shorthand',                                 storyImplication: "'She pulled a [creator name]' — the moment that became a verb." }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'cultural_dynamics', 'character_backstory']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 11 · Cross-Industry Influence ─── */
      {
        title: 'Cross-Industry Influence',
        content: JSON.stringify({
          summary: "Industries influence each other in LalaVerse. The most powerful cultural moments happen when an aesthetic, idea, or trend crosses cluster boundaries and becomes everyone's vocabulary.",
          influences: [
            { origin: 'Fashion',              influences: 'Beauty, Fitness, Entertainment',               example: 'A runway aesthetic from the Atelier Circuit becomes the makeup trend of the season. The Glow Gazette covers it as beauty news, not fashion.' },
            { origin: 'Beauty',               influences: 'Fashion, Wellness, Fitness',                   example: 'A skincare ingredient goes from the Glow Institute to the wellness cluster. Fitness creators start talking about skin health. Everywhere in 30 days.' },
            { origin: 'Music / Entertainment', influences: 'Fashion, Dance, Meme culture',                example: 'A music video starts a fashion trend. The choreography becomes a dance challenge. The outfit becomes a Halloween costume. The lyric becomes a caption.' },
            { origin: 'Creator Economy',      influences: 'All clusters',                                 example: 'Income transparency content starts in entrepreneurship and spreads to every cluster. Every creator is eventually asked how much they make.' },
            { origin: 'Wellness',             influences: 'Beauty, Entertainment, Fashion',               example: 'A rest culture moment makes burnout content go viral. Fashion responds with comfort aesthetic. Beauty responds with no-makeup trend.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'trend_engine', 'cultural_dynamics']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 12 · How the Story Engine Uses This ─── */
      {
        title: 'How the Story Engine Uses the Social Timeline',
        content: JSON.stringify({
          summary: 'The Social Timeline Engine is not background — it is active narrative infrastructure. Before generating any Feed scene, the story engine asks these questions.',
          questions: [
            'What layer of the Feed is this content landing in — personal circle, interest cluster, cultural moment, or viral wave?',
            'What stage of viral spread is this post at — seed, cluster, platform, or cultural moment?',
            'What engagement signals is this generating — strong (comments, shares, saves) or weak (views, likes)?',
            'Is this happening during a cultural event override — and is the content aligned or deliberately counter-programmed?',
            'What cluster is this content in, and which clusters does it have the potential to contaminate?',
            "What is this creator's momentum score before this post — and how does this post change it?",
            'Does this moment have the weight to become cultural memory, or does it die in 48 hours?'
          ],
          coreRule: 'THE FEED IS ALWAYS WATCHING. No post in LalaVerse exists in isolation. Every piece of content is entering a living system that has rules, memory, and momentum. The characters who understand this build empires. The characters who don\'t get used by the system instead of using it.'
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'feed_scenes', 'algorithm_behavior', 'all_scenes']),
        source_document: 'social-timeline-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'social-timeline-v1.0'
    });
  }
};
