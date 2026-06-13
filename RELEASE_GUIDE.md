# Release Guide

## Publishing a New Version

### 1. Bump version in `package.json`

```json
"version": "1.0.13"
```

### 2. Build the release ZIP

The ZIP must contain all project source files **excluding** the following preserved paths:

```
data/
.env
ssl/
backup/
node_modules/
.git/
.specify/
specs/
```

**PowerShell command** (run from repo root):

```powershell
$version = (Get-Content package.json | ConvertFrom-Json).version
$zipName = "laundry-v$version.zip"
$exclude = @('data','ssl','backup','node_modules','.git','.specify','specs','.env','.env.*')

$files = Get-ChildItem -Path . -Force | Where-Object { $_.Name -notin $exclude -and $_.Name -notlike '.env*' }
Compress-Archive -Path $files.FullName -DestinationPath $zipName -Force
Write-Host "Created: $zipName"
```

### 3. Generate SHA256 checksum

```powershell
$hash = (Get-FileHash $zipName -Algorithm SHA256).Hash.ToLower()
"$hash  $zipName" | Set-Content sha256sums.txt -Encoding UTF8
Write-Host "Checksum: $hash"
```

### 4. Create the GitHub Release

1. Go to https://github.com/alaaelmorsy/Laundry/releases/new
2. Tag: `v{VERSION}` (e.g. `v1.0.13`)
3. Title: `v{VERSION}`
4. Write release notes in the body
5. Upload **both** assets:
   - `laundry-v{VERSION}.zip`
   - `sha256sums.txt`
6. Publish the release

### 5. Verify

After publishing, open the app → Settings → التحديثات → فحص التحديثات and confirm the new version is detected.

---

## Asset Naming Convention

| File | Description |
|------|-------------|
| `laundry-v{VERSION}.zip` | Full source archive (no preserved paths) |
| `sha256sums.txt` | One line: `{sha256_hex}  laundry-v{VERSION}.zip` |

The version string must match `package.json` exactly (no leading `v` in package.json, but the GitHub tag must have `v` prefix).
