/**
 * EIN ABHOLER, DER KOMMT, KOMMT AUCH (45b, Konzept §6, Patrick 22.10.2026).
 *
 * Befund Montag Saat 18: BUNT + VA über der Schwelle, die Anzeige sagte
 * „Abholer kommt" — aber der Box-Abholer war nur der NÄCHSTE Verlader, und der
 * leere Misch-Verlader vorn fuhr nie. Jetzt fährt der Misch-Verlader ab, sobald
 * eine Box voll ist, und der Nachrücker kommt als Abholer dieser Box.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as THREE from "three";
import { initPhysics } from "../src/physics/physicsWorld";
import { BOX_SCHWELLE_KG } from "../src/delivery/schichtbetrieb";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { baueSchichtPlatz, festerZufall, type SchichtPlatz } from "./schichtlauf";
import type { BoxOrder } from "../src/delivery/schichtfuhrpark";

beforeAll(async () => {
  await initPhysics();
});
let zurueck: (() => void) | null = null;
afterEach(() => {
  zurueck?.();
  zurueck = null;
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

/**
 * Laufen lassen, bis `frage` wahr ist (höchstens `s` Sekunden); liefert die Zeit.
 * Alle 5 s Spielzeit Luft holen — sonst bricht Vitest mit „Timeout calling
 * onTaskUpdate" ab (dieselbe Lehre wie `kipperlauf.reiheMitLuft`, E-109).
 */
async function bis(p: SchichtPlatz, s: number, frage: () => boolean): Promise<number> {
  const t0 = p.schichtS;
  for (let i = 0; i < s * 60 && !frage(); i++) {
    p.takt();
    if (i % 300 === 299) await new Promise((r) => setTimeout(r, 0));
  }
  return p.schichtS - t0;
}

function belade(p: SchichtPlatz, kg: number, stueck: number): void {
  const bed = (p.vehicles.schichtVerlader as unknown as { bedGroup: THREE.Group }).bedGroup;
  for (let k = 0; k < stueck; k++) {
    const wo = bed.localToWorld(new THREE.Vector3(((k % 2) - 0.5) * 1.1, 0.9, 0.7 + k * 0.9));
    p.items.spawnScrap("mixed", kg / stueck, { kind: "box", dims: [0.7, 0.5, 0.7], color: 0x777777 }, wo, new THREE.Quaternion());
    for (let j = 0; j < 20; j++) p.takt();
  }
}

/** Steht vorn ein ladebereiter Abholer für diese Sorte? */
const vornFuer = (p: SchichtPlatz, o: string): boolean =>
  !!p.vehicles.schichtVerlader?.waitingForLoad && p.vehicles.schichtVerlader.bestellung === o;

describe("45b — eine volle Box ruft ihren Abholer sofort", () => {
  it("Montag Saat 18: BUNT + VA voll, Misch-Verlader leer → er fährt ohne Buchung, BUNT-Abholer in ≤ 60 s vorn", { timeout: 300_000 }, async () => {
    zurueck = festerZufall(18 * 7919 + 13);
    const box: Partial<Record<BoxOrder, number>> = { copper: 0, steel: 0, rubble: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 18, loseKg: () => 0, boxKg: box });
    await bis(p, 5, () => false);
    expect(p.vehicles.schichtVerlader?.bestellung).toBe("mixed");
    box.copper = BOX_SCHWELLE_KG.copper + 8_000; // der Befund: 9,5 t Alu in BUNT + VA
    const t = await bis(p, 60, () => vornFuer(p, "copper"));
    console.log(`BUNT voll → BUNT-Abholer ladebereit vorn nach ${t.toFixed(1)} s`);
    expect(vornFuer(p, "copper"), "kein BUNT-Abholer vorn").toBe(true);
    expect(t).toBeLessThanOrEqual(60);
    // Leer fährt er einfach: keine 0-€-Zeile an der Kasse
    expect(p.protokoll.abfahrten).toHaveLength(0);
    expect(p.protokoll.meldungen.some((m) => /Abholer für BUNT \+ VA kommt — der Verlader fährt vor/.test(m))).toBe(true);
  });

  it("ein beladener Misch-Verlader fährt mit seiner Ladung und wird gebucht; danach wieder Misch", { timeout: 300_000 }, async () => {
    zurueck = festerZufall(21);
    const box: Partial<Record<BoxOrder, number>> = { steel: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0, boxKg: box });
    belade(p, 300, 3);
    box.steel = BOX_SCHWELLE_KG.steel + 500;
    await bis(p, 10, () => p.protokoll.abfahrten.length > 0);
    expect(p.protokoll.abfahrten[0]).toMatchObject({ order: "mixed", teile: 3 });
    expect(p.protokoll.abfahrten[0]!.kg).toBeCloseTo(300, 3);
    await bis(p, 60, () => vornFuer(p, "steel"));
    expect(vornFuer(p, "steel"), "kein Stahl-Abholer vorn").toBe(true);
    // Der Spieler lädt die Box auf ihn und hupt
    belade(p, 400, 2);
    box.steel = 0;
    expect(p.vehicles.requestPickup()).toBe("abgefahren");
    await bis(p, 10, () => p.protokoll.abfahrten.length > 1);
    expect(p.protokoll.abfahrten[1]?.order).toBe("steel");
    await bis(p, 90, () => vornFuer(p, "mixed"));
    expect(vornFuer(p, "mixed"), "danach kein Misch-Verlader").toBe(true);
  });

  it("zwei volle Boxen: die vollere zuerst, dann die andere", { timeout: 400_000 }, async () => {
    zurueck = festerZufall(22);
    const box: Partial<Record<BoxOrder, number>> = { steel: 0, rubble: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0, boxKg: box });
    box.steel = BOX_SCHWELLE_KG.steel * 1.1;
    box.rubble = BOX_SCHWELLE_KG.rubble * 1.5;
    await bis(p, 60, () => vornFuer(p, "rubble"));
    expect(vornFuer(p, "rubble"), "MÜLL (×1,5) kam nicht zuerst").toBe(true);
    belade(p, 200, 1);
    box.rubble = 0;
    expect(p.vehicles.requestPickup()).toBe("abgefahren");
    await bis(p, 90, () => vornFuer(p, "steel"));
    expect(vornFuer(p, "steel"), "danach kein Stahl-Abholer").toBe(true);
  });

  it("ein leerer Box-Abholer, dessen Box nicht mehr voll ist, fährt von selbst; voll bleibt er", { timeout: 300_000 }, async () => {
    zurueck = festerZufall(23);
    const box: Partial<Record<BoxOrder, number>> = { steel: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0, boxKg: box });
    box.steel = BOX_SCHWELLE_KG.steel + 500;
    await bis(p, 60, () => vornFuer(p, "steel"));
    expect(vornFuer(p, "steel")).toBe(true);
    // Leer und Box voll: Er wartet (Gegenprobe), Hupe schickt ihn nicht leer weg
    await bis(p, 10, () => false);
    expect(vornFuer(p, "steel"), "leerer Abholer fuhr trotz voller Box").toBe(true);
    expect(p.vehicles.requestPickup()).toBe("unmoeglich");
    // Box geleert (anders als auf ihn): nichts mehr für ihn da
    box.steel = 0;
    const t = await bis(p, 10, () => !vornFuer(p, "steel"));
    expect(vornFuer(p, "steel"), "leerer Abholer blieb stehen").toBe(false);
    expect(t).toBeLessThan(5);
    await bis(p, 90, () => vornFuer(p, "mixed"));
    expect(vornFuer(p, "mixed")).toBe(true);
  });
});
