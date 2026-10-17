import * as THREE from "three";
import { verschmelze, verschmelzeBunt, type Bauteil } from "./bauteile";
import { DISPLAY_LAGE } from "./instruments";

/**
 * Die Kabine des Baggers, Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 06, beschlossen in E-025.
 *
 * WARUM. Die Kabine kostete **25 Netze** für Blech, Glas, Sitz und Konsolen,
 * dazu **14 für die beiden Joysticks** und **6 für die Unterarme**. Zusammen
 * 45 Netze und 90 Zeichenrufe — fast die Hälfte der ganzen Maschine, für ein
 * Bauteil, das man von außen durch getöntes Glas sieht.
 *
 * Nichts davon bewegt sich gegeneinander, mit zwei Ausnahmen: Die beiden
 * Joysticks kippen mit der Achseingabe, und an ihnen hängen die Unterarme.
 * Also bleiben sie eigene Netze — aber je Seite EINES statt sieben.
 *
 * FÜNF NETZE für die Kabine selbst:
 *   `06_KABINE_LACK`   — grün: Dach, vier Säulen, Dachstrebe, Regenrinne,
 *                        Türrahmen mit Scharnieren und Griff, Trittstufe,
 *                        zwei Spiegelarme
 *   `06_KABINE_STAHL`  — anthrazit: Bodenblech, Fußscheibenrahmen, zwei
 *                        Konsolen, Displayrahmen, zwei Spiegel,
 *                        Scheibenwischer, Sonnenblende, Kopfstützenstäbe
 *   `06_SCHEIBEN`      — Glas: Front, Heck, zwei Seiten, Fußscheibe,
 *                        Dachscheibe
 *   `06_SITZ`          — Sitz, Lehne, Kopfstütze, zwei Armlehnen, Gurt
 *   `06_DISPLAY_BILD`  — die Leinwand des Bordinstruments (eigene Textur,
 *                        wird viermal je Sekunde neu gezeichnet)
 *
 * WAS SICH NICHT ÄNDERT: Kein Maß der Kabine wandert. Der Augpunkt der
 * Kabinenkamera (y 3,28, z 0,20 bei unten stehender Kabine) und die Lage von
 * Sitz, Konsolen und Display bleiben, wie sie sind — die Kabinenansicht ist
 * Patricks Arbeitsplatz beim Sortieren und wird von diesem Paket nicht
 * berührt. Nur der Kabinenhub (eigenes, letztes Paket) rührt daran.
 */

/** Anthrazit — unverändert. */
const STAHL = 0x2b2e31;
/** Sitzpolster — unverändert. */
const POLSTER = 0x24272a;
/** Gehäuse des Bordinstruments — unverändert aus `instruments.ts`. */
const DISPLAY_RAHMEN = 0x121416;
/** Spiegelfläche. SW: helles Grau mit Metallglanz, damit sie sich abhebt. */
const SPIEGEL = 0xb6c2c9;
/** Sicherheitsgurt. SW: dunkles Gurtband. */
const GURT = 0x1d2124;

/**
 * 06.3 — das Kabinengerüst in Maschinenfarbe: Dach, vier Säulen, Dachstrebe.
 *
 * Alles unverändert in Lage und Maß. Neu sind Regenrinne, Türrahmen mit
 * Scharnieren und Griff, Trittstufe und die beiden Spiegelarme — die Teile,
 * die eine Kabine von einem Glaskasten unterscheiden und die der Kipper längst
 * hat (`delivery/vehicleModel.ts`: Türfuge, Griff, Tritte, Außenspiegel).
 */
export function kabineLack(cx: number, cz: number): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const dach = new THREE.BoxGeometry(1.2, 0.09, 0.85);
  dach.translate(cx, 2.1, cz - 0.32);
  teile.push(dach);
  const strebe = new THREE.BoxGeometry(1.16, 0.05, 0.06);
  strebe.translate(cx, 2.06, cz + 0.3);
  teile.push(strebe);
  for (const [px, pz] of [
    [-0.52, -0.66],
    [0.52, -0.66],
    [-0.52, 0.66],
    [0.52, 0.66],
  ] as const) {
    const saeule = new THREE.BoxGeometry(0.08, 1.45, 0.08);
    saeule.translate(cx + px, 1.33, cz + pz);
    teile.push(saeule);
  }
  // Regenrinne rund um das Dach — hinten quer, seitlich längs
  const rinneHinten = new THREE.BoxGeometry(1.24, 0.035, 0.045);
  rinneHinten.translate(cx, 2.145, cz - 0.735);
  teile.push(rinneHinten);
  for (const sx of [-1, 1]) {
    const rinne = new THREE.BoxGeometry(0.045, 0.035, 0.86);
    rinne.translate(cx + sx * 0.62, 2.145, cz - 0.32);
    teile.push(rinne);
  }
  /*
   * Türrahmen auf der RECHTEN Seite (−X): Der Fahrer steigt dort ein, dort
   * sitzt auch das Namensschild (`buildNamePlate`) und der Aufstieg am
   * Unterwagen. Vier Leisten um die Seitenscheibe, zwei Scharnieren hinten,
   * Griff vorn.
   */
  const tx = cx - 0.575;
  for (const [dy, h, dz, t] of [
    [0.71, 0.055, 0, 1.36],
    [-0.71, 0.055, 0, 1.36],
  ] as const) {
    const leiste = new THREE.BoxGeometry(0.045, h, t);
    leiste.translate(tx, 1.33 + dy, cz + dz);
    teile.push(leiste);
  }
  for (const dz of [-0.68, 0.68]) {
    const leiste = new THREE.BoxGeometry(0.045, 1.42, 0.055);
    leiste.translate(tx, 1.33, cz + dz);
    teile.push(leiste);
  }
  for (const dy of [-0.3, 0.3]) {
    const scharnier = new THREE.BoxGeometry(0.06, 0.09, 0.05);
    scharnier.translate(tx - 0.03, 1.33 + dy, cz - 0.68);
    teile.push(scharnier);
  }
  const griff = new THREE.BoxGeometry(0.04, 0.05, 0.18);
  griff.translate(tx - 0.04, 1.22, cz + 0.42);
  teile.push(griff);
  /*
   * Trittstufe unter der Tür, mit zwei Konsolen ans Bodenblech.
   *
   * Im ersten Riss am 15.09.2026 hing sie frei in der Luft: Das Bodenblech
   * liegt bei y 0,58, die Stufe bei 0,42 — 16 cm dazwischen, und nichts, was
   * sie hielt.
   */
  const tritt = new THREE.BoxGeometry(0.3, 0.05, 0.28);
  tritt.translate(cx - 0.66, 0.44, cz + 0.05);
  teile.push(tritt);
  for (const dz of [-0.1, 0.1]) {
    const konsole = new THREE.BoxGeometry(0.22, 0.05, 0.045);
    konsole.translate(cx - 0.6, 0.53, cz + 0.05 + dz);
    teile.push(konsole);
  }
  // Zwei Spiegelarme, vorn oben an den Säulen
  for (const sx of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6);
    arm.rotateZ(Math.PI / 2);
    arm.translate(cx + sx * 0.66, 1.96, cz + 0.62);
    teile.push(arm);
  }
  return verschmelze(teile, "Kabine-Lack");
}

/**
 * 06.3 — der Stahl der Kabine: Bodenblech, Fußscheibenrahmen, Konsolen,
 * Displayrahmen, Spiegel, Scheibenwischer, Sonnenblende, Kopfstützenstäbe.
 *
 * Bunt, weil der Displayrahmen fast schwarz und die Spiegelfläche hell ist —
 * drei Farben, ein Starrkörper, ein Netz (`bauteile.ts`).
 *
 * DIE FUSSSCHEIBE ist der Grund, warum hier gedreht wird: Ihr Rahmen saß in
 * einer eigenen Gruppe mit `rotation.x = −0,42` (Design-Wunsch 29.08.2026:
 * „der Fahrer sieht senkrecht nach unten auf den Greifer"). Beim Verschmelzen
 * muss diese Drehung in die Geometrie — die Gruppe gibt es danach nicht mehr.
 */
export function kabineStahl(cx: number, cz: number): THREE.BufferGeometry {
  const teile: Bauteil[] = [];
  const boden = new THREE.BoxGeometry(1.1, 0.07, 0.75);
  boden.translate(cx, 0.58, cz - 0.33);
  teile.push({ geo: boden, farbe: STAHL });

  /** Ein Teil des Fußscheibenrahmens in die geneigte Lage bringen. */
  const imFussrahmen = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    g.rotateX(-0.42);
    g.translate(cx, 0.6, cz + 0.36);
    return g;
  };
  const quer = new THREE.BoxGeometry(1.04, 0.028, 0.045);
  quer.translate(0, 0.03, 0);
  teile.push({ geo: imFussrahmen(quer), farbe: STAHL });
  for (const sx of [-0.5, 0.5]) {
    const rand = new THREE.BoxGeometry(0.05, 0.045, 0.72);
    rand.translate(sx, 0.02, 0);
    teile.push({ geo: imFussrahmen(rand), farbe: STAHL });
  }

  for (const side of [-1, 1]) {
    const konsole = new THREE.BoxGeometry(0.16, 0.28, 0.44);
    konsole.translate(cx + side * 0.36, 1.02, cz + 0.02);
    teile.push({ geo: konsole, farbe: STAHL });
  }
  for (const sx of [-0.09, 0.09]) {
    const stab = new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8);
    stab.translate(cx + sx, 1.63, cz - 0.47);
    teile.push({ geo: stab, farbe: STAHL });
  }

  /*
   * Gehäuse des Bordinstruments. Es stand bis zum 15.09.2026 in
   * `instruments.ts` als eigenes Mesh neben der Leinwand — zwei Netze für ein
   * Display. Die Leinwand bleibt dort (sie wird viermal je Sekunde neu
   * gezeichnet), das Gehäuse liegt jetzt hier. Die Lage kommt aus
   * `DISPLAY_LAGE`, damit beide dieselbe Zahl benutzen und nicht zwei Kopien.
   */
  const rahmen = new THREE.BoxGeometry(0.36, 0.26, 0.02);
  // Reihenfolge wie beim alten Halter (`rotation.set` in XYZ): erst Y, dann X
  rahmen.rotateY(DISPLAY_LAGE.ry);
  rahmen.rotateX(DISPLAY_LAGE.rx);
  rahmen.translate(cx + DISPLAY_LAGE.dx, DISPLAY_LAGE.y, cz + DISPLAY_LAGE.dz);
  teile.push({ geo: rahmen, farbe: DISPLAY_RAHMEN });

  // Zwei Außenspiegel an den Armen
  for (const sx of [-1, 1]) {
    const spiegel = new THREE.BoxGeometry(0.035, 0.22, 0.15);
    spiegel.translate(cx + sx * 0.79, 1.96, cz + 0.62);
    teile.push({ geo: spiegel, farbe: SPIEGEL });
  }
  /*
   * KEIN SCHEIBENWISCHER, und die Sonnenblende ist kleiner.
   *
   * Befund Patrick am Geraet, 15.09.2026, aus der Kabinensicht:
   * „Scheibenwischer erstmal raus, Sonnenblende kleiner."
   *
   * Beide standen genau dort, wo man beim Arbeiten hinschaut. Der Wischer lag
   * mit Arm und Blatt schraeg ueber der Frontscheibe auf Augenhoehe (y 1,05,
   * der Augpunkt liegt bei 1,68); die Blende hing mit 0,98 x 0,16 m ueber der
   * ganzen Scheibenbreite. Von aussen sind beide Zierrat, von innen nehmen sie
   * Sicht — und die Kabinenansicht ist die, in der gearbeitet wird.
   *
   * „Erstmal raus" heisst: Der Wischer kann wiederkommen, wenn es je Regen
   * gibt und er etwas zu tun hat. Dann gehoert er in Ruhestellung an den
   * unteren Scheibenrand, nicht quer ins Bild.
   *
   * Die Blende bleibt, weil sie eine Kabine als Kabine lesbar macht — aber nur
   * noch als schmaler Streifen: 0,72 x 0,09 statt 0,98 x 0,16 m, also knapp
   * ein Drittel der Flaeche. Sie sitzt weiter oben an der Scheibe, wo der
   * Blick ohnehin nicht hingeht.
   */
  const blende = new THREE.BoxGeometry(0.72, 0.028, 0.09);
  blende.rotateX(0.5);
  blende.translate(cx, 1.93, cz + 0.62);
  teile.push({ geo: blende, farbe: STAHL });

  return verschmelzeBunt(teile, "Kabine-Stahl");
}

/**
 * 06.4 — die ganze Verglasung als EIN Netz: Front, Heck, zwei Seiten,
 * Fußscheibe, Dachscheibe.
 *
 * Sechs Scheiben, sechs Netze, zwölf Zeichenrufe — und sie bewegen sich
 * natürlich nicht gegeneinander. Lage und Maß aller sechs sind unverändert.
 */
export function kabineGlas(cx: number, cz: number): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const scheiben: Array<[number, number, number, number, number, number]> = [
    [cx, 1.28, cz + 0.69, 1.0, 1.52, 0.03], // Front, bis in den Fußbereich
    [cx, 1.33, cz - 0.69, 1.0, 1.42, 0.03], // Heck
    [cx - 0.54, 1.33, cz, 0.03, 1.42, 1.3], // rechts (−X)
    [cx + 0.54, 1.33, cz, 0.03, 1.42, 1.3], // links
  ];
  for (const [x, y, z, sx, sy, sz] of scheiben) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    teile.push(g);
  }
  // Fußscheibe, schräg eingesetzt — dieselbe Neigung wie ihr Rahmen
  const fuss = new THREE.BoxGeometry(1.02, 0.035, 0.7);
  fuss.rotateX(-0.42);
  fuss.translate(cx, 0.6, cz + 0.36);
  teile.push(fuss);
  // Dachscheibe, 40° geneigt — der Blick nach oben auf den Ausleger
  const dach = new THREE.BoxGeometry(1.06, 0.04, 0.78);
  dach.rotateX(THREE.MathUtils.degToRad(40));
  dach.translate(cx, 1.98, cz + 0.42);
  teile.push(dach);
  return verschmelze(teile, "Kabine-Glas");
}

/**
 * 06.5 — der Sitz: Fläche, Lehne, Kopfstütze, zwei Armlehnen, Gurt.
 *
 * Lage und Maß von Fläche, Lehne und Kopfstütze sind unverändert — der
 * Augpunkt der Kabinenkamera liegt an der Lehne. Neu sind die Armlehnen (sie
 * führen zu den Konsolen und erklären, warum die Hände dort liegen) und der
 * Gurt.
 */
export function kabineSitz(cx: number, cz: number): THREE.BufferGeometry {
  const teile: Bauteil[] = [];
  const flaeche = new THREE.BoxGeometry(0.5, 0.12, 0.5);
  flaeche.translate(cx, 0.95, cz - 0.2);
  teile.push({ geo: flaeche, farbe: POLSTER });
  const lehne = new THREE.BoxGeometry(0.5, 0.62, 0.1);
  lehne.translate(cx, 1.3, cz - 0.48);
  teile.push({ geo: lehne, farbe: POLSTER });
  const kopf = new THREE.BoxGeometry(0.34, 0.22, 0.12);
  kopf.translate(cx, 1.76, cz - 0.47);
  teile.push({ geo: kopf, farbe: POLSTER });
  for (const side of [-1, 1]) {
    const lehnchen = new THREE.BoxGeometry(0.08, 0.07, 0.34);
    lehnchen.translate(cx + side * 0.29, 1.16, cz - 0.16);
    teile.push({ geo: lehnchen, farbe: POLSTER });
  }
  // Gurt: schräg über die Lehne, wie abgelegt
  const gurt = new THREE.BoxGeometry(0.06, 0.66, 0.02);
  gurt.rotateX(-0.12);
  gurt.rotateZ(0.32);
  gurt.translate(cx - 0.12, 1.3, cz - 0.41);
  teile.push({ geo: gurt, farbe: GURT });
  return verschmelzeBunt(teile, "Kabine-Sitz");
}

/* ------------------------------------------------------------- Joysticks */

/** Faltenbalg-Gummi. Unverändert. */
const GUMMI = 0x17191b;
/** Griffschale. Unverändert. */
const GRIFF = 0x24282c;
/** Tastenfarbe. Unverändert. */
const TASTE = 0xd97a1f;

/**
 * Ein ISO-Joystick als EIN Netz: Faltenbalg (drei Wülste), Schaft, Griff,
 * Daumentaste, Wippe.
 *
 * Er kippt mit der Achseingabe und ist deshalb ein eigener Starrkörper — aber
 * innerhalb kippt nichts gegeneinander. Vorher sieben Netze je Seite, also 14
 * Netze und 28 Zeichenrufe für zwei Hebel von 40 cm Höhe.
 *
 * Alle Maße unverändert (Design-Wunsch 29.08.2026: „moderner Kreuzhebel statt
 * Kugelknauf"). Der Ursprung ist der Kipppunkt des Hebels.
 */
export function joystick(): THREE.BufferGeometry {
  const teile: Bauteil[] = [];
  for (let b = 0; b < 3; b++) {
    const balg = new THREE.CylinderGeometry(0.055 - b * 0.006, 0.062 - b * 0.006, 0.035, 10);
    balg.translate(0, 0.03 + b * 0.037, 0);
    teile.push({ geo: balg, farbe: GUMMI });
  }
  const schaft = new THREE.CylinderGeometry(0.021, 0.025, 0.12, 8);
  schaft.translate(0, 0.18, 0);
  teile.push({ geo: schaft, farbe: GRIFF });
  const griff = new THREE.CapsuleGeometry(0.048, 0.1, 3, 8);
  griff.rotateX(-0.22);
  griff.translate(0, 0.29, -0.012);
  teile.push({ geo: griff, farbe: GRIFF });
  const daumen = new THREE.CylinderGeometry(0.019, 0.019, 0.014, 8);
  daumen.rotateX(-0.22);
  daumen.translate(0, 0.365, 0.012);
  teile.push({ geo: daumen, farbe: TASTE });
  const wippe = new THREE.BoxGeometry(0.05, 0.032, 0.018);
  wippe.rotateX(0.25);
  wippe.translate(0, 0.285, 0.05);
  teile.push({ geo: wippe, farbe: TASTE });
  return verschmelzeBunt(teile, "Joystick");
}

