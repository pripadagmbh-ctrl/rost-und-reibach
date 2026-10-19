/**
 * E-131 — Patrick, 16.10.2026: „Baue mehr Werbeschilder ein und mache anstelle
 * von ROST&Reibach wieder Pripada.de rein".
 *
 *  1. Der Firmenname steht an EINER Stelle (`werbung.FIRMA`); kein sichtbarer
 *     Text nennt noch Rust’n’Reibach.
 *  2. Kein Schild steht im Weg: keins auf der Platzfläche, keins in einem
 *     Bauwerk der Hindernisliste, keins in Reichweite der Spinne, keins in der
 *     Zufahrt; die Hallenblenden engen das Tor nicht ein.
 *  3. Alle Schilder zusammen sind zwei Netze — zwei Zeichenrufe (E-025).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { FIRMA, FIRMA_KURZ, werbeschilder, baueWerbeschilder, werbeAtlas, atlasFeld, PRIPADA_GRUEN } from "../src/world/werbung";
import { YARD_D, YARD_MIN_X, YARD_MAX_X, GATE_X, BUCHT_Z, WEIGH_X, WEIGH_Z } from "../src/world/yard";
import { alleHindernisse } from "../src/world/obstacles";
import { BAGGER_STAND, VERLADE_STAND, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { HALLEN_Z, HALLE_BREITE, officeFootprints } from "../src/world/office";
import { alleAbholPlaetze } from "../src/delivery/routes";
import { leinwandMitVerlauf } from "../tools/engstellen-kern";

const wurzel = resolve(__dirname, "..");
const HZ = YARD_D / 2;

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? dateien(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/*
 * E-173 — Patrick, 20.10.2026: „Nenn das Spiel wieder Rost&Reibach. Auch die
 * Werbetafeln entsprechend umbenennen." Auf Nachfrage: Auf dem Platz wird
 * ALLES Rost & Reibach, Pripada verschwindet aus dem Spiel (Anbieter im Store
 * bleibt die Pripada GmbH — das steht auf den Rechtsseiten, nicht im Spiel).
 */
describe("Der Spielname (E-131, E-173)", () => {
  it("heisst Rost & Reibach", () => {
    expect(FIRMA).toBe("Rost & Reibach");
  });

  /*
   * Noch offen: Ausleger und Bordinstrument schreiben „PRIPADA" — das ist der
   * Bagger-Bereich (`src/excavator/`), bestellt über den Orchestrator. Steht
   * dort kein Pripada mehr, meldet der Test, dass die Ausnahme weg kann.
   */
  const NOCH_OFFEN = ["src/excavator/excavator.ts", "src/excavator/instruments.ts"].map((p) => join(wurzel, p));

  it("kein Text im Spiel nennt noch Pripada oder Rust’n’Reibach", () => {
    // Zeichenketten in Anfuehrungszeichen — Kommentare duerfen die Geschichte erzaehlen
    const zeichenkette = /["'`][^"'`\n]*(Pripada|PRIPADA|RUSTN|Rust’n)[^"'`\n]*["'`]/;
    const treffer: string[] = [];
    for (const p of [...dateien(join(wurzel, "src")), join(wurzel, "index.html")]) {
      const text = readFileSync(p, "utf8");
      const ohneKommentare = p.endsWith(".html")
        ? text.replace(/<!--[\s\S]*?-->/g, "")
        : text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      if (p.endsWith(".html") ? /Pripada|PRIPADA|RUSTN/.test(ohneKommentare) : zeichenkette.test(ohneKommentare)) {
        treffer.push(p);
      }
    }
    expect(treffer.filter((p) => !NOCH_OFFEN.includes(p))).toEqual([]);
    for (const p of NOCH_OFFEN) expect(treffer, `${p} ist sauber — Ausnahme streichen`).toContain(p);
  });

  it("Titel, Manifest und App-Name heissen Rost & Reibach, unter dem Symbol ohne Leerzeichen", () => {
    expect(readFileSync(join(wurzel, "index.html"), "utf8")).toContain("<title>Rost &amp; Reibach</title>");
    const manifest = JSON.parse(readFileSync(join(wurzel, "public/manifest.webmanifest"), "utf8"));
    expect(manifest.name).toBe(FIRMA);
    expect(manifest.short_name).toBe(FIRMA_KURZ);
    expect(JSON.parse(readFileSync(join(wurzel, "capacitor.config.json"), "utf8")).appName).toBe(FIRMA);
    const plist = readFileSync(join(wurzel, "ios/App/App/Info.plist"), "utf8");
    expect(plist).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Rost&amp;Reibach<\/string>/);
    expect(FIRMA_KURZ.length).toBeLessThanOrEqual(12);
  });

  it("das Hauptmenue holt den Namen von derselben Stelle", () => {
    const html = readFileSync(join(wurzel, "index.html"), "utf8");
    expect(html).toMatch(/<div id="hauptmenue">[\s\S]*?<h1><\/h1>/);
    const menue = readFileSync(join(wurzel, "src/ui/hauptmenue.ts"), "utf8");
    expect(menue).toMatch(/textContent = FIRMA/);
  });
});

describe("Die Schilder stehen niemandem im Weg (E-131)", () => {
  const schilder = werbeschilder();

  /** Die Ecken der Schaufläche im Grundriss (Dicke vernachlässigt). */
  const enden = (s: (typeof schilder)[number]): Array<[number, number]> => {
    const dx = Math.cos(s.rot) * (s.b / 2);
    const dz = -Math.sin(s.rot) * (s.b / 2);
    return [
      [s.x - dx, s.z - dz],
      [s.x + dx, s.z + dz],
    ];
  };

  it("mehr als die eine Firmentafel, und der Name ist mehrfach dabei", () => {
    expect(schilder.length).toBeGreaterThanOrEqual(6);
    expect(schilder.filter((s) => s.bild.name === FIRMA).length).toBeGreaterThanOrEqual(3);
  });

  /** Die Dachtafel auf dem Büro (E-133) steht über dem Platz, nicht auf ihm. */
  const amBoden = (t: (typeof schilder)[number]): boolean => t.pfosten && !(t.fuss ?? 0);

  it("keine freistehende Tafel auf der Platzfläche — alle hinter der Mauer", () => {
    for (const s of schilder.filter(amBoden)) {
      // Seit E-133 auch hinter der Bucht: südlich ihrer Rückwand
      const draussen = s.z > HZ || s.z < BUCHT_Z || s.x > YARD_MAX_X || s.x < YARD_MIN_X;
      expect(draussen, `${s.name} steht auf dem Platz`).toBe(true);
    }
  });

  it("keine Tafel ausserhalb der Mauer in der Zufahrt zum Tor", () => {
    for (const s of schilder.filter((t) => t.z > HZ)) {
      for (const [x] of enden(s)) {
        // Zufahrt: x −22 ± 1,55 m, die halbe Wagenbreite, mit der auch die
        // Firmentafel seit E-010 gerechnet ist (`yard.SCHILD_POS`)
        expect(Math.abs(x - GATE_X), `${s.name} ragt in die Zufahrt`).toBeGreaterThan(1.55);
      }
      const links = Math.min(...enden(s).map((e) => e[0]));
      const rechts = Math.max(...enden(s).map((e) => e[0]));
      expect(links > GATE_X || rechts < GATE_X, `${s.name} steht quer vor dem Tor`).toBe(true);
    }
  });

  it("keine in Reichweite der Spinne — von keinem der beiden Baggerstände", () => {
    for (const s of schilder) {
      for (const [x, z] of [...enden(s), [s.x, s.z] as [number, number]]) {
        for (const st of [BAGGER_STAND, VERLADE_STAND]) {
          expect(Math.hypot(x - st.x, z - st.z), `${s.name} im Schwenkbereich`).toBeGreaterThan(SCHWENK_AUSSEN);
        }
      }
    }
  });

  it("die Hallenblende engt das Tor nicht ein und bleibt unter dem Dach", () => {
    for (const s of schilder.filter((t) => !t.pfosten)) {
      expect(s.y - s.h / 2, `${s.name}: Unterkante unter dem Sturz`).toBeGreaterThanOrEqual(4.475 - 1e-9);
      // Dachlinie am Giebel: Traufe 5,0 m, First 1,9 m darueber (office.ts)
      const dach = 5.0 + 1.9 * (1 - s.b / 2 / (HALLE_BREITE / 2));
      expect(s.y + s.h / 2, `${s.name}: Ecken ueber der Dachlinie`).toBeLessThan(dach);
      expect(HALLEN_Z.some((z) => Math.abs(z - s.z) < 1e-9)).toBe(true);
    }
  });

  it("keine Tafel steht in einem Bauwerk — die Pfosten stehen frei", () => {
    for (const s of schilder.filter(amBoden)) {
      for (const [x, z] of enden(s)) {
        const drin = alleHindernisse().find(
          (o) => Math.abs(x - o.x) < o.hw && Math.abs(z - o.z) < o.hd
        );
        expect(drin?.label, `${s.name} steckt in ${drin?.label}`).toBeUndefined();
      }
    }
  });
});

describe("Zwei Netze für alle Schilder (E-025)", () => {
  beforeAll(async () => {
    await initPhysics();
    leinwandMitVerlauf();
  });

  it("eine Schaufläche, ein Gestell — und die Firmentafel behält ihre zwei Pfosten-Kollider", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    baueWerbeschilder(scene, world);
    const netze = scene.children.filter((o) => (o as THREE.Mesh).isMesh);
    expect(netze.length).toBe(2);
    let kollider = 0;
    world.forEachCollider(() => kollider++);
    expect(kollider).toBe(2);
  });
});

/**
 * E-133 — Patrick, 17.10.2026: „Schilder ändern, Pripada prominent direkt an
 * der waage und da wo gearbeitet wird. Ansonsten Schilder von Rent4ring,
 * glasklar-mg.de, MecLight bzw. led.profi.de."
 */
describe("Echte Firmen statt erfundener (E-133)", () => {
  const schilder = werbeschilder();
  const pripada = schilder.filter((s) => s.bild.name === FIRMA);

  it("keine erfundenen Betriebe mehr", () => {
    const texte = schilder.flatMap((s) => [s.bild.name, ...s.bild.zeilen]).join(" | ");
    for (const alt of ["ROLLMULDE", "Imbiss", "KIES & KLINKER", "SCHRAUBHALLE", "REIFEN-ECKE"]) {
      expect(texte, `${alt} steht noch auf einer Tafel`).not.toContain(alt);
    }
  });

  /*
   * E-143 — Patrick, 17.10.2026: „nimm rent4ring und ledprofi raus. Mach nur
   * pripada.de rein", auf Nachfrage glasklar-mg.de ebenso.
   */
  it("jede Tafel zeigt den eigenen Namen, keine fremde Firma (E-143)", () => {
    expect(schilder.length).toBeGreaterThan(0);
    for (const s of schilder) expect(s.bild.name, s.name).toBe(FIRMA);
    const texte = schilder.flatMap((s) => [s.bild.name, ...s.bild.zeilen]).join(" | ");
    for (const alt of ["Rent4Ring", "glasklar", "led-profi", "MecLight"]) expect(texte).not.toContain(alt);
  });

  it("keine Logodateien fremder Firmen mehr im Spiel (E-143)", () => {
    expect(existsSync(join(wurzel, "public/logos"))).toBe(false);
  });

  it("der Name steht höchstens 10 m von der Waage", () => {
    const naechste = Math.min(...pripada.map((s) => Math.hypot(s.x - WEIGH_X, s.z - WEIGH_Z)));
    expect(naechste).toBeLessThanOrEqual(10);
  });

  it("der Name steht höchstens 20 m vom Abladeplatz-Halt", () => {
    const [hx, hz] = alleAbholPlaetze()[0]!.halt;
    const naechste = Math.min(...pripada.map((s) => Math.hypot(s.x - hx, s.z - hz)));
    expect(naechste).toBeLessThanOrEqual(20);
  });

  it("die Dachtafel steht auf dem Büro, ihre Unterkante über dem First", () => {
    const dach = schilder.filter((s) => (s.fuss ?? 0) > 0);
    expect(dach.map((s) => s.name)).toEqual(["Tafel, Dach Büro an der Waage"]);
    const s = dach[0]!;
    const [ox, oz, ohw, ohd] = officeFootprints()[0]!;
    expect(Math.abs(s.x - ox)).toBeLessThan(ohw);
    expect(Math.abs(s.z - oz)).toBeLessThan(ohd);
    // Pfosten auch über dem Grundriss (0,55 m hinter der Schaufläche, ±0,32 · b)
    const px = s.x - Math.sin(s.rot) * 0.55;
    expect(Math.abs(px - ox)).toBeLessThan(ohw);
    expect(Math.abs(s.z - oz) + s.b * 0.32).toBeLessThan(ohd);
    // Traufe 6,2 m + First 1,7 m (office.ts: GESCHOSS · 2, FIRST_BUERO)
    expect(s.y - s.h / 2).toBeGreaterThan(6.2 + 1.7);
    // Die Pfosten fangen auf der Dachfläche an, zwischen Traufe und First
    expect(s.fuss!).toBeGreaterThan(6.2);
    expect(s.fuss!).toBeLessThan(6.2 + 1.7);
  });

  it("der Name auch hinter der Bucht, über deren Rückwand", () => {
    const bucht = pripada.find((s) => s.z < BUCHT_Z);
    expect(bucht, "keine Tafel hinter der Bucht").toBeDefined();
    expect(bucht!.y - bucht!.h / 2).toBeGreaterThan(4.8); // SUED_HOCH
  });
});

describe("Der gemeinsame Atlas (E-133)", () => {
  beforeAll(() => {
    leinwandMitVerlauf();
  });

  it("gibt es einmal, 1024 × 1024 (E-143), das grüne Feld unten", () => {
    const a = werbeAtlas();
    expect(a).not.toBeNull();
    expect(werbeAtlas()).toBe(a);
    const f = atlasFeld("pripadaGruen", 2);
    // Zelle x 0…1024, y 768…1024 auf 1024 × 1024 (v nach oben)
    expect(a!.image.width).toBe(1024);
    expect(a!.image.height).toBe(1024);
    expect(f.u0).toBeCloseTo(0.25, 6);
    expect(f.u1).toBeCloseTo(0.75, 6);
    expect(f.v0).toBeCloseTo(0, 6);
    expect(f.v1).toBeCloseTo(0.25, 6);
    const r = atlasFeld("pripadaGruenRand");
    expect(r.u0).toBeGreaterThan(0);
    expect(r.u1).toBeLessThan(f.u0);
    // Breiter als die Zelle geht nicht
    const breit = atlasFeld("pripadaGruen", 10);
    expect(breit.u1 - breit.u0).toBeCloseTo(1, 6);
    expect(PRIPADA_GRUEN).toBe("#2f7a4f");
  });
});
