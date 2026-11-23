---
description: Area-scoped commits with conventional commits (one per area, no mixing)
argument-hint: "[extra message]"
---
Make commits with conventional commits, split by area, in this repo. Extra: $@

1. Inspect: `git status --short`, `git branch --show-current`, `git diff --stat` and `git diff --cached --stat`.
2. Group changes by area = top-level folder (`pi/`, `shared/`, etc; loose files in root = `root` area). Don't mix areas in the same commit.
3. For each area with changes: `git add <area>` and one commit `type(area): message` in lowercase, imperative mood.
   Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. When unsure, use `chore`.
4. Rules:
   - Do NOT use `git -c user.name=...` or `user.email=...`. Use the existing config.
   - One commit per area, in alphabetical area order.
   - Short message (≤72 chars) + body with details if needed.
   - Don't push unless asked.
5. At the end show `git log --oneline -n 5` and `git status --short`.
