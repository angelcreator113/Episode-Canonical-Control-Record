---
description: "Create a new Sequelize model + migration pair. Scaffolds the model file, migration with deleted_at (paranoid), and registers in models/index.js."
---
Create a new Sequelize model and its migration for this project.

## Model file (`src/models/{{ModelName}}.js`):
- Use the `(sequelize, DataTypes) => {}` function export pattern
- Use `Model.init()` with field definitions
- Include `static associate(models)` method
- Set `tableName` (snake_case plural), `underscored: true`, `modelName` (PascalCase)
- Paranoid mode is set globally — do NOT add `paranoid: true` to the model

## Migration file (`migrations/{{timestamp}}-create-{{table-name}}.js`):
- Timestamp format: `YYYYMMDDHHMMSS`
- Always include: `id`, `created_at`, `updated_at`, `deleted_at` columns
- `deleted_at` is REQUIRED — the project uses global `paranoid: true`
- Use `Sequelize.literal('NOW()')` for date defaults
- Include both `up` and `down` methods

## Registration in `src/models/index.js`:
- Add variable declaration in the appropriate section
- Add the `require` and initialization
- Wire up associations if needed

## After creating:
1. Run `node -c src/models/{{ModelName}}.js` to validate syntax
2. Explain the model purpose and its associations
