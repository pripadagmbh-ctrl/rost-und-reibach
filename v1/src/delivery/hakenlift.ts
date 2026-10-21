/**
 * DER HAKENARM DES MÜLL-ABROLLERS (E-190) — reine Rechnung, ohne three.js.
 *
 * Patrick, 21.10.2026: „Der Müllcontainer soll ein abholcontainer werden der
 * raufgezogen wird." Ein Abrollkipper hat statt einer Ladefläche einen
 * L-förmigen Arm: ein Balken im Rahmen, hinten in einem Gelenk gelagert, vorn
 * eine Säule mit dem Haken. Schwenkt der Arm nach hinten, steigt der Haken
 * über das Heck, der Container hängt daran und rollt über die Heckrolle ab,
 * bis er flach hinter dem Wagen steht. Umgekehrt zieht der Arm ihn hinauf.
 *
 * Alles im Wagenrahmen: z nach vorn (zur Kabine), y nach oben, Ursprung in
 * der Mitte der Ladefläche (wie jede Fahrzeuggruppe, `vehicleModel.ts`).
 *
 * WIE DER CONTAINER STEHT, folgt aus zwei Dingen und nicht aus einer Tabelle:
 *  1. Sein Hakenbügel hängt im Haken.
 *  2. Er hängt so weit nach hinten herunter, wie ihn Boden und Heckrolle
 *     lassen — die Schwerkraft dreht sein Heck nach unten, bis es aufliegt.
 * Gerechnet wird also der größte Neigungswinkel, bei dem seine Unterkante
 * weder in den Boden noch unter die Heckrolle geht. So entsteht die ganze
 * Bewegung — Anheben vorn, Rollen auf dem Boden, Auflaufen über die Rolle,
 * flach auf den Rahmen — aus einem einzigen Winkel des Arms.
 *
 * Alle Maße SW nach einem kleinen Zweiachs-Abroller (Hakenhöhe 1,0–1,6 m
 * üblich), angepasst an den Rahmen des Abholers (Ladeflächenlänge 5,40 m).
 */

/** Der Müll-Container (Abrollcontainer 10 m³), wie `containers.ts` ihn baut. */
export const MUELL_WANNE = {
  /** Breite über alles (x), Länge (z), Wandhöhe (m) — `CONFIGS` „r_rubble". */
  breite: 2.5,
  laenge: 4.5,
  wand: 1.0,
  /** Höhe des Hakenbügels über der Unterkante der Kufen (m). */
  bügelHoehe: 1.25,
  /** So weit steht der Bügel vor der Stirnwand (m). */
  bügelVor: 0.12,
};

/** Arm, Gelenk und Heckrolle des Abrollers. */
export interface HakenGeometrie {
  /** Armgelenk (z, y) */
  gelenk: [number, number];
  /** Haken in Fahrstellung minus Gelenk (z, y) */
  arm: [number, number];
  /** Heckrolle (z, y): dort läuft der Container über das Rahmenende */
  rolle: [number, number];
  /** Rahmenoberkante = Unterkante des aufgeladenen Containers (y) */
  rahmenOben: number;
  /** Vorderende der Auflage auf dem Rahmen (z) */
  rahmenVorn: number;
}

/**
 * Wie weit der Teleskoparm den Haken zuerst nach hinten schiebt, bevor der
 * Arm kippt (m). SW: Ohne diesen Schub schwenkte der Haken mit 4,5 m Radius
 * über das Heck, stieg auf 5,5 m und stellte den Container senkrecht auf sein
 * Ende (gemessen mit `wannenLage`). Mit 1,6 m Schub bleibt der Haken unter
 * 4,1 m und der Container neigt sich höchstens rund 40° — so sieht man es auf
 * jedem Hof.
 */
export const HAKEN_SCHUB_M = 1.6;

/**
 * Die Geometrie zu einer Rahmenlänge (bedLen wie beim Abholer: 5,40 m).
 *
 * Der Container liegt in Fahrstellung bündig mit dem Rahmenende, seine
 * Unterkante auf 1,05 m (wie die Ladefläche des Abholers, `vehicleModel`),
 * der Bügel davor im Haken. Das Gelenk sitzt 0,25 m vor dem Rahmenende auf
 * 0,95 m — tiefer als der Container, damit der Balken unter ihm im Rahmen
 * liegt und nicht durch seinen Boden geht.
 */
export function hakenGeometrie(bedLen: number): HakenGeometrie {
  const heck = -bedLen / 2;
  const rahmenOben = 1.05;
  const gelenk: [number, number] = [heck + 0.25, 0.95];
  const haken: [number, number] = [
    heck + MUELL_WANNE.laenge + MUELL_WANNE.bügelVor,
    rahmenOben + MUELL_WANNE.bügelHoehe,
  ];
  return {
    gelenk,
    arm: [haken[0] - gelenk[0], haken[1] - gelenk[1]],
    rolle: [heck, rahmenOben],
    rahmenOben,
    rahmenVorn: haken[0] - MUELL_WANNE.bügelVor,
  };
}

/**
 * Wo der Haken steht: `schub` (m, Teleskop eingefahren nach hinten, 0 …
 * `HAKEN_SCHUB_M`) und Armwinkel `alpha` (rad, 0 = Fahrstellung, positiv
 * nach hinten über das Heck).
 */
export function hakenSpitze(g: HakenGeometrie, alpha: number, schub = HAKEN_SCHUB_M): [number, number] {
  const a = g.arm[0] - schub;
  const b = g.arm[1];
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  return [g.gelenk[0] + a * c - b * s, g.gelenk[1] + a * s + b * c];
}

/** Lage des Containers im Wagenrahmen: Mitte seiner Unterkante (z, y) und Neigung (rad, vorn hoch). */
export interface WannenLage {
  z: number;
  y: number;
  neigung: number;
}

/** Container-Lage bei gegebenem Haken (z, y) und Neigung. */
function lageBei(haken: [number, number], th: number): { vorn: [number, number]; hinten: [number, number]; mitte: [number, number] } {
  const h = MUELL_WANNE.bügelHoehe;
  const e = MUELL_WANNE.bügelVor;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // Bügel = Vorderkante unten + Drehung · (z: e, y: h)
  const vorn: [number, number] = [haken[0] - (e * c - h * s), haken[1] - (h * c + e * s)];
  const L = MUELL_WANNE.laenge;
  const hinten: [number, number] = [vorn[0] - L * c, vorn[1] - L * s];
  const mitte: [number, number] = [vorn[0] - (L / 2) * c, vorn[1] - (L / 2) * s];
  return { vorn, hinten, mitte };
}

/** Steht die Unterkante bei dieser Neigung frei (über Boden und Heckrolle)? */
function frei(g: HakenGeometrie, haken: [number, number], th: number): boolean {
  const { vorn, hinten } = lageBei(haken, th);
  if (hinten[1] < -1e-9 || vorn[1] < -1e-9) return false;
  /*
   * Rahmen samt Heckrolle tragen von `rolle` bis `rahmenVorn`. Die Unterkante
   * ist eine Gerade, die nach vorn steigt — ihre tiefste Stelle über dem
   * Rahmen liegt also an dessen hinterem Ende oder am Heck des Containers.
   */
  const [rz, ry] = g.rolle;
  const z = Math.max(hinten[0], rz);
  if (z <= Math.min(vorn[0], g.rahmenVorn)) {
    const t = vorn[0] === hinten[0] ? 0 : (z - hinten[0]) / (vorn[0] - hinten[0]);
    const y = hinten[1] + t * (vorn[1] - hinten[1]);
    if (y < ry - 1e-6) return false;
  }
  return true;
}

/** Größte Neigung, die bei 0° noch frei ist; −1, wenn schon flach nicht geht (Haken zu tief). */
function neigungFuer(g: HakenGeometrie, haken: [number, number]): number {
  if (!frei(g, haken, 0)) return -1;
  let lo = 0;
  let hi = (85 * Math.PI) / 180;
  if (frei(g, haken, hi)) return hi;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (frei(g, haken, m)) lo = m;
    else hi = m;
  }
  return lo;
}

/** Wo der Container bei Armwinkel `alpha` und Schub `schub` steht. */
export function wannenLage(g: HakenGeometrie, alpha: number, schub = HAKEN_SCHUB_M): WannenLage {
  const haken = hakenSpitze(g, alpha, schub);
  const th = Math.max(0, neigungFuer(g, haken));
  const { mitte } = lageBei(haken, th);
  return { z: mitte[0], y: mitte[1], neigung: th };
}

/**
 * Der Armwinkel, bei dem der Container flach auf dem Boden steht: Der Haken
 * ist dann genau auf Bügelhöhe. Weiter darf der Arm nicht, sonst drückte er
 * die Front in den Boden.
 */
export function alphaAmBoden(g: HakenGeometrie): number {
  let lo = Math.PI / 2;
  let hi = Math.PI;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (hakenSpitze(g, m)[1] > MUELL_WANNE.bügelHoehe) lo = m;
    else hi = m;
  }
  return lo;
}

/**
 * Wo der Container steht, wenn er abgesetzt ist — im Wagenrahmen. Daraus
 * rechnet der Fuhrpark, wo der Wagen halten muss, um ihn zu holen oder dort
 * abzusetzen: Wagenursprung = Containermitte + `abstand` in Fahrtrichtung.
 */
export function abstandAmBoden(g: HakenGeometrie): number {
  return -wannenLage(g, alphaAmBoden(g)).z;
}
