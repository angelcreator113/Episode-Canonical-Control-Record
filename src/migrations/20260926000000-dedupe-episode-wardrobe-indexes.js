'use strict';

/**
 * episode_wardrobe loses its duplicate indexes (Task #1933).
 *
 * Production read, ATTESTED 2026-09-25 (Evoni, recorded on #1930): the table
 * has 12 indexes. episode_id is indexed three times, wardrobe_id three
 * times, and UNIQUE (episode_id, wardrobe_id) exists twice, as
 * episode_wardrobe_episode_id_wardrobe_id_key and unique_episode_wardrobe.
 * Evoni: "accumulated cruft rather than a problem". The table holds 0 rows
 * (ATTESTED on the #1929 PR), so this is cheap.
 *
 * The two unique names are known from her read. The names of the three
 * episode_id and three wardrobe_id indexes are not: the repo's scripts and
 * dumps name seven candidates between them (episode_wardrobe_episode_id,
 * idx_episode_wardrobe_episode_id, episode_wardrobe_episode_id_idx,
 * idx_episode_wardrobe_episode, and the wardrobe_id counterparts), more
 * than three each. So this migration never guesses a name. It reads the
 * table's indexes from pg_indexes at run time and groups the exact
 * duplicates by definition:
 *
 *   unique    CREATE UNIQUE INDEX … USING btree (episode_id, wardrobe_id)
 *   episode   CREATE INDEX … USING btree (episode_id)
 *   wardrobe  CREATE INDEX … USING btree (wardrobe_id)
 *
 * Only a plain btree over exactly those columns, with no WHERE, INCLUDE,
 * expression, opclass or sort order, counts as a duplicate. The primary
 * key, the foreign keys and every other index (scene_id, worn_at, the
 * favorites partial index, …) are not touched.
 *
 * From each group it keeps one, under the name the model declares
 * (src/models/EpisodeWardrobe.js `indexes`): unique_episode_wardrobe,
 * episode_wardrobe_episode_id and episode_wardrobe_wardrobe_id. If an index
 * with that name is in the group, that one is kept. Otherwise it keeps the
 * first by name and renames it. It drops the rest with DROP INDEX IF EXISTS,
 * or ALTER TABLE … DROP CONSTRAINT IF EXISTS when a constraint owns the
 * index. A group with no index at all gets one created, so the end state is
 * exactly one of each. /wardrobe/select's
 * `ON CONFLICT (episode_id, wardrobe_id)` needs the unique index, and the
 * kept one serves it whether it is a constraint or a plain unique index.
 *
 * down: up writes what it dropped, renamed and created, with each dropped
 * object's own definition (pg_get_indexdef / pg_get_constraintdef), into
 * the comment of the kept unique index. down reads that record, drops what
 * up created, renames back what up renamed, and recreates each dropped
 * index or constraint from its recorded definition.
 *
 * No CREATE TABLE: no live migration creates episode_wardrobe, so a fresh
 * database (CI, a new dev box) has none. There, like
 * 20260925000001-add-approval-columns-to-episode-wardrobe.js, this logs and
 * does nothing. All of it runs in one transaction.
 *
 * Deploy order: this migration first, then the code (the model's `indexes`
 * block now names the two single-column indexes; nothing runs sync, so the
 * order matters only for keeping the model and the table in agreement).
 */
const TABLE = 'episode_wardrobe';
const LOG = '[migration 20260926000000]';
const RECORD_MARKER = 'Task #1933 index cleanup record: ';

// Known from Evoni's read: the duplicate of the kept unique index.
const KNOWN_DUPLICATE_UNIQUE = 'episode_wardrobe_episode_id_wardrobe_id_key';

const GROUPS = [
  { key: 'unique', unique: true, columns: ['episode_id', 'wardrobe_id'], keep: 'unique_episode_wardrobe' },
  { key: 'episode', unique: false, columns: ['episode_id'], keep: 'episode_wardrobe_episode_id' },
  { key: 'wardrobe', unique: false, columns: ['wardrobe_id'], keep: 'episode_wardrobe_wardrobe_id' },
];

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;
// A string literal (standard_conforming_strings is on: only the quote is doubled).
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Parse a pg_indexes.indexdef. Returns { unique, columns } for a plain btree
 * over bare columns, or null for anything else (partial, INCLUDE,
 * expressions, opclasses, sort orders, other access methods).
 */
function parseIndexDef(indexdef) {
  const m = /^CREATE (UNIQUE )?INDEX \S+ ON \S+ USING btree \(([^()]*)\)$/.exec(indexdef);
  if (!m) return null;
  const columns = m[2].split(',').map((c) => c.trim());
  if (!columns.every((c) => /^"?[a-z_][a-z0-9_]*"?$/.test(c))) return null;
  return { unique: !!m[1], columns: columns.map((c) => c.replace(/"/g, '')) };
}

async function readIndexes(sequelize, transaction) {
  // pg_indexes names the table's indexes; pg_constraint says which of them a
  // constraint owns (those are dropped and renamed through the constraint).
  const [rows] = await sequelize.query(
    `SELECT i.indexname, i.indexdef, c.conname, c.contype,
            pg_get_constraintdef(c.oid) AS condef,
            obj_description(ic.oid, 'pg_class') AS comment
     FROM pg_indexes i
     JOIN pg_class ic ON ic.relname = i.indexname
       AND ic.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
     LEFT JOIN pg_constraint c ON c.conindid = ic.oid AND c.contype IN ('p', 'u', 'x')
       AND c.conrelid = to_regclass(quote_ident(i.schemaname) || '.' || quote_ident(i.tablename))
     WHERE i.schemaname = current_schema() AND i.tablename = :table
     ORDER BY i.indexname`,
    { replacements: { table: TABLE }, transaction }
  );
  return rows;
}

async function relationExists(sequelize, name, transaction) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM pg_class WHERE relname = :name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())`,
    { replacements: { name }, transaction }
  );
  return rows.length > 0;
}

async function constraintExists(sequelize, name, transaction) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM pg_constraint WHERE conname = :name AND conrelid = to_regclass(:table)`,
    { replacements: { name, table: TABLE }, transaction }
  );
  return rows.length > 0;
}

async function dropIndexOrConstraint(sequelize, row, transaction) {
  if (row.conname) {
    await sequelize.query(`ALTER TABLE ${q(TABLE)} DROP CONSTRAINT IF EXISTS ${q(row.conname)}`, { transaction });
  } else {
    await sequelize.query(`DROP INDEX IF EXISTS ${q(row.indexname)}`, { transaction });
  }
}

async function rename(sequelize, { from, to, constraint }, transaction) {
  if (constraint) {
    await sequelize.query(`ALTER TABLE ${q(TABLE)} RENAME CONSTRAINT ${q(from)} TO ${q(to)}`, { transaction });
  } else {
    await sequelize.query(`ALTER INDEX ${q(from)} RENAME TO ${q(to)}`, { transaction });
  }
}

module.exports = {
  parseIndexDef,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await queryInterface.tableExists(TABLE, { transaction }))) {
        console.warn(`${LOG} ${TABLE} does not exist here; no live migration creates it, so there is nothing to dedupe (fresh database).`);
        return;
      }

      const indexes = await readIndexes(sequelize, transaction);
      console.log(`${LOG} ${TABLE} has ${indexes.length} indexes before: ${indexes.map((r) => r.indexname).join(', ')}`);
      const record = { task: '#1933', dropped: [], renamed: [], created: [] };
      let keptUnique = null;

      for (const group of GROUPS) {
        const members = indexes.filter((r) => {
          if (r.contype === 'p') return false;
          const parsed = parseIndexDef(r.indexdef);
          return parsed && parsed.unique === group.unique
            && parsed.columns.length === group.columns.length
            && parsed.columns.every((c, i) => c === group.columns[i]);
        });

        if (members.length === 0) {
          // Nothing to keep: create the one the model declares.
          const cols = group.columns.map(q).join(', ');
          await sequelize.query(
            `CREATE ${group.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${q(group.keep)} ON ${q(TABLE)} (${cols})`,
            { transaction }
          );
          record.created.push(group.keep);
          console.log(`${LOG} ${group.key}: none found; created ${group.keep}`);
          if (group.unique) keptUnique = group.keep;
          continue;
        }

        const keep = members.find((r) => r.indexname === group.keep) || members[0];
        for (const row of members) {
          if (row === keep) continue;
          record.dropped.push({
            name: row.indexname,
            kind: row.conname ? 'constraint' : 'index',
            constraint: row.conname || null,
            def: row.conname ? row.condef : row.indexdef,
          });
          await dropIndexOrConstraint(sequelize, row, transaction);
          console.log(`${LOG} ${group.key}: dropped ${row.conname ? 'constraint' : 'index'} ${row.indexname}`);
        }

        let keptName = keep.indexname;
        if (keptName !== group.keep) {
          if (await relationExists(sequelize, group.keep, transaction)) {
            console.warn(`${LOG} ${group.key}: kept ${keptName}; ${group.keep} is taken by an index that is not a duplicate, so no rename.`);
          } else {
            await rename(sequelize, { from: keptName, to: group.keep, constraint: !!keep.conname }, transaction);
            record.renamed.push({ from: keptName, to: group.keep, constraint: !!keep.conname });
            console.log(`${LOG} ${group.key}: kept ${keptName}, renamed to ${group.keep}`);
            keptName = group.keep;
          }
        } else {
          console.log(`${LOG} ${group.key}: kept ${keptName}`);
        }
        if (group.unique) keptUnique = keptName;
      }

      if (!record.dropped.some((d) => d.name === KNOWN_DUPLICATE_UNIQUE)
        && indexes.some((r) => r.indexname === KNOWN_DUPLICATE_UNIQUE)
        && keptUnique !== KNOWN_DUPLICATE_UNIQUE) {
        console.warn(`${LOG} ${KNOWN_DUPLICATE_UNIQUE} exists but is not an exact duplicate of UNIQUE (episode_id, wardrobe_id); left in place.`);
      }

      // The record down needs, on the kept unique index.
      await sequelize.query(
        `COMMENT ON INDEX ${q(keptUnique)} IS ${lit(RECORD_MARKER + JSON.stringify(record))}`,
        { transaction }
      );

      const after = await readIndexes(sequelize, transaction);
      console.log(`${LOG} ${TABLE} has ${after.length} indexes after: ${after.map((r) => r.indexname).join(', ')}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await queryInterface.tableExists(TABLE, { transaction }))) {
        console.warn(`${LOG} ${TABLE} does not exist here; nothing to restore.`);
        return;
      }
      const indexes = await readIndexes(sequelize, transaction);
      const holder = indexes.find((r) => typeof r.comment === 'string' && r.comment.startsWith(RECORD_MARKER));
      if (!holder) {
        console.warn(`${LOG} no Task #1933 record on any ${TABLE} index; nothing to restore.`);
        return;
      }
      const record = JSON.parse(holder.comment.slice(RECORD_MARKER.length));
      await sequelize.query(`COMMENT ON INDEX ${q(holder.indexname)} IS NULL`, { transaction });

      for (const name of [...record.created].reverse()) {
        await sequelize.query(`DROP INDEX IF EXISTS ${q(name)}`, { transaction });
        console.log(`${LOG} down: dropped created ${name}`);
      }
      for (const r of [...record.renamed].reverse()) {
        const exists = r.constraint
          ? await constraintExists(sequelize, r.to, transaction)
          : await relationExists(sequelize, r.to, transaction);
        if (exists && !(await relationExists(sequelize, r.from, transaction))) {
          await rename(sequelize, { from: r.to, to: r.from, constraint: r.constraint }, transaction);
          console.log(`${LOG} down: renamed ${r.to} back to ${r.from}`);
        }
      }
      for (const d of record.dropped) {
        if (d.kind === 'constraint') {
          if (!(await constraintExists(sequelize, d.constraint, transaction))) {
            await sequelize.query(`ALTER TABLE ${q(TABLE)} ADD CONSTRAINT ${q(d.constraint)} ${d.def}`, { transaction });
          }
        } else {
          await sequelize.query(d.def.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS '), { transaction });
        }
        console.log(`${LOG} down: recreated ${d.kind} ${d.name}`);
      }
    });
  },
};
