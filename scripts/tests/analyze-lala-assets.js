const { sequelize, Asset } = require('./src/models');

async function analyzeLalaAssets() {
  try {
    console.log('🔍 Analyzing LALA assets discrepancy\n');

    // Get all LALA assets (what Thumbnail Composer sees)
    const lalaAssets = await Asset.findAll({
      where: {
        asset_group: 'LALA'
      },
      attributes: ['id', 'name', 'asset_type', 'asset_scope', 'approval_status', 'show_id', 'episode_id', 'is_global'],
      order: [['created_at', 'DESC']],
    });

    console.log(`📊 Total LALA assets in database: ${lalaAssets.length}\n`);

    // Break down by approval status
    const byApproval = {};
    lalaAssets.forEach(asset => {
      const status = asset.approval_status || 'NULL';
      byApproval[status] = (byApproval[status] || 0) + 1;
    });

    console.log('📋 By Approval Status:');
    Object.entries(byApproval).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Break down by scope
    const byScope = {};
    lalaAssets.forEach(asset => {
      const scope = asset.asset_scope || 'NULL';
      byScope[scope] = (byScope[scope] || 0) + 1;
    });

    console.log('📋 By Asset Scope:');
    Object.entries(byScope).forEach(([scope, count]) => {
      console.log(`   ${scope}: ${count}`);
    });
    console.log();

    // Show approved vs pending
    const approved = lalaAssets.filter(a => a.approval_status === 'APPROVED');
    const pending = lalaAssets.filter(a => a.approval_status === 'PENDING');
    const rejected = lalaAssets.filter(a => a.approval_status === 'REJECTED');
    const noStatus = lalaAssets.filter(a => !a.approval_status);

    console.log('✅ APPROVED assets:', approved.length);
    console.log('⏳ PENDING assets:', pending.length);
    console.log('❌ REJECTED assets:', rejected.length);
    console.log('❓ No approval_status:', noStatus.length);
    console.log();

    // Sample of each type
    if (approved.length > 0) {
      console.log('✅ Sample APPROVED assets:');
      approved.slice(0, 3).forEach(a => {
        console.log(`   - ${a.name} (${a.asset_type}, scope: ${a.asset_scope || 'NULL'})`);
      });
      console.log();
    }

    if (pending.length > 0) {
      console.log('⏳ Sample PENDING assets:');
      pending.slice(0, 3).forEach(a => {
        console.log(`   - ${a.name} (${a.asset_type}, scope: ${a.asset_scope || 'NULL'})`);
      });
      console.log();
    }

    if (noStatus.length > 0) {
      console.log('❓ Sample assets WITHOUT approval_status:');
      noStatus.slice(0, 3).forEach(a => {
        console.log(`   - ${a.name} (${a.asset_type}, scope: ${a.asset_scope || 'NULL'})`);
      });
      console.log();
    }

    console.log('💡 DIAGNOSIS:');
    console.log('   If Assets tab only shows APPROVED assets:');
    console.log(`   Expected count: ${approved.length}`);
    console.log('   If Thumbnail Composer shows ALL assets:');
    console.log(`   Expected count: ${lalaAssets.length}`);
    console.log();
    console.log(`   Your Assets tab shows: 4 assets`);
    console.log(`   Your Thumbnail Composer shows: 26 assets`);
    console.log();

    if (approved.length === 4 && lalaAssets.length === 26) {
      console.log('✅ LIKELY CAUSE: Assets tab filters by approval_status=APPROVED');
      console.log('   Thumbnail Composer shows ALL assets regardless of approval.');
      console.log();
      console.log('🔧 SOLUTION: Thumbnail Composer should also filter by APPROVED.');
    } else {
      console.log('🤔 Numbers don\'t match expected pattern. More investigation needed.');
    }

    await sequelize.close();
    console.log('\n✅ Analysis complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeLalaAssets();
