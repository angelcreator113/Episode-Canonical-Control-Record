exports.up = (pgm) => {
  // Step 1: Add versioning columns to thumbnail_compositions
  pgm.addColumns('thumbnail_compositions', {
    current_version: {
      type: 'integer',
      default: 1,
    },
    version_history: {
      type: 'jsonb',
      default: '{}',
    },
    last_modified_by: {
      type: 'varchar(100)',
    },
    modification_timestamp: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Step 2: Create composition_versions tracking table
  pgm.createTable('composition_versions', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    composition_id: {
      type: 'uuid',
      notNull: true,
      references: { name: 'thumbnail_compositions', field: 'id' },
      onDelete: 'CASCADE',
    },
    version_number: {
      type: 'integer',
      notNull: true,
    },
    version_hash: {
      type: 'varchar(64)',
      unique: true,
    },
    change_summary: {
      type: 'text',
    },
    changed_fields: {
      type: 'jsonb',
    },
    created_by: {
      type: 'varchar(100)',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    is_published: {
      type: 'boolean',
      default: false,
    },
    composition_snapshot: {
      type: 'jsonb',
      notNull: true,
    },
  });

  // Add unique constraint and check constraint
  pgm.addConstraint('composition_versions', 'unique_composition_version', {
    unique: ['composition_id', 'version_number'],
  });

  pgm.addConstraint('composition_versions', 'valid_version_number', {
    check: 'version_number > 0',
  });

  // Step 3: Create indexes for performance
  pgm.createIndex('composition_versions', 'composition_id', {
    name: 'idx_composition_versions_composition_id',
  });

  pgm.createIndex('composition_versions', 'created_at', {
    name: 'idx_composition_versions_created_at',
    direction: 'DESC',
  });

  pgm.createIndex('composition_versions', 'version_hash', {
    name: 'idx_composition_versions_hash',
  });

  pgm.createIndex('thumbnail_compositions', 'current_version', {
    name: 'idx_compositions_current_version',
  });

  // Step 4: Create version changelog view for easy querying
  pgm.createView(
    'composition_version_changelog',
    {
      replace: true,
    },
    `
      SELECT 
        cv.composition_id,
        cv.version_number,
        cv.change_summary,
        cv.created_by,
        cv.created_at,
        cv.is_published,
        cv.changed_fields,
        tc.name as composition_name
      FROM composition_versions cv
      JOIN thumbnail_compositions tc ON cv.composition_id = tc.id
      ORDER BY cv.composition_id, cv.version_number DESC
    `
  );

  // Step 5: Create function to initialize version 1 for existing compositions
  pgm.createFunction(
    'initialize_composition_version',
    [],
    { returns: 'void', language: 'plpgsql', replace: true },
    `
      BEGIN
        -- For compositions without version history, create v1 entry
        INSERT INTO composition_versions (
          composition_id,
          version_number,
          change_summary,
          created_by,
          created_at,
          is_published,
          composition_snapshot,
          version_hash
        )
        SELECT
          id,
          1,
          'Initial composition creation',
          'system',
          created_at,
          TRUE,
          jsonb_build_object(
            'id', id,
            'name', name,
            'template_id', template_id,
            'background_frame_asset_id', background_frame_asset_id,
            'lala_asset_id', lala_asset_id,
            'guest_asset_id', guest_asset_id,
            'justawomen_asset_id', justawomen_asset_id,
            'selected_formats', selected_formats,
            'status', status
          ),
          'initial_version'
        FROM thumbnail_compositions
        WHERE id NOT IN (SELECT DISTINCT composition_id FROM composition_versions)
        ON CONFLICT DO NOTHING;
      END;
    `
  );

  // Execute initialization
  pgm.sql(`SELECT initialize_composition_version();`);

  // Step 6: Create trigger to track composition updates
  pgm.createFunction(
    'track_composition_changes',
    [],
    { returns: 'trigger', language: 'plpgsql', replace: true },
    `
      DECLARE
        v_changes JSONB := '{}';
        v_hash VARCHAR(64);
      BEGIN
        -- Build changed_fields JSON if this is an update
        IF TG_OP = 'UPDATE' THEN
          IF OLD.name IS DISTINCT FROM NEW.name THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
          END IF;
          IF OLD.template_id IS DISTINCT FROM NEW.template_id THEN
            v_changes := v_changes || jsonb_build_object('template_id', jsonb_build_object('old', OLD.template_id, 'new', NEW.template_id));
          END IF;
          IF OLD.background_frame_asset_id IS DISTINCT FROM NEW.background_frame_asset_id THEN
            v_changes := v_changes || jsonb_build_object('background_asset', jsonb_build_object('old', OLD.background_frame_asset_id::text, 'new', NEW.background_frame_asset_id::text));
          END IF;
          IF OLD.lala_asset_id IS DISTINCT FROM NEW.lala_asset_id THEN
            v_changes := v_changes || jsonb_build_object('lala_asset', jsonb_build_object('old', OLD.lala_asset_id::text, 'new', NEW.lala_asset_id::text));
          END IF;
          IF OLD.guest_asset_id IS DISTINCT FROM NEW.guest_asset_id THEN
            v_changes := v_changes || jsonb_build_object('guest_asset', jsonb_build_object('old', OLD.guest_asset_id::text, 'new', NEW.guest_asset_id::text));
          END IF;
          IF OLD.selected_formats IS DISTINCT FROM NEW.selected_formats THEN
            v_changes := v_changes || jsonb_build_object('selected_formats', jsonb_build_object('old', OLD.selected_formats, 'new', NEW.selected_formats));
          END IF;
          IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
          END IF;
        END IF;

        -- Create new version
        v_hash := md5(NEW.id::text || NEW.current_version::text || NOW()::text);
        
        INSERT INTO composition_versions (
          composition_id,
          version_number,
          version_hash,
          change_summary,
          changed_fields,
          created_by,
          is_published,
          composition_snapshot
        ) VALUES (
          NEW.id,
          NEW.current_version,
          v_hash,
          CASE 
            WHEN TG_OP = 'INSERT' THEN 'Composition created'
            ELSE 'Composition updated'
          END,
          v_changes,
          COALESCE(NEW.last_modified_by, 'system'),
          (NEW.status = 'published'),
          jsonb_build_object(
            'id', NEW.id,
            'name', NEW.name,
            'template_id', NEW.template_id,
            'background_frame_asset_id', NEW.background_frame_asset_id,
            'lala_asset_id', NEW.lala_asset_id,
            'guest_asset_id', NEW.guest_asset_id,
            'justawomen_asset_id', NEW.justawomen_asset_id,
            'selected_formats', NEW.selected_formats,
            'status', NEW.status,
            'created_at', NEW.created_at,
            'updated_at', NOW()
          )
        );

        -- Update version history in composition
        NEW.version_history := jsonb_build_object(
          'total_versions', NEW.current_version,
          'last_modified', NOW(),
          'last_modified_by', NEW.last_modified_by
        );
        
        NEW.modification_timestamp := NOW();
        
        RETURN NEW;
      END;
    `
  );

  // Create trigger
  pgm.sql(`
    CREATE TRIGGER "tr_track_composition_changes"
    AFTER INSERT OR UPDATE ON "thumbnail_compositions"
    FOR EACH STATEMENT
    EXECUTE PROCEDURE "track_composition_changes"()
  `);
};

exports.down = (pgm) => {
  // Drop trigger
  pgm.sql(`DROP TRIGGER IF EXISTS "tr_track_composition_changes" ON "thumbnail_compositions"`);

  // Drop functions
  pgm.dropFunction('track_composition_changes', [], {
    ifExists: true,
  });

  pgm.dropFunction('initialize_composition_version', [], {
    ifExists: true,
  });

  // Drop view
  pgm.dropView('composition_version_changelog', {
    ifExists: true,
  });

  // Drop table
  pgm.dropTable('composition_versions', {
    ifExists: true,
  });

  // Drop columns from thumbnail_compositions
  pgm.dropColumns('thumbnail_compositions', [
    'current_version',
    'version_history',
    'last_modified_by',
    'modification_timestamp',
  ]);
};
