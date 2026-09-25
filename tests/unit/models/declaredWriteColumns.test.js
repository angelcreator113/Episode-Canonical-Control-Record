/**
 * Task #1870, step 1 — the seven writes that dropped values for columns
 * production has (docs/SCHEMA_AGREEMENT_READ.md §1.1 / §6.1).
 *
 * Each column below is written by a create/update call but was not declared
 * on its model, so Sequelize dropped the value with no error. The fix is to
 * declare it (Evoni, 2026-09-25: declare, don't delete). This test pins each
 * declaration to the 2026-09-17 canon schema capture: the column must be in
 * the capture, and the model's type and nullability must match what the
 * capture shows. No database: models are defined on a never-connected
 * Sequelize instance and the capture is read from the repository.
 *
 * Task #1897 adds approveComposition's approved_by / approved_at (an
 * instance write, which the schema-agreement checker did not see then).
 * Task #1909 adds the instance writes the checker's step 1 now reports for
 * columns canon has.
 */
const fs = require('fs');
const path = require('path');
const { loadModel } = require('../helpers/schemaCheckedModel');

const CAPTURE = path.join(__dirname, '..', '..', '..', 'docs', 'audit', 'EvidenceNote_Canon_Schema_Capture_2026-09-17.txt');

// table -> column -> { data_type, is_nullable }
function readCapture() {
  const out = {};
  for (const line of fs.readFileSync(CAPTURE, 'utf8').split('\n')) {
    const cells = line.split('|').map(s => s.trim());
    if (cells.length !== 4 || cells[0] === 'table_name' || !cells[1]) continue;
    const [table, column, dataType, nullable] = cells;
    (out[table] = out[table] || {})[column] = { dataType, nullable };
  }
  return out;
}

// Sequelize type key -> information_schema.columns.data_type
const PG_TYPE = {
  STRING: 'character varying',
  JSONB: 'jsonb',
  UUID: 'uuid',
  BOOLEAN: 'boolean',
  ENUM: 'USER-DEFINED',
  // Sequelize 6 has one DATE type for Postgres; the model convention
  // (ThumbnailComposition.created_at, updated_at) declares DATE for canon's
  // `timestamp without time zone` columns too. Either timestamp kind matches.
  DATE: ['timestamp with time zone', 'timestamp without time zone'],
};

// [call site, model, columns]
const SITES = [
  ['src/routes/worldEvents.js (POST /events/from-profile)', 'WorldEvent', ['theme', 'mood', 'color_palette', 'floral_style', 'border_style']],
  ['src/routes/sceneProposeRoute.js (POST /arc-stage)', 'StorytellerBook', ['current_arc_stage', 'arc_stage_scores']],
  // createComposition was retired by Task #1884; the columns stay declared (canon has them).
  ['src/services/CompositionService.js (createComposition, retired #1884)', 'ThumbnailComposition', ['include_justawomaninherprime', 'justawomaninherprime_position', 'approval_status']],
  // Task #1897: an instance update (findByPk, then composition.update), which step 1 of the checker does not see.
  ['src/services/CompositionService.js (approveComposition, #1897)', 'ThumbnailComposition', ['approved_by', 'approved_at']],
  // Task #1909: writes through a loaded record, found by step 1's instance check.
  ['src/routes/compositions.js (POST /:id/generate-thumbnails, #1909)', 'ThumbnailComposition', ['published_at']],
  ['src/controllers/wardrobeController.js (toggleEpisodeFavorite, #1909)', 'EpisodeWardrobe', ['is_episode_favorite']],
  ['src/services/AssetService.js (processAsset, #1909)', 'Asset', ['s3_key_processed']],
  ['src/routes/characterCrossingRoutes.js (PUT /:id/confirm-gap, #1909)', 'RegistryCharacter', ['performing_publicly', 'dimensions_performed', 'dimensions_hidden']],
  ['src/services/careerPipelineService.js (spawnUnlockOpportunities)', 'Opportunity', ['career_goal_id']],
  ['src/routes/characterGenerator.js (commit)', 'RegistryCharacter', ['world_character_id']],
  ['src/controllers/sceneStudioController.js (saveSceneSetCanvas)', 'SceneSet', ['canvas_settings']],
  ['src/routes/propertyRoutes.js (POST /properties/:id/rooms)', 'SceneSet', ['canvas_settings']],
];

const capture = readCapture();
const rows = SITES.flatMap(([site, model, cols]) => cols.map(col => [model, col, site]));

describe('columns the dropping writes send are declared, as the capture shows them', () => {
  test.each(rows)('%s.%s (%s)', (modelName, column) => {
    const Model = loadModel(modelName);
    const table = Model.getTableName();
    const cap = capture[table] && capture[table][column];
    expect(cap).toBeDefined(); // the column exists in production: declare, never delete

    const attr = Model.rawAttributes[column];
    expect(attr).toBeDefined();
    expect([].concat(PG_TYPE[attr.type.key])).toContain(cap.dataType);
    expect(attr.allowNull !== false).toBe(cap.nullable === 'YES');
  });

  test('WorldEvent.CURRENT_ATTRIBUTES reads the invitation style back', () => {
    const WorldEvent = loadModel('WorldEvent');
    expect(WorldEvent.CURRENT_ATTRIBUTES).toEqual(
      expect.arrayContaining(['theme', 'mood', 'color_palette', 'floral_style', 'border_style']),
    );
  });

  test('StorytellerBook.current_arc_stage has the migration enum values', () => {
    expect(loadModel('StorytellerBook').rawAttributes.current_arc_stage.values)
      .toEqual(['establishment', 'pressure', 'crisis', 'integration']);
  });

  test('ThumbnailComposition.include_justawomaninherprime (NOT NULL) defaults to false', () => {
    expect(loadModel('ThumbnailComposition').rawAttributes.include_justawomaninherprime.defaultValue).toBe(false);
  });

  test('ThumbnailComposition keeps one version column: current_version, not version (#1897)', () => {
    // Evoni, 2026-09-25: point the code at current_version; do not declare
    // `version` (canon has it, but two version columns on one table is the
    // two-homes problem).
    const attrs = loadModel('ThumbnailComposition').rawAttributes;
    expect(attrs.current_version).toBeDefined();
    expect(attrs.version).toBeUndefined();
  });
});
