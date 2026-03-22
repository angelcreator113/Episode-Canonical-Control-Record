'use strict';

/**
 * Seed: Scene Rules + Scene Generation Franchise Laws
 *
 * Adds the 15 rules locked in Session 21 (March 21, 2026) to franchise_knowledge.
 * Run AFTER the main show-brain-franchise-laws seeder has already run.
 *
 * Usage:
 *   node scripts/seed-scene-rules.js
 *
 * Safe to re-run — uses findOrCreate on title to avoid duplicates.
 */

const { FranchiseKnowledge, sequelize } = require('../src/models');

const now = new Date();

const base = {
  category:        'franchise_law',
  severity:        'critical',
  always_inject:   true,
  source_document: 'show-brain-v1.0',
  source_version:  '1.0',
  status:          'active',
  created_at:      now,
  updated_at:      now,
};

const entries = [

  // ── CANON SCENE RULES (8 rules) ────────────────────────────────────────────

  {
    ...base,
    title: 'Scene Rules — Scenes Are Containers, Characters Are Layers',
    content: JSON.stringify({
      summary: 'Scenes are environment containers. Characters are separate layers. They are never baked together. Not sometimes. Not optionally. Never.',
      rule_number: 1,
      section: 'scene_rules',
      enforcement: 'system_level',
      violation_examples: [
        'Generating a bedroom scene with Lala already in the frame',
        'Baking a character silhouette into a window shot',
        'Compositing character + environment in a single RunwayML call',
      ],
      correct_pattern: 'scene_generation → environment_only → character_layer_added_separately',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'writer_brain', 'director_brain', 'continuity_engine',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Invalid Scene Definition',
    content: JSON.stringify({
      summary: 'A scene is invalid if it contains a person, partial body, hand, shadow, reflection of a person, or implied presence such as a body impression or personal object mid-use.',
      rule_number: 2,
      section: 'scene_rules',
      enforcement: 'generation_validation',
      invalid_if_contains: [
        'a person',
        'partial body (hand, legs, shadow)',
        'reflection of a person in mirror or glass',
        'implied presence: body impression on bed',
        'implied presence: coffee cup mid-sip',
        'implied presence: personal object staged as in-use',
      ],
      why: 'Breaks composability, reuse, and continuity across episodes and characters.',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Intentional Negative Space Required',
    content: JSON.stringify({
      summary: 'Every scene must preserve intentional negative space — clear open areas where characters can be placed, animated, or layered later.',
      rule_number: 3,
      section: 'scene_rules',
      enforcement: 'prompt_level',
      required_spatial_zones: [
        'open floor areas',
        'clear bed edge',
        'space near vanity',
        'room in doorway framing',
        'clear walking path through room',
      ],
      why: 'Later the system will place avatars, animate scenes, and layer interactions. A room that is too visually full becomes unusable as a base environment.',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Multi-Angle Consistency Required',
    content: JSON.stringify({
      summary: 'A Scene Set is only valid if all angles feel like the same physical room. Same layout, same lighting, same spatial relationships. If two angles feel like different rooms, reject the set.',
      rule_number: 4,
      section: 'scene_rules',
      enforcement: 'review_gate',
      consistency_requirements: [
        'same room layout across all angles',
        'same lighting direction and quality',
        'same furniture placement',
        'same spatial relationships between objects',
      ],
      rejection_trigger: 'two angles feel like different rooms',
      mechanism: 'base_runway_seed locked on first generation — all angles use same seed for consistency',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Lighting Is System Behavior',
    content: JSON.stringify({
      summary: 'Lighting is system behavior, not aesthetic choice. For each canonical location, lighting conditions are locked and cannot change between angles.',
      rule_number: 5,
      section: 'scene_rules',
      enforcement: 'prompt_level',
      canonical_lighting: {
        "lala_bedroom": {
          time: 'morning',
          direction: 'window-based',
          quality: 'soft stripes through sheer curtains',
          canonical_note: 'The light is perfect at 6:14 AM',
        },
      },
      rule: 'All angles in a set must respect the canonical lighting. Lighting is a system constraint, not a creative variable per shot.',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain', 'writer_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Scenes Must Be Reusable Across Stories',
    content: JSON.stringify({
      summary: 'Scenes must be reusable across different characters, moods, and story beats. If a scene feels locked to one specific moment, it is wrong.',
      rule_number: 6,
      section: 'scene_rules',
      enforcement: 'design_review',
      valid_scene_supports: [
        'different characters in the same space',
        'different moods (morning calm vs deadline urgency)',
        'different story beats (Beat 1 vs Beat 14)',
      ],
      invalid_if: 'the scene only works for one specific narrative moment',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Scene Generation and Character Generation Are Separate Pipeline Stages',
    content: JSON.stringify({
      summary: 'Scene generation and character generation are separate pipeline stages. They are never triggered together.',
      rule_number: 7,
      section: 'scene_rules',
      enforcement: 'system_level',
      pipeline_order: [
        'Stage 1: Scene Layer — environment only, no characters',
        'Stage 2: Character Layer — avatar rendered separately',
        'Stage 3: Action Layer — behavior and interaction',
        'Stage 4: Camera Layer — shot composition',
        'Stage 5: Composition — layers combined for final output',
      ],
      violation: 'Triggering character and environment generation in the same RunwayML call',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain', 'writer_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Rules — Four Layers Are Distinct and Never Collapsed',
    content: JSON.stringify({
      summary: 'The Scene Layer, Character Layer, Action Layer, and Camera Layer are distinct. The system must never collapse them into a single baked output.',
      rule_number: 8,
      section: 'scene_rules',
      enforcement: 'architecture_level',
      layers: {
        scene_layer: 'environment — reusable, empty, consistent',
        character_layer: 'avatar — composable, not baked into scene',
        action_layer: 'behavior — what the character does in the space',
        camera_layer: 'shot composition — angle, framing, movement',
      },
      current_status: 'Scene Layer implemented in scene_sets/scene_angles. Character/Action/Camera layers are future builds.',
      why: 'Collapsing layers produces disposable single-use images. Separating layers produces a scalable storytelling infrastructure.',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain', 'writer_brain', 'continuity_engine',
    ]),
  },

  // ── SCENE GENERATION RULES (7 rules) ──────────────────────────────────────

  {
    ...base,
    title: 'Scene Generation — Environment-Only Output Required',
    content: JSON.stringify({
      summary: 'All scene generation calls must produce environment-only output. No exceptions.',
      rule_number: 1,
      section: 'scene_generation',
      enforcement: 'system_level',
      implemented_in: 'sceneGenerationService.js — ENVIRONMENT_ONLY_CONSTRAINT constant prepended to every prompt',
      constraint_text: 'Empty room. No people. No person. No human. No figure. No silhouette. No body. No face. No hands. No reflection of a person. Environment only.',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Prompt Must Open With Empty Room Constraint',
    content: JSON.stringify({
      summary: 'Every RunwayML prompt must open with the empty-room negative constraint. This is the first token group, not appended at the end.',
      rule_number: 2,
      section: 'scene_generation',
      enforcement: 'prompt_level',
      why_first: 'RunwayML weights early tokens more heavily. The constraint must be first, not last.',
      required_opening: 'Empty room. No people. No person. No human. No figure. No silhouette. No body. No face. No hands. No reflection of a person. Environment only.',
      implemented_in: 'sceneGenerationService.js buildPrompt() — ENVIRONMENT_ONLY_CONSTRAINT is parts[0]',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Constraint Is System-Level Not Prompt-Level',
    content: JSON.stringify({
      summary: 'The environment-only constraint is enforced in sceneGenerationService.js before any prompt reaches RunwayML. It is not a creative guideline — it is code.',
      rule_number: 3,
      section: 'scene_generation',
      enforcement: 'code_level',
      location: 'src/services/sceneGenerationService.js',
      constant: 'ENVIRONMENT_ONLY_CONSTRAINT',
      cannot_be_overridden_by: [
        'individual prompt edits',
        'canonical_description content',
        'angle modifier text',
      ],
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Intentional Negative Space Specifics',
    content: JSON.stringify({
      summary: 'Generated scenes must include deliberate empty space for character placement. Not just "no people" but actively open spatial zones.',
      rule_number: 4,
      section: 'scene_generation',
      enforcement: 'prompt_level',
      required_spatial_zones: [
        'open floor areas',
        'clear bed edge with visible space',
        'unobstructed space near vanity',
        'room in doorway framing for entrance/exit',
      ],
      prompt_language: 'spacious layout, clear open areas for character placement, unobstructed spatial zones',
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Multi-Angle Consistency Requirements',
    content: JSON.stringify({
      summary: 'All angles in a Scene Set must feel like the same physical room. Enforced via base_runway_seed locking.',
      rule_number: 5,
      section: 'scene_generation',
      enforcement: 'seed_locking',
      mechanism: {
        base_seed_locked: 'On first successful generation, base_runway_seed is written to scene_sets record and never overwritten',
        angle_generation: 'All subsequent angles pass the locked base_runway_seed to RunwayML, ensuring visual consistency',
        never_overwrite: 'PUT /api/v1/scene-sets/:id will never overwrite base_runway_seed — enforced in route handler',
      },
      consistency_requirements: [
        'same room layout',
        'same lighting direction and quality',
        'same furniture and object placement',
        'same spatial scale and proportions',
      ],
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Style Target',
    content: JSON.stringify({
      summary: 'All LalaVerse scene generation targets soft realism with warm feminine aesthetic. Specific banned styles are listed.',
      rule_number: 6,
      section: 'scene_generation',
      enforcement: 'prompt_level',
      style_target: {
        description: 'soft realism, warm tones, feminine and expressive, lived-in but intentional',
        visual_blend: [
          'Final Fantasy softness + lighting',
          'The Sims personalization + livability',
          'Pinterest-core femininity + aspirational detail',
          'magical realism (not fantasy overload)',
        ],
      },
      banned_styles: [
        'hyper-staged catalog look',
        'clutter chaos',
        'dark cinematic mood (unless explicitly defined for a specific set)',
        'staging that implies a specific person was just present',
        'neon lighting',
        'cyberpunk elements',
        'ultra-minimal sterile design',
        'Pinterest maximalism explosion',
        'IKEA catalog emptiness',
      ],
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation', 'director_brain', 'writer_brain',
    ]),
  },

  {
    ...base,
    title: 'Scene Generation — Banned Output Types',
    content: JSON.stringify({
      summary: 'Specific output types are permanently banned from scene generation regardless of prompt or context.',
      rule_number: 7,
      section: 'scene_generation',
      enforcement: 'generation_validation',
      permanently_banned: [
        'any output containing a person, figure, or human form',
        'any output containing a reflection of a person',
        'any output where staging implies a specific person was just present',
        'any output that locks the scene to a single narrative moment',
        'catalog-style staging (too perfect, no life)',
        'chaos-style staging (too cluttered, no intention)',
      ],
    }),
    applies_to: JSON.stringify([
      'show_brain', 'scene_generation',
    ]),
  },

];

async function seedSceneRules() {
  const t = await sequelize.transaction();

  try {
    console.log('Seeding Scene Rules into franchise_knowledge...');
    console.log(`Total entries: ${entries.length}`);
    console.log('');

    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const [record, wasCreated] = await FranchiseKnowledge.findOrCreate({
        where: { title: entry.title },
        defaults: entry,
        transaction: t,
      });

      if (wasCreated) {
        console.log(`  ✓ Created: ${entry.title}`);
        created++;
      } else {
        // Update content if already exists — rules may have been refined
        await record.update({
          content: entry.content,
          applies_to: entry.applies_to,
          updated_at: now,
        }, { transaction: t });
        console.log(`  ↺ Updated: ${entry.title}`);
        updated++;
      }
    }

    await t.commit();

    console.log('');
    console.log(`✅ Scene Rules seed complete.`);
    console.log(`   Created: ${created} | Updated: ${updated}`);
    console.log('');
    console.log('These rules are now available to:');
    console.log('  memories.js         — story generation guardrails');
    console.log('  tierFeatures.js     — continuity guard');
    console.log('  upgradeRoutes.js    — post-generation review');
    console.log('  ShowBrain.jsx       — after frontend rewrite');
    console.log('  sceneGenerationService.js — already enforced in code');

  } catch (err) {
    await t.rollback();
    console.error('✗ Seed failed:', err.message);
    throw err;
  }
}

if (require.main === module) {
  seedSceneRules()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = seedSceneRules;
