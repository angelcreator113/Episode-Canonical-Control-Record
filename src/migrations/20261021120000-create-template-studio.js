'use strict';

/**
 * template_studio: the templates the Templates page lists and
 * TemplateDesigner edits (src/routes/templateStudio.js, raw SQL; no model).
 * Until now only the ad-hoc scripts/migrations/create-template-studio-table.js
 * made it, so on a database built from src/migrations every Templates call
 * failed (relation "template_studio" does not exist). Evoni, 2026-10-21: fix
 * the Templates page.
 *
 * The table is made exactly as that script makes it (columns, CHECK,
 * UNIQUE(name, version), indexes, the updated_at trigger), plus deleted_at.
 * Where the script already made it, its rows are kept; only deleted_at is
 * added. thumbnail_compositions.template_studio_id (the script
 * add-template-studio-id-column.js) is added the same way.
 *
 * Guarded throughout. down changes nothing: the table may hold templates
 * made before this migration, by the script.
 */

const TABLE = 'template_studio';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const run = (sql) => sequelize.query(sql, { transaction });
      if (!(await tableExists(sequelize, TABLE, transaction))) {
        await run(`
          CREATE TABLE ${TABLE} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
            locked BOOLEAN DEFAULT false,
            canvas_config JSONB NOT NULL DEFAULT '{"width": 1280, "height": 720, "background_color": "#000000"}'::jsonb,
            role_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
            safe_zones JSONB DEFAULT '{}'::jsonb,
            required_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
            optional_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
            formats_supported TEXT[] DEFAULT ARRAY['YOUTUBE']::TEXT[],
            created_by UUID,
            published_at TIMESTAMP,
            locked_at TIMESTAMP,
            parent_template_id UUID REFERENCES ${TABLE}(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(name, version)
          )`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_status ON ${TABLE}(status)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_locked ON ${TABLE}(locked)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_name ON ${TABLE}(name)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_created_by ON ${TABLE}(created_by)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_parent_template_id ON ${TABLE}(parent_template_id)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_template_studio_formats_supported ON ${TABLE} USING GIN(formats_supported)`);
        await run(`
          CREATE OR REPLACE FUNCTION update_template_studio_updated_at()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql`);
        await run(`DROP TRIGGER IF EXISTS trigger_template_studio_updated_at ON ${TABLE}`);
        await run(`
          CREATE TRIGGER trigger_template_studio_updated_at
            BEFORE UPDATE ON ${TABLE}
            FOR EACH ROW
            EXECUTE FUNCTION update_template_studio_updated_at()`);
      }
      await run(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
      if (await tableExists(sequelize, 'thumbnail_compositions', transaction)) {
        await run(`ALTER TABLE thumbnail_compositions
          ADD COLUMN IF NOT EXISTS template_studio_id UUID REFERENCES ${TABLE}(id) ON DELETE SET NULL`);
        await run('CREATE INDEX IF NOT EXISTS idx_compositions_template_studio_id ON thumbnail_compositions(template_studio_id)');
      }
    });
  },

  async down() {
    // Left as is: dropping the table could lose templates the script made.
  },
};
