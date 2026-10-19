// The episode's three story layers (Evoni, 2026-10-17): the main plot (can
// Lala succeed at the event?), the personal subplot (what will success cost
// her?) and the larger arc (what is happening beneath this opportunity?),
// each from what the show already holds, never invented. A layer with
// nothing to draw on is a gap: the writer is told to keep it to this
// episode, and the Script tab shows it after writing.

const nameOf = (p) => p?.creator_name || p?.display_name || p?.handle || null;

function seasonThreads(sc) {
  const list = Array.isArray(sc?.story_purposes) ? sc.story_purposes : [];
  const purposes = [...list.filter((p) => p?.primary), ...list.filter((p) => p && !p.primary)]
    .map((p) => (p.text ? `${p.text}${p.story_thread ? ` (thread: ${p.story_thread})` : ''}` : p.story_thread ? `Continue the thread "${p.story_thread}"` : null))
    .filter(Boolean);
  if (!purposes.length && sc?.story_purpose) purposes.push(sc.story_purpose);
  const threads = [...new Set([...list.map((p) => p?.story_thread), sc?.story_thread].filter(Boolean))];
  return { purposes, threads };
}

function eventOutcomes(eventData) {
  let rewards = eventData?.rewards || {};
  if (typeof rewards === 'string') {
    try { rewards = JSON.parse(rewards || '{}'); } catch (err) { console.warn('[StoryLayers] event rewards did not parse:', err.message); rewards = {}; }
  }
  return Array.isArray(rewards?.outcomes) ? rewards.outcomes.filter(Boolean) : [];
}

/**
 * { text, gaps } for the writer's prompt. `gaps`: [{ layer, label }], one
 * per layer the show holds nothing for.
 */
function storyLayers({ brief = null, eventData = null, seasonContext = null, story = null, beat14 = null } = {}) {
  const { LALA_TIES } = require('../services/episodeScriptWriterService');
  const gaps = [];
  const lines = [];

  if (eventData?.name) {
    lines.push(`Main plot: can Lala succeed at ${eventData.name}?${eventData.narrative_stakes ? ` Stakes: ${eventData.narrative_stakes}` : ''}`);
    // Beat 12 is the runway walk (Evoni, 2026-10-19; Script page re-audit,
    // 2026-10-19: this still said "deliverable (12)").
    lines.push('  Runs: invitation (4–5) → strategy (6) → styling (8) → event outcome (11) → runway walk (12).');
  } else {
    gaps.push({ layer: 'main', label: 'No event is assigned, so the main plot has no event to resolve.' });
    lines.push('Main plot: NOT GIVEN (no event is assigned).');
  }

  const { purposes, threads } = seasonThreads(seasonContext);
  if (purposes.length) {
    lines.push(`Personal subplot, what success will cost her: ${purposes[0]}`);
  } else {
    gaps.push({ layer: 'personal', label: "No season story purpose or thread is set for Lala's personal story." });
    lines.push("Personal subplot: NOT GIVEN (no season story purpose or thread). Let her worry come from this episode alone.");
  }
  lines.push('  Runs: welcome (3) → complication (7) → difficult choice (8–11) → relationship consequence (11).');

  const outcomes = eventOutcomes(eventData);
  const hook = typeof brief?.forward_hook === 'string' ? brief.forward_hook.trim() : '';
  const arc = [...threads.map((t) => `thread "${t}"`), ...outcomes, ...(hook ? [`forward hook: ${hook}`] : [])];
  if (arc.length) {
    lines.push(`Larger arc: ${arc.join('; ')}`);
    lines.push('  Runs: one subtle clue during the episode → a connected question in beat 14. Move it forward; it need not be solved.');
  } else {
    gaps.push({ layer: 'arc', label: 'No season thread, event outcome or forward hook is set for the larger arc.' });
    lines.push('Larger arc: NOT GIVEN (no season thread, event outcome or forward hook).');
  }

  const tied = (story?.socialProfiles || [])
    .filter((p) => nameOf(p) && LALA_TIES[p.lala_relationship] && p.lala_relationship !== 'justawoman')
    .map((p) => `${nameOf(p)} (${LALA_TIES[p.lala_relationship]})`);
  if (tied.length) {
    lines.push(`Beat 7 message, from someone with an established tie to Lala: ${tied.slice(0, 5).join('; ')}`);
  } else {
    gaps.push({ layer: 'sender', label: 'No one at the event has an established tie to Lala to send the beat 7 message.' });
    lines.push('Beat 7 message: NO ESTABLISHED SENDER. Whoever sends it is someone Lala does not know well yet; give them no shared history.');
  }

  // Beat 14's second message is the attached opportunity's invitation when
  // it comes, not optional (Script page re-audit, 2026-10-19).
  const { beat14Outcome } = require('./beat14Invitation');
  const second = beat14Outcome(beat14, brief?.designed_intent || null) === 'invitation'
    ? 'a second at beat 14 is the invitation (BEAT 14 OPPORTUNITY), and only that'
    : 'a second at beat 14 optional';
  const text = `
═══ STORY LAYERS ═══
${lines.join('\n')}

- Use what is given here and above without forcing it. Where a layer is NOT GIVEN, never invent established history for it (an old friendship, a past event, a running feud); keep it to this episode.
- What the writer knows is not what the characters know. Lala's private worry may shape how she reacts; whoever messages her mentions only what they could plausibly know.
- Messages: one private exchange at beat 7 is the default, ${second}. The invitation, the closet, the to-do list, travel and the post already keep the phone busy; never add messages to fill a quota.
- Beat 11 resolves this episode's main event before beat 14 opens the next question. The cliffhanger deepens the larger story; it never stands in for this episode's payoff.
- Each beat does its own Story job (SCENE PLAN below) and does not repeat what an earlier beat already said.
`;
  return { text, gaps };
}

module.exports = { storyLayers };
