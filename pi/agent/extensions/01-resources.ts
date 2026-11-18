/**
 * 01-resources — shows Context/Skills/Prompts/Extensions in a read-only overlay.
 *
 * pi officially hides the startup listing with `"quietStartup": true`
 * (see docs/settings.md and `pi/agent/settings.base.json`). This extension adds
 * the command to view it on demand without cluttering startup:
 *
 *   /resources  — read-only popup with Context, Skills,
 *                 Prompts and Extensions (original UI style)
 *
 * Official patterns used (do not reinvent):
 * - docs/extensions.md → pi.registerCommand, pi.getCommands (names by
 *   source: "extension"|"prompt"|"skill"), ctx.ui.custom with
 *   { overlay: true, overlayOptions }; ctx.getSystemPromptOptions()
 *   (commands only) for the [Context] contextFiles.
 * - docs/tui.md → Overlay, Key Rules (callback theme, truncateToWidth,
 *   tui.requestRender after state changes), matchesKey + Key for keys;
 *   window frame ┌┐└┘│ with borderAccent/mdHeading/dim colors.
 * - docs/skills.md → skill origins; hence Skills/Prompts come from
 *   getCommands (authoritative source) instead of hand-reading folders.
 * - Labels like the original UI (interactive-mode.js): Context relative to
 *   cwd (`AGENTS.md`) or `~` outside it; `[Name] (n)` headers;
 *   dim rows.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

type Section = "context" | "skill" | "prompt" | "extension";

const SECTION_LABEL: Record<Section, string> = {
  context: "Context",
  skill: "Skills",
  prompt: "Prompts",
  extension: "Extensions",
};

const ORDER: Section[] = ["context", "skill", "prompt", "extension"];

// Visible body rows inside the window (the rest via scroll).
const BUDGET = 18;

function agentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

/** Like interactive-mode formatContextPath: relative to cwd, or `~` outside it. */
function contextLabel(p: string, cwd: string): string {
  const abs = resolve(cwd, p);
  const rel = relative(resolve(cwd), abs);
  const inside = rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`));
  if (inside) return (rel || ".").split(sep).join("/");
  const home = homedir();
  if (abs.startsWith(home)) return `~${abs.slice(home.length)}`.split(sep).join("/");
  return abs.split(sep).join("/");
}

function listExtensionFiles(cwd: string): string[] {
  const seen = new Set<string>();
  for (const dir of [join(agentDir(), "extensions"), join(cwd, ".pi", "extensions")]) {
    try {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".ts") || f.endsWith(".js")) seen.add(f);
      }
    } catch {
      /* ignore unreadable dirs */
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

function collectNames(pi: ExtensionAPI, ctx: ExtensionCommandContext): Record<Section, string[]> {
  const names: Record<Section, string[]> = { context: [], skill: [], prompt: [], extension: [] };

  try {
    const files = ctx.getSystemPromptOptions?.().contextFiles ?? [];
    names.context = [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => contextLabel(f.path, ctx.cwd));
  } catch {
    /* no context available */
  }

  const cmds = pi.getCommands?.() ?? [];
  names.skill = cmds
    .filter((c) => c.source === "skill")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.name.replace(/^skill:/, ""));
  names.prompt = cmds
    .filter((c) => c.source === "prompt")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `/${c.name}`);
  names.extension = listExtensionFiles(ctx.cwd);
  return names;
}

function padEndVisible(s: string, n: number): string {
  const w = visibleWidth(s);
  return w >= n ? s : s + " ".repeat(n - w);
}

async function showResources(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const names = collectNames(pi, ctx);

  // No overlay without TUI: original-style summary.
  if (ctx.mode !== "tui" || !ctx.hasUI) {
    const text = ORDER.map((s) => {
      const list = names[s];
      return `[${SECTION_LABEL[s]}]${list.length > 0 ? `\n  ${list.join("\n  ")}` : " (vacío)"}`;
    }).join("\n\n");
    ctx.ui.notify(text, "info");
    return;
  }

  // Original-UI-style body: `[Name] (n)` header + one resource per line.
  const body: Array<{ head: boolean; text: string }> = [];
  for (const s of ORDER) {
    const list = names[s];
    body.push({ head: true, text: `[${SECTION_LABEL[s]}] (${list.length})` });
    if (list.length === 0) body.push({ head: false, text: "(vacío)" });
    for (const n of list) body.push({ head: false, text: n });
  }

  await ctx.ui.custom<void>((tui, theme, _kb, done) => {
    let scroll = 0;
    const maxScroll = Math.max(0, body.length - BUDGET);

    return {
      invalidate() {},
      handleInput(data: string) {
        if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || matchesKey(data, Key.space) || data === "q") {
          done(undefined);
          return;
        }
        let next = scroll;
        if (matchesKey(data, Key.up)) next = scroll - 1;
        else if (matchesKey(data, Key.down)) next = scroll + 1;
        else if (matchesKey(data, Key.pageUp)) next = scroll - BUDGET;
        else if (matchesKey(data, Key.pageDown)) next = scroll + BUDGET;
        else if (matchesKey(data, Key.home)) next = 0;
        else if (matchesKey(data, Key.end)) next = maxScroll;
        else return;
        scroll = Math.min(maxScroll, Math.max(0, next));
        tui.requestRender();
      },
      render(width: number): string[] {
        const W = Math.max(40, width);
        const inner = W - 2;
        const b = (s: string) => theme.fg("borderAccent", s);
        const title = (s: string) => theme.fg("accent", theme.bold(s));
        const sec = (s: string) => theme.fg("mdHeading", theme.bold(s));
        const dim = (s: string) => theme.fg("dim", s);

        const titleText = " Recursos ";
        const titleW = visibleWidth(titleText);
        const top = b("┌") + b("─") + title(titleText) + b("─".repeat(Math.max(1, inner - 1 - titleW))) + b("┐");
        const sepLine = b("├") + b("─".repeat(inner)) + b("┤");
        const bot = b("└") + b("─".repeat(inner)) + b("┘");
        const row = (s: string) => b("│") + padEndVisible(truncateToWidth(s, inner), inner) + b("│");

        const out: string[] = [truncateToWidth(top, W)];
        const view = body.slice(scroll, scroll + BUDGET);
        view.forEach((ln, i) => {
          out.push(truncateToWidth(row(ln.head ? sec(` ${ln.text}`) : dim(`  ${ln.text}`)), W));
          // Subtle separator between sections (not after the last visible one).
          const next = view[i + 1];
          if (next?.head) out.push(truncateToWidth(sepLine, W));
        });
        const remaining = Math.max(0, body.length - scroll - BUDGET);
        out.push(
          truncateToWidth(
            row(dim(remaining > 0 ? `  ↓ ${remaining} más · enter/esc/espacio/q cerrar` : "  enter/esc/espacio/q cerrar")),
            W,
          ),
        );
        out.push(truncateToWidth(bot, W));
        return out;
      },
    };
  }, {
    overlay: true,
    overlayOptions: { anchor: "center", width: "60%", maxHeight: "90%", margin: 2 },
  });
}

export default function (pi: ExtensionAPI) {
  const handler = async (_args: string, ctx: ExtensionCommandContext) => {
    await showResources(pi, ctx);
  };
  pi.registerCommand("resources", {
    description: "Show Context, Skills, Prompts and Extensions in a read-only popup",
    handler,
  });
}
