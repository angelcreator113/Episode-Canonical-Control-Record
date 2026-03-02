const http = require('http');
http.get('http://localhost:3002/api/v1/memories/relationship-map', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    console.log('META:', JSON.stringify(d.meta, null, 2));
    console.log('\nNODES (' + d.nodes.length + '):');
    d.nodes.forEach(n => console.log('  ' + n.id + ' | ' + n.label + ' | ' + n.group));
    console.log('\nEDGES (' + d.edges.length + '):');
    d.edges.forEach(e => console.log('  ' + e.from + ' --> ' + e.to + ' | ' + (e.type || '?')));
  });
});
