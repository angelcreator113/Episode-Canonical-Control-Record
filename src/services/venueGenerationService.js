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
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

// ─── VENUE IDENTITY BUILDER ─────────────────────────────────────────────────

function buildVenueIdentity(event) {
  const auto = event.canon_consequences?.automation || {};
  const prestige = event.prestige || 5;
  const venueName = auto.venue_name || event.venue_name || event.name;
  const venueAddress = auto.venue_address || event.venue_address || '';
  const category = auto.content_category || event.category || 'creator_economy';
  const mood = auto.mood || event.mood || 'aspirational';
  const hostArchetype = auto.host_archetype || '';

  // Derive architectural style from prestige + category
  const VENUE_AESTHETICS = {
    fashion:         { low: 'converted loft, raw concrete, industrial lighting', high: 'glass atrium gallery, marble floors, designer furniture' },
    beauty:          { low: 'cozy salon with neon signs, pink walls', high: 'luxury spa resort, crystal chandeliers, white marble' },
    music:           { low: 'underground club, graffiti walls, colored lights', high: 'intimate jazz lounge, velvet curtains, warm wood' },
    food:            { low: 'street food market, fairy lights, communal tables', high: 'private dining room, michelin-star decor, candlelight' },
    lifestyle:       { low: 'rooftop garden, string lights, mismatched furniture', high: 'penthouse terrace, infinity pool views, sunset' },
    creator_economy: { low: 'coworking space, exposed brick, whiteboards', high: 'members-only creative club, art on walls, designer seating' },
    creative:        { low: 'artist studio, paint-splattered floors, skylights', high: 'museum-quality gallery, white walls, dramatic lighting' },
    drama:           { low: 'dimly lit bar, red velvet booths, mirrors', high: 'grand ballroom, gold accents, theatrical lighting' },
  };

  const catAesthetic = VENUE_AESTHETICS[category.toLowerCase()] || VENUE_AESTHETICS.creator_economy;
  const aesthetic = prestige >= 7 ? catAesthetic.high : catAesthetic.low;

  // Parse neighborhood from address
  const neighborhood = venueAddress.split(',').slice(1).join(',').trim() || 'creative district';

  // Time of day from event_time
  const eventTime = auto.event_time || event.event_time || '19:00';
  const hour = parseInt(eventTime.split(':')[0]) || 19;
  const timeOfDay = hour >= 20 ? 'night, city lights' : hour >= 17 ? 'golden hour, warm sunset light' : 'afternoon, natural light';

  return {
    venueName,
    venueAddress,
    neighborhood,
    aesthetic,
    prestige,
    category,
    mood,
    timeOfDay,
    hostArchetype,
  };
}

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

// ─── MAIN: GENERATE VENUE IMAGES ────────────────────────────────────────────

async function generateVenueImages(event, models) {
  const identity = buildVenueIdentity(event);
  const auto = event.canon_consequences?.automation || {};
  const venueTheme = auto.venue_theme || event.location_hint || null;

  console.log(`[VenueGen] Generating venue for: ${identity.venueName} (prestige ${identity.prestige}, ${identity.category})`);
  if (venueTheme) console.log(`[VenueGen] Using venue theme: ${venueTheme.slice(0, 80)}...`);

  let venuePrompt;
  if (venueTheme) {
    // Use the specific venue theme from the template
    venuePrompt = `Photorealistic interior photograph of a luxury event venue.
Theme: ${venueTheme}
Prestige level: ${identity.prestige}/10. Mood: ${identity.mood}.
The space is decorated and ready for an exclusive event during ${identity.timeOfDay}.
This is a fantasy dream world venue in the LalaVerse — make it feel magical, aspirational, and unique.
No text, no logos, no people. Luxury interior design photography. Landscape orientation.`;
  } else {
    // Fallback to generic venue generation
    const sharedStyle = `Architectural style: ${identity.aesthetic}. Located in ${identity.neighborhood}. Mood: ${identity.mood}. Prestige level: ${identity.prestige}/10.`;
    venuePrompt = `Photorealistic interior photograph of "${identity.venueName}", a ${identity.category} venue.
${sharedStyle}
Show the main event space decorated and ready for guests during ${identity.timeOfDay}.
Include: ambient lighting, seating arrangement, decorative details, atmosphere that communicates the venue's personality.
This is where fashion creators and influencers gather — make it feel alive and aspirational.
No text, no logos, no people. Interior design photography. Landscape orientation.`;
  }

  // Generate single image
  console.log('[VenueGen] Generating venue image...');
  const imageUrl = await generateImageUrl(venuePrompt, { size: 'landscape', quality: 'hd' });

  if (!imageUrl) throw new Error('Image generation failed — no URL returned');

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

  // Create Scene Set with single angle
  let sceneSet = null;
  if (models.SceneSet) {
    try {
      sceneSet = await models.SceneSet.create({
        name: identity.venueName,
        scene_type: 'EVENT_LOCATION',
        canonical_description: `${identity.venueName} — ${identity.aesthetic}. ${identity.neighborhood}.`,
        base_still_url: s3Url,
        show_id: event.show_id,
        generation_status: 'complete',
      });

      if (models.SceneAngle) {
        await models.SceneAngle.create({
          scene_set_id: sceneSet.id,
          angle_name: `${identity.venueName} — Event Space`,
          angle_label: 'interior_wide',
          still_image_url: s3Url,
          generation_status: 'complete',
          sort_order: 1,
        });
      }

      console.log(`[VenueGen] Scene set created: ${sceneSet.id} — ${identity.venueName}`);
    } catch (err) {
      console.warn('[VenueGen] Scene set creation failed:', err.message);
    }
  }

  // Link scene set to event
  if (sceneSet) {
    try {
      await models.sequelize.query(
        'UPDATE world_events SET scene_set_id = :sceneSetId, updated_at = NOW() WHERE id = :eventId',
        { replacements: { sceneSetId: sceneSet.id, eventId: event.id } }
      );
    } catch { /* non-blocking */ }
  }

  // Update WorldLocation if it exists
  try {
    const auto = event.canon_consequences?.automation || {};
    if (auto.venue_location_id && models.WorldLocation) {
      await models.WorldLocation.update(
        { style_guide: { venue_url: s3Url, generated_for_event: event.id } },
        { where: { id: auto.venue_location_id } }
      ).catch(err => { console.warn('[VenueGen] WorldLocation style_guide update failed:', err?.message); });
    }
  } catch { /* non-blocking */ }

  return {
    venue_url: s3Url,
    scene_set_id: sceneSet?.id || null,
    venue_identity: identity,
  };
}

module.exports = { generateVenueImages, buildVenueIdentity };
