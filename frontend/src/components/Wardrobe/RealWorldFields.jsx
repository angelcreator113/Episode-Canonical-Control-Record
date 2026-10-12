/**
 * Producer Mode › Wardrobe › a piece's editor › "Real world" (Task #3019):
 * the real-world source of the piece (brand, retailer, prices, links, order
 * date), folded away under the in-world fields. These never appear in the
 * story; Shop the Look reads them. Pure helpers: lib/wardrobeRealWorld.
 * Styles: RealWorldFields.css (wa-real-*).
 */
import React from 'react';
import { REAL_FIELDS } from '../../lib/wardrobeRealWorld';
import './RealWorldFields.css';

const INPUT = { price: { type: 'number', min: '0', step: '0.01', inputMode: 'decimal' }, url: { type: 'url' }, date: { type: 'date' } };

export default function RealWorldFields({ value, onChange, disabled = false, source = null }) {
  const filled = REAL_FIELDS.filter((f) => String(value?.[f.key] ?? '').trim()).length;
  return (
    <details className="wa-real" data-testid="wardrobe-real-world">
      <summary>⋯ real world{filled ? ` (${filled})` : ''}</summary>
      <p className="wa-real-note">What you actually bought. Never shown in the story; only Shop the Look uses it.</p>
      <div className="wa-real-grid">
        {REAL_FIELDS.map((f) => (
          <label key={f.key} className={f.kind === 'url' ? 'wa-real-wide' : undefined}>
            {f.label}
            <input
              {...(INPUT[f.kind] || { type: 'text' })}
              name={f.key}
              value={value?.[f.key] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {source && <p className="wa-real-note">Source: {source}</p>}
    </details>
  );
}
