/**
 * Episode Money Phase B, MB4 (docs/EVENT_EPISODE_FLOW.md §8(gg)): before
 * Complete, the episode's money warnings as one confirm message, or null
 * when nothing warns. A failed read logs and returns null: the warning never
 * stands in the way of Complete, whose own refusals stay.
 */
import api from '../services/api';

export async function completeMoneyWarning(showId, episodeId) {
  if (!showId || !episodeId) return null;
  try {
    const r = await api.get(`/api/v1/world/${showId}/episodes/${episodeId}/money`);
    const warnings = r.data?.data?.warnings || [];
    if (!warnings.length) return null;
    return `Money warning:\n${warnings.map((w) => `• ${w.message}`).join('\n')}\n\nComplete anyway?`;
  } catch (err) {
    console.error('[moneyWarnings] money warning read failed:', err);
    return null;
  }
}
