const {sequelize} = require('../src/models');
sequelize.query(
  "UPDATE assets SET deleted_at = NOW() WHERE s3_url_raw LIKE '%mock-s3%' AND deleted_at IS NULL"
).then(([, m]) => {
  console.log('Soft-deleted', m.rowCount, 'mock-s3 assets');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
