# release.ps1 - pushes whatever changed locally to a given branch, safely.
#
# Usage (run from inside the devtoolbox folder, or anywhere -- it cd's to its own location):
#   .\release.ps1 -Branch development -Message "CR#1: light mode toggle, trust badge"
#
# What it does:
#   1. Fetches and syncs the target branch so you're never pushing on top of stale history.
#   2. Shows you exactly which files changed (git's own diff, not a guess).
#   3. Asks for confirmation before committing/pushing anything.
#   4. Commits everything changed and pushes to the branch you named.
#
# This only pushes to development/staging/main directly. Promoting staging -> main should
# still go through a GitHub pull request (that's what triggers the CI check) -- this script
# is for getting your local edits onto a branch, not for the promotion step itself.
#
# Note: this script deliberately does NOT set $ErrorActionPreference = "Stop". git writes a
# lot of normal, non-error status text to stderr (branch switches, push progress, etc.), and
# under "Stop" that text can get treated as a fatal error, silently killing the script partway
# through -- which is exactly what happened the first time this script was used. Instead, every
# git command below is checked explicitly via $LASTEXITCODE.

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('development', 'staging', 'main')]
    [string]$Branch,

    [Parameter(Mandatory = $true)]
    [string]$Message
)

function Invoke-GitStep {
    param(
        [string]$Description,
        [scriptblock]$Command
    )
    Write-Host $Description -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $Description (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Set-Location $PSScriptRoot

# Sanity check: are we actually inside a git repo?
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "This folder isn't a git repository yet. See the one-time setup steps before using this script." -ForegroundColor Red
    exit 1
}

# One-time identity check, since git refuses to commit without this.
$hasEmail = git config user.email
if (-not $hasEmail) {
    Write-Host "Git doesn't know who you are yet. Run these once, then re-run this script:" -ForegroundColor Red
    Write-Host '  git config --global user.email "you@example.com"' -ForegroundColor Yellow
    Write-Host '  git config --global user.name "Your Name"' -ForegroundColor Yellow
    exit 1
}

Invoke-GitStep "Fetching latest from origin..." { git fetch origin }
Invoke-GitStep "Switching to '$Branch'..." { git checkout $Branch }
Invoke-GitStep "Syncing '$Branch' with origin..." { git pull origin $Branch }

Write-Host "`n--- Changed files ---" -ForegroundColor Cyan
git status --short

$changed = git status --porcelain
if (-not $changed) {
    Write-Host "No local changes to push. Nothing to do." -ForegroundColor Yellow
    exit 0
}

$confirm = Read-Host "`nPush these changes to '$Branch'? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Aborted -- nothing was committed or pushed." -ForegroundColor Yellow
    exit 0
}

Invoke-GitStep "Staging changes..." { git add -A }
Invoke-GitStep "Committing..." { git commit -m $Message }
Invoke-GitStep "Pushing to origin/$Branch..." { git push origin $Branch }

# Confirm the push actually moved the remote branch, not just "everything up to date".
$remoteHead = git rev-parse "origin/$Branch"
$localHead = git rev-parse HEAD
if ($remoteHead -ne $localHead) {
    Write-Host "`nWarning: origin/$Branch ($remoteHead) does not match local HEAD ($localHead) after push. Something's off -- check 'git status' and 'git log' manually." -ForegroundColor Red
    exit 1
}

Write-Host "`nPushed to '$Branch' -- origin/$Branch is now at $localHead." -ForegroundColor Green
if ($Branch -eq 'staging' -or $Branch -eq 'main') {
    Write-Host "Check the Actions tab on GitHub to watch the CI run." -ForegroundColor Green
}
