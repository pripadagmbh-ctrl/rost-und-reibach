import type RAPIER from "@dimforge/rapier3d-compat";
import type { EventBus, GameEvents } from "../core/events";
import type { WrackArt } from "../dismantle/carDef";
import type { Zweisprachig } from "./texte";

/**
 * DER AUFGABEN-RAHMEN (E-125, 06.10.2026; neu gefasst in E-162, 19.10.2026).
 *
 * Patrick: „Mit Challenges soll das Spiel anfangen, damit die Steuerung klar
 * wird." Eine Aufgabe ist DATEN (`katalog.ts`): was liegt wo, welche
 * Lernschritte, welche Schwellen fuer die Sterne. Hier steht nur, was alle
 * gemeinsam haben — das Beobachten, das Weiterruecken, das Zaehlen, das Werten.
 *
 * NUR BEOBACHTEN. Nichts hier bewegt einen Koerper, eine Spinne oder ein
 * Pendel (Regel 2). Ein Schritt gilt erst als geschafft, wenn das Spiel ihn
 * gesehen hat — nie nach Zeit. Was der Spieler schon richtig macht, wird
 * uebersprungen: Ein spaeterer Schritt, der schon zu sehen ist, nimmt die
 * frueheren mit.
 *
 * WAS NEU IST (E-162): Der Lauf hoert selbst auf die Ereignisse, die es schon
 * gibt (`itemEntered`, `itemLeft`, `schrott:aufprall`, `greifer:ueberlast`,
 * `wrack:geknautscht`, `fahrkunst:zyklus`), und zaehlt daraus, was man SIEHT:
 * Uhr, Fehlwuerfe, harte Aufschlaege, Ueberlast-Meldungen, Fremdteile im Ziel,
 * Abstand zur Markierung. Pendel-Ruhe in Grad ist keine Sternbedingung mehr
 * (Patrick 19.10.2026, Frage 5 A).
 *
 * WAS BEOBACHTET WERDEN KANN — die naechste Aufgabe waehlt aus dieser Liste;
 * wer etwas Neues beobachten will, setzt hier eine Zeile dazu.
 *
 * Teile (Aufgabe 1). „Das Teil" ist das gefasste Aufgaben-Teil, sonst das
 * erste, das noch nicht im Ziel liegt:
 *   blick_auf_teil     der Oberwagen schaut aufs Teil (Winkel klein)
 *   spinne_am_teil     die Spinne steht ueber dem Teil — waagrecht nah UND
 *                      tief genug, dass Schliessen es packt
 *   teil_gefasst       das Teil haengt in der Spinne
 *   teil_gehoben       gefasst und hoch genug, um ueber die Wand des
 *                      Zielbehaelters zu kommen
 *   teil_ueber_ziel    gefasst und ueber dem Zielbehaelter
 *   teil_im_ziel       ALLE Aufgaben-Teile liegen im Zielbehaelter, keines
 *                      mehr in der Spinne
 *
 * Wrack und Presse (E-125, Aufgabe 2 — unveraendert):
 *   wrack_gefasst      das Wrack haengt in der Spinne
 *   wrack_ueber_kammer es haengt in der Spinne und steht waagerecht ueber
 *                      der Presskammer (Pruefung der Presse selbst)
 *   wrack_in_kammer    losgelassen und in der Kammer — genau das, was die
 *                      Presse beim Stempeln als „drin" zaehlt (`inChamber`).
 *                      Bewusst NICHT „still": Quer aufgelegt ruht ein Wrack
 *                      auf Wandkrone und Klappe und schlaeft dort nie ein
 *                      (gemessen, `tools/challenge-ruhe.ts`).
 *   wrack_gepresst     die Presse hat zugeschlagen, nachdem sie mit dem Wrack
 *                      in der Kammer gestartet wurde
 */
export type Beobachtung =
  | "blick_auf_teil"
  | "spinne_am_teil"
  | "teil_gefasst"
  | "teil_gehoben"
  | "teil_ueber_ziel"
  | "teil_im_ziel"
  | "wrack_gefasst"
  | "wrack_ueber_kammer"
  | "wrack_in_kammer"
  | "wrack_gepresst";

/**
 * Was der Geisterdaumen zeigt — die Form steht in `core/events.ts`.
 *
 * `richtung` ist das VORZEICHEN DES BEFEHLS, wie ihn der Bagger bekommt
 * (gelesen in `excavator/excavator.ts`, Zeilen „inCab/inBoom/inStick" und
 * „Spinne"; Tastatur `input.axis(minus, plus)`, Touch `touch.axes.*`):
 *   grapple  plus = schliessen (Leertaste, rechter Stick nach rechts),
 *            minus = oeffnen — dasselbe „plus" wie in `ui/challengekarte.ts`
 *   boom     plus = Hauptarm HEBEN (Taste R, `boomAngle` steigt),
 *            minus = senken (Taste F)
 *   cab      plus = `cabYaw` steigt (Taste Q). Blickrichtung ist
 *            (sin, cos) von `heading + cabYaw`; steigt der Winkel, dreht der
 *            Oberwagen nach +x — vom Fahrer aus nach LINKS (er schaut beim
 *            Start nach +z, rechts von ihm ist −x). minus = nach rechts (E).
 *   stick    plus = Ausleger WEG (Taste T, `stickAngle` steigt Richtung
 *            −25°, die Spitze geht nach aussen), minus = heran (G)
 * Welcher Stick und welche Bildschirmrichtung das sind, weiss nur die
 * Anzeige — die Belegung ist frei (`core/controlConfig.ts`).
 */
export type Zeige = GameEvents["challenge:schritt"]["zeige"];

export interface Lernschritt {
  /** Woran das Spiel erkennt, dass der Schritt geschafft ist */
  beobachtet: Beobachtung;
  titel: Zweisprachig;
  /**
   * Bildschirmtext. Platzhalter fuer die Bedienung — `{schwenken}`,
   * `{hauptarm}`, `{ausleger}`, `{schliessen}`, `{oeffnen}` — setzt die
   * Anzeige aus der Stickbelegung ein (`ui/challengekarte.ts`). In BEIDEN
   * Sprachen dieselben (Waechter in `test/aufgabe1.test.ts`).
   */
  text: Zweisprachig;
  /** Geisterdaumen: welche Bewegung, in welche Richtung; null = keiner */
  zeige: Zeige;
}

/**
 * Was am Ende gemessen vorliegt — nur Sichtbares (Patrick 19.10.2026).
 * Die Schluesselnamen sind mit der Anzeige vereinbart (Abschlusstafel,
 * Sternziel-Zeilen); wer einen umbenennt, bricht `ui/abrechnung.ts`.
 */
export interface ChallengeMessung {
  /** Spielzeit vom Start bis zum letzten Schritt (s), ohne Pause */
  zeitS: number;
  /** Aufgaben-Teile, die in einer falschen Mulde gelandet sind — je Teil und Einwurf einmal */
  fehlwuerfe: number;
  /** Aufschlaege eigener Teile/Wracks ab `HART_AB_MS` */
  harteAufschlaege: number;
  /** Fahrkunst Praezision (E-119): Abstand zum Ablageziel im Liegen (cm); null = ohne Ziel/Zyklus */
  praezisionCm: number | null;
  /** Ueberlast-Meldungen der Maschine (E-152) */
  ueberlasten: number;
  /** Falsche Teile, die beim Abschluss im Zielbehaelter liegen (Stand, nicht Ereignis) */
  fremdteile: number;
}

/** Obergrenzen je Messgroesse. Was fehlt, zaehlt fuer diesen Stern nicht. */
export type Schwellen = Partial<Record<keyof ChallengeMessung, number>>;

/** Ein Stern ist der Boden (geschafft). Zwei und drei verlangen ALLE ihre Schwellen. */
export interface ChallengeWertung {
  zwei: Schwellen;
  drei: Schwellen;
}

/** Ein Teil aus dem Teilekatalog (`name` wie in `world/objektkatalog.ts` bzw. `scrapItems.ts`). */
export interface AufbauTeil {
  name: string;
  x: number;
  z: number;
  /** Drehung um die Hochachse (rad) */
  gier?: number;
}

export interface AufbauWrack {
  art: WrackArt;
  x: number;
  z: number;
  gier?: number;
}

/** Was auf dem sonst leeren Platz steht (gebaut von `aufbau.ts`). */
export interface ChallengeAufbau {
  teile?: readonly AufbauTeil[];
  wracks?: readonly AufbauWrack[];
  /** Mit welchem Greifer die Aufgabe beginnt (Kennung aus `excavator/greiferwahl.ts`) */
  greifer?: "fuenfschalen" | "magnet";
}

export interface ChallengeDaten {
  id: string;
  /** Knopf im Hauptmenue und Kopf des Abschlussbilds */
  name: Zweisprachig;
  /** Kleingedrucktes im Hauptmenue */
  beschreibung: Zweisprachig;
  /** Ein Satz auf der Karte: was zu tun ist */
  ziel: Zweisprachig;
  aufbau: ChallengeAufbau;
  /**
   * Wohin die Teile gehoeren (Container-ID aus `world/containers.ts`). Ist er
   * gesetzt, gilt ein Fahrkunst-Zyklus ueber ihm als „am Ziel"; sonst ueber
   * der Presskammer.
   */
  zielBehaelter?: string;
  /** Ablageziel fuer die Praezision (`Fahrkunst.ziel`); null = keins */
  ablageziel: { x: number; z: number } | null;
  schritte: readonly Lernschritt[];
  wertung: ChallengeWertung;
}

/** Erfuellt die Messung alle diese Schwellen? Ungemessen erfuellt keine. */
export function erfuellt(s: Schwellen, m: ChallengeMessung): boolean {
  return (Object.keys(s) as Array<keyof ChallengeMessung>).every((k) => {
    const v = m[k];
    return v !== null && v <= s[k]!;
  });
}

/** Ein bis drei Sterne — die einzige Stelle, an der sie entstehen. */
export function sterne(w: ChallengeWertung, m: ChallengeMessung): number {
  return erfuellt(w.drei, m) ? 3 : erfuellt(w.zwei, m) ? 2 : 1;
}

/* ------------------------------------------------------------------------ */
/* Schwellen der Beobachtung — alle SW, nach Patricks ersten Laeufen nachstellen */
/* ------------------------------------------------------------------------ */

/**
 * Ab dieser Wucht (m/s Tempoverlust, wie `schrott:aufprall` sie meldet) ist
 * ein Aufschlag „hart". // SW: 5,0 m/s ist der freie Fall aus 1,3 m
 * (√(2 · 9,81 · 1,27)). Gehaltene Last meldet 2 × Senktempo
 * (`audio/klangregeln.ts` `lastAufschlagWucht`): mit vollem Arm (3,15 m/s,
 * gemessen E-134) aufgesetzt sind das 6,3 — hart; nur mit dem Ausleger
 * (2,13 m/s) 4,3 — nicht hart; ruhig abgesetzt meldet der Melder 1,5. Der
 * Ton macht ab 1,5 einen eigenen Schlag (`SCHLAG_AB_MS`) — „hart" liegt
 * deutlich darueber, sonst zaehlte jedes Ablegen.
 */
export const HART_AB_MS = 5.0;

/**
 * „Der Oberwagen schaut aufs Teil": Winkel zwischen Blickrichtung und
 * Richtung Drehmitte → Teil. // SW: 6° sind auf 8,1 m Ausladung (gemessen,
 * `test/aufgabe1.test.ts`) 0,85 m seitlich — gemessen greift der
 * Fuenfschalengreifer den Kupfer-Boiler noch mit 0,8 m Versatz. Das Teil der
 * Aufgabe 1 liegt 15° neben der Startblickrichtung, der Schritt kann sich also
 * nicht selbst erledigen.
 */
export const BLICK_TOLERANZ_RAD = (6 * Math.PI) / 180;

/**
 * „Die Spinne steht am Teil", waagrecht: Abstand Sensorpunkt → Teilmitte.
 * // SW: 0,8 m — bis dahin greift der Fuenfschalengreifer den Kupfer-Boiler
 * gemessen noch (`test/aufgabe1.test.ts`, Versatz 0 / 0,4 / 0,8 m).
 */
export const SPINNE_WAAGRECHT_M = 0.8;

/**
 * „… und tief genug": Hoehe Sensorpunkt ueber Teilmitte. // SW: 1,2 m.
 * Gemessen (Fuenfschalengreifer, `test/aufgabe1.test.ts`): in der Startpose
 * steht der Sensor 1,76 m ueber der Mitte des liegenden Boilers, mit dem
 * Hauptarm bis zum Boden gesenkt 0,87 m. 1,2 m liegt dazwischen und knapp
 * unter dem Sensorradius (1,24 m) — die Greifkugel reicht dann bis zur
 * Teilmitte.
 */
export const SPINNE_HOEHE_M = 1.2;

/**
 * „Gehoben": so viel Luft muss die Unterkante des Teils ueber der Wand des
 * Zielbehaelters haben. // SW: 0,3 m — eine Handbreit mehr als die Wand,
 * damit es beim Schwenken nicht an der Krone haengen bleibt.
 */
export const HUB_LUFT_M = 0.3;

/** Ohne Zielbehaelter: so hoch ueber seiner Liegehoehe gilt ein Teil als gehoben. // SW: 1,0 m, deutlich mehr als jedes Zucken beim Zupacken */
export const HUB_OHNE_ZIEL_M = 1.0;

/* ------------------------------------------------------------------------ */
/* Was der Lauf von der Welt liest — mehr nicht                              */
/* ------------------------------------------------------------------------ */

export interface Punkt {
  x: number;
  y: number;
  z: number;
}

/**
 * Die Quellen des Laufs. Fertig verdrahtet fuer das Spiel in
 * `challenges/quellen.ts` (`weltQuellen`); Tests geben Attrappen.
 */
export interface ChallengeQuellen {
  /** Was gerade in der Spinne haengt (`grip.grippedBodies`) */
  gegriffen(): ReadonlyArray<{ handle: number }>;
  /** Sensorpunkt der Spinne (`excavator.getSensorPosition`) */
  spinne(): Punkt;
  /** Drehmitte des Oberwagens (`excavator.position`) */
  drehmitte(): { x: number; z: number };
  /** Weltgier des Oberwagens, `heading + cabYaw` (rad); Blick = (sin, cos) */
  blickRad(): number;
  /** Ort und Wandoberkante eines Behaelters, null wenn es ihn nicht gibt */
  behaelter(id: string): { x: number; z: number; oberkante: number } | null;
  /** Steht der Punkt ueber dem Behaelter? (`GameContainer.isOverhead`, beruecksichtigt die Drehung) */
  ueberBehaelter(id: string, p: { x: number; z: number }): boolean;
  /** In welchem Behaelter das Teil laut Zonen-Zaehlung liegt (`ScrapItem.containerId`) */
  behaelterVon(itemId: string): string | null;
  /** `PressManager.ueberKammer` */
  ueberKammer(p: { x: number; z: number }): boolean;
  /** `PressManager.inChamber` */
  inKammer(p: Punkt): boolean;
}

/** Was ein Koerper der Aufgabe koennen muss — ein `RAPIER.RigidBody` kann es. */
export type AufgabenKoerper = Pick<RAPIER.RigidBody, "handle" | "translation" | "isValid">;

/** Die Objekte, die `aufbau.ts` fuer die Aufgabe gebaut hat (`ScrapItem` / `CarComposite` passen). */
export interface ChallengeObjekte {
  teile: ReadonlyArray<{ id: string; body: AufgabenKoerper }>;
  wracks: ReadonlyArray<{ body: AufgabenKoerper }>;
}

type Marke = GameEvents["challenge:stand"]["marken"][number];

export class ChallengeLauf {
  zeitS = 0;
  geschafft = false;
  /** Hoechster beobachteter Schritt (Index), −1 = noch keiner */
  private erreicht = -1;
  private gemeldet = -1;
  private laeuft = false;
  /** Nach `beenden()` stumm — der EventBus kennt kein `off` (E-162) */
  private aus = false;

  private inKammer = false;
  private freigegeben = false;
  private gepresst = false;
  /** Letzter Fahrkunst-Zyklus, der am Ziel zur Ruhe kam */
  private zyklus: GameEvents["fahrkunst:zyklus"] | null = null;

  private fehlwuerfe = 0;
  private harteAufschlaege = 0;
  private ueberlasten = 0;
  /** Hoechster gemeldeter Knautschgrad eines Aufgaben-Wracks (Aufgabe 4 liest ihn) */
  knautschgrad = 0;
  /** Teile, deren falscher Einwurf schon gezaehlt ist — frei erst nach erneutem Greifen */
  private falschGezaehlt = new Set<string>();
  /** Falsche Teile, die gerade im Zielbehaelter liegen */
  private fremdImZiel = new Set<string>();
  /** Liegehoehe je Teil (tiefste Mitte, solange es nicht gefasst war) */
  private liegeY = new Map<string, number>();

  private readonly teilIds: ReadonlySet<string>;
  private readonly eigeneHandles: ReadonlySet<number>;

  constructor(
    readonly daten: ChallengeDaten,
    /** Stelle im Katalog, ab 1 (`challenge:start`) */
    readonly nr: number,
    private q: ChallengeQuellen,
    private bus: EventBus,
    private objekte: ChallengeObjekte
  ) {
    this.teilIds = new Set(objekte.teile.map((t) => t.id));
    this.eigeneHandles = new Set([
      ...objekte.teile.map((t) => t.body.handle),
      ...objekte.wracks.map((w) => w.body.handle),
    ]);
    const zaehlt = (): boolean => this.laeuft && !this.aus && !this.geschafft;
    bus.on("itemEntered", (e) => {
      if (!zaehlt()) return;
      if (!e.correct && e.containerId === daten.zielBehaelter) this.fremdImZiel.add(e.itemId);
      if (e.correct || !this.teilIds.has(e.itemId) || this.falschGezaehlt.has(e.itemId)) return;
      this.falschGezaehlt.add(e.itemId);
      this.fehlwuerfe++;
    });
    bus.on("itemLeft", (e) => {
      if (!zaehlt()) return;
      if (e.containerId === daten.zielBehaelter) this.fremdImZiel.delete(e.itemId);
    });
    bus.on("schrott:aufprall", (e) => {
      if (!zaehlt() || e.handle === undefined || !this.eigeneHandles.has(e.handle)) return;
      if (e.wucht >= HART_AB_MS) this.harteAufschlaege++;
    });
    bus.on("greifer:ueberlast", () => {
      if (zaehlt()) this.ueberlasten++;
    });
    bus.on("wrack:geknautscht", (e) => {
      if (zaehlt() && this.eigeneHandles.has(e.handle)) this.knautschgrad = Math.max(this.knautschgrad, e.grad);
    });
    bus.on("fahrkunst:zyklus", (e) => {
      if (zaehlt()) this.zyklusGemessen(e);
    });
  }

  /** `challenge:start`, dann den ersten Schritt zeigen. */
  start(): void {
    if (this.laeuft || this.aus) return;
    this.laeuft = true;
    for (const t of this.objekte.teile) {
      if (t.body.isValid()) this.liegeY.set(t.id, t.body.translation().y);
    }
    const d = this.daten;
    this.bus.emit("challenge:start", { id: d.id, nr: this.nr, name: d.name, ziel: d.ziel, wertung: d.wertung });
    this.melde();
  }

  /** Nach ↻ oder Verlassen: ab jetzt stumm, zaehlt und meldet nichts mehr. */
  beenden(): void {
    this.aus = true;
  }

  get beendet(): boolean {
    return this.aus;
  }

  /** Einmal je Bild, ausserhalb der Pause. */
  takt(dt: number): void {
    if (!this.laeuft || this.aus || this.geschafft) return;
    this.zeitS += dt;
    const { jetzt, marken } = this.beobachte();
    // Was der Spieler schon richtig macht, wird uebersprungen: Ein spaeterer
    // Schritt, der schon zu sehen ist, nimmt die frueheren mit.
    this.daten.schritte.forEach((s, i) => {
      if (jetzt[s.beobachtet] && i > this.erreicht) this.erreicht = i;
    });
    this.bus.emit("challenge:stand", {
      id: this.daten.id,
      zeitS: this.zeitS,
      zaehler: null,
      balken01: null,
      pressenBereit: this.pressenBereit,
      tipp: null,
      marken,
    });
    this.melde();
  }

  /** Fahrkunst-Zyklus vom Bus. Gilt nur, wenn die Ladung am Ziel liegt. */
  zyklusGemessen(e: GameEvents["fahrkunst:zyklus"]): void {
    const z = this.daten.zielBehaelter;
    if (z ? this.q.ueberBehaelter(z, e) : this.q.ueberKammer(e)) this.zyklus = e;
  }

  /** Der Knopf PRESSEN darf auf die Karte: Wrack losgelassen in der Kammer, noch nicht gepresst. */
  get pressenBereit(): boolean {
    return this.inKammer && !this.gepresst && this.daten.schritte.some((s) => s.beobachtet === "wrack_gepresst");
  }

  /**
   * Darf die Presse jetzt laufen? Erst, wenn das Wrack losgelassen in der
   * Kammer ist — eine leere Presse waere kein Lernschritt.
   */
  pressenErlaubt(): boolean {
    if (this.inKammer) this.freigegeben = true;
    return this.inKammer;
  }

  /** `press.onStamp` — zaehlt nur nach einem freigegebenen Start. */
  presseHatGestempelt(): void {
    if (this.freigegeben && !this.aus) this.gepresst = true;
  }

  /** Was gerade zu sehen ist — und wo die Markierungen hingehoeren. */
  private beobachte(): { jetzt: Record<Beobachtung, boolean>; marken: Marke[] } {
    const q = this.q;
    const ziel = this.daten.zielBehaelter;
    const griff = new Set(q.gegriffen().map((b) => b.handle));
    const marken: Marke[] = [];

    // --- Teile -----------------------------------------------------------
    const lebend = this.objekte.teile.filter((t) => t.body.isValid());
    let gefasst: (typeof lebend)[number] | null = null;
    /*
     * Im Ziel heisst: losgelassen, in der Zone UND schon unter der Wandkrone
     * (qa-Befund 19.10.2026: Die Zone zaehlt das Teil, waehrend es noch ueber
     * der 2-m-Wand faellt — prallte es heraus, waere die Aufgabe trotzdem
     * geschafft). Mitte unter der Oberkante = es ist drin, nicht darueber.
     */
    const zielKrone = ziel ? (q.behaelter(ziel)?.oberkante ?? Infinity) : Infinity;
    const imZiel = (t: { id: string; body: AufgabenKoerper }): boolean =>
      !!ziel && !griff.has(t.body.handle) && q.behaelterVon(t.id) === ziel && t.body.translation().y < zielKrone;
    for (const t of lebend) {
      const p = t.body.translation();
      if (griff.has(t.body.handle)) {
        gefasst ??= t;
        // Neu gegriffen: ein neuer Einwurf darf wieder als Fehlwurf zaehlen
        this.falschGezaehlt.delete(t.id);
        continue;
      }
      const alt = this.liegeY.get(t.id);
      if (alt === undefined || p.y < alt) this.liegeY.set(t.id, p.y);
      if (!imZiel(t)) marken.push({ x: p.x, y: p.y + this.liegeY.get(t.id)!, z: p.z, art: "teil" });
    }
    const teil = gefasst ?? lebend.find((t) => !imZiel(t)) ?? null;
    const zielOrt = ziel ? q.behaelter(ziel) : null;
    if (gefasst && zielOrt) marken.push({ x: zielOrt.x, y: zielOrt.oberkante, z: zielOrt.z, art: "ziel" });

    let blick = false;
    let amTeil = false;
    let gehoben = false;
    let ueberZiel = false;
    if (teil) {
      const p = teil.body.translation();
      const m = q.drehmitte();
      const a = q.blickRad();
      const zuTeil = Math.atan2(p.x - m.x, p.z - m.z);
      blick = Math.abs(winkelDiff(a, zuTeil)) <= BLICK_TOLERANZ_RAD;
      const s = q.spinne();
      amTeil = Math.hypot(s.x - p.x, s.z - p.z) <= SPINNE_WAAGRECHT_M && s.y - p.y <= SPINNE_HOEHE_M;
      if (gefasst) {
        const liege = this.liegeY.get(teil.id) ?? p.y;
        // Unterkante ≈ Mitte − halbe Hoehe; liegend auf dem Boden (y 0) ist die Mitte die halbe Hoehe
        const unterkante = p.y - liege;
        gehoben = zielOrt ? unterkante >= zielOrt.oberkante + HUB_LUFT_M : unterkante >= HUB_OHNE_ZIEL_M;
        ueberZiel = !!ziel && q.ueberBehaelter(ziel, p);
      }
    }
    const alleImZiel = !!ziel && lebend.length > 0 && lebend.every(imZiel);

    // --- Wrack (E-125) -----------------------------------------------------
    const w = this.objekte.wracks[0];
    const wb = w && w.body.isValid() ? w.body : null;
    const wp = wb?.translation();
    const wGefasst = !!wb && griff.has(wb.handle);
    this.inKammer = !!wb && !wGefasst && q.inKammer(wp!);

    return {
      jetzt: {
        blick_auf_teil: blick,
        spinne_am_teil: amTeil,
        teil_gefasst: !!gefasst,
        teil_gehoben: gehoben,
        teil_ueber_ziel: ueberZiel,
        teil_im_ziel: alleImZiel,
        wrack_gefasst: wGefasst,
        wrack_ueber_kammer: wGefasst && q.ueberKammer(wp!),
        wrack_in_kammer: this.inKammer,
        wrack_gepresst: this.gepresst,
      },
      marken,
    };
  }

  /** Die Messung, wie sie jetzt steht. */
  messung(): ChallengeMessung {
    return {
      zeitS: this.zeitS,
      fehlwuerfe: this.fehlwuerfe,
      harteAufschlaege: this.harteAufschlaege,
      praezisionCm: this.zyklus?.praezisionCm ?? null,
      ueberlasten: this.ueberlasten,
      fremdteile: this.fremdImZiel.size,
    };
  }

  private melde(): void {
    const n = this.daten.schritte.length;
    const nr = this.erreicht + 1;
    if (nr === this.gemeldet) return;
    this.gemeldet = nr;
    if (nr < n) {
      const s = this.daten.schritte[nr]!;
      this.bus.emit("challenge:schritt", {
        id: this.daten.id,
        nr: nr + 1,
        von: n,
        titel: s.titel,
        text: s.text,
        zeige: s.zeige,
      });
      return;
    }
    this.geschafft = true;
    const messung = this.messung();
    this.bus.emit("challenge:geschafft", {
      id: this.daten.id,
      name: this.daten.name,
      sterne: sterne(this.daten.wertung, messung),
      messung,
      wertung: this.daten.wertung,
    });
  }
}

/** Kleinster Winkel von b nach a, −π … π. */
function winkelDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
