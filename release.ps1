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

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('development', 'staging', 'main')]
    [string]$Branch,

    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

# Sanity check: are we actually inside a git repo?
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "This folder isn't a git repository yet. See the one-time setup steps before using this script." -ForegroundColor Red
    exit 1
}

Write-Host "Fetching latest from origin..." -ForegroundColor Cyan
git fetch origin

Write-Host "Switching to '$Branch' and syncing with origin..." -ForegroundColor Cyan
git checkout $Branch
git pull origin $Branch

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

git add -A
git commit -m $Message
git push origin $Branch

Write-Host "`nPushed to '$Branch'." -ForegroundColor Green
if ($Branch -eq 'staging' -or $Branch -eq 'main') {
    Write-Host "Check the Actions tab on GitHub to watch the CI run." -ForegroundColor Green
}
