/**
 * Test Template Studio Integration
 * Tests the complete flow: Template selection → Composition → Generation
 */

const fetch = require('node-fetch');

const API_BASE = 'http://127.0.0.1:3002/api/v1';

async function testTemplateStudioIntegration() {
  console.log('🧪 Testing Template Studio Integration\n');

  try {
    // Step 1: Get available templates
    console.log('1️⃣ Fetching templates...');
    const templatesResponse = await fetch(`${API_BASE}/template-studio?status=PUBLISHED`);
    const templatesData = await templatesResponse.json();
    
    if (templatesData.count === 0) {
      console.error('❌ No templates available');
      return;
    }

    console.log(`✅ Found ${templatesData.count} templates`);
    const template = templatesData.data[0];
    console.log(`   Using: ${template.name} (${template.id})`);
    console.log(`   Required roles: ${template.required_roles.join(', ')}`);

    // Step 2: Get episodes
    console.log('\n2️⃣ Fetching episodes...');
    const episodesResponse = await fetch(`${API_BASE}/episodes`);
    const episodesData = await episodesResponse.json();
    
    if (!episodesData.data || episodesData.data.length === 0) {
      console.error('❌ No episodes available');
      return;
    }

    const episode = episodesData.data[0];
    console.log(`✅ Using episode: ${episode.name || episode.title} (${episode.id})`);

    // Step 3: Get assets for the episode
    console.log('\n3️⃣ Fetching assets...');
    const assetsResponse = await fetch(`${API_BASE}/assets?episode_id=${episode.id}`);
    const assetsData = await assetsResponse.json();
    
    console.log(`✅ Found ${assetsData.count} assets`);

    // Build asset_map for required roles
    const assetMap = {};
    
    // Map assets to roles (simplified - just pick first asset for each required role)
    template.required_roles.forEach(role => {
      // Find an asset that might match this role
      const asset = assetsData.data.find(a => {
        if (role.includes('LALA')) return a.asset_role?.includes('LALA') || a.name?.toLowerCase().includes('lala');
        if (role.includes('JUSTAWOMAN')) return a.asset_role?.includes('JUSTAWOMAN') || a.name?.toLowerCase().includes('justawoman');
        if (role.includes('GUEST')) return a.asset_role?.includes('GUEST') || a.name?.toLowerCase().includes('guest');
        if (role.includes('BG.MAIN')) return a.asset_role?.includes('BG') || a.category === 'background';
        return false;
      });

      if (asset) {
        assetMap[role] = asset.id;
        console.log(`   Mapped ${role} → ${asset.name}`);
      } else {
        console.warn(`   ⚠️  No asset found for ${role}`);
      }
    });

    // Add text fields
    assetMap['TEXT.SHOW.TITLE'] = episode.name || episode.title || 'Test Episode';

    // Step 4: Create composition
    console.log('\n4️⃣ Creating composition...');
    const compositionPayload = {
      episode_id: episode.id,
      template_studio_id: template.id,
      asset_map: assetMap,
      selected_formats: ['YOUTUBE'],
      composition_name: `Test - ${template.name} - ${new Date().toISOString()}`
    };

    console.log('   Payload:', JSON.stringify(compositionPayload, null, 2));

    const compositionResponse = await fetch(`${API_BASE}/compositions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(compositionPayload)
    });

    const compositionData = await compositionResponse.json();

    if (compositionResponse.status !== 201) {
      console.error('❌ Failed to create composition:', compositionData);
      return;
    }

    console.log(`✅ Composition created: ${compositionData.data.composition.id}`);
    console.log(`   Status: ${compositionData.data.composition.status}`);
    console.log(`   Template Studio ID: ${compositionData.data.composition.template_studio_id}`);
    console.log(`   Thumbnails generated: ${compositionData.data.thumbnails_generated}`);

    if (compositionData.data.thumbnails && compositionData.data.thumbnails.length > 0) {
      console.log('\n📸 Thumbnails:');
      compositionData.data.thumbnails.forEach(t => {
        console.log(`   - ${t.format}: ${t.width}×${t.height} (${(t.size / 1024).toFixed(2)} KB)`);
      });
    }

    console.log('\n✅ Test completed successfully!');
    console.log(`\n🔗 View composition: ${API_BASE}/compositions/${compositionData.data.composition.id}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run test
testTemplateStudioIntegration();
