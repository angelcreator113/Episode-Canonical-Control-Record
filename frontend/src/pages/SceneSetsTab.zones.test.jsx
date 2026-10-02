/**
 * L14 (Evoni, 2026-10-02, answers 1-9; §8(hh)): an angle's kind is a zone of
 * the place (Front, Inside, Back, Event area, Zone) or an extra framing on a
 * zone; an extra with no zone is on Inside, the set's base.
 */
import React, { useState } from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import { AngleKindFields, ANGLE_KIND_OPTIONS } from './SceneSetsTab';

const ANGLES = [
  { id: 'a-front', angle_name: 'Front steps', angle_kind: 'front' },
  { id: 'a-back', angle_name: 'Green room', angle_kind: 'back' },
  { id: 'a-extra', angle_name: 'Mirror close', angle_kind: 'extra' },
];

function Harness({ onState }) {
  const [value, setValue] = useState({ angle_kind: '', zone_angle_id: '' });
  return (
    <AngleKindFields
      value={value}
      angles={ANGLES}
      onChange={(patch) => { const next = { ...value, ...patch }; setValue(next); onState(next); }}
    />
  );
}

describe('SceneSetsTab angle kinds as zones (L14)', () => {
  test('the kinds are the zones and the extra framing', () => {
    expect(ANGLE_KIND_OPTIONS).toEqual({
      front: 'Front', inside: 'Inside', back: 'Back', area: 'Event area', zone: 'Zone', extra: 'Extra framing',
    });
    render(<Harness onState={() => {}} />);
    const kind = screen.getByLabelText('Angle kind');
    expect(within(kind).getAllByRole('option').map((o) => o.textContent)).toEqual(['None', 'Front', 'Inside', 'Back', 'Event area', 'Zone', 'Extra framing']);
    expect(screen.queryByLabelText('Zone of this framing')).toBeNull();
  });

  test('an extra framing names its zone: Inside (the base) or one of the set\'s zones', () => {
    const states = [];
    render(<Harness onState={(s) => states.push(s)} />);
    fireEvent.change(screen.getByLabelText('Angle kind'), { target: { value: 'extra' } });
    const zone = screen.getByLabelText('Zone of this framing');
    expect(within(zone).getAllByRole('option').map((o) => o.textContent)).toEqual(['Inside (the base)', 'Front: Front steps', 'Back: Green room']);
    fireEvent.change(zone, { target: { value: 'a-back' } });
    expect(states.at(-1)).toEqual({ angle_kind: 'extra', zone_angle_id: 'a-back' });
    // Leaving extra clears the zone.
    fireEvent.change(screen.getByLabelText('Angle kind'), { target: { value: 'back' } });
    expect(states.at(-1)).toEqual({ angle_kind: 'back', zone_angle_id: '' });
    expect(screen.queryByLabelText('Zone of this framing')).toBeNull();
  });
});
