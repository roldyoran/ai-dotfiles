# herdr-desktop — backup tema roldy-theme

Backup del diseño personalizado de Herdr Desktop (Windows).

## Estructura

```text
herdr-desktop/
  README.md
  layouts/roldy-theme.json        # layout activo (clon de main)
  mods/roldy-spaces/main.js       # rail colapsado con letra + estado
  mods/roldy-spaces/mod.json
  backgrounds/mountain.jpg       # fondo en uso (cover)
  backgrounds/imagen-back-2.jpg   # fondo alternativo
  backgrounds/image-back.png      # fondo alternativo (cielo)
```

## Estado actual

- layout: `roldy-theme` (acento `#f59e0b`, base neutral-950 `#0a0a0a`)
- fondo: `backgrounds/mountain.jpg` con `fit: cover`
- opacidad 80%: `background/canvas/chrome/surface/popover` en `#0a0a0acc`
- `terminal_opacity: 0.3` (pane de terminal en `#0a0a0a99` para que se note)
- menús/popups (`popover`) opacos al 100%
- `work-body` con velo `#0a0a0acc` sobre sus rebordes
- sidebar en `chrome`, divider root en `#262626` (neutral-800)
- sidebar colapsado (<160px): letra inicial del space + punto de estado

## Restaurar (Windows pwsh)

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\backgrounds | Out-Null
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces | Out-Null
Copy-Item .\herdr-desktop\mods\roldy-spaces\main.js $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\main.js -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\mod.json $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\mod.json -Force
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces
herdr-app do layout.switch --name "roldy-theme"
herdr-app status
```

Nota: Herdr no carga `.avif` como fondo; usar PNG/JPG.
