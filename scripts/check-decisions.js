const { Episode, UserDecision } = require('../src/models');

async function checkDecisions() {
  try {
    // Get all decisions
    const decisions = await UserDecision.findAll({
      limit: 10,
      attributes: ['id', 'episode_id', 'decision_type', 'decision_category'],
      order: [['created_at', 'DESC']]
    });

    console.log(`\nFound ${decisions.length} decisions in database:`);
    decisions.forEach(d => {
      console.log(`  Episode: ${d.episode_id}, Type: ${d.decision_type}, Category: ${d.decision_category}`);
    });

    // Get all episodes
    const episodes = await Episode.findAll({
      attributes: ['id', 'title', 'show_id'],
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    console.log(`\nRecent episodes:`);
    episodes.forEach(e => {
      console.log(`  ID: ${e.id}, Title: ${e.title}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDecisions();
