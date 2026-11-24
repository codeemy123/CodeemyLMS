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

# Ensure NSSM service logs stdout and stderr to disk
$logDir = "C:\LMS\Backend\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
nssm set LMSBackend AppStdout "$logDir\service-stdout.log"
nssm set LMSBackend AppStderr "$logDir\service-stderr.log"

Write-Host "============================================="
Write-Host "=== 2. UPDATE SHARED & SYSTEM CONFIGURATION ==="
Write-Host "============================================="
# 1. Update shared environment file if exists
$sharedEnv = "C:\LMS\Backend\Deployments\shared\.env.local"
if (Test-Path $sharedEnv) {
    $sharedText = Get-Content $sharedEnv -Raw
    $sharedAppend = ""
    if ($sharedText -notmatch "LMS_PUBLIC_ORIGINS") {
        $sharedAppend += "`nLMS_PUBLIC_ORIGINS=https://lerno.codeemy.in,https://learnoin.netlify.app,https://api.lerno.codeemy.in`n"
    }
    if ($sharedText -notmatch "LMS_ADMIN_EMAILS") {
        $sharedAppend += "LMS_ADMIN_EMAILS=info.codeemy@gmail.com`n"
    }
    if ($sharedText -notmatch "LMS_DATABASE_MODE") {
        $sharedAppend += "LMS_DATABASE_MODE=true`n"
    }
    if ($sharedText -notmatch "GOOGLE_APPLICATION_CREDENTIALS") {
        $sharedAppend += "GOOGLE_APPLICATION_CREDENTIALS=C:\LMS\Backend\Deployments\shared\firebase-service-account.json`n"
    }
    if ($sharedText -match "cloudsql" -or $sharedText -notmatch "DATABASE_URL") {
        $sharedAppend += "DATABASE_URL=postgresql://codeemy_app:ThisMyApp123@127.0.0.1:5432/codeemy_lms`n"
    }
    if ($sharedAppend) {
        Add-Content -Path $sharedEnv -Value $sharedAppend
        Write-Host "Updated shared .env.local with configuration."
    }
}

# 2. Set system-wide environment variables for Windows Services
[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', 'C:\LMS\Backend\Deployments\shared\firebase-service-account.json', 'Machine')
[System.Environment]::SetEnvironmentVariable('LMS_ADMIN_EMAILS', 'info.codeemy@gmail.com', 'Machine')
[System.Environment]::SetEnvironmentVariable('LMS_DATABASE_MODE', 'true', 'Machine')
[System.Environment]::SetEnvironmentVariable('DATABASE_URL', 'postgresql://codeemy_app:ThisMyApp123@127.0.0.1:5432/codeemy_lms', 'Machine')

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

# Also ensure active release directory has updated code
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
        if ($envText -notmatch "LMS_DATABASE_MODE") {
            $appendContent += "LMS_DATABASE_MODE=true`n"
        }
        if ($envText -notmatch "GOOGLE_APPLICATION_CREDENTIALS") {
            $appendContent += "GOOGLE_APPLICATION_CREDENTIALS=C:\LMS\Backend\Deployments\shared\firebase-service-account.json`n"
        }
        if ($envText -match "cloudsql" -or $envText -notmatch "DATABASE_URL") {
            $appendContent += "DATABASE_URL=postgresql://codeemy_app:ThisMyApp123@127.0.0.1:5432/codeemy_lms`n"
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
Write-Host "=== 4. DATABASE CHECK & ADMIN PROVISIONING ==="
Write-Host "============================================="
$env:PGPASSWORD = "ThisMyApp123"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) { $psqlPath = $psqlCmd.Source }
}

if ($psqlPath -and (Test-Path $psqlPath)) {
    Write-Host "Found psql at $psqlPath"
    Write-Host "Current users in database:"
    & $psqlPath -h 127.0.0.1 -U codeemy_app -d codeemy_lms -c "SELECT id, email, role, status, firebase_uid FROM users;"

    Write-Host "Upserting info.codeemy@gmail.com as ADMIN..."
    & $psqlPath -h 127.0.0.1 -U codeemy_app -d codeemy_lms -c "INSERT INTO users (id, email, full_name, role, status, firebase_uid, created_at, updated_at) VALUES (gen_random_uuid(), 'info.codeemy@gmail.com', 'Anapty CodeEmy Technologies', 'ADMIN', 'ACTIVE', 'admin-seed-uid', NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', status = 'ACTIVE';"

    Write-Host "Verification after upsert:"
    & $psqlPath -h 127.0.0.1 -U codeemy_app -d codeemy_lms -c "SELECT id, email, role, status, firebase_uid FROM users WHERE email = 'info.codeemy@gmail.com';"
}

Write-Host "============================================="
Write-Host "=== 5. TESTING NODE RUNTIME PRISMA & FIREBASE ==="
Write-Host "============================================="
if ($appDir -and (Test-Path $appDir)) { Set-Location $appDir } else { Set-Location $targetDir }
$runtimeTest = @'
import { getPrisma } from './src/lib/prisma.js';
import { firebaseAuth } from './src/lib/server/firebase.js';

async function test() {
  console.log('Testing Prisma...');
  const prisma = getPrisma();
  const count = await prisma.users.count();
  console.log('Prisma test success, users count:', count);

  console.log('Testing Firebase Auth...');
  const auth = firebaseAuth();
  console.log('Firebase app initialized:', auth.app.name, 'project:', auth.app.options.projectId);
}

test().catch(err => console.error('Test error:', err));
'@
Set-Content -Path "test-runtime.mjs" -Value $runtimeTest
node test-runtime.mjs
Remove-Item -Force "test-runtime.mjs"

Write-Host "============================================="
Write-Host "=== 6. RESTARTING NSSM LMSBACKEND SERVICE ==="
Write-Host "============================================="
nssm restart LMSBackend
Start-Sleep -Seconds 6
$status = nssm status LMSBackend
Write-Host "LMSBackend status: $status"

Write-Host "============================================="
Write-Host "=== 7. VERIFYING LOCAL SERVICE ENDPOINTS ==="
Write-Host "============================================="
Write-Host "--- Testing /api/auth/config ---"
curl.exe -s http://127.0.0.1:3000/api/auth/config
Write-Host ""
Write-Host "--- Testing /api/auth/session Origin Check ---"
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/session -H "Origin: https://lerno.codeemy.in" -H "Content-Type: application/json" -d "{}"

if (Test-Path "$logDir\service-stderr.log") {
    Write-Host "--- Recent Service Stderr (last 20 lines) ---"
    Get-Content "$logDir\service-stderr.log" -Tail 20
}
