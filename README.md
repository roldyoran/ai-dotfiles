# ai-dotfiles — Multi-harness configurations

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Single repo to manage the configuration of different AI harnesses.
Today: **pi**. Tomorrow: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```
ai-dotfiles/
├── README.md            # This file (EN) — see README.es.md for Spanish
├── README.es.md         # Este archivo en español
├── pi/                  # Everything about pi-coding-agent (active harness)
│   ├── README.md        # (EN) — see README.es.md for Spanish
│   ├── README.es.md
│   ├── agent/           # Mirror of ~/.pi/agent/
│   │   ├── settings.base.json
│   │   ├── extensions/
│   │   └── skills/
│   └── scripts/
│       ├── install.ps1
│       └── install.sh
├── claude/              # (future)
├── codex/               # (future)
└── opencode/            # (future)
```

## Philosophy

1. **The repo is the source of truth.** Nothing is edited directly in `~/.pi`.
2. **Each harness has its own folder** (`pi/`, `claude/`...) with its native format.
3. **Symlink install**: `pi/scripts/install.ps1` links `pi/agent/*` → `~/.pi/agent/*`.

## Quick start (pi)

```powershell
cd pi/scripts
./install.ps1        # links extensions + skills, merges settings.base.json
pi                  # starts with your system loaded
/reload             # reloads extensions after editing the repo
```

See `pi/README.md` for the system detail.

## Author

These configurations and extensions are by developer **roldyoran**.
They are personal setups, but open for anyone to use and improve.
