// Temp: check registered routes on storyteller router
const r = require('./src/routes/storyteller');
r.stack.filter(l => l.route).forEach(l => {
  console.log(JSON.stringify(l.route.methods), l.route.path);
});
console.log('Total routes:', r.stack.filter(l => l.route).length);
