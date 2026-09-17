---
description: Commits por áreas con conventional commits (uno por área, sin mezclar)
argument-hint: "[mensaje extra]"
---
Haz commits con conventional commits, separados por áreas, en este repo. Extra: $@

1. Inspecciona: `git status --short`, `git branch --show-current`, `git diff --stat` y `git diff --cached --stat`.
2. Agrupa los cambios por área = carpeta top-level (`pi/`, `shared/`, etc; archivos sueltos en root = área `root`). No mezcles áreas en el mismo commit.
3. Por cada área con cambios: `git add <área>` y un commit `tipo(área): mensaje` en minúsculas, imperativo presente.
   Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Si no sabes cuál, usa `chore`.
4. Reglas:
   - NO uses `git -c user.name=...` ni `user.email=...`. Usa la config ya existente.
   - Un commit por área, en orden alfabético de área.
   - Mensaje corto (≤72 chars) + si hace falta, cuerpo con detalle.
   - No hagas push salvo que te lo pida.
5. Al final muestra `git log --oneline -n 5` y `git status --short`.
