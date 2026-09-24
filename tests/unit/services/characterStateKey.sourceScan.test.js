/**
 * Task #1816 — one character_state key, 'lala', per the F-Sec-3 decision
 * (docs/audit/F-Sec-3_Canonical_CharacterKey_Decision_2026-07-02.md).
 *
 * Source scan: no code under src/ may read or write character_state (or
 * character_state_history) with the 'justawoman' key.
 *
 * Deliberately NOT matched (these are not character_state keys):
 *   - is_justawoman_record, justawomaninherprime, justawoman_mirror,
 *     justawoman_line / justawoman_action (identifiers, not the literal)
 *   - 'justawoman' used as a beat actor, feed/social enum value, registry
 *     seed id, therapy/threshold profile key, or franchise_knowledge
 *     applies_to label — none of those sit in a character_key comparison
 *     or in a SQL string that touches character_state.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', '..', 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(SRC);

describe("character_state key is 'lala' everywhere (Task #1816)", () => {
  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("has no character_key = 'justawoman' / character_key: 'justawoman' literal in src/", () => {
    const pattern = /character_key\s*(?:===|=|:)\s*['"]justawoman['"]/;
    const hits = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("has no SQL template touching character_state that carries a 'justawoman' literal", () => {
    // Catches positional writes such as
    //   INSERT INTO character_state_history (..., character_key, ...)
    //   VALUES (:id, :showId, 'justawoman', ...)
    const hits = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const templates = src.match(/`[^`]*`/g) || [];
      for (const t of templates) {
        if (/character_state/.test(t) && /'justawoman'/.test(t)) {
          hits.push(`${path.relative(SRC, f)}: ${t.slice(0, 160).replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
