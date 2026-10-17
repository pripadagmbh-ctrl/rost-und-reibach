/**
 * DAS EINSPURMODELL (E-140) — ein Fahrzeug faehrt Kreise, es dreht sich nicht.
 *
 * Patrick, 17.10.2026: „lkws drehen sich unrealistisch um ihren mittelpunkt.
 * allerdings sollten die LKws und auch anhänger lenkende Achsen haben und die
 * bewegung aus der lenkbewegung der achsen kommen. Wie bei echten fahrzeugen.
 * Auch die Achse bei anhängern berücksichtigen."
 *
 * WAS VORHER WAR (E-084). Die Gierlage folgte der Streckenrichtung mit
 * begrenzter Drehrate (0,85 rad/s), auch im Stand. An einer Kehre stand der
 * Wagen still und drehte sich um seine Mitte — wie ein Gabelstapler.
 *
 * WAS JETZT GILT — das „Fahrradmodell", wie es jedes Fahrschul-Lehrbuch hat:
 *
 *   - Bezugspunkt ist die Mitte der starren Hinterachse(n). Dort steht kein
 *     Rad quer zur Fahrt, also bewegt sich dieser Punkt nur in Wagenrichtung.
 *   - Die Vorderachse lenkt um den Winkel δ, hoechstens `LENK_MAX`, und der
 *     Lenkeinschlag aendert sich hoechstens mit `LENK_TEMPO` (Lenkrad drehen
 *     dauert).
 *   - Die Gierrate folgt allein daraus:  ω = v · tan δ / Radstand.
 *     Ohne Fahrt (v = 0) dreht sich NICHTS — auch wenn die Raeder schon
 *     eingeschlagen sind.
 *   - Ein Anhaenger haengt an der Kupplung und laeuft mit seiner eigenen
 *     starren Achse nach (Knickwinkel-Gleichung, siehe `rolle`).
 *
 * Gefahren wird eine Strecke mit einem BAHNFOLGER ("Pure Pursuit"): Der
 * Fahrer schaut ein Stueck die Strecke entlang voraus und lenkt so ein, dass
 * ein Kreisbogen ihn genau dorthin fuehrt. Rueckwaerts ebenso — dann schaut er
 * nach hinten, und beim Gespann zielt er mit der ANHAENGERACHSE, nicht mit
 * dem Auto (so setzt man einen Anhaenger zurueck).
 *
 * Die Rechnung steht hier und nicht in `vehicles.ts`, weil drei Stellen
 * dasselbe Gesetz brauchen: die Fahrt (`vehicles.advance`), die Waechter
 * (`test/knicklauf.ts`) und die Strecken-Abtastung beim Ausfaedeln.
 */

/**
 * Groesster Lenkeinschlag der Vorderraeder (rad).
 *
 * 40 Grad aus dem Auftrag E-140 (Orchestrator, „Einschlag begrenzt ~40°");
 * dieselbe Zahl, aus der E-084 schon den Wendekreis hergeleitet hatte. Ein
 * Dreiachser mit 4,70 m Radstand faehrt damit einen Kreis von
 * 4,70 / tan 40° = 5,60 m um die Hinterachse; seine aeusserste Ecke streicht
 * dabei rund 9,4 m weit aus.
 */
export const LENK_MAX = (40 * Math.PI) / 180;

/**
 * Wie schnell der Fahrer am Lenkrad dreht (rad/s, am Rad gemessen).
 *
 * SW: 0,6 rad/s — von geradeaus bis voll eingeschlagen gut eine Sekunde. Ein
 * LKW mit Servolenkung braucht dafuer rund zwei Lenkradumdrehungen.
 */
export const LENK_TEMPO = 0.6;

/**
 * Wie stark der Wagen in der Kurve quer beschleunigen darf (m/s²).
 *
 * SW: 1,2 m/s². Daraus folgt das Kurventempo v = √(a·R): bei vollem Einschlag
 * (R 5,6 m) 2,6 m/s, auf weitem Bogen (R 15 m) 4,2 m/s. Ein LKW auf dem Hof
 * faehrt Kurven im Schritt, nicht mit Umschlagtempo.
 */
export const QUER_BESCHL = 1.2;

/**
 * Wie weit der Fahrer voraus zielt (m): `max(VORAUS_MIN, VORAUS_JE_MS · Tempo)`.
 *
 * SW: 3,0 m und 0,9 s. Bei 4,8 m/s sind das 4,3 m. Kuerzer laesst den Wagen
 * schlingern, laenger schneidet er Ecken ab — gemessen mit dem Waechter
 * `test/rangierknick.test.ts`.
 */
export const VORAUS_MIN = 3.0;
export const VORAUS_JE_MS = 0.9;

/**
 * Lenkt der Fahrer noch nach, faehrt er langsamer (rad).
 *
 * SW: Fehlen dem Lenkeinschlag 0,35 rad (20 Grad) zum Soll, steht der Wagen
 * und der Fahrer kurbelt im Stand — das tut man auf dem Hof auch. Darunter
 * geht das Tempo linear mit.
 */
export const LENK_NACHLAUF = 0.35;

/**
 * Wie hart der Fahrer beim Zuruecksetzen des Gespanns den Knick nachfuehrt
 * (1/m). SW: Ein Meter Weg, dann ist der Fehler auf gut ein Drittel herunter.
 */
export const KNICK_FOLGE = 1.0;

/** Groesster Knick, den der Fahrer beim Zuruecksetzen anstrebt (rad, SW 35°). */
export const KNICK_SOLL_MAX = 0.6;

/**
 * Wo ein Anhaenger an der Deichsel anschlaegt (rad). 1,0 rad = 57 Grad.
 * Eine Notbremse fuer den Fall, dass der Fahrer blockiert steht und der
 * Knick weiterliefe — im Waechter wird sie nie erreicht.
 */
export const KNICK_ANSCHLAG = 1.0;

/** Ab diesem Rest gilt eine Strecke als abgefahren (m). */
export const ZIEL_REST = 0.02;

/**
 * DIE GEGENPROBE (seit E-084). Steht `lenkrate` eines Wagens auf `Infinity`,
 * faehrt er wie vor dem 16.09.2026: Ort und Gierlage hart auf die Strecke
 * gesetzt. Jeder endliche Wert heisst: Einspurmodell. Die Zahl selbst ist die
 * hoechste Gierrate, die das Modell bei Umschlagtempo erreicht
 * (4,8 m/s · tan 40° / 4,70 m = 0,857 rad/s).
 */
export const LENK_RATE = 0.85;

/** Wo die Achsen eines Fahrzeugs sitzen — Laengslagen im Fahrzeugrahmen (m, +z vorn). */
export interface Fahrwerk {
  /** Lenkende Vorderachse. */
  vorn: number;
  /** Mitte der starren Hinterachse(n) — der Bezugspunkt des Modells. */
  hinten: number;
  /**
   * Der Anhaenger, falls einer dranhaengt:
   *   kupplung  Laengslage der Kugel im Zugrahmen
   *   deichsel  Kupplung bis Anhaengerachse
   *   heck      Anhaengerachse bis Heck (= der Punkt, der bei geradem Gespann
   *             auf dem Fahrzeugursprung liegt)
   */
  anhaenger: { kupplung: number; deichsel: number; heck: number } | null;
}

/** Die Lage eines Fahrzeugs: Ursprung, Gier, Lenkeinschlag, Knick des Anhaengers. */
export interface Lage {
  x: number;
  z: number;
  gier: number;
  /** Lenkeinschlag der Vorderraeder (rad); positiv dreht die Gier positiv. */
  lenk: number;
  /** Gier des Anhaengers gegen das Zugfahrzeug (rad) — `trailerYawRel`. */
  knick: number;
}

export function radstand(f: Fahrwerk): number {
  return f.vorn - f.hinten;
}

/** Der Kreisradius der Hinterachse bei vollem Einschlag (m). */
export function wendeRadius(f: Fahrwerk): number {
  return radstand(f) / Math.tan(LENK_MAX);
}

export function hinterachse(l: Lage, f: Fahrwerk): [number, number] {
  return [l.x + Math.sin(l.gier) * f.hinten, l.z + Math.cos(l.gier) * f.hinten];
}

export function anhaengerAchse(l: Lage, f: Fahrwerk): [number, number] {
  const a = f.anhaenger!;
  const t = l.gier + l.knick;
  return [
    l.x + Math.sin(l.gier) * a.kupplung - Math.sin(t) * a.deichsel,
    l.z + Math.cos(l.gier) * a.kupplung - Math.cos(t) * a.deichsel,
  ];
}

/**
 * Der Punkt, dessen Lage auf der Strecke „wie weit bin ich" beantwortet.
 *
 * Beim LKW der Ursprung (Mitte der Ladeflaeche) — die Halteplaetze aller
 * Strecken sind fuer genau diesen Punkt ausgemessen. Beim Gespann das Heck des
 * Anhaengers: Bei geradem Gespann liegt es auf dem Ursprung, beim Knick nicht,
 * und die Ladung liegt auf dem Anhaenger.
 */
export function fortschrittsPunkt(l: Lage, f: Fahrwerk): [number, number] {
  if (!f.anhaenger) return [l.x, l.z];
  const [ax, az] = anhaengerAchse(l, f);
  const t = l.gier + l.knick;
  return [ax - Math.sin(t) * f.anhaenger.heck, az - Math.cos(t) * f.anhaenger.heck];
}

/** Mit welchem Punkt der Fahrer zielt: Hinterachse — rueckwaerts im Gespann die Anhaengerachse. */
function fuehrPunkt(l: Lage, f: Fahrwerk, rueck: boolean): [number, number] {
  return rueck && f.anhaenger ? anhaengerAchse(l, f) : hinterachse(l, f);
}

/**
 * Ein Stueck Weg rollen: `ds` Meter an der Hinterachse, vorwaerts positiv.
 *
 * Exakt fuer den Kreisbogen: Die Hinterachse rueckt auf der Sehne mit der
 * mittleren Gier vor. Der Anhaenger folgt der Gleichung
 *
 *     dθ = (ds · sin φ − M · dψ · cos φ) / Lt,     φ = ψ − θ
 *
 * mit M = Hinterachse bis Kupplung und Lt = Kupplung bis Anhaengerachse. Sie
 * sagt nur: Die Anhaengerachse bewegt sich nie quer zu sich selbst. Vorwaerts
 * zieht sie den Knick von selbst gerade, rueckwaerts schaukelt sie ihn auf —
 * deshalb muss rueckwaerts gelenkt werden (`folgeSchritt`).
 */
export function rolle(l: Lage, f: Fahrwerk, ds: number): void {
  const dpsi = (ds * Math.tan(l.lenk)) / radstand(f);
  const [hx, hz] = hinterachse(l, f);
  const mitte = l.gier + dpsi / 2;
  const nx = hx + ds * Math.sin(mitte);
  const nz = hz + ds * Math.cos(mitte);
  if (f.anhaenger) {
    const M = f.hinten - f.anhaenger.kupplung;
    const phi = -l.knick;
    const dtheta = (ds * Math.sin(phi) - M * dpsi * Math.cos(phi)) / f.anhaenger.deichsel;
    l.knick += dtheta - dpsi;
    if (l.knick > KNICK_ANSCHLAG) l.knick = KNICK_ANSCHLAG;
    if (l.knick < -KNICK_ANSCHLAG) l.knick = -KNICK_ANSCHLAG;
  }
  l.gier += dpsi;
  l.x = nx - Math.sin(l.gier) * f.hinten;
  l.z = nz - Math.cos(l.gier) * f.hinten;
}

/* ------------------------------------------------------------ Strecke --- */

/**
 * Der Punkt bei Bogenlaenge `s` — VOR dem Anfang und HINTER dem Ende
 * geradeaus verlaengert. Der Fahrer zielt am Streckenende ueber den Halt
 * hinaus, sonst schaute er in den letzten Metern auf seine eigenen Fuesse.
 */
export function punktBei(route: ReadonlyArray<readonly [number, number]>, s: number): [number, number] {
  let rest = s;
  const n = route.length;
  if (n < 2) return [route[0]![0], route[0]![1]];
  for (let i = 0; i < n - 1; i++) {
    const [ax, az] = route[i]!;
    const [bx, bz] = route[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-9) continue;
    if (rest <= len || i === n - 2 || (i === 0 && rest < 0)) {
      const t = rest / len;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    rest -= len;
  }
  return [route[n - 1]![0], route[n - 1]![1]];
}

/**
 * Die Bogenlaenge des naechstgelegenen Streckenpunkts — nur im Fenster
 * `sMitte ± fenster`. Das Fenster ist Pflicht: Eine Strecke, die an sich selbst
 * vorbeifuehrt (Wendeschleife, Rangierzug), liegt sonst an zwei Stellen nah,
 * und der Fahrer saehe sich ploetzlich am anderen Ende.
 */
export function projiziere(
  route: ReadonlyArray<readonly [number, number]>,
  px: number,
  pz: number,
  sMitte: number,
  fenster: number
): number {
  const von = sMitte - fenster;
  const bis = sMitte + fenster;
  let best = sMitte;
  let bestD = Infinity;
  let s0 = 0;
  const n = route.length;
  for (let i = 0; i < n - 1; i++) {
    const [ax, az] = route[i]!;
    const [bx, bz] = route[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) continue;
    // Erstes und letztes Stueck reichen ins Unendliche (siehe `punktBei`).
    const tMin = Math.max(i === 0 ? -Infinity : 0, (von - s0) / len);
    const tMax = Math.min(i === n - 2 ? Infinity : 1, (bis - s0) / len);
    if (tMin <= tMax) {
      let t = ((px - ax) * dx + (pz - az) * dz) / (len * len);
      t = Math.min(Math.max(t, tMin), tMax);
      const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
      if (d < bestD) {
        bestD = d;
        best = s0 + len * t;
      }
    }
    s0 += len;
  }
  return best;
}

/** Der kuerzeste Weg von `ist` nach `soll`, in (−pi, pi]. */
export function winkelRest(ist: number, soll: number): number {
  let d = soll - ist;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Einen Schritt in Richtung `soll` — hoechstens `maxSchritt` weit. */
export function lenkeEin(ist: number, soll: number, maxSchritt: number): number {
  const d = winkelRest(ist, soll);
  if (!(maxSchritt < Math.abs(d))) return soll;
  return ist + Math.sign(d) * maxSchritt;
}

/**
 * Wie stark ein Bogen von `von` zum Ziel `(tx, tz)` gekruemmt sein muss, wenn
 * er in Richtung `richtung` beginnt (1/m) — die Pure-Pursuit-Formel
 * κ = 2 · sin α / Abstand. Liegt das Ziel hinter dem Fahrer, zaehlt der volle
 * Einschlag zur richtigen Seite (sonst ergaebe sin 180° = 0 „geradeaus").
 */
function kruemmungZu(vx: number, vz: number, richtung: number, tx: number, tz: number): number {
  const d = Math.hypot(tx - vx, tz - vz);
  if (d < 1e-6) return 0;
  const a = winkelRest(richtung, Math.atan2(tx - vx, tz - vz));
  const s = Math.abs(a) > Math.PI / 2 ? Math.sign(a) : Math.sin(a);
  return (2 * s) / Math.max(d, 0.5);
}

export interface FolgeErgebnis {
  /** Neuer Fortschritt auf der Strecke (m). */
  s: number;
  /** Ist der Halt am Streckenende erreicht? */
  fertig: boolean;
  /** Gefahrene Strecke an der Hinterachse in diesem Schritt (m, vorzeichenlos). */
  weg: number;
}

/**
 * EIN RECHENSCHRITT DES FAHRERS: zielen, lenken, Tempo waehlen, rollen.
 *
 * `s` ist der bisherige Fortschritt (`fortschrittsPunkt` auf der Strecke),
 * `tempo` das Wunschtempo dieser Etappe. Die Strecke ist in FAHRTRICHTUNG
 * aufgeschrieben, rueckwaerts wie vorwaerts.
 */
export function folgeSchritt(
  l: Lage,
  f: Fahrwerk,
  route: ReadonlyArray<readonly [number, number]>,
  laenge: number,
  s: number,
  rueck: boolean,
  tempo: number,
  dt: number
): FolgeErgebnis {
  if (laenge - s <= ZIEL_REST) return { s: Math.max(s, laenge), fertig: true, weg: 0 };
  const dir = rueck ? -1 : 1;
  const L = radstand(f);
  const gespannRueck = rueck && f.anhaenger !== null;
  // In welche Richtung der Fuehrpunkt faehrt (Weltwinkel).
  const fahrRichtung = gespannRueck ? l.gier + l.knick + Math.PI : l.gier + (rueck ? Math.PI : 0);
  const [fx, fz] = fuehrPunkt(l, f, rueck);
  const [px, pz] = fortschrittsPunkt(l, f);
  // Wo der Fuehrpunkt auf der Strecke steht: Fortschritt plus sein Vorsprung.
  const vorsprung = (fx - px) * Math.sin(fahrRichtung) + (fz - pz) * Math.cos(fahrRichtung);
  const sF = projiziere(route, fx, fz, s + vorsprung, 2.5);
  const voraus = Math.max(VORAUS_MIN, VORAUS_JE_MS * tempo);
  const [tx, tz] = punktBei(route, sF + voraus);

  let soll: number;
  if (!gespannRueck) {
    soll = dir * Math.atan(kruemmungZu(fx, fz, fahrRichtung, tx, tz) * L);
  } else {
    /*
     * RUECKWAERTS MIT ANHAENGER. Gezielt wird mit der Anhaengerachse; aus der
     * Kruemmung, die SIE fahren soll, folgt der Knick, den das Gespann dafuer
     * braucht (im Beharrungszustand sin φ ≈ −κ·(Lt + M)), und aus dem
     * Knickfehler der Lenkeinschlag des Autos. Die mittlere Zeile ist die
     * Knickgleichung aus `rolle`, nach der Gierrate umgestellt.
     */
    const a = f.anhaenger!;
    const M = f.hinten - a.kupplung;
    const Lt = a.deichsel;
    const kt = kruemmungZu(fx, fz, fahrRichtung, tx, tz);
    const phi = -l.knick;
    const phiSoll = Math.max(-KNICK_SOLL_MAX, Math.min(KNICK_SOLL_MAX, -Math.atan(kt * (Lt + M))));
    const v = -Math.max(tempo, 0.1);
    const omega =
      (KNICK_FOLGE * -v * (phiSoll - phi) + (v * Math.sin(phi)) / Lt) /
      (1 + (M * Math.cos(phi)) / Lt);
    soll = Math.atan((omega * L) / v);
  }
  soll = Math.max(-LENK_MAX, Math.min(LENK_MAX, soll));
  l.lenk = lenkeEin(l.lenk, soll, LENK_TEMPO * dt);

  let v = tempo;
  const tan = Math.abs(Math.tan(l.lenk));
  if (tan > 1e-6) v = Math.min(v, Math.sqrt((QUER_BESCHL * L) / tan));
  v *= Math.max(0, 1 - Math.abs(soll - l.lenk) / LENK_NACHLAUF);
  v = Math.min(v, (laenge - s) / dt);
  if (v <= 0) return { s, fertig: false, weg: 0 };
  rolle(l, f, dir * v * dt);
  const [qx, qz] = fortschrittsPunkt(l, f);
  let sNeu = projiziere(route, qx, qz, s + v * dt, Math.max(1, 2 * v * dt));
  const fertig = laenge - sNeu <= ZIEL_REST;
  if (fertig) sNeu = laenge;
  return { s: sNeu, fertig, weg: v * dt };
}
