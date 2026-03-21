const fs = require('fs');
const code = fs.readFileSync('frontend/src/pages/StoryEngine.jsx', 'utf8');
const lines = code.split('\n');

// Find "}) {" — the actual function body start for StoryPanel
let bodyStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function StoryPanel(')) {
    // Now find the "}) {" line
    for (let j = i; j < lines.length; j++) {
      if (/^\}\)\s*\{/.test(lines[j].trim())) {
        bodyStart = j;
        break;
      }
    }
    break;
  }
}

// Find matching close brace — start at depth 1 (the body '{' is already counted)
let depth = 1, bodyEnd = -1;
for (let i = bodyStart + 1; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) { bodyEnd = i; break; }
    }
  }
  if (bodyEnd >= 0) break;
}

console.log('StoryPanel body: lines', bodyStart + 1, 'to', bodyEnd + 1);
console.log('Body length:', bodyEnd - bodyStart, 'lines');

// Collect const/let declarations at function body level (2-space indent)
const decls = new Map();
for (let i = bodyStart + 1; i < bodyEnd; i++) {
  const line = lines[i];
  let m = line.match(/^  const (\w+)\s*=/);
  if (m && !decls.has(m[1])) decls.set(m[1], i + 1);
  m = line.match(/^  let (\w+)\s*=/);
  if (m && !decls.has(m[1])) decls.set(m[1], i + 1);
  m = line.match(/^  const \[([^\]]+)\]/);
  if (m) {
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
      const clean = name.replace(/\s*=.*/, '');
      if (clean && !decls.has(clean)) decls.set(clean, i + 1);
    });
  }
}

console.log('Total declarations found:', decls.size);

// Check for usages before declaration
const issues = [];
for (const [name, declLine] of decls) {
  const re = new RegExp('\\b' + name + '\\b');
  for (let i = bodyStart + 1; i < declLine - 1; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    if (re.test(line)) {
      issues.push({ name, declLine, usedLine: i + 1, snippet: line.trim().substring(0, 100) });
      break;
    }
  }
}

console.log('\nPotential TDZ issues:', issues.length);
issues.forEach(i => console.log(JSON.stringify(i)));
