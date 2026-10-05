/**
 * Show more / Show less for the Event Package's long lists (Evoni,
 * 2026-10-05: "place section needs a show less/show more and maybe other
 * sections"). The first `limit` items show; the rest wait behind the toggle.
 */

/** { shown, hidden }: the items to render and how many are folded away. */
export function visibleSlice(items, open, limit) {
  const list = items || [];
  if (open || list.length <= limit) return { shown: list, hidden: 0 };
  return { shown: list.slice(0, limit), hidden: list.length - limit };
}

/** The toggle's label: "Show 3 more" (or "Show 3 more parts"), else "Show less". */
export function showMoreLabel(open, hidden, noun = '') {
  if (open) return 'Show less';
  return `Show ${hidden} more${noun ? ` ${noun}` : ''}`;
}
