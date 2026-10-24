/**
 * What putting a History version back would change (History audit,
 * 2026-10-24: "no diff"): the script's lines, blank lines left out, as
 * [{ type: 'same' | 'add' | 'del', text }] from `from` (the page) to `to`
 * (the version). The longest run of lines kept in order is matched; past
 * ~4 million line pairs a plain set comparison stands in, so a huge paste
 * never hangs the panel. Pure: no React, no network.
 */
const linesOf = (text) => String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());

export function lineDiff(from, to) {
  const a = linesOf(from);
  const b = linesOf(to);
  const n = a.length;
  const m = b.length;
  if (n * m > 4e6) {
    const inA = new Set(a);
    const inB = new Set(b);
    return [...a.map((t) => ({ type: inB.has(t) ? 'same' : 'del', text: t })), ...b.filter((t) => !inA.has(t)).map((t) => ({ type: 'add', text: t }))];
  }
  const len = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) len[i][j] = a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i += 1; j += 1; }
    else if (len[i + 1][j] >= len[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i += 1; }
    else { out.push({ type: 'add', text: b[j] }); j += 1; }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i += 1; }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j += 1; }
  return out;
}

/**
 * The changed lines with `context` unchanged lines around each run, and a
 * { type: 'gap' } where unchanged lines are left out between runs.
 */
export function diffHunks(diff, context = 1) {
  const keep = diff.map(() => false);
  diff.forEach((d, k) => {
    if (d.type === 'same') return;
    for (let x = Math.max(0, k - context); x <= Math.min(diff.length - 1, k + context); x += 1) keep[x] = true;
  });
  const out = [];
  diff.forEach((d, k) => {
    if (keep[k]) out.push(d);
    else if (out.length && out[out.length - 1].type !== 'gap') out.push({ type: 'gap' });
  });
  while (out.length && out[out.length - 1].type === 'gap') out.pop();
  return out;
}

/** "3 lines in, 1 line out", how many lines a diff adds and takes away. */
export function diffSummary(diff) {
  const add = diff.filter((d) => d.type === 'add').length;
  const del = diff.filter((d) => d.type === 'del').length;
  return { add, del };
}
