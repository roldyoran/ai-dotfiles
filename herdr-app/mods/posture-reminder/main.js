// posture-reminder: reminds you to fix your sitting posture every so often.
// Only runs with Herdr open (mods live in the window).
// Lightweight: a 60s timer checks whether it's time; no network, no exec.
// Respects the global mute (settings.sounds.enabled) for sound; the toast still shows.
//
// Toast design: custom shrimp icon (shrimp.svg, modo gamba 🍤), fixed title
// + rotating general advice, 12s on screen, own sound (sounds/posture.mp3).
// Clicking the toast = snooze 10 min (via posture-reminder.snooze command).
// posture-reminder.preview command = show one without moving the timer.

import { View, div } from "gpui-kit";
import { notify, playSound, checking, shared, setShared, settings, nextCommand } from "herdr";

// How often to remind. Change this number and save: hot-reload applies instantly.
const MINUTES = 14;
const INTERVAL = MINUTES * 60 * 1000;
const TICK = 60 * 1000;
const ICON = "mods/posture-reminder/shrimp.svg";
const SOUND = "mods/posture-reminder/sounds/posture.mp3";

const MESSAGES = [
  "Endereza la espalda, deja de hacer el camarón 🍤.",
  "Hombros atrás y abajo, pecho abierto.",
  "Pies en el suelo, rodillas a 90°.",
  "Pantalla a la altura de los ojos, barbilla adentro.",
  "Siéntate al fondo de la silla, sin encorvarte.",
  "Cuello largo, hombros lejos de las orejas.",
  "Levántate un minuto y estira la espalda.",
  "Afloja la mandíbula y respira hondo.",
];

export default class PostureReminder extends View {
  init(_props, cx) {
    if (checking()) return;
    // First run: schedule the first reminder.
    if (!shared("posture-reminder.next")) {
      setShared("posture-reminder.next", Date.now() + INTERVAL);
    }
    setShared("posture-reminder.alive", Date.now());
    // Re-evaluates every minute in case no render triggered it.
    cx.timer.every(TICK, (cx) => {
      setShared("posture-reminder.alive", Date.now());
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
    setShared("posture-reminder.next", Date.now() + min * 60 * 1000);
    setShared("posture-reminder.last", { at: Date.now(), snoozed: min });
  }

  fire(preview = false) {
    if (checking()) return;
    const count = (shared("posture-reminder.count") ?? 0) + (preview ? 0 : 1);
    const body = MESSAGES[count % MESSAGES.length];
    if (!preview && this.soundsOn()) playSound(SOUND);
    notify({
      title: "Corrige tu postura",
      body,
      level: "info",
      icon: ICON,
      timeout: 12000,
      action: preview ? undefined : { name: "posture-reminder.snooze" },
    });
    if (!preview) {
      setShared("posture-reminder.count", count);
      setShared("posture-reminder.last", { at: Date.now() });
      setShared("posture-reminder.next", Date.now() + INTERVAL);
    }
  }

  maybe() {
    if (checking()) return;
    const next = shared("posture-reminder.next");
    if (!next) {
      setShared("posture-reminder.next", Date.now() + INTERVAL);
      return;
    }
    if (Date.now() < next) return;
    this.fire(false);
  }

  render() {
    if (!checking()) this.maybe();
    return div().id("posture-reminder");
  }
}
