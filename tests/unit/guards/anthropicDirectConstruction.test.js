'use strict';

/**
 * Ratchet: direct Anthropic SDK use (AI egress gateway, G3 milestone P0a).
 *
 * Clients should be built by src/services/anthropicClient.js
 * (createAnthropicClient), the routing seam a later approved change will
 * point at the gateway. At P0a-1 no call site has moved yet, so the 146
 * existing direct constructions (120 files) are listed in
 * anthropicDirectConstruction.baseline.json. This guard fails when:
 *   - a file not in the baseline builds a client or loads an @anthropic-ai
 *     package directly;
 *   - a listed file's count rises;
 *   - a listed count is higher than the code (the migration that lowered it
 *     must lower the baseline too, so the ratchet tightens);
 *   - the baseline itself grows past the ceilings frozen below;
 *   - a string names the provider host outside src/aiGateway;
 *   - a scanned file cannot be parsed (nothing is skipped silently).
 * Only three files are exempt: the factory, aiCostTracker and aiResponseCache.
 *
 * This is an inventory guard, not gateway enforcement: the provider key is
 * still in the application's environment, so it bounds new direct use but
 * cannot prevent a determined bypass.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');
const { scanSource, inventory, EXEMPT } = require('../../../scripts/aigw/anthropicInventory');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASELINE_FILE = path.join(__dirname, 'anthropicDirectConstruction.baseline.json');
// The only place the provider host may be named: the gateway's own operation catalogue.
const HOST_ALLOWED_DIR = 'src/aiGateway/';
const outsideGateway = (refs) => Object.fromEntries(Object.entries(refs).filter(([f]) => !f.startsWith(HOST_ALLOWED_DIR)));

// Measured at 46c613d7. These only ever go down; never raise them.
const CEILING = Object.freeze({ constructions: 146, constructionFiles: 120, sdkImports: 140, sdkImportFiles: 120 });

const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);

/** Differences between the code (actual) and the baseline for one kind; [] when they agree. */
function ratchet(kind, actual, baseline) {
  const problems = [];
  for (const [file, n] of Object.entries(actual)) {
    if (!(file in baseline)) problems.push(`${kind}: ${file} has ${n}, and is not in the baseline. Use createAnthropicClient() from src/services/anthropicClient.js.`);
    else if (n > baseline[file]) problems.push(`${kind}: ${file} has ${n}, more than its baseline of ${baseline[file]}. Use createAnthropicClient().`);
  }
  for (const [file, n] of Object.entries(baseline)) {
    const now = actual[file] || 0;
    if (now < n) problems.push(`${kind}: ${file} is down to ${now} from ${n}. Lower its baseline entry${now === 0 ? ' (remove it)' : ''} in anthropicDirectConstruction.baseline.json.`);
  }
  return problems;
}

describe('direct Anthropic SDK use is ratcheted toward the client factory', () => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const inv = inventory(ROOT);

  test('every scanned file parses (no file is skipped silently)', () => {
    expect(inv.parseErrors).toEqual([]);
  });

  test('no new direct constructions and no raised counts', () => {
    expect(ratchet('constructions', inv.constructions, baseline.constructions)).toEqual([]);
  });

  test('no new direct SDK imports and no raised counts', () => {
    expect(ratchet('sdkImports', inv.sdkImports, baseline.sdkImports)).toEqual([]);
  });

  test('the baseline never grows past its frozen ceilings', () => {
    expect(sum(baseline.constructions)).toBeLessThanOrEqual(CEILING.constructions);
    expect(Object.keys(baseline.constructions).length).toBeLessThanOrEqual(CEILING.constructionFiles);
    expect(sum(baseline.sdkImports)).toBeLessThanOrEqual(CEILING.sdkImports);
    expect(Object.keys(baseline.sdkImports).length).toBeLessThanOrEqual(CEILING.sdkImportFiles);
    for (const n of [...Object.values(baseline.constructions), ...Object.values(baseline.sdkImports)]) {
      expect(Number.isSafeInteger(n) && n > 0).toBe(true);
    }
  });

  test('no string names the provider host outside src/aiGateway (no raw HTTP around the SDK)', () => {
    expect(outsideGateway(inv.hostRefs)).toEqual({});
  });

  test('only the factory, aiCostTracker and aiResponseCache are exempt, and all three exist', () => {
    expect([...EXEMPT].sort()).toEqual([
      'src/services/aiCostTracker.js',
      'src/services/aiResponseCache.js',
      'src/services/anthropicClient.js',
    ]);
    for (const f of EXEMPT) expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
  });

  test('the factory requires nothing but the SDK, so it cannot form a require cycle', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/services/anthropicClient.js'), 'utf8');
    const required = [];
    const visit = (n) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'require') {
        required.push(n.arguments[0] && n.arguments[0].value);
      }
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === 'string') visit(v);
      }
    };
    visit(espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }));
    expect(required).toEqual(['@anthropic-ai/sdk']);
  });
});

describe('the ratchet comparison', () => {
  test('a new file, a raised count and a stale entry each fail; agreement passes', () => {
    expect(ratchet('k', { 'a.js': 1 }, { 'a.js': 1 })).toEqual([]);
    expect(ratchet('k', { 'a.js': 1, 'new.js': 1 }, { 'a.js': 1 })[0]).toMatch(/new\.js has 1, and is not in the baseline/);
    expect(ratchet('k', { 'a.js': 2 }, { 'a.js': 1 })[0]).toMatch(/more than its baseline of 1/);
    expect(ratchet('k', { 'a.js': 1 }, { 'a.js': 2 })[0]).toMatch(/down to 1 from 2. Lower its baseline entry/);
    expect(ratchet('k', {}, { 'a.js': 1 })[0]).toMatch(/\(remove it\)/);
  });
});

describe('the detector', () => {
  const scan = (src, file = 'src/x.js') => scanSource(src, file);
  const SDK = "require('@anthropic-ai/sdk')";

  test.each([
    ['plain', `const A = ${SDK};\nconst c = new A();`],
    ['options', `const Anthropic = ${SDK};\nconst c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });`],
    ['.default || fallback', `const X = ${SDK}.default || ${SDK};\nnew X();`],
    ['.default || .Anthropic', `const X = ${SDK}.default || ${SDK}.Anthropic;\nnew X();`],
    ['destructured', `const { Anthropic: K } = ${SDK};\nnew K();`],
    ['member', `const sdk = ${SDK};\nnew sdk.Anthropic();`],
    ['inline require', `new (${SDK})();`],
    ['alias chain', `const a = ${SDK};\nconst b = a;\nnew b();`],
    ['assigned later', `let A;\ntry { A = ${SDK}; } catch (e) { A = null; }\nnew A();`],
    ['called without new', `const make = ${SDK};\nconst c = make({});`],
    ['ESM import', "import Claude from '@anthropic-ai/sdk';\nnew Claude();"],
    ['dynamic import', "async function f() { const m = await import('@anthropic-ai/sdk'); return new m.default(); }"],
    ['name backstop', 'const c = new AnthropicBedrock();'],
  ])('counts a direct construction: %s', (_label, src) => {
    expect(scan(src, src.startsWith('import') ? 'src/x.mjs' : 'src/x.js').constructions).toBe(1);
  });

  test('counts every SDK import form, including other @anthropic-ai packages', () => {
    expect(scan(`const A = ${SDK};`).sdkImports).toBe(1);
    expect(scan("const B = require(`@anthropic-ai/bedrock-sdk`);").sdkImports).toBe(1);
    expect(scan("import x from '@anthropic-ai/sdk';", 'src/x.mjs').sdkImports).toBe(1);
    expect(scan("export * from '@anthropic-ai/sdk';", 'src/x.mjs').sdkImports).toBe(1);
    expect(scan("import('@anthropic-ai/sdk');").sdkImports).toBe(1);
  });

  test('ignores comments, strings, unrelated classes and the factory call', () => {
    const src = [
      "// const c = new Anthropic(); require('@anthropic-ai/sdk')",
      "/* new Anthropic({ apiKey }) */",
      "const doc = \"new Anthropic() and require('@anthropic-ai/sdk')\";",
      'const m = new Map();',
      "const { createAnthropicClient } = require('../services/anthropicClient');",
      'const c = createAnthropicClient({ maxRetries: 0 });',
    ].join('\n');
    expect(scan(src)).toMatchObject({ constructions: 0, sdkImports: 0, hostRefs: 0 });
  });

  test('reports the provider host with line numbers; the guard exempts only src/aiGateway', () => {
    const host = ['api', 'anthropic', 'com'].join('.');
    const src = `const a = 1;\naxios.post('https://${host}/v1/messages', {});`;
    expect(scan(src, 'src/services/x.js')).toMatchObject({ hostRefs: 1, lines: { hostRefs: [2] } });
    expect(outsideGateway({ 'src/aiGateway/operationCatalog.js': 1, 'src/services/x.js': 1 })).toEqual({ 'src/services/x.js': 1 });
  });
});
