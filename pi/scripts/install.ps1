#Requires -Version 5.1
<#
.SYNOPSIS
  Instala el sistema pi de ai-dotfiles: symlinks a ~/.pi/agent + merge de settings.
.EXAMPLE
  Set-ExecutionPolicy -Scope Process Bypass
  ./install.ps1
  ./install.ps1 -Copy   # en vez de symlink, copiar (si no hay Developer Mode/admin)
#>
param([switch]$Copy)

$ErrorActionPreference = "Stop"
$RepoPi = Split-Path -Parent $PSScriptRoot          # .../pi
$AgentSrc = Join-Path $RepoPi "agent"
$Target = Join-Path $HOME ".pi/agent"

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }
Ensure-Dir (Join-Path $Target "extensions")
Ensure-Dir (Join-Path $Target "skills")

function Link-Or-Copy($src, $dst) {
  if (Test-Path $dst) {
    $item = Get-Item $dst -Force
    if ($item.LinkType) { Remove-Item $dst -Force }
    elseif ($item.PSIsContainer) { Write-Host "  ~ $dst ya existe (directorio), lo dejo" ; return }
    else { Remove-Item $dst -Force }
  }
  if ($Copy) {
    if ((Get-Item $src).PSIsContainer) { Copy-Item $src $dst -Recurse -Force } else { Copy-Item $src $dst -Force }
    Write-Host "  + copiado $dst"
  } else {
    try {
      New-Item -ItemType SymbolicLink -Path $dst -Target $src | Out-Null
      Write-Host "  + link $dst -> $src"
    } catch {
      Write-Host "  ! symlink falló (activa Developer Mode o corre como admin). Copiando: $dst"
      if ((Get-Item $src).PSIsContainer) { Copy-Item $src $dst -Recurse -Force } else { Copy-Item $src $dst -Force }
    }
  }
}

Write-Host "◆ ai-dotfiles/pi → $Target"

# 1. Extensiones (*.ts sueltas)
Get-ChildItem (Join-Path $AgentSrc "extensions") -Filter *.ts -File | ForEach-Object {
  Link-Or-Copy $_.FullName (Join-Path (Join-Path $Target "extensions") $_.Name)
}

# 2. Skills (cada subcarpeta)
$skillsSrc = Join-Path $AgentSrc "skills"
if (Test-Path $skillsSrc) {
  Get-ChildItem $skillsSrc -Directory | ForEach-Object {
    Link-Or-Copy $_.FullName (Join-Path (Join-Path $Target "skills") $_.Name)
  }
}

# 3. Merge settings.base.json sobre settings.json existente
$basePath = Join-Path $AgentSrc "settings.base.json"
$settingsPath = Join-Path $Target "settings.json"
$base = Get-Content $basePath -Raw | ConvertFrom-Json
if (Test-Path $settingsPath) {
  $cur = Get-Content $settingsPath -Raw | ConvertFrom-Json
} else {
  $cur = New-Object psobject
}
foreach ($prop in $base.PSObject.Properties) {
  $cur | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
}
$cur | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
Write-Host "  + settings mergeadas en $settingsPath"

Write-Host ""
Write-Host "Listo. Arranca con: pi   (y usa /reload tras editar el repo)"
Write-Host "Comandos del sistema: /dotfiles /guardian /tasks /flow"
