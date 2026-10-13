/**
 * Producer Mode › Wardrobe › a piece's editor › "Real world" (Task #3019):
 * the real-world source of the piece (brand, retailer, prices, links, order
 * date), folded away under the in-world fields. These never appear in the
 * story; Shop the Look reads them. Pure helpers: lib/wardrobeRealWorld.
 * Styles: RealWorldFields.css (wa-real-*).
 *
 * `lazy` (Add piece, Task 3083): the inputs render only once the section is
 * opened, so a closed section adds no fields to the dialog.
 */
import React, { useState } from 'react';
import { REAL_FIELDS } from '../../lib/wardrobeRealWorld';
import './RealWorldFields.css';

const INPUT = { price: { type: 'number', min: '0', step: '0.01', inputMode: 'decimal' }, url: { type: 'url' }, date: { type: 'date' } };

export default function RealWorldFields({ value, onChange, disabled = false, source = null, lazy = false }) {
  const [open, setOpen] = useState(false);
  const filled = REAL_FIELDS.filter((f) => String(value?.[f.key] ?? '').trim()).length;
  const shown = !lazy || open;
  return (
    <details className="wa-real" data-testid="wardrobe-real-world" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>⋯ real world{filled ? ` (${filled})` : ''}</summary>
      <p className="wa-real-note">What you actually bought. Never shown in the story; only Shop the Look uses it.</p>
      {shown && <div className="wa-real-grid">
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
      </div>}
      {source && <p className="wa-real-note">Source: {source}</p>}
    </details>
  );
}
