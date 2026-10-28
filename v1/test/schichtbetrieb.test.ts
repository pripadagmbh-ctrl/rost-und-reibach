/**
 * E-202 — SCHICHT-FAHRPLAN, VERLADER, BOX-ABHOLER, SILO-PRITSCHE, STANDZEIT.
 *
 * Patrick, 21.10.2026: Schicht gewählt → 06:00, der Verlader steht schon vor
 * dem Bagger; Misch-Fuhren nach Fahrplan an die Annahme; voll oder angehupt
 * fährt der Verlader, der nächste rückt von der Nordmauer nach; eine volle
 * Box ruft einen Abholer ihrer Sorte; selten wartet eine sortenreine Pritsche
 * am Lager; wer Laster warten lässt, zahlt Standgeld.
 *
 * Der Fahrplan ist kopflos geprüft, alles andere mit echter Physik auf dem
 * Schicht-Platz (`test/schichtlauf.ts`, derselbe Prüfstand wie
 * `tools/schicht-lauf.ts`).
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  fahrplan,
  mischZeiten,
  STUFEN,
  SPITZE_S,
  SPITZE_ABSTAND_S,
  WELLE1_ENDE_S,
  FRUEHSTUECK_ENDE_S,
  SORTENREIN_SORTEN,
} from "../src/economy/schichtplan";
import { SCHICHTSTUFEN, standgeldSekunden } from "../src/economy/kasse";
import { SCHICHT_TORSCHLUSS_S, SCHICHT_FEIERABEND_S } from "../src/world/schichtzeit";
import { naechsteOrder, BOX_SCHWELLE_KG, ANNAHME_ZU_KG, ANNAHME_AUF_KG } from "../src/delivery/schichtbetrieb";
import { NACHRUECK_SLOT, kassenTeilAus, boxFuer, nachVornHindernisse, verladerVomWarteplatz, warteplatzZugVonWaage } from "../src/delivery/schichtfuhrpark";
import { VERLADER_VORN, verladeHaltFuer, planHindernisse } from "../src/delivery/routes";
import { bahnTiefe } from "../src/delivery/rangierplan";
import { lagerMuldeFuer } from "../src/world/containers";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { boxUeberlappung } from "../src/delivery/umriss";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN } from "../src/world/baggerstand";
import { ABSETZMULDE } from "../src/delivery/fuellgrad";
import { baueSchichtPlatz, festerZufall, TestFahrer, lagerSorten, DT, type SchichtPlatz } from "./schichtlauf";

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

/* ================================================================ Fahrplan */

describe("E-202 — der Fahrplan je Stufe", () => {
  it("Torschluss kommt aus der einen Uhr: 540 s, Feierabend 600 s", () => {
    expect(SCHICHT_TORSCHLUSS_S).toBeCloseTo(540, 6);
    expect(SCHICHT_FEIERABEND_S).toBeCloseTo(600, 6);
  });

  it("Anzahl je Stufe: Montag 4 Misch, Mittwoch 5 + 1 sortenrein, Freitag 5 + 2 — für jede Saat", () => {
    const soll = { montag: [4, 0], mittwoch: [5, 1], freitag: [5, 2] } as const;
    for (const st of SCHICHTSTUFEN) {
      for (let saat = 1; saat <= 30; saat++) {
        const p = fahrplan(st, saat);
        expect(p.filter((f) => f.art === "misch").length, `${st} Saat ${saat}`).toBe(soll[st][0]);
        expect(p.filter((f) => f.art === "sortenrein").length, `${st} Saat ${saat}`).toBe(soll[st][1]);
        expect(STUFEN[st].sortenrein).toBe(soll[st][1]);
      }
    }
  });

  it("nichts nach Torschluss, die erste um 06:00, sortiert nach Zeit", () => {
    for (const st of SCHICHTSTUFEN) {
      for (let saat = 1; saat <= 30; saat++) {
        const p = fahrplan(st, saat);
        expect(Math.max(...p.map((f) => f.tS))).toBeLessThanOrEqual(SCHICHT_TORSCHLUSS_S);
        expect(p[0]!.tS).toBe(0);
        for (let i = 1; i < p.length; i++) expect(p[i]!.tS).toBeGreaterThanOrEqual(p[i - 1]!.tS);
      }
    }
  });

  it("Wellen: Grundtakt in Welle 1, halber Takt im Frühstück, Spitze um 300 s mit zwei Fuhren", () => {
    for (const st of SCHICHTSTUFEN) {
      const t = STUFEN[st].grundtaktS;
      const z = mischZeiten(t);
      // Welle 1: Abstand = Grundtakt
      const w1 = z.filter((x) => x < WELLE1_ENDE_S);
      for (let i = 1; i < w1.length; i++) expect(w1[i]! - w1[i - 1]!).toBeCloseTo(t, 0);
      // Frühstück: höchstens eine Fuhre (60 s bei halbem Takt ≤ eine)
      expect(z.filter((x) => x >= WELLE1_ENDE_S && x < FRUEHSTUECK_ENDE_S).length).toBeLessThanOrEqual(1);
      // Spitze: zwei direkt hintereinander
      expect(z).toContain(SPITZE_S);
      expect(z).toContain(SPITZE_S + SPITZE_ABSTAND_S);
    }
    // Gegenprobe: ohne das Frühstück käme die zweite Fuhre am Montag schon bei 200 s
    expect(mischZeiten(200)[1]).toBe(220);
  });

  it("Fahrzeuge: Montag nur Kipper, Mittwoch mit Pritsche, Freitag mit Pritsche und Absetzkipper", () => {
    for (let saat = 1; saat <= 30; saat++) {
      const mo = fahrplan("montag", saat).filter((f) => f.art === "misch");
      expect(new Set(mo.map((f) => f.fahrzeug))).toEqual(new Set(["kipper"]));
      const mi = fahrplan("mittwoch", saat).filter((f) => f.art === "misch").map((f) => f.fahrzeug);
      expect(mi).toContain("pritsche");
      expect(mi).not.toContain("absetzer");
      const fr = fahrplan("freitag", saat).filter((f) => f.art === "misch").map((f) => f.fahrzeug);
      expect(fr).toContain("pritsche");
      expect(fr).toContain("absetzer");
    }
  });

  it("sortenrein: Pritsche mit einer Sorte, deren Lagersilo es gibt; zwei verschiedene am Freitag", () => {
    for (let saat = 1; saat <= 30; saat++) {
      for (const st of ["mittwoch", "freitag"] as const) {
        const rein = fahrplan(st, saat).filter((f) => f.art === "sortenrein");
        for (const f of rein) {
          expect(f.fahrzeug).toBe("pritsche");
          expect(lagerMuldeFuer(f.sorte!), `${f.sorte} hat kein Lager`).not.toBeNull();
        }
        expect(new Set(rein.map((f) => f.sorte)).size).toBe(rein.length);
      }
    }
  });

  it("gleiche Saat → gleicher Plan, andere Saat → anderer Freitag", () => {
    expect(fahrplan("freitag", 7)).toEqual(fahrplan("freitag", 7));
    const verschieden = new Set(Array.from({ length: 10 }, (_, s) => JSON.stringify(fahrplan("freitag", s + 1))));
    expect(verschieden.size).toBeGreaterThan(1);
  });

  it("Wächter: die sortenreinen Sorten sind genau die Metall-Lagersilos (keine zweite Liste, E-094)", () => {
    expect([...SORTENREIN_SORTEN].sort()).toEqual(lagerSorten().filter((s) => s !== "rubble").sort());
  });

  it("Wächter: Fahrplan und Schicht-Zeit sind rein — kein three.js, kein DOM", () => {
    const lies = (p: string): string => readFileSync(resolve(__dirname, "..", p), "utf8");
    const importe = (t: string): string[] => [...t.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    expect(importe(lies("src/economy/schichtplan.ts")).sort()).toEqual(["../world/schichtzeit", "./kasse"]);
    expect(importe(lies("src/world/schichtzeit.ts"))).toEqual([]);
    expect(lies("src/economy/schichtplan.ts")).not.toMatch(/document|window\./);
  });
});

/* ============================================================== Disponent */

describe("E-202 — welche Sorte der nächste Verlader holt", () => {
  it("unter allen Schwellen: Misch; eine Box darüber: ihre Sorte; zwei: die weiter darüber", () => {
    const leer = { steel: 0, copper: 0, rubble: 0 };
    expect(naechsteOrder((o) => leer[o])).toBe("mixed");
    expect(naechsteOrder((o) => ({ ...leer, steel: BOX_SCHWELLE_KG.steel - 1 })[o])).toBe("mixed");
    expect(naechsteOrder((o) => ({ ...leer, steel: BOX_SCHWELLE_KG.steel })[o])).toBe("steel");
    expect(naechsteOrder((o) => ({ ...leer, steel: 6_500, copper: 2_400 })[o])).toBe("copper");
    expect(naechsteOrder((o) => ({ ...leer, rubble: 3_100 })[o])).toBe("rubble");
  });

  it("die Boxen der Schicht: STAHL, BUNT + VA, MÜLL-Halde (aus CONFIGS gesucht)", () => {
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 });
    expect(p).toBeTruthy();
    expect(boxFuer("steel").id).toBe("c_steel");
    expect(boxFuer("copper").id).toBe("r_bunt");
    expect(boxFuer("rubble").id).toBe("c_mixed");
  });

  it("Kassenteile: Presspaket nach Fraktionsmix, Platzinventar 0 kg, Stückliste geht nicht an die Kasse", () => {
    expect(kassenTeilAus({ materialId: "steel", massKg: 120 })).toEqual({ materialId: "steel", massKg: 120 });
    // Waschmaschine: Stückliste (composition) bleibt draußen, sie zählt nach ihrer Fraktion
    expect(
      kassenTeilAus({ materialId: "mixed", massKg: 60, composition: [{ materialId: "steel", massKg: 49 }, { materialId: "plastic", massKg: 11 }] })
    ).toEqual({ materialId: "mixed", massKg: 60 });
    expect(
      kassenTeilAus({
        materialId: "mixed",
        massKg: 300,
        composition: [{ materialId: "steel", massKg: 300 }],
        fraktionsmix: [{ materialId: "copper", massKg: 100 }, { materialId: "brass", massKg: 200 }],
      })
    ).toEqual({ materialId: "mixed", massKg: 300, zusammensetzung: [{ materialId: "copper", massKg: 100 }, { materialId: "brass", massKg: 200 }] });
    expect(
      kassenTeilAus({ materialId: "steel", massKg: 14, composition: [{ materialId: "steel", massKg: 0 }], shape: { kind: "box", dims: [1, 1, 1], color: 0, inventar: "besen" } })
    ).toEqual({ materialId: "steel", massKg: 0 });
  });
});

/* ================================================================== Wege */

describe("E-202 — die neuen Fahrten des Nachrückers sind frei", () => {
  it("Waage → Warteplatz an der Nordmauer und Warteplatz → Verladeplatz vorn: geplant ohne Berührung", () => {
    baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 }); // schaltet den Schicht-Platz ein
    expect(NACHRUECK_SLOT).toEqual([-0.3, 23]);
    const lagen = (pts: ReadonlyArray<readonly [number, number]>): Array<{ x: number; z: number; gier: number }> =>
      pts.slice(0, -1).map((p, i) => ({ x: p[0], z: p[1], gier: Math.atan2(pts[i + 1]![0] - p[0], pts[i + 1]![1] - p[1]) }));
    const vorn = verladerVomWarteplatz();
    expect(vorn.wahl).not.toMatch(/kein/i);
    expect(bahnTiefe(lagen(vorn.anfahrt), nachVornHindernisse())).toBe(0);
    const ein = warteplatzZugVonWaage();
    expect(bahnTiefe(lagen(ein.anfahrt), planHindernisse(NACHRUECK_SLOT))).toBe(0);
  });
});

/* ======================================================= Mit echter Physik */

/** Laufen lassen, bis `frage` wahr ist (höchstens `s` Sekunden); liefert die Zeit. */
function bis(p: SchichtPlatz, s: number, frage: () => boolean, fahrer?: TestFahrer): number {
  const t0 = p.schichtS;
  for (let i = 0; i < s * 60 && !frage(); i++) {
    p.takt();
    fahrer?.schritt(DT);
  }
  return p.schichtS - t0;
}

/** Schwere Kisten auf die Fläche des Verladers legen — zusammen `kg`. */
function belade(p: SchichtPlatz, kg: number, stueck = 10): number {
  const v = p.vehicles.schichtVerlader!;
  const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
  let summe = 0;
  for (let k = 0; k < stueck; k++) {
    const wo = bed.localToWorld(new THREE.Vector3(((k % 2) - 0.5) * 1.1, 0.9 + Math.floor(k / 6) * 0.7, 0.7 + ((k % 6) / 5) * 4.0));
    const it = p.items.spawnScrap("mixed", kg / stueck, { kind: "box", dims: [0.7, 0.5, 0.7], color: 0x777777 }, wo, new THREE.Quaternion());
    summe += it.massKg;
    for (let j = 0; j < 20; j++) p.takt();
  }
  return summe;
}

describe("E-202 — der Verlader vorn", () => {
  it("steht zur Schicht schon am Halt, der Nachrücker an der Nordmauer", () => {
    zurueck = festerZufall(11);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 });
    const v = p.vehicles.schichtVerlader!;
    expect(v.waitingForLoad).toBe(true);
    expect(Math.hypot(v.group.position.x - VERLADER_VORN.x, v.group.position.z - VERLADER_VORN.z)).toBeLessThan(0.05);
    expect(v.bestellung).toBe("mixed");
    expect(v.kind).toBe("abholer"); // Abroller 34 m³
    p.takt();
    const n = p.vehicles.schichtNachruecker!;
    expect(n.wartetAufRuf).toBe(true);
    expect(Math.hypot(n.group.position.x - NACHRUECK_SLOT[0], n.group.position.z - NACHRUECK_SLOT[1])).toBeLessThan(0.05);
    // Rapier-Lehre: Die Körper stehen schon im ersten Schritt dort, nicht am Tor
    for (let i = 0; i < 30; i++) p.takt();
    expect(Math.hypot(v.group.position.x - VERLADER_VORN.x, v.group.position.z - VERLADER_VORN.z)).toBeLessThan(0.05);
  });

  it("voll → fährt los, meldet seine Teile genau, der Nachrücker steht in ≤ 40 s am Halt", { timeout: 300_000 }, () => {
    zurueck = festerZufall(12);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 });
    // Der Kipper um 06:00 soll hier nicht stören: Er darf kommen, aber wir laden nur den Verlader
    const kg = belade(p, 9_000);
    const dauer = bis(p, 30, () => p.protokoll.abfahrten.length > 0);
    expect(p.protokoll.abfahrten.length, "voll, aber nicht losgefahren").toBe(1);
    expect(dauer).toBeLessThan(10); // 3 s ruhig (E-120) plus Setzen
    const a = p.protokoll.abfahrten[0]!;
    expect(a.order).toBe("mixed");
    expect(a.teile).toBe(10);
    expect(a.kg).toBeCloseTo(kg, 3);
    const lueck = bis(p, 60, () => !!p.vehicles.schichtVerlader?.waitingForLoad);
    expect(p.vehicles.schichtVerlader?.waitingForLoad, "kein Nachrücker am Halt").toBe(true);
    expect(lueck, "Lücke zu lang").toBeLessThanOrEqual(40);
    const n = p.vehicles.schichtVerlader!;
    expect(Math.hypot(n.group.position.x - VERLADER_VORN.x, n.group.position.z - VERLADER_VORN.z)).toBeLessThan(0.5);
    console.log(`Verlader voll ab nach ${dauer.toFixed(1)} s, Nachrücker am Halt nach ${lueck.toFixed(1)} s`);
    // Und ein neuer Nachrücker kommt durchs Tor auf den Warteplatz
    bis(p, 120, () => !!p.vehicles.schichtNachruecker?.wartetAufRuf);
    expect(p.vehicles.schichtNachruecker?.wartetAufRuf, "der nächste hat den Warteplatz nicht erreicht").toBe(true);
  });

  it("Hupe/ABHOLEN: leer bleibt er, ab 1 kg fährt er", { timeout: 120_000 }, () => {
    zurueck = festerZufall(13);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 });
    expect(p.vehicles.requestPickup()).toBe("unmoeglich");
    belade(p, 120, 1);
    expect(p.vehicles.requestPickup()).toBe("abgefahren");
    bis(p, 10, () => p.protokoll.abfahrten.length > 0);
    expect(p.protokoll.abfahrten[0]?.kg).toBeCloseTo(120, 3);
  });

  it("eine Box über ihrer Schwelle → der Nachrücker kommt für ihre Sorte", { timeout: 300_000 }, () => {
    zurueck = festerZufall(14);
    const box = { steel: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0, boxKg: box });
    belade(p, 200, 1);
    box.steel = BOX_SCHWELLE_KG.steel + 500; // Stahl hat eine Fuhre beisammen
    for (let i = 0; i < 30; i++) p.takt();
    expect(p.betrieb.naechsterVerlader).toBe("steel");
    // 45b: Der Misch-Verlader fährt von selbst, sobald die Box voll ist — keine Hupe nötig
    bis(p, 10, () => p.protokoll.abfahrten.length > 0);
    expect(p.protokoll.abfahrten[0]?.order).toBe("mixed");
    bis(p, 60, () => !!p.vehicles.schichtVerlader?.waitingForLoad);
    expect(p.vehicles.schichtVerlader?.bestellung, "der Nachrücker ist nicht für Stahl").toBe("steel");
    // W0c: der Funk nennt das Box-Schild (wie „Abholer für … kommt", E-211)
    expect(p.protokoll.meldungen.some((m) => /für STAHLSCHROTT ist unterwegs/.test(m))).toBe(true);
    // Gegenprobe: Box wieder leer → der übernächste ist wieder Misch
    box.steel = 0;
    for (let i = 0; i < 30; i++) p.takt();
    expect(p.betrieb.naechsterVerlader).toBe("mixed");
  });
});

describe("E-202 — der BUNT-Abholer ist ein Absetzkipper (E-177) und steht vorn im Greifband", () => {
  it("alle vier Ecken der Absetzmulde 5,8 … 9,2 m vom Sitz", { timeout: 300_000 }, () => {
    zurueck = festerZufall(18);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0, boxKg: { copper: BOX_SCHWELLE_KG.copper + 100 } });
    // Der erste Nachrücker steht schon (Abroller); erst der zweite wird für BUNT gerufen
    for (let r = 0; r < 2; r++) {
      belade(p, 150, 1);
      expect(p.vehicles.requestPickup()).toBe("abgefahren");
      bis(p, 10, () => p.protokoll.abfahrten.length > r);
      bis(p, 180, () => p.vehicles.schichtVerlader?.waitingForLoad === true);
    }
    const v = p.vehicles.schichtVerlader!;
    expect(v.kind).toBe("absetzer");
    expect(v.bestellung).toBe("copper");
    const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
    bed.updateWorldMatrix(true, false);
    for (const [x, z] of [[-1, 0], [1, 0], [-1, 1], [1, 1]] as const) {
      const w = bed.localToWorld(new THREE.Vector3((x * ABSETZMULDE.breite) / 2, 0, z * ABSETZMULDE.laenge));
      const d = Math.hypot(w.x - BAGGER_STAND.x, w.z - BAGGER_STAND.z);
      expect(d, `Ecke (${w.x.toFixed(2)} | ${w.z.toFixed(2)})`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    }
  });
});

describe("E-202 — die Annahme macht zu und wieder auf (Hysterese)", () => {
  it(`ab ${ANNAHME_ZU_KG} kg zu, bleibt zu bis unter ${ANNAHME_AUF_KG} kg, dann kommt die wartende Fuhre`, { timeout: 120_000 }, () => {
    zurueck = festerZufall(15);
    let lose = ANNAHME_ZU_KG + 1_000;
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => lose });
    for (let i = 0; i < 120; i++) p.takt();
    expect(p.betrieb.annahmeVoll).toBe(true);
    expect(p.betrieb.wartend).toBe(1); // die Fuhre von 06:00 wartet am Tor
    expect(p.vehicles.schichtAnlieferer).toBeNull();
    lose = (ANNAHME_ZU_KG + ANNAHME_AUF_KG) / 2; // dazwischen: bleibt zu
    for (let i = 0; i < 120; i++) p.takt();
    expect(p.betrieb.annahmeVoll).toBe(true);
    expect(p.vehicles.schichtAnlieferer).toBeNull();
    lose = ANNAHME_AUF_KG - 100;
    for (let i = 0; i < 60; i++) p.takt();
    expect(p.betrieb.annahmeVoll).toBe(false);
    expect(p.vehicles.schichtAnlieferer?.kind).toBe("kipper");
    expect(p.betrieb.wartend).toBe(0);
    expect(p.protokoll.meldungen).toContain("Büro an Bagger: Der Platz ist voll — neue Fuhren warten am Tor, bis aufgeräumt ist.");
    expect(p.protokoll.meldungen).toContain("Büro an Bagger: Platz wieder frei — die nächste Fuhre kommt.");
  });
});

describe("E-202 — die sortenreine Pritsche wartet am Lager", () => {
  it("hält am Verladeplatz ihres Silos, das Büro sagt es, der Bagger am Lager stört nicht; leer fährt sie", { timeout: 300_000 }, () => {
    zurueck = festerZufall(16);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => ANNAHME_ZU_KG + 1 }); // Annahme zu: nur die Pritsche fährt
    p.vehicles.schichtFaellig({ tS: 0, art: "sortenrein", fahrzeug: "pritsche", sorte: "copper" });
    p.takt(); // durchs Tor
    const silo = lagerMuldeFuer("copper")!;
    const halt = verladeHaltFuer(silo);
    // Der Bagger steht schon am Lager (E-192: gilt die Silogassen-Regel? Hier nicht — sie hält 7,5 m davor)
    const w0 = p.vehicles.schichtSiloWagen;
    expect(w0?.kind).toBe("pritsche");
    p.bagger.set(w0!.festerPlatz!.stand.x, 0, w0!.festerPlatz!.stand.z);
    bis(p, 120, () => p.vehicles.schichtSiloWagen?.phaseName === "waitUnload");
    const w = p.vehicles.schichtSiloWagen!;
    expect(w.phaseName, "nicht am Lager angekommen").toBe("waitUnload");
    expect(Math.hypot(w.group.position.x - halt[0], w.group.position.z - halt[1])).toBeLessThan(0.6);
    expect(w.sortedMaterial).toBe("copper");
    expect(p.protokoll.meldungen).toContain("Büro an Bagger: Pritsche mit Kupfer wartet am KUPFER-LAGER — fahr hin und lad ab.");
    expect(p.vehicles.anliefererWartet, "Hupe am Lager meint die Pritsche").toBe(true);
    // Ausladen (wie der Prüfstand in fahrspuren.test.ts): Was oben liegt, ist weg
    for (const it of [...w.cargo.items]) {
      const e = p.items.itemByBody(it.body);
      if (e) p.items.remove(e, true);
    }
    w.cargo.items.length = 0;
    bis(p, 120, () => p.vehicles.schichtSiloWagen === null);
    expect(p.vehicles.schichtSiloWagen, "leer, aber nicht vom Hof").toBeNull();
    expect(p.protokoll.standzeiten.length).toBe(1);
  });
});

describe("E-202 — Standzeit zählt Warten, nicht Fahren", () => {
  it("Kipper, Annahme frei: nur die Kippzeit; dieselbe Fuhre 60 s am Tor: 60 s mehr", { timeout: 300_000 }, () => {
    const lauf = (wartenS: number): { stand: number; aufDemHof: number } => {
      zurueck?.();
      zurueck = festerZufall(17);
      let lose = wartenS > 0 ? ANNAHME_ZU_KG + 1 : 0;
      const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => lose });
      bis(p, wartenS, () => false);
      lose = 0;
      let start: number | null = null;
      bis(p, 200, () => {
        if (start === null && p.vehicles.schichtAnlieferer) start = p.schichtS;
        return p.protokoll.standzeiten.length > 0;
      });
      expect(p.protokoll.standzeiten.length).toBe(1);
      const e = p.protokoll.standzeiten[0]!;
      expect(e.fahrzeug).toBe("kipper");
      setzeSchichtPlatzZurueck();
      return { stand: e.standzeitS, aufDemHof: e.t - (start ?? 0) };
    };
    const frei = lauf(0);
    const gewartet = lauf(60);
    console.log(`Standzeit Kipper: frei ${frei.stand.toFixed(1)} s (auf dem Hof ${frei.aufDemHof.toFixed(0)} s), 60 s am Tor ${gewartet.stand.toFixed(1)} s`);
    // Gegenprobe Fahren: Auf dem Hof war er viel länger, als die Standzeit sagt
    expect(frei.aufDemHof - frei.stand, "die Fahrt zählt mit").toBeGreaterThan(25);
    expect(frei.stand).toBeLessThan(40);
    expect(standgeldSekunden(frei.stand)).toBe(0);
    // Warten am Tor zählt: genau die 60 s (± ein Bild Takt der Messung) mehr
    expect(gewartet.stand - frei.stand).toBeGreaterThan(58);
    expect(gewartet.stand - frei.stand).toBeLessThan(65);
  });
});

/* ======================================================= Freitag, voll */

describe("E-202 — Mehrfahrzeug-Lauf Freitag mit Test-Fahrer", () => {
  it(
    "ganze Schicht: keiner steckt > 60 s fest, kein Rumpf an Rumpf > 20 s, alle Fuhren bedient",
    { timeout: 1_500_000 },
    () => {
      zurueck = festerZufall(202);
      const p = baueSchichtPlatz({ stufe: "freitag", saat: 3 });
      const fahrer = new TestFahrer(p, { griffS: 4, lagerFahrtS: 20 });
      type F = (typeof p.vehicles.fahrzeuge)[number];
      const ruhig = new Set([
        "waitUnload", "waitLoad", "parked", "tipping", "tipHold", "tipBack", "tipCreep", "pauseBeforeUnload",
        "settleCargo", "weighIn", "shiftPause", "muldeHeben", "muldeRuhe", "muldeKippen", "muldeLeeren",
        "muldeSenken", "muldeLoesen", "armeEin", "muldeHolen", "muldeAufnehmen",
      ]);
      const stand = new Map<F, { x: number; z: number; s: number; ph: string }>();
      const rumpf = new Map<string, number>();
      let laengsterStand = 0;
      let laengsterRumpf = 0;
      let wer = "";
      const ids = new Map<F, number>();
      for (let i = 0; i < 60 * (SCHICHT_FEIERABEND_S + 1); i++) {
        p.takt();
        fahrer.schritt(DT);
        if (i % 6) continue;
        const alle = [...p.vehicles.fahrzeuge];
        for (const v of alle) if (!ids.has(v)) ids.set(v, ids.size);
        const jetzt = new Set<string>();
        for (let x = 0; x < alle.length; x++) {
          for (let y = x + 1; y < alle.length; y++) {
            const A: Array<{ x: number; z: number; hw: number; hd: number; rot: number }> = [];
            const B: typeof A = [];
            alle[x]!.boxen(A);
            alle[y]!.boxen(B);
            let d = 0;
            for (const u of A) for (const w of B) d = Math.max(d, boxUeberlappung(u, w));
            if (d <= 0.3) continue;
            const k = `${ids.get(alle[x]!)}|${ids.get(alle[y]!)}`;
            jetzt.add(k);
            rumpf.set(k, (rumpf.get(k) ?? 0) + 6 * DT);
            laengsterRumpf = Math.max(laengsterRumpf, rumpf.get(k)!);
          }
        }
        for (const k of [...rumpf.keys()]) if (!jetzt.has(k)) rumpf.delete(k);
        for (const v of alle) {
          const st = stand.get(v) ?? { x: v.group.position.x, z: v.group.position.z, s: 0, ph: v.phaseName };
          if (Math.hypot(v.group.position.x - st.x, v.group.position.z - st.z) > 0.3 || st.ph !== v.phaseName) {
            st.x = v.group.position.x;
            st.z = v.group.position.z;
            st.s = 0;
            st.ph = v.phaseName;
          } else if (!ruhig.has(v.phaseName)) st.s += 6 * DT;
          stand.set(v, st);
          if (st.s > laengsterStand) {
            laengsterStand = st.s;
            wer = `${v.kind} ${v.phaseName} (${v.group.position.x.toFixed(1)} | ${v.group.position.z.toFixed(1)}) bei ${p.schichtS.toFixed(0)} s`;
          }
        }
      }
      const plan = p.betrieb.plan;
      console.log(
        `Freitag: ${plan.length} Fuhren im Plan, ${p.protokoll.standzeiten.length} Standzeiten gemeldet, ` +
          `${p.protokoll.abfahrten.length} Verlader-Abfahrten, längster Stillstand beim Fahren ${laengsterStand.toFixed(1)} s (${wer}), ` +
          `längstes Rumpf an Rumpf ${laengsterRumpf.toFixed(1)} s, Griffe ${fahrer.griffe}`
      );
      expect(laengsterStand, `ein Laster hing beim Fahren fest: ${wer}`).toBeLessThan(60);
      expect(laengsterRumpf, "zwei Laster standen Rumpf an Rumpf").toBeLessThan(20);
      // Jede Fuhre des Fahrplans hat ihre Standzeit gemeldet (beim Abfahren oder zum Feierabend)
      expect(p.protokoll.standzeiten.length).toBe(plan.length);
      expect(p.protokoll.abfahrten.length).toBeGreaterThanOrEqual(1);
    }
  );
});
