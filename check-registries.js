const http = require('http');
http.get('http://localhost:3002/api/v1/character-registry/registries', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const regs = j.registries || j;
    regs.forEach(r => {
      console.log(JSON.stringify({ id: r.id, title: r.title, book_tag: r.book_tag, status: r.status }));
    });
  });
});
