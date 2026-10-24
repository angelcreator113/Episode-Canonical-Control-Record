'use strict';

/**
 * Who knows about a relationship (Evoni, 2026-10-23: "each relationship
 * records who knows the truth of it, like character secrets do, so the
 * writers know who can mention it and who can't"). Two columns on
 * character_relationships:
 *
 *   known_by      JSONB list of who knows, besides the two of them:
 *                 [{ registry_character_id | profile_id | name, since_episode_id?, how? }]
 *   public_state  secret | rumoured | known: where everyone else stands
 *
 * Backfill, once, from what is already there:
 *   - public_state from The Pulse: the pair's Feed profiles
 *     (registry_characters.feed_profile_id) in social_profile_relationships,
 *     either way round. A romantic row reads the romantic kinds, any other
 *     row the rest; the most open visibility wins (public > rumored >
 *     hidden). So a romance hidden on the Pulse is 'secret'. No Pulse row
 *     leaves it 'known'.
 *   - known_by from the three old "knows" notes (source_knows,
 *     target_knows, reader_knows): a character of either person's registry
 *     whose name the notes use (the chosen name, the display name, or a
 *     first name only one of them has) is added, with how saying so.
 *     The notes themselves are left as they are: they say what each person
 *     knows about the other, which is a different thing.
 *
 * Down drops both columns.
 */

const STATES = ['secret', 'rumoured', 'known'];
const ROMANTIC_KINDS = ['couple', 'ex', 'situationship', 'baby_daddy', 'baby_mama', 'secret_link'];
const OPENNESS = { public: 'known', rumored: 'rumoured', hidden: 'secret' };
const ORDER = ['known', 'rumoured', 'secret'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const says = (text, name) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(text);

/** The characters the notes name, other than the two of them. Exported for the tests. */
function namedInNotes(text, people, pair) {
  if (!text || !text.trim()) return [];
  const firstCount = new Map();
  for (const p of people) {
    const first = String(p.selected_name || p.display_name || '').trim().split(/\s+/)[0] || '';
    if (first.length >= 3) firstCount.set(first.toLowerCase(), (firstCount.get(first.toLowerCase()) || 0) + 1);
  }
  return people.filter((p) => {
    if (pair.includes(String(p.id))) return false;
    const names = [p.selected_name, p.display_name].map((n) => String(n || '').trim()).filter((n) => n.length >= 3);
    const first = (names[0] || '').split(/\s+/)[0];
    if (first && first.length >= 3 && firstCount.get(first.toLowerCase()) === 1) names.push(first);
    return names.some((n) => says(text, n));
  });
}

module.exports = {
  namedInNotes,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await queryInterface.describeTable('character_relationships');
      if (!cols.known_by) {
        await queryInterface.addColumn('character_relationships', 'known_by', {
          type: Sequelize.JSONB, allowNull: false, defaultValue: [],
        }, { transaction });
      }
      if (!cols.public_state) {
        await queryInterface.addColumn('character_relationships', 'public_state', {
          type: Sequelize.STRING(20), allowNull: false, defaultValue: 'known',
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE character_relationships ADD CONSTRAINT character_relationships_public_state_check
             CHECK (public_state IN (${STATES.map((s) => `'${s}'`).join(', ')}))`, { transaction });
      }

      const [rows] = await sequelize.query(
        `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.is_romantic, cr.source_knows, cr.target_knows, cr.reader_knows,
                ca.registry_id AS reg_a, cb.registry_id AS reg_b, ca.feed_profile_id AS fa, cb.feed_profile_id AS fb,
                ca.display_name AS name_a, COALESCE(NULLIF(ca.selected_name, ''), ca.display_name) AS chosen_a,
                cb.display_name AS name_b, COALESCE(NULLIF(cb.selected_name, ''), cb.display_name) AS chosen_b
           FROM character_relationships cr
           JOIN registry_characters ca ON ca.id = cr.character_id_a
           JOIN registry_characters cb ON cb.id = cr.character_id_b`, { transaction });

      const hasPulse = (await sequelize.query("SELECT 1 FROM pg_class WHERE relname = 'social_profile_relationships'", { transaction }))[0].length > 0;
      const registryPeople = new Map();
      const peopleOf = async (reg) => {
        if (!reg) return [];
        if (!registryPeople.has(reg)) {
          const [people] = await sequelize.query(
            'SELECT id, display_name, selected_name FROM registry_characters WHERE registry_id = :reg AND deleted_at IS NULL',
            { replacements: { reg }, transaction });
          registryPeople.set(reg, people);
        }
        return registryPeople.get(reg);
      };

      for (const r of rows) {
        let state = 'known';
        if (hasPulse && r.fa && r.fb) {
          const [pulse] = await sequelize.query(
            `SELECT relationship_type::text AS kind, COALESCE(public_visibility::text, 'public') AS visibility
               FROM social_profile_relationships
              WHERE (source_profile_id = :fa AND target_profile_id = :fb) OR (source_profile_id = :fb AND target_profile_id = :fa)`,
            { replacements: { fa: r.fa, fb: r.fb }, transaction });
          const matching = pulse.filter((p) => ROMANTIC_KINDS.includes(p.kind) === !!r.is_romantic);
          if (matching.length) state = ORDER[Math.min(...matching.map((p) => ORDER.indexOf(OPENNESS[p.visibility] || 'known')))];
        }

        const pair = [String(r.character_id_a), String(r.character_id_b)];
        const people = [...new Map([...(await peopleOf(r.reg_a)), ...(await peopleOf(r.reg_b))].map((p) => [String(p.id), p])).values()];
        const notes = [
          ['source_knows', `${r.chosen_a || r.name_a || 'the first'} knows`],
          ['target_knows', `${r.chosen_b || r.name_b || 'the second'} knows`],
          ['reader_knows', 'Reader knows'],
        ];
        const knowers = new Map();
        for (const [col, label] of notes) {
          for (const p of namedInNotes(r[col], people, pair)) {
            if (!knowers.has(String(p.id))) knowers.set(String(p.id), { registry_character_id: String(p.id), how: `Named in the "${label}" notes` });
          }
        }
        if (state === 'known' && !knowers.size) continue;
        await sequelize.query(
          'UPDATE character_relationships SET public_state = :state, known_by = CAST(:known AS jsonb) WHERE id = :id',
          { replacements: { id: r.id, state, known: JSON.stringify([...knowers.values()]) }, transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await queryInterface.describeTable('character_relationships');
      await sequelize.query('ALTER TABLE character_relationships DROP CONSTRAINT IF EXISTS character_relationships_public_state_check', { transaction });
      if (cols.public_state) await queryInterface.removeColumn('character_relationships', 'public_state', { transaction });
      if (cols.known_by) await queryInterface.removeColumn('character_relationships', 'known_by', { transaction });
    });
  },
};
