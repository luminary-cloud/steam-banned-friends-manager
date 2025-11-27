<#
.SYNOPSIS
    Package the extension into Chrome and Firefox zip archives (Windows PowerShell version).
.DESCRIPTION
    Mirrors logic of compile.sh. Creates Banchecker_Chrome_<version>.zip from original manifest.
    Then modifies manifest for Firefox (adds browser_specific_settings and converts background.service_worker
    to background.scripts array) and produces Banchecker_Firefox_<version>.zip.
.PARAMETER DryRun
    If specified, shows intended actions without creating zips or writing Firefox-modified manifest.
#>
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[+] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "[i] $msg" -ForegroundColor Gray }

# Create zip archives using Unix-style forward slashes for entry names (required by AMO)
Add-Type -AssemblyName System.IO.Compression.FileSystem
function New-ZipWithUnixPaths {
    param(
        [Parameter(Mandatory=$true)][string]$SourceDir,
        [Parameter(Mandatory=$true)][string]$ZipPath
    )
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    $fileMode = [System.IO.FileMode]::Create
    $fs = [System.IO.File]::Open($ZipPath, $fileMode)
    try {
        $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        $base = (Resolve-Path $SourceDir).Path
        Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
            $full = $_.FullName
            # Build relative path and strip any leading slashes/backslashes using regex
            $rel = $full.Substring($base.Length) -replace '^[\\/]+',''
            $unixRel = $rel -replace '\\','/'
            $entry = $zip.CreateEntry($unixRel, [System.IO.Compression.CompressionLevel]::Optimal)
            $inStream = [System.IO.File]::OpenRead($full)
            $outStream = $entry.Open()
            try {
                $inStream.CopyTo($outStream)
            } finally {
                $inStream.Dispose(); $outStream.Dispose()
            }
        }
    } finally {
        $zip.Dispose(); $fs.Dispose()
    }
}

# --- Extract version from manifest.json ---
$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
if (!(Test-Path $manifestPath)) { throw "manifest.json not found at $manifestPath" }

$manifestJson = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifestJson.version
if (-not $version) { throw 'Version field missing in manifest.json' }
Write-Step "Friend Ban Manager version: $version"

# --- Prepare temp working directory ---
$tempDir = Join-Path $PSScriptRoot 'temp'
if (Test-Path $tempDir) {
    Write-Warn "Existing temp directory found; removing it first"
    Remove-Item $tempDir -Recurse -Force
}
Write-Step "Creating temp directory"
New-Item -ItemType Directory -Path $tempDir | Out-Null

# --- Copy JS files ---
Write-Step "Copying top-level .js files"
$jsFiles = Get-ChildItem -Path $PSScriptRoot -Filter '*.js' -File
foreach ($f in $jsFiles) {
    Write-Info "Copy $($f.Name)"
    Copy-Item $f.FullName -Destination $tempDir
}

# --- Copy other resources ---
# Current project uses style.css and no options page
$copyList = @('style.css','manifest.json')
foreach ($item in $copyList) {
    $src = Join-Path $PSScriptRoot $item
    if (Test-Path $src) {
        Write-Info "Copy $item"
    Copy-Item $src -Destination $tempDir
    } else { Write-Warn "$item not found (skipping)" }
}

# --- Copy icons directory if present ---
$iconsSrc = Join-Path $PSScriptRoot 'icons'
if (Test-Path $iconsSrc) {
    Write-Info 'Copy icons directory'
    Copy-Item $iconsSrc -Destination (Join-Path $tempDir 'icons') -Recurse
} else {
    Write-Warn 'icons directory not found (skipping)'
}

# --- Create Chrome zip ---
$chromeZip = Join-Path $PSScriptRoot ("FriendBanManager_Chrome_${version}.zip")
Write-Step "Creating Chrome archive: $chromeZip"
if (-not $DryRun) {
    New-ZipWithUnixPaths -SourceDir $tempDir -ZipPath $chromeZip
} else {
    Write-Info "DryRun: would create Chrome zip $chromeZip"
}

# --- Modify manifest for Firefox ---
Write-Step 'Modifying manifest for Firefox'
$ffManifestPath = Join-Path $tempDir 'manifest.json'
$ffManifest = Get-Content $ffManifestPath -Raw | ConvertFrom-Json

# Add browser_specific_settings.gecko.id and data_collection_permissions
if (-not $ffManifest.PSObject.Properties.Name.Contains('browser_specific_settings')) {
    $ffManifest | Add-Member -MemberType NoteProperty -Name 'browser_specific_settings' -Value ([pscustomobject]@{ 
        gecko = [pscustomobject]@{ 
            id = 'cloud@luminary.ovh'
            data_collection_permissions = [pscustomobject]@{
                required = @('none')
            }
        } 
    })
    Write-Info 'Added browser_specific_settings.gecko.id and data_collection_permissions'
} else {
    # Ensure gecko exists
    if (-not $ffManifest.browser_specific_settings.PSObject.Properties.Name.Contains('gecko')) {
        $ffManifest.browser_specific_settings | Add-Member -MemberType NoteProperty -Name 'gecko' -Value ([pscustomobject]@{})
    }
    # Ensure data_collection_permissions.required is set to ['none']
    if (-not $ffManifest.browser_specific_settings.gecko.PSObject.Properties.Name.Contains('data_collection_permissions')) {
        $ffManifest.browser_specific_settings.gecko | Add-Member -MemberType NoteProperty -Name 'data_collection_permissions' -Value ([pscustomobject]@{ required = @('none') })
    } else {
        $ffManifest.browser_specific_settings.gecko.data_collection_permissions = [pscustomobject]@{ required = @('none') }
    }
    Write-Info 'browser_specific_settings present; ensured gecko.data_collection_permissions.required=["none"]'
}

# Convert background.service_worker to background.scripts
if ($ffManifest.background -and $ffManifest.background.service_worker) {
    $sw = $ffManifest.background.service_worker
    $ffManifest.background.PSObject.Properties.Remove('service_worker') | Out-Null
    $ffManifest.background | Add-Member -MemberType NoteProperty -Name 'scripts' -Value @($sw)
    Write-Info 'Converted background.service_worker to background.scripts'
} else {
    Write-Warn 'background.service_worker not found to convert'
}

if (-not $DryRun) {
    ($ffManifest | ConvertTo-Json -Depth 10) | Set-Content -Path $ffManifestPath -Encoding UTF8
} else {
    Write-Info 'DryRun: would write modified Firefox manifest.json'
}

# --- Create Firefox zip ---
$firefoxZip = Join-Path $PSScriptRoot ("FriendBanManager_Firefox_${version}.zip")
Write-Step "Creating Firefox archive: $firefoxZip"
if (-not $DryRun) {
    New-ZipWithUnixPaths -SourceDir $tempDir -ZipPath $firefoxZip
} else {
    Write-Info "DryRun: would create Firefox zip $firefoxZip"
}

# --- Cleanup ---
Write-Step 'Cleanup temp directory'
Remove-Item $tempDir -Recurse -Force

Write-Step 'Done'
if ($DryRun) { Write-Warn 'DryRun enabled: no archives created and manifest not persisted for Firefox (simulated actions only).' }