/**
 * Production → Money, to Evoni's Episode mock: three tiles (Earns, Spends,
 * Net estimate) over "Every line in the estimate", each line saying where it
 * comes from and when it is charged or paid, then where the deal terms
 * stand. Pure: everything comes from GET /world/:showId/episodes/:id/money
 * (src/services/episodeMoneyLines.js buildMoneyLines).
 *
 * The rows add up to the projected net exactly: a posted line counts its
 * ledger row, a planned or pending line its amount; a conditional bonus, a
 * bonus not earned and a comped cost count 0 (Q3, Q8); a posted row no
 * line matches counts as it posted.
 *
 * Lala's look (2026-10-06): the server plans a line per piece Finalize
 * charges (src/services/episodeLookCharges.js); the page shows them as one
 * "Lala's look" row, at Finalize, Planned until every piece has posted. A
 * look not chosen yet reads "Not chosen"; one whose pieces are all owned
 * reads "All owned".
 */

const DEAL_CATEGORIES = new Set(['appearance_fee', 'partnership_base_fee', 'performance_fee', 'content_fee', 'deal_bonus', 'content_revenue']);

const SOURCE = {
  appearance_fee: 'Deal',
  partnership_base_fee: 'Deal',
  performance_fee: 'Deal',
  deal_bonus: 'Deal',
  content_fee: 'Deal · Paid content',
  content_revenue: 'Deal · Content revenue',
  event_payment: 'Event payment',
  event_entry: 'Event cost',
  event_cost: 'Event cost',
  event_spending: 'Event spending',
  styling_extras: 'Event extras',
  wardrobe_purchase: 'Wardrobe · bought',
  wardrobe_rental: 'Wardrobe · rented',
};

const STATE_CHIP = {
  planned: 'Planned',
  pending: 'Pending',
  posted: 'Posted',
  not_earned: 'Not earned',
};

const coins = (n) => Number(n || 0).toLocaleString();
export const signedCoins = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coins(Math.abs(n))}`;
const words = (s) => String(s || '').replace(/_/g, ' ');
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const day = (date) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Who pays or covers the line (MB2). */
export function payerText(line) {
  const who = line.payer?.who;
  const name = line.payer?.name || (who === 'brand' ? 'the brand' : who === 'host' ? 'the host' : null);
  if (line.covered) return `comped by ${name || 'the host'}`;
  if (who === 'lala') return 'Lala pays';
  return name ? `Paid by ${name}` : 'Paid by the host';
}

/** What a line adds to the estimate. */
export function lineCounts(line) {
  if (line.posted) return Number(line.posted.signed) || 0;
  if (line.covered || line.conditional || line.state === 'not_earned') return 0;
  return Number(line.signed) || 0;
}

/**
 * The estimate's rows: { key, label, source, when, amount, amountText, chip,
 * chipKind, counts }. A deal with no bonus tier gets a "None in deal" row,
 * as in the mock.
 */
const isLookLine = (l) => l.look === true || l.source?.type === 'wardrobe';

function lookRow(money, lookLines) {
  if (lookLines.length) {
    const counts = lookLines.reduce((s, l) => s + lineCounts(l), 0);
    const open = lookLines.filter((l) => !l.posted).length;
    const paid = lookLines.length - open;
    const parts = [open ? `${open} to buy` : null, paid ? `${paid} bought` : null].filter(Boolean).join(', ');
    return {
      key: 'look', label: "Lala's look", source: `Wardrobe · ${parts}`, when: 'At Finalize',
      amount: counts, amountText: signedCoins(counts), chip: open ? 'Planned' : 'Posted',
      chipKind: open ? 'planned' : 'posted', counts,
      pieces: lookLines.map((l) => l.label),
    };
  }
  if (!money?.event || !money.look) return null;
  const chosen = money.look.pieces > 0;
  // Nothing to charge is not always "all owned": gifted and borrowed pieces
  // cost nothing too (Evoni, 2026-10-07).
  return {
    key: 'look', label: "Lala's look", source: chosen ? 'Wardrobe · nothing to buy or rent' : 'Wardrobe · to-buy pieces',
    when: 'At Finalize', amount: 0, amountText: chosen ? '0' : '—', chip: chosen ? 'Nothing to pay' : 'Not chosen',
    chipKind: chosen ? 'none' : 'missing', counts: 0,
  };
}

export function estimateRows(money) {
  const all = money?.lines || [];
  const lookLines = all.filter(isLookLine);
  const lines = all.filter((l) => !isLookLine(l));
  const rows = lines.map((l) => {
    const counts = lineCounts(l);
    let amountText = signedCoins(counts);
    let chip = STATE_CHIP[l.state] || capital(words(l.state));
    if (l.covered) {
      amountText = '0';
      chip = l.covered_amount ? `Comped ${coins(l.covered_amount)}` : 'Comped';
    } else if (l.conditional && l.state === 'planned') {
      amountText = `up to ${signedCoins(l.signed)}`;
      chip = `If ${String(l.tier || '').toUpperCase()}`;
    } else if (l.state === 'not_earned') {
      amountText = '0';
    }
    return {
      key: l.key,
      label: l.label,
      source: `${SOURCE[l.category] || capital(words(l.category)) || 'Terms'} · ${payerText(l)}`,
      // A covered line is never charged; it used to read "At Complete".
      when: l.covered ? 'Not charged' : capital(l.trigger || 'at Complete'),
      amount: counts,
      amountText,
      chip,
      chipKind: l.covered ? 'covered' : l.conditional && l.state === 'planned' ? 'conditional' : l.state,
      counts,
    };
  });
  const look = lookRow(money, lookLines);
  if (look) rows.push(look);
  const isDeal = lines.some((l) => DEAL_CATEGORIES.has(l.category));
  if (isDeal && !lines.some((l) => l.category === 'deal_bonus')) {
    rows.push({
      key: 'no-bonus', label: 'Performance bonus', source: 'Deal', when: 'At Complete',
      amount: 0, amountText: '0', chip: 'None in deal', chipKind: 'none', counts: 0,
    });
  }
  for (const r of money?.unplanned || []) {
    const counts = Number(r.signed) || 0;
    rows.push({
      key: `unplanned-${r.id}`,
      unplannedId: r.id,
      label: r.description || capital(words(r.category)),
      source: SOURCE[r.category] || capital(words(r.category)),
      when: r.date ? `Posted ${day(r.date)}` : 'Posted',
      amount: counts,
      amountText: signedCoins(counts),
      chip: 'Posted, not planned',
      chipKind: 'posted',
      counts,
    });
  }
  return rows;
}

const listOf = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** The three tiles: Earns, Spends and the Net estimate, from the rows. */
export function moneyTiles(money) {
  const rows = estimateRows(money);
  const earns = rows.filter((r) => r.counts > 0);
  const spends = rows.filter((r) => r.counts < 0);
  const lines = money?.lines || [];
  const comped = lines.filter((l) => l.covered).map((l) => l.label);
  const earnsTotal = earns.reduce((s, r) => s + r.counts, 0);
  const spendsTotal = spends.reduce((s, r) => s + r.counts, 0);

  let earnsNote = 'Nothing to earn yet';
  if (earns.length === 1) earnsNote = `${earns[0].label}, ${earns[0].when.toLowerCase()}`;
  else if (earns.length > 1) earnsNote = `${earns.length} lines: ${listOf(earns.map((r) => r.label))}`;

  let spendsNote = spends.length ? listOf(spends.map((r) => r.label)) : 'Nothing to pay';
  if (comped.length) spendsNote += `; ${listOf(comped)} ${comped.length === 1 ? 'is' : 'are'} comped`;

  const projection = money?.projection || null;
  return {
    earns: { total: earnsTotal, note: earnsNote },
    spends: { total: spendsTotal, note: spendsNote },
    net: {
      total: projection ? projection.projected_net : earnsTotal + spendsTotal,
      conditional: projection?.conditional || [],
      balance: projection ? { now: projection.actual_balance, after: projection.projected_balance } : null,
    },
  };
}

/** Where the deal terms stand, under the estimate (null without an event). */
export function termsNote(money) {
  // Only an event with deal terms has terms to lock (Evoni, 2026-10-07).
  if (!money?.event || money.event.deal === false) return null;
  const draft = money.spending ? money.spending.editable !== false : true;
  return draft
    ? 'Deal terms are locked at Start Episode. The episode is still a draft, so they can be reopened.'
    : 'Deal terms were locked at Start Episode. The episode is complete, so they stay as they are.';
}
