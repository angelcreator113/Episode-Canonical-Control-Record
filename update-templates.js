const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Updating templates with layout_config...');
    
    const youtubeConfig = {
      background: { x: 0, y: 0, width: 1920, height: 1080 },
      lala: { x: 50, y: 50, width: 400, height: 400 },
      guest: { x: 1470, y: 50, width: 400, height: 400 },
      text: { x: 500, y: 800, width: 900, height: 200 }
    };
    
    const instagramConfig = {
      background: { x: 0, y: 0, width: 1080, height: 1080 },
      lala: { x: 50, y: 50, width: 350, height: 350 },
      guest: { x: 680, y: 50, width: 350, height: 350 },
      text: { x: 50, y: 750, width: 980, height: 250 }
    };
    
    await sequelize.query(`
      UPDATE thumbnail_templates 
      SET layout_config = $1
      WHERE id = 'youtube-1920x1080'
    `, {
      bind: [JSON.stringify(youtubeConfig)],
      type: sequelize.QueryTypes.UPDATE
    });
    
    await sequelize.query(`
      UPDATE thumbnail_templates 
      SET layout_config = $1
      WHERE id = 'instagram-1080x1080'
    `, {
      bind: [JSON.stringify(instagramConfig)],
      type: sequelize.QueryTypes.UPDATE
    });
    
    console.log('✅ Templates updated with layout_config');
    process.exit(0);
  } catch(e) { 
    console.error('❌ Error:', e.message); 
    process.exit(1);
  }
})();
