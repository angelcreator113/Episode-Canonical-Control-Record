/**
 * update-character-profiles.js
 * Run with: node src/scripts/update-character-profiles.js
 *
 * Updates the 4 core Book 1 characters with full psychological profiles
 * based on the author's own understanding of who these characters are.
 *
 * Safe to re-run — uses findOne + update, not create.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.DATABASE_URL?.includes('amazonaws.com')
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const RegistryCharacter = sequelize.define('RegistryCharacter', {
      id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      registry_id:         { type: DataTypes.UUID },
      character_key:       { type: DataTypes.STRING(100) },
      icon:                { type: DataTypes.STRING(20) },
      display_name:        { type: DataTypes.STRING(255) },
      subtitle:            { type: DataTypes.STRING(255) },
      selected_name:       { type: DataTypes.STRING(255) },
      role_type:           { type: DataTypes.STRING },
      role_label:          { type: DataTypes.STRING(255) },
      description:         { type: DataTypes.TEXT },
      core_belief:         { type: DataTypes.TEXT },
      pressure_type:       { type: DataTypes.TEXT },
      personality:         { type: DataTypes.TEXT },
      personality_matrix:  { type: DataTypes.JSONB },
      appearance_mode:     { type: DataTypes.STRING },
      status:              { type: DataTypes.STRING },
      sort_order:          { type: DataTypes.INTEGER, defaultValue: 0 },
    }, {
      tableName: 'registry_characters',
      timestamps: true,
      underscored: true,
    });

    // ── Character profiles ───────────────────────────────────────────────

    const profiles = [

      {
        display_name: 'JustAWoman',
        character_key: 'just-a-woman',
        icon: '♛',
        subtitle: 'The Unnamed',
        role_type: 'protagonist',
        role_label: 'Core Protagonist',
        appearance_mode: 'on_page',
        sort_order: 0,
        updates: {
          selected_name: 'JustAWoman',
          description: 'Protagonist. She is not blocked by fear — she is active, consistent, and showing up every day. Posting. Creating. Putting herself out there. The wound is not inaction. The wound is visibility: she is doing everything right and still not being seen. Invisibility while trying is her specific pain.',
          core_belief: 'I am doing everything right. Why is the world looking past me?',
          pressure_type: 'Primary POV. Her confusion, persistence, and hunger drive every chapter. She is not a victim — she is a woman in motion who has not yet found her frequency.',
          personality: 'JustAWoman posts. Takes photos. Shows her meals. Invests. Tries. She is not lazy or afraid. She is consistent and invisible — and that specific combination is what makes her story so relatable. Do not write her as blocked. Write her as active and unseen. The frustration is not about starting. It is about not being found yet.',
          personality_matrix: {
            confidence: 65,
            playfulness: 70,
            luxury_tone: 60,
            drama: 55,
            softness: 75,
          },
        },
      },

      {
        display_name: 'The Comparison Creator',
        character_key: 'comparison-creator',
        icon: '◈',
        subtitle: 'Adjacent Timeline',
        role_type: 'pressure',
        role_label: 'Observed Pressure',
        appearance_mode: 'observed',
        sort_order: 3,
        updates: {
          selected_name: 'Chloe',
          description: 'Mirror character. Chloe is not a villain and not a rival. She is proof that it is possible. JustAWoman genuinely loves her — the friendship is real, the cheering is real. That authentic love makes the comparison more complicated, not less. Chloe\'s success does not make JustAWoman jealous. It makes her confused: we started in the same place, why is she there and I am still here?',
          core_belief: 'If Chloe can do it, I can do it. So why haven\'t I?',
          pressure_type: 'Motivation, creative inspiration, and living proof. Her presence raises the question JustAWoman cannot answer. She is not the antagonist — she is the measuring stick JustAWoman chose for herself.',
          personality: 'Write Chloe as genuinely successful, genuinely likable, genuinely supportive. She is not doing anything wrong. She is not flaunting. She is just thriving. That is what makes her so useful to JustAWoman and so quietly painful to be around. The comparison is JustAWoman\'s — Chloe never asked to be compared to.',
          personality_matrix: {
            confidence: 85,
            playfulness: 75,
            luxury_tone: 70,
            drama: 40,
            softness: 65,
          },
        },
      },

      {
        display_name: 'The Husband',
        character_key: 'the-husband',
        icon: '⚖',
        subtitle: 'Stability vs. Risk',
        role_type: 'pressure',
        role_label: 'Domestic Pressure',
        appearance_mode: 'on_page',
        sort_order: 1,
        updates: {
          selected_name: 'The Husband',
          description: 'The voice of practical love. He is not wrong — she has spent money, the returns have not come consistently. His skepticism is grounded in watching her try and not land. But his doubt, even when gentle, even when loving, confirms JustAWoman\'s deepest fear: maybe this is not real, maybe I am not built for this.',
          core_belief: 'Is wanting more a betrayal of what I already have? Is my desire for visibility selfish?',
          pressure_type: 'Internal pressure. He represents the reasonable voice that says stop spending, stop measuring yourself against strangers, come back to what is real. He means protect. She hears: quit. That gap between his intention and her reception is the tension.',
          personality: 'Do not write him as a villain or an obstacle. He loves her. He is watching her spend money and emotional energy on something that has not paid off yet. His concern is valid. But valid concern delivered at the wrong moment still hurts. Write the love and the friction simultaneously — that is what makes him real.',
          personality_matrix: {
            confidence: 70,
            playfulness: 45,
            luxury_tone: 35,
            drama: 30,
            softness: 60,
          },
        },
      },

      {
        display_name: 'Lala',
        character_key: 'lala',
        icon: '✦',
        subtitle: 'The Voice Inside',
        role_type: 'special',
        role_label: 'Creative Self / Alter Ego',
        appearance_mode: 'invisible',
        sort_order: 7,
        updates: {
          selected_name: 'Lala',
          description: 'The success JustAWoman wants. The version of herself who gets seen. Who the algorithm loves. Who does not second-guess the post before publishing it. In Book 1 she is still forming — a proto-voice, a thought that sounds different from the doubt. In the show she is AI because she was always inside JustAWoman. She did not arrive from outside. She was built from within.',
          core_belief: 'What happens when the world I built becomes its own kind of control?',
          pressure_type: 'Creative self. Possibility. The internal voice that is confident, not afraid. Styled, not performative. Direct, not aggressive. She is not a separate person — she is what JustAWoman becomes when she stops asking for permission. In Book 1 she appears as a single intrusive thought. By the end of the book she has a name.',
          personality: 'In Book 1, Lala does not speak in full paragraphs. She arrives as a thought — one line, sharp, styled, certain. She does not sound like doubt. She does not sound like fear. She sounds like someone who already knows the answer. Write her sparingly. Her rarity is what makes her arrival feel seismic. When she appears it must feel like a tonal rupture — the reader knows something has shifted even before JustAWoman does.',
          personality_matrix: {
            confidence: 95,
            playfulness: 80,
            luxury_tone: 90,
            drama: 65,
            softness: 55,
          },
        },
      },

    ];

    // ── Get registry_id from existing character ────────────────────────
    const anyChar = await RegistryCharacter.findOne();
    let registryId = anyChar ? anyChar.registry_id : null;

    if (!registryId) {
      // No characters at all — look up the registry
      const [rows] = await sequelize.query(
        `SELECT id FROM character_registries LIMIT 1`
      );
      if (rows.length === 0) {
        console.error('No character registry found. Create one in the UI first.');
        process.exit(1);
      }
      registryId = rows[0].id;
    }

    // ── Apply updates ────────────────────────────────────────────────────

    let updated = 0;
    let created = 0;

    for (const profile of profiles) {
      const character = await RegistryCharacter.findOne({
        where: { display_name: profile.display_name },
      });

      if (character) {
        await character.update(profile.updates);
        console.log(`✓ Updated: ${profile.display_name} → ${profile.updates.selected_name}`);
        updated++;
      } else {
        // Create the character with both metadata + updates
        await RegistryCharacter.create({
          registry_id: registryId,
          character_key: profile.character_key,
          icon: profile.icon,
          display_name: profile.display_name,
          subtitle: profile.subtitle,
          role_type: profile.role_type,
          role_label: profile.role_label,
          appearance_mode: profile.appearance_mode,
          sort_order: profile.sort_order,
          status: 'draft',
          ...profile.updates,
        });
        console.log(`+ Created: ${profile.display_name} → ${profile.updates.selected_name}`);
        created++;
      }
    }

    console.log(`\nDone. ${updated} updated, ${created} created.`);

  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
