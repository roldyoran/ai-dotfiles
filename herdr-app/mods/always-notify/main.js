// always-notify: sound + toast on EVERY agent transition, even while
// watching the app (Herdr only notifies when you look away).
// Watches agents() on every render (Herdr re-renders on state change)
// and fires playSound + notify on blocked/done transitions,
// plus working -> idle (finished while watched: Herdr flips it to idle).

import { View, div } from "gpui-kit";
import { agents, notify, playSound, checking, setShared, settings } from "herdr";

const displayName = (a) => a.program?.name || a.app || "Agente";
const where = (a) => [a.space_name, a.tab_name].filter(Boolean).join(" · ");

export default class AlwaysNotify extends View {
  init(_props, cx) {
    this.last = {};
    // Heartbeat: proves the mod got instantiated (visible in shared.json).
    if (!checking()) {
      setShared("always-notify.alive", Date.now());
      // Re-evaluates every 2s in case a state change didn't trigger a render.
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
      if (prev === undefined) continue; // first time seen (e.g. on app start): register silently
      if (checking()) continue; // `herdr-app check`: nunca efectos
      if (a.status === "blocked" && prev !== "blocked") {
        this.announce(a, "blocked");
      } else if (a.status === "done" && prev !== "done") {
        this.announce(a, "done");
      } else if (a.status === "idle" && prev === "working") {
        // Finished while you were watching: Herdr doesn't notify by itself.
        this.announce(a, "done");
      }
      // done -> idle is just "you saw the toast": silence on purpose.
    }
    for (const k of Object.keys(this.last)) {
      if (!seen.has(k)) delete this.last[k];
    }
    return div().id("always-notify");
  }
}
