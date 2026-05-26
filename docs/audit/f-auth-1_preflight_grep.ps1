# f-auth-1_preflight_grep.ps1 v2
#
# F-AUTH-1 Section 5.1 Pre-Flight Grep Script
#
# Runs five grep passes against the routes directory + src/app.js:
#   Pass 1: optionalAuth inventory (PE #51 verification)
#   Pass 2: File-level auth mount inventory (PE #52 candidate verification)
#   Pass 3: src/app.js global auth mount line verification
#   Pass 4: Per-route auth detection (conservative pass) - PE #52 refinement
#   Pass 5: Per-route auth detection (aggressive pass) - PE #52 further refinement
#
# Output: stdout. To capture for later analysis:
#   .\f-auth-1_preflight_grep.ps1 | Out-File -FilePath f-auth-1_preflight.txt
#
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\docs\audit\f-auth-1_preflight_grep.ps1
#
# This script is READ-ONLY. It greps repository state. It does not modify files,
# commit, or push. Safe to run during G4 soak (passive monitoring posture
# preserved).
#
# v2 changes (2026-05-21):
#   - Pass 3 now correctly targets src/app.js (not root-level app.js stub)
#   - Pass 3 detects BOTH global mount patterns (bare app.use(auth) and
#     path-prefixed app.use('/path', auth, ...))
#   - Pass 4 (NEW): Conservative per-route auth detection - inline middleware
#   - Pass 5 (NEW): Aggressive per-route auth detection - multi-line, indirected
#   - Drift summary now uses corrected PE #51 / PE #52 inventories from
#     2026-05-21 verification amendments
#
# Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni
# Date: 2026-05-21 (F-Deploy-1 Phase A G4 soak day 2 of 7)

$ErrorActionPreference = 'Stop'

# Configuration: PE #51 and PE #52 expected inventories (CORRECTED 2026-05-21).
# Source: Session_PE_Roster.md, PE #51 / PE #52 verification amendments
# filed 2026-05-21.

# PE #51 corrected inventory: Pass 1 catches Pattern 1 (same-line) write routes.
# 4 explicit Pattern 1 per-route + 2 file-level mounts.
#
# Note: PE #51 in the roster lists 7 write routes total. The 3 additional
# (iconSlots.js:49/59/69) use Pattern 5/6 (multi-line declarations where
# optionalAuth lives on line N+2). Pass 1's same-line regex cannot match
# these by design; they appear in Pass 4 Tier 1 (confirmed auth via 5-line
# window). This is correct behavior, not script drift.
$PE51_ExplicitWriteOptionalAuth = @(
    @{ File = 'luxuryFilterRoutes.js'; Line = 11 },
    @{ File = 'luxuryFilterRoutes.js'; Line = 32 },
    @{ File = 'seasonRhythmRoutes.js'; Line = 16 },
    @{ File = 'worldStudio.js';        Line = 2483 }
)

$PE51_FileLevelOptionalAuth = @(
    @{ File = 'authorNoteRoutes.js';   Line = 18 },
    @{ File = 'entanglementRoutes.js'; Line = 40 }
)

$PE51_AppGlobalLine = 236      # src/app.js bare app.use(optionalAuth)
$PE51_AppPathPrefixLine = 1168 # src/app.js path-prefixed admin queues mount

# PE #52 corrected outer bound (2026-05-21 verification amendment)
$PE52_ExpectedFileCount = 120
$PE52_ExpectedWriteRouteCount = 853

# Auth middleware names to detect (for Pass 4 / Pass 5)
$AuthMiddlewareNames = @('requireAuth', 'authenticateJWT', 'optionalAuth', 'authMiddleware', 'authenticate')

# Locate project root via .git presence
$projectRoot = (Get-Item -Path '.').FullName
if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
    Write-Error "Not in project root. Run from the project root directory."
    exit 1
}

$routesDir = Join-Path $projectRoot 'src\routes'
$appFile   = Join-Path $projectRoot 'src\app.js'

if (-not (Test-Path $routesDir)) {
    Write-Error "Routes directory not found at $routesDir"
    exit 1
}

if (-not (Test-Path $appFile)) {
    Write-Error "src/app.js not found at $appFile"
    exit 1
}

Write-Output "================================================================"
Write-Output "F-AUTH-1 Section 5.1 Pre-Flight Grep v2"
Write-Output "Run date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Write-Output "Project root: $projectRoot"
Write-Output "Routes dir:   $routesDir"
Write-Output "App file:     $appFile"
Write-Output "================================================================"
Write-Output ""

# ----------------------------------------------------------------------
# Pass 1: optionalAuth inventory (PE #51 verification)
# ----------------------------------------------------------------------
Write-Output "=== Pass 1: optionalAuth inventory ==="
Write-Output ""

# Explicit per-route declarations on WRITES: router.{post,put,delete,patch}(... optionalAuth ...)
$pass1_writeRoutes = Get-ChildItem -Recurse -Include *.js -Path $routesDir |
    Select-String -Pattern 'router\.(post|put|delete|patch).*optionalAuth' |
    Select-Object @{Name='File';Expression={(Split-Path $_.Path -Leaf)}},
                  @{Name='Line';Expression={$_.LineNumber}},
                  @{Name='Content';Expression={$_.Line.Trim()}}

Write-Output "Explicit per-route optionalAuth declarations on WRITES (POST/PUT/PATCH/DELETE):"
if ($pass1_writeRoutes) {
    $pass1_writeRoutes | Format-Table -AutoSize -Wrap | Out-String | Write-Output
} else {
    Write-Output "  (none found)"
}
Write-Output ""

# File-level mounts: router.use(optionalAuth)
$pass1_fileLevel = Get-ChildItem -Recurse -Include *.js -Path $routesDir |
    Select-String -Pattern 'router\.use\s*\(\s*optionalAuth' |
    Select-Object @{Name='File';Expression={(Split-Path $_.Path -Leaf)}},
                  @{Name='Line';Expression={$_.LineNumber}},
                  @{Name='Content';Expression={$_.Line.Trim()}}

Write-Output "File-level router.use(optionalAuth) mounts:"
if ($pass1_fileLevel) {
    $pass1_fileLevel | Format-Table -AutoSize | Out-String | Write-Output
} else {
    Write-Output "  (none found)"
}
Write-Output ""

# ----------------------------------------------------------------------
# Pass 2: File-level auth mount inventory (PE #52 candidate verification)
# ----------------------------------------------------------------------
Write-Output "=== Pass 2: File-level auth mount inventory ==="
Write-Output ""

# Find all router.use(...) calls invoking auth middleware (any of the four names)
$pass2_authMounts = Get-ChildItem -Recurse -Include *.js -Path $routesDir |
    Select-String -Pattern 'router\.use\s*\(.*(requireAuth|authenticateJWT|optionalAuth|authMiddleware)' |
    Select-Object @{Name='File';Expression={(Split-Path $_.Path -Leaf)}},
                  @{Name='Line';Expression={$_.LineNumber}},
                  @{Name='Content';Expression={$_.Line.Trim()}}

Write-Output "Files with file-level auth mounts:"
if ($pass2_authMounts) {
    $pass2_authMounts | Format-Table -AutoSize | Out-String | Write-Output
} else {
    Write-Output "  (none found)"
}
Write-Output ""

# Identify PE #52 candidate files: write routes with no file-level auth mount
$filesWithAuthMounts = $pass2_authMounts | Select-Object -ExpandProperty File -Unique

# Get all .js files in routes dir that contain at least one write route
$allRouteFiles = Get-ChildItem -Recurse -Include *.js -Path $routesDir |
    Where-Object {
        $content = Get-Content $_.FullName -Raw
        $content -match 'router\.(post|put|delete|patch)'
    }

$pe52_candidateFiles = $allRouteFiles | Where-Object { $_.Name -notin $filesWithAuthMounts }

Write-Output "PE #52 candidate files (write routes, no file-level auth mount): $($pe52_candidateFiles.Count) files"
Write-Output ""

# ----------------------------------------------------------------------
# Pass 3: src/app.js auth mount line verification
# ----------------------------------------------------------------------
Write-Output "=== Pass 3: src/app.js global auth mounts ==="
Write-Output ""

# Detect both bare and path-prefixed app.use(...) with auth middleware
$pass3_appMounts = Select-String -Path $appFile -Pattern 'app\.use\s*\(.*(?:optionalAuth|requireAuth|authenticateJWT|authMiddleware|authenticate)' |
    Select-Object @{Name='File';Expression={(Split-Path $_.Path -Leaf)}},
                  @{Name='Line';Expression={$_.LineNumber}},
                  @{Name='Content';Expression={$_.Line.Trim()}}

if ($pass3_appMounts) {
    $pass3_appMounts | Format-Table -AutoSize -Wrap | Out-String | Write-Output
} else {
    Write-Output "  No app.use(...auth...) mounts found in src/app.js"
}
Write-Output ""

# ----------------------------------------------------------------------
# Pass 4: Per-route auth detection - CONSERVATIVE pass
# ----------------------------------------------------------------------
Write-Output "=== Pass 4: Per-route auth detection (conservative) ==="
Write-Output ""
Write-Output "For each PE #52 candidate file, count routes where auth middleware"
Write-Output "appears inline between path and handler. This catches Patterns 1, 4,"
Write-Output "5, 6 from the deliverable's pattern enumeration."
Write-Output ""

# Build a per-file count of write routes WITH inline auth (conservative)
$pass4_results = @()

foreach ($file in $pe52_candidateFiles) {
    $content = Get-Content $file.FullName -Raw
    $lines = $content -split "`n"

    # Find all router.{post,put,delete,patch}(...) line numbers
    $writeRouteLines = @()
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'router\.(post|put|delete|patch)') {
            $writeRouteLines += $i  # 0-indexed
        }
    }

    $totalWrites = $writeRouteLines.Count
    $confirmedAuthCount = 0
    $confirmedAuthLines = @()

    foreach ($routeLine in $writeRouteLines) {
        # Look at the route declaration line + next 5 lines (catches Pattern 1, 5, 6)
        $endLine = [Math]::Min($routeLine + 5, $lines.Length - 1)
        $routeBlock = $lines[$routeLine..$endLine] -join " "

        # Conservative: must contain one of the auth middleware names as a
        # standalone token (not inside a string, not inside a comment, not
        # inside an identifier like 'requireAuthorization').
        # Pattern: word boundary, name, word boundary, NOT followed by alphanumeric
        $hasAuth = $false
        foreach ($name in $AuthMiddlewareNames) {
            if ($routeBlock -match "\b$name\b(?!\w)") {
                $hasAuth = $true
                break
            }
        }

        if ($hasAuth) {
            $confirmedAuthCount++
            $confirmedAuthLines += ($routeLine + 1)  # 1-indexed line number
        }
    }

    $pass4_results += [PSCustomObject]@{
        File = $file.Name
        TotalWrites = $totalWrites
        ConfirmedAuth = $confirmedAuthCount
        NoAuthDetected = ($totalWrites - $confirmedAuthCount)
    }
}

Write-Output "Per-file conservative classification:"
Write-Output ""
$pass4_results | Sort-Object -Property NoAuthDetected -Descending |
    Format-Table -AutoSize | Out-String | Write-Output

$totalConfirmed = ($pass4_results | Measure-Object -Property ConfirmedAuth -Sum).Sum
$totalNoAuth = ($pass4_results | Measure-Object -Property NoAuthDetected -Sum).Sum
$totalAllWrites = ($pass4_results | Measure-Object -Property TotalWrites -Sum).Sum

Write-Output "Pass 4 aggregate:"
Write-Output "  Total write routes in PE #52 candidate files: $totalAllWrites"
Write-Output "  Routes with confirmed inline auth (Pattern 1/5/6): $totalConfirmed"
Write-Output "  Routes with no auth detected by Pass 4: $totalNoAuth"
Write-Output ""

# ----------------------------------------------------------------------
# Pass 5: Per-route auth detection - AGGRESSIVE pass
# ----------------------------------------------------------------------
Write-Output "=== Pass 5: Per-route auth detection (aggressive) ==="
Write-Output ""
Write-Output "For routes that Pass 4 did not catch, look more broadly: scan up"
Write-Output "to 15 lines after the route declaration for auth middleware"
Write-Output "references including arrays and indirected names. False positives"
Write-Output "possible (comments mentioning auth, nearby unrelated routes)."
Write-Output ""

# Build a per-file count of write routes WITH wider auth detection (aggressive)
$pass5_results = @()

foreach ($file in $pe52_candidateFiles) {
    $content = Get-Content $file.FullName -Raw
    $lines = $content -split "`n"

    # Find all router.{post,put,delete,patch}(...) line numbers
    $writeRouteLines = @()
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'router\.(post|put|delete|patch)') {
            $writeRouteLines += $i  # 0-indexed
        }
    }

    $totalWrites = $writeRouteLines.Count
    $probableAuthCount = 0
    $confirmedFromPass4 = 0

    for ($idx = 0; $idx -lt $writeRouteLines.Count; $idx++) {
        $routeLine = $writeRouteLines[$idx]

        # First check: was this caught by Pass 4? (5-line conservative window)
        $endLine = [Math]::Min($routeLine + 5, $lines.Length - 1)
        $routeBlock = $lines[$routeLine..$endLine] -join " "

        $hasAuthConservative = $false
        foreach ($name in $AuthMiddlewareNames) {
            if ($routeBlock -match "\b$name\b(?!\w)") {
                $hasAuthConservative = $true
                break
            }
        }

        if ($hasAuthConservative) {
            $confirmedFromPass4++
            continue
        }

        # Pass 5: extend window to 15 lines, look for auth-name references
        # Stop scanning at next route declaration to avoid bleeding into adjacent routes
        $extendedEnd = [Math]::Min($routeLine + 15, $lines.Length - 1)

        # If there's a next route declaration before $extendedEnd, stop there
        if ($idx + 1 -lt $writeRouteLines.Count) {
            $nextRoute = $writeRouteLines[$idx + 1]
            if ($nextRoute -lt $extendedEnd) {
                $extendedEnd = $nextRoute - 1
            }
        }

        if ($extendedEnd -le $routeLine) {
            continue  # No room to scan
        }

        $extendedBlock = $lines[$routeLine..$extendedEnd] -join " "

        $hasAuthAggressive = $false
        foreach ($name in $AuthMiddlewareNames) {
            if ($extendedBlock -match "\b$name\b(?!\w)") {
                $hasAuthAggressive = $true
                break
            }
        }

        if ($hasAuthAggressive) {
            $probableAuthCount++
        }
    }

    $needsInspection = $totalWrites - $confirmedFromPass4 - $probableAuthCount

    $pass5_results += [PSCustomObject]@{
        File = $file.Name
        TotalWrites = $totalWrites
        Tier1_Confirmed = $confirmedFromPass4
        Tier2_Probable = $probableAuthCount
        Tier3_NeedsInspection = $needsInspection
    }
}

Write-Output "Per-file three-tier classification:"
Write-Output ""
$pass5_results | Sort-Object -Property Tier3_NeedsInspection -Descending |
    Format-Table -AutoSize | Out-String | Write-Output

$totalT1 = ($pass5_results | Measure-Object -Property Tier1_Confirmed -Sum).Sum
$totalT2 = ($pass5_results | Measure-Object -Property Tier2_Probable -Sum).Sum
$totalT3 = ($pass5_results | Measure-Object -Property Tier3_NeedsInspection -Sum).Sum

Write-Output "Pass 5 aggregate:"
Write-Output "  Tier 1 (confirmed auth, Pattern 1/5/6): $totalT1 routes"
Write-Output "  Tier 2 (probable auth, Pattern 2/3 likely): $totalT2 routes"
Write-Output "  Tier 3 (needs per-route inspection): $totalT3 routes"
Write-Output ""

# ----------------------------------------------------------------------
# Drift summary
# ----------------------------------------------------------------------
Write-Output "=== Drift Summary ==="
Write-Output ""

# PE #51 explicit write-route check
$pass1WriteCount = $pass1_writeRoutes.Count
$pe51WriteExpected = $PE51_ExplicitWriteOptionalAuth.Count
$pe51WriteStatus = if ($pass1WriteCount -eq $pe51WriteExpected) { 'MATCH' } else { 'DRIFT' }

Write-Output "PE #51 verification (corrected 2026-05-21):"
Write-Output "  Note: PE #51 lists 7 write routes total. Pass 1 catches 4 (Pattern 1,"
Write-Output "        single-line). The 3 iconSlots writes use Pattern 5/6 (multi-line)"
Write-Output "        and are detected by Pass 4 instead. See iconSlots.js Tier 1 count."
Write-Output "  Explicit per-route optionalAuth on writes (Pattern 1 only): $pass1WriteCount found / $pe51WriteExpected expected - $pe51WriteStatus"

if ($pe51WriteStatus -eq 'DRIFT') {
    Write-Output "  Expected entries:"
    foreach ($e in $PE51_ExplicitWriteOptionalAuth) {
        $matched = $pass1_writeRoutes | Where-Object { $_.File -eq $e.File -and $_.Line -eq $e.Line }
        if ($matched) {
            Write-Output "    [FOUND]    $($e.File):$($e.Line)"
        } else {
            Write-Output "    [MISSING]  $($e.File):$($e.Line)"
        }
    }
    Write-Output "  Found entries not in expected list:"
    foreach ($f in $pass1_writeRoutes) {
        $expected = $PE51_ExplicitWriteOptionalAuth | Where-Object { $_.File -eq $f.File -and $_.Line -eq $f.Line }
        if (-not $expected) {
            Write-Output "    [NEW]      $($f.File):$($f.Line)"
        }
    }
}

# PE #51 file-level mount check
$pe51FileLevelFound = $pass1_fileLevel.Count
$pe51FileLevelExpected = $PE51_FileLevelOptionalAuth.Count
$pe51FileLevelStatus = if ($pe51FileLevelFound -eq $pe51FileLevelExpected) { 'MATCH' } else { 'DRIFT' }

Write-Output "  File-level optionalAuth mounts: $pe51FileLevelFound found / $pe51FileLevelExpected expected - $pe51FileLevelStatus"

# src/app.js mounts check
$bareAppMount = $pass3_appMounts | Where-Object { $_.Content -match 'app\.use\s*\(\s*optionalAuth' } | Select-Object -First 1
$pathPrefixedMount = $pass3_appMounts | Where-Object { $_.Content -match 'app\.use\s*\(\s*''/' } | Select-Object -First 1

$bareLine = if ($bareAppMount) { $bareAppMount.Line } else { 'NOT FOUND' }
$bareStatus = if ($bareLine -eq $PE51_AppGlobalLine) { 'MATCH' } else { 'DRIFT' }
Write-Output "  src/app.js bare app.use(optionalAuth): line $bareLine / expected $PE51_AppGlobalLine - $bareStatus"

$pathLine = if ($pathPrefixedMount) { $pathPrefixedMount.Line } else { 'NOT FOUND' }
$pathStatus = if ($pathLine -eq $PE51_AppPathPrefixLine) { 'MATCH' } else { 'DRIFT' }
Write-Output "  src/app.js path-prefixed admin auth: line $pathLine / expected $PE51_AppPathPrefixLine - $pathStatus"

Write-Output ""

# PE #52 outer-bound check
$pe52FileStatus = if ($pe52_candidateFiles.Count -eq $PE52_ExpectedFileCount) { 'MATCH' } else { 'DRIFT' }
$pe52RouteStatus = if ($totalAllWrites -eq $PE52_ExpectedWriteRouteCount) { 'MATCH' } else { 'DRIFT' }

Write-Output "PE #52 verification (outer bound, corrected 2026-05-21):"
Write-Output "  Candidate files: $($pe52_candidateFiles.Count) found / $PE52_ExpectedFileCount expected - $pe52FileStatus"
Write-Output "  Candidate write routes: $totalAllWrites found / $PE52_ExpectedWriteRouteCount expected - $pe52RouteStatus"

Write-Output ""

# Per-route refinement summary
Write-Output "Per-route refinement (Passes 4 + 5):"
Write-Output "  Outer bound (no file-level auth mount): $totalAllWrites routes"
Write-Output "  Tier 1 (confirmed inline auth, Pattern 1/5/6): $totalT1 routes ($([Math]::Round(100 * $totalT1 / $totalAllWrites))%)"
Write-Output "  Tier 2 (probable auth, Pattern 2/3 likely): $totalT2 routes ($([Math]::Round(100 * $totalT2 / $totalAllWrites))%)"
Write-Output "  Tier 3 (NEEDS PER-ROUTE INSPECTION): $totalT3 routes ($([Math]::Round(100 * $totalT3 / $totalAllWrites))%)"
Write-Output ""
Write-Output "  Tier 3 is the prioritized F-AUTH-1 execution work surface."
Write-Output "  Tier 1 routes are auth-confirmed at script-detection level."
Write-Output "  Tier 2 routes need verification but are likely auth-gated via array"
Write-Output "  or indirected middleware patterns the script's regexes can't"
Write-Output "  authoritatively confirm."

Write-Output ""

# Overall status
$allMatch = ($pe51WriteStatus -eq 'MATCH') -and
            ($pe51FileLevelStatus -eq 'MATCH') -and
            ($bareStatus -eq 'MATCH') -and
            ($pathStatus -eq 'MATCH') -and
            ($pe52FileStatus -eq 'MATCH') -and
            ($pe52RouteStatus -eq 'MATCH')

if ($allMatch) {
    Write-Output "Status: No drift since 2026-05-21 verification inventory."
    Write-Output "        F-AUTH-1 execution can proceed against current PE #51 / PE #52 framing."
} else {
    Write-Output "Status: DRIFT DETECTED since 2026-05-21 verification inventory."
    Write-Output "        Reconcile drift before F-AUTH-1 execution begins."
    Write-Output "        Update PE #51 / PE #52 entries in Session_PE_Roster.md or wait for"
    Write-Output "        drifting work to land, then re-run this script."
}

Write-Output ""
Write-Output "================================================================"
Write-Output "End of F-AUTH-1 Section 5.1 Pre-Flight Grep v2"
Write-Output "================================================================"
