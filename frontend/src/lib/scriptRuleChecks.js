// The show's rules the writer is told, checked in the script (Evoni's rulings
// below, each where it was made). src/utils/scriptRuleChecks.js is the same
// code for the server, whose fix pass asks the writer to mend a missing one
// in its beat (utils/scriptCoverage); a parity test keeps them the same.
//
// - Beat 8: each piece of the look that costs her comes off as it goes on,
//   its own [STAT: coins -n] right after its [WEAR: id] line (Evoni,
//   2026-10-18; src/utils/scriptMoney.js moneyContext).
// - Beat 9 reads the approved shopping list on screen, [UI:DISPLAY Shopping
//   list] … [UI:HIDE Shopping list] (Evoni, 2026-10-18; scriptMoney.js).
// - Beat 12, The Fashion Challenge, is judged on her standing, never on
//   money: [STAT: reputation ±n], [STAT: brand_trust ±n], [STAT: influence
//   ±n], [STAT: stress ±n] (Evoni, 2026-10-18; canonicalBeats beat 12).
// - Beat 13: Lala says how the outcome feels (Evoni, 2026-10-17), and the
//   event's own costs come off there only, never earlier; what she is owed
//   is not paid in this episode, so it is never a coin line (Evoni,
//   2026-10-18). Coins change only in beat 8 and beat 13.
// - JustAWoman on camera (Evoni, 2026-10-17; PR #3347): at least once she
//   lets Lala's scene play while she watches in silence, (JustAWoman
//   watches, silent.). The only part of that rule a script shows by its
//   lines; her reactions themselves are the writer's to judge.
//
// Coin lines are read here with their own tolerant reading: `coins -50`,
// `coins: -50`, a typographic minus, `-1,200`, and several stats in one tag.

// BEGIN SHARED
const STAT_TAG = /^\s*\[\s*STAT\s*:\s*(.*?)\s*\]\s*$/i;
const STAT_ENTRY = /([a-z][a-z_]*(?:[ \t]+[a-z][a-z_]*)?)\s*:?\s*([+\-−–]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/gi;
const WEAR_CUE = /^\s*\[\s*WEAR\s*:\s*([^\]]*?)\s*\]\s*$/i;
const UI_CUE = /^\s*\[\s*UI\s*:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/i;
const LALA_SAYS = /^\s*lala\s*(?:\(([^)]*)\))?\s*:\s*\S/i;
const SILENT_WATCH = /^\s*(?:(?:me|justawoman|jawihp|prime)\s*:\s*)?\((?=[^)]*\bsilen(?:t|ce|tly)\b)[^)]*\)\s*\.?\s*$/i;
// The episode overlay's own name for the approved list (src/utils/scriptMoney.js SHOPPING_LIST_OVERLAY).
const SHOPPING_LIST = 'Shopping list';
const CLOSET_BEAT = 8;
const LIST_BEAT = 9;
// JustAWoman's silent watch has no beat of its own; it is asked of beat 11,
// the beat the event's people carry, not the phone (canonicalBeats beat 11).
const PLAYS_BEAT = 11;
const CHALLENGE_BEAT = 12;
const RECAP_BEAT = 13;
const JUDGED_ON = ['reputation', 'brand_trust', 'influence', 'stress'];

/** A [STAT:] tag's entries as [{ stat, value }], else null when the line is no stat tag. */
function statEntries(line) {
  const m = String(line ?? '').match(STAT_TAG);
  if (!m) return null;
  return [...m[1].matchAll(STAT_ENTRY)].map((e) => {
    const n = Number(e[3].replace(/,/g, ''));
    return { stat: e[1].toLowerCase().replace(/\s+/g, '_'), value: e[2] && e[2] !== '+' ? -n : n };
  });
}

/** The coins a line changes (signed), else null. */
function coinChange(line) {
  const c = (statEntries(line) || []).find((e) => e.stat === 'coins');
  return c ? c.value : null;
}

const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
const coinTag = (n) => `[STAT: coins ${signed(n)}]`;
const the = (name) => (/^the\s/i.test(String(name)) ? String(name) : `the ${name}`);
const linesOf = (b) => (b?.lines || []).map((l) => String(l ?? '')).filter((l) => l.trim());
const beatAt = (beats, n) => beats.find((b) => b.number === n) || null;
const ui = (line) => { const m = line.match(UI_CUE); return m ? { verb: m[1].toUpperCase(), target: m[2] } : null; };
const isList = (target) => target.trim().toLowerCase() === SHOPPING_LIST.toLowerCase();
const more = (list) => (list.length > 1 ? ` (+${list.length - 1} more)` : '');

// The closet beat: the one given, else the one that opens the closet, else beat 8.
function closetOf(beats, closetNumber) {
  if (closetNumber) return closetNumber;
  const opens = beats.find((b) => linesOf(b).some((l) => { const m = ui(l); return !!m && m.verb === 'OPEN' && /closet/i.test(m.target); }));
  return opens ? opens.number : CLOSET_BEAT;
}

/**
 * What the show's rules find in the script. `beats`: [{ number, lines }]
 * (lines under the header). `money`: { look: [{ id, name, amount }], recap:
 * [{ label, amount }] } or null when not read (no coin checks then);
 * `shoppingApproved`: true when the event's shopping list is approved (beat
 * 9 is checked only then); `closetNumber`: the closet beat, when known;
 * `complete`: every canonical beat is in the script (the "at least once"
 * rule is judged only then). Each finding: { key, ok, beat, text, label,
 * ask } where beat is the beat that carries it and ask, when not ok, is
 * what the writer is asked to write in that beat.
 */
function scriptRuleFindings(beats = [], { money = null, shoppingApproved = null, closetNumber = null, complete = false } = {}) {
  const out = [];
  const look = (money?.look || []).filter((p) => p && p.id != null && Math.round(Number(p.amount)) > 0)
    .map((p) => ({ id: String(p.id), name: p.name || String(p.id), amount: Math.round(Number(p.amount)) }));
  const recap = (money?.recap || []).filter((c) => c && Math.round(Number(c.amount)) > 0)
    .map((c) => ({ label: c.label || 'the event cost', amount: Math.round(Number(c.amount)) }));
  const recapFor = (n) => recap.find((c) => -c.amount === n) || null;
  const closet = closetOf(beats, closetNumber);
  // The closet beat's coin lines that belong to a piece of the look.
  const pieceCoins = new Set();

  // Beat 8: each costing piece's coin line right after its [WEAR: id] line,
  // before the next piece goes on (within the next two lines).
  const closetBeat = beatAt(beats, closet);
  if (money && look.length && closetBeat) {
    const lines = linesOf(closetBeat);
    let checked = 0;
    for (const p of look) {
      const at = lines.findIndex((l) => { const m = l.match(WEAR_CUE); return !!m && m[1] === p.id; });
      if (at < 0) continue; // not put on here: the look's own checks say so
      checked += 1;
      let coin = null;
      for (let i = at + 1; i < Math.min(lines.length, at + 3) && !WEAR_CUE.test(lines[i]); i += 1) {
        const c = coinChange(lines[i]);
        if (c !== null) { coin = { value: c, i }; break; }
      }
      if (coin) pieceCoins.add(coin.i);
      if (!coin) {
        out.push({
          key: `beat8-${p.id}`, ok: false, beat: closet, label: `${p.name}: ${coinTag(-p.amount)}`,
          text: `Beat ${closet}: ${the(p.name)} goes on without its coin line ${coinTag(-p.amount)}.`,
          ask: `Right after the [WEAR: ${p.id}] line, write the coin line for "${p.name}" on its own line, exactly: ${coinTag(-p.amount)}`,
        });
      } else if (coin.value !== -p.amount) {
        out.push({
          key: `beat8-${p.id}`, ok: false, beat: closet, label: `${p.name}: ${coinTag(-p.amount)}`,
          text: `Beat ${closet}: ${the(p.name)} comes off as ${signed(coin.value)} coins; it costs ${coinTag(-p.amount)}.`,
          ask: `The coin line right after [WEAR: ${p.id}] ("${p.name}") is exactly ${coinTag(-p.amount)}, not ${coinTag(coin.value)}.`,
        });
      }
    }
    if (checked && !out.some((f) => f.key.startsWith('beat8-'))) {
      out.push({ key: 'beat8', ok: true, beat: closet, label: 'The look comes off her coins', text: `Beat ${closet}: each piece Lala buys comes off her coins as it goes on.`, ask: null });
    }
  }

  // Beat 9: JustAWoman reads the approved shopping list on screen.
  const listBeat = beatAt(beats, LIST_BEAT);
  if (shoppingApproved === true && listBeat) {
    const lines = linesOf(listBeat);
    const shown = lines.findIndex((l) => { const m = ui(l); return !!m && m.verb === 'DISPLAY' && isList(m.target); });
    const hidden = shown >= 0 && lines.slice(shown + 1).some((l) => { const m = ui(l); return !!m && m.verb === 'HIDE' && isList(m.target); });
    const ask = `JustAWoman reads off the approved shopping list on screen: [UI:DISPLAY ${SHOPPING_LIST}] on its own line, each line of the list, the piece that filled it and its cost, then the total, and [UI:HIDE ${SHOPPING_LIST}] when she is done. The list is read, not rewritten.`;
    if (shown < 0) out.push({ key: 'beat9', ok: false, beat: LIST_BEAT, label: `[UI:DISPLAY ${SHOPPING_LIST}]`, text: `Beat ${LIST_BEAT}: the approved shopping list never comes up: [UI:DISPLAY ${SHOPPING_LIST}].`, ask });
    else if (!hidden) out.push({ key: 'beat9', ok: false, beat: LIST_BEAT, label: `[UI:HIDE ${SHOPPING_LIST}]`, text: `Beat ${LIST_BEAT}: the shopping list comes up and is never put away: [UI:HIDE ${SHOPPING_LIST}].`, ask });
    else out.push({ key: 'beat9', ok: true, beat: LIST_BEAT, label: 'The shopping list is read', text: `Beat ${LIST_BEAT}: JustAWoman reads the approved shopping list on screen.`, ask: null });
  }

  // Beat 12: judged on her standing, never on money.
  const challenge = beatAt(beats, CHALLENGE_BEAT);
  if (challenge) {
    const lines = linesOf(challenge);
    const moved = new Set(lines.flatMap((l) => (statEntries(l) || []).map((e) => e.stat)));
    const unmoved = JUDGED_ON.filter((s) => !moved.has(s));
    if (unmoved.length) {
      out.push({
        key: 'beat12', ok: false, beat: CHALLENGE_BEAT, label: unmoved.map((s) => `[STAT: ${s} ±n]`).join(' '),
        text: `Beat ${CHALLENGE_BEAT}: the room's verdict doesn't move her ${unmoved.join(', ')}: ${unmoved.map((s) => `[STAT: ${s} ±n]`).join(' ')}.`,
        ask: `The room's verdict on the challenge look moves her standing, each on its own line: ${JUDGED_ON.map((s) => `[STAT: ${s} ±n]`).join(', ')}; never coins.`,
      });
    } else {
      out.push({ key: 'beat12', ok: true, beat: CHALLENGE_BEAT, label: 'Judged on her standing', text: `Beat ${CHALLENGE_BEAT} is judged on her reputation, brand trust, influence and stress.`, ask: null });
    }
    const coins = lines.map(coinChange).filter((n) => n !== null);
    if (coins.length) {
      out.push({
        key: 'beat12-coins', ok: false, beat: CHALLENGE_BEAT, label: coinTag(coins[0]),
        text: `Beat ${CHALLENGE_BEAT}: a coin line ${coinTag(coins[0])}${more(coins)}; the challenge is judged on her standing, never on money.`,
        ask: 'No coin line in this beat: the challenge is judged on her standing (reputation, brand_trust, influence, stress), never on money.',
      });
    }
  }

  // Beat 13: Lala says how the outcome feels, in her own words.
  const recapBeat = beatAt(beats, RECAP_BEAT);
  if (recapBeat) {
    const says = linesOf(recapBeat).some((l) => { const m = l.match(LALA_SAYS); return !!m && !/v\.?\s*o\.?/i.test(m[1] || ''); });
    out.push(says
      ? { key: 'beat13', ok: true, beat: RECAP_BEAT, label: 'Lala has her line', text: `Beat ${RECAP_BEAT}: Lala says how the outcome feels.`, ask: null }
      : { key: 'beat13', ok: false, beat: RECAP_BEAT, label: "Lala's line", text: `Beat ${RECAP_BEAT}: Lala never says how the outcome feels.`, ask: 'Lala says how the outcome feels, in her own words, as one spoken line (Lala: …); the numbers stay on the stat card, which she does not see.' });
  }

  // Coins change only in beat 8 (the look) and beat 13 (the event's own
  // costs); what she is owed is never a coin line. Beat 12 has its own row.
  if (money) {
    for (const b of beats) {
      if (b.number === CHALLENGE_BEAT) continue;
      const flags = [];
      linesOf(b).forEach((l, i) => {
        const n = coinChange(l);
        if (n === null) return;
        const cost = recapFor(n);
        if (n > 0) flags.push({ text: `a coin line pays her ${coinTag(n)}; what she is owed is not paid in this episode`, ask: `Take out the coin line ${coinTag(n)}: what Lala is owed is not paid in this episode.` });
        else if (b.number === RECAP_BEAT) return;
        else if (b.number === closet && pieceCoins.has(i)) return;
        else if (cost) flags.push({ text: `${the(cost.label)} comes off here ${coinTag(n)}; it comes off in beat ${RECAP_BEAT} only`, ask: `Take out the coin line ${coinTag(n)}: ${the(cost.label)} comes off in beat ${RECAP_BEAT} (the Recap Panel) only.` });
        else if (b.number !== closet) flags.push({ text: `a coin line ${coinTag(n)}; her coins change only in beat ${closet} (the look) and beat ${RECAP_BEAT} (the event's costs)`, ask: `Take out the coin line ${coinTag(n)}: Lala's coins change only in beat ${closet} (each piece of the look) and beat ${RECAP_BEAT} (the event's own costs).` });
      });
      if (flags.length) {
        out.push({ key: `coins-${b.number}`, ok: false, beat: b.number, label: flags[0].text, text: `Beat ${b.number}: ${flags[0].text}${more(flags)}.`, ask: flags.map((f) => f.ask).join(' ') });
      }
    }
    // The event's own costs come off in beat 13: each its own line, or all
    // of them together.
    if (recap.length && recapBeat) {
      const lines = linesOf(recapBeat);
      const taken = lines.map(coinChange).filter((n) => n !== null && n < 0);
      const left = taken.slice();
      const unpaid = recap.filter((c) => { const at = left.indexOf(-c.amount); if (at < 0) return true; left.splice(at, 1); return false; });
      const total = recap.reduce((s, c) => s + c.amount, 0);
      if (unpaid.length && taken.reduce((s, n) => s - n, 0) !== total) {
        out.push({
          key: 'beat13-costs', ok: false, beat: RECAP_BEAT, label: unpaid.map((c) => `${c.label} ${coinTag(-c.amount)}`).join('; '),
          text: `Beat ${RECAP_BEAT}: ${unpaid.map((c) => `${the(c.label)} ${coinTag(-c.amount)}`).join(' and ')} ${unpaid.length === 1 ? "doesn't" : "don't"} come off.`,
          ask: `The event's own costs come off here, each its own coin line: ${recap.map((c) => `${c.label} ${coinTag(-c.amount)}`).join('; ')}.`,
        });
      } else {
        out.push({ key: 'beat13-costs', ok: true, beat: RECAP_BEAT, label: "The event's costs come off", text: `Beat ${RECAP_BEAT}: the event's own costs come off here.`, ask: null });
      }
    }
  }

  // JustAWoman on camera: at least once she watches Lala's scene in silence.
  if (complete) {
    const silent = beats.some((b) => linesOf(b).some((l) => SILENT_WATCH.test(l)));
    out.push(silent
      ? { key: 'silent', ok: true, beat: PLAYS_BEAT, label: 'JustAWoman watches in silence', text: "JustAWoman watches Lala's scene in silence at least once.", ask: null }
      : { key: 'silent', ok: false, beat: PLAYS_BEAT, label: '(JustAWoman watches, silent.)', text: "JustAWoman never watches in silence: at least once, Lala's scene plays while she watches, (JustAWoman watches, silent.).", ask: "Let Lala's line finish before JustAWoman reacts, and at least once let Lala's scene play while she watches in silence, on its own line: (JustAWoman watches, silent.)" });
  }
  return out;
}
// END SHARED

/**
 * Lala's money as the rules read it, from the Money page's own lines
 * (GET /world/:showId/episodes/:episodeId/money), sorted the way the
 * writer's copy sorts them (src/services/scriptMoneyContext.js
 * loadScriptMoney): look, the event's other costs (recap) and what she is
 * owed (income); covered and conditional lines cost her nothing. null when
 * there are no lines to read.
 */
export function scriptMoneyFrom(data) {
  if (!data || !Array.isArray(data.lines)) return null;
  const out = { look: [], recap: [], income: [] };
  for (const line of data.lines) {
    const amount = Math.round(Number(line?.amount) || 0);
    if (line?.look) {
      if (amount > 0) out.look.push({ id: line.source?.id != null ? String(line.source.id) : null, name: line.label, amount });
    } else if (line?.covered || line?.state === 'covered' || line?.conditional) {
      continue;
    } else if (line?.kind === 'income') {
      if (amount > 0) out.income.push({ label: line.label, amount });
    } else if (amount > 0) {
      out.recap.push({ label: line?.label, amount });
    }
  }
  return out;
}

/** Whether the event's shopping list is approved: true / false, null when the event is not read. */
export function shoppingListApproved(event) {
  if (!event) return null;
  let cc = event.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[scriptRuleChecks] event canon_consequences unreadable:', err); return null; }
  }
  return cc?.documents?.shopping_list?.status === 'approved';
}

/**
 * The rules as "Ready to film?" rows ({ key, ok, beatId, text }), each on
 * the beat that carries it. `rules`: { money, shoppingApproved }, null when
 * the tab has not read them (no rows). `canonical`: the canonical beats, so
 * the "at least once" rule is judged on a whole script only.
 */
export function scriptRuleRows(beats = [], rules = null, { canonical = [], closetNumber = null } = {}) {
  if (!rules) return [];
  const complete = canonical.length > 0 && canonical.every((c) => beats.some((b) => b.number === c.number));
  return scriptRuleFindings(beats, { money: rules.money || null, shoppingApproved: rules.shoppingApproved ?? null, closetNumber, complete })
    .map((f) => ({ key: `rule-${f.key}`, ok: f.ok, beatId: beatAt(beats, f.beat)?.id || null, text: f.text }));
}

export { statEntries, coinChange, scriptRuleFindings, SHOPPING_LIST, JUDGED_ON };
