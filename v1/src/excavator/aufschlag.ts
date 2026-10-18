import type RAPIER from "@dimforge/rapier3d-compat";
import { hitsObstacle } from "../world/obstacles";

/**
 * GEHALTENER SCHROTT SCHLAEGT AUF (E-134, 17.10.2026).
 *
 * Patrick: „schrott krach auch wenn ich mit der spinne schrott auf den boden
 * haue ohne loszulassen". Lose Teile melden ihren Aufprall selbst
 * (`scrapItems.onAufprall`, E-121); was die Spinne haelt, ist kinematisch und
 * meldet nichts.
 *
 * Erkannt wird ein EINSCHLAG, kein Aufliegen: der Uebergang von „frei" zu
 * „Kontakt", wenn die Spitze dabei schnell genug nach unten kam. Danach bleibt
 * es still, solange aufgesetzt bleibt — dieselbe Regel wie beim Greifklang
 * (E-130): kein Klang bleibt stehen. Erst wer wieder abhebt
 * (`AUFSCHLAG_FREI_S`), kann erneut aufschlagen.
 */

/**
 * Ab dieser Senkgeschwindigkeit der Spitze (m/s) ist es ein Schlag. SW 0,8,
 * gemessen mit `tools/lastaufschlag.ts` (180-kg-Traeger): Ausleger und Stiel
 * voll gesenkt 3,15 m/s, nur der Ausleger 2,13 m/s, behutsam abgesetzt
 * (Taste im Wechsel) 0,11 m/s. Die Schwelle liegt dazwischen, naeher am
 * Behutsamen: Wer zuegig absetzt, darf es hoeren.
 */
export const AUFSCHLAG_AB_MS = 0.8;
/**
 * So lange muss die Last frei gewesen sein, bevor sie erneut aufschlagen
 * kann (s). SW 0,15: Der Bodenkontakt flackert beim Aufliegen nicht, aber
 * ein Pendeln knapp ueber dem Boden soll kein Trommelfeuer geben.
 */
export const AUFSCHLAG_FREI_S = 0.15;

/*
 * E-137: DIE LEERE SPINNE HAEMMERT UND DRUECKT. Derselbe Melder, eine zweite
 * Instanz am Bagger (`Excavator.meldeSpinne`): Kontakt ist dort der
 * Bodenanschlag oder ein Rapier-Kontakt der Schalen mit einem losen Koerper.
 */
/**
 * Bei diesem Senktempo (m/s) ist die Wucht 1. Gemessen in E-134
 * (`tools/lastaufschlag.ts`): Ausleger und Stiel voll, beim Anschlag 3,15 m/s.
 */
export const SPINNE_WUCHT_VOLL_MS = 3.15;
/** Ab diesem Senkbefehl (0..1) drueckt der Spieler. SW 0,1: unter dem Totband jedes Sticks */
export const DRUECK_AB = 0.1;
/** Hoechstens so oft eine Drueck-Meldung (s) — Vertrag mit dem Ton (E-139) */
export const DRUECK_PAUSE_S = 0.25;
/**
 * So weit (m) muss das Material seit der letzten Meldung nachgegeben haben —
 * Spitze gesunken oder Teil gewandert —, damit „sich etwas tut". SW 0,01:
 * groesser als das Rauschen eines liegenden Teils (unter 1 mm je Bild),
 * kleiner als ein Bild Senken (Stiel voll: rund 5 cm).
 */
export const DRUECK_WEG_M = 0.01;

export class Aufschlagmelder {
  private kontaktAlt = true; // wer im Kontakt startet, hat nicht aufgeschlagen
  private freiS = 0;
  private abwaertsAlt = 0;

  /**
   * Ein Physikschritt. `kontakt`: liegt die Last jetzt auf; `abwaerts`:
   * Senkgeschwindigkeit der Spitze in diesem Schritt (m/s, vor dem Anschlag).
   * Liefert das Aufschlagtempo beim Einschlag, sonst null.
   */
  schritt(dt: number, kontakt: boolean, abwaerts: number): number | null {
    const tempo = Math.max(abwaerts, this.abwaertsAlt);
    const schlag = kontakt && !this.kontaktAlt && this.freiS >= AUFSCHLAG_FREI_S && tempo >= AUFSCHLAG_AB_MS;
    this.freiS = kontakt ? 0 : this.freiS + dt;
    this.kontaktAlt = kontakt;
    this.abwaertsAlt = abwaerts;
    return schlag ? tempo : null;
  }
}

/**
 * E-157: Worauf ein Anschlag trifft — Beton oder Stahl, Schrott oder Wrack.
 * Aus dem getroffenen Koerper (`Excavator.onAnschlag`):
 *  - ein Wrack → "wrack"; ein Schrottteil → "schrott";
 *  - kinematisch (Laster samt Bordwand und Mulde, Streifenwagen,
 *    Pressstempel) → "stahl";
 *  - sonst dynamisch (bewegliche Mulden und Container) → "stahl";
 *  - fest oder ein Bauwerk der Hindernisliste: Presse → "stahl"; liegt der
 *    Punkt in einer Stahlmulde oder auf einer Ladeflaeche (`stahlPunkt`, aus
 *    main) → "stahl"; sonst Betonlego und Mauer → "beton".
 */
export function anschlagUntergrund(
  a: { koerper: RAPIER.RigidBody | null; label: string | null; x: number; y: number; z: number },
  w: {
    istWrack: (handle: number) => boolean;
    istSchrott: (handle: number) => boolean;
    stahlPunkt: (x: number, y: number, z: number) => boolean;
  }
): "beton" | "stahl" | "schrott" | "wrack" {
  const k = a.koerper;
  if (k && k.isValid()) {
    if (w.istWrack(k.handle)) return "wrack";
    if (k.isKinematic()) return "stahl";
    if (k.isDynamic()) return w.istSchrott(k.handle) ? "schrott" : "stahl";
  }
  const label = a.label ?? hitsObstacle(a.x, a.z, 0.4, a.y)?.label ?? "";
  if (label.startsWith("Presse")) return "stahl";
  return w.stahlPunkt(a.x, a.y, a.z) ? "stahl" : "beton";
}
