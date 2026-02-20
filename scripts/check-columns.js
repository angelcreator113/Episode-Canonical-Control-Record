const path = require('path');
const { sequelize } = require(path.join(process.env.HOME || '/home/ubuntu', 'episode-metadata', 'src', 'models'));
sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='episodes' ORDER BY ordinal_position")
  .then(([rows]) => {
    rows.forEach(r => console.log(r.column_name));
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
