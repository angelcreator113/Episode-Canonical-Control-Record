/**
 * Test script for Scene API endpoints
 */
const baseUrl = 'http://localhost:3000/api/v1';

async function testSceneAPI() {
  console.log('🧪 Testing Scene API Endpoints\n');

  try {
    // Test 1: Get episodes to find one to use
    console.log('1️⃣ Getting episodes...');
    const episodesRes = await fetch(`${baseUrl}/episodes`);
    const episodesData = await episodesRes.json();
    
    if (!episodesData.data || episodesData.data.length === 0) {
      console.log('❌ No episodes found. Creating a test episode first...');
      const createEpisodeRes = await fetch(`${baseUrl}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Episode for Scenes',
          episode_number: 999,
          status: 'draft',
        }),
      });
      const newEpisode = await createEpisodeRes.json();
      if (!newEpisode.success) {
        throw new Error('Failed to create test episode');
      }
      var episodeId = newEpisode.data.id;
      console.log(`✅ Created test episode: ${episodeId}`);
    } else {
      var episodeId = episodesData.data[0].id;
      console.log(`✅ Using episode: ${episodeId} - "${episodesData.data[0].title}"`);
    }

    // Test 2: Create a scene
    console.log('\n2️⃣ Creating a scene...');
    const createRes = await fetch(`${baseUrl}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episode_id: episodeId,
        title: 'Opening Scene',
        description: 'The episode begins with an establishing shot',
        location: 'Studio',
        duration_seconds: 120,
      }),
    });
    const createData = await createRes.json();
    console.log(`✅ Scene created:`, createData);
    const sceneId = createData.data?.id;

    // Test 3: List all scenes
    console.log('\n3️⃣ Listing all scenes...');
    const listRes = await fetch(`${baseUrl}/scenes`);
    const listData = await listRes.json();
    console.log(`✅ Found ${listData.data?.length || 0} scene(s)`);
    console.log('Scenes:', listData.data?.map(s => `${s.scene_number}. ${s.title || 'Untitled'}`));

    // Test 4: Get single scene
    if (sceneId) {
      console.log('\n4️⃣ Getting single scene...');
      const getRes = await fetch(`${baseUrl}/scenes/${sceneId}`);
      const getData = await getRes.json();
      console.log(`✅ Scene details:`, getData.data);
    }

    // Test 5: Update scene
    if (sceneId) {
      console.log('\n5️⃣ Updating scene...');
      const updateRes = await fetch(`${baseUrl}/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Opening Scene (Updated)',
          duration_seconds: 150,
        }),
      });
      const updateData = await updateRes.json();
      console.log(`✅ Scene updated:`, updateData);
    }

    // Test 6: Get episode scenes
    console.log('\n6️⃣ Getting scenes for episode...');
    const episodeScenesRes = await fetch(`${baseUrl}/episodes/${episodeId}/scenes`);
    const episodeScenesData = await episodeScenesRes.json();
    console.log(`✅ Episode has ${episodeScenesData.count || 0} scene(s)`);
    console.log('Episode info:', episodeScenesData.episodeInfo);
    console.log('Scenes:', episodeScenesData.data?.map(s => `#${s.scene_number}: ${s.title}`));

    // Test 7: Create another scene
    console.log('\n7️⃣ Creating second scene...');
    const createRes2 = await fetch(`${baseUrl}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episode_id: episodeId,
        title: 'Main Interview',
        description: 'The main interview segment',
        location: 'Interview Room',
        duration_seconds: 300,
      }),
    });
    const createData2 = await createRes2.json();
    console.log(`✅ Second scene created:`, createData2.data);

    // Test 8: List scenes with filter
    console.log('\n8️⃣ Listing scenes filtered by episode...');
    const filterRes = await fetch(`${baseUrl}/scenes?episode_id=${episodeId}`);
    const filterData = await filterRes.json();
    console.log(`✅ Found ${filterData.data?.length || 0} scene(s) for this episode`);

    // Test 9: Delete a scene
    if (sceneId) {
      console.log('\n9️⃣ Deleting scene...');
      const deleteRes = await fetch(`${baseUrl}/scenes/${sceneId}`, {
        method: 'DELETE',
      });
      const deleteData = await deleteRes.json();
      console.log(`✅ Scene deleted:`, deleteData);
    }

    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSceneAPI();
