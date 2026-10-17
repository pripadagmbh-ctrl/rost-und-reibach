/**
 * Die Silo-Reihe: vollzählig versorgt, an der Wand, anfahrbar — und der Müll
 * steht nicht in der Rückfahrspur.
 *
 * Am 15.09.2026 ist die Reihe von neun auf sechs gekürzt und an die andere
 * Wand gezogen. Kürzen heißt kein Material verlieren: Was `lager: true`
 * trägt, ist das Ziel des sortenreinen Kippers UND Lamberts Ablageort. Fällt
 * ein Silo weg, ohne dass seine Fraktion woanders unterkommt, bleibt sie
 * liegen — und zwar stumm, ohne Fehlermeldung. Genau das hält der erste Test
 * hier fest.
 */
import { describe, it, expect } from "vitest";
import { UNTERWAGEN_HALB_B } from "../src/excavator/unterwagenParts";
import {
  CONFIGS,
  gehoertHierhin,
  lagerMuldeFuer,
  bayHalb,
  bayOeffnung,
  bayVorderkante,
  bayRuecken,
  type ContainerConfig,
} from "../src/world/containers";
import { MATERIALS } from "../src/materials/catalog";
import { YARD_MAX_X, YARD_MIN_X, YARD_D } from "../src/world/yard";
import { hitsObstacle, STATIC_OBSTACLES } from "../src/world/obstacles";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN, abstandVomStand } from "../src/world/baggerstand";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  MULDEN_GASSE_X,
  MULDEN_GASSE_Z,
} from "../src/delivery/routes";
import { StaffManager, imBaggerrevier } from "../src/world/people";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PRESS_CENTER, PRESS_INNER, PressManager } from "../src/world/press";

const LAGER = CONFIGS.filter((c) => c.lager === true);

/**
 * Fraktionen, die bewusst KEIN Lagersilo haben.
 *
 * Stahl und Mischschrott werden direkt an der Halde verladen (E-010: „Stahl
 * entfällt — ein Silo dafür wäre ein Umweg"). Beide stehen als Halde im
 * Katalog der Behälter und brauchen kein zweites Ziel.
 */
const OHNE_SILO = new Set(["steel", "mixed"]);

describe("Keine Fraktion verliert ihr Lager", () => {
  it("für jede Fraktion im Katalog gibt es ein Silo — oder einen genannten Grund", () => {
    const ohne: string[] = [];
    for (const id of Object.keys(MATERIALS)) {
      if (OHNE_SILO.has(id)) continue;
      if (!lagerMuldeFuer(id)) ohne.push(id);
    }
    expect(ohne, `ohne Lagerziel: ${ohne.join(", ")}`).toEqual([]);
  });

  it("und die drei gestrichenen Fraktionen landen nachweislich im ABFALL", () => {
    /*
     * HOLZ, KUNSTSTOFF und BAUMISCH hatten bis zum 15.09.2026 je ein eigenes
     * Silo. Sie sind zu einem zusammengelegt, weil alle vier Abfallsätze
     * negativ sind (−0,02 bis −0,06 €/kg, `materials/catalog.ts`): Sie werden
     * entsorgt, nicht verkauft, und ein Abnehmer bestellt sie nie.
     */
    const abfall = lagerMuldeFuer("rubble");
    expect(abfall?.id).toBe("c_rubble");
    for (const id of ["wood", "plastic", "tires", "rubble"]) {
      expect(lagerMuldeFuer(id)?.id, `${id} findet das Abfall-Silo nicht`).toBe("c_rubble");
      expect(MATERIALS[id]!.sellPricePerKg, `${id} ist kein Abfall`).toBeLessThan(0);
    }
  });

  it("was der Spieler in den MUELL wirft, darf Lambert eins zu eins weitertragen", () => {
    /*
     * Sonst zählte die Hälfte im Silo als Verunreinigung und drückte die
     * Reinheit des ganzen Behälters (Briefing Kap. 7, Erlös = kg × Preis ×
     * Reinheit²).
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    const silo = CONFIGS.find((c) => c.id === "c_rubble")!;
    for (const id of ["rubble", "tires", "wood", "plastic"]) {
      expect(gehoertHierhin(muell, id), `${id} gehört nicht in den MUELL`).toBe(true);
      expect(gehoertHierhin(silo, id), `${id} gehört nicht ins ABFALL-Silo`).toBe(true);
    }
  });

  it("kein Silo ist eine leere Hülle mehr", () => {
    // Das E-Motoren-Silo war baulich fertig, hatte aber keine Fraktion
    // (E-011) — es ist ersatzlos entfallen, und mit ihm das Kennzeichen.
    for (const c of CONFIGS) expect(c.nurHuelle, `${c.label}`).toBeUndefined();
  });
});

/** Westschenkel (Oeffnung nach Osten) und Suedschenkel (Oeffnung nach Norden). */
const WEST = LAGER.filter((c) => c.facing === "east");
const SUED = LAGER.filter((c) => c.facing === "north");

describe("Die Reihe steht als L an Westwand und Suedwand (E-028)", () => {
  it("es sind sechs, drei je Schenkel", () => {
    expect(LAGER.length).toBe(6);
    expect(WEST.length, "Westschenkel").toBe(3);
    expect(SUED.length, "Suedschenkel").toBe(3);
    expect(WEST.length + SUED.length, "ein Silo zeigt in keine der beiden Richtungen").toBe(
      LAGER.length
    );
  });

  it("jedes Silo steht mit dem Ruecken an SEINER Platzgrenze", () => {
    /*
     * Gemessen gegen die Wand, an der das Silo steht — nicht gegen eine fest
     * eingetragene. Bis zum 15.09.2026 stand hier `YARD_MAX_X` und damit die
     * Ostwand; nach dem Umzug haette derselbe Test 43,50 m „Leere hinter dem
     * Silo" gemeldet, obwohl das Silo sauber an der Westwand steht.
     */
    for (const c of LAGER) {
      const r = bayRuecken(c);
      const wand = c.facing === "north" ? -YARD_D / 2 : YARD_MIN_X;
      const luft = Math.abs(c.facing === "north" ? r.z - wand : r.x - wand);
      expect(luft, `${c.label}: ${luft.toFixed(2)} m Leere hinter dem Silo`).toBeLessThan(1.5);
      expect(luft, `${c.label}: steht in der Mauer`).toBeGreaterThan(0.3);
    }
  });

  it("jeder Schenkel steht in einer Flucht und hat gleichen Achsabstand", () => {
    for (const [name, leg] of [
      ["West", WEST],
      ["Sued", SUED],
    ] as Array<[string, ContainerConfig[]]>) {
      const quer = leg[0]!.facing === "north" ? "z" : "x";
      const laengs = quer === "z" ? "x" : "z";
      for (const c of leg) {
        expect(c[quer], `${c.label} steht nicht in der ${name}-Flucht`).toBeCloseTo(
          leg[0]![quer],
          6
        );
      }
      const achsen = leg.map((c) => c[laengs]).sort((a, b) => b - a);
      for (let i = 1; i < achsen.length; i++) {
        expect(achsen[i - 1]! - achsen[i]!, `${name}: ungleicher Achsabstand`).toBeCloseTo(4.6, 6);
      }
    }
  });

  it("kein Silo steht in einer Mauer", () => {
    for (const c of LAGER) {
      const { hw, hd } = bayHalb(c);
      // Flankenmass: halbe Laenge plus Steinreihe (0,275 m)
      const fw = c.facing === "north" ? hw + 0.275 : hw;
      const fd = c.facing === "north" ? hd : hd + 0.275;
      expect(c.x - fw, `${c.label} steht in der Westmauer`).toBeGreaterThan(YARD_MIN_X + 0.3);
      expect(c.x + fw, `${c.label} steht in der Ostmauer`).toBeLessThan(YARD_MAX_X - 0.3);
      expect(c.z - fd, `${c.label} steht in der Suedmauer`).toBeGreaterThan(-YARD_D / 2 + 0.3);
      expect(c.z + fd, `${c.label} steht in der Nordmauer`).toBeLessThan(YARD_D / 2 - 0.3);
    }
  });

  it("die beiden Schenkel kommen sich an der Ecke nicht ins Gehege", () => {
    /*
     * Die Ecke ist der heikle Punkt des L. Geprueft wird der Streifen, den
     * die Gasse des Suedschenkels braucht: Sie liegt auf z −17,0, ein LKW ist
     * dort 3,10 m breit, und das unterste Westsilo darf nicht hineinragen.
     */
    const LKW_HALB = 1.55;
    for (const c of WEST) {
      const { hd } = bayHalb(c);
      const suedkante = c.z - hd - 0.275;
      expect(
        suedkante,
        `${c.label} reicht bis z ${suedkante.toFixed(2)} und damit in die Suedgasse`
      ).toBeGreaterThan(MULDEN_GASSE_Z + LKW_HALB);
    }
    for (const c of SUED) {
      const { hw } = bayHalb(c);
      const nordkante = c.z + hw + 0.275;
      expect(nordkante, `${c.label} ragt in die Suedgasse`).toBeLessThan(
        MULDEN_GASSE_Z - LKW_HALB
      );
    }
  });

  it("und bewusst außerhalb des Schwenkbands — dorthin wird gefahren", () => {
    for (const c of LAGER) {
      expect(abstandVomStand(c.x, c.z), `${c.label} steht im Schwenkband`).toBeGreaterThan(
        SCHWENK_AUSSEN
      );
    }
  });

  it("Lambert kommt an jedes Silo — keines liegt in seinem Sperrgebiet", () => {
    /*
     * Lambert faehrt nicht in den Arbeitsbereich des Baggers (Ansage
     * 12.09.2026). Faellt ein Silo in dieses Gebiet, traegt er nichts mehr
     * dorthin — ohne Fehlermeldung, das Material bleibt einfach liegen.
     */
    for (const c of LAGER) {
      expect(imBaggerrevier(c.x, c.z), `${c.label} liegt in Lamberts Sperrgebiet`).toBe(false);
      const [ax, az] = StaffManager.anfahrtZu(c);
      expect(
        imBaggerrevier(ax, az),
        `${c.label}: der Halteplatz (${ax.toFixed(1)}|${az.toFixed(1)}) liegt im Sperrgebiet`
      ).toBe(false);
      // Und er haelt VOR der Oeffnung, nicht darin.
      const v = bayVorderkante(c);
      const o = bayOeffnung(c);
      const davor = (ax - v.x) * o.x + (az - v.z) * o.z;
      expect(davor, `${c.label}: Halteplatz ${davor.toFixed(2)} m vor der Oeffnung`).toBeCloseTo(
        2.2,
        6
      );
    }
  });

  it("die Gasse läuft 5,0 m vor den Öffnungen, nicht in ihnen", () => {
    for (const c of LAGER) {
      const v = bayVorderkante(c);
      const gasse = c.facing === "north" ? MULDEN_GASSE_Z : MULDEN_GASSE_X;
      const eigen = c.facing === "north" ? v.z : v.x;
      const abstand = Math.abs(gasse - eigen);
      expect(abstand, `${c.label}: Gasse ${abstand.toFixed(2)} m vor der Öffnung`).toBeCloseTo(
        5.0,
        6
      );
      const gx = c.facing === "north" ? c.x : MULDEN_GASSE_X;
      const gz = c.facing === "north" ? MULDEN_GASSE_Z : c.z;
      expect(hitsObstacle(gx, gz, 1.4), `${c.label}: Gasse versperrt`).toBeNull();
    }
  });
});

/**
 * Der MUELL ist seit E-034 ein frei versetzbarer Absetzcontainer.
 *
 * Geprüft wird deshalb sein STARTPLATZ und nichts weiter: Wohin der Spieler
 * ihn danach stellt, ist seine Sache („Der Container soll erstmal frei
 * bleiben, damit ich auch testen kann, wo der am besten steht"). Ein Wächter,
 * der ihm hinterherliefe, würde genau das verbieten, was gewollt ist.
 */
describe("Der Müllcontainer steht morgens richtig", () => {
  const muell = CONFIGS.find((c) => c.id === "r_rubble")!;

  /**
   * Abstand zweier achsparalleler Rechtecke. Negativ = sie durchdringen sich.
   *
   * Vorher stand hier eine PUNKTPROBE: neun Stellen im Raster 0,5 m um den
   * Container, jede gegen `hitsObstacle`. Die prüft nicht, was sie zu prüfen
   * vorgibt — ein Kasten kann eine Wand schneiden, ohne dass eine der neun
   * Stellen darin liegt, und umgekehrt schlägt sie Alarm, wo 20 cm Luft sind.
   * Nachgerechnet am 15.09.2026: Ein Platz mitten in der PRESSKAMMER kam
   * durch diese Probe glatt durch. Jetzt wird gerechnet, nicht gestochert.
   */
  function rechteckAbstand(
    a: { x: number; z: number; hw: number; hd: number },
    b: { x: number; z: number; hw: number; hd: number }
  ): number {
    const dx = Math.abs(a.x - b.x) - (a.hw + b.hw);
    const dz = Math.abs(a.z - b.z) - (a.hd + b.hd);
    if (dx >= 0 && dz >= 0) return Math.hypot(dx, dz);
    if (dx >= 0) return dx;
    if (dz >= 0) return dz;
    return Math.max(dx, dz);
  }

  /** Der Grundriss des Containers an seinem Startplatz. */
  const grundriss = () => ({
    x: muell.x,
    z: muell.z,
    hw: muell.size[0] / 2,
    hd: muell.size[1] / 2,
  });

  /**
   * So viel Luft muss zu jedem Bauwerk bleiben.
   *
   * Keine Vorliebe, sondern eine Untergrenze mit Grund: Der Container ist ein
   * DYNAMISCHER Körper. Steht er beim Spielstart in einer Wand, schiebt Rapier
   * ihn im ersten Schritt heraus — er springt weg, bevor Patrick ihn gesehen
   * hat (v2 E-010: Spawn ohne Überlappung). Ein Fingerbreit reicht dagegen.
   * Mehr ist auch nicht zu haben: Die einzige freie Tasche auf dem Platz ist
   * 0,19 m „dick" (E-041).
   *
   * 0,05 STATT 0,15 SEIT DEM 22.09.2026 (E-110), und das ist ein Nachgeben mit
   * Rechnung, kein Aufweichen: Die Nordflanke der Buntmetall-Mulde endet auf
   * z −16,25 und nicht auf −16,45 — die Hindernisliste führte die Wand 0,35 m
   * dick, gebaut ist sie 0,55 m. Damit ist die Tasche zwischen Wand (z −16,25
   * + 2,15 Containertiefe = −14,10) und Schwenkband (−13,98) nur noch 0,12 m
   * hoch. 0,15 m Luft sind darin nicht mehr unterzubringen, ohne das
   * Schwenkband oder die Fahrlinie aufzugeben; der Zweck der Schranke — kein
   * Spawn IN der Wand — ist mit 0,05 m ebenso erfüllt. Gemessen steht der
   * Container jetzt 0,08 m vor den Steinen (`tools/muldenwand-abgleich.ts`).
   */
  const MINDESTLUFT = 0.05;

  it("sein Startplatz liegt im Schwenkband — vierte Pflichtstation", () => {
    const d = abstandVomStand(muell.x, muell.z);
    expect(d, `MUELL ${d.toFixed(2)} m vom Sitz`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(d).toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("aber westlich der Rückfahrspur zum Abladeplatz", () => {
    /*
     * Ansage Patrick 15.09.2026: „Die LKWs fahren in die Müllmulde." Gemessen
     * lag die alte Mulde (7,0 | −27,0) mit ihrer Nordwand 2,45 x 0,70 m unter
     * der Ladefläche des haltenden Wagens.
     *
     * Die Spur ist der Streifen x = ABLADE_SPUR_X ± (halbe Wagenbreite 1,55 +
     * Tastrand 1,40) von der Rangierhöhe bis zum Halt. Der ganze Grundriss der
     * Mulde muss davon weg sein — samt Stirnwand, die 0,35 m übersteht.
     */
    const spurHalb = 1.55 + 1.4;
    const ostkante = muell.x + muell.size[0] / 2 + 0.35;
    expect(
      ostkante,
      `MUELL reicht bis x ${ostkante.toFixed(2)}, die Spur beginnt bei ${(
        ABLADE_SPUR_X - spurHalb
      ).toFixed(2)}`
    ).toBeLessThan(ABLADE_SPUR_X - spurHalb);
  });

  it("er ist oben offen und steht auf freiem Boden", () => {
    /*
     * Seit E-034 ist der MUELL ein Absetzcontainer, keine Betonlego-Mulde
     * mehr: oben offen, überall gleich hoch, und er steht in KEINER
     * Hindernisliste — bewegliche Behälter melden ihren Umriss jedes Bild neu
     * (`ContainerManager.hindernisse`), weil eine feste Liste keinen Kasten
     * führen kann, der wandert.
     *
     * Geprüft wird deshalb die Kehrseite: An seinem Startplatz steht nichts
     * Festes. Gerechnet gegen JEDES Bauwerk der Liste, als Rechteck gegen
     * Rechteck.
     */
    expect(muell.kind, "der MUELL ist wieder eine feste Mulde").toBe("rolloff");
    const g = grundriss();
    // Erst prüfen, ob die Zahlen Zahlen sind (sonst ist jeder Vergleich falsch).
    expect(
      Number.isFinite(g.x) && Number.isFinite(g.z) && Number.isFinite(g.hw) && Number.isFinite(g.hd),
      `Startplatz (${g.x} | ${g.z}) ist keine Koordinate`
    ).toBe(true);
    expect(STATIC_OBSTACLES.length, "die Hindernisliste ist leer").toBeGreaterThan(10);
    let engste = Infinity;
    let wo = "";
    for (const o of STATIC_OBSTACLES) {
      const d = rechteckAbstand(g, o);
      if (d < engste) {
        engste = d;
        wo = o.label;
      }
    }
    expect(
      engste,
      `der MUELL kommt ${engste.toFixed(2)} m an „${wo}" heran (Schranke ${MINDESTLUFT})`
    ).toBeGreaterThanOrEqual(MINDESTLUFT);
  });

  it("und er berührt die Buntmetall-Mulde nicht — auch den Sockel nicht", () => {
    /*
     * Ansage Patrick 15.09.2026: „Direkt neben Buntmetall-Mulde." Direkt
     * daneben heisst dicht dran und trotzdem frei.
     *
     * Vorher stand hier ein reiner x-Vergleich: „westliche Kante des MUELL
     * östlich der Schwelle". Der galt nur, solange der Container ÖSTLICH der
     * Mulde stand. Seit E-041 steht er nördlich von ihr — derselbe Vergleich
     * hätte dort Alarm geschlagen, obwohl 0,19 m Luft sind, weil er die
     * z-Richtung gar nicht kennt. Jetzt zählt der Abstand der Grundrisse.
     *
     * Mitgerechnet wird der SOCKEL: Die Schwellensteine stehen 0,55 m dick vor
     * der Mulde (Aussenkante x −4,95) und sind seit E-034 zwei Lagen = 1,00 m
     * hoch.
     *
     * BIS E-110 STAND HIER EIN FLICKEN: ein von Hand nachgetragenes Rechteck
     * für die Schwellensteine, weil die Hindernisliste die Schwelle nur mit
     * ±0,35 m um x −5,50 führte und damit „0,20 m zu viel" Luft meldete. Der
     * Flicken ist weg, weil der Grund weg ist — die Liste rechnet seit E-110
     * aus `muldenWaendeWelt()`, also aus derselben Quelle wie die Steine. Wer
     * hier wieder etwas von Hand nachtragen muss, hat einen Fehler in
     * `containers.ts` gefunden und soll ihn dort beheben.
     */
    const g = grundriss();
    for (const c of CONFIGS.filter((x) => x.sortierbox === true)) {
      const teile = STATIC_OBSTACLES.filter((o) => o.label.startsWith(c.label));
      expect(teile.length, `${c.label}: keine Wände in der Hindernisliste`).toBeGreaterThan(1);
      let engste = Infinity;
      let wo = "";
      for (const o of teile) {
        const d = rechteckAbstand(g, o);
        if (d < engste) {
          engste = d;
          wo = o.label;
        }
      }
      expect(
        engste,
        `${c.label}: der MUELL kommt ${engste.toFixed(2)} m an „${wo}" heran`
      ).toBeGreaterThanOrEqual(MINDESTLUFT);
      // ... und „direkt neben" heisst auch: nicht am anderen Ende des Platzes.
      expect(engste, `${c.label}: ${engste.toFixed(2)} m — das ist nicht mehr „daneben"`).toBeLessThan(
        2.0
      );
    }
  });

  it("und er steht nicht in der Fahrlinie des Baggers nach vorn", () => {
    /*
     * DER ANLASS VON E-041. Der Bagger schaut nach +z; fährt er geradeaus los,
     * prüft `ExcavatorCollision.chassisHits()` seinen Standpunkt gegen die
     * Hindernisliste — und die trägt zur Laufzeit auch die beweglichen
     * Behälter (`setBuildingObstacles` in `main.ts`). Am alten Startplatz
     * (−2,8 | −15,4) lagen zwischen Mitte und Fahrlinie 2,30 m, nötig sind
     * 1,80 + 1,50 = 3,30 — die Maschine stand nach 4,95 m.
     *
     * DIE 1,50 KOMMT SEIT E-107 AUS DER QUELLE und ist nicht mehr
     * abgeschrieben: Es ist die halbe Breite des GEBAUTEN Unterwagens
     * (`UNTERWAGEN_HALB_B`). Hier stand `CHASSIS_PAD` = 1,30 m — zwanzig
     * Zentimeter weniger, als die Maschine breit ist.
     *
     * Geprüft wird nur die Linie GERADEAUS. Wohin der Spieler den Container
     * danach schiebt, ist seine Sache; am Morgen soll der Weg frei sein.
     */
    const noetig = muell.size[0] / 2 + UNTERWAGEN_HALB_B;
    const seitlich = Math.abs(muell.x - BAGGER_STAND.x);
    expect(Number.isFinite(seitlich), "Seitenabstand ist keine Zahl").toBe(true);
    expect(
      seitlich - noetig,
      `nur ${seitlich.toFixed(2)} m neben der Fahrlinie, nötig sind ${noetig.toFixed(2)} m`
    ).toBeGreaterThan(0);
  });

  it("und er wird nicht gepresst — seit E-138 eine Abfrage der Presse, nicht mehr die Geometrie", async () => {
    /*
     * Ansage Patrick 15.09.2026: „Der Container kann nicht gepresst werden.
     * Dann gibt es die Fehlermeldung der Presse."
     *
     * Bis E-138 war das Geometrie: Die Kammer (4,20 x 4,05 m) war kuerzer als
     * der Container (4,30 m). Seit die Kammer 4,45 x 5,05 m misst (Patrick,
     * 17.10.2026: „die Schere muss etwas grösser werden"), passt er hinein —
     * also fragt die Presse: Steht ein beweglicher Koerper in der Kammer, der
     * weder Schrottteil noch Wrack ist, laeuft sie nicht los und nennt den
     * Grund. Geprueft am echten `PressManager` mit einem Koerper in den
     * Massen des Containers; die Gegenprobe ist derselbe Koerper als
     * Schrottteil angemeldet — dann presst sie.
     */
    const [w, d, h] = muell.size;
    const kammerLang = Math.max(PRESS_INNER.laenge, PRESS_INNER.tiefe);
    expect(Math.max(w, d), "der Container passt jetzt hinein — darum braucht es die Abfrage").toBeLessThan(kammerLang);
    await RAPIER.init();
    const lauf = (alsTeil: boolean): { los: boolean; grund: string | null } => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(PRESS_CENTER.x, 0.35, PRESS_CENTER.z)
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(d / 2, h / 2, w / 2).setTranslation(0, h / 2, 0), body);
      const items = { items: alsTeil ? [{ body }] : [] };
      const press = new PressManager(new THREE.Scene(), world, items as never, { cars: [] } as never);
      world.step();
      return { los: press.start(), grund: press.sperrgrund };
    };
    const container = lauf(false);
    expect(container.los, "die Presse lief mit dem Container los").toBe(false);
    expect(container.grund).toMatch(/Container/);
    const gegenprobe = lauf(true);
    expect(gegenprobe.los, "GEGENPROBE: ein Schrottteil muss gepresst werden").toBe(true);
    expect(gegenprobe.grund).toBeNull();
  });

  it("und der Abladeplatz selbst ist auf ganzer Wagenlänge frei", () => {
    // Umriss aus `vehicleModel.ts`: Heck −(bedLen/2 + 0,14), Kabine
    // +(bedLen/2 + 1,90) um den Haltepunkt, halbe Breite 1,55 m.
    const bedLen = 6.0; // der längste Wagen (Kipper)
    for (let dz = -(bedLen / 2 + 0.14); dz <= bedLen / 2 + 1.9; dz += 0.4) {
      for (const dx of [-1.55, 0, 1.55]) {
        expect(
          hitsObstacle(ABLADE_SPUR_X + dx, ABLADE_HALT_Z + dz, 0),
          `Abladeplatz belegt bei (${(ABLADE_SPUR_X + dx).toFixed(2)} | ${(
            ABLADE_HALT_Z + dz
          ).toFixed(2)})`
        ).toBeNull();
      }
    }
  });

  it("der Sitz steht noch dort, wo der Platz für ihn gebaut wurde", () => {
    expect(BAGGER_STAND).toEqual({ x: -0.5, z: -22.5 });
  });
});
