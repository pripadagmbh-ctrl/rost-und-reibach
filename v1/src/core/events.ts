import type { Tagesbilanz } from "../economy/shift";
import type { ChallengeMessung, ChallengeWertung } from "../challenges/challenge";

/**
 * Typisierter Event-Bus (Briefing Kap. 17): Module kommunizieren nur über Events,
 * kein Modul greift in ein anderes hinein.
 */
export interface GameEvents {
  /** Ein Item ist in einen Container gefallen (per Zonen-Zählung erkannt) */
  itemEntered: { itemId: string; materialId: string; containerId: string; correct: boolean };
  /** Ein Item wurde aus einem Container entfernt (Nachsortieren) */
  itemLeft: { itemId: string; containerId: string };
  /** Greifer hat zugepackt */
  grabbed: { count: number; massKg: number };
  /**
   * Greifer hat losgelassen. Seit E-121 mit Zuhoerer (Ton: Ventil oeffnet);
   * ausgeloest von `grip.onReleased` in main.ts.
   */
  released: { count: number };
  /** Eine Scheibe ist geborsten (Position für Partikel/Sound) */
  glassShattered: { x: number; y: number; z: number };
  /** Karosse hat eine Quetschstufe genommen */
  crushed: { stage: number; x: number; y: number; z: number };
  /** Baugruppe wurde abgerissen */
  partTorn: { name: string };
  /** Zaunfeld aus der Verankerung gerissen/gefahren */
  fenceBroken: { x: number; y: number; z: number };
  /**
   * Der Greifer wurde im Pausenmenue gewechselt (E-059).
   *
   * `greifer` ist die Kennung, die auch im Spielstand steht („sichel" oder
   * „fuenfschalen"), `name` der Klartext fuers HUD. Ton und Anzeige haengen
   * nur hier dran, nicht an der Maschine (Projektregel 10).
   */
  "greifer:gewechselt": { greifer: string; name: string };
  /**
   * Die Spinne hat mit Druck auf etwas zugedrueckt (E-112, 22.09.2026).
   *
   * Gemeldet wird EIN Biss je Koerper: `handle` ist der Rapier-Handle des
   * Getroffenen (vor dem Zugriff `isValid()` pruefen, E-103), `kraftKN` die
   * Schliesskraft in Kilonewton zum Zeitpunkt des Bisses, `x/y/z` der Ort des
   * Koerpers — dieselbe Form wie bei `crushed`.
   *
   * `kraftKN` ist abgestuft, keine Ja/Nein-Meldung: Wer haerter und laenger
   * zudrueckt, meldet mehr. Was mit dem Koerper passiert, entscheidet der
   * Zuhoerer; der Greifer sagt nur, wie hart er gedrueckt hat. Kein Wertabzug
   * haengt daran (Ansage Patrick 22.09.2026: „kaputt machen verliert keinen
   * wert").
   */
  "greifer:zugedrueckt": { handle: number; kraftKN: number; x: number; y: number; z: number };
  /**
   * Torschluss — es kommt keine Fuhre mehr herein (E-113, 22.09.2026).
   *
   * Eine Stunde vor Feierabend (`TORSCHLUSS_TIME` in `economy/shift.ts`). Das
   * ist der Anlass, an dem der Verkehr ausläuft; Mario sagt es durchs Funk,
   * die Tagesablaufzeile schreibt es hin. Payload leer: Wer mehr wissen will,
   * fragt `shift`.
   */
  "tag:torschluss": Record<string, never>;
  /**
   * Feierabend — der Arbeitstag ist zu Ende, hier ist die Abrechnung (E-113).
   *
   * Kommt genau einmal je Tag, zur Zeit `FEIERABEND_TIME`. Die Zahlen sind
   * fertig gerechnet (`shift.bilanz()`); Anzeige und Ton lesen sie nur ab und
   * rechnen nichts nach — die Sortierquote hat eine Quelle, und das ist
   * `economy/shift.ts`.
   */
  "tag:feierabend": Tagesbilanz;
  /**
   * Der nächste Tag beginnt (E-113).
   *
   * Nach der Abrechnung: Tageszähler auf null, Uhr auf den frühen Morgen, der
   * Kontostand bleibt. Wer etwas je Tag zurücksetzt, hängt sich hier an.
   */
  "tag:neu": { tag: number };
  /**
   * Ein Umschlag ist fertig: gegriffen, losgelassen, und die Ladung liegt
   * (E-119, 06.10.2026). Je gezaehltem Zyklus EIN Ereignis mit allen fuenf
   * Fahrkuensten.
   *
   * Die Definitionen stehen an EINER Stelle: im Kopf von
   * `skills/fahrkunst.ts`. Anzeige und Challenge lesen die Zahlen nur ab und
   * rechnen nichts nach. `null` heisst „ohne Vorgabe nicht messbar" — dann
   * wurde kein Ziel erfunden. `x/z` ist der Ladungspunkt im Liegen.
   */
  "fahrkunst:zyklus": {
    /** Abstand zum Ablageziel (cm), null ohne Ziel */
    praezisionCm: number | null;
    /** Pendelausschlag beim Loslassen (Grad) */
    ruheGrad: number;
    /** Zyklen pro Minute, null beim ersten Zyklus ohne Startzeit */
    tempoProMin: number | null;
    /** Abwurfgeschwindigkeit (m/s) */
    wurfMS: number;
    /** Weite vom Loslasspunkt bis zum Liegen (m) */
    wurfweiteM: number;
    /** Hoechste Schliesskraft waehrend des Haltens (kN) */
    kraftKN: number;
    /** Abstand der Spitzenkraft zur vorgegebenen Kraft (kN), null ohne Vorgabe */
    gefuehlKN: number | null;
    x: number;
    z: number;
  };
  /**
   * Eine Challenge zeigt ihren naechsten Lernschritt (E-125, 06.10.2026).
   *
   * `nr` zaehlt ab 1, `von` ist die Zahl der Schritte. `text` traegt noch die
   * Platzhalter der Bedienung (`{schliessen}` usw.) — welcher Stick das ist,
   * weiss nur die Anzeige, denn die Belegung ist frei waehlbar.
   */
  "challenge:schritt": { id: string; nr: number; von: number; titel: string; text: string };
  /**
   * Eine Challenge ist geschafft (E-125). Die Sterne sind fertig gerechnet
   * (`challenges/challenge.ts`); das Abschlussbild liest sie nur ab.
   * `wertung` sind die Schwellen der Challenge, damit das Bild sagen kann,
   * was zum naechsten Stern fehlt.
   */
  "challenge:geschafft": {
    id: string;
    name: string;
    sterne: number;
    messung: ChallengeMessung;
    wertung: ChallengeWertung;
  };
  /**
   * Ein Schrottteil schlaegt auf (E-121, 06.10.2026).
   *
   * Ausgeloest von `items.onAufprall` in main.ts (der Melder sitzt in
   * `world/scrapItems.ts`: Tempoverlust in einem Schritt, je Teil hoechstens
   * alle 0,18 s). `wucht` ist dieser Tempoverlust in m/s. `blech` heisst:
   * nachgiebig (`items.isCrushable`) — Stahlblech scheppert, massiver Stahl
   * wummert. `untergrund` sagt, worauf es faellt: Beton (Platz, Betonboxen),
   * Stahl (Ladeflaeche, Mulde) oder Schrott (auf anderen Teilen).
   *
   * Der Ton entscheidet selbst, was davon einen eigenen Schlag bekommt und was
   * nur ins Rasseln geht — der Melder meldet alles.
   */
  "schrott:aufprall": {
    materialId: string;
    massKg: number;
    wucht: number;
    blech: boolean;
    /** Späneknäuel (E-147): raschelt wie Draht statt nach Blech zu klingen */
    spaene?: boolean;
    untergrund: "beton" | "stahl" | "schrott";
    x: number;
    y: number;
    z: number;
  };
  /**
   * Das Wrack knautscht (E-128 baut das Knautschen, E-130 haengt den Ton an).
   *
   * Gesendet von `CarComposite.knautschAnwenden()` in `dismantle/composites.ts`,
   * und nur, wenn der mittlere Knautschgrad dabei gestiegen ist — ein Biss auf
   * ein schon flaches Wrack meldet nichts. `handle` ist der Rapier-Handle der
   * Karosse, `grad` der mittlere Knautschgrad 0 (heil) … 1 (flach), `zuwachs`
   * um wie viel er bei diesem Ereignis gestiegen ist: ein voller Biss etwa
   * 0,17, die Presse bis 1. `x/y/z` Ort der Karosse.
   */
  "wrack:geknautscht": { handle: number; grad: number; zuwachs: number; x: number; y: number; z: number };
  /**
   * Die LEERE Spinne (offen oder zu) schlaegt auf — Haemmern (E-137, Vertrag
   * mit dem Ton aus E-139). Einmal je Schlag, nicht je Bild: Gemeldet wird der
   * Uebergang frei → Kontakt bei mindestens 0,8 m/s Senktempo, ein neuer
   * Schlag erst nach 0,15 s frei (`excavator/aufschlag.ts`, wie E-134). Mit
   * Last meldet weiter `schrott:aufprall`. `wucht` 0..1 (1 = Ausleger und
   * Stiel voll, 3,15 m/s); `untergrund`: worauf — tragender Grund (Beton,
   * Stahl wie Ladeflaeche/Mulde), loses Teil (schrott) oder Karosse (wrack).
   * `x/y/z`: Krallenspitze.
   */
  "spinne:aufschlag": {
    wucht: number;
    untergrund: "beton" | "stahl" | "schrott" | "wrack";
    x: number;
    y: number;
    z: number;
  };
  /**
   * Die leere Spinne drueckt auf etwas (E-137, Vertrag mit dem Ton aus
   * E-139). Hoechstens alle 0,25 s, solange gedrueckt wird — und nur, wenn
   * sich etwas tut: beim Ansetzen einmal, danach nur, wenn das Material
   * nachgibt (die Spitze sinkt oder das Teil bewegt sich). Wer auf Beton
   * drueckt, hoert nichts — kein Dauerton. `staerke` 0..1 = wie weit der
   * Spieler nach unten drueckt.
   */
  "spinne:druecken": {
    staerke: number;
    untergrund: "beton" | "stahl" | "schrott" | "wrack";
    x: number;
    y: number;
    z: number;
  };
  /**
   * Der Lasthebemagnet (E-146) wird eingeschaltet („schliessen") bzw.
   * ausgeschaltet („oeffnen" — was haengt, faellt; das Fallen meldet weiter
   * `released`). Einmal je Umschalten, nicht je Bild. Fuer den Ton: Brummen
   * an, Klacken des Schuetzes.
   */
  "magnet:an": Record<string, never>;
  "magnet:aus": Record<string, never>;
  /**
   * Teile sind an der Scheibe angeschlagen und haften. `massKg`: was in
   * diesem Schritt dazugekommen ist (mehrere Teile im selben Schritt = eine
   * Meldung). Fuer den Ton: der dumpfe Klonk, lauter mit der Masse.
   */
  "magnet:haftet": { massKg: number };
  /**
   * E-152: Ueberlast wie an einer echten Maschine (Ueberlastwarneinrichtung
   * nach EN 474-5). Was in der Spinne haengt, ist schwerer, als die
   * Traglasttabelle bei dieser Ausladung erlaubt — Heben und Ausfahren
   * stoppen, Absenken, Heranziehen und Schwenken gehen weiter. Einmal je
   * Versuch, nicht je Bild: neu erst, wenn der Spieler die gesperrte Bewegung
   * losgelassen hat. `massKg` = gehaltene Last, `grenzeKg` = Traglast hier
   * (Anbaugeraet abgezogen), `ausladungM` = waagrechter Abstand zur Drehmitte,
   * `abgestuetzt` = Pratzen ganz draussen (E-154; frei stehend gilt 2/3 der
   * Tabelle — ist es false, hilft Abstuetzen mit Taste O).
   */
  "greifer:ueberlast": { massKg: number; grenzeKg: number; ausladungM: number; abgestuetzt: boolean };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Handler<keyof GameEvents>[]>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<keyof GameEvents>);
    this.handlers.set(event, list);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    for (const h of this.handlers.get(event) ?? []) {
      (h as Handler<K>)(payload);
    }
  }
}
