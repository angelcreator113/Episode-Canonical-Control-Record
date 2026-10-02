/**
 * Evoni, 2026-10-02: "when a set's base image changes (upload or generate),
 * its stored description written by the image analysis should be refreshed
 * or flagged, since a description of an old image now drives every prompt."
 */
const {
  isAnalysisDescription,
  reviewForNewBase,
  descriptionAfterAnalysis,
} = require('../../../src/services/baseDescriptionService');

const OLD = 'A cream bedroom with a brass bed and a green velvet chair.';
const NEW = 'A white bedroom with an oak bed and a rattan chair.';
const machineSet = { canonical_description: OLD, visual_language: { image_analysis: { source_url: 'https://x/old.jpg', description: OLD } } };
const yourSet = { canonical_description: 'My bedroom, the way I wrote it.', visual_language: { image_analysis: { source_url: 'https://x/old.jpg', description: OLD } } };

describe('isAnalysisDescription', () => {
  test('the description is the analysis\'s own text, or the text it recorded writing', () => {
    expect(isAnalysisDescription(machineSet)).toBe(true);
    expect(isAnalysisDescription({ canonical_description: OLD, visual_language: { description_source: { kind: 'image_analysis', text: OLD } } })).toBe(true);
    expect(isAnalysisDescription(yourSet)).toBe(false);
    expect(isAnalysisDescription({ canonical_description: '', visual_language: {} })).toBe(false);
  });
});

describe('reviewForNewBase', () => {
  test('a description the analysis wrote is marked for rewriting, whatever made the new base', () => {
    for (const origin of ['generated', 'uploaded', 'promoted']) {
      expect(reviewForNewBase(machineSet, { origin, baseUrl: 'https://x/new.jpg' }))
        .toMatchObject({ reason: 'base_changed', origin, base_url: 'https://x/new.jpg', machine_written: true, suggested: null });
    }
  });
  test('your description is flagged when the base was uploaded or promoted, not when it was generated from it', () => {
    expect(reviewForNewBase(yourSet, { origin: 'uploaded', baseUrl: 'https://x/new.jpg' })).toMatchObject({ machine_written: false });
    expect(reviewForNewBase(yourSet, { origin: 'promoted', baseUrl: 'https://x/new.jpg' })).toMatchObject({ machine_written: false });
    expect(reviewForNewBase(yourSet, { origin: 'generated', baseUrl: 'https://x/new.jpg' })).toBeNull();
  });
  test('no description: nothing to review (the analysis fills it)', () => {
    expect(reviewForNewBase({ canonical_description: null, visual_language: {} }, { origin: 'uploaded', baseUrl: 'u' })).toBeNull();
  });
});

describe('descriptionAfterAnalysis', () => {
  const analysis = { source_url: 'https://x/new.jpg', description: NEW };
  const withReview = (set, machine) => ({
    ...set,
    visual_language: { ...set.visual_language, description_review: { reason: 'base_changed', origin: 'uploaded', base_url: 'https://x/new.jpg', machine_written: machine, suggested: null } },
  });

  test('an empty description is filled, and its source recorded', () => {
    const out = descriptionAfterAnalysis({ canonical_description: '', visual_language: {} }, analysis);
    expect(out.description).toBe(NEW);
    expect(out.vlPatch.description_source).toMatchObject({ kind: 'image_analysis', source_url: 'https://x/new.jpg', text: NEW });
    expect(out.clearReview).toBe(false);
  });
  test('a description the analysis wrote for the old image is rewritten, and the review cleared', () => {
    const out = descriptionAfterAnalysis(withReview(machineSet, true), analysis);
    expect(out.description).toBe(NEW);
    expect(out.clearReview).toBe(true);
  });
  test('your description is kept; the review carries the new image\'s description as a suggestion', () => {
    const out = descriptionAfterAnalysis(withReview(yourSet, false), analysis);
    expect(out.description).toBeNull();
    expect(out.vlPatch.description_review).toMatchObject({ machine_written: false, suggested: NEW });
  });
  test('a review for another image, or none, changes nothing', () => {
    const other = withReview(machineSet, true);
    other.visual_language.description_review.base_url = 'https://x/other.jpg';
    expect(descriptionAfterAnalysis(other, analysis)).toEqual({ description: null, vlPatch: {}, clearReview: false });
    expect(descriptionAfterAnalysis(machineSet, analysis)).toEqual({ description: null, vlPatch: {}, clearReview: false });
  });
});
