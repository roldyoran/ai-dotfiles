# herdr-desktop — roldy-theme backup

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Backup of the custom Herdr Desktop design (Windows).

## Structure

```text
herdr-desktop/
  README.md                     # This file (EN) — see README.es.md for Spanish
  README.es.md                  # Spanish version
  layouts/roldy-theme.json      # active layout (clone of main)
  mods/roldy-spaces/main.js     # collapsed rail with letter + status
  mods/roldy-spaces/mod.json
  backgrounds/mountain.jpg      # background in use (cover)
  backgrounds/imagen-back-2.jpg # alternate background
  backgrounds/image-back.png    # alternate background (sky)
```

## Current state

- layout: `roldy-theme` (accent `#f59e0b`, base neutral-950 `#0a0a0a`)
- background: `backgrounds/mountain.jpg` with `fit: cover`
- 80% opacity: `background/canvas/chrome/surface/popover` at `#0a0a0acc`
- `terminal_opacity: 0.3` (terminal pane at `#0a0a0a99` so it stands out)
- menus/popups (`popover`) 100% opaque
- `work-body` with `#0a0a0acc` veil over its borders
- sidebar in `chrome`, root divider at `#262626` (neutral-800)
- collapsed sidebar (<160px): space initial letter + status dot

## Restore (Windows pwsh)

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

Note: Herdr doesn't load `.avif` as background; use PNG/JPG.
