// check-routes2.js: Count routes on storyteller router
process.env.DB_HOST = 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'Ayanna123!!';
process.env.DB_NAME = 'episode_metadata';
process.env.DB_SSL = 'true';

const r = require('./src/routes/storyteller');
const routes = r.stack.filter(x => x.route);
console.log('Total route handlers:', routes.length);
routes.forEach(x => {
  console.log(Object.keys(x.route.methods).join(',').toUpperCase(), x.route.path);
});
