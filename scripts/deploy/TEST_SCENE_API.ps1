# Scene API Test Commands
# Run these commands one by one in PowerShell while the server is running

# 1. Get an episode to use for testing
$episodes = Invoke-RestMethod "http://localhost:3000/api/v1/episodes"
$episodeId = $episodes.data[0].id
Write-Host "✅ Using episode: $($episodes.data[0].title) ($episodeId)" -ForegroundColor Green

# 2. Create a scene
$createBody = @{
    episode_id = $episodeId
    title = "Test Scene"
    description = "This is a test scene"
    location = "Studio A"
    duration_seconds = 120
} | ConvertTo-Json

$scene = Invoke-RestMethod "http://localhost:3000/api/v1/scenes" -Method Post -Body $createBody -ContentType "application/json"
$sceneId = $scene.data.id
Write-Host "✅ Created scene #$($scene.data.scene_number): $($scene.data.title) ($sceneId)" -ForegroundColor Green

# 3. List all scenes
$allScenes = Invoke-RestMethod "http://localhost:3000/api/v1/scenes"
Write-Host "✅ Found $($allScenes.pagination.total) total scenes" -ForegroundColor Green

# 4. Get single scene details
$singleScene = Invoke-RestMethod "http://localhost:3000/api/v1/scenes/$sceneId"
Write-Host "✅ Got scene: $($singleScene.data.title) - $($singleScene.data.duration_seconds)s" -ForegroundColor Green

# 5. Update the scene
$updateBody = @{
    title = "Updated Test Scene"
    duration_seconds = 180
} | ConvertTo-Json

$updated = Invoke-RestMethod "http://localhost:3000/api/v1/scenes/$sceneId" -Method Put -Body $updateBody -ContentType "application/json"
Write-Host "✅ Updated scene: $($updated.data.title) - $($updated.data.duration_seconds)s" -ForegroundColor Green

# 6. Get all scenes for the episode
$episodeScenes = Invoke-RestMethod "http://localhost:3000/api/v1/episodes/$episodeId/scenes"
Write-Host "✅ Episode '$($episodeScenes.episodeInfo.title)' has $($episodeScenes.count) scene(s)" -ForegroundColor Green

# 7. List scenes filtered by episode
$filtered = Invoke-RestMethod "http://localhost:3000/api/v1/scenes?episode_id=$episodeId"
Write-Host "✅ Found $($filtered.data.Count) scenes for this episode" -ForegroundColor Green

# 8. Delete the scene
$deleted = Invoke-RestMethod "http://localhost:3000/api/v1/scenes/$sceneId" -Method Delete
Write-Host "✅ Deleted scene: $($deleted.data.deletedSceneId)" -ForegroundColor Green

Write-Host "`n🎉 All Scene API tests passed!`n" -ForegroundColor Green
