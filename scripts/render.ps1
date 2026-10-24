# Full pipeline for one film in ideas.json:
#   VO (edge-tts placeholder, or public/vo/<slug>.user.wav) -> align (faster-whisper) -> cues + sound
#   events (beats.ts) -> mix -> Remotion render -> two-pass loudnorm to -14 LUFS / -1.5 dBTP -> +faststart -> QA
# usage: powershell -ExecutionPolicy Bypass -File scripts/render.ps1 <slug> [-KeepVo]
param([Parameter(Mandatory = $true)][string]$Slug, [switch]$KeepVo, [switch]$SkipRender)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$py = '.\.venv\Scripts\python.exe'
$dir = "out/$Slug"
New-Item -ItemType Directory -Force $dir | Out-Null
function Step($name, [scriptblock]$cmd) {
  $t = Get-Date
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "$name failed (exit $LASTEXITCODE)" }
  Write-Host ("[{0}] {1} ({2:N0}s)" -f (Get-Date -Format HH:mm:ss), $name, ((Get-Date) - $t).TotalSeconds)
}

$raw = "$dir/raw.mp4"
if (-not ($SkipRender -and (Test-Path $raw))) {
if (-not ($KeepVo -and (Test-Path "public/vo/$Slug.wav"))) { Step 'voiceover' { & $py scripts/make_vo.py $Slug } }
Step 'align' { & $py scripts/align.py $Slug }
Step 'cues + events' { node --no-warnings scripts/dump-events.mjs $Slug }
Step 'mix' { & $py scripts/mix.py $Slug }
Step 'props' { node scripts/props.mjs $Slug; node scripts/props.mjs $Slug --no-text }
if ($Slug -eq (Get-Content ideas.json -Raw | ConvertFrom-Json)[0].slug) { Copy-Item "$dir/words.json" src/film/words.json }
Step 'render' { npx remotion render WhatIf $raw "--props=$dir/props.json" --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --log=error }
}

# loudness: pass 1 measures, pass 2 applies one linear gain; an oversampled limiter catches peaks
$m = cmd /c "ffmpeg -hide_banner -nostats -i `"$raw`" -af loudnorm=I=-14:TP=-2:LRA=11:print_format=json -f null - 2>&1" | Out-String
$j = [regex]::Match($m, '\{\s*"input_i"[\s\S]*?\}').Value | ConvertFrom-Json
$ln = "loudnorm=I=-14:TP=-2:LRA=11:measured_I=$($j.input_i):measured_TP=$($j.input_tp):measured_LRA=$($j.input_lra):measured_thresh=$($j.input_thresh):offset=$($j.target_offset):linear=true"
$final = "out/$Slug.mp4"
$secs = ((Get-Content ideas.json -Raw | ConvertFrom-Json) | Where-Object { $_.slug -eq $Slug }).duration
# AAC can overshoot the limiter on noisy material (rain): measure the encoded true peak and, if it is
# over -1.5 dBTP, lower the limiter ceiling by the overshoot and encode again (loudness barely moves)
$limitDb = -2.5
for ($try = 1; $try -le 4; $try++) {
  $limit = [math]::Round([math]::Pow(10, $limitDb / 20), 4)
  $af = "$ln,aresample=192000,alimiter=limit=${limit}:attack=1:release=50:level=false,aresample=48000"
  Step "loudnorm + faststart (limit $limitDb dB)" { ffmpeg -v error -y -i $raw -c:v copy -af $af -ar 48000 -c:a aac -b:a 192k -t $secs -movflags +faststart $final }
  $e = cmd /c "ffmpeg -hide_banner -nostats -i `"$final`" -af ebur128=peak=true -f null - 2>&1" | Out-String
  $tp = [double]([regex]::Match($e.Substring($e.LastIndexOf('Summary:')), 'Peak:\s+(-?[\d.]+)').Groups[1].Value)
  if ($tp -le -1.7) { break }
  $limitDb -= ($tp + 1.9)
}
Step 'qa' { & $py scripts/qa.py $Slug }
Write-Host "done: $final"
