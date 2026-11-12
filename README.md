# ai-dotfiles — Multi-harness configurations

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Single repo to manage the configuration of different AI harnesses.
Today: **pi**. Tomorrow: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```
ai-dotfiles/
├── AGENTS.md              # repo rules: source of truth, symlinks, git flow, docs convention
├── README.md              # This file (EN) — see README.es.md for Spanish
├── README.es.md           # Este archivo en español
├── skills-lock.json       # pinned external skills
├── pi/                    # Everything about pi-coding-agent (active harness)
│   ├── README.md          # (EN) — see README.es.md for Spanish
│   ├── README.es.md
│   ├── agent/             # Mirror of ~/.pi/agent/
│   │   ├── settings.base.json
│   │   ├── extensions/    # 00-greeting.ts, 01-resources.ts, 02-tokens-context-ai.ts, 03-todos.ts
│   │   ├── skills/        # <name>/SKILL.md
│   │   ├── prompts/       # commit.md, merge.md (executable git flow)
│   │   └── themes/        # one-dark-pro-darker.json
│   └── scripts/
│       ├── install.ps1    # Windows symlink installer
│       └── install.sh     # unix symlink installer
├── herdr-desktop/         # Backup mirror of ~/.config/herdr-app (roldy-theme)
│   ├── README.md          # (EN) restore steps — see README.es.md for Spanish
│   ├── README.es.md
│   ├── layouts/roldy-theme.json
│   ├── mods/roldy-spaces/ # main.js + mod.json
│   └── backgrounds/       # mountain.jpg (in use) + alternates
├── claude/                # (future)
├── codex/                 # (future)
└── opencode/              # (future)
```

## Philosophy

1. **The repo is the source of truth.** Nothing is edited directly in `~/.pi` or `~/.config/herdr-app` — work here, then install/restore. See `AGENTS.md`.
2. **Each harness has its own folder** (`pi/`, `claude/`...) with its native format. `pi/agent/` mirrors `~/.pi/agent/`; `herdr-desktop/` mirrors `~/.config/herdr-app`.
3. **Symlink install (pi).** `pi/scripts/install.ps1` (or `install.sh`) links `pi/agent/*` → `~/.pi/agent/*`. Idempotent: skips good links, only deletes links, merges `settings.base.json` over `settings.json` preserving auth/model.
4. **Docs in EN-ES with flags.** English `README.md` is primary, Spanish `README.es.md` secondary, cross-linked with 🇪🇸/🇬🇧 flags. Applies to root, `pi/`, `herdr-desktop/`.

## Quick start (pi)

```powershell
cd pi/scripts
./install.ps1        # links extensions + skills + prompts + themes, merges settings.base.json
pi                  # starts with your system loaded
/reload             # reloads extensions after editing the repo
```

See `pi/README.md` for the system detail.

> Note (herdr-desktop): no installer/symlink — it is a manual backup. Copy files back as described in `herdr-desktop/README.md`. Summary below.

## herdr-desktop (backup of `~/.config/herdr-app`)

Backup of the custom Herdr Desktop design (`roldy-theme` layout, `roldy-spaces` mod, backgrounds). Full steps live in `herdr-desktop/README.md`.

Restore sketch (Windows pwsh):

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\main.js $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\main.js -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\mod.json $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\mod.json -Force
herdr-app do layout.switch --name "roldy-theme"
```

## Author

These configurations and extensions are by developer **roldyoran**.
They are personal setups, but open for anyone to use and improve.
