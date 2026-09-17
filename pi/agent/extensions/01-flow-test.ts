/**
 * 01-flow-test — STUB de prueba, no toca git.
 * Para validar tu flujo: commits por áreas + merge a develop/main con conventional commits.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AREAS = ["pi/", "shared/", "claude/", "codex/", "opencode/", "root"];
const TYPES = ["feat", "fix", "docs", "chore", "refactor", "test"];

function help(): string {
  return [
    "STUB flow-test (no hace nada en git):",
    `· áreas: ${AREAS.join(" ")}`,
    `· tipos: ${TYPES.join(" ")}`,
    "· uso: /flow-commit <area> <tipo> <mensaje>  → solo muestra lo que haría",
    "· uso: /flow-merge <develop|main>  → solo muestra lo que haría",
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("flow-test", {
    description: "[stub] Probar flujo de commits por áreas (no toca git)",
    handler: async (_args, ctx) => {
      ctx.ui.notify(help(), "info");
    },
  });

  pi.registerCommand("flow-commit", {
    description: "[stub] Simula commit por área con conventional commits",
    handler: async (args, ctx) => {
      const [area, type, ...msg] = args.trim().split(/\s+/);
      if (!area || !type || msg.length === 0) {
        ctx.ui.notify(`STUB: falta input. Uso: /flow-commit <area> <tipo> <mensaje>\nEj: /flow-commit pi feat saludo con logo`, "info");
        return;
      }
      if (!AREAS.includes(area)) {
        ctx.ui.notify(`STUB: área "${area}" no válida. Válidas: ${AREAS.join(", ")} (no hice nada)`, "info");
        return;
      }
      if (!TYPES.includes(type)) {
        ctx.ui.notify(`STUB: tipo "${type}" no válido. Válidos: ${TYPES.join(", ")} (no hice nada)`, "info");
        return;
      }
      ctx.ui.notify(
        `STUB commit (nada ejecutado):\n· área: ${area}\n· haría: git add ${area} + commit "${type}(${area}): ${msg.join(" ")}"`,
        "info",
      );
    },
  });

  pi.registerCommand("flow-merge", {
    description: "[stub] Simula merge a develop o main",
    handler: async (args, ctx) => {
      const target = args.trim();
      if (target !== "develop" && target !== "main") {
        ctx.ui.notify(`STUB: uso /flow-merge <develop|main> (no hice nada)`, "info");
        return;
      }
      ctx.ui.notify(`STUB merge (nada ejecutado):\n· haría: git checkout ${target} + merge --no-ff actual → ${target}`, "info");
    },
  });
}
