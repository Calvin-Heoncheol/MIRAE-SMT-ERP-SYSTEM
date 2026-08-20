#Requires -Version 5.1
<#
.SYNOPSIS
  솔더페이스트 로그 동기화 작업 스케줄러 등록 (3분 간격)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\register-scheduled-task.ps1
#>
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
  [int]$IntervalMinutes = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'sync-solder-paste-log.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "sync-solder-paste-log.ps1 을 찾을 수 없습니다: $scriptPath"
}

$taskName = 'MiraeSolderPasteLogSync'
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigPath `"$ConfigPath`""

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)

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
  -Description '솔더페이스트 설비 로그를 ERP로 자동 전송' `
  -Force | Out-Null

Write-Host "등록 완료: $taskName (${IntervalMinutes}분마다 실행)"
