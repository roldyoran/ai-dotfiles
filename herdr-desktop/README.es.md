# herdr-desktop — backup tema roldy-theme

> 🇬🇧 English version: [README.md](README.md)

Backup del setup personalizado de Herdr Desktop (Windows). Esta carpeta es la
fuente de verdad del tema — la app viva lee desde `~/.config/herdr-app`
(`$HERDR_APP_HOME` lo cambia), así que restaurar es copiar estos archivos ahí
y recargar en caliente.

## Qué se respalda (y qué no)

```text
herdr-desktop/
  README.md                     # Este archivo en inglés — ver README.es.md para español
  README.es.md                  # Este archivo
  layouts/roldy-theme.json      # layout activo (clon de main, v0.1.15)
  mods/roldy-tabs/main.js         # barra de tabs (clon de tabs, X siempre visible)
  mods/roldy-tabs/mod.json
  mods/roldy-tabs/win-*.svg       # botones de ventana (del clon)
  mods/always-notify/main.js    # sonido + toast en CADA transición del agente
  mods/always-notify/mod.json
  backgrounds/mountain_1.jpg    # fondo EN USO (cover)
  backgrounds/imagen-back-2.jpg # fondo alternativo
```

Respaldado: solo el tema custom (layout + 2 mods + fondos en uso).
No respaldado (local de la máquina, se edita en la app):

- `settings.json` — zoom, sonidos, fuentes, apariencia, telemetría (ver Sonidos y ajustes)
- `keys.json` — atajos por defecto intactos
- `programs.json`, `themes/*.json` — sin entradas custom
- layouts originales (`main`, `terminals`, `win98`) y mods originales
  (`agents`, `tabs`, `files`, `changes`, `toast`, …) — Herdr los reemplaza
  completos en cada arranque; nunca editarlos, clonar primero (`layout.clone`, `mod.clone`)
- `view.json`, `shared.json`, `data/`, `seen.json`, `window.json` — estado en vivo
- `layouts/.state/` — overrides de clics/tamaños (sobreviven reinicios, no editar a mano)

Fondos vivos no incluidos aquí: `image-back.jpg`, `image-back.png`,
`mountain.jpg` (alternativos que quedaron solo en `~/.config/herdr-app/backgrounds/`).

## Layout: `roldy-theme.json`

Clon de `main`. Raíz tipo `row`:

- `sidebar` (columna, 268px, `chrome`, no redimensionable): `brand` (46px,
  `workspace-chrome`) → `sidebar-lists` (columna: `spaces` peso 1 +
  `agents` peso 1 + `always-notify` 2px) → `sidebar-footer` (69px)
- `work` (columna): barra `tabs` (42px, `window_drag`) → `work-body` (fila:
  bloque tab `main` + `panel` stack `files`/`changes`, oculto) → `status` (28px)
- `titlebar: none` (barra custom), `traffic_lights: [12, 16]` para macOS

Look (tokens de raíz — el layout gana a `settings.json`, el theme picker gana a ambos):

- acento `#f59e0b`, base neutral-950 `#0a0a0a`
- `background/canvas/chrome/surface/popover` en `#0a0a0acc` (80% opacidad),
  excepto `popover: #0a0a0a` (menús 100% opacos)
- `background: { image: backgrounds/mountain_1.jpg, fit: cover }`
- `terminal_opacity: 0.3`, marco de pane `background: #0a0a0a99` (terminales destacan),
  `terminal_padding: [14, 12]`, `radius: 10`, `gap: 8`, `lone: true`
- divisor raíz `#262626` (neutral-800), `work-body` con velo `#0a0a0acc`

Sidebar colapsado (<160px): los mods dibujan rail compacto (letra inicial + punto de estado).

## Mods

### `roldy-tabs` (`place: none`, clon del `tabs` original)

Barra de tabs. Igual que el original, salvo que la X de cerrar sale en **todas**
las tabs, no solo en la activa. La X inactiva va atenuada, hover la resalta.
Clic en X cierra con `tab.close { id }` (stopPropagation para no seleccionar antes).

### `always-notify` (83 líneas, `place: none`)

Suena + toast en **cada** transición del agente, aun mirando la app.
El built-in solo toca sonidos `blocked`/`done` (y pone el toast) cuando **no** miras;
si lo miras cambia `done → idle` en silencio.

| transición | built-in | este mod |
|---|---|---|
| `→ blocked` | sonido + toast (si estás fuera) | `playSound("blocked")` + toast error |
| `→ done` | sonido + toast (si estás fuera) | `playSound("done")` + toast éxito |
| `working → idle` (terminó mientras mirabas) | silencio | `playSound("done")` + toast éxito |
| `done → idle` (ya viste el toast) | silencio | silencio (a propósito) |
| primera vista (p. ej. al abrir) | — | registra en silencio, sin ruido |

Detalles:

- vigila `agents()` en cada render (Herdr re-renderiza al cambiar live-data)
  más red de seguridad con `cx.timer` cada 2s; `herdr-app check` nunca tiene efectos
- `soundsOn()` lee `settings().sounds.enabled !== false` — el mute global sigue
  muteando el sonido (el toast igual sale); los MP3 custom de `sounds.done`/
  `sounds.blocked` se respetan solos vía `playSound("done"/"blocked")`
- la acción del toast corre `agent.focus { terminal }` (clic salta al agente)
- estado debug en `shared.json`: `always-notify.alive` (heartbeat),
  `always-notify.last { kind, address, name, at }`
- el bloque en layout es `size: { px: 2 }`, **no** `hidden: true` — un bloque oculto
  nunca se instancia (probado: sin key en `shared.json` hasta hacerlo visible)

## Fondos

- en uso: `backgrounds/mountain_1.jpg` (`fit: cover`)
- alternativo en repo: `backgrounds/imagen-back-2.jpg`
- Herdr no carga `.avif` como fondo; usar PNG/JPG
- imágenes/SVG se referencian desde `~/.config/herdr-app`: `image("mods/<name>/…")`,
  guardar bajo `mods/` refresca cada copia que lo muestra

## Sonidos y ajustes (`settings.json`, NO en este backup)

`~/.config/herdr-app/settings.json` vivo (local de la máquina):

```json
{
  "zoom": 1,
  "sounds": { "enabled": true },
  "font_ligatures": false,
  "minimum_contrast": 1,
  "appearance": "dark",
  "telemetry": false,
  "font_size": 16
}
```

- `sounds.enabled: false` mutea `playSound` (y el sonido de este mod); los toasts igual salen
- sonidos propios: `"sounds": { "enabled": true, "done": "sounds/mio-done.mp3",
  "blocked": "sounds/mio-blocked.mp3" }` — ruta absoluta o relativa a
  `~/.config/herdr-app`; aplica en vivo, incluyendo los botones Play en
  Settings → Alerts (`An agent needs you` / `An agent finished`)
- `zoom` escala todo (0.5–3); `appearance: dark` + tokens dark del layout;
  `telemetry: false` frena conteos anónimos

## Restaurar (Windows pwsh)

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\backgrounds | Out-Null
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs | Out-Null
Copy-Item .\herdr-desktop\mods\roldy-tabs\* $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\always-notify | Out-Null
Copy-Item .\herdr-desktop\mods\always-notify\main.js $env:USERPROFILE\.config\herdr-app\mods\always-notify\main.js -Force
Copy-Item .\herdr-desktop\mods\always-notify\mod.json $env:USERPROFILE\.config\herdr-app\mods\always-notify\mod.json -Force
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\always-notify
herdr-app do layout.switch --name "roldy-theme"
herdr-app status
```

Unix (mismas rutas bajo `~/.config/herdr-app`):

```sh
cp herdr-desktop/layouts/roldy-theme.json ~/.config/herdr-app/layouts/roldy-theme.json
mkdir -p ~/.config/herdr-app/backgrounds ~/.config/herdr-app/mods/roldy-tabs ~/.config/herdr-app/mods/always-notify
cp herdr-desktop/backgrounds/* ~/.config/herdr-app/backgrounds/
cp herdr-desktop/mods/roldy-tabs/* ~/.config/herdr-app/mods/roldy-tabs/
cp herdr-desktop/mods/always-notify/main.js herdr-desktop/mods/always-notify/mod.json ~/.config/herdr-app/mods/always-notify/
herdr-app check ~/.config/herdr-app/mods/roldy-tabs
herdr-app check ~/.config/herdr-app/mods/always-notify
herdr-app do layout.switch --name "roldy-theme"
herdr-app status
```

## Aplicar y verificar

```sh
herdr-app check ~/.config/herdr-app/mods/roldy-tabs       # debe pasar; X en cada tab
herdr-app check ~/.config/herdr-app/mods/always-notify   # debe pasar; sin efectos (checking())
herdr-app status        # layout roldy-theme, sin errores, overlays []
herdr-app ls            # spaces > tabs > terminales
herdr-app shot /tmp/herdr.png   # chequeo visual (sirve tapado/minimizado)
```

- guardar un mod recarga en caliente cada copia; si falla conserva la versión vieja
  y lo reporta en `status` + archivo `<name>.error`
- confirma que `always-notify` corre: `shared.json` debe tener `always-notify.alive`
  (heartbeat cada 2s) — si falta, su bloque no está instanciado en el layout
- prueba sonido: deja el tab del agente visible, deja que otro termine / te necesite →
  debe sonar + toast aun mirando; clic en toast → `agent.focus`
- prueba preview cuando sea: Settings → Alerts → `Play` (llama `playSound` directo)

## Flujo de edición (repo = fuente de verdad)

1. Edita en vivo bajo `~/.config/herdr-app/` (`layouts/roldy-theme.json`, `mods/<name>/main.js`)
2. `herdr-app check <mod>` debe pasar, `herdr-app status` limpio, `herdr-app shot` para ver
3. Copia de vuelta al repo: layout + mod(s) cambiado(s) + fondos nuevos
4. Un commit por área según convención (`herdr-desktop/`), `git status --short` limpio

Nunca edites layouts/mods originales en su lugar — al arrancar los mueve a
`<name>-edited` y restaura los de Herdr. Clona, y apunta el layout al clon.

## Troubleshooting

- no suena mirando → falta `always-notify.alive` en `shared.json` → el bloque está
  `hidden` o falta en el layout mostrado; debe ser bloque visible (aunque sea 2px)
- `herdr-app check` falla → imprime el error exacto; corrige, guarda, re-chequea
  (la versión vieja sigue corriendo mientras)
- `status.errors` no vacío o archivo `<mod>.error` → archivo inválido apartado
- layout raro tras editar → `layout.switch` reaplica; los clics viven en
  `layouts/.state/`, `layout.reset {name}` restaura un layout original
- sonidos muteados → `settings.json → sounds.enabled` está en `false`
- MP3 custom no suena → ruta absoluta o relativa al home, formato MP3
- escape total: `ctrl-alt-shift-escape` resetea layout mostrado + `keys.json`
