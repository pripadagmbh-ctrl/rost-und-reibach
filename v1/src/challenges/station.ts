import { EventBus, type GameEvents } from "../core/events";
import { ChallengeLauf, type Beobachtung, type ChallengeDaten, type ChallengeObjekte, type ChallengeQuellen } from "./challenge";

/**
 * EINE STATION IM LEHRGANG (L8, Teil 2 — offene-punkte.md 39c/42).
 *
 * Teil 2 des Lehrgangs uebt Greifen, Last, Haemmern, Presse, Magnet,
 * Sortieren an „Stationen": den fertigen Aufbauten der Pruefungen aus
 * `katalog.ts`. Eine Station ist ein ganz normaler `ChallengeLauf` mit den
 * Daten der Pruefung — er beobachtet genau wie dort (Regel 2: nur
 * beobachten) —, aber STUMM gefahren: Er spricht ueber einen gefilterten Bus.
 *
 *   on      geht an den echten Bus (er hoert `itemEntered`, `wrack:geknautscht` …)
 *   emit    nur `challenge:stand` geht hinaus — Zielmarke (Leuchten, Pfeil,
 *           Weg, Auftrag 41) und der Lotse des Lehrgangs (`lektion.ts`) lesen
 *           daraus die Marken. `challenge:start`, `challenge:vorschau`,
 *           `challenge:schritt` und `challenge:geschafft` werden geschluckt:
 *           keine Zielzeile, kein Kameraflug, keine Tafel — der Lehrgang hat
 *           seine eigene Leiste.
 *
 * Geschluckt heisst nicht vergessen: `challenge:schritt` sagt, wie weit die
 * Pruefung ist (`nr` = der jetzt gezeigte Schritt, die davor sind gesehen),
 * `challenge:geschafft`, dass alle gesehen sind. Daraus `gesehen(b)` — die
 * Quelle `stationGesehen` des Lehrgangs (main.ts verdrahtet).
 */
export class StationLauf {
  readonly lauf: ChallengeLauf;
  /** Schritte der Pruefung, die gesehen sind (aus `challenge:schritt.nr − 1`) */
  private gesehenBis = 0;
  private fertig = false;

  constructor(readonly daten: ChallengeDaten, q: ChallengeQuellen, bus: EventBus, objekte: ChallengeObjekte) {
    this.lauf = new ChallengeLauf(daten, 0, q, new StationsBus(bus, this), objekte);
  }

  get id(): string {
    return this.daten.id;
  }

  /** @internal Vom gefilterten Bus: was die Pruefung meldet. */
  gemeldet<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    if (event === "challenge:schritt") this.gesehenBis = Math.max(this.gesehenBis, (payload as GameEvents["challenge:schritt"]).nr - 1);
    if (event === "challenge:geschafft") this.fertig = true;
  }

  /**
   * Hat die Station `b` gesehen — jetzt oder frueher im Ablauf der Pruefung?
   * Eine Beobachtung, die in ihren Schritten nicht vorkommt, nie.
   */
  gesehen(b: Beobachtung): boolean {
    const i = this.daten.schritte.findIndex((s) => s.beobachtet === b);
    if (i < 0) return false;
    return this.fertig || i < this.gesehenBis;
  }

  /** Alle Schritte der Pruefung gesehen */
  get geschafft(): boolean {
    return this.fertig;
  }

  start(): void {
    this.lauf.start();
  }

  takt(dt: number): void {
    this.lauf.takt(dt);
  }

  /** Station wechselt oder der Lehrgang endet: ab jetzt stumm (der Bus kennt kein `off`). */
  beenden(): void {
    this.lauf.beenden();
  }

  get beendet(): boolean {
    return this.lauf.beendet;
  }

  /** Wie `ChallengeLauf.pressenErlaubt` — main.ts fragt vor dem Pressenstart. */
  pressenErlaubt(): boolean {
    return this.lauf.pressenErlaubt();
  }

  /** Wie `ChallengeLauf.presseHatGestempelt` — `press.onStamp`. */
  presseHatGestempelt(): void {
    this.lauf.presseHatGestempelt();
  }
}

/** Nur `challenge:stand` geht hinaus; alles andere meldet er der Station. Zuhoeren geht an den echten Bus. */
class StationsBus extends EventBus {
  constructor(
    private echt: EventBus,
    private station: StationLauf
  ) {
    super();
  }

  override on<K extends keyof GameEvents>(event: K, handler: (payload: GameEvents[K]) => void): void {
    this.echt.on(event, handler);
  }

  override emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    if (event === "challenge:stand") this.echt.emit(event, payload);
    else this.station.gemeldet(event, payload);
  }
}
