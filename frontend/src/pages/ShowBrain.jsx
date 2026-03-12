import React, { useState } from 'react';
import './ShowBrain.css';

/* ═══════════════════════════════════════════════════════════════
   Show Brain — Master Intelligence Document · v1.0
   PRODUCTION VERSION — 24 episodes · 6 stats · Prime Bank
   13 tabs · Pink accent (#d4789a) · .sb-* CSS prefix
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'identity',    label: 'Identity' },
  { key: 'character',   label: 'Character Bible' },
  { key: 'sliders',     label: 'Personality' },
  { key: 'worldlaws',   label: 'World Rules' },
  { key: 'stats',       label: 'Stats' },
  { key: 'economy',     label: 'Economy' },
  { key: 'beats',       label: 'Episode Beats' },
  { key: 'brains',      label: '5 Brains' },
  { key: 'screens',     label: 'Screen States' },
  { key: 'visual',      label: 'Visual Language' },
  { key: 'season',      label: 'Season 1' },
  { key: 'platform',    label: 'Multi-Platform' },
  { key: 'canon',       label: 'Canon Rules' },
];

/* ─── DATA ─── */

const IDENTITY = {
  genre: 'Narrative-driven luxury fashion life simulator',
  format: 'YouTube-first (multi-platform expansion)',
  season_structure: '24 episodes per season — 3 mini-arcs of 8 episodes each',
  current_season: 'Season 1: Soft Luxury Ascension',
  current_status: 'Episodes 1–4 completed. Entering Episode 5.',
  production_system: 'Prime Studios (primepisodes.com)',
  universe: 'LalaVerse — shared canon across all Prime Studios products',
};

const EMOTIONAL_PROMISE = [
  'I am helping Lala rise.',
  'This world has rules.',
  'Her choices matter.',
  'Failure has weight.',
  'Success feels earned.',
  'This is not random — it is building.',
];

const SHOW_IS = [
  'A narrative-driven, creator-driven, beauty-driven economy.',
  'A world where fashion is strategy, reputation is currency, and legacy is built episode by episode.',
];

const SHOW_ISNT = [
  'Not a dress-up game.',
  'Not a fashion vlog.',
  'Not a content tutorial.',
  'Not a dashboard.',
];

const LALA_CORE = {
  name: 'Lala (LalaVerse Canon Character)',
  role: 'Luxury fashion creator and main protagonist',
  world: 'LalaVerse — a consequence-driven fashion economy',
  awareness: 'Lala does NOT know she is in a show. She believes her world is real.',
  current_era: 'Soft Luxury Era (Episodes 1–3 complete, entering Episode 4+)',
  current_arc: 'ARC 1: The Rise',
};

const VOICE_DNA = [
  { aspect: 'Bestie Address', desc: 'Uses "bestie" as a warm, confident address — not slang, elevated casual.' },
  { aspect: 'Sentence Style', desc: 'Speaks in complete, considered sentences — never fragments under pressure.' },
  { aspect: 'Emotional Escalation', desc: 'Escalates emotionally in beats: Reveal → Reaction → Resolution.' },
  { aspect: 'Voice Activation', desc: 'NEVER speaks before Voice Activation occurs — this is a core game mechanic.' },
  { aspect: 'Interruption Rule', desc: 'Rarely interrupts. When she does, it is a dramatic story beat.' },
  { aspect: 'Signature Energy', desc: '"This is my moment." / "The world will notice." / "I built this."' },
];

const INTERACTION_GRAMMAR = [
  { rule: 'Voice Activation', desc: 'Lala cannot speak until the creator clicks the Voice Icon. Always.' },
  { rule: 'Emotional Escalation', desc: 'All emotional beats follow: Reveal → Transformation → Payoff.' },
  { rule: 'Interruption Rule', desc: 'Lala rarely interrupts. When she does, log it as a narrative beat.' },
  { rule: 'Silence Rule', desc: 'Silence is a valid Lala state. Not every beat requires dialogue.' },
  { rule: 'Login Ritual', desc: 'Every episode opens with headphones on → login overlay → typing animation → Enter. Sacred. Never skipped.' },
];

const PERSONALITY_SLIDERS = [
  { name: 'Confidence', value: 65, desc: 'How boldly she speaks and acts.' },
  { name: 'Playfulness', value: 70, desc: 'How light vs. serious her tone is.' },
  { name: 'Luxury Tone', value: 80, desc: 'How elevated and aspirational her language is.' },
  { name: 'Drama Level', value: 55, desc: 'How emotionally reactive she gets.' },
  { name: 'Softness', value: 60, desc: 'How warm vs. guarded her demeanor is.' },
];

const STAT_DRIVEN_BEHAVIOR = [
  { condition: 'Reputation < 3', response: 'Defensive, hesitant, seeking approval', tone: '"I hope this is enough…"' },
  { condition: 'Reputation > 7', response: 'Bold, authoritative, selective', tone: '"Maison Belle? Of course they called me."' },
  { condition: 'Coins < event cost', response: 'Stressed, calculating, risk-averse', tone: '"I need to think about this."' },
  { condition: 'Brand Trust < 3', response: 'Cautious with new deals, slower to commit', tone: '"Let me see the brief first."' },
  { condition: 'Influence > 7', response: 'Charismatic, trend-setting, commanding', tone: '"They follow my lead."' },
  { condition: 'Momentum streak', response: 'Energized, faster decisions, elevated tone', tone: '"Keep going. Nothing can stop this."' },
  { condition: 'Confidence < 40', response: 'Vulnerable, introspective, quieter', tone: '"Okay… I can do this. I think."' },
  { condition: 'Confidence > 80', response: 'Radiant, effortless, genre-defining', tone: '"Bestie, of course I was invited."' },
];

const WORLD_LAWS = [
  { num: 1, rule: 'Login Ritual is sacred — every episode must open with it.', consequence: 'Episode feels disconnected from the world.' },
  { num: 2, rule: 'Lala requires Voice Activation before speaking.', consequence: 'Breaks game mechanic and audience immersion.' },
  { num: 3, rule: 'All narrative events arrive as Mail (5 canonical types).', consequence: 'World feels unpredictable and unstructured.' },
  { num: 4, rule: 'Checklists must follow outfit swaps.', consequence: 'Transformation loop loses its dopamine rhythm.' },
  { num: 5, rule: 'Deadlines create pacing acceleration.', consequence: 'Tension drops; urgency is lost.' },
  { num: 6, rule: 'Reputation affects brand offers received.', consequence: 'Economy feels arbitrary and unrewarding.' },
  { num: 7, rule: 'Failed events reduce brand trust and future offers.', consequence: 'Failure has no weight; story arc flattens.' },
  { num: 8, rule: 'Coin milestones unlock location upgrades.', consequence: 'Growth feels invisible and unmotivating.' },
  { num: 9, rule: 'Nothing is random — everything is consequence-driven.', consequence: 'World loses its logic and emotional truth.' },
];

const MAIL_TYPES = [
  { type: 'Invite', icon: '💌', desc: 'Event invitation (fashion show, appearance, collab).', freq: '1 per episode (Episodes 1–3: only type allowed)' },
  { type: 'Brand Deal', icon: '🤝', desc: 'Sponsorship or campaign opportunity with deliverable.', freq: '1 per episode (unlocks Episode 4+)' },
  { type: 'Reminder', icon: '⏰', desc: 'Deadline pulse — intensifies pacing and urgency.', freq: '1 per episode' },
  { type: 'DM / Social', icon: '💬', desc: 'Social signal — rival activity, fan moment, press mention.', freq: 'Optional, 1 max per episode' },
  { type: 'Deadline', icon: '🔴', desc: 'Final countdown — triggers max urgency, accelerates all beats.', freq: 'Rare — used for arc climaxes' },
];

const EVENT_DENSITY = [
  { episodes: '1–3', rule: 'Invite + Reminder only. No brand deals. World feels clean and welcoming.' },
  { episodes: '4–6', rule: 'First brand deal appears. Small deliverable. Light stat impact.' },
  { episodes: '7–8', rule: 'First failure episode. Reputation dip. Deliverable matters. Stakes are real.' },
];

const SIX_STATS = [
  { name: 'Prime Coins', emoji: '💫', range: '0–unlimited (starts: 500)', desc: 'Wealth and purchasing power.', status: '✅ Built' },
  { name: 'Reputation', emoji: '⭐', range: '0–10 (starts: 0)', desc: 'Social prestige and public perception.', status: '✅ Built' },
  { name: 'Influence', emoji: '📈', range: '0–10 (starts: 0)', desc: 'Audience growth and creator reach.', status: '✅ Built' },
  { name: 'Brand Trust', emoji: '🤝', range: '0–10 (starts: 5)', desc: 'Professional credibility with brands.', status: '✅ Built' },
  { name: 'Momentum', emoji: '🔥', range: '0–10', desc: 'Winning/losing streak energy multiplier.', status: '❌ Not yet built' },
  { name: 'Confidence', emoji: '💖', range: '0–100', desc: 'Internal emotional state (inverse of Stress).', status: '⚠️ Partial (stress field)' },
];

const VISIBILITY_LAYERS = [
  { layer: 'Micro HUD', desc: 'Subtle always-on stat display. Gold-accented, luxury aesthetic. Soft sparkle animation on stat changes. Always visible but never intrusive.' },
  { layer: 'Milestone Recap Panels', desc: 'End-of-episode summary cards showing stat changes. Cinematic design, not spreadsheet-style. Appears after Event Outcome beat.' },
  { layer: 'Invisible Emotional Engine', desc: "Stats influence Lala's dialogue tone, reaction intensity, and confidence. The viewer feels it but never sees a number. This is the most powerful layer." },
];

const EVALUATION_FORMULA = {
  base_score: 100,
  components: [
    { name: 'Outfit Tier Bonus', value: 'up to +20', desc: 'Based on outfit quality tier' },
    { name: 'Synergy Bonus', value: 'up to +5', desc: 'Outfit aesthetic matches event type' },
    { name: 'Rep Contribution', value: 'min(rep × 3, 15)', desc: 'Capped at 15 to prevent inflation' },
    { name: 'Risk Penalty', value: '−(risk × difficulty)', desc: 'Event risk level × difficulty multiplier' },
    { name: 'Recent Loss Penalty', value: '−10', desc: 'If last event failed' },
    { name: 'Under Budget Penalty', value: '−15', desc: 'If event cost exceeds available coins' },
  ],
  pass_threshold: 'Score ≥ 60',
  fail_threshold: 'Score < 60',
};

const CURRENCIES = [
  { name: 'Prime Coins', icon: '💫', desc: 'Primary currency. Wealth and purchasing power. Used to enter events, buy wardrobe, unlock locations. Visible in Micro HUD.' },
  { name: 'Creator Credits', icon: '⭐', desc: 'Status currency. Earned through career milestones and brand partnerships. Unlocks premium event access and prestige offers.' },
  { name: 'Dream Fund', icon: '✨', desc: "Seasonal arc driver. Accumulates toward Lala's season dream goal. Milestone hits trigger major world events." },
  { name: 'Bank Meter', icon: '🏦', desc: 'Platform consistency tracker (NOT in the show — future platform layer). Resets monthly. Invisible to the audience.' },
];

const DREAM_FUND = {
  season_1: 'Become a Recognized Creator',
  season_2: 'Break Into Luxury Tier (resets, but achievements carry forward)',
  accumulation: 'Across all 24 episodes — never resets mid-season',
  milestone_triggers: 'New location, expanded closet, scene upgrade',
  display: 'Never displayed as a progress bar — appears only at milestone moments',
};

const REVENUE_STREAMS = [
  'Brand Deals — sponsorship contracts with deliverables',
  'Paid Appearances — event fees from high-prestige invites',
  'Campaign Shoots — multi-episode brand arcs with performance clauses',
  'Collaboration Lines — co-designed product deals at high influence tiers',
  'Affiliate Touchpoints — commerce layer (Phase 2 feature)',
];

const BEATS = [
  { num: 1,  name: 'Opening Ritual', desc: "Headphones on — the show's sacred opening. Never skipped.", highlight: true },
  { num: 2,  name: 'Login Sequence', desc: 'Login overlay → typing animation → Enter. World loads.', highlight: true },
  { num: 3,  name: 'Welcome', desc: 'Lala enters the frame. World state is visible. Tone is set.' },
  { num: 4,  name: 'Interruption Pulse #1', desc: 'Mail arrives. First narrative event of the episode. Usually an Invite.' },
  { num: 5,  name: 'Reveal', desc: 'Lala reads the mail. Audience sees her unfiltered reaction.' },
  { num: 6,  name: 'Strategic Reaction', desc: 'Lala evaluates: Can I afford this? Do I want this? What does this mean?' },
  { num: 7,  name: 'Interruption Pulse #2', desc: 'Second mail arrives. Brand deal, DM, or Side Quest. Tension compounds.' },
  { num: 8,  name: 'Transformation Loop', desc: 'Dopamine engine. Scroll → select → swap → check. Outfit is chosen.', highlight: true },
  { num: 9,  name: 'Reminder / Deadline Pulse', desc: 'Pacing accelerates. Music intensifies. The clock is real.' },
  { num: 10, name: 'Event Travel', desc: 'Stylish wipe transition. New environment loads. World expands.' },
  { num: 11, name: 'Event Outcome', desc: 'The evaluation resolves. Pass or fail. Stats update.' },
  { num: 12, name: 'Deliverable Creation', desc: 'Lala creates brand content. This exports as real Instagram stories.', highlight: true },
  { num: 13, name: 'Recap Panel', desc: 'Cinematic stat card. Coins changed. Brand trust updated. Dream Fund moved.' },
  { num: 14, name: 'Cliffhanger', desc: 'Next episode is seeded. The world keeps going.' },
];

const ARCHETYPES = [
  { name: 'Rise Episode', desc: 'Lala wins. Stats climb. World responds warmly. Used for momentum building and audience trust.' },
  { name: 'Pressure Episode', desc: 'Multiple interruptions. Tight decisions. Stakes are high but outcome is still possible to control.' },
  { name: 'Failure Episode', desc: 'Lala fails an event. Reputation or brand trust drops. Emotional weight is mandatory. Never softened.' },
  { name: 'Recovery Episode', desc: 'Post-failure arc. Slower pacing. Rebuilding tone. Smaller wins. Emotional depth.' },
  { name: 'Legacy Episode', desc: 'Season arc climax. Major event. Dream Fund milestone. Cinematic scale. Everything the season built pays off.' },
];

const SCRIPT_TAGS = [
  { tag: '[EVENT: name]', desc: 'Marks the narrative event triggering in this beat.', status: '✅ Built' },
  { tag: '[RESULT: pass/fail]', desc: 'Declares the outcome of the event evaluation.', status: '✅ Built' },
  { tag: '[STAT: field +/- value]', desc: 'Declares a stat change — applied after evaluation.', status: '✅ Built' },
  { tag: '[MAIL: type]', desc: 'Marks a mail arrival beat (Invite / Brand Deal / Reminder / DM / Deadline).', status: '❌ Future' },
  { tag: '[WARDROBE_SWAP]', desc: 'Marks the transformation beat — triggers checklist animation.', status: '❌ Future' },
  { tag: '[LOCATION_HINT: name]', desc: 'Suggests the background environment for Event Travel.', status: '❌ Future' },
  { tag: '[REACTION: emotion]', desc: "Declares Lala's emotional state for the Writer Brain.", status: '❌ Future' },
  { tag: '[DELIVERABLE: type]', desc: 'Marks the content creation beat — triggers export pipeline.', status: '❌ Future' },
  { tag: '[AUDIENCE_HOOK]', desc: 'Marks a beat designed to drive audience engagement or voting.', status: '❌ Future' },
];

const FIVE_BRAINS = [
  {
    name: 'Writer Brain', icon: '✍️', color: '#d4789a', status: '[CONCEPT]',
    domain: 'Script & Dialogue Intelligence',
    capabilities: [
      "Generates and suggests script lines based on Lala's current stats.",
      'Reads Character Bible personality sliders to match voice.',
      'Validates scripts against beat presence rules.',
      'Enforces Interaction Grammar (Voice Activation, escalation path).',
      'Stat-aware filtering: confidence < 40 → vulnerable tone | confidence > 80 → radiant tone.',
    ],
  },
  {
    name: 'Editor Brain', icon: '🔍', color: '#a889c8', status: '[CONCEPT]',
    domain: 'Visual & Timeline Intelligence',
    capabilities: [
      'Maps each beat to a Screen State.',
      'Controls zoom level, UI visibility, motion intensity, sound intensity.',
      'Auto-manages luxury pacing: heavy info → reduce motion | big emotional line → micro zoom + sound swell.',
      'Tracks wardrobe visual stats: most-used outfit, transformation frequency, accessories per episode.',
    ],
  },
  {
    name: 'Director Brain', icon: '🎬', color: '#7ab3d4', status: '⚠️ Partial',
    domain: 'Narrative Arc Intelligence',
    capabilities: [
      'Seasonal Arc Planner: defines season theme, 3 arc themes, emotional goals per mini-arc.',
      'Event Alignment Engine: suggests 3 arc-aligned event options per episode instead of random choices.',
      'Adaptive arc planning: 2+ consecutive fails → suggest recovery event | 3+ wins → suggest high-stakes risk.',
      'Tracks healthy failure rhythm per 8-ep arc: 2 moderate setbacks, 1 real failure, 4 wins, 1 major win.',
      'Enforces Event Density Control (max per episode rules).',
    ],
  },
  {
    name: 'Interaction Brain', icon: '💬', color: '#6bba9a', status: '[CONCEPT]',
    domain: 'Character Behavior & Response Intelligence',
    capabilities: [
      'Reaction Engine: stat conditions trigger specific behavioral responses.',
      'Emotional Memory: tracks unresolved emotions across episodes — flags when they need resolution.',
      'Decision Echoes: outfit and event choices have narrative consequences 3–5 episodes later.',
      'Signature Moments Engine: learns recurring patterns — flags when broken for dramatic effect.',
      'Awareness Tracker: hidden variable — how close Lala is to discovering she is controlled.',
    ],
  },
  {
    name: 'Producer Brain', icon: '📊', color: '#c9a84c', status: '⚠️ Partial',
    domain: 'Economy & Commerce Intelligence',
    capabilities: [
      'Manages Prime Bank: Coins, Creator Credits, Dream Fund, Bank Meter.',
      'Revenue Engine: Brand Deals, Sponsorship Contracts, Paid Appearances, Campaign Shoots.',
      'Contract Lifecycle Tracker: multi-episode brand deals with performance clauses.',
      'Weighted Outcome Engine: calculates success probability from all stat inputs.',
      'Content-to-Commerce Pipeline: fictional brand deliverables → real story content → real brand interest.',
      'Multi-platform export: 1 episode generates YouTube video + Instagram story polls + TikTok clips + caption text.',
    ],
  },
];

const SCREEN_STATES = [
  { name: 'IDLE', color: '#b89060', desc: 'Minimal UI. Gentle drift. Lala at rest. World is quiet.' },
  { name: 'ALERT', color: '#c9a84c', desc: 'Soft notification. Icon pulse. No bounce animations. Something is arriving.' },
  { name: 'INFO_FOCUS', color: '#7ab3d4', desc: 'Background blurred. Panel centered. World dims. Important information surfacing.' },
  { name: 'GAMEPLAY', color: '#6bba9a', desc: 'Closet UI active. Scroll pulses. Selection tension. Transformation Loop is running.' },
  { name: 'TRANSITION', color: '#a889c8', desc: 'Full-screen stylish wipe. Camera parallax. Event Travel is happening.' },
  { name: 'ADMIRATION', color: '#d4789a', desc: 'UI reduces. Screen cleans. Music swells. Slow push. Lala has arrived.' },
];

const AESTHETIC_REFERENCE = [
  'Luxury Instagram editors',
  'Nyane-style smooth, elegant transitions',
  'High-end fashion reels — not streetwear, not chaotic',
  'Scrolling should feel like luxury shopping: motion blur, quick but controlled',
];

const ALLOWED_MOTION = [
  'Smooth pushes',
  'Soft zoom',
  'Gentle whip transitions',
  'Elegant sound pairing',
  'Motion blur on scroll — quick but always controlled',
];

const BANNED_MOTION = [
  'Chaotic cuts',
  'Bounce animations',
  'Aggressive transitions',
  'Childish or playful visual effects',
  'Dashboard-style data displays',
];

const MUSIC_RULES = [
  'Music is ALWAYS present — never silent.',
  "Auto-ducked under dialogue — never competes with Lala's voice.",
  'Luxury mood — never aggressive, never childish.',
  'Scroll pulses have subtle rhythm accents.',
  'Deadline beats trigger music intensity escalation.',
  'Admiration beats trigger music swells.',
];

const SEASON_ARCS = [
  {
    name: 'ARC 1: The Rise', episodes: '1–8', color: '#6bba9a',
    desc: 'Small events. First brand deal. First reputation shift. First mini failure at Episode 4.',
    graduated: [
      'Episodes 1–3: Invite + Reminder only. No brand deals. World feels clean.',
      'Episodes 4–6: First brand deal appears. Small deliverable. Light stat impact.',
      'Episodes 7–8: Failure episode. Reputation dip. Deliverable matters.',
    ],
  },
  {
    name: 'ARC 2: The Pressure', episodes: '9–16', color: '#c9a84c',
    desc: 'Bigger invites. Multiple interruptions per episode. Brand deadlines create real tension.',
    keys: 'Social proof challenges — rival arcs, brand ambassador competition. Major failure episode — reputation AND brand trust at risk simultaneously. Creator Credits start mattering.',
  },
  {
    name: 'ARC 3: The Legacy Move', episodes: '17–24', color: '#d4789a',
    desc: 'Major brand arc — multi-episode collaboration line. Dream Fund milestone → scene upgrade.',
    keys: 'Prestige event at Episode 24 — season climax. Cliffhanger into Season 2: new rival, global expansion, or era shift.',
  },
];

const PLATFORMS = [
  { name: 'YouTube — Styling Adventures', icon: '▶️', desc: 'Main show. Full game world with UI overlays, evaluation scores, wardrobe gameplay. The definitive Lala experience.' },
  { name: 'TikTok — Day in the Life', icon: '🎵', desc: "Lala as a content creator living her 'real life.' Choosing captions, doing brand outreach. She doesn't know it's a different show." },
  { name: 'Instagram Stories', icon: '📸', desc: 'Brand deal deliverables from the show become REAL stories. Audience votes on outfit choices. Fiction becomes a funnel for real brand interest.' },
  { name: 'Future: Interactive App', icon: '📱', desc: 'YouTube show is proof of concept. Mechanics convert to interactive app. Fans play as Lala, or as themselves in her world.' },
];

const COMMERCE_PIPELINE = [
  'Lala creates fictional brand deliverables in Episode Beat 12.',
  'Those deliverables export as real Instagram story polls.',
  'Real audience votes create real engagement data.',
  'Real engagement data attracts real brand deals.',
  'Fiction becomes a business development engine.',
];

const FUTURE_SYSTEMS = [
  { name: 'Emotional Memory', desc: 'Unresolved emotions carry forward. Flags when they need resolution.', priority: 'HIGH' },
  { name: 'Decision Echoes', desc: 'Outfit/event choices have consequences 3–5 episodes later.', priority: 'HIGH' },
  { name: 'World Temperature', desc: 'Is LalaLand warm or cold to Lala? Affects invites, brand interest, rival time.', priority: 'MEDIUM' },
  { name: 'Awareness Tracker', desc: 'Hidden variable — how close Lala is to discovering she is controlled.', priority: 'MEDIUM' },
  { name: 'Signature Moments Engine', desc: 'Learns recurring patterns, flags when broken for dramatic effect.', priority: 'MEDIUM' },
  { name: 'RunwayML Location Gen', desc: 'AI backgrounds generated from script location hints. Saves prompt + seed.', priority: 'LOW' },
  { name: 'Brand Deal Pipeline', desc: 'Fictional deals → real content → real brand interest. Full loop.', priority: 'HIGH' },
  { name: 'AI Video Editing', desc: 'Claude API + FFmpeg + YouTube analysis. Separate 16-week plan.', priority: 'FUTURE' },
  { name: 'Momentum Stat Engine', desc: 'Winning/losing streak tracker fully implemented in evaluation formula.', priority: 'HIGH' },
  { name: 'Multiple Mail Types', desc: 'All 5 canonical mail types fully implemented and rendered.', priority: 'HIGH' },
  { name: 'Enhanced Script Tags', desc: 'All 9 script tags built and parsed, not just EVENT/RESULT/STAT.', priority: 'MEDIUM' },
  { name: 'Character Bible Page', desc: '5-section control center: Identity, Voice DNA, Visual Identity, Role, Patterns.', priority: 'HIGH' },
];

const CANON_CHARACTER = [
  'Lala does NOT know she is in a show. Never break this. Never hint at it.',
  'Lala cannot speak before Voice Activation. This is a mechanic, not a bug.',
  "Lala in LalaVerse is NOT the same as Lala in Character to Currency. Different systems, different purposes, different system prompts. The wall is absolute.",
  'Login Ritual cannot be skipped. Not for time. Not for pacing. Never.',
];

const CANON_WORLD = [
  'Rep contribution to evaluation is capped at 15 — prevents score inflation at high rep levels.',
  'Event density is enforced per episode — max 1 Invite, 1 Brand Deal, 1 Reminder, 1 optional DM.',
  'Failure episodes must never be softened. Failure has weight or the world has no rules.',
  'character_state is per-show, not per-episode — one row tracks cumulative progression.',
];

const CANON_PRODUCTION = [
  'The show must NEVER feel like a dashboard. If it does, redesign before shipping.',
  'Bounce animations are permanently banned from the visual language.',
  'Script is always the source of truth for beat structure — not the UI.',
  "Book lines (from JustAWoman's manuscript) are the source. Script is the output. Writer Brain is the pipeline.",
];

/* ─── TAB RENDERERS ─── */

function renderIdentity() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        STYLING ADVENTURES WITH LALA is a narrative-driven luxury fashion life simulator.
        Fashion is strategy. Reputation is currency. Legacy is built episode by episode.
        This is the master intelligence document — the single source of truth for every system, engine, and brain.
      </p>

      <div className="sb-identity-grid">
        {Object.entries(IDENTITY).map(([key, val]) => (
          <div key={key} className="sb-identity-card">
            <h4>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h4>
            <p>{val}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Emotional Promise</h3>
      <div className="sb-callout">
        <span className="sb-callout-icon">💫</span>
        <div>
          <strong>What the viewer must feel</strong>
          <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.2rem' }}>
            {EMOTIONAL_PROMISE.map((p, i) => <li key={i} style={{ fontSize: '.88rem', lineHeight: '1.65', color: '#6a4a5a' }}>{p}</li>)}
          </ul>
        </div>
      </div>

      <div className="sb-is-isnot">
        <div className="sb-is-card">
          <h4>What the Show IS</h4>
          <ul>{SHOW_IS.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="sb-isnot-card">
          <h4>What the Show is NOT</h4>
          <ul>{SHOW_ISNT.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      </div>

      <div className="sb-callout" style={{ marginTop: '1.5rem' }}>
        <span className="sb-callout-icon">⚖️</span>
        <div>
          <strong>Canonical Rule</strong>
          <p>If a feature, script, decision, or system contradicts this document — the document wins. Update this document first. Then update the system. Never the other way around.</p>
        </div>
      </div>
    </div>
  );
}

function renderCharacter() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Lala is a luxury fashion creator and main protagonist in the LalaVerse. She does NOT know she is in a show — she believes her world is real.
      </p>

      <div className="sb-identity-grid">
        {Object.entries(LALA_CORE).map(([key, val]) => (
          <div key={key} className="sb-identity-card">
            <h4>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h4>
            <p>{val}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Voice DNA</h3>
      <div className="sb-identity-grid">
        {VOICE_DNA.map((v) => (
          <div key={v.aspect} className="sb-identity-card">
            <h4>{v.aspect}</h4>
            <p>{v.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Interaction Grammar</h3>
      <div className="sb-identity-grid">
        {INTERACTION_GRAMMAR.map((ig) => (
          <div key={ig.rule} className="sb-identity-card">
            <h4>{ig.rule}</h4>
            <p>{ig.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSliders() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        5 personality sliders define Lala's baseline personality. They shift dynamically based on current stats. All engines must check stat conditions before generating Lala behavior.
      </p>

      <div className="sb-slider-stack">
        {PERSONALITY_SLIDERS.map((s) => (
          <div key={s.name}>
            <div className="sb-slider-card">
              <span className="sb-slider-label">{s.name}</span>
              <div className="sb-slider-bar">
                <div className="sb-slider-fill" style={{ width: `${s.value}%` }} />
              </div>
              <span className="sb-slider-value">{s.value}</span>
            </div>
            <p className="sb-slider-desc">{s.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Stat-Driven Behavior Table</h3>
      <div className="sb-threshold-grid">
        {STAT_DRIVEN_BEHAVIOR.map((t) => (
          <div key={t.condition} className="sb-threshold-card">
            <code>{t.condition}</code>
            <p><strong>{t.response}</strong></p>
            <p style={{ fontStyle: 'italic', color: '#a889c8', marginTop: '.25rem' }}>{t.tone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderWorldLaws() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        The 9 canonical operating rules of LalaLand. Nothing is random. Everything is consequence-driven. These are physics, not suggestions.
      </p>

      <div className="sb-law-stack">
        {WORLD_LAWS.map((l) => (
          <div key={l.num} className="sb-law-card">
            <span className="sb-law-number">{l.num}</span>
            <div className="sb-law-body">
              <h4>{l.rule}</h4>
              <p><strong>If violated:</strong> {l.consequence}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Mail System — 5 Canonical Types</h3>
      <p className="sb-intro">All narrative events enter Lala's world as Mail. The mail system is the only narrative delivery mechanism.</p>
      <div className="sb-mail-grid">
        {MAIL_TYPES.map((m) => (
          <div key={m.type} className="sb-mail-card">
            <div className="sb-mail-icon">{m.icon}</div>
            <h4>{m.type}</h4>
            <p>{m.desc}</p>
            <p style={{ fontSize: '.78rem', color: '#a889c8', marginTop: '.35rem', fontWeight: 500 }}>{m.freq}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Graduated Event Density</h3>
      <div className="sb-callout">
        <span className="sb-callout-icon">📈</span>
        <div>
          <strong>Event Density Control</strong>
          <p>Max per episode: 1 Invite + 1 Brand Deal + 1 Reminder + 1 Social DM (optional). Director Brain enforces these limits.</p>
          <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
            {EVENT_DENSITY.map((d, i) => (
              <li key={i} style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}>
                <strong>Episodes {d.episodes}:</strong> {d.rule}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function renderStats() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        6 core stats drive every decision, outcome, and behavior. They are the engine beneath everything the audience sees.
      </p>

      <div className="sb-stat-grid">
        {SIX_STATS.map((s) => (
          <div key={s.name} className="sb-stat-card">
            <div className="sb-stat-header">
              <span className="sb-stat-emoji">{s.emoji}</span>
              <h4>{s.name}</h4>
              <span className="sb-stat-range">{s.range}</span>
            </div>
            <p className="sb-stat-desc">{s.desc}</p>
            <div className="sb-stat-drives">
              <strong>Build Status</strong>
              {s.status}
            </div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">3 Visibility Layers</h3>
      <p className="sb-intro">Stats are NEVER displayed raw as a dashboard. They surface through 3 visibility layers.</p>
      <div className="sb-vis-stack">
        {VISIBILITY_LAYERS.map((v, i) => (
          <div key={v.layer} className={`sb-vis-card ${['sb-vis-public', 'sb-vis-private', 'sb-vis-hidden'][i]}`}>
            <h4>{v.layer}</h4>
            <p>{v.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Evaluation Formula</h3>
      <div className="sb-formula">
        Base Score: {EVALUATION_FORMULA.base_score}
        {EVALUATION_FORMULA.components.map((c, i) => (
          <span key={i}><br />{c.name}: {c.value} — {c.desc}</span>
        ))}
        <br /><br />
        <em style={{ color: '#d4789a', fontSize: '.8rem' }}>
          Pass: {EVALUATION_FORMULA.pass_threshold} | Fail: {EVALUATION_FORMULA.fail_threshold}
        </em>
      </div>
    </div>
  );
}

function renderEconomy() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        The show economy runs on Prime Bank with 4 interconnected currency types. The economy serves narrative, not monetization.
      </p>

      <div className="sb-currency-grid">
        {CURRENCIES.map((c) => (
          <div key={c.name} className="sb-currency-card">
            <div className="sb-currency-icon">{c.icon}</div>
            <h4>{c.name}</h4>
            <p style={{ fontSize: '.85rem', lineHeight: '1.55', color: '#4a4a5a' }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Dream Fund Behavior</h3>
      <div className="sb-callout">
        <span className="sb-callout-icon">✨</span>
        <div>
          <strong>The Dream Fund</strong>
          <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.2rem' }}>
            <li style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}><strong>Season 1 Dream:</strong> {DREAM_FUND.season_1}</li>
            <li style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}><strong>Season 2 Dream:</strong> {DREAM_FUND.season_2}</li>
            <li style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}><strong>Accumulation:</strong> {DREAM_FUND.accumulation}</li>
            <li style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}><strong>Milestones:</strong> {DREAM_FUND.milestone_triggers}</li>
            <li style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#6a4a5a' }}><strong>Display:</strong> {DREAM_FUND.display}</li>
          </ul>
        </div>
      </div>

      <h3 className="sb-sub-heading">Revenue Streams (in-world)</h3>
      <div className="sb-revenue-stack">
        {REVENUE_STREAMS.map((r, i) => (
          <div key={i} className="sb-revenue-card">
            <h4>{r}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBeats() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Every episode follows a canonical 14-beat sequence. No episode skips beats. No beat is optional. Opening Ritual and Login Sequence are sacred.
      </p>

      <div className="sb-beat-stack">
        {BEATS.map((b) => (
          <div key={b.num} className={`sb-beat-card${b.highlight ? ' sb-beat-card--highlight' : ''}`}>
            <span className="sb-beat-num">{String(b.num).padStart(2, '0')}</span>
            <div className="sb-beat-body">
              <h4>{b.name}</h4>
              <p>{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="sb-callout" style={{ marginTop: '1.25rem' }}>
        <span className="sb-callout-icon">💡</span>
        <div>
          <strong>Interruption Pulses</strong>
          <p>Beats 4 and 7 can pulse multiple times in high-density episodes. This is intentional — Lala's life is busy.</p>
        </div>
      </div>

      <h3 className="sb-sub-heading">5 Episode Archetypes</h3>
      <div className="sb-archetype-grid">
        {ARCHETYPES.map((a) => (
          <div key={a.name} className="sb-archetype-card">
            <h4>{a.name}</h4>
            <p>{a.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Script Tag System (9 tags)</h3>
      <div className="sb-tag-grid">
        {SCRIPT_TAGS.map((t) => (
          <div key={t.tag} className="sb-tag-chip">
            <span className="sb-tag-name">{t.tag}</span>
            <p>{t.desc}</p>
            <span style={{ fontSize: '.72rem', color: t.status.startsWith('✅') ? '#6bba9a' : '#c05050', fontWeight: 600 }}>{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBrains() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Five interconnected AI layers that make the show feel alive. One script drives the entire production pipeline. All 5 brains must be consulted on every episode.
      </p>

      <div className="sb-callout">
        <span className="sb-callout-icon">🧠</span>
        <div>
          <strong>The Vision</strong>
          <p>Writer Brain suggests dialogue → Editor Brain determines screen state → Director Brain confirms arc alignment → Interaction Brain adjusts Lala's reaction → Producer Brain tracks economic impact.</p>
        </div>
      </div>

      <div className="sb-brain-stack">
        {FIVE_BRAINS.map((b) => (
          <div key={b.name} className="sb-brain-card" style={{ borderLeftColor: b.color }}>
            <div className="sb-brain-header">
              <span className="sb-brain-icon">{b.icon}</span>
              <h4 style={{ color: b.color }}>{b.name}</h4>
              <span style={{ fontSize: '.72rem', marginLeft: 'auto', fontWeight: 600, color: '#8a8a9a' }}>{b.status}</span>
            </div>
            <div className="sb-brain-row"><strong>Domain</strong><p>{b.domain}</p></div>
            <div className="sb-brain-row">
              <strong>Capabilities</strong>
              <ul style={{ margin: '.25rem 0 0', paddingLeft: '1.2rem' }}>
                {b.capabilities.map((c, i) => (
                  <li key={i} style={{ fontSize: '.85rem', lineHeight: '1.55', color: '#4a4a5a' }}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderScreens() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Every beat maps to exactly one Screen State. These control the entire visual production. Editor Brain assigns these. ADMIRATION reduces all UI.
      </p>

      <div className="sb-screen-stack">
        {SCREEN_STATES.map((s) => (
          <div key={s.name} className="sb-screen-card" style={{ borderLeftColor: s.color }}>
            <h4 style={{ color: s.color }}>{s.name}</h4>
            <p style={{ fontSize: '.88rem', lineHeight: '1.55', color: '#4a4a5a' }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderVisual() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        The show has a specific luxury visual aesthetic. Not negotiable. Must NEVER feel like a dashboard.
      </p>

      <h3 className="sb-sub-heading">Aesthetic Reference</h3>
      <div className="sb-callout">
        <span className="sb-callout-icon">🎨</span>
        <div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {AESTHETIC_REFERENCE.map((r, i) => <li key={i} style={{ fontSize: '.88rem', lineHeight: '1.65', color: '#6a4a5a' }}>{r}</li>)}
          </ul>
        </div>
      </div>

      <div className="sb-motion-grid">
        <div className="sb-motion-allowed">
          <h4>Allowed Motion</h4>
          <ul>{ALLOWED_MOTION.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
        <div className="sb-motion-banned">
          <h4>Banned Motion</h4>
          <ul>{BANNED_MOTION.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      </div>

      <div className="sb-music-card">
        <h4>Music Rules</h4>
        <ul>{MUSIC_RULES.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>

      <div className="sb-callout" style={{ marginTop: '1.25rem' }}>
        <span className="sb-callout-icon">⚠️</span>
        <div>
          <strong>Core Visual Rule</strong>
          <p>The show must NEVER feel like a dashboard. It must ALWAYS feel like a luxury life simulator. If a viewer thinks "this looks like a CMS", the design has failed.</p>
        </div>
      </div>
    </div>
  );
}

function renderSeason() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Season 1: Soft Luxury Ascension — Lala earns her place in the luxury tier. 24 episodes, 3 mini-arcs of 8. Dream: Become a Recognized Creator.
      </p>

      <div className="sb-callout">
        <span className="sb-callout-icon">🎯</span>
        <div>
          <strong>Healthy Failure Rhythm</strong>
          <p>Per 8-episode arc: 2 moderate setbacks, 1 real failure, 4 wins, 1 major win.</p>
        </div>
      </div>

      <div className="sb-arc-stack">
        {SEASON_ARCS.map((a) => (
          <div key={a.name} className="sb-arc-card" style={{ borderLeftColor: a.color }}>
            <div className="sb-arc-header">
              <span className="sb-arc-badge" style={{ background: a.color }}>EP {a.episodes}</span>
              <h4>{a.name}</h4>
            </div>
            <div className="sb-arc-row"><strong>Description</strong><p>{a.desc}</p></div>
            {a.graduated && (
              <div className="sb-arc-row">
                <strong>Graduated Intensity</strong>
                <ul style={{ margin: '.25rem 0 0', paddingLeft: '1.2rem' }}>
                  {a.graduated.map((g, i) => (
                    <li key={i} style={{ fontSize: '.85rem', lineHeight: '1.6', color: '#4a4a5a' }}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.keys && <div className="sb-arc-row"><strong>Key Moments</strong><p>{a.keys}</p></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderPlatform() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Same character, same stats, same arc — different lens across every platform. One show. Many worlds. Each platform gets purpose-built content — never repurposed cuts.
      </p>

      <div className="sb-platform-grid">
        {PLATFORMS.map((p) => (
          <div key={p.name} className="sb-platform-card">
            <div className="sb-platform-header">
              <span className="sb-platform-icon">{p.icon}</span>
              <h4>{p.name}</h4>
            </div>
            <div className="sb-platform-row"><p>{p.desc}</p></div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Content-to-Commerce Pipeline</h3>
      <div className="sb-callout">
        <span className="sb-callout-icon">💰</span>
        <div>
          <strong>Fiction → Business Engine</strong>
          <ol style={{ margin: '.4rem 0 0', paddingLeft: '1.4rem' }}>
            {COMMERCE_PIPELINE.map((step, i) => (
              <li key={i} style={{ fontSize: '.85rem', lineHeight: '1.65', color: '#6a4a5a' }}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <h3 className="sb-sub-heading">Future Systems — Queued But Not Built</h3>
      <div className="sb-future-grid">
        {FUTURE_SYSTEMS.map((f) => (
          <div key={f.name} className="sb-future-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.35rem' }}>
              <h4 style={{ margin: 0 }}>{f.name}</h4>
              <span style={{
                fontSize: '.68rem',
                fontWeight: 700,
                padding: '.15rem .5rem',
                borderRadius: '8px',
                color: '#fff',
                background: f.priority === 'HIGH' ? '#c05050' : f.priority === 'MEDIUM' ? '#c9a84c' : f.priority === 'LOW' ? '#6bba9a' : '#a889c8',
              }}>
                {f.priority}
              </span>
            </div>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCanon() {
  return (
    <div className="sb-section">
      <div className="sb-callout">
        <span className="sb-callout-icon">🔒</span>
        <div>
          <strong>Permanent and Non-Negotiable</strong>
          <p>These decisions are permanent. They cannot be changed without a formal deviation log entry. These are the show's constitution.</p>
        </div>
      </div>

      <div className="sb-canon-section sb-canon-character">
        <h3>Character Rules</h3>
        <ul className="sb-canon-list">
          {CANON_CHARACTER.map((r, i) => (
            <li key={i} className="sb-canon-item">
              <span className="sb-canon-lock">🔒</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="sb-canon-section sb-canon-world">
        <h3>World Rules</h3>
        <ul className="sb-canon-list">
          {CANON_WORLD.map((r, i) => (
            <li key={i} className="sb-canon-item">
              <span className="sb-canon-lock">🔒</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="sb-canon-section sb-canon-production">
        <h3>Production Rules</h3>
        <ul className="sb-canon-list">
          {CANON_PRODUCTION.map((r, i) => (
            <li key={i} className="sb-canon-item">
              <span className="sb-canon-lock">🔒</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const TAB_RENDERERS = {
  identity: renderIdentity,
  character: renderCharacter,
  sliders: renderSliders,
  worldlaws: renderWorldLaws,
  stats: renderStats,
  economy: renderEconomy,
  beats: renderBeats,
  brains: renderBrains,
  screens: renderScreens,
  visual: renderVisual,
  season: renderSeason,
  platform: renderPlatform,
  canon: renderCanon,
};

/* ─── PAGE COMPONENT ─── */

export default function ShowBrain() {
  const [activeTab, setActiveTab] = useState('identity');

  return (
    <div className="sb-page">
      <header className="sb-header">
        <h1>Show Brain</h1>
        <p className="sb-subtitle">Master Intelligence Document · v1.0 · Prime Studios — The single source of truth for Styling Adventures with Lala</p>
      </header>

      <nav className="sb-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`sb-tab ${activeTab === t.key ? 'sb-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="sb-content">
        {TAB_RENDERERS[activeTab]?.()}
      </main>
    </div>
  );
}
