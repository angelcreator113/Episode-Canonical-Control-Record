'use strict';

// The show's rules the writer is told, checked in the script (Evoni's
// rulings: beat 8's coin lines and beat 9's shopping list, 2026-10-18,
// utils/scriptMoney.js; the cutscene, 2026-10-19: beat 11 Lala talks with
// the host and two featured guests, beat 12 is the runway walk, her stats
// move in beat 12 or 13, JustAWoman comments in 11 to 13; beat 13 Lala's
// line, 2026-10-17, and the event's costs there only, 2026-10-18; owed
// coins paid next episode, 2026-10-19), the server's copy of
// frontend/src/lib/scriptRuleChecks.js: the code between BEGIN SHARED and
// END SHARED is the same word for word (a parity test in
// frontend/src/lib/scriptRuleChecks.test.js checks it). Each finding
// becomes a coverage item (utils/scriptCoverage.js), so the fix pass after
// writing asks the writer to mend a missing one in its beat, never an
// approved one (groundedScriptGeneratorService).

const { statEntries, coinChange } = require('./scriptStats');

// BEGIN SHARED
const WEAR_CUE = /^\s*\[\s*WEAR\s*:\s*([^\]]*?)\s*\]\s*$/i;
const UI_CUE = /^\s*\[\s*UI\s*:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/i;
// `**Lala:**` and `__Lala__:` are her lines too (Script page audit 3, 2026-10-19).
const LALA_SAYS = /^\s*(?:\*\*|__)?\s*lala\s*(?:\(([^)]*)\))?\s*(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*\S/i;
// `Lala (V.O.):` is her thoughts; "(devoted)", "(nervously)" and "(voice
// cracking)" are her speaking (Script page re-audit, 2026-10-19: an
// unanchored v.o. matched inside them; lib/scriptShowRules VOICE_OVER).
const VOICE_OVER = /^\s*v\.?\s*o\.?\s*(?:[,;].*)?$/i;
const lalaSpeaks = (l) => { const m = l.match(LALA_SAYS); return !!m && !VOICE_OVER.test(m[1] || ''); };
// JustAWoman's comment: `Me:` (or her name) with words beyond a stage direction.
const JAW_SAYS = /^\s*(?:\*\*|__)?\s*(?:me|justawoman|jawihp|prime)\s*(?:\([^)]*\))?\s*(?:\*\*|__)?\s*:\s*(?:\*\*|__)?(.*)$/i;
// A speaker's line: a name (no cue, no stage direction) before a colon.
const SPEAKER = /^\s*([^:[\]()]{1,60}?)\s*(?:\([^)]*\))?\s*:\s*\S/;
// The runway itself: "walks over to the bar" is no runway walk (Script page
// audit 3, 2026-10-19).
const RUNWAY = /\b(?:runway|catwalk)\b/i;
// The episode overlay's own name for the approved list (src/utils/scriptMoney.js SHOPPING_LIST_OVERLAY).
const SHOPPING_LIST = 'Shopping list';
const CLOSET_BEAT = 8;
const LIST_BEAT = 9;
const CUTSCENE = [11, 12, 13];
const TALK_BEAT = 11;
const CHALLENGE_BEAT = 12;
const RECAP_BEAT = 13;
const JUDGED_ON = ['reputation', 'brand_trust', 'influence', 'stress'];
// The cutscene has no phone (Evoni, 2026-10-19; Script page re-audit,
// 2026-10-19: these lines in beats 11-13 were never flagged): a tap, a
// screen opened, closed or scrolled, a voice click, or the phone itself
// coming up (putting it away is not using it). Overlays on the video ([UI:DISPLAY Stats Panel]) and
// [TRANSITION: …] stay.
// A notification, a DM or a post is the phone too (Script page audit 3,
// 2026-10-19: [UI:NOTIFY …] in beat 12 was never flagged).
const PHONE_VERBS = new Set(['CLICK', 'TAP', 'SELECT', 'OPEN', 'CLOSE', 'SCROLL', 'SWIPE', 'TYPE', 'VOICE_ACTIVATE', 'VOICEACTIVATE', 'NOTIFY', 'NOTIFICATION', 'DM', 'POST']);
// The closet is the screen named Closet ("Lala's Closet", "ClosetCategory
// Outfit"): Closet, then only words that name a part of it. "Closet Sale
// Alert" in beat 7 was the closet (Script page audit 3, 2026-10-19).
// lib/scriptMoments closetBeat, utils/scriptWear closetIndex and
// utils/scriptCoverage read it the same.
const CLOSET_PARTS = new Set(['screen', 'app', 'page', 'ui', 'tab', 'view', 'grid', 'panel', 'window', 'overlay', 'icon', 'category', 'categories', 'item', 'items', 'outfit', 'outfits', 'look', 'looks', 'rack', 'wardrobe']);
const isClosetScreen = (target) => {
  const w = String(target || '').replace(/\s+x\d+$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  while (w.length && ['lala', 'lalas', 's', 'the'].includes(w[0])) w.shift();
  return w[0] === 'closet' && w.slice(1).every((x) => CLOSET_PARTS.has(x));
};
const PHONE_ITSELF = new Set(['phone', 'thephone', 'lalasphone', 'lalaphone', 'phonedevice']);
const PHONE_UP = new Set(['SHOW', 'DISPLAY']);

const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
const coinTag = (n) => `[STAT: coins ${signed(n)}]`;
const the = (name) => (/^the\s/i.test(String(name)) ? String(name) : `the ${name}`);
const linesOf = (b) => (b?.lines || []).map((l) => String(l ?? '')).filter((l) => l.trim());
const beatAt = (beats, n) => beats.find((b) => b.number === n) || null;
const ui = (line) => { const m = line.match(UI_CUE); return m ? { verb: m[1].toUpperCase(), target: m[2] } : null; };
const isList = (target) => target.trim().toLowerCase() === SHOPPING_LIST.toLowerCase();
const more = (list) => (list.length > 1 ? ` (+${list.length - 1} more)` : '');
const list = (items) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
// A curly apostrophe is a straight one, an accent is let go and Markdown bold
// is not the name (Script page audit 3, 2026-10-19: `D’Angelo:` was not
// D'Angelo Price).
const norm = (v) => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019\u02BC]/g, "'")
  .replace(/^[\s*_]+|[\s*_]+$/g, '').replace(/^@/, '').replace(/\s+/g, ' ').toLowerCase();
// A speaker is the person when the name as written is one of theirs, or
// their first name (`Declan:` for Declan Ferris).
const speaks = (who, c) => {
  const w = norm(who);
  return [c.name, ...(c.aliases || [])].map(norm).filter(Boolean)
    .some((n) => n === w || (w.length >= 3 && !w.includes(' ') && n.split(' ')[0] === w));
};
const profilesById = (profiles) => new Map((profiles || []).filter((p) => p && p.id != null).map((p) => [String(p.id), p]));
// "Also known as" (social_profiles.aliases; Evoni, 2026-10-23): the other
// names they go by, nicknames like "Truth" for Truthville. A list, or the
// JSON of one when read raw.
const aliasesOf = (p) => {
  let a = p?.aliases;
  if (typeof a === 'string') {
    try { a = JSON.parse(a); } catch (err) { console.error('[scriptRuleChecks] aliases unreadable:', err.message); a = []; }
  }
  return Array.isArray(a) ? a : [];
};
// A person's names as the writer names them: creator_name, else
// display_name, else handle, then their "also known as" names and the
// event's own copies of them.
const namesOf = (p, own = []) => [p?.creator_name, p?.display_name, p?.handle, ...aliasesOf(p), ...own].filter((n) => typeof n === 'string' && n.trim());

/**
 * The event's host and two featured guests, as the writer names them
 * (episodeScriptWriterService: creator_name, else display_name, else
 * handle): [{ name, role, aliases }]. The host is the creator organizer
 * (source_profile_id, else automation.host_profile_id); the featured
 * guests are the Event Package's guests marked featured (automation
 * guest_profiles). `profiles`: the social profiles read for them, by id.
 */
function eventCast(event, profiles = []) {
  let cc = event?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[scriptRuleChecks] canon_consequences unreadable:', err.message); cc = null; }
  }
  const auto = cc?.automation && typeof cc.automation === 'object' ? cc.automation : {};
  const byId = profilesById(profiles);
  const person = (role, id, own = []) => {
    const names = namesOf(id != null ? byId.get(String(id)) : null, own);
    return names.length ? { name: names[0].trim(), role, aliases: names.slice(1) } : null;
  };
  const out = [];
  const hostId = event?.source_profile_id ?? auto.host_profile_id ?? null;
  if (hostId != null && hostId !== '') {
    const same = auto.host_profile_id != null && String(auto.host_profile_id) === String(hostId);
    const host = person('host', hostId, same ? [auto.host_display_name, auto.host_handle] : []);
    if (host) out.push(host);
  }
  const guests = (Array.isArray(auto.guest_profiles) ? auto.guest_profiles : []).filter((g) => g && g.featured).slice(0, 2);
  for (const g of guests) {
    const guest = person('featured guest', g.profile_id ?? g.id ?? null, [g.creator_name, g.display_name, g.handle]);
    if (guest && !out.some((c) => norm(c.name) === norm(guest.name))) out.push(guest);
  }
  return out;
}

/**
 * The person a relationship goal is about (Evoni, 2026-10-23: "Get to know
 * Truthville" never ticked when the script named her by her real name):
 * the goal's own profile_id (dealTermsDraftService draftRelationshipGoals),
 * else its slot: relationship_host is the host eventCast reads,
 * relationship_guest the Event Package's first named guest, the one the
 * goal was written for. A brand goal is about the brand: its profile_id
 * (the brand's Pulse account), and the event's brand name either way, so
 * an older goal with no profile_id still has one. { id, name, names,
 * shown, shared, whole } or null: `names` are every name of theirs as norm
 * reads it (creator_name, display_name, handle, their "also known as"
 * names, the event's copies of them, the first name of each), `shown` each
 * as written. A name needs 3 letters or more. A name another of the
 * event's people has too, whole or as a first name, is not one of theirs
 * (`shared`), so a lone "Marcus" names nobody when there are two; a
 * surname never is. A brand (`whole`) is named only by a whole name of its
 * own, and never by common words alone ("Studio", "The House").
 */
function goalPerson(goal, event, profiles = []) {
  if (!goal) return null;
  let cc = event?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[scriptRuleChecks] canon_consequences unreadable:', err.message); cc = null; }
  }
  const auto = cc?.automation && typeof cc.automation === 'object' ? cc.automation : {};
  const byId = profilesById(profiles);
  const key = (id) => (id == null || id === '' ? null : String(id));
  const hostId = key(event?.source_profile_id ?? auto.host_profile_id);
  const guests = (Array.isArray(auto.guest_profiles) ? auto.guest_profiles : []).filter(Boolean);
  // Everyone at the event, each with the names the event has for them.
  const people = [];
  if (hostId) people.push({ id: hostId, own: [event?.host, ...(key(auto.host_profile_id) === hostId ? [auto.host_display_name, auto.host_handle] : [])] });
  for (const g of guests) people.push({ id: key(g.profile_id ?? g.id), own: [g.creator_name, g.display_name, g.handle] });
  const brand = goal.slot === 'relationship_brand';
  let id = key(goal.profile_id);
  if (!id && goal.slot === 'relationship_host') id = hostId;
  // The guest the goal was written for: the first with a name (draftRelationshipGoals).
  const named = guests.find((g) => g.display_name || g.handle);
  if (!id && goal.slot === 'relationship_guest' && named) id = key(named.profile_id ?? named.id);
  const brandName = brand ? String(event?.host_brand || auto.host_brand || '').trim() : '';
  if (!id && !brandName) return null;
  const full = (p) => namesOf(byId.get(p.id), p.own).map((n) => n.trim());
  const mine = [...new Set(brand
    ? [...(id ? namesOf(byId.get(id)) : []), brandName].map((n) => n.trim()).filter(Boolean)
    : full({ id, own: people.filter((p) => p.id === id).flatMap((p) => p.own) }))];
  if (!mine.length) return null;
  const firstOf = (n) => n.split(' ')[0];
  const letters = (n) => n.replace(/[^a-z0-9]/g, '').length;
  // Each other person's names, whole and first.
  const theirs = new Set(people.filter((p) => !id || (p.id && p.id !== id)).flatMap(full).map(norm).flatMap((n) => [n, firstOf(n)]));
  const names = [];
  const shown = [];
  const shared = [];
  const add = (n, as) => {
    if (!n || names.includes(n) || letters(n) < 3) return;
    if (brand && !nameWords(n).some((w) => !BRAND_WORDS.has(w))) return;
    if (theirs.has(n)) { if (!shared.includes(n)) shared.push(n); return; }
    names.push(n); shown.push(as);
  };
  for (const n of mine) add(norm(n), n);
  if (!brand) {
    for (const n of mine) {
      const f = firstOf(norm(n));
      if (f !== norm(n) && !NOT_FIRST_NAMES.has(f.replace(/\.$/, ''))) add(f, firstOf(n));
    }
  }
  if (!names.length) return null;
  return { id: id || null, name: mine[0], names, shown, shared, ...(brand ? { whole: true } : {}) };
}

// Words that are never a first name alone: articles, titles, connectors
// ("The" of "The Column" named every "the"; Evoni, 2026-10-24). The same
// list as the server's utils/firstNames NOT_FIRST_NAMES (a unit test checks).
const NOT_FIRST_NAMES = new Set([
  'the', 'a', 'an', 'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'dame', 'lady', 'lord', 'madam', 'madame',
  'mademoiselle', 'monsieur', 'señor', 'senor', 'señora', 'senora', 'mister', 'aunt', 'auntie', 'uncle',
  'de', 'del', 'della', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'lo', 'los', 'las', 'van', 'von', 'der', 'den',
  'ten', 'ter', 'el', 'al', 'st', 'ste', 'saint', 'san', 'santa', 'mac', 'mc', 'o', 'of', 'and', 'by', 'for',
]);

// Words a brand's name may hold that name no one alone: "Studio" is not
// Studio by Sable, "The House" no house.
const BRAND_WORDS = new Set(['the', 'a', 'an', 'by', 'and', 'of', 'for', 'co', 'company', 'inc', 'studio', 'studios', 'house', 'atelier', 'beauty', 'brand', 'brands', 'boutique', 'collective', 'label', 'design', 'designs', 'fashion', 'style', 'styles', 'official', 'group', 'agency', 'media', 'shop', 'store', 'lab', 'labs', 'club', 'closet', 'wear', 'couture', 'collection', 'apparel', 'goods']);

// Words as names are matched: norm, then letters and digits only
// ("D'Angelo" is d angelo, "@truth_ville" truth ville).
const nameWords = (v) => norm(v).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/**
 * Where the goal's person (goalPerson) is in these lines: { as, line } or
 * null; `as` is the name they go by there, as written, `line` the line.
 * They speak (a speaker line, as speaks reads it, but not by a first name
 * another of the event's people has too; a brand only by a whole name of
 * its own), or one of their names is in a line, whole.
 */
function personLine(lines = [], person = null) {
  if (!person?.names?.length) return null;
  for (const l of lines) {
    const m = String(l ?? '').match(SPEAKER);
    if (!m) continue;
    const who = norm(m[1]);
    if (person.shared?.includes(who)) continue;
    if (person.whole ? !person.names.includes(who) : !speaks(m[1], { name: person.names[0], aliases: person.names.slice(1) })) continue;
    const at = person.names.indexOf(who);
    return { as: at >= 0 ? person.shown[at] : m[1].replace(/^[\s*_]+|[\s*_]+$/g, ''), line: String(l) };
  }
  for (const l of lines) {
    const have = nameWords(l);
    const at = person.names.findIndex((n) => {
      const w = nameWords(n);
      return w.length > 0 && have.some((_, i) => w.every((x, j) => have[i + j] === x));
    });
    if (at >= 0) return { as: person.shown[at], line: String(l) };
  }
  return null;
}

/** The name the goal's person goes by in these lines, as written, or null (personLine). */
function personIn(lines = [], person = null) {
  return personLine(lines, person)?.as ?? null;
}

// The closet beat: the one given, else the one that opens the closet, else beat 8.
function closetOf(beats, closetNumber) {
  if (closetNumber) return closetNumber;
  // The screen named Closet, as closetBeat and utils/scriptWear read it (Script
  // page re-audit, 2026-10-19: "Closet Sale Alert" in beat 7 was the closet).
  const opens = beats.find((b) => linesOf(b).some((l) => { const m = ui(l); return !!m && m.verb === 'OPEN' && isClosetScreen(m.target); }));
  return opens ? opens.number : CLOSET_BEAT;
}

/** The lines of beats 11-13 that use the phone: [{ beat, lines }], one per beat that has any. */
function cutscenePhoneLines(beats = []) {
  return CUTSCENE.map((n) => beatAt(beats, n)).filter(Boolean).map((b) => ({
    beat: b.number,
    lines: linesOf(b).filter((l) => { const m = ui(l); return !!m && (PHONE_VERBS.has(m.verb) || (PHONE_UP.has(m.verb) && PHONE_ITSELF.has(m.target.toLowerCase().replace(/[^a-z0-9]/g, '')))); }).map((l) => l.trim()),
  })).filter((c) => c.lines.length);
}

/** The cutscene's phone lines as findings, one per beat. */
function cutsceneFindings(beats = []) {
  return cutscenePhoneLines(beats).map((c) => ({
    key: `cutscene-${c.beat}`, ok: false, beat: c.beat, label: c.lines[0],
    text: `Beat ${c.beat}: Beats 11–13 are the cutscene: no phone — remove ${c.lines[0]}${more(c.lines)}.`,
    ask: `Take out ${list(c.lines)}: beats 11 to 13 are the cutscene, an AI video with no phone, no phone screens, no notifications or messages and no voice-icon click. Overlays on the video ([UI:DISPLAY Stats Panel], [UI:HIDE Stats Panel]) and [TRANSITION: …] stay.`,
  }));
}

/**
 * What the show's rules find in the script. `beats`: [{ number, lines }]
 * (lines under the header). `money`: { look: [{ id, name, amount }], recap:
 * [{ label, amount }] } or null when not read (no coin checks then);
 * `shoppingApproved`: true when the event's shopping list is approved (beat
 * 9 is checked only then); `closetNumber`: the closet beat, when known;
 * `cast`: the event's host and featured guests (eventCast), [] when not
 * known (no beat 11 check then). Each finding: { key, ok, beat, text, label,
 * ask } where beat is the beat that carries it and ask, when not ok, is
 * what the writer is asked to write in that beat.
 */
function scriptRuleFindings(beats = [], { money = null, shoppingApproved = null, closetNumber = null, cast = [] } = {}) {
  const out = [];
  const look = (money?.look || []).filter((p) => p && p.id != null && Math.round(Number(p.amount)) > 0)
    .map((p) => ({ id: String(p.id), name: p.name || String(p.id), amount: Math.round(Number(p.amount)) }));
  const recap = (money?.recap || []).filter((c) => c && Math.round(Number(c.amount)) > 0)
    .map((c) => ({ label: c.label || 'the event cost', amount: Math.round(Number(c.amount)) }));
  const recapFor = (n) => recap.find((c) => -c.amount === n) || null;
  const closet = closetOf(beats, closetNumber);
  // The closet beat's coin lines that belong to a piece of the look.
  const pieceCoins = new Set();

  // Beat 8: each costing piece's coin line after its [WEAR: id] line, before
  // the next piece goes on, and only one (Script page audit 3, 2026-10-19:
  // a coin line three lines on was missed, and the server's coin pass then
  // charged the piece twice).
  const closetBeat = beatAt(beats, closet);
  if (money && look.length && closetBeat) {
    const lines = linesOf(closetBeat);
    let checked = 0;
    for (const p of look) {
      const at = lines.findIndex((l) => { const m = l.match(WEAR_CUE); return !!m && m[1] === p.id; });
      if (at < 0) continue; // not put on here: the look's own checks say so
      checked += 1;
      let coin = null;
      let again = null;
      for (let i = at + 1; i < lines.length && !WEAR_CUE.test(lines[i]); i += 1) {
        const c = coinChange(lines[i]);
        if (c === null) continue;
        // An event cost written here is that cost in the wrong beat (its
        // own row below), not this piece charged again.
        if (!coin) { coin = { value: c, i }; pieceCoins.add(i); } else if (!again && !(recapFor(c) && c !== -p.amount)) { again = { value: c, i }; pieceCoins.add(i); }
      }
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
      } else if (again) {
        out.push({
          key: `beat8-${p.id}`, ok: false, beat: closet, label: `${p.name}: ${coinTag(-p.amount)}`,
          text: `Beat ${closet}: ${the(p.name)} comes off twice, ${coinTag(coin.value)} and ${coinTag(again.value)}; it costs ${coinTag(-p.amount)} once.`,
          ask: `Take out the second coin line after [WEAR: ${p.id}] ("${p.name}"): it comes off once, ${coinTag(-p.amount)}.`,
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

  // Beat 11: the cutscene begins with Lala's conversation with the event's
  // host and two featured guests; each says a line, and so does Lala.
  const talk = beatAt(beats, TALK_BEAT);
  const people = (cast || []).filter((c) => c && c.name);
  if (talk && people.length) {
    const lines = linesOf(talk);
    const speakers = lines.map((l) => (l.match(SPEAKER) || [])[1]).filter(Boolean);
    const lalaSays = lines.some(lalaSpeaks);
    const quiet = people.filter((c) => !speakers.some((who) => speaks(who, c)));
    for (const c of quiet) {
      out.push({
        key: `beat11-${c.role === 'host' ? 'host' : 'guest'}-${norm(c.name).replace(/[^a-z0-9]+/g, '-')}`, ok: false, beat: TALK_BEAT, label: `${c.name} (${c.role})`,
        text: `Beat ${TALK_BEAT}: Lala doesn't talk with ${c.name} (${c.role}).`,
        ask: `Lala has a conversation with ${c.name} (${c.role}), who speaks directly as ${c.name}: [their words], in their own voice.`,
      });
    }
    if (!lalaSays) {
      out.push({ key: 'beat11-lala', ok: false, beat: TALK_BEAT, label: "Lala's side of the conversation", text: `Beat ${TALK_BEAT}: Lala never speaks in her conversation with the host and guests.`, ask: 'Lala speaks in the conversation in her own voice (Lala: …), answering the host and the featured guests.' });
    }
    if (!quiet.length && lalaSays) {
      out.push({ key: 'beat11', ok: true, beat: TALK_BEAT, label: 'Lala talks with the host and guests', text: `Beat ${TALK_BEAT}: Lala talks with ${list(people.map((c) => c.name))}.`, ask: null });
    }
  }

  // Beat 12: the Fashion Challenge is her runway walk, never money.
  const challenge = beatAt(beats, CHALLENGE_BEAT);
  if (challenge) {
    const lines = linesOf(challenge);
    out.push(lines.some((l) => RUNWAY.test(l))
      ? { key: 'beat12-runway', ok: true, beat: CHALLENGE_BEAT, label: 'The runway walk', text: `Beat ${CHALLENGE_BEAT}: the Fashion Challenge is her runway walk.`, ask: null }
      : { key: 'beat12-runway', ok: false, beat: CHALLENGE_BEAT, label: 'The runway walk', text: `Beat ${CHALLENGE_BEAT}: the Fashion Challenge is a runway walk — it isn't in the beat yet.`, ask: 'The Fashion Challenge is a surprise runway walk at the event: Lala walks the runway in the look, and the room watches.' });
    const coins = lines.map(coinChange).filter((n) => n !== null);
    if (coins.length) {
      out.push({
        key: 'beat12-coins', ok: false, beat: CHALLENGE_BEAT, label: coinTag(coins[0]),
        text: `Beat ${CHALLENGE_BEAT}: a coin line ${coinTag(coins[0])}${more(coins)}; the challenge is judged on her standing, never on money.`,
        ask: 'No coin line in this beat: the challenge is judged on her standing (reputation, brand_trust, influence, stress), never on money.',
      });
    }
  }

  // Her standing moves in beat 12 or on beat 13's stats panel; the row is
  // beat 13's (beat 12's when there is no beat 13).
  const judged = [CHALLENGE_BEAT, RECAP_BEAT].map((n) => beatAt(beats, n)).filter(Boolean);
  if (judged.length) {
    const at = judged[judged.length - 1].number;
    const moved = new Set(judged.flatMap((b) => linesOf(b).flatMap((l) => (statEntries(l) || []).map((e) => e.stat))));
    const unmoved = JUDGED_ON.filter((st) => !moved.has(st));
    out.push(unmoved.length
      ? {
        key: 'stats', ok: false, beat: at, label: unmoved.map((st) => `[STAT: ${st} ±n]`).join(' '),
        text: `Beat ${at}: the runway's verdict doesn't move her ${unmoved.join(', ')}: ${unmoved.map((st) => `[STAT: ${st} ±n]`).join(' ')}.`,
        ask: `The room's verdict on her runway walk moves her standing, each on its own line: ${JUDGED_ON.map((st) => `[STAT: ${st} ±n]`).join(', ')}; never coins.`,
      }
      : { key: 'stats', ok: true, beat: at, label: 'Judged on her standing', text: `Beat ${at}: her runway is judged on her reputation, brand trust, influence and stress.`, ask: null });
  }

  // Beat 13: Lala says how the outcome feels, in her own words.
  const recapBeat = beatAt(beats, RECAP_BEAT);
  if (recapBeat) {
    const says = linesOf(recapBeat).some(lalaSpeaks);
    out.push(says
      ? { key: 'beat13', ok: true, beat: RECAP_BEAT, label: 'Lala has her line', text: `Beat ${RECAP_BEAT}: Lala says how the outcome feels.`, ask: null }
      : { key: 'beat13', ok: false, beat: RECAP_BEAT, label: "Lala's line", text: `Beat ${RECAP_BEAT}: Lala never says how the outcome feels.`, ask: 'Lala says how the outcome feels, in her own words, as one spoken line (Lala: …); the numbers stay on the stat card, which she does not see.' });
  }

  // Coins change only in beat 8 (the look) and beat 13 (the event's own
  // costs); what she is owed is never a coin line. Beat 12 has its own row.
  // These need no money read (Script page audit 3, 2026-10-19: with the
  // Money page unread a + coin line passed).
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
  if (money) {
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

  out.push(...cutsceneFindings(beats));

  // JustAWoman on camera, in the cutscene: she comments, a Me: line in each
  // of beats 11 to 13.
  const silentIn = CUTSCENE.map((n) => beatAt(beats, n)).filter(Boolean)
    .filter((b) => !linesOf(b).some((l) => { const m = l.match(JAW_SAYS); return !!m && m[1].replace(/\([^)]*\)/g, '').trim().length > 0; }));
  for (const b of silentIn) {
    out.push({ key: `jaw-${b.number}`, ok: false, beat: b.number, label: 'JustAWoman comments (Me:)', text: `Beat ${b.number}: JustAWoman never comments on the cutscene (a Me: line).`, ask: "JustAWoman stays on screen and comments a little between the characters' lines, at least one line of her own: Me: …" });
  }
  if (!silentIn.length && CUTSCENE.some((n) => beatAt(beats, n))) {
    out.push({ key: 'jaw', ok: true, beat: CUTSCENE.find((n) => beatAt(beats, n)), label: 'JustAWoman comments', text: 'JustAWoman comments on the cutscene in each of its beats.', ask: null });
  }
  return out;
}
// END SHARED

/**
 * The rules' coverage items for a script split by splitScriptBeats
 * (`beats`: [{ number, text }], header first). `rules`: { money,
 * shoppingApproved, cast } from the writer's inputs (coverageFacts); when
 * not given, only the cutscene's phone lines (they need nothing read). Each item:
 * { kind: 'rule', rule, label, beat (where it is, or null), target, ask }.
 */
function scriptRuleItems(beats = [], rules = null) {
  const read = beats.map((b) => ({ number: b.number, lines: String(b.text || '').split('\n').slice(1) }));
  // The cutscene's phone lines need nothing read (Script page re-audit, 2026-10-19).
  const found = rules
    ? scriptRuleFindings(read, { money: rules.money || null, shoppingApproved: rules.shoppingApproved ?? null, cast: rules.cast || [] })
    : cutsceneFindings(read);
  return found
    .map((f) => ({ kind: 'rule', rule: f.key, label: f.label, beat: f.ok ? f.beat : null, target: f.beat, ask: f.ask }));
}

module.exports = { statEntries, coinChange, scriptRuleFindings, cutsceneFindings, scriptRuleItems, eventCast, goalPerson, personIn, personLine, speaks, norm, NOT_FIRST_NAMES, SHOPPING_LIST, JUDGED_ON };
