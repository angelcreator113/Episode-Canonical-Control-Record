# Quick Start Guide - Role-Based Asset System

## For Content Creators

### Uploading Assets

1. **Go to Asset Manager**
2. **Select Category**: Background, Lala, Guest, Wardrobe, etc.
3. **Choose Asset Type**: Promo, Video, Image, etc.
4. **Enter Asset Role** (NEW!):
   - Format: `CATEGORY.ROLE.VARIANT`
   - Examples:
     - LaLa primary pose: `CHAR.HOST.PRIMARY`
     - Guest reaction: `GUEST.REACTION.1`
     - Background: `BG.MAIN`
     - Wardrobe item: `WARDROBE.ITEM.1`
     - Episode title: `TEXT.TITLE.PRIMARY`

### Role Naming Guide

| Asset Type | Role Format | Example |
|------------|-------------|---------|
| LaLa Character | `CHAR.HOST.{variant}` | `CHAR.HOST.PRIMARY` |
| Background | `BG.{purpose}` | `BG.MAIN`, `BG.PATTERN` |
| Guest | `GUEST.{purpose}.{number}` | `GUEST.REACTION.1` |
| Wardrobe | `WARDROBE.ITEM.{number}` | `WARDROBE.ITEM.3` |
| Title Text | `TEXT.TITLE.{variant}` | `TEXT.TITLE.PRIMARY` |
| Brand Logo | `BRAND.LOGO.{variant}` | `BRAND.LOGO.PRIMARY` |
| UI Element | `UI.{purpose}.{variant}` | `UI.BUTTON.PLAY` |
| Icon | `ICON.{purpose}.{variant}` | `ICON.SOCIAL.YOUTUBE` |

### Creating Thumbnails

1. **Select Episode**
2. **Choose Template**: "Styling Adventures v1" or custom
3. **Fill Required Roles** (marked with *):
   - Background
   - LaLa Character
   - Episode Title
4. **Fill Optional Roles** (thumbnails work without these):
   - Guest reactions
   - Wardrobe items (up to 8)
   - Brand logo
5. **Select Formats**: YouTube, Instagram, Facebook, etc.
6. **Generate**

### Asset Scope

When uploading, assets can have different scopes:

- **GLOBAL**: Available everywhere (LaLa primary poses, main backgrounds)
- **SHOW**: Available for all episodes in a show
- **EPISODE**: Available only for specific episodes (guests, episode-specific wardrobe)

## For Developers

### Basic Service Usage

#### Get Eligible Assets for a Role
```javascript
const AssetRoleService = require('./services/AssetRoleService');

const assets = await AssetRoleService.getEligibleAssets(
  'CHAR.HOST.PRIMARY',
  {
    episodeId: 'episode-uuid',
    showId: 'show-uuid',
    includeGlobal: true
  }
);
```

#### Check if Asset Can Be Used
```javascript
const result = await AssetRoleService.canAssetBeUsedFor(
  'asset-uuid',
  'GUEST.REACTION.1',
  { episodeId: 'episode-uuid' }
);

if (result.eligible) {
  // Use the asset
} else {
  console.log(result.reason); // Why it can't be used
}
```

#### Get Active Templates
```javascript
const ThumbnailTemplateService = require('./services/ThumbnailTemplateService');

const templates = await ThumbnailTemplateService.getActiveForShow('show-uuid');
```

#### Generate Thumbnails
```javascript
const ThumbnailGeneratorService = require('./services/ThumbnailGeneratorServiceEnhanced');

const result = await ThumbnailGeneratorService.generateForComposition(
  'composition-uuid',
  ['YOUTUBE', 'INSTAGRAM_FEED']
);

console.log(result.generatedFormats); // { YOUTUBE: 's3-url', INSTAGRAM_FEED: 's3-url' }
console.log(result.errors); // Any errors
console.log(result.warnings); // Optional assets missing
```

### Creating a Custom Template

```javascript
const template = await ThumbnailTemplateService.create({
  template_name: 'My Custom Template',
  template_version: '1.0',
  show_id: 'show-uuid', // or null for global
  required_roles: [
    'BG.MAIN',
    'CHAR.HOST.PRIMARY'
  ],
  optional_roles: [
    'GUEST.REACTION.1',
    'WARDROBE.ITEM.1'
  ],
  layout_config: {
    baseWidth: 1920,
    baseHeight: 1080,
    layers: {
      'BG.MAIN': { 
        x: 0, 
        y: 0, 
        width: 1920, 
        height: 1080, 
        zIndex: 0 
      },
      'CHAR.HOST.PRIMARY': { 
        x: 200, 
        y: 200, 
        width: 800, 
        height: 800, 
        zIndex: 10 
      }
    }
  },
  format_overrides: {
    'INSTAGRAM_FEED': {
      baseWidth: 1080,
      baseHeight: 1080,
      layers: {
        'CHAR.HOST.PRIMARY': { 
          x: 140, 
          y: 140, 
          width: 800, 
          height: 800, 
          zIndex: 10 
        }
      }
    }
  }
});
```

### API Endpoints (To Implement)

```javascript
// Get eligible assets for a role
GET /api/v1/assets/eligible?role=CHAR.HOST.PRIMARY&episodeId=xxx&showId=xxx

// Get all templates for a show
GET /api/v1/templates?showId=xxx

// Create new template
POST /api/v1/templates
Body: { template_name, template_version, required_roles, ... }

// Get template details
GET /api/v1/templates/:templateId

// Update template
PATCH /api/v1/templates/:templateId
Body: { is_active: false }

// Create composition
POST /api/v1/compositions
Body: {
  episode_id,
  template_id,
  asset_roles: [
    { asset_role: 'BG.MAIN', asset_id: 'xxx' },
    { asset_role: 'CHAR.HOST.PRIMARY', asset_id: 'yyy' }
  ]
}

// Generate thumbnails
POST /api/v1/compositions/:compositionId/generate
Body: { formats: ['YOUTUBE', 'INSTAGRAM_FEED'] }

// Get generation status
GET /api/v1/compositions/:compositionId/status

// Regenerate thumbnails
POST /api/v1/compositions/:compositionId/regenerate
```

### Frontend Component Usage

```jsx
import AssetRolePicker from '../components/AssetRolePicker';

function ThumbnailComposer() {
  const [selectedAssets, setSelectedAssets] = useState({});

  return (
    <div>
      <AssetRolePicker
        role="CHAR.HOST.PRIMARY"
        episodeId={episodeId}
        showId={showId}
        selectedAssetId={selectedAssets['CHAR.HOST.PRIMARY']}
        onChange={(assetId) => {
          setSelectedAssets({
            ...selectedAssets,
            'CHAR.HOST.PRIMARY': assetId
          });
        }}
        required={true}
      />
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Upload Asset with Role
```javascript
// Frontend form submission
const formData = new FormData();
formData.append('file', file);
formData.append('asset_type', 'PROMO_LALA');
formData.append('asset_role', 'CHAR.HOST.PRIMARY');
formData.append('asset_scope', 'GLOBAL');

await axios.post('/api/v1/assets/upload', formData);
```

### Pattern 2: Create Composition from Template
```javascript
// 1. Get template
const template = await ThumbnailTemplateService.getById(templateId);

// 2. Get eligible assets for each role
const assetSelections = {};
for (const role of template.required_roles) {
  const assets = await AssetRoleService.getEligibleAssets(role, context);
  assetSelections[role] = assets[0]?.asset_id; // Pick first
}

// 3. Validate
const validation = template.validateComposition(
  Object.entries(assetSelections).map(([role, assetId]) => ({
    asset_role: role,
    asset_id: assetId
  }))
);

if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  return;
}

// 4. Create composition
const composition = await ThumbnailComposition.create({
  episode_id: episodeId,
  template_id: templateId,
  template_version: template.template_version
});

// 5. Create composition assets
await CompositionAsset.setForComposition(
  composition.composition_id,
  Object.entries(assetSelections).map(([role, assetId], index) => ({
    asset_role: role,
    asset_id: assetId,
    layer_order: index * 10
  }))
);

// 6. Generate
await ThumbnailGeneratorService.generateForComposition(
  composition.composition_id,
  ['YOUTUBE', 'INSTAGRAM_FEED']
);
```

### Pattern 3: Update Asset Role
```javascript
// Update single asset
await AssetRoleService.updateAssetRole(
  'asset-uuid',
  'WARDROBE.ITEM.2'
);

// Update asset scope
await AssetRoleService.updateAssetScope(
  'asset-uuid',
  'SHOW',
  'show-uuid'
);
```

## Troubleshooting

### "Asset not eligible for role"
**Cause**: Asset's scope doesn't match the context
**Fix**: 
- Check asset's `asset_scope` (GLOBAL, SHOW, EPISODE)
- Ensure asset is linked to episode (for EPISODE scope)
- Verify show_id matches (for SHOW scope)

### "Missing required assets"
**Cause**: Required role not filled in composition
**Fix**: Add asset for each required role in template

### "Generation failed"
**Cause**: Asset URL inaccessible or Sharp processing error
**Fix**:
- Check S3 URLs are accessible
- Verify image format is supported (JPEG, PNG)
- Check Sharp logs for processing errors

### "Template not found"
**Cause**: Template inactive or deleted
**Fix**: Use `getActiveForShow()` to get active templates only

## Performance Tips

1. **Index Usage**: Indexes created on `asset_role`, `show_id`, `asset_scope`
2. **Caching**: Cache template layouts (they rarely change)
3. **Batch Generation**: Generate multiple formats in parallel
4. **Asset CDN**: Use CloudFront for faster asset downloads
5. **Lazy Loading**: Load assets on-demand in UI

## Migration from Legacy System

Old hardcoded columns are still present for backward compatibility:
- `lala_asset_id`
- `guest_asset_id`
- `justawomen_asset_id`
- `background_frame_asset_id`

These will be deprecated in future versions. New compositions use `composition_assets` junction table exclusively.

---

**Questions?** Check [ROLE_BASED_ASSET_SYSTEM_COMPLETE.md](ROLE_BASED_ASSET_SYSTEM_COMPLETE.md) for full documentation.
