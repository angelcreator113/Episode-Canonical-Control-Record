'use strict';

/**
 * Lala's coins in the script (Evoni, 2026-10-18). Pure: the writer's prompt
 * block, and the fix after writing.
 *
 * - She starts the episode with the balance before it; each piece of the
 *   look that costs her comes off as it goes on in the closet, its own
 *   `[STAT: coins -n]` right after its `[WEAR: id]` line; the event's other
 *   costs come off in the Recap Panel only; what she is owed is not paid in
 *   this episode. The Script tab adds the `[STAT: coins]` lines up from the
 *   balance before the episode (frontend/src/lib/beatState.js).
 * - Beat 9 reads the approved shopping list overlay, line by line.
 */

const { headerNumber } = require('./beatLabelNumber');
const { closetIndex } = require('./scriptWear');

const coins = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
// The episode overlay's own name for the approved list (episodeOverlaysService DOCUMENT_PIECES).
const SHOPPING_LIST_OVERLAY = 'Shopping list';

/** The writer's LALA'S COINS and SHOPPING LIST blocks; '' when there is no money. */
function moneyContext(money) {
  if (!money) return '';
  const out = [];
  if (money.balanceBefore != null || money.look.length) {
    const spent = money.look.reduce((n, p) => n + p.amount, 0);
    out.push("═══ LALA'S COINS ═══");
    if (money.balanceBefore != null) out.push(`Lala starts this episode with ${coins(money.balanceBefore)} coins. Every change to her coins is a [STAT: coins ±n] line; the Script tab adds them up from this number, so never say any other balance.`);
    if (money.look.length) {
      out.push('Her look costs her, piece by piece, as it goes on in the closet (Beat 8): right after the piece\'s [WEAR: id] line, its own coin line, exactly as written here:');
      for (const p of money.look) out.push(`- ${p.name}${p.id ? ` [WEAR: ${p.id}]` : ''}: [STAT: coins -${p.amount}]`);
      out.push('Every other piece of the look is already hers and costs nothing; no coin line for it.');
      if (money.balanceBefore != null) out.push(`After the look she has ${coins(money.balanceBefore - spent)} coins. JustAWoman may say the running balance as each piece comes off.`);
    }
    if (money.recap.length) out.push(`The event's own costs come off in the Recap Panel (Beat 13) only, never earlier: ${money.recap.map((c) => `${c.label} [STAT: coins -${c.amount}]`).join('; ')}.`);
    if (money.covered.length) out.push(`Covered by the host or brand, never charged to Lala: ${money.covered.map((c) => c.label).join('; ')}.`);
    if (money.income.length) out.push(`Owed to her but not paid in this episode (it is known next episode); never a coin line: ${money.income.map((c) => `${c.label} (${coins(c.amount)})`).join('; ')}.`);
  }
  if (money.shopping) {
    out.push('', '═══ APPROVED SHOPPING LIST ═══');
    for (const l of money.shopping.lines) {
      const what = l.pieces.length ? l.pieces.join(' + ') : null;
      const cost = !what ? 'not filled' : l.owned || !l.cost ? 'already hers' : `${coins(l.cost)} coins`;
      out.push(`- ${l.extra ? 'Also: ' : ''}${l.label}${what && !l.extra ? `: ${what}` : ''} — ${cost}`);
    }
    out.push(`Total: ${coins(money.shopping.total)} coins.`);
    out.push(`Beat 9 (Reminder/Deadline): JustAWoman reads off this approved list on screen, [UI:DISPLAY ${SHOPPING_LIST_OVERLAY}]: each line, the piece that filled it and its cost or that it was already hers, then the total${money.balanceBefore != null ? ', what Lala started with and what is left' : ''}. [UI:HIDE ${SHOPPING_LIST_OVERLAY}] when she is done. The list is read, not rewritten.`);
  } else {
    out.push('', 'No shopping list is approved for this event: Beat 9 reads her to-do list as it stands.');
  }
  return `\n${out.join('\n')}\n`;
}

const WEAR_LINE = /^\s*\[WEAR:\s*([^\]\s]+)\s*\]\s*$/i;
// A coin line in any form, as the Script tab adds them up
// (frontend/src/lib/beatState.js coinChange; Script page audit, 2026-10-19):
// `coins: -50`, a Unicode minus, `- 50`, `-1,200`, or coins in a tag with
// other stats. Otherwise a written coin line was missed and a second added.
const STAT_TAG = /^\s*\[STAT\s*:\s*(.*?)\s*\]\s*$/i;
const COINS_IN_TAG = /(?:^|[\s,;])coins\s*:?\s*([+\-\u2212\u2013\u2014]?)\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/i;
const isCoinLine = (line) => { const tag = String(line || '').match(STAT_TAG); return !!tag && COINS_IN_TAG.test(tag[1]); };
const BEAT_SPLIT = /(?=^[ \t]*##[ \t]*BEAT:)/im;
const HEADER = /^\s*##\s*BEAT:/i;

/**
 * The script with each costing piece's coin line right after its [WEAR: id]
 * line, where the writer left it out (the next two lines hold no coin line).
 * `skip`: beat positions never changed (approved beats). Returns
 * { script, added }.
 *
 * Only in the closet beat (Script page audit, 2026-10-19): the look is
 * paid for as it goes on in the closet, so a [WEAR:] in any other beat (the
 * Fashion Challenge's) charges nothing. The closet beat is the one that
 * opens the closet, else canonical beat 8 (utils/scriptWear.js closetIndex);
 * `closetNumber` names it instead, for one beat written on its own.
 */
function scriptWithCoinLines(scriptText, money, { skip = [], closetNumber = null } = {}) {
  const text = String(scriptText || '');
  const cost = new Map((money?.look || []).filter((p) => p.id).map((p) => [String(p.id), p.amount]));
  if (!cost.size) return { script: text, added: 0 };
  const parts = text.split(BEAT_SPLIT);
  const preamble = parts.length && !HEADER.test(parts[0]) ? parts.shift().trimEnd() : '';
  const beats = parts.map((part, i) => {
    const lines = part.split('\n');
    const label = ((lines[0] || '').match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim();
    return { number: headerNumber(label) || i + 1, lines: lines.slice(1).filter((l) => l.trim()) };
  });
  const closet = closetNumber == null ? closetIndex(beats) : beats.findIndex((b) => b.number === Number(closetNumber));
  if (closet < 0) return { script: text, added: 0 };
  const charged = new Set();
  let added = 0;
  const sections = parts.map((part, beatIndex) => {
    const section = part.trimEnd();
    if (beatIndex !== closet) return section;
    if (skip.includes(beatIndex)) {
      for (const l of section.split('\n')) { const m = l.match(WEAR_LINE); if (m) charged.add(m[1]); }
      return section;
    }
    const lines = section.split('\n');
    const next = [];
    let changed = false;
    lines.forEach((line, i) => {
      next.push(line);
      const m = line.match(WEAR_LINE);
      if (!m || !cost.has(m[1]) || charged.has(m[1])) return;
      charged.add(m[1]);
      const after = lines.slice(i + 1).filter((l) => l.trim()).slice(0, 2);
      if (after.some(isCoinLine)) return;
      next.push(`[STAT: coins -${cost.get(m[1])}]`);
      added += 1;
      changed = true;
    });
    return changed ? next.join('\n') : section;
  });
  if (!added) return { script: text, added: 0 };
  const body = sections.join('\n\n');
  return { script: preamble ? `${preamble}\n\n${body}` : body, added };
}

module.exports = { moneyContext, scriptWithCoinLines, SHOPPING_LIST_OVERLAY };
