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
