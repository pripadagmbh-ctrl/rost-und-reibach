/**
 * Wächter für die Platzordnung nach E-010 — die Ausbuchtung.
 *
 * Zwei Zusicherungen, die beim Umbau am 14.09.2026 als einzige wirklich
 * zählen und bis dahin nirgends festgehalten waren:
 *
 * 1. **Jedes Sortierziel liegt im Schwenkband 5,8 bis 9,2 m.** Der Bagger hat
 *    nicht nur eine äußere Grenze, sondern auch eine innere — unter 5,8 m
 *    bekommt er den Arm nicht eng genug zusammen. Beim Zeichnen sind an genau
 *    dieser inneren Grenze zwei Ziele gescheitert (E-010). Ohne Wächter merkt
 *    das erst der Spieler, und dann ist der Platz schon gebaut.
 *
 * 2. **Die Sortiermulden haben keine Rückwand** (E-006, Ansage 13.09.2026:
 *    „Rückwände raus, nur Seitenwände"). Das hing bisher an einem einzelnen
 *    `shareEast: true` je Mulde. Wer es zurücksetzt, baut eine unsichtbare
 *    Wand zwischen Greifer und Mulde — dieselbe Klasse Fehler, die am
 *    12.09.2026 als „unsichtbare Barriere" gemeldet wurde.
 *
 * Gemessen wird gegen den gebauten Platz, nicht gegen den Konzeptplan: Die
 * Zahlen kommen aus `containers.ts`, `press.ts` und `obstacles.ts`.
 */
import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import {
  BAGGER_STAND,
  VERLADE_STAND,
  SCHWENK_INNEN,
  SCHWENK_AUSSEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import {
  CONFIGS,
  bayHalb,
  bayVorderkante,
  type ContainerConfig,
} from "../src/world/containers";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  BED_HALF_W,
  VERLADE_SPUR_X,
} from "../src/delivery/routes";
import { PRESS_CENTER, PRESS_FUSS, KLAPPE_WEG, KLAPPE_RICHTUNG } from "../src/world/press";
import { STATIC_OBSTACLES, hitsObstacle } from "../src/world/obstacles";
import {
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  YARD_D,
  YARD_MAX_X,
  YARD_MIN_X,
} from "../src/world/yard";

/**
 * Die Mulden, die der Spieler selbst befüllt.
 *
 * Seit E-028 ist es EINE: die Buntmetall-Mulde. Aus den drei Metallmulden
 * (Alu+Zink, Kabel, Kupfer+Messing) ist eine geworden — die dritte lag mit
 * 12,26 m ohnehin ausserhalb des Schwenkbands.
 */
const SORTIERMULDEN = ["r_bunt"];

function cfg(id: string): ContainerConfig {
  const c = CONFIGS.find((x) => x.id === id);
  if (!c) throw new Error(`Kein Behälter mit id ${id}`);
  return c;
}

/**
 * Der Punkt, den der Bagger an diesem Ziel wirklich anfährt.
 *
 * Bei einer HALDE ist das die vordere Kante — man gräbt sich von vorn hinein,
 * und die Mitte einer 9 m tiefen Halde liegt außerhalb jeder Reichweite
 * (E-010). Bei allem anderen ist es die Mitte: In eine Mulde von 4 m Tiefe
 * greift man mittig hinein.
 */
function zielpunkt(c: ContainerConfig): [number, number] {
  if (c.kind === "halde") return [c.x, c.z + c.size[1] / 2];
  return [c.x, c.z];
}

/*
 * DIE VIER PFLICHTZIELE (Ansage Patrick, 14.09.2026 abends).
 *
 * „Erst mal gucken, dass wir vor allem an Mischschrott drankommen, an die
 * Presse, an Stahlschrott und an den Muell." Dazu kommt der Platz, an dem der
 * LKW steht — er ist kein Behaelter, aber der Ort, von dem aus alles andere
 * gefuellt wird.
 *
 * Bis dahin stand hier „die acht Ziele". Diese Acht sind nicht mehr
 * erfuellbar: Die Presse hat die Suedhaelfte der Westflanke uebernommen, weil
 * der LKW ihre alte Ecke braucht, und der Reifencontainer ist ersatzlos weg.
 * Was uebrigbleibt, sind vier Pflichtziele plus Abladeplatz — und die drei
 * Metallmulden, die Patrick ausdruecklich als zweitrangig eingestuft hat
 * („die ueberlegen wir uns noch"). Der Waechter prueft deshalb ZWEI Dinge
 * getrennt: die Pflicht hart, die Mulden als Bestandsaufnahme.
 */
/*
 * Nachtrag 15.09.2026 abends (E-034): Der MUELL ist kein fester Behaelter
 * mehr, sondern ein Absetzcontainer, den der Spieler versetzt. Geprueft wird
 * hier deshalb sein STARTPLATZ — der Ort, an dem er am Morgen steht. Wohin er
 * danach wandert, entscheidet der Spieler; ein Waechter, der ihm folgte,
 * verboete genau das (Ansage: „Der Container soll erstmal frei bleiben, damit
 * ich auch testen kann, wo der am besten steht").
 */
describe("Die vier Pflichtziele liegen im Schwenkband", () => {
  const ziele: Array<[string, number, number]> = [
    ...["c_mixed", "c_steel", "r_rubble"].map((id) => {
      const c = cfg(id);
      const [x, z] = zielpunkt(c);
      return [c.label, x, z] as [string, number, number];
    }),
    ["PRESSE", PRESS_CENTER.x, PRESS_CENTER.z],
  ];

  it("führt genau die vier Ziele der Abnahme", () => {
    expect(ziele.map((z) => z[0]).sort()).toEqual(
      ["MISCHSCHROTT", "MUELL", "PRESSE", "STAHLSCHROTT"].sort()
    );
  });

  for (const [label, x, z] of ziele) {
    it(`${label} liegt zwischen ${SCHWENK_INNEN} und ${SCHWENK_AUSSEN} m`, () => {
      const d = abstandVomStand(x, z);
      expect(d, `${label}: ${d.toFixed(2)} m — zu nah, der Arm bleibt eingeklappt`)
        .toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d, `${label}: ${d.toFixed(2)} m — außerhalb der Reichweite`).toBeLessThanOrEqual(
        SCHWENK_AUSSEN
      );
    });
  }

  it("der LKW steht mit der ganzen Ladefläche im Band — das ist der Sinn des Umbaus", () => {
    /*
     * Ansage: „Ich haette gerne, dass ich LKWs nicht mehr von hinten, sondern
     * von der Seite ablade."
     *
     * DIE LADEFLAECHE LIEGT UM DEN HALTEPUNKT HERUM, nicht noerdlich davon.
     * Bis zum 15.09.2026 rechnete dieser Waechter sie von `ABLADE_HALT_Z` bis
     * +5,4 — das war falsch: Der Ursprung eines Fahrzeugs liegt in der MITTE
     * der Ladeflaeche (`vehicleModel.ts`: `bedGroup.position.z = −bedLen/2`).
     * Mit der falschen Annahme war der Test gruen, waehrend die vordere linke
     * Ecke in Wahrheit 5,58 m vom Sitz lag — unter der inneren Grenze von
     * 5,80 m. Genau das hat Patrick gemeldet: „Ich kann noch nicht mal die
     * LKWs vollstaendig abladen."
     */
    const halbeBreite = BED_HALF_W; // 1,35 m
    const laenge = 5.4; // bedLen einer Pritsche (vehicles.ts)
    const ecken: Array<[number, number]> = [];
    for (const dx of [-halbeBreite, halbeBreite]) {
      for (const dz of [-laenge / 2, laenge / 2]) {
        ecken.push([ABLADE_SPUR_X + dx, ABLADE_HALT_Z + dz]);
      }
    }
    for (const [x, z] of ecken) {
      const d = abstandVomStand(x, z);
      expect(d, `Ladeflächenecke (${x.toFixed(2)} | ${z.toFixed(2)}): ${d.toFixed(2)} m — zu nah`)
        .toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d, `Ladeflächenecke (${x.toFixed(2)} | ${z.toFixed(2)}): ${d.toFixed(2)} m`)
        .toBeLessThanOrEqual(SCHWENK_AUSSEN);
    }
    // Und die Mitte der Fläche liegt sauber im Band.
    const mitte = abstandVomStand(ABLADE_SPUR_X, ABLADE_HALT_Z);
    expect(mitte).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(mitte).toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("und die Mauer steht weit genug weg, dass der Greifer nicht hineinfasst", () => {
    /*
     * Befund Patrick 15.09.2026: „Ich greife in die Wand." Die offene Spinne
     * misst 3,38 m, braucht also 1,69 m Halbmass um den Greifpunkt. Gemessen
     * wird von der aeussersten Ladeflaechenecke zur Mauerinnenseite.
     */
    const SPINNE_HALB = 1.69;
    const suedMauerInnen = -YARD_D / 2 + 0.3;
    const ostMauerInnen = YARD_MAX_X - 0.3;
    const zuSued = ABLADE_HALT_Z - 5.4 / 2 - suedMauerInnen;
    const zuOst = ostMauerInnen - (ABLADE_SPUR_X + BED_HALF_W);
    expect(zuSued, `${zuSued.toFixed(2)} m bis zur Südmauer`).toBeGreaterThan(SPINNE_HALB);
    expect(zuOst, `${zuOst.toFixed(2)} m bis zur Ostmauer`).toBeGreaterThan(SPINNE_HALB);
  });

  it("und er steht quer, nicht mit dem Heck zum Bagger", () => {
    /*
     * Die Laengsachse des Wagens laeuft in z (er setzt auf der Spur nach
     * Sueden zurueck), der Bagger steht im Westen. Der Winkel zwischen
     * Laengsachse und der Richtung zum Sitz muss deshalb nahe 90 Grad sein —
     * das ist „von der Seite" in einer Zahl.
     */
    const mx = ABLADE_SPUR_X;
    const mz = ABLADE_HALT_Z + 2.7;
    const zumSitz = Math.atan2(BAGGER_STAND.x - mx, BAGGER_STAND.z - mz);
    const laengsachse = 0; // +z
    let winkel = Math.abs((zumSitz - laengsachse) * (180 / Math.PI));
    if (winkel > 180) winkel = 360 - winkel;
    expect(Math.abs(winkel - 90), `${winkel.toFixed(0)}° statt quer`).toBeLessThan(25);
  });

  it("die Buntmetall-Mulde liegt im Band — und zwar ganz (E-028)", () => {
    /*
     * Seit dem 15.09.2026 gibt es nur noch EINE Sortiermulde, und damit ist
     * aus der Bestandsaufnahme eine Zusicherung geworden: Faellt sie aus dem
     * Band, kann der Spieler ueberhaupt nicht mehr sortieren.
     *
     * Geprueft wird nicht nur die Mitte, sondern der erreichbare ANTEIL ihrer
     * Achse. Bei 6,0 m Laenge ist das die Frage, die zaehlt — eine Mulde,
     * deren Nordende 12 m weg liegt, ist zur Haelfte Deko (genau das war
     * KUPFER + MESSING bis gestern).
     */
    const c = cfg("r_bunt");
    const mitte = abstandVomStand(c.x, c.z);
    expect(mitte, `BUNTMETALL: ${mitte.toFixed(2)} m`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(mitte, `BUNTMETALL: ${mitte.toFixed(2)} m`).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    const laenge = c.size[1];
    let treffer = 0;
    const schritte = 100;
    for (let i = 0; i <= schritte; i++) {
      const z = c.z - laenge / 2 + (laenge * i) / schritte;
      const d = abstandVomStand(c.x, z);
      if (d >= SCHWENK_INNEN && d <= SCHWENK_AUSSEN) treffer++;
    }
    const anteil = treffer / (schritte + 1);
    expect(anteil, `nur ${(anteil * 100).toFixed(0)} % der Muldenachse erreichbar`)
      .toBeGreaterThan(0.85);
  });

  it("der Verladeplatz liegt symmetrisch zwischen Silo und LKW-Spur", () => {
    /*
     * E-010: „7,5 m zur Silo-Vorderkante, 7,5 m zur LKW-Spur. Der Abholer
     * setzt rückwärts an, der Bagger steht dazwischen." Geprüft wird die
     * Symmetrie, nicht die Zahl 7,5 — verschiebt jemand die Silo-Reihe, muss
     * die Spur mitwandern.
     *
     * Seit dem 15.09.2026 steht die Reihe an der anderen Wand und oeffnet sich
     * nach WESTEN: Die Vorderkante ist `x − w/2`, und der Abholer haelt
     * westlich des Baggers statt oestlich. Gerechnet wird deshalb mit dem
     * Betrag — die Eigenschaft ist die Symmetrie, nicht das Vorzeichen.
     */
    const silo = cfg("c_cable_lager");
    const siloKante = bayVorderkante(silo).x;
    const zurSilo = Math.abs(siloKante - VERLADE_STAND.x);
    expect(zurSilo, `${zurSilo.toFixed(2)} m zur Silo-Vorderkante`).toBeGreaterThanOrEqual(
      SCHWENK_INNEN
    );
    expect(zurSilo).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    // Die LKW-Spur steht spiegelbildlich auf der anderen Seite.
    expect(zurSilo).toBeCloseTo(7.5, 6);
    expect(Math.abs(VERLADE_SPUR_X - VERLADE_STAND.x)).toBeCloseTo(zurSilo, 6);
  });

  it("die Silo-Reihe steht bewusst außerhalb — dorthin wird gefahren", () => {
    /*
     * Der Gegentest zum Schwenkband: Die neun Silos gehören NICHT hinein
     * (E-010). Läge eines darin, hätte der Platz sein Gefälle verloren.
     */
    for (const c of CONFIGS.filter((x) => x.lager === true)) {
      expect(abstandVomStand(c.x, c.z), `${c.label} steht im Schwenkband`).toBeGreaterThan(
        SCHWENK_AUSSEN
      );
    }
  });
});

describe("Die Sortiermulden haben keine Rückwand (E-006)", () => {
  it("jede Mulde ist als offen gekennzeichnet", () => {
    for (const id of SORTIERMULDEN) {
      expect(cfg(id).shareEast, `${cfg(id).label}: shareEast zurückgesetzt`).toBe(true);
    }
  });

  it("und trägt auch keine Stirnwand in der Hindernisliste", () => {
    /*
     * Die schärfere Prüfung: Das Kennzeichen allein nützt nichts, wenn die
     * Hindernisliste die Wand trotzdem führt. Genau so sind am 12.09.2026 die
     * unsichtbaren Barrieren entstanden — gebaut und verzeichnet liefen
     * auseinander.
     */
    const labels = STATIC_OBSTACLES.map((o) => o.label);
    for (const id of SORTIERMULDEN) {
      const c = cfg(id);
      expect(labels, `${c.label}: Stirnwand steht noch in der Liste`).not.toContain(
        `${c.label} Stirn`
      );
      // Und der Greifer kommt von beiden Seiten hinein.
      const [w] = c.size;
      for (const seite of [-1, 1]) {
        expect(
          hitsObstacle(c.x + seite * (w / 2 + 0.8), c.z, 0),
          `${c.label}: ${seite > 0 ? "Ost" : "West"}seite zugestellt`
        ).toBeNull();
      }
    }
  });

  it("die Flanken stehen aber weiterhin — sonst laufen die Fraktionen ineinander", () => {
    for (const id of SORTIERMULDEN) {
      const c = cfg(id);
      const [, d] = c.size;
      /*
       * Die Nordflanke bringt jede Mulde selbst mit; die Südflanke stellt der
       * Nachbar bzw. die Außenmauer (`shareSouth`). Getastet wird mit 0,4 m
       * Rand, weil die geteilten Wände nicht auf den Zentimeter auf der
       * Muldenkante stehen — die Außenmauer liegt 0,1 m davor, die Nordwand
       * des Nachbarn 0,2 m dahinter.
       */
      expect(hitsObstacle(c.x, c.z + d / 2, 0.4), `${c.label}: Nordflanke fehlt`).not.toBeNull();
      expect(hitsObstacle(c.x, c.z - d / 2, 0.4), `${c.label}: Südflanke fehlt`).not.toBeNull();
    }
  });
});

describe("Die Ausbuchtung", () => {
  it("ist rundum mit hoher Wand eingefasst", () => {
    for (const [name, x, z] of [
      ["Westschenkel", BUCHT_X_VON, -34],
      ["Ostschenkel", BUCHT_X_BIS, -34],
      ["Rückwand", 0.5, BUCHT_Z],
    ] as Array<[string, number, number]>) {
      const o = hitsObstacle(x, z, 0, 4.0);
      expect(o, `${name} fehlt`).not.toBeNull();
      expect(o!.top, `${name} ist zu niedrig`).toBeGreaterThan(4.0);
    }
  });

  it("ist nach Norden offen — sonst käme der Bagger nicht hinein", () => {
    for (let x = BUCHT_X_VON + 1; x < BUCHT_X_BIS - 1; x += 1) {
      expect(hitsObstacle(x, -YARD_D / 2, 0), `Südmauer sperrt die Bucht bei x=${x}`).toBeNull();
    }
  });

  it("nimmt beide Halden vollständig auf", () => {
    for (const id of ["c_mixed", "c_steel"]) {
      const c = cfg(id);
      const [w, d] = c.size;
      expect(c.x - w / 2, `${c.label} ragt nach Westen aus der Bucht`).toBeGreaterThanOrEqual(
        BUCHT_X_VON
      );
      expect(c.x + w / 2, `${c.label} ragt nach Osten aus der Bucht`).toBeLessThanOrEqual(
        BUCHT_X_BIS
      );
      expect(c.z - d / 2, `${c.label} ragt durch die Rückwand`).toBeGreaterThanOrEqual(BUCHT_Z);
      expect(c.z + d / 2, `${c.label} ragt aus der Bucht heraus`).toBeLessThanOrEqual(-YARD_D / 2);
    }
  });

  it("die Trennsteine sind in der Mitte am höchsten und laufen nach außen ab", () => {
    const hoehen = TRENNSTEINE.map((s) => s.hoehe);
    expect(Math.max(...hoehen), "die Mitte erreicht 2,4 m nicht").toBeCloseTo(2.4, 6);
    expect(hoehen[0], "das vordere Ende läuft nicht auf 0,6 m ab").toBeCloseTo(0.6, 6);
    expect(hoehen[hoehen.length - 1], "das hintere Ende läuft nicht ab").toBeCloseTo(0.6, 6);
    // Pyramide: von vorn bis zur Mitte steigend, danach fallend.
    const mitte = hoehen.indexOf(Math.max(...hoehen));
    for (let i = 1; i <= mitte; i++) expect(hoehen[i]).toBeGreaterThanOrEqual(hoehen[i - 1]!);
    for (let i = mitte + 1; i < hoehen.length; i++)
      expect(hoehen[i]).toBeLessThanOrEqual(hoehen[i - 1]!);
  });

  it("der Arm kommt über die Trennsteine hinweg", () => {
    // Das ist der ganze Sinn der Pyramide: „sodass der Zugriff von
    // Mischschrott zu Stahlschrott flüssig läuft."
    for (const s of TRENNSTEINE) {
      expect(s.hoehe, "ein Trennstein steht so hoch wie eine Boxwand").toBeLessThanOrEqual(2.4);
      expect(hitsObstacle(0.5, s.z, 0, 2.5), `Trennstein bei z=${s.z} sperrt nach oben`).toBeNull();
    }
  });
});

describe("Nichts steht im anderen", () => {
  it("keine zwei Behälter überschneiden sich", () => {
    for (let i = 0; i < CONFIGS.length; i++) {
      for (let j = i + 1; j < CONFIGS.length; j++) {
        const a = CONFIGS[i]!;
        const b = CONFIGS[j]!;
        /*
         * In WELTachsen gerechnet, nicht in Muldenachsen. Bei einer nach
         * Norden offenen Mulde sind Tiefe und Laenge vertauscht; wer hier
         * stur `size[0]` als x liest, prueft ein um 90 Grad verdrehtes
         * Rechteck — und findet eine Ueberschneidung von 1,40 m nicht, die
         * daneben steht. `bayHalb` liefert beides aus einer Quelle.
         */
        const ha = a.kind === "bay" ? bayHalb(a) : { hw: a.size[0] / 2, hd: a.size[1] / 2 };
        const hb = b.kind === "bay" ? bayHalb(b) : { hw: b.size[0] / 2, hd: b.size[1] / 2 };
        const dx = Math.abs(a.x - b.x) - (ha.hw + hb.hw);
        const dz = Math.abs(a.z - b.z) - (ha.hd + hb.hd);
        expect(
          dx >= 0 || dz >= 0,
          `${a.label} und ${b.label} überschneiden sich um ` +
            `${(-Math.max(dx, dz)).toFixed(2)} m`
        ).toBe(true);
      }
    }
  });

  it("die Presse steht an der Westflanke, aber nicht in der Mauer", () => {
    /*
     * Gemessen, nicht geglaubt: Der Rahmen reicht über die lichte Kammer
     * hinaus, und die Deckelklappe schwingt noch einmal 3,85 m über die Mitte.
     * Beides muss innerhalb der Mauern bleiben.
     *
     * Seit dem 14.09.2026 abends steht die Maschine an der WESTFLANKE und um
     * 90 Grad gedreht (der LKW hat ihre Ecke bekommen). Damit zeigt die
     * Klappe nach Westen statt nach Süden — geprüft wird deshalb mit
     * `KLAPPE_RICHTUNG` statt mit einem festen Vorzeichen; sonst prüfte der
     * Wächter eine Seite, an der gar nichts mehr schwingt.
     */
    const WAND_INNEN = 0.3;
    expect(
      PRESS_CENTER.x + PRESS_FUSS.hw,
      "die Presse steht in der Ostmauer"
    ).toBeLessThan(YARD_MAX_X - WAND_INNEN);
    expect(
      PRESS_CENTER.x - PRESS_FUSS.hw,
      "die Presse steht in der Westmauer"
    ).toBeGreaterThan(YARD_MIN_X + WAND_INNEN);
    expect(
      PRESS_CENTER.z - PRESS_FUSS.hd,
      "die Presse steht in der Südmauer"
    ).toBeGreaterThan(-YARD_D / 2 + WAND_INNEN);
    // Und die offene Klappe dazu.
    const klappeX = PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG;
    const klappeZ = PRESS_CENTER.z + KLAPPE_RICHTUNG.z * KLAPPE_WEG;
    expect(klappeX, "die Deckelklappe schlägt in die Westmauer").toBeGreaterThan(
      YARD_MIN_X + WAND_INNEN
    );
    expect(klappeX, "die Deckelklappe schlägt in die Ostmauer").toBeLessThan(
      YARD_MAX_X - WAND_INNEN
    );
    expect(klappeZ, "die Deckelklappe schlägt in die Südmauer").toBeGreaterThan(
      -YARD_D / 2 + WAND_INNEN
    );
  });});

/*
 * Der Bagger muss dort stehen, wo der Platz fuer ihn gebaut wurde.
 *
 * Am 14.09.2026 stand in excavator.ts die alte Zahl (−2,5 | −19,5), waehrend
 * der ganze Platz um (−0,5 | −22,5) herum neu gebaut war — 3,6 m daneben.
 * Damit stimmte im Spiel keine einzige Entfernung der Abnahmetabelle, und es
 * fiel niemandem auf, weil beide Zahlen fuer sich genommen richtig aussahen.
 */
describe("Der Bagger steht auf seinem Standplatz", () => {
  it("nimmt seine Startposition aus baggerstand.ts, nicht aus einer eigenen Zahl", async () => {
    const quelle = await readFile(new URL("../src/excavator/excavator.ts", import.meta.url), "utf8");
    expect(quelle).toContain("BAGGER_STAND.x");
    expect(quelle).toContain("BAGGER_STAND.z");
    // Keine hart eingetragene Startposition mehr
    expect(quelle).not.toMatch(/readonly position = new THREE\.Vector3\(-?\d/);
  });
});
