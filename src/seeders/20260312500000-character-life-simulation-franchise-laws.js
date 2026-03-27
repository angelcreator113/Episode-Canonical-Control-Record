'use strict';

/**
 * Character Life Simulation System — Doc 07 · v1.0 · March 2026
 * franchise_law · always_inject
 *
 * 11 entries:
 *   1.  External Career Life Stages
 *   2.  Career Paths
 *   3.  Family & Romantic Relationship System
 *   4.  Friendship Networks & Social Clusters
 *   5.  Life Milestones
 *   6.  Rivalry System
 *   7.  Mentorship Chains
 *   8.  City Migration
 *   9.  Public Persona vs. Private Life
 *   10. Generational Influence & Aging
 *   11. The Two-Clock Principle
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('franchise_knowledge', [
      /* ─── 01 · External Career Life Stages ─── */
      {
        title: 'External Career Life Stages',
        content: JSON.stringify({
          summary: 'Each character moves through external career stages at their own pace. The stage determines their cultural position, what they can access, who approaches them, and what the world expects from them. This runs parallel to — and independently from — the internal arc stages in the Character Registry.',
          stages: [
            { stage: 1, name: 'Discovery', career_position: 'Unknown — experimenting with identity, skills, and communities. No established audience.', typical_content: 'Trying trends, joining communities, experimenting with aesthetics — identity content', access: 'Micro communities, peer collaborators at the same level, early feedback loops', internal_arc_tension: 'Often in establishment internally — but external invisibility and internal pressure can coexist. Being new does not mean being uncomplicated.' },
            { stage: 2, name: 'Breakout', career_position: 'Gaining recognition — the audience is forming, the algorithm is starting to respond, the industry is noticing', typical_content: 'Viral posts, networking, career launches, milestone documentation', access: 'Mid-tier collaborators, first brand attention, event invitations that weren\'t always automatic', internal_arc_tension: 'Often in pressure internally — the breakout brings expectation and the expectation surfaces the wound.' },
            { stage: 3, name: 'Expansion', career_position: 'Building — brands, industry recognition, team, larger projects, a name that travels ahead of them', typical_content: 'Product launches, partnerships, behind-the-scenes of the build, aspiration content', access: 'Industry events, Tier 2–3 collaborators, the Velvet Academy / Glow Institute connections', internal_arc_tension: 'Can be in any internal stage — expansion is external success that does not resolve internal state. The wound does not care about the brand deal.' },
            { stage: 4, name: 'Legacy', career_position: 'Institution — mentorship, cultural influence, the career that shapes what\'s possible for other careers', typical_content: 'Guiding younger creators, establishing institutions, reflection content, the platform as cultural archive', access: 'Everything — and the awareness that access is no longer the thing she was looking for', internal_arc_tension: 'Often in integration internally — but not always. The Legacy stage creator who is still in crisis is the most compelling kind.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 02 · Career Paths ─── */
      {
        title: 'Career Paths by Industry',
        content: JSON.stringify({
          summary: 'Characters choose or evolve into industries. Career path shapes what cultural events are relevant, which cities they live in, which institutions trained them, and which legendary figures they look up to.',
          industries: [
            { industry: 'Fashion', career_tracks: 'Designer · Stylist · Fashion photographer · Runway model · Fashion journalist', home_city: 'Velvet City', peak_cultural_event: 'Atelier Circuit + Velvet Season', legendary_reference: 'The Style Queen, Velvet Muse, The Runway Architect' },
            { industry: 'Beauty', career_tracks: 'Makeup artist · Skincare specialist · Salon owner · Cosmetic chemist · Beauty influencer', home_city: 'Glow District', peak_cultural_event: 'Glow Week + Glow Honors', legendary_reference: 'The Glow Guru, Skin Scientist, The Makeup Oracle' },
            { industry: 'Creator', career_tracks: 'Lifestyle creator · Vlogger · Comedian · Storyteller · Commentator', home_city: 'Creator Harbor', peak_cultural_event: 'Creator Camp + Creator Cruise', legendary_reference: 'The Creator King, The Digital Mogul, The Community Architect' },
            { industry: 'Entertainment', career_tracks: 'Musician · Performer · Actor · DJ · Stage director', home_city: 'Pulse City', peak_cultural_event: 'Neon Nights + Soundwave Nights + Cloud Carnival', legendary_reference: 'The Music Architect, The Nightlife Queen, The Performance Icon' },
            { industry: 'Entrepreneur', career_tracks: 'Brand founder · Digital product creator · Creator agency owner · Tech founder', home_city: 'Horizon City', peak_cultural_event: 'Dream Market + Trend Summit', legendary_reference: 'The Brand Builder, The Collaboration Queen, The Digital Empress' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 03 · Family & Romantic Relationship System ─── */
      {
        title: 'Family & Romantic Relationship System',
        content: JSON.stringify({
          summary: 'Characters build complex social lives that shape their content, identity, and arcs. Relationship status is never neutral — it is always content, context, or both.',
          romantic_types: [
            { type: 'Casual Dating', looks_like: 'Low public commitment — implied or partially disclosed', provides: 'Freedom, independence, the relationship as private', costs: 'Nothing publicly. Which is its own kind of cost when the audience expects access.', story_when_ends: 'Nothing publicly. Until the next relationship makes the previous one a retrospective.' },
            { type: 'Power Couple', looks_like: 'Two influencer-level creators whose audiences overlap — joint content, shared milestones, brand as unit', provides: 'Reach amplification, shared legitimacy, a story the audience can follow', costs: 'Individual identity — who is she separately from the couple brand?', story_when_ends: 'A breakup that requires both audiences to choose. The split feels like a franchise ending.' },
            { type: 'Rival Lovers', looks_like: 'Romantic relationship with competitive tension built in — they\'re in the same space, wanting the same things', provides: 'Intensity, creative friction, the relationship as fuel', costs: 'Stability. They will never fully be on the same side.', story_when_ends: 'The rivalry outlasts the relationship. The competition continues after the love doesn\'t.' },
            { type: 'Long-Term Partners', looks_like: 'Stable, evolved, present as context not spectacle — the relationship that has seen multiple arc stages', provides: 'Depth, safety, the relationship as infrastructure rather than content', costs: 'Freshness — stable love doesn\'t generate as much engagement as unstable love', story_when_ends: 'Rarely. When it ends, it ends quietly. The audience didn\'t see it coming because they had stopped watching.' }
          ],
          family_roles: [
            { role: 'Parents', feed_impact: 'Parental approval or disapproval becomes context for the creator\'s choices — present or conspicuously absent', story_potential: 'The parent who doesn\'t know what their child does for a living. The parent who is proud of the wrong things.' },
            { role: 'Siblings', feed_impact: 'Collaboration potential, rivalry potential, the shared history that complicates the public persona', story_potential: 'The sibling who is also a creator. The sibling who refuses to be. Both are stories.' },
            { role: 'Partners', feed_impact: 'The relationship that shapes the character\'s content permission structure — what she will and won\'t show', story_potential: 'David. JustAWoman tells him everything about the men. He doesn\'t have the feeling.' },
            { role: 'Children', feed_impact: 'Parent creators shift content — the child changes what she will and won\'t say publicly', story_potential: 'What she protects from the Feed. What the Feed takes anyway. The line she draws and what it costs to hold it.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'relationship-engine']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 04 · Friendship Networks & Social Clusters ─── */
      {
        title: 'Friendship Networks & Social Clusters',
        content: JSON.stringify({
          summary: 'Friend groups form social clusters in LalaVerse. The cluster a character belongs to is part of their identity — and leaving one is always a story.',
          friend_groups: [
            { type: 'Fashion Circle', who: 'Stylists, designers, fashion creators, runway figures — city-adjacent, event-forward', creates: 'Access to industry events, aesthetic alignment, the feeling of being inside something', breaks: 'Someone from the circle goes mainstream and gets perceived as leaving. Or does leave.' },
            { type: 'Beauty Collective', who: 'Makeup artists, skincare creators, beauty founders — product-adjacent, tutorial-heavy', creates: 'Brand deal access, collaborative content, the validation of peer expertise', breaks: 'A product collab that goes wrong and the audience blames everyone adjacent.' },
            { type: 'Creator House', who: 'Multiple creators living or working in proximity — cross-industry, high-production', creates: 'Content, collaboration, an audience that follows the house as much as the individuals', breaks: 'One member\'s controversy contaminates the house. Everyone has to respond.' },
            { type: 'Music Crew', who: 'Musicians, producers, DJs, entertainment creators — nightlife-adjacent, sound-forward', creates: 'Access to Pulse City culture, the prestige of entertainment adjacency, a different kind of cool', breaks: 'Someone in the crew makes it to a different tier. The crew either rises with them or gets left.' },
            { type: 'Founding Circle', who: 'Entrepreneurial creators who built things together — shared origin story, mutual investment', creates: 'Trust, co-investment, the kind of loyalty that comes from surviving early stages together', breaks: 'Money. Or credit. Or the realization that one person\'s vision became everyone\'s work.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'relationship-engine']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 05 · Life Milestones ─── */
      {
        title: 'Life Milestones',
        content: JSON.stringify({
          summary: 'Certain moments create major story events in a character\'s life. Milestones generate content, shift reputation, and mark the before-and-after of who a character is on the Feed.',
          milestones: [
            { category: 'Career', milestone: 'First viral post', feed_event: 'The before and after — who she was when nobody was watching vs. who she becomes when everyone is', internal_signal: 'Often triggers the pressure stage internally. The audience arrived before she was ready.' },
            { category: 'Career', milestone: 'First product launch', feed_event: 'The creator becomes the entrepreneur — the content becomes commercial', internal_signal: 'Expansion stage. And a test: does the audience follow her into commerce?' },
            { category: 'Career', milestone: 'Winning a major award', feed_event: 'Status shift — the industry agreed publicly. The Starlight Awards on the record.', internal_signal: 'The external validation that does not resolve the internal question. The trophy doesn\'t answer the wound.' },
            { category: 'Career', milestone: 'First Atelier Circuit invitation', feed_event: 'Fashion legitimacy — the invitation is the content, the appearance is the credential', internal_signal: 'She made it into the room. Now she has to decide what she does with the room.' },
            { category: 'Relationship', milestone: 'First relationship reveal', feed_event: 'The audience meets the relationship — they immediately have opinions', internal_signal: 'Vulnerability. Or the performance of vulnerability. The Feed cannot tell the difference.' },
            { category: 'Relationship', milestone: 'Engagement / wedding', feed_event: 'Major content event — the audience is invested in the relationship milestone', internal_signal: 'The private decision becomes public property. The commitment is witnessed by everyone.' },
            { category: 'Relationship', milestone: 'Breakup', feed_event: 'The post that announces or implies it. The silence before the announcement.', internal_signal: 'Whatever the relationship was providing — safety, identity, content — is now gone.' },
            { category: 'Life', milestone: 'Moving cities', feed_event: 'The relocation post — new city, new energy, new chapter narrative', internal_signal: 'She left something. The new city is always partly about what she\'s leaving.' },
            { category: 'Life', milestone: 'Starting a business', feed_event: 'The launch announcement — the creator becomes the founder', internal_signal: 'Her identity expands beyond the Feed. Or tries to.' },
            { category: 'Life', milestone: 'Becoming a parent', feed_event: 'If she discloses: the Feed changes. If she doesn\'t: the speculation is its own event.', internal_signal: 'Everything about what she will and won\'t show publicly gets re-negotiated.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 06 · Rivalry System ─── */
      {
        title: 'Rivalry System',
        content: JSON.stringify({
          summary: 'Competition creates ongoing stories in LalaVerse. Rivalries intensify at specific cultural pressure points — award seasons, Atelier Circuit, trend cycles — when the stakes of being better are publicly legible.',
          rivalry_types: [
            { type: 'Designer vs. Designer', trigger: 'Shared aesthetic territory, same client tier, Atelier Circuit proximity', escalation: 'Collection comparisons, gossip media coverage, industry panels taking sides', peaks: 'Velvet Season — front row proximity, collection reveals in the same week', ends: 'One designer moves to a different aesthetic lane. Or both lose relevance to a third designer who arrived while they were competing.' },
            { type: 'Beauty Brand vs. Beauty Brand', trigger: 'Overlapping product claims, shared influencer relationships, Glow Week positioning', escalation: 'Tutorial comparisons, ingredient wars, creator loyalty battles', peaks: 'Glow Honors — which brand gets the most creator endorsements on the night', ends: 'Market differentiation — they find the territory that doesn\'t overlap. Or one collapses.' },
            { type: 'Creator vs. Creator', trigger: 'Same content lane, same tier, same audience demographic', escalation: 'Post timing wars, trend speed competition, audience forced to choose between them', peaks: 'Award nominations — Starlight Awards puts it on the record', ends: 'One creator moves to a different stage or a different lane. The rivalry only works when they\'re equal. Growth ends it.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'relationship-engine']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 07 · Mentorship Chains ─── */
      {
        title: 'Mentorship Chains',
        content: JSON.stringify({
          summary: 'Legacy creators mentor younger talent. The chain creates generational influence — the mentor\'s approach lives in the student\'s work long after the relationship ends.',
          chain_levels: [
            { level: 'Generation 1 — Legacy', role: 'The originator — built something first, defined the template', provides: 'Access, credibility, the shortcut that comes from being associated with history', takes: 'Association — the student is known as hers before they\'re known as themselves', story_when_breaks: 'When the legacy creator\'s reputation changes, everyone in the chain is affected retroactively.' },
            { level: 'Generation 2 — Established', role: 'The bridge — trained by legacy, now training the next tier', provides: 'Industry knowledge, peer relationships, the credibility of having survived the early stages', takes: 'Labor — the mentorship takes time the established creator could spend on their own work', story_when_breaks: 'When the mentee surpasses the mentor. The mentor has to decide whether that was the point.' },
            { level: 'Generation 3 — Rising', role: 'The student — absorbing, growing, building on a foundation they didn\'t build', provides: 'Talent, energy, the freshness that legacy and established have lost', takes: 'Credit — the origin story of their approach belongs partly to someone else', story_when_breaks: 'When they realize the foundation they built on has a crack. Everything they were taught came from a specific perspective.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'relationship-engine']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 08 · City Migration ─── */
      {
        title: 'City Migration Patterns',
        content: JSON.stringify({
          summary: 'Characters move between cultural capitals for reasons that are always partly professional and partly personal. Where a character lives is a character statement. Where they move to reveals what they\'re looking for. What they leave behind is the story.',
          migration_patterns: [
            { pattern: 'Creator Harbor → Velvet City', signals: 'Ambition in fashion — she wants legitimacy beyond the Feed', career_effect: 'Fashion industry access, Velvet Academy adjacency, the Atelier Circuit as goal', story_beneath: 'She left the collaborative, entrepreneurial world for the hierarchical, status-obsessed one. She thinks she\'s ready.' },
            { pattern: 'Glow District → Creator Harbor', signals: 'Beauty expertise becoming personal brand — the specialist becomes the influencer', career_effect: 'Audience-building, platform expansion, the credibility of expertise applied to content', story_beneath: 'She was the expert in the room. Now she has to be the character on the Feed. Different skill.' },
            { pattern: 'Pulse City → Horizon City', signals: 'Entertainment creator becoming founder — the performer becomes the builder', career_effect: 'Startup culture, product development, Dream Market positioning', story_beneath: 'She got tired of being the talent. She wanted to own the thing. That transition is harder than it looks.' },
            { pattern: 'Anywhere → Velvet City', signals: 'The aspiration move — Velvet City is the destination that means you made it in fashion', career_effect: 'Depends entirely on whether she has industry relationships or just the aspiration', story_beneath: 'The move she made before she was ready. The city didn\'t open for her the way she thought it would.' },
            { pattern: 'Velvet City → Anywhere', signals: 'The departure — from the place that was supposed to be the destination', career_effect: 'Career diversification, independence from a single industry power center', story_beneath: 'She made it and found out what it cost. The move away is the real story.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 09 · Public Persona vs. Private Life ─── */
      {
        title: 'Public Persona vs. Private Life',
        content: JSON.stringify({
          summary: 'Every character in LalaVerse maintains two identities. The gap between them is where the most important stories live. The Personality Engine\'s authenticity score is one measure of the gap. The Character Registry\'s psychological depth is another.',
          gap_types: [
            { gap: 'Narrow gap', public_persona: 'Mostly real — what you see is close to what\'s true', private_life: 'Consistent with the Feed — not much is hidden', story_in_gap: 'The creator who seems to hold nothing back. The audience assumes she has no secrets. She does. They\'re just different from what they\'d expect.' },
            { gap: 'Medium gap', public_persona: 'Curated truth — real things, but selected. The architecture of disclosure.', private_life: 'More complicated than the content suggests — the parts left out are the load-bearing parts', story_in_gap: 'The comment section that knows something is wrong before she says anything. They\'re reading the medium gap.' },
            { gap: 'Wide gap', public_persona: 'Constructed persona — the Feed is a performance, the person is elsewhere', private_life: 'Completely separate from the public identity — different values, different relationships, different life', story_in_gap: 'JustAWoman at the dinner table vs. JustAWoman online. She knows both. The audience only knows one.' },
            { gap: 'Gap in motion', public_persona: 'The persona is changing — what she\'s willing to show is expanding or contracting', private_life: 'The private life is pressing against the public one — something is forcing the gap to move', story_in_gap: 'The content shift. The caption that\'s different from last week\'s. The comment she didn\'t make. The audience tracks the gap even when they don\'t have language for it.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'social-personality']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── 10 · Generational Influence & Aging ─── */
      {
        title: 'Generational Influence & Aging',
        content: JSON.stringify({
          summary: 'Characters mature, shift priorities, and eventually transition from participant to institution. Children of famous creators often enter the industry, building legacy lines that carry the parent\'s approach into a new generation.',
          generational_moments: [
            { moment: 'Career pivot (mid-arc)', what_changes: 'Content lane, aesthetic, platform behavior', what_stays: 'The wound. The wound does not pivot.', story: 'The creator who changed everything about how she shows up. The audience can see what didn\'t change.' },
            { moment: 'Priority shift (becoming a parent)', what_changes: 'What she will and won\'t share publicly, the content permission structure', what_stays: 'The ambition. The wound. The audience.', story: 'She hid the pregnancy until she couldn\'t. She\'s been calculating what the Feed costs since before the baby was born.' },
            { moment: 'Entering the Legacy stage', what_changes: 'She stops being a participant and becomes a reference point', what_stays: 'The body of work. The relationships she built. The creators who learned from her.', story: 'The younger creator who does something she invented and doesn\'t know the origin. The Archivist notices.' },
            { moment: 'Child entering the industry', what_changes: 'A second generation carrying the family aesthetic, wound, and audience expectations', what_stays: 'The family name. The comparison the child can\'t escape.', story: 'The child who needs to fail publicly before the audience will let them succeed on their own terms.' },
            { moment: 'Founding a brand or institution', what_changes: 'She moves from creator to architect — building the structure others will inhabit', what_stays: 'The voice. The original vision.', story: 'Who built it and who benefits from it are not always the same person.' }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },

      /* ─── The Two-Clock Principle ─── */
      {
        title: 'The Two-Clock Principle',
        content: JSON.stringify({
          summary: 'External career arc and internal psychological arc run on independent clocks and can be in conflict. A character at Legacy stage externally who is in crisis internally is not a contradiction — it is the most human configuration. The story engine always reads both before generating any major character moment.',
          rule: 'The external career life stages (Discovery → Breakout → Expansion → Legacy) track what a character is doing in the world. The internal arc stages (establishment → pressure → crisis → integration) track what is happening inside them. These two systems never collapse into one. A character can be at any external stage while in any internal stage. The mismatch between outer position and inner state is often the most interesting story.',
          instruction: 'The story engine reads this document before generating career progression, relationship milestones, city moves, mentorship dynamics, rivalry escalation, or any moment where a character\'s external position and internal state come into contact.'
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story-engine', 'character-registry', 'world-studio', 'social-personality']),
        source_document: 'character-life-simulation-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'character-life-simulation-v1.0',
    });
  },
};
