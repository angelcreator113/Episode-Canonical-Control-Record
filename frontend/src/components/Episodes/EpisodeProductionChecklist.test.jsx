import { describe, expect, test } from 'vitest';
import { computeSectionState, CHECKLIST_SECTIONS } from './EpisodeProductionChecklist';

const requiredSection = {
  id: 'brief',
  items: [
    { id: 'first', required: true },
    { id: 'second', required: true },
  ],
};

const optionalOnlySection = {
  id: 'social',
  items: [{ id: 'optional', required: false }, { id: 'other', required: false }],
};

const unavailableSection = {
  id: 'future',
  unavailableReason: 'Not built yet',
  items: [{ id: 'x', required: false }],
};

describe('computeSectionState', () => {
  test('transitions from needs setup to in progress to complete', () => {
    expect(computeSectionState(requiredSection, {})).toEqual({
      state: 'needs_setup',
      why: 'Nothing set up yet',
    });
    expect(computeSectionState(requiredSection, { first: true })).toEqual({
      state: 'in_progress',
      why: '1 of 2 required items done',
    });
    expect(computeSectionState(requiredSection, { first: true, second: true })).toEqual({
      state: 'complete',
      why: 'All required items done',
    });
  });

  // The checklist fixes (2026-10-07): no more "0 of 0 required items done".
  test('a section with nothing required says so: not set up, in progress, all done', () => {
    expect(computeSectionState(optionalOnlySection, {})).toEqual({ state: 'needs_setup', why: 'Nothing required; nothing set up yet' });
    expect(computeSectionState(optionalOnlySection, { optional: true })).toEqual({ state: 'in_progress', why: 'Nothing required' });
    expect(computeSectionState(optionalOnlySection, { optional: true, other: true })).toEqual({ state: 'complete', why: 'Nothing required; all done' });
  });

  test('Lala\'s Phone is a normal section now (it counts phone-screen images, never phone_missions)', () => {
    const phone = CHECKLIST_SECTIONS.find((s) => s.id === 'overlays');
    expect(phone.unavailableReason).toBeUndefined();
    expect(computeSectionState(phone, { overlays_generated: true })).toEqual({ state: 'complete', why: 'Nothing required; all done' });
    expect(computeSectionState(phone, {}).state).toBe('needs_setup');
  });

  test('a section can still be marked unavailable', () => {
    expect(computeSectionState(unavailableSection, { x: true })).toEqual({ state: 'unavailable', why: 'Not built yet' });
  });
});
