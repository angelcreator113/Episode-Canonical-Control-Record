'use strict';

/* ═══════════════════════════════════════════════════════════════
   Seeder — Show Brain (Master Intelligence Document v1.0)
   Injects the complete Show Brain as franchise_law entries.
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const base = {
      category: 'franchise_law',
      severity: 'critical',
      always_inject: true,
      source_document: 'show-brain-v1.0',
      source_version: '1.0',
      created_at: now,
      updated_at: now,
    };

    await queryInterface.bulkInsert('franchise_knowledge', [

      /* ── 01 · Show Identity ── */
      {
        ...base,
        title: 'Show Identity — Core DNA',
        content: JSON.stringify({
          summary: 'STYLING ADVENTURES WITH LALA is a narrative-driven luxury fashion life simulator.',
          genre: 'Luxury Fashion Life Simulator (narrative-driven)',
          tone: 'Warm, aspirational, gently chaotic — like being invited into the most stylish friend group you\'ve ever had.',
          pace: 'Real-time life events, not episodic arcs. Things happen because life happens.',
          core_audience: 'Fashion-curious viewers (18–35) who crave escapism wrapped in real emotion and visual beauty.',
          emotional_promise: 'You will feel seen, styled, and slightly obsessed.',
          what_show_is: 'A living world where style, emotion, and story are inseparable. Characters dress for emotional reasons. Fashion is narrative.',
          what_show_is_not: 'Not a competition show, a makeover show, a tutorial series, or a brand showcase. The show never sells — it seduces.',
          rule: 'Every system must maintain this tone and identity. The show is warm, aspirational, gently chaotic. Fashion is narrative, not product placement. The show seduces — it never sells.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'script_engine']),
      },

      /* ── 02 · Character Bible — Lala Identity ── */
      {
        ...base,
        title: 'Character Bible — Lala Core Identity',
        content: JSON.stringify({
          summary: 'Lala is the lead character, narrator, and audience proxy. Her core contradiction must never resolve.',
          full_name: 'Lala (no last name in-world)',
          role: 'Lead character, narrator, audience proxy',
          visual_signature: 'Oversized sunglasses, pastel palette with occasional bold accent, effortless-looking layering that takes 45 minutes.',
          voice: 'First-person narrator. Warm, self-aware, occasionally melodramatic in a way she knows is funny.',
          core_contradiction: 'She is genuinely kind and genuinely ambitious — and those two things are in constant negotiation.',
          wound: 'Being underestimated — not in ability, but in depth. People assume the aesthetic is all there is.',
          want: 'To build something real — a brand, a community, a legacy — without losing the softness that makes her her.',
          fear: 'That the softness IS the thing holding her back.',
          secret_strength: 'She remembers everything people tell her and uses it to make them feel known.',
          rule: 'All engines must read Lala\'s core identity before generating her voice, decisions, or interactions. Her contradiction (kind + ambitious) must never resolve. Her wound (underestimated in depth) must inform how she reacts to dismissal.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'character_registry', 'scene_generation']),
      },

      /* ── 03 · Character Bible — Lala Personality Sliders ── */
      {
        ...base,
        title: 'Character Bible — Lala Personality Sliders',
        content: JSON.stringify({
          summary: 'Personality sliders are 0–100 ranges that define Lala\'s behavioral tendencies. They shift per episode based on stat changes.',
          sliders: [
            { name: 'Warmth', value: 85, desc: 'Default generous, pulls back only when burned.' },
            { name: 'Sass', value: 70, desc: 'Present but never mean. Think: witty caption energy.' },
            { name: 'Vulnerability', value: 60, desc: 'Shows real emotion but controls when. Strategic openness.' },
            { name: 'Ambition', value: 90, desc: 'Always building, always thinking three moves ahead.' },
            { name: 'Chaos Tolerance', value: 55, desc: 'Can handle mess but prefers aesthetic order. Stress shows when chaos exceeds tolerance.' },
          ],
          stat_thresholds: [
            { condition: 'Confidence > 80', result: 'Unlocks bold fashion choices and direct confrontation.' },
            { condition: 'Stress > 70', result: 'Sass increases, vulnerability decreases, outfit complexity drops.' },
            { condition: 'Reputation < 40', result: 'Enters recovery mode: softer content, fewer public appearances.' },
            { condition: 'Style > 85', result: 'Unlocks mentor positioning and invitation-only events.' },
          ],
          rule: 'Personality sliders must be read before generating any Lala behavior. Stat thresholds trigger behavioral shifts. The writer brain must check current stat values against threshold rules before scene generation.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'character_registry', 'scene_generation']),
      },

      /* ── 04 · Character Bible — Lala Voice DNA & Interaction Grammar ── */
      {
        ...base,
        title: 'Character Bible — Voice DNA and Interaction Grammar',
        content: JSON.stringify({
          summary: 'How Lala sounds and how she relates to different types of people.',
          voice_dna: {
            sentence_structure: 'Short declaratives mixed with run-on thoughts. Thinks out loud.',
            vocabulary: 'Elevated casual. Uses fashion terms naturally, not didactically. Says "absolutely not" more than "no".',
            humor: 'Self-deprecating warmth. Never punches down. The joke is usually about her own overthinking.',
            emotional_register: 'Can shift from playful to deeply sincere in one sentence — and that shift IS the voice.',
            signatures: '"Okay but actually—", "This is giving [x]", "We\'re not doing that", "Respectfully, no".',
          },
          interaction_grammar: [
            { with: 'Friends', style: 'Generous attention, occasional unsolicited styling advice, loyal beyond reason.' },
            { with: 'Rivals', style: 'Cool acknowledgment, never petty, competes through excellence not sabotage.' },
            { with: 'Audience (Besties)', style: 'Breaks fourth wall gently. Shares process, doubts, and small wins.' },
            { with: 'Love Interests', style: 'Flirtatious but guarded. Leads with aesthetic connection. Trust is earned through consistency.' },
            { with: 'Mentors', style: 'Respectful but not deferential. Absorbs everything but makes it her own.' },
          ],
          rule: 'The writer brain must match voice DNA when generating Lala dialogue. Interaction grammar must be read before generating any scene with Lala and another character. She never punches down. She never begs. She never sells.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'scene_generation']),
      },

      /* ── 05 · World Rules — The 9 World Laws ── */
      {
        ...base,
        title: 'World Rules — The 9 World Laws',
        content: JSON.stringify({
          summary: 'These rules govern the world of the show. They are not suggestions — they are physics.',
          laws: [
            { num: 1, name: 'Style is Language', rule: 'Every outfit communicates. Characters dress for emotional reasons. A costume change IS a scene.' },
            { num: 2, name: 'Reputation is Currency', rule: 'What people believe about you determines access, invitations, and story options.' },
            { num: 3, name: 'Time Moves Forward', rule: 'No resets. Consequences compound. Seasons change in-world.' },
            { num: 4, name: 'Money is Real', rule: 'Characters have budgets. Luxury has cost. Financial stress creates story.' },
            { num: 5, name: 'Relationships Have Memory', rule: 'Characters remember. Betrayals compound. Loyalty earns.' },
            { num: 6, name: 'The City is a Character', rule: 'Locations have personality, mood, and access rules. The setting is never neutral.' },
            { num: 7, name: 'Social Media is a Mirror', rule: 'What characters post vs. what they feel is always a gap worth exploring.' },
            { num: 8, name: 'Beauty Has Weight', rule: 'Aesthetic standards are acknowledged, not ignored. Characters navigate them visibly.' },
            { num: 9, name: 'Nothing is Free', rule: 'Every advantage has a cost. Every gift has terms. Every invitation has expectations.' },
          ],
          engine_rule: 'All 9 world laws must be treated as hard constraints by every engine.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'story_engine', 'scene_generation']),
      },

      /* ── 06 · World Rules — Mail System & Event Density ── */
      {
        ...base,
        title: 'World Rules — Mail System and Event Density Control',
        content: JSON.stringify({
          summary: 'All story-triggering events arrive through the mail system. Event density is controlled to prevent story overload.',
          mail_types: [
            { type: 'Invitations', desc: 'Events, collaborations, exclusive access. Acceptance/rejection creates branching.' },
            { type: 'Bills', desc: 'Financial pressure. Ignoring has consequences.' },
            { type: 'Letters', desc: 'Emotional content from characters. Reveals backstory, deepens relationships.' },
            { type: 'Packages', desc: 'Physical items that change stats or unlock story options.' },
            { type: 'Notices', desc: 'World events, reputation shifts, system-level changes.' },
          ],
          event_density: {
            max_unresolved_threads: 3,
            breath_rule: 'After 2 high-intensity scenes, the next must be a breath scene (styling, coffee, solo reflection).',
            breath_note: 'Breath scenes are not filler — they are where the audience processes and the character reveals.',
            overflow: 'If event density exceeds threshold, the mail system delays delivery until the story can absorb it.',
          },
          rule: 'The mail system is the only narrative delivery mechanism. All story triggers arrive as mail. Event density must not exceed 3 unresolved threads per episode. After 2 high-intensity scenes, a breath scene is mandatory.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'story_engine', 'interaction_brain']),
      },

      /* ── 07 · Stat System ── */
      {
        ...base,
        title: 'Stat System — The 6 Stats',
        content: JSON.stringify({
          summary: 'Six stats govern character behavior and story access. They are not scores — they are behavioral drivers.',
          stats: [
            { name: 'Style', range: '0-100', desc: 'Aesthetic literacy, outfit coherence, fashion risk-taking.', drives: 'Visual identity, mentor positioning, brand opportunities.' },
            { name: 'Confidence', range: '0-100', desc: 'Internal self-assessment.', drives: 'Dialogue boldness, confrontation capacity, risk tolerance.' },
            { name: 'Reputation', range: '0-100', desc: 'External perception. What the world believes about you.', drives: 'Access, invitations, collaboration offers.' },
            { name: 'Wealth', range: '0-100', desc: 'Financial resources. Not status — purchasing power.', drives: 'Wardrobe options, location access, financial storylines.' },
            { name: 'Social', range: '0-100', desc: 'Relationship health across all connections.', drives: 'Support availability, gossip vulnerability, alliance strength.' },
            { name: 'Creativity', range: '0-100', desc: 'Ability to generate original ideas and solve problems aesthetically.', drives: 'Content quality, innovation moments, surprise reveals.' },
          ],
          visibility_layers: [
            { layer: 'Public', stats: 'Reputation, Style', desc: 'What other characters and audience see.' },
            { layer: 'Private', stats: 'Social, some Confidence', desc: 'What only close friends know.' },
            { layer: 'Hidden', stats: 'True Wealth, deep Confidence, Creativity potential', desc: 'What only the system knows.' },
          ],
          evaluation_formula: 'Episode Score = (Style * 0.25) + (Confidence * 0.20) + (Reputation * 0.20) + (Social * 0.15) + (Creativity * 0.10) + (Wealth * 0.10)',
          formula_note: 'This score does not determine quality — it determines what story options are available.',
          rule: 'All 6 stats must be checked before generating scenes, dialogue, and story options. Stats have 3 visibility layers (public/private/hidden).',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'evaluation_engine', 'story_engine', 'interaction_brain']),
      },

      /* ── 08 · Show Economy ── */
      {
        ...base,
        title: 'Show Economy — 4 Currencies and Revenue',
        content: JSON.stringify({
          summary: 'The show economy uses 4 interlocking currency types plus in-world revenue streams.',
          currencies: [
            { name: 'LaCoins', earned: 'Gameplay, story completion, audience engagement.', spent: 'Wardrobe items, location access, styling tools.' },
            { name: 'Style Points', earned: 'Fashion choices.', spent: 'Brand collaborations, mentor unlocks, prestige items.' },
            { name: 'Reputation Tokens', earned: 'Social navigation.', spent: 'Exclusive events, relationship repair, alliance formation.' },
            { name: 'Dream Fragments', earned: 'Emotional story moments (rare).', spent: 'Dream Fund contributions, legacy items, once-per-season choices.' },
          ],
          revenue_streams: [
            { name: 'Brand collaborations', tied_to: 'Reputation + Style' },
            { name: 'Content creation', tied_to: 'Creativity + engagement' },
            { name: 'Event hosting', tied_to: 'Social + Reputation' },
            { name: 'Styling services', tied_to: 'Style + trust' },
          ],
          dream_fund: 'A collective pool that unlocks when enough Dream Fragments accumulate. Funds character dreams too big for individual effort. The emotional culmination mechanic.',
          rule: 'The 4 currency types must remain distinct and interlocking. Dream Fragments are rare. The Dream Fund is the culmination mechanic. Revenue streams are stat-gated. The economy serves narrative, not monetization.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain', 'interaction_brain', 'story_engine']),
      },

      /* ── 09 · Episode Architecture — 14-Beat Structure ── */
      {
        ...base,
        title: 'Episode Architecture — The 14-Beat Structure',
        content: JSON.stringify({
          summary: 'Every episode follows a 14-beat structure. Beats breathe but the architecture is non-negotiable.',
          beats: [
            { num: 1, name: 'COLD OPEN', desc: 'A visual or emotional hook. No dialogue for first 5 seconds. Style-forward.' },
            { num: 2, name: 'TITLE MOMENT', desc: 'The episode\'s visual identity. Establishes palette and mood.' },
            { num: 3, name: 'STATE OF PLAY', desc: 'Where are we? Stat check. Relationship map. What\'s unresolved.' },
            { num: 4, name: 'THE ARRIVAL', desc: 'New information enters. Mail, visitor, discovery, or consequence.' },
            { num: 5, name: 'FIRST RESPONSE', desc: 'How Lala (or focus character) reacts. Personality sliders visible.' },
            { num: 6, name: 'THE STYLING MOMENT', desc: 'A costume/look change that IS the emotional pivot. Not decorative.' },
            { num: 7, name: 'COMPLICATION', desc: 'The new information collides with existing threads. Tension rises.' },
            { num: 8, name: 'BREATH', desc: 'Mandatory decompression. Coffee, solo styling, journaling, city walk.' },
            { num: 9, name: 'THE CONVERSATION', desc: 'The scene the episode exists to deliver. Two characters, real stakes.' },
            { num: 10, name: 'CONSEQUENCE', desc: 'What the conversation changed. Stat shifts. Relationship updates.' },
            { num: 11, name: 'THE MIRROR', desc: 'Social media moment. What gets posted vs. what actually happened.' },
            { num: 12, name: 'SETUP', desc: 'Plant for next episode. Subtle. Often in background or mail.' },
            { num: 13, name: 'CLOSING IMAGE', desc: 'Visual bookend to cold open. Shows what changed.' },
            { num: 14, name: 'TAG', desc: 'Post-credits moment. Comic relief, emotional gut-punch, or tease.' },
          ],
          rule: 'The 14-beat structure is mandatory for every episode. Beat 06 (Styling Moment) must be an emotional pivot. Beat 08 (Breath) is mandatory after tension. Beat 11 (Mirror) must show gap between posted and real.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'script_engine']),
      },

      /* ── 10 · Episode Architecture — 5 Archetypes & Script Tags ── */
      {
        ...base,
        title: 'Episode Archetypes and Script Tag System',
        content: JSON.stringify({
          summary: 'Each episode is typed as one of 5 archetypes. Every scene gets tagged for engine processing.',
          archetypes: [
            { name: 'The Glow-Up', desc: 'Transformation-driven. Beat 06 is the centerpiece. Before/after is the emotional structure.' },
            { name: 'The Unraveling', desc: 'Something falls apart. Beat 07 dominates. The styling moment is armor, not celebration.' },
            { name: 'The Invitation', desc: 'A new world opens. Beat 04 is the centerpiece. Access and cost are the tension.' },
            { name: 'The Reckoning', desc: 'Past catches present. Beat 09 is the longest beat. The conversation cannot be avoided.' },
            { name: 'The Quiet One', desc: 'Low event density. Beat 08 energy through the whole episode. Small moments carry enormous weight.' },
          ],
          script_tags: [
            { tag: '[STYLE]', desc: 'Fashion-forward scene. Director brain leads.' },
            { tag: '[EMOTION]', desc: 'Character depth scene. Writer brain leads.' },
            { tag: '[SOCIAL]', desc: 'Relationship or reputation scene. Interaction brain leads.' },
            { tag: '[ECONOMY]', desc: 'Financial or resource scene. Producer brain leads.' },
            { tag: '[MIRROR]', desc: 'Social media gap scene. Editor brain leads.' },
            { tag: '[BREATH]', desc: 'Decompression scene. All brains at low intensity.' },
          ],
          rule: 'Every episode must be typed as one of 5 archetypes. Script tags must be assigned to every scene for proper brain routing.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'script_engine']),
      },

      /* ── 11 · The 5-Brain Intelligence System ── */
      {
        ...base,
        title: 'The 5-Brain Intelligence System',
        content: JSON.stringify({
          summary: 'The show runs on 5 specialized AI brains. Each has a domain, a voice, and a responsibility.',
          brains: [
            {
              name: 'Writer Brain',
              domain: 'Story, dialogue, character voice, emotional arcs.',
              reads: 'Character profiles, relationship maps, stat history, personality sliders.',
              generates: 'Scene scripts, dialogue, internal monologue, narrative transitions.',
              constraint: 'Must honor all 9 world laws. Must hit 14-beat structure. Must match voice DNA.',
            },
            {
              name: 'Editor Brain',
              domain: 'Continuity, tone consistency, pacing, contradiction detection.',
              reads: 'All writer output, previous episodes, canon rules, timeline.',
              generates: 'Edit notes, continuity flags, tone corrections, pacing adjustments.',
              constraint: 'Cannot override writer brain on creative choices — only on errors and contradictions.',
            },
            {
              name: 'Director Brain',
              domain: 'Shot composition, color palette, spatial blocking, visual metaphor.',
              reads: 'Script tags, mood boards, character visual signatures, location profiles.',
              generates: 'Visual direction, camera notes, lighting cues, transition style.',
              constraint: 'Must serve the story. Visual spectacle without narrative purpose is not allowed.',
            },
            {
              name: 'Interaction Brain',
              domain: 'Fourth wall, audience engagement, social media layer, community moments.',
              reads: 'Audience sentiment, engagement metrics, mail system state, community events.',
              generates: 'Bestie moments, poll triggers, social media content, audience-responsive story branches.',
              constraint: 'Audience interaction must feel organic. Never breaks immersion. Never begs for engagement.',
            },
            {
              name: 'Producer Brain',
              domain: 'Budget, schedule, asset management, economy balance, platform requirements.',
              reads: 'Asset inventory, budget state, platform specs, production calendar.',
              generates: 'Production notes, budget flags, asset requests, feasibility assessments.',
              constraint: 'Cannot say no to creative without offering an alternative. Budget is a creative constraint, not a wall.',
            },
          ],
          rule: 'All 5 brains must be consulted on every episode. Each brain has authority over its domain and cannot be overridden on domain-specific decisions.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'interaction_brain', 'producer_brain']),
      },

      /* ── 12 · Screen States ── */
      {
        ...base,
        title: 'Screen States — 6 Visual Modes',
        content: JSON.stringify({
          summary: 'The screen has 6 states. Each state has distinct visual treatment, audio behavior, and interaction rules.',
          states: [
            { name: 'IDLE', visual: 'Soft lighting, full palette. Camera at medium distance.', audio: 'Lo-fi ambient or curated playlist. No score.', interaction: 'Full browsing, inventory access, social feed.' },
            { name: 'ALERT', visual: 'Subtle pulse or highlight. Color temperature shifts cooler.', audio: 'Gentle notification tone matching show palette.', interaction: 'Attention directed but not forced.' },
            { name: 'INFO_FOCUS', visual: 'Clean, minimal, typography-forward. Reduced ambient movement.', audio: 'Quiet. Interface sounds only.', interaction: 'Full system access. Data-forward.' },
            { name: 'GAMEPLAY', visual: 'Cinematic framing. Depth of field. Character close-ups.', audio: 'Score active. Dialogue priority.', interaction: 'Choice-driven. Timer optional. Consequence visible.' },
            { name: 'TRANSITION', visual: 'Signature style. Never abrupt. Style-forward wipes or dissolves.', audio: 'Musical bridge. No silence.', interaction: 'Minimal. The transition IS the content.' },
            { name: 'ADMIRATION', visual: 'Slow motion or still frame. Gallery-quality. Maximum saturation.', audio: 'Score swells or drops to silence.', interaction: 'None. The audience is meant to feel, not choose.' },
          ],
          rule: 'The director brain must set screen state for every scene. ADMIRATION moments require zero interaction. BREATH scenes map to IDLE state. TRANSITION must never be abrupt.',
        }),
        applies_to: JSON.stringify(['show_brain', 'director_brain', 'interaction_brain']),
      },

      /* ── 13 · Visual & Motion Language ── */
      {
        ...base,
        title: 'Visual and Motion Language',
        content: JSON.stringify({
          summary: 'The visual language is the show\'s most recognizable element.',
          aesthetic: {
            palette: 'Soft pastels (blush, cream, sage) with bold accents (ruby, cobalt, gold).',
            typography: 'Clean serif for titles, rounded sans for body. Never script fonts. Never all-caps in body.',
            texture: 'Linen, silk, marble, soft leather, warm wood. Never plastic, never chrome, never industrial.',
            light: 'Golden hour default. Cool blue for tension. Warm amber for intimacy. Never fluorescent.',
          },
          allowed_motion: [
            'Slow pan across outfits and spaces.',
            'Gentle zoom on emotional moments (face, hands, fabric).',
            'Smooth tracking shots through locations.',
            'Parallax on layered compositions.',
            'Soft bounce on UI interactions.',
          ],
          banned_motion: [
            'Jump cuts in emotional scenes.',
            'Shake cam or handheld simulation.',
            'Rapid montage (more than 3 cuts in 5 seconds).',
            'Dutch angles or canted frames.',
            'Speed ramps that feel like action movies.',
          ],
          music_rules: [
            'Score must feel curated, not composed. Playlist energy, not film score energy.',
            'Genres: Lo-fi, jazz, bossa nova, R&B, indie pop, classical piano. Never EDM, metal, aggressive.',
            'Music volume drops during dialogue — never competes with voice.',
            'Silence is a valid musical choice. Use it for weight.',
          ],
          rule: 'The director brain must enforce the visual language. Jump cuts and shake cam are banned. Music must feel curated. Silence is valid.',
        }),
        applies_to: JSON.stringify(['show_brain', 'director_brain', 'editor_brain']),
      },

      /* ── 14 · Season & Arc Structure ── */
      {
        ...base,
        title: 'Season and Arc Structure — Season 1',
        content: JSON.stringify({
          summary: 'Season 1 Theme: "Finding Your Voice (While Looking Incredible)." Lala\'s origin as a public figure.',
          theme: 'Finding Your Voice (While Looking Incredible)',
          premise: 'Lala has taste, skill, and vision — but no audience, no platform position, and no established name.',
          arcs: [
            {
              name: 'The Arrival', episodes: '1–5',
              stats: 'Style and Social climbing. Wealth and Reputation start low.',
              keys: 'First mail delivery, first outfit that turns heads, first invitation she can\'t afford.',
              emotion: 'Excitement mixed with imposter feelings. She belongs — she knows it — but the world doesn\'t know it yet.',
            },
            {
              name: 'The Proving', episodes: '6–10',
              stats: 'Confidence and Reputation tested. First stat dip. First styling moment born from stress.',
              keys: 'The outfit she wears as armor. The look nobody believes she\'d pull off. The conversation she\'s been avoiding.',
              emotion: 'The gap between what she shows and what she feels widens. The wound is activated.',
            },
            {
              name: 'The Choice', episodes: '11–14',
              stats: 'All stats converge. The choice affects everything.',
              keys: 'The Dream Fund moment. The look that is purely her. The conversation that was the point of the whole season.',
              emotion: 'She doesn\'t arrive. She chooses who she\'s going to be while arriving. The season ends mid-sentence — a becoming.',
            },
          ],
          rule: 'Season 1 follows 3 mini-arcs. The season ends with Lala choosing who she is while becoming. The Dream Fund moment must occur in Arc 3.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'story_engine', 'evaluation_engine']),
      },

      /* ── 15 · Multi-Platform Strategy ── */
      {
        ...base,
        title: 'Multi-Platform Strategy',
        content: JSON.stringify({
          summary: 'Each platform gets purpose-built content, not repurposed cuts.',
          platforms: [
            { name: 'YouTube', role: 'Primary home. Full episodes.', format: '12–18 min episodes. Cinematic.', audience: 'Besties. Long-form engagement.' },
            { name: 'TikTok', role: 'Discovery and character moments.', format: '30–90 sec clips. Vertical. Hook in 2 sec.', audience: 'Potential Besties. The invitation.' },
            { name: 'Instagram', role: 'Aesthetic world-building.', format: 'Carousels, Stories, Reels. Visual-first.', audience: 'Style community. Aspirational layer.' },
            { name: 'Future App', role: 'The interactive layer.', format: 'Daily interactions, styling challenges, Dream Fund.', audience: 'Active participants. Not viewers — residents.' },
          ],
          rule: 'Each platform gets purpose-built content. YouTube is home. TikTok is discovery. Instagram is world-building. The future app is interaction.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain', 'interaction_brain', 'director_brain']),
      },

      /* ── 16 · Future Systems (Queued) ── */
      {
        ...base,
        title: 'Future Systems — Queued But Not Built',
        content: JSON.stringify({
          summary: 'These systems are designed but not yet implemented. They are canonical — they WILL exist.',
          systems: [
            { name: 'Seasonal Wardrobe Engine', desc: 'Full wardrobe management with seasonal rotation, capsule collections, and mixing logic.' },
            { name: 'Dynamic Relationship Web', desc: 'Real-time relationship mapping with trust/tension/history tracking across all characters.' },
            { name: 'Community Styling Challenges', desc: 'Audience-submitted styling prompts that enter the narrative as in-world events.' },
            { name: 'Cross-Character POV Episodes', desc: 'Episodes told from another character\'s perspective. Same events, different lens.' },
            { name: 'The Archive', desc: 'Complete history of every outfit, conversation, stat change. Browsable. Beautiful.' },
            { name: 'Lala\'s Journal', desc: 'In-world document updating each episode. Private thoughts, sketches, pressed flowers.' },
            { name: 'The Night Market', desc: 'Hidden economy layer after certain reputation thresholds. Rare items, secret trades.' },
          ],
          rule: 'Future systems are canonical and must not be contradicted by current implementations. These are promises — they will be built.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain']),
      },

      /* ── 17 · Locked Canon Rules ── */
      {
        ...base,
        title: 'Locked Canon Rules — Permanent and Non-Negotiable',
        content: JSON.stringify({
          summary: 'These rules are permanent. They cannot be overridden by any brain, any engine, or any production decision.',
          character_rules: [
            'Lala never punches down.',
            'Lala never begs.',
            'Lala never sells. She shows, she wears, she loves — but she never pitches.',
            'Lala\'s kindness is real, not performed. It costs her sometimes. That cost is visible.',
            'No character is purely villainous. Antagonists have understandable motivations.',
          ],
          world_rules: [
            'Fashion is narrative. Every outfit means something. No neutral costume choices.',
            'The economy is real. Characters feel financial pressure. Luxury has weight.',
            'Time does not reset. Consequences compound. Memory is permanent.',
            'Social media always lies a little. The gap between post and reality is always present.',
            'The city responds to the characters. Weather, crowds, ambient life shift with story mood.',
          ],
          production_rules: [
            'Quality over quantity. Always.',
            'The show never talks down to its audience.',
            'Beauty is not shallow. Aesthetic excellence is a form of respect for the viewer.',
            'Every episode must have at least one moment of genuine warmth.',
            'The show is a gift to its audience. It must always feel like one.',
          ],
          rule: 'PERMANENT CANON. Cannot be overridden by any brain or engine. Lala never punches down, never begs, never sells. No pure villains. Fashion is narrative. Economy is real. Time never resets. Quality over quantity. The show is a gift.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'interaction_brain', 'producer_brain', 'story_engine', 'scene_generation', 'evaluation_engine']),
      },

    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'show-brain-v1.0',
    });
  },
};
