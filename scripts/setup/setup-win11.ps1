#Requires -Version 5.1
# WhiteLab Windows 11 setup - documentation: docs/tr/KURULUM-WIN11.md

param(
    [ValidateSet("check", "tools", "local", "testnet", "full")]
    [string]$Phase = "local",
    [switch]$InstallTools,
    [switch]$SkipTests,
    [switch]$StartPreview,
    [switch]$StartDevServer
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MinNodeMajor = 18
$RecommendedNodeMajor = 20
$LogFile = Join-Path $ProjectRoot "setup-win11.log"

function Write-Step {
    param([string]$Message)
    $line = "==> $Message"
    Write-Host $line -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + " " + $line)
}

function Write-Ok {
    param([string]$Message)
    Write-Host ("    OK  " + $Message) -ForegroundColor Green
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host ("    !!  " + $Message) -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host ("    XX  " + $Message) -ForegroundColor Red
    throw $Message
}

function Refresh-PathEnv {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $machine + ";" + $user
}

function Test-Cmd {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeMajorVersion {
    if (-not (Test-Cmd "node")) { return $null }
    $raw = (node -v).TrimStart("v")
    return [int]$raw.Split(".")[0]
}

function Invoke-Npm {
    param(
        [string]$Command,
        [string]$Label
    )
    if (-not $Label) { $Label = $Command }
    Write-Step $Label
    Push-Location $ProjectRoot
    try {
        $tokens = $Command.Split(" ", 2, [StringSplitOptions]::RemoveEmptyEntries)
        if ($tokens.Length -eq 1) {
            & npm.cmd $tokens[0]
        } else {
            & npm.cmd $tokens[0] $tokens[1]
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Err ("npm failed: " + $Command + " (exit " + $LASTEXITCODE + ")")
        }
    } finally {
        Pop-Location
    }
}

function Install-WithWinget {
    param(
        [string]$PackageId,
        [string]$Title
    )
    if (-not (Test-Cmd "winget")) {
        Write-WarnLine ("winget missing - install " + $Title + " manually")
        return $false
    }
    Write-Step ("Installing " + $Title)
    & winget install --id $PackageId -e --accept-package-agreements --accept-source-agreements
    Refresh-PathEnv
    return ($LASTEXITCODE -eq 0)
}

function Ensure-DotEnv {
    param([switch]$Required)
    $envPath = Join-Path $ProjectRoot ".env"
    $examplePath = Join-Path $ProjectRoot ".env.example"
    if (Test-Path $envPath) {
        Write-Ok ".env exists"
        return
    }
    if (-not $Required) {
        Write-Ok "No .env (OK for local Hardhat - uses default test key)"
        return
    }
    if (-not (Test-Path $examplePath)) {
        Write-WarnLine ".env.example not found"
        return
    }
    Copy-Item $examplePath $envPath
    Write-Ok "Created .env from .env.example"
    Write-WarnLine "Fill PRIVATE_KEY, ETHERSCAN_API_KEY, TREASURY_ADDRESS before testnet deploy"
}

function Show-PrereqReport {
    Write-Host ""
    Write-Host "=== WhiteLab prerequisite report ===" -ForegroundColor White

    $nodeMajor = Get-NodeMajorVersion
    if ($nodeMajor) { Write-Ok ("Node: " + (node -v)) } else { Write-WarnLine "Node: MISSING" }
    if (Test-Cmd "npm") { Write-Ok ("npm: " + (npm -v)) } else { Write-WarnLine "npm: MISSING" }
    if (Test-Cmd "git") { Write-Ok ("Git: " + (git --version)) } else { Write-WarnLine "Git: MISSING (needed for GitHub/Cloudflare)" }
    if (Test-Cmd "winget") { Write-Ok "winget: available" } else { Write-WarnLine "winget: MISSING" }

    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pyCmd -and ($pyCmd.Source -notmatch "WindowsApps")) {
        Write-Ok ("Python: " + (python --version 2>&1 | Out-String).Trim())
    } else {
        Write-WarnLine "Python: optional (Slither) - not installed"
    }

    if (Test-Cmd "gh") { Write-Ok "gh: available" } else { Write-WarnLine "gh: optional (GitHub CLI)" }

    if (-not $nodeMajor) {
        Write-Err "Node.js required. Install: winget install OpenJS.NodeJS.LTS"
    }
    if ($nodeMajor -lt $MinNodeMajor) {
        Write-Err ("Node.js >= " + $MinNodeMajor + " required")
    }
    if ($nodeMajor -ne $RecommendedNodeMajor) {
        Write-WarnLine ("CI uses Node " + $RecommendedNodeMajor + "; you have Node " + $nodeMajor)
    }
}

function Install-Prerequisites {
    $doInstall = $InstallTools -or ($Phase -eq "tools") -or ($Phase -eq "full")
    if (-not $doInstall) {
        Write-WarnLine "Run with -InstallTools to auto-install Git via winget"
        return
    }
    if (-not (Test-Cmd "git")) {
        Install-WithWinget -PackageId "Git.Git" -Title "Git"
    } else {
        Write-Ok "Git already installed"
    }
    if (-not (Test-Cmd "node")) {
        Install-WithWinget -PackageId "OpenJS.NodeJS.LTS" -Title "Node.js LTS"
    } else {
        Write-Ok "Node already installed"
    }
    Refresh-PathEnv
}

function Invoke-LocalSetup {
    Ensure-DotEnv -Required:$false
    Invoke-Npm -Command "install" -Label "npm install"
    Invoke-Npm -Command "run compile" -Label "Hardhat compile"
    if (-not $SkipTests) {
        Invoke-Npm -Command "test" -Label "Hardhat tests (expect 50 passing)"
        Invoke-Npm -Command "run e2e:local" -Label "Local E2E"
    } else {
        Write-WarnLine "Skipped tests (-SkipTests)"
    }
    Invoke-Npm -Command "run deploy:local:demo" -Label "Local demo deploy"
    Invoke-Npm -Command "run build:site" -Label "Build static site (dist/)"
}

function Invoke-TestnetSetup {
    Ensure-DotEnv -Required
    $envPath = Join-Path $ProjectRoot ".env"
    if (-not (Test-Path $envPath)) {
        Write-Err ".env required for testnet. Fill keys then re-run -Phase testnet"
    }
    Write-Step "Validate .env for Base Sepolia"
    Push-Location $ProjectRoot
    try {
        & npm.cmd run env:check
        if ($LASTEXITCODE -ne 0) {
            Write-Err "env:check failed - fix .env (PRIVATE_KEY, RPC, ETHERSCAN_API_KEY, TREASURY)"
        }
    } finally {
        Pop-Location
    }
    Invoke-Npm -Command "run deploy:sepolia:demo" -Label "Deploy Base Sepolia demo"
    Invoke-Npm -Command "run verify" -Label "Basescan verify"
    Invoke-Npm -Command "run build:site" -Label "Rebuild site with live addresses"
}

function Show-MarketSteps {
    Write-Host ""
    Write-Host "=== Next steps (go live) ===" -ForegroundColor Magenta
    Write-Host "Local preview:  npm run preview:site"
    Write-Host "  http://127.0.0.1:4173/       marketing"
    Write-Host "  http://127.0.0.1:4173/app    protocol console"
    Write-Host "  http://127.0.0.1:4173/legal  legal"
    Write-Host ""
    Write-Host "GitHub:  git init, commit, push (install Git first)"
    Write-Host "Cloudflare Pages: build=npm run build:site, output=dist, Node 20"
    Write-Host "Sepolia: fill .env, faucet ETH, .\scripts\setup\setup-win11.ps1 -Phase testnet"
    Write-Host "Guides: docs/tr/KURULUM-WIN11.md, docs/tr/GO-LIVE.md, docs/tr/SENIN-ADIMLAR.md"
    Write-Host ""
}

# --- Main ---
try {
    if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
    Set-Location $ProjectRoot
    Write-Step ("WhiteLab setup phase=" + $Phase)

    Show-PrereqReport

    switch ($Phase) {
        "check" {
            Show-MarketSteps
            exit 0
        }
        "tools" {
            Install-Prerequisites
            Refresh-PathEnv
            Show-PrereqReport
            Show-MarketSteps
            exit 0
        }
        "local" {
            Invoke-LocalSetup
        }
        "testnet" {
            Invoke-LocalSetup
            Invoke-TestnetSetup
        }
        "full" {
            Install-Prerequisites
            Invoke-LocalSetup
            $envPath = Join-Path $ProjectRoot ".env"
            if (Test-Path $envPath) {
                $raw = Get-Content $envPath -Raw
                if (($raw -notmatch "your_private_key") -and ($raw -match "PRIVATE_KEY=\S+")) {
                    try { Invoke-TestnetSetup } catch { Write-WarnLine $_.Exception.Message }
                } else {
                    Write-WarnLine "Testnet skipped - .env keys not configured"
                }
            }
        }
    }

    Show-MarketSteps

    if ($StartPreview) {
        Write-Step "Starting preview server (Ctrl+C to stop)"
        Push-Location $ProjectRoot
        try { & npm.cmd run preview:site } finally { Pop-Location }
    } elseif ($StartDevServer) {
        Write-Step "Starting dev server (Ctrl+C to stop)"
        Push-Location $ProjectRoot
        try { & npm.cmd run start } finally { Pop-Location }
    }

    Write-Ok ("Done. Log: " + $LogFile)
} catch {
    Write-Err $_.Exception.Message
}
