# ai-dotfiles — Configuraciones multi-harness

> 🇬🇧 English version: [README.md](README.md)

Repo único para gestionar la configuración de distintos harnesses de IA.
Hoy: **pi**. Mañana: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```
ai-dotfiles/
├── AGENTS.md              # reglas del repo: fuente de verdad, symlinks, flujo git, convención docs
├── README.md              # Este archivo en inglés — ver README.es.md para español
├── README.es.md           # Este archivo
├── skills-lock.json       # skills externas fijadas
├── pi/                    # Todo lo de pi-coding-agent (harness activo)
│   ├── README.md          # (EN) — ver README.es.md para español
│   ├── README.es.md
│   ├── agent/             # Espejo de ~/.pi/agent/
│   │   ├── settings.base.json
│   │   ├── extensions/    # 00-greeting.ts, 01-resources.ts, 02-tokens-context-ai.ts, 03-todos.ts
│   │   ├── skills/        # <nombre>/SKILL.md
│   │   ├── prompts/       # commit.md, merge.md (flujo git ejecutable)
│   │   └── themes/        # one-dark-pro-darker.json
│   └── scripts/
│       ├── install.ps1    # instalador por symlinks (Windows)
│       └── install.sh     # instalador por symlinks (unix)
├── herdr-desktop/         # Backup espejo de ~/.config/herdr-app (roldy-theme)
│   ├── README.md          # (EN) pasos de restore — ver README.es.md para español
│   ├── README.es.md
│   ├── layouts/roldy-theme.json
│   ├── mods/roldy-spaces/ # main.js + mod.json
│   └── backgrounds/       # mountain.jpg (en uso) + alternos
├── claude/                # (futuro)
├── codex/                 # (futuro)
└── opencode/              # (futuro)
```

## Filosofía

1. **El repo es la fuente de verdad.** Nada se edita directamente en `~/.pi` ni en `~/.config/herdr-app` — se trabaja aquí, luego se instala/restaura. Ver `AGENTS.md`.
2. **Cada harness tiene su carpeta** (`pi/`, `claude/`...) con su formato nativo. `pi/agent/` es espejo de `~/.pi/agent/`; `herdr-desktop/` es espejo de `~/.config/herdr-app`.
3. **Instalación por symlink (pi).** `pi/scripts/install.ps1` (o `install.sh`) enlaza `pi/agent/*` → `~/.pi/agent/*`. Idempotente: omite enlaces buenos, solo borra enlaces, mergea `settings.base.json` sobre `settings.json` preservando auth/modelo.
4. **Docs en EN-ES con flags.** El `README.md` en inglés es primario, `README.es.md` en español secundario, enlazados con flags 🇪🇸/🇬🇧. Aplica a raíz, `pi/`, `herdr-desktop/`.

## Uso rápido (pi)

```powershell
cd pi/scripts
./install.ps1        # enlaza extensions + skills + prompts + themes, mergea settings.base.json
pi                  # arranca con tu sistema cargado
/reload             # recarga extensiones tras editar el repo
```

Ver `pi/README.es.md` para el detalle del sistema.

> Nota (herdr-desktop): sin instalador/symlink — es un backup manual. Copia los archivos de vuelta como se describe en `herdr-desktop/README.es.md`. Resumen abajo.

## herdr-desktop (backup de `~/.config/herdr-app`)

Backup del diseño personalizado de Herdr Desktop (layout `roldy-theme`, mod `roldy-spaces`, fondos). Pasos completos en `herdr-desktop/README.es.md`.

Restaurar (resumen, Windows pwsh):

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\main.js $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\main.js -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\mod.json $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\mod.json -Force
herdr-app do layout.switch --name "roldy-theme"
```

## Autor

Estas configuraciones y extensiones son del desarrollador **roldyoran**.
Son cosas personales, pero abiertas para mejora y uso de cualquiera.
