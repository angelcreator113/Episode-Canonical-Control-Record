'use strict';

/**
 * The show rules' findings that code can mend, mended before the paid fix
 * pass (Script page audit 3, 2026-10-19: each one cost a Sonnet call that
 * rewrote the whole beat and lost its dialogue). Pure; no I/O.
 *
 * - Beat 8 (the closet beat): the coin line right after a costing piece's
 *   [WEAR: id] (within the next two lines, before the next piece goes on, as
 *   utils/scriptRuleChecks reads it) is set to the piece's cost when its
 *   amount is wrong. A missing coin line is utils/scriptMoney's to add.
 * - A + coin line is taken out wherever it is: what Lala is owed is paid
 *   next episode, never in this one.
 * - The cutscene (beats 11-13) has no phone: a line utils/scriptRuleChecks
 *   flags there (a tap, a screen opened, the phone brought up, a voice click)
 *   is taken out. Overlays on the video and [TRANSITION: …] stay.
 *
 * A [STAT:] line that also moves another stat is left for the writer, so
 * no other stat is lost. Coin lines are read by utils/scriptStats, the one
 * reader every check shares. Approved beats (`skip`, beat positions) are
 * never changed.
 */

const { headerNumber } = require('./beatLabelNumber');
const { closetIndex } = require('./scriptWear');
const { statEntries, coinChange } = require('./scriptStats');
const { cutsceneFindings } = require('./scriptRuleChecks');

const BEAT_SPLIT = /(?=^[ \t]*##[ \t]*BEAT:)/im;
const HEADER = /^\s*##\s*BEAT:\s*(.*)$/i;
const WEAR_LINE = /^\s*\[\s*WEAR\s*:\s*([^\]]*?)\s*\]\s*$/i;
const CUTSCENE = [11, 12, 13];

// A [STAT:] line that moves coins and nothing else.
const onlyCoins = (line) => { const e = statEntries(line); return !!e && e.length === 1 && e[0].stat === 'coins'; };
const isPhoneInCutscene = (n, line) => cutsceneFindings([{ number: n, lines: [line] }]).length > 0;

/**
 * Returns { script, coin_amounts, plus_coins, cutscene_lines }: the script
 * and how many of each were mended. `money`: { look: [{ id, amount }] } or
 * null (no amounts checked then). `closetNumber` names the closet beat for
 * one beat written on its own.
 */
function scriptWithAutoFixes(scriptText, money = null, { skip = [], closetNumber = null } = {}) {
  const text = String(scriptText || '');
  const none = { script: text, coin_amounts: 0, plus_coins: 0, cutscene_lines: 0 };
  const parts = text.split(BEAT_SPLIT);
  const preamble = parts.length && !HEADER.test(parts[0].split('\n')[0]) ? parts.shift().trimEnd() : '';
  if (!parts.length) return none;
  const beats = parts.map((part, i) => {
    const lines = part.trimEnd().split('\n');
    return { number: headerNumber(((lines[0] || '').match(HEADER)?.[1] || '').trim()) || i + 1, header: lines[0], lines: lines.slice(1) };
  });
  const cost = new Map((money?.look || []).filter((p) => p && p.id != null && Math.round(Number(p.amount)) > 0)
    .map((p) => [String(p.id), Math.round(Number(p.amount))]));
  const closet = closetNumber != null
    ? beats.findIndex((b) => b.number === Number(closetNumber))
    : closetIndex(beats.map((b) => ({ number: b.number, lines: b.lines.filter((l) => l.trim()) })));

  let coinAmounts = 0;
  let plusCoins = 0;
  let cutsceneLines = 0;
  const sections = beats.map((b, i) => {
    if (skip.includes(i)) return null;
    let lines = b.lines.slice();
    let changed = false;
    if (i === closet && cost.size) {
      lines.forEach((line, at) => {
        const m = line.match(WEAR_LINE);
        if (!m || !cost.has(m[1])) return;
        for (let j = at + 1, seen = 0; j < lines.length && seen < 2; j += 1) {
          if (!lines[j].trim()) continue;
          if (WEAR_LINE.test(lines[j])) break;
          seen += 1;
          const c = coinChange(lines[j]);
          if (c === null) continue;
          if (c !== -cost.get(m[1]) && c < 0 && onlyCoins(lines[j])) {
            lines[j] = `[STAT: coins -${cost.get(m[1])}]`;
            coinAmounts += 1;
            changed = true;
          }
          break;
        }
      });
    }
    const kept = lines.filter((line) => {
      if (onlyCoins(line) && coinChange(line) > 0) { plusCoins += 1; return false; }
      if (CUTSCENE.includes(b.number) && isPhoneInCutscene(b.number, line)) { cutsceneLines += 1; return false; }
      return true;
    });
    if (kept.length !== lines.length) { lines = kept; changed = true; }
    return changed ? [b.header, ...lines].join('\n').trimEnd() : null;
  });
  if (!coinAmounts && !plusCoins && !cutsceneLines) return none;
  const body = parts.map((part, i) => (sections[i] ?? part.trimEnd())).join('\n\n');
  return { script: preamble ? `${preamble}\n\n${body}` : body, coin_amounts: coinAmounts, plus_coins: plusCoins, cutscene_lines: cutsceneLines };
}

module.exports = { scriptWithAutoFixes };
