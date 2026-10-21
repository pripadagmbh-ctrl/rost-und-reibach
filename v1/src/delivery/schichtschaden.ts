/**
 * SCHÄDEN AM LASTER (E-204, Patrick 21.10.2026: „Abzug für … Schäden/harte
 * Aufschläge") — wer einen Laster beschädigt, zahlt 50 € (`kasse.SCHADEN_EUR`).
 *
 * Vergleich: der Fahrer, der aussteigt und auf die Delle zeigt. Er schaut
 * nicht auf jedes Klappern, sondern nur, wenn etwas Schweres hart auf seinen
 * Wagen knallt — und für dieselbe Delle meldet er sich nur einmal.
 *
 * Der Melder hört nur auf den Bus (`schrott:aufprall`, `spinne:aufschlag`) und
 * fragt die Standflächen der Laster über einen Port ab (`vehicles.ladeBoxen`).
 * Er bucht nicht selbst: `onSchaden` ruft die Verdrahtung (`main.ts`), die
 * `kasse.bucheSchaden()` ruft und `schicht:buchung` meldet.
 */
import type { EventBus } from "../core/events";
import { HART_AB_MS } from "../challenges/challenge";
import { findeBox, type Box } from "../world/boxen";

/**
 * Ab dieser Masse kann ein Teil einen Laster beschädigen (kg). SW: Ein
 * Motorblock, eine Waschmaschine voll Beton, ein Presspaket, ein Wrack — das
 * verbeult eine Bordwand. Ein Felgenrad, ein Heizkörper, ein Kabelbund (bis
 * rund 100 kg) prallen ab, auch hart; sonst zahlte der Spieler für jedes
 * Blech, das er aus Schwenkhöhe fallen lässt. Liegt zwischen den beiden
 * Gegenproben (80 kg nie, 400 kg aus 3 m immer, `test/schichtschaden.test.ts`).
 */
export const SCHADEN_AB_KG = 300;
/**
 * Die Spinne schlägt mit voller Wucht (`wucht` 1 = Ausleger und Stiel voll,
 * 3,15 m/s, E-134) auf Stahl. SW: Wer hämmert, um ein Teil zu knautschen, trifft
 * meist das Teil (`untergrund` schrott/wrack) — nur wer daneben voll auf die
 * Ladefläche schlägt, zahlt.
 */
export const SPINNE_SCHADEN_WUCHT = 1.0;
/**
 * Derselbe Aufprall zählt nur einmal (s). SW: Ein schweres Teil hüpft nach dem
 * ersten Schlag ein-, zweimal nach (der Teile-Melder meldet je Teil alle
 * 0,18 s neu), ein Bündel aus drei Teilen meldet drei Aufschläge im selben
 * Bild, und wer die Spinne voll auf die Fläche setzt, prellt nach. 1,5 s deckt
 * das ab und ist kürzer als ein neuer Griff (Greifen, Schwenken, Ablegen dauert
 * gemessen 6–10 s), damit jeder neue harte Wurf wieder zählt.
 */
export const SCHADEN_SPERRE_S = 1.5;
/**
 * Rand um die Standfläche (m) — derselbe wie `stahlGrund` in `main.ts`
 * (Ladefläche heißt „Stahl" bis 0,4 m neben dem Umriss): Ein Teil, dessen Mitte
 * knapp neben dem Umriss liegt, hat die Bordwand getroffen.
 */
const UMRISS_RAND_M = 0.4;
/**
 * Zwei Treffer gehören zu demselben Laster, wenn die Mitten ihrer Standflächen
 * so nah beieinander liegen (m). SW: Ein Laster, an dem geladen wird, steht;
 * zwei verschiedene stehen nie so dicht (Lkw-Breite 2,7 m).
 */
const DERSELBE_LASTER_M = 2;

export interface SchadenPorts {
  /** Die Standflächen der Laster, an denen geladen wird — im Spiel `vehicles.ladeBoxen()` (E-204: nicht `fahrzeugBoxen`, sonst beschädigt sich ein kippender Kipper selbst). */
  boxen(): Box[];
  /** Sekunden, die fortlaufen (Spielzeit). Ohne Angabe: `performance.now()`. */
  jetztS?(): number;
}

export class SchadenMelder {
  /** Ein Schaden: wo, und was es war (für Anzeige und Log). */
  onSchaden: ((e: { x: number; z: number; was: string }) => void) | null = null;
  /** Zuletzt gezählt, je Laster (Mitte der Standfläche). */
  private zuletzt: Array<{ x: number; z: number; t: number }> = [];
  /** Aus (z. B. nach Feierabend): nichts wird mehr gezählt. */
  aktiv = true;

  constructor(
    bus: EventBus,
    private readonly ports: SchadenPorts
  ) {
    bus.on("schrott:aufprall", (e) => {
      if (e.massKg >= SCHADEN_AB_KG && e.wucht >= HART_AB_MS) this.treffer(e.x, e.z, `${Math.round(e.massKg)} kg mit ${e.wucht.toFixed(1)} m/s`);
    });
    bus.on("spinne:aufschlag", (e) => {
      if (e.untergrund === "stahl" && e.wucht >= SPINNE_SCHADEN_WUCHT) this.treffer(e.x, e.z, "Spinne voll auf die Ladefläche");
    });
  }

  private treffer(x: number, z: number, was: string): void {
    if (!this.aktiv) return;
    const b = findeBox(x, z, this.ports.boxen(), UMRISS_RAND_M);
    if (!b) return;
    const t = this.ports.jetztS?.() ?? performance.now() / 1000;
    this.zuletzt = this.zuletzt.filter((s) => t - s.t < SCHADEN_SPERRE_S);
    if (this.zuletzt.some((s) => Math.hypot(s.x - b.x, s.z - b.z) < DERSELBE_LASTER_M)) return;
    this.zuletzt.push({ x: b.x, z: b.z, t });
    this.onSchaden?.({ x, z, was });
  }
}
