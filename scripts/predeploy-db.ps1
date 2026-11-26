Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-CheckedNativeCommand {
    param([string]$Name, [scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

if (-not $env:DATABASE_URL -or -not $env:MIGRATION_DATABASE_URL) {
    throw 'Required database credentials are missing; deployment is blocked.'
}

$runtimeUri = $null
try {
    $runtimeUri = [Uri]$env:DATABASE_URL
} catch {
    throw 'DATABASE_URL is invalid; deployment is blocked.'
}
$runtimeUser = [Uri]::UnescapeDataString(($runtimeUri.UserInfo -split ':', 2)[0])
if ($runtimeUser -ne 'codeemy_app') {
    throw 'DATABASE_URL must use codeemy_app; deployment is blocked.'
}

$targetDir = 'C:\LMS\Backend\CodeemyLMS-main'
if (-not (Test-Path (Join-Path $targetDir '.git'))) {
    throw "Deployment repository not found at $targetDir."
}

Set-Location $targetDir
Invoke-CheckedNativeCommand 'Fetch main' { git fetch origin main }
$sourceRevision = (& git rev-parse origin/main).Trim()
if ($LASTEXITCODE -ne 0 -or -not $sourceRevision) {
    throw 'Could not resolve the production source revision; deployment is blocked.'
}

if (-not (Test-Path (Join-Path $targetDir 'node_modules'))) {
    throw 'Production Node dependencies are unavailable for the database preflight.'
}

$preflightDir = Join-Path $env:TEMP ("codeemy-db-preflight-" + [Guid]::NewGuid().ToString('N'))
$nodeModulesLink = Join-Path $preflightDir 'node_modules'
$worktreeAdded = $false
try {
    Invoke-CheckedNativeCommand 'Create isolated preflight worktree' {
        git worktree add --detach $preflightDir $sourceRevision
    }
    $worktreeAdded = $true
    New-Item -ItemType Junction -Path $nodeModulesLink -Target (Join-Path $targetDir 'node_modules') | Out-Null
    Set-Location $preflightDir
    Invoke-CheckedNativeCommand 'Pre-deployment backup, restore check, and migrations' {
        node scripts/deploy-db-safety.mjs
    }
} finally {
    Set-Location $targetDir
    if (Test-Path $nodeModulesLink) {
        Remove-Item -LiteralPath $nodeModulesLink -Force
    }
    if ($worktreeAdded) {
        Invoke-CheckedNativeCommand 'Remove isolated preflight worktree' {
            git worktree remove --force $preflightDir
        }
    }
}

[System.Environment]::SetEnvironmentVariable('DATABASE_URL', $env:DATABASE_URL, 'Machine')
Write-Host 'Runtime DATABASE_URL updated from the protected application secret; other environment variables were not changed.'
