/**
 * SANDKASTEN-REKORDE (E-195) — hängen nur am Bus (Regel 10), messen nichts
 * selbst. main.ts installiert sie nur im Sandkasten; eine Sitzung ist ein
 * Start bis zum Neuladen bzw. Menü (neue Instanz = neue Sitzung).
 *
 *  - sortiertKg   richtig einsortierte Masse dieser Sitzung
 *  - quoteBp      Anteil richtig nach Masse, erst ab `QUOTE_AB_KG`
 *  - ausweidenHs  erster `wrack:abriss` an einem Wrack bis `rest === 0`
 *
 * Nicht dabei: der weiteste Wurf. `fahrkunst:zyklus.wurfweiteM` misst vom
 * Loslassen bis zum Liegen — Rollen, Rutschen und Wegschieben zählen mit,
 * und ein Wrack, das nie einschläft, wird erst beim nächsten Griff gemessen.
 *
 * WER HAT ES HINEINGETAN? `itemEntered` sagt das nicht: Auch der Kipper
 * kippt sortenrein ins Lagersilo (E-178), und beim Laden eines Stands zählt
 * der Platz alle Boxen neu. Gezählt wird darum nur, was binnen
 * `WURF_FENSTER_S` Spielzeit nach einem `released` hineinfällt.
 * ponytail: Zeitfenster statt Teile-Kennung — ein Kipper, der genau dann
 * kippt, zählt mit. Sauber wird es mit `released.itemIds` (Rückfrage E-195).
 *
 * Je `itemId` zählt der LETZTE Einwurf (Nachsortieren ist erlaubt), nie zwei.
 * `itemLeft` nimmt nichts zurück: Holt der Abholer die Box ab, war die
 * Arbeit trotzdem getan.
 *
 * Die Zeit ist Spielzeit: `takt(dt)` ruft main.ts je Bild AUSSERHALB der
 * Pause. Vor dem ersten Takt (Laden der Welt) zählt nichts — ein Wrack, das
 * dabei schon Teile verliert, ist vorbelastet und zählt die ganze Sitzung nicht.
 */
import type { EventBus } from "./events";
import { merkeRekord, type RekordId } from "./bestenliste";

// SW: 1 t — sonst ist ein einziger Treffer schon 100 %; rund 10–20 Teile
export const QUOTE_AB_KG = 1000;
// SW: 4 s — ein Wurf über 8 m fliegt gut 1 s, dazu Rollen in die Box
export const WURF_FENSTER_S = 4;

export interface SandkastenRekorde {
  /** Je Bild außerhalb der Pause, mit derselben dt wie die Simulation. */
  takt(dt: number): void;
}

export function installSandkastenRekorde(
  bus: EventBus,
  merke: (id: RekordId, wert: number) => boolean = merkeRekord
): SandkastenRekorde {
  let zeit = 0;
  let losgelassen = -Infinity;
  const teile = new Map<string, { kg: number; richtig: boolean }>();
  const wrackStart = new Map<number, number>();
  const vorbelastet = new Set<number>();

  bus.on("released", () => {
    losgelassen = zeit;
  });
  bus.on("itemEntered", (e) => {
    if (zeit === 0 || e.massKg === undefined || zeit - losgelassen > WURF_FENSTER_S) return;
    teile.set(e.itemId, { kg: e.massKg, richtig: e.correct });
    let richtig = 0;
    let alle = 0;
    for (const t of teile.values()) {
      alle += t.kg;
      if (t.richtig) richtig += t.kg;
    }
    if (richtig > 0) merke("sortiertKg", Math.round(richtig));
    if (alle >= QUOTE_AB_KG) merke("quoteBp", Math.round((richtig / alle) * 10000));
  });
  bus.on("wrack:abriss", (e) => {
    if (zeit === 0) {
      vorbelastet.add(e.handle);
      return;
    }
    if (vorbelastet.has(e.handle)) return;
    // Die Uhr läuft ab dem ersten Eingriff — auch „Haube springt auf"
    const start = wrackStart.get(e.handle) ?? zeit;
    wrackStart.set(e.handle, start);
    if (e.art === "ab" && e.rest === 0) {
      wrackStart.delete(e.handle);
      vorbelastet.add(e.handle); // ein zweites Mal gibt es nicht
      if (zeit > start) merke("ausweidenHs", Math.round((zeit - start) * 100));
    }
  });

  return {
    takt(dt: number): void {
      zeit += dt;
    },
  };
}
