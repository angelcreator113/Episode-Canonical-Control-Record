/**
 * Clean fix for app.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Cleaning up app.js completely...\n');

const appJsPath = path.join(__dirname, 'deploy-package', 'backend', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Remove all broken template-related code blocks
content = content.replace(/try\s*{\s*templateRoutes[\s\S]*?\/\/ Scene routes/m, 
`try {
  templateRoutes = require('./routes/templates');
  console.log('✓ Templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load templates routes:', e.message);
  templateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Thumbnail template routes (separate from episode templates)
let thumbnailTemplateRoutes;
try {
  thumbnailTemplateRoutes = require('./routes/thumbnailTemplates');
  console.log('✓ Thumbnail templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load thumbnail templates routes:', e.message);
  thumbnailTemplateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Scene routes`);

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ Cleaned template routes section');

// Now add mount if missing
if (!content.includes("app.use('/api/v1/thumbnail-templates'")) {
  content = fs.readFileSync(appJsPath, 'utf8');
  content = content.replace(
    /app\.use\('\/api\/v1\/templates',\s*templateRoutes\);/,
    `app.use('/api/v1/templates', templateRoutes);\napp.use('/api/v1/thumbnail-templates', thumbnailTemplateRoutes);`
  );
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log('✅ Added thumbnail templates mount point');
}

console.log('\n🎉 app.js cleaned and fixed!\n');
