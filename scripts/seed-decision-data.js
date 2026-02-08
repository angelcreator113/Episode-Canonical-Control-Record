const { UserDecision, Episode } = require('../src/models');

async function seedDecisionData() {
  try {
    console.log('🌱 Seeding decision data...');

    // Find the first episode (your "Lala's Princess Fair Adventure" episode)
    const episode = await Episode.findOne({
      order: [['created_at', 'ASC']]
    });

    if (!episode) {
      console.log('❌ No episodes found! Create an episode first.');
      console.log('   Go to http://localhost:5174/episodes and create one.');
      process.exit(1);
    }

    console.log(`📺 Using episode: "${episode.title}" (${episode.id})`);

    // Decision templates
    const decisionTypes = [
      {
        type: 'scene_duration',
        category: 'timing',
        options: ['3_seconds', '5_seconds', '7_seconds', '10_seconds'],
        contexts: [
          { scene_type: 'intro', position: 'start' },
          { scene_type: 'main', position: 'middle' },
          { scene_type: 'outro', position: 'end' }
        ]
      },
      {
        type: 'transition_type',
        category: 'style',
        options: ['cut', 'fade', 'dissolve', 'wipe', 'slide'],
        contexts: [
          { from_scene: 'intro', to_scene: 'main' },
          { from_scene: 'main', to_scene: 'outro' }
        ]
      },
      {
        type: 'music_volume',
        category: 'audio',
        options: ['background', 'moderate', 'prominent', 'none'],
        contexts: [
          { scene_type: 'intro', mood: 'energetic' },
          { scene_type: 'main', mood: 'neutral' }
        ]
      },
      {
        type: 'text_overlay_style',
        category: 'content',
        options: ['bold', 'subtle', 'animated', 'none'],
        contexts: [
          { text_type: 'title', position: 'center' },
          { text_type: 'caption', position: 'bottom' }
        ]
      },
      {
        type: 'color_grading',
        category: 'style',
        options: ['warm', 'cool', 'neutral', 'vibrant', 'muted'],
        contexts: [
          { mood: 'happy', time_of_day: 'day' },
          { mood: 'dramatic', time_of_day: 'evening' }
        ]
      },
      {
        type: 'scene_linking',
        category: 'asset_selection',
        options: ['linked', 'unlinked', 'pending'],
        contexts: [
          { action: 'add_to_timeline', scene_id: 'scene_1' }
        ]
      }
    ];

    // Create 50 random decisions
    const decisions = [];
    const now = new Date();

    for (let i = 0; i < 50; i++) {
      const decisionType = decisionTypes[Math.floor(Math.random() * decisionTypes.length)];
      const chosenValue = decisionType.options[Math.floor(Math.random() * decisionType.options.length)];
      const context = decisionType.contexts[Math.floor(Math.random() * decisionType.contexts.length)];

      // Spread decisions over the last 7 days
      const createdAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      decisions.push({
        created_by: 'dev@example.com', // Your logged-in user
        episode_id: episode.id, // ← THIS IS CRITICAL!
        decision_type: decisionType.type,
        decision_category: decisionType.category,
        chosen_option: { value: chosenValue },
        rejected_options: decisionType.options
          .filter(o => o !== chosenValue)
          .map(o => ({ value: o })),
        context_data: context,
        was_ai_suggestion: Math.random() > 0.7, // 30% AI suggested
        ai_confidence_score: Math.random() * 0.5 + 0.5, // 0.5-1.0
        timestamp: createdAt,
        created_at: createdAt
      });
    }

    // Sort by date (oldest first)
    decisions.sort((a, b) => a.created_at - b.created_at);

    await UserDecision.bulkCreate(decisions);
    
    console.log(`✅ Created ${decisions.length} sample decisions`);
    console.log(`\n📊 View analytics:`);
    console.log(`   Episode-specific: http://localhost:5174/episodes/${episode.id}`);
    console.log(`                     (Click the "Decisions" tab)`);
    console.log(`   Global analytics: http://localhost:5174/analytics/decisions`);
    console.log(`\n💡 Both views should now show data!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedDecisionData();
