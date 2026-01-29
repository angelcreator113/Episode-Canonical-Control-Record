/**
 * Populate composition_assets for testing ThumbnailComposer
 */

const { sequelize, Episode, Asset, ThumbnailComposition, CompositionAsset } = require('./src/models');

async function populateAssets() {
  try {
    console.log('🔍 Finding composition...');
    
    const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    const compositionId = 'f0b20fff-2c73-43cc-bf8e-c30e2dd06500';
    
    const composition = await ThumbnailComposition.findByPk(compositionId, {
      include: [
        { model: Episode, as: 'episode' },
        { 
          model: CompositionAsset, 
          as: 'compositionAssets',
          include: [{ model: Asset, as: 'asset' }]
        }
      ]
    });
    
    if (!composition) {
      console.log('❌ Composition not found');
      return;
    }
    
    console.log(`✅ Found composition for: ${composition.episode.title}`);
    console.log(`📦 Current assets: ${composition.compositionAssets?.length || 0}`);
    
    // Find available assets for this episode
    console.log('\n🔍 Finding available assets...');
    const assets = await Asset.findAll({
      where: { episode_id: episodeId },
      limit: 10
    });
    
    console.log(`\n📦 Available Assets (${assets.length}):`);
    assets.forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.id} - ${asset.name || asset.file_name} - Type: ${asset.asset_type} - Role: ${asset.role || 'NONE'}`);
    });
    
    // Auto-assign assets based on their roles or names
    const roleMappings = [
      { role: 'CHAR.HOST.LALA', keywords: ['lala', 'host'] },
      { role: 'CHAR.GUEST.1', keywords: ['guest', 'justawoman'] },
      { role: 'BG.MAIN', keywords: ['background', 'bg'] },
      { role: 'UI.ICON.CLOSET', keywords: ['closet', 'wardrobe'] },
      { role: 'BRAND.SHOW.TITLE_GRAPHIC', keywords: ['logo', 'title'] }
    ];
    
    console.log('\n🎯 Auto-assigning assets to roles...');
    
    // Smart mapping based on asset_type
    const typeToRoleMap = {
      'PROMO_LALA': 'CHAR.HOST.LALA',
      'PROMO_JUSTAWOMANINHERPRIME': 'CHAR.HOST.JUSTAWOMANINHERPRIME',
      'PROMO_GUEST': 'CHAR.GUEST.1',
      'BACKGROUND_IMAGE': 'BG.MAIN',
      'BRAND_LOGO': 'BRAND.SHOW.TITLE_GRAPHIC'
    };
    
    for (const asset of assets) {
      const targetRole = typeToRoleMap[asset.asset_type];
      
      if (targetRole) {
        // Check if already assigned
        const existing = await CompositionAsset.findOne({
          where: {
            composition_id: compositionId,
            asset_role: targetRole
          }
        });
        
        if (!existing) {
          await CompositionAsset.create({
            composition_id: compositionId,
            asset_id: asset.id,
            asset_role: targetRole,
            order_index: 0
          });
          console.log(`✅ Assigned ${asset.name || asset.file_name} (${asset.asset_type}) to ${targetRole}`);
        } else {
          // Update if exists but with NULL role
          if (!existing.asset_role) {
            await existing.update({ asset_role: targetRole });
            console.log(`✅ Updated ${asset.name || asset.file_name} to ${targetRole}`);
          } else {
            console.log(`⏭️ ${targetRole} already assigned to ${existing.asset_id}`);
          }
        }
      }
    }
    
    // Reload composition with assets
    await composition.reload({
      include: [
        { 
          model: CompositionAsset, 
          as: 'compositionAssets',
          include: [{ model: Asset, as: 'asset' }]
        }
      ]
    });
    
    console.log(`\n✅ Final asset count: ${composition.compositionAssets?.length || 0}`);
    
    if (composition.compositionAssets?.length > 0) {
      console.log('\n📋 Assigned Assets:');
      composition.compositionAssets.forEach(ca => {
        console.log(`  • ${ca.asset_role}: ${ca.asset?.name || ca.asset?.file_name}`);
      });
    }
    
    console.log(`\n🚀 Test URL: http://localhost:5175/composer/${episodeId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

populateAssets();
