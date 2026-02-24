// patch-models-index.js: Add StorytellerEcho to the server's models/index.js
const fs = require('fs');
const path = '/home/ubuntu/episode-metadata/src/models/index.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add declaration after StorytellerMemory declaration
content = content.replace(
  'let StorytellerMemory; // StoryTeller Memory Bank model',
  'let StorytellerMemory; // StoryTeller Memory Bank model\nlet StorytellerEcho; // Decision Echo model'
);

// 2. Add require after StorytellerMemory require
content = content.replace(
  "StorytellerMemory = require('./StorytellerMemory')(sequelize);",
  "StorytellerMemory = require('./StorytellerMemory')(sequelize);\n  StorytellerEcho = require('./StorytellerEcho')(sequelize);"
);

// 3. Add to requiredModels after StorytellerMemory
content = content.replace(
  /(\s+StorytellerMemory,\n)/,
  '$1  StorytellerEcho,\n'
);

// 4. Add associate call after StorytellerMemory associate
content = content.replace(
  /if \(StorytellerMemory && StorytellerMemory\.associate\) \{\n\s+StorytellerMemory\.associate\(requiredModels\);\n\}/,
  `if (StorytellerMemory && StorytellerMemory.associate) {\n  StorytellerMemory.associate(requiredModels);\n}\nif (StorytellerEcho && StorytellerEcho.associate) {\n  StorytellerEcho.associate(requiredModels);\n}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched models/index.js successfully');

// Verify
const patched = fs.readFileSync(path, 'utf8');
if (patched.includes('StorytellerEcho')) {
  console.log('✓ StorytellerEcho found in patched file');
} else {
  console.error('✗ StorytellerEcho NOT found!');
}
