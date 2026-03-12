import React, { useState } from 'react';
import './CharacterLifeSimulation.css';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';

/* ═══════════════════════════════════════════════════════════════
   Character Life Simulation System — Doc 07 · v1.0
   10 tabs · Teal accent (#4ea8a6) · .cls-* CSS prefix
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'stages',        label: 'Career Stages' },
  { key: 'careers',       label: 'Career Paths' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'friends',       label: 'Friend Groups' },
  { key: 'milestones',    label: 'Milestones' },
  { key: 'rivalries',     label: 'Rivalries' },
  { key: 'mentorship',    label: 'Mentorship' },
  { key: 'migration',     label: 'City Migration' },
  { key: 'persona',       label: 'Persona Gap' },
  { key: 'generational',  label: 'Generational' },
];

/* ─── DATA ─── */

const CAREER_STAGES = [
  { stage: 1, name: 'Discovery', position: 'Unknown — experimenting with identity, skills, and communities. No established audience.', content: 'Trying trends, joining communities, experimenting with aesthetics — identity content', access: 'Micro communities, peer collaborators at the same level, early feedback loops', tension: 'Often in establishment internally — but external invisibility and internal pressure can coexist. Being new does not mean being uncomplicated.' },
  { stage: 2, name: 'Breakout', position: 'Gaining recognition — the audience is forming, the algorithm is starting to respond, the industry is noticing', content: 'Viral posts, networking, career launches, milestone documentation', access: 'Mid-tier collaborators, first brand attention, event invitations that weren\'t always automatic', tension: 'Often in pressure internally — the breakout brings expectation and the expectation surfaces the wound.' },
  { stage: 3, name: 'Expansion', position: 'Building — brands, industry recognition, team, larger projects, a name that travels ahead of them', content: 'Product launches, partnerships, behind-the-scenes of the build, aspiration content', access: 'Industry events, Tier 2–3 collaborators, the Velvet Academy / Glow Institute connections', tension: 'Can be in any internal stage — expansion is external success that does not resolve internal state. The wound does not care about the brand deal.' },
  { stage: 4, name: 'Legacy', position: 'Institution — mentorship, cultural influence, the career that shapes what\'s possible for other careers', content: 'Guiding younger creators, establishing institutions, reflection content, the platform as cultural archive', access: 'Everything — and the awareness that access is no longer the thing she was looking for', tension: 'Often in integration internally — but not always. The Legacy stage creator who is still in crisis is the most compelling kind.' },
];

const CAREER_PATHS = [
  { industry: 'Fashion', tracks: 'Designer · Stylist · Fashion photographer · Runway model · Fashion journalist', city: 'Velvet City', event: 'Atelier Circuit + Velvet Season', legends: 'The Style Queen, Velvet Muse, The Runway Architect', color: '#d4789a' },
  { industry: 'Beauty', tracks: 'Makeup artist · Skincare specialist · Salon owner · Cosmetic chemist · Beauty influencer', city: 'Glow District', event: 'Glow Week + Glow Honors', legends: 'The Glow Guru, Skin Scientist, The Makeup Oracle', color: '#a889c8' },
  { industry: 'Creator', tracks: 'Lifestyle creator · Vlogger · Comedian · Storyteller · Commentator', city: 'Creator Harbor', event: 'Creator Camp + Creator Cruise', legends: 'The Creator King, The Digital Mogul, The Community Architect', color: '#7ab3d4' },
  { industry: 'Entertainment', tracks: 'Musician · Performer · Actor · DJ · Stage director', city: 'Pulse City', event: 'Neon Nights + Soundwave Nights + Cloud Carnival', legends: 'The Music Architect, The Nightlife Queen, The Performance Icon', color: '#c9a84c' },
  { industry: 'Entrepreneur', tracks: 'Brand founder · Digital product creator · Creator agency owner · Tech founder', city: 'Horizon City', event: 'Dream Market + Trend Summit', legends: 'The Brand Builder, The Collaboration Queen, The Digital Empress', color: '#6bba9a' },
];

const ROMANTIC_TYPES = [
  { type: 'Casual Dating', looks: 'Low public commitment — implied or partially disclosed', provides: 'Freedom, independence, the relationship as private', costs: 'Nothing publicly. Which is its own kind of cost when the audience expects access.', ends: 'Nothing publicly. Until the next relationship makes the previous one a retrospective.' },
  { type: 'Power Couple', looks: 'Two influencer-level creators whose audiences overlap — joint content, shared milestones, brand as unit', provides: 'Reach amplification, shared legitimacy, a story the audience can follow', costs: 'Individual identity — who is she separately from the couple brand?', ends: 'A breakup that requires both audiences to choose. The split feels like a franchise ending.' },
  { type: 'Rival Lovers', looks: 'Romantic relationship with competitive tension — same space, wanting the same things', provides: 'Intensity, creative friction, the relationship as fuel', costs: 'Stability. They will never fully be on the same side.', ends: 'The rivalry outlasts the relationship. The competition continues after the love doesn\'t.' },
  { type: 'Long-Term Partners', looks: 'Stable, evolved, present as context not spectacle — the relationship that has seen multiple arc stages', provides: 'Depth, safety, the relationship as infrastructure rather than content', costs: 'Freshness — stable love doesn\'t generate as much engagement as unstable love', ends: 'Rarely. When it ends, it ends quietly. The audience didn\'t see it coming because they had stopped watching.' },
];

const FAMILY_ROLES = [
  { role: 'Parents', feed: 'Parental approval or disapproval becomes context for the creator\'s choices — present or conspicuously absent', story: 'The parent who doesn\'t know what their child does for a living. The parent who is proud of the wrong things.' },
  { role: 'Siblings', feed: 'Collaboration potential, rivalry potential, the shared history that complicates the public persona', story: 'The sibling who is also a creator. The sibling who refuses to be. Both are stories.' },
  { role: 'Partners', feed: 'The relationship that shapes the character\'s content permission structure — what she will and won\'t show', story: 'David. JustAWoman tells him everything about the men. He doesn\'t have the feeling.' },
  { role: 'Children', feed: 'Parent creators shift content — the child changes what she will and won\'t say publicly', story: 'What she protects from the Feed. What the Feed takes anyway. The line she draws and what it costs to hold it.' },
];

const FRIEND_GROUPS = [
  { type: 'Fashion Circle', who: 'Stylists, designers, fashion creators, runway figures — city-adjacent, event-forward', creates: 'Access to industry events, aesthetic alignment, the feeling of being inside something', breaks: 'Someone from the circle goes mainstream and gets perceived as leaving. Or does leave.' },
  { type: 'Beauty Collective', who: 'Makeup artists, skincare creators, beauty founders — product-adjacent, tutorial-heavy', creates: 'Brand deal access, collaborative content, the validation of peer expertise', breaks: 'A product collab that goes wrong and the audience blames everyone adjacent.' },
  { type: 'Creator House', who: 'Multiple creators living or working in proximity — cross-industry, high-production', creates: 'Content, collaboration, an audience that follows the house as much as the individuals', breaks: 'One member\'s controversy contaminates the house. Everyone has to respond.' },
  { type: 'Music Crew', who: 'Musicians, producers, DJs, entertainment creators — nightlife-adjacent, sound-forward', creates: 'Access to Pulse City culture, the prestige of entertainment adjacency, a different kind of cool', breaks: 'Someone in the crew makes it to a different tier. The crew either rises with them or gets left.' },
  { type: 'Founding Circle', who: 'Entrepreneurial creators who built things together — shared origin story, mutual investment', creates: 'Trust, co-investment, the kind of loyalty that comes from surviving early stages together', breaks: 'Money. Or credit. Or the realization that one person\'s vision became everyone\'s work.' },
];

const MILESTONES = [
  { cat: 'Career', milestone: 'First viral post', feed: 'The before and after — who she was when nobody was watching vs. who she becomes when everyone is', signal: 'Often triggers the pressure stage internally. The audience arrived before she was ready.' },
  { cat: 'Career', milestone: 'First product launch', feed: 'The creator becomes the entrepreneur — the content becomes commercial', signal: 'Expansion stage. And a test: does the audience follow her into commerce?' },
  { cat: 'Career', milestone: 'Winning a major award', feed: 'Status shift — the industry agreed publicly. The Starlight Awards on the record.', signal: 'The external validation that does not resolve the internal question. The trophy doesn\'t answer the wound.' },
  { cat: 'Career', milestone: 'First Atelier Circuit invitation', feed: 'Fashion legitimacy — the invitation is the content, the appearance is the credential', signal: 'She made it into the room. Now she has to decide what she does with the room.' },
  { cat: 'Relationship', milestone: 'First relationship reveal', feed: 'The audience meets the relationship — they immediately have opinions', signal: 'Vulnerability. Or the performance of vulnerability. The Feed cannot tell the difference.' },
  { cat: 'Relationship', milestone: 'Engagement / wedding', feed: 'Major content event — the audience is invested in the relationship milestone', signal: 'The private decision becomes public property. The commitment is witnessed by everyone.' },
  { cat: 'Relationship', milestone: 'Breakup', feed: 'The post that announces or implies it. The silence before the announcement.', signal: 'Whatever the relationship was providing — safety, identity, content — is now gone.' },
  { cat: 'Life', milestone: 'Moving cities', feed: 'The relocation post — new city, new energy, new chapter narrative', signal: 'She left something. The new city is always partly about what she\'s leaving.' },
  { cat: 'Life', milestone: 'Starting a business', feed: 'The launch announcement — the creator becomes the founder', signal: 'Her identity expands beyond the Feed. Or tries to.' },
  { cat: 'Life', milestone: 'Becoming a parent', feed: 'If she discloses: the Feed changes. If she doesn\'t: the speculation is its own event.', signal: 'Everything about what she will and won\'t show publicly gets re-negotiated.' },
];

const RIVALRIES = [
  { type: 'Designer vs. Designer', trigger: 'Shared aesthetic territory, same client tier, Atelier Circuit proximity', escalation: 'Collection comparisons, gossip media coverage, industry panels taking sides', peaks: 'Velvet Season — front row proximity, collection reveals in the same week', ends: 'One designer moves to a different aesthetic lane. Or both lose relevance to a third designer who arrived while they were competing.' },
  { type: 'Beauty Brand vs. Beauty Brand', trigger: 'Overlapping product claims, shared influencer relationships, Glow Week positioning', escalation: 'Tutorial comparisons, ingredient wars, creator loyalty battles', peaks: 'Glow Honors — which brand gets the most creator endorsements on the night', ends: 'Market differentiation — they find the territory that doesn\'t overlap. Or one collapses.' },
  { type: 'Creator vs. Creator', trigger: 'Same content lane, same tier, same audience demographic', escalation: 'Post timing wars, trend speed competition, audience forced to choose between them', peaks: 'Award nominations — Starlight Awards puts it on the record', ends: 'One creator moves to a different stage or a different lane. The rivalry only works when they\'re equal. Growth ends it.' },
];

const MENTORSHIP_CHAINS = [
  { gen: 'Generation 1 — Legacy', role: 'The originator — built something first, defined the template', provides: 'Access, credibility, the shortcut that comes from being associated with history', takes: 'Association — the student is known as hers before they\'re known as themselves', breaks: 'When the legacy creator\'s reputation changes, everyone in the chain is affected retroactively.' },
  { gen: 'Generation 2 — Established', role: 'The bridge — trained by legacy, now training the next tier', provides: 'Industry knowledge, peer relationships, the credibility of having survived the early stages', takes: 'Labor — the mentorship takes time the established creator could spend on their own work', breaks: 'When the mentee surpasses the mentor. The mentor has to decide whether that was the point.' },
  { gen: 'Generation 3 — Rising', role: 'The student — absorbing, growing, building on a foundation they didn\'t build', provides: 'Talent, energy, the freshness that legacy and established have lost', takes: 'Credit — the origin story of their approach belongs partly to someone else', breaks: 'When they realize the foundation they built on has a crack. Everything they were taught came from a specific perspective.' },
];

const MIGRATIONS = [
  { pattern: 'Creator Harbor → Velvet City', signals: 'Ambition in fashion — she wants legitimacy beyond the Feed', career: 'Fashion industry access, Velvet Academy adjacency, the Atelier Circuit as goal', story: 'She left the collaborative, entrepreneurial world for the hierarchical, status-obsessed one. She thinks she\'s ready.' },
  { pattern: 'Glow District → Creator Harbor', signals: 'Beauty expertise becoming personal brand — the specialist becomes the influencer', career: 'Audience-building, platform expansion, the credibility of expertise applied to content', story: 'She was the expert in the room. Now she has to be the character on the Feed. Different skill.' },
  { pattern: 'Pulse City → Horizon City', signals: 'Entertainment creator becoming founder — the performer becomes the builder', career: 'Startup culture, product development, Dream Market positioning', story: 'She got tired of being the talent. She wanted to own the thing. That transition is harder than it looks.' },
  { pattern: 'Anywhere → Velvet City', signals: 'The aspiration move — Velvet City is the destination that means you made it in fashion', career: 'Depends entirely on whether she has industry relationships or just the aspiration', story: 'The move she made before she was ready. The city didn\'t open for her the way she thought it would.' },
  { pattern: 'Velvet City → Anywhere', signals: 'The departure — from the place that was supposed to be the destination', career: 'Career diversification, independence from a single industry power center', story: 'She made it and found out what it cost. The move away is the real story.' },
];

const PERSONA_GAPS = [
  { gap: 'Narrow', public: 'Mostly real — what you see is close to what\'s true', private: 'Consistent with the Feed — not much is hidden', story: 'The creator who seems to hold nothing back. The audience assumes she has no secrets. She does. They\'re just different from what they\'d expect.' },
  { gap: 'Medium', public: 'Curated truth — real things, but selected. The architecture of disclosure.', private: 'More complicated than the content suggests — the parts left out are the load-bearing parts', story: 'The comment section that knows something is wrong before she says anything. They\'re reading the medium gap.' },
  { gap: 'Wide', public: 'Constructed persona — the Feed is a performance, the person is elsewhere', private: 'Completely separate from the public identity — different values, different relationships, different life', story: 'JustAWoman at the dinner table vs. JustAWoman online. She knows both. The audience only knows one.' },
  { gap: 'In Motion', public: 'The persona is changing — what she\'s willing to show is expanding or contracting', private: 'The private life is pressing against the public one — something is forcing the gap to move', story: 'The content shift. The caption that\'s different from last week\'s. The comment she didn\'t make. The audience tracks the gap even when they don\'t have language for it.' },
];

const GENERATIONAL_MOMENTS = [
  { moment: 'Career pivot (mid-arc)', changes: 'Content lane, aesthetic, platform behavior', stays: 'The wound. The wound does not pivot.', story: 'The creator who changed everything about how she shows up. The audience can see what didn\'t change.' },
  { moment: 'Priority shift (becoming a parent)', changes: 'What she will and won\'t share publicly, the content permission structure', stays: 'The ambition. The wound. The audience.', story: 'She hid the pregnancy until she couldn\'t. She\'s been calculating what the Feed costs since before the baby was born.' },
  { moment: 'Entering the Legacy stage', changes: 'She stops being a participant and becomes a reference point', stays: 'The body of work. The relationships she built. The creators who learned from her.', story: 'The younger creator who does something she invented and doesn\'t know the origin. The Archivist notices.' },
  { moment: 'Child entering the industry', changes: 'A second generation carrying the family aesthetic, wound, and audience expectations', stays: 'The family name. The comparison the child can\'t escape.', story: 'The child who needs to fail publicly before the audience will let them succeed on their own terms.' },
  { moment: 'Founding a brand or institution', changes: 'She moves from creator to architect — building the structure others will inhabit', stays: 'The voice. The original vision.', story: 'Who built it and who benefits from it are not always the same person.' },
];

const DEFAULTS = {
  CAREER_STAGES, CAREER_PATHS, ROMANTIC_TYPES, FAMILY_ROLES, FRIEND_GROUPS,
  MILESTONES, RIVALRIES, MENTORSHIP_CHAINS, MIGRATIONS, PERSONA_GAPS, GENERATIONAL_MOMENTS,
};

/* ─── TAB RENDERERS ─── */

function renderStages() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Each character moves through external career stages at their own pace. This runs <strong>parallel to — and independently from</strong> — the internal arc stages (establishment / pressure / crisis / integration) in the Character Registry.
      </p>

      <div className="cls-two-clock">
        <span className="cls-two-clock-icon">⏱️⏱️</span>
        <div>
          <strong>The Two-Clock Principle</strong>
          <p>External career arc and internal psychological arc run on independent clocks. A character at Legacy stage externally who is in crisis internally is not a contradiction — it is the most human configuration.</p>
        </div>
      </div>

      <div className="cls-stage-track">
        <EditableList constantKey="CAREER_STAGES" defaults={CAREER_STAGES} label="Add Stage">
          {(s) => (
          <div className="cls-stage-card">
            <div className="cls-stage-number">Stage {s.stage}</div>
            <h3 className="cls-stage-name">{s.name}</h3>
            <div className="cls-stage-field"><strong>Position</strong><p>{s.position}</p></div>
            <div className="cls-stage-field"><strong>Typical Content</strong><p>{s.content}</p></div>
            <div className="cls-stage-field"><strong>Access</strong><p>{s.access}</p></div>
            <div className="cls-stage-tension"><strong>Internal Arc Tension</strong><p>{s.tension}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderCareers() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Career path shapes what cultural events are relevant, which cities they live in, which institutions trained them, and which legendary figures they look up to.
      </p>
      <div className="cls-career-grid">
        <EditableList constantKey="CAREER_PATHS" defaults={CAREER_PATHS} label="Add Career Path">
          {(c) => (
          <div className="cls-career-card" style={{ borderTopColor: c.color }}>
            <h3 className="cls-career-industry">{c.industry}</h3>
            <div className="cls-career-tracks">{c.tracks}</div>
            <table className="cls-mini-table">
              <tbody>
                <tr><td className="cls-mini-label">Home City</td><td>{c.city}</td></tr>
                <tr><td className="cls-mini-label">Peak Event</td><td>{c.event}</td></tr>
                <tr><td className="cls-mini-label">Legends</td><td>{c.legends}</td></tr>
              </tbody>
            </table>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderRelationships() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Relationship status is never neutral — it is always content, context, or both.
      </p>

      <h3 className="cls-sub-heading">Romantic Relationship Types</h3>
      <div className="cls-rel-grid">
        <EditableList constantKey="ROMANTIC_TYPES" defaults={ROMANTIC_TYPES} label="Add Romantic Type">
          {(r) => (
          <div className="cls-rel-card">
            <h4>{r.type}</h4>
            <div className="cls-rel-row"><span className="cls-rel-tag provides">Provides</span><p>{r.provides}</p></div>
            <div className="cls-rel-row"><span className="cls-rel-tag costs">Costs</span><p>{r.costs}</p></div>
            <div className="cls-rel-row"><span className="cls-rel-tag ends">When It Ends</span><p>{r.ends}</p></div>
          </div>
          )}
        </EditableList>
      </div>

      <h3 className="cls-sub-heading">Family Tree Structure</h3>
      <div className="cls-family-grid">
        <EditableList constantKey="FAMILY_ROLES" defaults={FAMILY_ROLES} label="Add Family Role">
          {(f) => (
          <div className="cls-family-card">
            <h4>{f.role}</h4>
            <div className="cls-family-field"><strong>Feed Impact</strong><p>{f.feed}</p></div>
            <div className="cls-family-field"><strong>Story Potential</strong><p className="cls-story-italic">{f.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderFriends() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        The cluster a character belongs to is part of their identity — and leaving one is always a story.
      </p>
      <div className="cls-friend-grid">
        <EditableList constantKey="FRIEND_GROUPS" defaults={FRIEND_GROUPS} label="Add Friend Group">
          {(f) => (
          <div className="cls-friend-card">
            <h4>{f.type}</h4>
            <div className="cls-friend-field"><strong>Who's In It</strong><p>{f.who}</p></div>
            <div className="cls-friend-field"><strong>What It Creates</strong><p>{f.creates}</p></div>
            <div className="cls-friend-break"><strong>What Breaks It</strong><p>{f.breaks}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderMilestones() {
  const { data } = usePageEdit();
  const milestones = data.MILESTONES || MILESTONES;
  const categories = ['Career', 'Relationship', 'Life'];
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Milestones generate content, shift reputation, and mark the before-and-after of who a character is on the Feed.
      </p>
      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="cls-sub-heading">{cat} Milestones</h3>
          <div className="cls-milestone-grid">
            {milestones.filter((m) => m.cat === cat).map((m, i) => (
              <div key={i} className="cls-milestone-card">
                <h4>{m.milestone}</h4>
                <div className="cls-milestone-field"><strong>Feed Event</strong><p>{m.feed}</p></div>
                <div className="cls-milestone-signal"><strong>Internal Arc Signal</strong><p>{m.signal}</p></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderRivalries() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Rivalries intensify at specific cultural pressure points — award seasons, Atelier Circuit, trend cycles — when the stakes of being better are publicly legible.
      </p>
      <div className="cls-rivalry-stack">
        <EditableList constantKey="RIVALRIES" defaults={RIVALRIES} label="Add Rivalry">
          {(r) => (
          <div className="cls-rivalry-card">
            <h4 className="cls-rivalry-title">{r.type}</h4>
            <div className="cls-rivalry-phases">
              <div className="cls-rivalry-phase"><span className="cls-phase-label">Trigger</span><p>{r.trigger}</p></div>
              <div className="cls-rivalry-arrow">→</div>
              <div className="cls-rivalry-phase"><span className="cls-phase-label">Escalation</span><p>{r.escalation}</p></div>
              <div className="cls-rivalry-arrow">→</div>
              <div className="cls-rivalry-phase"><span className="cls-phase-label">Peak</span><p>{r.peaks}</p></div>
              <div className="cls-rivalry-arrow">→</div>
              <div className="cls-rivalry-phase"><span className="cls-phase-label">Resolution</span><p>{r.ends}</p></div>
            </div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderMentorship() {
  const { data } = usePageEdit();
  const items = data.MENTORSHIP_CHAINS || MENTORSHIP_CHAINS;
  return (
    <div className="cls-section">
      <p className="cls-intro">
        The chain creates generational influence — the mentor's approach lives in the student's work long after the relationship ends.
      </p>
      <div className="cls-mentor-chain">
        <EditableList constantKey="MENTORSHIP_CHAINS" defaults={MENTORSHIP_CHAINS} label="Add Generation">
          {(m, idx) => (
            <>
              <div className="cls-mentor-card">
                <h4 className="cls-mentor-gen">{m.gen}</h4>
                <p className="cls-mentor-role">{m.role}</p>
                <div className="cls-mentor-row"><span className="cls-mentor-tag gives">Provides</span><p>{m.provides}</p></div>
                <div className="cls-mentor-row"><span className="cls-mentor-tag takes">Takes</span><p>{m.takes}</p></div>
                <div className="cls-mentor-break"><strong>When the Chain Breaks</strong><p>{m.breaks}</p></div>
              </div>
              {idx < items.length - 1 && <div className="cls-chain-arrow">↓</div>}
            </>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderMigration() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Where a character lives is a character statement. Where they move to reveals what they're looking for. What they leave behind is the story.
      </p>
      <div className="cls-migration-stack">
        <EditableList constantKey="MIGRATIONS" defaults={MIGRATIONS} label="Add Migration">
          {(m) => (
          <div className="cls-migration-card">
            <h4 className="cls-migration-pattern">{m.pattern}</h4>
            <div className="cls-migration-field"><strong>What It Signals</strong><p>{m.signals}</p></div>
            <div className="cls-migration-field"><strong>Career Effect</strong><p>{m.career}</p></div>
            <div className="cls-migration-story"><strong>Story Beneath It</strong><p>{m.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderPersona() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Every character maintains two identities. The gap between them is where the most important stories live.
      </p>
      <div className="cls-persona-grid">
        <EditableList constantKey="PERSONA_GAPS" defaults={PERSONA_GAPS} label="Add Gap Type">
          {(p) => (
          <div className={`cls-persona-card cls-gap-${(p.gap || '').toLowerCase().replace(/\s+/g, '-')}`}>
            <h4 className="cls-gap-label">{p.gap} Gap</h4>
            <div className="cls-persona-side">
              <div className="cls-persona-half public"><strong>Public Persona</strong><p>{p.public}</p></div>
              <div className="cls-persona-half private"><strong>Private Life</strong><p>{p.private}</p></div>
            </div>
            <div className="cls-persona-story"><strong>Story in the Gap</strong><p>{p.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

function renderGenerational() {
  return (
    <div className="cls-section">
      <p className="cls-intro">
        Characters mature, shift priorities, and eventually transition from participant to institution.
      </p>
      <div className="cls-gen-stack">
        <EditableList constantKey="GENERATIONAL_MOMENTS" defaults={GENERATIONAL_MOMENTS} label="Add Moment">
          {(g) => (
          <div className="cls-gen-card">
            <h4>{g.moment}</h4>
            <div className="cls-gen-columns">
              <div className="cls-gen-col changes"><strong>What Changes</strong><p>{g.changes}</p></div>
              <div className="cls-gen-col stays"><strong>What Stays</strong><p>{g.stays}</p></div>
            </div>
            <div className="cls-gen-story"><strong>Story It Creates</strong><p>{g.story}</p></div>
          </div>
          )}
        </EditableList>
      </div>
    </div>
  );
}

const TAB_RENDERERS = {
  stages: renderStages,
  careers: renderCareers,
  relationships: renderRelationships,
  friends: renderFriends,
  milestones: renderMilestones,
  rivalries: renderRivalries,
  mentorship: renderMentorship,
  migration: renderMigration,
  persona: renderPersona,
  generational: renderGenerational,
};

/* ─── PAGE COMPONENT ─── */

export default function CharacterLifeSimulation() {
  const [activeTab, setActiveTab] = useState('stages');
  const [editItem, setEditItem] = useState(null);
  const { data, updateItem, addItem, removeItem, saving } = usePageData('character_life_simulation', DEFAULTS);
  const Renderer = TAB_RENDERERS[activeTab];

  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div className="cls-page">
      <header className="cls-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>Character Life Simulation</h1>
          {saving && <span className="eim-saving">Saving…</span>}
        </div>
        <p className="cls-subtitle">Doc 07 · v1.0 — How characters evolve through career stages, relationships, cities, and life events</p>
      </header>

      <nav className="cls-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`cls-tab ${activeTab === t.key ? 'cls-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="cls-content">
        {Renderer && <Renderer />}
      </main>

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
