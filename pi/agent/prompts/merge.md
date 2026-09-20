---
description: Merge con --no-ff a develop (d) o a main (m) con mensaje detallado
argument-hint: "<d|m>"
---
Haz un merge con `--no-ff` según el argumento: $@
- `d` / `develop` = rama actual into `develop`
- `m` / `main` =  rama `develop` into `main`

Pasos:
1. Resuelve target y source:
   - Si `d`: source = `git branch --show-current`, target = `develop`
   - Si `m`: source = `develop`, target = `main` (ignora la rama actual salvo para verificar que está limpia)
   - Arg inválido → explica uso `/merge d` o `/merge m` y detente.
2. Verifica: `git status --short` debe estar limpio (si no, detente y pide commitear con `/commit` primero). Verifica que `develop` y `main` existen (`git branch -a`).
3. `git checkout <target>` + `git pull --ff-only` si hay remoto (si falla, detente y avisa).
4. Muestra qué va a entrar: `git log --oneline <target>..<source>` y `git diff --stat <target>..<source>`.
5. Merge: `git merge --no-ff <source> -m "merge(<source>-into-<target>): integra <source> en <target>" -m "<resumen de commits incluidos>"`.
   El mensaje debe decir explícitamente qué rama se mergea a cuál.
6. Reglas:
   - NO uses `git -c user.name=...` ni `user.email=...`.
   - Nunca `--force`, nunca borres ramas sin preguntar, nunca push sin confirmación.
7. Al final: `git log --oneline -n 5` y `git status --short`.
8. Solo si el argumento fue `m` y no hubo ningún problema en los pasos anteriores: vuelve a `develop` con `git checkout develop` y confirma la rama con `git branch --show-current`.
