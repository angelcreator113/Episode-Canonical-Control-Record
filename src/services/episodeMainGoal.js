'use strict';

/**
 * Her goal in the script, and how her stress and self-talk shape her voice
 * (Evoni, 2026-10-25: "How do goals affect evaluation and the script…" —
 * "Yes build the goals and stress script work").
 *
 * Which goal is the episode's main one is chosen in one place only,
 * scriptCareerService.loadEpisodeGoal (goal-ladders' pickMainGoal, the rule
 * mainGoalForEvent uses); this module only describes
 * the chosen goal and writes the prompt blocks. Goals never change the score
 * or the stress; they change what she weighs at Beat 6 and feels at Beat 13.
 *
 * Both writers read these blocks through storyContextBlocks
 * (episodeScriptWriterService), so the old Script Writer and the Script
 * tab's writer say the same. No AI call here: prompt text only.
 *
 *   describeGoal(goal, goals, state, kind)                     the goal as the writers and the tab read it
 *   herGoalBlock(goal)                                         prompt text, '' with none
 *   herVoiceBlock({ stress, tone })                            prompt text
 */

const METRIC_LABEL = {
  coins: 'coins',
  reputation: 'reputation',
  brand_trust: 'brand trust',
  influence: 'influence',
  stress: 'stress',
  followers: 'followers',
  engagement_rate: 'engagement',
  portfolio_strength: 'portfolio strength',
  consistency_streak: 'consistency streak',
};
const metricLabel = (m) => METRIC_LABEL[m] || String(m || '').replace(/_/g, ' ');
// A stat she keeps under, not one she climbs.
const DOWN = new Set(['stress']);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[MainGoal] a JSON field could not be read:', err.message);
    return fallback;
  }
}

/** How far along the goal is, 0–1 (1 reached), from its start to its target. */
function progressOf(goal, current) {
  const target = num(goal.target_value);
  if (target === null || current === null) return null;
  const down = DOWN.has(goal.target_metric);
  const start = num(goal.starting_value) ?? (down ? 10 : 0);
  if (down ? current <= target : current >= target) return 1;
  const span = down ? start - target : target - start;
  if (span <= 0) return 0;
  const done = down ? start - current : current - start;
  return Math.max(0, Math.min(1, done / span));
}

/** The progress in words, for the writer (who never says a number). */
function howClose(progress) {
  if (progress === null) return 'progress not measured';
  if (progress >= 1) return 'reached';
  if (progress >= 0.75) return 'nearly there';
  if (progress >= 0.5) return 'more than halfway';
  if (progress >= 0.25) return 'on her way';
  return 'just starting';
}

/** Lower rungs first: by target (highest first for a stat to keep under), then priority. */
function byRung(a, b) {
  const dir = DOWN.has(a.target_metric) ? -1 : 1;
  return dir * ((num(a.target_value) || 0) - (num(b.target_value) || 0))
    || (num(a.priority) ?? 3) - (num(b.priority) ?? 3);
}

/**
 * The goal as the writers and the Script tab read it, with its next rung:
 * the next active goal on the same stat past this one's target, else what
 * completing it opens (unlocks_on_complete's first named item).
 */
function describeGoal(goal, goals, state, kind) {
  const metric = goal.target_metric || 'custom';
  const fromState = state && metric in state ? num(state[metric]) : null;
  const current = fromState ?? num(goal.current_value);
  const target = num(goal.target_value);
  const progress = metric === 'custom' ? null : progressOf(goal, current);
  const down = DOWN.has(metric);
  const next = metric === 'custom' || target === null ? null : (goals || [])
    .filter((g) => String(g.id) !== String(goal.id) && g.target_metric === metric && num(g.target_value) !== null
      && (down ? num(g.target_value) < target : num(g.target_value) > target))
    .sort(byRung)[0] || null;
  const unlocks = parseJson(goal.unlocks_on_complete, []);
  const opens = Array.isArray(unlocks) ? (unlocks.find((u) => u && typeof u.name === 'string' && u.name.trim())?.name.trim() || null) : null;
  return {
    id: goal.id,
    title: String(goal.title || '').trim() || 'Her goal',
    description: goal.description || null,
    kind,
    metric,
    metric_label: metricLabel(metric),
    current,
    target,
    progress,
    how_close: howClose(progress),
    next: next ? { id: next.id, title: next.title, target: num(next.target_value) } : null,
    opens: next ? null : opens,
  };
}

const fmt = (v) => (v === null || v === undefined ? '?' : Number(v).toLocaleString('en-US'));

/** HER GOAL THIS EPISODE, for both writers; '' with no goal. */
function herGoalBlock(goal) {
  if (!goal) return '';
  const where = goal.metric === 'custom'
    ? `${goal.how_close}`
    : `${goal.metric_label} ${fmt(goal.current)} → ${fmt(goal.target)}, ${goal.how_close}`;
  const why = goal.kind === 'main'
    ? 'Her main goal for this episode: Evoni pinned this event to it.'
    : 'Suggested: the goal this event moves most; no goal is pinned to it.';
  const lines = [
    '═══ HER GOAL THIS EPISODE ═══',
    `${goal.title} (${where}). ${why}`,
  ];
  if (goal.description) lines.push(`What it means to her: ${String(goal.description).trim()}`);
  if (goal.next) lines.push(`Next rung after it: ${goal.next.title}.`);
  else if (goal.opens) lines.push(`Reaching it opens: ${goal.opens}.`);
  lines.push(`SCRIPT DIRECTIVE: Beat 6 (Strategic Reaction): Lala weighs this episode against ${goal.title} in her own words: what the night could do for it and what it risks. Beat 13 (Recap Panel): she feels where the night leaves her on it: closer, stalled or set back. Felt, never stated: no numbers, no stat names, never read out like a list.`);
  return `${lines.join('\n')}\n`;
}

const SELF_TALK = {
  hard: 'Hard on herself: blunt and self-critical, she holds herself to account, even for what went right.',
  honest: 'Honest: she names what worked and what didn\'t, plainly, without cruelty and without sugar.',
  kind: 'Kind: gentle and forgiving, she finds what she did well and lets the rest go.',
};

/** Her voice by her stress (0–10), and Beat 13's self-talk tone. */
function stressVoice(stress) {
  const s = num(stress);
  if (s === null) return null;
  if (s <= 3) return 'Playful and sure of herself: the jokes land, she trusts her eye, her inner voice is on her side.';
  if (s <= 6) return 'Sharper: the confidence is still there, but a doubting inner voice (Lala (V.O.) and her thoughts) second-guesses her choices.';
  return 'Spiralling: her inner voice is loud and catastrophising ("I can\'t afford another flop"); she is still on her feet, just barely holding it together.';
}

/**
 * HER VOICE: how her stress shapes how she talks, and the tone of her
 * self-talk at Beat 13, which overrides that beat's usual tone. `tone` null
 * (none saved) is Honest.
 */
function herVoiceBlock({ stress = null, tone = null } = {}) {
  const t = SELF_TALK[tone] ? tone : 'honest';
  const lines = ['═══ HER VOICE ═══'];
  const voice = stressVoice(stress);
  if (voice) lines.push(`Her stress (${Math.round(Number(stress))}/10) shapes how she talks and thinks this episode: ${voice}`);
  lines.push(`Beat 13 (Recap Panel) self-talk: ${SELF_TALK[t]} This tone overrides Beat 13's usual reflection tone.`);
  lines.push("SCRIPT DIRECTIVE: Stats are felt, never stated: her stress shows in her words, pace and inner voice, never as a number or the word \"stress\" read off a screen.");
  return `${lines.join('\n')}\n`;
}

module.exports = {
  describeGoal, progressOf, howClose, herGoalBlock, herVoiceBlock, stressVoice,
};
