/**
 * The Episode page's header and tabs in the Producer Mode style (Evoni's
 * Episode mock, 2026-10-05). Pure helpers over what the page already reads.
 */

/**
 * How many production checks are still open: the Production tab's
 * "N left" badge. checks is loadProductionChecks' { id: bool }, sections
 * the checklist's CHECKLIST_SECTIONS. Null until the checks are read.
 */
export function checklistLeft(checks, sections) {
  if (!checks || !sections) return null;
  const items = sections.flatMap((s) => s.items || []);
  return items.filter((i) => !checks[i.id]).length;
}

/** "1,900 coins", the header's balance chip. */
export function coinsLabel(balance) {
  const n = Number(balance);
  return Number.isFinite(n) ? `${n.toLocaleString()} coins` : null;
}
