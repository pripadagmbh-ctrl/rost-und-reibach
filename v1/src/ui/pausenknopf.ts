/**
 * DER ⏸-KNOPF NEBEN ☰ (Auftrag 43a, Patrick 22.10.2026: „eigener ⏸-Knopf
 * neben ☰ + Ton aus — friert alles ein, auch alle Töne; großes ▶ in der
 * Mitte setzt fort").
 *
 *  - ⏸ (`#btn-halt`, index.html — `btn-pause` ist der PAUSE-Eintrag im Kranz) sendet `spiel:pause { art: "still" }`.
 *    main.ts friert ein (wie im ☰-Menue, nur ohne Menue) und laesst alle
 *    Sticks und Pedale los; `audio/audioManager.ts` wird still.
 *  - Das ▶-Feld (`#weiterfeld`, ganzes Bild) erscheint nur bei "still" — beim
 *    ☰-Menue ("menue") hat das Menue seinen eigenen WEITER-Knopf.
 *  - Tipp aufs Feld sendet `spiel:weiter`; JEDES `spiel:weiter` blendet es aus,
 *    auch wenn ESC/P am Rechner fortsetzt.
 *
 * Kein sichtbarer Text, nur Zeichen; der Vorlesetext (aria-label) folgt der
 * Sprache. Haengt nur am Bus (Regel 10).
 */
import type { EventBus } from "../core/events";
import { sprache, waehle } from "../challenges/texte";
import { wort } from "./aufgabentexte";
import { tippKnopf } from "./challengekarte";

const WEITER = { de: "Weiter", en: "Resume" };

export interface Pausenknopf {
  /** Nach einem Sprachwechsel (der Bauleiter haengt es an die Sprachwahl). */
  neuBeschriften(): void;
}

export function installPausenknopf(m: { bus: EventBus }): Pausenknopf {
  const knopf = document.getElementById("btn-halt");
  const feld = document.getElementById("weiterfeld");
  if (!knopf || !feld) return { neuBeschriften() {} };

  const beschrifte = (): void => {
    const s = sprache();
    knopf.setAttribute("aria-label", wort("pause", s));
    feld.setAttribute("aria-label", waehle(WEITER, s));
  };
  beschrifte();

  tippKnopf(knopf, () => m.bus.emit("spiel:pause", { art: "still" }));
  tippKnopf(feld, () => {
    if (!feld.hidden) m.bus.emit("spiel:weiter", {});
  });

  m.bus.on("spiel:pause", (e) => {
    beschrifte();
    feld.hidden = e.art !== "still";
  });
  m.bus.on("spiel:weiter", () => {
    feld.hidden = true;
  });

  return { neuBeschriften: beschrifte };
}
