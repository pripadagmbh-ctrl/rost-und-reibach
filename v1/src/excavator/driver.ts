import * as THREE from "three";
import { farbstoff, verschmelze, verschmelzeBunt, type Bauteil } from "./bauteile";

/**
 * Der Fahrer in der Kabine — Daniel. Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 06.10, beschlossen in E-025,
 * Frage 4 von Patrick am 15.09.2026 mit „ja" beantwortet (Warnjacke, eckige
 * Schultern).
 *
 * WARUM ER UMGEBAUT WURDE. Patrick am 14.09.2026: „Jetzt aktuell ist es auch
 * Playmobil like samt Fahrer." Gemessen stimmte das Gefühl und hatte zwei
 * getrennte Ursachen:
 *
 *  1. FORM. Alles war Kapsel oder Kugel — Rumpf `CapsuleGeometry`, Schultern
 *     `SphereGeometry`, Hüfte, Beine, Hals: Kapseln. Keine einzige Kante brach
 *     die Silhouette. Dazu weißes Hemd und Jeans: Freizeitkleidung. Wer eine
 *     Umschlagmaschine fährt, trägt Warnkleidung — und die ist zugleich das
 *     einzige Farbsignal, das auf 15 m Entfernung noch lesbar ist.
 *
 *  2. PREIS. Daniel kostete **16 Netze und 4 648 Dreiecke** — 30 % der ganzen
 *     Maschine für eine Figur, die in der Außenansicht so groß ist wie eine
 *     Hand, während Ausleger und Stiel je 12 Dreiecke hatten. Jedes seiner
 *     16 Teile warf Schatten, kostete also zwei Zeichenrufe: 32 von rund 194.
 *
 * JETZT ZWEI NETZE: `06_FAHRER_HAUT` und `06_FAHRER_KLEIDUNG`. Dass die
 * Kleidung fünf Farben trägt (Orange, Reflexweiß, Hose, Stiefel, Haar) und
 * trotzdem ein Netz bleibt, geht über Eckfarben (`bauteile.ts`).
 *
 * WAS BEWUSST NICHT GEBAUT WURDE: eine Mütze (das Konzept nennt sie als
 * Ersatz für die Haarkugel, Patrick hat sie nicht verlangt) und die Abnahme
 * des Lederbands. Beides ist Charakter, nicht Technik — und beides kostet in
 * dieser Bauweise ohnehin kein Netz mehr.
 *
 * Aus der Innensicht ist absichtlich wenig von ihm zu sehen: Der Blick geht
 * vom Augpunkt aus, Kopf und Rumpf liegen hinter der Kamera. Sichtbar bleiben
 * die Arme mit den Handschuhen an den Joysticks — seit E-142 `fahrerArme()`
 * unten, je Seite ein Netz von der Schulter bis zu den Fingern.
 *
 * @returns die Netze, die beim Wechsel in die Innensicht ausgeblendet werden.
 *          Aus 16 Einträgen sind zwei geworden; `setFirstPerson` arbeitet
 *          unverändert.
 */

/** Haut (m Farbe unverändert seit dem Prototyp). */
const HAUT = 0xe3b18c;
/**
 * Warnorange der Jacke.
 *
 * SW nach EN ISO 20471, Warnorange-Rot. Es ist das einzige an Daniel, was man
 * durch getöntes Glas aus 15 m noch sieht — deshalb kräftig und nicht pastell.
 */
const JACKE = 0xf0741a;
/** Reflexstreifen — silbrig hell, damit sie gegen das Orange stehen. */
const REFLEX = 0xdfe4e8;
/** Hose: unverändert die alte Jeansfarbe. */
const HOSE = 0x3d4b5c;
/** Stiefel: unverändert. */
const STIEFEL = 0x2a2724;
/** Haar: unverändert. */
const HAAR = 0x6b4a2e;
/** Lederband: unverändert. */
const LEDER = 0x2a2724;

/**
 * Wie viele Ecken ein „eckiges" Körperteil bekommt.
 *
 * Sechs. Das ist der Kern der Sache (Konzept 6c): „Ein Sechseck-Profil genügt,
 * es bricht die Silhouette." Bei zwölf Ecken sähe der Rumpf wieder rund aus,
 * bei vier wie ein Karton.
 */
const ECKEN = 6;

/** Ein Sechskantprofil, stehend, mit Mitte bei (x, y, z). */
function hexprisma(
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  drehung = 0
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, ECKEN);
  g.rotateY(drehung);
  g.translate(x, y, z);
  return g;
}

/**
 * 06.10a — die WARNJACKE: Rumpf als Sechskantprofil mit zwei Reflexstreifen.
 *
 * Das war eine `CapsuleGeometry(0.16, 0.3)` — ein Ei. Das Sechskantprofil hat
 * dieselbe Bauhöhe und denselben Umfang, aber sechs senkrechte Kanten, an
 * denen das Licht bricht.
 */
function warnjacke(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  teile.push({ geo: hexprisma(0.175, 0.44, 0, 1.44, z), farbe: JACKE });
  // Zwei Reflexstreifen rund um den Rumpf — das Erkennungszeichen schlechthin
  for (const y of [1.3, 1.45]) {
    teile.push({ geo: hexprisma(0.181, 0.045, 0, y, z), farbe: REFLEX });
  }
  return teile;
}

/**
 * 06.10b — ECKIGE SCHULTERN und KRAGEN statt der Kugel.
 *
 * Die Schulterpartie war eine `SphereGeometry(0.17)`. Eine Kugel auf einem Ei
 * ist die Silhouette einer Spielfigur; ein querliegender Schulterbalken mit
 * zwei Kappen und ein Stehkragen sind die einer Jacke.
 */
function schultern(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const balken = new THREE.BoxGeometry(0.46, 0.15, 0.27);
  balken.translate(0, 1.6, z);
  teile.push({ geo: balken, farbe: JACKE });
  for (const sx of [-1, 1]) {
    const kappe = new THREE.BoxGeometry(0.1, 0.13, 0.25);
    kappe.translate(sx * 0.255, 1.575, z);
    teile.push({ geo: kappe, farbe: JACKE });
  }
  // Kragen: kurzes Sechskantprofil, 45° gedreht, damit es gegen den Rumpf steht
  teile.push({ geo: hexprisma(0.105, 0.075, 0, 1.685, z, Math.PI / ECKEN), farbe: JACKE });
  return teile;
}

/**
 * 06.10d — Hüfte, Beine, Stiefel. Form unverändert (Konzept 6c: „Der Rest
 * bleibt, wie er ist — von außen sieht man ihn durch getöntes Glas").
 */
function beine(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const huefte = new THREE.CapsuleGeometry(0.12, 0.12, 4, 8);
  huefte.translate(0, 1.12, z + 0.08);
  teile.push({ geo: huefte, farbe: HOSE });
  for (const sx of [-0.1, 0.1]) {
    const ober = new THREE.CapsuleGeometry(0.07, 0.26, 4, 8);
    ober.rotateX(Math.PI / 2);
    ober.translate(sx, 1.1, z + 0.26);
    teile.push({ geo: ober, farbe: HOSE });
    const unter = new THREE.CapsuleGeometry(0.065, 0.24, 4, 8);
    unter.translate(sx, 0.88, z + 0.44);
    teile.push({ geo: unter, farbe: HOSE });
    const stiefel = new THREE.SphereGeometry(0.075, 8, 6);
    stiefel.translate(sx, 0.7, z + 0.5);
    teile.push({ geo: stiefel, farbe: STIEFEL });
  }
  return teile;
}

/** 06.10e — Haar und Lederband. Unverändert, nur nicht mehr als eigene Netze. */
function haarUndBand(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const kappe = new THREE.SphereGeometry(0.122, 12, 10);
  kappe.scale(1, 0.95, 1.02);
  kappe.translate(0, 1.9, z - 0.02);
  teile.push({ geo: kappe, farbe: HAAR });
  const nacken = new THREE.SphereGeometry(0.1, 10, 8);
  nacken.scale(1, 0.7, 0.7);
  nacken.translate(0, 1.84, z - 0.06);
  teile.push({ geo: nacken, farbe: HAAR });
  const band = new THREE.TorusGeometry(0.075, 0.01, 6, 14);
  band.rotateX(Math.PI / 2);
  band.translate(0, 1.65, z + 0.01);
  teile.push({ geo: band, farbe: LEDER });
  return teile;
}

/** 06.10f — Hals und Kopf. Das einzige, was Haut ist. */
function hautteile(z: number): THREE.BufferGeometry[] {
  const hals = new THREE.CapsuleGeometry(0.05, 0.06, 4, 8);
  hals.translate(0, 1.73, z - 0.01);
  const kopf = new THREE.SphereGeometry(0.115, 12, 10);
  kopf.scale(1, 1.12, 1.02);
  kopf.translate(0, 1.87, z - 0.01);
  return [hals, kopf];
}

export function buildDriver(
  parent: THREE.Object3D,
  cx: number,
  cz: number
): THREE.Object3D[] {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.name = "06_FAHRER";
  parent.add(g);

  // Alle Teile sind um denselben Rumpfbezug gebaut — er stand vorher an
  // jedem Körperteil einzeln.
  const z = -0.24;

  const haut = new THREE.Mesh(
    verschmelze(hautteile(z), "Fahrerhaut"),
    new THREE.MeshStandardMaterial({ color: HAUT, roughness: 0.8 })
  );
  haut.name = "06_FAHRER_HAUT";
  /*
   * Nur die Kleidung wirft Schatten. Der Kopf liegt vollständig in ihrer
   * Silhouette; sein Schatten wäre nicht zu sehen, würde aber zwei Zeichenrufe
   * kosten (Budgetregel E-025). Vorher warfen ALLE 16 Teile Schatten — 32
   * Zeichenrufe von rund 194 für eine Figur hinter getöntem Glas.
   */
  haut.castShadow = false;
  g.add(haut);

  const kleidung = new THREE.Mesh(
    verschmelzeBunt(
      [...warnjacke(z), ...schultern(z), ...beine(z), ...haarUndBand(z)],
      "Fahrerkleidung"
    ),
    farbstoff(0.88)
  );
  kleidung.name = "06_FAHRER_KLEIDUNG";
  kleidung.castShadow = true;
  g.add(kleidung);

  /*
   * `setFirstPerson` blendet diese Liste aus. Sie hatte 16 Einträge und hat
   * jetzt zwei; die Arme (`fahrerArme`) stehen nicht darin und bleiben in der
   * Kabinenansicht sichtbar.
   */
  return [haut, kleidung];
}

/* ------------------------------------------------- Arme und Hände (E-142) */

/*
 * WARUM DIE ARME VERFORMT AUSSAHEN (Patrick, 17.10.2026: „die arme des
 * baggerfahrers sind verformt"). Es gab keinen Arm, sondern zwei Stücke, die
 * nichts voneinander wussten:
 *
 *  - der OBERARM hing als Kapsel an der Schulter senkrecht nach unten
 *    (bis E-142 hier oben in der Kleidung, Ellbogen bei y 1,33);
 *  - der UNTERARM war eine 45 cm lange, 11 cm dicke Hautkapsel am Joystick
 *    (`kabinenParts.ts fahrerhand`), die waagerecht nach hinten in den Rumpf
 *    stach. Ihr hinteres Ende lag 13 cm weiter außen, 16 cm weiter hinten
 *    und 6 cm höher als der Ellbogen; beim Kippen des Hebels schwenkte es
 *    noch einmal bis zu 12 cm.
 *
 * Die „Faust" war eine querliegende Kapsel über dem Griff, der Daumen eine
 * zweite. Ungleich skalierte Knoten gab es nicht — die Form war falsch, nicht
 * die Skalierung.
 *
 * JETZT: Schulter → Ellbogen → Handgelenk als echte Kette mit festen Längen.
 * Die Hand hängt am Hebel; Ober- und Unterarm werden nach jedem Kippen aus
 * Schulter und Handgelenk errechnet (Zwei-Gelenk-Lösung, wie ein Zirkel mit
 * zwei festen Schenkeln: Spitze an der Schulter, Mine am Handgelenk, das
 * Gelenk des Zirkels ist der Ellbogen und knickt immer nach unten-außen).
 *
 * PREIS. Je Seite EIN Netz mit drei Knochen (Oberarm, Unterarm, Hand). Jedes
 * Teil hängt zu 100 % an genau einem Knochen — es verbiegt sich nichts, die
 * Teile werden nur starr mitgenommen. Das kostet dieselben Zeichenrufe wie
 * vorher die zwei Unterarm-Netze (2 Netze mit Schatten = 4).
 */

/** SW: Schulter bis Ellbogen. Erwachsener ≈ 0,30 m, die Figur ist knapp kleiner. */
const OBERARM = 0.29;
/** SW: Ellbogen bis Handgelenk. Erwachsener ≈ 0,26 m. */
const UNTERARM = 0.26;
/** SW: Arbeitshandschuh aus Rindspaltleder, naturfarben. */
const HANDSCHUH = 0xb3925e;
/** SW: Stulpe aus Segeltuch, blau — wie beim üblichen Kombihandschuh. */
const STULPE = 0x2e5b86;

/**
 * Lage des Joystick-Griffs im Hebel — abgeschrieben aus `kabinenParts.ts`
 * `joystick()`: Kapsel r 0,048, um −0,22 rad gekippt, Mitte (0, 0,29, −0,012).
 * Die Hand wird um diese Griffachse gebaut (y = Griffachse, +z = vorn).
 */
const GRIFF_R = 0.048;
const GRIFF = new THREE.Matrix4()
  .makeTranslation(0, 0.29, -0.012)
  .multiply(new THREE.Matrix4().makeRotationX(-0.22));

/** Handgelenk im Griffraum: hinter dem Griff, etwas außen. s = +1 links (+x). */
function handgelenkImGriff(s: 1 | -1): THREE.Vector3 {
  return new THREE.Vector3(s * 0.035, -0.008, -0.085); // SW
}

const Y = new THREE.Vector3(0, 1, 0);
const grad = THREE.MathUtils.degToRad;

/** Alle Ecken eines Teils hängen zu 100 % an Knochen `i`. */
function anKnochen(t: Bauteil, i: number): Bauteil {
  const n = t.geo.getAttribute("position").count;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    idx[k * 4] = i;
    w[k * 4] = 1;
  }
  t.geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  t.geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  return t;
}

function kugel(r: number, p: THREE.Vector3, farbe: number): Bauteil {
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.translate(p.x, p.y, p.z);
  return { geo: g, farbe };
}

/** Kapsel von a nach b — Daumenglieder. */
function stab(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CapsuleGeometry(r, d.length(), 3, 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Ärmel entlang +y von 0 (Gelenk) bis `len`, Halbmesser r0 → r1. */
function aermel(r0: number, r1: number, len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, len, 8);
  g.translate(0, len / 2, 0);
  return g;
}

/** Reflexstreifen um den Ärmel bei Höhe y (Warnjacke nach EN ISO 20471). */
function reflexring(r: number, y: number): Bauteil {
  const g = new THREE.CylinderGeometry(r, r, 0.035, 8);
  g.translate(0, y, 0);
  return { geo: g, farbe: REFLEX };
}

/**
 * Der Handschuh um den Griff, im Hebelraum (folgt dem Hebel starr).
 *
 * Haltung wie beim Händeschütteln mit geschlossener Faust: Handteller außen
 * am Griff, die vier Finger laufen vorn um den Griff herum bis an seine
 * Innenseite, der Daumen liegt oben auf der Daumentaste.
 */
function handschuh(s: 1 | -1, zumEllbogen: THREE.Vector3): Bauteil[] {
  const R = GRIFF_R;
  const teile: Bauteil[] = [];
  const teller = new THREE.BoxGeometry(0.028, 0.09, 0.1);
  teller.translate(s * (R + 0.014), 0, -0.02);
  teile.push({ geo: teller, farbe: HANDSCHUH });

  // Zeige-, Mittel-, Ring-, kleiner Finger: Höhe am Griff, Umschlingung in
  // Grad, Dicke (SW: Handschuhfinger ≈ 2,5 cm; die Ringe überlappen, damit
  // keine Fuge bleibt, durch die die Wippe vorn am Griff scheint)
  const finger: Array<[number, number, number]> = [
    [0.035, 190, 0.0125],
    [0.0117, 205, 0.0128],
    [-0.0117, 195, 0.0125],
    [-0.035, 170, 0.0115],
  ];
  for (const [y, bogenGrad, r] of finger) {
    const bogen = grad(bogenGrad);
    // Mittellinie des Fingers: Griff + Fingerdicke + 4 mm, damit die Wippe
    // vorn am Griff (kabinenParts `joystick()`, ragt bis r 0,069) darunter liegt
    const rho = R + r + 0.004;
    // Winkel ψ = atan2(z, x). Knöchel vorn-außen, Spitze hinten-innen.
    const knoechel = s > 0 ? grad(35) : grad(145);
    const spitze = knoechel + s * bogen;
    const g = new THREE.TorusGeometry(rho, r, 5, 9, bogen);
    g.rotateX(-Math.PI / 2); // Bogen liegt jetzt bei ψ ∈ [−bogen, 0] …
    g.rotateY(-Math.max(knoechel, spitze)); // … und hier zwischen Knöchel und Spitze
    g.translate(0, y, 0);
    teile.push({ geo: g, farbe: HANDSCHUH });
    for (const psi of [knoechel, spitze]) {
      teile.push(kugel(r, new THREE.Vector3(rho * Math.cos(psi), y, rho * Math.sin(psi)), HANDSCHUH));
    }
  }

  // Daumen: Grundglied vom Ballen hoch, Endglied auf der Daumentaste
  const basis = new THREE.Vector3(s * (R + 0.012), 0.038, -0.045);
  const knick = new THREE.Vector3(s * 0.04, 0.09, -0.012);
  const kuppe = new THREE.Vector3(s * 0.005, 0.087, 0.04);
  teile.push({ geo: stab(basis, knick, 0.0135), farbe: HANDSCHUH });
  teile.push({ geo: stab(knick, kuppe, 0.012), farbe: HANDSCHUH });
  teile.push(kugel(0.026, new THREE.Vector3(s * (R + 0.006), 0.022, -0.04), HANDSCHUH));

  // Stulpe: weiter Trichter über dem Ärmelende, Richtung Ellbogen
  const stulpe = new THREE.CylinderGeometry(0.047, 0.056, 0.065, 8);
  stulpe.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, zumEllbogen.clone().negate()));
  const m = handgelenkImGriff(s).addScaledVector(zumEllbogen, 0.022);
  stulpe.translate(m.x, m.y, m.z);
  teile.push({ geo: stulpe, farbe: STULPE });

  for (const t of teile) t.geo.applyMatrix4(GRIFF);
  return teile;
}

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Ellbogen aus Schulter S und Handgelenk W bei festen Längen: Er liegt auf dem
 * Kreis, auf dem sich zwei Kugeln (um S mit OBERARM, um W mit UNTERARM)
 * schneiden; `pol` wählt den Punkt darauf (unten-außen-hinten).
 */
function ellbogen(S: THREE.Vector3, W: THREE.Vector3, pol: THREE.Vector3, out: THREE.Vector3): void {
  _d.subVectors(W, S);
  const dist = THREE.MathUtils.clamp(_d.length(), OBERARM - UNTERARM + 1e-3, OBERARM + UNTERARM - 1e-3);
  _d.normalize();
  const a = (OBERARM * OBERARM - UNTERARM * UNTERARM + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, OBERARM * OBERARM - a * a));
  _p.copy(pol).addScaledVector(_d, -pol.dot(_d)).normalize();
  out.copy(S).addScaledVector(_d, a).addScaledVector(_p, h);
}

/**
 * Beide Arme des Fahrers, von der Schulter bis in den Handschuh am Hebel.
 *
 * @param parent    dieselbe Gruppe, in der die Joysticks hängen (Kabine)
 * @param cx        Sitzmitte wie bei `buildDriver`
 * @param cz        Sitzmitte wie bei `buildDriver`
 * @param joysticks die beiden Hebel-Drehpunkte (`06_JOYSTICK_L/R`); die Seite
 *                  ergibt sich aus ihrer Lage links oder rechts der Sitzmitte
 * @returns `folge()` — nach jedem Kippen der Hebel aufrufen, rückt Ober- und
 *          Unterarm nach. Die Hände selbst hängen schon am Hebel.
 */
export function fahrerArme(
  parent: THREE.Object3D,
  cx: number,
  cz: number,
  joysticks: THREE.Object3D[]
): () => void {
  const stoff = farbstoff(0.9);
  const folgen: Array<() => void> = [];
  for (const joy of joysticks) {
    const s: 1 | -1 = joy.position.x > cx ? 1 : -1;
    const seite = s > 0 ? "L" : "R";
    // Schultergelenk in der Schulterkappe (schultern(): Kappe x ±0,255, y 1,575)
    const schulter = new THREE.Vector3(cx + s * 0.25, 1.555, cz - 0.24);
    const pol = new THREE.Vector3(s * 0.4, -1, -0.35); // SW: Ellbogen hängt unten-außen-hinten
    const gelenkImHebel = handgelenkImGriff(s).applyMatrix4(GRIFF);

    const ober = new THREE.Bone();
    ober.name = `06_FAHRER_OBERARM_${seite}`;
    const unter = new THREE.Bone();
    unter.name = `06_FAHRER_UNTERARM_${seite}`;
    const hand = new THREE.Bone();
    hand.name = `06_FAHRER_HANDKNOCHEN_${seite}`;
    parent.add(ober, unter);
    joy.add(hand); // die Hand kippt mit dem Hebel

    const E = new THREE.Vector3();
    const W = new THREE.Vector3();
    const r = new THREE.Vector3();
    const folge = (): void => {
      joy.updateMatrix();
      W.copy(gelenkImHebel).applyMatrix4(joy.matrix);
      ellbogen(schulter, W, pol, E);
      ober.position.copy(schulter);
      ober.quaternion.setFromUnitVectors(Y, r.subVectors(E, schulter).normalize());
      unter.position.copy(E);
      unter.quaternion.setFromUnitVectors(Y, r.subVectors(W, E).normalize());
    };
    folge();

    // Ruherichtung Handgelenk → Ellbogen im Griffraum, für die Stulpe
    const zumEllbogen = E.clone()
      .applyMatrix4(joy.matrix.clone().invert())
      .applyMatrix4(GRIFF.clone().invert())
      .sub(handgelenkImGriff(s))
      .normalize();

    const teile: Bauteil[] = [
      anKnochen({ geo: aermel(0.056, 0.05, OBERARM), farbe: JACKE }, 0),
      anKnochen(kugel(0.056, new THREE.Vector3(), JACKE), 0),
      anKnochen(reflexring(0.0565, OBERARM * 0.62), 0),
      anKnochen({ geo: aermel(0.05, 0.041, UNTERARM), farbe: JACKE }, 1),
      anKnochen(kugel(0.051, new THREE.Vector3(), JACKE), 1),
      anKnochen(reflexring(0.05, UNTERARM * 0.45), 1),
      ...handschuh(s, zumEllbogen).map((t) => anKnochen(t, 2)),
    ];
    const arm = new THREE.SkinnedMesh(verschmelzeBunt(teile, "Fahrerarm"), stoff);
    arm.name = `06_FAHRER_ARM_${seite}`;
    arm.castShadow = true;
    /*
     * Jedes Teil ist im Raum SEINES Knochens gebaut; deshalb sind Bind- und
     * Knochen-Inverse die Einheitsmatrix: Ecke in der Welt = Knochen × Ecke.
     */
    const I = (): THREE.Matrix4 => new THREE.Matrix4();
    arm.bind(new THREE.Skeleton([ober, unter, hand], [I(), I(), I()]), I());
    // Hüllkugel für alle Hebelstellungen (das Netz liegt am Ursprung der Kabine)
    arm.boundingSphere = new THREE.Sphere(schulter.clone().lerp(W, 0.5), 0.5);
    parent.add(arm);
    folgen.push(folge);
  }
  return () => {
    for (const f of folgen) f();
  };
}
