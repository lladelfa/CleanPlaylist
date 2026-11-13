# Pester 3 tests for tools/github/gh-workflow.ps1 pure helpers.
# Run from repo root: powershell -NoProfile -Command "Invoke-Pester tools/github/tests"
# No network, no gh/git calls: only helpers that operate on strings and local temp files.

$script = Join-Path $PSScriptRoot '..\gh-workflow.ps1'
. $script

Describe 'Test-StoryBranchName' {
    It 'accepts lowercase kebab-case story names' {
        Test-StoryBranchName -Name '7-2-preset-micro-copy-contract-test' | Should Be $true
    }
    It 'rejects uppercase, spaces, slashes and empty names' {
        Test-StoryBranchName -Name 'Master' | Should Be $false
        Test-StoryBranchName -Name 'has space' | Should Be $false
        Test-StoryBranchName -Name '../escape' | Should Be $false
        Test-StoryBranchName -Name '' | Should Be $false
    }
    It 'rejects names that start with a hyphen' {
        Test-StoryBranchName -Name '-leading' | Should Be $false
    }
}

Describe 'Add-PrAttribution' {
    It 'appends the Claude Code line to a body that lacks it' {
        $result = Add-PrAttribution -Body 'Summary'
        $result | Should Match 'Generated with \[Claude Code\]'
        $result | Should Match '^Summary'
    }
    It 'does not add the line twice' {
        $once = Add-PrAttribution -Body 'Summary'
        $twice = Add-PrAttribution -Body $once
        ([regex]::Matches($twice, 'Generated with \[Claude Code\]').Count) | Should Be 1
    }
}

Describe 'Set-SprintStoryStatus' {
    $fixture = @"
generated: 11-06-2026 10:39
last_updated: 11-13-2026 12:30
development_status:
  epic-7: in-progress
  7-1-telemetry-rate-limiting-payload-bounds: done
  7-2-preset-micro-copy-contract-test: review
"@

    It 'sets the status of an existing story key and bumps last_updated' {
        $path = Join-Path $TestDrive 'sprint.yaml'
        Set-Content -LiteralPath $path -Value $fixture -Encoding UTF8
        Set-SprintStoryStatus -Path $path -Key '7-2-preset-micro-copy-contract-test' -Status 'done'
        $text = Get-Content -LiteralPath $path -Raw
        $text | Should Match '7-2-preset-micro-copy-contract-test: done'
        $text | Should Not Match '7-2-preset-micro-copy-contract-test: review'
        $text | Should Not Match 'last_updated: 11-13-2026 12:30'
    }
    It 'leaves other story lines untouched' {
        $path = Join-Path $TestDrive 'sprint2.yaml'
        Set-Content -LiteralPath $path -Value $fixture -Encoding UTF8
        Set-SprintStoryStatus -Path $path -Key '7-2-preset-micro-copy-contract-test' -Status 'done'
        (Get-Content -LiteralPath $path -Raw) | Should Match '7-1-telemetry-rate-limiting-payload-bounds: done'
    }
    It 'throws when the story key is missing' {
        $path = Join-Path $TestDrive 'sprint3.yaml'
        Set-Content -LiteralPath $path -Value $fixture -Encoding UTF8
        $threw = $false
        try { Set-SprintStoryStatus -Path $path -Key '9-9-missing' -Status 'done' } catch { $threw = $true }
        $threw | Should Be $true
    }
    It 'throws on an unrecognised status' {
        $path = Join-Path $TestDrive 'sprint4.yaml'
        Set-Content -LiteralPath $path -Value $fixture -Encoding UTF8
        $threw = $false
        try { Set-SprintStoryStatus -Path $path -Key '7-1-telemetry-rate-limiting-payload-bounds' -Status 'finished' } catch { $threw = $true }
        $threw | Should Be $true
    }
}

Describe 'Test-PathUnder' {
    It 'accepts a child path even when separators differ' {
        Test-PathUnder -Path 'C:/repo/.claude/worktrees/x' -Root 'C:\repo\.claude\worktrees' | Should Be $true
    }
    It 'matches case-insensitively' {
        Test-PathUnder -Path 'c:\REPO\.claude\worktrees\x' -Root 'C:\repo\.claude\worktrees' | Should Be $true
    }
    It 'rejects a sibling folder that shares the prefix' {
        Test-PathUnder -Path 'C:\repo\.claude\worktrees-evil\x' -Root 'C:\repo\.claude\worktrees' | Should Be $false
    }
    It 'rejects paths outside the root' {
        Test-PathUnder -Path 'C:\repo\backend' -Root 'C:\repo\.claude\worktrees' | Should Be $false
    }
}

Describe 'Get-ReparsePointsIn' {
    It 'returns nothing for a plain directory tree' {
        $root = Join-Path $TestDrive 'plain'
        New-Item -ItemType Directory -Path (Join-Path $root 'a\b') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $root 'a\b\file.txt') -Value 'x'
        @(Get-ReparsePointsIn -Path $root).Count | Should Be 0
    }
    It 'finds a junction inside the tree and does not follow it' {
        $root = Join-Path $TestDrive 'withlink'
        $target = Join-Path $TestDrive 'target'
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        New-Item -ItemType Junction -Path (Join-Path $root 'link') -Target $target | Out-Null
        $found = @(Get-ReparsePointsIn -Path $root)
        $found.Count | Should Be 1
        $found[0] | Should Match 'link$'
        Test-Path -LiteralPath (Join-Path $target '.') | Should Be $true
    }
}
