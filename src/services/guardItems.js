'use strict';

/**
 * The franchise guard's canon check (the LalaVerse Show Bible "Check now",
 * 2026-10-06): POST /franchise-brain/guard may carry items instead of one
 * scene_brief, [{ key, label, brief }], checked in one call. These two
 * helpers clean the items and attribute each warning to one of them.
 */

const GUARD_MAX_ITEMS = 25;
const GUARD_ITEM_CHARS = 1200;

/**
 * The items, cleaned: null when the body sent none; a string (the 400's
 * error) when they are unusable; else [{ key, label, brief }] with each
 * brief cut to GUARD_ITEM_CHARS.
 */
function guardItems(raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length === 0) return 'items must be a non-empty array';
  if (raw.length > GUARD_MAX_ITEMS) return `at most ${GUARD_MAX_ITEMS} items per check`;
  const items = [];
  const seen = new Set();
  for (const it of raw) {
    const key = String(it?.key ?? '').trim();
    const brief = String(it?.brief ?? '').trim();
    if (!key || !brief || seen.has(key)) return 'each item needs a unique key and a brief';
    seen.add(key);
    items.push({ key, label: String(it?.label ?? key).slice(0, 200), brief: brief.slice(0, GUARD_ITEM_CHARS) });
  }
  return items;
}

/** The key of the item a warning names, or null when it names none that was sent. */
function itemOfWarning(warning, items) {
  const named = String(warning?.item ?? '').replace(/^\[|\]$/g, '').trim();
  return (items || []).some((it) => it.key === named) ? named : null;
}

module.exports = { GUARD_MAX_ITEMS, GUARD_ITEM_CHARS, guardItems, itemOfWarning };
