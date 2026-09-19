# pi — Carpeta lista para desarrollar juntos

> 🇬🇧 English version: [README.md](README.md)

Fuente de verdad: `pi/agent/`. Se instala (symlink) en `~/.pi/agent/`.

```
pi/
├── README.md
├── README.es.md         # Este archivo
├── agent/
│   ├── settings.base.json   # base mínima, se mergea sin pisar tu auth/modelo
│   ├── extensions/
│   └── skills/
│   └── prompts/
└── scripts/
    ├── install.ps1
    └── install.sh
```

## Instalación

```powershell
cd pi/scripts
./install.ps1
```
