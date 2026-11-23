# ai-dotfiles — Configuraciones multi-harness

> 🇬🇧 English version: [README.md](README.md)

Repo único para gestionar la configuración de distintos harnesses de IA.
Hoy: **pi** (`pi/`) + backup del tema de Herdr Desktop (`herdr-desktop/`).
Mañana: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```text
ai-dotfiles/
├── AGENTS.md              # reglas del repo: fuente de verdad, symlinks, flujo git, convención docs
├── README.md              # Este archivo en inglés — ver README.es.md para español
├── README.es.md           # Este archivo
├── skills-lock.json       # skills externas fijadas (agent-browser)
├── .gitignore             # ignora .playwright-cli/ + .agents/ (salida local, nunca se commitea)
├── pi/                    # pi-coding-agent (harness activo)
│   ├── README.md / README.es.md
│   ├── agent/             # Espejo de ~/.pi/agent/ (fuente de verdad)
│   │   ├── settings.base.json  # { theme, enableSkillCommands, quietStartup }
│   │   ├── extensions/    # 00-greeting, 01-resources, 02-tokens-context-ai, 03-todos
│   │   ├── skills/        # vacío hoy (.gitkeep) — convención <nombre>/SKILL.md
│   │   ├── prompts/       # commit.md, merge.md (flujo git ejecutable)
│   │   └── themes/        # one-dark-pro-darker.json
│   └── scripts/
│       ├── install.ps1    # instalador por symlinks (Windows)
│       └── install.sh     # instalador por symlinks (unix)
├── herdr-desktop/         # Backup espejo de ~/.config/herdr-app (roldy-theme)
│   ├── README.md / README.es.md
│   ├── layouts/roldy-theme.json        # layout activo (clon de main, v0.1.15)
│   ├── mods/roldy-tabs/                 # barra de tabs (clon de tabs, X siempre visible)
│   ├── mods/always-notify/             # sonido + toast en CADA transición del agente
│   └── backgrounds/                    # mountain_1.jpg (en uso) + imagen-back-2.jpg
├── claude/                # (futuro)
├── codex/                 # (futuro)
└── opencode/              # (futuro)
```

## Filosofía

1. **El repo es la fuente de verdad.** Nada se edita directamente en `~/.pi` ni en `~/.config/herdr-app` — se trabaja aquí, luego se instala/restaura. Ver `AGENTS.md`.
2. **Cada harness tiene su carpeta** (`pi/`, `claude/`...) con su formato nativo. `pi/agent/` es espejo de `~/.pi/agent/`; `herdr-desktop/` es espejo de `~/.config/herdr-app`.
3. **Instalación por symlink (pi).** `pi/scripts/install.ps1` (o `install.sh`) enlaza `pi/agent/*` → `~/.pi/agent/*`. Idempotente: omite enlaces buenos, solo borra **enlaces** (archivos reales intactos), limpia enlaces huérfanos, ignora `.gitkeep`. `settings.base.json` se **mergea** sobre `settings.json` (auth/modelo preservados) con backup con timestamp.
4. **Docs en EN-ES con flags.** El `README.md` en inglés es primario, `README.es.md` en español secundario, enlazados con flags 🇪🇸/🇬🇧. Aplica a raíz, `pi/`, `herdr-desktop/`.
5. **Un commit por área.** El flujo git es `feature/*` → `develop` → `main` con `git merge --no-ff` y conventional commits `tipo(área): mensaje`. Ver [Flujo git](#flujo-git).

## pi — sistema del coding agent

Fuente de verdad: `pi/agent/`. Se instala (symlink) en `~/.pi/agent/`. Detalle completo en `pi/README.es.md`.

### Extensiones (`pi/agent/extensions/*.ts`)

| Archivo | Comando | Qué hace |
|---------|---------|----------|
| `00-greeting.ts` | — (banner de arranque) | Bienvenida en dos columnas: logo π con degradado + info de sesión (cwd, branch, modelo, nivel de thinking) |
| `01-resources.ts` | `/resources` | Ventana de solo lectura con Context, Skills, Prompts y Extensions (compañera del arranque silencioso) |
| `02-tokens-context-ai.ts` | `/tokens-context-ai` | Alterna footer original ↔ compacto (tokens actuales `◈` + barra de contexto + `%`/ventana + costo) |
| `03-todos.ts` | `/todos` + tool `todo` | Lista TODO de sesión (por branch, sin disco). `/todos`, `/todos table`, `Alt+T`. El modelo la maneja con el tool `todo` (`create/update/list/get/delete/clear`) |

### Prompts, tema, settings, skills

- **Prompts** (`pi/agent/prompts/`): `commit.md` — commits por área top-level con conventional commits; `merge.md` — `merge d` (hacia `develop`) / `merge m` (`develop` hacia `main`) con `--no-ff`. Son la fuente ejecutable del flujo git.
- **Tema** (`pi/agent/themes/one-dark-pro-darker.json`): tema oscuro usado con `"theme": "one-dark-pro-darker"`.
- **Settings** (`pi/agent/settings.base.json`): solo base mínima — `{ "theme", "enableSkillCommands": true, "quietStartup": true }`. Nunca auth/modelo. Se mergea, nunca se sobrescribe.
- **Skills** (`pi/agent/skills/`): vacío hoy (se conserva `.gitkeep`). La convención es `skills/<nombre>/SKILL.md` (el instalador avisa si falta). Las skills externas se fijan en `skills-lock.json` (hoy `agent-browser` de `vercel-labs/agent-browser`).

### Instalador (`pi/scripts/install.ps1` / `install.sh`)

5 pasos: `1/5 extensiones (*.ts)` → `2/5 skills (subcarpetas)` → `3/5 prompts (*.md)` → `4/5 themes (*.json)` → `5/5 settings (merge)`.

- Omite enlaces que ya apuntan al repo, solo borra enlaces, respeta tus archivos reales.
- Limpia enlaces huérfanos (borrados del repo) y poda `.bak-*` / `.backup-*` viejos a los últimos 2 por archivo.
- Alternativas: `install.ps1 -Copy` / `install.sh --copy` (sin Developer Mode / sin admin), `-Uninstall` (quita solo los links del repo), `-Force` (respalda conflictos reales a `.bak-<timestamp>` y reemplaza).

### Uso rápido (pi)

```powershell
cd pi/scripts
./install.ps1        # enlaza extensions + skills + prompts + themes, mergea settings.base.json
pi                  # arranca con tu sistema cargado
/reload             # recarga extensiones tras editar el repo
```

> Nota (herdr-desktop): sin instalador/symlink — es un backup manual. Copia los archivos de vuelta como se describe en `herdr-desktop/README.es.md`. Resumen abajo.

## herdr-desktop — backup de `roldy-theme`

Backup del setup personalizado de Herdr Desktop. La app viva lee desde `~/.config/herdr-app`, así que restaurar es copiar estos archivos ahí y recargar en caliente. Pasos completos en `herdr-desktop/README.es.md`.

**Respaldado:** layout + 2 mods propios + fondos en uso. **No respaldado** (local de la máquina): `settings.json`, `keys.json`, layouts/mods originales (nunca editarlos en su lugar — clonar primero), `view.json` / `shared.json` / `data/` / `layouts/.state/`.

| Pieza | Archivo | Resumen |
|-------|---------|---------|
| Layout | `layouts/roldy-theme.json` | Clon de `main`. Acento `#f59e0b`, neutral-950 `#0a0a0a`, superficies al 80% de opacidad (menús 100% opacos), `mountain_1.jpg` cover, `terminal_opacity: 0.3`, `radius: 10`, `gap: 8`, titlebar propia, sidebar de 268px |
| Mod | `mods/roldy-tabs/` | Barra de tabs: igual que el original, X en **cada** tab (no solo activa) |
| Mod | `mods/always-notify/` (83 líneas) | Sonido + toast en **cada** transición del agente, aun mirando la app (el built-in solo avisa cuando no miras) |
| Fondos | `backgrounds/` | `mountain_1.jpg` (en uso) + `imagen-back-2.jpg` (alternativo). Herdr necesita PNG/JPG, no AVIF |

Restaurar (resumen, Windows pwsh):

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
Copy-Item .\herdr-desktop\mods\roldy-tabs\* $env:USERPROFILE\.config\herdr-app\mods\roldy-tabs\ -Force
Copy-Item .\herdr-desktop\mods\always-notify\main.js $env:USERPROFILE\.config\herdr-app\mods\always-notify\main.js -Force
Copy-Item .\herdr-desktop\mods\always-notify\mod.json $env:USERPROFILE\.config\herdr-app\mods\always-notify\mod.json -Force
herdr-app do layout.switch --name "roldy-theme"
```

Flujo de edición: edita en vivo bajo `~/.config/herdr-app/` → `herdr-app check <mod>` debe pasar → `herdr-app status` limpio → `herdr-app shot` para ver → copia de vuelta al repo → un commit para `herdr-desktop/`.

## Flujo git

Fuente ejecutable: `pi/agent/prompts/commit.md` + `merge.md`.

- Flujo `feature/*` → `develop` → `main`, siempre `git merge --no-ff`. Nunca `--force`, nunca borrar ramas ni push sin confirmación explícita.
- Un commit por área top-level (`pi/`, `herdr-desktop/`, `root` = archivos sueltos), orden alfabético, `tipo(área): mensaje` en minúsculas imperativo ≤72 chars. Tipos `feat|fix|docs|chore|refactor|test` (por defecto `chore`).
- Nunca sobrescribir identidad (`git -c user.name=...` prohibido).
- `git status --short` debe estar limpio antes de mergear; revisa `git log --oneline -5`.

## Verificación (sin build/lint/test en este repo)

- Valida que `settings.base.json` sea JSON válido, re-ejecuta el instalador, confirma que el resumen muestra links OK.
- Smoke test: `pi` arranca limpio, `/reload` aplica el cambio.
- Herdr: `herdr-app check <mod>` debe pasar, `herdr-app status` limpio, `herdr-app shot` para chequeo visual. `always-notify` está corriendo cuando `shared.json` contiene `always-notify.alive`.

## Roadmap

- `pi/`: más extensiones, skills (`<nombre>/SKILL.md`), prompts y temas a medida que crezca el sistema.
- `herdr-desktop/`: mantener layout + mods + fondos sincronizados con la app viva.
- Futuros harnesses (`claude/`, `codex/`, `opencode/`, `gemini/`...): mismo patrón — carpeta nativa + READMEs EN/ES + instalador o pasos de restore.

## Autor

Estas configuraciones y extensiones son del desarrollador **roldyoran**.
Son cosas personales, pero abiertas para mejora y uso de cualquiera.
