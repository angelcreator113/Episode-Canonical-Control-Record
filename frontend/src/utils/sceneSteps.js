/**
 * The scenes' next step (L12): plan, images, locks, then the script. Shown
 * on the Production Checklist since S9 (c) (Evoni, 2026-10-02; §8(hh)):
 * "Plan → Images → Locks → Write Script guidance — Remove from this tab;
 * put stage-aware guidance on the episode Overview or Checklist."
 */

/** "4", "4 and 5", "4, 5 and 6". */
export const listBeats = (beats) => (beats.length < 2
  ? String(beats[0])
  : `${beats.slice(0, -1).join(', ')} and ${beats[beats.length - 1]}`);

/**
 * plan: the plan rows; readiness: planReadiness's { ready, total, not_ready };
 * coverage: the plan's beatPlanCoverage ({ complete, text }), when known.
 */
export function nextStep(plan, readiness, coverage) {
  const total = (plan || []).length;
  if (!total) return { kind: 'plan', text: 'Make the beat plan' };
  // Audit GATE-01 (2026-10-03): a plan short of the 14 beats is still at
  // the plan step, whatever its images and locks say.
  if (coverage && !coverage.complete) return { kind: 'plan', text: `Complete the beat plan: ${coverage.text}` };
  if (readiness && readiness.ready < readiness.total) {
    const beats = (readiness.not_ready || []).map((b) => b.beat_number);
    return { kind: 'images', text: `Add the missing images: ${beats.length === 1 ? 'beat' : 'beats'} ${listBeats(beats)}` };
  }
  if (plan.some((b) => !b.locked)) return { kind: 'lock', text: 'Lock the beats' };
  return { kind: 'script', text: 'Write the script' };
}
