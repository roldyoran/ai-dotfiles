# herdr-desktop — roldy-theme backup

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Backup of the custom Herdr Desktop setup (Windows). This folder is the
source of truth for the custom theme — the live app reads from
`~/.config/herdr-app` (`$HERDR_APP_HOME` overrides), so restoring means
copying these files there and hot-reloading.

## What is backed up (and what is not)

```text
herdr-desktop/
  README.md                     # This file (EN) — see README.es.md for Spanish
  README.es.md                  # Spanish version
  layouts/roldy-theme.json      # active layout (clone of main, v0.1.15)
  mods/roldy-tabs/main.js         # tabs bar (clone of shipped tabs, X always visible)
  mods/roldy-tabs/mod.json
  mods/roldy-tabs/win-*.svg       # window buttons (from clone)
  mods/always-notify/main.js    # sound + toast on EVERY agent transition
  mods/always-notify/mod.json
  mods/water-reminder/main.js + drop.svg + sounds/  # drink-water reminder every 16 min (timer + toast)
  mods/water-reminder/mod.json
  mods/posture-reminder/main.js + shrimp.svg + sounds/  # posture reminder every 30 min (timer + toast)
  mods/posture-reminder/mod.json
  backgrounds/mountain_1.jpg    # background IN USE (cover)
  backgrounds/imagen-back-2.jpg # alternate background
```

Backed up: only the custom theme (layout + 4 custom mods + backgrounds in use).
Not backed up (machine-local, edited in the app):

- `settings.json` — zoom, sounds, fonts, appearance, telemetry (see Sounds & settings)
- `keys.json` — untouched default shortcuts
- `programs.json`, `themes/*.json` — no custom entries
- shipped layouts (`main`, `terminals`, `win98`) and shipped mods
  (`agents`, `tabs`, `files`, `changes`, `toast`, …) — Herdr replaces them
  whole on every start; never edit them, clone first (`layout.clone`, `mod.clone`)
- `view.json`, `shared.json`, `data/`, `seen.json`, `window.json` — runtime state
- `layouts/.state/` — click/size overrides (survive restarts, don't edit by hand)

Live backgrounds not in this backup: `image-back.jpg`, `image-back.png`,
`mountain.jpg` (alternates that stayed only in `~/.config/herdr-app/backgrounds/`).

## Layout: `roldy-theme.json`

Clone of `main`. Root is a `row`:

- `sidebar` (column, 268px, `chrome`, not resizable): `brand` (46px,
  `workspace-chrome`) → `sidebar-lists` (column: `spaces` weight 1 +
  `agents` weight 1 + `always-notify` 2px + `water-reminder` 2px +
  `posture-reminder` 2px) → `sidebar-footer` (69px)
- `work` (column): `tabs` bar (42px, `window_drag`) → `work-body` (row:
  `main` tab block + `panel` stack `files`/`changes`, hidden) → `status` (28px)
- `titlebar: none` (custom bar), `traffic_lights: [12, 16]` for macOS

Look (root tokens — layout wins over `settings.json`, theme picker overrides both):

- accent `#f59e0b`, base neutral-950 `#0a0a0a`
- `background/canvas/chrome/surface/popover` at `#0a0a0acc` (80% opacity),
  except `popover: #0a0a0a` (menus 100% opaque)
- `background: { image: backgrounds/mountain_1.jpg, fit: cover }`
- `terminal_opacity: 0.3`, pane frame `background: #0a0a0a99` (terminals stand out),
  `terminal_padding: [14, 12]`, `radius: 10`, `gap: 8`, `lone: true`
- root divider `#262626` (neutral-800), `work-body` veil `#0a0a0acc`

Collapsed sidebar (<160px): mods draw a compact rail (initial letter + status dot).

## Mods

### `roldy-tabs` (`place: none`, cloned from shipped `tabs`)

Tabs bar. Same as shipped, except the close X shows on **every** tab, not only
the active one. Inactive X is muted, hover highlights. Click X closes via
`tab.close { id }` (stopPropagation so it never selects first).

### `always-notify` (83 lines, `place: none`)

Sounds + toast on **every** agent transition, even while looking at the app.

### `water-reminder` (`place: none`)

Drink-water reminder every 16 min (change `MINUTES` on top of `main.js`).
Timer checks every 60s, posts a toast with a custom droplet icon (`drop.svg`),
rotating message, 60s timeout, plus its own sound (`sounds/cute-water.mp3`),
then reschedules. Clicking the toast snoozes 10 min
(`water-reminder.snooze` via `nextCommand`); `water-reminder.preview` shows one
without touching the timer. Respects global mute for sound (toast
still shows). Only runs with Herdr open — closing the window pauses it.
State in `shared.json`: `water-reminder.next/alive/last/count`.
Layout block is `size: { px: 2 }`, not `hidden` (same reason as always-notify).
Herdr built-in only plays `blocked`/`done` sounds (and posts the toast) when you
are **not** looking; when you watch it flips `done → idle` silently.

| transition | built-in | this mod |
|---|---|---|
| `→ blocked` | sound + toast (if away) | `playSound("blocked")` + error toast |
| `→ done` | sound + toast (if away) | `playSound("done")` + success toast |
| `working → idle` (finished while watched) | silent | `playSound("done")` + success toast |
| `done → idle` (you saw the toast) | silent | silent (by design) |
| first seen (e.g. app start) | — | registers silently, no noise |

Details:

- watches `agents()` on every render (Herdr re-renders on live-data change)
  plus a 2s `cx.timer` re-eval safety net; `herdr-app check` never has side effects
- `soundsOn()` reads `settings().sounds.enabled !== false` — global mute still
  mutes the sound (toast still shows); custom MP3s from `sounds.done`/`sounds.blocked`
  are honored automatically via `playSound("done"/"blocked")`
- toast action runs `agent.focus { terminal }` (click jumps to the agent)
- debug state in `shared.json`: `always-notify.alive` (heartbeat),
  `always-notify.last { kind, address, name, at }`
- layout block is `size: { px: 2 }`, **not** `hidden: true` — a hidden block
  never instantiates (proven: no `shared.json` key until it was made visible)

### `posture-reminder` (`place: none`)

Posture reminder every 30 min (change `MINUTES` on top of `main.js`).
Same pattern as `water-reminder`: timer checks every 60s, posts a toast with
a custom shrimp icon (`shrimp.svg`, anti modo-gamba 🍤), rotating general
advice, 12s timeout, plus its own sound (`sounds/posture.mp3`),
then reschedules. Clicking the toast snoozes 10 min
(`posture-reminder.snooze` via `nextCommand`); `posture-reminder.preview` shows one
without touching the timer. Respects global mute for sound (toast
still shows). Only runs with Herdr open — closing the window pauses it.
State in `shared.json`: `posture-reminder.next/alive/last/count`.
Layout block is `size: { px: 2 }`, not `hidden` (same reason as always-notify).

## Backgrounds

- in use: `backgrounds/mountain_1.jpg` (`fit: cover`)
- alternate in repo: `backgrounds/imagen-back-2.jpg`
- Herdr does not load `.avif` as background; use PNG/JPG
- images/SVGs are referenced from `~/.config/herdr-app`: `image("mods/<name>/…")`,
  saving under `mods/` refreshes every copy showing it

## Sounds & settings (`settings.json`, NOT in this backup)

Live `~/.config/herdr-app/settings.json` (machine-local):

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

- `sounds.enabled: false` mutes `playSound` (and this mod's sound); toasts still show
- custom sounds: `"sounds": { "enabled": true, "done": "sounds/my-done.mp3",
  "blocked": "sounds/my-blocked.mp3" }` — absolute path or relative to
  `~/.config/herdr-app`; applies live, including the Play buttons in
  Settings → Alerts (`An agent needs you` / `An agent finished`)
- `zoom` scales everything (0.5–3); `appearance: dark` + layout dark tokens;
  `telemetry: false` stops anonymous counts

## Restore (Windows pwsh)

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\backgrounds | Out-Null
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs | Out-Null
Copy-Item .\herdr-desktop\mods\roldy-tabs\* $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\always-notify | Out-Null
Copy-Item .\herdr-desktop\mods\always-notify\main.js $env:USERPROFILE\.config\herdr-app\mods\always-notify\main.js -Force
Copy-Item .\herdr-desktop\mods\always-notify\mod.json $env:USERPROFILE\.config\herdr-app\mods\always-notify\mod.json -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\water-reminder | Out-Null
Copy-Item .\herdr-desktop\mods\water-reminder\* $env:USERPROFILE\.config\herdr-app\mods\water-reminder\ -Force
New-Item -ItemType Directory -Force $env:USERPROFILE\.config\herdr-app\mods\posture-reminder | Out-Null
Copy-Item .\herdr-desktop\mods\posture-reminder\* $env:USERPROFILE\.config\herdr-app\mods\posture-reminder\ -Force
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\always-notify
herdr-app check $env:USERPROFILE\.config\herdr-app\mods\posture-reminder
herdr-app do layout.switch --name "roldy-theme"
herdr-app status
```

Unix (same paths under `~/.config/herdr-app`):

```sh
cp herdr-desktop/layouts/roldy-theme.json ~/.config/herdr-app/layouts/roldy-theme.json
mkdir -p ~/.config/herdr-app/backgrounds ~/.config/herdr-app/mods/roldy-tabs ~/.config/herdr-app/mods/always-notify ~/.config/herdr-app/mods/water-reminder ~/.config/herdr-app/mods/posture-reminder
cp herdr-desktop/backgrounds/* ~/.config/herdr-app/backgrounds/
cp herdr-desktop/mods/roldy-tabs/* ~/.config/herdr-app/mods/roldy-tabs/
cp herdr-desktop/mods/always-notify/main.js herdr-desktop/mods/always-notify/mod.json ~/.config/herdr-app/mods/always-notify/
cp herdr-desktop/mods/water-reminder/* ~/.config/herdr-app/mods/water-reminder/
cp herdr-desktop/mods/posture-reminder/main.js herdr-desktop/mods/posture-reminder/mod.json herdr-desktop/mods/posture-reminder/shrimp.svg ~/.config/herdr-app/mods/posture-reminder/
cp herdr-desktop/mods/posture-reminder/sounds/* ~/.config/herdr-app/mods/posture-reminder/sounds/
herdr-app check ~/.config/herdr-app/mods/roldy-tabs
herdr-app check ~/.config/herdr-app/mods/water-reminder
herdr-app check ~/.config/herdr-app/mods/always-notify
herdr-app check ~/.config/herdr-app/mods/posture-reminder
herdr-app do layout.switch --name "roldy-theme"
herdr-app status
```

## Apply & verify

```sh
herdr-app check ~/.config/herdr-app/mods/water-reminder    # must pass; timer only, no side effects
herdr-app check ~/.config/herdr-app/mods/roldy-tabs       # must pass; X on every tab
herdr-app check ~/.config/herdr-app/mods/always-notify   # must pass; no side effects (checking())
herdr-app check ~/.config/herdr-app/mods/posture-reminder # must pass; timer only, no side effects
herdr-app status        # layout roldy-theme, no errors, overlays []
herdr-app ls            # spaces > tabs > terminals
herdr-app shot /tmp/herdr.png   # visual check (works covered/minimized)
```

- saving any mod file hot-reloads every copy; broken save keeps the old version
  and reports in `status` + `<name>.error`
- confirm `always-notify` runs: `shared.json` must contain `always-notify.alive`
  (heartbeat every 2s) — if missing, its layout block isn't instantiated
- confirm `water-reminder` runs: `shared.json` must contain `water-reminder.alive`
  (heartbeat every 60s) and `water-reminder.next` — if missing, its layout block isn't instantiated
- confirm `posture-reminder` runs: `shared.json` must contain `posture-reminder.alive`
  (heartbeat every 60s) and `posture-reminder.next` — if missing, its layout block isn't instantiated
- test sound: keep the agent tab visible, let another agent finish / need you →
  expect sound + toast even while watching; click toast → `agent.focus`
- test preview anytime: Settings → Alerts → `Play` (calls `playSound` directly)

## Edit workflow (keep repo = source of truth)

1. Edit live under `~/.config/herdr-app/` (`layouts/roldy-theme.json`, `mods/<name>/main.js`)
2. `herdr-app check <mod>` must pass, `herdr-app status` clean, `herdr-app shot` to eyeball
3. Copy back to repo: layout + changed mod(s) + new backgrounds
4. One commit per area per repo convention (`herdr-desktop/`), `git status --short` clean

Never hand-edit shipped layouts/mods in place — next start moves them to
`<name>-edited` and restores Herdr's copy. Clone, then point the layout at the clone.

## Troubleshooting

- no sound while watching → `shared.json` lacks `always-notify.alive` → block is
  `hidden` or missing from the shown layout; must be a visible (even 2px) block
- `herdr-app check` fails → exact error printed; fix, save, re-check (old version
  keeps running meanwhile)
- `status.errors` non-empty or `<mod>.error` file → invalid file kept aside
- layout looks wrong after edit → `layout.switch` re-applies; clicks live in
  `layouts/.state/`, `layout.reset {name}` restores a shipped layout
- sounds muted → `settings.json → sounds.enabled` is `false`
- custom MP3 not playing → path must be absolute or relative to home, MP3 format
- total escape hatch: `ctrl-alt-shift-escape` resets shown layout + `keys.json`
