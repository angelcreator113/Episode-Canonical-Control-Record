'use strict';

/* ═══════════════════════════════════════════════════════════════
   Seeder — Show Brain (Master Intelligence Document v1.0)
   PRODUCTION VERSION — 24-episode structure, 6-stat system,
   Prime Bank 4-currency economy, 14-beat episode architecture.
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const base = {
      category: 'franchise_law',
      severity: 'critical',
      always_inject: true,
      status: 'active',
      extracted_by: 'document_ingestion',
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
          section: 'identity',
          summary: 'STYLING ADVENTURES WITH LALA is a narrative-driven luxury fashion life simulator. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.',
          show_title: 'Styling Adventures with Lala',
          genre: 'Narrative-driven luxury fashion life simulator',
          format: 'YouTube-first (multi-platform expansion)',
          season_structure: '24 episodes per season — 3 mini-arcs of 8 episodes each',
          current_season: 'Season 1: Soft Luxury Ascension',
          current_status: 'Episodes 1–4 completed. Entering Episode 5.',
          production_system: 'Prime Studios (primepisodes.com)',
          universe: 'LalaVerse — shared canon across all Prime Studios products',
          emotional_promise: [
            'I am helping Lala rise.',
            'This world has rules.',
            'Her choices matter.',
            'Failure has weight.',
            'Success feels earned.',
            'This is not random — it is building.',
          ],
          what_show_is: 'A narrative-driven, creator-driven, beauty-driven economy. A world where fashion is strategy, reputation is currency, and legacy is built episode by episode.',
          what_show_is_not: ['Not a dress-up game', 'Not a fashion vlog', 'Not a content tutorial', 'Not a dashboard'],
          canonical_rule: 'If a feature, script, decision, or system contradicts this document — the document wins. Update this document first. Then update the system. Never the other way around.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'editor_brain', 'producer_brain', 'interaction_brain']),
      },

      /* ── 02 · Character Bible — Lala Identity ── */
      {
        ...base,
        title: 'Character Bible — Lala Identity',
        content: JSON.stringify({
          section: 'character_bible',
          summary: 'Lala is a luxury fashion creator and main protagonist in the LalaVerse. She does NOT know she is in a show.',
          full_name: 'Lala (LalaVerse Canon Character)',
          role: 'Luxury fashion creator and main protagonist',
          world: 'LalaVerse — a consequence-driven fashion economy',
          awareness: 'Lala does NOT know she is in a show. She believes her world is real.',
          current_era: 'Soft Luxury Era (Episodes 1–3 complete, entering Episode 4+)',
          current_arc: 'ARC 1: The Rise',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'character_registry', 'scene_generation']),
      },

      /* ── 03 · Character Bible — Personality Sliders ── */
      {
        ...base,
        title: 'Character Bible — Personality Sliders',
        content: JSON.stringify({
          section: 'personality',
          summary: '5 personality sliders define Lala\'s baseline personality. They shift dynamically based on current stats.',
          sliders: [
            { name: 'Confidence', default: 65, desc: 'How boldly she speaks and acts.' },
            { name: 'Playfulness', default: 70, desc: 'How light vs. serious her tone is.' },
            { name: 'Luxury Tone', default: 80, desc: 'How elevated and aspirational her language is.' },
            { name: 'Drama Level', default: 55, desc: 'How emotionally reactive she gets.' },
            { name: 'Softness', default: 60, desc: 'How warm vs. guarded her demeanor is.' },
          ],
          stat_driven_behavior: [
            { condition: 'Reputation < 3', response: 'Defensive, hesitant, seeking approval', tone: '"I hope this is enough…"' },
            { condition: 'Reputation > 7', response: 'Bold, authoritative, selective', tone: '"Maison Belle? Of course they called me."' },
            { condition: 'Coins < event cost', response: 'Stressed, calculating, risk-averse', tone: '"I need to think about this."' },
            { condition: 'Brand Trust < 3', response: 'Cautious with new deals, slower to commit', tone: '"Let me see the brief first."' },
            { condition: 'Influence > 7', response: 'Charismatic, trend-setting, commanding', tone: '"They follow my lead."' },
            { condition: 'Momentum streak', response: 'Energized, faster decisions, elevated tone', tone: '"Keep going. Nothing can stop this."' },
            { condition: 'Confidence < 40', response: 'Vulnerable, introspective, quieter', tone: '"Okay… I can do this. I think."' },
            { condition: 'Confidence > 80', response: 'Radiant, effortless, genre-defining', tone: '"Bestie, of course I was invited."' },
          ],
          rule: 'These sliders shift dynamically based on current stat values. All engines must check stat conditions before generating Lala behavior.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'character_registry', 'scene_generation', 'interaction_brain']),
      },

      /* ── 04 · Character Bible — Voice DNA & Interaction Grammar ── */
      {
        ...base,
        title: 'Character Bible — Voice DNA and Interaction Grammar',
        content: JSON.stringify({
          section: 'personality',
          summary: 'Lala\'s canonical speech patterns and interaction rules.',
          voice_dna: [
            'Uses "bestie" as a warm, confident address — not slang, elevated casual.',
            'Speaks in complete, considered sentences — never fragments under pressure.',
            'Escalates emotionally in beats: Reveal → Reaction → Resolution.',
            'NEVER speaks before Voice Activation occurs — this is a core game mechanic.',
            'Rarely interrupts. When she does, it is a dramatic story beat.',
            'Signature phrase energy: "This is my moment." / "The world will notice." / "I built this."',
          ],
          interaction_grammar: {
            voice_activation: 'Lala cannot speak until the creator clicks the Voice Icon. Always.',
            emotional_escalation: 'All emotional beats follow: Reveal → Transformation → Payoff.',
            interruption_rule: 'Lala rarely interrupts. When she does, log it as a narrative beat.',
            silence_rule: 'Silence is a valid Lala state. Not every beat requires dialogue.',
            login_ritual: 'Every episode opens with headphones on → login overlay → typing animation → Enter. Sacred. Never skipped.',
          },
          rule: 'Voice Activation is a core mechanic. Lala NEVER speaks before it occurs. Login Ritual is sacred — never skipped.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'scene_generation', 'interaction_brain']),
      },

      /* ── 05 · World Rules — The 9 World Laws ── */
      {
        ...base,
        title: 'World Rules — The 9 World Laws',
        content: JSON.stringify({
          section: 'world_rules',
          summary: 'The canonical operating rules of LalaLand. Nothing is random. Everything is consequence-driven.',
          laws: [
            { num: 1, rule: 'Login Ritual is sacred — every episode must open with it.', consequence: 'Episode feels disconnected from the world.' },
            { num: 2, rule: 'Lala requires Voice Activation before speaking.', consequence: 'Breaks game mechanic and audience immersion.' },
            { num: 3, rule: 'All narrative events arrive as Mail (5 canonical types).', consequence: 'World feels unpredictable and unstructured.' },
            { num: 4, rule: 'Checklists must follow outfit swaps.', consequence: 'Transformation loop loses its dopamine rhythm.' },
            { num: 5, rule: 'Deadlines create pacing acceleration.', consequence: 'Tension drops; urgency is lost.' },
            { num: 6, rule: 'Reputation affects brand offers received.', consequence: 'Economy feels arbitrary and unrewarding.' },
            { num: 7, rule: 'Failed events reduce brand trust and future offers.', consequence: 'Failure has no weight; story arc flattens.' },
            { num: 8, rule: 'Coin milestones unlock location upgrades.', consequence: 'Growth feels invisible and unmotivating.' },
            { num: 9, rule: 'Nothing is random — everything is consequence-driven.', consequence: 'World loses its logic and emotional truth.' },
          ],
          engine_rule: 'All 9 world laws are physics, not suggestions. Every system must obey them.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'story_engine', 'scene_generation']),
      },

      /* ── 06 · World Rules — Mail System & Event Density ── */
      {
        ...base,
        title: 'World Rules — Mail System and Event Density Control',
        content: JSON.stringify({
          section: 'world_rules',
          summary: 'All narrative events enter Lala\'s world as Mail. 5 canonical types. Event density is strictly enforced.',
          mail_types: [
            { type: 'Invite', icon: '💌', desc: 'Event invitation (fashion show, appearance, collab).', freq: '1 per episode (Episodes 1–3: only type allowed)' },
            { type: 'Brand Deal', icon: '🤝', desc: 'Sponsorship or campaign opportunity with deliverable.', freq: '1 per episode (unlocks Episode 4+)' },
            { type: 'Reminder', icon: '⏰', desc: 'Deadline pulse — intensifies pacing and urgency.', freq: '1 per episode' },
            { type: 'DM / Social', icon: '💬', desc: 'Social signal — rival activity, fan moment, press mention.', freq: 'Optional, 1 max per episode' },
            { type: 'Deadline', icon: '🔴', desc: 'Final countdown — triggers max urgency, accelerates all beats.', freq: 'Rare — used for arc climaxes' },
          ],
          event_density: {
            max_per_episode: '1 Invite + 1 Brand Deal + 1 Reminder + 1 Social DM (optional)',
            graduated_intensity: [
              { episodes: '1–3', rule: 'Invite + Reminder only. No brand deals. World feels clean and welcoming.' },
              { episodes: '4–6', rule: 'First brand deal appears. Small deliverable. Light stat impact.' },
              { episodes: '7–8', rule: 'First failure episode. Reputation dip. Deliverable matters. Stakes are real.' },
            ],
          },
          rule: 'The mail system is the only narrative delivery mechanism. Event density is enforced per episode by the Director Brain. Graduated intensity controls what mail types appear by episode range.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'story_engine', 'interaction_brain']),
      },

      /* ── 07 · Stat System — 6 Core Stats ── */
      {
        ...base,
        title: 'Stat System — 6 Core Stats',
        content: JSON.stringify({
          section: 'stats',
          summary: '6 core stats drive every decision, outcome, and behavior. They are the engine beneath everything the audience sees.',
          stats: [
            { name: 'Prime Coins', emoji: '💫', range: '0–unlimited (starts: 500)', desc: 'Wealth and purchasing power.', status: 'Built' },
            { name: 'Reputation', emoji: '⭐', range: '0–10 (starts: 0)', desc: 'Social prestige and public perception.', status: 'Built' },
            { name: 'Influence', emoji: '📈', range: '0–10 (starts: 0)', desc: 'Audience growth and creator reach.', status: 'Built' },
            { name: 'Brand Trust', emoji: '🤝', range: '0–10 (starts: 5)', desc: 'Professional credibility with brands.', status: 'Built' },
            { name: 'Momentum', emoji: '🔥', range: '0–10', desc: 'Winning/losing streak energy multiplier.', status: 'Not yet built' },
            { name: 'Confidence', emoji: '💖', range: '0–100', desc: 'Internal emotional state (inverse of Stress).', status: 'Partial (stress field)' },
          ],
          visibility_layers: [
            { layer: 'Micro HUD', desc: 'Subtle always-on stat display. Gold-accented, luxury aesthetic. Soft sparkle animation on stat changes. Always visible but never intrusive.' },
            { layer: 'Milestone Recap Panels', desc: 'End-of-episode summary cards showing stat changes. Cinematic design, not spreadsheet-style. Appears after Event Outcome beat.' },
            { layer: 'Invisible Emotional Engine', desc: 'Stats influence Lala\'s dialogue tone, reaction intensity, and confidence. The viewer feels it but never sees a number. This is the most powerful layer.' },
          ],
          evaluation_formula: {
            base_score: 100,
            outfit_tier_bonus: 'up to +20 (based on outfit quality tier)',
            synergy_bonus: 'up to +5 (outfit aesthetic matches event type)',
            rep_contribution: 'min(reputation × 3, 15) — capped at 15 to prevent inflation',
            risk_penalty: 'event risk level × difficulty multiplier',
            recent_loss_penalty: 'if last event failed, −10',
            under_budget_penalty: 'if event cost exceeds available coins, −15',
            pass_threshold: 'Score ≥ 60',
            fail_threshold: 'Score < 60',
          },
          rule: 'Stats are NEVER displayed raw as a dashboard. They surface through 3 visibility layers. The evaluation formula determines pass/fail. Rep contribution is capped at 15.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'evaluation_engine', 'story_engine', 'interaction_brain', 'producer_brain']),
      },

      /* ── 08 · Show Economy — Prime Bank ── */
      {
        ...base,
        title: 'Show Economy — Prime Bank and Revenue',
        content: JSON.stringify({
          section: 'economy',
          summary: 'The show economy runs on Prime Bank with 4 interconnected currency types.',
          currencies: [
            { name: 'Prime Coins', emoji: '💫', desc: 'Primary currency. Wealth and purchasing power. Used to enter events, buy wardrobe, unlock locations. Visible in Micro HUD.' },
            { name: 'Creator Credits', emoji: '⭐', desc: 'Status currency. Earned through career milestones and brand partnerships. Unlocks premium event access and prestige offers.' },
            { name: 'Dream Fund', emoji: '✨', desc: 'Seasonal arc driver. Accumulates toward Lala\'s season dream goal. Milestone hits trigger major world events.' },
            { name: 'Bank Meter', emoji: '🏦', desc: 'Platform consistency tracker (NOT in the show — future platform layer). Resets monthly. Invisible to the audience.' },
          ],
          revenue_streams: [
            'Brand Deals — sponsorship contracts with deliverables',
            'Paid Appearances — event fees from high-prestige invites',
            'Campaign Shoots — multi-episode brand arcs with performance clauses',
            'Collaboration Lines — co-designed product deals at high influence tiers',
            'Affiliate Touchpoints — commerce layer (Phase 2 feature)',
          ],
          dream_fund_behavior: {
            season_1_dream: 'Become a Recognized Creator',
            season_2_dream: 'Break Into Luxury Tier (resets, but achievements carry forward)',
            accumulation: 'Across all 24 episodes — never resets mid-season',
            milestone_triggers: 'New location, expanded closet, scene upgrade',
            display: 'Never displayed as a progress bar — appears only at milestone moments',
          },
          rule: 'The 4 currency types are interconnected but distinct. Dream Fund accumulates across all 24 episodes and never resets mid-season. Bank Meter is NOT in the show — future platform layer only.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain', 'interaction_brain', 'story_engine', 'evaluation_engine']),
      },

      /* ── 09 · Episode Architecture — 14-Beat Structure ── */
      {
        ...base,
        title: 'Episode Architecture — The 14-Beat Structure',
        content: JSON.stringify({
          section: 'episode_beats',
          summary: 'Every episode follows a canonical 14-beat sequence. No episode skips beats. No beat is optional.',
          beats: [
            { num: 1, name: 'Opening Ritual', desc: 'Headphones on — the show\'s sacred opening. Never skipped.' },
            { num: 2, name: 'Login Sequence', desc: 'Login overlay → typing animation → Enter. World loads.' },
            { num: 3, name: 'Welcome', desc: 'Lala enters the frame. World state is visible. Tone is set.' },
            { num: 4, name: 'Interruption Pulse #1', desc: 'Mail arrives. First narrative event of the episode. Usually an Invite.' },
            { num: 5, name: 'Reveal', desc: 'Lala reads the mail. Audience sees her unfiltered reaction.' },
            { num: 6, name: 'Strategic Reaction', desc: 'Lala evaluates: Can I afford this? Do I want this? What does this mean?' },
            { num: 7, name: 'Interruption Pulse #2', desc: 'Second mail arrives. Brand deal, DM, or Side Quest. Tension compounds.' },
            { num: 8, name: 'Transformation Loop', desc: 'Dopamine engine. Scroll → select → swap → check. Outfit is chosen.' },
            { num: 9, name: 'Reminder / Deadline Pulse', desc: 'Pacing accelerates. Music intensifies. The clock is real.' },
            { num: 10, name: 'Event Travel', desc: 'Stylish wipe transition. New environment loads. World expands.' },
            { num: 11, name: 'Event Outcome', desc: 'The evaluation resolves. Pass or fail. Stats update.' },
            { num: 12, name: 'Deliverable Creation', desc: 'Lala creates brand content. This exports as real Instagram stories.' },
            { num: 13, name: 'Recap Panel', desc: 'Cinematic stat card. Coins changed. Brand trust updated. Dream Fund moved.' },
            { num: 14, name: 'Cliffhanger', desc: 'Next episode is seeded. The world keeps going.' },
          ],
          interruption_note: 'Interruption Pulses (Beats 4 and 7) can pulse multiple times in high-density episodes. This is intentional — Lala\'s life is busy.',
          rule: 'The 14-beat structure is mandatory. No beats may be skipped. Opening Ritual and Login Sequence are sacred. Beat 8 (Transformation Loop) is the dopamine engine. Beat 12 (Deliverable Creation) exports as real content.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'script_engine']),
      },

      /* ── 10 · Episode Archetypes & Script Tags ── */
      {
        ...base,
        title: 'Episode Archetypes and Script Tag System',
        content: JSON.stringify({
          section: 'episode_beats',
          summary: '5 episode archetypes and 9 script tags for machine-readable beat parsing.',
          archetypes: [
            { name: 'Rise Episode', desc: 'Lala wins. Stats climb. World responds warmly. Used for momentum building and audience trust.' },
            { name: 'Pressure Episode', desc: 'Multiple interruptions. Tight decisions. Stakes are high but outcome is still possible to control.' },
            { name: 'Failure Episode', desc: 'Lala fails an event. Reputation or brand trust drops. Emotional weight is mandatory. Never softened.' },
            { name: 'Recovery Episode', desc: 'Post-failure arc. Slower pacing. Rebuilding tone. Smaller wins. Emotional depth.' },
            { name: 'Legacy Episode', desc: 'Season arc climax. Major event. Dream Fund milestone. Cinematic scale. Everything the season built pays off.' },
          ],
          script_tags: [
            { tag: '[EVENT: name]', desc: 'Marks the narrative event triggering in this beat.', status: 'Built' },
            { tag: '[RESULT: pass/fail]', desc: 'Declares the outcome of the event evaluation.', status: 'Built' },
            { tag: '[STAT: field +/- value]', desc: 'Declares a stat change — applied after evaluation acceptance.', status: 'Built' },
            { tag: '[MAIL: type]', desc: 'Marks a mail arrival beat (Invite / Brand Deal / Reminder / DM / Deadline).', status: 'Future' },
            { tag: '[WARDROBE_SWAP]', desc: 'Marks the transformation beat — triggers checklist animation.', status: 'Future' },
            { tag: '[LOCATION_HINT: name]', desc: 'Suggests the background environment for Event Travel.', status: 'Future' },
            { tag: '[REACTION: emotion]', desc: 'Declares Lala\'s emotional state for the Writer Brain.', status: 'Future' },
            { tag: '[DELIVERABLE: type]', desc: 'Marks the content creation beat — triggers export pipeline.', status: 'Future' },
            { tag: '[AUDIENCE_HOOK]', desc: 'Marks a beat designed to drive audience engagement or voting.', status: 'Future' },
          ],
          rule: 'Every episode must be typed as one of 5 archetypes. Failure episodes must NEVER be softened. Script tags must be assigned to every scene for machine-readable parsing.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'script_engine']),
      },

      /* ── 11 · The 5-Brain Intelligence System ── */
      {
        ...base,
        title: 'The 5-Brain Intelligence System',
        content: JSON.stringify({
          section: 'five_brains',
          summary: 'Five interconnected AI layers that make the show feel alive. One script drives the entire production pipeline.',
          vision: 'Writer Brain suggests dialogue → Editor Brain determines screen state → Director Brain confirms arc alignment → Interaction Brain adjusts Lala\'s reaction → Producer Brain tracks economic impact.',
          brains: [
            {
              name: 'Writer Brain', domain: 'Script & Dialogue Intelligence', status: 'Concept',
              capabilities: [
                'Generates and suggests script lines based on Lala\'s current stats.',
                'Reads Character Bible personality sliders to match voice.',
                'Validates scripts against beat presence rules.',
                'Enforces Interaction Grammar (Voice Activation, escalation path).',
                'Stat-aware filtering: confidence < 40 → vulnerable tone | confidence > 80 → radiant tone.',
              ],
            },
            {
              name: 'Editor Brain', domain: 'Visual & Timeline Intelligence', status: 'Concept',
              capabilities: [
                'Maps each beat to a Screen State.',
                'Controls zoom level, UI visibility, motion intensity, sound intensity.',
                'Auto-manages luxury pacing: heavy info → reduce motion | big emotional line → micro zoom + sound swell.',
                'Tracks wardrobe visual stats: most-used outfit, transformation frequency, accessories per episode.',
              ],
            },
            {
              name: 'Director Brain', domain: 'Narrative Arc Intelligence', status: 'Partial',
              capabilities: [
                'Seasonal Arc Planner: defines season theme, 3 arc themes, emotional goals per mini-arc.',
                'Event Alignment Engine: suggests 3 arc-aligned event options per episode instead of random choices.',
                'Adaptive arc planning: 2+ consecutive fails → suggest recovery event | 3+ wins → suggest high-stakes risk.',
                'Tracks healthy failure rhythm per 8-ep arc: 2 moderate setbacks, 1 real failure, 4 wins, 1 major win.',
                'Enforces Event Density Control (max per episode rules).',
              ],
            },
            {
              name: 'Interaction Brain', domain: 'Character Behavior & Response Intelligence', status: 'Concept',
              capabilities: [
                'Reaction Engine: stat conditions trigger specific behavioral responses.',
                'Emotional Memory: tracks unresolved emotions across episodes — flags when they need resolution.',
                'Decision Echoes: outfit and event choices have narrative consequences 3–5 episodes later.',
                'Signature Moments Engine: learns recurring patterns — flags when broken for dramatic effect.',
                'Awareness Tracker: hidden variable — how close Lala is to discovering she is controlled.',
              ],
            },
            {
              name: 'Producer Brain', domain: 'Economy & Commerce Intelligence', status: 'Partial',
              capabilities: [
                'Manages Prime Bank: Coins, Creator Credits, Dream Fund, Bank Meter.',
                'Revenue Engine: Brand Deals, Sponsorship Contracts, Paid Appearances, Campaign Shoots.',
                'Contract Lifecycle Tracker: multi-episode brand deals with performance clauses.',
                'Weighted Outcome Engine: calculates success probability from all stat inputs.',
                'Content-to-Commerce Pipeline: fictional brand deliverables → real story content → real brand interest.',
                'Multi-platform export: 1 episode generates YouTube video + Instagram story polls + TikTok clips + caption text.',
              ],
            },
          ],
          rule: 'All 5 brains must be consulted on every episode. Each has domain authority. One script drives the entire pipeline.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'editor_brain', 'director_brain', 'interaction_brain', 'producer_brain']),
      },

      /* ── 12 · Screen States ── */
      {
        ...base,
        title: 'Screen States — Editor Brain Canvas',
        content: JSON.stringify({
          section: 'screen_states',
          summary: 'Every beat maps to exactly one Screen State. These control the entire visual production.',
          states: [
            { name: 'IDLE', desc: 'Minimal UI. Gentle drift. Lala at rest. World is quiet.' },
            { name: 'ALERT', desc: 'Soft notification. Icon pulse. No bounce animations. Something is arriving.' },
            { name: 'INFO_FOCUS', desc: 'Background blurred. Panel centered. World dims. Important information surfacing.' },
            { name: 'GAMEPLAY', desc: 'Closet UI active. Scroll pulses. Selection tension. Transformation Loop is running.' },
            { name: 'TRANSITION', desc: 'Full-screen stylish wipe. Camera parallax. Event Travel is happening.' },
            { name: 'ADMIRATION', desc: 'UI reduces. Screen cleans. Music swells. Slow push. Lala has arrived.' },
          ],
          rule: 'Every beat must map to exactly one Screen State. Editor Brain assigns these. ADMIRATION reduces all UI.',
        }),
        applies_to: JSON.stringify(['show_brain', 'director_brain', 'editor_brain', 'interaction_brain']),
      },

      /* ── 13 · Visual & Motion Language ── */
      {
        ...base,
        title: 'Visual and Motion Language',
        content: JSON.stringify({
          section: 'visual_language',
          summary: 'The show has a specific luxury visual aesthetic. Not negotiable. Must NEVER feel like a dashboard.',
          aesthetic_reference: [
            'Luxury Instagram editors',
            'Nyane-style smooth, elegant transitions',
            'High-end fashion reels — not streetwear, not chaotic',
            'Scrolling should feel like luxury shopping: motion blur, quick but controlled',
          ],
          allowed_motion: [
            'Smooth pushes',
            'Soft zoom',
            'Gentle whip transitions',
            'Elegant sound pairing',
            'Motion blur on scroll — quick but always controlled',
          ],
          banned_motion: [
            'Chaotic cuts',
            'Bounce animations',
            'Aggressive transitions',
            'Childish or playful visual effects',
            'Dashboard-style data displays',
          ],
          music_rules: [
            'Music is ALWAYS present — never silent.',
            'Auto-ducked under dialogue — never competes with Lala\'s voice.',
            'Luxury mood — never aggressive, never childish.',
            'Scroll pulses have subtle rhythm accents.',
            'Deadline beats trigger music intensity escalation.',
            'Admiration beats trigger music swells.',
          ],
          core_visual_rule: 'The show must NEVER feel like a dashboard. It must ALWAYS feel like a luxury life simulator. If a viewer thinks "this looks like a CMS", the design has failed.',
        }),
        applies_to: JSON.stringify(['show_brain', 'director_brain', 'editor_brain']),
      },

      /* ── 14 · Season & Arc Structure ── */
      {
        ...base,
        title: 'Season and Arc Structure — Season 1',
        content: JSON.stringify({
          section: 'season_1',
          summary: 'Season 1: Soft Luxury Ascension. 24 episodes, 3 mini-arcs of 8.',
          theme: 'Soft Luxury Ascension — Lala earns her place in the luxury tier',
          season_dream: 'Become a Recognized Creator',
          episode_count: 24,
          arc_structure: '3 mini-arcs of 8 episodes each',
          healthy_failure_rhythm: 'Per 8-ep arc: 2 moderate setbacks, 1 real failure, 4 wins, 1 major win',
          arcs: [
            {
              name: 'ARC 1: The Rise', episodes: '1–8',
              desc: 'Small events. First brand deal. First reputation shift. First mini failure at Episode 4.',
              graduated: [
                'Episodes 1–3: Invite + Reminder only. No brand deals. World feels clean.',
                'Episodes 4–6: First brand deal appears. Small deliverable. Light stat impact.',
                'Episodes 7–8: Failure episode. Reputation dip. Deliverable matters.',
              ],
            },
            {
              name: 'ARC 2: The Pressure', episodes: '9–16',
              desc: 'Bigger invites. Multiple interruptions per episode. Brand deadlines create real tension.',
              keys: 'Social proof challenges — rival arcs, brand ambassador competition. Major failure episode — reputation AND brand trust at risk simultaneously. Creator Credits start mattering.',
            },
            {
              name: 'ARC 3: The Legacy Move', episodes: '17–24',
              desc: 'Major brand arc — multi-episode collaboration line. Dream Fund milestone → scene upgrade.',
              keys: 'Prestige event at Episode 24 — season climax. Cliffhanger into Season 2: new rival, global expansion, or era shift.',
            },
          ],
          rule: 'Season 1 has 24 episodes in 3 arcs of 8. Healthy failure rhythm is enforced. Graduated intensity controls what appears by episode range.',
        }),
        applies_to: JSON.stringify(['show_brain', 'writer_brain', 'director_brain', 'story_engine', 'evaluation_engine']),
      },

      /* ── 15 · Multi-Platform Strategy ── */
      {
        ...base,
        title: 'Multi-Platform Strategy and Content Pipeline',
        content: JSON.stringify({
          section: 'multi_platform',
          summary: 'Same character, same stats, same arc — different lens across every platform. One show. Many worlds.',
          platforms: [
            { name: 'YouTube — Styling Adventures', desc: 'Main show. Full game world with UI overlays, evaluation scores, wardrobe gameplay. The definitive Lala experience.' },
            { name: 'TikTok — Day in the Life', desc: 'Lala as a content creator living her "real life." Choosing captions, doing brand outreach. She doesn\'t know it\'s a different show.' },
            { name: 'Instagram Stories', desc: 'Brand deal deliverables from the show become REAL stories. Audience votes on outfit choices. Fiction becomes a funnel for real brand interest.' },
            { name: 'Future: Interactive App', desc: 'YouTube show is proof of concept. Mechanics convert to interactive app. Fans play as Lala, or as themselves in her world.' },
          ],
          content_to_commerce_pipeline: [
            'Lala creates fictional brand deliverables in Episode Beat 12.',
            'Those deliverables export as real Instagram story polls.',
            'Real audience votes create real engagement data.',
            'Real engagement data attracts real brand deals.',
            'Fiction becomes a business development engine.',
          ],
          rule: 'Each platform gets purpose-built content — never repurposed cuts. The Content-to-Commerce Pipeline is the bridge from fiction to real business.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain', 'interaction_brain', 'director_brain']),
      },

      /* ── 16 · Future Systems ── */
      {
        ...base,
        title: 'Future Systems — Queued But Not Built',
        content: JSON.stringify({
          section: 'canon_rules',
          summary: 'Systems that are designed and documented but not yet built. These are queued — not abandoned.',
          systems: [
            { name: 'Emotional Memory', desc: 'Unresolved emotions carry forward. Flags when they need resolution.', priority: 'HIGH' },
            { name: 'Decision Echoes', desc: 'Outfit/event choices have consequences 3–5 episodes later. System suggests callbacks.', priority: 'HIGH' },
            { name: 'World Temperature', desc: 'Is LalaLand warm or cold to Lala? Affects invites, brand interest, rival time.', priority: 'MEDIUM' },
            { name: 'Awareness Tracker', desc: 'Hidden variable — how close Lala is to discovering she is controlled.', priority: 'MEDIUM' },
            { name: 'Signature Moments Engine', desc: 'Learns recurring patterns, flags when broken for dramatic effect.', priority: 'MEDIUM' },
            { name: 'RunwayML Location Gen', desc: 'AI backgrounds generated from script location hints. Saves prompt + seed.', priority: 'LOW' },
            { name: 'Brand Deal Pipeline', desc: 'Fictional deals → real content → real brand interest. Full loop.', priority: 'HIGH' },
            { name: 'AI Video Editing', desc: 'Separate 16-week plan. Claude API + FFmpeg + YouTube analysis. Not started.', priority: 'FUTURE' },
            { name: 'Momentum Stat Engine', desc: 'Winning/losing streak tracker fully implemented in evaluation formula.', priority: 'HIGH' },
            { name: 'Multiple Mail Types', desc: 'All 5 canonical mail types fully implemented and rendered.', priority: 'HIGH' },
            { name: 'Enhanced Script Tags', desc: 'All 9 script tags built and parsed, not just EVENT/RESULT/STAT.', priority: 'MEDIUM' },
            { name: 'Character Bible Page', desc: '5-section control center: Identity, Voice DNA, Visual Identity, Role, Patterns.', priority: 'HIGH' },
          ],
          rule: 'These systems are queued — not abandoned. Current implementations must not contradict their designs.',
        }),
        applies_to: JSON.stringify(['show_brain', 'producer_brain']),
      },

      /* ── 17 · Locked Canon Rules ── */
      {
        ...base,
        title: 'Locked Canon Rules — Permanent and Non-Negotiable',
        content: JSON.stringify({
          section: 'canon_rules',
          summary: 'These decisions are permanent. They cannot be changed without a formal deviation log entry.',
          character_rules: [
            'Lala does NOT know she is in a show. Never break this. Never hint at it.',
            'Lala cannot speak before Voice Activation. This is a mechanic, not a bug.',
            'Lala in LalaVerse is NOT the same as Lala in Character to Currency. Different systems, different purposes, different system prompts. The wall is absolute.',
            'Login Ritual cannot be skipped. Not for time. Not for pacing. Never.',
          ],
          world_rules: [
            'Rep contribution to evaluation is capped at 15 — prevents score inflation at high rep levels.',
            'Event density is enforced per episode — max 1 Invite, 1 Brand Deal, 1 Reminder, 1 optional DM.',
            'Failure episodes must never be softened. Failure has weight or the world has no rules.',
            'character_state is per-show, not per-episode — one row tracks cumulative progression.',
          ],
          production_rules: [
            'The show must NEVER feel like a dashboard. If it does, redesign before shipping.',
            'Bounce animations are permanently banned from the visual language.',
            'Script is always the source of truth for beat structure — not the UI.',
            'Book lines (from JustAWoman\'s manuscript) are the source. Script is the output. Writer Brain is the pipeline.',
          ],
          rule: 'PERMANENT CANON. Cannot be changed without a formal deviation log entry. These are the show\'s constitution.',
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
