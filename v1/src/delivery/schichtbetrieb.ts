/**
 * DER SCHICHTBETRIEB (E-202, Patrick 21.10.2026) — der Disponent der Schicht.
 *
 * Vergleich: das Büro mit dem Fahrplan an der Wand. Es schaut auf die eine Uhr
 * (`daylight.schichtSekunden`, E-113 — keine eigene), meldet dem Fuhrpark,
 * welche Fuhre gerade fällig ist, macht die Annahme zu, wenn zu viel loser
 * Schrott herumliegt, und sagt, für welche Sorte der nächste Verlader kommt.
 * Fahren lässt der Fuhrpark (`vehicles.ts`, Schicht-Teil); bezahlt wird an
 * der Kasse (`economy/kasse.ts`, E-203). Beide kennt dieses Modul nur über
 * Rückrufe — `main.ts` verbindet.
 *
 * Was Patrick erlebt (Auftrag S2): Schicht gewählt → 06:00, der Verlader steht
 * quer vor dem Bagger. Nach Fahrplan rollen Misch-Fuhren (~8 t) an die
 * Annahme. Ist der Verlader voll oder wird er angehupt, fährt er; der nächste
 * stand an der Nordmauer bereit und rückt nach. Hat eine Box eine Fuhre
 * beisammen, ist der nächste Verlader einer für diese Sorte. Selten wartet eine
 * sortenreine Pritsche am Lager. Wer Laster warten lässt, zahlt Standgeld.
 */
import type { Schichtstufe } from "../economy/kasse";
import { MISCH } from "../economy/kasse";
import { fahrplan, type Fahrt } from "../economy/schichtplan";
import { SCHICHT_TORSCHLUSS_S, SCHICHT_FEIERABEND_S } from "../world/schichtzeit";
import type { AbholAufbau, VehicleManager, VerladerAbfahrt } from "./vehicles";
import { BOX_ORDERS, type BoxOrder } from "./schichtfuhrpark";

/** Was der Betrieb vom Platz wissen muss — `main.ts` misst es ohnehin. */
export interface SchichtPorts {
  /** Loser Schrott auf dem Platz (kg): nicht in einer Box, nicht auf einem Laster. */
  looseKg(): number;
  /** Inhalt der Box (kg): STAHL, BUNT + VA, MÜLL-Halde. */
  boxKg(order: BoxOrder): number;
}

/* ------------------------------------------------------------ Stellschrauben */

/**
 * Ab hier ist die Annahme voll: neue Fuhren warten am Tor (kg). SW,
 * Konzept Abschnitt 4: „mehr als 10 t loser Schrott" — gut eine Fuhre (8 t)
 * plus Reste. Im Sandkasten sind es 16 t (`shift.JAM_KG`).
 */
export const ANNAHME_ZU_KG = 10_000;
/**
 * Darunter geht sie wieder auf (kg). SW: Hysterese wie `shift.JAM_CLEAR_KG`
 * (dort 16 → 11 t), damit das Tor nicht im Sekundentakt auf und zu geht.
 */
export const ANNAHME_AUF_KG = 6_000;
/**
 * Ab hier hat eine Box „eine Fuhre beisammen", und der nächste Verlader kommt
 * für ihre Sorte (kg). Alle SW, Konzept Abschnitt 4.
 */
export const BOX_SCHWELLE_KG: Readonly<Record<BoxOrder, number>> = {
  steel: 6_000,
  copper: 1_500,
  rubble: 3_000,
};
/**
 * Welcher Wagen kommt (E-177: Abroller bei viel, Absetzkipper bei wenig). Die
 * Schwellen oben sind die Mengen, also feste Zuordnung: 1,5 t Buntmetall
 * passen in die 7-m³-Absetzmulde, Stahl, Müll und Misch brauchen den
 * 34-m³-Abroller. SW.
 */
export const VERLADER_AUFBAU: Readonly<Record<string, AbholAufbau>> = {
  mixed: "abroller",
  steel: "abroller",
  copper: "absetzer",
  rubble: "abroller",
};
/** Wie oft die Boxen nachgesehen werden (s). SW, derselbe Takt wie `VOLL_PRUEF_S` (E-120). */
const BOX_PRUEF_S = 0.25;

/**
 * Für welche Sorte der nächste Verlader kommt: die Box, die am weitesten über
 * ihrer Schwelle ist — sonst Misch. Reine Rechnung, für Tests offen.
 */
export function naechsteOrder(boxKg: (o: BoxOrder) => number): string {
  let beste: BoxOrder | null = null;
  let besterGrad = 1;
  for (const o of BOX_ORDERS) {
    const grad = boxKg(o) / BOX_SCHWELLE_KG[o];
    if (grad >= besterGrad) {
      besterGrad = grad;
      beste = o;
    }
  }
  return beste ?? MISCH;
}

export class SchichtBetrieb {
  /** Der Fahrplan dieser Schicht (Stufe + Saat). */
  readonly plan: readonly Fahrt[];
  private naechste = 0;
  private annahmeZu = false;
  private schichtS = 0;
  private feierabend = false;
  private boxPruefT = 0;
  private order: string = MISCH;

  /** Ein Verlader oder Box-Abholer verlässt den Hof — für `kasse.bucheAbfahrt(e.order, e.teile)`. */
  onVerladerAbfahrt: ((e: VerladerAbfahrt) => void) | null = null;
  /**
   * Je Anlieferer einmal, wenn er seinen Halt verlässt (oder bei Feierabend):
   * die rohe Standzeit. Die freien 60 s zieht die Kasse ab
   * (`standgeldSekunden`, E-203).
   */
  onStandzeit: ((e: { standzeitS: number; fahrzeug: string }) => void) | null = null;

  constructor(
    readonly stufe: Schichtstufe,
    private readonly vehicles: VehicleManager,
    private readonly ports: SchichtPorts,
    /** Gleiche Saat → gleicher Fahrplan (Bestenliste, Wächter). Ohne Angabe: jedes Mal ein anderer. */
    readonly saat: number = Math.floor(Math.random() * 2 ** 31)
  ) {
    this.plan = fahrplan(stufe, saat);
    this.order = naechsteOrder((o) => ports.boxKg(o));
    vehicles.starteSchicht({
      nachrueckerOrder: () => this.order,
      aufbauFuer: (o) => VERLADER_AUFBAU[o] ?? "abroller",
      onVerladerAbfahrt: (e) => this.onVerladerAbfahrt?.(e),
      onStandzeit: (e) => this.onStandzeit?.(e),
    });
  }

  /**
   * Ein Takt. Die Zeit kommt von der einen Uhr (`daylight.schichtSekunden`);
   * `dt` braucht der Betrieb nur für den Blick in die Boxen.
   */
  takt(dt: number, schichtS: number): void {
    this.schichtS = schichtS;
    // Fällige Fuhren melden — nichts nach Torschluss (der Fahrplan hat dort ohnehin keine)
    while (this.naechste < this.plan.length && this.plan[this.naechste]!.tS <= schichtS) {
      const f = this.plan[this.naechste++]!;
      if (f.tS <= SCHICHT_TORSCHLUSS_S) this.vehicles.schichtFaellig(f);
    }
    // Annahme voll? Hysterese wie im Sandkasten (`shift.ts`)
    const lose = this.ports.looseKg();
    if (this.annahmeZu) {
      if (lose < ANNAHME_AUF_KG) this.annahmeZu = false;
    } else if (lose >= ANNAHME_ZU_KG) {
      this.annahmeZu = true;
    }
    this.vehicles.acceptDeliveries = !this.annahmeZu;
    // Welche Box hat eine Fuhre beisammen?
    this.boxPruefT -= dt;
    if (this.boxPruefT <= 0) {
      this.boxPruefT = BOX_PRUEF_S;
      this.order = naechsteOrder((o) => this.ports.boxKg(o));
    }
    if (!this.feierabend && schichtS >= SCHICHT_FEIERABEND_S) {
      this.feierabend = true;
      this.vehicles.schichtFeierabend();
    }
  }

  /** Torschluss (15:00): keine neue Fuhre mehr. */
  get torZu(): boolean {
    return this.schichtS >= SCHICHT_TORSCHLUSS_S;
  }

  /** Feierabend (16:00) ist durch. */
  get vorbei(): boolean {
    return this.feierabend;
  }

  /** Ist die Annahme gerade zu (zu viel loser Schrott)? */
  get annahmeVoll(): boolean {
    return this.annahmeZu;
  }

  /** Fällige Fuhren, die noch nicht an ihren Halt fahren konnten. */
  get wartend(): number {
    return this.vehicles.schichtWartend;
  }

  /** Für welche Sorte der nächste Verlader käme (`mixed` oder eine Box). */
  get naechsterVerlader(): string {
    return this.order;
  }
}
