const { Client } = require('pg');
async function main() {
  const client = new Client({
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    port: 5432, database: 'episode_metadata', user: 'postgres', password: 'Ayanna123!!',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  // List all registries
  const regs = await client.query(`SELECT id, title, book_tag, description, created_at FROM character_registries WHERE deleted_at IS NULL ORDER BY created_at`);
  console.log('=== REGISTRIES ===');
  for (const r of regs.rows) {
    console.log(`  ${r.id} | ${r.title} | tag: ${r.book_tag} | created: ${r.created_at}`);
  }

  // Count characters per registry
  for (const r of regs.rows) {
    const chars = await client.query(`SELECT id, display_name, selected_name, role_type, status, created_at FROM registry_characters WHERE registry_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [r.id]);
    console.log(`\n=== Characters in "${r.title}" (${r.id}) — ${chars.rows.length} total ===`);
    for (const c of chars.rows) {
      console.log(`  ${c.display_name || c.selected_name} | role: ${c.role_type} | status: ${c.status} | created: ${c.created_at}`);
    }
  }

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
