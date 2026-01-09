# Cleanup Test and Debug Files
# Removes temporary debug files from the project

Write-Host "Cleaning up test and debug files..." -ForegroundColor Cyan

# Remove debug files
$filesToRemove = @(
    "frontend/debug.html",
    "test-svg-fix.html",
    "test-*.html",
    "debug-*.html"
)

foreach ($pattern in $filesToRemove) {
    $files = Get-Item -Path $pattern -ErrorAction SilentlyContinue
    if ($files) {
        foreach ($file in $files) {
            Remove-Item -Path $file.FullName -Force
            Write-Host "  [+] Removed: $($file.Name)" -ForegroundColor Green
        }
    }
}

Write-Host "Cleanup complete!" -ForegroundColor Green

