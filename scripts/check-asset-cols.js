const eco = require('./ecosystem.config.js');
const cfg = eco.apps[0].env;
const { Client } = require('pg');
const c = new Client({
  host: cfg.DB_HOST, port: cfg.DB_PORT, database: cfg.DB_NAME,
  user: cfg.DB_USER, password: cfg.DB_PASSWORD, ssl: { rejectUnauthorized: false }
});
c.connect().then(() => c.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='assets' ORDER BY ordinal_position"
)).then(r => {
  console.log(r.rows.map(x => x.column_name).join('\n'));
  c.end();
}).catch(e => { console.error(e.message); c.end(); });
