const http = require('http');
http.get('http://localhost:3002/api/v1/character-generator/ecosystem', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    console.log('Total characters:', d.total_characters);
    console.log('\nBook 1:');
    console.log('  Stats:', JSON.stringify(d.book1.stats, null, 2));
    console.log('  Characters:', d.book1.characters.map(c => c.name).join(', '));
    console.log('\nLalaVerse:');
    console.log('  Stats:', JSON.stringify(d.lalaverse.stats, null, 2));
    console.log('  Characters:', d.lalaverse.characters.map(c => c.name).join(', '));
  });
});
