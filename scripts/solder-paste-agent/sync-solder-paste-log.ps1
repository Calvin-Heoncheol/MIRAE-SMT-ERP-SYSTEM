#Requires -Version 5.1
<#
.SYNOPSIS
  Solder paste equipment PC -> ERP log sync

.DESCRIPTION
  Reads D:\Log\2026\8\19.txt style logs and POSTs to ERP API.
  Register with register-scheduled-task.ps1 (every 3 minutes).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\sync-solder-paste-log.ps1
  powershell -ExecutionPolicy Bypass -File .\sync-solder-paste-log.ps1 -ConfigPath C:\MiraeSolderPaste\config.json
#>
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config not found: $ConfigPath`nCopy config.example.json to config.json"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$logRoot = [string]$config.logRoot
$erpUrl = [string]$config.erpUrl
$ingestKey = [string]$config.ingestKey
$syncDaysBack = if ($null -ne $config.syncDaysBack) { [int]$config.syncDaysBack } else { 1 }

if (-not $logRoot -or -not $erpUrl -or -not $ingestKey) {
  throw 'config.json needs logRoot, erpUrl, ingestKey'
}

if ($ingestKey -match 'same-as-vercel|SOLDER_PASTE_INGEST_KEY|placeholder|여기에|동일') {
  throw 'config.json ingestKey is still a placeholder. Set it to the same value as Vercel SOLDER_PASTE_INGEST_KEY.'
}

$stateDir = Join-Path $env:ProgramData 'MiraeSolderPasteAgent'
$statePath = Join-Path $stateDir 'state.json'
if (-not (Test-Path -LiteralPath $stateDir)) {
  New-Item -ItemType Directory -Path $stateDir | Out-Null
}

$state = @{}
if (Test-Path -LiteralPath $statePath) {
  $loaded = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($null -ne $loaded) {
    foreach ($prop in $loaded.PSObject.Properties) {
      $state[$prop.Name] = [string]$prop.Value
    }
  }
}

function Get-FileSha256([string]$Path) {
  $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
  return $hash.Hash.ToLowerInvariant()
}

# Keep only lines the ERP parser cares about. Full day logs are mostly door/rotation noise.
function Get-RelevantLogText([string]$RawText) {
  $lines = $RawText -split "`r?`n"
  $kept = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -notmatch '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}') { continue }
    if (
      $line -match '[A-Z]-P[FB]-\d{6}' -or
      $line -match '입고|꺼내기|교반|출고|경보|상온|WaitOutbound|错误|오류|알람'
    ) {
      $kept.Add($line.TrimEnd())
    }
  }
  return ($kept -join "`n")
}

$script:JsonSerializer = $null
try {
  Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
  $script:JsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $script:JsonSerializer.MaxJsonLength = 64MB
} catch {
  $script:JsonSerializer = $null
}

function ConvertTo-IngestJson([hashtable]$Payload) {
  if ($null -ne $script:JsonSerializer) {
    return $script:JsonSerializer.Serialize($Payload)
  }
  return ($Payload | ConvertTo-Json -Compress -Depth 5)
}

function Send-LogFile([string]$Path, [string]$SourceName) {
  $raw = Get-Content -LiteralPath $Path -Raw -Encoding Default
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-Log "SKIP empty $SourceName"
    return
  }

  $content = Get-RelevantLogText -RawText $raw
  if ([string]::IsNullOrWhiteSpace($content)) {
    Write-Log "SKIP no-events $SourceName"
    return
  }

  $body = ConvertTo-IngestJson @{
    text = $content
    sourceName = $SourceName
    sourcePath = $Path
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  Write-Log "SEND $SourceName bytes=$($bytes.Length) lines=$(($content -split "`n").Count)"

  try {
    $http = Invoke-WebRequest `
      -Uri $erpUrl `
      -Method Post `
      -ContentType 'application/json; charset=utf-8' `
      -Headers @{
        'X-Solder-Paste-Key' = $ingestKey
      } `
      -Body $bytes `
      -UseBasicParsing `
      -MaximumRedirection 0
    $statusCode = [int]$http.StatusCode
    $responseText = [string]$http.Content
  } catch {
    $statusCode = -1
    if ($_.Exception.Response) {
      try {
        $statusCode = [int]$_.Exception.Response.StatusCode
      } catch {}
    }

    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $detail = $_.ErrorDetails.Message
    } elseif ($_.Exception.Response) {
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $detail = $reader.ReadToEnd()
      } catch {}
    }

    if ($statusCode -ge 300 -and $statusCode -lt 400) {
      throw "status=$statusCode redirect (check ingestKey) body=$detail"
    }

    throw "status=$statusCode body=$detail"
  }

  if ($statusCode -ge 300 -and $statusCode -lt 400) {
    throw "status=$statusCode redirect (check ingestKey) body=$responseText"
  }

  try {
    $response = $responseText | ConvertFrom-Json
  } catch {
    throw "status=$statusCode body=$responseText"
  }

  if ($response.skipped) {
    Write-Log "SKIP unchanged $SourceName"
  } else {
    Write-Log "OK $SourceName status=$statusCode rows=$($response.rowCount)"
  }

  $state[$SourceName] = Get-FileSha256 -Path $Path
}

Write-Log "START logRoot=$logRoot erpUrl=$erpUrl daysBack=$syncDaysBack"

for ($offset = 0; $offset -le $syncDaysBack; $offset++) {
  $date = (Get-Date).Date.AddDays(-$offset)
  $year = $date.Year
  $month = $date.Month
  $day = $date.Day
  $path = Join-Path $logRoot (Join-Path $year (Join-Path $month ("{0}.txt" -f $day)))
  $sourceName = '{0}/{1}/{2}.txt' -f $year, $month, $day

  if (-not (Test-Path -LiteralPath $path)) {
    Write-Log "MISS $sourceName"
    continue
  }

  $hash = Get-FileSha256 -Path $path
  if ($state.ContainsKey($sourceName) -and $state[$sourceName] -eq $hash) {
    Write-Log "SKIP local-unchanged $sourceName"
    continue
  }

  try {
    Send-LogFile -Path $path -SourceName $sourceName
  } catch {
    Write-Log "ERR $sourceName $($_.Exception.Message)"
  }
}

$stateObject = New-Object PSObject
foreach ($entry in $state.GetEnumerator()) {
  $stateObject | Add-Member -NotePropertyName $entry.Key -NotePropertyValue $entry.Value
}
$stateObject | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

Write-Log 'DONE'
