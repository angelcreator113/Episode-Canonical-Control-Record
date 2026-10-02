/**
 * Display bug 3 (Evoni, 2026-10-02): "Images don't refresh as sets/angles
 * finish generating; the Beat Plan and Scenes tab update a beat's image
 * without a reload." While any beat says what it waits on is still
 * generating (location.generating, from GET /episode-brief/:id/plan), the
 * page re-reads the plan every PLAN_REFRESH_MS; it stops when none is.
 */
import { useEffect } from 'react';

export const PLAN_REFRESH_MS = 6000;

export const planIsGenerating = (plan) => (plan || []).some((b) => b?.location?.generating);

export default function usePlanRefresh(plan, refresh) {
  const generating = planIsGenerating(plan);
  useEffect(() => {
    if (!generating) return undefined;
    const timer = setTimeout(() => {
      Promise.resolve(refresh()).catch((err) => console.error('[BeatPlan] refresh failed:', err));
    }, PLAN_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [generating, plan, refresh]);
}
