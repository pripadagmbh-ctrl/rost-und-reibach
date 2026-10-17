/**
 * WIRD DIE BRÜCKE FREI? — Messreihe zum Kippablauf (E-149).
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/kipper-leeren.ts -- [Anzahl Saaten] [Variante …]
 *
 * ANLASS: `test/kipper.test.ts` „Brücke weitgehend frei" war rot (46 % gegen
 * die Schranke 45 %), und über 144 frische Saaten lag der Median vor wie nach
 * E-140 bei 47,1 % — fast die halbe Fuhre fuhr wieder vom Hof.
 *
 * Dieses Werkzeug fährt DENSELBEN Laufapparat wie der Wächter
 * (`test/kipperlauf.ts`, Lehre E-062) mit FRISCHEN Saaten (100000 …, wie
 * `tools/kipper-streuung.ts`) und GEPAART: Jede Variante bekommt dieselben
 * Saaten. Gemeldet werden alle vier Zahlen des Wächters — eine leere Brücke,
 * die dafür schleudert, ist keine Lösung.
 *
 * Varianten (ohne Angabe: alle):
 *   alt        58°, 2,2 s halten, kein Rütteln — der Stand vor E-149
 *   gebaut     `KIPP_ABLAUF` aus `routes.ts`
 *   w65 w70 w75             nur steiler, 3,5 s halten, kein Rütteln
 *   r58                     58° mit Rütteln
 *   w70a2 w70a6             70°, Rütteln mit 2° / 6°
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { spielFuhre, pruefKunde } from "../test/pruefkunde";
import { lauf, SAATEN_LANG, type Lauf } from "../test/kipperlauf";
import type { KippAblauf } from "../src/delivery/routes";

const grad = (x: number): number => (x * Math.PI) / 180;

const VARIANTEN: Record<string, Partial<KippAblauf> | undefined> = {
  alt: { winkel: grad(58), haltS: 2.2, ruettelStoesse: 0 },
  gebaut: undefined,
  w70: { winkel: grad(70), haltS: 3.5, ruettelStoesse: 0 },
  w75: { winkel: grad(75), haltS: 3.5, ruettelStoesse: 0 },
  r58: { winkel: grad(58), haltS: 3.5 },
  w70a2: { winkel: grad(70), ruettelAmpl: grad(2) },
  w70a6: { winkel: grad(70), ruettelAmpl: grad(6) },
  w65r: { winkel: grad(65) },
  w75r: { winkel: grad(75) },
  w70s8: { winkel: grad(70), ruettelStoesse: 8 },
  w75s8: { winkel: grad(75), ruettelStoesse: 8 },
  w75a6: { winkel: grad(75), ruettelAmpl: grad(6) },
  w70a8f1: { winkel: grad(70), ruettelAmpl: grad(8), ruettelHz: 1.0 },
  r58s8: { winkel: grad(58), ruettelStoesse: 8 },
  w70s12: { winkel: grad(70), ruettelStoesse: 12 },
  w70a3s10: { winkel: grad(70), ruettelAmpl: grad(3), ruettelStoesse: 10 },
  w70a2s12: { winkel: grad(70), ruettelAmpl: grad(2), ruettelStoesse: 12 },
  w70f1: { winkel: grad(70), ruettelHz: 1.0, ruettelStoesse: 6 },
  r58a3s10: { winkel: grad(58), ruettelAmpl: grad(3), ruettelStoesse: 10 },
  w65a3s10: { winkel: grad(65), ruettelAmpl: grad(3), ruettelStoesse: 10 },
  w65s8: { winkel: grad(65), ruettelStoesse: 8 },
  w65: { winkel: grad(65), haltS: 3.5, ruettelStoesse: 0 },
};

/**
 * Die Energiegrenze aus dem Kopf von `test/kipper.test.ts`, für 70°: Die
 * Vorderkante steht 1,05 + 6,00 · sin 70° = 6,69 m hoch, die Brücke bewegt
 * sich beim Rütteln mit höchstens 4° · π · 1,5 Hz · 6,00 m = 1,97 m/s.
 * √(2 · 9,81 · 6,69) + 1,97 = 13,4 m/s = 48 km/h. Was schneller ist, hat
 * seine Energie nicht vom Kippen, sondern vom Löser.
 */
const ENERGIEGRENZE_KMH = 48;

const mittelwert = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const p = (a: number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};

async function main(): Promise<void> {
  await initPhysics();
  const n = Number(process.argv[2]) || 96;
  const namen = process.argv.slice(3).filter((x) => x in VARIANTEN);
  // `--silo`: sortenreine Alu-Fuhre ins ALU-LAGER, mit Betonlego-Waenden
  const silo = process.argv.includes("--silo");
  // `--waechter`: die 48 festen Saaten von `test/kipper.test.ts` statt frischer
  const waechter = process.argv.includes("--waechter");
  const saat = (i: number): number => (waechter ? SAATEN_LANG[i % SAATEN_LANG.length]! : 100000 + i);
  const kunde = silo
    ? () => pruefKunde({ fuellgrad: 0.85, sortenrein: "alu", vehicle: "kipper", aufbau: "flach" })
    : spielFuhre;
  const liste = namen.length > 0 ? namen : Object.keys(VARIANTEN);
  const ergebnis: Record<string, Lauf[]> = {};
  for (const name of liste) {
    const t0 = Date.now();
    const r: Lauf[] = [];
    for (let i = 0; i < n; i++) {
      r.push(lauf({ name, kunde, kippen: VARIANTEN[name], mitMulden: silo }, saat(i)));
    }
    ergebnis[name] = r;
    const rest = r.map((x) => x.restAnteil * 100);
    const v = r.map((x) => x.vmaxKmh);
    const ab = r.map((x) => x.endAbstand);
    const d = r.map((x) => x.durchAnteil * 100);
    console.log(
      `${name.padEnd(7)} n=${n}  liegt Median ${p(rest, 0.5).toFixed(1)} %  Mittel ${mittelwert(rest).toFixed(1)} %  ` +
        `p95 ${p(rest, 0.95).toFixed(1)} %  |  Tempo Median ${p(v, 0.5).toFixed(0)}  Mittel ${mittelwert(v).toFixed(0)}  ` +
        `p99 ${p(v, 0.99).toFixed(0)}  max ${Math.max(...v).toFixed(0)} km/h  |  durch ${mittelwert(d).toFixed(1)} %  |  ` +
        `Endabstand Median ${p(ab, 0.5).toFixed(1)}  max ${Math.max(...ab).toFixed(1)} m  |  ` +
        `${mittelwert(r.map((x) => x.teile)).toFixed(1)} Stk  (${((Date.now() - t0) / 1000).toFixed(0)} s)`
    );
    // Wo die schnellen Stuecke herkommen: Phase des Wagens beim Hoechstwert
    const ueber = r.filter((x) => x.vmaxKmh > ENERGIEGRENZE_KMH);
    const phasen: Record<string, number> = {};
    for (const x of ueber) phasen[x.vmaxPhase] = (phasen[x.vmaxPhase] ?? 0) + 1;
    console.log(
      `        ueber der Energiegrenze ${ENERGIEGRENZE_KMH} km/h: ${ueber.length}/${n}, ueber 100: ` +
        `${r.filter((x) => x.vmaxKmh > 100).length}/${n}  |  Phase dabei: ` +
        Object.entries(phasen)
          .map(([k, z]) => `${k} ${z}`)
          .join(", ") +
        (silo ? `  |  in der Mulde ${(mittelwert(r.map((x) => x.inDerMulde)) * 100).toFixed(0)} %` : "")
    );
    // Getrennt nach Ziel: Abladeplatz (steil, geruettelt) und Lagersilo (wie frueher)
    for (const [ziel, teil] of [
      ["Abladeplatz", r.filter((x) => !x.insSilo)],
      ["Lagersilo", r.filter((x) => x.insSilo)],
    ] as const) {
      if (teil.length === 0) continue;
      const rr = teil.map((x) => x.restAnteil * 100);
      const vv = teil.map((x) => x.vmaxKmh);
      console.log(
        `        ${ziel.padEnd(11)} ${String(teil.length).padStart(3)} Fuhren: liegt Median ${p(rr, 0.5).toFixed(1)} %  ` +
          `Mittel ${mittelwert(rr).toFixed(1)} %  |  Tempo Median ${p(vv, 0.5).toFixed(0)} km/h`
      );
    }
    /*
     * WIE OFT REISST DIE SCHRANKE DES WAECHTERS ZUFAELLIG? (E-109)
     * `test/kipper.test.ts` urteilt nach dem MITTEL des Rests ueber 48 Saaten.
     * Ziehen mit Zuruecklegen: 20.000 Gruppen zu 48 aus diesen n Laeufen.
     */
    const gruppen: number[] = [];
    for (let k = 0; k < 20000; k++) {
      let summe = 0;
      for (let j = 0; j < 48; j++) summe += r[Math.floor(Math.random() * n)]!.restAnteil;
      gruppen.push((summe / 48) * 100);
    }
    const quote = (g: number): string =>
      `${((gruppen.filter((x) => x > g).length / gruppen.length) * 100).toFixed(2)} %`;
    console.log(
      `        Rest-Mittel ueber 48 Saaten: p01 ${p(gruppen, 0.01).toFixed(1)}  Median ${p(gruppen, 0.5).toFixed(1)}  ` +
        `p99 ${p(gruppen, 0.99).toFixed(1)}  max ${Math.max(...gruppen).toFixed(1)} %  |  reisst ueber ` +
        `45 %: ${quote(45)}, 30 %: ${quote(30)}, 25 %: ${quote(25)}, 20 %: ${quote(20)}`
    );
  }
  /*
   * GEPAART GEGEN „alt": je Saat der Unterschied im Rest. Nur gültig, weil
   * beide Läufe dieselbe Fuhre tragen — der Kippablauf zieht keine
   * Zufallszahl, also würfelt eine Variante keine andere Ladung.
   */
  const alt = ergebnis["alt"];
  if (alt) {
    for (const name of liste) {
      if (name === "alt") continue;
      const r = ergebnis[name]!;
      const delta = r.map((x, i) => (x.restAnteil - alt[i]!.restAnteil) * 100);
      const gleicheLadung = r.every((x, i) => x.teile === alt[i]!.teile && x.masseKg === alt[i]!.masseKg);
      console.log(
        `  ${name} gegen alt: Rest ${mittelwert(delta).toFixed(1)} Punkte im Mittel, ` +
          `besser in ${delta.filter((x) => x < 0).length}/${n}, schlechter in ${delta.filter((x) => x > 0).length}/${n}` +
          `  (dieselbe Ladung: ${gleicheLadung ? "ja" : "NEIN"})`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
