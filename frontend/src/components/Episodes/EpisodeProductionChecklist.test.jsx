import { describe, expect, test } from 'vitest';
import { computeSectionState } from './EpisodeProductionChecklist';

const requiredSection = {
  id: 'brief',
  items: [
    { id: 'first', required: true },
    { id: 'second', required: true },
  ],
};

const optionalOnlySection = {
  id: 'social',
  items: [{ id: 'optional', required: false }],
};

const overlaysSection = {
  id: 'overlays',
  unavailableReason: 'Phone missions not deployed yet (phone_missions absent from canon)',
  items: [{ id: 'overlays_generated', required: false }],
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

  test('optional-only checks yield in progress', () => {
    expect(computeSectionState(optionalOnlySection, { optional: true })).toEqual({
      state: 'in_progress',
      why: '0 of 0 required items done',
    });
  });

  test('overlays is always unavailable', () => {
    expect(computeSectionState(overlaysSection, {})).toEqual({
      state: 'unavailable',
      why: 'Phone missions not deployed yet (phone_missions absent from canon)',
    });
    expect(computeSectionState(overlaysSection, { overlays_generated: true })).toEqual({
      state: 'unavailable',
      why: 'Phone missions not deployed yet (phone_missions absent from canon)',
    });
  });
});