'use strict';

/**
 * Venue Generation Service
 *
 * Generates coherent exterior + interior images for event venues.
 * Both images share the same architectural identity so they look
 * like the same building.
 *
 * Auto-creates a SceneSet with both images as angles.
 * Links to the event and WorldLocation.
 *
 * S4: the category look-up and prompt templates (buildVenueIdentity) are
 * gone; both images come from Scene Briefs (S5, below).
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

// ─── IMAGE GENERATION (via unified service) ────────────────────────────────

const { generateImageUrl } = require('./imageGenerationService');

async function downloadImage(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(response.data);
}

async function uploadToS3(buffer, folder, suffix) {
  const s3Key = `venues/${folder}/${uuidv4()}-${suffix}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── THE VENUE'S SCENE BRIEFS (S5) ──────────────────────────────────────────
//
// Ruling S5 (Evoni, 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "Venue
// generation saves the full brief and the world_location_id, and never
// overwrites a location's style guide." The interior and exterior are made
// from Scene Briefs (S1) for the event named in the route (S3): the place is
// the event's venue World Location, the event layer is this event. The
// interior is the set's base (WIDE); the exterior is its establishing angle.

const { buildSceneBrief, briefToPrompt, loadBriefLocation, loadBriefEvent } = require('./sceneBriefService');
const { estimateGenerationCost, estimateImageFromImageCost, generateImageFromImage } = require('./imageGenerationService');

const VENUE_IMAGE_OPTIONS = Object.freeze({ size: 'landscape', quality: 'hd', useCase: 'venue' });
const EXTERIOR_CAMERA = "Exterior: the building's full facade and entrance from the street, with the street and its surroundings.";

const cleanText = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

function automationOf(event) {
  const cc = event?.canon_consequences;
  const parsed = typeof cc === 'string' ? (() => {
    try { return JSON.parse(cc); } catch (err) {
      console.warn('[VenueGen] canon_consequences is not JSON:', err.message);
      return {};
    }
  })() : (cc || {});
  return parsed.automation || {};
}

/** The event's venue World Location id: its own field, else its automation copy. */
function venueLocationId(event) {
  return event?.venue_location_id || automationOf(event).venue_location_id || null;
}

/**
 * The scene set a venue generation makes, before it is saved: the venue's
 * name and World Location. Its description is the location's own (read by
 * the brief); only a venue with no location description takes the event
 * template's venue theme as the set's description.
 */
function venueDraftSet(event, location) {
  const auto = automationOf(event);
  const name = cleanText(location?.name || auto.venue_name || event.venue_name || event.name) || 'Venue';
  return {
    id: null,
    name,
    scene_type: 'EVENT_LOCATION',
    show_id: event.show_id || null,
    world_location_id: location?.id || null,
    canonical_description: location?.description ? null : (cleanText(auto.venue_theme || event.location_hint) || null),
  };
}

/**
 * The interior and exterior briefs, and the estimate for the two images.
 * overrides apply to both, except a camera override, which is the interior's.
 */
async function prepareVenueBriefs(sequelize, event, { overrides = {} } = {}) {
  const location = await loadBriefLocation(sequelize, venueLocationId(event));
  const chosen = await loadBriefEvent(sequelize, event.id, event.show_id);
  const draft = venueDraftSet(event, location);
  const over = overrides && typeof overrides === 'object' ? overrides : {};
  const { camera: _interiorCamera, ...exteriorOverrides } = over;
  const interior = buildSceneBrief({ sceneSet: draft, location, event: chosen, angleLabel: 'WIDE', overrides: over });
  const exterior = buildSceneBrief({
    sceneSet: draft, location, event: chosen, angleLabel: 'ESTABLISHING', cameraDirection: EXTERIOR_CAMERA, overrides: exteriorOverrides,
  });
  // S6: with an approved base at the venue, the interior is its
  // event-dressed version (a Flux Kontext edit), priced as such.
  const one = estimateGenerationCost(VENUE_IMAGE_OPTIONS);
  const interiorCost = interior.mode === 'event_dressing' ? estimateImageFromImageCost() : one;
  const priced = [interiorCost, one].every((e) => typeof e.usd === 'number');
  const estimate = {
    usd: priced ? Math.round((interiorCost.usd + one.usd) * 1e4) / 1e4 : null,
    priced: priced && Boolean(interiorCost.priced && one.priced),
    images: 2,
    model: one.model,
    interior_model: interiorCost.model,
  };
  return { draft, location, interior, exterior, estimate };
}

// ─── MAIN: GENERATE VENUE IMAGES ────────────────────────────────────────────

/**
 * options.overrides: { <brief line key>: text }, the "Your override" lines
 * confirmed on the venue's brief (S2).
 */
async function generateVenueImages(event, models, options = {}) {
  const { draft, interior, exterior } = await prepareVenueBriefs(models.sequelize, event, { overrides: options.overrides || {} });
  const interiorPrompt = briefToPrompt(interior);
  const exteriorPrompt = briefToPrompt(exterior);

  console.log(`[VenueGen] Generating venue for: ${draft.name} (location ${draft.world_location_id || 'none'})`);

  // Generate single interior image: an edit of the venue's approved base
  // when it has one (S6), else from the brief.
  console.log(`[VenueGen] Generating interior image${interior.mode === 'event_dressing' ? ' (event dressing of the approved base)' : ''}...`);
  const imageUrl = interior.mode === 'event_dressing'
    ? (await generateImageFromImage(interior.approved_base.image_url, interiorPrompt, { size: 'landscape' })).url
    : await generateImageUrl(interiorPrompt, VENUE_IMAGE_OPTIONS);

  if (!imageUrl) throw new Error('Image generation failed — no URL returned');

  let exteriorUrl = null;
  try {
    console.log('[VenueGen] Generating exterior image...');
    exteriorUrl = await generateImageUrl(exteriorPrompt, VENUE_IMAGE_OPTIONS);
  } catch (err) {
    console.warn('[VenueGen] Exterior generation failed (non-blocking):', err.message);
  }

  // Download and upload to S3
  const buffer = await downloadImage(imageUrl);
  const eventFolder = event.id || 'unknown';
  let s3Url;

  if (S3_BUCKET) {
    s3Url = await uploadToS3(buffer, eventFolder, 'venue');
    console.log(`[VenueGen] Uploaded venue image to S3`);
  } else {
    s3Url = imageUrl;
  }

  // Upload exterior to S3
  let exteriorS3Url = null;
  if (exteriorUrl && S3_BUCKET) {
    try {
      const extBuffer = await downloadImage(exteriorUrl);
      exteriorS3Url = await uploadToS3(extBuffer, eventFolder, 'exterior');
      console.log('[VenueGen] Uploaded exterior to S3');
    } catch (err) {
      console.warn('[VenueGen] Exterior upload failed; keeping the provider URL:', err.message);
      exteriorS3Url = exteriorUrl;
    }
  } else {
    exteriorS3Url = exteriorUrl;
  }

  // The Scene Set: the venue's World Location, and the full briefs (S5).
  let sceneSet = null;
  if (models.SceneSet) {
    try {
      const id = uuidv4();
      const generatedAt = new Date().toISOString();
      sceneSet = await models.SceneSet.create({
        id,
        name: draft.name,
        scene_type: draft.scene_type,
        canonical_description: draft.canonical_description,
        world_location_id: draft.world_location_id,
        base_still_url: s3Url,
        base_runway_prompt: interiorPrompt,
        show_id: event.show_id,
        generation_status: 'complete',
        base_generation: {
          source: 'venue_generation',
          generated_for_event: event.id,
          generated_at: generatedAt,
          brief: { ...interior, scene_set_id: id },
          exterior_brief: exteriorS3Url ? { ...exterior, scene_set_id: id } : null,
        },
      });

      if (models.SceneAngle) {
        // Exterior establishing shot (for video generation)
        if (exteriorS3Url) {
          await models.SceneAngle.create({
            scene_set_id: sceneSet.id,
            angle_name: `${draft.name} — Exterior`,
            angle_label: 'ESTABLISHING',
            still_image_url: exteriorS3Url,
            runway_prompt: exteriorPrompt,
            generation_status: 'complete',
            camera_motion: 'slow_pan_right',
            video_duration: 10,
            sort_order: 0,
          });
        }

        // Interior wide shot
        await models.SceneAngle.create({
          scene_set_id: sceneSet.id,
          angle_name: `${draft.name} — Event Space`,
          angle_label: 'interior_wide',
          still_image_url: s3Url,
          runway_prompt: interiorPrompt,
          generation_status: 'complete',
          sort_order: 1,
        });
      }

      console.log(`[VenueGen] Scene set created: ${sceneSet.id} — ${draft.name} (${exteriorS3Url ? 'exterior + interior' : 'interior only'})`);
    } catch (err) {
      console.warn('[VenueGen] Scene set creation failed:', err.message);
    }
  }

  // Link the scene set to the event it was made for (named in the route).
  if (sceneSet) {
    try {
      await models.sequelize.query(
        'UPDATE world_events SET scene_set_id = :sceneSetId, updated_at = NOW() WHERE id = :eventId',
        { replacements: { sceneSetId: sceneSet.id, eventId: event.id } }
      );
    } catch (err) {
      console.warn('[VenueGen] Linking the scene set to the event failed:', err.message);
    }
  }

  // The World Location's style guide is never written here (S5): the place
  // is read from it, and the venue image lives on the scene set.

  return {
    venue_url: s3Url,
    exterior_url: exteriorS3Url,
    scene_set_id: sceneSet?.id || null,
    world_location_id: draft.world_location_id,
    brief: interior,
  };
}

module.exports = {
  generateVenueImages,
  prepareVenueBriefs,
  venueDraftSet,
  venueLocationId,
  EXTERIOR_CAMERA,
};
