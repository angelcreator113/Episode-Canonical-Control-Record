'use strict';

/**
 * Artifact Detection Service — v1.0
 *
 * Provides AI-generated image quality analysis for RunwayML outputs.
 * Two modes:
 *   1. Heuristic analysis — fast, local, checks image-level signals
 *   2. Manual review — structured flagging by human reviewers
 *
 * Known gen4_image artifact categories:
 *   - FURNITURE_DISTORTION: warped legs, impossible geometry on chairs/tables
 *   - OBJECT_BLOBBING: small surface objects (bottles, cosmetics) lack defined shapes
 *   - REFLECTION_ERROR: mirrors/glass don't show coherent reflections
 *   - FABRIC_ANOMALY: unnatural stiff folds, melting edges on fabric/pillows
 *   - HARDWARE_INCONSISTENCY: drawer handles, knobs vary in size/shape
 *   - FLOOR_DISTORTION: pattern breaks near furniture legs (herringbone, tile)
 *   - HAND_BODY: malformed hands/fingers if characters are present
 *   - TEXT_BLEED: phantom text or symbols appearing in image
 */

const sharp = require('sharp');
const axios = require('axios');

// ─── ARTIFACT CATEGORIES ────────────────────────────────────────────────────

const ARTIFACT_CATEGORIES = {
  FURNITURE_DISTORTION: {
    label: 'Furniture Distortion',
    description: 'Warped legs, impossible geometry on chairs, tables, or bed frames',
    severity: 'high',
    promptFix: 'physically correct furniture with straight legs and consistent proportions',
  },
  OBJECT_BLOBBING: {
    label: 'Blobby Objects',
    description: 'Small surface objects (bottles, cosmetics, decor) lack defined shapes',
    severity: 'medium',
    promptFix: 'sharply defined individual objects with clear edges and recognizable shapes',
  },
  REFLECTION_ERROR: {
    label: 'Reflection Error',
    description: 'Mirrors or glass surfaces show incoherent or impossible reflections',
    severity: 'medium',
    promptFix: 'coherent mirror reflections showing the room behind the camera',
  },
  FABRIC_ANOMALY: {
    label: 'Fabric Anomaly',
    description: 'Unnatural stiff folds, melting edges on curtains, pillows, or throws',
    severity: 'low',
    promptFix: 'natural fabric draping with soft realistic folds',
  },
  HARDWARE_INCONSISTENCY: {
    label: 'Hardware Inconsistency',
    description: 'Drawer handles, knobs, or fixtures vary in size, shape, or placement',
    severity: 'low',
    promptFix: 'consistent matching hardware on all drawers and cabinets',
  },
  FLOOR_DISTORTION: {
    label: 'Floor Distortion',
    description: 'Floor patterns (herringbone, tile) warp or break near furniture',
    severity: 'low',
    promptFix: 'continuous unbroken floor pattern extending under and around furniture',
  },
  HAND_BODY: {
    label: 'Hand/Body Error',
    description: 'Malformed hands, extra fingers, or anatomical impossibilities',
    severity: 'critical',
    promptFix: 'no people visible, empty room scene',
  },
  TEXT_BLEED: {
    label: 'Text Bleed',
    description: 'Phantom text, symbols, or watermark-like artifacts in the image',
    severity: 'high',
    promptFix: 'no text, no writing, no symbols, no watermarks anywhere in the image',
  },
};

const SEVERITY_WEIGHTS = {
  critical: 40,
  high: 25,
  medium: 15,
  low: 8,
};

// ─── HEURISTIC ANALYSIS ─────────────────────────────────────────────────────

/**
 * Run fast heuristic checks on a generated image.
 * Downloads the image, analyzes with Sharp for basic quality signals.
 * Returns { qualityScore, flags[], suggestions[] }
 */
async function analyzeImageQuality(imageUrl) {
  const flags = [];

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Check 1: Resolution quality
    if (metadata.width < 1024 || metadata.height < 576) {
      flags.push({
        category: 'LOW_RESOLUTION',
        label: 'Low Resolution',
        description: `Image is ${metadata.width}x${metadata.height}, expected at least 1024x576`,
        severity: 'high',
        auto: true,
      });
    }

    // Check 2: Color channel uniformity (oversaturated or washed out)
    const channels = stats.channels;
    if (channels.length >= 3) {
      const avgStdDev = (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;

      // Very low variance = washed out / flat image
      if (avgStdDev < 20) {
        flags.push({
          category: 'FLAT_IMAGE',
          label: 'Flat/Washed Out',
          description: 'Image has very low color variance — may appear washed out or overexposed',
          severity: 'medium',
          auto: true,
        });
      }

      // Very high variance can indicate extreme artifacts
      if (avgStdDev > 100) {
        flags.push({
          category: 'HIGH_CONTRAST_ARTIFACT',
          label: 'Extreme Contrast',
          description: 'Unusually high color variance — may contain contrast artifacts',
          severity: 'low',
          auto: true,
        });
      }

      // Check for color channel imbalance (one channel dominating unnaturally)
      const means = channels.map(c => c.mean);
      const maxMean = Math.max(...means);
      const minMean = Math.min(...means);
      if (maxMean - minMean > 80) {
        flags.push({
          category: 'COLOR_CAST',
          label: 'Color Cast',
          description: 'Strong color imbalance detected — possible unnatural tinting',
          severity: 'low',
          auto: true,
        });
      }
    }

    // Check 3: Edge density (detect blurriness via entropy-like measure)
    // Use Laplacian-style approach: convert to greyscale, apply sharpen, measure variance
    const edgeStats = await sharp(buffer)
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0], // Laplacian
      })
      .stats();

    const edgeVariance = edgeStats.channels[0].stdev;
    if (edgeVariance < 8) {
      flags.push({
        category: 'SOFT_FOCUS',
        label: 'Overly Soft',
        description: 'Image appears very soft/blurry — edges lack definition',
        severity: 'medium',
        auto: true,
      });
    }

    // Calculate quality score: start at 100, subtract for each flag
    let qualityScore = 100;
    for (const flag of flags) {
      qualityScore -= SEVERITY_WEIGHTS[flag.severity] || 10;
    }
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
      qualityScore,
      resolution: { width: metadata.width, height: metadata.height },
      flags,
      analyzedAt: new Date().toISOString(),
      method: 'heuristic',
    };
  } catch (err) {
    console.error('[ArtifactDetection] Image analysis failed:', err.message);
    return {
      qualityScore: null,
      flags: [],
      error: err.message,
      analyzedAt: new Date().toISOString(),
      method: 'heuristic',
    };
  }
}

// ─── MANUAL REVIEW ──────────────────────────────────────────────────────────

/**
 * Record a manual artifact review for a scene angle.
 * @param {string[]} categories - Array of ARTIFACT_CATEGORIES keys
 * @param {string} [notes] - Optional reviewer notes
 * @returns {{ flags, qualityScore, refinedPromptSuffix }}
 */
function createManualReview(categories, notes = null) {
  const flags = categories
    .filter(cat => ARTIFACT_CATEGORIES[cat])
    .map(cat => ({
      category: cat,
      ...ARTIFACT_CATEGORIES[cat],
      auto: false,
    }));

  let qualityScore = 100;
  for (const flag of flags) {
    qualityScore -= SEVERITY_WEIGHTS[flag.severity] || 10;
  }
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // Build a prompt suffix that addresses the flagged artifacts
  const promptFixes = flags.map(f => f.promptFix).filter(Boolean);
  const refinedPromptSuffix = promptFixes.length > 0
    ? `QUALITY EMPHASIS: ${promptFixes.join('. ')}.`
    : '';

  return {
    flags,
    qualityScore,
    refinedPromptSuffix,
    notes,
    reviewedAt: new Date().toISOString(),
    method: 'manual',
  };
}

/**
 * Build a refined prompt that incorporates artifact feedback.
 * Used when regenerating an angle after quality review.
 */
function buildRefinedPrompt(originalPrompt, artifactFlags) {
  const fixes = artifactFlags
    .map(f => {
      const cat = ARTIFACT_CATEGORIES[f.category || f];
      return cat?.promptFix;
    })
    .filter(Boolean);

  if (fixes.length === 0) return originalPrompt;

  const suffix = `QUALITY EMPHASIS: ${fixes.join('. ')}.`;

  // Insert before the final "Cinematic quality" line if present
  if (originalPrompt.includes('Cinematic quality.')) {
    return originalPrompt.replace(
      'Cinematic quality.',
      `${suffix} Cinematic quality.`
    );
  }

  // Otherwise append (respecting 1000 char limit)
  const combined = `${originalPrompt} ${suffix}`;
  return combined.length > 1000 ? combined.slice(0, 997) + '...' : combined;
}

module.exports = {
  ARTIFACT_CATEGORIES,
  SEVERITY_WEIGHTS,
  analyzeImageQuality,
  createManualReview,
  buildRefinedPrompt,
};
