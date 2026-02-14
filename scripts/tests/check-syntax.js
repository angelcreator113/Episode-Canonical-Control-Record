const fs = require('fs');

const content = fs.readFileSync('src/services/youtubeService.js', 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);
console.log('\nChecking for issues...\n');

lines.forEach((line, i) => {
  const lineNum = i + 1;
  
  // Check for non-ASCII
  if (/[^\x00-\x7F]/.test(line)) {
    console.log(`Line ${lineNum}: Found non-ASCII character`);
    console.log(`  Content: ${line.substring(0, 50)}`);
  }
  
  // Check for null bytes
  if (line.includes('\0')) {
    console.log(`Line ${lineNum}: Found null byte`);
  }
  
  // Check line 543 specifically
  if (lineNum === 543) {
    console.log(`Line 543 (${line.length} chars):`);
    console.log(`  Content: "${line}"`);
    console.log(`  Bytes:`, Buffer.from(line).toString('hex'));
  }
});
