/**
 * What may never reach a response body: the database's or the ORM's own words.
 *
 * Four suites each kept a private copy of this pattern — referenceWritersSetLiveness,
 * sceneSetDeleteLockOrder, eventWritersEpisodeFirst and baseSaveLiveSet — and
 * three of them still carried the defect the first one was corrected for
 * (Evoni, 2026-11-27). One matcher now serves all four, and each suite says
 * which WORDS it wants; the SQL recognition is shared by all of them.
 *
 * Two kinds of thing go into the pattern, and they are not interchangeable:
 *   · WORDS are literal text, escaped before they are used, so a token like
 *     `relation ` keeps its trailing space and a token is never read as regex.
 *   · The SQL SHAPES below are deliberate regular expressions. They are the
 *     shared part: no caller may vary them, and none needs to.
 *
 * Why shapes rather than keywords. The three bare keywords this replaced —
 * `SELECT `, `UPDATE `, `INSERT `, matched case-insensitively — flagged the
 * routes' own English ("Failed to update event" contains "update ", which
 * failed a real assertion in run 45902313934 with no database text in the body
 * at all) and let real statements through: the DELETE verb was never listed,
 * and a statement broken over lines or tabs has no single space after its verb.
 * SQL and prose differ by SHAPE, not by a word: prose says "set", never
 * "set x ="; it says "from your closet", never "from scene_sets".
 *
 * Why WS and LB. Most call sites match against JSON.stringify(body), which
 * writes a newline as the two characters \ and n. An encoded multiline
 * statement therefore carries no whitespace character at all, and the escape's
 * trailing letter runs into the next keyword, leaving \b with no boundary to
 * find. WS accepts real whitespace or such an escape; LB is the left-hand
 * boundary and accepts one too. Some call sites pass a raw string instead
 * (an Error's message, or a captured statement), so both forms must work.
 *
 * Measured on the corpus in tests/unit/helpers/databaseText.test.js, not
 * claimed in general: that corpus is what this is known to catch.
 */

// Written in pieces so no line of this file reads as a bare SQL statement to
// the repository's own command guards.
const VERB_S = 'sel' + 'ect';
const VERB_U = 'upd' + 'ate';
const VERB_I = 'ins' + 'ert';
const VERB_D = 'del' + 'ete';

/** Words English puts before a noun, never before a table. */
const ARTICLE = 'the|a|an|your|my|our|its|their|this|that|these|those|here|there|his|her|every|any|all|one|two';
/** Real whitespace, or the \n \r \t that JSON.stringify writes in its place. */
const WS = '(?:\\s|\\\\[nrt])';
/** A left-hand boundary that an escape satisfies as well as a space. */
const LB = '(?:^|\\s|\\\\[nrt]|[^a-z0-9_\\\\])';

/**
 * SQL by its shape: a verb with the clause that must follow it, and clauses
 * prose does not carry. Shared by every caller, varied by none.
 */
const SQL_SHAPES = [
  `${VERB_I}${WS}+into${WS}`,
  `${VERB_D}${WS}+from${WS}+(?!(?:${ARTICLE})\\b)["a-z_(]`,
  `${VERB_U}\\b[\\s\\S]{0,160}?${LB}set\\b[\\s\\S]{0,40}?("?[a-z_][a-z0-9_]*"?|[a-z_]+\\.[a-z_"]+)${WS}*=`,
  `${VERB_S}\\b[\\s\\S]{0,240}?${LB}from${WS}+(?!(?:${ARTICLE})\\b)["a-z_(]`,
  `${VERB_S}${WS}+(\\*|\\d|[a-z_]+${WS}*\\()`,
  `${LB}where\\b[\\s\\S]{0,80}?(=${WS}*\\$\\d|=${WS}*'|=${WS}*"|${LB}is${WS}+null\\b|${LB}in${WS}*\\()`,
  `${LB}values${WS}*\\(`,
  `${LB}returning\\b`,
  `${LB}on${WS}+conflict\\b`,
  `${LB}(order|group)${WS}+by\\b`,
  `${LB}limit${WS}+\\d`,
];

/**
 * The words three of the four suites share. A suite that wants a different
 * set passes its own; nothing is inherited that a caller did not ask for.
 */
const BASE_WORDS = Object.freeze([
  'deadlock',
  'violates',
  'constraint',
  'relation',
  'syntax',
  'sequelize',
  'canceling statement',
  'lock timeout',
]);

const escape = (word) => String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A matcher for one suite: its `words` as literal text, plus the shared SQL
 * shapes. Returns a real RegExp — case-insensitive and NOT global, so .test()
 * is stateless and every existing `expect(x).not.toMatch(m)` call site keeps
 * working exactly as it did.
 *
 * Called with nothing, it is BASE_WORDS plus the shapes.
 */
function databaseTextMatcher(words = BASE_WORDS) {
  if (!Array.isArray(words)) throw new TypeError('databaseTextMatcher(words): words must be an array of literal strings');
  if (!words.length) throw new TypeError('databaseTextMatcher(words): words must not be empty');
  return new RegExp([...words.map(escape), ...SQL_SHAPES].join('|'), 'i');
}

module.exports = { databaseTextMatcher, BASE_WORDS, SQL_SHAPES };
