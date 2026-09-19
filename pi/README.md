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
