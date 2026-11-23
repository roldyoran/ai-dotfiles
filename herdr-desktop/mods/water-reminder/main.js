// water-reminder: reminds you to drink water every so often.
// Only runs with Herdr open (mods live in the window).
// Lightweight: a 60s timer checks whether it's time; no network, no exec.
// Respects the global mute (settings.sounds.enabled) for sound; the toast still shows.
//
// Toast design: custom blue droplet (drop.svg) instead of the generic dot,
// fixed title + rotating message, 60s on screen, own sound (sounds/cute-water.mp3).
// Clicking the toast = snooze 10 min (via water-reminder.snooze command).
// water-reminder.preview command = show one without moving the timer.

import { View, div } from "gpui-kit";
import { notify, playSound, checking, shared, setShared, settings, nextCommand } from "herdr";

// How often to remind. Change this number and save: hot-reload applies instantly.
const MINUTES = 16;
const INTERVAL = MINUTES * 60 * 1000;
const TICK = 60 * 1000;
const ICON = "mods/water-reminder/drop.svg";
const SOUND = "mods/water-reminder/sounds/cute-water.mp3";

const MESSAGES = [
  "Toma agua y estírate un poco.",
  "Toma agua y mueve los hombros.",
  "Toma agua y mira lejos 20 segundos.",
  "Toma agua y camina un minuto.",
];

export default class WaterReminder extends View {
  init(_props, cx) {
    if (checking()) return;
    // First run: schedule the first reminder.
    if (!shared("water-reminder.next")) {
      setShared("water-reminder.next", Date.now() + INTERVAL);
    }
    setShared("water-reminder.alive", Date.now());
    // Re-evaluates every minute in case no render triggered it.
    cx.timer.every(TICK, (cx) => {
      setShared("water-reminder.alive", Date.now());
      this.maybe();
      cx.notify();
    });
    // Mod commands: toast click = snooze, preview = show design without moving the timer.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (checking()) continue;
        if (c === "snooze") this.snooze(10);
        else if (c === "preview") this.fire(true);
        cx.notify();
      }
    });
  }

  soundsOn() {
    try {
      return (settings()?.sounds ?? {}).enabled !== false;
    } catch { return true; }
  }

  snooze(min) {
    if (checking()) return;
    setShared("water-reminder.next", Date.now() + min * 60 * 1000);
    setShared("water-reminder.last", { at: Date.now(), snoozed: min });
  }

  fire(preview = false) {
    if (checking()) return;
    const count = (shared("water-reminder.count") ?? 0) + (preview ? 0 : 1);
    const body = MESSAGES[count % MESSAGES.length];
    if (!preview && this.soundsOn()) playSound(SOUND);
    notify({
      title: "Toca hidratarse",
      body,
      level: "info",
      icon: ICON,
      timeout: 60000,
      action: preview ? undefined : { name: "water-reminder.snooze" },
    });
    if (!preview) {
      setShared("water-reminder.count", count);
      setShared("water-reminder.last", { at: Date.now() });
      setShared("water-reminder.next", Date.now() + INTERVAL);
    }
  }

  maybe() {
    if (checking()) return;
    const next = shared("water-reminder.next");
    if (!next) {
      setShared("water-reminder.next", Date.now() + INTERVAL);
      return;
    }
    if (Date.now() < next) return;
    this.fire(false);
  }

  render() {
    if (!checking()) this.maybe();
    return div().id("water-reminder");
  }
}
