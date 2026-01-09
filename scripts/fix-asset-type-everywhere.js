const fs = require('fs');
const path = require('path');

console.log('🔍 Searching for asset type typos...\n');

const filesToCheck = [
  'src/routes/assets.js',
  'src/services/AssetService.js',
  'frontend/src/pages/AssetManager.jsx',
  'frontend/src/pages/ThumbnailComposer.jsx',
  'frontend/src/components/AssetLibrary.jsx',
];

let totalFixed = 0;

filesToCheck.forEach(relPath => {
  const fullPath = path.join(process.cwd(), relPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${relPath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  
  // Fix all variations of the typo
  const typos = [
    { pattern: /PROMO_JUSTAWOMANINPERPRIME/g, replace: 'PROMO_JUSTAWOMANINHERPRIME' },
    { pattern: /JUSTAWOMANINPERPRIME/g, replace: 'JUSTAWOMANINHERPRIME' },
    { pattern: /TANOMANINHERPRIME/g, replace: 'JUSTAWOMANINHERPRIME' },
    { pattern: /justawomaninperprime/g, replace: 'justawomaninherprime' },
  ];
  
  let fixCount = 0;
  typos.forEach(({ pattern, replace }) => {
    const matches = content.match(pattern);
    if (matches) {
      fixCount += matches.length;
      content = content.replace(pattern, replace);
    }
  });
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${relPath} (${fixCount} replacements)`);
    totalFixed += fixCount;
  } else {
    console.log(`✓  ${relPath} (already correct)`);
  }
});

console.log(`\n🎉 Total fixes: ${totalFixed}`);

if (totalFixed > 0) {
  console.log('\n⚡ Next steps:');
  console.log('  1. Restart backend: npm start');
  console.log('  2. Restart frontend: cd frontend && npm run dev');
  console.log('  3. Clear browser cache: Ctrl+Shift+R');
} else {
  console.log('\n✅ All files are already correct!');
}
