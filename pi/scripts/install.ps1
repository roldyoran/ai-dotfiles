#Requires -Version 5.1
<#
.SYNOPSIS
  Instala el sistema pi de ai-dotfiles: symlinks a ~/.pi/agent + merge de settings.
.DESCRIPTION
  Enlaza extensions/*.ts, skills/*/, prompts/*.md del repo hacia ~/.pi/agent
  y fusiona settings.base.json sobre settings.json (con backup automatico).
  Limpia symlinks huerfanos (archivos borrados del repo) sin tocar tus archivos reales.
.EXAMPLE
  Set-ExecutionPolicy -Scope Process Bypass
  ./install.ps1
.EXAMPLE
  ./install.ps1 -Copy        # copiar en vez de symlink (sin Developer Mode / sin admin)
.EXAMPLE
  ./install.ps1 -Uninstall   # quita solo los links creados por el repo
.EXAMPLE
  ./install.ps1 -Force       # si hay archivos reales con el mismo nombre, los respalda (.bak) y reemplaza
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$Copy,
  [switch]$Uninstall,
  [switch]$Force,
  [switch]$NoColor
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------- colores ---
$UseColor = (-not $NoColor) -and (-not $env:NO_COLOR) -and ($Host.UI.RawUI.ForegroundColor -ne $null)
function Write-C($Text, [string]$Color = "White", [switch]$NoNewline) {
  if ($UseColor) { Write-Host $Text -ForegroundColor $Color -NoNewline:$NoNewline }
  else { Write-Host $Text -NoNewline:$NoNewline }
}
function Write-Title($t) { Write-C "`n== $t ==" "Cyan" }
function Write-Ok($t)    { Write-C "  [OK]  " "Green" -NoNewline;  Write-C " $t" "White" }
function Write-Link($t)  { Write-C "  [LINK]" "Green" -NoNewline;  Write-C " $t" "White" }
function Write-CopyMsg($t){ Write-C "  [COPY]" "Green" -NoNewline; Write-C " $t" "White" }
function Write-Info($t)  { Write-C "  [..]  " "DarkCyan" -NoNewline; Write-C " $t" "Gray" }
function Write-Warn($t)  { Write-C "  [ !! ] " "Yellow" -NoNewline; Write-C "$t" "Yellow" }
function Write-ErrMsg($t){ Write-C "  [FAIL] " "Red" -NoNewline;    Write-C "$t" "Red" }
function Write-Dim($t)   { Write-C "  $t" "DarkGray" }
function Show-Banner {
  Write-C "`n+==============================================================+" "Cyan"
  Write-C "|  " "Cyan" -NoNewline; Write-C "ai-dotfiles" "White" -NoNewline; Write-C "  -  instalador " "Cyan" -NoNewline; Write-C "pi" "Yellow" -NoNewline; Write-C "                              |" "Cyan"
  Write-C "+==============================================================+" "Cyan"
}

# ---------------------------------------------------------------- rutas -----
if ($PSScriptRoot) { $RepoPi = Split-Path -Parent $PSScriptRoot }
else { $RepoPi = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
$AgentSrc = Join-Path $RepoPi "agent"
$Target   = Join-Path $HOME ".pi/agent"

$script:NLinked = 0; $script:NCopied = 0; $script:NSkipped = 0; $script:NCleaned = 0; $script:NBackedUp = 0

function Ensure-Dir($p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

function Test-IsLink($p) {
  if (-not (Test-Path -LiteralPath $p)) { return $false }
  $item = Get-Item -LiteralPath $p -Force
  if ($item.LinkType) { return $true }
  # Junctions / reparse points (dirs) en PS 5.1 a veces no exponen LinkType
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { return $true }
  return $false
}

function Remove-Safe($dst, [string]$label) {
  # Solo borra links. Archivos/dirs reales: avisa y respeta (salvo -Force -> .bak).
  if (-not (Test-Path -LiteralPath $dst)) { return $true }
  if (Test-IsLink $dst) {
    Remove-Item -LiteralPath $dst -Force
    $script:NCleaned++
    return $true
  }
  $item = Get-Item -LiteralPath $dst -Force
  if ($item.PSIsContainer) {
    if ($Force) {
      $bak = "$dst.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
      Move-Item -LiteralPath $dst -Destination $bak -Force
      $script:NBackedUp++
      Write-Warn "$label existe como directorio real -> respaldado en $(Split-Path $bak -Leaf)"
      return $true
    }
    Write-Warn "$label ya existe como directorio real, lo respeto (usa -Force para respaldar y reemplazar)"
    $script:NSkipped++
    return $false
  }
  else {
    if ($Force) {
      $bak = "$dst.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
      Move-Item -LiteralPath $dst -Destination $bak -Force
      $script:NBackedUp++
      Write-Warn "$label existe como archivo real -> respaldado en $(Split-Path $bak -Leaf)"
      return $true
    }
    Write-Warn "$label ya existe como archivo real, lo respeto (usa -Force para respaldar y reemplazar)"
    $script:NSkipped++
    return $false
  }
}

function Install-Entry($src, $dst, [string]$label) {
  # Idempotente: si ya apunta al mismo origen, no tocar (evita degradar links buenos)
  if ((Test-IsLink $dst) -and ((Get-Item -LiteralPath $dst -Force).Target -eq $src)) {
    Write-Dim "ya enlazado: $label"
    return
  }
  if ($PSCmdlet.ShouldProcess($dst, "instalar $label")) {
    if (-not (Remove-Safe $dst $label)) { return }
    if ($Copy) {
      $s = Get-Item -LiteralPath $src -Force
      if ($s.PSIsContainer) { Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force }
      else { Copy-Item -LiteralPath $src -Destination $dst -Force }
      $script:NCopied++
      Write-CopyMsg "$label"
    }
    else {
      try {
        New-Item -ItemType SymbolicLink -Path $dst -Target $src | Out-Null
        $script:NLinked++
        Write-Link "$label"
      }
      catch {
        Write-Warn "symlink sin permiso para $label -> copio en su lugar."
        Write-Dim "Tip: activa Developer Mode (Windows) o corre como admin para usar symlinks."
        $s = Get-Item -LiteralPath $src -Force
        if ($s.PSIsContainer) { Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force }
        else { Copy-Item -LiteralPath $src -Destination $dst -Force }
        $script:NCopied++
        Write-CopyMsg "$label (copia fallback)"
      }
    }
  }
}

function Clear-Orphans($targetDir, [string[]]$validNames, [string]$kind) {
  if (-not (Test-Path -LiteralPath $targetDir)) { return }
  Get-ChildItem -LiteralPath $targetDir -Force | Where-Object {
    $_.Name -notin @(".gitkeep") -and $validNames -notcontains $_.Name
  } | ForEach-Object {
    $full = $_.FullName
    if (Test-IsLink $full) {
      if ($PSCmdlet.ShouldProcess($full, "limpiar huerfano")) {
        Remove-Item -LiteralPath $full -Force
        $script:NCleaned++
        Write-Dim "limpio huerfano ($kind): $($_.Name)"
      }
    }
    else {
      Write-Dim "conservo archivo propio ($kind): $($_.Name)"
    }
  }
}

# ---------------------------------------------------------------- main ------
try {
  Show-Banner
  Write-Dim "repo   : $AgentSrc"
  Write-Dim "destino: $Target"
  if ($Copy) { Write-Dim "modo   : COPIA (-Copy)" } else { Write-Dim "modo   : SYMLINK" }

  if (-not (Test-Path -LiteralPath $AgentSrc)) { throw "No existe la carpeta del repo: $AgentSrc" }
  if (-not (Test-Path -LiteralPath (Join-Path $AgentSrc "settings.base.json"))) { throw "Falta settings.base.json en $AgentSrc" }

  Ensure-Dir $Target
  Ensure-Dir (Join-Path $Target "extensions")
  Ensure-Dir (Join-Path $Target "skills")
  Ensure-Dir (Join-Path $Target "prompts")
  Ensure-Dir (Join-Path $Target "themes")

  $extSrc = Join-Path $AgentSrc "extensions"
  $skillsSrc = Join-Path $AgentSrc "skills"
  $promptsSrc = Join-Path $AgentSrc "prompts"

  # ---- desinstalar: quita solo links, deja archivos reales intactos ----
  if ($Uninstall) {
    Write-Title "Desinstalando links del repo"
    foreach ($dir in @("extensions", "skills", "prompts", "themes")) {
      $td = Join-Path $Target $dir
      if (-not (Test-Path -LiteralPath $td)) { continue }
      Get-ChildItem -LiteralPath $td -Force | Where-Object { $_.Name -ne ".gitkeep" } | ForEach-Object {
        if (Test-IsLink $_.FullName) {
          if ($PSCmdlet.ShouldProcess($_.FullName, "quitar link")) {
            Remove-Item -LiteralPath $_.FullName -Force
            $script:NCleaned++
            Write-Ok "quitado $($dir)/$($_.Name)"
          }
        }
        else { Write-Dim "conservo (no es link): $($dir)/$($_.Name)" }
      }
    }
    Write-C "`n  Desinstalado. Tus archivos propios quedaron intactos.`n" "Green"
    exit 0
  }

  # ---- 1. extensiones ----
  Write-Title "1/5  Extensiones  (*.ts)"
  $extFiles = @()
  if (Test-Path -LiteralPath $extSrc) {
    $extFiles = @(Get-ChildItem -LiteralPath $extSrc -Filter *.ts -File -Force | Where-Object { $_.Name -ne ".gitkeep" })
  }
  if ($extFiles.Count -eq 0) { Write-Dim "(sin extensiones .ts para enlazar)" }
  foreach ($f in $extFiles) {
    Install-Entry $f.FullName (Join-Path (Join-Path $Target "extensions") $f.Name) "extensions/$($f.Name)"
  }
  Clear-Orphans (Join-Path $Target "extensions") @($extFiles | ForEach-Object { $_.Name }) "extensions"

  # ---- 2. skills ----
  Write-Title "2/5  Skills  (subcarpetas)"
  $skillDirs = @()
  if (Test-Path -LiteralPath $skillsSrc) {
    $skillDirs = @(Get-ChildItem -LiteralPath $skillsSrc -Directory -Force | Where-Object { $_.Name -ne ".gitkeep" -and $_.Name -notlike ".git*" })
  }
  if ($skillDirs.Count -eq 0) { Write-Dim "(sin skills todavia - crea una en pi/agent/skills/mi-skill/SKILL.md)" }
  foreach ($d in $skillDirs) {
    if (-not (Test-Path -LiteralPath (Join-Path $d.FullName "SKILL.md"))) {
      Write-Warn "skills/$($d.Name) no tiene SKILL.md (igual la enlazo)"
    }
    Install-Entry $d.FullName (Join-Path (Join-Path $Target "skills") $d.Name) "skills/$($d.Name)"
  }
  Clear-Orphans (Join-Path $Target "skills") @($skillDirs | ForEach-Object { $_.Name }) "skills"

  # ---- 3. prompts ----
  Write-Title "3/5  Prompts  (*.md)"
  $promptFiles = @()
  if (Test-Path -LiteralPath $promptsSrc) {
    $promptFiles = @(Get-ChildItem -LiteralPath $promptsSrc -Filter *.md -File -Force | Where-Object { $_.Name -ne ".gitkeep" })
  }
  if ($promptFiles.Count -eq 0) { Write-Dim "(sin prompts .md para enlazar)" }
  foreach ($f in $promptFiles) {
    Install-Entry $f.FullName (Join-Path (Join-Path $Target "prompts") $f.Name) "prompts/$($f.Name)"
  }
  Clear-Orphans (Join-Path $Target "prompts") @($promptFiles | ForEach-Object { $_.Name }) "prompts"

  # ---- 4. themes ----
  Write-Title "4/5  Themes  (*.json)"
  $themeFiles = @()
  if (Test-Path -LiteralPath (Join-Path $AgentSrc "themes")) {
    $themeFiles = @(Get-ChildItem -LiteralPath (Join-Path $AgentSrc "themes") -Filter *.json -File -Force | Where-Object { $_.Name -ne ".gitkeep" })
  }
  if ($themeFiles.Count -eq 0) { Write-Dim "(sin themes .json para enlazar)" }
  foreach ($f in $themeFiles) {
    Install-Entry $f.FullName (Join-Path (Join-Path $Target "themes") $f.Name) "themes/$($f.Name)"
  }
  Clear-Orphans (Join-Path $Target "themes") @($themeFiles | ForEach-Object { $_.Name }) "themes"

  # ---- 5. settings (merge con backup) ----
  Write-Title "5/5  Settings  (merge settings.base.json)"
  $basePath = Join-Path $AgentSrc "settings.base.json"
  $settingsPath = Join-Path $Target "settings.json"
  try {
    $base = Get-Content -LiteralPath $basePath -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  catch { throw "settings.base.json no es JSON valido: $($_.Exception.Message)" }
  $cur = New-Object psobject
  if (Test-Path -LiteralPath $settingsPath) {
    try {
      $raw = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8
      if ($raw.Trim()) { $cur = $raw | ConvertFrom-Json }
    }
    catch {
      $bakBad = "$settingsPath.malo-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
      Copy-Item -LiteralPath $settingsPath -Destination $bakBad -Force
      $script:NBackedUp++
      Write-Warn "settings.json estaba corrupto -> respaldado en $(Split-Path $bakBad -Leaf), empiezo de cero"
      $cur = New-Object psobject
    }
    # backup antes de modificar
    $bak = "$settingsPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $settingsPath -Destination $bak -Force
    $script:NBackedUp++
    Write-Dim "backup: $(Split-Path $bak -Leaf)"
  }
  else {
    Write-Info "no existia settings.json -> se crea nuevo"
  }
  foreach ($prop in $base.PSObject.Properties) {
    if ($PSCmdlet.ShouldProcess($settingsPath, "merge $($prop.Name)")) {
      $cur | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
    }
  }
  $cur | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $settingsPath -Encoding UTF8
  Write-Ok "settings fusionadas en $settingsPath"

  # ---- resumen ----
  Write-C "`n+--------------------------------------------------------------+" "Cyan"
  Write-C "|  " "Cyan" -NoNewline; Write-C "RESUMEN" "White" -NoNewline; Write-C "                                                      |" "Cyan"
  Write-C "+--------------------------------------------------------------+" "Cyan"
  Write-C "   Links creados : " "White" -NoNewline; Write-C "$($script:NLinked)" "Green"
  Write-C "   Copiados      : " "White" -NoNewline; Write-C "$($script:NCopied)" "Green"
  Write-C "   Huerfanos limp: " "White" -NoNewline; Write-C "$($script:NCleaned)" "DarkCyan"
  Write-C "   Backups       : " "White" -NoNewline; Write-C "$($script:NBackedUp)" "DarkCyan"
  Write-C "   Omitidos      : " "White" -NoNewline; Write-C "$($script:NSkipped)" "Yellow"

  Write-C "`n  Siguiente paso:" "Cyan"
  Write-C "    1. " "Cyan" -NoNewline; Write-C "pi" "Yellow" -NoNewline; Write-C "          # arranca con tu sistema" "Gray"
  Write-C "    2. " "Cyan" -NoNewline; Write-C "/reload" "Yellow" -NoNewline; Write-C "      # recarga tras editar el repo" "Gray"
  Write-C "`n  Listo. Buen build!`n" "Green"
}
catch {
  Write-ErrMsg $_.Exception.Message
  exit 1
}
