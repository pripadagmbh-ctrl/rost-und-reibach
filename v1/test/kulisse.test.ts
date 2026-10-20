/**
 * Wächter für drei Befunde vom 14.09.2026, die man sieht statt rechnet:
 * der Baum in der Wand, das verdeckte Firmenschild, die Scheinwerfer auf dem
 * Platz. Gemessen wird gegen die gebauten Zahlen, nicht gegen den Plan.
 */
import { describe, it, expect } from "vitest";
import {
  baumStandort,
  BAUM_ABSTAND,
  KRONE_R,
  MAUER_STEIN,
  SCHILD_POS,
  SCHILD_B,
  SCHILD_H,
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  GATE_X,
  TOR_HALB,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  BUCHT_FASE_WEST,
  BUCHT_FASE_OST,
} from "../src/world/yard";
import { einmauern } from "../src/world/daylight";
import { HALLEN_X, HALLEN_Z, HALLE_BREITE, HALLE_TIEFE } from "../src/world/office";
import { BAGGER_STAND } from "../src/world/baggerstand";

const HZ = YARD_D / 2;

/* ------------------------------------------------------------ Bäume ----- */

/**
 * Dieselbe Streuung wie in `Yard.buildLandscape` — fester Zufall, also
 * derselbe Wald bei jedem Start. Nachgebaut statt aufgerufen: Der Bau
 * braucht eine Szene, die Zahlen nicht.
 */
function baumplaetze(): Array<{ x: number; z: number; scale: number }> {
  const YARD_W = YARD_MAX_X - YARD_MIN_X;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const out: Array<{ x: number; z: number; scale: number }> = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 4;
    const t = rnd();
    let x: number;
    let z: number;
    if (side === 0) {
      x = YARD_MIN_X + t * YARD_W;
      z = HZ + 5 + rnd() * 26;
      if (Math.abs(x - GATE_X) < 9) continue;
    } else if (side === 1) {
      x = YARD_MIN_X + t * YARD_W;
      z = -HZ - 5 - rnd() * 26;
    } else if (side === 2) {
      x = YARD_MIN_X - 5 - rnd() * 26;
      z = -HZ + t * YARD_D;
    } else {
      x = YARD_MAX_X + 5 + rnd() * 26;
      z = -HZ + t * YARD_D;
    }
    const scale = 0.85 + rnd() * 0.8;
    // die sechs Würfe der Kronen in placeTree
    for (let k = 0; k < 6; k++) rnd();
    out.push({ x, z, scale });
  }
  return out;
}

/** Wie tief die Krone in eine Mauerfläche hineinragt (Meter, 0 = frei). */
function eindringtiefe(x: number, z: number, krone: number): number {
  const t = MAUER_STEIN.dicke / 2 + krone;
  const rechtecke: Array<[number, number, number, number]> = [
    [YARD_MIN_X, YARD_MAX_X, -HZ, HZ],
    [BUCHT_X_VON, BUCHT_X_BIS, BUCHT_Z, -HZ],
    // Fasen an den vorderen Ecken (E-189)
    [BUCHT_X_VON - BUCHT_FASE_WEST, BUCHT_X_VON, -HZ - BUCHT_FASE_WEST, -HZ],
    [BUCHT_X_BIS, BUCHT_X_BIS + BUCHT_FASE_OST, -HZ - BUCHT_FASE_OST, -HZ],
  ];
  let tiefste = 0;
  for (const [x0, x1, z0, z1] of rechtecke) {
    const dx = Math.min(x - (x0 - t), x1 + t - x);
    const dz = Math.min(z - (z0 - t), z1 + t - z);
    if (dx > 0 && dz > 0) tiefste = Math.max(tiefste, Math.min(dx, dz));
  }
  return tiefste;
}

describe("Kein Baum steckt in einer Wand", () => {
  const baeume = baumplaetze();

  it("streut überhaupt Bäume", () => {
    expect(baeume.length).toBeGreaterThan(30);
  });

  it("vorher stand mindestens einer in der Ausbuchtung", () => {
    // Der Befund selbst, als Zahl festgehalten: der Baum auf (−7,17 | −34,53)
    // reichte mit der Krone 1,13 m in den Westschenkel hinein.
    const treffer = baeume.filter((b) => eindringtiefe(b.x, b.z, KRONE_R * b.scale) > 0);
    expect(treffer.length, "der Befund ist nicht mehr nachzustellen").toBeGreaterThan(0);
  });

  it("nachher steht keiner mehr in einer Mauer", () => {
    for (const b of baeume) {
      const krone = KRONE_R * b.scale;
      const neu = baumStandort(b.x, b.z, krone);
      const tief = eindringtiefe(neu.x, neu.z, krone);
      expect(
        tief,
        `Baum (${neu.x.toFixed(2)} | ${neu.z.toFixed(2)}) steckt ${tief.toFixed(2)} m in der Wand`
      ).toBeLessThanOrEqual(1e-9);
    }
  });

  it("versetzt nur, wer im Weg steht, und nur so weit wie nötig", () => {
    let versetzt = 0;
    for (const b of baeume) {
      const krone = KRONE_R * b.scale;
      const neu = baumStandort(b.x, b.z, krone);
      const weg = Math.hypot(neu.x - b.x, neu.z - b.z);
      if (weg > 1e-9) {
        versetzt++;
        expect(weg, "ein Baum wandert quer über den Platz").toBeLessThan(krone + BAUM_ABSTAND + 1);
      }
    }
    /*
     * Am Nachmittag des 14.09.2026 waren es zwei: einer stand mit der Krone
     * im Westschenkel der Ausbuchtung, einer an ihrer hinteren Ecke. Am Abend
     * ist die Ausbuchtung von 9,5 auf 6,5 m verkürzt worden — die hintere
     * Ecke liegt seitdem 3 m weiter nördlich, und der zweite Baum steht von
     * selbst frei. Bleibt einer.
     *
     * Mehr wäre ein Kahlschlag, keiner ein Zeichen, dass die Prüfung nicht
     * greift.
     */
    expect(versetzt).toBe(1);
  });
});

/* ------------------------------------------------------- Firmenschild --- */

/**
 * Die Startansicht: Orbitkamera hinter dem Bagger (orbitCamera.ts — yaw π,
 * pitch 0,42, Abstand 11 m, Ziel 2,6 m über dem Standplatz, 55° Bildwinkel).
 */
const ZIEL = { x: BAGGER_STAND.x, y: 2.6, z: BAGGER_STAND.z };
const KAM = {
  x: ZIEL.x + Math.sin(Math.PI) * Math.cos(0.42) * 11,
  y: ZIEL.y + Math.sin(0.42) * 11,
  z: ZIEL.z + Math.cos(Math.PI) * Math.cos(0.42) * 11,
};

/**
 * Dachhöhe der Hallen an dieser Stelle, −1 = dort steht keine.
 *
 * Seit dem 15.09.2026 steht die Reihe an der Wand neben dem Buero: Die TIEFE
 * liegt in x, die BREITE in z, und der First laeuft in x. Der Hoehenverlauf
 * haengt deshalb am Abstand in z zur Hallenmitte, nicht mehr in x.
 */
function hallenHoehe(x: number, z: number): number {
  const TRAUFE = 5.0;
  const FIRST = 6.9;
  for (const hz of HALLEN_Z) {
    if (
      x >= HALLEN_X - HALLE_TIEFE / 2 &&
      x <= HALLEN_X + HALLE_TIEFE / 2 &&
      Math.abs(z - hz) <= HALLE_BREITE / 2
    ) {
      return TRAUFE + (FIRST - TRAUFE) * (1 - Math.abs(z - hz) / (HALLE_BREITE / 2));
    }
  }
  // Bürogebäude (office.ts): x −39,6 … −30,6, z 22,4 … 28,6, First 7,9 m
  if (x >= -39.6 && x <= -30.6 && z >= 22.4 && z <= 28.6) {
    return 6.2 + 1.7 * (1 - Math.abs(z - 25.5) / 3.1);
  }
  return -1;
}

function verdeckt(px: number, py: number, pz: number): boolean {
  // fein abgetastet: Das Bürogebäude wird an seiner Nordkante nur auf ein
  // paar Zentimetern gestreift, und genau das soll auffallen.
  for (let i = 1; i < 4000; i++) {
    const f = i / 4000;
    const x = KAM.x + f * (px - KAM.x);
    const y = KAM.y + f * (py - KAM.y);
    const z = KAM.z + f * (pz - KAM.z);
    if (z < 12) continue;
    const h = hallenHoehe(x, z);
    if (h > 0 && y < h) return true;
  }
  return false;
}

/** Bildkoordinaten −1 … +1; außerhalb heißt: nicht im Bild. */
function imBild(px: number, py: number, pz: number, seitenverhaeltnis: number): boolean {
  const f = { x: ZIEL.x - KAM.x, y: ZIEL.y - KAM.y, z: ZIEL.z - KAM.z };
  const len = Math.hypot(f.x, f.y, f.z);
  f.x /= len;
  f.y /= len;
  f.z /= len;
  const r = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r.x, r.z);
  r.x /= rl;
  r.z /= rl;
  const u = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  };
  const d = { x: px - KAM.x, y: py - KAM.y, z: pz - KAM.z };
  const tiefe = d.x * f.x + d.y * f.y + d.z * f.z;
  if (tiefe <= 0) return false;
  const ty = Math.tan((55 * Math.PI) / 180 / 2);
  const su = (d.x * r.x + d.z * r.z) / tiefe / (ty * seitenverhaeltnis);
  const sv = (d.x * u.x + d.y * u.y + d.z * u.z) / tiefe / ty;
  return Math.abs(su) <= 1 && Math.abs(sv) <= 1;
}

describe("Das Firmenschild ist in der Startansicht ganz zu sehen", () => {
  const punkte: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 6; j++) {
      punkte.push([(-0.5 + i / 12) * SCHILD_B, (-0.5 + j / 6) * SCHILD_H]);
    }
  }

  it("keine Halle und kein Büro steht davor", () => {
    for (const [dx, dy] of punkte) {
      expect(
        verdeckt(SCHILD_POS.x + dx, SCHILD_POS.y + dy, SCHILD_POS.z),
        `Tafelpunkt (${(SCHILD_POS.x + dx).toFixed(1)} | ${(SCHILD_POS.y + dy).toFixed(1)}) ist verdeckt`
      ).toBe(false);
    }
  });

  it("und die ganze Tafel liegt im Bild — auf iPad wie auf iPhone mini", () => {
    for (const seiten of [4 / 3, 2.16]) {
      for (const [dx, dy] of punkte) {
        expect(
          imBild(SCHILD_POS.x + dx, SCHILD_POS.y + dy, SCHILD_POS.z, seiten),
          `Tafelpunkt (${dx.toFixed(1)} | ${dy.toFixed(1)}) fällt bei ${seiten.toFixed(2)}:1 aus dem Bild`
        ).toBe(true);
      }
    }
  });

  it("steht im Fenster zwischen Büro und Halle 1, neben der Einfahrt", () => {
    const west = SCHILD_POS.x - SCHILD_B / 2;
    const ost = SCHILD_POS.x + SCHILD_B / 2;
    expect(ost, "die Tafel ragt in die Einfahrtsspur").toBeLessThan(GATE_X - 1.2);
    expect(west).toBeGreaterThan(-35);
    // Und sie hängt hinter der Nordmauer, nicht auf dem Platz.
    expect(SCHILD_POS.z).toBeGreaterThan(HZ);
  });

  it("hinter der Hallenreihe wäre sie verdeckt — sonst prüft der Wächter nichts", () => {
    /*
     * Der Gegentest zum Waechter: Er muss an einer Stelle ANSCHLAGEN, sonst
     * prueft er nichts.
     *
     * Bis zum 15.09.2026 war das die alte Schildstelle (−10 | 7,5): Dort
     * standen die Sortierhallen davor. Die stehen jetzt an der Wand neben dem
     * Buero, und das Fenster in der Einfahrtsachse ist entsprechend breiter
     * geworden — die alte Stelle ist heute frei. Geprueft wird deshalb an der
     * Stelle, an der heute Bauten stehen: hinter der Hallenreihe.
     */
    const alt = { x: HALLEN_X, y: 5.0, b: 14, h: 7 };
    let verdeckteEcken = 0;
    for (let i = 0; i <= 12; i++) {
      for (let j = 0; j <= 6; j++) {
        const px = alt.x + (-0.5 + i / 12) * alt.b;
        const py = alt.y + (-0.5 + j / 6) * alt.h;
        if (verdeckt(px, py, SCHILD_POS.z)) verdeckteEcken++;
      }
    }
    expect(verdeckteEcken, "der Befund ist nicht mehr nachzustellen").toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------- Flutlicht ----- */

describe("Die Scheinwerfer stehen in der Mauer", () => {
  // dieselbe Liste wie in main.ts
  const MASTEN: Array<[number, number]> = [
    [-37, 26],
    [-37, -26],
    [-37, 2],
    [9, 26],
    [9, 8],
    [0, 26],
  ];

  it("jeder Mast landet auf einer Mauerlinie", () => {
    for (const [x, z] of MASTEN) {
      const [mx, mz] = einmauern(x, z);
      const aufMauer =
        Math.abs(mx - YARD_MIN_X) < 1e-9 ||
        Math.abs(mx - YARD_MAX_X) < 1e-9 ||
        Math.abs(mz - HZ) < 1e-9 ||
        Math.abs(mz + HZ) < 1e-9;
      expect(aufMauer, `Mast (${x} | ${z}) steht weiter frei auf dem Platz`).toBe(true);
    }
  });

  it("und rückt dabei höchstens drei Meter", () => {
    for (const [x, z] of MASTEN) {
      const [mx, mz] = einmauern(x, z);
      expect(Math.hypot(mx - x, mz - z)).toBeLessThanOrEqual(3.0 + 1e-9);
    }
  });

  it("keiner steht in der Einfahrt", () => {
    for (const z of [26, 28, 30]) {
      const [mx, mz] = einmauern(GATE_X, z);
      if (Math.abs(mz - HZ) < 1e-9) {
        expect(Math.abs(mx - GATE_X), "Mast mitten im Tor").toBeGreaterThanOrEqual(TOR_HALB);
      }
    }
  });

  it("die Arbeitsfläche bleibt frei: kein Mast mehr innerhalb der Mauern", () => {
    for (const [x, z] of MASTEN) {
      const [mx, mz] = einmauern(x, z);
      const drinnen = mx > YARD_MIN_X && mx < YARD_MAX_X && mz > -HZ && mz < HZ;
      expect(drinnen, `Mast (${mx} | ${mz}) steht noch auf der Fläche`).toBe(false);
    }
  });
});
