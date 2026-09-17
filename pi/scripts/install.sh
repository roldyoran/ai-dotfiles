#!/usr/bin/env bash
# Instala el sistema pi de ai-dotfiles: symlinks a ~/.pi/agent + merge de settings.
# Uso: ./install.sh
set -euo pipefail

REPO_PI="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_PI/agent"
DST="$HOME/.pi/agent"

mkdir -p "$DST/extensions" "$DST/skills"
echo "◆ ai-dotfiles/pi → $DST"

for f in "$SRC"/extensions/*.ts; do
  [ -e "$f" ] || continue
  ln -sfn "$f" "$DST/extensions/$(basename "$f")"
  echo "  + link $(basename "$f")"
done

for d in "$SRC"/skills/*/; do
  [ -d "$d" ] || continue
  ln -sfn "$d" "$DST/skills/$(basename "$d")"
  echo "  + link skill $(basename "$d")"
done

# Merge settings.base.json (python3, python o node — lo que haya)
if command -v python3 >/dev/null 2>&1; then PY=python3;
elif command -v python >/dev/null 2>&1; then PY=python;
else PY=""; fi

if [ -n "$PY" ]; then
"$PY" - "$SRC/settings.base.json" "$DST/settings.json" <<'EOF'
import json, sys, os
base_path, settings_path = sys.argv[1], sys.argv[2]
with open(base_path) as f: base = json.load(f)
cur = {}
if os.path.exists(settings_path):
    with open(settings_path) as f:
        try: cur = json.load(f)
        except Exception: cur = {}
cur.update(base)
with open(settings_path, "w") as f: json.dump(cur, f, indent=2)
print(f"  + settings mergeadas en {settings_path}")
EOF
else
node -e "
const fs=require('fs');
const base=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const p=process.argv[2];
let cur={}; try{cur=JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){}
Object.assign(cur,base);
fs.writeFileSync(p,JSON.stringify(cur,null,2));
console.log('  + settings mergeadas en '+p);
" "$SRC/settings.base.json" "$DST/settings.json"
fi

echo ""
echo "Listo. Arranca con: pi   (y usa /reload tras editar el repo)"
echo "Comandos del sistema: /dotfiles /guardian /tasks /flow"
