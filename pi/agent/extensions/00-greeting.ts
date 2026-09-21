/**
 * 00-greeting — 2 columnas: logo π grande + info. Insta suavizado + carpeta en el borde.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readdirSync, statSync } from "node:fs";

const THINKING: Record<string, { label: string; icon: string }> = {
  off: { label: "reposo", icon: "○" },
  minimal: { label: "mínimo", icon: "·" },
  low: { label: "bajo", icon: "▲" },
  medium: { label: "medio", icon: "●" },
  high: { label: "alto", icon: "◆" },
  xhigh: { label: "muy alto", icon: "⬢" },
  max: { label: "máximo", icon: "✦" },
};

// π de antes: barra superior gruesa + pata izquierda corta + derecha larga.
// (sin espacios al final: se rellenan en código para que el ancho sea parejo
// y ningún editor los recorte al guardar).
const PI = [
  "██████████████████████",
  "██████████████████████",
  "     █████   █████",
  "     █████   █████",
  "     █████   █████",
  "             █████",
  "             █████",
  "             █████",
];

// Ancho parejo para todas las filas (gradiente y centrado uniformes).
const PIW = Math.max(...PI.map((r) => [...r].length));
const PIN = PI.map((r) => r.padEnd(PIW, " "));

// Colores de antes: Insta saturado +2 niveles (vivo, sin neón).
const STOPS: Array<[number, number, number]> = [
  [82, 36, 174], // morado vivo
  [176, 53, 122], // magenta vivo
  [197, 50, 100], // rosa rojizo vivo
  [206, 35, 35], // rojo vivo
  [224, 126, 77], // naranja arcilla vivo
  [239, 183, 105], // amarillo arena vivo
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function logoColor(x: number, y: number, w: number = PIW, h: number = PIN.length): [number, number, number] {
  // Diagonal: morado arriba-izquierda → amarillo abajo-derecha.
  const t = Math.min(1, Math.max(0, (x / Math.max(1, w - 1)) * 0.65 + (y / Math.max(1, h - 1)) * 0.35));
  const seg = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(seg));
  const raw = seg - i;
  const f = raw * raw * (3 - 2 * raw);
  const [r1, g1, b1] = STOPS[i];
  const [r2, g2, b2] = STOPS[i + 1];
  return [lerp(r1, r2, f), lerp(g1, g2, f), lerp(b1, b2, f)];
}

const paint = (line: string, y: number): string => {
  let out = "";
  let x = 0;
  for (const ch of line) {
    if (ch === " ") {
      out += " ";
    } else {
      const [r, g, b] = logoColor(x, y);
      out += `\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`;
    }
    x++;
  }
  return out;
};

// Centrado del logo por conteo de caracteres (cada █ y espacio = 1 celda).
// No usa truncate: el logo nunca se recorta, solo se rellena.
function centerLogo(painted: string, n: number): string {
  if (PIW >= n) return painted;
  const left = Math.floor((n - PIW) / 2);
  const right = n - PIW - left;
  return " ".repeat(left) + painted + " ".repeat(right);
}

function levelOf(pi: ExtensionAPI): string {
  try {
    return pi.getThinkingLevel();
  } catch {
    return "medium";
  }
}

function countExtFiles(dirs: string[]): number {
  const seen = new Set<string>();
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".ts") || f.endsWith(".js")) seen.add(f.toLowerCase());
      }
    } catch { /* ignora dirs ilegibles */ }
  }
  return seen.size;
}

function countSkillsInDirs(dirs: string[]): number {
  const seen = new Set<string>();
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === ".gitkeep") continue;
        let isDir = e.isDirectory();
        let isMd = e.isFile() && e.name.endsWith(".md");
        if (e.isSymbolicLink()) {
          try {
            const st = statSync(join(dir, e.name));
            isDir = st.isDirectory();
            isMd = st.isFile() && e.name.endsWith(".md");
          } catch { continue; }
        }
        if (isDir || isMd) seen.add(e.name.toLowerCase());
      }
    } catch { /* ignora dirs ilegibles */ }
  }
  return seen.size;
}

function countPromptsInDirs(dirs: string[]): number {
  const seen = new Set<string>();
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".md")) seen.add(f.toLowerCase());
      }
    } catch { /* ignora dirs ilegibles */ }
  }
  return seen.size;
}

// Sube desde cwd buscando <dir>/.agents/skills (como hace pi: ancestors).
function ancestorAgentsSkillDirs(cwd: string): string[] {
  const out: string[] = [];
  let cur = cwd;
  for (let i = 0; i < 12; i++) {
    out.push(join(cur, ".agents", "skills"));
    const parent = join(cur, "..");
    const norm = parent === cur ? cur : join(parent);
    // evita bucle en raíz: si ya no sube, para
    if (norm === cur || cur === "/" || /^[A-Z]:\\?$/.test(cur)) break;
    cur = norm;
    // no subir más allá del home (los globales se cuentan aparte)
    if (cur.length < homedir().length && homedir().startsWith(cur)) break;
  }
  return out;
}

function counts(pi: ExtensionAPI, ctx?: ExtensionContext): { ext: number; skills: number; prompts: number } {
  // Fuente autoritativa: pi ya resolvió, mergeó y dedupó (trust + colisiones).
  // source: "extension" | "prompt" | "skill" — es lo mismo que lista el TUI.
  try {
    const cmds = pi.getCommands?.() ?? [];
    if (cmds.length > 0) {
      const skills = new Set(cmds.filter((c) => c.source === "skill").map((c) => c.name.toLowerCase()));
      const prompts = new Set(cmds.filter((c) => c.source === "prompt").map((c) => c.name.toLowerCase()));
      const cwd = ctx?.cwd ?? process.cwd();
      const base = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
      const ext = countExtFiles([join(base, "extensions"), join(cwd, ".pi", "extensions")]);
      // Si getCommands trae datos, úsalo aunque sea 0 (ej. proyecto sin skills es 0 real).
      // Solo cae a fallback de FS si AMBOS están vacíos y podría ser carga temprana.
      if (skills.size > 0 || prompts.size > 0) return { ext, skills: skills.size, prompts: prompts.size };
      const fb = countsFromFs(cwd, base);
      return { ext, skills: fb.skills, prompts: fb.prompts };
    }
  } catch { /* cae a filesystem */ }
  try {
    const cwd = ctx?.cwd ?? process.cwd();
    const base = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
    return countsFromFs(cwd, base, ctx);
  } catch {
    return { ext: 0, skills: 0, prompts: 0 };
  }
}

// Fallback filesystem: replica las raíces que pi/package-manager usa.
function countsFromFs(cwd: string, base: string, ctx?: ExtensionContext): { ext: number; skills: number; prompts: number } {
  const trusted = (() => {
    try { return ctx?.isProjectTrusted?.() ?? true; } catch { return true; }
  })();
  const ext = countExtFiles(trusted ? [join(base, "extensions"), join(cwd, ".pi", "extensions")] : [join(base, "extensions")]);
  const skillDirs = trusted
    ? [join(cwd, ".pi", "skills"), ...ancestorAgentsSkillDirs(cwd), join(base, "skills"), join(homedir(), ".agents", "skills")]
    : [join(base, "skills"), join(homedir(), ".agents", "skills")];
  const promptDirs = trusted
    ? [join(cwd, ".pi", "prompts"), join(base, "prompts")]
    : [join(base, "prompts")];
  return { ext, skills: countSkillsInDirs(skillDirs), prompts: countPromptsInDirs(promptDirs) };
}

function padEndVisible(s: string, n: number): string {
  const w = visibleWidth(s);
  return w >= n ? s : s + " ".repeat(n - w);
}

function centerCell(s: string, n: number): string {
  const t = truncateToWidth(s, n);
  const w = visibleWidth(t);
  if (w >= n) return t;
  const left = Math.floor((n - w) / 2);
  const right = n - w - left;
  return " ".repeat(left) + t + " ".repeat(right);
}

// 4 saludos que caben en la columna del logo.
const LEFT_GREETINGS = ["Welcome back!", "¡Hola de nuevo!", "¡A construir!", "¡Vamos al código!"];

function pickGreeting(): string {
  return LEFT_GREETINGS[Math.floor(Math.random() * LEFT_GREETINGS.length)];
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
      const { ext, skills, prompts } = counts(pi, ctx);
      const dir = basename(ctx.cwd) || ctx.cwd;

      const W = Math.max(60, Math.min(width - 2, 92));
      const inner = W - 2;
      const leftW = 26;
      const rightW = inner - 1 - leftW;

      const b = (s: string) => theme.fg("borderMuted", s);
      const head = (s: string) => theme.fg("accent", s);
      const dim = (s: string) => theme.fg("dim", s);
      const val = (s: string) => theme.fg("text", s);
      const mut = (s: string) => theme.fg("muted", s);

      const top = b("┌") + b("─".repeat(leftW)) + b("┬") + b("─".repeat(rightW)) + b("┐");
      const row = (left: string, right: string) => b("│") + left + b("│") + right + b("│");
      // Divisor solo-derecha: comparte línea con una fila del logo para no cortarlo.
      const rdiv = (left: string) => b("│") + left + b("├") + b("─".repeat(rightW)) + b("┤");

      // Borde inferior con la carpeta incrustada.
      const label = ` ${dir} `;
      const labelW = visibleWidth(label);
      const padL = Math.max(1, Math.floor((inner - labelW) / 2));
      const padR = Math.max(1, inner - labelW - padL);
      const bot = b("└") + b("─".repeat(padL)) + val(label) + b("─".repeat(padR)) + b("┘");

      // Izquierda: saludo + logo + aire abajo (11 filas).
      // Derecha: 3 secciones (Modelo / Esfuerzo / Sistema) con divisor propio.
      const L = [
        centerCell(val(greeting), leftW),
        centerCell("", leftW),
        centerLogo(paint(PIN[0], 0), leftW),
        centerLogo(paint(PIN[1], 1), leftW),
        centerLogo(paint(PIN[2], 2), leftW),
        centerLogo(paint(PIN[3], 3), leftW),
        centerLogo(paint(PIN[4], 4), leftW),
        centerLogo(paint(PIN[5], 5), leftW),
        centerLogo(paint(PIN[6], 6), leftW),
        centerLogo(paint(PIN[7], 7), leftW),
        centerCell("", leftW),
      ];
      const R = [
        padEndVisible(` ${head("Modelo")}`, rightW),
        padEndVisible(` ${val(truncateToWidth(modelId, rightW - 2))}`, rightW),
        padEndVisible(` ${dim(truncateToWidth(provider, rightW - 2))}`, rightW),
        padEndVisible(` ${head("Esfuerzo")}`, rightW),
        padEndVisible(` ${theme.fg("warning", `${level} ${meta.icon}`)} ${dim(meta.label)}`, rightW),
        padEndVisible(` ${head("Sistema")}`, rightW),
        padEndVisible(` ${mut("ext")} ${val(`${ext}`)}  ${mut("skills")} ${val(`${skills}`)}  ${mut("prompts")} ${val(`${prompts}`)}`, rightW),
        padEndVisible(` ${dim(`v${VERSION}`)}`, rightW),
      ];

      const lines: string[] = [""];
      // Centra toda la tabla en pantalla (el contenido interno no cambia).
      const offset = Math.max(0, Math.floor((width - W) / 2));
      const pad = " ".repeat(offset);
      const out = (s: string) => pad + truncateToWidth(s, W);
      lines.push(out(top));
      lines.push(out(row(L[0], R[0])));
      lines.push(out(row(L[1], R[1])));
      lines.push(out(row(L[2], R[2])));
      lines.push(out(rdiv(L[3])));
      lines.push(out(row(L[4], R[3])));
      lines.push(out(row(L[5], R[4])));
      lines.push(out(rdiv(L[6])));
      lines.push(out(row(L[7], R[5])));
      lines.push(out(row(L[8], R[6])));
      lines.push(out(row(L[9], R[7])));
      lines.push(out(row(L[10], padEndVisible("", rightW))));
      lines.push(out(bot));

      return lines;
    },
  }));
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => paintHeader(pi, ctx));
  pi.on("model_select", async (_e, ctx) => paintHeader(pi, ctx));
  pi.on("thinking_level_select", async (_e, ctx) => paintHeader(pi, ctx));
}
