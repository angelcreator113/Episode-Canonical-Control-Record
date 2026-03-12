'use strict';

/**
 * World Infrastructure — Doc 04 · v1.0 · March 2026
 * franchise_law · always_inject
 *
 * 5 entries:
 *   1. The City System — Global Cultural Capitals
 *   2. The University System
 *   3. Major Corporations & Brands
 *   4. The 50 Legendary Influencers
 *   5. How the Entire World Connects
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('franchise_knowledge', [
      /* ─── 01 · City System ─── */
      {
        title: 'The City System — Global Cultural Capitals',
        content: JSON.stringify({
          summary: 'Different cities become centers of influence for specific industries. Characters travel between them during the cultural calendar. Where a character lives or travels to is a character statement.',
          cities: [
            {
              name: 'Velvet City',
              capitalOf: 'Fashion',
              famousFor: 'Couture houses, runway shows, designer studios, high-end boutiques',
              majorEvents: ['Velvet Season', 'Atelier Circuit'],
              whoLivesHere: 'Designers, stylists, fashion photographers, luxury influencers',
              energy: 'Elegant, high-status, trend-setting. Every sidewalk is a runway.'
            },
            {
              name: 'Glow District',
              capitalOf: 'Beauty',
              famousFor: 'Skincare labs, salons, beauty schools, product launch spaces',
              majorEvents: ['Glow Week', 'Glow Honors Awards'],
              whoLivesHere: 'Makeup artists, skincare experts, beauty founders, lash and nail artists',
              energy: 'Experimental, aesthetic, transformation culture. Reinvention is the local religion.'
            },
            {
              name: 'Pulse City',
              capitalOf: 'Entertainment',
              famousFor: 'Music studios, comedy clubs, creator houses, nightlife venues',
              majorEvents: ['Neon Nights', 'Soundwave Nights'],
              whoLivesHere: 'Musicians, comedians, entertainers, party influencers',
              energy: 'Chaotic, loud, viral culture. Something happens here that becomes a meme by morning.'
            },
            {
              name: 'Creator Harbor',
              capitalOf: 'Influencer culture',
              famousFor: 'Creator studios, content houses, podcast networks, collab spaces',
              majorEvents: ['Creator Camp', 'Creator Cruise departures'],
              whoLivesHere: 'Influencers, vloggers, digital entrepreneurs, talent managers',
              energy: 'Collaborative, entrepreneurial. The city that runs on content and deals.'
            },
            {
              name: 'Horizon City',
              capitalOf: 'Tech and startups',
              famousFor: 'Digital platforms, creator economy tools, startup founders, incubators',
              majorEvents: ['Dream Market', 'Trend Summit'],
              whoLivesHere: 'Developers, entrepreneurs, product designers, platform architects',
              energy: 'Futuristic, ambitious. The city building the tools everyone else uses.'
            }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'scene_placement', 'character_profiles', 'cultural_calendar']),
        source_document: 'world-infrastructure-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 02 · University System ─── */
      {
        title: 'The University System',
        content: JSON.stringify({
          summary: 'These schools produce the next generation of creators and industry leaders. Where a character went to school — or didn\'t — is part of their identity in LalaVerse.',
          institutions: [
            {
              name: 'The Velvet Academy',
              city: 'Velvet City',
              specialization: 'World\'s top fashion school',
              programs: ['Fashion design', 'Styling', 'Fashion photography', 'Fashion journalism'],
              significance: 'Graduates often debut during the Atelier Circuit. A Velvet Academy degree is a Tier 1 credential.'
            },
            {
              name: 'The Glow Institute',
              city: 'Glow District',
              specialization: 'Most prestigious beauty academy',
              programs: ['Makeup artistry', 'Skincare science', 'Cosmetic formulation', 'Aesthetic treatments'],
              significance: 'Graduates dominate Glow Week. The Glow Institute and the beauty industry are inseparable.'
            },
            {
              name: 'The Creator Conservatory',
              city: 'Creator Harbor',
              specialization: 'Content creation and media',
              programs: ['Storytelling', 'Video production', 'Social media strategy', 'Branding'],
              significance: 'The school that legitimized being a creator. Graduates become influencers who cite it.'
            },
            {
              name: 'Horizon Tech Institute',
              city: 'Horizon City',
              specialization: 'Technology and innovation',
              programs: ['Digital product design', 'Social platform engineering', 'AI and media tools'],
              significance: 'Many founders of major LalaVerse platforms came from here. The architecture of the world.'
            }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'character_profiles', 'character_backstory']),
        source_document: 'world-infrastructure-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 03 · Major Corporations & Brands ─── */
      {
        title: 'Major Corporations & Brands',
        content: JSON.stringify({
          summary: 'These companies shape the economy of LalaVerse. They hold power, employ creators, and make the decisions that change the landscape.',
          corporations: [
            {
              name: 'Velvet House',
              industry: 'Luxury fashion',
              knownFor: 'Couture collections, high-status events, collaborations with top creators',
              power: 'Controls what high fashion means. Who they invite to shows is a power signal.',
              storyPotential: 'The creator Velvet House ignores. The designer they finally recognize. The collaboration that changes everything.'
            },
            {
              name: 'Glow Labs',
              industry: 'Beauty',
              knownFor: 'Skincare breakthroughs, viral beauty products, innovation-first positioning',
              power: 'Makes beauty credible. Their product recommendations become canon.',
              storyPotential: 'The formula that went wrong. The creator they dropped. The product that made a career.'
            },
            {
              name: 'Nova Studios',
              industry: 'Entertainment',
              knownFor: 'Creator shows, music projects, comedy series, content production',
              power: 'Produces the content that defines the entertainment tier of LalaVerse.',
              storyPotential: 'The deal that changed a creator\'s trajectory. The show they cancelled. The artist they made.'
            },
            {
              name: 'Dream Market Collective',
              industry: 'Creator economy',
              knownFor: 'Digital shops, creator launches, marketplace infrastructure',
              power: 'The platform creators use to sell. They take a cut of everything.',
              storyPotential: 'The fee increase nobody announced. The creator who built around them and then had to leave.'
            },
            {
              name: 'Pulse Media Network',
              industry: 'Talent and media',
              knownFor: 'Talent management, influencer partnerships, brand matchmaking',
              power: 'The middleman between creators and brands. Enormous invisible power.',
              storyPotential: 'The contract clause nobody read. The creator who left and went independent. The manager who knew too much.'
            }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'brand_deals', 'corporate_dynamics', 'character_profiles']),
        source_document: 'world-infrastructure-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 04 · The 50 Legendary Influencers ─── */
      {
        title: 'The 50 Legendary Influencers',
        content: JSON.stringify({
          summary: 'The most powerful cultural figures in LalaVerse. All placeholders — names and handles assigned when characters are generated through the Character Registry. These are the gravity wells the story orbits around.',
          categories: [
            {
              group: 'Fashion Icons',
              count: 5,
              roles: [
                { role: 'The Style Queen', function: 'Defines what is fashionable this season and what is over', signature: 'Her opinion reshapes the Feed overnight' },
                { role: 'Velvet Muse', function: 'The living embodiment of Velvet City\'s aesthetic', signature: 'Every Velvet Season moment is built around her presence or absence' },
                { role: 'The Runway Architect', function: 'Designs the shows that define the Atelier Circuit', signature: 'Their runway is the reference point for the year' },
                { role: 'Street Style Sovereign', function: 'Bridges street style and high fashion', signature: 'Discovered at Style Market, now front row at every show' },
                { role: 'The Fashion Archivist', function: 'Documents and preserves fashion history in LalaVerse', signature: 'The ultimate authority on what actually happened vs. what people remember' }
              ]
            },
            {
              group: 'Beauty Legends',
              count: 5,
              roles: [
                { role: 'The Glow Guru', function: 'Defines beauty standards — her recommendations sell out in hours', signature: 'The beauty world waits for her review before celebrating a launch' },
                { role: 'Skin Scientist', function: 'Makes skincare evidence-based and aspirational simultaneously', signature: 'Translates beauty lab science into the Feed\'s language' },
                { role: 'The Makeup Oracle', function: 'Predicts beauty trends before they surface publicly', signature: 'The look she posts in January becomes the look everyone does in March' },
                { role: 'Lash Empress', function: 'Rules the lash and eye beauty space absolutely', signature: 'Started in Glow District salons — the Velvet Academy equivalent in beauty' },
                { role: 'The Aesthetic Alchemist', function: 'Combines beauty, fashion, and art into a singular visual language', signature: 'Impossible to copy because the source is a specific interior life' }
              ]
            },
            {
              group: 'Creator Economy Leaders',
              count: 5,
              roles: [
                { role: 'The Creator King', function: 'Represents success culture — entrepreneurs model themselves on him', signature: 'Every Dream Market launch is compared to his first product drop' },
                { role: 'The Digital Mogul', function: 'Built an empire from content — the proof that it\'s possible', signature: 'The creator who became a corporation' },
                { role: 'The Brand Builder', function: 'Turns creator identity into lasting brand equity', signature: 'The difference between a creator and a business, made visible' },
                { role: 'The Collaboration Queen', function: 'Creates win-win partnerships nobody else saw coming', signature: 'Her collab announcements trend before the product exists' },
                { role: 'The Community Architect', function: 'Built the most loyal audience in LalaVerse', signature: 'Her community is a movement, not a following' }
              ]
            },
            {
              group: 'Entertainment Stars',
              count: 5,
              roles: [
                { role: 'The Viral Comedian', function: 'Makes the platform laugh — laughter is its own kind of power', signature: 'The meme that defined the year was hers' },
                { role: 'The Music Architect', function: 'Builds sonic worlds, not just songs', signature: 'Her sound lives in the background of half the Feed\'s content' },
                { role: 'The Nightlife Queen', function: 'Controls what happens after midnight in LalaVerse', signature: 'Her guest list is the event' },
                { role: 'The Performance Icon', function: 'Elevates creator content to performance art', signature: 'The only creator whose live videos feel like theater' },
                { role: 'The Stage Rebel', function: 'Breaks every entertainment convention and gets celebrated for it', signature: 'The performance everyone talks about that nobody can explain' }
              ]
            },
            {
              group: 'Lifestyle Influencers',
              count: 5,
              roles: [
                { role: 'The Travel Queen', function: 'Makes the world feel accessible and aspirational simultaneously', signature: 'Her location tags become destinations' },
                { role: 'The Fitness Titan', function: 'Physical transformation as identity — the body as a project', signature: 'The workout that trended. The physique that became a goal.' },
                { role: 'The Wellness Prophet', function: 'The counter-narrative to hustle culture — rest as resistance', signature: 'Permission structure for an entire generation' },
                { role: 'The Food Visionary', function: 'Food as culture, not just content — elevates the everyday', signature: 'The recipe that became a cultural moment' },
                { role: 'The Adventure Creator', function: 'Makes risk look beautiful — extreme experiences as lifestyle content', signature: 'The content nobody else would make because they were afraid' }
              ]
            },
            {
              group: 'Cultural Commentators',
              count: 5,
              roles: [
                { role: 'The Culture Analyst', function: 'Makes sense of what\'s happening in real time', signature: 'Her analysis drops within hours of any major event — always definitive' },
                { role: 'The Trend Oracle', function: 'Predicts cultural shifts before they happen — always right, always cryptic', signature: 'The post from six months ago that predicted exactly this' },
                { role: 'The Social Philosopher', function: 'Asks the questions the platform usually avoids', signature: 'The thread that stopped the Feed for a day' },
                { role: 'The Media Critic', function: 'Holds the media networks accountable — including Whisper Wire', signature: 'The only creator the gossip outlets are afraid of' },
                { role: 'The Gossip Empress', function: 'Knows everything — shares it strategically, never wrong', signature: 'She knew before the announcement. She always knows.' }
              ]
            },
            {
              group: 'Creative Visionaries',
              count: 5,
              roles: [
                { role: 'The Art Visionary', function: 'Makes the platform take beauty seriously as an intellectual pursuit', signature: 'The piece that made people forget they were on social media' },
                { role: 'The Photography Legend', function: 'Documents LalaVerse — everything important is in their archive', signature: 'The image from the Atelier Circuit that became the year\'s icon' },
                { role: 'The Design Genius', function: 'Solves problems beautifully — aesthetics and function together', signature: 'The product that felt inevitable after she made it' },
                { role: 'The Storytelling Master', function: 'Narrative above everything — makes content feel like literature', signature: 'The series that everyone finished in one sitting' },
                { role: 'The Visual Poet', function: 'Creates images and videos that operate like poetry — compressed meaning', signature: 'One post. Everyone had a different interpretation. All of them were right.' }
              ]
            },
            {
              group: 'Rising Icons',
              count: 5,
              roles: [
                { role: 'The Breakout Creator', function: 'The name everyone learned this year', signature: 'Unknown in January. Starlight Award nominee in November.' },
                { role: 'The New Wave Designer', function: 'Bringing the next aesthetic before the industry catches up', signature: 'Style Market discovery. Atelier Circuit in two years.' },
                { role: 'The Beauty Prodigy', function: 'Doing things in beauty that shouldn\'t be possible at her age', signature: 'Found during Glow Week. The Glow Gazette couldn\'t stop writing about her.' },
                { role: 'The Street Innovator', function: 'Rewriting what street style means right now', signature: 'The look everyone copied. She was already wearing something else.' },
                { role: 'The Viral Wildcard', function: 'Nobody predicted her. Nobody can predict what she\'ll do next.', signature: 'The post that broke the Feed. Twice.' }
              ]
            },
            {
              group: 'Cultural Legends',
              count: 5,
              roles: [
                { role: 'The Legacy Builder', function: 'Everything she built outlasted the platforms it was built on', signature: 'The creator other creators cite when asked who inspired them' },
                { role: 'The Creator Mentor', function: 'Grows other creators — legacy through multiplication', signature: 'The roster of creators she launched is longer than most brand portfolios' },
                { role: 'The Platform Pioneer', function: 'Was there before the platform was what it is now', signature: 'The posts that exist from before the algorithm knew what to do with her' },
                { role: 'The Trend Historian', function: 'Documents where trends actually came from', signature: 'The correction post. The one that credited the right person. Finally.' },
                { role: 'The Culture Keeper', function: 'Preserves what LalaVerse was before it became what it is', signature: 'The archive that breaks people\'s hearts when they find it' }
              ]
            },
            {
              group: 'Global Icons',
              count: 5,
              roles: [
                { role: 'The Digital Empress', function: 'Operates across every platform simultaneously — omnipresent', signature: 'The only creator who exists everywhere at once and loses nothing in translation' },
                { role: 'The Internet Prince', function: 'Male cultural icon who transcends every category', signature: 'His aesthetic is referenced by every tier — he didn\'t create it but he defined it' },
                { role: 'The Fashion Empress', function: 'The female equivalent of total fashion authority', signature: 'When she and the Style Queen agree, the trend is already over' },
                { role: 'The Glow Queen', function: 'Total beauty authority — Glow Guru and Beauty Oracle combined', signature: 'The face and the formula. Both.' },
                { role: 'The Creator Icon', function: 'The single figure who represents what a creator can become in LalaVerse', signature: 'The answer to the question: what does this platform make possible?' }
              ]
            }
          ]
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'character_profiles', 'character_registry', 'cultural_events']),
        source_document: 'world-infrastructure-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      },

      /* ─── 05 · How the Entire World Connects ─── */
      {
        title: 'How the Entire World Connects — The Loop',
        content: JSON.stringify({
          summary: 'The infrastructure of LalaVerse operates as a single interconnected system.',
          layers: [
            { layer: 'Creators', whatItDoes: 'Produce content, build audiences, represent cultural values', feedsInto: 'Cultural events — they attend, participate, get excluded' },
            { layer: 'Cultural events', whatItDoes: 'Organize the year, create shared experiences, generate pressure', feedsInto: 'Media networks — who covers what determines who wins' },
            { layer: 'Media networks', whatItDoes: 'Amplify moments, create narrative, control memory', feedsInto: 'Algorithms — what gets covered gets boosted' },
            { layer: 'Algorithms', whatItDoes: 'Determine what is seen, who grows, what dies', feedsInto: 'Communities — the audience the algorithm builds shapes belief' },
            { layer: 'Communities', whatItDoes: 'Create demand, validate identity, generate new trends', feedsInto: 'Back to Creators — communities make creators, not the other way around' }
          ],
          theLoop: 'Creators influence cultural events. Cultural events get covered by media networks. Media networks are amplified by algorithms. Algorithms build communities. Communities create the demand that makes creators. The loop completes and accelerates.'
        }),
        category: 'franchise_law',
        severity: 'critical',
        always_inject: true,
        applies_to: JSON.stringify(['story_generation', 'world_systems', 'cultural_dynamics']),
        source_document: 'world-infrastructure-v1.0',
        source_version: '1.0',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'world-infrastructure-v1.0'
    });
  }
};
