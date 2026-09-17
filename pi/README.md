# pi — Carpeta lista para desarrollar juntos

Fuente de verdad: `pi/agent/`. Se instala (symlink) en `~/.pi/agent/`.

```
pi/
├── README.md
├── agent/
│   ├── settings.base.json   # base mínima, se mergea sin pisar tu auth/modelo
│   ├── extensions/          # vacío — aquí crearemos tus extensiones
│   └── skills/              # vacío — aquí crearemos tus skills
└── scripts/
    ├── install.ps1
    └── install.sh
```

## Instalación

```powershell
cd pi/scripts
./install.ps1
```

## Cómo crearemos extensiones

1. Me dices qué quieres (ej: "quiero un guard de seguridad").
2. La creamos en `pi/agent/extensions/NN-nombre.ts`.
3. Probamos con `pi` + `/reload`.
4. `install.ps1` solo si es archivo nuevo (crea el symlink).

Sin código de más: partimos de cero contigo.
