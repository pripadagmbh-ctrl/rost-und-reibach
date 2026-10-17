/**
 * Der Fünfschalengreifer nach dem Zusammenlegen — Form unverändert (E-053).
 *
 * Dieses Paket soll UNSICHTBAR sein: 217 Netze werden zu 58, und es darf
 * niemand ansehen können. Dafür prüfen hier drei Dinge, in dieser Reihenfolge:
 *
 *   1. **Dreieck für Dreieck dieselbe Form.** Der zusammengelegte Greifer wird
 *      dem Greifer in Einzelteilen gegenübergestellt — über den ganzen
 *      Öffnungsweg, mit Werkstoff, in Weltkoordinaten. Das ist der schärfste
 *      Wächter, den es für diese Frage gibt: Er vergleicht nicht Kennzahlen,
 *      sondern jeden einzelnen Eckpunkt.
 *   2. **Die absoluten Formzahlen** aus E-039 und E-048 — nicht „vorher gleich
 *      nachher", sondern die Werte selbst. Wer beide Fassungen gleichzeitig
 *      verbiegt, kommt an (1) vorbei, an diesen Zahlen nicht.
 *   3. **Die Netzzahl je Baugruppe.** Sonst schleicht sich das Zusammenlegen
 *      Stück für Stück wieder heraus, ohne dass es auffällt.
 *
 * Gemessen wird über KNOTENNAMEN (`07_ZAHN`), nicht über Extrempunkte. Am
 * 14.09.2026 ist an dieser Baugruppe ein Messwerkzeug weggeworfen worden, weil
 * es „äußerster Punkt = Spitze" annahm — bei einer nach innen gekrümmten
 * Schale ist das die Rückseite.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { baueGreifer, baueGreiferInTeilen, hebelarm, zylinderNeigung } from "../src/fuenfschalen/rig";
import { MASS, OFFEN, ZU, stoffe } from "../src/fuenfschalen/teile";
import { fuenfschalen, miss } from "../tools/greifer-modelle";

/** Ein Dreieck in Weltkoordinaten, mit dem Werkstoff, der es trägt. */
type Dreieck = { stoff: string; p: number[] };

function dreiecke(wurzel: THREE.Object3D): Dreieck[] {
  wurzel.updateMatrixWorld(true);
  const raus: Dreieck[] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const stoff = (m.material as THREE.Material).name;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const p: number[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        p.push(v.x, v.y, v.z);
      }
      raus.push({ stoff, p });
    }
  });
  return raus;
}

/**
 * Kantenlänge der Fächer, in die Dreiecke zum Wiederfinden einsortiert werden.
 *
 * NICHT sortieren und Stelle für Stelle vergleichen — das war der erste
 * Versuch und es war falsch: Zwei Dreiecke, die auf 30 Nanometer gleich sind,
 * können in der Sortierung die Plätze tauschen, und ab da vergleicht man
 * Nachbarn statt Partner. Der Wächter meldete 0,78 m Abweichung an einer Form,
 * die auf 30 nm stimmt. Stattdessen wird jeder Partner in seinem Fach gesucht:
 * 0,1 mm ist grob genug, dass er nie weiter als ein Fach daneben liegt, und
 * fein genug, dass in einem Fach nur eine Handvoll Dreiecke steht.
 */
const FACH = 1e-4;

/** Dreiecke nach dem Fach ihres Schwerpunkts, je Werkstoff. */
function faecher(liste: Dreieck[]): Map<string, Dreieck[]> {
  const raus = new Map<string, Dreieck[]>();
  for (const d of liste) {
    const k = fachName(d);
    const l = raus.get(k);
    if (l) l.push(d);
    else raus.set(k, [d]);
  }
  return raus;
}

function fachName(d: Dreieck, dx = 0, dy = 0, dz = 0): string {
  const cx = Math.round((d.p[0]! + d.p[3]! + d.p[6]!) / 3 / FACH) + dx;
  const cy = Math.round((d.p[1]! + d.p[4]! + d.p[7]!) / 3 / FACH) + dy;
  const cz = Math.round((d.p[2]! + d.p[5]! + d.p[8]!) / 3 / FACH) + dz;
  return `${d.stoff}|${cx},${cy},${cz}`;
}

describe("Fünfschalen — zusammengelegt ist dieselbe Form (E-053)", () => {
  it("zeigt in jeder Stellung genau dieselben Dreiecke wie der Greifer in Einzelteilen", () => {
    const einzeln = baueGreiferInTeilen(stoffe());
    const ganz = baueGreifer(stoffe());
    let groessteAbweichung = 0;
    let ohnePartner = 0;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      einzeln.setOeffnung(t);
      ganz.setOeffnung(t);
      const a = dreiecke(einzeln.wurzel);
      const b = dreiecke(ganz.wurzel);
      expect(b.length, `Dreieckszahl bei Öffnung ${t}`).toBe(a.length);
      const abgelegt = faecher(a);
      const benutzt = new Set<Dreieck>();
      for (const d of b) {
        let partner: Dreieck | null = null;
        let nah = Infinity;
        for (let dx = -1; dx <= 1 && !partner; dx++) {
          for (let dy = -1; dy <= 1 && !partner; dy++) {
            for (let dz = -1; dz <= 1 && !partner; dz++) {
              for (const k of abgelegt.get(fachName(d, dx, dy, dz)) ?? []) {
                if (benutzt.has(k)) continue;
                let ab = 0;
                for (let i = 0; i < 9; i++) ab = Math.max(ab, Math.abs(k.p[i]! - d.p[i]!));
                if (ab < nah) nah = ab;
                if (ab < 1e-6) {
                  partner = k;
                  break;
                }
              }
            }
          }
        }
        if (partner) {
          benutzt.add(partner);
          groessteAbweichung = Math.max(groessteAbweichung, nah);
        } else {
          ohnePartner++;
        }
      }
      expect(
        ohnePartner,
        `bei Öffnung ${t} haben ${ohnePartner} Dreiecke keinen Partner in den Einzelteilen`
      ).toBe(0);
    }
    /*
     * 1 µm. Beide Fassungen rechnen dieselbe starre Bewegung, nur an anderer
     * Stelle — einmal beim Bauen in den Eckpunktpuffer gebacken, einmal beim
     * Zeichnen über die Weltmatrix. Was bleibt, ist die Rundung einfacher
     * Genauigkeit: gemessen 0,03 µm, also ein Dreißigstel dieser Schranke.
     */
    expect(
      groessteAbweichung,
      `größte Abweichung eines Eckpunkts: ${(groessteAbweichung * 1e6).toFixed(3)} µm`
    ).toBeLessThan(1e-6);
  });

  it("legt nur zusammen, was sich nicht gegeneinander bewegt", () => {
    /*
     * Der Gegenbeweis zur Zusammenlegung: Wäre ein bewegtes Teil in ein
     * fremdes Netz geraten, stünde es beim Öffnen still. Geprüft an den drei
     * Bewegungen, die der Greifer hat — Schale schwenkt, Kolbenstange fährt
     * aus, Rotator dreht.
     */
    const g = baueGreifer(stoffe());
    const huelle = (o: THREE.Object3D): THREE.Box3 => {
      g.wurzel.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(o);
    };
    /* Richtung der Rohrachse in der Welt — das Rohr zeigt in seinem Frame nach −y. */
    const achse = (o: THREE.Object3D): THREE.Vector3 => {
      g.wurzel.updateMatrixWorld(true);
      const fuss = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      return new THREE.Vector3(0, -1, 0)
        .applyMatrix4(o.matrixWorld)
        .sub(fuss)
        .normalize();
    };
    g.setOeffnung(0);
    const schaleZu = huelle(g.schalen[0]!.gelenk).clone();
    const augeZu = huelle(g.zylinder[0]!.auge).getCenter(new THREE.Vector3());
    const rohrZu = achse(g.zylinder[0]!.rohr);
    g.setOeffnung(1);
    const schaleAuf = huelle(g.schalen[0]!.gelenk);
    const augeAuf = huelle(g.zylinder[0]!.auge).getCenter(new THREE.Vector3());
    const rohrAuf = achse(g.zylinder[0]!.rohr);
    expect(schaleAuf.max.y - schaleZu.max.y, "die Schale schwenkt nicht mehr").toBeGreaterThan(0.3);
    expect(augeAuf.distanceTo(augeZu), "die Kolbenstange fährt nicht mehr").toBeGreaterThan(0.1);
    /*
     * Das Rohr schwenkt von 20,71° auf 15,39° gegen die Senkrechte (E-039) —
     * 5,3°, und zwar als starre Drehung seines ganzen Netzes.
     */
    expect(
      (rohrZu.angleTo(rohrAuf) * 180) / Math.PI,
      "das Zylinderrohr schwenkt nicht mehr"
    ).toBeCloseTo(5.32, 1);
    g.setDrehung(Math.PI / 2);
    g.wurzel.updateMatrixWorld(true);
    const adapter = new THREE.Box3().setFromObject(g.adapter);
    const kopf = new THREE.Box3().setFromObject(g.traverse);
    expect(kopf.max.y, "der Kopf ist beim Drehen verschwunden").toBeGreaterThan(-1.2);
    expect(adapter.max.y, "der Adapter hängt nicht mehr oben").toBeGreaterThan(-0.1);
  });
});

describe("Fünfschalen — die Formzahlen nach dem Zusammenlegen (E-039, E-048)", () => {
  /*
   * Absolute Zahlen, keine Vergleiche. Sie stehen in E-039 („Die fünf
   * Unveränderlichen") und in E-048; gemessen wird am ZUSAMMENGELEGTEN
   * Greifer, also an dem, der ausgeliefert wird.
   */
  const g = baueGreifer(stoffe());
  const SCHRITTE = 40;

  it("gräbt 2,7439 m tief, ist geschlossen 2,5451 m hoch und dreht in Ø 3,3064 m", () => {
    let grabtiefe = 0;
    let huellkreis = 0;
    let hoch = 0;
    let tief = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i <= SCHRITTE; i++) {
      g.setOeffnung(i / SCHRITTE);
      g.wurzel.updateMatrixWorld(true);
      let yMin = Infinity;
      let yMax = -Infinity;
      g.wurzel.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
          huellkreis = Math.max(huellkreis, 2 * Math.hypot(v.x, v.z));
          yMin = Math.min(yMin, v.y);
          yMax = Math.max(yMax, v.y);
        }
      });
      /* Die Grabtiefe über den KNOTEN `07_ZAHN`, nicht über den tiefsten Punkt. */
      for (const zahn of zaehne(g)) {
        zahn.updateWorldMatrix(true, false);
        const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < pos.count; k++) {
          grabtiefe = Math.max(
            grabtiefe,
            -v.fromBufferAttribute(pos, k).applyMatrix4(zahn.matrixWorld).y
          );
        }
      }
      if (i === 0) {
        hoch = yMax;
        tief = yMin;
      }
    }
    /* 2,7511 → 2,7069 mit E-069: Der Zahn sitzt tangential (siehe teile.ts). */
    /* 2,7069 → 2,7439 mit E-090 (Trog + 60 % Saum). */
    expect(grabtiefe, "Grabtiefe").toBeCloseTo(2.7439, 4);
    /* 2,505 → 2,5451 mit E-090. */
    expect(hoch - tief, "Bauhöhe geschlossen").toBeCloseTo(2.5451, 3);
    /* 3,232 → 3,2262: die Zahnspitze dreht nicht mehr nach aussen (E-069). */
    /* 3,2262 → 3,3064 mit E-090: der Saum ist doppelt so breit und schwenkt weiter aus. */
    expect(huellkreis, "größter gezeichneter Durchmesser über den Weg").toBeCloseTo(3.3064, 3);
  });

  it("lässt die fünf Spitzen geschlossen 137,6 mm von der Achse zusammenkommen", () => {
    /*
     * Die LETZTEN fünf Punkte des Zahnkörpers sind sein Spitzenring — so legt
     * `baueGreiferspitze` sie ab, genau für diese Messung. Gemessen wird ihr
     * Schwerpunkt, nicht ihr äußerster Eckpunkt.
     */
    g.setOeffnung(0);
    g.wurzel.updateMatrixWorld(true);
    let weit = 0;
    for (const zahn of zaehne(g)) {
      zahn.updateWorldMatrix(true, false);
      const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
      const mitte = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (let i = pos.count - 5; i < pos.count; i++) {
        mitte.add(v.fromBufferAttribute(pos, i).applyMatrix4(zahn.matrixWorld));
      }
      weit = Math.max(weit, Math.hypot(mitte.x / 5, mitte.z / 5));
    }
    /* 142,3 → 137,6 mm mit E-069 — sie treffen sich naeher, nicht weiter. */
    /* 137,6 → 142,3 mm mit E-090: der breitere Saum schiebt sie wieder auseinander. */
    /*
     * 142,3 → 175,4 mm mit E-137 — und das ist der MESSPUNKT, nicht die Spitze.
     * Die letzten fuenf Punkte sind seit dem Umbau auf eigene Flaechenpunkte
     * nicht mehr der Spitzenring, sondern das Ende des letzten Seitenstreifens
     * (vier von fuenf liegen auf den beiden Stationen VOR dem Ende). E-137 macht
     * den Zahn dort breiter und legt eine Station dazwischen; damit wandert der
     * Streifen. Der wirkliche Spitzenring (Punkte 5–9, siehe `baueGreiferspitze`)
     * steht vorher und nachher auf 193,55 mm — der Waechter darunter.
     */
    expect(weit * 1000, "Spitzenabstand von der Achse, geschlossen (mm)").toBeCloseTo(175.4, 1);
  });

  it("E-137: der wirkliche Spitzenring steht, wo er stand — 193,55 mm", () => {
    g.setOeffnung(0);
    g.wurzel.updateMatrixWorld(true);
    let weit = 0;
    for (const zahn of zaehne(g)) {
      zahn.updateWorldMatrix(true, false);
      const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
      const mitte = new THREE.Vector3();
      const v = new THREE.Vector3();
      // Punkte 5–9: die Stirnflaeche an der Spitze (die ersten fuenf sind der Sitz)
      for (let i = 5; i < 10; i++) mitte.add(v.fromBufferAttribute(pos, i).applyMatrix4(zahn.matrixWorld));
      weit = Math.max(weit, Math.hypot(mitte.x / 5, mitte.z / 5));
    }
    expect(weit * 1000, "Spitzenring von der Achse, geschlossen (mm)").toBeCloseTo(193.55, 1);
  });

  it("nutzt 26,34° seines 36°-Sektors", () => {
    const SEKTOR_HALB = Math.PI / MASS.schalen;
    /* Näher als 0,30 m an der Achse laufen die Spitzen geschlossen ineinander. */
    const SEKTOR_AB = 0.3;
    let engste = Infinity;
    const v = new THREE.Vector3();
    for (let s = 0; s <= 20; s++) {
      g.setOeffnung(s / 20);
      g.wurzel.updateMatrixWorld(true);
      for (const schale of g.schalen) {
        schale.gelenk.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            if (Math.hypot(v.x, v.z) < SEKTOR_AB) continue;
            let d = Math.atan2(v.x, v.z) - schale.winkel;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            engste = Math.min(engste, SEKTOR_HALB - Math.abs(d));
          }
        });
      }
    }
    expect(((SEKTOR_HALB - engste) * 180) / Math.PI, "genutzter Sektor (Grad)").toBeCloseTo(
      /* 26,34 → 26,52 Grad mit E-090 — weiterhin weit unter der Grenze von 36. */
      26.52,
      2
    );
  });

  it("behält Zylinderneigung 15,4 / 20,7 / 24,4° und Hebelarm 0,201 / 0,118 m", () => {
    /*
     * Die Kinematik rührt das Zusammenlegen nicht an — sie steht in `rig.ts`
     * und rechnet mit Zahlen, nicht mit Netzen. Genau deshalb steht sie hier:
     * Wer beim Aufräumen an den Anlenkpunkten dreht, merkt es an dieser Zeile.
     */
    let groesste = 0;
    for (let i = 0; i <= 200; i++) {
      groesste = Math.max(groesste, zylinderNeigung(ZU + ((OFFEN - ZU) * i) / 200));
    }
    expect((zylinderNeigung(OFFEN) * 180) / Math.PI, "Neigung offen").toBeCloseTo(15.4, 1);
    expect((zylinderNeigung(ZU) * 180) / Math.PI, "Neigung geschlossen").toBeCloseTo(20.7, 1);
    expect((groesste * 180) / Math.PI, "größte Neigung").toBeCloseTo(24.4, 1);
    expect(hebelarm(ZU), "Hebelarm geschlossen").toBeCloseTo(0.201, 3);
    expect(hebelarm(OFFEN), "Hebelarm offen").toBeCloseTo(0.118, 3);
  });

  it("fasst netto 1.512 l", () => {
    /*
     * Der Nettokorb kommt aus einem Strahlraster durch den ganzen Körper
     * (`tools/greifer-modelle.miss`, 2-cm-Raster) — die einzige Zahl hier, die
     * die Netze nicht über ihre Eckpunkte, sondern über ihr VOLUMEN prüft.
     * Ein verlorenes, doppeltes oder falsch herum gewickeltes Netz fällt
     * dadurch auf. Sie kostet rund 25 s; sie ist es wert.
     */
    const m = miss(fuenfschalen());
    /*
     * 1.525 → 1.512 l mit E-090: Der aufgestellte Rand nimmt dem Korb 13 l.
     * Kein Verlust durch Schlamperei, sondern die Rechnung der Halbschale — das
     * Blech, das jetzt am Saum aufsteht, stand vorher in der Flaeche und zaehlte
     * als Hohlraum mit. Der BRUTTOkorb bleibt bei 1.615 l: Von aussen ist die
     * Schale gleich gross, innen sitzt mehr Stahl.
     */
    expect(m.nettokorb * 1000, "Nettokorb (l)").toBeCloseTo(1512, 0);
    expect(m.bruttokorb * 1000, "Bruttokorb (l)").toBeCloseTo(1615, 0);
    /*
     * 14.884 + 120 = 15.004 seit E-077: Der Zylinderschutz (`08_VERKLEIDUNG`,
     * zehn Flächen über ein geschlossenes Profil aus sechs Punkten) bringt
     * genau 120 Dreiecke mit. NETZE bringt er keines mit — er fällt ins Blech
     * des Kopfes, und die Zeile „58 Netze" weiter unten steht unverändert da.
     * Dreiecke sind nicht der Engpass (E-025), Netze sind es.
     */
    /*
     * 15.004 → 16.524 mit E-090: acht Felder quer statt vier, damit der
     * aufgestellte Rand des Trogs ueberhaupt darstellbar ist. +1.520 Dreiecke
     * (+10,1 %) und KEIN einziges Netz — die Zeile "58 Netze" unten steht
     * unveraendert da. Dreiecke sind nicht der Engpass, Netze sind es (E-025).
     */
    /* 16.524 → 16.574 mit E-137: eine Zahnstation mehr, 10 Dreiecke je Zahn. */
    expect(m.dreiecke, "Dreiecke").toBe(16574);
  }, 120000);
});

describe("Fünfschalen — ein Netz je Starrkörper und Werkstoff (E-025, E-053)", () => {
  it("steht bei 58 Netzen, aufgeteilt wie festgelegt", () => {
    const g = baueGreifer(stoffe());
    const zaehl = (o: THREE.Object3D): number => {
      let n = 0;
      o.traverse((k) => {
        if ((k as THREE.Mesh).isMesh) n++;
      });
      return n;
    };
    const finde = (name: string): THREE.Object3D => {
      const o = g.wurzel.getObjectByName(name);
      if (!o) throw new Error(`${name} fehlt`);
      return o;
    };
    /*
     * Die Aufteilung, Baugruppe für Baugruppe. Sie ist keine Schätzung: Sie
     * folgt daraus, wie viele WERKSTOFFE jeder Starrkörper trägt.
     *
     *   ADAPTER        4  Guss, Blech, Bolzen, Naht
     *   GRAPPLE_HEAD   4  dieselben vier — Rotator, Gehäuse, Traverse und
     *                     Stempel sind EIN Starrkörper
     *   SHELL_BODY_nn  2  Guss (Zinken, Augen, Konsole) und Blech (Haut)
     *   SHELL_TIP_nn   1  der Zahn bleibt eigenständig: an ihm wird die
     *                     Grabtiefe gemessen
     *   CYL_BARREL_nn  5  Lack, Blech, Guss, Naht, Bolzen
     *   CYL_ROD_nn     2  Schaft (wird gedehnt) und Auge (wird gesetzt) —
     *                     zwei eigene Bewegungen, also zwei Netze
     */
    expect(zaehl(finde("ADAPTER")), "ADAPTER").toBe(4);
    expect(zaehl(finde("GRAPPLE_HEAD")), "GRAPPLE_HEAD").toBe(4);
    for (let i = 1; i <= MASS.schalen; i++) {
      const nr = String(i).padStart(2, "0");
      expect(zaehl(finde(`SHELL_BODY_${nr}`)), `SHELL_BODY_${nr}`).toBe(2);
      expect(zaehl(finde(`SHELL_TIP_${nr}`)), `SHELL_TIP_${nr}`).toBe(1);
      expect(zaehl(finde(`CYL_BARREL_${nr}`)), `CYL_BARREL_${nr}`).toBe(5);
      expect(zaehl(finde(`CYL_ROD_${nr}`)), `CYL_ROD_${nr}`).toBe(2);
    }
    expect(zaehl(g.wurzel), "Netze im ganzen Greifer").toBe(58);
    /* Zum Vergleich: so viele waren es vorher, und so viele hat die Sichelkralle. */
    /*
     * 218 seit E-077 (vorher 217): In Einzelteilen ist der Zylinderschutz ein
     * eigenes Netz — zusammengelegt ist er keines mehr. Genau dieser
     * Unterschied ist der Beweis, dass er eingeschmolzen wird; wären beide
     * Zahlen gleich, hätte das Zusammenlegen ihn übersehen.
     */
    expect(zaehl(baueGreiferInTeilen(stoffe()).wurzel), "Netze in Einzelteilen").toBe(218);
  });

  it("behält die Knotennamen, auf die der GLB-Export sich verlässt", () => {
    const g = baueGreifer(stoffe());
    const soll = ["ADAPTER", "ROTATOR", "GRAPPLE_HEAD"];
    for (let i = 1; i <= MASS.schalen; i++) {
      const nr = String(i).padStart(2, "0");
      soll.push(
        `SHELL_${nr}`,
        `SHELL_BODY_${nr}`,
        `SHELL_TIP_${nr}`,
        `07_ZAHN`,
        `CYLINDER_${nr}`,
        `CYL_BARREL_${nr}`,
        `CYL_ROD_${nr}`,
        `CYL_ROD_SHAFT_${nr}`,
        `CYL_ROD_EYE_${nr}`
      );
    }
    for (const name of soll) {
      expect(g.wurzel.getObjectByName(name), `Knoten ${name} fehlt`).toBeTruthy();
    }
  });
});

/** Die fünf Zahnkörper, über ihren Knotennamen gesucht. */
function zaehne(g: ReturnType<typeof baueGreifer>): THREE.Mesh[] {
  return g.schalen.map((_s, i) => {
    const nr = String(i + 1).padStart(2, "0");
    const zahn = g.wurzel.getObjectByName(`SHELL_TIP_${nr}`)?.getObjectByName("07_ZAHN");
    if (!zahn) throw new Error(`07_ZAHN in SHELL_TIP_${nr} fehlt`);
    return zahn as THREE.Mesh;
  });
}
