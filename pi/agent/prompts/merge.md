---
description: Merge with --no-ff into develop (d) or main (m) with detailed message
argument-hint: "<d|m>"
---
Merge with `--no-ff` according to the argument: $@
- `d` / `develop` = current branch into `develop`
- `m` / `main` = `develop` branch into `main`

Steps:
1. Resolve target and source:
   - If `d`: source = `git branch --show-current`, target = `develop`
   - If `m`: source = `develop`, target = `main` (ignore the current branch except to verify it's clean)
   - Invalid arg → explain usage `/merge d` or `/merge m` and stop.
2. Verify: `git status --short` must be clean (if not, stop and ask to commit with `/commit` first). Verify `develop` and `main` exist (`git branch -a`).
3. `git checkout <target>` + `git pull --ff-only` if there's a remote (if it fails, stop and report).
4. Show what's coming in: `git log --oneline <target>..<source>` and `git diff --stat <target>..<source>`.
5. Merge: `git merge --no-ff <source> -m "merge(<source>-into-<target>): integrate <source> into <target>" -m "<summary of included commits>"`.
   The message must explicitly say which branch merges into which.
6. Rules:
   - Do NOT use `git -c user.name=...` or `user.email=...`.
   - Never `--force`, never delete branches without asking, never push without confirmation.
7. At the end: `git log --oneline -n 5` and `git status --short`.
8. Only if the argument was `m` and there were no issues in the previous steps: go back to `develop` with `git checkout develop` and confirm the branch with `git branch --show-current`.
