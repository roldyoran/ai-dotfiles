# ai-dotfiles — Configuraciones multi-harness

> 🇬🇧 English version: [README.md](README.md)

Repo único para gestionar la configuración de distintos harnesses de IA.
Hoy: **pi**. Mañana: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```
ai-dotfiles/
├── README.md            # Este archivo en inglés — ver README.es.md para español
├── README.es.md         # Este archivo
├── pi/                  # Todo lo de pi-coding-agent (harness activo)
│   ├── README.md        # (EN) — ver README.es.md para español
│   ├── README.es.md
│   ├── agent/           # Espejo de ~/.pi/agent/
│   │   ├── settings.base.json
│   │   ├── extensions/
│   │   └── skills/
│   └── scripts/
│       ├── install.ps1
│       └── install.sh
├── claude/              # (futuro)
├── codex/               # (futuro)
└── opencode/            # (futuro)
```

## Filosofía

1. **El repo es la fuente de verdad.** Nada se edita directamente en `~/.pi`.
2. **Cada harness tiene su carpeta** (`pi/`, `claude/`...) con su formato nativo.
3. **Instalación por symlink**: `pi/scripts/install.ps1` enlaza `pi/agent/*` → `~/.pi/agent/*`.

## Uso rápido (pi)

```powershell
cd pi/scripts
./install.ps1        # enlaza extensions + skills, mergea settings.base.json
pi                  # arranca con tu sistema cargado
/reload             # recarga extensiones tras editar el repo
```

Ver `pi/README.es.md` para el detalle del sistema.

## Autor

Estas configuraciones y extensiones son del desarrollador **roldyoran**.
Son cosas personales, pero abiertas para mejora y uso de cualquiera.
