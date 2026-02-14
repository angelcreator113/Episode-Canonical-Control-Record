# Scene API Test Script
Write-Host "🧪 Testing Scene API Endpoints`n" -ForegroundColor Cyan

# Wait for server
Start-Sleep -Seconds 2

try {
    # Test 1: Get episodes
    Write-Host "1️⃣  Getting episodes..." -ForegroundColor Yellow
    $episodes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/episodes" -Method Get
    $episodeId = $episodes.data[0].id
    Write-Host "✅ Using episode: $episodeId - $($episodes.data[0].title)`n" -ForegroundColor Green

    # Test 2: Create a scene
    Write-Host "2️⃣  Creating a scene..." -ForegroundColor Yellow
    $createBody = @{
        episode_id = $episodeId
        title = "Opening Scene"
        description = "The episode begins with an establishing shot"
        location = "Studio"
        duration_seconds = 120
    } | ConvertTo-Json
    
    $scene = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes" -Method Post -Body $createBody -ContentType "application/json"
    Write-Host "✅ Scene created: $($scene.data.id)" -ForegroundColor Green
    Write-Host "   Scene number: $($scene.data.scene_number)" -ForegroundColor Gray
    Write-Host "   Title: $($scene.data.title)`n" -ForegroundColor Gray
    $sceneId = $scene.data.id

    # Test 3: List all scenes
    Write-Host "3️⃣  Listing all scenes..." -ForegroundColor Yellow
    $allScenes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes" -Method Get
    Write-Host "✅ Found $($allScenes.data.Count) scene(s)" -ForegroundColor Green
    $allScenes.data | ForEach-Object {
        Write-Host "   - Scene #$($_.scene_number): $($_.title)" -ForegroundColor Gray
    }
    Write-Host ""

    # Test 4: Get single scene
    Write-Host "4️⃣  Getting single scene..." -ForegroundColor Yellow
    $singleScene = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes/$sceneId" -Method Get
    Write-Host "✅ Scene details retrieved" -ForegroundColor Green
    Write-Host "   Title: $($singleScene.data.title)" -ForegroundColor Gray
    Write-Host "   Duration: $($singleScene.data.duration_seconds)s`n" -ForegroundColor Gray

    # Test 5: Update scene
    Write-Host "5️⃣  Updating scene..." -ForegroundColor Yellow
    $updateBody = @{
        title = "Opening Scene (Updated)"
        duration_seconds = 150
    } | ConvertTo-Json
    
    $updated = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes/$sceneId" -Method Put -Body $updateBody -ContentType "application/json"
    Write-Host "✅ Scene updated" -ForegroundColor Green
    Write-Host "   New title: $($updated.data.title)" -ForegroundColor Gray
    Write-Host "   New duration: $($updated.data.duration_seconds)s`n" -ForegroundColor Gray

    # Test 6: Get episode scenes
    Write-Host "6️⃣  Getting scenes for episode..." -ForegroundColor Yellow
    $episodeScenes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/episodes/$episodeId/scenes" -Method Get
    Write-Host "✅ Episode has $($episodeScenes.count) scene(s)" -ForegroundColor Green
    Write-Host "   Episode: $($episodeScenes.episodeInfo.title)`n" -ForegroundColor Gray

    # Test 7: Create second scene
    Write-Host "7️⃣  Creating second scene..." -ForegroundColor Yellow
    $createBody2 = @{
        episode_id = $episodeId
        title = "Main Interview"
        description = "The main interview segment"
        location = "Interview Room"
        duration_seconds = 300
    } | ConvertTo-Json
    
    $scene2 = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes" -Method Post -Body $createBody2 -ContentType "application/json"
    Write-Host "✅ Second scene created: Scene #$($scene2.data.scene_number)`n" -ForegroundColor Green

    # Test 8: List with filter
    Write-Host "8️⃣  Listing scenes filtered by episode..." -ForegroundColor Yellow
    $filtered = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes?episode_id=$episodeId" -Method Get
    Write-Host "✅ Found $($filtered.data.Count) scene(s) for this episode`n" -ForegroundColor Green

    # Test 9: Delete scene
    Write-Host "9️⃣  Deleting first scene..." -ForegroundColor Yellow
    $deleted = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/scenes/$sceneId" -Method Delete
    Write-Host "✅ Scene deleted`n" -ForegroundColor Green

    Write-Host "🎉 All tests completed successfully!`n" -ForegroundColor Green

} catch {
    Write-Host "`n❌ Test failed: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
