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

## Reinstalación

Las reinstalaciones usan `-Force` por defecto: los archivos reales en `~/.pi`
se respaldan a `.bak-*` (se guardan los últimos 2) y se reemplazan con enlaces a este repo.

```powershell
./install.ps1 -Force
```

## Extensiones

| Archivo | Comando | Qué hace |
|---------|---------|----------|
| `00-greeting.ts` | — (banner de arranque) | Bienvenida en dos columnas: logo π grande + info de sesión |
| `01-resources.ts` | `/resources` | Ventana de solo lectura con Context, Skills, Prompts y Extensions |
| `02-tokens-context-ai.ts` | `/tokens-context-ai` | Alterna footer original ↔ mejorado (tokens + barra de contexto) |
| `03-todos.ts` | `/todos` + tool `todo` | Lista TODO de sesión (por branch, sin disco). `/todos` muestra/oculta la ventana; el modelo trackea trabajo multi-paso con el tool `todo` |
