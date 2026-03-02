const { Client } = require('pg');
const c = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432, database: 'episode_metadata', user: 'postgres',
  password: 'Ayanna123!!', ssl: { rejectUnauthorized: false }
});
c.connect().then(async () => {
  const r = await c.query("SELECT rc.character_key, rc.display_name, rc.role_type, rc.description, rc.relationships_map, cr.book_tag FROM registry_characters rc JOIN character_registries cr ON cr.id = rc.registry_id WHERE rc.deleted_at IS NULL ORDER BY cr.book_tag, rc.display_name");
  for (const row of r.rows) {
    const relCount = Array.isArray(row.relationships_map) ? row.relationships_map.length : 0;
    console.log('[' + row.book_tag + '] ' + row.display_name + ' (' + row.character_key + ') role=' + row.role_type + ' rels=' + relCount);
    if (relCount > 0) {
      row.relationships_map.forEach(rel => {
        console.log('    -> ' + rel.target + ' type=' + rel.type + ' dir=' + rel.direction + ' str=' + rel.strength);
      });
    }
  }
  await c.end();
});
