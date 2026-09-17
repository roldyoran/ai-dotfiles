/**
 * 00-greeting — Símbolo π en grande (degradado apagado) + saludo + tabla.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readdirSync } from "node:fs";

const THINKING: Record<string, { label: string; icon: string }> = {
  off: { label: "reposo", icon: "○" },
  minimal: { label: "mínimo", icon: "·" },
  low: { label: "bajo", icon: "▲" },
  medium: { label: "medio", icon: "●" },
  high: { label: "alto", icon: "◆" },
  xhigh: { label: "muy alto", icon: "⬢" },
  max: { label: "máximo", icon: "✦" },
};

// π estilo imagen: barra superior gruesa + pata izquierda corta + derecha larga.
// 20 columnas x 8 filas. Degradado diagonal Insta suavizado por carácter.
const PI = [
  "██████████████████████",
  "██████████████████████",
  "     █████   █████   ",
  "     █████   █████   ",
  "     █████   █████   ",
  "             █████   ",
  "             █████   ",
  "             █████   ",
  "                     ",
];

// Gradiente Insta a media saturación: morado → magenta → rosa → rojo → naranja → amarillo.
// Desaturado ~45% hacia gris para que se vea con vida pero sin gritar.
const STOPS: Array<[number, number, number]> = [
  [89, 57, 153], // morado suavizado
  [153, 76, 119], // magenta apagado
  [172, 75, 108], // rosa rojizo mate
  [182, 59, 59], // rojo terroso
  [203, 133, 98], // naranja arcilla
  [222, 180, 122], // amarillo arena
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function logoColor(x: number, y: number, w: number, h: number): [number, number, number] {
  // Diagonal: morado arriba-izquierda → amarillo abajo-derecha.
  const t = Math.min(1, Math.max(0, (x / Math.max(1, w - 1)) * 0.65 + (y / Math.max(1, h - 1)) * 0.35));
  const seg = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(seg));
  // smoothstep: evita bandas y grises en los puntos medios
  const raw = seg - i;
  const f = raw * raw * (3 - 2 * raw);
  const [r1, g1, b1] = STOPS[i];
  const [r2, g2, b2] = STOPS[i + 1];
  return [lerp(r1, r2, f), lerp(g1, g2, f), lerp(b1, b2, f)];
}

const paint = (line: string, y: number): string => {
  const h = PI.length;
  let out = "";
  let x = 0;
  for (const ch of line) {
    if (ch === " ") {
      out += " ";
    } else {
      const [r, g, b] = logoColor(x, y, line.length, h);
      out += `\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`;
    }
    x++;
  }
  return out;
};

function levelOf(pi: ExtensionAPI): string {
  try {
    return pi.getThinkingLevel();
  } catch {
    return "medium";
  }
}

// Cuenta archivos de extensión / carpetas de skill en ~/.pi/agent.
// Antes contábamos pi.getCommands() por source, pero eso cuenta COMANDOS
// (00-greeting.ts solo ya registra 2: /hola + /header) y por eso salía "3".
function counts(): { ext: number; skills: number } {
  try {
    const base = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
    let ext = 0;
    let skills = 0;
    const extDir = join(base, "extensions");
    if (existsSync(extDir)) {
      ext = readdirSync(extDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js")).length;
    }
    const skillsDir = join(base, "skills");
    if (existsSync(skillsDir)) {
      skills = readdirSync(skillsDir, { withFileTypes: true }).filter(
        (d) => d.name !== ".gitkeep" && (d.isDirectory() || d.name.endsWith(".md")),
      ).length;
    }
    return { ext, skills };
  } catch {
    return { ext: 0, skills: 0 };
  }
}

function padEndVisible(s: string, n: number): string {
  const w = visibleWidth(s);
  return w >= n ? s : s + " ".repeat(n - w);
}

const GREETINGS = [
  "Hola \u{1F44B}  — listo para construir.",
  "Buenas \u{1F6E0}\uFE0F  — ¿qué armamos hoy?",
  "Hey \u2728  — a afinar ese código.",
  "Saludos \u{1F680}  — vamos al grano.",
];

function pickGreeting(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

function paintHeader(pi: ExtensionAPI, ctx: ExtensionContext) {
  if (ctx.mode !== "tui") return;
  const greeting = pickGreeting();
  ctx.ui.setHeader((_tui, theme) => ({
    invalidate() {},
    render(width: number): string[] {
      const level = levelOf(pi);
      const meta = THINKING[level] ?? { label: level, icon: "●" };
      const provider = ctx.model?.provider ?? "—";
      const modelId = ctx.model?.id ?? "sin modelo";
      const { ext, skills } = counts();
      const dir = basename(ctx.cwd);

      const W = Math.max(40, Math.min(width, 64));
      const inner = W - 2;
      const colL = Math.floor((inner - 1) / 2);
      const colR = inner - 1 - colL;

      const b = (s: string) => theme.fg("borderMuted", s);
      const label = (s: string) => theme.fg("muted", s);
      const val = (s: string) => theme.fg("text", s);

      const lines: string[] = [""];

      // π en degradado apagado + versión/carpeta a la derecha
      PI.forEach((row, i) => {
        const suffix =
          i === 0
            ? theme.fg("dim", `   v${VERSION}`)
            : i === 2
              ? theme.fg("dim", `   ${dir}`)
              : "";
        lines.push(truncateToWidth(paint(row, i) + suffix, width));
      });

      lines.push(truncateToWidth(theme.fg("text", greeting), width));

      const top = b("┌") + b("─".repeat(colL)) + b("┬") + b("─".repeat(colR)) + b("┐");
      const mid = b("├") + b("─".repeat(colL)) + b("┼") + b("─".repeat(colR)) + b("┤");
      const bot = b("└") + b("─".repeat(colL)) + b("┴") + b("─".repeat(colR)) + b("┘");
      const row = (left: string, right: string) =>
        b("│") + padEndVisible(left, colL) + b("│") + padEndVisible(right, colR) + b("│");

      lines.push(truncateToWidth(top, width));
      lines.push(
        truncateToWidth(b("│") + padEndVisible(label(" modelo"), colL) + b("│") + padEndVisible(label(" esfuerzo"), colR) + b("│"), width),
      );
      lines.push(
        truncateToWidth(
          row(` ${theme.fg("dim", truncateToWidth(provider, colL - 2))}`, ` ${theme.fg("warning", `${level} ${meta.icon}`)}`),
          width,
        ),
      );
      lines.push(
        truncateToWidth(row(` ${val(truncateToWidth(modelId, colL - 2))}`, ` ${theme.fg("dim", meta.label)}`), width),
      );
      lines.push(truncateToWidth(mid, width));
      lines.push(
        truncateToWidth(b("│") + padEndVisible(label(" extensiones"), colL) + b("│") + padEndVisible(label(" skills"), colR) + b("│"), width),
      );
      lines.push(truncateToWidth(row(` ${val(`${ext}`)}`, ` ${val(`${skills}`)}`), width));
      lines.push(truncateToWidth(bot, width));

      return lines;
    },
  }));
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => paintHeader(pi, ctx));
  pi.on("model_select", async (_e, ctx) => paintHeader(pi, ctx));
  pi.on("thinking_level_select", async (_e, ctx) => paintHeader(pi, ctx));
}
