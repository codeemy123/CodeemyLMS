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
    if ($sharedAppend) {
        Add-Content -Path $sharedEnv -Value $sharedAppend
        Write-Host "Updated shared .env.local with configuration."
    }
}

# 2. Set system-wide environment variables for Windows Services
[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', 'C:\LMS\Backend\Deployments\shared\firebase-service-account.json', 'Machine')
[System.Environment]::SetEnvironmentVariable('LMS_ADMIN_EMAILS', 'info.codeemy@gmail.com', 'Machine')
[System.Environment]::SetEnvironmentVariable('LMS_DATABASE_MODE', 'true', 'Machine')

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
# Execute direct Prisma database check in active directory
if ($appDir -and (Test-Path $appDir)) {
    Set-Location $appDir
} else {
    Set-Location $targetDir
}

$dbScript = @'
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  try {
    const users = await prisma.users.findMany({
      select: { id: true, email: true, role: true, status: true, firebase_uid: true }
    });
    console.log(`Found ${users.length} users in database:`);
    for (const u of users) {
      console.log(`  - ${u.email} | role=${u.role} | status=${u.status} | uid=${u.firebase_uid}`);
    }

    // Ensure info.codeemy@gmail.com is provisioned as active ADMIN
    const adminEmail = 'info.codeemy@gmail.com';
    const existing = users.find(u => u.email.toLowerCase() === adminEmail);
    if (existing) {
      if (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE') {
        const updated = await prisma.users.update({
          where: { id: existing.id },
          data: { role: 'ADMIN', status: 'ACTIVE' }
        });
        console.log(`Updated ${adminEmail} to ADMIN:`, updated);
      } else {
        console.log(`${adminEmail} is already active ADMIN.`);
      }
    } else {
      const created = await prisma.users.create({
        data: {
          email: adminEmail,
          full_name: 'Anapty CodeEmy Technologies',
          role: 'ADMIN',
          status: 'ACTIVE',
          firebase_uid: 'admin-' + Date.now()
        }
      });
      console.log(`Created admin user ${adminEmail}:`, created);
    }
  } catch (err) {
    console.error('Database provisioning error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
'@

Set-Content -Path "check-db.js" -Value $dbScript
node check-db.js
Remove-Item -Force "check-db.js"

Write-Host "============================================="
Write-Host "=== 5. RESTARTING NSSM LMSBACKEND SERVICE ==="
Write-Host "============================================="
nssm restart LMSBackend
Start-Sleep -Seconds 6
$status = nssm status LMSBackend
Write-Host "LMSBackend status: $status"

Write-Host "============================================="
Write-Host "=== 6. VERIFYING LOCAL SERVICE ENDPOINTS ==="
Write-Host "============================================="
Write-Host "--- Testing /api/auth/config ---"
curl.exe -s http://127.0.0.1:3000/api/auth/config
Write-Host ""
Write-Host "--- Testing /api/auth/session Origin Check ---"
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/session -H "Origin: https://lerno.codeemy.in" -H "Content-Type: application/json" -d "{}"
