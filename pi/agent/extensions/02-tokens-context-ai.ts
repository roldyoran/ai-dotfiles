/**
 * 02-tokens-context-ai — footer minimal: solo tokens de la conversación + barra de contexto.
 *
 * Cambia esta línea larga del footer original:
 *   ↑22k ↓3.9k R158k CH96.2% $0.003 2.1%/1.0M (auto)
 * por esta versión compacta:
 *   ◈ 26k · █░░░░░░░░░ 2.1%/1.0M (auto) $0.003
 *
 * - `◈ 70k` = uso actual de la ventana de contexto (getContextUsage().tokens),
 *   el mismo número que mide la barra. El % se deriva de esos tokens/ventana
 *   en vez de fiarse de getContextUsage().percent, para que número y barra
 *   nunca discrepen (p. ej. ◈ 4.6k con 44.1%/1.0M visto con opencode-go).
 *   NO es suma acumulada: sumar `input`
 *   de cada mensaje multiplica de más porque cada input ya incluye el historial.
 * - `█░…` = barra de llenado del contexto total (getContextUsage().percent).
 * - `2.1%/1.0M (auto) $0.003` = mismo porcentaje/ventana/auto que el original
 *   más el gasto acumulado (`cost.total`, igual que `$0.003` del original).
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
 * El % se deriva AQUÍ de tokens/ventana (misma fuente) para que número y barra
 * nunca puedan discrepar aunque pi devuelva un objeto inconsistente
 * (visto con provider opencode-go: ◈ 4.6k frente a 44.1%/1.0M).
 * Tras compaction tokens es null → cae a suma de outputs hasta la próxima respuesta. */
function readUsage(ctx: ExtensionContext): { text: string; tokens: number | null; percent: number | null; window: number } {
  let reportedPercent: number | null = null;
  let win = 0;
  let tokens: number | null = null;
  try {
    const u = ctx.getContextUsage?.();
    reportedPercent = u?.percent ?? null;
    win = u?.contextWindow ?? 0;
    tokens = u?.tokens ?? null;
  } catch {
    reportedPercent = null;
  }
  if (!win) {
    try {
      win = (ctx as unknown as { model?: { contextWindow?: number } }).model?.contextWindow ?? 0;
    } catch {
      win = 0;
    }
  }
  // Fuente única de verdad: el % sale de los mismos tokens que se muestran.
  if (tokens !== null && tokens !== undefined) {
    const percent = win > 0 ? (tokens / win) * 100 : reportedPercent;
    return { text: fmt(tokens), tokens, percent, window: win };
  }
  const fb = outputFallback(ctx);
  const percent = win > 0 && fb > 0 ? (fb / win) * 100 : reportedPercent;
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

/** Gasto acumulado igual que el footer original (footer.ts): suma cost.total de
 * usage + assistant + toolResult + branch_summary/compaction. Solo se muestra
 * si hay gasto o es suscripción (kimi-coding o modelRuntime). */
function readCost(ctx: ExtensionContext): { cost: number; usingSubscription: boolean; text: string } {
  let cost = 0;
  try {
    for (const e of ctx.sessionManager.getEntries() ?? []) {
      const entry = e as unknown as Record<string, unknown>;
      const type = entry["type"] as string | undefined;
      if (type === "usage") {
        const u = entry["usage"] as { cost?: { total?: number } } | undefined;
        cost += u?.cost?.total ?? 0;
      } else if (type === "message") {
        const msg = entry["message"] as Record<string, unknown> | undefined;
        const role = msg?.["role"] as string | undefined;
        const u = msg?.["usage"] as { cost?: { total?: number } } | undefined;
        if (role === "assistant" || (role === "toolResult" && u)) cost += u?.cost?.total ?? 0;
      } else if (type === "branch_summary" || type === "compaction") {
        const u = entry["usage"] as { cost?: { total?: number } } | undefined;
        cost += u?.cost?.total ?? 0;
      }
    }
  } catch {
    /* sesión aún sin entries */
  }
  const provider = (ctx as unknown as { model?: { provider?: string } }).model?.provider;
  let usingSubscription = provider === "kimi-coding";
  try {
    const rt = (ctx as unknown as { modelRuntime?: { isUsingSubscription?: (p: string) => boolean } }).modelRuntime;
    if (!usingSubscription && provider && typeof rt?.isUsingSubscription === "function") {
      usingSubscription = rt.isUsingSubscription(provider);
    }
  } catch {
    /* sin modelRuntime */
  }
  const text = cost > 0 || usingSubscription ? `$${cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}` : "";
  return { cost, usingSubscription, text };
}

const BAR_W = 10;

/** Sombreado parcial: misma familia que el vacío (░) para no dejar hueco.
 * Los bloques ▏▎▍ dejan fondo vacío y se ve un espacio raro entre
 * lo pintado y lo no pintado; ▒▓ son de celda completa y funden bien. */
const SHADES = ["", "▒", "▓"];

/** Normaliza % en escala 0-100 (la que devuelve pi): recorta a [0,100]. null/inválido → 0. */
function normalizePct(pct: number | null): number {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.max(0, Math.min(100, pct));
}

function bar(pct: number | null, theme: { fg(c: string, s: string): string }): string {
  const p = normalizePct(pct);
  const exact = (p / 100) * BAR_W;
  let full = Math.floor(exact);
  // floor (no round): nunca sobre-representa. 2.1 % -> vacia en vez de 10 %.
  let frac = Math.floor((exact - full) * 3);
  if (frac === 3) {
    full += 1;
    frac = 0;
  }
  full = Math.min(BAR_W, full);
  // Color siempre relativo a la ventana actual, no a umbrales absolutos de tokens.
  const color = p >= 90 ? "error" : p >= 70 ? "warning" : "success";
  let filledStr = "█".repeat(full);
  if (frac > 0 && full < BAR_W) filledStr += SHADES[frac];
  const usedCells = full + (frac > 0 && full < BAR_W ? 1 : 0);
  const empty = "░".repeat(Math.max(0, BAR_W - usedCells));
  // Sin mínimo forzado: 0 % real → barra vacía (honesta). 2.1 % ya no pinta 10 %.
  if (!filledStr) return theme.fg("dim", empty);
  return theme.fg(color, filledStr) + theme.fg("dim", empty);
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
        const pNorm = pct === null ? null : normalizePct(pct);
        const pctText = pNorm === null ? "?" : pNorm.toFixed(1);
        const winText = win > 0 ? fmt(win) : "?";
        const auto = " (auto)";
        const total = usage.text;
        const costSuffix = (() => {
          const t = readCost(c).text;
          return t ? ` ${t}` : "";
        })();

        // Segmentos izquierdos; el bar se colorea aparte para no romper el dim.
        let before = `◈ ${total} · `;
        let after = ` ${pctText}%/${winText}${auto}${costSuffix}`;
        let leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        if (leftW > width) {
          after = ` ${pctText}%${auto}${costSuffix}`; // recorta ventana primero, nunca la barra
          leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        }
        if (leftW > width) {
          before = `◈ ${total} `;
          after = costSuffix; // sin % en mínimo, pero el gasto se mantiene
          leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        }
        const barStr = bar(pNorm, theme);
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
