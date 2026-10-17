/**
 * DIE KNICKTABELLE — jede Strecke, jede Ecke, in Grad und in Metern.
 *
 *     npx vite-node tools/rangierknick.ts
 *
 * Es druckt drei Tabellen:
 *
 *   1. je Fahrplan der schaerfste Knick eines einzelnen Rechenschritts,
 *      vorher (hartes Setzen) und nachher (Einlenken), dazu die Fahrzeit;
 *   2. die zwoelf schaerfsten Einzelknicke des alten Standes mit Ort;
 *   3. jede Durchdringung eines Bauwerks — das ist die Platzfrage: Ein
 *      Fahrzeug, das einlenkt, faehrt eine Kurve statt einer Ecke und
 *      braucht Raum, den die Strecke bisher nicht vorsieht.
 *
 * Es ist ein WERKZEUG und kein Waechter: Es misst und druckt, es hat keine
 * Schranken. Die Schranken stehen in `test/rangierknick.test.ts`.
 */
import { fahrplaene } from "../test/strecken";
import { fahre, ALT, NEU, type Fahrt } from "../test/knicklauf";


const g = (x: number, n = 1): string => x.toFixed(n).padStart(6);

/*
 * Seit E-140 gibt es nur noch eine Stellgroesse: `--rate=Infinity` ist der
 * alte Sprungzustand, jeder endliche Wert das Einspurmodell aus `lenkung.ts`.
 */
const arg = (n: string, s: number): number => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? Number(t.slice(n.length + 3)) : s;
};
const WEISE = { lenkrate: arg("rate", NEU.lenkrate) };
const plaene = fahrplaene();
const alt = plaene.map((p) => fahre(p, ALT));
const neu = plaene.map((p) => fahre(p, WEISE));
const zeilen: string[] = [];
zeilen.push(
  Number.isFinite(WEISE.lenkrate) ? "Einspurmodell (E-140)" : "alter Sprungzustand (vor E-084)"
);
zeilen.push("");
zeilen.push(
  "Fahrplan                        | Grad/Schritt   | Ecksprung m    | Dauer s      | Tiefe m"
);
zeilen.push(
  "                                | vorher nachher | vorher nachher | vorher nachher| v.   n."
);
for (let i = 0; i < plaene.length; i++) {
  const a = alt[i]!;
  const n = neu[i]!;
  zeilen.push(
    `${a.plan.padEnd(31)} |${g(a.maxGrad)} ${g(n.maxGrad)} |${g(a.maxSprungM, 2)} ` +
      `${g(n.maxSprungM, 2)} |${g(a.dauerS)} ${g(n.dauerS)} |${g(a.maxTiefeM, 2)} ${g(n.maxTiefeM, 2)}`
  );
}
const schlimmste = (r: Fahrt[]): string[] =>
  r
    .flatMap((f) => f.knicke.map((k) => ({ ...k, plan: f.plan })))
    .sort((a, b) => b.sprungM - a.sprungM)
    .slice(0, 12)
    .map(
      (k) =>
        `${g(k.sprungM, 2)} m  ${g(k.grad)} Grad  bei (${k.x.toFixed(1)} | ${k.z.toFixed(1)})  ` +
        `${k.etappe}`
    );
zeilen.push("", "DIE ZWOELF SCHAERFSTEN EINZELKNICKE — VORHER", ...schlimmste(alt));
zeilen.push("", "DIESELBEN STELLEN — NACHHER", ...schlimmste(neu));
const anstoesse = (r: Fahrt[]): string[] => {
  const alle = r.flatMap((f) => f.anstoesse.map((a) => ({ ...a, plan: f.plan })));
  const je = new Map<string, (typeof alle)[number]>();
  for (const a of alle) {
    const k = `${a.etappe} | ${a.bauwerk}`;
    if (!je.has(k) || je.get(k)!.tiefeM < a.tiefeM) je.set(k, a);
  }
  return [...je.values()]
    .sort((x, y) => y.tiefeM - x.tiefeM)
    .map(
      (a) =>
        `${g(a.tiefeM, 2)} m  ${a.etappe.padEnd(28)} ${a.bauwerk.padEnd(22)} ` +
        `bei (${a.x.toFixed(1)} | ${a.z.toFixed(1)})`
    );
};
const vorher = anstoesse(alt);
const nachher = anstoesse(neu);
zeilen.push("", `DURCHDRINGUNGEN VORHER (${vorher.length})`, ...vorher);
zeilen.push("", `DURCHDRINGUNGEN NACHHER (${nachher.length})`, ...nachher);
console.log(zeilen.join("\n"));
