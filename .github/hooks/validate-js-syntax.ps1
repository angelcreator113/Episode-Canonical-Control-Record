#!/usr/bin/env pwsh
# Post-edit syntax validator for backend JS files
# Called by .github/hooks/validate-js-syntax.json
# Reads tool invocation JSON from stdin, runs node -c on edited .js files in src/

$input_json = $input | Out-String
try {
    $data = $input_json | ConvertFrom-Json
    $filePath = $data.toolInput.filePath
    if ($filePath -and $filePath -match '[/\\]src[/\\].*\.js$') {
        $result = & node -c $filePath 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Syntax error in ${filePath}: $result"
            Write-Output '{"decision":"block"}'
            exit 2
        }
    }
} catch {
    # Non-blocking: don't fail hook on parse errors
    exit 0
}
