/**
 * Test role-based S3 folder path generation
 */

// Copy the function from AssetService.js
const getRoleBasedS3Folder = (assetRole, assetType, isProcessed = false) => {
  const suffix = isProcessed ? 'processed' : 'raw';

  // If role is provided, use it for semantic paths
  if (assetRole) {
    const parts = assetRole.split('.');
    const category = parts[0]?.toLowerCase(); // CHAR, UI, BG, BRAND, TEXT, WARDROBE
    const subcategory = parts[1]?.toLowerCase(); // HOST, ICON, etc.

    switch (category) {
      case 'char':
        return `characters/${subcategory || 'other'}/${suffix}`;
      case 'ui':
        const pluralMap = {
          icon: 'icons',
          button: 'buttons',
          mouse: 'mouse',
        };
        const uiFolder = pluralMap[subcategory] || subcategory || 'other';
        return `ui/${uiFolder}/${suffix}`;
      case 'bg':
        return `backgrounds/${subcategory || 'main'}/${suffix}`;
      case 'brand':
        return `branding/${subcategory || 'logo'}/${suffix}`;
      case 'text':
        return `text/${subcategory || 'other'}/${suffix}`;
      case 'wardrobe':
        const wardrobeFolder = subcategory === 'item' ? 'items' : 
                               subcategory === 'outfit' ? 'outfits' : 
                               subcategory || 'items';
        return `wardrobe/${wardrobeFolder}/${suffix}`;
      case 'guest':
        return `characters/guest/${suffix}`;
      default:
        return `assets/${category}/${suffix}`;
    }
  }

  // Fallback to legacy assetType-based paths
  const folderMap = {
    PROMO_LALA: 'promotional/lala',
    PROMO_JUSTAWOMANINHERPRIME: 'promotional/justawomaninherprime',
    PROMO_GUEST: 'promotional/guests',
    BRAND_LOGO: 'promotional/brands',
    EPISODE_FRAME: 'thumbnails/auto',
    BACKGROUND_IMAGE: 'backgrounds/images',
    PROMO_VIDEO: 'promotional/videos',
    EPISODE_VIDEO: 'episodes/videos',
    BACKGROUND_VIDEO: 'backgrounds/videos',
  };

  const baseFolder = folderMap[assetType] || 'assets/other';
  return `${baseFolder}/${suffix}`;
};

// Test cases
const testCases = [
  // Characters
  { role: 'CHAR.HOST.LALA', type: 'PROMO_LALA', expected: 'characters/host/raw' },
  { role: 'CHAR.HOST.JUSTAWOMANINHERPRIME', type: 'PROMO_JUSTAWOMANINHERPRIME', expected: 'characters/host/raw' },
  { role: 'CHAR.GUEST.1', type: 'PROMO_GUEST', expected: 'characters/guest/raw' },
  { role: 'CHAR.GUEST.2', type: 'PROMO_GUEST', expected: 'characters/guest/raw' },
  
  // UI Elements
  { role: 'UI.ICON.CLOSET', type: 'BRAND_LOGO', expected: 'ui/icons/raw' },
  { role: 'UI.ICON.JEWELRY_BOX', type: 'BRAND_LOGO', expected: 'ui/icons/raw' },
  { role: 'UI.BUTTON.EXIT', type: 'BRAND_LOGO', expected: 'ui/buttons/raw' },
  { role: 'UI.MOUSE.CURSOR', type: 'BRAND_LOGO', expected: 'ui/mouse/raw' },
  
  // Backgrounds
  { role: 'BG.MAIN', type: 'BACKGROUND_IMAGE', expected: 'backgrounds/main/raw' },
  { role: 'BG.PATTERN', type: 'BACKGROUND_IMAGE', expected: 'backgrounds/pattern/raw' },
  
  // Branding
  { role: 'BRAND.SHOW.TITLE_GRAPHIC', type: 'BRAND_LOGO', expected: 'branding/show/raw' },
  { role: 'BRAND.LOGO.PRIMARY', type: 'BRAND_LOGO', expected: 'branding/logo/raw' },
  
  // Text
  { role: 'TEXT.SHOW.TITLE', type: 'BRAND_LOGO', expected: 'text/show/raw' },
  { role: 'TEXT.EPISODE.SUBTITLE', type: 'BRAND_LOGO', expected: 'text/episode/raw' },
  
  // Wardrobe
  { role: 'WARDROBE.ITEM.1', type: 'BRAND_LOGO', expected: 'wardrobe/items/raw' },
  
  // Legacy fallback (no role provided)
  { role: null, type: 'PROMO_LALA', expected: 'promotional/lala/raw' },
  { role: null, type: 'BACKGROUND_VIDEO', expected: 'backgrounds/videos/raw' },
];

console.log('🧪 Testing role-based S3 folder generation\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ role, type, expected }) => {
  const result = getRoleBasedS3Folder(role, type, false);
  const isCorrect = result === expected;
  
  if (isCorrect) {
    passed++;
    console.log(`✅ ${role || `(type: ${type})`}`);
    console.log(`   → ${result}`);
  } else {
    failed++;
    console.log(`❌ ${role || `(type: ${type})`}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Got:      ${result}`);
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
