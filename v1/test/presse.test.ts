/**
 * Das Paket muss aus der Presse herausgehen — der ganze Weg, nicht nur „das
 * Hindernis ist weg".
 *
 * Befund Patrick, 15.09.2026: „Es war auch nicht möglich, ein
 * zusammengepresstes Auto wieder aus der Presse zu holen."
 *
 * Ursache (Punkt 1 in `docs/offene-punkte.md`): Die Presse stand in
 * `STATIC_OBSTACLES` als EIN volles Rechteck von 4,75 × 4,90 m auf 2,20 m
 * Höhe. `hitsObstacle` lässt alles über `top` hinweg und nichts darunter
 * hindurch — der Greifer galt also als „im Bauwerk steckend", sobald er unter
 * die Wandkrone kam. Physisch war die Kammer die ganze Zeit richtig gebaut
 * (Boden plus vier Wände, oben offen); nur die Hindernisliste sagte etwas
 * anderes. Dieselbe Klasse Fehler wie die „unsichtbare Barriere" vom
 * 12.09.2026, nur andersherum.
 *
 * Gebaut wie die Sortiermulden: Wände ja, Deckel nein. Geprüft wird deshalb
 * beides — dass der Greifer hineinkommt UND dass kein Fahrzeug hineinkommt.
 */
import { describe, it, expect } from "vitest";
import { STATIC_OBSTACLES, hitsObstacle } from "../src/world/obstacles";
import {
  PRESS_CENTER,
  PRESS_INNER,
  PRESS_FUSS,
  PRESS_KAMMER,
  PRESS_ROT,
  KLAPPE_WEG,
  KLAPPE_RICHTUNG,
  pressWaende,
  baleYard,
} from "../src/world/press";
import { clawSpan, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";
import { hoechsteKrallenspitze } from "../src/excavator/excavator";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { bedLenFor } from "../src/delivery/routes";

/** Sicherheitsrand, mit dem `collision.ts` die Spinne abtastet. */
const GRAPPLE_PAD = 0.25;
/** …und den Arm. */
const ARM_PAD = 0.2;
/** Der Bagger erreicht den Boden nur zwischen diesen beiden Abständen. */
const BODEN_VON = 3.0;
const BODEN_BIS = 9.5;

const SPANNE = clawSpan(CLAW_OPEN_SPLAY);
const WAENDE = pressWaende();
/** Höhe der Wandkrone: Kammerboden 0,30 m plus 1,90 m Wand. */
const KRONE = WAENDE[0]!.top;

describe("Presse: Wände ja, Deckel nein", () => {
  it("die vier Wände stehen in der Hindernisliste und der Ring ist lückenlos", () => {
    const eintraege = STATIC_OBSTACLES.filter((o) => o.label.startsWith("Presse "));
    expect(eintraege.length, "die Presse fehlt oder steht doppelt").toBe(4);
    for (const teil of ["Nord", "Süd", "West", "Ost"]) {
      const suche = teil === "Süd" ? "Sued" : teil;
      expect(
        eintraege.some((o) => o.label === `Presse ${suche}`),
        `die ${teil}wand fehlt`
      ).toBe(true);
    }
    /*
     * LÜCKENLOS heißt: Auf dem ganzen Umfang des Fußabdrucks liegt ein
     * Hindernis. Eine Lücke von 20 cm sieht man in keinem Bild, ein LKW fährt
     * hindurch und der Greifer hält sie für eine Tür.
     */
    const schritt = 0.1;
    for (let x = PRESS_CENTER.x - PRESS_FUSS.hw + 0.05; x < PRESS_CENTER.x + PRESS_FUSS.hw; x += schritt) {
      for (const z of [PRESS_CENTER.z - PRESS_FUSS.hd + 0.05, PRESS_CENTER.z + PRESS_FUSS.hd - 0.05]) {
        expect(hitsObstacle(x, z, 0), `Lücke im Ring bei (${x.toFixed(2)} | ${z.toFixed(2)})`)
          .not.toBeNull();
      }
    }
    for (let z = PRESS_CENTER.z - PRESS_FUSS.hd + 0.05; z < PRESS_CENTER.z + PRESS_FUSS.hd; z += schritt) {
      for (const x of [PRESS_CENTER.x - PRESS_FUSS.hw + 0.05, PRESS_CENTER.x + PRESS_FUSS.hw - 0.05]) {
        expect(hitsObstacle(x, z, 0), `Lücke im Ring bei (${x.toFixed(2)} | ${z.toFixed(2)})`)
          .not.toBeNull();
      }
    }
    // Und der Ring ergibt genau den Fußabdruck, den press.ts nennt.
    const x0 = Math.min(...WAENDE.map((o) => o.x - o.hw));
    const x1 = Math.max(...WAENDE.map((o) => o.x + o.hw));
    expect((x1 - x0) / 2).toBeCloseTo(PRESS_FUSS.hw, 6);
  });

  it("der Kammerboden ist offen — auf ganzer Fläche, nicht nur in der Mitte", () => {
    /*
     * Das ist der Befund selbst. Abgetastet wird der lichte Innenraum im
     * 10-cm-Raster, mit dem Rand, mit dem die Spinne prüft (`GRAPPLE_PAD`).
     */
    // Ein Zentimeter Abzug: Genau auf der Grenze entscheidet die
    // Gleitkommadarstellung, nicht die Geometrie.
    const hw = PRESS_KAMMER.hw - GRAPPLE_PAD - 0.01;
    const hd = PRESS_KAMMER.hd - GRAPPLE_PAD - 0.01;
    expect(hw, "die Kammer ist schmaler als der Tastradius").toBeGreaterThan(0.5);
    for (let dx = -hw; dx <= hw + 1e-9; dx += 0.1) {
      for (let dz = -hd; dz <= hd + 1e-9; dz += 0.1) {
        const o = hitsObstacle(PRESS_CENTER.x + dx, PRESS_CENTER.z + dz, GRAPPLE_PAD);
        expect(
          o,
          `Kammerboden bei (${dx.toFixed(2)} | ${dz.toFixed(2)}) versperrt durch ${o?.label}`
        ).toBeNull();
      }
    }
  });

  it("der Greifer passt zwischen die Wände — mit gemessener Luft", () => {
    /*
     * Die offene Sichelkralle misst 3,38 m. Die lichte Kammer ist seit E-138
     * 4,45 m in der Pressrichtung und 5,05 m quer dazu (vorher 4,20 x 4,05);
     * es bleiben 53 bzw. 83 cm je Seite. Unter 30 cm darf es nicht gehen
     * (E-023).
     */
    const luftLaengs = (PRESS_INNER.laenge - SPANNE) / 2;
    const luftQuer = (PRESS_INNER.tiefe - SPANNE) / 2;
    expect(SPANNE, "Spinnenspanne").toBeCloseTo(3.38, 1);
    expect(luftLaengs, `nur ${(luftLaengs * 100).toFixed(0)} cm Luft längs`).toBeGreaterThan(0.3);
    expect(luftQuer, `nur ${(luftQuer * 100).toFixed(0)} cm Luft quer`).toBeGreaterThan(0.3);
    /*
     * Und der TASTPUNKT der Spinne (ein Punkt mit 0,25 m Rand, nicht die
     * ganze Spanne) hat innen ein Fenster von 4,55 x 3,95 m (vor E-138
     * 3,55 x 3,70), in dem er frei ist. Das ist es, was `grappleHitsBuilding`
     * wirklich prueft.
     */
    expect(2 * (PRESS_KAMMER.hw - GRAPPLE_PAD)).toBeCloseTo(4.55, 6);
    expect(2 * (PRESS_KAMMER.hd - GRAPPLE_PAD)).toBeCloseTo(3.95, 6);
  });

  it("hinein, fassen, heraus: der ganze Weg ist frei", () => {
    /*
     * Ein Wächter, der nur „Hindernis ist weg" prüft, hilft nicht. Abgefahren
     * wird der Weg, den der Spieler nimmt: von außen über die Nordwand (die
     * dem Sitz zugewandte Seite), hinunter auf den Kammerboden, wieder hoch
     * und über dieselbe Wand zurück.
     *
     * `hitsObstacle(x, z, pad, y)` sperrt, solange y NICHT über `top` liegt.
     * Über der Wand muss der Greifer also höher als die Krone sein, drinnen
     * darf er beliebig tief.
     */
    const nord = WAENDE.find((w) => w.teil === "Nord")!;
    const ziel = baleYard();
    const bahn: Array<[number, number, number, string]> = [];
    // Anflug von der Sitzseite her, über der Wandkrone
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const x = PRESS_CENTER.x + (ziel.x - PRESS_CENTER.x) * t;
      const z = nord.z + 2.0 - (2.0 + (nord.z - ziel.z)) * t;
      // über der Krone, bis der Punkt innerhalb der Kammer liegt
      const drin =
        Math.abs(x - PRESS_CENTER.x) < PRESS_KAMMER.hw - GRAPPLE_PAD &&
        Math.abs(z - PRESS_CENTER.z) < PRESS_KAMMER.hd - GRAPPLE_PAD;
      bahn.push([x, z, drin ? 0.35 : KRONE + 0.35, drin ? "in der Kammer" : "über der Krone"]);
    }
    // Absenken auf den Kammerboden und wieder heben
    for (const y of [1.2, 0.6, 0.35, 0.6, 1.2, KRONE + 0.35]) {
      bahn.push([ziel.x, ziel.z, y, "am Paket"]);
    }
    // Und über die Wand zurück
    for (let t = 0; t <= 1.0001; t += 0.1) {
      bahn.push([
        ziel.x + (PRESS_CENTER.x - ziel.x) * t,
        ziel.z + (nord.z + 2.0 - ziel.z) * t,
        KRONE + 0.35,
        "Rückweg",
      ]);
    }
    for (const [x, z, y, was] of bahn) {
      const o = hitsObstacle(x, z, GRAPPLE_PAD, y);
      expect(
        o,
        `${was}: (${x.toFixed(2)} | ${z.toFixed(2)} | ${y.toFixed(2)}) blockiert durch ${o?.label}`
      ).toBeNull();
    }
    // Der Ausleger selbst tastet mit kleinerem Rand und liegt höher — auch frei.
    for (const [x, z] of bahn.map(([a, b]) => [a, b])) {
      expect(hitsObstacle(x!, z!, ARM_PAD, KRONE + 0.6)).toBeNull();
    }
  });

  it("und das Paket liegt wirklich in Reichweite — jede Ecke seines Feldes", () => {
    /*
     * Das Paket bleibt in der Kammer liegen (Ansage 12.09.2026: „Ballen
     * bleiben in Presse, ohne Abscheiden"). `baleYard()` sagt, wo es landen
     * kann; `spawnBale` streut es innerhalb dieses Feldes, abzüglich 1,2 bzw.
     * 1,4 m Rand.
     *
     * Gemessen vom Standplatz (−0,5 | −22,5): Der Arm erreicht den BODEN nur
     * zwischen 3,0 und 9,5 m, und über eine 2,20 m hohe Wand muss er auch
     * noch kommen.
     */
    const l = baleYard();
    let naechste = Infinity;
    let fernste = 0;
    for (const dx of [-(l.w - 1.2) / 2, 0, (l.w - 1.2) / 2]) {
      for (const dz of [-(l.d - 1.4) / 2, 0, (l.d - 1.4) / 2]) {
        const d = abstandVomStand(l.x + dx, l.z + dz);
        naechste = Math.min(naechste, d);
        fernste = Math.max(fernste, d);
      }
    }
    expect(naechste, `nächste Paketlage ${naechste.toFixed(2)} m`).toBeGreaterThan(BODEN_VON);
    expect(fernste, `fernste Paketlage ${fernste.toFixed(2)} m — dort kommt der Arm nicht hin`)
      .toBeLessThan(BODEN_BIS);
    /*
     * Und über die Wand: Auf der ganzen Strecke vom nächsten bis zum fernsten
     * Paketplatz muss die Krallenspitze höher kommen als die Wandkrone, sonst
     * hebt der Spieler das Paket gegen den Rahmen.
     */
    for (const d of [naechste, (naechste + fernste) / 2, fernste]) {
      const h = hoechsteKrallenspitze(d);
      expect(h, `bei ${d.toFixed(2)} m kommt die Kralle nur auf ${h.toFixed(2)} m`).toBeGreaterThan(
        KRONE
      );
    }
  });

  it("die offene Deckelklappe steht dem Greifer nicht im Weg", () => {
    /*
     * Sie schwingt 3,85 m über die Mitte hinaus und legt sich dort flach hin.
     * Bei `PRESS_ROT` = 90 Grad zeigt sie nach WESTEN, also vom Sitz weg: Der
     * Greifer kommt von Nordosten. Geprüft wird, dass zwischen Sitz und Kammer
     * nichts von ihr liegt — und dass sie selbst frei schwingt, also kein
     * Bauwerk in ihrem Weg steht.
     */
    expect(Math.abs(PRESS_ROT - Math.PI / 2), "die Maschine steht nicht mehr quer").toBeLessThan(
      1e-6
    );
    const kx = PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG;
    const kz = PRESS_CENTER.z + KLAPPE_RICHTUNG.z * KLAPPE_WEG;
    // Sie liegt auf der baggerabgewandten Seite: weiter weg als die Kammer.
    expect(abstandVomStand(kx, kz), "die Klappe fällt zum Sitz hin").toBeGreaterThan(
      abstandVomStand(PRESS_CENTER.x, PRESS_CENTER.z)
    );
    // Auf der Sitzseite der Kammer ist nichts von ihr.
    const richtung = Math.atan2(BAGGER_STAND.x - PRESS_CENTER.x, BAGGER_STAND.z - PRESS_CENTER.z);
    const klappe = Math.atan2(KLAPPE_RICHTUNG.x, KLAPPE_RICHTUNG.z);
    let winkel = Math.abs(((richtung - klappe) * 180) / Math.PI);
    if (winkel > 180) winkel = 360 - winkel;
    expect(winkel, `Klappe schwingt nur ${winkel.toFixed(0)} Grad neben der Sitzrichtung`)
      .toBeGreaterThan(90);
    // Und dort, wo sie hinfällt, steht kein Bauwerk.
    for (let t = 0.4; t <= 1.0001; t += 0.1) {
      const x = PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG * t;
      const z = PRESS_CENTER.z + KLAPPE_RICHTUNG.z * KLAPPE_WEG * t;
      if (Math.abs(x - PRESS_CENTER.x) < PRESS_FUSS.hw && Math.abs(z - PRESS_CENTER.z) < PRESS_FUSS.hd)
        continue;
      expect(hitsObstacle(x, z, 0), `die Klappe schlägt bei (${x.toFixed(2)} | ${z.toFixed(2)}) an`)
        .toBeNull();
    }
  });

  it("für Fahrzeuge bleibt sie zu — der Umriss passt nicht hinein", () => {
    /*
     * Was für den Greifer offen ist, muss für den LKW weiter zu sein. Zwei
     * Prüfungen:
     *
     *  1. Kein Wagen bekommt seinen Umriss in die Kammer, ohne eine Wand zu
     *     schneiden. Der längste Wagen ist der Kipper: 6,00 m Ladefläche, mit
     *     Kabine und Unterfahrschutz 8,04 m lang und 3,10 m breit — die lichte
     *     Kammer misst 4,05 × 4,20 m.
     *  2. Wer mit dem Tastradius der Fahrzeuge (1,40 m) auf die Presse zu
     *     fährt, wird angehalten, bevor er sie berührt.
     */
    const laenge = bedLenFor("kipper") / 2 + 1.9 + (bedLenFor("kipper") / 2 + 0.14);
    expect(laenge).toBeCloseTo(8.04, 6);
    expect(laenge, "der Wagen wäre kürzer als die Kammer").toBeGreaterThan(2 * PRESS_KAMMER.hd);
    expect(3.1, "der Wagen wäre schmaler als die Kammer").toBeLessThan(2 * PRESS_KAMMER.hw);
    /*
     * Ein 8,04 m langer Wagen in einer 4,20 m langen Kammer: Er ragt in jeder
     * Lage über mindestens eine Wand hinaus. Abgetastet werden seine Mittel-
     * und Endpunkte auf einem Raster über die ganze Kammer, in acht
     * Richtungen.
     */
    for (let dx = -PRESS_KAMMER.hw; dx <= PRESS_KAMMER.hw + 1e-9; dx += 0.5) {
      for (let dz = -PRESS_KAMMER.hd; dz <= PRESS_KAMMER.hd + 1e-9; dz += 0.5) {
        for (let k = 0; k < 8; k++) {
          const w = (k * Math.PI) / 4;
          let getroffen = false;
          for (const l of [-laenge / 2, -laenge / 4, 0, laenge / 4, laenge / 2]) {
            const x = PRESS_CENTER.x + dx + Math.sin(w) * l;
            const z = PRESS_CENTER.z + dz + Math.cos(w) * l;
            if (hitsObstacle(x, z, 1.55 - 0.05)) getroffen = true;
          }
          expect(
            getroffen,
            `ein LKW stünde frei in der Presse bei (${dx.toFixed(1)} | ${dz.toFixed(1)}), ${(
              (w * 180) /
              Math.PI
            ).toFixed(0)} Grad`
          ).toBe(true);
        }
      }
    }
  });
});
