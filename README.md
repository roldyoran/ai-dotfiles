# ai-dotfiles — Configuraciones multi-harness

Repo único para gestionar la configuración de distintos harnesses de IA.
Hoy: **pi**. Mañana: `claude/`, `codex/`, `opencode/`, `gemini/`, etc.

```
ai-dotfiles/
├── README.md            # Este archivo
├── shared/              # Principios, memoria y docs compartidos entre harnesses
│   ├── PRINCIPLES.md
│   └── MEMORY.md
├── pi/                  # Todo lo de pi-coding-agent (harness activo)
│   ├── README.md
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
3. **`shared/` es cross-harness**: principios y memoria que cada harness inyecta a su manera (en pi vía extensión `00-boot`).
4. **Instalación por symlink**: `pi/scripts/install.ps1` enlaza `pi/agent/*` → `~/.pi/agent/*`.

## Uso rápido (pi)

```powershell
cd pi/scripts
./install.ps1        # enlaza extensions + skills, mergea settings.base.json
pi                  # arranca con tu sistema cargado
/reload             # recarga extensiones tras editar el repo
```

Ver `pi/README.md` para el detalle del sistema.
