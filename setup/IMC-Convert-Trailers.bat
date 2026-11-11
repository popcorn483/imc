<# : IMC convert trailers - a batch file with PowerShell inside: double-click it (or drop a folder onto it)
@echo off
title IMC - convert trailers for the foyer TVs
set "IMC_BAT=%~f0"
set "IMC_ARG=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:IMC_BAT))"
if not defined IMC_NOPAUSE (echo. & pause)
exit /b
#>
# ---------------------------------------------------------------------------------------------
# IMC convert trailers. The foyer TVs play MP4 trailers. Some trailers arrive as .mpg, .avi, .wmv,
# .mkv or .mxf files (or as .mov files in a format the TVs can't play). This makes an MP4 copy of
# each one, next to it, with the same name, then moves the old file to the Recycle Bin (so it can
# be put back if needed). Files that already play are left alone.
#   Double-click: it finds the IMC TRAILERS folder (or asks you to pick it).
#   Or drag a folder onto this file to convert the trailers in that folder.
#   Afterwards it offers to do this by itself from then on: every 10 minutes, quietly in the
#   background, new trailers in that folder are converted (Task Scheduler: "IMC convert trailers",
#   log in C:\ProgramData\IMC\convert.log). Run it again and answer N to switch that off.
# The first time, it downloads the free FFmpeg converter (about 100 MB) into C:\ProgramData\IMC.
# ---------------------------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$TOOLS = "C:\ProgramData\IMC\ffmpeg"
$CONVERT = '\.(mpg|mpeg|mpe|m2v|vob|avi|wmv|asf|mkv|mxf|ts|m2ts|mts|flv|3gp|divx|ogv)$'
$CHECK = '\.(mp4|m4v|mov)$'
$HOMEDIR = "C:\ProgramData\IMC"
$CFG = Join-Path $HOMEDIR "convert-folder.txt"
$LOG = Join-Path $HOMEDIR "convert.log"
$TASK = "IMC convert trailers"
$AUTO = ($env:IMC_ARG -eq "/auto")
New-Item -ItemType Directory -Force -Path $HOMEDIR | Out-Null
function Log($t) { try { Add-Content -LiteralPath $LOG -Value ((Get-Date -Format "yyyy-MM-dd HH:mm") + "  " + $t); $l = @(Get-Content -LiteralPath $LOG); if ($l.Count -gt 400) { $l | Select-Object -Last 300 | Set-Content -LiteralPath $LOG } } catch {} }
function Say($t, $c = "Gray") { if ($AUTO) { if ($c -ne "Gray" -and $t.Trim() -and $t -notmatch '^\s*=+') { Log $t.Trim() } } else { Write-Host $t -ForegroundColor $c } }
function Ask($q) { while ($true) { $a = Read-Host "$q (Y/N)"; if ($a -match '^[yY]') { return $true }; if ($a -match '^[nN]') { return $false } } }
function Task-On { [bool](Get-ScheduledTask -TaskName $TASK -ErrorAction SilentlyContinue) }
function Install-Auto($folder) {
  Set-Content -LiteralPath $CFG -Value $folder -Encoding UTF8
  $me = Join-Path $HOMEDIR "IMC-Convert-Trailers.bat"
  if ($env:IMC_BAT -ne $me) { Copy-Item -LiteralPath $env:IMC_BAT -Destination $me -Force }
  $vbs = Join-Path $HOMEDIR "convert-hidden.vbs"
  Set-Content -LiteralPath $vbs -Encoding ASCII -Value ('Set s = CreateObject("WScript.Shell")' + "`r`n" + 's.Environment("PROCESS")("IMC_NOPAUSE") = "1"' + "`r`n" + 's.Run "cmd.exe /c ""' + $me + '"" /auto", 0, True')
  $who = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $a = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
  $e = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
  $l = New-ScheduledTaskTrigger -AtLogOn -User $who
  $w = New-ScheduledTaskPrincipal -UserId $who -LogonType Interactive -RunLevel Limited
  $o = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)
  Register-ScheduledTask -TaskName $TASK -Action $a -Trigger @($e, $l) -Principal $w -Settings $o -Force | Out-Null
  Log "Automatic converting switched on for $folder"
}
function Remove-Auto { Unregister-ScheduledTask -TaskName $TASK -Confirm:$false -ErrorAction SilentlyContinue; Log "Automatic converting switched off" }

if ($AUTO) { try { [Diagnostics.Process]::GetCurrentProcess().PriorityClass = "BelowNormal" } catch {} }
if ($env:IMC_ARG -eq "/off") { Remove-Auto; Write-Host "Automatic converting is off." -ForegroundColor Green; exit }
if (-not $AUTO) {
Clear-Host
Say "  =====================================================" Yellow
Say "        IMC  -  CONVERT TRAILERS FOR THE FOYER TVs" Yellow
Say "  =====================================================" Yellow
Say "  Makes an MP4 of any trailer the TVs can't play."
Say "  Keep this window open until it says Finished."
Say ""
}

# ----- 1. which folder -----
$dir = $env:IMC_ARG
$INSTALL = ($dir -eq "/install")
if ($AUTO -or $INSTALL) { $dir = $(if (Test-Path -LiteralPath $CFG) { (Get-Content -LiteralPath $CFG -Raw).Trim() } else { "" }); if ($INSTALL -and $env:IMC_DIR) { $dir = $env:IMC_DIR }
  if (-not $dir -or -not (Test-Path -LiteralPath $dir -PathType Container)) { Log "The trailers folder ($dir) isn't there: nothing done"; exit } }
if ($INSTALL) { Install-Auto $dir; Write-Host "Automatic converting is on for $dir" -ForegroundColor Green; exit }
if ($dir -and -not (Test-Path -LiteralPath $dir -PathType Container)) { $dir = Split-Path -LiteralPath $dir -Parent }
if (-not $dir) {
  $found = New-Object System.Collections.Generic.List[string]
  $tryList = @((Join-Path ([Environment]::GetFolderPath("Desktop")) "IMC TRAILERS"), (Join-Path $env:USERPROFILE "Desktop\IMC TRAILERS"), (Join-Path $env:USERPROFILE "My Drive\IMC TRAILERS"))
  foreach ($d in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) { foreach ($p in @("My Drive\IMC TRAILERS", "IMC TRAILERS")) { $tryList += (Join-Path $d.Root $p) } }
  foreach ($x in $tryList) { if ((Test-Path -LiteralPath $x -PathType Container) -and $x -ne "C:\IMC TRAILERS") { $full = (Resolve-Path -LiteralPath $x).ProviderPath; if (-not $found.Contains($full)) { $found.Add($full) } } }
  if ($found.Count -eq 1) { $dir = $found[0] }
  elseif ($found.Count -gt 1) {
    Say "Found more than one IMC TRAILERS folder:" Cyan
    for ($i = 0; $i -lt $found.Count; $i++) { Say ("   " + ($i + 1) + ".  " + $found[$i]) }
    while (-not $dir) { $a = Read-Host "Type the number of the folder to convert, then press Enter"; if ($a -match '^\d+$' -and [int]$a -ge 1 -and [int]$a -le $found.Count) { $dir = $found[[int]$a - 1] } }
  } else {
    Add-Type -AssemblyName System.Windows.Forms
    $fb = New-Object System.Windows.Forms.FolderBrowserDialog
    $fb.Description = "Pick the folder with the trailers in it"
    if ($fb.ShowDialog() -ne "OK") { Say "No folder picked. Nothing was changed." Yellow; exit }
    $dir = $fb.SelectedPath
  }
}
Say "Folder: $dir" $(if ($AUTO) { "Gray" } else { "Green" })

# ----- 2. the converter (FFmpeg), downloaded once -----
function Find-FF { Get-ChildItem -LiteralPath $TOOLS -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1 }
$ff = Find-FF
if (-not $ff) {
  Say ""
  Say "Downloading the free FFmpeg converter (about 100 MB, one time only)..." Cyan
  New-Item -ItemType Directory -Force -Path $TOOLS | Out-Null
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $zip = Join-Path $env:TEMP "imc-ffmpeg.zip"
  $urls = @("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip")
  foreach ($u in $urls) {
    if ($ff) { break }
    try { Invoke-WebRequest $u -OutFile $zip -UseBasicParsing; Expand-Archive -LiteralPath $zip -DestinationPath $TOOLS -Force; Remove-Item $zip -ErrorAction SilentlyContinue; $ff = Find-FF }
    catch { Say "  (that download didn't work, trying another)" DarkGray }
  }
  if (-not $ff) { Say "Couldn't download the converter. Check the internet connection and try again." Red; exit }
  Say "Converter ready." Green
}
$ffmpeg = $ff.FullName
$ffprobe = Join-Path $ff.DirectoryName "ffprobe.exe"

# ----- 3. which files need converting -----
function Video-Codec($path) {
  if (-not (Test-Path -LiteralPath $ffprobe)) { return "h264" }
  try { $c = & $ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$path" 2>$null; return ("" + $c).Trim().ToLower() } catch { return "" }
}
$todo = @()
foreach ($f in @(Get-ChildItem -LiteralPath $dir -File -Recurse -Depth 3 -ErrorAction SilentlyContinue)) {
  if ($f.Name -match '\.part\.mp4$' -or $f.Length -lt 20000) { continue }
  if ($AUTO -and ((Get-Date) - $f.LastWriteTime).TotalMinutes -lt 3) { continue }   # still being copied in: next time
  if ($f.Name -match $CONVERT) { $todo += $f; continue }
  if ($f.Name -match $CHECK) { $c = Video-Codec $f.FullName; if ($c -and $c -ne "h264") { $todo += $f } }
}
Say ""
if ($todo.Count -eq 0) { Say "Nothing to convert: every trailer in this folder already plays on the foyer TVs." $(if ($AUTO) { "Gray" } else { "Green" }) }
else {
Say ("" + $todo.Count + " trailer" + $(if ($todo.Count -ne 1) { "s" }) + " to convert:") Cyan
foreach ($f in $todo) { Say ("   " + $f.Name) }
Say ""
Say "Each one takes about a minute (longer on an old PC)." Gray

# ----- 4. convert -----
Add-Type -AssemblyName Microsoft.VisualBasic
$ok = 0; $bad = 0; $n = 0
foreach ($f in $todo) {
  $n++
  $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $out = Join-Path $f.DirectoryName ($base + ".mp4")
  if ((Test-Path -LiteralPath $out) -and ($out -ne $f.FullName)) { $out = Join-Path $f.DirectoryName ($base + " (foyer).mp4") }
  if ($out -eq $f.FullName) { $out = Join-Path $f.DirectoryName ($base + " (foyer).mp4") }
  $part = $out + ".part.mp4"
  Say ""
  Say ("[$n of $($todo.Count)]  " + $f.Name + "  ->  " + [IO.Path]::GetFileName($out)) Yellow
  # H.264 + AAC MP4 that every browser plays; interlaced TV-style files are smoothed; fast start for quick playback
  $ffa = @("-hide_banner", "-loglevel", "error", "-stats", "-y", "-i", $f.FullName,
            "-map", "0:v:0", "-map", "0:a:0?", "-vf", "yadif=deint=interlaced,scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", "-f", "mp4", $part)
  $ErrorActionPreference = "Continue"
  if ($AUTO) {   # in the background: quietly (this whole run is at low priority, so the PC stays quick)
    $msg = & $ffmpeg ($ffa | Where-Object { $_ -ne "-stats" }) 2>&1 | Select-Object -Last 3; $code = $LASTEXITCODE
    if ($code -ne 0) { Log ("   FFmpeg said: " + (($msg | ForEach-Object { "$_" }) -join " / ")) }
  } else { & $ffmpeg @ffa; $code = $LASTEXITCODE }
  $ErrorActionPreference = "Stop"
  if ($code -eq 0 -and (Test-Path -LiteralPath $part) -and (Get-Item -LiteralPath $part).Length -gt 20000) {
    Move-Item -LiteralPath $part -Destination $out -Force
    try { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($f.FullName, "OnlyErrorDialogs", "SendToRecycleBin"); Say "   Done. The old file is in the Recycle Bin." Green }
    catch { Say "   Done (couldn't move the old file to the Recycle Bin: delete it yourself)." Green }
    $ok++
  } else {
    Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue
    Say "   This one couldn't be converted (the file may be damaged or still copying). It was left as it was." Red
    $bad++
  }
}
Say ""
Say "  =====================================================" Yellow
Say ("  Finished: " + $ok + " converted" + $(if ($bad) { ", $bad couldn't be" })) Yellow
Say "  =====================================================" Yellow
Say "  In the hub, click Check on the Trailers page to see them."
}

# ----- 5. from now on, by itself -----
if (-not $AUTO) {
  Say ""
  if (Task-On) {
    $was = $(if (Test-Path -LiteralPath $CFG) { (Get-Content -LiteralPath $CFG -Raw).Trim() } else { "" })
    if ($was -ne $dir) { Install-Auto $dir; Say "Automatic converting now watches this folder." Green }
    else { Say "Automatic converting is on: new trailers in this folder are converted by themselves every 10 minutes." Green }
  } elseif ($env:IMC_NOASK) { } elseif (Ask "Convert new trailers in this folder by themselves from now on (every 10 minutes, in the background)?") {
    try { Install-Auto $dir; Say "Done. New trailers in this folder will be converted by themselves while this PC is on." Green }
    catch { Say "Couldn't switch that on: $($_.Exception.Message)" Red }
  } else { Say "OK. Double-click this again whenever new trailers arrive." Gray }
}
