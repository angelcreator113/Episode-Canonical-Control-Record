'use strict';

/**
 * Talk (Evoni, 2026-10-18; services/characterTalk).
 *
 * 1. character_conversations: a confidential session between a character
 *    and Dr. Amara Sinclair, their therapist. Only services/characterTalk
 *    reads it; no writer, drafter, press or Pulse code does.
 *      registry_character_id  whose session
 *      counselor              'dr_sinclair'
 *      messages               [{ from: 'dr_sinclair' | 'character', text, at }]
 *      review                 { session_note, items: [{ id, kind, ..., status }], reviewed_at }
 *      created_by, timestamps, deleted_at
 * 2. Dr. Amara Sinclair, a draft character in Lala's world for Evoni to
 *    accept: in the registry Lala is in (else the first registry), a
 *    confidential professional with no feed profile, so nothing posts as
 *    her or about her clients. Left alone if her key already exists.
 *
 * down: drops the table and removes her while she is still the draft this
 * added.
 */

const MARK = 'migration 20261018150000';

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const SINCLAIR = {
  key: 'amara_sinclair',
  name: 'Dr. Amara Sinclair',
  role_label: 'Therapist, The Quiet Room',
  description: 'A licensed therapist with a private practice, The Quiet Room. Everyone in the LalaVerse has heard of her; very few know anything about her. Known as Dr. Sinclair, or Amara to a select few.',
  personality: 'Elegant and grounded. Perceptive, direct when it matters, occasionally funny, very hard to manipulate. Not cold, not everyone\'s friend. She does not tell people what they want to hear; she helps them find out what they actually believe.',
  core_belief: 'Everyone deserves somewhere they don\'t have to perform.',
  signature_trait: 'Asks the question underneath the one you asked.',
  voice: {
    speech_pattern: 'Calm, unhurried; short questions that land.',
    vocabulary_tone: 'Warm, precise, never clinical.',
    catchphrases: ['Everyone deserves somewhere they don\'t have to perform.'],
    internal_monologue_style: 'Listens for what is not being said.',
  },
  career: { profession: 'Licensed therapist, The Quiet Room (private practice)', career_goal: 'Keep the room the one place her clients do not perform.' },
  extra: {
    classification: 'confidential_professional',
    specialty: 'Identity, relationships, ambition, self-worth, and life transitions',
    workplace: 'The Quiet Room',
    public_presence: 'Extremely limited; no personal feed; personal relationships not publicly documented',
    confidentiality: 'Her sessions are confidential. She never posts about clients, never shares what they say, and appears at an event only with a story reason.',
  },
};

module.exports = {
  SINCLAIR,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      await q(`CREATE TABLE IF NOT EXISTS character_conversations (
        id UUID PRIMARY KEY,
        registry_character_id UUID NOT NULL REFERENCES registry_characters(id) ON DELETE CASCADE,
        counselor VARCHAR(40) NOT NULL DEFAULT 'dr_sinclair',
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        review JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`);
      await q(`CREATE INDEX IF NOT EXISTS character_conversations_character
                 ON character_conversations (registry_character_id, updated_at DESC) WHERE deleted_at IS NULL`);

      if (!(await tableExists(sequelize, 'registry_characters', transaction))) return;
      const [[exists]] = await q('SELECT id FROM registry_characters WHERE character_key = :key AND deleted_at IS NULL LIMIT 1', { key: SINCLAIR.key });
      if (exists) { console.log(`[${MARK}] ${SINCLAIR.name} already exists; left as is`); return; }
      const [[lala]] = await q("SELECT registry_id FROM registry_characters WHERE character_key = 'lala' AND deleted_at IS NULL LIMIT 1");
      const [[first]] = lala ? [[null]] : await q('SELECT id FROM character_registries WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
      const registryId = lala?.registry_id || first?.id;
      if (!registryId) { console.log(`[${MARK}] no registry yet; ${SINCLAIR.name} not added`); return; }
      await q(
        `INSERT INTO registry_characters
           (id, registry_id, character_key, display_name, selected_name, world, role_type, role_label, appearance_mode, status,
            description, personality, core_belief, signature_trait, voice_signature, career_status, extra_fields,
            is_alive, intimate_eligible, created_at, updated_at)
         VALUES
           (gen_random_uuid(), :registry, :key, :name, :name, 'lalaverse', 'support', :roleLabel, 'brief', 'draft',
            :description, :personality, :coreBelief, :signatureTrait, CAST(:voice AS jsonb), CAST(:career AS jsonb), CAST(:extra AS jsonb),
            true, false, NOW(), NOW())`,
        {
          registry: registryId, key: SINCLAIR.key, name: SINCLAIR.name, roleLabel: SINCLAIR.role_label,
          description: SINCLAIR.description, personality: SINCLAIR.personality, coreBelief: SINCLAIR.core_belief,
          signatureTrait: SINCLAIR.signature_trait, voice: JSON.stringify(SINCLAIR.voice), career: JSON.stringify(SINCLAIR.career),
          extra: JSON.stringify({ ...SINCLAIR.extra, added_by: MARK }),
        });
      console.log(`[${MARK}] added ${SINCLAIR.name} as a draft character`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      await q('DROP TABLE IF EXISTS character_conversations');
      if (await tableExists(sequelize, 'registry_characters', transaction)) {
        await q(`DELETE FROM registry_characters WHERE character_key = :key AND status = 'draft' AND extra_fields->>'added_by' = :mark`,
          { key: SINCLAIR.key, mark: MARK });
      }
    });
  },
};
