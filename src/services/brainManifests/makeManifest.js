'use strict';

/**
 * Builds a page's Brain Manifest from a table of its domains (Brain Update;
 * docs/BRAIN_OWNERSHIP.md §6). A manifest turns the page's data map into
 * Brain cards, one per source item, each keyed by the item's name so the
 * key survives edits and reordering.
 *
 * config:
 *   SOURCE           the key prefix and sync name ('cultural_calendar')
 *   LABEL            the page as people know it ('Culture & Events — Calendar')
 *   PAGE_CONTENT     the usePageData page name the data comes from
 *   SOURCE_DOCUMENT  the source_document the seeders and the old Push to
 *                    Brain used, so legacy entries can be counted
 *   PRESENTATION     extra fields never sent (icon, color, num and accent
 *                    never are)
 *   DOMAINS          [{ key, kind, label, id | name, fields, humanizeName, whole }]
 *     key      the page data key ('CELEBRITY_HIERARCHY')
 *     kind     the key segment ('celebrity-tier')
 *     label    what one item is ('Celebrity Tier')
 *     id       the field naming an item, or
 *     name     (item) => its name, when no one field does
 *     fields   labels for fields, in order; other fields follow, sorted,
 *              under a label made from the field name
 *     humanizeName  the name is snake_case; show it as words
 *     whole    the value is one thing (a rule, a list of questions, a
 *              profile): one card for all of it
 *
 * Pure; no I/O.
 */

const ALWAYS_PRESENTATION = ['icon', 'color', 'num', 'accent'];

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Field names the pages abbreviate.
const WORDS = { desc: 'Description', cat: 'Category', gen: 'Generation' };
const humanize = (k) => WORDS[k] || k.replace(/_+$/, '').replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`)
  .replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const scalar = (v) => (typeof v === 'string' ? v.trim() : (typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''));

function makeManifest(config) {
  const { SOURCE, LABEL, PAGE_CONTENT, SOURCE_DOCUMENT, DOMAINS } = config;
  const presentation = new Set([...ALWAYS_PRESENTATION, ...(config.PRESENTATION || [])]);

  // A field's value as text: a scalar as is, a list joined, a list of
  // records one per line, a record as its labeled parts. Presentation
  // fields inside records are dropped too.
  const render = (v) => {
    if (Array.isArray(v)) {
      if (v.every((x) => !x || typeof x !== 'object')) return v.map(scalar).filter(Boolean).join('; ');
      return v.map((x) => (x && typeof x === 'object' ? `\n- ${record(x, ' · ')}` : `\n- ${scalar(x)}`)).join('');
    }
    if (v && typeof v === 'object') return record(v, '; ');
    return scalar(v);
  };
  const record = (obj, sep) => Object.keys(obj)
    .filter((k) => !presentation.has(k))
    .map((k) => [k, render(obj[k])])
    .filter(([, t]) => t)
    .map(([k, t]) => `${humanize(k)}: ${t}`)
    .join(sep);

  function wholeCard(domain, value) {
    let body = '';
    if (Array.isArray(value) && value.every((x) => !x || typeof x !== 'object')) {
      body = value.map(scalar).filter(Boolean).map((t) => `- ${t}`).join('\n');
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      body = Object.keys(value).filter((k) => !presentation.has(k))
        .map((k) => [k, render(value[k])]).filter(([, t]) => t)
        .map(([k, t]) => `${humanize(k)}: ${t}`).join('\n');
    } else {
      body = render(value).replace(/^\n/, '');
    }
    if (!body) return null;
    return {
      source_key: `${SOURCE}:${domain.kind}`,
      title: `${domain.label} — ${LABEL}`.slice(0, 200),
      content: `${domain.label} (${LABEL})\n${body}`,
      category: 'world',
      severity: 'important',
      domain: domain.label,
    };
  }

  /**
   * pageData: the page's data map. Returns { cards, skipped }: cards are
   * { source_key, title, content, category, severity, domain } in page
   * order; skipped lists items with no name ({ domain, index }).
   */
  function buildCards(pageData = {}) {
    const cards = [];
    const skipped = [];
    for (const domain of DOMAINS) {
      const value = pageData[domain.key];
      if (domain.whole) {
        const c = value == null ? null : wholeCard(domain, value);
        if (c) cards.push(c);
        continue;
      }
      const items = Array.isArray(value) ? value : [];
      const fields = domain.fields || {};
      const seen = new Map();
      items.forEach((item, index) => {
        if (!item || typeof item !== 'object') { skipped.push({ domain: domain.label, index }); return; }
        const raw = scalar(domain.name ? domain.name(item) : item[domain.id]);
        const name = raw && domain.humanizeName ? humanize(raw) : raw;
        if (!name || !slug(name)) { skipped.push({ domain: domain.label, index }); return; }
        const base = slug(name);
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        const lines = [`${name} (${domain.label})`];
        const keys = [...Object.keys(fields), ...Object.keys(item).filter((k) => !(k in fields)).sort()];
        for (const k of keys) {
          if (k === domain.id || presentation.has(k)) continue;
          const t = render(item[k]);
          if (t) lines.push(`${fields[k] || humanize(k)}:${t.startsWith('\n') ? '' : ' '}${t}`);
        }
        cards.push({
          source_key: `${SOURCE}:${domain.kind}:${n > 1 ? `${base}-${n}` : base}`,
          title: `${name} — ${domain.label}`.slice(0, 200),
          content: lines.join('\n'),
          category: 'world',
          severity: 'important',
          domain: domain.label,
        });
      });
    }
    return { cards, skipped };
  }

  return {
    SOURCE, LABEL, PAGE_CONTENT, SOURCE_DOCUMENT,
    DOMAINS: DOMAINS.map((d) => d.label),
    buildCards,
  };
}

module.exports = { makeManifest, humanize, slug };
