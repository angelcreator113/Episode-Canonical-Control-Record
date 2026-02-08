const { UserDecision } = require('../src/models');

async function countDecisions() {
  try {
    const lalaId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    
    const count = await UserDecision.count({
      where: { episode_id: lalaId }
    });

    console.log(`\nTotal decisions for Lala episode: ${count}`);

    if (count > 0) {
      const decisions = await UserDecision.findAll({
        where: { episode_id: lalaId },
        attributes: ['id', 'decision_type', 'decision_category', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      console.log('\nSample decisions:');
      decisions.forEach(d => {
        console.log(`  ${d.decision_type} (${d.decision_category}) - ${d.created_at}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

countDecisions();
