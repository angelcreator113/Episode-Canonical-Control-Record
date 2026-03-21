'use strict';

/**
 * Seed Script: Scene Set 001 — Lala's Bedroom — Morning Light
 *
 * Creates the first canonical scene set with 5 camera angles.
 * Idempotent: checks for existing set by name before inserting.
 *
 * Usage: node scripts/seed-scene-set-001.js
 */

const { SceneSet, SceneAngle, Universe, sequelize } = require('../src/models');

const ANGLES = [
  {
    angle_label: 'WIDE',
    angle_name: 'Wide Morning',
    angle_description: 'Full room, morning light flooding from the windows, bed centered.',
    beat_numbers: [1, 2, 3, 13, 14],
    camera_direction: 'Camera at door height looking into room. Window wall at right.',
  },
  {
    angle_label: 'WINDOW',
    angle_name: 'Window Light',
    angle_description: 'Camera facing the window, soft golden backlight. Lala silhouetted or three-quarter.',
    beat_numbers: [2, 14],
    camera_direction: 'Camera opposite window, medium height, warm flare.',
  },
  {
    angle_label: 'VANITY',
    angle_name: 'Vanity Ritual',
    angle_description: 'Vanity mirror reflection. Skincare bottles, jewelry tray, soft ambient light.',
    beat_numbers: [3, 6],
    camera_direction: 'Camera at mirror level, shallow depth of field.',
  },
  {
    angle_label: 'CLOSE',
    angle_name: 'Notification Moment',
    angle_description: 'Nightstand close-up — phone screen glow, a glass of water, small personal objects.',
    beat_numbers: [4, 5, 7],
    camera_direction: 'Overhead or 45° down. Tight crop on nightstand surface.',
  },
  {
    angle_label: 'DOORWAY',
    angle_name: 'Doorway Arrival',
    angle_description: 'Standing at the bedroom door looking in. Threshold moment — arrival or departure.',
    beat_numbers: [1],
    camera_direction: 'Camera at doorframe, slightly wide, hallway light spilling in.',
  },
];

function buildAnglePromptPreview(sceneDescription, angleLabel, angleDescription) {
  return [
    `LOCATION: Lala's Bedroom — Morning Light`,
    sceneDescription,
    '',
    `ANGLE: ${angleLabel}`,
    angleDescription,
  ].join('\n').trim();
}

async function seed() {
  console.log('─── Scene Set Seed 001 ──────────────────────────────');

  const existing = await SceneSet.findOne({ where: { name: "Lala's Bedroom — Morning Light" } });
  if (existing) {
    console.log(`✓ Scene set already exists (id: ${existing.id}). Skipping.`);
    process.exit(0);
  }

  // Find LalaVerse universe (optional — don't fail if not found)
  let universe = null;
  try {
    if (Universe) {
      universe = await Universe.findOne({ where: { name: { [require('sequelize').Op.iLike]: '%lalaverse%' } } });
    }
  } catch (e) {
    console.log('  (Universe lookup skipped:', e.message, ')');
  }

  const t = await sequelize.transaction();

  try {
    const sceneDescription = [
      'A soft, feminine, personalized space where identity, routine, and aesthetic intention meet.',
      'This room is not just a bedroom — it is a content space, a self-expression environment, a quiet ritual zone.',
      '',
      'Layout: Medium-sized room. One large window as primary light source.',
      'Bed positioned to catch morning light. Vanity or mirror area near the window.',
      'Subtle layering of zones: sleep, beauty, creation.',
      '',
      'Lighting (CANONICAL): Early morning sunlight comes through blinds or sheer curtains,',
      'creating clean, soft stripes across surfaces. Light moves across the room — time-aware feeling.',
      'The light is perfect at 6:14 AM.',
      '',
      'Bed area: Low-profile bed. Neutral bedding (cream, white, soft blush).',
      'Slightly unmade — lived-in, not staged. Soft throw blanket draped casually.',
      '',
      'Vanity area: Positioned to catch light. Phone (content creation tool), minimal makeup,',
      'jewelry tray with gold accents, perfume, candle. Mirror reflects light and creates depth.',
      '',
      'Signature details: A phone placed intentionally. Light hitting specific surfaces.',
      'Slight signs of real life — a hoodie, a book, a glass of water.',
      '',
      'What this space should feel like: This is a place where someone is becoming themselves.',
      'Not a showroom. Intentional reality.',
    ].join('\n');

    const set = await SceneSet.create({
      name: "Lala's Bedroom — Morning Light",
      scene_type: 'HOME_BASE',
      canonical_description: sceneDescription,
      mood_tags: ['calm', 'warm', 'intimate', 'morning ritual'],
      aesthetic_tags: ['soft gold light', 'cream linen', 'oak wood', 'feminine minimalism'],
      base_runway_model: 'gen3a_turbo',
      generation_status: 'pending',
      universe_id: universe?.id || null,
      notes: 'Primary location for Acts 1 and 5. Lala wakes up and returns here.',
    }, { transaction: t });

    console.log(`✓ Created scene set: ${set.name} (id: ${set.id})`);

    for (const angleDef of ANGLES) {
      const angle = await SceneAngle.create({
        scene_set_id: set.id,
        angle_name: angleDef.angle_name,
        angle_label: angleDef.angle_label,
        angle_description: angleDef.angle_description,
        beat_affinity: angleDef.beat_numbers,
        camera_direction: angleDef.camera_direction,
        generation_status: 'pending',
        runway_prompt: buildAnglePromptPreview(sceneDescription, angleDef.angle_label, angleDef.angle_description),
      }, { transaction: t });

      console.log(`  ✓ Angle: ${angle.angle_label} → beats [${angleDef.beat_numbers.join(', ')}]`);
    }

    await t.commit();
    console.log('─── Seed complete ──────────────────────────────────');
    console.log(`  Scene set id: ${set.id}`);
    console.log(`  Angles created: ${ANGLES.length}`);
    console.log(`  Status: pending (run generate-base to begin)`);
  } catch (err) {
    await t.rollback();
    console.error('Seed failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

seed();
