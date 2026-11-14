# PowerShell script for NASA LOLA Data Download & Verification (HUM-02)
[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [switch]$Download,
    [switch]$DemOnly,
    [string]$OutDir
)

$ErrorActionPreference = "Stop"

$Datasets = @(
    @{
        Name = "LDEM_80S_80MPP_ADJ.TIF"
        Url = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF"
        ExpectedBytes = 189158392
        Description = "LOLA Adjusted DEM (80m/px, 80°S-90°S)"
    },
    @{
        Name = "LDEM_80S_80MPP_ADJ_HILL.TIF"
        Url = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF"
        ExpectedBytes = 88474342
        Description = "LOLA Hillshade (80m/px, 45° alt, 45° az)"
    }
)

if (-not $OutDir) {
    if ($env:LUNAR_DATA_DIR) {
        $OutDir = $env:LUNAR_DATA_DIR
    } elseif ($env:LUNAR_DEM_PATH) {
        $OutDir = Split-Path -Parent $env:LUNAR_DEM_PATH
    } else {
        $OutDir = Join-Path $PSScriptRoot "..\raw"
    }
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "Lunar Landing Site Navigator — NASA LOLA Data Tools (HUM-02)" -ForegroundColor Cyan
Write-Host "Target directory: $OutDir" -ForegroundColor DarkGray
Write-Host ("=" * 70) -ForegroundColor Cyan

$Targets = if ($DemOnly) { $Datasets[0..0] } else { $Datasets }

if ($VerifyOnly -or (-not $Download)) {
    Write-Host "`nRunning remote server check..." -ForegroundColor Yellow
    foreach ($item in $Targets) {
        Write-Host "`n[CHECK] Probing: $($item.Name)..." -ForegroundColor White
        try {
            $req = [System.Net.HttpWebRequest]::Create($item.Url)
            $req.Method = "HEAD"
            $req.UserAgent = "ByteForce-LunarNavigator/1.0"
            $resp = $req.GetResponse()
            $len = $resp.ContentLength
            $lastMod = $resp.LastModified
            $resp.Close()

            Write-Host "  Remote size:    $([string]::Format('{0:N0}', $len)) bytes ($([math]::Round($len/1MB, 2)) MB)"
            Write-Host "  Expected size:  $([string]::Format('{0:N0}', $item.ExpectedBytes)) bytes"
            Write-Host "  Last-Modified:  $lastMod"
            if ($len -eq $item.ExpectedBytes) {
                Write-Host "  -> MATCH: File verified on NASA servers!" -ForegroundColor Green
            } else {
                Write-Host "  -> [WARN] Size mismatch!" -ForegroundColor Red
            }
        } catch {
            Write-Host "  [ERROR] Check failed: $_" -ForegroundColor Red
        }
    }

    if (-not $Download) {
        Write-Host "`nTo download these files, run: .\data\scripts\download_data.ps1 -Download" -ForegroundColor Yellow
        exit 0
    }
}

if ($Download) {
    if (-not (Test-Path $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    }

    foreach ($item in $Targets) {
        $dest = Join-Path $OutDir $item.Name
        if ((Test-Path $dest) -and ((Get-Item $dest).Length -eq $item.ExpectedBytes)) {
            Write-Host "`n[EXISTS] $dest already downloaded." -ForegroundColor Green
            continue
        }

        Write-Host "`n[DOWNLOADING] $($item.Name) from $($item.Url)..." -ForegroundColor White
        curl.exe -L --progress-bar $item.Url -o $dest
        if ((Test-Path $dest) -and ((Get-Item $dest).Length -eq $item.ExpectedBytes)) {
            Write-Host "-> Success! Saved to $dest" -ForegroundColor Green
        } else {
            Write-Host "-> [ERROR] Download incomplete or corrupt!" -ForegroundColor Red
        }
    }
}
