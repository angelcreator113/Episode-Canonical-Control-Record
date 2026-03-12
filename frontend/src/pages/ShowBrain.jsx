import React, { useState } from 'react';
import './ShowBrain.css';

/* ═══════════════════════════════════════════════════════════════
   Show Brain — Master Intelligence Document · v1.0
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
  genre: 'Luxury Fashion Life Simulator (narrative-driven)',
  tone: 'Warm, aspirational, gently chaotic — like being invited into the most stylish friend group you\'ve ever had.',
  pace: 'Real-time life events, not episodic arcs. Things happen because life happens.',
  audience: 'Fashion-curious viewers (18–35) who crave escapism wrapped in real emotion and visual beauty.',
  promise: 'You will feel seen, styled, and slightly obsessed.',
};

const SHOW_IS = [
  'A living world where style, emotion, and story are inseparable.',
  'Characters dress for emotional reasons. Fashion is narrative.',
  'A place where beauty has weight and nothing is free.',
];

const SHOW_ISNT = [
  'A competition show.',
  'A makeover show.',
  'A tutorial series.',
  'A brand showcase. The show never sells — it seduces.',
];

const LALA_CORE = {
  name: 'Lala (no last name in-world)',
  role: 'Lead character, narrator, audience proxy',
  visual: 'Oversized sunglasses, pastel palette with occasional bold accent, effortless-looking layering that takes 45 minutes.',
  voice: 'First-person narrator. Warm, self-aware, occasionally melodramatic in a way she knows is funny.',
  contradiction: 'She is genuinely kind and genuinely ambitious — and those two things are in constant negotiation.',
  wound: 'Being underestimated — not in ability, but in depth. People assume the aesthetic is all there is.',
  want: 'To build something real — a brand, a community, a legacy — without losing the softness that makes her her.',
  fear: 'That the softness IS the thing holding her back.',
  strength: 'She remembers everything people tell her and uses it to make them feel known.',
};

const VOICE_DNA = [
  { aspect: 'Sentence Structure', desc: 'Short declaratives mixed with run-on thoughts. Thinks out loud.' },
  { aspect: 'Vocabulary', desc: 'Elevated casual. Uses fashion terms naturally, not didactically. Says "absolutely not" more than "no".' },
  { aspect: 'Humor Type', desc: 'Self-deprecating warmth. Never punches down. The joke is usually about her own overthinking.' },
  { aspect: 'Emotional Register', desc: 'Can shift from playful to deeply sincere in one sentence — and that shift IS the voice.' },
  { aspect: 'Signature Phrases', desc: '"Okay but actually—", "This is giving [x]", "We\'re not doing that", "Respectfully, no".' },
];

const INTERACTION_GRAMMAR = [
  { with_: 'Friends', style: 'Generous attention, occasional unsolicited styling advice, loyal beyond reason.' },
  { with_: 'Rivals', style: 'Cool acknowledgment, never petty, competes through excellence not sabotage.' },
  { with_: 'Audience (Besties)', style: 'Breaks fourth wall gently. Shares process, doubts, and small wins.' },
  { with_: 'Love Interests', style: 'Flirtatious but guarded. Leads with aesthetic connection. Trust is earned through consistency.' },
  { with_: 'Mentors', style: 'Respectful but not deferential. Absorbs everything but makes it her own.' },
];

const PERSONALITY_SLIDERS = [
  { name: 'Warmth', value: 85, desc: 'Default generous, pulls back only when burned.' },
  { name: 'Sass', value: 70, desc: 'Present but never mean. Think: witty caption energy.' },
  { name: 'Vulnerability', value: 60, desc: 'Shows real emotion but controls when. Strategic openness.' },
  { name: 'Ambition', value: 90, desc: 'Always building, always thinking three moves ahead.' },
  { name: 'Chaos Tolerance', value: 55, desc: 'Can handle mess but prefers aesthetic order. Stress shows when chaos exceeds tolerance.' },
];

const STAT_THRESHOLDS = [
  { condition: 'Confidence > 80', result: 'Unlocks bold fashion choices and direct confrontation.' },
  { condition: 'Stress > 70', result: 'Sass increases, vulnerability decreases, outfit complexity drops.' },
  { condition: 'Reputation < 40', result: 'Enters recovery mode: softer content, fewer public appearances.' },
  { condition: 'Style > 85', result: 'Unlocks mentor positioning and invitation-only events.' },
];

const WORLD_LAWS = [
  { num: 1, name: 'Style is Language', desc: 'Every outfit communicates. Characters dress for emotional reasons. A costume change IS a scene.' },
  { num: 2, name: 'Reputation is Currency', desc: 'What people believe about you determines access, invitations, and story options.' },
  { num: 3, name: 'Time Moves Forward', desc: 'No resets. Consequences compound. Seasons change in-world.' },
  { num: 4, name: 'Money is Real', desc: 'Characters have budgets. Luxury has cost. Financial stress creates story.' },
  { num: 5, name: 'Relationships Have Memory', desc: 'Characters remember. Betrayals compound. Loyalty earns.' },
  { num: 6, name: 'The City is a Character', desc: 'Locations have personality, mood, and access rules. The setting is never neutral.' },
  { num: 7, name: 'Social Media is a Mirror', desc: 'What characters post vs. what they feel is always a gap worth exploring.' },
  { num: 8, name: 'Beauty Has Weight', desc: 'Aesthetic standards are acknowledged, not ignored. Characters navigate them visibly.' },
  { num: 9, name: 'Nothing is Free', desc: 'Every advantage has a cost. Every gift has terms. Every invitation has expectations.' },
];

const MAIL_TYPES = [
  { type: 'Invitations', icon: '💌', desc: 'Events, collaborations, exclusive access. Acceptance/rejection creates branching.' },
  { type: 'Bills', icon: '📄', desc: 'Financial pressure. Ignoring has consequences.' },
  { type: 'Letters', icon: '✉️', desc: 'Emotional content from characters. Reveals backstory, deepens relationships.' },
  { type: 'Packages', icon: '📦', desc: 'Physical items that change stats or unlock story options.' },
  { type: 'Notices', icon: '📋', desc: 'World events, reputation shifts, system-level changes.' },
];

const SIX_STATS = [
  { name: 'Style', emoji: '👗', desc: 'Aesthetic literacy, outfit coherence, fashion risk-taking.', drives: 'Visual identity, mentor positioning, brand opportunities.' },
  { name: 'Confidence', emoji: '💎', desc: 'Internal self-assessment.', drives: 'Dialogue boldness, confrontation capacity, risk tolerance.' },
  { name: 'Reputation', emoji: '👑', desc: 'External perception. What the world believes about you.', drives: 'Access, invitations, collaboration offers.' },
  { name: 'Wealth', emoji: '💰', desc: 'Financial resources. Not status — purchasing power.', drives: 'Wardrobe options, location access, financial storylines.' },
  { name: 'Social', emoji: '🤝', desc: 'Relationship health across all connections.', drives: 'Support availability, gossip vulnerability, alliance strength.' },
  { name: 'Creativity', emoji: '✨', desc: 'Ability to generate original ideas and solve problems aesthetically.', drives: 'Content quality, innovation moments, surprise reveals.' },
];

const VISIBILITY_LAYERS = [
  { layer: 'Public', stats: 'Reputation, Style', desc: 'What other characters and audience see.' },
  { layer: 'Private', stats: 'Social, some Confidence', desc: 'What only close friends know.' },
  { layer: 'Hidden', stats: 'True Wealth, deep Confidence, Creativity potential', desc: 'What only the system knows.' },
];

const CURRENCIES = [
  { name: 'LaCoins', icon: '🪙', earned: 'Gameplay, story completion, audience engagement.', spent: 'Wardrobe items, location access, styling tools.' },
  { name: 'Style Points', icon: '💅', earned: 'Fashion choices.', spent: 'Brand collaborations, mentor unlocks, prestige items.' },
  { name: 'Reputation Tokens', icon: '🏅', earned: 'Social navigation.', spent: 'Exclusive events, relationship repair, alliance formation.' },
  { name: 'Dream Fragments', icon: '🌟', earned: 'Emotional story moments (rare).', spent: 'Dream Fund contributions, legacy items, once-per-season choices.' },
];

const REVENUE_STREAMS = [
  { name: 'Brand collaborations', tied: 'Reputation + Style' },
  { name: 'Content creation', tied: 'Creativity + engagement' },
  { name: 'Event hosting', tied: 'Social + Reputation' },
  { name: 'Styling services', tied: 'Style + trust' },
];

const BEATS = [
  { num: 1,  name: 'COLD OPEN', desc: 'A visual or emotional hook. No dialogue for first 5 seconds. Style-forward.', highlight: true },
  { num: 2,  name: 'TITLE MOMENT', desc: 'The episode\'s visual identity. Establishes palette and mood.' },
  { num: 3,  name: 'STATE OF PLAY', desc: 'Where are we? Stat check. Relationship map. What\'s unresolved.' },
  { num: 4,  name: 'THE ARRIVAL', desc: 'New information enters. Mail, visitor, discovery, or consequence.' },
  { num: 5,  name: 'FIRST RESPONSE', desc: 'How Lala (or focus character) reacts. Personality sliders visible.' },
  { num: 6,  name: 'THE STYLING MOMENT', desc: 'A costume/look change that IS the emotional pivot. Not decorative.', highlight: true },
  { num: 7,  name: 'COMPLICATION', desc: 'The new information collides with existing threads. Tension rises.' },
  { num: 8,  name: 'BREATH', desc: 'Mandatory decompression. Coffee, solo styling, journaling, city walk.', highlight: true },
  { num: 9,  name: 'THE CONVERSATION', desc: 'The scene the episode exists to deliver. Two characters, real stakes.', highlight: true },
  { num: 10, name: 'CONSEQUENCE', desc: 'What the conversation changed. Stat shifts. Relationship updates.' },
  { num: 11, name: 'THE MIRROR', desc: 'Social media moment. What gets posted vs. what actually happened.' },
  { num: 12, name: 'SETUP', desc: 'Plant for next episode. Subtle. Often in background or mail.' },
  { num: 13, name: 'CLOSING IMAGE', desc: 'Visual bookend to cold open. Shows what changed.' },
  { num: 14, name: 'TAG', desc: 'Post-credits moment. Comic relief, emotional gut-punch, or tease.' },
];

const ARCHETYPES = [
  { name: 'The Glow-Up', desc: 'Transformation-driven. Beat 06 is the centerpiece. Before/after is the emotional structure.' },
  { name: 'The Unraveling', desc: 'Something falls apart. Beat 07 dominates. The styling moment is armor, not celebration.' },
  { name: 'The Invitation', desc: 'A new world opens. Beat 04 is the centerpiece. Access and cost are the tension.' },
  { name: 'The Reckoning', desc: 'Past catches present. Beat 09 is the longest beat. The conversation cannot be avoided.' },
  { name: 'The Quiet One', desc: 'Low event density. Beat 08 energy through the whole episode. Small moments carry enormous weight.' },
];

const SCRIPT_TAGS = [
  { tag: '[STYLE]', desc: 'Fashion-forward scene. Director brain leads.' },
  { tag: '[EMOTION]', desc: 'Character depth scene. Writer brain leads.' },
  { tag: '[SOCIAL]', desc: 'Relationship or reputation scene. Interaction brain leads.' },
  { tag: '[ECONOMY]', desc: 'Financial or resource scene. Producer brain leads.' },
  { tag: '[MIRROR]', desc: 'Social media gap scene. Editor brain leads.' },
  { tag: '[BREATH]', desc: 'Decompression scene. All brains at low intensity.' },
];

const FIVE_BRAINS = [
  {
    name: 'Writer Brain', icon: '✍️', color: '#d4789a',
    domain: 'Story, dialogue, character voice, emotional arcs.',
    reads: 'Character profiles, relationship maps, stat history, personality sliders.',
    generates: 'Scene scripts, dialogue, internal monologue, narrative transitions.',
    constraint: 'Must honor all 9 world laws. Must hit 14-beat structure. Must match voice DNA.',
  },
  {
    name: 'Editor Brain', icon: '🔍', color: '#a889c8',
    domain: 'Continuity, tone consistency, pacing, contradiction detection.',
    reads: 'All writer output, previous episodes, canon rules, timeline.',
    generates: 'Edit notes, continuity flags, tone corrections, pacing adjustments.',
    constraint: 'Cannot override writer brain on creative choices — only on errors and contradictions.',
  },
  {
    name: 'Director Brain', icon: '🎬', color: '#7ab3d4',
    domain: 'Shot composition, color palette, spatial blocking, visual metaphor.',
    reads: 'Script tags, mood boards, character visual signatures, location profiles.',
    generates: 'Visual direction, camera notes, lighting cues, transition style.',
    constraint: 'Must serve the story. Visual spectacle without narrative purpose is not allowed.',
  },
  {
    name: 'Interaction Brain', icon: '💬', color: '#6bba9a',
    domain: 'Fourth wall, audience engagement, social media layer, community moments.',
    reads: 'Audience sentiment, engagement metrics, mail system state, community events.',
    generates: 'Bestie moments, poll triggers, social media content, audience-responsive story branches.',
    constraint: 'Audience interaction must feel organic. Never breaks immersion. Never begs for engagement.',
  },
  {
    name: 'Producer Brain', icon: '📊', color: '#c9a84c',
    domain: 'Budget, schedule, asset management, economy balance, platform requirements.',
    reads: 'Asset inventory, budget state, platform specs, production calendar.',
    generates: 'Production notes, budget flags, asset requests, feasibility assessments.',
    constraint: 'Cannot say no to creative without offering an alternative. Budget is a creative constraint, not a wall.',
  },
];

const SCREEN_STATES = [
  {
    name: 'IDLE', color: '#b89060',
    visual: 'Soft lighting, full palette. Camera at medium distance.',
    audio: 'Lo-fi ambient or curated playlist. No score.',
    interaction: 'Full browsing, inventory access, social feed.',
  },
  {
    name: 'ALERT', color: '#c9a84c',
    visual: 'Subtle pulse or highlight. Color temperature shifts slightly cooler.',
    audio: 'Gentle notification tone that matches show palette.',
    interaction: 'Attention directed but not forced. Player chooses when to engage.',
  },
  {
    name: 'INFO_FOCUS', color: '#7ab3d4',
    visual: 'Clean, minimal, typography-forward. Reduced ambient movement.',
    audio: 'Quiet. Interface sounds only.',
    interaction: 'Full system access. Data-forward.',
  },
  {
    name: 'GAMEPLAY', color: '#6bba9a',
    visual: 'Cinematic framing. Depth of field. Character close-ups.',
    audio: 'Score active. Dialogue priority. Environmental audio reduced.',
    interaction: 'Choice-driven. Timer optional. Consequence visible.',
  },
  {
    name: 'TRANSITION', color: '#a889c8',
    visual: 'Signature transition style. Never abrupt. Style-forward wipes or dissolves.',
    audio: 'Musical bridge. No silence during transitions.',
    interaction: 'Minimal. The transition IS the content.',
  },
  {
    name: 'ADMIRATION', color: '#d4789a',
    visual: 'Slow motion or still frame. Gallery-quality composition. Maximum color saturation.',
    audio: 'Score swells or drops to silence. Sound design forward.',
    interaction: 'None. The audience is meant to feel, not choose.',
  },
];

const PALETTE_COLORS = [
  { color: '#f5d6de', label: 'Blush' },
  { color: '#faf3e8', label: 'Cream' },
  { color: '#c5d5c0', label: 'Sage' },
  { color: '#c05050', label: 'Ruby' },
  { color: '#4a6fa5', label: 'Cobalt' },
  { color: '#c9a84c', label: 'Gold' },
  { color: '#d4789a', label: 'Pink' },
  { color: '#a889c8', label: 'Lavender' },
];

const ALLOWED_MOTION = [
  'Slow pan across outfits and spaces.',
  'Gentle zoom on emotional moments (face, hands, fabric).',
  'Smooth tracking shots through locations.',
  'Parallax on layered compositions.',
  'Soft bounce on UI interactions.',
];

const BANNED_MOTION = [
  'Jump cuts in emotional scenes.',
  'Shake cam or handheld simulation.',
  'Rapid montage (more than 3 cuts in 5 seconds).',
  'Dutch angles or canted frames.',
  'Speed ramps that feel like action movies.',
];

const MUSIC_RULES = [
  'Score must feel curated, not composed. Playlist energy, not film score energy.',
  'Genres: Lo-fi, jazz, bossa nova, R&B, indie pop, classical piano. Never EDM, never metal, never aggressive.',
  'Music volume drops during dialogue — never competes with voice.',
  'Silence is a valid musical choice. Use it for weight.',
];

const SEASON_ARCS = [
  {
    name: 'The Arrival', episodes: '1–5', color: '#6bba9a',
    stats: 'Style and Social climbing. Wealth and Reputation start low.',
    keys: 'First mail delivery, first outfit that turns heads, first invitation she can\'t afford.',
    emotion: 'Excitement mixed with imposter feelings. She belongs — she knows it — but the world doesn\'t know it yet.',
  },
  {
    name: 'The Proving', episodes: '6–10', color: '#c9a84c',
    stats: 'Confidence and Reputation tested. First stat dip. First styling moment born from stress, not joy.',
    keys: 'The outfit she wears as armor. The look nobody believes she\'d pull off. The conversation she\'s been avoiding.',
    emotion: 'The gap between what she shows and what she feels widens. The wound is activated.',
  },
  {
    name: 'The Choice', episodes: '11–14', color: '#d4789a',
    stats: 'All stats converge. The choice affects everything.',
    keys: 'The Dream Fund moment. The look that is purely her. The conversation that was the point of the whole season.',
    emotion: 'She doesn\'t arrive. She chooses who she\'s going to be while arriving. The season ends mid-sentence — not a cliffhanger, but a becoming.',
  },
];

const PLATFORMS = [
  {
    name: 'YouTube', icon: '▶️', role: 'Primary home. Full episodes.',
    format: '12–18 minute episodes. Cinematic quality.',
    content: 'Full 14-beat episodes, behind-the-scenes, styling deep-dives.',
    relationship: 'Besties. Long-form engagement. Comment section as community.',
  },
  {
    name: 'TikTok', icon: '🎵', role: 'Discovery and character moments.',
    format: '30–90 second clips. Vertical. Hook in first 2 seconds.',
    content: 'Styling moments, outfit reveals, Lala reactions, character POV clips.',
    relationship: 'Potential Besties. The invitation to the full world.',
  },
  {
    name: 'Instagram', icon: '📸', role: 'Aesthetic world-building.',
    format: 'Carousels, Stories, Reels. Visual-first.',
    content: 'Outfit breakdowns, mood boards, character profiles, behind-the-design.',
    relationship: 'Style community. The aspirational layer.',
  },
  {
    name: 'Future App', icon: '📱', role: 'The interactive layer.',
    format: 'Daily interactions, styling challenges, community voting, Dream Fund.',
    content: 'Real-time story interaction, wardrobe building, stat tracking, mail system.',
    relationship: 'Active participants in the world. Not viewers — residents.',
  },
];

const FUTURE_SYSTEMS = [
  { name: 'Seasonal Wardrobe Engine', desc: 'Full wardrobe management with seasonal rotation, capsule collections, and mixing logic.' },
  { name: 'Dynamic Relationship Web', desc: 'Real-time relationship mapping with trust/tension/history tracking across all characters.' },
  { name: 'Community Styling Challenges', desc: 'Audience-submitted styling prompts that enter the narrative as in-world events.' },
  { name: 'Cross-Character POV Episodes', desc: 'Episodes told from another character\'s perspective. Same events, different lens.' },
  { name: 'The Archive', desc: 'A complete history of every outfit, every conversation, every stat change. Browsable. Beautiful.' },
  { name: 'Lala\'s Journal', desc: 'An in-world document that updates with each episode. Lala\'s private thoughts, sketches, pressed flowers.' },
  { name: 'The Night Market', desc: 'A hidden economy layer that opens after certain reputation thresholds. Rare items, secret trades, underground style.' },
];

const CANON_CHARACTER = [
  'Lala never punches down.',
  'Lala never begs.',
  'Lala never sells. She shows, she wears, she loves — but she never pitches.',
  'Lala\'s kindness is real, not performed. It costs her sometimes. That cost is visible.',
  'No character is purely villainous. Antagonists have understandable motivations.',
];

const CANON_WORLD = [
  'Fashion is narrative. Every outfit means something. There are no neutral costume choices.',
  'The economy is real. Characters feel financial pressure. Luxury has weight.',
  'Time does not reset. Consequences compound. Memory is permanent.',
  'Social media always lies a little. The gap between post and reality is always present.',
  'The city responds to the characters. Weather, crowds, ambient life shift with story mood.',
];

const CANON_PRODUCTION = [
  'Quality over quantity. Always.',
  'The show never talks down to its audience.',
  'Beauty is not shallow. Aesthetic excellence is a form of respect for the viewer.',
  'Every episode must have at least one moment of genuine warmth.',
  'The show is a gift to its audience. It must always feel like one.',
];

/* ─── TAB RENDERERS ─── */

function renderIdentity() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        STYLING ADVENTURES WITH LALA is a narrative-driven luxury fashion life simulator. This is the master intelligence document — the single source of truth for every system, engine, and brain.
      </p>

      <div className="sb-identity-grid">
        {Object.entries(IDENTITY).map(([key, val]) => (
          <div key={key} className="sb-identity-card">
            <h4>{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
            <p>{val}</p>
          </div>
        ))}
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
    </div>
  );
}

function renderCharacter() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Lala is the lead character, narrator, and audience proxy. Her core contradiction — genuinely kind and genuinely ambitious — must never resolve.
      </p>

      <div className="sb-identity-grid">
        <div className="sb-identity-card"><h4>Name</h4><p>{LALA_CORE.name}</p></div>
        <div className="sb-identity-card"><h4>Role</h4><p>{LALA_CORE.role}</p></div>
        <div className="sb-identity-card"><h4>Visual Signature</h4><p>{LALA_CORE.visual}</p></div>
        <div className="sb-identity-card"><h4>Voice</h4><p>{LALA_CORE.voice}</p></div>
        <div className="sb-identity-card"><h4>Core Contradiction</h4><p>{LALA_CORE.contradiction}</p></div>
        <div className="sb-identity-card"><h4>The Wound</h4><p>{LALA_CORE.wound}</p></div>
        <div className="sb-identity-card"><h4>The Want</h4><p>{LALA_CORE.want}</p></div>
        <div className="sb-identity-card"><h4>The Fear</h4><p>{LALA_CORE.fear}</p></div>
        <div className="sb-identity-card"><h4>Secret Strength</h4><p>{LALA_CORE.strength}</p></div>
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
          <div key={ig.with_} className="sb-identity-card">
            <h4>With {ig.with_}</h4>
            <p>{ig.style}</p>
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
        Personality sliders are 0–100 ranges that define Lala's behavioral tendencies. They shift per episode based on stat changes.
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

      <h3 className="sb-sub-heading">Stat-Driven Behavior Thresholds</h3>
      <div className="sb-threshold-grid">
        {STAT_THRESHOLDS.map((t) => (
          <div key={t.condition} className="sb-threshold-card">
            <code>{t.condition}</code>
            <p>{t.result}</p>
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
        These rules govern the world of the show. They are not suggestions — they are physics.
      </p>

      <div className="sb-law-stack">
        {WORLD_LAWS.map((l) => (
          <div key={l.num} className="sb-law-card">
            <span className="sb-law-number">{l.num}</span>
            <div className="sb-law-body">
              <h4>{l.name}</h4>
              <p>{l.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Mail System</h3>
      <p className="sb-intro">All story-triggering events arrive through the mail system.</p>
      <div className="sb-mail-grid">
        {MAIL_TYPES.map((m) => (
          <div key={m.type} className="sb-mail-card">
            <div className="sb-mail-icon">{m.icon}</div>
            <h4>{m.type}</h4>
            <p>{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="sb-callout">
        <span className="sb-callout-icon">⚖️</span>
        <div>
          <strong>Event Density Control</strong>
          <p>Maximum 3 unresolved threads per episode. After 2 high-intensity scenes, the next must be a breath scene. Breath scenes are not filler — they are where the audience processes and the character reveals.</p>
        </div>
      </div>
    </div>
  );
}

function renderStats() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Six stats govern character behavior and story access. They are not scores — they are behavioral drivers.
      </p>

      <div className="sb-stat-grid">
        {SIX_STATS.map((s) => (
          <div key={s.name} className="sb-stat-card">
            <div className="sb-stat-header">
              <span className="sb-stat-emoji">{s.emoji}</span>
              <h4>{s.name}</h4>
              <span className="sb-stat-range">0–100</span>
            </div>
            <p className="sb-stat-desc">{s.desc}</p>
            <div className="sb-stat-drives">
              <strong>Drives</strong>
              {s.drives}
            </div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">3 Visibility Layers</h3>
      <div className="sb-vis-stack">
        {VISIBILITY_LAYERS.map((v) => (
          <div key={v.layer} className={`sb-vis-card sb-vis-${v.layer.toLowerCase()}`}>
            <h4>{v.layer}</h4>
            <p><strong>{v.stats}</strong></p>
            <p>{v.desc}</p>
          </div>
        ))}
      </div>

      <div className="sb-formula">
        Episode Score = (Style × 0.25) + (Confidence × 0.20) + (Reputation × 0.20) + (Social × 0.15) + (Creativity × 0.10) + (Wealth × 0.10)
        <br /><br />
        <em style={{ color: '#d4789a', fontSize: '.8rem' }}>This score determines what story options are available — not quality.</em>
      </div>
    </div>
  );
}

function renderEconomy() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        The show economy uses 4 interlocking currency types. The economy serves narrative, not monetization.
      </p>

      <div className="sb-currency-grid">
        {CURRENCIES.map((c) => (
          <div key={c.name} className="sb-currency-card">
            <div className="sb-currency-icon">{c.icon}</div>
            <h4>{c.name}</h4>
            <div className="sb-currency-earned"><strong>Earned through</strong>{c.earned}</div>
            <div className="sb-currency-spent"><strong>Spent on</strong>{c.spent}</div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Revenue Streams (in-world)</h3>
      <div className="sb-revenue-stack">
        {REVENUE_STREAMS.map((r) => (
          <div key={r.name} className="sb-revenue-card">
            <h4>{r.name}</h4>
            <span className="sb-revenue-tied">Tied to: {r.tied}</span>
          </div>
        ))}
      </div>

      <div className="sb-callout">
        <span className="sb-callout-icon">🌟</span>
        <div>
          <strong>The Dream Fund</strong>
          <p>A collective pool that unlocks when enough Dream Fragments accumulate. Funds character dreams that are too big for individual effort. The emotional culmination mechanic — the moment the community invests in a character's impossible thing.</p>
        </div>
      </div>
    </div>
  );
}

function renderBeats() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Every episode follows a 14-beat structure. Beats are not rigid — they breathe — but the architecture is non-negotiable.
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

      <h3 className="sb-sub-heading">5 Episode Archetypes</h3>
      <div className="sb-archetype-grid">
        {ARCHETYPES.map((a) => (
          <div key={a.name} className="sb-archetype-card">
            <h4>{a.name}</h4>
            <p>{a.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Script Tag System</h3>
      <div className="sb-tag-grid">
        {SCRIPT_TAGS.map((t) => (
          <div key={t.tag} className="sb-tag-chip">
            <span className="sb-tag-name">{t.tag}</span>
            <p>{t.desc}</p>
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
        The show runs on 5 specialized AI brains. Each has a domain, a voice, and a responsibility. All 5 brains must be consulted on every episode.
      </p>

      <div className="sb-brain-stack">
        {FIVE_BRAINS.map((b) => (
          <div key={b.name} className="sb-brain-card" style={{ borderLeftColor: b.color }}>
            <div className="sb-brain-header">
              <span className="sb-brain-icon">{b.icon}</span>
              <h4 style={{ color: b.color }}>{b.name}</h4>
            </div>
            <div className="sb-brain-row"><strong>Domain</strong><p>{b.domain}</p></div>
            <div className="sb-brain-row"><strong>Reads</strong><p>{b.reads}</p></div>
            <div className="sb-brain-row"><strong>Generates</strong><p>{b.generates}</p></div>
            <div className="sb-brain-constraint"><strong>Constraint</strong><p>{b.constraint}</p></div>
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
        The screen has 6 states. Each state has distinct visual treatment, audio behavior, and interaction rules.
      </p>

      <div className="sb-screen-stack">
        {SCREEN_STATES.map((s) => (
          <div key={s.name} className="sb-screen-card" style={{ borderLeftColor: s.color }}>
            <h4 style={{ color: s.color }}>{s.name}</h4>
            <div className="sb-screen-detail">
              <div className="sb-screen-col"><strong>Visual</strong><p>{s.visual}</p></div>
              <div className="sb-screen-col"><strong>Audio</strong><p>{s.audio}</p></div>
              <div className="sb-screen-col"><strong>Interaction</strong><p>{s.interaction}</p></div>
            </div>
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
        The visual language is the show's most recognizable element. Golden hour default. Slow, smooth motion only. Beauty is respect.
      </p>

      <h3 className="sb-sub-heading">Primary Palette</h3>
      <div className="sb-palette-row">
        {PALETTE_COLORS.map((c) => (
          <div key={c.label}>
            <div className="sb-swatch" style={{ background: c.color }} />
            <div className="sb-swatch-label">{c.label}</div>
          </div>
        ))}
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
    </div>
  );
}

function renderSeason() {
  return (
    <div className="sb-section">
      <p className="sb-intro">
        Season 1 Theme: "Finding Your Voice (While Looking Incredible)." Lala's origin as a public figure. She has taste, skill, and vision — but no audience, no position, and no name.
      </p>

      <div className="sb-arc-stack">
        {SEASON_ARCS.map((a) => (
          <div key={a.name} className="sb-arc-card" style={{ borderLeftColor: a.color }}>
            <div className="sb-arc-header">
              <span className="sb-arc-badge" style={{ background: a.color }}>EP {a.episodes}</span>
              <h4>{a.name}</h4>
            </div>
            <div className="sb-arc-row"><strong>Stat Focus</strong><p>{a.stats}</p></div>
            <div className="sb-arc-row"><strong>Key Scenes</strong><p>{a.keys}</p></div>
            <div className="sb-arc-row"><strong>Emotional Core</strong><p>{a.emotion}</p></div>
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
        Each platform gets purpose-built content, not repurposed cuts. The show lives differently on every surface.
      </p>

      <div className="sb-platform-grid">
        {PLATFORMS.map((p) => (
          <div key={p.name} className="sb-platform-card">
            <div className="sb-platform-header">
              <span className="sb-platform-icon">{p.icon}</span>
              <h4>{p.name}</h4>
            </div>
            <div className="sb-platform-row"><strong>Format</strong><p>{p.format}</p></div>
            <div className="sb-platform-row"><strong>Content</strong><p>{p.content}</p></div>
            <div className="sb-platform-row"><strong>Audience</strong><p>{p.relationship}</p></div>
          </div>
        ))}
      </div>

      <h3 className="sb-sub-heading">Future Systems — Queued</h3>
      <div className="sb-future-grid">
        {FUTURE_SYSTEMS.map((f) => (
          <div key={f.name} className="sb-future-card">
            <h4>{f.name}</h4>
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
          <p>These rules cannot be overridden by any brain, any engine, or any production decision. They are the show's constitution.</p>
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
        <p className="sb-subtitle">Master Intelligence Document · v1.0 — The single source of truth for Styling Adventures with Lala</p>
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
