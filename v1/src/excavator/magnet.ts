import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { farbstoff, verschmelzeBunt, type Bauteil } from "./bauteile";
import { merkeMaxAusladung, type Greiferbau, type Greiferform } from "./greiferform";
import type { ScrapItem } from "../world/scrapItems";

/**
 * DER LASTHEBEMAGNET — der dritte Greifer (E-146, 17.10.2026).
 *
 * Patrick: „magnet als greifer". Auf Rueckfrage: Er zieht wie echt nur Eisen
 * und Stahl an. Kupfer, Aluminium, Messing und Edelstahl (VA, austenitisch,
 * nicht magnetisch) bleiben liegen bzw. fallen ab; ein Mischteil haengt nur,
 * wenn genug Stahl dran ist; Wracks ja, die sind ueberwiegend Stahl.
 *
 * Bauweise wie ein Schrottplatz-Magnet: eine runde Scheibe am Rotator, das
 * Kabel zum Stiel. Er haengt an demselben Kardangelenk und demselben Pendel
 * wie die Spinne — `PENDEL_L`, Daempfung, Schwenk und Kamera bleiben, wie sie
 * sind (Regel 2). Das Greifsystem ist dasselbe (kinematisches Mitfuehren,
 * `MAX_TOTAL_KG`), nur ohne Schalen: Was angezogen wird, zieht ein kurzer
 * Impuls bis an die Unterseite, dort wird es angeheftet, wo es anliegt
 * (`GripSystem.updateMagnet`). Kein Saugen ueber grosse Distanz und kein
 * Zurechtruecken in die Mitte.
 *
 * Alle Masse im Frame des Greifers: Ursprung = Kardangelenk, y nach unten
 * negativ, wie bei den beiden anderen Formen.
 */

/**
 * Radius der Scheibe (m). SW: Ø 1,30 m — runde Elektro-Lasthebemagnete fuer
 * Schrott an 20–30-t-Baggern liegen nach Herstellerangaben bei Ø 1,1–1,5 m;
 * genommen ist die Mitte der Spanne aus dem Auftrag.
 */
export const MAGNET_R = 0.65;
/** Hoehe der Scheibe (m). SW: Verhaeltnis wie bei den Datenblaettern, rund ein Drittel des Durchmessers. */
export const MAGNET_H = 0.45;
/**
 * Unterkante der Scheibe unter dem Kardangelenk (m).
 *
 * Darueber: Rotatorgehaeuse auf demselben Platz wie bei der Spinne (der
 * Palm-Kollider des Baggers bei −0,75 m, ±0,22), dann 0,18 m Gehaenge.
 * Gerechnet: Rotator-Unterkante 0,97 + Gehaenge 0,18 + Scheibe 0,45 = 1,60.
 */
export const MAGNET_UNTEN = 1.6;
/**
 * Wie weit das Feld unter der Scheibe zieht (m). SW aus dem Auftrag (~0,6 m):
 * Ein Teil muss nicht beruehrt werden, aber ein Meter Luft ist zu viel —
 * sonst saugt der Magnet den halben Haufen an.
 */
export const MAGNET_REICH = 0.6;
/** So weit ueber den Scheibenrand hinaus zieht das Feld seitlich (m). SW. */
export const MAGNET_RAND = 0.1;
/**
 * Ab diesem Anteil Eisen und Stahl haftet ein Teil (0..1). SW aus dem
 * Auftrag: „z. B. ≥ 50 % Stahl/Eisen". Waschmaschine (62 %) haftet,
 * Elektromotor (58 %) knapp, Rad mit Alufelge (0 %) nicht.
 */
export const MAGNET_AB = 0.5;
/**
 * Eigengewicht des Magneten (kg). SW 1 700 kg: Datenblaetter runder
 * Lasthebemagnete um Ø 1,3 m nennen 1,5–2 t (Auftrag „SW ~1,5–2 t").
 *
 * Seit E-152 geht es von der Traglast ab (`traglast.ts`): Mit dem Magneten
 * hebt die Maschine 0,6 t weniger als mit dem Fuenfschalengreifer. Auf Pendel
 * und Armtempo wirkt es weiterhin nicht (Regel 2).
 */
export const MAGNET_EIGEN_KG = 1700;

const WIRK_OBEN = -MAGNET_UNTEN + 0.05; // ein Hauch ueber der Unterseite: was anliegt, zaehlt
const WIRK_UNTEN = -MAGNET_UNTEN - MAGNET_REICH;
const WIRK_R = MAGNET_R + MAGNET_RAND;

/** Die Ausladung einer gekippten Scheibe: tiefster Randpunkt. */
function ausladung(_winkel: number, kipp: number): number {
  if (kipp === 0) return MAGNET_UNTEN; // Vorabsprung: lotrecht Ziffer fuer Ziffer `tiefe`
  return MAGNET_UNTEN * Math.cos(kipp) + MAGNET_R * Math.abs(Math.sin(kipp));
}

export const MAGNET: Greiferform = {
  id: "magnet",
  name: "Lasthebemagnet",
  // Keine Schalen: Alles, was der Bagger je Schale tut, laeuft null Mal.
  schalen: 0,
  stationen: 1,
  // „zu" und „offen" sind beim Magneten Aus und Ein — der Schliessgrad des Baggers
  zu: 0,
  offen: 1,
  punkt(_a, _w, _k, out) {
    return out.set(0, -MAGNET_UNTEN, 0);
  },
  tiefe: () => MAGNET_UNTEN,
  maxTiefe: MAGNET_UNTEN,
  ausladung,
  maxAusladung: merkeMaxAusladung(
    () => MAGNET,
    () => MAGNET_UNTEN
  ),
  /** Das Wirkfeld: ein Zylinder unter der Scheibe. */
  imKorb(p: THREE.Vector3): boolean {
    if (p.y > WIRK_OBEN || p.y < WIRK_UNTEN) return false;
    return Math.hypot(p.x, p.z) <= WIRK_R;
  },
  // Die Sensorkugel umschliesst den Wirkzylinder: Mitte in halber Reichweite
  sensorSitz: MAGNET_UNTEN + MAGNET_REICH / 2,
  sensorRadius: Math.hypot(WIRK_R, MAGNET_REICH / 2),
  korbLuftUnten: MAGNET_REICH,
  // Keine Schalen, keine Luecke — die Zahl muss nur existieren
  schalenluecke: 2 * MAGNET_R,
  // Nicht null: `schliesskraftKN` teilt dadurch (der Stau ist ohne Schalen 0)
  nachdrueckReserve: 1,
  weichReserve: 1,
  ladungOffen: 0,
  rate: 1,
  kolliderRadius: 0,
  eigengewichtKg: MAGNET_EIGEN_KG,
  magnet: { radius: MAGNET_R, hoehe: MAGNET_H, unten: MAGNET_UNTEN },
  baue: baueMagnet,
};

/**
 * Drei Netze (E-025: Zeichenrufe sparen, Auftrag ≤ 3):
 *  1. Rotator, Gehaenge, Scheibe, Rippen, Warnring, Klemmkasten — EIN Netz mit
 *     Vertexfarben;
 *  2. das Kabel vom Klemmkasten zum Gelenk am Stiel;
 *  3. die Lampe „Magnet ein" auf dem Klemmkasten — eigener Stoff, damit sie
 *     leuchten kann.
 */
function baueMagnet(): Greiferbau {
  const gruppe = new THREE.Group();
  gruppe.name = "Lasthebemagnet";
  const SCHWARZ = 0x1f1f1f; // SW: schwarz lackiert wie die meisten Schrottmagnete
  const GRAU = 0x3a3a3a;
  const POL = 0x77746f; // blanke Polflaeche unten
  const GELB = 0xd9a300; // SW: gelber Warnring
  const teile: Bauteil[] = [];
  const zyl = (r: number, h: number, y: number, farbe: number, seg = 28): void => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    g.translate(0, y, 0);
    teile.push({ geo: g, farbe });
  };
  const kiste = (sx: number, sy: number, sz: number, x: number, y: number, z: number, farbe: number, dreh = 0): void => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    if (dreh) g.rotateY(dreh);
    teile.push({ geo: g, farbe });
  };
  // Rotator wie bei der Spinne (Palm-Kollider bei −0,75 m)
  zyl(0.24, 0.42, -0.75, GRAU, 20);
  // Gehaenge: drei Laschen bis auf die Scheibe
  for (let i = 0; i < 3; i++) kiste(0.1, 0.24, 0.06, 0, -1.055, 0.16, GRAU, (i / 3) * Math.PI * 2);
  const oben = -MAGNET_UNTEN + MAGNET_H;
  zyl(MAGNET_R, MAGNET_H - 0.04, oben - (MAGNET_H - 0.04) / 2, SCHWARZ);
  zyl(MAGNET_R - 0.03, 0.04, -MAGNET_UNTEN + 0.02, POL);
  zyl(MAGNET_R + 0.006, 0.08, oben - 0.12, GELB);
  // Kuehlrippen auf dem Deckel
  for (let i = 0; i < 8; i++) kiste(0.04, 0.1, MAGNET_R - 0.12, 0, oben + 0.05, (MAGNET_R + 0.12) / 2, SCHWARZ, (i / 8) * Math.PI * 2 + Math.PI / 8);
  // Klemmkasten, an dem das Kabel ankommt
  kiste(0.28, 0.16, 0.22, 0, oben + 0.08, 0.42, GRAU);
  const koerper = new THREE.Mesh(verschmelzeBunt(teile, "Lasthebemagnet"), farbstoff(0.6, 0.35));
  koerper.castShadow = true;
  koerper.receiveShadow = true;
  gruppe.add(koerper);

  // Kabel: vom Klemmkasten in einem Bogen hinauf zum Gelenk unter der Stielspitze
  const bahn = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, oben + 0.16, 0.48),
    new THREE.Vector3(0, oben + 0.35, 0.7),
    new THREE.Vector3(0, -0.6, 0.62),
    new THREE.Vector3(0, -0.12, 0.3),
  ]);
  const kabel = new THREE.Mesh(
    new THREE.TubeGeometry(bahn, 16, 0.035, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
  );
  kabel.castShadow = true;
  gruppe.add(kabel);

  // Lampe „Magnet ein": aus = dunkles Glas, ein = rot leuchtend
  const lampeStoff = new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.3, emissive: 0x000000 });
  const lampe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), lampeStoff);
  lampe.position.set(-0.07, oben + 0.21, 0.42);
  gruppe.add(lampe);

  let an = false;
  return {
    gruppe,
    setWinkel(): void {},
    nachfuehren(): void {},
    setAn(jetzt: boolean): void {
      if (jetzt === an) return;
      an = jetzt;
      lampeStoff.color.setHex(an ? 0xff3a1c : 0x3a1410);
      lampeStoff.emissive.setHex(an ? 0xff2a10 : 0x000000);
      lampeStoff.emissiveIntensity = an ? 2.5 : 0;
    },
  };
}

/**
 * Anteil Eisen und Stahl an einem Schrottteil (0..1) — aus der
 * Zusammensetzung, keine Sonderliste (Auftrag E-146).
 *
 * Reihenfolge: Presspaket (`composition`, kg) vor Stueckliste
 * (`shape.zusammensetzung`, Anteile) vor dem Material des Teils selbst.
 * Magnetisch ist nur `steel`: Edelstahl `va` ist austenitisch, `zinc` ist
 * echtes Zink (Zinkblech, Dachrinne, Anoden), `mixed` ohne Stueckliste sagt
 * nicht, woraus es ist. Verzinkter Stahl IST Stahl (Patrick, 17.10.2026:
 * „verzinkt ist kein buntmetall") und steht im Katalog als `steel` (Welt-
 * Agent, E-147) — hier braucht es dafuer keine Zeile.
 */
export function ferroAnteil(it: Pick<ScrapItem, "materialId" | "shape" | "composition">): number {
  if (it.composition && it.composition.length > 0) {
    let stahl = 0;
    let alle = 0;
    for (const c of it.composition) {
      alle += c.massKg;
      if (c.materialId === "steel") stahl += c.massKg;
    }
    return alle > 0 ? stahl / alle : 0;
  }
  const z = it.shape?.zusammensetzung;
  if (z && z.length > 0) {
    let stahl = 0;
    for (const a of z) if (a.materialId === "steel") stahl += a.anteil;
    return stahl;
  }
  return it.materialId === "steel" ? 1 : 0;
}

/**
 * Der Haken fuers Greifsystem: `grip.ferroAnteil = (b) => ferroAnteilVon(b, items, composites.cars)`.
 * Wracks sind keine Schrottteile und gelten als Stahl (Patrick: „Wracks: ja").
 */
export function ferroAnteilVon(
  body: RAPIER.RigidBody,
  items: { itemByBody(b: RAPIER.RigidBody): ScrapItem | undefined },
  wracks: ReadonlyArray<{ body: RAPIER.RigidBody }>
): number {
  const it = items.itemByBody(body);
  if (it) return ferroAnteil(it);
  return wracks.some((w) => w.body.handle === body.handle) ? 1 : 0;
}
