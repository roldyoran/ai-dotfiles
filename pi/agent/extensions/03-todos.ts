/**
 * 03-todos — session-scoped TODO system (branch-aware, no disk) with an
 * on-demand modal overlay.
 *
 *   /todos [filtro]  — opens the Todos modal (overlay above everything).
 *                      Optional initial filter: all | pending | waiting |
 *                      in_progress | completed (Spanish aliases accepted).
 *   /todos table     — alias (kept for muscle memory, opens the same modal).
 *   alt+t            — opens the modal (ctrl+shift+t kept as fallback; many
 *                      terminals swallow ctrl+shift combos — see
 *                      docs/keybindings.md).
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
 * UI design: NO persistent widget. The main screen stays clean (zero render
 * cost when closed); the modal is the single view, opened on demand.
 *
 * Official patterns used (no reinventing):
 * - docs/extensions.md → pi.registerTool (promptSnippet/promptGuidelines),
 *   pi.registerCommand, pi.registerShortcut, pi.on(...); state table
 *   (tool-result details = branch-sensitive state).
 * - docs/tui.md → ctx.ui.custom() with `overlay: true` for a temporary screen
 *   above existing content; component renders string[] within the supplied
 *   width, caches layout by width+content and clears it in invalidate(),
 *   truncates every line with truncateToWidth ("…" ellipsis), measures with
 *   visibleWidth(), and repaints via the injected tui.requestRender()
 *   (coalesced by the TUI). Theme comes from the factory callback — themed
 *   strings are rebuilt on every render, never stored.
 * - examples/extensions/todo.ts → class-free custom component closed via
 *   done(); examples/extensions/overlay-qa-tests.ts → overlay sizing
 *   (anchor center, width "70%", maxHeight "90%", margin 2).
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
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

// --- modal overlay (the single view, opened on demand) ----------------------

// Visible body-row budget inside the modal viewport (headers + rows share it;
// the rest is reachable via scroll). Small enough to fit short terminals,
// large enough that most lists need no scrolling.
const MODAL_BUDGET = 14;

type Filter = "all" | "in_progress" | "pending" | "waiting" | "completed";
const FILTERS: Filter[] = ["all", "in_progress", "pending", "waiting", "completed"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "todas",
  in_progress: "en progreso",
  pending: "pendientes",
  waiting: "en espera",
  completed: "completadas",
};
const SECTION_TITLE: Record<Exclude<Filter, "all">, string> = {
  in_progress: "En progreso",
  waiting: "En espera",
  pending: "Pendientes",
  completed: "Completadas",
};

function padEndVisible(s: string, n: number): string {
  const w = visibleWidth(s);
  return w >= n ? s : s + " ".repeat(n - w);
}

/** Pending with at least one open (non-completed, non-deleted) dependency. */
function isWaiting(t: Task): boolean {
  if (t.status !== "pending" || t.blockedBy.length === 0) return false;
  return t.blockedBy.some((d) => {
    const dep = findTask(d);
    return dep !== undefined && dep.status !== "completed" && dep.status !== "deleted";
  });
}

function glyphFor(t: Task, theme: Theme): string {
  switch (t.status) {
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

function subjectFor(t: Task, theme: Theme): string {
  if (t.status === "completed") return theme.strikethrough(theme.fg("muted", t.subject));
  if (t.status === "in_progress") return theme.fg("accent", t.subject);
  return theme.fg("text", t.subject);
}

// Re-entrancy guard: the modal owns input focus while open, so a second
// open (shortcut while modal visible, double /todos) is ignored instead of
// stacking overlays.
let modalOpen = false;
// Live-refresh hook for the open modal (set by its factory, cleared on close).
// tool_execution_end pokes it so the modal repaints on every todo change.
let modalRefresh: (() => void) | undefined;

/**
 * Full-list modal (docs/tui.md: ctx.ui.custom temporary screen with
 * overlay:true — floats above everything, keeps input focus until closed).
 * Grouped by state so you can see at a glance what's running, what's
 * waiting, what's pending and what's done. Live: re-reads state on every
 * render and repaints on each todo tool change while open.
 */
async function openTodosModal(
  ctx: ExtensionCommandContext,
  getLive: () => Task[],
  initialFilter: Filter = "all",
): Promise<void> {
  if (modalOpen) return;
  if (!ctx.hasUI || ctx.mode !== "tui" || typeof ctx.ui?.custom !== "function") {
    const live = getLive();
    const done = live.filter((t) => t.status === "completed").length;
    ctx.ui.notify(
      live.length === 0
        ? "No todos yet. Ask the agent to add some!"
        : [`Todos (${done}/${live.length})`, ...live.map((t) => `  #${t.id} [${t.status}] ${t.subject}`)].join("\n"),
      "info",
    );
    return;
  }

  modalOpen = true;
  try {
    await ctx.ui.custom<void>(
    (tui, theme, _kb, doneFn) => {
      let scroll = 0;
      let filter: Filter = initialFilter;
      // Render cache (docs/tui.md: cache layout by width+content, clear in
      // invalidate() — parents reuse an unchanged array without re-reading).
      let cachedWidth: number | undefined;
      let cachedKey: string | undefined;
      let cachedLines: string[] | undefined;
      const invalidate = () => {
        cachedWidth = undefined;
        cachedKey = undefined;
        cachedLines = undefined;
      };
      modalRefresh = () => {
        invalidate();
        tui.requestRender();
      };
      const close = () => {
        modalRefresh = undefined;
        doneFn(undefined);
      };
      const snapshot = (): Task[] => [...getLive()].sort((a, b) => a.id - b.id);
      const groupOf = (t: Task): Exclude<Filter, "all"> =>
        t.status === "in_progress" ? "in_progress" : t.status === "completed" ? "completed" : isWaiting(t) ? "waiting" : "pending";

      return {
        invalidate,
        handleInput(data: string) {
          if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || matchesKey(data, Key.space) || data === "q") {
            close();
            return;
          }
          // `f` cycles the status filter.
          if (data === "f" || data === "F") {
            filter = FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length];
            scroll = 0;
            invalidate();
            tui.requestRender();
            return;
          }
          const live = snapshot();
          const rows = filter === "all" ? live : live.filter((t) => groupOf(t) === filter);
          // In "all" view, section headers share the scroll space.
          const groups: Array<Exclude<Filter, "all">> = ["in_progress", "waiting", "pending", "completed"];
          const bodyLen =
            filter === "all"
              ? groups.reduce((n, g) => n + (live.some((t) => groupOf(t) === g) ? 1 + live.filter((t) => groupOf(t) === g).length : 0), 0)
              : rows.length;
          const maxScroll = Math.max(0, bodyLen - MODAL_BUDGET);
          let next = scroll;
          if (matchesKey(data, Key.up)) next = scroll - 1;
          else if (matchesKey(data, Key.down)) next = scroll + 1;
          else if (matchesKey(data, Key.pageUp)) next = scroll - MODAL_BUDGET;
          else if (matchesKey(data, Key.pageDown)) next = scroll + MODAL_BUDGET;
          else if (matchesKey(data, Key.home)) next = 0;
          else if (matchesKey(data, Key.end)) next = maxScroll;
          else return;
          scroll = Math.min(maxScroll, Math.max(0, next));
          invalidate();
          tui.requestRender();
        },
        render(width: number): string[] {
          // Fresh state on every render — this is what makes the open modal live.
          const live = snapshot();
          const rows = filter === "all" ? live : live.filter((t) => groupOf(t) === filter);
          const groups: Array<Exclude<Filter, "all">> = ["in_progress", "waiting", "pending", "completed"];
          const counts = new Map<Exclude<Filter, "all">, number>();
          for (const g of groups) counts.set(g, live.filter((t) => groupOf(t) === g).length);

          // Cheap content signature: rebuild cached lines only when the
          // visible state actually changed (tool updates) or view moved.
          const sig = `${live.map((t) => `${t.id}:${t.status}:${t.subject}:${t.activeForm ?? ""}:${t.blockedBy.join(",")}`).join("|")}#${scroll}#${filter}`;
          if (cachedLines && cachedWidth === width && cachedKey === sig) return cachedLines;

          const depTexts = new Map<number, string>();
          for (const t of live) if (t.blockedBy.length > 0) depTexts.set(t.id, `⛓ ${t.blockedBy.map((d) => `#${d}`).join(",")}`);
          const depW = depTexts.size > 0 ? Math.max(4, ...[...depTexts.values()].map((s) => visibleWidth(s))) : 0;
          const W = Math.max(48, width);
          const inner = W - 2;
          const b = (s: string) => theme.fg("borderAccent", s);
          const title = (s: string) => theme.fg("accent", theme.bold(s));
          const dim = (s: string) => theme.fg("dim", s);
          const mut = (s: string) => theme.fg("muted", s);
          const sep = dim(" │ ");
          // ` #12 │ ◐ │ subject │ ⛓ #1` → titleW fills the rest.
          const titleW = Math.max(10, inner - 1 - 4 - 3 - 1 - 3 - (depW > 0 ? 3 + depW : 0));
          const cell = (s: string, n: number) => padEndVisible(truncateToWidth(s, n, "…"), n);
          const done = counts.get("completed") ?? 0;
          const active = (counts.get("in_progress") ?? 0) + (counts.get("waiting") ?? 0) + (counts.get("pending") ?? 0);
          const titleText =
            filter === "all"
              ? ` Todos (${done}/${live.length}) · ${active} activas `
              : ` Todos (${done}/${live.length}) · ${FILTER_LABEL[filter]} `;
          const top = b("┌") + b("─") + title(titleText) + b("─".repeat(Math.max(1, inner - 1 - visibleWidth(titleText)))) + b("┐");
          const mid = b("├") + b("─".repeat(inner)) + b("┤");
          const bot = b("└") + b("─".repeat(inner)) + b("┘");
          const rowLine = (s: string) => b("│") + padEndVisible(truncateToWidth(s, inner), inner) + b("│");
          const head = ` ${cell(mut("#"), 4)}${sep}${cell(mut("E"), 1)}${sep}${cell(mut("Título"), titleW)}${depW > 0 ? `${sep}${cell(mut("Dep"), depW)}` : ""}`;

          const body: string[] = [];
          if (filter === "all") {
            for (const g of groups) {
              const items = live.filter((t) => groupOf(t) === g);
              if (items.length === 0) continue;
              body.push(` ${mut(`▸ ${SECTION_TITLE[g]} (${items.length})`)}`);
              for (const t of items) {
                body.push(
                  ` ${cell(theme.fg("accent", `#${t.id}`), 4)}${sep}${cell(glyphFor(t, theme), 1)}${sep}${cell(
                    `${subjectFor(t, theme)}${t.status === "in_progress" && t.activeForm ? ` ${theme.fg("muted", `(${t.activeForm})`)}` : ""}`,
                    titleW,
                  )}${depW > 0 ? `${sep}${cell(mut(depTexts.get(t.id) ?? ""), depW)}` : ""}`,
                );
              }
            }
          } else {
            for (const t of rows) {
              body.push(
                ` ${cell(theme.fg("accent", `#${t.id}`), 4)}${sep}${cell(glyphFor(t, theme), 1)}${sep}${cell(
                  `${subjectFor(t, theme)}${t.status === "in_progress" && t.activeForm ? ` ${theme.fg("muted", `(${t.activeForm})`)}` : ""}`,
                  titleW,
                )}${depW > 0 ? `${sep}${cell(mut(depTexts.get(t.id) ?? ""), depW)}` : ""}`,
              );
            }
          }

          scroll = Math.min(scroll, Math.max(0, body.length - MODAL_BUDGET));
          const view = body.slice(scroll, scroll + MODAL_BUDGET);
          const out: string[] = [truncateToWidth(top, W), truncateToWidth(rowLine(head), W), truncateToWidth(mid, W)];
          if (view.length === 0) {
            out.push(
              truncateToWidth(
                rowLine(mut(live.length === 0 ? "  No hay todos todavía. Pídele al agente que añada alguno." : "  Sin todos en este filtro — pulsa f para cambiar")),
                W,
              ),
            );
          } else {
            for (const line of view) out.push(truncateToWidth(rowLine(line), W));
          }
          const remaining = Math.max(0, body.length - scroll - MODAL_BUDGET);
          out.push(
            truncateToWidth(
              rowLine(
                mut(
                  remaining > 0
                    ? `  ↓ ${remaining} más · f filtro (${FILTER_LABEL[filter]}) · ↑↓ scroll · q cerrar`
                    : `  f filtro (${FILTER_LABEL[filter]}) · ↑↓ scroll · q cerrar · ${done}/${live.length} completadas`,
                ),
              ),
              W,
            ),
          );
          out.push(truncateToWidth(bot, W));

          cachedWidth = width;
          cachedKey = sig;
          cachedLines = out;
          return out;
        },
      };
    },
    {
      overlay: true,
      overlayOptions: { anchor: "center", width: "70%", maxHeight: "90%", margin: 2 },
    },
  );
  } finally {
    modalOpen = false;
    modalRefresh = undefined;
  }
}

const ACTION_GLYPH: Record<TodoParamsType["action"], string> = {
  create: "+",
  update: "→",
  delete: "×",
  get: "›",
  list: "☰",
  clear: "∅",
};

function parseFilterArg(args: string): Filter {
  const a = args.trim().toLowerCase();
  if (a === "in_progress" || a === "progress" || a === "progreso" || a === "active" || a === "activa") return "in_progress";
  if (a === "pending" || a === "pendiente" || a === "pendientes") return "pending";
  if (a === "waiting" || a === "espera" || a === "blocked" || a === "bloqueada" || a === "bloqueadas") return "waiting";
  if (a === "completed" || a === "complete" || a === "done" || a === "completada" || a === "completadas" || a === "terminadas") return "completed";
  return "all";
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    reconstruct(ctx);
  });
  pi.on("session_compact", async (_event, ctx) => {
    reconstruct(ctx);
  });
  pi.on("session_tree", async (_event, ctx) => {
    reconstruct(ctx);
  });
  pi.on("session_shutdown", async () => {
    modalOpen = false;
    modalRefresh = undefined;
  });

  // Branch is stale in message_end — refresh here, reading live module state.
  // Also repaints the open modal so it stays live while visible.
  pi.on("tool_execution_end", async (event) => {
    if (event.toolName !== "todo" || event.isError) return;
    modalRefresh?.();
  });

  // Terminal-safe primary (alt combos arrive as ESC-prefix almost everywhere)
  // plus the old ctrl+shift+t as fallback where the terminal does deliver it.
  // Shortcut contexts carry the same ui surface; the cast only bridges the
  // command-context typing — the runtime guard inside openTodosModal applies.
  const openFromShortcut = async (ctx: { hasUI: boolean }) => {
    if (!ctx.hasUI || modalOpen) return;
    await openTodosModal(
      ctx as unknown as ExtensionCommandContext,
      () => tasks.filter((t) => t.status !== "deleted"),
    );
  };
  pi.registerShortcut(Key.alt("t"), {
    description: "Open the todos modal",
    handler: openFromShortcut,
  });
  pi.registerShortcut(Key.ctrlShift("t"), {
    description: "Open the todos modal (fallback)",
    handler: openFromShortcut,
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
    description: "Open the todos modal (overlay); optional filter: all | pending | waiting | in_progress | completed",
    handler: async (args, ctx) => {
      // `table`/`all` kept as aliases; legacy hide|show verbs just open it.
      const initial = parseFilterArg(args);
      await openTodosModal(ctx, () => tasks.filter((t) => t.status !== "deleted"), initial);
    },
  });
}
