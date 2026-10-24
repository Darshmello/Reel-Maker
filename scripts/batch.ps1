# Render every film in ideas.json (one at a time: renders share the GPU) and summarise QA.
# usage: powershell -ExecutionPolicy Bypass -File scripts/batch.ps1 [-KeepVo] [-Only slug1,slug2]
param([switch]$KeepVo, [string[]]$Only)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$ideas = Get-Content ideas.json -Raw | ConvertFrom-Json
$rows = @()
foreach ($idea in $ideas) {
  if ($Only -and ($Only -notcontains $idea.slug)) { continue }
  Write-Host "=== $($idea.slug): $($idea.title)"
  $t = Get-Date
  $log = "out/$($idea.slug).log"
  New-Item -ItemType Directory -Force "out/$($idea.slug)" | Out-Null
  $rargs = @('-ExecutionPolicy', 'Bypass', '-File', 'scripts/render.ps1', $idea.slug)
  if ($KeepVo) { $rargs += '-KeepVo' }
  & powershell @rargs *> $log
  $ok = $LASTEXITCODE -eq 0
  $qa = (Select-String -Path $log -Pattern 'checks passed' | Select-Object -Last 1).Line
  $rows += [pscustomobject]@{slug = $idea.slug; ok = $ok; qa = $qa; minutes = [math]::Round(((Get-Date) - $t).TotalMinutes, 1)}
  Write-Host ("    {0}  {1}  ({2} min)" -f ($(if ($ok) { 'OK  ' } else { 'FAIL' })), $qa, $rows[-1].minutes)
}
$rows | Format-Table -AutoSize
if ($rows | Where-Object { -not $_.ok }) { exit 1 }
