import React, { useState } from 'react';
import './CharacterDepthEngine.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';

/* ═══════════════════════════════════════════════════════════════
   The Character Depth Engine — Doc 09 · v1.0
   11 tabs · Steel accent (#7ab3d4) · .cde-* CSS prefix
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'body',        label: 'Body' },
  { key: 'money',       label: 'Money' },
  { key: 'time',        label: 'Time' },
  { key: 'luck',        label: 'Luck & Circumstance' },
  { key: 'narrative',   label: 'Self vs. Actual' },
  { key: 'blindspot',   label: 'Blind Spot' },
  { key: 'change',      label: 'Change Capacity' },
  { key: 'cosmology',   label: 'Cosmology' },
  { key: 'foreclosed',  label: 'Foreclosed' },
  { key: 'joy',         label: 'Joy' },
  { key: 'architecture', label: 'Architecture' },
];

/* ─── DATA ─── */

const BODY_FIELDS = [
  { field: 'body_relationship', captures: 'Fundamental orientation toward their physical self — owned, weaponized, hidden, performed, disciplined, currency, site of shame, site of power', generates: 'Determines how they move through scenes, what they notice, what they hide, how others perceive them before they speak', example: 'JustAWoman: body as art, fully owned, no apology — she would post naked not for approval but because she considers herself a masterpiece' },
  { field: 'body_history', captures: 'What has happened to this body that shaped the relationship — illness, pregnancy, injury, physical discipline, transformation, violation', generates: 'The history generates specific triggers and specific strengths. A body that survived something carries that survival.', example: 'The creator who built her career on physical transformation — her body is both her credential and her most pressured space' },
  { field: 'body_currency', captures: 'Whether and how the character uses physical appearance as economic or social capital — consciously or not', generates: 'Intersects with pay-for-attention, brand deals, audience relationship, and what happens when the currency depreciates', example: 'High: the character whose body is her most visible product. Low: the creator who deliberately keeps her body out of the frame.' },
  { field: 'body_control_pattern', captures: 'How the character uses physical discipline, deprivation, or indulgence as a response to stress or emotional overwhelm', generates: 'The eating change when anxious. The training regime that becomes punishing during crisis. The indulgence that signals she\'s stopped fighting.', example: 'The character who stops eating when a deal falls through. The one who overeats when lonely. The one who runs until her body forces her to stop.' },
];

const MONEY_PATTERNS = [
  { pattern: 'Hoarder', looks: 'Accumulates and rarely spends — money as safety. Feels physically anxious when resources leave.', wound: 'Scarcity wound — real or inherited. The poverty they survived or the poverty their parents survived.', story: 'The character who has enough but cannot feel it. The partner who can\'t spend on joy because the hoarding is load-bearing anxiety.', icon: '🏦' },
  { pattern: 'Compulsive giver', looks: 'Gives money away before it can be taken — generosity as armor. Cannot receive without discomfort.', wound: 'Guilt wound — about having more, about being loved, about surviving something others didn\'t.', story: 'The creator who supports everyone around her and never lets anyone support her. The one who dies for your career.', icon: '🎁' },
  { pattern: 'Spends to feel powerful', looks: 'Large purchases, visible spending, money as performance of status', wound: 'Powerlessness wound — usually class wound. The purchase proves something that the wound says is still in question.', story: 'The deal she took that she shouldn\'t have because she needed to prove she was worth that number.', icon: '👑' },
  { pattern: 'Deprives out of guilt', looks: 'Refuses to enjoy money even when present — punishing self with scarcity while resources exist', wound: 'Unworthiness wound. The belief, usually unconscious, that abundance is not for her specifically.', story: 'The creator who makes real money and still lives like she doesn\'t. The gap nobody can explain from the outside.', icon: '🔒' },
  { pattern: 'Uses money to control', looks: 'Financial generosity as leverage — giving to create obligation, withholding to punish', wound: 'Control wound — fear of loss expressed as financial management of other people', story: 'The mentor whose financial support has strings. The partner who pays for everything and calls it love.', icon: '🎯' },
  { pattern: 'Performs wealth', looks: 'Spends to maintain the appearance of more than exists — the lifestyle the income doesn\'t support', wound: 'Belonging wound — the need to appear to be in the room she isn\'t quite in yet.', story: 'The brand deal she took to afford the aesthetic her audience expects. The debt nobody knows about.', icon: '✨' },
];

const TIME_ORIENTATIONS = [
  { orientation: 'Past-anchored', experience: 'Constantly referencing who they were — the past is more real than the present. Memory as home.', shapes: 'Slow to change, loyal to old decisions, haunted by what was. The wound lives in the past and the past lives in them.', story: 'The character who cannot stop telling the story of the thing that happened. The story has become her identity. Changing would mean losing the story.', color: '#a889c8' },
  { orientation: 'Future-focused', experience: 'Living in the version of themselves they\'re building — the present is an obstacle course toward arrival', shapes: 'High ambition, low presence, relationships suffer because she is always partly elsewhere', story: 'The creator who is building toward legendary and cannot fully inhabit her current life. Everything is preparation.', color: '#7ab3d4' },
  { orientation: 'Present-impulsive', experience: 'The present moment is the only real thing — consequences are abstract, tomorrow is not guaranteed', shapes: 'Fast decisions, high-energy relationships, creative acceleration, difficulty with long-term planning', story: 'The creator who goes viral every six months and starts over every year. Perpetual beginning energy. Is the impulsivity freedom or avoidance?', color: '#c9a84c' },
  { orientation: 'Suspended', experience: 'Waiting — for the right moment, the right circumstances, the permission they haven\'t been given yet', shapes: 'Slow to act, thorough, often correct about what the moment needs but misses the window', story: 'The creator who has been ready for years. The system prompt she never sent. The collaboration she never pitched. The book she hasn\'t started.', color: '#8a8a9a' },
  { orientation: 'Cyclical', experience: 'Experiences time as seasons — recurring patterns, anniversaries as pressure points, the same lesson returning', shapes: 'Responds differently to the same trigger at different points in the cycle — sometimes ready, sometimes not', story: 'The character who keeps being in the same situation with different people. She thinks the problem is the people.', color: '#6bba9a' },
];

const LUCK_FIELDS = [
  { field: 'circumstance_advantages', captures: 'The unchosen advantages — access, timing, proximity to the right people at the right moment that the character did not earn', generates: 'What the character attributes to themselves that was actually luck. And whether they know it.' },
  { field: 'circumstance_disadvantages', captures: 'The unchosen obstacles — systems working against them, timing that cost them, doors closed before they arrived', generates: 'What the character has overcome that is not fully acknowledged by the world that watches her succeed.' },
  { field: 'luck_belief', captures: 'The operative belief: Random (nothing means anything) · Rigged (systems favor some) · Divinely ordered (everything for a reason) · Responsive (effort determines outcome) · Chaotic (all chance, but you can position)', generates: 'Drives ambition, faith, how she treats those with less, and whether she believes her success is secure or fragile.' },
  { field: 'luck_belief_vs_stated_belief', captures: 'Whether the operative luck belief matches the stated worldview', generates: 'The gap is where the character\'s most interesting contradictions live. She says everything happens for a reason. She acts like nothing is safe.' },
];

const NARRATIVE_FIELDS = [
  { field: 'self_narrative', contains: 'The story the character tells herself about who she is and why — origin story, turning points, villains, justifications', sees: 'The character. The story engine for first-person voice and internal monologue.', function_: 'The story is partially wrong. Which parts are wrong is the architecture of her blind spot.' },
  { field: 'actual_narrative', contains: 'The story the system knows — what actually happened, who was responsible, the real turning point, the real wound', sees: 'The author. The story engine for third-person narration and character revelation.', function_: 'Not necessarily kinder than the self-narrative. Sometimes the truth is harder. She was the villain in ways she doesn\'t know yet.' },
  { field: 'narrative_gap_type', contains: 'The specific flavor of distortion', sees: 'Author knowledge — drives arc direction. The gap closes or widens based on events.', function_: 'Shapes the revelation the story is building toward.' },
];

const GAP_TYPES = [
  { type: 'villain_misidentified', desc: 'She blames the wrong person for the wound' },
  { type: 'hero_exaggerated', desc: 'She credits herself too much for the outcome' },
  { type: 'wound_mislocated', desc: 'She thinks the wound is about one thing; it\'s about another' },
  { type: 'cause_reversed', desc: 'She has the cause and effect backwards' },
  { type: 'timeline_collapsed', desc: 'She compressed events; the truth was more gradual or sudden' },
  { type: 'significance_inverted', desc: 'The big moment she cites wasn\'t the real pivot — the small one was' },
];

const BLINDSPOT_CATEGORIES = [
  { cat: 'self_assessment', desc: 'Wrong about her own qualities', example: 'She believes she is generous. She is controlling.' },
  { cat: 'motivation', desc: 'Wrong about why she does what she does', example: 'She thinks she builds for her Besties. She builds for her invisibility wound.' },
  { cat: 'impact', desc: 'Wrong about her effect on others', example: 'She believes her content empowers women. Some does. Some doesn\'t. She can\'t see the difference.' },
  { cat: 'pattern', desc: 'Can\'t see the pattern repeating', example: 'She keeps choosing the same kind of relationship and each time believes this one is different.' },
  { cat: 'relationship', desc: 'Wrong about who is good for her', example: 'The person she trusts most is the one who keeps her small.' },
  { cat: 'wound', desc: 'Misidentified what actually hurts', example: 'She thinks the problem is the industry. The problem is the foreclosure she made at seventeen.' },
];

const CHANGE_TYPES = [
  { capacity: 'Rigid', desc: 'The armor is too thick — movement is almost impossible', implication: 'Not static — the story\'s pressure test. Everything breaks against them or eventually breaks them.', color: '#c05050' },
  { capacity: 'Slow', desc: 'Change happens but only under sustained pressure over long time', implication: 'Requires patience in the story — the arc happens across seasons, not scenes.', color: '#b89060' },
  { capacity: 'Conditional', desc: 'Change is possible but requires specific conditions', implication: 'The conditions become the story. Who needs to be present. What needs to be lost.', color: '#c9a84c' },
  { capacity: 'Fluid', desc: 'Takes the shape of whoever is near — change is easy and therefore unreliable', implication: 'Change that\'s too easy is not growth. The question is whether she ever settles into herself.', color: '#7ab3d4' },
  { capacity: 'Ready', desc: 'On the edge of a shift — the right scene will move them', implication: 'The most dramatic character to write. One scene away from becoming someone different.', color: '#6bba9a' },
];

const COSMOLOGY_TYPES = [
  { type: 'Merit-based', logic: 'Effort and character determine outcome. Good things happen to people who work hard and do right.', loss: 'Loss is a signal: I didn\'t work hard enough, I made a wrong choice, this is correctable.', ambition: 'Extreme — if success is earned, failure is also earned, which means every setback is personal.', breaks: 'The character who did everything right and it didn\'t work. The cosmology cracks. What replaces it?' },
  { type: 'Rigged', logic: 'Systems favor some and punish others. The game is not fair.', loss: 'Loss is expected and structural — not personal. The question is how to navigate, not what she did wrong.', ambition: 'Strategic — where are the openings, who are the gatekeepers, what are the actual rules.', breaks: 'Something good happens the rigged cosmology can\'t explain. Now what does she believe?' },
  { type: 'Divinely ordered', logic: 'Everything happens for a reason. The arc is longer than one life.', loss: 'Loss is a lesson or a redirection. The present pain is prologue.', ambition: 'Surrendered — builds but holds loosely, because the outcome isn\'t hers to control.', breaks: 'The loss so large that no reason could justify it. The divine order\'s most important test.' },
  { type: 'Random', logic: 'Nothing means anything beyond what we make it mean. The world is indifferent.', loss: 'Loss is weather. It happened. It doesn\'t mean anything about her.', ambition: 'Liberated or nihilistic depending on the wound. Either everything is possible or nothing matters.', breaks: 'When she starts to want something to mean something. The need for meaning with no room for it.' },
  { type: 'Relational', logic: 'The meaning is in the people, not the universe. What matters is who you are to others.', loss: 'Person-loss is the only loss that counts. Career loss is survivable. Relational loss is existential.', ambition: 'Ambient — builds because it provides resources for relationships, not because the building means anything itself.', breaks: 'When the relationship she built her meaning around ends or reveals itself to be different.' },
];

const FORECLOSED_CATEGORIES = [
  'love', 'safety', 'belonging', 'success', 'rest', 'joy',
  'visibility', 'being_known', 'being_chosen', 'starting_over',
];

const FORECLOSED_FIELDS = [
  { field: 'foreclosed_category', captures: 'The category of possibility that has been secretly given up on', function_: 'The story engine reads this when generating what she reaches for and what she flinches from. She wants it. She doesn\'t believe it\'s available. Both are true.' },
  { field: 'foreclosure_origin', captures: 'When and why it happened — the specific moment or accumulated experience', function_: 'Often the actual wound — not the one the character identifies, but the one that closed something down so quietly she never noticed.' },
  { field: 'foreclosure_vs_stated_want', captures: 'The gap between what the character says she wants and what she\'s foreclosed on', function_: 'She may be actively pursuing what she secretly doesn\'t believe she can have.' },
];

const JOY_ACCESSIBILITY = [
  { level: 'freely_accessible', desc: 'She can reach it when she needs it', color: '#6bba9a' },
  { level: 'conditional', desc: 'Requires specific circumstances or people', color: '#c9a84c' },
  { level: 'buried', desc: 'Exists but she can\'t get to it', color: '#b89060' },
  { level: 'forgotten', desc: 'She no longer remembers what it felt like', color: '#c05050' },
];

const JOY_FIELDS = [
  { field: 'joy_source', captures: 'The specific thing that makes this character come completely alive — not what they say but what actually lights them up', function_: 'Every scene that includes the joy source is where the character is most fully themselves. The audience recognizes it before they can name it.', threat: 'The thing the story takes from her. The thing she sacrifices. The thing she finds again.' },
  { field: 'joy_accessibility', captures: 'How accessible the joy is currently', function_: 'The arc of joy accessibility is the arc of the character\'s aliveness. Buried or forgotten joy is the recovery arc.', threat: 'freely_accessible → buried = the story has cost her something fundamental.' },
  { field: 'joy_vs_ambition', captures: 'Whether the joy source and the ambition are aligned or in tension', function_: 'The most painful revelation: she built the thing she thought would give her the feeling and the feeling didn\'t come.', threat: 'If the scale she builds toward requires distance from the connection she loves, that tension is the story.' },
];

const ARCHITECTURE_LAYERS = [
  { layer: 'Interior World', dimensions: 'Wound · Mask · Trigger · Want Architecture · Secret Layer · Desire Network', generates: 'The hidden structure of motivation — why she does what she does beneath the explanation she gives', color: '#d4789a' },
  { layer: 'Social World', dimensions: 'Personality traits · Posting archetype · Motivation type · Relationship dynamics · Reputation', generates: 'How she moves through other people and how they move through her', color: '#a889c8' },
  { layer: 'Physical World', dimensions: 'Body relationship · Body history · Body currency · Body control pattern', generates: 'The site where everything else lands — the body that carries the interior', color: '#c9a84c' },
  { layer: 'Economic World', dimensions: 'Money behavior pattern · Class wound · Circumstance advantages/disadvantages', generates: 'How resources shape and reveal character — money as behavior, not status', color: '#6bba9a' },
  { layer: 'Temporal World', dimensions: 'Time orientation · Change capacity · Change conditions · Change blocker', generates: 'How she relates to past, present, future — and whether she can move', color: '#7ab3d4' },
  { layer: 'Meaning World', dimensions: 'Operative cosmology · Luck belief · Foreclosed possibility · Self-narrative vs. actual narrative', generates: 'How she makes sense of what happens — the logic beneath the logic', color: '#b89060' },
  { layer: 'Blind Structure', dimensions: 'Blind spot · Blind spot category · Who can see it', generates: 'Author knowledge only — the thing the story is written toward revealing', color: '#c05050' },
  { layer: 'Aliveness', dimensions: 'Joy source · Joy accessibility · Joy vs. ambition', generates: 'The proof she is not only her damage — the direction she comes alive in', color: '#e8b847' },
];

const DEFAULTS = {
  BODY_FIELDS, MONEY_PATTERNS, TIME_ORIENTATIONS, LUCK_FIELDS,
  NARRATIVE_FIELDS, GAP_TYPES, BLINDSPOT_CATEGORIES, CHANGE_TYPES,
  COSMOLOGY_TYPES, FORECLOSED_CATEGORIES, FORECLOSED_FIELDS,
  JOY_ACCESSIBILITY, JOY_FIELDS, ARCHITECTURE_LAYERS,
};

/* ─── TAB RENDERERS ─── */

function renderBody() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        A character's relationship to their physical self is not appearance — it is the site where everything else lands. Stress, desire, grief, and shame live in the body.
      </p>
      <div className="cde-field-stack">
        <EditableList constantKey="BODY_FIELDS" defaults={BODY_FIELDS} label="Add Body Field">
          {(f) => (
          <div className="cde-field-card">
            <h4 className="cde-field-name">{f.field}</h4>
            <div className="cde-field-row"><strong>What It Captures</strong><p>{f.captures}</p></div>
            <div className="cde-field-row"><strong>How It Generates Story</strong><p>{f.generates}</p></div>
            <div className="cde-field-example"><p>{f.example}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderMoney() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Money is not a status — it is a behavior pattern. How a character actually moves when money is present or absent generates from their family architecture and wound.
      </p>
      <p className="cde-registry-note">Registry fields: <code>money_behavior_pattern</code> (enum) + <code>money_behavior_note</code> (text)</p>
      <div className="cde-money-grid">
        <EditableList constantKey="MONEY_PATTERNS" defaults={MONEY_PATTERNS} label="Add Money Pattern">
          {(m) => (
          <div className="cde-money-card">
            <div className="cde-money-header">
              <span className="cde-money-icon">{m.icon}</span>
              <h4>{m.pattern}</h4>
            </div>
            <div className="cde-money-row"><strong>What It Looks Like</strong><p>{m.looks}</p></div>
            <div className="cde-money-wound"><strong>What Wound It Comes From</strong><p>{m.wound}</p></div>
            <div className="cde-money-story"><strong>Story It Creates</strong><p>{m.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderTime() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        A character's personal relationship to time shapes every decision they make. Time orientation explains behavior that nothing else does.
      </p>
      <div className="cde-time-stack">
        <EditableList constantKey="TIME_ORIENTATIONS" defaults={TIME_ORIENTATIONS} label="Add Time Orientation">
          {(t) => (
          <div className="cde-time-card" style={{ borderLeftColor: t.color }}>
            <h4 style={{ color: t.color }}>{t.orientation}</h4>
            <div className="cde-time-row"><strong>How They Experience Time</strong><p>{t.experience}</p></div>
            <div className="cde-time-row"><strong>How It Shapes Decisions</strong><p>{t.shapes}</p></div>
            <div className="cde-time-story"><p>{t.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderLuck() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Some of what happens to characters is not character — it is the world. The circumstance layer captures what they didn't choose. The operative cosmology captures how they interpret it.
      </p>
      <div className="cde-luck-stack">
        <EditableList constantKey="LUCK_FIELDS" defaults={LUCK_FIELDS} label="Add Luck Field">
          {(f) => (
          <div className="cde-luck-card">
            <h4 className="cde-field-name">{f.field}</h4>
            <div className="cde-luck-row"><strong>What It Captures</strong><p>{f.captures}</p></div>
            <div className="cde-luck-gen"><strong>How It Generates Story</strong><p>{f.generates}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderNarrative() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Every person has a story they tell about who they are and why. That story is almost always partially wrong. The system generates both versions. The gap between them is where the deepest character work lives.
      </p>
      <div className="cde-narr-stack">
        <EditableList constantKey="NARRATIVE_FIELDS" defaults={NARRATIVE_FIELDS} label="Add Narrative Field">
          {(f) => (
          <div className="cde-narr-card">
            <h4 className="cde-field-name">{f.field}</h4>
            <div className="cde-narr-row"><strong>What It Contains</strong><p>{f.contains}</p></div>
            <div className="cde-narr-row"><strong>Who Sees It</strong><p>{f.sees}</p></div>
            <div className="cde-narr-fn"><strong>Story Function</strong><p>{f.function_}</p></div>
          </div>
          )}
        </EditableList>
      </div>

      <h3 className="cde-sub-heading">Narrative Gap Types</h3>
      <div className="cde-gap-grid">
        <EditableList constantKey="GAP_TYPES" defaults={GAP_TYPES} label="Add Gap Type">
          {(g) => (
          <div className="cde-gap-chip">
            <strong>{g.type}</strong>
            <p>{g.desc}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderBlindSpot() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Every character has something true about themselves they literally cannot see. Not a secret — a blind spot is something you genuinely don't know. It's usually the thing everyone around them can see clearly.
      </p>

      <div className="cde-author-callout">
        <span className="cde-author-icon">🔒</span>
        <div>
          <strong>Author Knowledge Only</strong>
          <p>Never generated into character voice. Never surfaced in internal monologue. Only in the author layer and the evaluation engine's lens.</p>
        </div>
      </div>

      <div className="cde-blind-fields">
        <div className="cde-blind-card">
          <h4 className="cde-field-name">blind_spot</h4>
          <p>The specific truth about this character that they cannot access — the thing the story is built to eventually deliver to them.</p>
        </div>
        <div className="cde-blind-card">
          <h4 className="cde-field-name">blind_spot_visible_to</h4>
          <p>Which other characters can see this character's blind spot clearly. The character who sees what the protagonist can't is always either a threat or a gift.</p>
        </div>
      </div>

      <h3 className="cde-sub-heading">Blind Spot Categories</h3>
      <div className="cde-blind-grid">
        <EditableList constantKey="BLINDSPOT_CATEGORIES" defaults={BLINDSPOT_CATEGORIES} label="Add Category">
          {(b) => (
          <div className="cde-blind-cat-card">
            <h4>{b.cat}</h4>
            <p className="cde-blind-desc">{b.desc}</p>
            <p className="cde-blind-ex">{b.example}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderChange() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Not every character can change equally. The change capacity determines whether a character has an arc or whether their function is to be the thing that doesn't change while everything around them does. Both are valid. Both are powerful.
      </p>
      <div className="cde-change-track">
        <EditableList constantKey="CHANGE_TYPES" defaults={CHANGE_TYPES} label="Add Change Type">
          {(c) => (
          <div className="cde-change-card" style={{ borderLeftColor: c.color }}>
            <h4 style={{ color: c.color }}>{c.capacity}</h4>
            <p className="cde-change-desc">{c.desc}</p>
            <div className="cde-change-impl"><strong>Story Implication</strong><p>{c.implication}</p></div>
          </div>
          )}
        </EditableList>
      </div>

      <h3 className="cde-sub-heading">Supporting Fields</h3>
      <div className="cde-change-support">
        <div className="cde-change-sup-card">
          <h4 className="cde-field-name">change_conditions</h4>
          <p>The specific conditions under which change becomes possible — who needs to be present, what they'd have to lose or gain, what kind of scene creates the opening.</p>
        </div>
        <div className="cde-change-sup-card">
          <h4 className="cde-field-name">change_blocker</h4>
          <p>The specific thing that prevents change: the story she tells herself · the relationship she won't end · the identity she can't afford to lose · the belief that's load-bearing · the fear that's never been named.</p>
        </div>
      </div>
    </div>
  );
}

function renderCosmology() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Not religion — the actual logic a character uses to make meaning. Two characters can have identical wounds and move in opposite directions because their answer to <em>why</em> is different.
      </p>
      <p className="cde-registry-note">Registry fields: <code>operative_cosmology</code> (enum) + <code>cosmology_vs_stated_religion</code> (text)</p>
      <div className="cde-cosmo-stack">
        <EditableList constantKey="COSMOLOGY_TYPES" defaults={COSMOLOGY_TYPES} label="Add Cosmology Type">
          {(c) => (
          <div className="cde-cosmo-card">
            <h4>{c.type}</h4>
            <div className="cde-cosmo-row"><strong>Operative Logic</strong><p>{c.logic}</p></div>
            <div className="cde-cosmo-row"><strong>Response to Loss</strong><p>{c.loss}</p></div>
            <div className="cde-cosmo-row"><strong>How It Shapes Ambition</strong><p>{c.ambition}</p></div>
            <div className="cde-cosmo-break"><strong>Story When It Breaks</strong><p>{c.breaks}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderForeclosed() {
  const { data } = usePageEdit();
  return (
    <div className="cde-section">
      <p className="cde-intro">
        What does this character believe is still possible for them? Not what they want — what they actually believe is still available. The foreclosure is usually invisible — even to them. But it controls everything.
      </p>

      <div className="cde-foreclosed-cats">
        {(data.FORECLOSED_CATEGORIES || FORECLOSED_CATEGORIES).map((c, i) => (
          <span key={i} className="cde-foreclosed-chip">{c}</span>
        ))}
      </div>

      <div className="cde-foreclosed-stack">
        <EditableList constantKey="FORECLOSED_FIELDS" defaults={FORECLOSED_FIELDS} label="Add Foreclosure Field">
          {(f) => (
          <div className="cde-foreclosed-card">
            <h4 className="cde-field-name">{f.field}</h4>
            <div className="cde-foreclosed-row"><strong>What It Captures</strong><p>{f.captures}</p></div>
            <div className="cde-foreclosed-fn"><strong>Story Function</strong><p>{f.function_}</p></div>
          </div>
          )}
        </EditableList>
      </div>

      <div className="cde-foreclosed-example">
        <strong>JustAWoman</strong>
        <p>She wants to be legendary. She believes in her ambition completely. Below the ambition: a quieter question about whether the right room will ever actually find her. The wound is not fear of starting. It is the specific grief of having started so many times and not been found yet.</p>
      </div>
    </div>
  );
}

function renderJoy() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        Characters need to be alive in the direction of joy. Not happy — alive. Present. Lit up. A character defined entirely by their damage is not a person. It's a case study.
      </p>

      <h3 className="cde-sub-heading">Joy Accessibility Levels</h3>
      <div className="cde-joy-levels">
        <EditableList constantKey="JOY_ACCESSIBILITY" defaults={JOY_ACCESSIBILITY} label="Add Joy Level">
          {(j) => (
          <div className="cde-joy-level" style={{ borderLeftColor: j.color }}>
            <span className="cde-joy-badge" style={{ background: j.color }}>{j.level}</span>
            <p>{j.desc}</p>
          </div>
          )}
        </EditableList>
      </div>

      <div className="cde-joy-stack">
        <EditableList constantKey="JOY_FIELDS" defaults={JOY_FIELDS} label="Add Joy Field">
          {(f) => (
          <div className="cde-joy-card">
            <h4 className="cde-field-name">{f.field}</h4>
            <div className="cde-joy-row"><strong>What It Captures</strong><p>{f.captures}</p></div>
            <div className="cde-joy-row"><strong>Story Function</strong><p>{f.function_}</p></div>
            <div className="cde-joy-threat"><strong>The Threat</strong><p>{f.threat}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderArchitecture() {
  return (
    <div className="cde-section">
      <p className="cde-intro">
        When all dimensions are stacked, the system knows things about the character that the character doesn't know about themselves. This is not a feature list — it is a theory of what makes a person real.
      </p>

      <div className="cde-arch-stack">
        <EditableList constantKey="ARCHITECTURE_LAYERS" defaults={ARCHITECTURE_LAYERS} label="Add Architecture Layer">
          {(l) => (
          <div className="cde-arch-card" style={{ borderLeftColor: l.color }}>
            <div className="cde-arch-header">
              <span className="cde-arch-dot" style={{ background: l.color }} />
              <h4>{l.layer}</h4>
            </div>
            <p className="cde-arch-dims">{l.dimensions}</p>
            <p className="cde-arch-gen">{l.generates}</p>
          </div>
          )}
        </EditableList>
      </div>

      <div className="cde-principle-callout">
        <span className="cde-principle-icon">💎</span>
        <div>
          <strong>What Makes a Character Last</strong>
          <p>The characters that last have contradiction that doesn't resolve. Goodness coexists with damage. Moments where they are completely wrong about themselves and the reader can see it. The system generates the contradiction. Preserves the blind spot. Never lets the character be too neat.</p>
        </div>
      </div>
    </div>
  );
}

const TAB_RENDERERS = {
  body: renderBody,
  money: renderMoney,
  time: renderTime,
  luck: renderLuck,
  narrative: renderNarrative,
  blindspot: renderBlindSpot,
  change: renderChange,
  cosmology: renderCosmology,
  foreclosed: renderForeclosed,
  joy: renderJoy,
  architecture: renderArchitecture,
};

/* ─── PAGE COMPONENT ─── */

export default function CharacterDepthEngine() {
  const [activeTab, setActiveTab] = useState('body');
  const { data, updateItems, addItem, removeItem, saving } = usePageData('character_depth_engine', DEFAULTS);
  const [editItem, setEditItem] = useState(null);
  const Renderer = TAB_RENDERERS[activeTab];

  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div className="cde-page">
      <header className="cde-header">
        {saving && <span className="eim-saving">Saving…</span>}
        <h1>The Character Depth Engine</h1>
        <p className="cde-subtitle">Doc 09 · v1.0 — The missing dimensions that make characters irreducible</p>
      </header>

      <nav className="cde-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`cde-tab ${activeTab === t.key ? 'cde-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="cde-content">
        {Renderer && <Renderer />}
      </main>
    </div>
    {editItem && <EditItemModal item={editItem.item} onSave={(updated) => { updateItems(editItem.key, editItem.index, updated); setEditItem(null); }} onCancel={() => setEditItem(null)} title={`Edit ${editItem.key}`} />}
    </PageEditContext.Provider>
  );
}
