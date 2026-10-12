/**
 * A wardrobe piece's real-world source (Task #3019; the fields are #2873):
 * what Evoni actually bought, kept apart from the piece's in-world brand,
 * price and links. Nothing in-world reads these; Shop the Look does
 * (Distribution, and the website once she publishes a look).
 *
 * The server's allow-list is realFieldsFrom in wardrobeController: text is
 * trimmed and empty clears it, a price is a number of zero or more, a date is
 * YYYY-MM-DD, and an absent key is left alone. So the editor sends only the
 * fields she changed.
 */

export const REAL_FIELDS = [
  { key: 'real_brand', label: 'Brand' },
  { key: 'real_product_name', label: 'Product name' },
  { key: 'real_retailer', label: 'Retailer' },
  { key: 'real_color', label: 'Colour' },
  { key: 'real_size', label: 'Size' },
  { key: 'real_price_paid', label: 'Price paid', kind: 'price' },
  { key: 'real_list_price', label: 'List price', kind: 'price' },
  { key: 'real_product_url', label: 'Product page', kind: 'url' },
  { key: 'affiliate_url', label: 'Affiliate link', kind: 'url' },
  { key: 'real_order_date', label: 'Order date', kind: 'date' },
];

const LABELS = Object.fromEntries([...REAL_FIELDS.map((f) => [f.key, f.label]), ['real_source', 'Source']]);

const asText = (v) => (v === null || v === undefined ? '' : String(v));
// The server stores DECIMAL(10,2), which reads back as "12.50"; compare by value.
const samePrice = (a, b) => (a === '' || b === '') ? a === b : Number(a) === Number(b);

/** The form's starting values for a piece: every real field as text. */
export function realDraftFrom(piece) {
  const draft = {};
  for (const { key, kind } of REAL_FIELDS) {
    const v = asText(piece?.[key]);
    draft[key] = kind === 'date' ? v.slice(0, 10) : v;
  }
  return draft;
}

/**
 * Only the real fields she changed, ready for PUT /api/v1/wardrobe/:id: an
 * emptied field is sent as null (cleared). The first time any real field is
 * filled on a piece with no source, real_source is set to "manual".
 */
export function realChanges(piece, draft) {
  const before = realDraftFrom(piece);
  const out = {};
  for (const { key, kind } of REAL_FIELDS) {
    const now = asText(draft?.[key]).trim();
    const was = before[key].trim();
    const same = kind === 'price' ? samePrice(now, was) : now === was;
    if (!same) out[key] = now === '' ? null : now;
  }
  const fills = Object.values(out).some((v) => v !== null);
  if (fills && !asText(piece?.real_source).trim()) out.real_source = 'manual';
  return out;
}

/** The server's refusal of real fields, in plain words; null for any other error. */
export function realWorldErrorText(err) {
  const data = err?.response?.data;
  if (data?.error !== 'Invalid real-world fields' || !Array.isArray(data.details)) return null;
  const lines = data.details.map((d) => {
    const [key, ...rest] = String(d).split(' ');
    return LABELS[key] ? `${LABELS[key]} ${rest.join(' ')}` : String(d);
  });
  return `Real world: ${lines.join('; ')}.`;
}
