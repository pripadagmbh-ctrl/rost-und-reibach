/**
 * Waechter fuer den Hoerparcours (E-159): jede Station hat eine Nummer und
 * klingt, jede kommt dreimal, die Zeile im Bild sagt, was laeuft, und am Ende
 * ist sie wieder weg.
 */
import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/events";
import { STATIONEN, WIEDERHOLUNGEN, hoerZeile, parcoursDauer, starteHoerparcours, type HoerTon } from "../src/audio/hoerparcours";

/** Uhr zum Abspielen im Test: sammelt Fristen und arbeitet sie der Zeit nach ab. */
function testUhr(): { uhr: Parameters<typeof starteHoerparcours>[3]; lauf: () => number } {
  let jetzt = 0;
  let id = 0;
  const fristen = new Map<number, { t: number; f: () => void }>();
  return {
    uhr: {
      setTimeout: (f: () => void, ms: number) => {
        fristen.set(++id, { t: jetzt + ms, f });
        return id;
      },
      clearTimeout: (i: number) => void fristen.delete(i),
    },
    lauf: () => {
      while (fristen.size) {
        const [i, n] = [...fristen.entries()].sort((a, b) => a[1].t - b[1].t || a[0] - b[0])[0]!;
        fristen.delete(i);
        jetzt = n.t;
        n.f();
      }
      return jetzt;
    },
  };
}

function tonUndBus(): { ton: HoerTon; bus: EventBus; klaenge: string[] } {
  const klaenge: string[] = [];
  const ton: HoerTon = {
    playGrab: () => klaenge.push("grab"),
    playCrash: () => klaenge.push("crash"),
    playTear: () => klaenge.push("tear"),
    playHupe: () => klaenge.push("hupe"),
    playFeierabend: () => klaenge.push("feierabend"),
    setScrape: (i) => klaenge.push(i > 0 ? "scrape" : "scrape-aus"),
  };
  const bus = new EventBus();
  const emit = bus.emit.bind(bus);
  (bus as unknown as { emit: (n: string, p: unknown) => void }).emit = (n, p) => {
    klaenge.push(n);
    emit(n as never, p as never);
  };
  return { ton, bus, klaenge };
}

describe("Hoerparcours (E-159)", () => {
  it("Stationen sind durchnummeriert und decken den Auftrag ab", () => {
    expect(STATIONEN.map((s) => s.nr)).toEqual(STATIONEN.map((_s, i) => i + 1));
    const namen = STATIONEN.map((s) => s.name).join(" | ");
    for (const muss of ["Auto auf Beton", "Auto auf Stahl", "Träger auf Beton", "Träger auf Stahl", "Alu", "Kupfer", "Edelstahl", "Blech", "Kleinteil Eisen", "Presse", "schleift über Beton", "schleift über Stahl", "Wand", "Laster", "Hämmern", "Magnet", "Hupe", "Feierabend"]) {
      expect(namen, muss).toContain(muss);
    }
    expect(WIEDERHOLUNGEN).toBe(3);
  });

  it("jede Station klingt, jede dreimal, mit Nummer im Bild — und am Ende ist die Zeile weg", () => {
    const { ton, bus, klaenge } = tonUndBus();
    const zeilen: string[] = [];
    const { uhr, lauf } = testUhr();
    starteHoerparcours(ton, bus, (z) => zeilen.push(z), uhr);
    const ende = lauf();
    for (const s of STATIONEN) {
      expect(zeilen.filter((z) => z.startsWith(`Hörprobe ${s.nr}/`)), s.name).toHaveLength(WIEDERHOLUNGEN);
    }
    expect(zeilen.at(-1)).toBe("");
    expect(klaenge.length).toBeGreaterThanOrEqual(STATIONEN.length * WIEDERHOLUNGEN);
    expect(klaenge.filter((k) => k === "scrape-aus").length).toBeGreaterThanOrEqual(2 * WIEDERHOLUNGEN); // Schleifen enden
    expect(ende / 1000).toBeCloseTo(parcoursDauer(), 0);
    console.info(`[E-159] Hoerparcours: ${STATIONEN.length} Stationen, ${(parcoursDauer() / 60).toFixed(1)} min`);
  });

  it("anhalten: nichts klingt mehr, die Zeile ist weg, das Schleifen ist aus", () => {
    const { ton, bus, klaenge } = tonUndBus();
    const zeilen: string[] = [];
    const { uhr, lauf } = testUhr();
    const stopp = starteHoerparcours(ton, bus, (z) => zeilen.push(z), uhr);
    stopp();
    const vorher = klaenge.length;
    lauf();
    expect(klaenge.length).toBe(vorher);
    expect(klaenge.at(-1)).toBe("scrape-aus");
    expect(zeilen.at(-1)).toBe("");
  });

  it("die Zeile nennt Nummer, Name und Durchgang", () => {
    expect(hoerZeile(STATIONEN[3]!, 2)).toBe(`Hörprobe 4/${STATIONEN.length} · ${STATIONEN[3]!.name} · 2/3`);
  });
});
