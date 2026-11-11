<# : IMC Foyer PC setup - a batch file with PowerShell inside: double-click it
@echo off
title IMC Foyer PC setup
set "IMC_BAT=%~f0"
set "IMC_MODE=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:IMC_BAT))"
if not "%~1"=="elevated" (echo. & pause)
exit /b
#>
# ---------------------------------------------------------------------------------------------
# IMC Foyer PC setup. Run once on each foyer PC: double-click, and click Yes when Windows asks.
#  1. installs Google Drive for desktop (if it isn't there) and sets it to start with Windows
#  2. you sign in once, in Google's own window, with the cinema's Google account
#  3. makes C:\IMC TRAILERS: a real copy on this PC of the Drive folder "My Drive\IMC TRAILERS",
#     kept up to date every 10 minutes (new trailers copied in, deleted ones taken out)
#  4. (optional) starts the IMC Foyer TV by itself, full screen with sound, when the PC switches on
# This script never asks for, sees or stores a password.
# ---------------------------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$TV_URL  = "https://popcorn483.github.io/imc/tv.html"
$DEST    = "C:\IMC TRAILERS"
$HOMEDIR = "C:\ProgramData\IMC"
$EXTRX   = '\.(mp4|m4v|mov|webm)$'
function Say($t, $c = "Gray") { Write-Host $t -ForegroundColor $c }
function Step($n, $t) { Write-Host ""; Write-Host " $n  $t" -ForegroundColor Yellow; Write-Host " ------------------------------------------------------------" -ForegroundColor DarkGray }
function Ask($q) { while ($true) { $a = Read-Host "$q (Y/N)"; if ($a -match '^[yY]') { return $true }; if ($a -match '^[nN]') { return $false } } }
function Drive-Exe { Get-ChildItem "$env:ProgramFiles\Google\Drive File Stream" -Recurse -Filter GoogleDriveFS.exe -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 }

# ===== the part that needs administrator rights (Windows asks "Yes/No" for it) =====
if ($env:IMC_MODE -eq "elevated") {
  try {
    Say "Installing and setting up (administrator part)..." Cyan
    if (-not (Drive-Exe)) {
      Say "Downloading Google Drive for desktop from Google..."
      $setup = Join-Path $env:TEMP "GoogleDriveSetup.exe"
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest "https://dl.google.com/drive-file-stream/GoogleDriveSetup.exe" -OutFile $setup -UseBasicParsing
      Say "Installing (a minute or two)..."
      Start-Process $setup -ArgumentList "--silent","--skip_launch_new","--desktop_shortcut=false","--gsuite_shortcuts=false" -Wait
    }
    # for every user of this PC: start with Windows, drive letter G, English folder names, no Outlook add-ins
    $k = "HKLM:\SOFTWARE\Google\DriveFS"
    if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
    Set-ItemProperty $k -Name AutoStartOnLogin -Value 1 -Type DWord
    Set-ItemProperty $k -Name DefaultMountPoint -Value "G" -Type String
    Set-ItemProperty $k -Name DisableLocalizedVirtualFolders -Value 1 -Type DWord
    Set-ItemProperty $k -Name DisableOutlookPlugin -Value 1 -Type DWord
    Set-ItemProperty $k -Name DisableMeetOutlookPlugin -Value 1 -Type DWord
    # the trailers folder and the helper folder, which everyday users of this PC can change
    New-Item -ItemType Directory -Force -Path $DEST, $HOMEDIR | Out-Null
    & icacls.exe "$DEST" /grant "*S-1-5-32-545:(OI)(CI)M" | Out-Null
    & icacls.exe "$HOMEDIR" /grant "*S-1-5-32-545:(OI)(CI)M" | Out-Null
  } catch { Say "Problem: $($_.Exception.Message)" Red; Start-Sleep -Seconds 8; exit 1 }
  exit 0
}

# ===== everything else runs as the everyday user (Google Drive's G: drive belongs to them) =====
Clear-Host
Say "  =====================================================" Yellow
Say "        IMC FOYER PC SETUP" Yellow
Say "  =====================================================" Yellow
Say "  Sets up trailer files for the foyer TV on this PC."
Say "  About 5 minutes. Keep this window open."

Step 1 "Google Drive for desktop"
$needAdmin = (-not (Drive-Exe)) -or (-not (Test-Path $DEST)) -or (-not (Test-Path "HKLM:\SOFTWARE\Google\DriveFS"))
if ($needAdmin) {
  Say "Windows will ask if this setup can make changes: click Yes." Cyan
  try { $p = Start-Process cmd.exe -ArgumentList "/c `"`"$env:IMC_BAT`" elevated`"" -Verb RunAs -Wait -PassThru } catch { Say "Setup needs that permission. Run it again and click Yes." Red; exit }
  if (-not (Drive-Exe)) { Say "Google Drive didn't install. Check the internet connection and run this setup again." Red; exit }
}
Say "Google Drive for desktop is installed and starts with Windows." Green

Step 2 "Sign in to Google Drive"
function Find-Src {
  foreach ($d in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
    foreach ($p in @("My Drive\IMC TRAILERS", "IMC TRAILERS")) { $x = Join-Path $d.Root $p; if ($x -ne $DEST -and (Test-Path -LiteralPath $x)) { return $x } }
    foreach ($top in @("Shared drives", "Computers")) { $sd = Join-Path $d.Root $top; if (Test-Path -LiteralPath $sd) { foreach ($s in @(Get-ChildItem -LiteralPath $sd -Directory -ErrorAction SilentlyContinue)) { $x = Join-Path $s.FullName "IMC TRAILERS"; if (Test-Path -LiteralPath $x) { return $x } } } } }
  $x = Join-Path $env:USERPROFILE "My Drive\IMC TRAILERS"; if (Test-Path -LiteralPath $x) { return $x }
  return $null
}
$src = Find-Src
if ($src) { Say "Already signed in: found $src" Green }
else {
  Start-Process (Drive-Exe).FullName -ErrorAction SilentlyContinue
  Say "A Google Drive window opens (if not, click the Drive icon by the clock)." Cyan
  Say "Sign in with the CINEMA'S Google account: the one that has the IMC TRAILERS folder." Cyan
  Say "Waiting for the IMC TRAILERS folder to appear (up to 15 minutes)"
  $t0 = Get-Date
  while (-not $src -and ((Get-Date) - $t0).TotalMinutes -lt 15) { Start-Sleep -Seconds 5; $src = Find-Src; Write-Host "." -NoNewline }
  Write-Host ""
  if (-not $src) { Say "The IMC TRAILERS folder didn't appear. If it was shared with this account by someone else, open drive.google.com, right-click it under 'Shared with me' > Organise > Add shortcut > My Drive, then run this setup again." Yellow; Say "Otherwise: Check you signed in with the cinema's account, and that its My Drive has a folder called IMC TRAILERS. Then run this setup again." Red; exit }
  Say "Found $src" Green
}

Step 3 "Trailer files on this PC: $DEST"
$sync = @'
# IMC trailers: copy "My Drive\IMC TRAILERS" (Google Drive) to C:\IMC TRAILERS, and remove files deleted from Drive.
# Runs every 10 minutes (Task Scheduler: "IMC trailers sync"). Log: C:\ProgramData\IMC\sync.log
param([switch]$Loop)
$DEST = "C:\IMC TRAILERS"; $LOG = "C:\ProgramData\IMC\sync.log"; $EXT = '\.(mp4|m4v|mov|webm)$'
function Log($t) { try { Add-Content -LiteralPath $LOG -Value ((Get-Date -Format "yyyy-MM-dd HH:mm") + "  " + $t); $l = @(Get-Content -LiteralPath $LOG); if ($l.Count -gt 400) { $l | Select-Object -Last 300 | Set-Content -LiteralPath $LOG } } catch {} }
function Run-Once {
  $src = $null
  foreach ($d in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) { foreach ($p in @("My Drive\IMC TRAILERS", "IMC TRAILERS")) { $x = Join-Path $d.Root $p; if ((-not $src) -and $x -ne $DEST -and (Test-Path -LiteralPath $x)) { $src = $x } }  foreach ($top in @("Shared drives", "Computers")) { $sd = Join-Path $d.Root $top; if ((-not $src) -and (Test-Path -LiteralPath $sd)) { foreach ($s in @(Get-ChildItem -LiteralPath $sd -Directory -ErrorAction SilentlyContinue)) { $x = Join-Path $s.FullName "IMC TRAILERS"; if ((-not $src) -and (Test-Path -LiteralPath $x)) { $src = $x } } } } }
  if (-not $src) { $x = Join-Path $env:USERPROFILE "My Drive\IMC TRAILERS"; if (Test-Path -LiteralPath $x) { $src = $x } }
  if (-not $src) { Log "Google Drive isn't ready (not signed in, or still starting): nothing changed"; return }
  New-Item -ItemType Directory -Force -Path $DEST | Out-Null
  $files = @(Get-ChildItem -LiteralPath $src -File -Recurse -Depth 3 -ErrorAction Stop | Where-Object { $_.Name -match $EXT -and $_.Name -notmatch '\.part\.mp4$' -and $_.FullName.Substring($src.Length) -notmatch '\\_' })
  $flag = "C:\ProgramData\IMC\empty.flag"
  if ($files.Count -eq 0) { if (-not (Test-Path $flag)) { New-Item $flag -ItemType File -Force | Out-Null; Log "The Drive folder looks empty: checking again next time before removing anything"; return } } else { Remove-Item $flag -ErrorAction SilentlyContinue }
  $names = @{}
  foreach ($f in $files) {
    $names[$f.Name] = 1; $to = Join-Path $DEST $f.Name
    if ((Test-Path -LiteralPath $to) -and ((Get-Item -LiteralPath $to).Length -eq $f.Length)) { continue }
    try { $part = $to + ".part"; Copy-Item -LiteralPath $f.FullName -Destination $part -Force; Move-Item -LiteralPath $part -Destination $to -Force; Log "Copied $($f.Name) ($([math]::Round($f.Length/1MB)) MB)" }
    catch { Log "Couldn't copy $($f.Name) yet: $($_.Exception.Message)"; Remove-Item -LiteralPath ($to + ".part") -ErrorAction SilentlyContinue }
  }
  foreach ($g in @(Get-ChildItem -LiteralPath $DEST -File)) {
    if ($g.Name -match $EXT -and -not $names.ContainsKey($g.Name)) { Remove-Item -LiteralPath $g.FullName -Force; Log "Removed $($g.Name) (deleted from Google Drive)" }
    elseif ($g.Name -like "*.part" -and $g.LastWriteTime -lt (Get-Date).AddHours(-6)) { Remove-Item -LiteralPath $g.FullName -Force }
  }
}
$m = New-Object System.Threading.Mutex($false, "Local\IMCTrailersSync")
do {
  if ($m.WaitOne(0)) { try { Run-Once } catch { Log "Problem: $($_.Exception.Message)" } finally { $m.ReleaseMutex() } }
  if ($Loop) { Start-Sleep -Seconds 600 }
} while ($Loop)
'@
New-Item -ItemType Directory -Force -Path $DEST, $HOMEDIR | Out-Null
Set-Content -LiteralPath "$HOMEDIR\sync-trailers.ps1" -Value $sync -Encoding UTF8
Set-Content -LiteralPath "$HOMEDIR\sync-hidden.vbs" -Value 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\ProgramData\IMC\sync-trailers.ps1""", 0, False' -Encoding ASCII
$scheduled = $false
try {
  $me      = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $action  = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$HOMEDIR\sync-hidden.vbs`""
  $every   = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
  $logon   = New-ScheduledTaskTrigger -AtLogOn -User $me
  $who     = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
  $opts    = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  Register-ScheduledTask -TaskName "IMC trailers sync" -Action $action -Trigger @($every, $logon) -Principal $who -Settings $opts -Force | Out-Null
  $scheduled = $true
} catch {}
$startup = [Environment]::GetFolderPath("Startup")
if (-not $scheduled) {   # no Task Scheduler rights: a hidden copy that starts with Windows and checks every 10 minutes instead
  Set-Content -LiteralPath "$HOMEDIR\sync-loop.vbs" -Value 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\ProgramData\IMC\sync-trailers.ps1"" -Loop", 0, False' -Encoding ASCII
  $ws = New-Object -ComObject WScript.Shell; $l = $ws.CreateShortcut((Join-Path $startup "IMC trailers sync.lnk")); $l.TargetPath = "wscript.exe"; $l.Arguments = "`"$HOMEDIR\sync-loop.vbs`""; $l.Save()
  Start-Process wscript.exe -ArgumentList "`"$HOMEDIR\sync-loop.vbs`""
}
Say "New trailers are copied to $DEST every 10 minutes, and ones deleted from Drive are taken out." Green
Say "Copying the trailers now (big files take a while on slow internet)..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOMEDIR\sync-trailers.ps1"
$n = @(Get-ChildItem -LiteralPath $DEST -File | Where-Object { $_.Name -match $EXTRX }).Count
Say "$n trailer file(s) in $DEST. Any still downloading follow within 10 minutes." Green

Step 4 "Start the foyer TV by itself"
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { Say "Google Chrome isn't installed on this PC, so this step is skipped. Install Chrome, then run this setup again." Red }
elseif (Ask "Start the IMC Foyer TV full screen, with sound, whenever this PC switches on?") {
  Get-ChildItem -LiteralPath $startup -Filter "IMC Foyer TV*" -ErrorAction SilentlyContinue | Remove-Item -Force
  $ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut((Join-Path $startup "IMC Foyer TV.lnk"))
  $lnk.TargetPath = $chrome; $lnk.Arguments = "--autoplay-policy=no-user-gesture-required --start-fullscreen --app=$TV_URL"; $lnk.Description = "IMC Foyer TV"; $lnk.Save()
  Copy-Item -LiteralPath (Join-Path $startup "IMC Foyer TV.lnk") -Destination (Join-Path ([Environment]::GetFolderPath("Desktop")) "IMC Foyer TV.lnk") -Force -ErrorAction SilentlyContinue
  Say "Done: the TV starts by itself with sound, no click needed. (If an older 'IMC Foyer TV' shortcut was in Startup it has been replaced, so only one TV plays.)" Green
}

Step 5 "Last step: in the TV app"
Say "The TV app opens now. On its set-up screen:" Cyan
Say "   1. click  Choose the trailers folder  and pick  This PC > Local Disk (C:) > IMC TRAILERS" Cyan
Say "   2. when Chrome asks, choose  Allow on every visit" Cyan
Say "   3. click  Start this TV" Cyan
if ($chrome) { Start-Process $chrome -ArgumentList "--new-window", "$TV_URL`?setup" } else { Start-Process "$TV_URL`?setup" }
Say ""
Say "  All done. You can close this window." Yellow
