/**
 * sRGB contrast (the WCAG formula) and a reader for CSS custom properties,
 * shared by the theme tests (docs/VISUAL_SYSTEM.md §3).
 */
const lum = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The value of `--name` across the given stylesheets' text, following
 * var(--other) aliases to a literal. Later sources win, as in CSS.
 */
export function readToken(sources, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token ${name} is circular`);
  seen.add(name);
  let value = null;
  for (const css of sources) {
    const re = new RegExp(`^\\s*${name.replace(/-/g, '\\-')}:\\s*([^;]+);`, 'gm');
    let m;
    while ((m = re.exec(css))) value = m[1].trim();
  }
  if (value === null) throw new Error(`token ${name} not found`);
  const alias = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  return alias ? readToken(sources, alias[1], seen) : value;
}

/**
 * Drops task and issue references ("Task #2292", "PRs #1590/#1593") from a
 * source text before it is scanned for color literals, so the scan reads
 * only colors. A color literal is quoted or follows a colon or "solid"; a
 * reference never is ("Phase A, #2278" is prose, so a comma does not mark a
 * color; a gradient's value list is caught by each guard's own gradient
 * check). Stripping every "#" plus three or four digits hid the all-digit
 * greys #333, #555, #666, #777, #888 and #999 when they were colors
 * (docs/VISUAL_SYSTEM.md §5).
 */
export const stripTaskRefs = (s) => s.replace(/(?<!['":]\s?)(?<!solid\s)#\d{3,4}\b/g, '');
