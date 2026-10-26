/**
 * What the Season page's round 3 AI buttons share (Evoni, 2026-10-26):
 * the Needs attention rows in the shape the server reads (services/
 * seasonAiHelpers: { kind, title, detail }, nothing else), and the error
 * text to show, the server's plain words first. A budget refusal (429
 * AI_BUDGET_EXCEEDED) already says, plainly, that nothing was asked.
 *
 *   attentionPayload(items)    → [{ kind, title, detail }] (at most 12)
 *   aiErrorText(err, fallback) → the message to show
 *   isBudgetError(err)         → true for a budget refusal
 *   seasonQuery(season)        → '?season=N' or ''
 */
export const ATTENTION_PAYLOAD_CAP = 12;

export function attentionPayload(items = []) {
  return (items || []).slice(0, ATTENTION_PAYLOAD_CAP).map((i) => ({ kind: i.kind || null, title: i.title || '', detail: i.detail || null }));
}

export const isBudgetError = (err) => err?.response?.status === 429 && err?.response?.data?.code === 'AI_BUDGET_EXCEEDED';

export function aiErrorText(err, fallback) {
  return err?.response?.data?.error || fallback;
}

export const seasonQuery = (season) => (season ? `?season=${encodeURIComponent(season)}` : '');
