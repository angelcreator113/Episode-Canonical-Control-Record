const fetch = require('node-fetch');

async function testTemplateStudioAPI() {
  try {
    console.log('🧪 Testing Template Studio API...\n');

    // Test 1: List all templates
    console.log('1️⃣ GET /api/v1/template-studio');
    const listResponse = await fetch('http://localhost:3002/api/v1/template-studio');
    const listData = await listResponse.json();
    console.log(`   Status: ${listData.status}`);
    console.log(`   Count: ${listData.count}`);
    console.log(`   Templates:`);
    listData.data.forEach(t => {
      console.log(`     - ${t.name} v${t.version} [${t.status}]${t.locked ? ' 🔒' : ''}`);
      console.log(`       ID: ${t.id}`);
      console.log(`       Canvas: ${t.canvas_config.width}x${t.canvas_config.height}`);
      console.log(`       Role slots: ${t.role_slots.length}`);
    });

    // Test 2: Get single template
    const templateId = listData.data[0].id;
    console.log(`\n2️⃣ GET /api/v1/template-studio/${templateId}`);
    const detailResponse = await fetch(`http://localhost:3002/api/v1/template-studio/${templateId}`);
    const detailData = await detailResponse.json();
    console.log(`   Status: ${detailData.status}`);
    console.log(`   Template: ${detailData.data.name} v${detailData.data.version}`);
    console.log(`   Required roles: ${detailData.data.required_roles.join(', ')}`);
    console.log(`   Optional roles: ${detailData.data.optional_roles.slice(0, 3).join(', ')}...`);

    // Test 3: Filter by status
    console.log(`\n3️⃣ GET /api/v1/template-studio?status=PUBLISHED`);
    const filterResponse = await fetch('http://localhost:3002/api/v1/template-studio?status=PUBLISHED');
    const filterData = await filterResponse.json();
    console.log(`   Count: ${filterData.count} published templates`);

    // Test 4: Filter by locked
    console.log(`\n4️⃣ GET /api/v1/template-studio?locked=true`);
    const lockedResponse = await fetch('http://localhost:3002/api/v1/template-studio?locked=true');
    const lockedData = await lockedResponse.json();
    console.log(`   Count: ${lockedData.count} locked templates`);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testTemplateStudioAPI();
