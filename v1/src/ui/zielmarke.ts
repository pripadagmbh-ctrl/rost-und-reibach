/**
 * DIE ZIELMARKE (E-162, 19.10.2026).
 *
 * Konzept: „eine Markierung am Ziel". Je Punkt aus `challenge:stand.marken`
 * schwebt ein nach unten zeigender Kegel ueber dem Punkt und liegt ein Ring
 * darauf: gelb ueber dem Teil, gruen ueber der Zielmulde (Farbe ist nicht der
 * einzige Kanal — der Kartentext nennt Teil und Mulde beim Namen).
 *
 * Sichtbar auch hinter einer Wand (`depthTest: false`, zuletzt gezeichnet):
 * Wer die Mulde nicht im Bild hat, soll trotzdem sehen, wohin.
 *
 * Sparsam: zwei Geometrien und zwei Materialien fuer alle Marken, einmal
 * angelegt. Je Marke zwei Netze (Kegel + Ring) = hoechstens zwei
 * Zeichenaufrufe; die Netze werden in einem Vorrat wiederverwendet, je Bild
 * wird nichts neu angelegt. Haengt nur am Bus.
 *
 * AUFTRAG 41 (22.10.2026, Pruefungen ohne Text): „DIESES Teil gehoert
 * DORTHIN" ohne Lesen.
 *  - Traegt eine Marke eine Sorte (`marken[].sorte`), sind Kegel und Ring in
 *    der Sortenfarbe (`SORTEN[s].farbe`, dieselbe wie Muldenschild und Bild) —
 *    am Teil wie an der Mulde. Ohne Sorte (Wrack, Presse, Kreis) bleibt es
 *    bei Gelb/Gruen.
 *  - Unter jedem Teil mit Sorte LEUCHTET der Boden in der Sortenfarbe: ein
 *    weicher Hof, der nach aussen ausblendet und ruhig atmet.
 *  - Von jedem Teil mit `nach` fuehrt ein GESTRICHELTER WEG am Boden zum
 *    Ziel, die Striche wandern langsam hin — der Weg zeigt die Richtung, das
 *    Bild am Schild sagt, was dort hingehoert (Farbe nie einziger Kanal).
 *  - Der Weg steht, solange das Teil liegt. Haengt es in der Spinne, meldet
 *    der Lauf keine Teil-Marke mehr, sondern die Ziel-Marke ueber der Mulde:
 *    Der Pfeil uebernimmt. Ein Weg vom pendelnden Teil wackelte jedes Bild
 *    mit, und am Boden unter der Last saehe man ihn ohnehin kaum.
 *  - Hof und Weg sind je EIN Netz fuer alle Teile (`InstancedMesh`, Farbe je
 *    Exemplar): zwei Zeichenaufrufe mehr, gleich wie viele Teile. Beide mit
 *    `depthTest` — sie liegen am Boden und verschwinden hinter Bagger und
 *    Muldenwand, statt durch sie hindurch zu schweben; nur der Pfeil ist
 *    hinter Waenden sichtbar (er sagt „dort", der Weg „hier entlang").
 */
import * as THREE from "three";
import type { EventBus } from "../core/events";
import { HAEKCHEN_PAUSE_S } from "../challenges/lektion";
import { SORTEN, type SorteId } from "../materials/sorten";

/** Hoehe der Kegelspitze ueber dem Punkt (m). SW: ueber einem Auto (1,5 m) noch frei sichtbar. */
const SCHWEBE_M = 2.2;
/** Wippen: Ausschlag (m) und Takt (Hz). SW: ruhig genug, dass es nicht nervoes wirkt. */
const WIPP_M = 0.18;
const WIPP_HZ = 0.9;
/** Ring knapp ueber dem Punkt (m), damit er nicht im Boden flimmert. SW */
const RING_UEBER_M = 0.08;

const FARBE = { teil: 0xf0c020, ziel: 0x4fd06a, erfolg: 0xc8ffd4 } as const; // SW: Gelb wie die Karte, Gruen wie ✓, Erfolg fast weiss-gruen
/** L4: so lange pulst die Marke beim Haekchen — die Pause, bis der naechste Schritt sie wegraeumt */
const ERFOLG_S = HAEKCHEN_PAUSE_S;
/** SW: Ring schwillt um die Haelfte an — aus 11 m Abstand deutlich, ohne Nachbarn zu verdecken */
const ERFOLG_WUCHS = 0.5;

/** Hof: innen und aussen (m). SW: aussen 1,2 m — breiter als der Kupfer-Boiler (1,2 m lang), schmaler als die offene Spinne (2,4 m) */
const HOF_INNEN_M = 0.3;
const HOF_AUSSEN_M = 1.2;
/** Deckkraft am inneren Rand, nach aussen auf 0. SW: kraeftig genug auf hellem Beton */
const HOF_DECKKRAFT = 0.85;
/** Atmen: Ausschlag der Groesse und Takt (Hz). SW: ruhig, langsamer als das Wippen des Pfeils */
const HOF_ATEM = 0.1;
const HOF_HZ = 0.5;
/** Strich des Wegs: Laenge, Breite, Abstand Anfang zu Anfang (m). SW: aus 11 m Kameraabstand als Strich lesbar */
const STRICH_LANG_M = 0.55;
const STRICH_BREIT_M = 0.22;
const STRICH_TAKT_M = 1.0;
/** So schnell wandern die Striche zum Ziel (m/s). SW: sichtbar, aber nicht hektisch */
const WEG_TEMPO_MS = 0.6;
/** Hoehe ueber dem Boden (y 0). SW: 4 cm — flimmert nicht im Beton, schwebt nicht sichtbar */
const BODEN_UEBER_M = 0.04;
/** Der Weg beginnt am Rand des Hofs, nicht unter dem Teil */
const WEG_AB_M = HOF_AUSSEN_M;
/**
 * Vorrat: so viele Hoefe und Striche hoechstens. SW: Pruefung 3 hat sechs
 * Teile, der laengste Weg (zur Stahlhalde hinten) ist rund 20 m — 6 × 20 = 120.
 */
const HOF_MAX = 16;
const STRICH_MAX = 256; // ponytail: laengere Wege werden am Ziel abgeschnitten — dann die Zahl erhoehen

export interface Zielmarke {
  /** Alle Marken weg (auch von aussen, z. B. vor einem Neuaufbau). */
  leeren(): void;
}

export function installZielmarke(scene: THREE.Scene, bus: EventBus): Zielmarke {
  // Kegel: Spitze nach unten (ConeGeometry zeigt nach +y). Masse SW: aus 10 m Abstand gut zu sehen.
  const kegelGeo = new THREE.ConeGeometry(0.32, 0.75, 16);
  kegelGeo.rotateX(Math.PI);
  kegelGeo.translate(0, 0.375, 0); // Ursprung = Spitze
  const ringGeo = new THREE.TorusGeometry(0.6, 0.06, 8, 40);
  ringGeo.rotateX(Math.PI / 2);
  const material = (farbe: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: farbe,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
  const mat = { teil: material(FARBE.teil), ziel: material(FARBE.ziel), erfolg: material(FARBE.erfolg) };
  mat.erfolg.opacity = 1;
  /** Je Sortenfarbe ein Material fuer Kegel und Ring, einmal angelegt (hoechstens fuenf Farben) */
  const sortenMat = new Map<number, THREE.MeshBasicMaterial>();
  const matFuer = (p: { art: "teil" | "ziel"; sorte?: SorteId | null }): THREE.MeshBasicMaterial => {
    if (!p.sorte) return mat[p.art];
    const f = SORTEN[p.sorte].farbe;
    let m = sortenMat.get(f);
    if (!m) sortenMat.set(f, (m = material(f)));
    return m;
  };

  // Hof: flacher Ring am Boden, Deckkraft je Ecke (innen HOF_DECKKRAFT, aussen 0), Farbe je Exemplar
  const hofGeo = new THREE.RingGeometry(HOF_INNEN_M, HOF_AUSSEN_M, 40, 1);
  hofGeo.rotateX(-Math.PI / 2);
  const hofPos = hofGeo.getAttribute("position");
  const hofRgba = new Float32Array(hofPos.count * 4);
  for (let i = 0; i < hofPos.count; i++) {
    const r = Math.hypot(hofPos.getX(i), hofPos.getZ(i));
    hofRgba.set([1, 1, 1, HOF_DECKKRAFT * (1 - (r - HOF_INNEN_M) / (HOF_AUSSEN_M - HOF_INNEN_M))], i * 4);
  }
  hofGeo.setAttribute("color", new THREE.BufferAttribute(hofRgba, 4));
  const bodenMaterial = (vertexColors: boolean, opacity: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      vertexColors,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      // SW: zieht es ein wenig vor den Boden, gegen Flimmern aus der Ferne
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: false,
    });
  const hof = new THREE.InstancedMesh(hofGeo, bodenMaterial(true, 1), HOF_MAX);
  // Weg: Striche, Laenge entlang +z, flach am Boden
  const strichGeo = new THREE.PlaneGeometry(STRICH_BREIT_M, STRICH_LANG_M);
  strichGeo.rotateX(-Math.PI / 2);
  const weg = new THREE.InstancedMesh(strichGeo, bodenMaterial(false, 0.9), STRICH_MAX); // SW: 0,9 wie der Pfeil
  const farbe = new THREE.Color();
  for (const n of [hof, weg]) {
    n.setColorAt(0, farbe.set(0xffffff)); // Farbpuffer gleich anlegen, nicht erst im ersten Bild
    n.count = 0;
    n.visible = false;
    n.frustumCulled = false;
    scene.add(n);
  }
  const mx = new THREE.Matrix4();
  const dreh = new THREE.Matrix4();
  const bodenAus = (): void => {
    hof.count = weg.count = 0;
    hof.visible = weg.visible = false;
  };

  const vorrat: Array<{ kegel: THREE.Mesh; ring: THREE.Mesh }> = [];
  const neueMarke = (): { kegel: THREE.Mesh; ring: THREE.Mesh } => {
    const kegel = new THREE.Mesh(kegelGeo, mat.teil);
    const ring = new THREE.Mesh(ringGeo, mat.teil);
    for (const n of [kegel, ring]) {
      n.renderOrder = 999; // nach allem anderen, damit sie ueber Waenden liegt
      n.frustumCulled = false;
      n.visible = false;
      n.matrixAutoUpdate = true;
      scene.add(n);
    }
    const m = { kegel, ring };
    vorrat.push(m);
    return m;
  };

  let sichtbar = 0;
  const leeren = (): void => {
    for (let i = 0; i < sichtbar; i++) {
      vorrat[i]!.kegel.visible = false;
      vorrat[i]!.ring.visible = false;
    }
    sichtbar = 0;
    bodenAus();
  };
  let aus = false;

  bus.on("challenge:start", () => {
    aus = false;
    leeren();
  });
  bus.on("challenge:stand", (e) => {
    if (aus) return;
    const t = performance.now() / 1000;
    const wipp = WIPP_M * Math.sin(2 * Math.PI * WIPP_HZ * t);
    const n = e.marken.length;
    const atem = 1 + HOF_ATEM * Math.sin(2 * Math.PI * HOF_HZ * t);
    const lauf = (t * WEG_TEMPO_MS) % STRICH_TAKT_M;
    let nHof = 0;
    let nStrich = 0;
    for (let i = 0; i < n; i++) {
      const p = e.marken[i]!;
      const mk = vorrat[i] ?? neueMarke();
      const m = matFuer(p);
      if (p.art === "teil") {
        const hex = p.sorte ? SORTEN[p.sorte].farbe : FARBE.teil;
        if (p.sorte && nHof < HOF_MAX) {
          mx.makeScale(atem, 1, atem).setPosition(p.x, BODEN_UEBER_M, p.z);
          hof.setMatrixAt(nHof, mx);
          hof.setColorAt(nHof++, farbe.setHex(hex));
        }
        if (p.nach) {
          const dx = p.nach.x - p.x;
          const dz = p.nach.z - p.z;
          const lang = Math.hypot(dx, dz);
          dreh.makeRotationY(Math.atan2(dx, dz));
          // Striche vom Hofrand bis zum Ziel; `lauf` schiebt sie jedes Bild ein Stueck weiter hin
          for (let s = WEG_AB_M + lauf; s + STRICH_LANG_M / 2 <= lang && nStrich < STRICH_MAX; s += STRICH_TAKT_M) {
            mx.copy(dreh).setPosition(p.x + (dx * s) / lang, BODEN_UEBER_M, p.z + (dz * s) / lang);
            weg.setMatrixAt(nStrich, mx);
            weg.setColorAt(nStrich++, farbe.setHex(hex));
          }
        }
      }
      if (mk.kegel.material !== m) {
        mk.kegel.material = m;
        mk.ring.material = m;
      }
      mk.kegel.position.set(p.x, p.y + SCHWEBE_M + wipp, p.z);
      mk.ring.position.set(p.x, p.y + RING_UEBER_M, p.z);
      mk.kegel.visible = true;
      mk.ring.visible = true;
    }
    for (let i = n; i < sichtbar; i++) {
      vorrat[i]!.kegel.visible = false;
      vorrat[i]!.ring.visible = false;
    }
    sichtbar = n;
    hof.count = nHof;
    weg.count = nStrich;
    hof.visible = nHof > 0;
    weg.visible = nStrich > 0;
    for (const b of [hof, weg]) {
      b.instanceMatrix.needsUpdate = true;
      b.instanceColor!.needsUpdate = true;
    }
  });
  bus.on("challenge:geschafft", () => {
    aus = true;
    leeren();
  });

  /*
   * E-196: Lektionen (z. B. Lektion 3 „Spinne über die Marke") senden ihre
   * Bodenmarke mit dem Schritt. Eine grüne Marke, der Ring so gross wie der
   * Zielkreis; ohne Marke oder nach der Lektion weg.
   */
  bus.on("lehrgang:schritt", (e) => {
    leeren();
    if (!e.marke) return;
    const mk = vorrat[0] ?? neueMarke();
    mk.kegel.material = mat.ziel;
    mk.ring.material = mat.ziel;
    mk.kegel.position.set(e.marke.x, e.marke.y + SCHWEBE_M, e.marke.z);
    mk.ring.position.set(e.marke.x, e.marke.y + RING_UEBER_M, e.marke.z);
    mk.ring.scale.setScalar(e.marke.radiusM / 0.6); // 0,6 m = Ring-Halbmesser oben
    mk.kegel.visible = true;
    mk.ring.visible = true;
    sichtbar = 1;
  });
  bus.on("lehrgang:geschafft", leeren);

  /*
   * L4 (Patrick: „sollte irgendwie gehighlighten sein, wenn eine aktion
   * erfolgreich war"): Beim Haekchen leuchtet die Marke hell auf und der Ring
   * schwillt einmal an und ab — `ERFOLG_S` lang, so lang wie die
   * Haekchen-Pause des Laufs, danach raeumt der naechste Schritt sie weg.
   */
  let puls = 0;
  bus.on("lehrgang:haekchen", () => {
    const mk = vorrat[0];
    if (sichtbar !== 1 || !mk || mk.ring.material !== mat.ziel) return;
    mk.kegel.material = mat.erfolg;
    mk.ring.material = mat.erfolg;
    const basis = mk.ring.scale.x;
    const t0 = performance.now();
    const lauf = ++puls;
    const schritt = (): void => {
      const k = (performance.now() - t0) / 1000 / ERFOLG_S;
      if (lauf !== puls || !mk.ring.visible) return;
      mk.ring.scale.setScalar(basis * (1 + ERFOLG_WUCHS * Math.sin(Math.PI * Math.min(1, k))));
      if (k < 1) requestAnimationFrame(schritt);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(schritt);
  });
  bus.on("lehrgang:schritt", () => {
    puls++; // ein laufender Puls hoert auf
  });

  return { leeren };
}
