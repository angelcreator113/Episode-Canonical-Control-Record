/**
 * Fix app.js - Clean insertion of thumbnail templates route
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Fixing app.js...\n');

const appJsPath = path.join(__dirname, 'deploy-package', 'backend', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Remove broken insertion
appJsContent = appJsContent.replace(/templateRoutes = \(req, res\) => res\.status\(500\)\.json\({ error: 'Routes not available' }\s*\/\/ Thumbnail template routes[\s\S]*?\);[\s\S]*?\}/m, 
  `templateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}`);

// Find correct insertion point (after templates try-catch block ends)
const correctPattern = /try\s*{\s*templateRoutes\s*=\s*require\('\.\/routes\/templates'\);[\s\S]*?\}\s*catch[\s\S]*?\}\s*\n/;
const match = appJsContent.match(correctPattern);

if (match) {
  const insertPos = match.index + match[0].length;
  const codeToInsert = `
// Thumbnail template routes (separate from episode templates)
let thumbnailTemplateRoutes;
try {
  thumbnailTemplateRoutes = require('./routes/thumbnailTemplates');
  console.log('✓ Thumbnail templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load thumbnail templates routes:', e.message);
  thumbnailTemplateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

`;
  
  appJsContent = appJsContent.slice(0, insertPos) + codeToInsert + appJsContent.slice(insertPos);
  console.log('✅ Fixed route loading code');
  
  // Add mount point
  if (!appJsContent.includes("app.use('/api/v1/thumbnail-templates'")) {
    const mountPattern = /app\.use\('\/api\/v1\/templates',\s*templateRoutes\);/;
    const mountMatch = appJsContent.match(mountPattern);
    
    if (mountMatch) {
      const mountPos = mountMatch.index + mountMatch[0].length;
      appJsContent = appJsContent.slice(0, mountPos) + 
        "\napp.use('/api/v1/thumbnail-templates', thumbnailTemplateRoutes);" +
        appJsContent.slice(mountPos);
      console.log('✅ Added route mount');
    }
  }
  
  fs.writeFileSync(appJsPath, appJsContent, 'utf8');
  console.log('✅ app.js fixed successfully!\n');
} else {
  console.error('❌ Could not find template routes block');
  process.exit(1);
}
