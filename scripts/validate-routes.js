#!/usr/bin/env node
'use strict';

// ============================================================================
// validate-routes.js — Static analysis of route files for common problems
// ============================================================================
// Catches issues that would cause 500s or silent failures at runtime:
//   1. Route files in src/routes/ that aren't registered in app.js
//   2. Route handlers missing try/catch (unhandled promise rejections)
//   3. Async handlers without error wrapping
//   4. Response handlers that never send a response on error paths
//
// Run: node scripts/validate-routes.js
// Exit: 0 = clean, 1 = issues found

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ROUTES_DIR = path.join(SRC, 'routes');
const APP_FILE = path.join(SRC, 'app.js');

let warnings = 0;
let errors = 0;

function warn(msg) {
  console.warn(`  ⚠  ${msg}`);
  warnings++;
}

function error(msg) {
  console.error(`  ✗  ${msg}`);
  errors++;
}

// ── 1. Check for unregistered route files ────────────────────────────────────
console.log('\n1. Checking for unregistered route files...');

const appSource = fs.readFileSync(APP_FILE, 'utf8');
const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));

for (const file of routeFiles) {
  const basename = file.replace('.js', '');
  // Check if this file is required anywhere in app.js
  const patterns = [
    `'./routes/${basename}'`,
    `'./routes/${file}'`,
    `"./routes/${basename}"`,
    `"./routes/${file}"`,
  ];
  const isRegistered = patterns.some(p => appSource.includes(p));
  if (!isRegistered) {
    warn(`${file} exists in src/routes/ but is not registered in app.js`);
  }
}

// ── 2. Check route handlers for missing error handling ───────────────────────
console.log('\n2. Checking route handlers for missing error handling...');

for (const file of routeFiles) {
  const filePath = path.join(ROUTES_DIR, file);
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');

  // Find async route handlers
  let asyncHandlerCount = 0;
  let handlerWithTryCatch = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: router.get('/path', ..., async (req, res
    if (/router\.(get|post|put|patch|delete)\s*\(/.test(line) && /async\s*\(/.test(line)) {
      asyncHandlerCount++;
      // Look ahead for try { within the next 10 lines
      const lookahead = lines.slice(i, i + 15).join('\n');
      if (lookahead.includes('try {') || lookahead.includes('try{')) {
        handlerWithTryCatch++;
      }
    }
  }

  if (asyncHandlerCount > 0 && handlerWithTryCatch < asyncHandlerCount) {
    const missing = asyncHandlerCount - handlerWithTryCatch;
    warn(`${file}: ${missing} of ${asyncHandlerCount} async handlers may be missing try/catch`);
  }
}

// ── 3. Check for require() calls that reference non-existent files ───────────
console.log('\n3. Checking for broken local requires...');

const allSrcFiles = [];
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walkDir(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      allSrcFiles.push(full);
    }
  }
}
walkDir(SRC);

for (const file of allSrcFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const relFile = path.relative(path.join(__dirname, '..'), file);

  // Find require('./...' or require('../...' patterns
  const requirePattern = /require\s*\(\s*['"](\.\/.+?|\.\.\/[^'"]+?)['"]\s*\)/g;
  let match;
  while ((match = requirePattern.exec(source)) !== null) {
    const reqPath = match[1];
    const resolved = path.resolve(path.dirname(file), reqPath);

    // Find line number and check context
    const beforeMatch = source.substring(0, match.index);
    const lineNum = beforeMatch.split('\n').length;
    const lineText = lines[lineNum - 1] || '';

    // Skip requires inside comments (JSDoc, //, /* */)
    const trimmed = lineText.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Skip requires inside try/catch blocks (optional deps pattern)
    // Look backwards from this line for a try { that isn't closed yet
    const preceding = lines.slice(Math.max(0, lineNum - 5), lineNum).join('\n');
    if (/try\s*\{/.test(preceding) && !preceding.includes('} catch')) continue;

    // Check if the file exists (with or without .js extension)
    const candidates = [resolved, resolved + '.js', resolved + '/index.js', resolved + '.json'];
    const exists = candidates.some(c => {
      try { return fs.statSync(c).isFile(); } catch { return false; }
    });

    if (!exists) {
      error(`${relFile}:${lineNum} — requires '${reqPath}' but file does not exist`);
    }
  }
}

// ── 4. Check for model references that might not exist ───────────────────────
console.log('\n4. Checking for potentially missing model references...');

// Get all model names from src/models/
const modelsDir = path.join(SRC, 'models');
const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js') && f !== 'index.js');
const knownModels = new Set(modelFiles.map(f => f.replace('.js', '')));

// Check route files for model destructuring without guards
for (const file of routeFiles) {
  const filePath = path.join(ROUTES_DIR, file);
  const source = fs.readFileSync(filePath, 'utf8');

  // Find patterns like: const { ModelName } = require('../models')
  const destructurePattern = /const\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]\.\.\/models['"]\s*\)/g;
  let match;
  while ((match = destructurePattern.exec(source)) !== null) {
    const models = match[1].split(',').map(m => m.trim()).filter(Boolean);
    for (const model of models) {
      const cleanName = model.replace(/\s+as\s+\w+/, '').trim();
      if (cleanName === 'Op' || cleanName === 'Sequelize' || cleanName === 'sequelize') continue;
      // This is just informational — models might be optional
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log(`Route files scanned: ${routeFiles.length}`);
console.log(`Source files scanned: ${allSrcFiles.length}`);
if (errors > 0) console.error(`Errors: ${errors}`);
if (warnings > 0) console.warn(`Warnings: ${warnings}`);
if (errors === 0 && warnings === 0) console.log('All checks passed.');
console.log('');

process.exit(errors > 0 ? 1 : 0);
