// water-reminder: te avisa cada cierto tiempo para tomar agua.
// Solo corre con Herdr abierto (los mods viven en la ventana).
// Liviano: un timer cada 60s revisa si ya toca; sin red, sin exec.
// Respeta el mute global (settings.sounds.enabled) para el sonido; el toast igual sale.
//
// Diseño del aviso: gota azul propia (drop.svg) en vez del punto genérico,
// título fijo + mensaje rotativo con racha (vaso n.º), 60s en pantalla.
// Clic en el aviso = posponer 10 min (vía comando water-reminder.snooze).
// Comando water-reminder.preview = mostrar un aviso sin mover el timer.

import { View, div } from "gpui-kit";
import { notify, playSound, checking, shared, setShared, settings, nextCommand } from "herdr";

// Cada cuánto avisar. Cambia este número y guarda: hot-reload aplica al instante.
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
    // Primera vez: programa el primer aviso.
    if (!shared("water-reminder.next")) {
      setShared("water-reminder.next", Date.now() + INTERVAL);
    }
    setShared("water-reminder.alive", Date.now());
    // Re-evalúa cada minuto por si ningún render lo disparó.
    cx.timer.every(TICK, (cx) => {
      setShared("water-reminder.alive", Date.now());
      this.maybe();
      cx.notify();
    });
    // Comandos del mod: clic en el aviso = snooze, preview = ver diseño sin mover el timer.
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
      body: `${body}`,
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
