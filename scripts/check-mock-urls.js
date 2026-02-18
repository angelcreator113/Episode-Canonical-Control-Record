const {sequelize} = require('../src/models');
(async () => {
  // Check mock-s3 assets
  const [mockAssets] = await sequelize.query(
    `SELECT id, name, s3_url_raw, s3_url_processed, episode_id, show_id 
     FROM assets 
     WHERE (s3_url_raw LIKE '%mock-s3%' OR s3_url_processed LIKE '%mock-s3%') 
       AND deleted_at IS NULL 
     LIMIT 15`
  );
  console.log(`=== Assets with mock-s3.dev URLs: ${mockAssets.length} ===`);
  mockAssets.forEach(a => {
    console.log(`  ${a.name || '(no name)'}`);
    console.log(`    raw: ${a.s3_url_raw || 'NULL'}`);
    console.log(`    processed: ${a.s3_url_processed || 'NULL'}`);
    console.log(`    episode: ${a.episode_id || 'NULL'}  show: ${a.show_id || 'NULL'}`);
  });

  // Check distinct URL patterns
  const [patterns] = await sequelize.query(
    `SELECT DISTINCT SUBSTRING(s3_url_raw FROM '^https?://[^/]+') as domain, COUNT(*) as cnt 
     FROM assets 
     WHERE s3_url_raw IS NOT NULL AND deleted_at IS NULL 
     GROUP BY 1 ORDER BY cnt DESC`
  );
  console.log('\n=== URL domains in assets ===');
  patterns.forEach(p => console.log(`  ${p.domain || 'NULL'}: ${p.cnt}`));

  // Check if there's a real S3 bucket configured
  console.log('\n=== Env vars ===');
  console.log('  S3_BUCKET:', process.env.S3_BUCKET || 'not set');
  console.log('  AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET || 'not set');
  console.log('  S3_REGION:', process.env.S3_REGION || process.env.AWS_REGION || 'not set');

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
