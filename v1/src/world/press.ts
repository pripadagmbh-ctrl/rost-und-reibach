import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { fraktionAus } from "../materials/purity";
import type { ItemManager } from "./scrapItems";
import type { CompositeManager } from "../dismantle/composites";

/**
 * Schrottschere / Paketierpresse (Design 2026-08-29):
 * Aufbau wie eine oben offene Containermulde — Schrott wird von oben mit der
 * Spinne eingefüllt. Der Zyklus:
 *   1. Zwei dicke Eisenplatten (Deckelklappen) schließen von beiden Seiten von
 *      oben und drücken dabei teilweise von oben ins Material.
 *   2. Der Pressstempel läuft von RECHTS nach LINKS durch die Mulde und presst
 *      das Paket gegen die linke Stirnwand.
 *   3. Stempel zurück, Klappen auf — das Paket liegt fertig in der Mulde.
 *
 * Sicherheitsprinzip (Kap. 6): Beide Werkzeuge sind kinematisch und stoppen vor
 * dem Material (Klemmgrenze), das eigentliche Plattdrücken ist ein
 * Zustandswechsel der Teile — nichts wird gegen eine Wand zerquetscht.
 */

// Südwestlich hinter dem Bagger, auf dem früheren Störstoffplatz. Mittig
// hinter der Maschine schnitt die Schere in die vorderste Sortiermulde;
// hier steht sie frei neben dem Stahlschrotthaufen, und die offene Seite
// bleibt in Reichweite (Design-Fix 29.08.2026).
// Seit der neuen Platzordnung (12.09.2026) steht sie an der Suedgrenze,
// direkt hinter dem Bagger: „hinter mir die Presse im Sueden".
// Kuerzer und ein Stueck zur Seite (Ansage 12.09.2026), damit der Bagger
// naeher an den Mischschrottplatz rueckt. Und quergestellt: Sie lag vom Sitz
// aus waagerecht im Bild und nahm die ganze Breite ein; hochkant steht sie in
// einer Reihe mit Stahlmulde und Halde.
/*
 * Die Presse steht ganz links in der Ecke (Ansage 13.09.2026: „Presse steht
 * ganz links in der Ecke, davor liegt Mischschrott"). Links vom Fahrersitz ist
 * +x, hinten ist −z; die Platzgrenze liegt bei x 10,5 und z −29.
 */
/*
 * Abstand zur Mauer, wegen der Klappe.
 *
 * Ansage 13.09.2026: „die Presse braucht ein wenig Abstand zur Mauer wegen
 * der Klappe." Gemessen an der offenen Maschine: Die Deckelplatte reichte bis
 * z −29,85, die Innenseite der Suedmauer liegt bei −28,7 — sie schwang also
 * 1,15 m in die Mauer hinein. Die Klappe haengt an der Suedseite (`makeLid(-1,
 * true)`), deshalb geht es nach Norden.
 *
 * In x stand sie ebenfalls in der Wand: Der Rahmen reichte bis 10,87, die
 * Ostmauer beginnt innen bei 10,20.
 *
 * Jetzt (5,5 | −24,3): Klappe bis −28,15, also 55 cm vor der Suedmauer,
 * Rahmen bis 9,77, also 43 cm vor der Ostmauer.
 */
/*
 * Nachtrag 14.09.2026, Platzumbau E-010: von (5,5 | −24,3) auf (6,6 | −24,6).
 *
 * Der Konzeptplan zeichnet sie auf (7,3 | −26,0). Beides geht nicht:
 *
 *  - In x endet der Rahmen bei Mitte + 3,325 m. Bei x 7,3 waeren das 10,63,
 *    die Ostmauer beginnt innen bei 10,20 — 43 cm in der Wand. 6,6 laesst
 *    27 cm Luft.
 *  - In z schwingt die Deckelklappe 3,85 m ueber die Mitte hinaus (gemessen
 *    an der offenen Maschine). Bei z −26,0 reichte sie bis −29,85, die
 *    Suedmauer steht innen bei −28,7. Bei −24,6 endet sie auf −28,45.
 *
 * Damit steht sie 7,4 m vom Bagger statt der geplanten 8,5 — beides liegt im
 * Schwenkband 5,8 bis 9,2 m (`test/platz.test.ts`).
 */
/*
 * Nachtrag 14.09.2026 abends: die Presse raeumt die Ostecke.
 *
 * Ansage Patrick: „Die Presse muss weg, da wo sie gerade steht, und da kommt
 * der LKW hin, da faehrt er rueckwaerts ran." Der Abladeplatz braucht die
 * Ecke hinter dem Bagger, weil der Wagen dort mit der Laengsseite zum Sitz
 * steht und nicht mehr von hinten ausgeraeumt werden muss.
 *
 * Die Presse geht dafuer an die WESTFLANKE, auf die Stelle der ersten
 * Sortiermulde. Gesucht, nicht gegriffen:
 *
 *  - Der Plan nennt (−8,0 | −26,5). In z reicht der Rahmen Mitte ± 2,45 m;
 *    bei −26,5 endet er auf −28,95, die Suedmauer steht innen bei −28,70.
 *    Bei −26,0 bleiben 25 cm Luft.
 *  - Abstand zum Sitz (−0,5 | −22,5): 8,28 m, mitten im Schwenkband
 *    5,8 bis 9,2 m.
 */
/*
 * E-138 (17.10.2026): z −26,0 → −26,025, weil die Kammer im Pressweg (z)
 * um 0,25 m laenger wird (siehe `INNER_W`). Zwischen der Suedmauer
 * (Innenkante −28,70) und der Suedwand der Buntmetall-Mulde (Aussenkante
 * −23,35) sind 5,35 m frei; der Rahmen misst jetzt 5,15 m, und −26,025 ist
 * die Mitte der Luecke — je 0,10 m Luft. x bleibt −8,0.
 */
const CENTER = new THREE.Vector3(-8.0, 0, -26.025);
/** Mitte der Presskammer — auch fuer Hindernisliste und Tests. */
export const PRESS_CENTER = CENTER;
// Die Schwelle gilt fuer Objekte wie fuer Pakete — sie steht in materials/purity.ts.
/**
 * Wo das fertige Paket liegen bleibt: in der Kammer.
 *
 * Es gibt kein Ballenlager, und ausgeworfen wird auch nichts (Ansage
 * 12.09.2026: "Ballen bleiben in Presse, ohne Abscheiden"). Das Paket bleibt
 * da, wo es entstanden ist, und wandert von dort in den Behaelter seiner
 * Fraktion — Stahlballen in den 40er, Alupaket in den Alucontainer. Solange es
 * in der Kammer liegt, blockiert es die naechste Fuhre, und genau das soll es
 * auch.
 *
 * Dazwischen war es einmal anders: Die Presse warf das Paket zum Bagger hin
 * aus, und weil die Maschine nur gut vier Meter danebensteht, musste die
 * Auswurfstelle gesucht werden, damit sie ueberhaupt im Greifring landet. Der
 * Aufwand ist mit der Ansage weggefallen — die Kammer ist die Stelle.
 */
export function baleYard(): { x: number; z: number; w: number; d: number } {
  /*
   * `w` und `d` sind WELTachsen, die Kammermasse nicht: Seit die Maschine
   * quersteht (`PRESS_ROT`), liegt die Kammerlaenge in z. Wer das hier
   * vergisst, streut die Pakete quer zur Kammer — bei der fast quadratischen
   * Kammer faellt es nicht auf, bei der naechsten Aenderung schon.
   */
  const quer = Math.abs(Math.sin(ROT)) > 0.5;
  /*
   * Das Feld waechst NICHT mit der Kammer (E-138): 2,00 x 2,85 m wie bei der
   * 4,20 x 4,05-Kammer. Die groessere Kammer reicht nach Westen ueber den
   * Schwenkbereich hinaus; ein Paket dort laege 9,6 m vom Sitz, ausser
   * Reichweite (`test/presse.test.ts`).
   */
  const laengs = 2.0;
  const tief = 2.85;
  return { x: CENTER.x, z: CENTER.z, w: quer ? tief : laengs, d: quer ? laengs : tief };
}
/**
 * Die Mulde liegt längs Ost–West, in einer Flucht mit dem Stahlschrottplatz
 * darüber: Die 10 m lange Seite läuft parallel zum Haufen (x −13,5 bis −3,5),
 * die 4 m Tiefe schließt südlich daran an (z −9 bis −5). Die Deckelklappen
 * legen sich dadurch nach Norden und Süden weg, und der Bagger füllt von oben
 * über die lange Seite ein (Design-Fix 02.09.2026).
 */
// Wieder laengs gestellt (Ansage 12.09.2026: „es kann auch die Presse
// gedreht werden, damit ein bisschen mehr Platz auf der Seite entsteht").
/*
 * Vierteldrehung seit dem Umzug an die Westflanke (14.09.2026 abends).
 *
 * Die Deckelklappe haengt an der Suedseite der Maschine (`makeLid(-1, true)`)
 * und legt sich beim Oeffnen dorthin flach hin — gemessen 3,85 m ueber die
 * Mitte hinaus. An der Westflanke waere das die Suedmauer (innen −28,70). Mit
 * ROT = 90° zeigt dieselbe Seite nach WESTEN, auf die freie Flaeche vor der
 * Silo-Reihe; die Klappe endet dort bei x −11,85 und hat 20 m Luft.
 *
 * Gedreht wird die ganze Gruppe, nicht die Wandlogik: Kammer, Stempel,
 * Klappe und Kollider sitzen unveraendert im Modell.
 */
const ROT = Math.PI / 2;
// Große Mulde: die lange offene Seite zeigt nach Norden zum Baggerplatz,
// damit von dort bequem eingefüllt werden kann (Design 2026-08-29).
// Breite wie der Stahlschrottplatz (11 m), direkt daneben: So bildet die
// Schere mit dem Haufen eine Flucht. Die geringe Tiefe hält die Deckelklappen
// kurz — die Spinne reicht bequem darüber (Wunsch 02.09.2026).
/*
 * 15 % kuerzer und 20 % schmaler als vorher (Ansage 13.09.2026). Aus 7,00 x
 * 4,70 m werden 5,95 x 3,76 m. Der Greifer passt weiterhin hinein: offen misst
 * er 3,02 m ueber die Spitzen, es bleiben also 37 cm auf jeder Seite.
 */
/*
 * Kuerzer seit dem 14.09.2026 abends: „Die Presse ist, glaub ich, auch ein
 * bisschen zu gross, die kann verkleinert werden, eher wie so ein Rechteck,
 * wie ein Quader."
 *
 * Aus 5,95 x 4,05 m werden 4,20 x 4,05 m — im Grundriss fast ein Quadrat und
 * damit ein Quader statt einer langen Wanne. Das ist ein Drittel weniger
 * Grundflaeche (24,1 auf 17,0 m²).
 *
 * Weiter geht nicht: Die offene Sichelkralle misst 3,38 m, mit 30 cm Luft je
 * Seite braucht die Kammer 3,98 m in BEIDEN Richtungen (`spinnenmass`). Wer
 * unter dieses Mass geht, baut einen Behaelter, den man befuellen, aber nicht
 * mehr ausraeumen kann.
 *
 * Die Form entscheidet Patrick am Bild (docs/messungen/
 * 2026-09-14_presse.svg); 4,20 ist ein Vorschlag und haengt an dieser einen
 * Zahl.
 */
/*
 * E-138 (Patrick, 17.10.2026: „die Schere muss etwas grösser werden"):
 * 4,20 → 4,45 m (+6 %). Mehr geht im Pressweg nicht: Er liegt seit der
 * Vierteldrehung in z, und dort fuellt der Rahmen (W + 0,70 = 5,15 m) die
 * 5,35 m zwischen Suedmauer und Buntmetall-Mulde bis auf je 0,10 m. Gewachsen
 * ist die Kammer deshalb vor allem in der TIEFE (`INNER_D`), quer zum
 * Pressweg: Dort liegt ein Wrack richtig, der Stempel drueckt es ueber seine
 * Breite (1,70 m Pkw), nicht ueber seine Laenge.
 */
const INNER_W = 4.45; // x — Länge, Pressweg (rechts → links)
// Schmaler (Ansage 12.09.2026: „die Presse erscheint immer noch zu tief,
// die kann ruhig noch ein bisschen schmaler werden").
/*
 * z — Tiefe der Kammer. Sie bestimmt, ob die Spinne ueberhaupt hineinkommt.
 *
 * Befund 12.09.2026: „bei Presse kam ich nicht an Boden." Gemessen ist die
 * Spinne offen 3,38 m breit (`clawSpan(CLAW_OPEN_SPLAY)`), die Kammer war
 * 3,20 m tief — der Greifer setzte auf den beiden Laengswaenden auf, bevor
 * er unten war. 4,20 m lassen beidseits gut 40 cm Luft, und das ist das
 * Mindestmass fuer jeden Behaelter auf dem Platz: Was man befuellen soll,
 * muss man auch ausraeumen koennen.
 */
/*
 * Nachtrag 13.09.2026, Rueckbau auf die Sichelkralle: 3,76 geht nicht mehr.
 *
 * Die 3,76 m waren die geforderten −20 % und gingen nur, solange der
 * Fuenfschalengreifer eingebaut war — der misst offen 3,02 m. Die Sichelkralle
 * von gestern misst 3,38 m; mit 30 cm Luft je Seite braucht die Kammer 3,98 m.
 * Bei 3,76 setzte der Greifer wieder auf den Laengswaenden auf, und ein
 * Behaelter, den man nicht ausraeumen kann, ist eine Sackgasse
 * (`spinnenmass`).
 *
 * 4,05 statt der urspruenglichen 4,70 sind damit −14 % statt −20. Die Laenge
 * bleibt bei den geforderten −15 %.
 */
/*
 * E-138: 4,05 → 5,05 m (+25 %), gerechnet am laengsten Wrack, das hinein
 * soll — dem Wohnwagen-Aufbau, 4,20 m: quer zum Pressweg abgelegt bleiben
 * ihm 0,42 m an jedem Ende, einem Pkw (4,00 m) 0,52 m. Bei 4,05 waren es
 * beim Pkw 2 cm — wer ihn nicht millimetergenau absetzte, setzte ihn auf
 * die Wand. Die Spinne (3,38 m offen) hat jetzt 0,83 m je Seite.
 * Platz ist in diese Richtung: Die Klappe schwingt nach Westen bis x −12,35
 * (vorher −11,85), das ABFALL-Silo beginnt bei −18,15. Nach Osten rueckt
 * der Rahmen 0,5 m auf den Bagger zu (Aussenkante x −5,125).
 * Zusammen: Grundflaeche 17,0 → 22,5 m² (+32 %).
 */
const INNER_D = 5.05;
/** Lichte Masse der Kammer — fuer Tests und Platzplanung. */
export const PRESS_INNER = { laenge: INNER_W, tiefe: INNER_D };
/** Drehung der Maschine um die Hochachse (0 = Pressweg laeuft in x). */
export const PRESS_ROT = ROT;
/**
 * Aussenmass des Rahmens in WELTachsen, halbe Ausdehnungen.
 *
 * Seit die Presse quersteht, sind Kammerlaenge und Weltachse nicht mehr
 * dasselbe. Wer das uebersieht, traegt sie um 90 Grad verdreht in die
 * Hindernisliste ein — und genau diese Klasse Fehler ist am 12.09.2026 als
 * „unsichtbare Barriere" gemeldet worden. Deshalb steht die Umrechnung
 * einmal hier, und Hindernisliste wie Tests rechnen dagegen.
 */
export const PRESS_FUSS = {
  hw: (Math.abs(Math.cos(ROT)) * (INNER_W + 0.7) + Math.abs(Math.sin(ROT)) * (INNER_D + 0.7)) / 2,
  hd: (Math.abs(Math.sin(ROT)) * (INNER_W + 0.7) + Math.abs(Math.cos(ROT)) * (INNER_D + 0.7)) / 2,
};
/**
 * Die vier Waende der Kammer in WELTachsen — fuer die Hindernisliste.
 *
 * WARUM DAS NOETIG WAR (Befund Patrick, 15.09.2026): „Es war auch nicht
 * moeglich, ein zusammengepresstes Auto wieder aus der Presse zu holen."
 *
 * Die Presse stand in `STATIC_OBSTACLES` als EIN volles Rechteck von
 * 4,75 x 4,90 m und 2,20 m Hoehe. `hitsObstacle` laesst alles ueber `top`
 * hinweg, aber nichts darunter hindurch — der Greifer galt also als „in der
 * Presse steckend", sobald er unter die Wandkrone kam, und das fertige Paket
 * lag unerreichbar in der eigenen Maschine. Genau derselbe Fehler wie die
 * Muldenreihe im August: ein Behaelter, den man befuellen, aber nicht
 * ausraeumen kann.
 *
 * PHYSISCH war die Kammer die ganze Zeit richtig gebaut: Boden plus vier
 * Waende, oben offen (siehe `PressManager`, `walls`). Nur die Hindernisliste
 * sagte etwas anderes. Zwei Wahrheiten ueber dieselbe Sache halten nie —
 * deshalb kommen die Eintraege ab jetzt aus DERSELBEN Rechnung wie die
 * Kollider, so wie `hallenWaende()` es fuer die Hallen macht.
 *
 * (Zahlen unten: Stand vor E-138; seitdem 5,00 x 4,85 m licht, Mitte
 * z −25,75 — die Rechnung ist dieselbe.)
 *
 * Die Kammer misst lichte 4,20 m (Pressweg) x 4,05 m (Tiefe), der Rahmen
 * ist rundum 0,35 m stark. Bei `ROT` = 90 Grad liegt der Pressweg in z:
 *
 *   Nord  x −8,000 ± 2,025   z −23,725 ± 0,175
 *   Sued  x −8,000 ± 2,025   z −28,275 ± 0,175
 *   West  x −10,200 ± 0,175  z −26,000 ± 2,450
 *   Ost   x  −5,800 ± 0,175  z −26,000 ± 2,450
 *
 * Aussen ergibt das genau `PRESS_FUSS` (2,375 x 2,450), innen bleiben
 * 4,05 x 4,20 m frei. Der Ring ist lueckenlos: Die Stirnwaende stossen mit
 * ihrer Aussenkante auf die Innenkante der Laengswaende.
 */
export function pressWaende(): Array<{
  x: number;
  z: number;
  hw: number;
  hd: number;
  top: number;
  teil: string;
}> {
  // Lokale Wandmitten und -masse, wie sie `PressManager` baut.
  const lokal: Array<[number, number, number, number, string]> = [
    [0, -(INNER_D / 2 + 0.175), INNER_W + 0.7, 0.35, "Sued"],
    [0, INNER_D / 2 + 0.175, INNER_W + 0.7, 0.35, "Nord"],
    [-(INNER_W / 2 + 0.175), 0, 0.35, INNER_D, "West"],
    [INNER_W / 2 + 0.175, 0, 0.35, INNER_D, "Ost"],
  ];
  const c = Math.cos(ROT);
  const si = Math.sin(ROT);
  return lokal.map(([lx, lz, sx, sz, name]) => {
    // three.js: Welt = R_y(ROT) * lokal
    const wx = CENTER.x + c * lx + si * lz;
    const wz = CENTER.z - si * lx + c * lz;
    // Halbmasse drehen sich mit: aus (sx, sz) wird bei 90 Grad (sz, sx).
    const hw = (Math.abs(c) * sx + Math.abs(si) * sz) / 2;
    const hd = (Math.abs(si) * sx + Math.abs(c) * sz) / 2;
    /*
     * Namen nach WELTrichtung, nicht nach Kammerachse: Bei ROT = 90 Grad
     * liegt die lokale Suedwand im Westen. Wer den lokalen Namen weitergibt,
     * baut dieselbe Verwechslung ein wie die um 90 Grad verdrehte
     * Hindernisliste vom 12.09.2026.
     */
    const richtung =
      Math.abs(hw) < Math.abs(hd) ? (wx < CENTER.x ? "West" : "Ost") : wz < CENTER.z ? "Sued" : "Nord";
    void name;
    return { x: wx, z: wz, hw, hd, top: 0.3 + WALL_H, teil: richtung };
  });
}

/**
 * Lichte Weite der Kammer in WELTachsen — was zwischen den Waenden frei ist.
 *
 * Steht hier, damit Waechter und Reichweitenrechnung dieselbe Zahl lesen wie
 * der Bau. Die offene Sichelkralle misst 3,38 m; mehr als diese Weite minus
 * Greiferbreite bleibt nicht.
 */
export const PRESS_KAMMER = {
  hw: (Math.abs(Math.cos(ROT)) * INNER_W + Math.abs(Math.sin(ROT)) * INNER_D) / 2,
  hd: (Math.abs(Math.sin(ROT)) * INNER_W + Math.abs(Math.cos(ROT)) * INNER_D) / 2,
};

/**
 * Wie weit die offene Deckelklappe ueber die Mitte hinausschwingt und wohin.
 *
 * Gemessen an der offenen Maschine: 3,85 m zur Klappenseite. Die Klappe
 * haengt lokal im Sueden; die Drehung bildet das auf die Weltachsen ab.
 */
/*
 * 3,85 m waren an der offenen Maschine mit INNER_D 4,05 gemessen. Alles an
 * der Klappe haengt an INNER_D / 2 (Scharnier, Plattenspann, Zylinderbock),
 * also waechst der Weg um die halbe Tiefenaenderung mit (E-138).
 */
export const KLAPPE_WEG = 3.85 + (INNER_D - 4.05) / 2;
export const KLAPPE_RICHTUNG = { x: -Math.sin(ROT), z: -Math.cos(ROT) };
const WALL_H = 1.9;
const PLATE_T = 0.3; // dicke Eisenplatten (SW)
const LID_HINGE_Y = WALL_H - 0.1;
// Offen legen sich die Klappen nach außen weg, statt hochkant über der Mulde
// zu stehen — so bleibt der Blick auf die Schere frei (Design-Fix 29.08.2026)
const LID_OPEN_ANGLE = 2.65; // rad ≈ 152°, die Platten liegen fast flach außen
const RAM_HOME_X = INNER_W / 2 - 0.35;
const RAM_END_X = -INNER_W / 2 + 1.1; // Restdicke = Paketdicke (SW)

const LID_TIME = 1.6; // s (SW)
const RAM_FWD_TIME = 3.0;
const RAM_HOLD_TIME = 0.9;
const RAM_BACK_TIME = 2.0;

type Phase = "idle" | "lidsClose" | "ramFwd" | "hold" | "ramBack" | "lidsOpen";

/**
 * Wie weit reicht ein Koerper entlang einer Weltrichtung? (E-138)
 *
 * Aus seinen Quader-Kollidern gerechnet, so wie sie JETZT liegen — gedreht,
 * geknautscht, schief in der Kammer. Andere Formen zaehlen mit ihrem
 * Mittelpunkt. Gebraucht fuer zweierlei: Der Stempel darf ein Wrack nicht
 * kuerzer schieben, als es lang ist, und die Klappe nicht tiefer schliessen,
 * als sein Dach hoch ist.
 */
export function ausdehnung(body: RAPIER.RigidBody, achse: THREE.Vector3): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  const q = new THREE.Quaternion();
  const e = new THREE.Vector3();
  for (let i = 0; i < body.numColliders(); i++) {
    const c = body.collider(i);
    const t = c.translation();
    const mitte = t.x * achse.x + t.y * achse.y + t.z * achse.z;
    let r = 0;
    if (c.shapeType() === RAPIER.ShapeType.Cuboid) {
      const h = c.halfExtents();
      const rot = c.rotation();
      q.set(rot.x, rot.y, rot.z, rot.w);
      r += Math.abs(e.set(1, 0, 0).applyQuaternion(q).dot(achse)) * h.x;
      r += Math.abs(e.set(0, 1, 0).applyQuaternion(q).dot(achse)) * h.y;
      r += Math.abs(e.set(0, 0, 1).applyQuaternion(q).dot(achse)) * h.z;
    }
    min = Math.min(min, mitte - r);
    max = Math.max(max, mitte + r);
  }
  if (min > max) {
    const t = body.translation();
    min = max = t.x * achse.x + t.y * achse.y + t.z * achse.z;
  }
  return { min, max };
}

/** Der Pressweg als Weltrichtung: lokale x-Achse der gedrehten Maschine. */
const PRESSWEG = new THREE.Vector3(Math.cos(ROT), 0, -Math.sin(ROT));
const OBEN = new THREE.Vector3(0, 1, 0);

export class PressManager {
  /**
   * Verdichtung der größeren Presse — von `main.ts` gesetzt (1 = Grundausbau).
   *
   * Wirkt auf die Pressdichte, nicht aufs Geld: Dieselbe Masse kommt als
   * kleinerer Würfel heraus, und davon passt mehr auf einen Abholer. Kein
   * Preis, keine Reinheit, kein Erlös ändert sich (E-094).
   */
  getBaleBonus: (() => number) | null = null;

  /**
   * DIE Deckelklappe — eine, nicht zwei.
   *
   * Bis zum 15.09.2026 gab es hier ein zweites Paar (`lidRight`), das seit dem
   * 12.09. nichts mehr zeigte: Seine vier Netze standen auf `visible = false`,
   * seine Platte war auf 1 mm zusammengeschrumpft. Der KOLLIDER blieb dabei in
   * voller Groesse stehen — 4,45 x 2,16 m, und im Ruhezustand hing er auf
   * x −6,88 bis −4,83, also 0,905 m weit in die Kammermuendung hinein
   * (gemessen, E-071). Das war die unsichtbare Wand, an der die Spinne beim
   * Ausraeumen der Presse haengenblieb. Jetzt ist die zweite Klappe ganz weg:
   * kein Koerper, kein Kollider, keine unsichtbaren Netze.
   */
  private lid: THREE.Group;
  /** Hubzylinder der Deckelplatten (Winkelhebel-Antrieb) */
  private linkages: Array<{
    a: THREE.Object3D;
    b: THREE.Object3D;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
    barrelLen: number;
  }> = [];
  private lidBody: RAPIER.RigidBody;
  private ram: THREE.Mesh;
  private ramBody: RAPIER.RigidBody;
  private group!: THREE.Group;
  private localP = new THREE.Vector3();
  private phase: Phase = "idle";
  private t = 0;
  private lidAngle = LID_OPEN_ANGLE; // 0 = zu
  /** Zweites Gelenk der Klappe: faltet die aeussere Haelfte auf die innere. */
  private falten: Array<{ gruppe: THREE.Group; seite: -1 | 1; weg: number }> = [];
  private ramX = RAM_HOME_X;
  private ramBackFrom = RAM_END_X;
  private ramTarget = RAM_END_X;
  private stamped = false;

  onStart: (() => void) | null = null;
  onLidsClosed: (() => void) | null = null;
  /** (Anzahl gepresster Teile, Position) */
  onStamp: ((count: number, pos: THREE.Vector3) => void) | null = null;

  /**
   * Warum die Presse eben nicht losgelaufen ist, `null` = sie lief oder lief
   * schon. Fuer die Meldung in `main.ts` (E-138).
   */
  sperrgrund: string | null = null;

  constructor(
    scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private composites: CompositeManager
  ) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a5157, roughness: 0.6, metalness: 0.55 });
    const heavy = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.5, metalness: 0.7 });

    const group = new THREE.Group();
    group.position.copy(CENTER);
    group.rotation.y = ROT;
    scene.add(group);
    this.group = group;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ROT, 0));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(CENTER.x, 0, CENTER.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );

    // --- Mulde: Boden + vier Wände, oben offen ---
    const floor = new THREE.Mesh(new THREE.BoxGeometry(INNER_W + 0.7, 0.3, INNER_D + 0.7), steel);
    floor.position.y = 0.15;
    floor.receiveShadow = true;
    group.add(floor);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((INNER_W + 0.7) / 2, 0.15, (INNER_D + 0.7) / 2).setTranslation(0, 0.15, 0),
      body
    );
    // [x, z, sx, sz] — Längswände (z±) und Stirnwände (x±)
    const walls: Array<[number, number, number, number]> = [
      [0, -(INNER_D / 2 + 0.175), INNER_W + 0.7, 0.35],
      [0, INNER_D / 2 + 0.175, INNER_W + 0.7, 0.35],
      [-(INNER_W / 2 + 0.175), 0, 0.35, INNER_D],
      [INNER_W / 2 + 0.175, 0, 0.35, INNER_D],
    ];
    for (const [wx, wz, sx, sz] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_H, sz), steel);
      wall.position.set(wx, WALL_H / 2 + 0.3, wz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sx / 2, WALL_H / 2, sz / 2).setTranslation(wx, WALL_H / 2 + 0.3, wz),
        body
      );
    }
    // Der gelbe Warnbalken auf der Muldenkante ist weg (Ansage 12.09.2026:
    // „der gelbe Balken da, der kann sowieso weg, der hat für mich jetzt keine
    // große Funktion"). Er lag als durchgehender Riegel quer im Bild und war
    // das Auffaelligste an der ganzen Maschine, ohne etwas zu bedeuten.

    /*
     * EINE Deckelplatte statt zweier (Ansage 12.09.2026: „weil's ja eigentlich
     * nur der Deckel ist, reicht es, wenn wir einen klappbaren Ausleger haben
     * auf einer Seite … ein Pressenkonzept, das nicht so viel Breite
     * braucht").
     *
     * Zwei Klappen, die sich beim Öffnen nach beiden Seiten flach hinlegen,
     * brauchten links und rechts je zwei Meter Luft — die Maschine war doppelt
     * so breit wie ihre Kammer. Jetzt klappt eine einzige Platte zur
     * baggerabgewandten Seite weg; die andere Seite bleibt eine feste Wand.
     */
    const lidReach = INNER_D / 2 + 0.14; // wie weit die Platte zur Mitte reicht
    const lidLen = INNER_W + 0.25; // über die ganze Muldenlänge
    // Drei Hebelpaare je Klappe: Bei 10 m Breite trügen zwei die Platte
    // sichtbar zu wenig.
    const leverX = [-INNER_W / 2 + 1.1, 0, INNER_W / 2 - 1.1];
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xb8bec4,
      roughness: 0.22,
      metalness: 0.85,
    });

    /*
     * EINE Klappe, und sie wird auch nur einmal gebaut (E-071, 15.09.2026).
     *
     * Bis hierher nahm `makeLid` ein Flag `voll` und wurde zweimal gerufen:
     * einmal echt, einmal als Attrappe mit `visible = false` und einer auf
     * 1 mm geschrumpften Platte. Die Attrappe kostete vier Netze, einen
     * kinematischen Koerper — und einen Kollider in VOLLER Groesse, der
     * quer in der Kammermuendung stand. Ein Bauteil, das man nicht sieht und
     * das trotzdem im Weg steht, ist schlimmer als ein haessliches: Man kann
     * es nicht einmal beschreiben. Deshalb gibt es die zweite Seite jetzt
     * ueberhaupt nicht mehr.
     */
    const makeLid = (side: -1 | 1): { pivot: THREE.Group; body: RAPIER.RigidBody } => {
      const pivot = new THREE.Group();
      pivot.position.set(0, LID_HINGE_Y + 0.3, side * (INNER_D / 2 + 0.12));
      /*
       * Zweiteilig statt einer grossen Platte (Ansage 12.09.2026: „ich wuensch
       * mir eher, dass die Klappe noch mal geklappt ist").
       *
       * Eine Platte, die ueber die ganze Kammer reicht, schwingt beim Oeffnen
       * als ein Brett nach aussen und braucht dort genauso viel Platz, wie sie
       * lang ist. Gefaltet legt sich die aeussere Haelfte auf die innere — die
       * Maschine kommt mit der halben Ausladung aus.
       */
      const spann = INNER_D + 0.28;
      const halbSpann = spann / 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(lidLen, PLATE_T, halbSpann), heavy);
      plate.position.z = -side * (halbSpann / 2);
      plate.castShadow = true;
      pivot.add(plate);
      // Zweites Gelenk am Ende der inneren Haelfte
      const falte = new THREE.Group();
      // Ausgangslage: eingefahren; `update` schiebt sie heraus.
      falte.position.z = 0;
      pivot.add(falte);
      const plate2 = new THREE.Mesh(new THREE.BoxGeometry(lidLen, PLATE_T, halbSpann), heavy);
      plate2.position.z = -side * (halbSpann / 2);
      plate2.castShadow = true;
      falte.add(plate2);
      // Fuehrungsschiene statt Scharnier: die Haelfte faehrt aus, sie klappt
      // nicht mehr (Ansage 12.09.2026).
      const schiene = new THREE.Mesh(new THREE.BoxGeometry(lidLen, 0.12, 0.2), heavy);
      schiene.position.z = -side * (halbSpann - 0.1);
      falte.add(schiene);
      this.falten.push({ gruppe: falte, seite: side, weg: halbSpann });
      /*
       * Quer-Versteifungen auf der Platte — gerechnet, nicht abgeschrieben
       * (E-071, 15.09.2026).
       *
       * Hier stand die feste Liste [−4,2 … 4,2]. Die stammt aus der Zeit, als
       * die Klappe 10 m lang war; seit dem 14.09. misst sie `lidLen` = 4,45 m,
       * halbe Laenge also 2,225. Vier der sechs Riegel standen damit NEBEN der
       * Platte in der Luft — gemessen auf z −21,80 und −30,20 (2,00 m
       * daneben) sowie −23,50 und −28,50 (0,28 m daneben), alle auf 1,94 bis
       * 2,93 m Hoehe. Zwei dunkle Balken schwebten frei hinter der Presse.
       *
       * Jetzt sitzen sie gleichmaessig auf der Platte: sechs Riegel auf den
       * Mitten von sechs gleich breiten Feldern, also auf ±0,371, ±1,113 und
       * ±1,854 m. Der aeusserste liegt 0,371 m vor der Plattenkante.
       */
      const RIEGEL = 6;
      for (let i = 0; i < RIEGEL; i++) {
        const rx = lidLen * ((i + 0.5) / RIEGEL - 0.5);
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, halbSpann - 0.25), heavy);
        rib.position.set(rx, PLATE_T / 2 + 0.05, -side * (halbSpann / 2));
        pivot.add(rib);
      }
      // Scharnierrohr längs
      /*
       * Auch das Scharnierrohr ist nicht mehr gelb. Es lief als durchgehender
       * Strang ueber die ganze Kammerlaenge und war genau der Balken, der
       * zweimal beanstandet wurde — die Farbe machte aus einem Bauteil ein
       * Ausrufezeichen.
       */
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, lidLen + 0.2, 10),
        heavy
      );
      hinge.rotation.z = Math.PI / 2;
      pivot.add(hinge);
      // Winkelhebel: stehen nach außen-oben ab und werden von den Zylindern gezogen
      for (const lx of leverX) {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.86, 0.26), heavy);
        lever.position.set(lx, 0.34, side * 0.2);
        lever.rotation.x = -side * 0.42;
        lever.castShadow = true;
        pivot.add(lever);
        const anchor = new THREE.Object3D();
        anchor.position.set(lx, 0.68, side * 0.42);
        pivot.add(anchor);
        // Fester Zylinderbock unten außen an der Mulde
        const base = new THREE.Object3D();
        base.position.set(lx, 0.6, side * (INNER_D / 2 + 1.25));
        group.add(base);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.2, 0.44), steel);
        stand.position.copy(base.position);
        stand.position.y = 0.6;
        stand.castShadow = true;
        group.add(stand);
        // Kräftiger als nötig gezeichnet: Die Hubzylinder sollen die Mechanik
        // erzählen, nicht als Striche verschwinden (Wunsch 02.09.2026).
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12), heavy);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1, 10), rodMat);
        barrel.castShadow = true;
        scene.add(barrel);
        scene.add(rod);
        this.linkages.push({ a: base, b: anchor, barrel, rod, barrelLen: 1.1 });
      }
      group.add(pivot);
      /*
       * Der Koerper entsteht AN DER STARTPOSE, nicht im Ursprung (v2 E-058).
       * Dafuer wird die Ruhestellung — Klappe offen — vorher gesetzt und die
       * Weltmatrix einmal durchgerechnet; `syncTools` fuehrt sie danach nur
       * noch nach. Vorher lag der Kollider einen Schritt lang auf (0|0|0),
       * also mitten unter dem Bagger.
       */
      pivot.rotation.x = -side * LID_OPEN_ANGLE;
      plate.updateWorldMatrix(true, false);
      const startP = plate.getWorldPosition(new THREE.Vector3());
      const startQ = plate.getWorldQuaternion(new THREE.Quaternion());
      const lidBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(startP.x, startP.y, startP.z)
          .setRotation({ x: startQ.x, y: startQ.y, z: startQ.z, w: startQ.w })
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(lidLen / 2, PLATE_T / 2, lidReach / 2),
        lidBody
      );
      return { pivot, body: lidBody };
    };
    const klappe = makeLid(-1);
    this.lid = klappe.pivot;
    this.lidBody = klappe.body;

    // --- Pressstempel: fährt längs durch die Mulde ---
    this.ram = new THREE.Mesh(new THREE.BoxGeometry(PLATE_T * 1.4, WALL_H - 0.1, INNER_D - 0.1), heavy);
    this.ram.position.set(RAM_HOME_X, WALL_H / 2 + 0.3, 0);
    this.ram.castShadow = true;
    group.add(this.ram); // im Muldenrahmen — dreht mit
    /*
     * An der Startpose erzeugen (v2 E-058), nicht im Ursprung: Bis E-138 lag
     * der Stempel einen Schritt lang auf (0 | 1,05 | 0) mitten im Platz.
     */
    this.ram.updateWorldMatrix(true, false);
    const ramP = this.ram.getWorldPosition(new THREE.Vector3());
    const ramQ = this.ram.getWorldQuaternion(new THREE.Quaternion());
    this.ramBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(ramP.x, ramP.y, ramP.z)
        .setRotation({ x: ramQ.x, y: ramQ.y, z: ramQ.z, w: ramQ.w })
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((PLATE_T * 1.4) / 2, (WALL_H - 0.1) / 2, (INNER_D - 0.1) / 2),
      this.ramBody
    );
    // Zylinderbock rechts hinter dem Stempel
    /*
     * Der gelbe Stempelbock am Kammerende ist weg (Ansage 12.09.2026: „bei
     * der Presse ist immer noch der gelbe Balken … das sieht komisch aus und
     * kann weg, es wird ja sowieso nur noch die Ballen gepresst und es bleibt
     * in der Presse, deshalb kann man das Anbauteil entfernen"). Er war das
     * letzte grosse gelbe Stueck an der Maschine und stand quer im Bild.
     */

    this.syncTools();
  }

  start(): boolean {
    this.sperrgrund = null;
    if (this.phase !== "idle") return false;
    /*
     * Was weder Schrottteil noch Wrack ist, wird nicht gepresst (Ansage
     * 15.09.2026: „Der Container kann nicht gepresst werden. Dann gibt es die
     * Fehlermeldung der Presse."). Bis E-138 erledigte das die Geometrie —
     * der MUELL-Container (4,30 m) war laenger als die Kammer (4,20 m). Mit
     * 5,00 m passt er hinein, also fragt die Presse jetzt nach: Steht ein
     * beweglicher Koerper in der Kammer, den sie nicht kennt, laeuft sie nicht.
     * Gesammelt, dann ausgewertet (v2 E-044).
     */
    const fremd: RAPIER.RigidBody[] = [];
    const kennt = new Set<number>();
    for (const it of this.items.items) kennt.add(it.body.handle);
    for (const car of this.composites.cars) kennt.add(car.body.handle);
    const kammer = new RAPIER.Cuboid(INNER_W / 2, WALL_H / 2, INNER_D / 2);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ROT, 0));
    this.world.intersectionsWithShape(
      { x: CENTER.x, y: 0.3 + WALL_H / 2, z: CENTER.z },
      { x: q.x, y: q.y, z: q.z, w: q.w },
      kammer,
      (c) => {
        const b = c.parent();
        if (b && b.isDynamic() && !kennt.has(b.handle)) fremd.push(b);
        return true;
      }
    );
    if (fremd.length > 0) {
      this.sperrgrund = "Container kann nicht gepresst werden";
      return false;
    }
    this.phase = "lidsClose";
    this.t = 0;
    this.onStart?.();
    return true;
  }

  get running(): boolean {
    return this.phase !== "idle";
  }

  /**
   * Ist der Punkt in der Muldenkammer? (Prüfung im gedrehten Muldenrahmen)
   *
   * Öffentlich seit E-125: Die Challenge fragt genau diese Prüfung, statt eine
   * zweite Kammergeometrie zu rechnen — was hier als „drin" gilt, wird gepresst.
   */
  inChamber(p: { x: number; y: number; z: number }): boolean {
    return this.ueberKammer(p) && this.toLocal(p).y < WALL_H + 1.0;
  }

  /** Dieselbe Prüfung ohne Höhe: steht der Punkt waagerecht über der Kammer? (E-125) */
  ueberKammer(p: { x: number; z: number }): boolean {
    const l = this.toLocal({ x: p.x, y: 0, z: p.z });
    return Math.abs(l.x) < INNER_W / 2 + 0.2 && Math.abs(l.z) < INNER_D / 2 + 0.2;
  }

  private toLocal(p: { x: number; y: number; z: number }): THREE.Vector3 {
    this.localP.set(p.x, p.y, p.z);
    return this.group.worldToLocal(this.localP);
  }

  /** Oberkante des Materials — die Klappen drücken nur bis knapp darüber. */
  private pileTop(): number {
    let top = 0.3;
    for (const item of this.items.items) {
      const p = item.body.translation();
      if (this.inChamber(p)) top = Math.max(top, p.y + 0.3);
    }
    // Wracks rechnet `lidLimit` selbst (E-138): Bei ihnen zaehlt nicht nur
    // die Hoehe, sondern auch, wie nah am Scharnier das Dach anfaengt.
    return top;
  }

  /** Weltposition des Muldenzentrums auf Arbeitshöhe (für Partikel/Toasts). */
  get centerWorld(): THREE.Vector3 {
    return CENTER.clone().setY(1.0);
  }

  /**
   * Endposition des Stempels = linke Stirnwand + Paketdicke. Die Dicke wächst
   * mit der Materialmenge — so wird nie mehr Material in den Raum gedrückt, als
   * hineinpasst (Klemmschutz), und der Stempel fährt trotzdem sichtbar durch.
   */
  private computeRamTarget(): number {
    let count = 0;
    let wrackLaenge = 0;
    for (const item of this.items.items) {
      if (this.inChamber(item.body.translation())) count++;
    }
    /*
     * Ein Wrack zaehlt mit seiner LAENGE im Pressweg, nicht pauschal 1,40 m
     * (E-138). Das Knautschen macht es flach, nicht kuerzer — ein Pkw bleibt
     * 4,00 m lang. Mit 1,40 m fuhr der Stempel bis 1,94 m vor die Stirnwand
     * und schob ein laengs liegendes Auto 1,3 m durch sie hindurch.
     */
    for (const car of this.composites.cars) {
      if (!this.inChamber(car.body.translation())) continue;
      const a = ausdehnung(car.body, PRESSWEG);
      wrackLaenge += a.max - a.min;
    }
    const thickness = 0.4 + 0.14 * count + wrackLaenge;
    const ziel = THREE.MathUtils.clamp(-INNER_W / 2 + thickness, RAM_END_X, RAM_HOME_X - 0.4);
    // Nie naeher an die Stirnwand als die Wracks lang sind (+5 cm): Passt
    // eines nicht hinein (der LKW), bleibt der Stempel, wo er ist.
    // `ramX` ist die Mitte des Stempels; seine Druckflaeche liegt eine halbe
    // Plattenstaerke davor.
    const anschlag = wrackLaenge > 0 ? -INNER_W / 2 + wrackLaenge + 0.05 + (PLATE_T * 1.4) / 2 : -Infinity;
    return Math.min(RAM_HOME_X, Math.max(ziel, anschlag));
  }

  /** Kleinstmöglicher Klappenwinkel, damit die Platte nicht ins Material presst. */
  private lidLimit(): number {
    const need = this.pileTop() + 0.08 - (LID_HINGE_Y + 0.3);
    const arm = INNER_D / 2;
    let winkel = need <= 0 ? 0 : Math.asin(Math.min(need / arm, 1));
    /*
     * WRACKS (E-138). Bis hierher stand ein Wrack mit „Unterkante + 0,75 m" in
     * `pileTop`, und gerechnet wurde an der Plattenspitze in der Kammermitte.
     * Beides ist fuer ein Auto falsch: Sein Dach liegt 1,42 m hoch (Wohnwagen
     * 2,40 m), und die Klappe ist am Scharnier am tiefsten, nicht an der
     * Spitze — sie trifft das Dach an seiner scharniernahen Kante. Gemessen
     * schloss sie bis 1,13 m ueber Grund und drueckte das Wrack durch den
     * Kammerboden. Jetzt: Dach, wie es liegt, plus halbe Plattenstaerke, an
     * der Stelle, an der das Wrack dem Scharnier am naechsten kommt.
     */
    const scharnierY = LID_HINGE_Y + 0.3;
    const quer = new THREE.Vector3(Math.sin(ROT), 0, Math.cos(ROT)); // lokale z-Achse
    const scharnierZ = -(INNER_D / 2 + 0.12); // die Klappe haengt lokal im Sueden
    const mitteQuer = CENTER.x * quer.x + CENTER.z * quer.z;
    for (const car of this.composites.cars) {
      if (!this.inChamber(car.body.translation())) continue;
      const dach = ausdehnung(car.body, OBEN).max + 0.08 + PLATE_T / 2 - scharnierY;
      if (dach <= 0) continue;
      const nah = Math.max(ausdehnung(car.body, quer).min - mitteQuer - scharnierZ, 0.3);
      winkel = Math.max(winkel, Math.asin(Math.min(dach / nah, 1)));
    }
    return Math.min(LID_OPEN_ANGLE, winkel);
  }

  update(dt: number): void {
    if (this.phase !== "idle") this.t += dt;
    switch (this.phase) {
      case "lidsClose": {
        const target = this.lidLimit();
        const k = Math.min(this.t / LID_TIME, 1);
        this.lidAngle = THREE.MathUtils.lerp(LID_OPEN_ANGLE, target, k);
        if (k >= 1) {
          this.phase = "ramFwd";
          this.t = 0;
          this.stamped = false;
          this.ramTarget = this.computeRamTarget();
          this.onLidsClosed?.();
        }
        break;
      }
      case "ramFwd": {
        const k = Math.min(this.t / RAM_FWD_TIME, 1);
        this.ramX = THREE.MathUtils.lerp(RAM_HOME_X, this.ramTarget, k);
        // Auf halbem Weg zuschlagen: ab hier ist alles flach und braucht Platz
        if (k >= 0.5 && !this.stamped) {
          this.stamped = true;
          this.stamp();
        }
        if (k >= 1) {
          this.phase = "hold";
          this.t = 0;
        }
        break;
      }
      case "hold":
        if (this.t >= RAM_HOLD_TIME) {
          this.phase = "ramBack";
          this.ramBackFrom = this.ramX;
          this.t = 0;
        }
        break;
      case "ramBack": {
        const k = Math.min(this.t / RAM_BACK_TIME, 1);
        this.ramX = THREE.MathUtils.lerp(this.ramBackFrom, RAM_HOME_X, k);
        if (k >= 1) {
          this.phase = "lidsOpen";
          this.t = 0;
        }
        break;
      }
      case "lidsOpen": {
        const k = Math.min(this.t / LID_TIME, 1);
        this.lidAngle = THREE.MathUtils.lerp(this.lidLimit(), LID_OPEN_ANGLE, k);
        if (k >= 1) this.phase = "idle";
        break;
      }
      case "idle":
        return;
    }
    this.syncTools();
  }

  /** Klappen- und Stempelpose auf Meshes + kinematische Körper übertragen. */
  private syncTools(): void {
    // Die Klappe schwenkt um die Längsachse (X); sie hängt lokal im Süden.
    this.lid.rotation.x = -this.lidAngle;
    /*
     * Die zweite Haelfte FAEHRT AUS, statt zu klappen (Ansage 12.09.2026:
     * „die zweite Haelfte, um die Mulde zu bedecken, soll ausfahrbar sein,
     * also hydraulisch ausfahrbar").
     *
     * Geschlossen ist sie ganz heraus und deckt die Kammer; beim Oeffnen
     * zieht sie sich unter die erste Haelfte zurueck. Dadurch schwenkt beim
     * Oeffnen nur noch eine halbe Plattenlaenge nach aussen.
     */
    const ausfahrt = 1 - this.lidAngle / LID_OPEN_ANGLE;
    for (const f of this.falten) {
      f.gruppe.position.z = -f.seite * f.weg * ausfahrt;
    }
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    const plate = this.lid.children[0];
    plate.updateWorldMatrix(true, false);
    plate.getWorldPosition(wp);
    plate.getWorldQuaternion(wq);
    this.lidBody.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
    this.lidBody.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
    this.ram.position.x = this.ramX;
    this.ram.updateWorldMatrix(true, false);
    this.ram.getWorldPosition(wp);
    this.ram.getWorldQuaternion(wq);
    this.ramBody.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
    this.ramBody.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
    this.updateLinkages();
  }

  private linkA = new THREE.Vector3();
  private linkB = new THREE.Vector3();
  private linkDir = new THREE.Vector3();
  private static UP = new THREE.Vector3(0, 1, 0);

  /** Hubzylinder zwischen festem Bock und Winkelhebel nachführen. */
  private updateLinkages(): void {
    for (const l of this.linkages) {
      l.a.getWorldPosition(this.linkA);
      l.b.getWorldPosition(this.linkB);
      this.linkDir.copy(this.linkB).sub(this.linkA);
      const dist = Math.max(this.linkDir.length(), 0.25);
      this.linkDir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(PressManager.UP, this.linkDir);
      l.barrel.position.copy(this.linkA).addScaledVector(this.linkDir, l.barrelLen / 2);
      l.barrel.quaternion.copy(q);
      l.barrel.scale.set(1, l.barrelLen, 1);
      const rodLen = Math.max(dist - l.barrelLen + 0.12, 0.12);
      l.rod.position.copy(this.linkB).addScaledVector(this.linkDir, -rodLen / 2);
      l.rod.quaternion.copy(q);
      l.rod.scale.set(1, rodLen, 1);
    }
  }

  /**
   * Zuschlagen: alles in der Mulde wird zu Paketen.
   *
   * Alles in der Kammer wird zu EINEM Paket — die Presse sortiert nicht.
   * Wer ein sortenreines Paket will, muss sortenrein einlegen; das Paket
   * merkt sich seine Zusammensetzung und bringt gemischt entsprechend
   * weniger (Design-Fix 29.08.2026).
   *
   * Die Regel in einem Satz (E-091): **Ein Paket ist so sortenrein wie das,
   * was hineinging.** Nichts wird besser durchs Pressen, aber auch nichts
   * schlechter — der Erloes ist vor und nach dem Zuschlagen auf den Cent
   * derselbe (`test/presspaket.test.ts`).
   */
  private stamp(): void {
    const inChamber = this.items.items.filter((it) => this.inChamber(it.body.translation()));
    let count = 0;
    if (inChamber.length === 1) {
      // ein einzelnes Teil ergibt noch kein Paket — das wird nur gestaucht
      if (this.items.flattenItem(inChamber[0])) count++;
    } else if (inChamber.length > 1) {
      // Zusammensetzung festhalten, auch die von schon gepressten Paketen
      const anteile = new Map<string, number>();
      for (const it of inChamber) {
        for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
          anteile.set(c.materialId, (anteile.get(c.materialId) ?? 0) + c.massKg);
        }
      }
      const composition = [...anteile].map(([materialId, massKg]) => ({ materialId, massKg }));
      const kg = composition.reduce((s, c) => s + c.massKg, 0);
      /*
       * Das Etikett des Pakets kommt aus den FRAKTIONEN, nicht aus den
       * Rohstoffen (E-091, 16.09.2026).
       *
       * Der Unterschied ist der zwischen „woraus ist das gemacht" und „wohin
       * gehoert das". Ein Baggerloeffel BESTEHT zu 97 % aus Stahl und zu 3 %
       * aus Gummi; er IST Stahlschrott, denn genau das sagt `fraktionVonTeil`
       * (E-042: bis 10 % Fremdstoff bleibt Stahl Stahl), und danach sortiert
       * der Spieler, danach rechnet das Muldenschild, danach bestellt der
       * Abholer.
       *
       * Bis hierher las die Presse die Rohstoffe und wandte `SORTENREIN_AB`
       * (95 %) darauf an. Damit galt an der Presse eine STRENGERE Regel als
       * auf dem ganzen uebrigen Platz: Fuenf Stuecke, die jedes fuer sich
       * Stahlschrott sind, weil sie 9 % Fremdstoff tragen, kamen als
       * Mischschrott heraus. Pressen machte Sortierarbeit kaputt — und das ist
       * genau umgekehrt gedacht.
       *
       * Die Regel jetzt in einem Satz: **Ein Paket ist so sortenrein wie das,
       * was hineinging.** Gleiche Fraktion hinein, gleiche Fraktion heraus;
       * verschiedene hinein, Mischschrott heraus. Besser wird nichts durchs
       * Pressen — `fraktionAus` verlangt weiterhin 95 % EINER Fraktion.
       *
       * Die Zusammensetzung bleibt unveraendert die Summe der Rohstoffe, also
       * bleibt auch der Erloes auf den Cent derselbe (gemessen,
       * `tools/pressbilanz.ts`).
       *
       * Gewichtet wird mit der WIRTSCHAFTLICHEN Masse eines Stuecks (der Summe
       * seiner Zusammensetzung), nicht mit `massKg`. Sonst bekaeme
       * Platzinventar — der Kehrbesen wiegt 14 kg und besteht aus nichts
       * (E-079) — eine Stimme darueber, wie das Paket heisst.
       */
      const fraktionen = new Map<string, number>();
      for (const it of inChamber) {
        const wirtKg = (it.composition ?? [{ massKg: it.massKg }]).reduce(
          (s, c) => s + c.massKg,
          0
        );
        if (wirtKg <= 0) continue;
        fraktionen.set(it.materialId, (fraktionen.get(it.materialId) ?? 0) + wirtKg);
      }
      const paketMaterial = fraktionAus(
        [...fraktionen].map(([materialId, m]) => ({ materialId, anteil: m / Math.max(kg, 1e-9) })),
        // Kein Stueck mit Masse in der Kammer: dann gibt es nichts zu benennen.
        // „mixed" statt der Vorgabe „steel" von `fraktionAus` — ein Paket aus
        // Nichts ist kein Stahlpaket.
        "mixed"
      );
      for (const it of inChamber) {
        const wasCar = this.composites.despawnByBody(it.body);
        this.items.remove(it, !wasCar);
      }
      // Das fertige Paket wandert ins Ballenlager östlich der Kammer —
      // dort liegt es griffbereit für den Abholer, statt der Presse im Weg
      const lager = baleYard();
      this.items.spawnBale(
        paketMaterial,
        kg,
        new THREE.Vector3(
          lager.x + (Math.random() - 0.5) * (lager.w - 1.2),
          1.4,
          lager.z + (Math.random() - 0.5) * (lager.d - 1.4)
        ),
        composition,
        /*
         * Hier hing der Ausbau bis zum 16.09.2026 in der Luft: `main.ts` setzte
         * `getBaleBonus` auf 1,6, und niemand hat ihn je gefragt — toter Code,
         * 42.000 € fuer nichts (`docs/fraktionen.md`, Nachtrag 17.09.).
         *
         * Verdrahtet ist er jetzt als das, was im Kaufmenue steht („Schwerere
         * Pakete, mehr Ladung je Abholung"), NICHT als Geldfaktor: 1,6 auf die
         * Pressdichte macht dasselbe Paket 37,5 % kleiner (Kante −14,5 %), also
         * passt rund die 1,6-fache Masse auf denselben Abholer. Ein Geldfaktor
         * waere eine Preisaenderung ohne Quelle gewesen.
         */
        this.getBaleBonus?.() ?? 1,
        /*
         * Der Fraktionsmix geht MIT (E-094). Bis hierher trug das Paket nur
         * seine Rohstoffe, und die Kasse las sie — seit sie in Fraktionen
         * rechnet, braucht sie die Fraktionen, die hineingegangen sind.
         *
         * Sonst waere E-091 wieder aufgemacht: 64 kg Kupfer und 217 kg
         * Messing aus dem KUPFER-LAGER heissen als Paket „Mischschrott"
         * (keine Fraktion hat 95 %) und kaemen auf 44,96 € statt 1393,90 €.
         * Mit dem Mix bleibt der Erloes vor und nach dem Zuschlagen auf den
         * Cent derselbe — die Zusage aus E-091.
         */
        [...fraktionen].map(([materialId, massKg]) => ({ materialId, massKg }))
      );
      count += inChamber.length;
    }
    for (const car of this.composites.cars) {
      if (!this.inChamber(car.body.translation())) continue;
      if (car.crushStage < 2) {
        car.pressCrush();
        count++;
      }
    }
    this.onStamp?.(count, CENTER.clone().setY(1.0));
  }
}
