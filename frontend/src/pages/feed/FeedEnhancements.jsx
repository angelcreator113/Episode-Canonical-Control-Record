/**
 * FeedEnhancements — Profile Comparison, Lala's Reactions, Feed Timeline, Relationship Web
 *
 * These components plug into the SocialProfileGenerator page as additional views/modals.
 */

import React, { useState, useEffect, useRef } from 'react';

const C = { ink: '#2C2C2C', inkMid: '#666', inkLight: '#94a3b8', border: '#e2e8f0', surface: '#fff', surfaceAlt: '#FAF7F0', pink: '#ec4899', lavender: '#6366f1', blue: '#3b82f6', gold: '#B8962E', radius: 10, radiusSm: 6, shadow: '0 1px 3px rgba(0,0,0,0.06)' };

const MOTIVATION_COLORS = {
  aspiration: { bg: '#fef3c7', color: '#92400e', label: 'Aspiration' },
  inspiration: { bg: '#dbeafe', color: '#1e40af', label: 'Inspiration' },
  entertainment: { bg: '#d1fae5', color: '#065f46', label: 'Entertainment' },
  competition: { bg: '#e0e7ff', color: '#3730a3', label: 'Competition' },
  relatability: { bg: '#fce7f3', color: '#9d174d', label: 'Relatability' },
  envy: { bg: '#fde8e8', color: '#9d174d', label: 'Envy' },
  study: { bg: '#f0f0f0', color: '#666', label: 'Study' },
  guilt_pleasure: { bg: '#fef3c7', color: '#92400e', label: 'Guilty Pleasure' },
  hate_follow: { bg: '#fef2f2', color: '#dc2626', label: 'Hate Follow' },
};

// ─── 1. PROFILE COMPARISON ──────────────────────────────────────────────────

export function ProfileComparison({ profiles, onClose }) {
  const [leftId, setLeftId] = useState(profiles[0]?.id || null);
  const [rightId, setRightId] = useState(profiles[1]?.id || null);
  const left = profiles.find(p => p.id === leftId);
  const right = profiles.find(p => p.id === rightId);

  const CompareRow = ({ label, leftVal, rightVal, highlight }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>{leftVal || '—'}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', minWidth: 80, textAlign: 'center', alignSelf: 'center' }}>{label}</div>
      <div style={{ fontSize: 12, color: C.ink }}>{rightVal || '—'}</div>
    </div>
  );

  const ScoreBar = ({ value, max = 10, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 60, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
    </div>
  );

  if (!left || !right) return null;

  // Surface story tensions
  const tensions = [];
  if (left.beauty_factor >= 7 && right.beauty_factor >= 7) tensions.push('Both are beauty powerhouses — direct visual competition');
  if (left.follow_motivation === 'envy' || right.follow_motivation === 'envy') tensions.push('Envy follow detected — this relationship creates insecurity');
  if ((left.lifestyle_gap === 'massive') !== (right.lifestyle_gap === 'massive')) tensions.push('One is authentic, the other is performing — tension when they meet');
  if (left.celebrity_tier !== right.celebrity_tier) tensions.push(`Power imbalance: ${left.celebrity_tier} vs ${right.celebrity_tier}`);
  if (left.follow_motivation === 'competition' || right.follow_motivation === 'competition') tensions.push('Competition energy — every interaction is measured');
  if ((left.clout_score || 0) - (right.clout_score || 0) > 30) tensions.push('Major clout gap — creates hierarchy dynamics in any scene');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Profile Comparison</h3>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Close</button>
      </div>

      {/* Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 16 }}>
        <select value={leftId || ''} onChange={e => setLeftId(parseInt(e.target.value))} style={{ padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.handle} — {p.display_name}</option>)}
        </select>
        <span style={{ fontSize: 16, color: C.inkLight, alignSelf: 'center' }}>vs</span>
        <select value={rightId || ''} onChange={e => setRightId(parseInt(e.target.value))} style={{ padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.handle} — {p.display_name}</option>)}
        </select>
      </div>

      {/* Story Tensions */}
      {tensions.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 6 }}>Story Tensions</div>
          {tensions.map((t, i) => <div key={i} style={{ fontSize: 12, color: '#92400e', marginBottom: 2 }}>• {t}</div>)}
        </div>
      )}

      {/* Comparison Grid */}
      <CompareRow label="Handle" leftVal={left.handle} rightVal={right.handle} />
      <CompareRow label="Platform" leftVal={left.platform} rightVal={right.platform} />
      <CompareRow label="Archetype" leftVal={left.archetype?.replace(/_/g, ' ')} rightVal={right.archetype?.replace(/_/g, ' ')} />
      <CompareRow label="Follow" leftVal={MOTIVATION_COLORS[left.follow_motivation]?.label} rightVal={MOTIVATION_COLORS[right.follow_motivation]?.label} />
      <CompareRow label="Emotion" leftVal={left.follow_emotion} rightVal={right.follow_emotion} />
      <CompareRow label="Beauty" leftVal={<ScoreBar value={left.beauty_factor || 0} color={C.pink} />} rightVal={<ScoreBar value={right.beauty_factor || 0} color={C.pink} />} />
      <CompareRow label="Excitement" leftVal={<ScoreBar value={left.event_excitement || 0} color={C.gold} />} rightVal={<ScoreBar value={right.event_excitement || 0} color={C.gold} />} />
      <CompareRow label="Clout" leftVal={<ScoreBar value={left.clout_score || 0} max={100} color={C.lavender} />} rightVal={<ScoreBar value={right.clout_score || 0} max={100} color={C.lavender} />} />
      <CompareRow label="Celebrity" leftVal={left.celebrity_tier} rightVal={right.celebrity_tier} />
      <CompareRow label="Lifestyle Gap" leftVal={left.lifestyle_gap} rightVal={right.lifestyle_gap} />
      <CompareRow label="Drama" leftVal={left.drama_magnet ? 'Yes' : 'No'} rightVal={right.drama_magnet ? 'Yes' : 'No'} />
      <CompareRow label="Persona" leftVal={left.public_persona} rightVal={right.public_persona} />
      <CompareRow label="Reality" leftVal={left.private_reality} rightVal={right.private_reality} />
    </div>
  );
}

// ─── 2. LALA'S REACTIONS GENERATOR ──────────────────────────────────────────

export function LalaReactions({ profile, showId, onClose }) {
  const [reactions, setReactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const p = profile;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/memories/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are writing internal monologue for Lala, a luxury fashion content creator in the LalaVerse.

She just saw content from ${p.display_name || p.handle} (${p.platform}).
Follow motivation: ${p.follow_motivation || 'general interest'}
Follow emotion: ${p.follow_emotion || 'neutral'}
Follow trigger: ${p.follow_trigger || 'their content'}
Beauty factor: ${p.beauty_factor || 5}/10
Lifestyle claim: ${p.lifestyle_claim || 'unknown'}
Lifestyle reality: ${p.lifestyle_reality || 'unknown'}

Generate 4 reaction scenarios as JSON:
[
  { "trigger": "specific content moment", "internal_monologue": "what Lala thinks (2-3 sentences, raw and honest)", "what_she_posts": "her public response (caption or comment)", "emotional_cost": "what this interaction takes from her" },
  ...4 total
]

Make reactions feel real — jealousy, aspiration, self-comparison, motivation. Not generic.`,
          maxTokens: 1500,
        }),
      });
      const d = await res.json();
      const text = d.response || d.content || d.data;
      if (text) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) setReactions(JSON.parse(match[0]));
      }
    } catch (err) {
      console.error('Reaction generation failed:', err);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Lala's Reactions to {p.handle}</h3>
          <div style={{ fontSize: 11, color: C.inkLight }}>
            {p.follow_motivation && <span style={{ ...MOTIVATION_COLORS[p.follow_motivation], padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, marginRight: 4 }}>{MOTIVATION_COLORS[p.follow_motivation]?.label}</span>}
            {p.follow_emotion && <span style={{ fontSize: 10, color: C.inkMid }}>feels {p.follow_emotion}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={generate} disabled={loading} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.gold}`, background: C.surfaceAlt, color: C.gold, fontWeight: 600, fontSize: 11, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Generating...' : reactions ? 'Regenerate' : 'Generate Reactions'}
          </button>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
      </div>

      {!reactions && !loading && (
        <div style={{ textAlign: 'center', padding: 30, color: C.inkLight }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Generate AI-written emotional reactions for Lala</div>
          <div style={{ fontSize: 11 }}>Based on her follow psychology: {p.follow_motivation || 'general'} + {p.follow_emotion || 'neutral'}</div>
        </div>
      )}

      {reactions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reactions.map((r, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, borderLeft: `4px solid ${C.pink}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', marginBottom: 6 }}>{r.trigger}</div>
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8 }}>"{r.internal_monologue}"</div>
              {r.what_she_posts && (
                <div style={{ background: '#f8f8f8', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: C.inkLight, marginBottom: 2 }}>WHAT SHE POSTS</div>
                  <div style={{ fontSize: 12, color: C.ink }}>{r.what_she_posts}</div>
                </div>
              )}
              {r.emotional_cost && <div style={{ fontSize: 11, color: C.pink }}>Cost: {r.emotional_cost}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 3. EVENT INVITE PREVIEW ────────────────────────────────────────────────

const INVITATION_TYPES = {
  invite:     { label: 'Social Invite', icon: '🥂', color: '#B8962E', bg: '#faf5ea' },
  brand_deal: { label: 'Brand Deal', icon: '🤝', color: '#6366f1', bg: '#eef2ff' },
  upgrade:    { label: 'Upgrade', icon: '⭐', color: '#22c55e', bg: '#f0fdf4' },
  guest:      { label: 'Guest List', icon: '💌', color: '#ec4899', bg: '#fdf2f8' },
  fail_test:  { label: 'Challenge', icon: '🔥', color: '#ef4444', bg: '#fef2f2' },
  deliverable:{ label: 'Deliverable', icon: '📋', color: '#0ea5e9', bg: '#f0f9ff' },
};

// Map event_type + opportunity_type to a viewer-friendly invitation category
function getInvitationType(event) {
  const etype = event.event_type || 'invite';
  const auto = event.canon_consequences?.automation || {};
  const oppType = auto.opportunity_type || '';

  if (oppType === 'runway' || oppType === 'casting_call' || oppType === 'editorial') return { label: 'Modeling Gig', icon: '👗', color: '#B8962E', bg: '#faf5ea' };
  if (oppType === 'podcast' || oppType === 'interview') return { label: 'Press Invite', icon: '🎙️', color: '#8b5cf6', bg: '#f5f3ff' };
  if (oppType === 'award_show') return { label: 'Award Show', icon: '🏆', color: '#B8962E', bg: '#faf5ea' };
  if (etype === 'brand_deal' || oppType === 'brand_deal' || oppType === 'campaign' || oppType === 'ambassador') return INVITATION_TYPES.brand_deal;
  return INVITATION_TYPES[etype] || INVITATION_TYPES.invite;
}

export function EventInvitePreview({ event, hostProfile }) {
  if (!event) return null;
  const auto = event.canon_consequences?.automation || {};
  const host = hostProfile || {};
  const excitement = auto.event_excitement || host.event_excitement || 5;
  const motivation = auto.follow_motivation || host.follow_motivation;
  const hostName = auto.host_display_name || event.host || 'Someone';
  const venueName = auto.venue_name || event.venue_name || '';
  const inviteType = getInvitationType(event);

  // Script lines based on excitement — these go to the voice actor, not on screen
  const SCRIPT_LINES = {
    high: [
      `Oh my god. ${hostName} just invited ME? I need to figure out what to wear immediately.`,
      `Wait — this is real? ${hostName} wants ME there? Everything just changed.`,
      `I literally just screamed. ${hostName}'s event. I'm going. I'm GOING.`,
    ],
    mid: [
      `Hmm, ${hostName}'s hosting something. Could be good. Let me see who else is going.`,
      `Okay, this is interesting. ${hostName} always has decent events. I should go.`,
      `New invite from ${hostName}. Not bad. Let me check my schedule.`,
    ],
    low: [
      `Another invite. I'll think about it. Could be useful for content, or I could rest.`,
      `${hostName} is hosting? I mean... sure. If nothing better comes up.`,
      `Do I even want to go? Let me see what the dress code is first.`,
    ],
  };
  const tier = excitement >= 8 ? 'high' : excitement >= 5 ? 'mid' : 'low';
  const lines = SCRIPT_LINES[tier];
  const scriptLine = lines[Math.floor(Date.now() / 60000) % lines.length]; // deterministic pick

  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      {/* On-Screen Notification Overlay — what the viewer sees when mail icon is tapped */}
      <div style={{ background: 'linear-gradient(135deg, #FAF7F0, #fff8e7)', borderRadius: 16, padding: '14px 18px', marginBottom: 12, boxShadow: '0 4px 20px rgba(184, 150, 46, 0.15)', border: '2px solid #B8962E30' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${inviteType.color}, ${inviteType.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: `0 2px 8px ${inviteType.color}40` }}>{inviteType.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: inviteType.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{inviteType.label}</span>
              <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: inviteType.bg, color: inviteType.color, fontWeight: 600 }}>UI.OVERLAY.INVITATION</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3, marginBottom: 4 }}>{event.name}</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
              Hosted by <strong style={{ color: '#1a1a2e' }}>{hostName}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {event.event_date && <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>{event.event_date}</span>}
              {venueName && <span style={{ fontSize: 10, color: '#94a3b8' }}>{venueName}</span>}
              {event.prestige && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Prestige {event.prestige}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Script Line — Lala's voice reaction (not shown on screen, spoken by voice actor) */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Script Line — Lala's Voice</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {excitement >= 7 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>excited</span>}
            {excitement >= 4 && excitement < 7 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>interested</span>}
            {excitement < 4 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f0f0f0', color: '#666' }}>indifferent</span>}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.6, fontFamily: "'Lora', serif" }}>
          "{scriptLine}"
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 9, color: '#94a3b8' }}>
          <span>Excitement: {excitement}/10</span>
          {motivation && <span>Follow: {MOTIVATION_COLORS[motivation]?.label || motivation}</span>}
          <span>Asset: UI.OVERLAY.NOTIFICATION</span>
        </div>
      </div>

      {/* Flow indicator */}
      <div style={{ textAlign: 'center', padding: '8px 0', color: '#B8962E', fontSize: 11 }}>
        <strong>Mail Icon</strong> → <strong>Voice Icon</strong> (Lala speaks) → <strong>Tap</strong> → <strong>Invitation Opens</strong> (UI.OVERLAY.INVITATION)
      </div>
    </div>
  );
}

// ─── 4. FEED TIMELINE (STORY MODE) ─────────────────────────────────────────

export function FeedTimeline({ profiles, onSelectProfile }) {
  // Generate mock posts from profiles
  const posts = profiles
    .filter(p => p.sample_captions?.length > 0 || p.pinned_post)
    .flatMap(p => {
      const captions = p.sample_captions || [];
      const items = [];
      if (p.pinned_post) items.push({ profile: p, content: p.pinned_post, type: 'pinned', time: '2h' });
      captions.forEach((cap, i) => items.push({ profile: p, content: cap, type: 'post', time: `${3 + i * 4}h` }));
      return items;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 0' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: C.gold, marginBottom: 12, padding: '0 16px' }}>Lala's Feed — Story Mode</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {posts.map((post, i) => {
          const p = post.profile;
          const mc = MOTIVATION_COLORS[p.follow_motivation] || {};
          return (
            <div key={i} style={{ background: C.surface, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              {/* Post header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }} onClick={() => onSelectProfile(p)}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${mc.color || '#999'}, ${C.lavender})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                  {(p.display_name || p.handle || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{p.handle}</div>
                  <div style={{ fontSize: 9, color: C.inkLight }}>{post.time} ago{post.type === 'pinned' ? ' · Pinned' : ''}</div>
                </div>
                {p.follow_motivation && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: mc.bg, color: mc.color, fontWeight: 600 }}>{mc.label}</span>}
              </div>

              {/* Post content */}
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, marginBottom: 8 }}>{post.content}</div>

              {/* Lala's inner reaction */}
              {p.follow_trigger && (
                <div style={{ background: '#faf7f0', borderRadius: 8, padding: '6px 10px', borderLeft: `3px solid ${C.gold}`, marginTop: 6 }}>
                  <div style={{ fontSize: 9, color: C.gold, fontWeight: 700, marginBottom: 2 }}>LALA THINKS</div>
                  <div style={{ fontSize: 11, color: C.inkMid, fontStyle: 'italic' }}>
                    {p.follow_emotion === 'jealousy' && `Why does everything come so easy to her? I work twice as hard and get half the engagement.`}
                    {p.follow_emotion === 'excitement' && `Yes! This is exactly the kind of content I want to make. Taking notes.`}
                    {p.follow_emotion === 'anxiety' && `She makes it look effortless. Am I even doing this right?`}
                    {p.follow_emotion === 'admiration' && `Honestly... respect. She's really built something.`}
                    {p.follow_emotion === 'motivation' && `Okay, if she can do it, I can do it better. Time to step up.`}
                    {!p.follow_emotion && `Scrolling... scrolling... stop. Why did I stop on this?`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. RELATIONSHIP WEB ────────────────────────────────────────────────────

export function RelationshipWeb({ profiles, relationships = [], onSelectProfile }) {
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || profiles.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement?.offsetWidth || 600;
    const H = canvas.height = 500;

    // Position profiles in a circle
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) * 0.35;
    const nodes = profiles.slice(0, 20).map((p, i) => {
      const angle = (i / Math.min(profiles.length, 20)) * Math.PI * 2 - Math.PI / 2;
      return { ...p, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });

    ctx.clearRect(0, 0, W, H);

    // Draw connections
    const relColors = { collab: '#22c55e', rival: '#dc2626', couple: '#ec4899', ex: '#94a3b8', bestie: '#6366f1', feud: '#f59e0b', mentor: '#3b82f6', secret_link: '#92400e' };
    for (const rel of relationships) {
      const from = nodes.find(n => n.id === rel.source_profile_id || n.id === rel.profile_a_id);
      const to = nodes.find(n => n.id === rel.target_profile_id || n.id === rel.profile_b_id);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = (relColors[rel.relationship_type] || '#ddd') + '60';
      ctx.lineWidth = Math.max(1, (rel.drama_level || 1) / 3);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const mc = MOTIVATION_COLORS[node.follow_motivation] || {};
      const r = node.celebrity_tier === 'untouchable' ? 18 : node.celebrity_tier === 'exclusive' ? 14 : 10;

      // Glow for high beauty
      if (node.beauty_factor >= 7) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = mc.color || '#6366f1';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.fillText(node.handle?.slice(0, 12) || '', node.x, node.y + r + 14);
    }
  }, [profiles, relationships]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
        Relationship Web — {profiles.length} profiles
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {Object.entries(MOTIVATION_COLORS).map(([k, v]) => {
          const count = profiles.filter(p => p.follow_motivation === k).length;
          if (!count) return null;
          return <span key={k} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: v.bg, color: v.color, fontWeight: 600 }}>{v.label}: {count}</span>;
        })}
      </div>
      <div style={{ background: '#fafafa', borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  );
}
