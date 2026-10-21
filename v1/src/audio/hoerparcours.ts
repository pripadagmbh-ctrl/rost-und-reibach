/**
 * HÖRPARCOURS (E-159, Auftrag 18.10.2026): Patrick hört jeden wichtigen Klang
 * nacheinander, je dreimal, mit Nummer und Namen im Bild — und vergibt Noten
 * 1–5 in `docs/messungen/hoerparcours.md`. So wird „klingt kindlich" zu einer
 * Liste, an der man arbeiten kann.
 *
 * Alles geht über dieselben Wege wie im Spiel (Bus-Ereignisse und die
 * öffentlichen Aufrufe des AudioManagers) — man hört genau das, was das Spiel
 * spielt, nicht eine Vorführfassung.
 */
import type { EventBus } from "../core/events";
import type { Untergrund } from "./klangregeln";

/** Was der Parcours vom Ton braucht. */
export interface HoerTon {
  playGrab(materialId?: string): void;
  playCrash(strength?: number): void;
  playTear(): void;
  playHupe(): void;
  playFeierabend(): void;
  setScrape(intensity: number, untergrund?: Untergrund): void;
}

/** Eine Station: spielt einmal und sagt, wie lange (s) sie dauert. */
export interface Station {
  nr: number;
  name: string;
  /** Dauer eines Durchgangs in s (danach kommt die Pause) */
  dauer: number;
  spiele(ton: HoerTon, bus: EventBus, nachher: (s: number, f: () => void) => void): void;
}

/** Wiederholungen je Station und Pause dazwischen (s). SW. */
export const WIEDERHOLUNGEN = 3;
export const PAUSE_S = 0.8;

const aufprall = (bus: EventBus, materialId: string, massKg: number, untergrund: Untergrund, blech = false): void =>
  bus.emit("schrott:aufprall", { materialId, massKg, wucht: 6, blech, untergrund, x: 0, y: 0, z: 0 });

/** Ein Vorgang, der jedes Bild etwas setzt (Schleifen): alle 1/30 s, `dauer` s lang. */
const jedesBild = (nachher: (s: number, f: () => void) => void, dauer: number, f: (t: number) => void, ende: () => void): void => {
  const schritt = 1 / 30;
  for (let t = 0; t < dauer; t += schritt) nachher(t, () => f(t));
  nachher(dauer, ende);
};

let n = 0;
const st = (name: string, dauer: number, spiele: Station["spiele"]): Station => ({ nr: ++n, name, dauer, spiele });

export const STATIONEN: readonly Station[] = [
  st("Auto auf Beton", 1.5, (_t, bus) => aufprall(bus, "steel", 900, "beton", true)),
  st("Auto auf Stahl (Ladefläche)", 2.2, (_t, bus) => aufprall(bus, "steel", 900, "stahl", true)),
  st("Auto fällt und knautscht", 2.5, (_t, bus) =>
    bus.emit("wrack:geknautscht", { handle: 1, grad: 0.3, zuwachs: 0.25, x: 0, y: 0, z: 0 })
  ),
  st("Träger auf Beton", 1.5, (_t, bus) => aufprall(bus, "steel", 400, "beton")),
  st("Träger auf Stahl (Ladefläche)", 2.5, (_t, bus) => aufprall(bus, "steel", 400, "stahl")),
  st("Alu auf Beton", 1, (_t, bus) => aufprall(bus, "alu", 15, "beton")),
  st("Kupfer auf Beton", 1, (_t, bus) => aufprall(bus, "copper", 20, "beton")),
  st("Edelstahl auf Beton", 1.6, (_t, bus) => aufprall(bus, "va", 30, "beton")),
  st("Blech auf Beton", 1, (_t, bus) => aufprall(bus, "steel", 25, "beton", true)),
  st("Kleinteil Eisen auf Beton", 1.2, (_t, bus) => aufprall(bus, "steel", 8, "beton")),
  st("Presse (5 s)", 5.5, (ton, bus, nachher) => {
    ton.playGrab(); // Hydraulik laeuft an
    nachher(0.8, () => ton.playCrash(0.6)); // Klappen schlagen zu
    for (let i = 0; i < 4; i++) {
      nachher(1.5 + i * 0.9, () =>
        bus.emit("wrack:geknautscht", { handle: 1, grad: 0.2 * (i + 1), zuwachs: 0.2, x: 0, y: 0, z: 0 })
      );
    }
    nachher(5, () => {
      ton.playCrash(1);
      ton.playTear();
    });
  }),
  st("Spinne schleift über Beton", 2.2, (ton, _b, nachher) =>
    jedesBild(nachher, 2, () => ton.setScrape(0.7, "beton"), () => ton.setScrape(0))
  ),
  st("Spinne schleift über Stahl", 2.2, (ton, _b, nachher) =>
    jedesBild(nachher, 2, () => ton.setScrape(0.7, "stahl"), () => ton.setScrape(0))
  ),
  st("Spinne schlägt an die Wand", 1.2, (_t, bus) =>
    bus.emit("spinne:aufschlag", { wucht: 1, untergrund: "beton", x: 0, y: 0, z: 0 })
  ),
  st("Spinne schlägt an den Laster", 2.2, (_t, bus) =>
    bus.emit("spinne:aufschlag", { wucht: 1, untergrund: "stahl", x: 0, y: 0, z: 0 })
  ),
  st("Hämmern und Drücken aufs Wrack", 2.5, (_t, bus, nachher) => {
    bus.emit("spinne:aufschlag", { wucht: 1, untergrund: "wrack", x: 0, y: 0, z: 0 });
    for (let i = 0; i < 6; i++) {
      nachher(0.7 + i * 0.25, () => bus.emit("spinne:druecken", { staerke: 0.8, untergrund: "wrack", x: 0, y: 0, z: 0 }));
    }
  }),
  st("Magnet an, Teil klonkt, Magnet aus", 2.5, (_t, bus, nachher) => {
    bus.emit("magnet:an", {});
    nachher(0.6, () => bus.emit("magnet:haftet", { massKg: 200 }));
    nachher(1.6, () => bus.emit("magnet:aus", {}));
  }),
  st("Hupe", 1.8, (ton) => ton.playHupe()),
  st("Feierabend", 5.2, (ton) => ton.playFeierabend()),
];

/** Kopfzeile im Bild: „Hörprobe 4/19 · Träger auf Beton · 2/3". */
export function hoerZeile(s: Station, durchgang: number): string {
  return `Hörprobe ${s.nr}/${STATIONEN.length} · ${s.name} · ${durchgang}/${WIEDERHOLUNGEN}`;
}

/**
 * Den Parcours abspielen. `zeige(text)` setzt die Zeile im Bild (leer = weg).
 * Liefert eine Stopp-Funktion. Zeitgeber: `window.setTimeout` — im Test
 * ersetzbar.
 */
export function starteHoerparcours(
  ton: HoerTon,
  bus: EventBus,
  zeige: (text: string) => void,
  uhr: { setTimeout: (f: () => void, ms: number) => number; clearTimeout: (id: number) => void } = window
): () => void {
  const offen: number[] = [];
  let t0 = 0;
  const um = (s: number, f: () => void): void => {
    offen.push(uhr.setTimeout(f, Math.round(s * 1000)));
  };
  for (const s of STATIONEN) {
    for (let d = 1; d <= WIEDERHOLUNGEN; d++) {
      const ab = t0;
      um(ab, () => zeige(hoerZeile(s, d)));
      // `nachher` zaehlt ab dem Start des Durchgangs (der Rueckruf laeuft ja erst dann)
      um(ab, () => s.spiele(ton, bus, um));
      t0 += s.dauer + PAUSE_S;
    }
    t0 += PAUSE_S; // zwischen den Stationen etwas laenger
  }
  um(t0, () => zeige(""));
  return () => {
    for (const id of offen) uhr.clearTimeout(id);
    ton.setScrape(0);
    zeige("");
  };
}

/** Gesamtdauer des Parcours (s). */
export function parcoursDauer(): number {
  return STATIONEN.reduce((a, s) => a + WIEDERHOLUNGEN * (s.dauer + PAUSE_S) + PAUSE_S, 0);
}
