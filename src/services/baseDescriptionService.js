'use strict';

/**
 * A scene set's description after its base image changes (Evoni,
 * 2026-10-02): "when a set's base image changes (upload or generate), its
 * stored description written by the image analysis should be refreshed or
 * flagged, since a description of an old image now drives every prompt."
 *
 * The description (scene_sets.canonical_description) is in every Scene
 * Brief. The image analysis (sceneGenerationService.analyzeBaseImage) fills
 * it only when it is empty, so a description it wrote for an earlier base
 * stayed after the base changed.
 *
 * - A description the analysis wrote (it is still the analysis's own text)
 *   is rewritten from the new base's analysis, whatever made the new base.
 * - A description the person wrote or edited is kept, and flagged when the
 *   new base was uploaded, promoted from an angle or replaced by URL (it
 *   was not made from that description); the flag carries the new base's
 *   analysis description as a suggestion. A base generated from the
 *   description is not flagged.
 *
 * The flag is visual_language.description_review:
 *   { reason: 'base_changed', origin, base_url, machine_written, suggested, at }
 * It is set when the base changes, so it stands even when the analysis does
 * not run, and resolved by the analysis of that base, by the person
 * (POST /scene-sets/:id/description-review), or by saving a description.
 * visual_language.description_source { kind: 'image_analysis', source_url,
 * text } records a description the analysis wrote.
 */

const clean = (t) => String(t || '').trim();

/** The set's description is the image analysis's own text. */
function isAnalysisDescription(set) {
  const desc = clean(set?.canonical_description);
  if (!desc) return false;
  const vl = set?.visual_language || {};
  if (desc === clean(vl.image_analysis?.description)) return true;
  return vl.description_source?.kind === 'image_analysis' && desc === clean(vl.description_source.text);
}

/**
 * The review a new base calls for, or null.
 *   origin: 'generated' | 'uploaded' | 'promoted' | 'replaced'
 */
function reviewForNewBase(set, { origin, baseUrl }) {
  if (!clean(set?.canonical_description)) return null;
  const machine = isAnalysisDescription(set);
  if (!machine && origin === 'generated') return null;
  return {
    reason: 'base_changed',
    origin,
    base_url: baseUrl || null,
    machine_written: machine,
    suggested: null,
    at: new Date().toISOString(),
  };
}

const sourceFor = (analysis) => ({
  kind: 'image_analysis',
  source_url: analysis.source_url || null,
  text: clean(analysis.description),
  at: new Date().toISOString(),
});

/**
 * What a fresh analysis of the base does to the description.
 * Returns { description: new text or null, vlPatch, clearReview }.
 */
function descriptionAfterAnalysis(set, analysis) {
  const none = { description: null, vlPatch: {}, clearReview: false };
  const text = clean(analysis?.description);
  if (!text) return none;
  if (!clean(set?.canonical_description)) {
    return { description: text, vlPatch: { description_source: sourceFor(analysis) }, clearReview: false };
  }
  const review = set?.visual_language?.description_review;
  if (!review || review.base_url !== analysis.source_url) return none;
  if (review.machine_written) {
    return { description: text, vlPatch: { description_source: sourceFor(analysis) }, clearReview: true };
  }
  return { description: null, vlPatch: { description_review: { ...review, suggested: text } }, clearReview: false };
}

/** Write (or, with null, remove) the set's description review. */
async function writeReview(sequelize, setId, review, { transaction } = {}) {
  if (review) {
    await sequelize.query(
      `UPDATE scene_sets SET visual_language = COALESCE(visual_language, '{}'::jsonb) || jsonb_build_object('description_review', CAST(:review AS jsonb)), updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: setId, review: JSON.stringify(review) }, transaction });
  } else {
    await sequelize.query(
      `UPDATE scene_sets SET visual_language = COALESCE(visual_language, '{}'::jsonb) - 'description_review', updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: setId }, transaction });
  }
}

/**
 * The base of a set changed: record the review it calls for (or clear an
 * older one). Reads the set as stored, before the new base is analysed.
 * The base is already saved when this runs, so a failure here is logged and
 * does not fail the base change (noteBaseChanged).
 */
async function markBaseChanged(sequelize, setId, { origin, baseUrl }) {
  if (!sequelize) return null;
  const [rows] = await sequelize.query(
    'SELECT id, canonical_description, visual_language FROM scene_sets WHERE id = :id',
    { replacements: { id: setId } });
  const set = rows[0];
  if (!set) return null;
  const review = reviewForNewBase(set, { origin, baseUrl });
  await writeReview(sequelize, setId, review);
  return review;
}

/** markBaseChanged, logged instead of thrown. */
function noteBaseChanged(sequelize, setId, options) {
  return markBaseChanged(sequelize, setId, options).catch((err) => {
    console.error(`[BaseDescription] could not record the description review for set ${setId}:`, err.message);
    return null;
  });
}

module.exports = {
  noteBaseChanged,
  isAnalysisDescription,
  reviewForNewBase,
  descriptionAfterAnalysis,
  writeReview,
  markBaseChanged,
};
