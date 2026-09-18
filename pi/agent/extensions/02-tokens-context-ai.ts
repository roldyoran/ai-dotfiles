/**
 * 02-tokens-context-ai — footer minimal: solo tokens de la conversación + barra de contexto.
 *
 * Cambia esta línea larga del footer original:
 *   ↑22k ↓3.9k R158k CH96.2% $0.003 2.1%/1.0M (auto)
 * por esta versión compacta:
 *   ◈ 26k · █░░░░░░░░░ 2.1%/1.0M (auto)
 *
 * - `◈ 70k` = uso actual de la ventana de contexto (getContextUsage().tokens),
 *   el mismo número que mide la barra. NO es suma acumulada: sumar `input`
 *   de cada mensaje multiplica de más porque cada input ya incluye el historial.
 * - `█░…` = barra de llenado del contexto total (getContextUsage().percent).
 * - `2.1%/1.0M (auto)` = mismo porcentaje/ventana que el footer original.
 * - El resto queda igual: línea de pwd (+branch, +session) y modelo a la derecha.
 *
 * Comando:
 *   /tokens-context-ai — alterna entre versión original y mejorada (min)
 *
 * Patrones oficiales (no reinventar):
 * - docs/tui.md Pattern 6 → ctx.ui.setFooter(factory) con (tui, theme, footerData);
 *   footerData.getGitBranch()/getExtensionStatuses()/getAvailableProviderCount()/
 *   onBranchChange() son lo único no accesible por otro medio; ctx.ui.setFooter(undefined)
 *   restaura el footer original.
 * - examples/extensions/custom-footer.ts → totales desde sessionManager,
 *   truncateToWidth/visibleWidth para no exceder `width`.
 * - docs/extensions.md → ctx.getContextUsage() ({tokens, contextWindow, percent}),
 *   ctx.model (id/contextWindow/reasoning), pi.on("session_start"|"turn_end"|...) + tui.requestRender().
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isAbsolute, relative, resolve, sep } from "node:path";

type Mode = "min" | "full";

// Activa al arrancar: ves la mejora sin hacer nada; /footer vuelve al original.
let mode: Mode = "min";

// TUI activo del footer custom (para refrescar en cada evento de sesión).
let liveTui: { requestRender(): void } | null = null;
// ctx más reciente (el capturado al instalar el footer queda viejo tras
// cambios de sesión/modelo; el render siempre usa este). Sintetiza TUI+ctx.
let currentCtx: ExtensionContext | null = null;
const requestFooterRender = () => {
  try {
    liveTui?.requestRender();
  } catch {
    /* TUI ya cerrado */
  }
};

/** Igual que FooterComponent.formatTokens en pi (footer.ts). */
function fmt(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
  return `${Math.round(n / 1000000)}M`;
}

/** Igual que formatCwdForFooter en pi: ~ dentro de home, ruta tal cual fuera. */
function fmtCwd(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  const rc = resolve(cwd);
  const rh = resolve(home);
  const rel = relative(rh, rc);
  const inside = rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  if (!inside) return cwd;
  return rel === "" ? "~" : `~${sep}${rel}`;
}

/** Número a mostrar: tokens actuales de la ventana (lo mismo que mide la barra).
 * Tras compaction tokens es null → cae a suma de outputs hasta la próxima respuesta. */
function readUsage(ctx: ExtensionContext): { text: string; tokens: number | null; percent: number | null; window: number } {
  let percent: number | null = 0;
  let win = 0;
  let tokens: number | null = null;
  try {
    const u = ctx.getContextUsage?.();
    percent = u?.percent ?? null;
    win = u?.contextWindow ?? 0;
    tokens = u?.tokens ?? null;
  } catch {
    percent = null;
  }
  if (!win) {
    try {
      win = (ctx as unknown as { model?: { contextWindow?: number } }).model?.contextWindow ?? 0;
    } catch {
      win = 0;
    }
  }
  if (tokens !== null && tokens !== undefined) return { text: fmt(tokens), tokens, percent, window: win };
  const fb = outputFallback(ctx);
  return { text: fmt(fb), tokens: fb, percent, window: win };
}

/** Suma solo outputs (cada respuesta genera tokens nuevos, sin doble conteo).
 * Solo fallback cuando el contexto aún es desconocido (recién compactado). */
function outputFallback(ctx: ExtensionContext): number {
  let total = 0;
  try {
    for (const e of ctx.sessionManager.getEntries() ?? []) {
      const entry = e as unknown as Record<string, unknown>;
      if (entry["type"] === "message") {
        const msg = entry["message"] as Record<string, unknown> | undefined;
        if (msg?.["role"] === "assistant") {
          const u = msg["usage"] as Record<string, number> | undefined;
          if (u) total += u["output"] ?? 0;
        }
      }
    }
  } catch {
    /* sesión aún sin entries */
  }
  return total;
}

const BAR_W = 10;

function bar(tokens: number | null, pct: number | null, theme: { fg(c: string, s: string): string }): string {
  const raw = pct === null || pct <= 0 ? 0 : Math.round((pct / 100) * BAR_W);
  // Mínimo 1 bloque si hay algo de contexto, para que la barra siempre se vea.
  const filled = pct === null || pct <= 0 ? 0 : Math.max(1, Math.min(BAR_W, raw));
  // Verde <300k, amarillo >=300k, rojo >=600k. Sin dato de tokens, cae a %.
  const color =
    tokens !== null && tokens !== undefined
      ? tokens >= 600000
        ? "error"
        : tokens >= 300000
          ? "warning"
          : "success"
      : pct !== null && pct > 90
        ? "error"
        : pct !== null && pct > 70
          ? "warning"
          : "success";
  return theme.fg(color, "█".repeat(filled)) + theme.fg("dim", "░".repeat(BAR_W - filled));
}

function pwdText(ctx: ExtensionContext, footerData: { getGitBranch(): string | null }): string {
  let pwd = fmtCwd(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE);
  try {
    const branch = footerData.getGitBranch();
    if (branch) pwd = `${pwd} (${branch})`;
  } catch {
    /* sin git */
  }
  try {
    const name = ctx.sessionManager.getSessionName();
    if (name) pwd = `${pwd} • ${name}`;
  } catch {
    /* sin nombre */
  }
  return pwd;
}

function modelRight(
  ctx: ExtensionContext,
  footerData: { getAvailableProviderCount(): number },
  leftW: number,
  width: number,
): string {
  const m = (ctx as unknown as { model?: { id?: string; provider?: string; reasoning?: unknown } }).model;
  const modelName = m?.id || "no-model";
  let right = modelName;
  if (m?.reasoning) {
    const level = (ctx as unknown as { thinkingLevel?: string }).thinkingLevel || "off";
    right = level === "off" ? `${modelName} • thinking off` : `${modelName} • ${level}`;
  }
  try {
    if (m?.provider && footerData.getAvailableProviderCount() > 1) {
      const withProvider = `(${m.provider}) ${right}`;
      if (leftW + 2 + visibleWidth(withProvider) <= width) return withProvider;
    }
  } catch {
    /* sin conteo de providers */
  }
  return right;
}

function applyMin(ctx: ExtensionContext): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  currentCtx = ctx;
  ctx.ui.setFooter((tui, theme, footerData) => {
    liveTui = tui;
    const unsub = footerData.onBranchChange(() => tui.requestRender());
    return {
      dispose: () => {
        if (liveTui === tui) liveTui = null;
        try {
          (unsub as unknown as () => void)();
        } catch {
          /* ya liberado */
        }
      },
      invalidate() {},
      render(width: number): string[] {
        // Usa el ctx más reciente: el capturado al instalar el footer queda
        // con modelo/sesión viejos tras cambios de sesión o de modelo.
        const c: ExtensionContext = currentCtx ?? ctx;
        const usage = readUsage(c);
        const pct = usage.percent;
        const win = usage.window;
        const pctText = pct === null ? "?" : pct.toFixed(1);
        const auto = " (auto)";
        const total = usage.text;

        // Segmentos izquierdos; el bar se colorea aparte para no romper el dim.
        let before = `◈ ${total} · `;
        let after = ` ${pctText}%/${fmt(win)}${auto}`;
        let leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        if (leftW > width) {
          after = ` ${pctText}%${auto}`; // recorta ventana primero, nunca la barra
          leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        }
        if (leftW > width) {
          before = `◈ ${total} `;
          after = "";
          leftW = visibleWidth(before) + BAR_W;
        }
        const barStr = bar(usage.tokens, pct, theme);
        const leftFinal = theme.fg("dim", before) + barStr + (after ? theme.fg("dim", after) : "");

        let right = modelRight(c, footerData, leftW, width);
        const minPad = 2;
        const rightW = visibleWidth(right);
        let stats: string;
        if (leftW + minPad + rightW <= width) {
          stats = leftFinal + theme.fg("dim", " ".repeat(width - leftW - rightW) + right);
        } else {
          const room = width - leftW - minPad;
          if (room > 0) {
            right = truncateToWidth(right, room, "");
            stats = leftFinal + theme.fg("dim", " ".repeat(Math.max(0, width - leftW - visibleWidth(right))) + right);
          } else {
            stats = truncateToWidth(leftFinal, width);
          }
        }

        const lines = [
          truncateToWidth(theme.fg("dim", pwdText(c, footerData)), width, theme.fg("dim", "...")),
          truncateToWidth(stats, width),
        ];
        try {
          const statuses = footerData.getExtensionStatuses();
          if (statuses.size > 0) {
            const txt = [...statuses.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, v]) => v.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim())
              .join(" ");
            lines.push(truncateToWidth(txt, width, theme.fg("dim", "...")));
          }
        } catch {
          /* sin statuses */
        }
        return lines;
      },
    };
  });
}

function applyFull(ctx: ExtensionContext): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  liveTui = null;
  ctx.ui.setFooter(undefined); // restaura el footer original de pi
}

function apply(ctx: ExtensionContext): void {
  if (mode === "min") applyMin(ctx);
  else applyFull(ctx);
}

export default function (pi: ExtensionAPI) {
  const toggle = async (_args: string, ctx: ExtensionCommandContext) => {
    mode = mode === "min" ? "full" : "min";
    currentCtx = ctx;
    apply(ctx);
    ctx.ui.notify(
      mode === "min" ? "Footer mejorado: ◈ total + barra de contexto" : "Footer original de pi restaurado",
      "info",
    );
  };
  pi.registerCommand("tokens-context-ai", {
    description: "Alterna footer original ↔ mejorado (tokens + barra de contexto)",
    handler: toggle,
  });

  // Cada handler refresca currentCtx: el render lee modelo/sesión en vivo.
  pi.on("session_start", async (_e, ctx) => {
    currentCtx = ctx;
    apply(ctx);
  });
  pi.on("model_select", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("thinking_level_select", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("turn_end", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("message_end", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("tool_result", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("session_compact", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
  pi.on("session_info_changed", async (_e, ctx) => {
    currentCtx = ctx;
    requestFooterRender();
  });
}
