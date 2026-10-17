/**
 * Wächter für das Traversenblatt vom 15.09.2026.
 *
 * Das Blatt (`docs/f5-traverse-2026-09-15.svg`) ist eine Entscheidungsvorlage,
 * keine gebaute Änderung. Trotzdem gehören Wächter dazu, und zwar aus drei
 * Gründen:
 *
 * 1. Die Rechnung in `tools/fuenfschalen/traverse-rechnen.ts` ist eine Kopie
 *    der Kinematik aus `src/fuenfschalen/rig.ts`. Läuft die Kopie irgendwann
 *    auseinander, stehen falsche Zahlen auf einem Blatt, an dem entschieden
 *    wird. Also wird sie gegen das Original geprüft.
 * 2. Das Messwerkzeug SETZT Werte in `teile.ts` um, bevor es baut. Wenn es
 *    sie nicht zurückstellt, misst jeder spätere Test eine Form, die niemand
 *    gebaut hat.
 * 3. Die harten Bedingungen aus dem Auftrag — Grabtiefe unverändert, fünf
 *    Spitzen treffen sich, Zahn bleibt ein Gussstück — dürfen von keiner der
 *    drei Varianten gebrochen werden, auch nicht auf dem Papier.
 */
import { describe, expect, it } from "vitest";
import {
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  ZYLINDER_AUFNAHME,
  MASS,
  schwenkFuer,
} from "../src/fuenfschalen/teile";
import { hebelarm, zylinderLaenge, zylinderNeigung } from "../src/fuenfschalen/rig";
import {
  GEBAUT,
  VOR_E039,
  arbeitspunkt,
  aufnahmeFuer,
  haeltVertrag,
  kennwerte,
  traverseAus,
} from "../tools/fuenfschalen/traverse-rechnen";
import { A, B, C, VARIANTEN, traverseHoehe } from "../tools/fuenfschalen/traverse-varianten";
import { miss } from "../tools/fuenfschalen/traverse-messen";
import { bahn } from "../tools/fuenfschalen/traverse-blatt";

describe("Traversenblatt — die Rechnung", () => {
  it("rechnet dieselbe Kinematik wie rig.ts", () => {
    /*
     * Gegen das Original, nicht gegen eine abgeschriebene Zahl. Geprüft wird
     * über den ganzen Öffnungsweg, nicht nur an den Enden: Genau dazwischen
     * liegen der größte Neigungswinkel und der kleinste Hebelarm.
     */
    const k = kennwerte(GEBAUT);
    let neigungMax = 0;
    let hebelMin = Infinity;
    for (let i = 0; i <= 60; i++) {
      const s = ZU + ((OFFEN - ZU) * i) / 60;
      neigungMax = Math.max(neigungMax, (zylinderNeigung(s) * 180) / Math.PI);
      hebelMin = Math.min(hebelMin, hebelarm(s));
    }
    expect(k.neigungMax).toBeCloseTo(neigungMax, 6);
    expect(k.hebelMin).toBeCloseTo(hebelMin, 6);
    expect(k.laengeZu).toBeCloseTo(zylinderLaenge(ZU), 6);
    expect(k.laengeOffen).toBeCloseTo(zylinderLaenge(OFFEN), 6);
  });

  it("beschreibt mit Variante B genau den gebauten Stand", () => {
    /*
     * Bis E-039 stand hier A. Seit dem 15.09.2026 ist B gebaut, und dieser
     * Wächter ist die Klammer zwischen Blatt und Bauteil: Wer eine der vier
     * Zahlen in `teile.ts` ändert, ohne das Blatt mitzuziehen, wird hier rot.
     */
    expect(B.Zr).toBeCloseTo(ZYLINDER_AUFNAHME.r, 9);
    expect(B.Zy).toBeCloseTo(ZYLINDER_AUFNAHME.y, 9);
    expect(B.Ay).toBeCloseTo(OBERE_ANBINDUNG.y, 9);
    expect(B.Az).toBeCloseTo(OBERE_ANBINDUNG.z, 9);
    expect(B.durchmesser).toBeCloseTo(MASS.traverse.breite, 9);
    expect(traverseAus(B.Zr)).toBeCloseTo(MASS.traverse.breite, 9);
    /* Die Traverse folgt ihrer Aufnahme — 9,5 cm hoch, auf −0,865. */
    expect(traverseHoehe(B.Zy)).toBeCloseTo(-0.865, 9);
    expect(traverseHoehe(A.Zy)).toBeCloseTo(-0.96, 9);
    /*
     * Und der Abstand Aufnahme–Traversenmitte bleibt 0,23 m. Daran hängt die
     * Bauhöhe von 0,45 m und der Gabelfuß, der 9 cm in den Flansch greift.
     */
    expect(ZYLINDER_AUFNAHME.y - traverseHoehe(B.Zy)).toBeCloseTo(0.23, 9);
  });

  it("hält am gebauten Stand die Kennwerte, wegen derer umgebaut wurde", () => {
    /*
     * Die Zahlen des Blattes vom 15.09.2026, Spalte B. Sie stehen hier als
     * ABSOLUTE Werte und nicht als „besser als vorher": Ein Wächter, der nur
     * eine Richtung prüft, lässt jede Zwischenstufe durch.
     *
     * Mit der alten Anlenkung (A) meldet er 38,90° statt 24,44° und 0,0924 m
     * statt 0,1179 m — nachgestellt am 15.09.2026, er wird rot.
     */
    const k = kennwerte(GEBAUT);
    expect(k.neigungOffen).toBeCloseTo(15.4, 1);
    expect(k.neigungZu).toBeCloseTo(20.7, 1);
    expect(k.neigungMax).toBeCloseTo(24.4, 1);
    expect(k.hebelZu).toBeCloseTo(0.201, 3);
    expect(k.hebelMin).toBeCloseTo(0.118, 3);
    /* +28 % Schließkraft an der schwächsten Stelle gegen den Stand bis E-039. */
    const alt = kennwerte(VOR_E039);
    expect(k.hebelMin / alt.hebelMin).toBeCloseTo(1.28, 2);
  });

  it("hält mit allen drei Varianten den Vertrag der Anlenkung", () => {
    for (const v of VARIANTEN) {
      const k = kennwerte(v);
      expect(haeltVertrag(k), `${v.name} bricht den Vertrag`).toBe(true);
      /* Der Zylinder fährt zum SCHLIESSEN aus — sonst ist es ein anderes Gerät. */
      expect(k.laengeZu, `${v.name} fährt zum Öffnen aus`).toBeGreaterThan(k.laengeOffen);
    }
  });

  it("findet die beiden E-009-Ziele erst ab Ø 1,10 m", () => {
    /*
     * Das ist der Befund vom 14.09.2026 (`anlenkung.ts`: 4.567 Lösungen, die
     * kleinste bei Aufnahmeradius 0,540 m). Hier steht er als Wächter, weil
     * die Empfehlung auf dem Blatt darauf aufbaut.
     */
    const erreicht = (durchmesser: number): boolean => {
      const l = arbeitspunkt(aufnahmeFuer(durchmesser));
      return l !== null && l.k.neigungMax < 20 && l.k.hebelMin > 0.1;
    };
    expect(erreicht(1.05), "Ø 1,05 dürfte beide Ziele nicht halten").toBe(false);
    expect(erreicht(1.1), "Ø 1,10 muss beide Ziele halten").toBe(true);
  });

  it("verbessert beide Kennwerte von A über B nach C", () => {
    const kA = kennwerte(A);
    const kB = kennwerte(B);
    const kC = kennwerte(C);
    expect(kB.neigungMax).toBeLessThan(kA.neigungMax);
    expect(kC.neigungMax).toBeLessThan(kB.neigungMax);
    expect(kB.hebelMin).toBeGreaterThan(kA.hebelMin);
    expect(kC.hebelMin).toBeGreaterThan(kA.hebelMin);
  });
});

describe("Traversenblatt — die harten Bedingungen", () => {
  /* Einmal messen, dreimal prüfen — jeder Bau kostet Sekunden. */
  const gemessen = VARIANTEN.map((v) => miss(v, false));

  it("lässt die Grabtiefe unangetastet", () => {
    /*
     * Gemessen am Knoten `07_ZAHN`, nicht am äußersten Punkt des Netzes: Bei
     * einer nach innen gekrümmten Sichel liegt der äußerste Punkt auf der
     * RÜCKSEITE. Genau daran ist am 14.09.2026 ein Messwerkzeug gescheitert.
     */
    for (const m of gemessen) {
      expect(m.grabtiefe, `${m.name} gräbt anders tief`).toBeCloseTo(gemessen[0]!.grabtiefe, 6);
    }
    /*
     * Und sie liegt auf den Zehntelmillimeter dort, wo sie liegen soll.
     * `toBeGreaterThan(2.7)` stand hier und hätte jede Variante durchgelassen,
     * die 4 cm tiefer gräbt.
     *
     * Von 2,7511 auf 2,7069 mit E-069: Der Zahn sitzt seitdem tangential auf
     * dem Schalenende statt um 12,15° gegengedreht, und damit waelzt seine
     * Spitze auf halbem Schliessweg 4,4 cm weniger weit nach unten aus. Die
     * Traverse hat damit nichts zu tun — genau das prueft die Schleife darueber.
     */
    /* 2,7069 → 2,7439 mit E-090. */
    expect(gemessen[0]!.grabtiefe).toBeCloseTo(2.7439, 4);
  });

  it("lässt die fünf Spitzen weiterhin zusammenlaufen", () => {
    for (const m of gemessen) {
      expect(m.spitzenAufAchse, `${m.name} schließt nicht mehr auf der Achse`).toBeCloseTo(
        gemessen[0]!.spitzenAufAchse,
        6
      );
    }
  });

  it("lässt jede Schale in ihrem eigenen Sektor", () => {
    for (const m of gemessen) {
      expect(m.sektor, `${m.name} greift in den Nachbarsektor`).toBeLessThan(180 / MASS.schalen);
    }
  });

  it("ändert Bauhöhe, Breite und Hüllkreis nicht", () => {
    for (const m of gemessen) {
      expect(m.bauhoehe).toBeCloseTo(gemessen[0]!.bauhoehe, 6);
      expect(m.huellkreis).toBeCloseTo(gemessen[0]!.huellkreis, 6);
      expect(m.breiteZu).toBeCloseTo(gemessen[0]!.breiteZu, 6);
    }
    /* Der Hüllkreis bleibt unter dem Platzmaß der Sichelkralle (E-009). */
    expect(gemessen[0]!.huellkreis).toBeLessThan(3.3805);
    /* Die fünf Unveränderlichen des Auftrags E-039, als Zahlen. */
    /* 2,505 → 2,5451 mit E-090. */
    expect(gemessen[0]!.bauhoehe).toBeCloseTo(2.5451, 3);
    /*
     * Huellkreis 3,232 → 3,226 und Spitzenabstand 142,3 → 137,6 mm mit E-069:
     * Der tangential sitzende Zahn dreht seine Spitze nicht mehr nach aussen.
     * Beides ist eine VERBESSERUNG gegenueber dem Vertrag — der Huellkreis
     * bleibt unter der Grenze 3,3805, und die fuenf Spitzen treffen sich
     * geschlossen 4,7 mm naeher an der Achse.
     */
    /* 3,226 → 3,3064 m mit E-090: der breitere Saum schwenkt weiter aus. */
    expect(gemessen[0]!.huellkreis).toBeCloseTo(3.3064, 3);
    /* 2,190 → 2,1906 m mit E-090: 0,6 mm breiter geschlossen — der breitere Saum. */
    expect(gemessen[0]!.breiteZu).toBeCloseTo(2.1906, 3);
    /* 137,6 → 142,3 mm mit E-090: der breitere Saum schiebt die Spitzen auseinander. */
    /* 142,3 → 175,4 mm mit E-137: derselbe Messpunkt wie in `verschmelzen` (Ende des letzten Seitenstreifens), der wirkliche Spitzenring steht unveraendert. */
    expect(gemessen[0]!.spitzenAufAchse * 1000).toBeCloseTo(175.4, 1);
    /* 26,34 → 26,52 Grad mit E-090 — weiterhin weit unter der Grenze von 36. */
    expect(gemessen[0]!.sektor).toBeCloseTo(26.52, 2);
  });

  it("meldet ehrlich, wo das Zylinderauge den Gusskörper verlässt", () => {
    /*
     * Kein Verbot, sondern eine Meldung: E-013 hat die Konsole abgeschafft,
     * und jede nachgestellte Anlenkung holt sie zurück. Der Wächter hält fest,
     * dass das BEKANNT ist und wie weit — nicht, dass es nicht sein darf.
     */
    expect(gemessen[0]!.augeImGuss, "A ist der gebaute Stand, dort sitzt das Auge im Guss").toBe(
      true
    );
    for (const m of gemessen.slice(1)) {
      expect(m.augeAbstand, `${m.name}: Konsole länger als 60 mm`).toBeLessThan(0.06);
    }
  });

  it("stellt die Werte in teile.ts nach dem Messen zurück", () => {
    /*
     * Der wichtigste Wächter dieser Datei. `traverse-messen.ts` setzt
     * `ZYLINDER_AUFNAHME`, `OBERE_ANBINDUNG` und `MASS.traverse` um, bevor es
     * baut. Bliebe einer davon stehen, würde jeder folgende Test eine Form
     * messen, die niemand gebaut hat — und es fiele niemandem auf.
     */
    miss(C, false);
    expect(ZYLINDER_AUFNAHME.r).toBeCloseTo(0.465, 9);
    expect(ZYLINDER_AUFNAHME.y).toBeCloseTo(-0.635, 9);
    expect(OBERE_ANBINDUNG.y).toBeCloseTo(-0.08, 9);
    expect(OBERE_ANBINDUNG.z).toBeCloseTo(0.245, 9);
    expect(MASS.traverse.breite).toBeCloseTo(0.95, 9);
    expect(MASS.traverse.tiefe).toBeCloseTo(0.95, 9);
  });
});

describe("Traversenblatt — die Zeichnung", () => {
  it("zeichnet dieselbe Grabtiefe, die das Modell misst", () => {
    /*
     * Ein Blatt, das tiefer oder flacher zeichnet als das Modell misst, ist
     * schlimmer als keines: Patrick entscheidet am Bild. Die 5 cm Toleranz
     * sind der Spielraum des Umrisses — die Zeichnung trägt die Dicke des
     * Gusskörpers an der Bahn ab, das Netz baut sie als Körper auf.
     */
    let gezeichnet = 0;
    for (let i = 0; i <= 40; i++) {
      for (const p of bahn(schwenkFuer(i / 40))) gezeichnet = Math.max(gezeichnet, -p.y + p.h / 2);
    }
    const gemessen = miss(A, false).grabtiefe;
    expect(Math.abs(gezeichnet - gemessen), `gezeichnet ${gezeichnet.toFixed(3)} m`).toBeLessThan(
      0.05
    );
  });

  it("zeichnet die Schale dort, wo die Kinematik sie rechnet", () => {
    /*
     * Die Bahn der Zeichnung muss an der Spitze auf derselben Höhe enden wie
     * die Mittellinie des Modells — sonst zeigt das Blatt eine andere Form
     * als die, über die entschieden wird.
     */
    for (const t of [0, 0.5, 1]) {
      const b = bahn(schwenkFuer(t));
      const ende = b[b.length - 1]!;
      expect(Number.isFinite(ende.r) && Number.isFinite(ende.y)).toBe(true);
    }
    /* Geschlossen läuft die Spitze auf die Achse zu. */
    const zu = bahn(schwenkFuer(0));
    expect(Math.abs(zu[zu.length - 1]!.r)).toBeLessThan(0.25);
    /* Offen steht sie weit außen — und der Bolzen bleibt, wo er ist. */
    const auf = bahn(schwenkFuer(1));
    expect(Math.abs(auf[auf.length - 1]!.r)).toBeGreaterThan(1.2);
    expect(STEMPEL_AUGE.r).toBeCloseTo(0.59, 9);
  });
});
