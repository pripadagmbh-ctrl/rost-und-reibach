/**
 * MESSUNG E-152: Grosse und schwere Teile greifen — Fuenfschalengreifer und
 * Magnet, mehrere Lagen, mit Diagnose, WARUM ein Griff scheitert.
 *
 * Patrick, 17.10.2026: „extrem schwere bzw. grosse objekte lassen sich oft
 * nicht greifen oder verlangsamen den bagger unnatürlich".
 *
 * Teile: alle Katalog-Eintraege ab 800 kg oder mit einer Kante ueber 2 m,
 * dazu die drei Wracks. Je Teil und Lage ein Lauf aus
 * `grossteil-greifen-kern.ts` (senken, nachdruecken, zufassen, heben).
 *
 *     npx vite-node tools/grossteile-schwer.ts <fuenf|magnet|sichel> [Lagen, z. B. 0,0.8,1.4] [Teil-Filter|-] [jedes n-te] [Rest]
 *
 * Hebt der Arm wegen Ueberlast nicht (E-152), zieht der Lauf den Stiel heran
 * wie ein Spieler. Ausgabe als Tabelle; Spalte „warum": Ueberlast (gefasst, auch nah nicht hebbar) · Sensor ·
 * Korb · Schalen · Fenster · Baugruppe (statt des Rumpfs reisst die Spinne
 * ein Teil heraus) · gefasst, aber nicht gehoben.
 */
import { ALLE_SPECS, messeGrossteil, type MessOptionen } from "./grossteil-greifen-kern";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { MAGNET } from "../src/excavator/magnet";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import type { WrackArt } from "../src/dismantle/carDef";

const formArg = process.argv[2] ?? "fuenf";
const form = formArg === "magnet" ? MAGNET : formArg === "sichel" ? SICHELKRALLE : FUENFSCHALEN;
const lagen = (process.argv[3] ?? "0,0.8,1.4").split(",").map(Number);
const filter = process.argv[4] && process.argv[4] !== "-" ? process.argv[4] : "";
const jedes = Number(process.argv[5] ?? 1);
/** Rest: mit `jedes` zusammen laesst sich die Liste auf mehrere Prozesse verteilen */
const rest = Number(process.argv[6] ?? 0);

const specs = ALLE_SPECS()
  .filter((s) => s.massKg >= 800 || Math.max(...s.dims) > 2)
  .filter((s) => !filter || (s.name ?? "").includes(filter))
  .filter((_, i) => i % jedes === rest);
const ziele: Array<{ sp: (typeof specs)[number]; opt: MessOptionen }> = specs.map((sp) => ({ sp, opt: { form } }));
if ((!filter || filter === "Wrack") && rest === 0)
  for (const w of ["pkw", "wohnwagen", "lkw"] as WrackArt[]) ziele.push({ sp: specs[0] ?? ALLE_SPECS()[0]!, opt: { form, wrack: w } });

const STUFE = ["Sensor", "Korb", formArg === "magnet" ? "Stahl" : "Schalen", "Fenster", "?"];
console.log(`Greifer ${form.name}, Lagen ${lagen.join(" / ")} m, ${ziele.length} Teile`);
console.log("Teil                                  kg  Lage  gefasst gehoben  warum        Hub m/s  blockiert  Pflug  Ueberlast");
let ok = 0;
let n = 0;
for (const { sp, opt } of ziele) {
  for (const lage of lagen) {
    const m = await messeGrossteil(sp, undefined, { x: lage, z: 0 }, opt);
    const gehoben = m.gefasst > 0 && m.gehoben > 1;
    let warum = "ok";
    if (!gehoben) {
      if (m.gefasst > 0 && m.ueberlast > 0) warum = "Ueberlast";
      else if (m.reisst) warum = "Baugruppe";
      else if (m.gefasst > 0) warum = "nicht gehoben";
      else warum = STUFE[m.stufe] ?? "?";
    }
    n++;
    if (gehoben) ok++;
    console.log(
      `${m.name.slice(0, 34).padEnd(34)}${String(Math.round(m.massKg)).padStart(6)}${lage.toFixed(1).padStart(6)}` +
        `${String(m.gefasst).padStart(8)}${m.gehoben.toFixed(2).padStart(8)}  ${warum.padEnd(13)}` +
        `${m.hubMs.toFixed(2).padStart(7)}${String(m.armBlockiert).padStart(10)}${m.pflugMin.toFixed(2).padStart(7)}${String(m.ueberlast).padStart(10)}`
    );
  }
}
console.log(`gehoben ${ok} von ${n}`);
