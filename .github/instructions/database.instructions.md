---
description: "Use when creating, editing, or debugging Sequelize models, database migrations, associations, JSONB fields, or database queries. Covers paranoid mode, model registration, migration patterns, and Neon PostgreSQL conventions."
applyTo: "src/models/**"
---
# Database & Sequelize Model Conventions

## Global Settings

- **Paranoid mode**: Enabled globally via `define.paranoid` in config — all tables soft-delete
- **Underscored**: All columns use `snake_case` (`underscored: true`)
- **Timestamps**: `created_at`, `updated_at` auto-managed; `deleted_at` for soft-delete
- **Database**: Neon PostgreSQL with connection pooling

## Model File Pattern (`src/models/ModelName.js`)

```javascript
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ModelName extends Model {
    static associate(models) {
      // Define associations here
    }
  }

  ModelName.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      // ... fields
    },
    {
      sequelize,
      modelName: 'ModelName',       // PascalCase
      tableName: 'model_names',     // snake_case plural
      underscored: true,
    }
  );

  return ModelName;
};
```

## Migration Pattern (`migrations/YYYYMMDDHHMMSS-description.js`)

```javascript
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('table_name', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      // ... columns
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },  // REQUIRED
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('table_name');
  },
};
```

## Critical Rules

- **Always include `deleted_at`** in migrations — omitting it breaks paranoid queries
- **Integer PKs** use `autoIncrement: true`; **UUID PKs** use `DataTypes.UUIDV4`
- **JSONB fields**: use `DataTypes.JSONB` for flexible data — common for `voice_signature`, `relationships_map`, `evolution_tracking`, `extra_fields`
- **Model registration**: Add to `src/models/index.js` — declare variable, require file, call init, wire associations
- **ENUM columns**: Must `DROP TYPE` in migration `down` method
- **SSL for scripts**: Standalone scripts hitting Neon need `DB_SSL_REJECT_UNAUTHORIZED=false`

## Character ID Patterns

```javascript
// Integer PK → RegistryCharacter → character_key (string slug)
const { RegistryCharacter } = require('../models');
const regChar = await RegistryCharacter.findByPk(character_id, { attributes: ['character_key'] });
const characterKey = regChar?.character_key;
// Use characterKey for context loaders, character_id (integer) for direct lookups
```

## Key Models

| Model | Purpose | PK Type |
|-------|---------|---------|
| `RegistryCharacter` | Character registry entries | UUID |
| `StorytellerChapter` | Chapter content for WriteMode | Integer |
| `StorytellerStory` | Story Engine stories | Integer |
| `StorytellerMemory` | Story memory bank | Integer |
| `BrainDocument` | Knowledge base documents | Integer |
| `CharacterRelationship` | Character relationships | UUID |
| `SocialProfile` | Social media profiles | UUID |

## Validation

```bash
node -c src/models/ModelName.js   # Syntax check
npm run migrate                    # Run pending migrations
```
