/**
 * Comprehensive test of the complete role-based thumbnail composition flow
 * Tests: Show → Episode → Template → Eligible Assets → Composition Creation
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3002/api/v1';

// Test utilities
function logSuccess(message) {
  console.log('✅', message);
}

function logError(message, error) {
  console.error('❌', message);
  if (error.response) {
    console.error('   Status:', error.response.status);
    console.error('   Data:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('   Error:', error.message);
  }
}

function logInfo(message) {
  console.log('ℹ️ ', message);
}

function logStep(step) {
  console.log('\n' + '='.repeat(70));
  console.log(`STEP ${step}`);
  console.log('='.repeat(70));
}

// Main test function
async function testCompleteFlow() {
  console.log('\n🧪 TESTING COMPLETE ROLE-BASED THUMBNAIL COMPOSITION FLOW\n');

  let selectedShow = null;
  let selectedEpisode = null;
  let selectedTemplate = null;
  let eligibleAssets = {};
  let createdComposition = null;

  try {
    // ========================================================================
    // STEP 1: Get Shows
    // ========================================================================
    logStep('1: GET SHOWS');
    const showsResponse = await axios.get(`${BASE_URL}/shows`, {
      params: { includeEpisodeCounts: true }
    });
    
    if (showsResponse.data.data && showsResponse.data.data.length > 0) {
      logSuccess(`Found ${showsResponse.data.data.length} shows`);
      selectedShow = showsResponse.data.data[0]; // Select first show
      logInfo(`Selected Show: "${selectedShow.name}" (ID: ${selectedShow.id})`);
      logInfo(`   Episodes: ${selectedShow.episode_count || 'unknown'}`);
    } else {
      logError('No shows found', new Error('Empty shows array'));
      return;
    }

    // ========================================================================
    // STEP 2: Get Episodes for Selected Show
    // ========================================================================
    logStep('2: GET EPISODES FOR SHOW');
    const episodesResponse = await axios.get(`${BASE_URL}/episodes`, {
      params: { showId: selectedShow.id }
    });

    if (episodesResponse.data.data && episodesResponse.data.data.length > 0) {
      logSuccess(`Found ${episodesResponse.data.data.length} episodes for show "${selectedShow.name}"`);
      selectedEpisode = episodesResponse.data.data[0]; // Select first episode
      logInfo(`Selected Episode: "${selectedEpisode.title}" (ID: ${selectedEpisode.id})`);
      logInfo(`   Season ${selectedEpisode.season_number || 'N/A'}, Episode ${selectedEpisode.episode_number || 'N/A'}`);
    } else {
      logError('No episodes found for show', new Error('Empty episodes array'));
      return;
    }

    // ========================================================================
    // STEP 3: Get Templates for Show
    // ========================================================================
    logStep('3: GET THUMBNAIL TEMPLATES');
    const templatesResponse = await axios.get(`${BASE_URL}/thumbnail-templates`, {
      params: { showId: selectedShow.id }
    });

    console.log('DEBUG: templatesResponse.data:', JSON.stringify(templatesResponse.data, null, 2));

    if (templatesResponse.data.data && templatesResponse.data.data.length > 0) {
      logSuccess(`Found ${templatesResponse.data.data.length} templates`);
      selectedTemplate = templatesResponse.data.data[0]; // Select first template
      logInfo(`Selected Template: "${selectedTemplate.name}" (ID: ${selectedTemplate.id})`);
      logInfo(`   Required Roles: ${selectedTemplate.required_roles.length}`);
      logInfo(`   Optional Roles: ${selectedTemplate.optional_roles.length}`);
      
      // Show required roles
      console.log('\n   📋 Required Roles:');
      selectedTemplate.required_roles.forEach(role => {
        console.log(`      • ${role}`);
      });
    } else {
      logError('No templates found', new Error('Empty templates array'));
      return;
    }

    // ========================================================================
    // STEP 4: Get Eligible Assets for Each Required Role
    // ========================================================================
    logStep('4: GET ELIGIBLE ASSETS FOR REQUIRED ROLES');
    
    const assetSelections = {}; // Will store {role: assetId}
    
    for (const role of selectedTemplate.required_roles) {
      console.log(`\n🔍 Fetching assets for role: ${role}`);
      
      try {
        const assetsResponse = await axios.get(`${BASE_URL}/assets/eligible`, {
          params: {
            role: role,
            showId: selectedShow.id,
            episodeId: selectedEpisode.id,
            approvalStatus: 'APPROVED'
          }
        });

        if (assetsResponse.data.data && assetsResponse.data.data.length > 0) {
          const assets = assetsResponse.data.data;
          logSuccess(`Found ${assets.length} eligible assets for role "${role}"`);
          
          // Show first 3 assets
          assets.slice(0, 3).forEach((asset, idx) => {
            console.log(`   ${idx + 1}. ${asset.name} [${asset.asset_scope}]`);
          });
          
          // Select first asset
          assetSelections[role] = assets[0].id;
          eligibleAssets[role] = assets;
          
          logInfo(`Auto-selected: "${assets[0].name}" (ID: ${assets[0].id})`);
        } else {
          logError(`No eligible assets found for role "${role}"`, new Error('Empty assets array'));
          console.log('   ⚠️  Continuing with other roles...\n');
        }
      } catch (error) {
        logError(`Failed to fetch assets for role "${role}"`, error);
      }
    }

    // Check if we have all required assets
    const missingRoles = selectedTemplate.required_roles.filter(role => !assetSelections[role]);
    
    if (missingRoles.length > 0) {
      console.log('\n⚠️  WARNING: Missing assets for required roles:');
      missingRoles.forEach(role => console.log(`   • ${role}`));
      console.log('\n❌ Cannot proceed with composition creation without all required assets');
      console.log('💡 TIP: Create test assets with proper asset_role values:\n');
      
      missingRoles.forEach(role => {
        console.log(`   INSERT INTO assets (id, name, asset_role, asset_scope, show_id, approval_status, s3_url_processed)`);
        console.log(`   VALUES (gen_random_uuid(), 'Test Asset for ${role}', '${role}', 'SHOW', '${selectedShow.show_id}', 'APPROVED', 'https://test.com/asset.jpg');\n`);
      });
      
      return;
    }

    logSuccess(`✅ All ${selectedTemplate.required_roles.length} required roles have assets!`);

    // ========================================================================
    // STEP 5: Create Composition (Skip format selection for now)
    // ========================================================================
    logStep('5: CREATE COMPOSITION');
    
    const compositionPayload = {
      episode_id: selectedEpisode.id,
      template_id: selectedTemplate.id,
      assets: assetSelections,
      selected_formats: ['THUMBNAIL', 'YOUTUBE_THUMBNAIL'] // Default formats
    };

    console.log('\n📤 Sending composition payload:');
    console.log(JSON.stringify(compositionPayload, null, 2));

    const createResponse = await axios.post(`${BASE_URL}/compositions`, compositionPayload);

    if (createResponse.data.data) {
      createdComposition = createResponse.data.data;
      logSuccess(`Composition created successfully! (ID: ${createdComposition.id})`);
      console.log('\n📋 Composition Details:');
      console.log(`   Template: ${selectedTemplate.name}`);
      console.log(`   Episode: ${selectedEpisode.title}`);
      console.log(`   Show: ${selectedShow.name}`);
      console.log(`   Asset Mappings: ${Object.keys(assetSelections).length} roles`);
    } else {
      logError('Failed to create composition', new Error('API returned success: false'));
      return;
    }

    // ========================================================================
    // STEP 6: Verify Composition Was Saved with Assets
    // ========================================================================
    logStep('6: VERIFY COMPOSITION');
    
    const verifyResponse = await axios.get(`${BASE_URL}/compositions/${createdComposition.id}`);

    if (verifyResponse.data.data) {
      const composition = verifyResponse.data.data;
      logSuccess('Composition retrieved successfully!');
      
      console.log('\n📊 Composition Asset Mappings:');
      if (composition.compositionAssets && composition.compositionAssets.length > 0) {
        composition.compositionAssets.forEach(ca => {
          console.log(`   • ${ca.asset_role}: ${ca.asset ? ca.asset.name : 'N/A'} (${ca.asset_id})`);
        });
        logSuccess(`✅ Found ${composition.compositionAssets.length} composition_assets records!`);
      } else {
        logError('No composition assets found!', new Error('compositionAssets array is empty'));
      }
    } else {
      logError('Failed to retrieve composition', new Error('API returned success: false'));
    }

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n✅ All steps completed:');
    console.log(`   1. ✅ Shows API returned ${showsResponse.data.data.length} shows`);
    console.log(`   2. ✅ Episodes API returned ${episodesResponse.data.data.length} episodes`);
    console.log(`   3. ✅ Templates API returned ${templatesResponse.data.data.length} templates`);
    console.log(`   4. ✅ Assets/eligible API returned assets for ${Object.keys(eligibleAssets).length}/${selectedTemplate.required_roles.length} roles`);
    console.log(`   5. ✅ Composition created: ${createdComposition.id}`);
    console.log(`   6. ✅ Composition verified with ${verifyResponse.data.data.compositionAssets.length} asset mappings`);
    
    console.log('\n💡 Next Steps:');
    console.log('   • Open http://localhost:5173/ in browser');
    console.log('   • Navigate to Thumbnail Composer');
    console.log('   • Test the UI flow manually');
    console.log('   • Verify AssetRolePicker renders dynamically');
    console.log('   • Create a composition through the UI\n');

  } catch (error) {
    logError('Test failed', error);
    console.log('\n🔍 Debug Info:');
    console.log(`   Selected Show: ${selectedShow ? selectedShow.show_name : 'none'}`);
    console.log(`   Selected Episode: ${selectedEpisode ? selectedEpisode.episode_title : 'none'}`);
    console.log(`   Selected Template: ${selectedTemplate ? selectedTemplate.template_name : 'none'}`);
    console.log(`   Asset Selections: ${Object.keys(eligibleAssets).length} roles`);
  }
}

// Run the test
testCompleteFlow().catch(error => {
  console.error('💥 Unhandled error:', error.message);
  process.exit(1);
});
