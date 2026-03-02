const { Client } = require('pg');
(async () => {
  const c = new Client({
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    port: 5432, database: 'episode_metadata', user: 'postgres', password: 'Ayanna123!!',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  const r = await c.query(
    "UPDATE registry_characters SET status='accepted' WHERE registry_id='0ed07537-2cc0-45f9-9b11-bf0b9fd0031c' AND status='draft' AND deleted_at IS NULL RETURNING display_name, status"
  );
  console.log('Updated', r.rowCount, 'characters:');
  r.rows.forEach(x => console.log(' ', x.display_name, '->', x.status));
  await c.end();
})();
