const { Sequelize } = require('sequelize');
const s = new Sequelize('postgresql://localhost:5432/episode_metadata', { logging: false });
(async () => {
  const [r] = await s.query("SELECT id, angle_name, generation_status, substring(still_image_url,1,60) as img, deleted_at FROM scene_angles WHERE scene_set_id='1fda0e44-9620-4674-8d49-62de53e3d5e7' ORDER BY deleted_at DESC NULLS FIRST");
  console.log(JSON.stringify(r, null, 2));
  const [r2] = await s.query("SELECT count(*) as total FROM scene_angles WHERE scene_set_id='1fda0e44-9620-4674-8d49-62de53e3d5e7'");
  console.log('Total (including deleted):', r2[0].total);
  await s.close();
})();
