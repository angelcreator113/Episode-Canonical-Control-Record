import React, { useState } from 'react';
import './SocialPersonality.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';
import PushToBrain from '../components/PushToBrain';

/* ══════════════════════════════════════════════
   Data Constants — Doc 06 · Social Personality v1.0
   ══════════════════════════════════════════════ */

const PERSONALITY_TRAITS = [
  { trait: 'Attention Seeking', measures: 'How much the character craves visibility and audience response', high: 'Constant posting, dramatic captions, viral challenges, performance-forward content — presence as identity', low: "Private lifestyle, minimal posting, discomfort with the Feed's gaze — presence as effort", conflict: "High attention-seeking + high authenticity: needs to be seen but can't perform. Every post is the real thing. Exhausting and magnetic." },
  { trait: 'Authenticity', measures: 'How honest and unfiltered their content actually feels to the audience', high: 'Relatable posts, vulnerability, real-life struggles, low production — the audience trusts them because they feel unguarded', low: "Highly curated lifestyle, luxury illusions, controlled narrative — the audience admires them but doesn't know them", conflict: "Low authenticity + high community orientation: builds deep community through content that isn't actually honest. The audience is real. The person isn't. Yet." },
  { trait: 'Ambition', measures: 'Desire for influence, success, and industry position', high: 'Networking, collaborations, business launches, constant forward motion — rest is a threat', low: 'Casual posting, hobby creators, presence without agenda — the Feed is entertainment not strategy', conflict: 'High ambition + low attention-seeking: wants the career, hates being watched. Brand deals, no personal content.' },
  { trait: 'Drama Sensitivity', measures: 'How likely they are to engage in conflict — to initiate, respond to, or get caught in controversy', high: "Public arguments, reaction videos, calling things out — cannot let things go publicly", low: "Avoids controversy, stays neutral during feuds, doesn't bite when baited — strategic silence or genuine discomfort", conflict: "High drama sensitivity + high authenticity: the conflict is always real and always visible. No filter on the wound." },
  { trait: 'Trend Responsiveness', measures: 'How quickly they adopt or reject emerging trends', high: 'Jumps on trends early, cultural event participation, algorithm-aligned content — rides every wave', low: 'Ignores trends, consistent aesthetic regardless of the calendar — the one who makes the trend feel late by existing before it', conflict: "High trend responsiveness + high ambition: exhausting output. Jumps on everything. Hard to know who she actually is under the trend cycle." },
  { trait: 'Community Orientation', measures: 'How focused the character is on building relationships with their audience vs. on self-expression', high: 'Group conversations, uplifting followers, collaborative energy — the audience is the product', low: 'Self-focused content, the audience is witness not participant — she creates and the audience watches', conflict: "Low community orientation + high authenticity: intensely personal content the audience can't interact with. Intimacy without invitation." }
];

const POSTING_ARCHETYPES = [
  { archetype: 'The Broadcaster', posts: 'Daily life updates, personal stories, real-time reactions — the Feed as diary', rate: 'Very high — multiple times daily', traits: 'High attention-seeking + high authenticity + variable community orientation', shift: 'When the Broadcaster goes quiet, something happened. The silence is louder than the content.' },
  { archetype: 'The Curator', posts: 'Aesthetic photos, professional shoots, carefully composed content — every post is a statement', rate: 'Moderate — quality over frequency', traits: 'Low authenticity (performed) + high ambition + low drama sensitivity', shift: "When the Curator posts something raw and unedited, the audience knows it's real. And serious." },
  { archetype: 'The Reactor', posts: 'Commentary, response videos, reaction to events — exists in response to the culture around her', rate: 'High during drama, near-zero otherwise', traits: 'High drama sensitivity + high trend responsiveness + low ambition (usually)', shift: "When the Reactor stops reacting, she's either healing or she's done." },
  { archetype: 'The Educator', posts: 'Tutorials, guides, how-tos, knowledge threads — teaches as a form of authority building', rate: 'Consistent — scheduled, reliable', traits: 'High authenticity + high ambition + low drama sensitivity', shift: "When the Educator gets personal, the lesson is about herself. The audience isn't ready." },
  { archetype: 'The Ghost', posts: 'Occasional updates with long gaps — present enough to maintain but never truly available', rate: 'Very low — infrequent and unpredictable', traits: 'Low attention-seeking + low community orientation + high or low everything else', shift: 'Every Ghost post is an event. The audience has been waiting. What she posts carries disproportionate weight.' }
];

const MOTIVATION_TYPES = [
  { type: 'Fame Seeker', goal: 'Influence, visibility, cultural status', pattern: 'Chasing viral moments, networking constantly, pivoting to whatever gets the most engagement', gap: 'The audience sees ambition and energy. The Fame Seeker is terrified the Feed will forget her.', breaks: "She goes viral for the wrong reason. The fame arrives and it's not what she wanted." },
  { type: 'Entrepreneur', goal: 'Business success, revenue, building something that outlasts the content', pattern: 'Selling products, launching brands, treating the Feed as a distribution channel', gap: 'The audience sees hustle. The Entrepreneur is playing a different game — the content is a means.', breaks: "The business fails publicly. Or succeeds so completely she doesn't need the Feed anymore." },
  { type: 'Community Builder', goal: 'Belonging, connection, being at the center of a real network', pattern: 'Group conversations, support culture, elevating other creators — the community is the product', gap: 'The audience sees generosity. The Community Builder needs the network as much as the network needs her.', breaks: "She builds something real and it gets taken from her." },
  { type: 'Artist', goal: 'Creative expression, making something that matters, leaving something behind', pattern: 'Sharing work, experimenting with form, using the Feed as gallery or stage', gap: 'The audience sees talent. The Artist is using the Feed as a venue — the algorithm is irrelevant to the work.', breaks: 'The algorithm rewards something she made carelessly. The thing she made with her whole self went nowhere.' },
  { type: 'Observer', goal: 'Entertainment, voyeurism, the pleasure of watching without being watched', pattern: 'Minimal posting, heavy consumption — the Feed as window not mirror', gap: 'The audience barely sees her. She sees everything.', breaks: 'She posts once. It goes viral. The Observer becomes observed against her will.' }
];

const RELATIONSHIP_DYNAMICS = [
  { type: 'Best Friends', feedLook: "Constant tagging, inside jokes, collaborative presence — the audience knows they're close", offFeed: 'Emotional support, creative feedback, belonging — the friendship is the infrastructure', ends: "Falling out over something the audience doesn't fully see", after: 'The post that stopped the tags. Everyone noticed before either of them said anything.' },
  { type: 'Collaborators', feedLook: 'Joint projects, co-branded products, recurring appearances — professional intimacy', offFeed: 'Audience access, shared credibility, revenue — the collab is a business', ends: 'Creative divergence, audience feedback turning negative, one outgrowing the other', after: 'Who the collaboration made and who it used. That answer usually takes a year to become visible.' },
  { type: 'Mentors', feedLook: "The mentor's endorsement, the student's public gratitude — the relationship is content", offFeed: "Industry access, knowledge, the shortcut that isn't — mentorship is acceleration with invisible strings", ends: "Student surpasses mentor publicly, or mentor feels ownership over student's trajectory", after: 'Was it mentorship or was it control? The student has to answer that, publicly, eventually.' },
  { type: 'Rivals', feedLook: 'Competing in the same space — the audience picks sides, comparisons trend', offFeed: "Clarity of identity — the rival defines what you are by being what you're not", ends: 'One wins decisively, or both lose to a third party who arrived while they were competing', after: 'The rivalry that defined both of them ends and neither knows who they are without it.' },
  { type: 'Romantic Partners', feedLook: 'Couples content, public milestones, the relationship as shared brand', offFeed: 'Everything — or the performance of everything. Sometimes impossible to know which.', ends: "Breakup, cheating allegation, one partner's controversy contaminating the other", after: 'The photo where she stopped tagging him. Three days before the announcement. Everyone counts backward.' }
];

const EMOTIONAL_REACTIONS = [
  { type: 'Supportive', triggers: "Other creator's success, community moments, good news", feedLook: 'Encouragement, congratulations, amplifying others — generous presence', traits: 'High community orientation + low drama sensitivity + high authenticity', shift: 'When the Supportive character stops celebrating someone she used to celebrate, the audience clocks it immediately.' },
  { type: 'Competitive', triggers: 'Rival goes viral, someone else wins an award she wanted, a trend she ignores takes off', feedLook: 'Posting better content immediately after — same energy, higher production', traits: 'High ambition + moderate attention-seeking + low drama sensitivity', shift: 'The competitive reaction she thought nobody would notice. They always notice.' },
  { type: 'Defensive', triggers: 'Criticism, accusations, misrepresentation', feedLook: 'Responding to negative comments, posting clarifications, the apology video or its absence', traits: 'High drama sensitivity + high attention-seeking + high authenticity (usually)', shift: "What she defends reveals what she's afraid to lose. The defensive post is always more revealing than the original content." },
  { type: 'Opportunistic', triggers: 'Trending moment, viral format, event that matches her content lane', feedLook: 'Joining challenges, posting trend-aligned content the moment the window opens', traits: 'High trend responsiveness + high ambition + low authenticity', shift: "When she joins a trend that doesn't fit her and the audience can see it doesn't fit her." },
  { type: 'Withdrawn', triggers: "Overwhelm, significant personal event, content that didn't land as expected", feedLook: 'Going quiet — Ghost mode activated by circumstance rather than personality', traits: 'Variable trait profile — response to pressure, not a stable state', shift: "The silence after something happened. The return post carries the weight of everything she didn't say." }
];

const REPUTATION_TYPES = [
  { type: 'Authentic', built: 'Consistent vulnerability, truth-telling that costs something, showing up the same in crisis as in success', opens: 'Deep audience trust, community loyalty, collaborations with brands that want credibility', attracts: "The audience that defends her when she hasn't asked them to", destroyed: "One moment that contradicts the authenticity. The audience's investment turns into the most specific betrayal." },
  { type: 'Controversial', built: 'Public conflict, strong opinions, willingness to name things others avoid', opens: 'Viral amplification, media coverage, the audience that loves to watch', attracts: "Controversy that finds her even when she didn't start it. The reputation summons the drama.", destroyed: 'Running out of things to be controversial about. Or choosing the wrong target.' },
  { type: 'Inspirational', built: 'Documented growth, shared struggle with visible resolution, the story with a second act', opens: 'Brand partnerships that want aspiration, speaking opportunities, platform expansion', attracts: 'The audience that needs permission — she gives it by existing', destroyed: 'Being caught not living the inspiration. The gap between the story and the life.' },
  { type: 'Comedic', built: 'Consistent humor, meme identity, the willingness to be ridiculous publicly', opens: 'Entertainment partnerships, viral format adoption, the audience that keeps returning for the feeling', attracts: 'Being reduced to the joke. People stop taking anything else she does seriously.', destroyed: 'The moment she wants to be serious and the audience laughs. Or the moment the joke lands wrong.' },
  { type: 'Mysterious', built: 'Selective disclosure, strategic absence, content that implies more than it says', opens: 'Intense audience investment, the parasocial relationship that fills in the gaps', attracts: 'The audience that invents her. The image becomes larger than the person.', destroyed: 'Revealing too much. Or having something revealed without her control. The mystery ends.' }
];

const GROWTH_FORCES = [
  { force: 'Consistency', requires: 'Showing up at the same frequency, quality level, and voice — even when nobody is watching', builds: 'Algorithmic momentum, audience habit, the sense that she is reliable', cannot: 'Audience passion — consistency is respect, not devotion', risk: 'The creator who has been consistent so long the audience stopped noticing. Invisible by reliability.' },
  { force: 'Cultural Participation', requires: 'Engaging with events, trends, and cultural moments as they happen', builds: 'Relevance, discoverability, the sense that she is part of the world', cannot: 'Distinction — participation is table stakes, not differentiation', risk: "Participating in everything means standing for nothing. The algorithm finds her but the audience can't describe her." },
  { force: 'Collaboration', requires: 'Working with other creators — shared content, joint launches, mutual amplification', builds: 'Audience crossover, industry legitimacy, the social proof of being chosen by peers', cannot: "Trust — audiences know collabs are strategic. The relationship feels professional even when it's real.", risk: "Being known primarily as someone else's collaborator. The attribution problem." },
  { force: 'Viral Moments', requires: 'One post that escapes its origin cluster and reaches the platform-wide feed', builds: 'Sudden follower growth, brand attention, the before-and-after of her public identity', cannot: 'The audience that was there before — they often leave when the platform arrives', risk: "Growth faster than identity. Who is she to 300,000 new followers who don't know her history?" }
];

const DAMAGE_EVENTS = [
  { event: 'Scandal (personal)', destroys: 'Authentic reputation — the audience trusted her privately and feels betrayed', feedEffect: 'Feed dominance for 3–7 days. Every old post re-read for evidence.', recovery: 'Genuine vulnerability, not performance. The apology that admits the thing without minimizing it.', cost: 'Privacy. The recovery requires more disclosure than the scandal did.' },
  { event: 'Controversy (opinion)', destroys: "Safe reputation — the audience thought she was neutral and discovers she isn't", feedEffect: 'Split engagement — she gains some and loses some simultaneously', recovery: 'Holding the position or walking it back — both have audiences, neither is neutral', cost: 'Either her conviction or her consistency. She picks which one to sacrifice.' },
  { event: 'Cancelled post / accusation', destroys: 'Trust reputation — the audience questions what else they missed', feedEffect: 'Viral spread of the accusation before any response is possible', recovery: "Speed of response + specificity of correction + behavioral change that's visible over time", cost: 'The narrative. She will never fully own how this gets told.' },
  { event: 'Brand betrayal', destroys: 'Commercial reputation — she promoted something that failed or lied', feedEffect: 'The audience loses money or trust based on her recommendation', recovery: 'Full accountability + refund advocacy + public separation from the brand', cost: 'Her ability to monetize trust. Some part of her commercial relationship with the audience changes permanently.' },
  { event: 'Relationship fallout (public)', destroys: 'The parasocial investment the audience made in the relationship', feedEffect: "Audience takes sides before she's said anything", recovery: "Time + the return post that handles the situation in her register, not the audience's", cost: 'The relationship. Public recovery from a private loss, performed publicly.' }
];

const STORY_ARCS = [
  { arc: 'The Rise', external: 'Unknown creator becomes recognized — follower count, brand deals, industry access accumulate', internal: 'Establishment stage: discovering what works, what the audience responds to, who she is publicly', breaks: 'The moment she realizes the version of herself the audience loves is not entirely accurate' },
  { arc: 'The Fall', external: 'Scandal or controversy damages reputation — public loss of status, partnerships, audience', internal: 'Crisis stage: the wound is open. The wound was always there. The fall just made it visible.', breaks: 'The post she makes from the bottom that is more honest than anything she made on the way up' },
  { arc: 'The Reinvention', external: 'Creator changes identity — aesthetic, content lane, persona, sometimes name', internal: "Pressure stage: the old identity is costing more than it's returning", breaks: 'The collaboration or event that shows her what she could be if she stopped being what she had been' },
  { arc: 'The Redemption', external: 'Public forgiveness arc — the audience decides to believe in her again', internal: 'Integration stage: the wound is acknowledged and carried rather than hidden or performed', breaks: "The moment the audience realizes she's different. Not the apology — something after it." },
  { arc: 'The Rivalry', external: 'Ongoing competition — two creators defining each other by contrast', internal: "Both in pressure stage simultaneously, each the other's pressure source", breaks: "One of them leaves the rivalry. The one who stays doesn't know who she is without it." },
  { arc: 'The Legacy', external: 'Creator transitions from participant to institution — mentor, founder, cultural reference point', internal: 'Integration stage: the wound is the credential. She builds for others what she needed for herself.', breaks: 'The younger creator who surpasses her. She has to decide what that means about what she built.' }
];

const ALGO_INTERACTIONS = [
  { traits: 'High ambition + high attention-seeking', pattern: 'Viral chasing — optimizes every post for reach, jumps every trend, networks constantly', algorithm: 'High initial momentum, strong reward — the algorithm loves this profile', longTerm: 'Burnout. Or a career built on performance that one day the performance can no longer sustain.' },
  { traits: 'High authenticity + high community orientation', pattern: 'Deep connection — the audience trusts her, the community is real, the content serves people', algorithm: 'Slow build, loyal retention — the algorithm is neutral but the audience is devoted', longTerm: 'The creator who never went viral and never needed to. The community is the legacy.' },
  { traits: 'High drama sensitivity + variable everything', pattern: 'Frequent controversies — she finds conflict or conflict finds her', algorithm: 'Amplification spikes during drama, instability between them', longTerm: "A reputation that makes her the story before she's done anything. The audience arrives for the event." },
  { traits: 'High trend responsiveness + low authenticity', pattern: 'Perfect trend adoption — she is always current, always relevant, always performing', algorithm: "Consistent reach — she's exactly what the algorithm wants her to be", longTerm: "The creator who has been everywhere and stands for nothing. The audience can't remember why they follow her." },
  { traits: 'Low attention-seeking + high ambition', pattern: 'Builds behind the scenes — brands, products, influence through others', algorithm: "Low personal content reach — the algorithm doesn't reward what it can't see", longTerm: 'She builds something real while everyone else is building an audience.' },
  { traits: 'High authenticity + high drama sensitivity', pattern: 'The wound is always visible — every conflict is real, every response is personal, every recovery is public', algorithm: 'Drama amplification with authentic engagement underneath — the audience is deeply invested', longTerm: 'She gives the audience everything. The cost is that she has nothing left that is only hers.' }
];

const JAW_PROFILE = {
  scores: { attentionSeeking: 75, authenticity: 85, ambition: 95, dramaSensitivity: 40, trendResponsiveness: 60, communityOrientation: 80 },
  notes: [
    'She builds for her Besties.',
    'She is not performing confidence — it is her foundation.',
    'Her ambition is for legacy, not fame.',
    'The algorithm has not found the right room for her yet. That is the wound.'
  ]
};

const DEFAULTS = {
  PERSONALITY_TRAITS, POSTING_ARCHETYPES, MOTIVATION_TYPES, RELATIONSHIP_DYNAMICS,
  EMOTIONAL_REACTIONS, REPUTATION_TYPES, GROWTH_FORCES, DAMAGE_EVENTS,
  STORY_ARCS, ALGO_INTERACTIONS, JAW_PROFILE,
};

/* ═══════════════════
   Tab definitions
   ═══════════════════ */
const TABS = [
  { key: 'traits',        label: 'Traits' },
  { key: 'archetypes',    label: 'Archetypes' },
  { key: 'motivations',   label: 'Motivations' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'reactions',     label: 'Reactions' },
  { key: 'reputation',    label: 'Reputation' },
  { key: 'growth',        label: 'Growth' },
  { key: 'damage',        label: 'Damage & Recovery' },
  { key: 'arcs',          label: 'Story Arcs' },
  { key: 'algorithm',     label: 'Algorithm' }
];

/* ═══════════════════
   Tab Renderers
   ═══════════════════ */

function TabTraits() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Each character has a score (0–100) in six traits. The score shapes behavior — not as rules but as tendencies. The most interesting characters have trait scores in conflict with each other.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="PERSONALITY_TRAITS" defaults={PERSONALITY_TRAITS} label="Add Trait">
          {(t) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-rose">{t.trait}</span>
            </div>
            <p className="sp-card-body"><strong>Measures:</strong> {t.measures}</p>
            <div className="sp-trait-row">
              <div className="sp-trait-half">
                <span className="sp-badge sp-badge-mint">High 70–100</span>
                <p className="sp-card-body">{t.high}</p>
              </div>
              <div className="sp-trait-half">
                <span className="sp-badge sp-badge-steel">Low 0–30</span>
                <p className="sp-card-body">{t.low}</p>
              </div>
            </div>
            <p className="sp-card-body sp-conflict"><strong>In-Conflict Story:</strong> {t.conflict}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabArchetypes() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Characters naturally fall into posting styles based on their trait scores. The archetype can shift across a character's arc — this is one of the signals that something has changed.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="POSTING_ARCHETYPES" defaults={POSTING_ARCHETYPES} label="Add Archetype">
          {(a) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-orchid">{a.archetype}</span>
              <span className="sp-badge sp-badge-amber">{a.rate}</span>
            </div>
            <p className="sp-card-body"><strong>Posts:</strong> {a.posts}</p>
            <p className="sp-card-body"><strong>Trait Profile:</strong> {a.traits}</p>
            <p className="sp-card-body sp-muted"><strong>When It Shifts:</strong> {a.shift}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabMotivations() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">These define why characters use social media. The gap between real motivation and performed motivation is story.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="MOTIVATION_TYPES" defaults={MOTIVATION_TYPES} label="Add Motivation">
          {(m) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-gold">{m.type}</span>
            </div>
            <p className="sp-card-body"><strong>Real Goal:</strong> {m.goal}</p>
            <p className="sp-card-body"><strong>Pattern:</strong> {m.pattern}</p>
            <p className="sp-card-body"><strong>What Audience Sees vs. Truth:</strong> {m.gap}</p>
            <p className="sp-card-body sp-muted"><strong>When It Breaks:</strong> {m.breaks}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabRelationships() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Characters interact through social bonds that shape their content, their audience, and their arcs.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="RELATIONSHIP_DYNAMICS" defaults={RELATIONSHIP_DYNAMICS} label="Add Relationship">
          {(r) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-rose">{r.type}</span>
            </div>
            <p className="sp-card-body"><strong>On the Feed:</strong> {r.feedLook}</p>
            <p className="sp-card-body"><strong>Off the Feed:</strong> {r.offFeed}</p>
            <p className="sp-card-body"><strong>What Ends It:</strong> {r.ends}</p>
            <p className="sp-card-body sp-muted"><strong>Story After:</strong> {r.after}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabReactions() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Characters react differently to the same event based on their trait profile. The reaction type a character defaults to is one of the most revealing things about them.</p>
      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Reaction</th>
              <th>Triggers</th>
              <th>Feed Behavior</th>
              <th>Trait Profile</th>
              <th>When It Shifts</th>
            </tr>
          </thead>
          <tbody>
            <EditableList constantKey="EMOTIONAL_REACTIONS" defaults={EMOTIONAL_REACTIONS} label="Add Reaction">
              {(r) => (
              <tr>
                <td className="sp-cell-label">{r.type}</td>
                <td>{r.triggers}</td>
                <td>{r.feedLook}</td>
                <td>{r.traits}</td>
                <td className="sp-muted">{r.shift}</td>
              </tr>
              )}
            </EditableList>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabReputation() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Each character develops a public reputation that travels ahead of them — the audience's expectation before they've seen the latest content.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="REPUTATION_TYPES" defaults={REPUTATION_TYPES} label="Add Reputation">
          {(r) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-orchid">{r.type}</span>
            </div>
            <p className="sp-card-body"><strong>Built By:</strong> {r.built}</p>
            <p className="sp-card-body"><strong>Opens:</strong> {r.opens}</p>
            <p className="sp-card-body"><strong>Attracts:</strong> {r.attracts}</p>
            <p className="sp-card-body sp-muted"><strong>Destroyed By:</strong> {r.destroyed}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabGrowth() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">Creators gain influence through four forces. The fastest growth combines all four. The most sustainable growth is built on the first two.</p>
      <div className="sp-card-grid sp-cols-2">
        <EditableList constantKey="GROWTH_FORCES" defaults={GROWTH_FORCES} label="Add Force">
          {(g) => (
          <div className="sp-card">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-mint">{g.force}</span>
            </div>
            <p className="sp-card-body"><strong>Requires:</strong> {g.requires}</p>
            <p className="sp-card-body"><strong>Builds:</strong> {g.builds}</p>
            <p className="sp-card-body"><strong>Cannot Build:</strong> {g.cannot}</p>
            <p className="sp-card-body sp-muted"><strong>Risk:</strong> {g.risk}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabDamage() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">The damage is not the event — it's the gap between the event and the reputation the character had built. The bigger the reputation, the more specific the damage.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="DAMAGE_EVENTS" defaults={DAMAGE_EVENTS} label="Add Event">
          {(d) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-rose">{d.event}</span>
            </div>
            <p className="sp-card-body"><strong>Destroys:</strong> {d.destroys}</p>
            <p className="sp-card-body"><strong>Feed Effect:</strong> {d.feedEffect}</p>
            <p className="sp-card-body"><strong>Recovery:</strong> {d.recovery}</p>
            <p className="sp-card-body sp-muted"><strong>Cost:</strong> {d.cost}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabArcs() {
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">These arc types describe the external narrative shape of a character's journey — running parallel to, and in tension with, the internal arc stages tracked in the Character Registry.</p>
      <div className="sp-card-grid sp-cols-1">
        <EditableList constantKey="STORY_ARCS" defaults={STORY_ARCS} label="Add Arc">
          {(a) => (
          <div className="sp-card sp-card-wide">
            <div className="sp-card-header">
              <span className="sp-badge sp-badge-gold">{a.arc}</span>
            </div>
            <p className="sp-card-body"><strong>External:</strong> {a.external}</p>
            <p className="sp-card-body"><strong>Internal:</strong> {a.internal}</p>
            <p className="sp-card-body sp-muted"><strong>What Breaks It Open:</strong> {a.breaks}</p>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function TabAlgorithm() {
  const { data } = usePageEdit();
  const jawProfile = data.JAW_PROFILE || JAW_PROFILE;
  return (
    <div className="sp-tab-content">
      <p className="sp-intro">The Timeline Engine and the Personality Engine interact. A character's trait profile determines how the algorithm responds — and how their behavior responds to the algorithm over time.</p>
      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Trait Combination</th>
              <th>Behavioral Pattern</th>
              <th>Algorithm Response</th>
              <th>Long-Term Story</th>
            </tr>
          </thead>
          <tbody>
            <EditableList constantKey="ALGO_INTERACTIONS" defaults={ALGO_INTERACTIONS} label="Add Interaction">
              {(a) => (
              <tr>
                <td className="sp-cell-label">{a.traits}</td>
                <td>{a.pattern}</td>
                <td>{a.algorithm}</td>
                <td className="sp-muted">{a.longTerm}</td>
              </tr>
              )}
            </EditableList>
          </tbody>
        </table>
      </div>

      {/* JustAWoman Profile Highlight */}
      <div className="sp-jaw-card">
        <div className="sp-jaw-header">
          <span className="sp-jaw-name">JustAWoman</span>
          <span className="sp-badge sp-badge-rose">Profile Note</span>
        </div>
        <div className="sp-jaw-scores">
          {Object.entries((jawProfile.scores || JAW_PROFILE.scores)).map(([key, val]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            return (
              <div key={key} className="sp-jaw-score">
                <span className="sp-jaw-label">{label}</span>
                <div className="sp-jaw-bar-track">
                  <div className="sp-jaw-bar-fill" style={{ width: `${val}%` }} />
                </div>
                <span className="sp-jaw-val">{val}</span>
              </div>
            );
          })}
        </div>
        <ul className="sp-jaw-notes">
          {(jawProfile.notes || JAW_PROFILE.notes).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
    </div>
  );
}

const TAB_RENDERERS = {
  traits: TabTraits,
  archetypes: TabArchetypes,
  motivations: TabMotivations,
  relationships: TabRelationships,
  reactions: TabReactions,
  reputation: TabReputation,
  growth: TabGrowth,
  damage: TabDamage,
  arcs: TabArcs,
  algorithm: TabAlgorithm
};

/* ═══════════════════
   Main Component
   ═══════════════════ */

export default function SocialPersonality() {
  const [activeTab, setActiveTab] = useState('traits');
  const [editItem, setEditItem] = useState(null);
  const { data, updateItem, addItem, removeItem, saving } = usePageData('social_personality', DEFAULTS);
  const Renderer = TAB_RENDERERS[activeTab];

  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div className="sp-page">
      <header className="sp-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="sp-title">The Social Personality Engine</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saving && <span className="eim-saving">Saving…</span>}
            <PushToBrain pageName="social_personality" data={data} />
          </span>
        </div>
        <p className="sp-subtitle">Doc 06 · v1.0 · March 2026 — What characters post, how they react, and how they grow</p>
      </header>

      <nav className="sp-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`sp-tab ${activeTab === t.key ? 'sp-tab-active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="sp-panel" role="tabpanel">
        {Renderer && <Renderer />}
      </section>

      <footer className="sp-footer">
        Source: <em>social-personality-v1.0</em> · franchise_law · always_inject
      </footer>

      {editItem && (
        <EditItemModal
          item={editItem.item}
          title={`Edit ${editItem.key.replace(/_/g, ' ')}`}
          onSave={(updated) => {
            if (editItem.index === -1) addItem(editItem.key, updated);
            else updateItem(editItem.key, editItem.index, updated);
            setEditItem(null);
          }}
          onCancel={() => setEditItem(null)}
        />
      )}
    </div>
    </PageEditContext.Provider>
  );
}
