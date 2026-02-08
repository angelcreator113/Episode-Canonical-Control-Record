const { Episode, UserDecision } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

async function seedForSpecificEpisode() {
  try {
    const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    
    console.log(`\nSeeding decisions for episode ${episodeId}...`);
    
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      console.error('❌ Episode not found');
      process.exit(1);
    }
    
    console.log(`✅ Found episode: ${episode.title}`);

    const decisionTypes = [
      { type: 'scene_duration', category: 'timing', options: ['5 seconds', '7 seconds', '10 seconds'] },
      { type: 'transition_type', category: 'editing', options: ['Fade', 'Cut', 'Dissolve', 'Wipe'] },
      { type: 'music_volume', category: 'audio', options: ['Quiet (20%)', 'Medium (50%)', 'Loud (80%)'] },
      { type: 'color_grading', category: 'visual', options: ['Warm', 'Cool', 'Neutral', 'Vibrant'] },
      { type: 'text_overlay_style', category: 'visual', options: ['Bold', 'Italic', 'Handwritten', 'Modern'] }
    ];

    const decisions = [];
    const now = new Date();

    for (let i = 0; i < 50; i++) {
      const decType = decisionTypes[Math.floor(Math.random() * decisionTypes.length)];
      const chosenOption = decType.options[Math.floor(Math.random() * decType.options.length)];
      const otherOptions = decType.options.filter(o => o !== chosenOption);
      const rejectedOptions = otherOptions.slice(0, Math.floor(Math.random() * otherOptions.length) + 1);

      const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      decisions.push({
        id: uuidv4(),
        created_by: '1',
        episode_id: episodeId,
        decision_type: decType.type,
        decision_category: decType.category,
        chosen_option: { value: chosenOption },
        rejected_options: rejectedOptions.map(o => ({ value: o })),
        context_data: {
          scene_number: Math.floor(Math.random() * 20) + 1,
          timestamp_ms: Math.floor(Math.random() * 180000)
        },
        was_ai_suggestion: Math.random() > 0.5,
        ai_confidence_score: Math.random() > 0.5 ? (Math.random() * 0.3 + 0.7).toFixed(2) : null,
        timestamp: timestamp,
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    await UserDecision.bulkCreate(decisions);

    console.log(`\n✅ Created ${decisions.length} sample decisions for episode "${episode.title}"`);
    console.log(`\nView episode decisions at: http://localhost:5174/episodes/${episodeId}`);
    console.log(`View global analytics at: http://localhost:5174/analytics/decisions`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedForSpecificEpisode();
