/**
 * Lala's line after she puts a piece on (Lala's Phone spec §7 item 2; Task
 * 3190; Evoni, 2026-10-14, phone phase 3 ruling 5): a draft in her voice from
 * the piece's name, its in-world price in coins and whether it fits the
 * event's dress code, for Evoni to edit. A free template: no AI call. The
 * piece's own `lala_reaction_own`, when written, is used as it is.
 *
 * The AI draft comes later, behind a button and under the daily cap (a
 * separate issue). It would draft from the same facts: `draftFacts` is that
 * hook; nothing here calls it.
 */
import { dressCodeKeywords, matchesDressCode } from './lookBuilder';
import { wearCues } from './scriptMoments';

// A tier this high, or a price this high when the piece has no tier, is a splurge.
const SPLURGE_TIERS = new Set(['luxury', 'elite']);
const SPLURGE_COINS = 500;

/** A small stable number from a piece id, so a piece always gets the same variant. */
export function variantIndex(id, n) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return n > 0 ? h % n : 0;
}

// A category in the words a dress code uses ("heels", "statement
// accessories"), so shoes meet "heels" and a clutch meets "accessories".
const CATEGORY_WORDS = {
  shoes: ['heels', 'shoes'], heels: ['heels', 'shoes'], boots: ['boots', 'shoes'], sneakers: ['sneakers', 'shoes'],
  clutch: ['accessories', 'bag'], bag: ['accessories', 'bag'], bags: ['accessories', 'bag'], purse: ['accessories', 'bag'],
  jewelry: ['accessories', 'jewelry'], accessories: ['accessories'], hat: ['accessories', 'hat'],
  dress: ['dress', 'gown'], gown: ['gown', 'dress'],
};

const coins = (n) => `${Number(n).toLocaleString('en-US')} coins`;

/**
 * What the draft is made from: { name, coins, cost: 'owned' | 'free' |
 * 'splurge' | 'steal', fit: 'fits' | 'off' | 'unknown', reaction }. The
 * dress code is the event's text; `keywords` overrides its words.
 */
export function draftFacts(piece, { dressCode = '', keywords = null } = {}) {
  const name = String(piece?.name || 'this').trim();
  const price = Number(piece?.coin_cost);
  const tier = String(piece?.tier || '').toLowerCase();
  let cost;
  if (piece?.is_owned) cost = 'owned';
  else if (!Number.isFinite(price) || price <= 0) cost = 'free';
  else if (SPLURGE_TIERS.has(tier) || (!tier && price >= SPLURGE_COINS)) cost = 'splurge';
  else cost = 'steal';
  const want = keywords || dressCodeKeywords({ dress_code: dressCode });
  const own = [
    ...(Array.isArray(piece?.dress_code_keywords) ? piece.dress_code_keywords : []),
    ...(CATEGORY_WORDS[String(piece?.clothing_category || '').toLowerCase()] || []),
  ].map((k) => String(k).toLowerCase());
  const fit = !want.length ? 'unknown'
    : (matchesDressCode(piece, want) || own.some((k) => want.some((w) => k.includes(w) || w.includes(k))) ? 'fits' : 'off');
  const reaction = String(piece?.lala_reaction_own || '').trim().replace(/^["“]|["”]$/g, '').trim();
  return { name, coins: Number.isFinite(price) && price > 0 ? price : 0, cost, fit, reaction };
}

const OPENERS = {
  owned: [
    (f) => `The ${f.name}, straight from my closet.`,
    (f) => `My ${f.name}. Already mine, already perfect.`,
    (f) => `Pulling out the ${f.name}.`,
  ],
  free: [
    (f) => `The ${f.name}.`,
    (f) => `Okay, the ${f.name}.`,
    (f) => `This ${f.name}, though.`,
  ],
  splurge: [
    (f) => `The ${f.name}. ${coins(f.coins)}, and worth every one.`,
    (f) => `${coins(f.coins)} for the ${f.name}? It's an investment.`,
    (f) => `The ${f.name} costs ${coins(f.coins)}. I'm not even sorry.`,
  ],
  steal: [
    (f) => `The ${f.name}, only ${coins(f.coins)}.`,
    (f) => `${coins(f.coins)} for the ${f.name}? A steal.`,
    (f) => `The ${f.name}. ${coins(f.coins)}, done.`,
  ],
};

const FITS = {
  fits: ['Exactly what the dress code asked for.', 'Dress code: handled.', 'On theme and on point.'],
  off: ["Not quite the dress code, but I'll make it work.", 'Bending the dress code a little. On purpose.', 'Off-code? Call it a statement.'],
  unknown: ['I love this.', 'This is the one.', 'Yes. This.'],
};

/**
 * The draft line, without the speaker: the piece's own reaction when it has
 * one, else an opener on its price and a word on the dress code, the
 * variants picked by the piece's id.
 */
export function draftLine(piece, opts = {}) {
  const f = draftFacts(piece, opts);
  if (f.reaction) return f.reaction;
  const openers = OPENERS[f.cost];
  const fits = FITS[f.fit];
  const v = variantIndex(piece?.id ?? f.name, openers.length * fits.length);
  return `${openers[v % openers.length](f)} ${fits[Math.floor(v / openers.length) % fits.length]}`;
}

/** The script line Insert writes: `Lala: "<draft>"`, inner double quotes made single. */
export const lalaLine = (text) => `Lala: "${String(text || '').trim().replace(/"/g, "'")}"`;

// `Lala:` or `Lala (twirling):` (Script page audit, 2026-10-19).
const LALA_SPEAKS = /^\s*lala\s*(?:\([^)]*\))?\s*:/i;
const STAT_LINE = /^\s*\[STAT\s*:/i;

/**
 * Where a Lala line slot goes: each wear cue naming exactly one piece of the
 * look (a [WEAR] id, or a legacy select by its one name) whose next line in
 * the beat, past its [STAT:] lines, is not Lala speaking. `lineIndex` is the
 * line the draft goes after: the cue's last [STAT:] line, so a draft never
 * comes between a [WEAR] and its coin line (Script page audit, 2026-10-19).
 * [{ beatIndex, lineIndex, piece }].
 */
export function lalaLineSlots(beats = [], look = []) {
  return wearCues(beats, look)
    .filter((c) => c.piece)
    .map((c) => {
      const lines = beats[c.beatIndex]?.lines || [];
      let last = c.lineIndex;
      while (last + 1 < lines.length && STAT_LINE.test(String(lines[last + 1] || ''))) last += 1;
      return { c, last, next: String(lines[last + 1] || '') };
    })
    .filter(({ next }) => !LALA_SPEAKS.test(next))
    .map(({ c, last }) => ({ beatIndex: c.beatIndex, lineIndex: last, piece: c.piece }));
}
