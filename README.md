# ai-dotfiles — Multi-harness AI configurations

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Single repo to manage the configuration of different AI harnesses.
Today: **pi** (`pi/`) + Herdr Desktop theme backup (`herdr-desktop/`).
Tomorrow: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```text
ai-dotfiles/
├── AGENTS.md              # repo rules: source of truth, symlinks, git flow, docs convention
├── README.md              # This file (EN) — see README.es.md for Spanish
├── README.es.md           # Spanish translation
├── skills-lock.json       # pinned external skills (agent-browser)
├── .gitignore             # ignores .playwright-cli/ + .agents/ (local output, never committed)
├── pi/                    # pi-coding-agent (active harness)
│   ├── README.md / README.es.md
│   ├── agent/             # Mirror of ~/.pi/agent/ (source of truth)
│   │   ├── settings.base.json  # { theme, enableSkillCommands, quietStartup }
│   │   ├── extensions/    # 00-greeting, 01-resources, 02-tokens-context-ai, 03-todos
│   │   ├── skills/        # empty today (.gitkeep) — <name>/SKILL.md convention
│   │   ├── prompts/       # commit.md, merge.md (executable git flow)
│   │   └── themes/        # one-dark-pro-darker.json
│   └── scripts/
│       ├── install.ps1    # Windows symlink installer
│       └── install.sh     # unix symlink installer
├── herdr-desktop/         # Backup mirror of ~/.config/herdr-app (roldy-theme)
│   ├── README.md / README.es.md
│   ├── layouts/roldy-theme.json        # active layout (clone of main, v0.1.15)
│   ├── mods/roldy-spaces/              # spaces sidebar (clone of shipped spaces)
│   ├── mods/always-notify/             # sound + toast on EVERY agent transition
│   └── backgrounds/                    # mountain_1.jpg (in use) + imagen-back-2.jpg
├── claude/                # (future)
├── codex/                 # (future)
└── opencode/              # (future)
```

## Philosophy

1. **The repo is the source of truth.** Nothing is edited directly in `~/.pi` or `~/.config/herdr-app` — work here, then install/restore. See `AGENTS.md`.
2. **Each harness has its own folder** (`pi/`, `claude/`...) with its native format. `pi/agent/` mirrors `~/.pi/agent/`; `herdr-desktop/` mirrors `~/.config/herdr-app`.
3. **Symlink install (pi).** `pi/scripts/install.ps1` (or `install.sh`) links `pi/agent/*` → `~/.pi/agent/*`. Idempotent: skips good links, only deletes **links** (real files kept), cleans orphan links, ignores `.gitkeep`. `settings.base.json` is **merged** over `settings.json` (auth/model preserved) with timestamped backup.
4. **Docs in EN-ES with flags.** English `README.md` is primary, Spanish `README.es.md` secondary, cross-linked with 🇪🇸/🇬🇧 flags. Applies to root, `pi/`, `herdr-desktop/`.
5. **One commit per area.** Git flow is `feature/*` → `develop` → `main` with `git merge --no-ff` and conventional commits `type(area): message`. See [Git workflow](#git-workflow).

## pi — coding agent system

Source of truth: `pi/agent/`. Installed (symlink) into `~/.pi/agent/`. Full detail in `pi/README.md`.

### Extensions (`pi/agent/extensions/*.ts`)

| File | Command | What it does |
|------|---------|--------------|
| `00-greeting.ts` | — (startup banner) | Two-column welcome: gradient π logo + session info (cwd, branch, model, thinking level) |
| `01-resources.ts` | `/resources` | Read-only overlay with Context, Skills, Prompts and Extensions (quiet startup companion) |
| `02-tokens-context-ai.ts` | `/tokens-context-ai` | Toggles stock footer ↔ compact footer (current tokens `◈` + context fill bar + `%`/window + cost) |
| `03-todos.ts` | `/todos` + `todo` tool | Session-scoped TODO list (branch-aware, no disk). `/todos`, `/todos table`, `Alt+T`. Model drives it via the `todo` tool (`create/update/list/get/delete/clear`) |

### Prompts, theme, settings, skills

- **Prompts** (`pi/agent/prompts/`): `commit.md` — commit by top-level area with conventional commits; `merge.md` — `merge d` (into `develop`) / `merge m` (`develop` into `main`) with `--no-ff`. These are the executable source of the git flow.
- **Theme** (`pi/agent/themes/one-dark-pro-darker.json`): dark theme used via `"theme": "one-dark-pro-darker"`.
- **Settings** (`pi/agent/settings.base.json`): minimal base only — `{ "theme", "enableSkillCommands": true, "quietStartup": true }`. Never auth/model. Merged, never overwritten.
- **Skills** (`pi/agent/skills/`): empty today (`.gitkeep` kept). Convention is `skills/<name>/SKILL.md` (installer warns if missing). External skills are pinned in `skills-lock.json` (currently `agent-browser` from `vercel-labs/agent-browser`).

### Installer (`pi/scripts/install.ps1` / `install.sh`)

5 steps: `1/5 extensions (*.ts)` → `2/5 skills (subfolders)` → `3/5 prompts (*.md)` → `4/5 themes (*.json)` → `5/5 settings (merge)`.

- Skips links already pointing at the repo, removes only links, keeps your real files.
- Cleans orphan links (deleted from repo) and prunes old `.bak-*` / `.backup-*` to the last 2 per file.
- Fallbacks: `install.ps1 -Copy` / `install.sh --copy` (no Developer Mode / no admin), `-Uninstall` (removes only repo links), `-Force` (backs up real conflicts to `.bak-<timestamp>` and replaces).

### Quick start (pi)

```powershell
cd pi/scripts
./install.ps1        # links extensions + skills + prompts + themes, merges settings.base.json
pi                  # starts with your system loaded
/reload             # reloads extensions after editing the repo
```

> Note (herdr-desktop): no installer/symlink — it is a manual backup. Copy files back as described in `herdr-desktop/README.md`. Summary below.

## herdr-desktop — `roldy-theme` backup

Backup of the custom Herdr Desktop setup. The live app reads from `~/.config/herdr-app`, so restoring means copying these files there and hot-reloading. Full steps live in `herdr-desktop/README.md`.

**Backed up:** layout + 2 custom mods + backgrounds in use. **Not backed up** (machine-local): `settings.json`, `keys.json`, shipped layouts/mods (never edit in place — clone first), `view.json` / `shared.json` / `data/` / `layouts/.state/`.

| Piece | File | Summary |
|-------|------|---------|
| Layout | `layouts/roldy-theme.json` | Clone of `main`. Accent `#f59e0b`, neutral-950 `#0a0a0a`, surfaces at 80% opacity (menus 100% opaque), `mountain_1.jpg` cover, `terminal_opacity: 0.3`, `radius: 10`, `gap: 8`, custom titlebar, 268px sidebar |
| Mod | `mods/roldy-spaces/` (486 lines) | Spaces sidebar: stable colored avatars, worktrees nested under checkout, grouped by machine, live repo/branch + ahead/behind |
| Mod | `mods/always-notify/` (83 lines) | Sound + toast on **every** agent transition, even while watching (built-in only notifies when away) |
| Backgrounds | `backgrounds/` | `mountain_1.jpg` (in use) + `imagen-back-2.jpg` (alternate). Herdr needs PNG/JPG, not AVIF |

Restore sketch (Windows pwsh):

```powershell
Copy-Item .\herdr-desktop\layouts\roldy-theme.json $env:USERPROFILE\.config\herdr-app\layouts\roldy-theme.json -Force
Copy-Item .\herdr-desktop\backgrounds\* $env:USERPROFILE\.config\herdr-app\backgrounds\ -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\main.js $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\main.js -Force
Copy-Item .\herdr-desktop\mods\roldy-spaces\mod.json $env:USERPROFILE\.config\herdr-app\mods\roldy-spaces\mod.json -Force
Copy-Item .\herdr-desktop\mods\always-notify\main.js $env:USERPROFILE\.config\herdr-app\mods\always-notify\main.js -Force
Copy-Item .\herdr-desktop\mods\always-notify\mod.json $env:USERPROFILE\.config\herdr-app\mods\always-notify\mod.json -Force
herdr-app do layout.switch --name "roldy-theme"
```

Edit workflow: edit live under `~/.config/herdr-app/` → `herdr-app check <mod>` must pass → `herdr-app status` clean → `herdr-app shot` eyeball → copy back to repo → one commit for `herdr-desktop/`.

## Git workflow

Executable source: `pi/agent/prompts/commit.md` + `merge.md`.

- Flow `feature/*` → `develop` → `main`, always `git merge --no-ff`. Never `--force`, never delete branches or push without explicit confirmation.
- One commit per top-level area (`pi/`, `herdr-desktop/`, `root` = loose files), alphabetical order, `type(area): message` lowercase imperative ≤72 chars. Types `feat|fix|docs|chore|refactor|test` (default `chore`).
- Never override identity (`git -c user.name=...` forbidden).
- `git status --short` must be clean before merge; check `git log --oneline -5`.

## Verification (no build/lint/test in this repo)

- Validate `settings.base.json` is valid JSON, re-run the installer, confirm the summary shows links OK.
- Smoke test: `pi` starts cleanly, `/reload` applies the change.
- Herdr: `herdr-app check <mod>` must pass, `herdr-app status` clean, `herdr-app shot` for a visual check. `always-notify` is running when `shared.json` contains `always-notify.alive`.

## Roadmap

- `pi/`: more extensions, skills (`<name>/SKILL.md`), prompts and themes as the system grows.
- `herdr-desktop/`: keep layout + mods + backgrounds in sync with the live app.
- Future harnesses (`claude/`, `codex/`, `opencode/`, `gemini/`...): same pattern — native folder + EN/ES READMEs + installer or restore steps.

## Author

These configurations and extensions are by developer **roldyoran**.
They are personal setups, but open for anyone to use and improve.
