/**
 * DIE FAHRTEN DES EINSPURMODELLS, VON OBEN GEZEICHNET (E-140).
 *
 *     npx vite-node tools/einspur-plan.ts -- [Teil des Plannamens] [--aus=datei.png]
 *
 * Grau die Bauwerke, duenn die Strecken, farbig der Umriss alle 0,5 s, rot
 * jede Lage mit Durchdringung. Norden ist oben, Westen links (x nach rechts,
 * z nach oben) — so wie `tools/platzplan.ts`.
 */
import { bedLenFor, rangierzuege, fahrHindernisse } from "../src/delivery/routes";
const STATIC_OBSTACLES = fahrHindernisse();
import { fahrzeugUmriss, umrissEcken, umrissUeberlappung } from "../src/delivery/umriss";
import { fahrplaene } from "../test/strecken";
import { fahre } from "../test/knicklauf";
import { Blatt, farbe } from "./fuenfschalen/png";

const args = process.argv.slice(2).filter((a) => a !== "--");
const ausArg = args.find((a) => a.startsWith("--aus="));
const aus = ausArg ? ausArg.slice(6) : "einspur-plan.png";
const filter = args.filter((a) => !a.startsWith("--"));
const ausschnitt = (args.find((a) => a.startsWith("--box=")) ?? "--box=-41,-30,11,30")
  .slice(6)
  .split(",")
  .map(Number) as [number, number, number, number];

const [X0, Z0, X1, Z1] = ausschnitt;
const M = 14;
const B = new Blatt(Math.round((X1 - X0) * M), Math.round((Z1 - Z0) * M), [0xfa, 0xfa, 0xf7]);
const px = (x: number): number => (x - X0) * M;
const py = (z: number): number => (Z1 - z) * M;

for (const o of STATIC_OBSTACLES) {
  B.rechteck(
    Math.round(px(o.x - o.hw)),
    Math.round(py(o.z + o.hd)),
    Math.max(1, Math.round(o.hw * 2 * M)),
    Math.max(1, Math.round(o.hd * 2 * M)),
    farbe("#9a9a9a")
  );
}
// Meterraster alle 5 m
for (let x = Math.ceil(X0 / 5) * 5; x <= X1; x += 5) B.linie(px(x), 0, px(x), B.hoehe, farbe("#e4e4e4"));
for (let z = Math.ceil(Z0 / 5) * 5; z <= Z1; z += 5) B.linie(0, py(z), B.breite, py(z), farbe("#e4e4e4"));

const FARBEN = ["#1f6fb2", "#2e8b57", "#b8860b", "#7b3fa0", "#c05a1a", "#227c7c"];
const zeile: string[] = [];
let n = 0;
for (const plan of fahrplaene()) {
  const passt = (f: string): boolean => (f.startsWith("=") ? plan.name === f.slice(1) : plan.name.includes(f));
  if (filter.length > 0 && !filter.some(passt)) continue;
  const art = args.find((a) => a.startsWith("--art="))?.slice(6);
  if (art) plan.kind = art;
  const fahrt = fahre(plan);
  const bedLen = bedLenFor(plan.kind);
  for (const e of plan.etappen) {
    for (let i = 0; i < e.route.length - 1; i++) {
      const [ax, az] = e.route[i]!;
      const [bx, bz] = e.route[i + 1]!;
      B.linie(px(ax), py(az), px(bx), py(bz), farbe(e.rueckwaerts ? "#d04040" : "#404040"), 3);
    }
  }
  const f = farbe(FARBEN[n++ % FARBEN.length]!);
  fahrt.spur.forEach((p, i) => {
    const b = fahrzeugUmriss({ x: p.x, z: p.z, rot: p.gier }, bedLen);
    let tief = 0;
    for (const o of STATIC_OBSTACLES) tief = Math.max(tief, umrissUeberlappung(b, o));
    if (i % 30 !== 0 && tief < 0.01) return;
    const c = tief >= 0.01 ? farbe("#ff0000") : f;
    const e = umrissEcken(b);
    const ring = [e[0]!, e[1]!, e[3]!, e[2]!, e[0]!];
    for (let k = 0; k < 4; k++) {
      B.linie(px(ring[k]![0]), py(ring[k]![1]), px(ring[k + 1]![0]), py(ring[k + 1]![1]), c);
    }
  });
  zeile.push(
    `${plan.name.padEnd(44)} Tiefe ${fahrt.maxTiefeM.toFixed(2)}  ${fahrt.dauerS.toFixed(1)} s  ` +
      `Grad/Bild ${fahrt.maxGrad.toFixed(2)}  Stand ${fahrt.standDrehGrad.toFixed(2)}  ` +
      `Ende ${fahrt.maxEndAbweichungM.toFixed(2)} m  Knick ${fahrt.maxKnickGrad.toFixed(0)}` +
      (fahrt.stecken.length ? `  STECKT: ${fahrt.stecken.join(", ")}` : "") +
      (fahrt.anstoesse.length
        ? `  [${fahrt.anstoesse
            .slice(0, 2)
            .map((a) => `${a.etappe}|${a.bauwerk} ${a.tiefeM.toFixed(2)}`)
            .join("; ")}]`
        : "")
  );
}
console.log(zeile.join("\n"));
B.schreibe(aus);
for (const z of rangierzuege()) {
  const h = z.rueckweg[z.rueckweg.length - 1]!;
  console.log(`Zug zu (${h[0].toFixed(1)} | ${h[1].toFixed(1)}): ${z.wahl}`);
}
