# AGENTS.md — ai-dotfiles

Multi-harness AI config repo. Source of truth is **this repo, never `~/.pi`**.

## Layout

- `pi/agent/` → mirrors `~/.pi/agent/`: `extensions/*.ts`, `skills/<name>/SKILL.md`, `prompts/*.md`, `themes/*.json`, `settings.base.json`
- `pi/scripts/`: `install.ps1` (Windows), `install.sh` (unix)
- `herdr-desktop/`: backup mirror of `~/.config/herdr-app` (`layouts/`, `mods/`, `backgrounds/`); restore steps live in its README
- `.playwright-cli/` and `.agents/` are untracked local output — do not commit

## Work here, not in `~/.pi`

1. Edit under `pi/agent/`, then re-run installer: `pi/scripts/install.ps1` (or `./install.sh`), then `pi` + `/reload`.
2. Installer is idempotent: skips good links, only deletes **links** (real files kept unless `-Force`, which backs up to `.bak-*`, pruned to last 2), cleans orphan links, ignores `.gitkeep`. `settings.base.json` is **merged** over `settings.json` (auth/model preserved) with timestamped backup.
3. Fallbacks: `install.ps1 -Copy`, `install.sh --copy`. Never hand-edit `~/.pi/agent`.

## Git (see `pi/agent/prompts/commit.md`, `merge.md` — they are the executable source)

- Flow `feature/*` → `develop` → `main`, always `git merge --no-ff`. Never `--force`, never delete branches or push without explicit confirmation.
- One commit per top-level area (`pi/`, `herdr-desktop/`, `root` = loose files), alphabetical order, `tipo(área): mensaje` lowercase imperative ≤72 chars. Types `feat|fix|docs|chore|refactor|test` (default `chore`).
- Never override identity (`git -c user.name=...` forbidden).
- `git status --short` must be clean before merge; check `git log --oneline -5`.

## pi conventions

- Extensions import from `@earendil-works/pi-coding-agent` / `@earendil-works/pi-tui`. Follow the pattern in existing `pi/agent/extensions/*.ts`; do not reinvent overlay/footer primitives.
- Every skill is `pi/agent/skills/<name>/SKILL.md` (installer warns if missing). Empty dirs keep `.gitkeep`.
- `settings.base.json` stays valid JSON, minimal keys only — never auth/model.

## Docs convention

- READMEs: English `README.md` is primary, Spanish `README.es.md` secondary, with flag cross-links (`🇪🇸`/`🇬🇧`). Applies to root, `pi/`, `herdr-desktop/`.

## Verification (no build/lint/test in this repo)

- Validate `settings.base.json` JSON, re-run installer, confirm summary shows links OK.
- Smoke test: `pi` starts cleanly, `/reload` applies the change.
