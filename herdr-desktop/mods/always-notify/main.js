// always-notify: suena y avisa SIEMPRE que un agente termina o te necesita,
// incluso cuando estás mirando la app (Herdr solo avisa cuando no miras).
// Vigila agents() en cada render (Herdr re-renderiza al cambiar de estado)
// y dispara playSound + notify en transiciones a blocked/done,
// más working -> idle (terminó mientras mirabas: Herdr lo pone idle directo).

import { View, div } from "gpui-kit";
import { agents, notify, playSound, checking, setShared, settings } from "herdr";

const displayName = (a) => a.program?.name || a.app || "Agente";
const where = (a) => [a.space_name, a.tab_name].filter(Boolean).join(" · ");

export default class AlwaysNotify extends View {
  init(_props, cx) {
    this.last = {};
    // Heartbeat: demuestra que el mod llegó a instanciarse (visible en shared.json).
    if (!checking()) {
      setShared("always-notify.alive", Date.now());
      // Re-evalúa cada 2s por si un cambio de estado no disparó render.
      cx.timer.every(2000, (cx) => {
        setShared("always-notify.alive", Date.now());
        cx.notify();
      });
    }
  }

  soundsOn() {
    try {
      const s = settings()?.sounds ?? {};
      return s.enabled !== false;
    } catch { return true; }
  }

  announce(a, kind) {
    const name = displayName(a);
    const body = where(a) || a.title || "";
    if (!checking()) {
      setShared("always-notify.last", { kind, address: a.address, name, at: Date.now() });
    }
    if (kind === "blocked") {
      if (this.soundsOn()) playSound("blocked");
      notify({
        title: `${name} te necesita`,
        body,
        level: "error",
        action: { name: "agent.focus", args: { terminal: a.address } },
      });
    } else {
      if (this.soundsOn()) playSound("done");
      notify({
        title: `${name} terminó`,
        body,
        level: "success",
        action: { name: "agent.focus", args: { terminal: a.address } },
      });
    }
  }

  render() {
    const list = agents() ?? [];
    const seen = new Set();
    for (const a of list) {
      seen.add(a.address);
      const prev = this.last[a.address];
      this.last[a.address] = a.status;
      if (prev === undefined) continue; // primera vez visto (p. ej. al abrir la app): registrar sin ruido
      if (checking()) continue; // `herdr-app check`: nunca efectos
      if (a.status === "blocked" && prev !== "blocked") {
        this.announce(a, "blocked");
      } else if (a.status === "done" && prev !== "done") {
        this.announce(a, "done");
      } else if (a.status === "idle" && prev === "working") {
        // Terminó mientras lo mirabas: Herdr no avisa por sí mismo.
        this.announce(a, "done");
      }
      // done -> idle es solo "miraste el toast": silencio a propósito.
    }
    for (const k of Object.keys(this.last)) {
      if (!seen.has(k)) delete this.last[k];
    }
    return div().id("always-notify");
  }
}
