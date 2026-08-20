#Requires -Version 5.1
<#
.SYNOPSIS
  Register solder paste log sync scheduled task (every 3 minutes)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\register-scheduled-task.ps1
#>
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
  [int]$IntervalMinutes = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'sync-solder-paste-log.bat'
if (-not (Test-Path -LiteralPath $scriptPath)) {
  $scriptPath = Join-Path $PSScriptRoot 'sync-solder-paste-log.ps1'
}
if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw 'sync-solder-paste-log.bat or .ps1 not found'
}

$taskName = 'MiraeSolderPasteLogSync'
if ($scriptPath -like '*.ps1') {
  $action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigPath `"$ConfigPath`"" `
    -WorkingDirectory $PSScriptRoot
} else {
  $action = New-ScheduledTaskAction `
    -Execute 'cmd.exe' `
    -Argument "/c `"$scriptPath`"" `
    -WorkingDirectory $PSScriptRoot
}

# [TimeSpan]::MaxValue causes invalid Duration in task scheduler XML.
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Mirae solder paste equipment log sync to ERP' `
  -Force | Out-Null

Write-Host "OK registered: $taskName (every $IntervalMinutes minutes)"
