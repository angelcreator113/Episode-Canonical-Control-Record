'use strict';

/**
 * Anthropic SDK inventory (AI egress gateway, G3 milestone P0a).
 *
 * Finds, per source file, the places that build an Anthropic client or load
 * an @anthropic-ai package directly, instead of going through
 * src/services/anthropicClient.js. Read-only: it parses files and prints;
 * it never writes, never loads the code it scans and never touches the
 * network.
 *
 * It parses with espree (ESLint's parser), so comments and strings that only
 * mention the SDK are not counted, and it follows the SDK through aliases:
 *   const A = require('@anthropic-ai/sdk');            new A(...)
 *   const A = require('@anthropic-ai/sdk').default || ...; new A(...)
 *   const { Anthropic } = require('@anthropic-ai/sdk'); new Anthropic(...)
 *   const sdk = require('@anthropic-ai/sdk');           new sdk.Anthropic(...)
 *   new (require('@anthropic-ai/sdk'))(...)
 *   A(...)            (the SDK's module export also builds a client without `new`)
 *   import A from '@anthropic-ai/sdk' / import('@anthropic-ai/sdk')
 *   let A; A = require('@anthropic-ai/sdk');            (assigned later)
 * and, as a backstop, any `new X(...)` whose name starts or ends with
 * `Anthropic` (AnthropicBedrock, AnthropicVertex, ...).
 * Not detected (documented limits): require() with a computed module name,
 * a client built in a module that is never parsed (node_modules, tests/),
 * and an SDK constructor passed through function arguments.
 *
 * Also reported: string literals naming the provider host api.anthropic.com
 * (a raw HTTP path around the SDK). The scanner reports them in every file;
 * the guard test exempts only the gateway's own operation catalogue
 * directory, so this file does not need to name it.
 *
 * Usage: node scripts/aigw/anthropicInventory.js [--json]
 * The guard tests/unit/guards/anthropicDirectConstruction.test.js runs the
 * same scan against its committed baseline.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.resolve(__dirname, '..', '..');

/** Directories scanned, relative to the repository root. */
const SCAN_DIRS = ['src', 'scripts', 'lambda', 'frontend/src'];
/** Repository-root files scanned as well (*.js, *.cjs, *.mjs at the top level). */
const ROOT_FILE = /^[^/]+\.(c|m)?js$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__mocks__']);
const EXTENSIONS = /\.(c|m)?jsx?$/;

/** The SDK infrastructure allowed to load and construct the SDK directly. */
const EXEMPT = Object.freeze([
  'src/services/anthropicClient.js', // the factory
  'src/services/aiCostTracker.js', // patches Messages.prototype.create (budget gate, usage log)
  'src/services/aiResponseCache.js', // wraps the same prototype method (Redis cache)
]);

const HOST = ['api', 'anthropic', 'com'].join('.'); // built, so this file does not report itself
const SDK_PREFIX = '@anthropic-ai/';

function listFiles(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p);
      } else if (e.isFile() && EXTENSIONS.test(e.name)) {
        out.push(path.relative(root, p).split(path.sep).join('/'));
      }
    }
  };
  for (const d of SCAN_DIRS) walk(path.join(root, d));
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && ROOT_FILE.test(e.name)) out.push(e.name);
  }
  return out.sort();
}

function parse(source, file = '') {
  const jsx = /\.jsx$/.test(file) || file.startsWith('frontend/');
  const base = { ecmaVersion: 'latest', range: true, ecmaFeatures: { jsx, globalReturn: true } };
  const attempts = file.endsWith('.mjs') || file.startsWith('frontend/')
    ? ['module', 'script'] : ['script', 'module'];
  let lastErr;
  for (const sourceType of attempts) {
    try {
      return espree.parse(source.replace(/^#!.*/, ''), { ...base, sourceType, ecmaFeatures: { ...base.ecmaFeatures, globalReturn: sourceType === 'script' } });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

const isSdkName = (v) => typeof v === 'string' && v.startsWith(SDK_PREFIX);
const literalString = (n) => {
  if (!n) return null;
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return n.quasis[0].value.cooked;
  return null;
};
const isRequireOfSdk = (n) => Boolean(n && n.type === 'CallExpression' && n.callee.type === 'Identifier'
  && n.callee.name === 'require' && isSdkName(literalString(n.arguments[0])));

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

/** True when the expression evaluates to the SDK module or one of its exports. */
function refersToSdk(n, bindings) {
  if (!n) return false;
  if (isRequireOfSdk(n)) return true;
  if (n.type === 'Identifier') return bindings.has(n.name);
  if (n.type === 'MemberExpression') return refersToSdk(n.object, bindings);
  if (n.type === 'LogicalExpression') return refersToSdk(n.left, bindings) || refersToSdk(n.right, bindings);
  if (n.type === 'ConditionalExpression') return refersToSdk(n.consequent, bindings) || refersToSdk(n.alternate, bindings);
  if (n.type === 'AwaitExpression') return refersToSdk(n.argument, bindings);
  if (n.type === 'ImportExpression') return isSdkName(literalString(n.source));
  if (n.type === 'ChainExpression') return refersToSdk(n.expression, bindings);
  return false;
}

function bindPattern(pattern, bindings) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') bindings.add(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => bindPattern(p.type === 'RestElement' ? p.argument : p.value, bindings));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((e) => bindPattern(e, bindings));
  else if (pattern.type === 'AssignmentPattern') bindPattern(pattern.left, bindings);
}

const calleeName = (c) => {
  if (!c) return '';
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') return c.property.name;
  return '';
};

/**
 * Scan one source text. Returns
 *   { sdkImports, constructions, hostRefs, lines: { sdkImports: [...], constructions: [...], hostRefs: [...] } }
 */
function scanSource(source, file = '') {
  const ast = parse(source, file);
  const lineOf = (n) => source.slice(0, n.range[0]).split('\n').length;
  const result = { sdkImports: 0, constructions: 0, hostRefs: 0, lines: { sdkImports: [], constructions: [], hostRefs: [] } };
  const add = (kind, n) => { result[kind] += 1; result.lines[kind].push(lineOf(n)); };

  // Pass 1: names bound to the SDK module or its exports (fixed point, for chains of aliases).
  const bindings = new Set();
  let size = -1;
  while (bindings.size !== size) {
    size = bindings.size;
    walk(ast, (n) => {
      if (n.type === 'ImportDeclaration' && isSdkName(n.source.value)) n.specifiers.forEach((s) => bindings.add(s.local.name));
      if (n.type === 'VariableDeclarator' && n.init && refersToSdk(n.init, bindings)) bindPattern(n.id, bindings);
      if (n.type === 'AssignmentExpression' && refersToSdk(n.right, bindings)) bindPattern(n.left, bindings);
    });
  }

  // Pass 2: imports, constructions and raw host references.
  walk(ast, (n) => {
    if (isRequireOfSdk(n)) add('sdkImports', n);
    else if (n.type === 'ImportDeclaration' && isSdkName(n.source.value)) add('sdkImports', n);
    else if ((n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source && isSdkName(n.source.value)) add('sdkImports', n);
    else if (n.type === 'ImportExpression' && isSdkName(literalString(n.source))) add('sdkImports', n);

    if (n.type === 'NewExpression') {
      if (refersToSdk(n.callee, bindings) || /^Anthropic|Anthropic$/.test(calleeName(n.callee))) add('constructions', n);
    } else if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && bindings.has(n.callee.name)) {
      add('constructions', n); // the module export builds a client when called without `new`
    }

    const s = n.type === 'Literal' && typeof n.value === 'string' ? n.value
      : (n.type === 'TemplateElement' ? n.value.cooked : null);
    if (s && s.includes(HOST)) add('hostRefs', n);
  });
  return result;
}

/** Scan the repository. Returns { files: { [file]: scanResult }, parseErrors: [{ file, message }] }. */
function scanRepo(root = ROOT) {
  const files = {};
  const parseErrors = [];
  for (const file of listFiles(root)) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (!/anthropic/i.test(source)) continue; // nothing to find; skip the parse
    try {
      const r = scanSource(source, file);
      if (r.sdkImports || r.constructions || r.hostRefs) files[file] = r;
    } catch (err) {
      parseErrors.push({ file, message: err.message });
    }
  }
  return { files, parseErrors };
}

/** The guard's view: per-file counts for every non-exempt file. */
function inventory(root = ROOT) {
  const { files, parseErrors } = scanRepo(root);
  const constructions = {};
  const sdkImports = {};
  const hostRefs = {};
  for (const [file, r] of Object.entries(files)) {
    if (EXEMPT.includes(file)) continue;
    if (r.constructions) constructions[file] = r.constructions;
    if (r.sdkImports) sdkImports[file] = r.sdkImports;
    if (r.hostRefs) hostRefs[file] = r.hostRefs;
  }
  const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);
  return {
    constructions, sdkImports, hostRefs, parseErrors, exemptFound: Object.keys(files).filter((f) => EXEMPT.includes(f)),
    totals: { constructions: total(constructions), constructionFiles: Object.keys(constructions).length, sdkImports: total(sdkImports), sdkImportFiles: Object.keys(sdkImports).length, hostRefs: total(hostRefs) },
  };
}

module.exports = { scanSource, scanRepo, inventory, listFiles, EXEMPT, SCAN_DIRS, ROOT };

if (require.main === module) {
  const inv = inventory();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(inv, null, 2)}\n`);
  } else {
    process.stdout.write(`Direct Anthropic constructions: ${inv.totals.constructions} in ${inv.totals.constructionFiles} files\n`);
    process.stdout.write(`Direct SDK imports: ${inv.totals.sdkImports} in ${inv.totals.sdkImportFiles} files\n`);
    process.stdout.write(`String literals naming ${HOST}: ${inv.totals.hostRefs} (${Object.keys(inv.hostRefs).join(', ') || 'none'})\n`);
    process.stdout.write(`Exempt SDK infrastructure present: ${inv.exemptFound.join(', ') || '(none)'}\n`);
    if (inv.parseErrors.length) {
      process.stdout.write(`Parse errors (${inv.parseErrors.length}):\n${inv.parseErrors.map((e) => `  ${e.file}: ${e.message}`).join('\n')}\n`);
      process.exitCode = 1;
    }
  }
}
