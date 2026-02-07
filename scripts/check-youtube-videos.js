const { AITrainingData, sequelize } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const videos = await AITrainingData.findAll({
      where: { source_type: 'youtube' },
      order: [['created_at', 'DESC']],
      limit: 10
    });

    console.log(`📚 Found ${videos.length} YouTube training videos:\n`);

    if (videos.length === 0) {
      console.log('❌ No videos found. Try analyzing a YouTube video first!');
    } else {
      videos.forEach((v, idx) => {
        const data = v.toJSON();
        console.log(`${idx + 1}. ${data.video_title || 'Untitled'}`);
        console.log(`   ID: ${data.id}`);
        console.log(`   Video ID: ${data.video_id}`);
        console.log(`   Duration: ${data.duration_seconds}s`);
        console.log(`   Pacing: ${data.pacing_rhythm}`);
        console.log(`   Text Style: ${typeof data.text_style === 'object' ? JSON.stringify(data.text_style) : data.text_style}`);
        console.log(`   Created: ${data.created_at}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
