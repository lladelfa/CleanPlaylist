<#
.SYNOPSIS
  Repeatable git / GitHub / worktree tasks for CleanPlaylist.
  Developer tooling only. Nothing here is part of the backend, frontend, or Vercel deploy.

.DESCRIPTION
  Commands:
    start      Create a worktree on feature/<name> from origin/master
    verify     Run the AGENTS.md checks (backend tests, frontend tests, lint, build)
    open-pr    Push the current feature branch and open a draft PR against master
    ready      Run verify, then mark a PR ready for review
    checkout-pr  Check out a PR's branch in its own worktree for review
    cleanup    Remove a merged branch's worktree, local branch, and remote branch
    status     Set a story's status in sprint-status.yaml (no commit)

.EXAMPLE
  tools\github\gh-workflow.ps1 start -Name 7-3-custom-preset-copy-accuracy
.EXAMPLE
  tools\github\gh-workflow.ps1 cleanup -Branch feature/7-2-preset-micro-copy-contract-test
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'verify', 'open-pr', 'ready', 'checkout-pr', 'cleanup', 'status')]
    [string]$Command,
    [string]$Name,
    [string]$Branch,
    [int]$Pr,
    [string]$Title,
    [string]$BodyFile,
    [string]$Key,
    [string]$Status
)

$script:BaseBranch = 'master'
$script:ClaudeAttribution = ([char]::ConvertFromUtf32(0x1F916)) + ' Generated with [Claude Code](https://claude.com/claude-code)'
$script:AllowedStatuses = @('backlog', 'in-progress', 'review', 'done', 'optional')
$script:SprintStatusRelPath = '_bmad-output\implementation-artifacts\sprint-status.yaml'
$script:WorktreeRelDir = '.claude\worktrees'

# ---------------------------------------------------------------------------
# Pure helpers (unit tested in tools/github/tests)
# ---------------------------------------------------------------------------

function Test-StoryBranchName {
    param([string]$Name)
    if ([string]::IsNullOrEmpty($Name)) { return $false }
    if ($Name -eq $script:BaseBranch) { return $false }
    return ($Name -cmatch '^[a-z0-9][a-z0-9-]*$')
}

function Test-PathUnder {
    # True when Path is strictly inside Root. Normalises separators and case, and
    # requires a trailing separator so "worktrees-evil" is not treated as under "worktrees".
    param([string]$Path, [string]$Root)
    $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $fullPath = [IO.Path]::GetFullPath($Path)
    return $fullPath.StartsWith($fullRoot, [StringComparison]::OrdinalIgnoreCase)
}

function Add-PrAttribution {
    param([string]$Body)
    if ($Body -match [regex]::Escape('Generated with [Claude Code]')) { return $Body }
    return ($Body.TrimEnd() + "`n`n" + $script:ClaudeAttribution)
}

function Set-SprintStoryStatus {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Status,
        [datetime]$Now = (Get-Date)
    )
    if ($script:AllowedStatuses -notcontains $Status) {
        throw "Unknown status '$Status'. Allowed: $($script:AllowedStatuses -join ', ')"
    }
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
    $keyPattern = '^\s+' + [regex]::Escape($Key) + ':'
    $index = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $keyPattern) { $index = $i; break }
    }
    if ($index -lt 0) { throw "Story key '$Key' not found in $Path" }
    $lines[$index] = $lines[$index] -replace '^(\s+[^:]+:)\s*\S+\s*$', ('$1 ' + $Status)
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^last_updated:') {
            $lines[$i] = 'last_updated: ' + $Now.ToString('MM-dd-yyyy HH:mm')
        }
    }
    Set-Content -LiteralPath $Path -Value $lines -Encoding UTF8
}

# Walks the tree without descending into reparse points (junctions, symlinks),
# so a recursive operation can never leave the directory it was asked to clean.
function Get-ReparsePointsIn {
    param([string]$Path)
    $found = New-Object System.Collections.Generic.List[string]
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($Path)
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        foreach ($entry in [IO.Directory]::GetFileSystemEntries($dir)) {
            $attributes = [IO.File]::GetAttributes($entry)
            if ($attributes -band [IO.FileAttributes]::ReparsePoint) {
                $found.Add($entry)
                continue
            }
            if ([IO.Directory]::Exists($entry)) { $stack.Push($entry) }
        }
    }
    # No comma operator: an empty array must come back as nothing, not as one empty array.
    $found.ToArray()
}

# ---------------------------------------------------------------------------
# Process wrappers
# ---------------------------------------------------------------------------

function Invoke-Git {
    $output = & git @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed (exit $LASTEXITCODE): $output"
    }
    return $output
}

function Test-GitSuccess {
    & git @args *> $null
    return ($LASTEXITCODE -eq 0)
}

function Get-RepoRoot {
    return ((& git rev-parse --show-toplevel) | Select-Object -First 1).Trim()
}

function Get-WorktreeList {
    # Parses `git worktree list --porcelain` into objects with Path and Branch.
    $items = @()
    $current = $null
    foreach ($line in (Invoke-Git worktree list --porcelain)) {
        if ($line -like 'worktree *') {
            if ($current) { $items += $current }
            $current = [pscustomobject]@{ Path = $line.Substring(9); Branch = $null }
        } elseif ($line -like 'branch refs/heads/*' -and $current) {
            $current.Branch = $line.Substring(18)
        }
    }
    if ($current) { $items += $current }
    return $items
}

function Get-MainCheckoutRoot {
    return (Get-WorktreeList | Select-Object -First 1).Path
}

function Get-WorktreeForBranch {
    param([string]$Branch)
    return (Get-WorktreeList | Where-Object { $_.Branch -eq $Branch } | Select-Object -First 1).Path
}

function Get-CurrentBranch {
    return ((Invoke-Git branch --show-current) | Select-Object -First 1).Trim()
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

function Invoke-Start {
    param([string]$Name)
    if (-not (Test-StoryBranchName -Name $Name)) {
        throw "Invalid name '$Name': use lowercase letters, digits, and hyphens, and not 'master'."
    }
    $branch = "feature/$Name"
    if (Test-GitSuccess show-ref --verify --quiet "refs/heads/$branch") {
        throw "Local branch $branch already exists."
    }
    Invoke-Git fetch origin $script:BaseBranch | Out-Null
    $path = Join-Path (Get-MainCheckoutRoot) (Join-Path $script:WorktreeRelDir $Name)
    Invoke-Git worktree add -b $branch $path "origin/$($script:BaseBranch)" | Out-Null
    Write-Host "Created $path on $branch from origin/$($script:BaseBranch)."
}

function Get-PythonExe {
    foreach ($root in @((Get-RepoRoot), (Get-MainCheckoutRoot))) {
        $candidate = Join-Path $root '.venv\Scripts\python.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'No .venv\Scripts\python.exe found in this worktree or the main checkout.'
}

function Invoke-Verify {
    $root = Get-RepoRoot
    if (-not (Test-Path -LiteralPath (Join-Path $root 'frontend\node_modules'))) {
        throw "frontend\node_modules is missing in $root. Run 'npm --prefix frontend ci' here first."
    }
    $python = Get-PythonExe
    $checks = @(
        @{ Name = 'backend tests';   Run = { $env:PYTHONPATH = 'backend'; & $python -m pytest backend/app/tests/ -q } },
        @{ Name = 'frontend tests';  Run = { npm --prefix frontend test } },
        @{ Name = 'frontend lint';   Run = { npm --prefix frontend run lint } },
        @{ Name = 'frontend build';  Run = { npm --prefix frontend run build } }
    )
    $failed = @()
    Push-Location $root
    try {
        foreach ($check in $checks) {
            $log = [IO.Path]::GetTempFileName()
            & $check.Run *> $log
            $code = $LASTEXITCODE
            if ($code -eq 0) {
                Write-Host ("PASS  " + $check.Name)
            } else {
                Write-Host ("FAIL  " + $check.Name + " (exit $code)")
                Get-Content -LiteralPath $log -Tail 15 | ForEach-Object { Write-Host "      $_" }
                $failed += $check.Name
            }
            Remove-Item -LiteralPath $log -Force
        }
    } finally {
        Pop-Location
    }
    if ($failed.Count -gt 0) { throw "Verification failed: $($failed -join ', ')" }
    Write-Host 'All checks passed.'
}

function Invoke-OpenPr {
    param([string]$Title, [string]$BodyFile)
    if (-not $Title) { throw 'open-pr needs -Title.' }
    $branch = Get-CurrentBranch
    if ($branch -eq $script:BaseBranch -or $branch -notmatch '^(feature|fix|chore)/') {
        throw "Current branch '$branch' is not a feature/, fix/, or chore/ branch. Refusing."
    }
    Invoke-Git push -u origin $branch | Out-Null
    $body = ''
    if ($BodyFile) { $body = Get-Content -LiteralPath $BodyFile -Raw }
    $tmp = [IO.Path]::GetTempFileName()
    try {
        Set-Content -LiteralPath $tmp -Value (Add-PrAttribution -Body $body) -Encoding UTF8
        gh pr create --base $script:BaseBranch --draft --title $Title --body-file $tmp
        if ($LASTEXITCODE -ne 0) { throw 'gh pr create failed.' }
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-Ready {
    param([int]$Pr)
    if ($Pr -le 0) { throw 'ready needs -Pr <number>.' }
    Invoke-Verify
    gh pr ready $Pr
    if ($LASTEXITCODE -ne 0) { throw "gh pr ready $Pr failed." }
}

function Invoke-CheckoutPr {
    param([int]$Pr)
    if ($Pr -le 0) { throw 'checkout-pr needs -Pr <number>.' }
    $branch = ((gh pr view $Pr --json headRefName --jq '.headRefName') | Select-Object -First 1).Trim()
    if (-not $branch) { throw "Could not read the branch for PR $Pr." }
    Invoke-Git fetch origin $branch | Out-Null
    $path = Join-Path (Get-MainCheckoutRoot) (Join-Path $script:WorktreeRelDir "pr-$Pr")
    if (Test-GitSuccess show-ref --verify --quiet "refs/heads/$branch") {
        Invoke-Git worktree add $path $branch | Out-Null
    } else {
        Invoke-Git worktree add --track -b $branch $path "origin/$branch" | Out-Null
    }
    Write-Host "PR $Pr is checked out at $path on $branch."
}

function Test-BranchMerged {
    # Only a merged PR counts. A fresh branch with no new commits is an ancestor of master,
    # so an ancestor check would wrongly call unfinished work "merged".
    param([string]$Branch)
    $merged = (gh pr list --head $Branch --state merged --json number --jq 'length') | Select-Object -First 1
    return ([int]$merged -gt 0)
}

function Remove-WorktreeSafely {
    param([string]$Path)
    $worktreeRoot = Join-Path (Get-MainCheckoutRoot) $script:WorktreeRelDir
    if (-not (Test-PathUnder -Path $Path -Root $worktreeRoot)) {
        throw "$Path is not under $worktreeRoot. Refusing to delete it."
    }
    $dirty = Invoke-Git -C $Path status --porcelain
    if ($dirty) { throw "Uncommitted or untracked changes in $Path. Refusing." }

    # The only link we expect is our own frontend/node_modules junction. Remove that
    # link with rmdir (no /s, so nothing is recursed into). Any other link stops the run.
    $nodeModules = [IO.Path]::GetFullPath((Join-Path $Path 'frontend\node_modules'))
    foreach ($link in (Get-ReparsePointsIn -Path $Path)) {
        if ([IO.Path]::GetFullPath($link) -ieq $nodeModules) {
            cmd /c rmdir "$link" | Out-Null
        } else {
            throw "Unexpected link $link in $Path. Refusing."
        }
    }
    if (@(Get-ReparsePointsIn -Path $Path).Count -gt 0) { throw "Links remain in $Path. Refusing." }

    if (-not (Test-GitSuccess worktree remove $Path)) {
        # Windows sometimes holds files for a moment and git reports that as "Permission denied".
        # Links are already gone, so a direct delete of this worktree directory is safe.
        Write-Warning 'git worktree remove failed; deleting the worktree directory directly.'
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    Invoke-Git worktree prune | Out-Null

    $commonDir = ((Invoke-Git rev-parse --git-common-dir) | Select-Object -First 1).Trim()
    $adminDir = Join-Path (Resolve-Path $commonDir).Path ('worktrees\' + (Split-Path $Path -Leaf))
    if (Test-Path -LiteralPath $adminDir) { Remove-Item -LiteralPath $adminDir -Recurse -Force }
}

function Invoke-Cleanup {
    param([string]$Branch)
    if (-not $Branch) { throw 'cleanup needs -Branch <name>.' }
    if ($Branch -eq $script:BaseBranch) { throw 'Refusing to clean up master.' }
    Invoke-Git fetch origin --prune | Out-Null
    if (-not (Test-BranchMerged -Branch $Branch)) {
        throw "$Branch has no merged PR. Refusing to clean it up."
    }
    $path = Get-WorktreeForBranch -Branch $Branch
    if ($path) { Remove-WorktreeSafely -Path $path; Write-Host "Removed worktree $path." }
    if (Test-GitSuccess show-ref --verify --quiet "refs/heads/$Branch") {
        Invoke-Git branch -d $Branch | Out-Null
        Write-Host "Deleted local branch $Branch."
    }
    if (Test-GitSuccess ls-remote --exit-code --heads origin $Branch) {
        Invoke-Git push origin --delete $Branch | Out-Null
        Write-Host "Deleted remote branch $Branch."
    }
    if ((Get-CurrentBranch) -eq $script:BaseBranch) {
        Invoke-Git pull --ff-only origin $script:BaseBranch | Out-Null
        Write-Host "Fast-forwarded $($script:BaseBranch)."
    }
}

function Invoke-StatusUpdate {
    param([string]$Key, [string]$Status)
    if (-not $Key -or -not $Status) { throw 'status needs -Key and -Status.' }
    $file = Join-Path (Get-RepoRoot) $script:SprintStatusRelPath
    Set-SprintStoryStatus -Path $file -Key $Key -Status $Status
    Write-Host "Set $Key to $Status in $script:SprintStatusRelPath (not committed)."
}

function Invoke-GhWorkflow {
    param(
        [string]$Command, [string]$Name, [string]$Branch, [int]$Pr,
        [string]$Title, [string]$BodyFile, [string]$Key, [string]$Status
    )
    switch ($Command) {
        'start'       { Invoke-Start -Name $Name }
        'verify'      { Invoke-Verify }
        'open-pr'     { Invoke-OpenPr -Title $Title -BodyFile $BodyFile }
        'ready'       { Invoke-Ready -Pr $Pr }
        'checkout-pr' { Invoke-CheckoutPr -Pr $Pr }
        'cleanup'     { Invoke-Cleanup -Branch $Branch }
        'status'      { Invoke-StatusUpdate -Key $Key -Status $Status }
        default       { Write-Host 'Usage: gh-workflow.ps1 <start|verify|open-pr|ready|checkout-pr|cleanup|status> [options]' }
    }
}

# Run only when executed directly, not when the tests dot-source this file.
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-GhWorkflow -Command $Command -Name $Name -Branch $Branch -Pr $Pr `
        -Title $Title -BodyFile $BodyFile -Key $Key -Status $Status
}
