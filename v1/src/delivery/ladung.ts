/**
 * Wie eine Fuhre auf der Ladefläche liegt (Wunsch 11.09.2026).
 *
 * Vorher wurde jedes Stück auf einen zufälligen freien Platz gewürfelt, und
 * was keinen fand, kam auf einen Stapel in der Mitte — daher die Türme, die
 * weit über die Bordwand ragten. Ein beladener LKW sieht anders aus: Die
 * Ladung folgt dem Kasten, liegt dicht und endet knapp über der Bordwand.
 *
 * Gepackt wird deshalb wie in einer Kiste: Die Fläche ist ein Raster, jede
 * Spalte merkt sich ihre Füllhöhe, und jedes Stück kommt an die tiefste
 * Stelle, an der es noch unter die Höhengrenze passt. Was nicht mehr passt,
 * bleibt liegen — sein Gewicht verteilt der Aufrufer auf die übrigen Stücke,
 * damit die Fuhre trotzdem ihre Tonnage hat.
 *
 * ---------------------------------------------------------------------------
 * EIN STÜCK IST EIN RECHTECK, KEIN QUADRAT (17.09.2026, E-105)
 *
 * Bis dahin hat jedes Stück ein QUADRAT belegt, dessen Seite die halbe
 * GRUNDRISS-DIAGONALE mal zwei war — also die Diagonale selbst. Begründung im
 * alten Kommentar: „damit passt das Stück in jeder Drehung". Nur wird es gar
 * nicht gedreht: `vehicles.loadCargo` setzt es mit der Drehung der Ladefläche
 * ab, die Kanten liegen also längs und quer, nicht schräg.
 *
 * Die Folge war teuer. Ein Blech von 1,90 m × 1,50 m belegte ein Quadrat von
 * 2,42 m Kante. Die Ladefläche eines Lkw ist innen 2,54 m breit — das passte
 * gerade noch. Ein Mähdrescher-Schneidwerk von 4,60 m × 1,30 m belegte 4,78 m
 * im Quadrat und passte NIE, obwohl es der Länge nach mühelos auf jede
 * Pritsche geht. Gemessen mit `tools/grossteile.ts` über 96 Saaten: Von 64
 * Schwergewichten konnten 60 auf keiner Ladefläche des Spiels liegen; von 365
 * gezogenen Schwergewichten kamen 7 an (1,9 %).
 *
 * Jetzt belegt ein Stück sein wirkliches Rechteck — und darf sich dabei einmal
 * um 90° drehen, so wie ein Lader ein langes Teil längs auf den Wagen legt und
 * nicht quer. Beides zusammen ist keine neue Freiheit, sondern die Abbildung
 * dessen, was der Kollider ohnehin ist: ein achsparalleler Quader.
 */

/** Rasterweite der Höhenkarte (m) — fein genug für Kleinteile. */
const RASTER = 0.2;

/**
 * LUFT ZWISCHEN ZWEI STÜCKEN (E-105).
 *
 * Solange jedes Stück ein Quadrat seiner Grundriss-Diagonale belegte, lag um
 * jedes Teil von selbst viel Platz — ein Blech von 1,90 m × 1,50 m bekam ein
 * Feld von 2,42 m Kante, also einen halben Meter Luft. Mit dem wirklichen
 * Rechteck liegt die Fuhre plötzlich auf Kante, und beim Setzen überschneiden
 * sich Kollider um Rundungsreste. Rapier drückt sie mit einem Stoß auseinander
 * — genau der „Katapult", den E-071 schon einmal beseitigt hat.
 *
 * GEMESSEN mit `tools/kipp-luft.ts` — dieselbe Reihe wie `test/kipper.test.ts`,
 * 24 Saaten, gewürfelte Händlerfuhre. Tempo der Ladung in km/h, dazu der
 * Anteil, der am Ende noch auf der gekippten Brücke liegt:
 *
 *                       Mittel  Median  Höchst   liegt noch   Stücke/Fuhre
 *   vor E-105              29      19     106       31 %          10,5
 *   Rechteck, 0,00 m       84      82     250       —             20,2
 *   Rechteck, 0,06 m       31      17     150       45 %          10,5
 *   Rechteck, 0,12 m       22      18      75       43 %           9,9   ← genommen
 *   Rechteck, 0,18 m       36      17     371       42 %           9,8
 *   Schranke des Wächters  55      40     200       45 %
 *
 * WIE DIESE TABELLE ZU LESEN IST: Der MEDIAN liegt bei 17 bis 18 km/h,
 * gleichgültig wieviel Luft — er ist die belastbare Zahl. Mittel und Höchst
 * hängen an je einem Ausreißer (bei 0,18 m ein einziger Wurf mit 371), denn
 * der Kipper ist eine chaotische Größe; das sagt der Wächter selbst. 0,12 m
 * ist deshalb nicht der „beste Messwert", sondern der mittlere Wert, bei dem
 * alle vier Schranken mit Abstand halten.
 *
 * WAS OFFEN BLEIBT: „Liegt am Ende noch auf der Brücke" ist von 31 % auf 43 %
 * gestiegen und damit dicht an der Schranke von 45 %. Grund ist nicht die
 * Luft, sondern die dichte Lage: Wo vorher jedes Stück auf einem eigenen
 * Plateau saß und beim Kippen herunterkollerte, liegt die Fuhre jetzt als
 * flache Schicht, und Schrott hat Reibung 2,2 gegen tan 58° = 1,60 — eine
 * ruhende Lage rutscht rechnerisch gar nicht. Steilerer Kippwinkel oder
 * weniger Reibung ist ein eigenes Paket (`docs/offene-punkte.md`).
 */
export const LUFT = 0.12;

export interface LadeStueck {
  /** Kantenlänge quer zur Fahrtrichtung (m), ungedreht */
  breite: number;
  /** Kantenlänge in Fahrtrichtung (m), ungedreht */
  laenge: number;
  /** Bauhöhe (m) */
  hoehe: number;
}

export interface LadePlatz {
  /** quer zur Fahrtrichtung, 0 = Mitte */
  x: number;
  /** Höhe der Unterkante über dem Flächenboden */
  y: number;
  /** in Fahrtrichtung, 0 = vorderes Ende der Fläche */
  z: number;
  /**
   * Liegt das Stück um 90° um die Hochachse gedreht?
   *
   * Der Aufrufer muss diese Drehung beim Absetzen mitgeben, sonst steht das
   * Modell quer zu dem Platz, der dafür freigeräumt wurde.
   */
  quer: boolean;
}

/**
 * Plätze für eine Ladung suchen. Reihenfolge bleibt erhalten: `plaetze[i]`
 * gehört zu `stuecke[i]`, `null` heißt "passt nicht mehr".
 *
 * @param halbBreite halbe Innenbreite der Fläche
 * @param laenge nutzbare Länge der Fläche
 * @param maxHoehe Oberkante der Ladung über dem Flächenboden
 */
export function packeLadung(
  stuecke: LadeStueck[],
  halbBreite: number,
  laenge: number,
  maxHoehe: number
): Array<LadePlatz | null> {
  const nx = Math.max(1, Math.floor((halbBreite * 2) / RASTER));
  const nz = Math.max(1, Math.floor(laenge / RASTER));
  const hoehen = new Float64Array(nx * nz);
  const plaetze: Array<LadePlatz | null> = [];

  // Große Stücke zuerst: Sie brauchen den freien Boden, Kleinkram füllt
  // hinterher die Lücken. Die Ausgabereihenfolge bleibt davon unberührt.
  const raum = (s: LadeStueck): number => s.breite * s.laenge * s.hoehe;
  const reihenfolge = stuecke
    .map((s, i) => ({ s, i }))
    .sort((a, b) => raum(b.s) - raum(a.s));

  for (const { s, i } of reihenfolge) {
    let bestIx = -1;
    let bestIz = -1;
    let bestFx = 0;
    let bestFz = 0;
    let bestQuer = false;
    let bestH = Infinity;
    /*
     * Beide Lagen durchprobieren: längs (Breite quer zum Wagen) und quer
     * gedreht (Länge quer zum Wagen). Ein Rohr von 2,60 m passt längs auf
     * jede Pritsche und quer auf keine — vorher fiel es durch, weil nur die
     * eine Lage gedacht war.
     */
    const fxLaengs = Math.max(1, Math.ceil((s.breite + LUFT) / RASTER));
    const fzLaengs = Math.max(1, Math.ceil((s.laenge + LUFT) / RASTER));
    // Ein quadratischer Grundriss sieht gedreht genauso aus — einmal reicht.
    const lagen = fxLaengs === fzLaengs ? [false] : [false, true];
    for (const quer of lagen) {
      const fx = quer ? fzLaengs : fxLaengs;
      const fz = quer ? fxLaengs : fzLaengs;
      if (fx > nx || fz > nz) continue;
      for (let iz = 0; iz + fz <= nz; iz++) {
        for (let ix = 0; ix + fx <= nx; ix++) {
          let h = 0;
          for (let b = 0; b < fz && h < bestH; b++) {
            for (let a = 0; a < fx; a++) {
              const v = hoehen[(iz + b) * nx + ix + a];
              if (v > h) h = v;
            }
          }
          if (h + s.hoehe > maxHoehe) continue;
          if (h < bestH) {
            bestH = h;
            bestIx = ix;
            bestIz = iz;
            bestFx = fx;
            bestFz = fz;
            bestQuer = quer;
          }
        }
      }
    }
    if (bestIx < 0) {
      plaetze[i] = null;
      continue;
    }
    // Spalten unter dem Stück auf die neue Oberkante heben, plus Luft — sonst
    // liegt das nächste Stück mit null Abstand darauf.
    const oben = bestH + s.hoehe + LUFT;
    for (let b = 0; b < bestFz; b++) {
      for (let a = 0; a < bestFx; a++) hoehen[(bestIz + b) * nx + bestIx + a] = oben;
    }
    plaetze[i] = {
      x: -halbBreite + (bestIx + bestFx / 2) * RASTER,
      y: bestH,
      z: (bestIz + bestFz / 2) * RASTER,
      quer: bestQuer,
    };
  }
  return plaetze;
}

/**
 * Höchste Oberkante einer fertig gepackten Ladung — zum Nachrechnen, ob die
 * Fuhre so vom Hof fahren darf.
 */
export function ladeHoehe(
  stuecke: LadeStueck[],
  plaetze: Array<LadePlatz | null>
): number {
  let max = 0;
  plaetze.forEach((p, i) => {
    if (!p) return;
    const oben = p.y + stuecke[i].hoehe;
    if (oben > max) max = oben;
  });
  return max;
}

/**
 * Grundriss und Bauhöhe eines Schrottteils, so wie es auf der Fläche liegt.
 *
 * Die Maße sind DIE DES KOLLIDERS, nicht eine Näherung davon — nachgeschlagen
 * in `world/scrapItems.spawnScrap`. Wer dort eine Form anders baut, muss hier
 * nachziehen, sonst räumt der Packer einen Platz frei, in den das Teil nicht
 * passt (oder umgekehrt):
 *
 *   box          `cuboid(w/2, h/2, d/2)` bei dims [w, h, d]
 *   cyl, lang    `cuboid(r, r, len/2)` — liegendes Rohr, Achse in Fahrtrichtung
 *   cyl, kurz    `achtkant(r, len/2)` — Scheibe auf der Fläche, Achse steht
 *   torus        `achtkant(r + tube, tube)` — Ring flach
 *   wire         verbeulte Kugel vom Radius r, als Bund platt gedrückt
 */
export function stueckMass(kind: string, dims: number[]): LadeStueck {
  switch (kind) {
    case "box":
      return { breite: dims[0], laenge: dims[2], hoehe: dims[1] };
    case "cyl": {
      const [r, len] = dims;
      /*
       * Die Grenze `len > r * 2.5` ist dieselbe wie in `spawnScrap`: darüber
       * ein liegendes Rohr, darunter eine Scheibe, die auf ihrer flachen
       * Seite steht. Bis zum 17.09.2026 galt hier für BEIDE die Rohr-Regel —
       * eine Felge (r 0,32, len 0,22) wurde als 0,64 m hoch gerechnet statt
       * als 0,22 m und deshalb 21 cm über der Fläche abgesetzt.
       */
      return len > r * 2.5
        ? { breite: r * 2, laenge: len, hoehe: r * 2 }
        : { breite: r * 2, laenge: r * 2, hoehe: len };
    }
    case "torus":
      return { breite: (dims[0] + dims[1]) * 2, laenge: (dims[0] + dims[1]) * 2, hoehe: dims[1] * 2 };
    default:
      // Draht und Kabel liegen als Bund flach
      return { breite: dims[0] * 2, laenge: dims[0] * 2, hoehe: Math.max(0.18, dims[0] * 0.7) };
  }
}

/**
 * DAS RECHENVOLUMEN EINES STÜCKS — absichtlich die alte Rechnung.
 *
 * Zwei Stellen in `vehicles.loadCargo` brauchen ein „wie groß ist das":
 *
 *   FÜLLGRAD  Wie voll ist der Wagen? Summe der Stückvolumen durch Laderaum.
 *             Daran hängt, wieviele Runden nachgeladen werden.
 *   DECKEL    Was darf ein Stück höchstens wiegen? Volumen × 2600 kg/m³ × 0,55.
 *
 * Beide holten sich das Volumen bis E-105 aus demselben `stueckMass` wie der
 * Packplatz — also aus dem Quadrat der Grundriss-Diagonale. Seit E-105 belegt
 * ein Stück beim Packen sein WIRKLICHES Rechteck. Hier gilt weiter die alte
 * Rechnung, und zwar aus zwei getrennten Gründen:
 *
 * 1. STÜCKZAHL UND PHYSIK-BUDGET. Mit dem echten Volumen ist eine Fuhre erst
 *    bei doppelt so vielen Teilen „voll". Gemessen (`tools/grossteile.ts`,
 *    96 Saaten × 10 Fuhren): 11,0 Stücke je Fuhre vorher, 20,2 nachher. Jedes
 *    Stück ist ein eigener Körper. `test/kipper.test.ts` ist daran prompt rot
 *    geworden — 66/27/232 km/h gegen die Schranke 55/40/200 —, weil der
 *    abfahrende Lkw durch einen doppelt so großen Haufen fährt.
 * 2. WIRTSCHAFT. Der Deckel entscheidet mit, was eine Fuhre wiegt. Gemessen
 *    (96 Saaten × 10 Fuhren, alles richtig sortiert, Preise aus
 *    `materials/catalog.ts`):
 *
 *      Stand 17.09. vormittags                41 470 EUR/Tag
 *      nur Packen berichtigt                  37 151 EUR/Tag   −10,4 %
 *      zusätzlich das echte Volumen           29 724 EUR/Tag   −28,3 %
 *
 *    Die weiteren 18 % wären eine reine WIRTSCHAFTSÄNDERUNG. Sie hängen daran,
 *    dass ein kleines Buntmetallteil heute weit mehr wiegen darf, als es von
 *    der Dichte her könnte — ein Kupferbund von 0,28 m Durchmesser durfte
 *    380 kg wiegen, massives Kupfer dieser Größe wären 54 kg.
 *
 * Beides sind Befunde, keine Entscheidungen. Ob Fuhren voller und Buntmetall
 * leichter werden soll, entscheidet Patrick, nicht diese Zeile. Deshalb steht
 * die alte Rechnung jetzt sichtbar an EINER Stelle statt versteckt in
 * `stueckMass` — wer sie ändern will, findet hier, was es kostet.
 */
export function deckelVolumen(kind: string, dims: number[]): number {
  let r: number;
  let hoehe: number;
  switch (kind) {
    case "box":
      r = Math.hypot(dims[0], dims[2]) / 2;
      hoehe = dims[1];
      break;
    case "cyl":
      r = Math.max(dims[0], dims[1] / 2);
      hoehe = dims[0] * 2;
      break;
    case "torus":
      r = dims[0] + dims[1];
      hoehe = dims[1] * 2;
      break;
    default:
      r = dims[0];
      hoehe = Math.max(0.18, dims[0] * 0.7);
  }
  return Math.pow(r * 2, 2) * hoehe;
}
