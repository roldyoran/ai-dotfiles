/**
 * 02-tokens-context-ai — minimal footer: conversation tokens only + context bar.
 *
 * Replaces this long line of the original footer:
 *   ↑22k ↓3.9k R158k CH96.2% $0.003 2.1%/1.0M (auto)
 * with this compact version:
 *   ◈ 26k · █░░░░░░░░░ 2.1%/1.0M (auto) $0.003
 *
 * - `◈ 70k` = current context-window usage (getContextUsage().tokens),
 *   the same number the bar measures. The % is derived from those tokens/window
 *   instead of trusting getContextUsage().percent, so number and bar
 *   never disagree (e.g. ◈ 4.6k vs 44.1%/1.0M seen with opencode-go).
 *   It is NOT a cumulative sum: summing `input`
 *   of every message overcounts because each input already includes history.
 * - `█░…` = total context fill bar (getContextUsage().percent).
 * - `2.1%/1.0M (auto) $0.003` = same percent/window/auto as the original
 *   plus accumulated spend (`cost.total`, same as the original `$0.003`).
 * - The rest stays the same: pwd line (+branch, +session) and model on the right.
 *
 * Command:
 *   /tokens-context-ai — toggles between the original and the improved (min) version
 *
 * Official patterns (do not reinvent):
 * - docs/tui.md Pattern 6 → ctx.ui.setFooter(factory) with (tui, theme, footerData);
 *   footerData.getGitBranch()/getExtensionStatuses()/getAvailableProviderCount()/
 *   onBranchChange() are the only things not reachable by other means; ctx.ui.setFooter(undefined)
 *   restores the original footer.
 * - examples/extensions/custom-footer.ts → totals from sessionManager,
 *   truncateToWidth/visibleWidth to never exceed `width`.
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

// Enabled at startup: you see the improvement without doing anything; /footer restores the original.
let mode: Mode = "min";

// Live TUI of the custom footer (to refresh on every session event).
let liveTui: { requestRender(): void } | null = null;
// Freshest ctx (the one captured when installing the footer goes stale after
// session/model changes; rendering always uses this one). Bridges TUI+ctx.
let currentCtx: ExtensionContext | null = null;
const requestFooterRender = () => {
  try {
    liveTui?.requestRender();
  } catch {
    /* TUI already closed */
  }
};

/** Same as FooterComponent.formatTokens in pi (footer.ts). */
function fmt(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
  return `${Math.round(n / 1000000)}M`;
}

/** Same as formatCwdForFooter in pi: ~ inside home, path as-is outside. */
function fmtCwd(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  const rc = resolve(cwd);
  const rh = resolve(home);
  const rel = relative(rh, rc);
  const inside = rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  if (!inside) return cwd;
  return rel === "" ? "~" : `~${sep}${rel}`;
}

/** Number to show: current window tokens (the same thing the bar measures).
 * The % is derived HERE from tokens/window (same source) so number and bar
 * can never disagree even if pi returns an inconsistent object
 * (seen with provider opencode-go: ◈ 4.6k vs 44.1%/1.0M).
 * After compaction tokens is null → falls back to summing outputs until the next response. */
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
  // Single source of truth: the % comes from the same tokens being shown.
  if (tokens !== null && tokens !== undefined) {
    const percent = win > 0 ? (tokens / win) * 100 : reportedPercent;
    return { text: fmt(tokens), tokens, percent, window: win };
  }
  const fb = outputFallback(ctx);
  const percent = win > 0 && fb > 0 ? (fb / win) * 100 : reportedPercent;
  return { text: fmt(fb), tokens: fb, percent, window: win };
}

/** Sums outputs only (each response generates new tokens, no double counting).
 * Fallback only while context is still unknown (freshly compacted). */
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
    /* session without entries yet */
  }
  return total;
}

/** Accumulated spend just like the original footer (footer.ts): sums cost.total of
 * usage + assistant + toolResult + branch_summary/compaction. Only shown
 * when there is spend or it is a subscription (kimi-coding or modelRuntime). */
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
    /* session without entries yet */
  }
  const provider = (ctx as unknown as { model?: { provider?: string } }).model?.provider;
  let usingSubscription = provider === "kimi-coding";
  try {
    const rt = (ctx as unknown as { modelRuntime?: { isUsingSubscription?: (p: string) => boolean } }).modelRuntime;
    if (!usingSubscription && provider && typeof rt?.isUsingSubscription === "function") {
      usingSubscription = rt.isUsingSubscription(provider);
    }
  } catch {
    /* no modelRuntime */
  }
  const text = cost > 0 || usingSubscription ? `$${cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}` : "";
  return { cost, usingSubscription, text };
}

const BAR_W = 10;

/** Partial shading: same family as the empty cell (░) so no gap is left.
 * The ▏▎▍ blocks leave empty background and a weird space shows between
 * painted and unpainted areas; ▒▓ are full-cell and blend cleanly. */
const SHADES = ["", "▒", "▓"];

/** Normalize % to the 0-100 scale (what pi returns): clamp to [0,100]. null/invalid → 0. */
function normalizePct(pct: number | null): number {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.max(0, Math.min(100, pct));
}

function bar(pct: number | null, theme: { fg(c: string, s: string): string }): string {
  const p = normalizePct(pct);
  const exact = (p / 100) * BAR_W;
  let full = Math.floor(exact);
  // floor (no round): never over-represents. 2.1% → empty instead of 10%.
  let frac = Math.floor((exact - full) * 3);
  if (frac === 3) {
    full += 1;
    frac = 0;
  }
  full = Math.min(BAR_W, full);
  // Color always relative to the current window, never to absolute token thresholds.
  const color = p >= 90 ? "error" : p >= 70 ? "warning" : "success";
  let filledStr = "█".repeat(full);
  if (frac > 0 && full < BAR_W) filledStr += SHADES[frac];
  const usedCells = full + (frac > 0 && full < BAR_W ? 1 : 0);
  const empty = "░".repeat(Math.max(0, BAR_W - usedCells));
  // No forced minimum: real 0% → empty bar (honest). 2.1% no longer paints 10%.
  if (!filledStr) return theme.fg("dim", empty);
  return theme.fg(color, filledStr) + theme.fg("dim", empty);
}

function pwdText(ctx: ExtensionContext, footerData: { getGitBranch(): string | null }): string {
  let pwd = fmtCwd(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE);
  try {
    const branch = footerData.getGitBranch();
    if (branch) pwd = `${pwd} (${branch})`;
  } catch {
    /* no git */
  }
  try {
    const name = ctx.sessionManager.getSessionName();
    if (name) pwd = `${pwd} • ${name}`;
  } catch {
    /* no name */
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
    /* no provider count */
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
        // Use the freshest ctx: the one captured when installing the footer
        // holds a stale model/session after session or model changes.
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

        // Left segments; the bar is colored separately so it never breaks the dim.
        let before = `◈ ${total} · `;
        let after = ` ${pctText}%/${winText}${auto}${costSuffix}`;
        let leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        if (leftW > width) {
          after = ` ${pctText}%${auto}${costSuffix}`; // trim the window first, never the bar
          leftW = visibleWidth(before) + BAR_W + visibleWidth(after);
        }
        if (leftW > width) {
          before = `◈ ${total} `;
          after = costSuffix; // no % in minimal mode, but spend is kept
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
          /* no statuses */
        }
        return lines;
      },
    };
  });
}

function applyFull(ctx: ExtensionContext): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  liveTui = null;
  ctx.ui.setFooter(undefined); // restore pi's original footer
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

  // Every handler refreshes currentCtx: rendering reads the live model/session.
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
