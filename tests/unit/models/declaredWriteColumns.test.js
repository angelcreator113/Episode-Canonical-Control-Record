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
};

// [call site, model, columns]
const SITES = [
  ['src/routes/worldEvents.js (POST /events/from-profile)', 'WorldEvent', ['theme', 'mood', 'color_palette', 'floral_style', 'border_style']],
  ['src/routes/sceneProposeRoute.js (POST /arc-stage)', 'StorytellerBook', ['current_arc_stage', 'arc_stage_scores']],
  ['src/services/CompositionService.js (createComposition)', 'ThumbnailComposition', ['include_justawomaninherprime', 'justawomaninherprime_position', 'approval_status']],
  ['src/services/careerPipelineService.js (spawnUnlockOpportunities)', 'Opportunity', ['career_goal_id']],
  ['src/routes/characterGenerator.js (commit)', 'RegistryCharacter', ['world_character_id']],
  ['src/controllers/sceneStudioController.js (saveSceneSetCanvas)', 'SceneSet', ['canvas_settings']],
  ['src/routes/propertyRoutes.js (POST /properties/:id/rooms)', 'SceneSet', ['canvas_settings']],
];

const capture = readCapture();
const rows = SITES.flatMap(([site, model, cols]) => cols.map(col => [model, col, site]));

describe('columns the seven dropping writes send are declared, as the capture shows them', () => {
  test.each(rows)('%s.%s (%s)', (modelName, column) => {
    const Model = loadModel(modelName);
    const table = Model.getTableName();
    const cap = capture[table] && capture[table][column];
    expect(cap).toBeDefined(); // the column exists in production: declare, never delete

    const attr = Model.rawAttributes[column];
    expect(attr).toBeDefined();
    expect(PG_TYPE[attr.type.key]).toBe(cap.dataType);
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
});
