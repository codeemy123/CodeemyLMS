$ErrorActionPreference = "Continue"

Write-Host "============================================="
Write-Host "=== 1. CHECK NSSM SERVICE CONFIGURATION ==="
Write-Host "============================================="
try {
    $appPath = (nssm get LMSBackend Application).Trim()
    $appDir = (nssm get LMSBackend AppDirectory).Trim()
    $appParams = (nssm get LMSBackend AppParameters).Trim()
    Write-Host "LMSBackend Application: $appPath"
    Write-Host "LMSBackend AppDirectory: $appDir"
    Write-Host "LMSBackend AppParameters: $appParams"
    nssm status LMSBackend
} catch {
    Write-Host "NSSM query warning: $_"
}

Write-Host "============================================="
Write-Host "=== 2. INSPECT HOSTERDADDY SCRIPTS ==="
Write-Host "============================================="
if (Test-Path "C:\LMS\Backend\Deployments\scripts\prepare-release.ps1") {
    Write-Host "--- prepare-release.ps1 content ---"
    Get-Content "C:\LMS\Backend\Deployments\scripts\prepare-release.ps1"
} else {
    Write-Host "prepare-release.ps1 not found"
}
if (Test-Path "C:\LMS\Backend\Deployments\scripts\deploy.ps1") {
    Write-Host "--- deploy.ps1 content ---"
    Get-Content "C:\LMS\Backend\Deployments\scripts\deploy.ps1"
} else {
    Write-Host "deploy.ps1 not found"
}

Write-Host "============================================="
Write-Host "=== 3. SYNC REPOSITORY CODE ==="
Write-Host "============================================="
$targetDir = "C:\LMS\Backend\CodeemyLMS-main"
if (-not (Test-Path "$targetDir\.git")) {
    Write-Host "No .git found in $targetDir. Initializing git from GitHub..."
    $tempDir = "C:\LMS\Backend\temp_repo"
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    git clone https://github.com/codeemy123/CodeemyLMS.git $tempDir
    Get-ChildItem -Path $tempDir -Exclude ".env.local" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $targetDir -Recurse -Force
    }
    if (Test-Path "$tempDir\.git") {
        Copy-Item -Path "$tempDir\.git" -Destination "$targetDir\.git" -Recurse -Force
    }
    Remove-Item -Recurse -Force $tempDir
    Write-Host "Sync from fresh clone complete."
} else {
    Write-Host "Git found in $targetDir. Pulling latest code..."
    Set-Location $targetDir
    git remote set-url origin https://github.com/codeemy123/CodeemyLMS.git
    git fetch origin main
    git reset --hard origin/main
}

# If NSSM points to a different folder, copy updated source files there too
if ($appDir -and ($appDir -ne $targetDir) -and (Test-Path $appDir)) {
    Write-Host "Copying updated files from $targetDir to active directory $appDir..."
    Get-ChildItem -Path $targetDir -Exclude ".env.local", "node_modules", ".next" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $appDir -Recurse -Force
    }
}

$dirsToUpdate = @($targetDir)
if ($appDir -and ($dirsToUpdate -notcontains $appDir) -and (Test-Path $appDir)) {
    $dirsToUpdate += $appDir
}

foreach ($dir in $dirsToUpdate) {
    Write-Host "---------------------------------------------"
    Write-Host "Processing directory: $dir"
    Write-Host "---------------------------------------------"
    Set-Location $dir
    
    # 1. Ensure .env.local has required variables
    $envFile = Join-Path $dir ".env.local"
    if (Test-Path $envFile) {
        $envText = Get-Content $envFile -Raw
        $appendContent = ""
        if ($envText -notmatch "LMS_PUBLIC_ORIGINS") {
            $appendContent += "`nLMS_PUBLIC_ORIGINS=https://lerno.codeemy.in,https://learnoin.netlify.app,https://api.lerno.codeemy.in`n"
        }
        if ($envText -notmatch "LMS_ADMIN_EMAILS") {
            $appendContent += "LMS_ADMIN_EMAILS=info.codeemy@gmail.com`n"
        }
        if ($appendContent) {
            Add-Content -Path $envFile -Value $appendContent
            Write-Host "Updated $envFile with configuration variables."
        } else {
            Write-Host "$envFile already has required environment variables."
        }
    } else {
        Write-Host "Warning: $envFile not found in $dir"
    }

    # 2. Run Prisma generate and Next.js build
    Write-Host "Generating Prisma client in $dir..."
    cmd.exe /c "npx prisma generate"
    
    Write-Host "Building Next.js application in $dir..."
    cmd.exe /c "npm run build"
}

Write-Host "============================================="
Write-Host "=== 4. RESTARTING NSSM LMSBACKEND SERVICE ==="
Write-Host "============================================="
nssm restart LMSBackend
Start-Sleep -Seconds 6
$status = nssm status LMSBackend
Write-Host "LMSBackend status: $status"

Write-Host "============================================="
Write-Host "=== 5. VERIFYING LOCAL SERVICE ENDPOINT ==="
Write-Host "============================================="
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/session -H "Origin: https://lerno.codeemy.in" -H "Content-Type: application/json" -d "{}"
