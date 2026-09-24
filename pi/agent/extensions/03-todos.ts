/**
 * 03-todos — session-scoped TODO system (session A: branch-aware, no disk).
 *
 *   /todos            — toggles the live panel (hide/show, no shortcut needed)
 *   /todos hide|show  — explicit collapse / expand
 *   /todos table      — full list in a scrollable overlay window (ordered by #id,
 *                       `f` filters by status, no ctrl+o needed)
 *   alt+t             — collapses / expands the live panel (ctrl+shift+t kept
 *                       as fallback; ctrl+shift combos don't reach pi in many
 *                       terminals — see docs/keybindings.md)
 *
 *   todo tool (for the model):
 *     create(subject, description?, blockedBy?)  — new pending task
 *     update(id, status?, subject?, description?, addBlockedBy?, removeBlockedBy?)
 *     list(status?, includeDeleted?) — snapshot of visible tasks
 *     get(id)                        — single task detail
 *     delete(id)                     — tombstone (kept for branch replay)
 *     clear()                        — reset all (fresh nextId)
 *
 * State lives in tool-result `details` (full post-mutation snapshot), so
 * branching, /reload and compaction stay correct — same contract as the
 * official `todo.ts` example. Rebuilt from the session branch on
 * `session_start` / `session_compact` / `session_tree`.
 *
 * TUI design follows @juicesharp/rpiv-todo (pi.dev/packages/@juicesharp/rpiv-todo,
 * docs/overlay.md): persistent panel above the editor, tree rows, status
 * glyphs, overflow summary, completed fade-out, collapse shortcut.
 *
 * Official patterns used (no reinventing):
 * - docs/extensions.md → pi.registerTool (promptSnippet/promptGuidelines),
 *   pi.registerCommand, pi.registerShortcut, pi.on(...); state table
 *   (tool-result details = branch-sensitive state).
 * - docs/tui.md → setWidget factory + requestRender, theme from callback,
 *   truncateToWidth with "…" ellipsis; the live widget is the single view
 *   (no second overlay), and app.tools.expand (ctrl+o) shows the full list.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ExtensionUIContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text, truncateToWidth, visibleWidth, type TUI } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type Status = "pending" | "in_progress" | "completed" | "deleted";

interface Task {
  id: number;
  subject: string;
  description?: string;
  status: Status;
  blockedBy: number[];
  activeForm?: string;
}

interface TodoState {
  tasks: Task[];
  nextId: number;
}

interface TodoDetails {
  action: string;
  tasks: Task[];
  nextId: number;
  error?: string;
}

const TodoParams = Type.Object({
  action: StringEnum(["create", "update", "list", "get", "delete", "clear"] as const),
  id: Type.Optional(Type.Number({ description: "Task id (update/get/delete)" })),
  subject: Type.Optional(Type.String({ description: "Short imperative title (create, or update to rename)" })),
  description: Type.Optional(Type.String({ description: "Long-form detail" })),
  status: Type.Optional(
    StringEnum(["pending", "in_progress", "completed"] as const, { description: "Target status (update)" }),
  ),
  activeForm: Type.Optional(
    Type.String({ description: "Present-continuous label shown while in_progress, e.g. 'writing tests'" }),
  ),
  blockedBy: Type.Optional(Type.Array(Type.Number(), { description: "Initial dependency set (create)" })),
  addBlockedBy: Type.Optional(Type.Array(Type.Number(), { description: "Dependencies to add (update)" })),
  removeBlockedBy: Type.Optional(Type.Array(Type.Number(), { description: "Dependencies to remove (update)" })),
  includeDeleted: Type.Optional(Type.Boolean({ description: "Include tombstoned tasks in list" })),
});

type TodoParamsType = {
  action: "create" | "update" | "list" | "get" | "delete" | "clear";
  id?: number;
  subject?: string;
  description?: string;
  status?: Exclude<Status, "deleted">;
  activeForm?: string;
  blockedBy?: number[];
  addBlockedBy?: number[];
  removeBlockedBy?: number[];
  includeDeleted?: boolean;
};

// --- session state (rebuilt from the branch, never disk) --------------------

let tasks: Task[] = [];
let nextId = 1;

function snapshot(): TodoState {
  return { tasks: tasks.map((t) => ({ ...t, blockedBy: [...t.blockedBy] })), nextId };
}

function findTask(id: number): Task | undefined {
  return tasks.find((t) => t.id === id);
}

/** Depth-first cycle check on blockedBy edges (ignores deleted tombstones). */
function hasCycle(all: Task[]): boolean {
  const live = new Map(all.filter((t) => t.status !== "deleted").map((t) => [t.id, t]));
  const visiting = new Set<number>();
  const done = new Set<number>();
  const visit = (id: number): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const dep of live.get(id)?.blockedBy ?? []) {
      if (live.has(dep) && visit(dep)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  for (const id of live.keys()) if (visit(id)) return true;
  return false;
}

function validateDeps(taskId: number, deps: number[]): string | undefined {
  for (const d of deps) {
    if (d === taskId) return `task #${taskId} cannot block itself`;
    if (!findTask(d) || findTask(d)?.status === "deleted") return `dependency #${d} does not exist`;
  }
  return undefined;
}

function mutate(params: TodoParamsType): { ok: boolean; text: string; error?: string } {
  switch (params.action) {
    case "create": {
      if (!params.subject?.trim()) return { ok: false, text: "Error: subject required for create", error: "subject required" };
      const deps = params.blockedBy ?? [];
      const bad = validateDeps(nextId, deps);
      if (bad) return { ok: false, text: `Error: ${bad}`, error: bad };
      const task: Task = {
        id: nextId++,
        subject: params.subject.trim(),
        description: params.description,
        status: "pending",
        blockedBy: [...new Set(deps)],
      };
      tasks.push(task);
      if (hasCycle(tasks)) {
        tasks.pop();
        nextId--;
        return { ok: false, text: "Error: blockedBy would create a dependency cycle", error: "dependency cycle" };
      }
      return { ok: true, text: `Created #${task.id}: ${task.subject}` };
    }
    case "update": {
      if (params.id === undefined) return { ok: false, text: "Error: id required for update", error: "id required" };
      const task = findTask(params.id);
      if (!task || task.status === "deleted") return { ok: false, text: `Task #${params.id} not found`, error: `#${params.id} not found` };
      const backup = { ...task, blockedBy: [...task.blockedBy] };
      if (params.subject !== undefined) {
        if (!params.subject.trim()) return { ok: false, text: "Error: subject cannot be empty", error: "empty subject" };
        task.subject = params.subject.trim();
      }
      if (params.description !== undefined) task.description = params.description || undefined;
      if (params.status !== undefined) {
        if (params.status === "in_progress") {
          const other = tasks.find((t) => t.id !== task.id && t.status === "in_progress");
          if (other) {
            Object.assign(task, backup);
            return {
              ok: false,
              text: `Error: #${other.id} is already in_progress — complete it first`,
              error: `#${other.id} already in_progress`,
            };
          }
          task.status = "in_progress";
          if (params.activeForm !== undefined) task.activeForm = params.activeForm;
        } else {
          if (params.status === "completed") {
            const open = task.blockedBy.filter((d) => {
              const dep = findTask(d);
              return dep && dep.status !== "completed" && dep.status !== "deleted";
            });
            if (open.length > 0) {
              Object.assign(task, backup);
              return { ok: false, text: `Error: #${task.id} blocked by ${open.map((d) => `#${d}`).join(", ")}`, error: "blocked by open deps" };
            }
          }
          task.status = params.status;
          task.activeForm = undefined;
        }
      } else if (params.activeForm !== undefined && task.status === "in_progress") {
        task.activeForm = params.activeForm;
      }
      const merged = new Set(task.blockedBy);
      for (const d of params.addBlockedBy ?? []) merged.add(d);
      for (const d of params.removeBlockedBy ?? []) merged.delete(d);
      task.blockedBy = [...merged];
      const bad = validateDeps(task.id, task.blockedBy);
      if (bad || hasCycle(tasks)) {
        Object.assign(task, backup);
        const msg = bad ?? "dependency cycle";
        return { ok: false, text: `Error: ${msg}`, error: msg };
      }
      return { ok: true, text: `Updated #${task.id}: ${task.subject} [${task.status}]` };
    }
    case "delete": {
      if (params.id === undefined) return { ok: false, text: "Error: id required for delete", error: "id required" };
      const task = findTask(params.id);
      if (!task || task.status === "deleted") return { ok: false, text: `Task #${params.id} not found`, error: `#${params.id} not found` };
      task.status = "deleted";
      task.activeForm = undefined;
      return { ok: true, text: `Deleted #${task.id}` };
    }
    case "clear": {
      const n = tasks.filter((t) => t.status !== "deleted").length;
      tasks = [];
      nextId = 1;
      return { ok: true, text: `Cleared ${n} task(s)` };
    }
    case "get": {
      if (params.id === undefined) return { ok: false, text: "Error: id required for get", error: "id required" };
      const task = findTask(params.id);
      if (!task || task.status === "deleted") return { ok: false, text: `Task #${params.id} not found`, error: `#${params.id} not found` };
      const lines = [
        `#${task.id}: ${task.subject} [${task.status}]`,
        ...(task.activeForm ? [`  doing: ${task.activeForm}`] : []),
        ...(task.description ? [`  ${task.description}`] : []),
        ...(task.blockedBy.length > 0 ? [`  blocked by: ${task.blockedBy.map((d) => `#${d}`).join(", ")}`] : []),
      ];
      return { ok: true, text: lines.join("\n") };
    }
    case "list": {
      const visible = tasks.filter(
        (t) => t.status !== "deleted" && (params.status === undefined || t.status === params.status),
      );
      if (visible.length === 0) return { ok: true, text: "No todos" };
      return {
        ok: true,
        text: visible.map((t) => `[${t.status === "completed" ? "x" : t.status === "in_progress" ? "~" : " "}] #${t.id}: ${t.subject}`).join("\n"),
      };
    }
  }
}

function reconstruct(ctx: ExtensionContext): void {
  tasks = [];
  nextId = 1;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const msg = entry.message;
    if (msg.role !== "toolResult" || msg.toolName !== "todo") continue;
    const details = msg.details as TodoDetails | undefined;
    if (details) {
      tasks = details.tasks.map((t) => ({ ...t, blockedBy: [...t.blockedBy] }));
      nextId = details.nextId;
    }
  }
}

// --- live panel (rpiv-todo style) -------------------------------------------

const WIDGET_KEY = "todos";
// Content-row budget (heading counts against it): at most 4 todo rows so the
// panel stays compact — overflowing shows 3 rows + the `+N more` summary.
// Floor of 3 mirrors rpiv-todo's getMaxWidgetLines(); no ceiling. Read fresh
// per render so a future config file can plug in without touching the math.
const DEFAULT_MAX_WIDGET_LINES = 5;
function getMaxWidgetLines(): number {
  return DEFAULT_MAX_WIDGET_LINES < 3 ? 12 : DEFAULT_MAX_WIDGET_LINES;
}
// Collapse hint always advertises the terminal-safe key. ctrl+shift+t stays
// registered as a fallback but many terminals swallow ctrl+shift combos
// (docs/keybindings.md: super/ctrl+shift need Kitty protocol or get
// intercepted), so /todos hide|show never depends on a shortcut.
const COLLAPSE_HINT = "alt+t to expand";

const ACTION_GLYPH: Record<TodoParamsType["action"], string> = {
  create: "+",
  update: "→",
  delete: "×",
  get: "›",
  list: "☰",
  clear: "∅",
};

function overlayGlyph(status: Status, theme: Theme): string {
  switch (status) {
    case "pending":
      return theme.fg("dim", "○");
    case "in_progress":
      return theme.fg("warning", "◐");
    case "completed":
      return theme.fg("success", "✓");
    case "deleted":
      return theme.fg("error", "✗");
  }
}

function formatRow(t: Task, theme: Theme, showId: boolean): string {
  const glyph = overlayGlyph(t.status, theme);
  const color = t.status === "in_progress" ? "accent" : t.status === "pending" ? "text" : "muted";
  let subject = theme.fg(color, t.subject);
  if (t.status === "completed" || t.status === "deleted") subject = theme.strikethrough(subject);
  let line = glyph;
  if (showId) line += ` ${theme.fg("dim", `#${t.id}`)}`;
  line += ` ${subject}`;
  if (t.status === "in_progress" && t.activeForm) line += ` ${theme.fg("muted", `(${t.activeForm})`)}`;
  if (t.blockedBy.length > 0) line += ` ${theme.fg("muted", `⛓ ${t.blockedBy.map((d) => `#${d}`).join(",")}`)}`;
  return line;
}

// Visible body rows inside the table window (rest via scroll).
const TABLE_BUDGET = 14;

function padEndVisible(s: string, n: number): string {
  const w = visibleWidth(s);
  return w >= n ? s : s + " ".repeat(n - w);
}

// Refresh hook for the open table window (set by its factory, cleared on close).
// tool_execution_end pokes it so the table re-renders live on every todo change.
let tableRefresh: (() => void) | undefined;

/** Full-list overlay window (docs/tui.md: ctx.ui.custom temporary screen).
 *  Bordered table like 01-resources, one row per todo — no row budget,
 *  scroll with ↑↓/PgUp/PgDn/Home/End, `f` filters by status, close with
 *  esc/enter/space/q. Live: re-reads state on every render and repaints on
 *  each todo tool change while open. */
async function showTodosTable(
  ctx: ExtensionCommandContext,
  getLive: () => Task[],
): Promise<void> {
  const live = getLive();
  if (ctx.mode !== "tui" || !ctx.hasUI) {
    const done = live.filter((t) => t.status === "completed").length;
    ctx.ui.notify(
      live.length === 0
        ? "No todos yet. Ask the agent to add some!"
        : [`Todos (${done}/${live.length})`, ...live.map((t) => `  #${t.id} [${t.status}] ${t.subject}`)].join("\n"),
      "info",
    );
    return;
  }

  type Filter = "all" | Exclude<Status, "deleted">;
  const FILTERS: Filter[] = ["all", "pending", "in_progress", "completed"];
  const FILTER_LABEL: Record<Filter, string> = { all: "todas", pending: "pendientes", in_progress: "en progreso", completed: "completadas" };
  // Creation order (#id ascending) — "en orden"; status views come from the filter.
  // Rows/dep widths resolve per render from getLive() so the open table stays live.

  await ctx.ui.custom<void>(
    (tui, theme, _kb, doneFn) => {
      tableRefresh = () => tui.requestRender();
      const close = () => {
        tableRefresh = undefined;
        doneFn(undefined);
      };
      let scroll = 0;
      let filter: Filter = "all";
      const snapshot = (): Task[] => [...getLive()].sort((a, b) => a.id - b.id);
      const maxScrollFor = (n: number): number => Math.max(0, n - TABLE_BUDGET);
      const glyphFor = (t: Task): string => {
        switch (t.status) {
          case "pending": return theme.fg("dim", "○");
          case "in_progress": return theme.fg("warning", "◐");
          case "completed": return theme.fg("success", "✓");
          case "deleted": return theme.fg("error", "✗");
        }
      };
      const subjectFor = (t: Task): string => {
        if (t.status === "completed") return theme.strikethrough(theme.fg("muted", t.subject));
        if (t.status === "in_progress") return theme.fg("accent", t.subject);
        return theme.fg("text", t.subject);
      };

      return {
        invalidate() {},
        handleInput(data: string) {
          if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || matchesKey(data, Key.space) || data === "q") {
            close();
            return;
          }
          // `f` cycles the status filter: todas → pendientes → en progreso → completadas.
          if (data === "f" || data === "F") {
            filter = FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length];
            scroll = 0;
            tui.requestRender();
            return;
          }
          const maxScroll = maxScrollFor(snapshot().filter((t) => filter === "all" || t.status === filter).length);
          let next = scroll;
          if (matchesKey(data, Key.up)) next = scroll - 1;
          else if (matchesKey(data, Key.down)) next = scroll + 1;
          else if (matchesKey(data, Key.pageUp)) next = scroll - TABLE_BUDGET;
          else if (matchesKey(data, Key.pageDown)) next = scroll + TABLE_BUDGET;
          else if (matchesKey(data, Key.home)) next = 0;
          else if (matchesKey(data, Key.end)) next = maxScroll;
          else return;
          scroll = Math.min(maxScroll, Math.max(0, next));
          tui.requestRender();
        },
        render(width: number): string[] {
          // Fresh state on every render — this is what makes the open table live.
          const live = snapshot();
          const rows = filter === "all" ? live : live.filter((t) => t.status === filter);
          scroll = Math.min(scroll, Math.max(0, rows.length - TABLE_BUDGET));
          const done = live.filter((t) => t.status === "completed").length;
          const depTexts = new Map<number, string>();
          for (const t of live) if (t.blockedBy.length > 0) depTexts.set(t.id, `⛓ ${t.blockedBy.map((d) => `#${d}`).join(",")}`);
          const depW = depTexts.size > 0 ? Math.max(4, ...[...depTexts.values()].map((s) => visibleWidth(s))) : 0;
          const W = Math.max(48, width);
          const inner = W - 2;
          const b = (s: string) => theme.fg("borderAccent", s);
          const title = (s: string) => theme.fg("accent", theme.bold(s));
          const dim = (s: string) => theme.fg("dim", s);
          const sep = dim(" │ ");
          // ` #12 │ ◐ │ subject │ ⛓ #1` → titleW fills the rest.
          const titleW = Math.max(10, inner - 1 - 4 - 3 - 1 - 3 - (depW > 0 ? 3 + depW : 0));
          const cell = (s: string, n: number) => padEndVisible(truncateToWidth(s, n, "…"), n);
          const titleText = filter === "all" ? ` Todos (${done}/${live.length}) ` : ` Todos (${done}/${live.length}) · ${FILTER_LABEL[filter]} `;
          const top = b("┌") + b("─") + title(titleText) + b("─".repeat(Math.max(1, inner - 1 - visibleWidth(titleText)))) + b("┐");
          const mid = b("├") + b("─".repeat(inner)) + b("┤");
          const bot = b("└") + b("─".repeat(inner)) + b("┘");
          const rowLine = (s: string) => b("│") + padEndVisible(truncateToWidth(s, inner), inner) + b("│");
          const head = ` ${cell(dim("#"), 4)}${sep}${cell(dim("E"), 1)}${sep}${cell(dim("Título"), titleW)}${depW > 0 ? `${sep}${cell(dim("Dep"), depW)}` : ""}`;

          const out: string[] = [truncateToWidth(top, W), truncateToWidth(rowLine(head), W), truncateToWidth(mid, W)];
          const view = rows.slice(scroll, scroll + TABLE_BUDGET);
          if (view.length === 0)
            out.push(
              truncateToWidth(
                rowLine(dim(live.length === 0 ? "  No todos yet. Ask the agent to add some!" : "  Sin todos en este filtro — pulsa f para cambiar")),
                W,
              ),
            );
          for (const t of view) {
            const line = ` ${cell(theme.fg("accent", `#${t.id}`), 4)}${sep}${cell(glyphFor(t), 1)}${sep}${cell(subjectFor(t), titleW)}${
              depW > 0 ? `${sep}${cell(dim(depTexts.get(t.id) ?? ""), depW)}` : ""
            }`;
            out.push(truncateToWidth(rowLine(line), W));
          }
          const remaining = Math.max(0, rows.length - scroll - TABLE_BUDGET);
          out.push(
            truncateToWidth(
              rowLine(dim(remaining > 0 ? `  ↓ ${remaining} más · f filtro · ↑↓ scroll · q cerrar` : `  f filtro · ↑↓ scroll · q cerrar · ${done}/${live.length} completed`)),
              W,
            ),
          );
          out.push(truncateToWidth(bot, W));
          return out;
        },
      };
    },
    {
      overlay: true,
      overlayOptions: { anchor: "center", width: "70%", maxHeight: "90%", margin: 2 },
    },
  );
}

export default function (pi: ExtensionAPI) {
  let uiCtx: ExtensionUIContext | undefined;
  let widgetRegistered = false;
  let tui: TUI | undefined;
  let collapsed = false;
  // Completed fade-out: rows stay for the rest of the turn, hide on next turn.
  const pendingHide = new Set<number>();
  const hiddenCompleted = new Set<number>();
  // Detects clear() (nextId drops back to 1) so stale fade flags can't survive it.
  let lastNextId: number | undefined;

  const visibleTasks = (): Task[] =>
    tasks.filter((t) => t.status !== "deleted" && !hiddenCompleted.has(t.id));

  function renderPanel(theme: Theme, width: number): string[] {
    const live = visibleTasks();
    if (live.length === 0) return [];
    const trunc = (s: string) => truncateToWidth(s, width, "…");
    const done = live.filter((t) => t.status === "completed").length;
    const hasActive = live.some((t) => t.status === "pending" || t.status === "in_progress");
    const color = hasActive ? "accent" : "dim";
    const heading = trunc(`${theme.fg(color, hasActive ? "●" : "○")} ${theme.fg(color, `Todos (${done}/${live.length})`)}`);

    if (collapsed) {
      return [heading, trunc(`${theme.fg("dim", "└─")} ${theme.fg("dim", COLLAPSE_HINT)}`), ""];
    }

    const showIds = live.some((t) => t.blockedBy.length > 0);
    // Track newly displayed completed rows for fade-out on next turn.
    for (const t of live) {
      if (t.status === "completed" && !pendingHide.has(t.id) && !hiddenCompleted.has(t.id)) pendingHide.add(t.id);
    }

    // Pi's built-in app.tools.expand (ctrl+o) shows the full list on demand;
    // otherwise the heading + budget keep the panel compact. Optional chaining
    // keeps compat with hosts predating getToolsExpanded().
    const expanded =
      (uiCtx as { getToolsExpanded?: () => boolean } | undefined)?.getToolsExpanded?.() === true;
    const budget = expanded ? live.length : getMaxWidgetLines() - 1; // heading counts against the budget
    const completed = live.filter((t) => t.status === "completed");
    const unfinished = live.filter((t) => t.status !== "completed");
    // Drop completed first (newest first — oldest completed stays longest).
    let shownCompleted = completed;
    let hiddenCompletedCount = 0;
    if (completed.length + unfinished.length > budget) {
      const roomForCompleted = Math.max(0, budget - unfinished.length);
      hiddenCompletedCount = completed.length - roomForCompleted;
      shownCompleted = completed.slice(0, roomForCompleted);
    }
    let shown = [...shownCompleted, ...unfinished];
    let truncatedTail = 0;
    if (shown.length > budget) {
      // Unfinished alone still overflows: reserve one row for the summary.
      const keep = unfinished.slice(0, budget - shownCompleted.length - 1);
      truncatedTail = unfinished.length - keep.length;
      shown = [...shownCompleted, ...keep];
    }

    const lines = [heading];
    for (const t of shown) lines.push(trunc(`${theme.fg("dim", "├─")} ${formatRow(t, theme, showIds)}`));
    if (hiddenCompletedCount === 0 && truncatedTail === 0) {
      lines[lines.length - 1] = lines[lines.length - 1].replace("├─", "└─");
    } else {
      const parts: string[] = [];
      if (hiddenCompletedCount > 0) parts.push(`${hiddenCompletedCount} completed`);
      if (truncatedTail > 0) parts.push(`${truncatedTail} pending`);
      const total = hiddenCompletedCount + truncatedTail;
      lines.push(trunc(`${theme.fg("dim", "└─")} ${theme.fg("dim", `+${total} more (${parts.join(", ")})`)}`));
    }
    lines.push(""); // breathing room above the editor box
    return lines;
  }

  function update(resetFade = false): void {
    if (lastNextId !== undefined && nextId < lastNextId) {
      // clear() reset the id sequence — drop fade tracking with it.
      pendingHide.clear();
      hiddenCompleted.clear();
    }
    lastNextId = nextId;
    if (resetFade) {
      pendingHide.clear();
      hiddenCompleted.clear();
    }
    if (!uiCtx) return;
    if (visibleTasks().length === 0) {
      if (widgetRegistered) {
        uiCtx.setWidget(WIDGET_KEY, undefined);
        widgetRegistered = false;
        tui = undefined;
      }
      return;
    }
    if (!widgetRegistered) {
      uiCtx.setWidget(
        WIDGET_KEY,
        (t, factoryTheme) => {
          tui = t;
          return {
            render: (width: number) => renderPanel(uiCtx?.theme ?? factoryTheme, width),
            invalidate: () => {},
          };
        },
        { placement: "aboveEditor" },
      );
      widgetRegistered = true;
    } else {
      tui?.requestRender();
    }
  }

  function dispose(): void {
    try {
      uiCtx?.setWidget(WIDGET_KEY, undefined);
    } catch {
      /* stale ui proxy on shutdown — safe to ignore */
    }
    widgetRegistered = false;
    tui = undefined;
    uiCtx = undefined;
  }

  pi.on("session_start", async (_event, ctx) => {
    reconstruct(ctx);
    if (!ctx.hasUI) return;
    uiCtx = ctx.ui;
    await update(true);
  });
  pi.on("session_compact", async (_event, ctx) => {
    reconstruct(ctx);
    await update(true);
  });
  pi.on("session_tree", async (_event, ctx) => {
    reconstruct(ctx);
    await update(true);
  });
  pi.on("session_shutdown", async () => dispose());

  // Branch is stale in message_end — refresh here, reading live module state.
  // Also repaints the open /todos table so it stays live while visible.
  pi.on("tool_execution_end", async (event) => {
    if (event.toolName !== "todo" || event.isError) return;
    await update();
    tableRefresh?.();
  });

  // Completed rows fade at the start of the next turn.
  pi.on("agent_start", async () => {
    if (pendingHide.size === 0) return;
    for (const id of pendingHide) hiddenCompleted.add(id);
    pendingHide.clear();
    await update();
  });

  // Terminal-safe primary (alt combos arrive as ESC-prefix almost everywhere)
  // plus the old ctrl+shift+t as fallback where the terminal does deliver it.
  // Forced redraw: collapsing changes the widget height, so request a shape
  // change, not a plain refresh.
  const toggleCollapse = (ctx: { hasUI: boolean }) => {
    if (!ctx.hasUI || !widgetRegistered) return;
    collapsed = !collapsed;
    (tui?.requestRender as ((forced?: boolean) => void) | undefined)?.(true);
  };
  pi.registerShortcut(Key.alt("t"), {
    description: "Collapse or expand the todo panel",
    handler: toggleCollapse,
  });
  pi.registerShortcut(Key.ctrlShift("t"), {
    description: "Collapse or expand the todo panel (fallback)",
    handler: toggleCollapse,
  });

  pi.registerTool({
    name: "todo",
    label: "Todo",
    description:
      "Manage a session task list for multi-step work. Actions: create (new task), update (status/fields/deps), list, get, delete, clear. Status: pending → in_progress → completed (+ deleted tombstone).",
    promptSnippet: "Manage a task list to track multi-step progress",
    promptGuidelines: [
      "Use `todo` for work with 3+ steps or when the user gives a task list. Skip it for single trivial tasks.",
      "Mark a task in_progress BEFORE starting it; mark completed IMMEDIATELY after — never batch. One task in_progress at a time.",
      "Never complete a task with failing tests or partial work — keep it in_progress and create a blocker task instead.",
      'Change status via {"action":"update","id":N,"status":"completed"} (or "in_progress" with activeForm like "writing tests").',
      "Use blockedBy for dependencies; cycles, self-blocks and dangling ids are rejected.",
    ],
    parameters: TodoParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const p = params as unknown as TodoParamsType;
      const result = mutate(p);
      const state = snapshot();
      return {
        content: [{ type: "text", text: result.text }],
        details: { action: p.action, tasks: state.tasks, nextId: state.nextId, ...(result.error ? { error: result.error } : {}) } as TodoDetails,
      };
    },
    renderCall(args, theme, _context) {
      const a = args as unknown as TodoParamsType;
      const glyph = ACTION_GLYPH[a.action] ?? a.action;
      let text = theme.fg("toolTitle", theme.bold("todo ")) + theme.fg("muted", glyph);
      if (a.action === "create" && a.subject) text += ` ${theme.fg("dim", a.subject)}`;
      else if ((a.action === "update" || a.action === "get" || a.action === "delete") && a.id !== undefined) {
        const subject = findTask(a.id)?.subject;
        text += ` ${theme.fg("accent", subject ?? `#${a.id}`)}`;
      } else if (a.action === "list" && a.status) text += ` ${theme.fg("muted", a.status)}`;
      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as TodoDetails | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }
      if (details.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      const live = details.tasks.filter((t) => t.status !== "deleted");
      if (details.action === "list") {
        if (live.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);
        const show = expanded ? live : live.slice(0, 5);
        let out = theme.fg("muted", `${live.length} todo(s):`);
        for (const t of show) {
          const check = t.status === "completed" ? theme.fg("success", "✓") : t.status === "in_progress" ? theme.fg("warning", "◐") : theme.fg("dim", "○");
          out += `\n${check} ${theme.fg("accent", `#${t.id}`)} ${theme.fg("muted", t.subject)}`;
        }
        if (!expanded && live.length > 5) out += `\n${theme.fg("dim", `... ${live.length - 5} more`)}`;
        return new Text(out, 0, 0);
      }
      const text = result.content[0];
      const msg = text?.type === "text" ? text.text : "";
      return new Text(theme.fg("success", "✓ ") + theme.fg("muted", msg), 0, 0);
    },
  });

  pi.registerCommand("todos", {
    description: "Toggle the live todo panel; /todos hide|show for explicit state; /todos table for the full list window",
    handler: async (args, ctx) => {
      const sub = args.trim().toLowerCase();
      if (sub === "table" || sub === "all") {
        await showTodosTable(ctx, () => tasks.filter((t) => t.status !== "deleted"));
        return;
      }
      const redraw = () =>
        (tui?.requestRender as ((forced?: boolean) => void) | undefined)?.(true);
      if (sub === "hide" || sub === "collapse" || sub === "off") {
        collapsed = true;
        redraw();
        return;
      }
      if (sub === "show" || sub === "expand" || sub === "on") {
        collapsed = false;
        redraw();
        return;
      }
      // Bare /todos toggles: the live widget above the editor is the only
      // view — no second overlay, no notify spam.
      if (!ctx.hasUI) {
        ctx.ui.notify("/todos requires interactive mode", "error");
        return;
      }
      collapsed = !collapsed;
      redraw();
    },
  });
}
