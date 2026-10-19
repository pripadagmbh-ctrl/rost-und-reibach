/**
 * KOMMEN DIE GROSSTEILE AN? — die Nullprobe zu Patricks Frage vom 17.09.2026
 * („und was ist eigentlich mit den grossen objekten passiert?").
 *
 * Gemessen wird an zwei Stellen, weil zwei verschiedene Fragen dahinterstehen:
 *
 *  1. PASSFORM (rechnerisch, ohne Zufall). Kann ein Katalogeintrag auf
 *     IRGENDEINE Ladefläche des Spiels — und wenn nicht, woran scheitert er?
 *     Das ist eine reine Geometriefrage und braucht keine Saat.
 *  2. DURCHLAUF (gewürfelt, über viele Saaten). Wie viele Stücke zieht
 *     `randomCargo` je Liste, und wie viele davon legt `packeLadung` wieder
 *     weg? Das ist die eigentliche Frage: gezogen ist nicht angekommen.
 *
 * Die Ladeschleife ist hier NACHGEBAUT, nicht aufgerufen — `loadCargo` hängt
 * an Rapier, Szene und Fahrzeugmodell. Sie folgt `vehicles.ts` Zeile für
 * Zeile; wer dort etwas ändert, muss hier nachziehen. Der Wächter
 * `test/grossteile.test.ts` prüft die Passform gegen dieselben Konstanten,
 * damit die Aussage nicht allein an diesem Nachbau hängt.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/grossteile.ts
 *     npx vite-node tools/grossteile.ts 96      (Zahl der Saaten)
 */
import { SPECS, BIG_SPECS, HUGE_SPECS, randomCargo } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";
import { packeLadung, stueckMass, deckelVolumen } from "../src/delivery/ladung";
import { BED_HALF_W, bedLenFor } from "../src/delivery/routes";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  LADE_RAND,
  ladeHoeheGrenze,
  type Aufbau,
} from "../src/delivery/fuellgrad";
import { wandHoehe } from "../src/delivery/vehicleModel";
import {
  rollAnlieferung,
  EINZELSTUECK_FLAECHE,
  type CustomerProfile,
} from "../src/delivery/customers";
import { getMaterial } from "../src/materials/catalog";
import { PURCHASE_PRICE_PER_KG, SORTING_BONUS_PER_KG } from "../src/economy/account";

/** Rasterweite von `ladung.RASTER` — dort nicht exportiert, hier gespiegelt. */
const RASTER = 0.2;

/** Fester Zufall, wie in `test/fuhreAmWagen.test.ts`: eine Messung ohne Saat ist keine. */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

export interface Flaeche {
  name: string;
  halbBreite: number;
  nutzLaenge: number;
  maxHoehe: number;
}

/**
 * Die Ladefläche eines Fahrzeugs, gerechnet wie in `vehicles.loadCargo`.
 * Eine Stelle, damit Werkzeug und Wächter dieselben Maße sehen.
 */
export function flaecheFuer(kind: string, aufbau: Aufbau): Flaeche {
  const anhaenger = kind === "pkw";
  return {
    name: `${kind}/${aufbau}`,
    halbBreite: anhaenger ? ANHAENGER_HALB_BREITE : BED_HALF_W - 0.08,
    nutzLaenge: bedLenFor(kind) - 2 * LADE_RAND,
    maxHoehe: ladeHoeheGrenze(anhaenger ? ANHAENGER_WAND : wandHoehe(kind, aufbau)),
  };
}

/** Alle Flächen, auf denen im Spiel wirklich angeliefert wird. */
export const LIEFERFLAECHEN: Flaeche[] = [
  flaecheFuer("pkw", "flach"),
  flaecheFuer("wrack", "flach"),
  flaecheFuer("pritsche", "flach"),
  flaecheFuer("pritsche", "rungen"),
  flaecheFuer("pritsche", "koffer"),
  flaecheFuer("kipper", "flach"),
  flaecheFuer("kipper", "rungen"),
  flaecheFuer("kipper", "koffer"),
];

/**
 * E-126: die flache Pritsche mit EINEM Stueck, erhoehte Hoehengrenze. Steht
 * absichtlich NICHT in `LIEFERFLAECHEN`: Darauf kommen nur Teile aus
 * `customers.EINZELSTUECKE`, nicht alles, was allein darauf passen wuerde.
 */
const EINZEL_FLAECHE: Flaeche = { name: "pritsche/einzeln", ...EINZELSTUECK_FLAECHE };

/**
 * Grundriss eines Stücks, so wie `packeLadung` ihn belegt.
 *
 * Das Werkzeug muss VOR und NACH der Änderung laufen — sonst gibt es kein
 * Vorher/Nachher. Vorher hatte `LadeStueck` nur `r` (halbe Diagonale) und die
 * Fläche belegte ein QUADRAT dieser Diagonale; nachher nennt es Breite und
 * Länge getrennt. Diese eine Stelle liest beides.
 */
function grundriss(t: ReturnType<typeof stueckMass>): { breite: number; laenge: number } {
  const tt = t as unknown as { r?: number; breite?: number; laenge?: number };
  if (tt.breite !== undefined && tt.laenge !== undefined) {
    return { breite: tt.breite, laenge: tt.laenge };
  }
  const seite = (tt.r ?? 0) * 2;
  return { breite: seite, laenge: seite };
}

/** Grundfläche für den Dichte-Deckel aus `loadCargo`. */
function huellGrund(t: ReturnType<typeof stueckMass>): number {
  const g = grundriss(t);
  return g.breite * g.laenge;
}

/**
 * Mit `--engerdeckel` rechnet das Werkzeug den Dichte-Deckel aus dem
 * WIRKLICHEN Hüllvolumen (Breite × Länge × Höhe) statt aus dem Quadrat der
 * Grundriss-Diagonale, mit dem `ladung.deckelVolumen` weiter arbeitet. So ist
 * die offene Frage zu beziffern, ohne sie zu entscheiden.
 */
const ENGER_DECKEL = process.argv.includes("--engerdeckel");

export type Hindernis = "passt" | "breite" | "laenge" | "hoehe";

/**
 * Passt dieses Stück auf diese Fläche — und wenn nicht, woran liegt es?
 *
 * Gerechnet genau wie `packeLadung`: Der Grundriss wird auf ganze Rasterfelder
 * aufgerundet und in beiden Lagen probiert (längs und um 90° gedreht).
 *
 * Achtung beim Lesen der Zahlen: Das Raster von 0,20 m frisst Breite. Eine
 * Innenbreite von 2,54 m ergibt 12 Felder, also 2,40 m nutzbar — ein Stück von
 * 2,50 m gilt deshalb als „zu breit", obwohl es rechnerisch zwischen die
 * Bordwände ginge.
 */
export function hindernis(sp: PileSpec, f: Flaeche): Hindernis {
  const t = stueckMass(sp.kind, sp.dims);
  const g = grundriss(t);
  const nx = Math.max(1, Math.floor((f.halbBreite * 2) / RASTER));
  const nz = Math.max(1, Math.floor(f.nutzLaenge / RASTER));
  const a = Math.max(1, Math.ceil(g.breite / RASTER));
  const b = Math.max(1, Math.ceil(g.laenge / RASTER));
  // Beide Lagen, genau wie `packeLadung` seit E-105.
  const passtGrundriss = (a <= nx && b <= nz) || (b <= nx && a <= nz);
  if (!passtGrundriss) return Math.min(a, b) > nx ? "breite" : "laenge";
  if (t.hoehe > f.maxHoehe) return "hoehe";
  return "passt";
}

/** Findet die Fläche, auf der das Stück am ehesten liegt. */
export function passtIrgendwo(sp: PileSpec): { ok: boolean; grund: Hindernis; auf: string } {
  let besterGrund: Hindernis = "breite";
  for (const f of LIEFERFLAECHEN) {
    const h = hindernis(sp, f);
    if (h === "passt") return { ok: true, grund: "passt", auf: f.name };
    // „Breite" ist das härteste Hindernis: Sie ist bei jedem Wagen fast
    // gleich. Höhe lässt sich mit einem anderen Aufbau lösen.
    if (h === "hoehe") besterGrund = "hoehe";
    else if (h === "laenge" && besterGrund !== "hoehe") besterGrund = "laenge";
  }
  return { ok: false, grund: besterGrund, auf: "—" };
}

/* ---------------------------------------------------------------------- */
/* Teil 2 — der Durchlauf                                                  */
/* ---------------------------------------------------------------------- */

const LISTEN: Array<{ kurz: string; liste: PileSpec[] }> = [
  { kurz: "SPECS", liste: SPECS },
  { kurz: "BIG", liste: BIG_SPECS },
  { kurz: "HUGE", liste: HUGE_SPECS },
];

/** Name + Maße als Schlüssel — „VA-Behälter" steht in SPECS UND in HUGE. */
function schluessel(name: string | undefined, dims: number[]): string {
  return `${name ?? "?"}|${dims.join(",")}`;
}

const HERKUNFT = new Map<string, string>();
for (const { kurz, liste } of LISTEN) {
  for (const sp of liste) HERKUNFT.set(schluessel(sp.name, sp.dims), kurz);
}

export interface FuhrenErgebnis {
  kind: string;
  gruppe: string;
  schwer: boolean;
  gezogen: Record<string, number>;
  gelegt: Record<string, number>;
  namenGelegt: string[];
  namenWeg: string[];
  /** Was am Ende wirklich auf der Fläche liegt, Fraktion und Kilogramm. */
  fracht: Array<{ materialId: string; massKg: number }>;
  /** Wieviel der Kunde angekündigt hatte, bevor die Fläche es gekappt hat. */
  angekuendigtKg: number;
}

/**
 * Eine Fuhre packen — Nachbau von `vehicles.loadCargo`, ohne Physik.
 * Zählt für jedes gezogene Stück, aus welcher Liste es kam und ob es am Ende
 * auf der Fläche liegt.
 */
export function packeFuhre(c: CustomerProfile): FuhrenErgebnis {
  /*
   * Die Einzelstueck-Fuhre (E-126), wie `loadCargo`: ein Teil, keine Runde,
   * kein Umlegen — es liegt, und es wiegt, was es wiegt. Es kommt nur aus
   * `EINZELSTUECKE`, und die passen alle (Waechter `test/einzelstueck.test.ts`).
   */
  if (c.einzelstueck) {
    const sp = c.einzelstueck;
    const h = HERKUNFT.get(schluessel(sp.name, sp.dims)) ?? "SPECS";
    return {
      kind: c.vehicle,
      gruppe: "einzelstueck",
      schwer: false,
      gezogen: { SPECS: 0, BIG: 0, HUGE: 0, [h]: 1 },
      gelegt: { SPECS: 0, BIG: 0, HUGE: 0, [h]: 1 },
      namenGelegt: [sp.name ?? "?"],
      namenWeg: [],
      fracht: [{ materialId: sp.materialId, massKg: sp.massKg }],
      angekuendigtKg: c.massKg,
    };
  }
  const klein = c.group === "privat";
  const schwer = !klein && !c.sortedMaterial && Math.random() < 0.28;
  const MINDEST_FUELLUNG = 0.3;
  const zielFuellung = Math.min(1, c.fuellgrad);
  const mindestFuellung = Math.min(MINDEST_FUELLUNG, zielFuellung);
  const f = flaecheFuer(c.vehicle, c.aufbau);
  const raum = f.halbBreite * 2 * f.nutzLaenge * f.maxHoehe;

  const gezogen: Record<string, number> = { SPECS: 0, BIG: 0, HUGE: 0 };
  const gelegt: Record<string, number> = { SPECS: 0, BIG: 0, HUGE: 0 };

  type Spec = ReturnType<typeof randomCargo>[number];
  let specs: Spec[] = [];
  let plaetze: Array<ReturnType<typeof packeLadung>[number]> = [];
  let fuellung = 0;
  let leerlauf = 0;
  for (let runde = 0; runde < 12 && fuellung < zielFuellung; runde++) {
    const erste = runde === 0;
    const brocken = Math.max(2, Math.round((klein ? 4 : 8) * zielFuellung));
    const nachschub = randomCargo(
      erste ? brocken : Math.max(2, Math.round(6 * zielFuellung)),
      erste ? 0.5 : 0.08,
      erste && schwer ? 0.55 : 0,
      c.sortedMaterial ?? undefined
    );
    for (const sp of nachschub) {
      const h = HERKUNFT.get(schluessel(sp.shape.name, sp.shape.dims)) ?? "SPECS";
      gezogen[h] = (gezogen[h] ?? 0) + 1;
    }
    // Einzeln auflegen und nichts nehmen, was ueber die Bestellung hebt (E-105)
    const anteil = (sp: (typeof nachschub)[number]): number =>
      raum > 0 ? deckelVolumen(sp.shape.kind, sp.shape.dims) / raum : 0;
    const kandidaten = [...specs];
    let steht = fuellung;
    for (const sp of nachschub) {
      if (steht > 0 && steht + anteil(sp) > zielFuellung) continue;
      kandidaten.push(sp);
      const probe = packeLadung(
        kandidaten.map((k) => stueckMass(k.shape.kind, k.shape.dims)),
        f.halbBreite,
        f.nutzLaenge,
        f.maxHoehe
      );
      steht =
        raum > 0
          ? kandidaten.reduce(
              (a, k, i) => a + (probe[i] ? deckelVolumen(k.shape.kind, k.shape.dims) : 0),
              0
            ) / raum
          : 0;
    }
    if (erste && kandidaten.length === specs.length && nachschub.length > 0) {
      kandidaten.push(
        nachschub.reduce((a, b) => (anteil(b) < anteil(a) ? b : a), nachschub[0]!)
      );
    }
    const st = kandidaten.map((sp) => stueckMass(sp.shape.kind, sp.shape.dims));
    const pl = packeLadung(st, f.halbBreite, f.nutzLaenge, f.maxHoehe);
    const liegen = pl.filter(Boolean).length;
    if (liegen > 28 && !erste) break;
    const belegt = kandidaten.reduce(
      (a, sp, i) => a + (pl[i] ? deckelVolumen(sp.shape.kind, sp.shape.dims) : 0),
      0
    );
    const neueFuellung = raum > 0 ? belegt / raum : 0;
    const dazu = neueFuellung - fuellung;
    specs = kandidaten;
    plaetze = pl;
    fuellung = neueFuellung;
    if (!erste && dazu < 0.01) {
      leerlauf++;
      if (leerlauf >= 2 && fuellung >= mindestFuellung) break;
      if (leerlauf >= 5) break;
    } else {
      leerlauf = 0;
    }
  }

  /*
   * Die Gewichtsverteilung von `loadCargo`, ebenfalls nachgebaut — ohne sie
   * wäre die Tagesbilanz unten die Summe der KATALOG-Gewichte und nicht die
   * der Waage. Der Dichte-Deckel hängt am Hüllvolumen des Stücks; wer die
   * Grundfläche ändert, ändert ihn mit. Genau deshalb steht er hier.
   */
  const stuecke = specs.map((sp) => stueckMass(sp.shape.kind, sp.shape.dims));
  const DICHTE_MAX = 2600;
  const grenze = (i: number): number =>
    DICHTE_MAX *
    0.55 *
    (ENGER_DECKEL
      ? huellGrund(stuecke[i]!) * stuecke[i]!.hoehe
      : deckelVolumen(specs[i]!.shape.kind, specs[i]!.shape.dims));
  const draufIdx = specs.map((_, i) => i).filter((i) => plaetze[i]);
  const summeDrauf = draufIdx.reduce((a, i) => a + specs[i]!.massKg, 0);
  const gewicht = new Map<number, number>();
  for (const i of draufIdx) gewicht.set(i, specs[i]!.massKg);
  const angekuendigtKg = c.massKg;
  if (summeDrauf > 0) {
    for (const i of draufIdx) gewicht.set(i, 0);
    let rest = c.massKg;
    for (let runde = 0; runde < 4 && rest > 1; runde++) {
      const offen = draufIdx.filter((i) => gewicht.get(i)! < grenze(i) - 1);
      if (offen.length === 0) break;
      const basis = offen.reduce((a, i) => a + specs[i]!.massKg, 0) || 1;
      const zuVerteilen = rest;
      rest = 0;
      for (const i of offen) {
        const anteil = (specs[i]!.massKg / basis) * zuVerteilen;
        const roh = gewicht.get(i)! + anteil;
        const neu = Math.min(roh, grenze(i));
        gewicht.set(i, neu);
        rest += roh - neu;
      }
    }
  }

  const namenGelegt: string[] = [];
  const namenWeg: string[] = [];
  const fracht: Array<{ materialId: string; massKg: number }> = [];
  specs.forEach((sp, i) => {
    const h = HERKUNFT.get(schluessel(sp.shape.name, sp.shape.dims)) ?? "SPECS";
    if (plaetze[i]) {
      gelegt[h] = (gelegt[h] ?? 0) + 1;
      if (h !== "SPECS") namenGelegt.push(sp.shape.name ?? "?");
      fracht.push({
        materialId: sp.materialId,
        massKg: Math.max(1, Math.round(gewicht.get(i) ?? sp.massKg)),
      });
    } else if (h !== "SPECS") namenWeg.push(sp.shape.name ?? "?");
  });
  return {
    kind: c.vehicle,
    gruppe: c.group,
    schwer,
    gezogen,
    gelegt,
    namenGelegt,
    namenWeg,
    fracht,
    angekuendigtKg,
  };
}

/* ---------------------------------------------------------------------- */
/* Ausgabe                                                                 */
/* ---------------------------------------------------------------------- */

function z(n: number, b = 6): string {
  return String(n).padStart(b);
}

function main(): void {
  const arg = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  const SAATEN = arg.length > 0 ? Number(arg[0]) : 96; // E-080: 24 reichen nicht

  console.log("=== 1. PASSFORM: was kann ueberhaupt auf eine Ladeflaeche? ===\n");
  console.log("Flaechen (Breite x nutzLaenge x maxHoehe, Rasterfelder quer x laengs):");
  for (const f of LIEFERFLAECHEN) {
    const nx = Math.max(1, Math.floor((f.halbBreite * 2) / RASTER));
    const nz = Math.max(1, Math.floor(f.nutzLaenge / RASTER));
    console.log(
      `  ${f.name.padEnd(18)} ${(f.halbBreite * 2).toFixed(2)} m x ${f.nutzLaenge.toFixed(2)} m x ` +
        `${f.maxHoehe.toFixed(2)} m   Raster ${nx} x ${nz}`
    );
  }
  console.log("");

  const nie: Array<{ kurz: string; sp: PileSpec; grund: Hindernis }> = [];
  console.log("Liste   Eintraege   passt irgendwo   passt nie");
  for (const { kurz, liste } of LISTEN) {
    let ok = 0;
    for (const sp of liste) {
      const r = passtIrgendwo(sp);
      if (r.ok) ok++;
      else nie.push({ kurz, sp, grund: r.grund });
    }
    console.log(`${kurz.padEnd(8)}${z(liste.length, 9)}${z(ok, 17)}${z(liste.length - ok, 12)}`);
  }
  console.log("");
  console.log(`PASST NIE — ${nie.length} Eintraege:`);
  const grundZaehler: Record<string, number> = {};
  for (const { kurz, sp, grund } of nie) {
    grundZaehler[grund] = (grundZaehler[grund] ?? 0) + 1;
    const t = stueckMass(sp.kind, sp.dims);
    const g = grundriss(t);
    console.log(
      `  [${kurz}] ${(sp.name ?? "?").padEnd(34)} ${sp.kind} ${sp.dims.map((d) => d.toFixed(2)).join(" x ")}` +
        `  -> Grundriss ${g.breite.toFixed(2)} x ${g.laenge.toFixed(2)} m, Bauhoehe ${t.hoehe.toFixed(2)} m  (${grund})`
    );
  }
  console.log(`  Gruende: ${JSON.stringify(grundZaehler)}`);
  const alleinOk = nie.filter(({ sp }) => hindernis(sp, EINZEL_FLAECHE) === "passt").length;
  console.log(
    `  davon passen ALLEIN auf die Pritsche (E-126, ${EINZEL_FLAECHE.maxHoehe.toFixed(2)} m): ${alleinOk}` +
      ` — als Einzelstueck kommen nur die aus customers.EINZELSTUECKE`
  );

  console.log(`\n=== 2. DURCHLAUF ueber ${SAATEN} Saaten ===\n`);
  const summeG: Record<string, number> = { SPECS: 0, BIG: 0, HUGE: 0 };
  const summeL: Record<string, number> = { SPECS: 0, BIG: 0, HUGE: 0 };
  let fuhren = 0;
  let schwere = 0;
  const gruppen: Record<string, number> = {};
  const angekommen = new Map<string, number>();
  const verworfen = new Map<string, number>();
  let kgAn = 0;
  const kgJeFraktion = new Map<string, number>();
  let kgAngekuendigt = 0;
  let ankauf = 0;
  let erloes = 0;
  let praemie = 0;
  for (let s = 0; s < SAATEN; s++) {
    let zurueck = festerZufall(20260917 + s * 7919);
    /*
     * `--getrennt` (E-123): Kunden und Packen ziehen aus GETRENNTEN Folgen.
     * Ohne das kippt jede Katalogaenderung die ganze Kundenreihe hinter der
     * ersten anders gepackten Fuhre — und ein Vorher/Nachher der Tagesbilanz
     * misst dann zur Haelfte, welche Kunden zufaellig kamen. Mit dem Schalter
     * sind die 960 Kunden in beiden Laeufen dieselben.
     */
    const getrennt = process.argv.includes("--getrennt");
    const kunden = getrennt ? Array.from({ length: 10 }, () => rollAnlieferung()) : [];
    // Zehn Kunden je Saat — ein Spieltag hat rund so viele Anlieferungen.
    for (let i = 0; i < 10; i++) {
      if (getrennt) {
        zurueck();
        zurueck = festerZufall(31337 + s * 7919 + i * 104729);
      }
      const c = getrennt ? kunden[i]! : rollAnlieferung();
      const r = packeFuhre(c);
      fuhren++;
      if (r.schwer) schwere++;
      gruppen[r.gruppe] = (gruppen[r.gruppe] ?? 0) + 1;
      for (const k of ["SPECS", "BIG", "HUGE"]) {
        summeG[k] = (summeG[k] ?? 0) + (r.gezogen[k] ?? 0);
        summeL[k] = (summeL[k] ?? 0) + (r.gelegt[k] ?? 0);
      }
      for (const n of r.namenGelegt) angekommen.set(n, (angekommen.get(n) ?? 0) + 1);
      for (const n of r.namenWeg) verworfen.set(n, (verworfen.get(n) ?? 0) + 1);
      /*
       * TAGESBILANZ — der bestmögliche Fall, absichtlich.
       *
       * Angenommen wird: Der Spieler sortiert jedes Stück richtig (Reinheit
       * 1,0, also Reinheit² = 1,0) und verkauft alles. Preise aus
       * `materials/catalog.ts` (Briefing Kap. 7), Ankauf 0,16 €/kg und
       * Sortierprämie 0,05 €/kg aus `economy/account.ts`. Das ist keine
       * Vorhersage des echten Verdienstes, sondern ein MASSSTAB: dieselbe
       * Rechnung vor und nach der Änderung, damit die Verschiebung sichtbar
       * wird und nicht im Spielverlauf untergeht.
       */
      kgAngekuendigt += r.angekuendigtKg;
      for (const f of r.fracht) {
        kgAn += f.massKg;
        kgJeFraktion.set(f.materialId, (kgJeFraktion.get(f.materialId) ?? 0) + f.massKg);
        ankauf += f.massKg * PURCHASE_PRICE_PER_KG;
        praemie += f.massKg * SORTING_BONUS_PER_KG;
        erloes += f.massKg * getMaterial(f.materialId).sellPricePerKg;
      }
    }
    zurueck();
  }
  console.log(
    `Fuhren: ${fuhren}   davon "schwere" Kunden: ${schwere} (${((schwere / fuhren) * 100).toFixed(1)} %)`
  );
  console.log(`Kundengruppen: ${JSON.stringify(gruppen)}\n`);
  console.log("Liste    gezogen    gelegt   abgelegt   Quote    je Fuhre gelegt");
  for (const k of ["SPECS", "BIG", "HUGE"]) {
    const g = summeG[k] ?? 0;
    const l = summeL[k] ?? 0;
    console.log(
      `${k.padEnd(8)}${z(g, 8)}${z(l, 10)}${z(g - l, 11)}` +
        `${((l / Math.max(1, g)) * 100).toFixed(1).padStart(8)} %${(l / fuhren).toFixed(2).padStart(15)}`
    );
  }
  const gGes = summeG.SPECS! + summeG.BIG! + summeG.HUGE!;
  const lGes = summeL.SPECS! + summeL.BIG! + summeL.HUGE!;
  console.log(
    `${"gesamt".padEnd(8)}${z(gGes, 8)}${z(lGes, 10)}${z(gGes - lGes, 11)}` +
      `${((lGes / Math.max(1, gGes)) * 100).toFixed(1).padStart(8)} %${(lGes / fuhren).toFixed(2).padStart(15)}`
  );

  const grosseEintraege = [...BIG_SPECS, ...HUGE_SPECS];
  const nieGesehen = grosseEintraege.filter((sp) => !angekommen.has(sp.name ?? "?"));
  console.log(
    `\nGrosse Eintraege (BIG+HUGE): ${grosseEintraege.length}, davon in ${fuhren} Fuhren nie angekommen: ${nieGesehen.length}`
  );
  const oft = [...verworfen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("Am haeufigsten weggeworfen:");
  for (const [n, c] of oft) console.log(`  ${z(c, 5)} x ${n}`);
  const da = [...angekommen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("Am haeufigsten angekommen (BIG/HUGE):");
  for (const [n, c] of da) console.log(`  ${z(c, 5)} x ${n}`);

  /*
   * EINZELNE TEILE NACHSEHEN (E-123): `--zeige=Mulde|Gerüst|bagger` druckt je
   * passendem Grossteil, wie oft es gezogen wurde, wie oft es ankam und auf
   * welche Flaechen es ueberhaupt passt. Ein Teil, das nie ankommt, gibt es
   * fuer Patrick nicht — das soll man je Name sehen, nicht nur in der Summe.
   */
  const zeige = process.argv.find((a) => a.startsWith("--zeige="))?.slice(8);
  if (zeige) {
    const muster = new RegExp(zeige, "i");
    console.log(`\nEinzeln (--zeige=${zeige}), je ${fuhren} Fuhren:`);
    console.log("  gezogen  angekommen  je 100 Fuhren  passt auf");
    for (const sp of grosseEintraege.filter((s) => muster.test(s.name ?? ""))) {
      const n = sp.name ?? "?";
      const an = angekommen.get(n) ?? 0;
      const weg = verworfen.get(n) ?? 0;
      const flaechen = [...LIEFERFLAECHEN, EINZEL_FLAECHE]
        .filter((f) => hindernis(sp, f) === "passt")
        .map((f) => f.name);
      console.log(
        `  ${z(an + weg, 7)}${z(an, 12)}${((an / fuhren) * 100).toFixed(2).padStart(15)}  ` +
          `${n}  [${flaechen.join(", ") || "KEINE"}]`
      );
    }
  }

  const tage = fuhren / 10;
  const eur = (n: number): string => (n / tage).toFixed(2).padStart(12);
  console.log(`\n=== 3. TAGESBILANZ (${tage} Tage a 10 Fuhren, alles richtig sortiert) ===\n`);
  console.log(`  angekuendigt je Tag ${(kgAngekuendigt / tage).toFixed(0).padStart(9)} kg`);
  console.log(`  angekommen   je Tag ${(kgAn / tage).toFixed(0).padStart(9)} kg   ` +
    `(${((kgAn / Math.max(1, kgAngekuendigt)) * 100).toFixed(1)} % der Ankuendigung)`);
  console.log(`  Ankauf          ${eur(-ankauf)} EUR`);
  console.log(`  Sortierpraemie  ${eur(praemie)} EUR`);
  console.log(`  Verkaufserloes  ${eur(erloes)} EUR`);
  console.log(`  ------------------------------------`);
  console.log(`  TAGESVERDIENST  ${eur(erloes + praemie - ankauf)} EUR`);
  console.log("\n  kg je Tag und Fraktion:");
  for (const [id, kg] of [...kgJeFraktion.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`    ${id.padEnd(8)}${(kg / tage).toFixed(0).padStart(8)} kg`);
}

// Nur als Aufruf laufen, nicht als Baustein (tools/sortenanteile.ts nutzt packeFuhre).
if (!(globalThis as { grossteileAlsBaustein?: boolean }).grossteileAlsBaustein) main();
