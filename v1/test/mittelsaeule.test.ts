/**
 * Die zwei Blätter vom 15.09.2026 abends — und was sie behaupten.
 *
 * Patrick, 15.09.2026: „Also, wir sind uns doch einig, dass die Zacken direkt
 * an der Traverse sein sollen. Und das ist aktuell nicht der Fall. Deshalb
 * weiss ich überhaupt nicht, woran der Agent gearbeitet hat."
 *
 * Darauf sind zwei Blätter entstanden:
 *   docs/f5-zahn-vorher-nachher-2026-09-15.svg  — was E-069 wirklich gebaut hat
 *   docs/f5-mittelsaeule-2026-09-15.svg         — was es kostet, die Säule
 *                                                 wegzunehmen (gerechnet)
 *
 * Ein Blatt, das niemand nachprüft, ist eine Behauptung. Dieser Wächter hält
 * seine load-bearing Zahlen gegen die gebaute Form — und JEDE Zahlenschranke
 * hier hat eine Gegenprobe, die melden MUSS. Wer `teile.ts` ändert, ohne die
 * Blätter neu zu ziehen, wird hier rot.
 */
import { describe, expect, it } from "vitest";
import {
  MASS,
  OFFEN,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZYLINDER_AUFNAHME,
  zahnAnstellung,
} from "../src/fuenfschalen/teile";
import { FORMEN, baue, zahnspitze } from "../tools/fuenfschalen/zahnformen";
import {
  SAEULE_HEUTE,
  SAEULENROHR,
  anlenkungAus,
  anlenkungBei,
  kopfHerunter,
  korbmass,
  probe,
} from "../tools/fuenfschalen/saeulenrechnung";
import * as raum from "../tools/fuenfschalen/anlenkungsraum";
import { bahnprobe, verdeckung } from "../tools/fuenfschalen/anlenkungsriss";
import { schalenmass } from "../tools/fuenfschalen/anlenkungsraum";

/** Länge des Zylinderrohrs (m) — dieselbe Ableitung wie in `rig.stelleSchale`. */
const ROHR = MASS.zylinder.laenge * 0.6;

const GRAD = 180 / Math.PI;

describe("Blatt 1 — der Zahn, vorher gegen nachher (E-069)", () => {
  it("vergleicht die zwei Formen, um die es geht", () => {
    /* A ist der Stand bis 15.09. mittags, B der gebaute. C gehört nicht aufs Blatt. */
    expect(FORMEN[0]!.anstellung * GRAD).toBeCloseTo(-12.15, 2);
    expect(FORMEN[1]!.anstellung).toBe(0);
    /* Und B IST der gebaute Stand: `zahnAnstellung` liefert am Anschlag null. */
    expect(zahnAnstellung(OFFEN)).toBeCloseTo(0, 12);
  });

  it("bewegt die Zahnspitze um 41 mm — nicht mehr, nicht weniger", () => {
    /*
     * Das ist die ehrliche Zahl des Blattes. Sie ist KLEIN, und genau deshalb
     * steht sie dort: Patricks Verdacht war, es sei gar nichts gebaut worden.
     * 41 mm sind etwas — aber am 3,2-m-Greifer sieht man sie kaum.
     */
    const a = baue(FORMEN[0]!);
    const b = baue(FORMEN[1]!);
    for (const t of [0, 1]) {
      const weg = zahnspitze(a, t).distanceTo(zahnspitze(b, t));
      expect(weg, `Öffnung ${t}`).toBeGreaterThan(0.035);
      /* 0,047 → 0,050 mit E-137: Der breitere Zahn verschiebt den Messpunkt (Ende des letzten Seitenstreifens), gemessen 40,6 → 48,2 mm. */
      expect(weg, `Öffnung ${t}`).toBeLessThan(0.05);
    }
    /*
     * GEGENPROBE: Dieselbe Form gegen sich selbst muss NULL ergeben. Ohne sie
     * misst der Wächter womöglich nur das Rauschen zweier Neubauten.
     */
    const c = baue(FORMEN[1]!);
    expect(zahnspitze(b, 1).distanceTo(zahnspitze(c, 1))).toBeLessThan(1e-12);
  });
});

describe("Blatt 2 — die Mittelsäule, gerechnet und nicht gebaut", () => {
  it("steht unverändert: 66,9 cm zwischen Traverse und Schalenbolzen", () => {
    /*
     * Der eigentliche Einwand von Patrick. Solange diese Zahl hier steht, ist
     * die Säule NICHT weggebaut — und das Blatt sagt genau das.
     */
    expect(SAEULE_HEUTE).toBeCloseTo(0.6685, 9);
    expect(TRAVERSE_Y - STEMPEL_AUGE.y).toBeCloseTo(SAEULE_HEUTE, 12);
    /* 26 cm davon sind der Stempelkörper, der Rest das Säulenrohr `09_SAEULE`. */
    expect(SAEULENROHR).toBeCloseTo(SAEULE_HEUTE - MASS.stempel.hoehe, 12);
    expect(SAEULENROHR).toBeCloseTo(0.4085, 9);
  });

  it("rechnet die Anlenkung wie rig.ts — und die Prüfung ist nicht blind", () => {
    const p = probe();
    expect(p.fehler, "die Kopie trifft rig.ts nicht mehr").toBeLessThan(1e-12);
    /*
     * GEGENPROBE: Ein um 1 mm verschobener Bolzen muss sich im Hebelarm
     * niederschlagen. Wäre das null, prüfte der Test oben nichts.
     */
    expect(p.gegenprobe, "die Rechnung reagiert gar nicht auf die Bolzenhöhe").toBeGreaterThan(1e-6);
  });

  it("hält heute beide Wächter von E-039 — und reisst, sobald der Bolzen steigt", () => {
    const heute = anlenkungBei(STEMPEL_AUGE.y);
    expect(heute.neigungMax, "Neigung heute").toBeLessThan(25);
    expect(heute.hebelMin, "Hebelarm heute").toBeGreaterThan(0.115);
    /*
     * GEGENPROBE, und sie ist der ganze Befund des Blattes: An der Traverse
     * steht der Zylinder quer (fast 90°) und ist offen kürzer als sein eigenes
     * Rohr. Meldet dieser Block nicht, ist die Rechnung kaputt.
     */
    const oben = anlenkungBei(TRAVERSE_Y);
    expect(oben.neigungMax, "an der Traverse müsste die Neigung reissen").toBeGreaterThan(25);
    expect(oben.neigungMax).toBeGreaterThan(85);
    const rohr = MASS.zylinder.laenge * 0.6;
    expect(oben.laengeOffen, "der Zylinder wäre kürzer als sein Rohr").toBeLessThan(rohr);
  });

  it("lässt den Bolzen nur rund 2 cm steigen, bevor der erste Wächter reisst", () => {
    let letzterOk = 0;
    for (let i = 0; i <= 1000; i++) {
      const hoch = (SAEULE_HEUTE * i) / 1000;
      const a = anlenkungBei(STEMPEL_AUGE.y + hoch);
      if (a.neigungMax < 25 && a.hebelMin > 0.115) letzterOk = hoch;
      else break;
    }
    expect(letzterOk).toBeGreaterThan(0.015);
    expect(letzterOk).toBeLessThan(0.030);
  });

  it("nimmt dem Korb nichts — er hängt am Bolzen und geht mit", () => {
    /*
     * 20 Stützstellen statt 200: Der Wächter prüft die GLEICHHEIT zweier
     * Messungen, und dafür genügt dasselbe Raster auf beiden Seiten. Die
     * absoluten Zahlen des Blattes stehen im Werkzeug.
     */
    const heute = korbmass(0, 20);
    const ohne = korbmass(SAEULE_HEUTE, 20);
    expect(ohne.tiefeZu).toBeCloseTo(heute.tiefeZu, 9);
    expect(ohne.maxTiefe).toBeCloseTo(heute.maxTiefe, 9);
    expect(ohne.schwebt).toBeCloseTo(heute.schwebt, 9);
    expect(ohne.maul).toBeCloseTo(heute.maul, 9);
    expect(ohne.huellkreis).toBeCloseTo(heute.huellkreis, 9);
    /*
     * GEGENPROBE: Hätte das Heben gar nicht gewirkt, wären die fünf Zeilen
     * darüber trivial gleich. Die Welthöhe MUSS sich um genau die Säule ändern.
     */
    expect(heute.tiefeWelt - ohne.tiefeWelt).toBeCloseTo(SAEULE_HEUTE, 9);
  });
});

describe("Blatt 3 — die Anlenkung: passt der Zylinder? (E-073)", () => {
  /*
   * Patrick, 15.09.2026: „Ich bräuchte schon irgendwie ne Zeichnung, ob das
   * passt." Das Blatt `docs/f5-anlenkung-2026-09-15.svg` zeigt drei Wege. Hier
   * steht, was es behauptet.
   */
  const HEUTE = anlenkungAus(ZYLINDER_AUFNAHME.y, STEMPEL_AUGE.y);
  const BOLZEN_HOCH = anlenkungAus(ZYLINDER_AUFNAHME.y, TRAVERSE_Y);
  const TRAVERSE_RUNTER = anlenkungAus(ZYLINDER_AUFNAHME.y - SAEULE_HEUTE, STEMPEL_AUGE.y);

  it("kennt nur den Abstand — Bolzen hinauf und Traverse herunter sind dieselbe Rechnung", () => {
    /*
     * Der Kern des Blattes, und keine Behauptung, sondern eine Identität: In
     * `hebelarm` und `zylinderLaenge` stehen ausschliesslich DIFFERENZEN von
     * Aufnahme und Bolzen. Wer den Abstand um denselben Betrag schliesst,
     * bekommt dieselbe Anlenkung — egal, welches der beiden Teile wandert.
     *
     * NICHT bitgenau, und das ist ehrlich so aufgeschrieben: Die beiden Wege
     * addieren dieselben Zahlen in anderer Reihenfolge, und das letzte Bit
     * einer Fliesskommazahl haengt daran. Gemessen sind 5,6e−17 m bei den
     * Laengen und 2,8e−14 Grad beim Winkel — unvorstellbar wenig, aber nicht
     * null, und ein `toBe` waere an dieser Stelle eine Luege.
     */
    expect(TRAVERSE_RUNTER.laengeZu).toBeCloseTo(BOLZEN_HOCH.laengeZu, 12);
    expect(TRAVERSE_RUNTER.laengeOffen).toBeCloseTo(BOLZEN_HOCH.laengeOffen, 12);
    expect(TRAVERSE_RUNTER.neigungMax).toBeCloseTo(BOLZEN_HOCH.neigungMax, 12);
    expect(TRAVERSE_RUNTER.hebelMin).toBeCloseTo(BOLZEN_HOCH.hebelMin, 12);
    /*
     * GEGENPROBE: Ein anderer Abstand muss ein anderes Ergebnis geben. Ohne
     * sie bewiese der Block oben nur, dass die Funktion konstant ist.
     */
    const halb = anlenkungAus(ZYLINDER_AUFNAHME.y, STEMPEL_AUGE.y + SAEULE_HEUTE / 2);
    expect(halb.laengeOffen).not.toBeCloseTo(BOLZEN_HOCH.laengeOffen, 3);
  });

  it("zeigt, dass die Stange nur heute in ihr Rohr passt", () => {
    /* Das Rohr ist fest; der Augenabstand offen ist die Probe. */
    expect(ROHR).toBeCloseTo(0.42, 9);
    expect(HEUTE.laengeOffen, "heute schaut die Stange heraus").toBeGreaterThan(ROHR);
    /*
     * GEGENPROBE und Befund in einem: Bei beiden Umbauten läge das Auge der
     * Kolbenstange INNERHALB des Rohrs. Meldet dieser Block nicht, zeichnet
     * das Blatt einen Zylinder, den es nicht gibt.
     */
    expect(BOLZEN_HOCH.laengeOffen, "Umbau: Auge läge im Rohr").toBeLessThan(ROHR);
    expect(ROHR - BOLZEN_HOCH.laengeOffen).toBeGreaterThan(0.2);
    expect(TRAVERSE_RUNTER.laengeOffen).toBeLessThan(ROHR);
  });

  it("legt bei Variante 3 den Kopf in den Korb und reisst oben eine Lücke auf", () => {
    const drei = kopfHerunter(SAEULE_HEUTE, false);
    /* Der Kopf steht dann unter der Bolzenebene — also im Korb. */
    expect(drei.unterBolzen, "Kopf unter der Bolzenebene").toBeGreaterThan(0.1);
    expect(drei.freiZuSchale, "Kopf berührt die Schalen fast").toBeLessThan(0.02);
    /* Die Säule ist nicht weg, sie ist umgezogen: oben klafft dieselbe Länge. */
    expect(drei.luecke).toBeCloseTo(SAEULE_HEUTE, 9);
    /*
     * GEGENPROBE: Ohne Verschiebung steht der Kopf ÜBER der Bolzenebene und
     * hat Luft zu den Schalen. Sonst misst der Block oben nur sich selbst.
     */
    const null0 = kopfHerunter(0, false);
    expect(null0.unterBolzen, "unverschoben darf der Kopf nicht im Korb stehen").toBeLessThan(0);
    expect(null0.freiZuSchale).toBeGreaterThan(0.05);
  });
});

describe("Blatt 4 — der Anlenkungsraum: es gibt eine Lösung (E-075)", () => {
  /*
   * Patrick, 15.09.2026: „Aber es kann nicht sein, dass wir da keine Lösung
   * finden." Er hatte recht. Das Blatt
   * `docs/f5-anlenkungsraum-2026-09-15.svg` zeigt sie; hier steht, was es
   * behauptet. Die Suche ist teuer, deshalb wird sie nur dreimal gerufen.
   */
  it("rechnet Anlenkung UND Schalenbahn wie rig.ts — beides nicht blind", () => {
    const p = raum.probe();
    expect(p.fehler, "die Kopie trifft rig.ts nicht mehr").toBeLessThan(1e-12);
    expect(p.gegenprobe, "die Rechnung reagiert nicht auf den Radiusabstand").toBeGreaterThan(1e-6);
    /* Die gezeichnete Schalenbahn muss beim gebauten Bolzenkreis `mittellinie` treffen. */
    expect(bahnprobe(STEMPEL_AUGE.y, STEMPEL_AUGE.r)).toBeLessThan(1e-12);
    /*
     * GEGENPROBE: Ein anderer Bolzenkreis MUSS eine andere Bahn ergeben. Ohne
     * sie prüfte die Zeile darüber nur, dass die Funktion konstant ist.
     */
    expect(bahnprobe(STEMPEL_AUGE.y, 0.5)).toBeGreaterThan(0.05);
  });

  it("findet den heutigen Stand wieder — er ist eine Nadel, kein Gebiet", () => {
    /*
     * Die erste Fassung des Rasters hat ihn VERFEHLT, weil `OBERE_ANBINDUNG.z`
     * mit 0,245 zwischen zwei Rasterpunkten lag, und daraufhin „keine Lösung"
     * gemeldet — für einen Greifer, der gebaut dasteht. Seitdem stehen seine
     * beiden Zahlen im Raster, und dieser Wächter hält das fest.
     */
    const f = raum.kleinsteSaeule(raum.DR_HEUTE, true);
    expect(f.saeule, "der gebaute Stand wird nicht gefunden").not.toBeNull();
    expect(f.saeule!).toBeLessThanOrEqual(raum.SAEULE_HEUTE + 1e-9);
    expect(f.saeule!).toBeGreaterThan(0.6);
  });

  it("verkürzt die Säule auf rund 49 cm, wenn Kopf und Bolzenkreis gleich weit sind", () => {
    const f = raum.kleinsteSaeule(0, true);
    expect(f.saeule, "bei gleichem Radius muss es gehen").not.toBeNull();
    expect(f.saeule!).toBeGreaterThan(0.44);
    expect(f.saeule!).toBeLessThan(0.53);
    /* Und alle Wächter halten dort — keiner ist nachgezogen. */
    const k = f.k!;
    expect(k.neigungMax).toBeLessThan(25);
    expect(k.hebelMin).toBeGreaterThan(0.115);
    expect(k.hebelZu).toBeGreaterThan(0.2);
    expect(k.laengeMin, "die Stange muss aus dem Rohr schauen").toBeGreaterThan(raum.ROHR + 0.05);
  });

  it("wird schlechter, je weiter der Bolzenkreis über den Kopf hinausragt", () => {
    /*
     * Der Befund, der Patricks Vermutung umdreht — und die GEGENPROBE zum Test
     * darüber: Wäre die Suche blind erfolgreich, fände sie auch hier etwas.
     */
    const weit = raum.kleinsteSaeule(0.2, true);
    expect(weit.saeule, "bei +0,20 m darf es keine Lösung geben").toBeNull();
    expect(["Neigung", "Hebelarm", "Hebel zu", "zu lang"]).toContain(weit.grund);
  });

  it("zahlt für den kleineren Bolzenkreis mit Maulweite, nicht mit Korbtiefe", () => {
    const heute = schalenmass(STEMPEL_AUGE.r);
    const schlank = schalenmass(0.5);
    /* Der Formsatz hält den Äquator — die GESCHLOSSENE Form bleibt. */
    expect(schlank.tiefeZu).toBeCloseTo(heute.tiefeZu, 9);
    /* Offen wird es enger, dafür schwebt der Greifer weniger. */
    expect(schlank.maul).toBeLessThan(heute.maul);
    expect(schlank.schwebt).toBeLessThan(heute.schwebt);
    /* Und die fünf Schalen passen noch nebeneinander. */
    expect(schlank.sektor, "Sektor je Schale").toBeLessThan(36);
    expect(schlank.sektor).toBeGreaterThan(heute.sektor);
  });
});

describe("Blatt 5 — der Kopf ist zu schlank: es ist die Verkleidung (E-076)", () => {
  /*
   * Patrick, 15.09.2026, zu sieben Vorbildaufnahmen: „Der Kopf ist zu schlank."
   * Und die Korrektur, ohne die alles Weitere falsch gewesen wäre: „Das ist ein
   * Zylinderschutz. Also es ist kein Gusskörper."
   */
  it("beweist, dass ein hochstehender Schalenarm nichts bringt", () => {
    /*
     * Das Auge läuft auf einem Kreis um den Bolzen. Seine größte Höhe über ihm
     * ist der ARMRADIUS — gleich, ob der Arm nach oben oder nach unten zeigt.
     * Die Rechnung steht in `augenHoch`; hier wird sie gegen die Behauptung
     * gehalten.
     */
    const r = raum.armRadius(raum.HEUTE.Ay, raum.HEUTE.Az);
    expect(r).toBeCloseTo(0.2577, 4);
    expect(raum.augenHoch(raum.HEUTE.Ay, raum.HEUTE.Az)).toBeLessThanOrEqual(r + 1e-9);
    /* Arm nach OBEN gedreht, gleicher Radius: der Scheitel bleibt derselbe. */
    const hoch = raum.augenHoch(r * Math.sin(1.1), r * Math.cos(1.1));
    expect(hoch).toBeCloseTo(r, 6);
    /*
     * GEGENPROBE: Ein KLEINERER Armradius senkt den Scheitel wirklich — sonst
     * prüfte die Zeile darüber nur, dass die Funktion konstant ist.
     */
    expect(raum.augenHoch(0, 0.1)).toBeCloseTo(0.1, 6);
  });

  it("findet mit hochstehendem Arm keine einzige Lösung — mit hängendem schon", () => {
    /* Arm nach oben (Armwinkel +10° bis +90°): nichts, bei keinem Radius. */
    for (const r of [0.2577, 0.35]) {
      const hoch = raum.kleinsteSaeuleBeiArm(r, true, -0.6, 0.3, 10, 90);
      expect(hoch.saeule, `Armradius ${r} nach oben`).toBeNull();
    }
    /*
     * GEGENPROBE, und zugleich der Befund: Mit freiem Armwinkel geht es sehr
     * wohl — der Arm zeigt dann nach UNTEN. Meldet dieser Block nicht, sucht
     * die Funktion gar nicht.
     */
    const frei = raum.kleinsteSaeuleBeiArm(0.35, true);
    expect(frei.saeule, "mit freiem Armwinkel muss es gehen").not.toBeNull();
    expect(Math.atan2(frei.Ay, frei.Az), "der Arm zeigt nach unten").toBeLessThan(0);
    expect(frei.saeule!).toBeLessThan(raum.SAEULE_HEUTE);
  });

  it("rechnet die Sicht: unten verdeckt der Kopf nie, oben ab Ø 1,81 m", () => {
    const AUF = 2.766; // Aufhängung aufgesetzt, E-065
    /* Kabine unten: das Auge liegt kaum über dem Kopf, der Blick streift vorbei. */
    for (const D of [0.95, 2.0, 2.8]) {
      expect(verdeckung(D / 2, 3.28, 4, AUF, 0.72, 2.5, 3.0), `Ø ${D} unten`).toBe(0);
    }
    /*
     * Kabine oben (2,60 m Hub): jetzt verdeckt er, und zwar mehr, je breiter.
     * Das ist die Gegenprobe zur Zeile darüber — wäre die Rechnung blind,
     * käme auch hier null heraus.
     */
    const schmal = verdeckung(0.95 / 2, 5.88, 4, AUF, 0.72, 2.5, 3.0);
    const breit = verdeckung(2.8 / 2, 5.88, 4, AUF, 0.72, 2.5, 3.0);
    expect(schmal).toBeGreaterThan(0.05);
    expect(breit).toBeGreaterThan(schmal);
    /* Die Grenze, unter der über 75 % sichtbar bleiben. */
    expect(verdeckung(1.81 / 2, 5.88, 4, AUF, 0.72, 2.5, 3.0)).toBeLessThan(0.25);
    expect(verdeckung(1.9 / 2, 5.88, 4, AUF, 0.72, 2.5, 3.0)).toBeGreaterThan(0.25);
  });
});
