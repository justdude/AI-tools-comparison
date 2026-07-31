<#
  Run every acceptance gate for a generated app and report a single verdict.

      powershell -File scripts\verify.ps1 [app-folder]

  Exit codes:
    0  every gate passed
    2  at least one gate failed  <- Claude Code treats exit 2 as blocking
    1  could not work out what to run (setup problem, deliberately non-blocking)
#>
param([string]$App = "")

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# ---------- locate the generated app ----------
if (-not $App) {
    if ((Test-Path package.json) -or (Get-ChildItem -Filter *.sln -ErrorAction SilentlyContinue)) {
        $App = "."
    } else {
        $cands = Get-ChildItem -Directory | Where-Object {
            $_.Name -notin @('node_modules', '.git', 'scripts', 'prompts', 'docs') -and
            ((Test-Path (Join-Path $_.FullName 'package.json')) -or
             (Get-ChildItem $_.FullName -Filter *.sln -ErrorAction SilentlyContinue))
        }
        if ($cands.Count -eq 1) { $App = $cands[0].Name }
        elseif ($cands.Count -eq 0) {
            Write-Host "verify: no app found. Generate one first, or pass the folder: powershell -File scripts\verify.ps1 orders-grid"
            exit 1
        } else {
            Write-Host "verify: more than one app here - pass the folder explicitly:"
            $cands | ForEach-Object { Write-Host "  $($_.Name)" }
            exit 1
        }
    }
}

if (-not (Test-Path $App -PathType Container)) { Write-Host "verify: '$App' is not a folder"; exit 1 }
Set-Location $App
Write-Host "verify: running gates in $(Get-Location)`n"

$passed = @(); $failed = @()

function Invoke-Gate([string]$Label, [scriptblock]$Body) {
    Write-Host "-- $Label"
    & $Body | Out-Host
    if ($LASTEXITCODE -eq 0) { $script:passed += $Label; Write-Host "   PASS  $Label`n" }
    else { $script:failed += $Label; Write-Host "   FAIL  $Label (exit $LASTEXITCODE)`n" }
}

function Test-NpmScript([string]$Name) {
    if (-not (Test-Path package.json)) { return $false }
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    return $null -ne $pkg.scripts.$Name
}

# ---------- Node app ----------
if (Test-Path package.json) {
    if (-not (Test-Path node_modules)) { Invoke-Gate "npm install" { npm install --no-audit --no-fund } }

    foreach ($g in @('typecheck', 'lint', 'test', 'check:clean', 'build')) {
        if (Test-NpmScript $g) { Invoke-Gate "npm run $g" { npm run $g --silent }.GetNewClosure() }
        else { Write-Host "-- npm run $g`n   SKIP  not defined in package.json`n" }
    }

    # A bare `eslint .` exits 0 on warnings, so a lint script without the flag is not a gate.
    if (Test-NpmScript 'lint') {
        $lint = (Get-Content package.json -Raw | ConvertFrom-Json).scripts.lint
        if ($lint -notmatch '--max-warnings[= ]0') {
            Write-Host "verify: WARNING - the 'lint' script has no --max-warnings 0, so it exits 0 on warnings."
            Write-Host "        That is not a gate. Fix package.json before trusting this run.`n"
            $failed += "lint script is missing --max-warnings 0"
        }
    }
}

# ---------- .NET app ----------
if ((Get-ChildItem -Filter *.sln -ErrorAction SilentlyContinue) -or
    (Get-ChildItem -Filter *.csproj -Recurse -Depth 2 -ErrorAction SilentlyContinue)) {
    Invoke-Gate "dotnet build -warnaserror" { dotnet build -warnaserror --nologo -v minimal }
    Invoke-Gate "dotnet test"               { dotnet test --nologo -v minimal }
}

# ---------- verdict ----------
Write-Host "========================================"
$passed | ForEach-Object { Write-Host "  PASS  $_" }
$failed | ForEach-Object { Write-Host "  FAIL  $_" }
Write-Host "========================================"

if ($failed.Count -gt 0) {
    Write-Host "`nNOT DONE. $($failed.Count) gate(s) failed. Fix the code - never the gate."
    Write-Host "Do not suppress a warning, weaken a test, or add 'as any' to get past this."
    exit 2
}

Write-Host "`nAll gates green. This is what 'finished' means."
exit 0
