# pi — Folder ready to build together

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Source of truth: `pi/agent/`. Installed (symlink) into `~/.pi/agent/`.

```
pi/
├── README.md
├── README.es.md
├── agent/
│   ├── settings.base.json   # minimal base, merged without overwriting your auth/model
│   ├── extensions/
│   └── skills/
│   └── prompts/
└── scripts/
    ├── install.ps1
    └── install.sh
```

## Install

```powershell
cd pi/scripts
./install.ps1
```

## Extensions

| File | Command | What it does |
|------|---------|--------------|
| `00-greeting.ts` | — (startup banner) | Two-column welcome: big π logo + session info |
| `01-resources.ts` | `/resources` | Read-only overlay with Context, Skills, Prompts and Extensions |
| `02-tokens-context-ai.ts` | `/tokens-context-ai` | Toggles stock footer ↔ improved footer (tokens + context bar) |
| `03-todos.ts` | `/todos` + `todo` tool | Session-scoped TODO list (branch-aware, no disk). `/todos` shows/hides the overlay; the model tracks multi-step work via the `todo` tool |
