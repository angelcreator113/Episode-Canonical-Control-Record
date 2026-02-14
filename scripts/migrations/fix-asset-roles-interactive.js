const { sequelize } = require('./src/models');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

// Available roles for thumbnail composer
const AVAILABLE_ROLES = {
  '1': { role: 'CHAR.HOST.LALA', label: 'Lala (Host) - Main character' },
  '2': { role: 'BG.MAIN', label: 'Background - Main background image' },
  '3': { role: 'CHAR.GUEST.1', label: 'Guest 1 - First guest character' },
  '4': { role: 'CHAR.GUEST.2', label: 'Guest 2 - Second guest character' },
  '5': { role: 'UI.ICON.CLOSET', label: 'Icon: Closet' },
  '6': { role: 'UI.ICON.JEWELRY_BOX', label: 'Icon: Jewelry Box' },
  '7': { role: 'UI.ICON.TODO_LIST', label: 'Icon: To-Do List' },
  '8': { role: 'UI.ICON.SPEECH', label: 'Icon: Speech' },
  '9': { role: 'UI.ICON.LOCATION', label: 'Icon: Location' },
  '10': { role: 'UI.ICON.PERFUME', label: 'Icon: Perfume' },
  '11': { role: 'UI.ICON.POSE', label: 'Icon: Pose' },
  '12': { role: 'UI.ICON.RESERVED', label: 'Icon: Reserved' },
  '13': { role: 'UI.ICON.HOLDER.MAIN', label: 'Icon Holder - Background for icons' },
  's': { role: 'SKIP', label: 'Skip this asset (keep current role)' },
  'd': { role: 'DELETE', label: 'Mark for deletion' }
};

(async () => {
  try {
    console.log('🔧 Asset Role Reassignment Tool\n');
    console.log('This will help you reassign roles to assets currently marked as CHAR.HOST.LALA\n');
    
    // Get assets with wrong role
    const [assets] = await sequelize.query(`
      SELECT 
        id,
        name,
        asset_type,
        asset_role,
        s3_url_raw,
        created_at
      FROM assets
      WHERE asset_role = 'CHAR.HOST.LALA'
      ORDER BY created_at DESC
    `);
    
    if (assets.length === 0) {
      console.log('✅ No assets need reassignment!');
      process.exit(0);
    }
    
    console.log(`Found ${assets.length} assets with role "CHAR.HOST.LALA"\n`);
    
    const mode = await question('Choose mode:\n  1) Interactive - Review each asset one by one\n  2) Bulk - Apply same role to multiple assets\n  3) Auto - Reassign based on asset_type\n  4) Cancel\nEnter choice (1-4): ');
    
    if (mode === '4') {
      console.log('❌ Cancelled');
      rl.close();
      process.exit(0);
    }
    
    if (mode === '3') {
      // Auto mode - reassign based on asset_type
      console.log('\n🤖 AUTO MODE: Reassigning based on asset_type...\n');
      
      const updates = [];
      for (const asset of assets) {
        let newRole = 'CHAR.HOST.LALA'; // default, keep as is
        
        // Smart defaults based on asset_type
        if (asset.asset_type === 'BACKGROUND_IMAGE' || asset.asset_type === 'BACKGROUND_VIDEO') {
          newRole = 'BG.MAIN';
        } else if (asset.asset_type === 'PROMO_GUEST') {
          newRole = 'CHAR.GUEST.1';
        } else if (asset.asset_type === 'PROMO_LALA') {
          // Keep as CHAR.HOST.LALA (already correct)
          newRole = 'CHAR.HOST.LALA';
        }
        
        if (newRole !== asset.asset_role) {
          updates.push({ id: asset.id, name: asset.name, oldRole: asset.asset_role, newRole });
        }
      }
      
      if (updates.length === 0) {
        console.log('✅ All assets already have appropriate roles based on type!');
      } else {
        console.log(`\n📝 Proposed changes (${updates.length} assets):\n`);
        updates.forEach((u, idx) => {
          console.log(`  ${idx + 1}. ${u.name}`);
          console.log(`     ${u.oldRole} → ${u.newRole}`);
        });
        
        const confirm = await question('\nApply these changes? (yes/no): ');
        if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
          for (const update of updates) {
            await sequelize.query(
              `UPDATE assets SET asset_role = :newRole WHERE id = :id`,
              { replacements: { newRole: update.newRole, id: update.id } }
            );
            console.log(`✅ Updated: ${update.name} → ${update.newRole}`);
          }
          console.log(`\n✅ Successfully updated ${updates.length} assets!`);
        } else {
          console.log('❌ Cancelled');
        }
      }
      
    } else if (mode === '2') {
      // Bulk mode
      console.log('\n📦 BULK MODE\n');
      console.log('Available roles:');
      Object.entries(AVAILABLE_ROLES).forEach(([key, value]) => {
        if (key !== 's' && key !== 'd') {
          console.log(`  ${key}) ${value.label}`);
        }
      });
      
      const roleChoice = await question('\nSelect role to apply to all assets (1-13): ');
      const selectedRole = AVAILABLE_ROLES[roleChoice];
      
      if (!selectedRole || selectedRole.role === 'SKIP' || selectedRole.role === 'DELETE') {
        console.log('❌ Invalid choice');
        rl.close();
        process.exit(1);
      }
      
      console.log(`\n📝 Will update ${assets.length} assets to role: ${selectedRole.role}\n`);
      const confirm = await question('Confirm? (yes/no): ');
      
      if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
        for (const asset of assets) {
          await sequelize.query(
            `UPDATE assets SET asset_role = :newRole WHERE id = :id`,
            { replacements: { newRole: selectedRole.role, id: asset.id } }
          );
          console.log(`✅ Updated: ${asset.name}`);
        }
        console.log(`\n✅ Successfully updated ${assets.length} assets!`);
      } else {
        console.log('❌ Cancelled');
      }
      
    } else if (mode === '1') {
      // Interactive mode
      console.log('\n🎯 INTERACTIVE MODE\n');
      console.log('Review each asset and choose the correct role.\n');
      
      let updatedCount = 0;
      let markedForDeletion = [];
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        console.log('\n' + '='.repeat(70));
        console.log(`Asset ${i + 1} of ${assets.length}`);
        console.log('='.repeat(70));
        console.log(`Name: ${asset.name}`);
        console.log(`Type: ${asset.asset_type}`);
        console.log(`Current Role: ${asset.asset_role}`);
        console.log(`Created: ${new Date(asset.created_at).toLocaleString()}`);
        console.log(`URL: ${asset.s3_url_raw}`);
        console.log('');
        
        console.log('Choose new role:');
        Object.entries(AVAILABLE_ROLES).forEach(([key, value]) => {
          console.log(`  ${key}) ${value.label}`);
        });
        
        const choice = await question('\nEnter choice: ');
        const selectedRole = AVAILABLE_ROLES[choice];
        
        if (!selectedRole) {
          console.log('⚠️  Invalid choice, skipping...');
          continue;
        }
        
        if (selectedRole.role === 'SKIP') {
          console.log('⏭️  Skipped');
          continue;
        }
        
        if (selectedRole.role === 'DELETE') {
          markedForDeletion.push(asset);
          console.log('🗑️  Marked for deletion');
          continue;
        }
        
        // Update the asset
        await sequelize.query(
          `UPDATE assets SET asset_role = :newRole WHERE id = :id`,
          { replacements: { newRole: selectedRole.role, id: asset.id } }
        );
        console.log(`✅ Updated to: ${selectedRole.role}`);
        updatedCount++;
      }
      
      console.log('\n' + '='.repeat(70));
      console.log('📊 SUMMARY');
      console.log('='.repeat(70));
      console.log(`✅ Updated: ${updatedCount} assets`);
      console.log(`⏭️  Skipped: ${assets.length - updatedCount - markedForDeletion.length} assets`);
      console.log(`🗑️  Marked for deletion: ${markedForDeletion.length} assets`);
      
      if (markedForDeletion.length > 0) {
        console.log('\n⚠️  Assets marked for deletion:');
        markedForDeletion.forEach(a => console.log(`  - ${a.name}`));
        const confirmDelete = await question('\nDelete these assets? (yes/no): ');
        if (confirmDelete.toLowerCase() === 'yes' || confirmDelete.toLowerCase() === 'y') {
          for (const asset of markedForDeletion) {
            await sequelize.query(
              `DELETE FROM assets WHERE id = :id`,
              { replacements: { id: asset.id } }
            );
            console.log(`🗑️  Deleted: ${asset.name}`);
          }
        }
      }
    }
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    rl.close();
    process.exit(1);
  }
})();
