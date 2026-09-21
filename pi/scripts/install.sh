#!/usr/bin/env bash
# Instala el sistema pi de ai-dotfiles: symlinks a ~/.pi/agent + merge de settings.
#
# Uso:
#   ./install.sh              # symlinks (por defecto)
#   ./install.sh --copy       # copiar en vez de symlink
#   ./install.sh --force      # respalda (.bak) archivos reales que choquen y reemplaza
#   ./install.sh --keep-backups=N  # conserva solo los ultimos N .bak por archivo (def: 2)
#   ./install.sh --uninstall  # quita solo los links del repo
#   ./install.sh --no-color   # sin colores
#   ./install.sh --help       # ayuda
set -euo pipefail
IFS=$'\n\t'

MODE="link"
FORCE=0
UNINSTALL=0
NO_COLOR=0
KEEP_BACKUPS=2

for arg in "$@"; do
  case "$arg" in
    --copy) MODE="copy" ;;
    --force) FORCE=1 ;;
    --keep-backups=*) KEEP_BACKUPS="${arg#*=}" ;;
    --uninstall) UNINSTALL=1 ;;
    --no-color) NO_COLOR=1 ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "Flag desconocido: $arg (usa --help)" >&2; exit 2 ;;
  esac
done

if ! [[ "$KEEP_BACKUPS" =~ ^[0-9]+$ ]]; then
  echo "--keep-backups debe ser un numero >= 0 (recibido: $KEEP_BACKUPS)" >&2; exit 2
fi

# ---- colores (respetan NO_COLOR y salida no-tty) ----
if [[ $NO_COLOR -eq 1 || -n "${NO_COLOR:-}" && "${NO_COLOR:-}" != "0" ]] || [[ ! -t 1 ]]; then
  C_RST=""; C_BOLD=""; C_GREEN=""; C_CYAN=""; C_YELLOW=""; C_RED=""; C_GRAY=""; C_WHITE=""
else
  C_RST=$'\033[0m'; C_BOLD=$'\033[1m'; C_GREEN=$'\033[32m'; C_CYAN=$'\033[36m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_GRAY=$'\033[90m'; C_WHITE=$'\033[97m'
fi
title() { printf "\n${C_CYAN}== %s ==${C_RST}\n" "$1"; }
ok()    { printf "  ${C_GREEN}[OK]${C_RST}  %s\n" "$1"; }
lnk()   { printf "  ${C_GREEN}[LINK]${C_RST} %s\n" "$1"; }
cpy()   { printf "  ${C_GREEN}[COPY]${C_RST} %s\n" "$1"; }
info()  { printf "  ${C_CYAN}[..]${C_RST}  ${C_GRAY}%s${C_RST}\n" "$1"; }
warn()  { printf "  ${C_YELLOW}[ !! ]${C_RST} ${C_YELLOW}%s${C_RST}\n" "$1"; }
err()   { printf "  ${C_RED}[FAIL]${C_RST} %s\n" "$1" >&2; }
dim()   { printf "  ${C_GRAY}%s${C_RST}\n" "$1"; }
trap 'err "Algo fallo en la linea $LINENO. Revisa los mensajes de arriba."' ERR

banner() {
  printf "\n${C_CYAN}+==============================================================+${C_RST}\n"
  printf "${C_CYAN}|  ${C_RST}${C_WHITE}ai-dotfiles${C_RST}${C_CYAN}  -  instalador ${C_RST}${C_BOLD}pi${C_RST}                              ${C_CYAN}|${C_RST}\n"
  printf "${C_CYAN}+==============================================================+${C_RST}\n"
}

# ---- rutas ----
REPO_PI="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_PI/agent"
DST="$HOME/.pi/agent"

N_LINKED=0; N_COPIED=0; N_SKIPPED=0; N_CLEANED=0; N_BACKEDUP=0; N_PRUNED=0

is_link() { [[ -L "$1" ]]; }

remove_safe() { # remove_safe <dst> <label> -> 0 si libre para instalar, 1 si se debe omitir
  local dst="$1" label="$2"
  [[ -e "$dst" || -L "$dst" ]] || return 0
  if is_link "$dst"; then
    rm -f "$dst"  # reemplazo de link: no cuenta como "huerfano limpio"
    return 0
  fi
  if [[ -d "$dst" ]]; then
    if [[ $FORCE -eq 1 ]]; then
      local bak="${dst}.bak-$(date +%Y%m%d-%H%M%S)"
      mv "$dst" "$bak"
      N_BACKEDUP=$((N_BACKEDUP + 1))
      warn "$label existe como directorio real -> respaldado en $(basename "$bak")"
      return 0
    fi
    warn "$label ya existe como directorio real, lo respeto (usa --force para respaldar y reemplazar)"
    N_SKIPPED=$((N_SKIPPED + 1))
    return 1
  else
    if [[ $FORCE -eq 1 ]]; then
      local bak="${dst}.bak-$(date +%Y%m%d-%H%M%S)"
      mv "$dst" "$bak"
      N_BACKEDUP=$((N_BACKEDUP + 1))
      warn "$label existe como archivo real -> respaldado en $(basename "$bak")"
      return 0
    fi
    warn "$label ya existe como archivo real, lo respeto (usa --force para respaldar y reemplazar)"
    N_SKIPPED=$((N_SKIPPED + 1))
    return 1
  fi
}

install_entry() { # install_entry <src> <dst> <label>
  local src="$1" dst="$2" label="$3"
  # Idempotente: si ya apunta al mismo origen, no tocar (evita degradar links buenos)
  if is_link "$dst" && [[ "$(readlink "$dst")" == "$src" ]]; then
    dim "ya enlazado: $label"
    return 0
  fi
  remove_safe "$dst" "$label" || return 0
  if [[ "$MODE" == "copy" ]]; then
    if [[ -d "$src" ]]; then cp -R "$src" "$dst"; else cp -f "$src" "$dst"; fi
    N_COPIED=$((N_COPIED + 1))
    cpy "$label"
  else
    ln -sfn "$src" "$dst"
    if is_link "$dst"; then
      N_LINKED=$((N_LINKED + 1))
      lnk "$label"
    else
      # MSYS/Git-Bash sin winsymlinks crea copias en vez de symlinks nativos.
      N_COPIED=$((N_COPIED + 1))
      cpy "$label (copia: tu shell no crea symlinks nativos)"
      warn "Tip Windows: usa pi/scripts/install.ps1 para symlinks reales"
      dim "  o exporta MSYS=winsymlinks:nativestrict y reinstala con --force"
    fi
  fi
}

clear_orphans() { # clear_orphans <targetDir> <validNames...>: borra links cuyo nombre ya no esta en el repo
  local target_dir="$1"; shift
  local valid=("$@")
  [[ -d "$target_dir" ]] || return 0
  local entry name keep
  for entry in "$target_dir"/* "$target_dir"/.*; do
    [[ -e "$entry" || -L "$entry" ]] || continue
    name="$(basename "$entry")"
    [[ "$name" == "." || "$name" == ".." || "$name" == ".gitkeep" ]] && continue
    keep=0
    for v in ${valid[@]+"${valid[@]}"}; do [[ "$name" == "$v" ]] && { keep=1; break; }; done
    if [[ $keep -eq 0 ]]; then
      if is_link "$entry"; then
        rm -f "$entry"
        N_CLEANED=$((N_CLEANED + 1))
        dim "limpio huerfano: $name"
      else
        dim "conservo archivo propio: $name"
      fi
    fi
  done
}

prune_backups() { # prune_backups <dir> [label]: conserva solo los ultimos KEEP_BACKUPS .bak/.backup por archivo base
  local dir="$1" label="${2:-backups}" keep="$KEEP_BACKUPS"
  if [[ "$keep" -lt 0 ]]; then return 0; fi
  [[ -d "$dir" ]] || return 0
  local list bases b entry mtime tmp tmp2 i
  tmp="$(mktemp)"
  for entry in "$dir"/*.bak-* "$dir"/*.backup-* "$dir"/*.malo*.bak; do
    [[ -e "$entry" || -L "$entry" ]] || continue
    b="$(basename "$entry")"
    b="$(printf '%s' "$b" | sed -E 's/\.bak-[0-9]{8}-[0-9]{6}.*$//; s/\.backup-[0-9]{8}-[0-9]{6}.*$//; s/\.malo.*\.bak$//')"
    printf '%s\n' "$b" >> "$tmp"
  done
  bases="$(sort -u "$tmp" 2>/dev/null)"
  rm -f "$tmp"
  [[ -n "$bases" ]] || return 0
  while IFS= read -r b; do
    [[ -n "$b" ]] || continue
    tmp2="$(mktemp)"
    for entry in "$dir/$b".bak-* "$dir/$b".backup-* "$dir/$b".malo*.bak; do
      [[ -e "$entry" || -L "$entry" ]] || continue
      if mtime="$(stat -c %Y "$entry" 2>/dev/null)"; then :;
      elif mtime="$(stat -f %m "$entry" 2>/dev/null)"; then :;
      else mtime=0; fi
      printf '%s\t%s\n' "$mtime" "$entry" >> "$tmp2"
    done
    i=0
    while IFS= read -r entry; do
      [[ -n "$entry" ]] || continue
      i=$((i + 1))
      if [[ $i -gt $keep ]]; then
        rm -rf "$entry"
        N_PRUNED=$((N_PRUNED + 1))
        dim "podo backup viejo ($label): $(basename "$entry")"
      fi
    done < <(sort -rn "$tmp2" 2>/dev/null | cut -f2-)
    rm -f "$tmp2"
  done <<< "$bases"
}

pick_python() {
  # Devuelve el interprete usable en stdout. El stub de "python" del
  # Windows Store existe pero no ejecuta (exit 49): hay que probarlo.
  local c
  for c in python3 python py; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import json,sys' >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

merge_settings() {
  local base="$1" dest="$2" py=""
  py="$(pick_python || true)"

  if [[ -f "$dest" ]]; then
    local ts
    ts="$(date +%Y%m%d-%H%M%S)"
    cp -f "$dest" "${dest}.backup-${ts}"
    N_BACKEDUP=$((N_BACKEDUP + 1))
    dim "backup: $(basename "$dest").backup-${ts}"
  else
    info "no existia settings.json -> se crea nuevo"
  fi

  if [[ -n "$py" ]]; then
    "$py" - "$base" "$dest" <<'EOF'
import json, sys, os
base_path, dest_path = sys.argv[1], sys.argv[2]
with open(base_path, encoding="utf-8") as f:
    base = json.load(f)
cur = {}
if os.path.exists(dest_path):
    try:
        with open(dest_path, encoding="utf-8") as f:
            raw = f.read().strip()
            cur = json.loads(raw) if raw else {}
    except Exception:
        bad = dest_path + ".malo.bak"
        try: os.replace(dest_path, bad)
        except Exception: pass
        print("  [ !! ] settings.json estaba corrupto -> respaldado, empiezo de cero")
        cur = {}
cur.update(base)
with open(dest_path, "w", encoding="utf-8") as f:
    json.dump(cur, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF
  elif command -v node >/dev/null 2>&1; then
    node -e "
const fs=require('fs');
const base=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const p=process.argv[2];
let cur={};
try{const r=fs.readFileSync(p,'utf8').trim(); cur=r?JSON.parse(r):{};}catch(e){
  try{fs.copyFileSync(p,p+'.malo.bak');}catch(_){}
  console.log('  [ !! ] settings.json estaba corrupto -> respaldado, empiezo de cero');
  cur={};
}
Object.assign(cur,base);
fs.writeFileSync(p,JSON.stringify(cur,null,2)+'\n');
" "$base" "$dest"
  else
    if [[ ! -f "$dest" ]]; then
      cp -f "$base" "$dest"
      warn "sin python/node: copio settings.base.json tal cual (sin merge)"
    else
      err "sin python3/python/node: no puedo fusionar settings.json"
      return 1
    fi
  fi
  ok "settings fusionadas en $dest"
}

# ---- main ----
banner
dim "repo   : $SRC"
dim "destino: $DST"
dim "modo   : $([[ "$MODE" == "copy" ]] && echo "COPIA (--copy)" || echo "SYMLINK")"

[[ -d "$SRC" ]] || { err "No existe la carpeta del repo: $SRC"; exit 1; }
[[ -f "$SRC/settings.base.json" ]] || { err "Falta settings.base.json en $SRC"; exit 1; }

mkdir -p "$DST/extensions" "$DST/skills" "$DST/prompts" "$DST/themes"

if [[ $UNINSTALL -eq 1 ]]; then
  title "Desinstalando links del repo"
  for dir in extensions skills prompts themes; do
    [[ -d "$DST/$dir" ]] || continue
    for entry in "$DST/$dir"/*; do
      [[ -e "$entry" || -L "$entry" ]] || continue
      name="$(basename "$entry")"
      [[ "$name" == ".gitkeep" ]] && continue
      if is_link "$entry"; then
        rm -f "$entry"
        N_CLEANED=$((N_CLEANED + 1))
        ok "quitado $dir/$name"
      else
        dim "conservo (no es link): $dir/$name"
      fi
    done
  done
  printf "\n  ${C_GREEN}Desinstalado. Tus archivos propios quedaron intactos.${C_RST}\n\n"
  exit 0
fi

# 1. extensiones
title "1/5  Extensiones  (*.ts)"
ext_names=()
shopt -s nullglob 2>/dev/null || true
ext_files=("$SRC"/extensions/*.ts)
if [[ ${#ext_files[@]} -eq 0 ]]; then
  dim "(sin extensiones .ts para enlazar)"
else
  for f in "${ext_files[@]}"; do
    name="$(basename "$f")"
    [[ "$name" == ".gitkeep" ]] && continue
    ext_names+=("$name")
    install_entry "$f" "$DST/extensions/$name" "extensions/$name"
  done
fi
clear_orphans "$DST/extensions" ${ext_names[@]+"${ext_names[@]}"}
prune_backups "$DST/extensions" "extensions"

# 2. skills
title "2/5  Skills  (subcarpetas)"
skill_names=()
found_skill=0
for d in "$SRC"/skills/*/; do
  [[ -d "$d" ]] || continue
  src_dir="${d%/}"
  name="$(basename "$src_dir")"
  found_skill=1
  skill_names+=("$name")
  [[ -f "$src_dir/SKILL.md" ]] || warn "skills/$name no tiene SKILL.md (igual la enlazo)"
  install_entry "$src_dir" "$DST/skills/$name" "skills/$name"
done
[[ $found_skill -eq 0 ]] && dim "(sin skills todavia - crea una en pi/agent/skills/mi-skill/SKILL.md)"
clear_orphans "$DST/skills" ${skill_names[@]+"${skill_names[@]}"}
prune_backups "$DST/skills" "skills"

# 3. prompts
title "3/5  Prompts  (*.md)"
prompt_names=()
prompt_files=("$SRC"/prompts/*.md)
if [[ ${#prompt_files[@]} -eq 0 ]]; then
  dim "(sin prompts .md para enlazar)"
else
  for f in "${prompt_files[@]}"; do
    name="$(basename "$f")"
    [[ "$name" == ".gitkeep" ]] && continue
    prompt_names+=("$name")
    install_entry "$f" "$DST/prompts/$name" "prompts/$name"
  done
fi
clear_orphans "$DST/prompts" ${prompt_names[@]+"${prompt_names[@]}"}
prune_backups "$DST/prompts" "prompts"

# 4. themes
title "4/5  Themes  (*.json)"
theme_names=()
theme_files=("$SRC"/themes/*.json)
if [[ ${#theme_files[@]} -eq 0 ]]; then
  dim "(sin themes .json para enlazar)"
else
  for f in "${theme_files[@]}"; do
    name="$(basename "$f")"
    [[ "$name" == ".gitkeep" ]] && continue
    theme_names+=("$name")
    install_entry "$f" "$DST/themes/$name" "themes/$name"
  done
fi
clear_orphans "$DST/themes" ${theme_names[@]+"${theme_names[@]}"}
prune_backups "$DST/themes" "themes"

# 5. settings
title "5/5  Settings  (merge settings.base.json)"
merge_settings "$SRC/settings.base.json" "$DST/settings.json"
prune_backups "$DST" "settings"

# resumen
printf "\n${C_CYAN}+--------------------------------------------------------------+${C_RST}\n"
printf "${C_CYAN}|  ${C_RST}${C_WHITE}RESUMEN${C_RST}                                                      ${C_CYAN}|${C_RST}\n"
printf "${C_CYAN}+--------------------------------------------------------------+${C_RST}\n"
printf "   Links creados : ${C_GREEN}%s${C_RST}\n" "$N_LINKED"
printf "   Copiados      : ${C_GREEN}%s${C_RST}\n" "$N_COPIED"
printf "   Huerfanos limp: ${C_CYAN}%s${C_RST}\n" "$N_CLEANED"
printf "   Backups       : ${C_CYAN}%s${C_RST}\n" "$N_BACKEDUP"
printf "   Backups podados : ${C_CYAN}%s${C_RST}\n" "$N_PRUNED"
printf "   Omitidos      : ${C_YELLOW}%s${C_RST}\n" "$N_SKIPPED"
printf "\n  ${C_CYAN}Siguiente paso:${C_RST}\n"
printf "    1. ${C_YELLOW}pi${C_RST}          # arranca con tu sistema\n"
printf "    2. ${C_YELLOW}/reload${C_RST}      # recarga tras editar el repo\n"
printf "\n  ${C_GREEN}Listo. Buen build!${C_RST}\n\n"
