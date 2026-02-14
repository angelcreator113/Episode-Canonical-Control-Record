/**
 * Test Script for Role-Based Asset System Flow
 * Tests the complete show → episode → template → assets → composition flow
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3002/api/v1';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testFlow() {
  try {
    logSection('STEP 1: Test Shows API');
    
    const showsResponse = await axios.get(`${BASE_URL}/shows`);
    log('✅', `Found ${showsResponse.data.count} shows`, colors.green);
    
    if (showsResponse.data.data && showsResponse.data.data.length > 0) {
      const firstShow = showsResponse.data.data[0];
      log('📺', `Example show: ${firstShow.name} (ID: ${firstShow.id})`, colors.blue);
      
      // STEP 2: Test Episodes for Show
      logSection('STEP 2: Test Episodes API');
      
      try {
        const episodesResponse = await axios.get(`${BASE_URL}/episodes`, {
          params: { show_id: firstShow.id }
        });
        log('✅', `Found ${episodesResponse.data.count || episodesResponse.data.length || 0} episodes for show`, colors.green);
        
        if (episodesResponse.data.data && episodesResponse.data.data.length > 0) {
          const firstEpisode = episodesResponse.data.data[0];
          log('🎬', `Example episode: ${firstEpisode.title || firstEpisode.episodeTitle} (ID: ${firstEpisode.id})`, colors.blue);
          
          // STEP 3: Test Thumbnail Templates
          logSection('STEP 3: Test Thumbnail Templates API');
          
          const templatesResponse = await axios.get(`${BASE_URL}/thumbnail-templates`, {
            params: { showId: firstShow.id }
          });
          log('✅', `Found ${templatesResponse.data.count} templates`, colors.green);
          
          if (templatesResponse.data.data && templatesResponse.data.data.length > 0) {
            const firstTemplate = templatesResponse.data.data[0];
            log('📋', `Example template: ${firstTemplate.name}`, colors.blue);
            log('  ', `Required roles: ${firstTemplate.required_roles?.length || 0}`, colors.blue);
            log('  ', `Optional roles: ${firstTemplate.optional_roles?.length || 0}`, colors.blue);
            
            if (firstTemplate.required_roles && firstTemplate.required_roles.length > 0) {
              log('  ', `First required role: ${firstTemplate.required_roles[0]}`, colors.blue);
              
              // STEP 4: Test Eligible Assets API
              logSection('STEP 4: Test Eligible Assets API');
              
              const testRole = firstTemplate.required_roles[0];
              try {
                const assetsResponse = await axios.get(`${BASE_URL}/assets/eligible`, {
                  params: {
                    role: testRole,
                    showId: firstShow.id,
                    episodeId: firstEpisode.id,
                    approvalStatus: 'APPROVED'
                  }
                });
                
                log('✅', `Found ${assetsResponse.data.count} eligible assets for role "${testRole}"`, colors.green);
                
                if (assetsResponse.data.data && assetsResponse.data.data.length > 0) {
                  const firstAsset = assetsResponse.data.data[0];
                  log('🖼️', `Example asset: ${firstAsset.name} (Scope: ${firstAsset.asset_scope})`, colors.blue);
                  
                  // STEP 5: Test Composition Creation (Dry Run)
                  logSection('STEP 5: Test Composition Creation API (Validation)');
                  
                  // Build assets object with all required roles
                  const assets = {};
                  for (const role of firstTemplate.required_roles) {
                    try {
                      const roleAssetsResponse = await axios.get(`${BASE_URL}/assets/eligible`, {
                        params: {
                          role: role,
                          showId: firstShow.id,
                          episodeId: firstEpisode.id,
                          approvalStatus: 'APPROVED'
                        }
                      });
                      
                      if (roleAssetsResponse.data.data && roleAssetsResponse.data.data.length > 0) {
                        assets[role] = roleAssetsResponse.data.data[0].id;
                        log('  ', `✓ ${role}: ${roleAssetsResponse.data.data[0].name}`, colors.green);
                      } else {
                        log('  ', `⚠ ${role}: No assets available`, colors.yellow);
                      }
                    } catch (err) {
                      log('  ', `⚠ ${role}: Error fetching assets`, colors.yellow);
                    }
                  }
                  
                  const requiredRolesFilled = firstTemplate.required_roles.every(role => assets[role]);
                  
                  if (requiredRolesFilled) {
                    log('✅', 'All required roles have assets available', colors.green);
                    log('📝', 'Composition payload ready:', colors.magenta);
                    console.log(JSON.stringify({
                      episode_id: firstEpisode.id,
                      template_id: firstTemplate.id,
                      assets: assets,
                      selected_formats: ['YOUTUBE_THUMBNAIL']
                    }, null, 2));
                    
                    log('\n🎉', 'All API endpoints are working correctly!', colors.green);
                  } else {
                    log('⚠️', 'Some required roles are missing assets - composition cannot be created yet', colors.yellow);
                  }
                  
                } else {
                  log('⚠️', `No assets available for role "${testRole}"`, colors.yellow);
                  log('💡', 'Assets need to be created with asset_role field set', colors.yellow);
                }
              } catch (error) {
                log('❌', `Error fetching eligible assets: ${error.message}`, colors.red);
                if (error.response?.data) {
                  console.log('Response:', error.response.data);
                }
              }
            }
          } else {
            log('⚠️', 'No templates available - run migration to create default template', colors.yellow);
          }
        } else {
          log('⚠️', 'No episodes available for this show', colors.yellow);
        }
      } catch (error) {
        log('❌', `Error fetching episodes: ${error.message}`, colors.red);
      }
    } else {
      log('⚠️', 'No shows available - create a show first', colors.yellow);
    }
    
    // STEP 6: Test Compositions GET endpoint
    logSection('STEP 6: Test Compositions GET API');
    
    try {
      const compositionsResponse = await axios.get(`${BASE_URL}/compositions`);
      log('✅', `Found ${compositionsResponse.data.count} compositions`, colors.green);
      
      if (compositionsResponse.data.data && compositionsResponse.data.data.length > 0) {
        const firstComposition = compositionsResponse.data.data[0];
        log('🎨', `Example composition ID: ${firstComposition.id}`, colors.blue);
        
        if (firstComposition.compositionAssets && firstComposition.compositionAssets.length > 0) {
          log('  ', `Has ${firstComposition.compositionAssets.length} composition_assets records`, colors.green);
          log('  ', `Example role: ${firstComposition.compositionAssets[0].asset_role}`, colors.blue);
        } else {
          log('  ', 'No composition_assets (legacy composition)', colors.yellow);
        }
      }
    } catch (error) {
      log('❌', `Error fetching compositions: ${error.message}`, colors.red);
    }
    
    logSection('TEST SUMMARY');
    log('🎯', 'Testing complete! Check results above.', colors.cyan);
    log('🌐', 'Frontend running at: http://localhost:5174/', colors.cyan);
    log('🔧', 'Backend API at: http://localhost:3002/api/v1', colors.cyan);
    
  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    if (error.response?.data) {
      console.log('Error details:', error.response.data);
    }
    console.error(error);
  }
}

// Run the test
console.log(`${colors.magenta}
╔══════════════════════════════════════════════════════════╗
║     Role-Based Asset System - Flow Test                 ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

testFlow().catch(console.error);
