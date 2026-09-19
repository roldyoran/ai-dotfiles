# AGENTS.md — ai-dotfiles

Multi-harness AI config repo. Source of truth is **this repo, never `~/.pi`**.

## Layout

- `pi/agent/` → mirrors `~/.pi/agent/`: `extensions/*.ts`, `skills/*/SKILL.md`, `prompts/*.md`, `themes/*.json`, `settings.base.json`
- `pi/scripts/`: `install.ps1` (Windows), `install.sh` (unix) — symlink repo → `~/.pi/agent` + merge settings
- `.playwright-cli/` is untracked local tool output — do not commit it

## Work here, not in `~/.pi`

1. Edit files under `pi/agent/`.
2. Re-run installer: `pi/scripts/install.ps1` (or `./install.sh`), then `pi` + `/reload` to pick up changes.
3. Installer is idempotent: skips good links, only deletes **links** (real files are kept unless `-Force`/`--force`, which backs up to `.bak-*`), cleans orphan links, ignores `.gitkeep`. `settings.base.json` is **merged** over `settings.json` (auth/model preserved) with timestamped backup.

Fallbacks: `install.ps1 -Copy` (no symlink perms), `install.sh --copy`. Never hand-edit `~/.pi/agent` to "fix" something.

## Git conventions (enforced via `/commit`, `/merge` prompts)

- Branch flow: `feature/*` → `develop` → `main`, always `git merge --no-ff`. Never `--force`, never delete branches or push without explicit confirmation.
- Commits: conventional commits, **one commit per top-level area** (`pi/`, `root` = loose files), alphabetical order, `tipo(área): mensaje` lowercase imperative ≤72 chars. Types: `feat|fix|docs|chore|refactor|test` (default `chore`).
- Never override identity (`git -c user.name=...` forbidden — use existing config).
- Verify with `git status --short` (must be clean before merge) and `git log --oneline -5`.

## pi conventions

- Extensions are `.ts` importing from `@earendil-works/pi-coding-agent` / `@earendil-works/pi-tui`. Follow the pattern comments in `pi/agent/extensions/*.ts` (`registerCommand`, `ctx.ui.custom` overlay, `ctx.getContextUsage()`); do not reinvent TUI/overlay/footer primitives.
- Every skill is a subfolder `pi/agent/skills/<name>/SKILL.md` (installer warns if missing). Empty dirs keep `.gitkeep` so git tracks them.
- `settings.base.json` must stay valid JSON, minimal keys only — never put auth/model there.

## Verification (no build/lint/test in this repo)

- JSON check + reinstall: validate `settings.base.json`, re-run the installer script, confirm summary shows links OK.
- No test suite; smoke test is `pi` starting cleanly and `/reload` applying the change.
