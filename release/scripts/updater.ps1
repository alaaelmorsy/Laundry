param(
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$ZipPath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$AppRoot
)

$StatusFile  = Join-Path $AppRoot "data\update-status.json"
$LogFile     = Join-Path $AppRoot "data\update-log.txt"
$MigrateJs   = Join-Path $AppRoot "migrate.js"
$ServerJs    = Join-Path $AppRoot "server\index.js"

# Paths that must NEVER be overwritten
$PRESERVE = @('data', '.env', 'ssl', 'backup', 'node_modules', '.git', '.specify', 'specs')

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Set-UpdateResult {
  param([string]$Status, [string]$FromVersion, [string]$ToVersion)
  try {
    $obj = @{}
    if (Test-Path $StatusFile) {
      $raw = Get-Content $StatusFile -Raw -Encoding UTF8
      $obj = $raw | ConvertFrom-Json
      $hash = @{}
      $obj.PSObject.Properties | ForEach-Object { $hash[$_.Name] = $_.Value }
      $obj = $hash
    }
    $obj['lastUpdateResult'] = @{
      status      = $Status
      fromVersion = $FromVersion
      toVersion   = $ToVersion
      timestamp   = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')
    }
    if ($Status -eq 'success') { $obj['hasUpdate'] = $false }
    $obj | ConvertTo-Json -Depth 5 | Set-Content -Path $StatusFile -Encoding UTF8
  } catch {
    Write-Log 'WARN' "Could not write status file: $_"
  }
}

function Start-AppServer {
  Write-Log 'INFO' 'Starting app server...'
  # Wait for port to be free
  Start-Sleep -Seconds 3
  $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $nodeExe) { $nodeExe = 'node' }
  Start-Process -FilePath $nodeExe -ArgumentList "`"$ServerJs`"" -WorkingDirectory $AppRoot -WindowStyle Normal
}

# ── Read package.json for fromVersion ────────────────────────────────────────
$fromVersion = 'unknown'
try {
  $pkgPath = Join-Path $AppRoot 'package.json'
  $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $fromVersion = $pkg.version
} catch {}

Write-Log 'INFO' "Updater started: from=$fromVersion to=$TargetVersion pid=$ServerPid"

# ── Step 1: Wait for server process to exit ───────────────────────────────────
Write-Log 'INFO' "Waiting for server PID $ServerPid to exit..."
$timeout = 30
$elapsed = 0
while ($elapsed -lt $timeout) {
  $proc = Get-Process -Id $ServerPid -ErrorAction SilentlyContinue
  if (-not $proc) { break }
  Start-Sleep -Milliseconds 500
  $elapsed += 0.5
}
if ($elapsed -ge $timeout) {
  Write-Log 'WARN' "Server PID $ServerPid did not exit within ${timeout}s, forcing kill"
  try { Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 1
}
Write-Log 'INFO' 'Server process exited'

# ── Step 2: Extract ZIP skipping preserved paths ──────────────────────────────
Write-Log 'INFO' "Extracting $ZipPath to $AppRoot"
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  foreach ($entry in $zip.Entries) {
    # skip directory entries and preserved paths
    $relPath = $entry.FullName.Replace('/', '\')
    $topDir  = ($relPath -split '\\')[0]
    if ($PRESERVE -contains $topDir) { continue }
    if ($relPath.EndsWith('\')) { continue }
    if ($entry.Name -eq '.env') { continue }

    $destFile = Join-Path $AppRoot $relPath
    $destDir  = Split-Path $destFile -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
  }
  $zip.Dispose()
  Write-Log 'INFO' 'Files replaced successfully'
} catch {
  Write-Log 'ERROR' "File extraction failed: $_"
  # Rollback
  Write-Log 'INFO' 'Starting rollback: restoring source files'
  try {
    $srcBackup = Join-Path $BackupPath 'source'
    if (Test-Path $srcBackup) {
      Get-ChildItem -Path $srcBackup | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $AppRoot $_.Name) -Recurse -Force
      }
      Write-Log 'INFO' 'Source files restored from backup'
    }
  } catch { Write-Log 'ERROR' "Restore failed: $_" }
  Set-UpdateResult 'rollback' $fromVersion $TargetVersion
  Start-AppServer
  exit 1
}

# Delete temp zip
try { Remove-Item -Path $ZipPath -Force -ErrorAction SilentlyContinue } catch {}

# ── Step 3: Run DB migration ──────────────────────────────────────────────────
Write-Log 'INFO' 'Running DB migration...'
try {
  $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $nodeExe) { $nodeExe = 'node' }
  $proc = Start-Process -FilePath $nodeExe -ArgumentList "`"$MigrateJs`"" -WorkingDirectory $AppRoot -Wait -PassThru -WindowStyle Hidden
  if ($proc.ExitCode -ne 0) { throw "migrate.js exited with code $($proc.ExitCode)" }
  Write-Log 'INFO' 'DB migration complete'
} catch {
  Write-Log 'ERROR' "DB migration failed: $_"
  # Rollback files + DB
  Write-Log 'INFO' 'Starting rollback: restoring source files and DB'
  try {
    $srcBackup = Join-Path $BackupPath 'source'
    if (Test-Path $srcBackup) {
      Get-ChildItem -Path $srcBackup | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $AppRoot $_.Name) -Recurse -Force
      }
      Write-Log 'INFO' 'Source files restored from backup'
    }
    $dbBackup = Join-Path $BackupPath 'db-backup.sql'
    if (Test-Path $dbBackup) {
      $envPath = Join-Path $AppRoot '.env'
      $dbHost = 'localhost'; $dbPort = '3306'; $dbUser = 'root'; $dbPass = ''; $dbName = 'laundry'
      if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
          if ($_ -match '^DB_HOST=(.+)$')     { $dbHost = $Matches[1].Trim() }
          if ($_ -match '^DB_PORT=(.+)$')     { $dbPort = $Matches[1].Trim() }
          if ($_ -match '^DB_USER=(.+)$')     { $dbUser = $Matches[1].Trim() }
          if ($_ -match '^DB_PASS(?:WORD)?=(.+)$') { $dbPass = $Matches[1].Trim() }
          if ($_ -match '^DB_NAME=(.+)$')     { $dbName = $Matches[1].Trim() }
        }
      }
      $mysqlArgs = "--host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPass $dbName"
      $mysqlInput = Get-Content $dbBackup -Raw
      try {
        $mysqlInput | & mysql --host=$dbHost --port=$dbPort --user=$dbUser "--password=$dbPass" $dbName 2>$null
        Write-Log 'INFO' 'DB restored from backup'
      } catch { Write-Log 'WARN' "mysql restore failed: $_" }
    }
  } catch { Write-Log 'ERROR' "Rollback failed: $_" }
  Set-UpdateResult 'rollback' $fromVersion $TargetVersion
  Start-AppServer
  exit 1
}

# ── Step 4: Success ───────────────────────────────────────────────────────────
# Delete backup to reclaim disk space
try { Remove-Item -Path $BackupPath -Recurse -Force -ErrorAction SilentlyContinue } catch {}

Set-UpdateResult 'success' $fromVersion $TargetVersion
Write-Log 'INFO' "Update complete: $fromVersion -> $TargetVersion"

Start-AppServer
exit 0
