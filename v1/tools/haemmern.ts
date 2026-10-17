/** Aufruf: npx vite-node tools/haemmern.ts [Hebebilder] — Kern: haemmern-kern.ts */
import { haemmere, pfluege, type Untergrund } from "./haemmern-kern";

const heb = Number(process.argv[2] ?? 24);
console.log(`Heben je Schlag: ${heb} Bilder`);
console.log("Untergrund  Spinne  vFrei  vAufsetzen je Schlag (m/s)     gesperrt frei  Pflug frei  Schlaege (worauf)        Druecken (halten)  Weg Ziel");
for (const u of ["beton", "grossteil", "haufen"] as Untergrund[]) {
  for (const zu of [false, true]) {
    const l = await haemmere(u, zu, heb);
    const worauf = l.aufschlaege.map((a) => (a.handle === null ? "B" : a.handle === l.zielHandle ? "Z" : "T") + a.wucht.toFixed(2)).join(" ");
    console.log(
      `${u.padEnd(11)} ${(zu ? "zu" : "offen").padEnd(6)} ${l.vFrei.toFixed(2).padStart(5)}  ${l.vAufsetzen.map((v) => v.toFixed(2)).join(" ").padEnd(30)} ${String(l.gesperrtFrei).padStart(12)}  ${l.pflugFreiMin.toFixed(2).padStart(10)}  ${worauf.padEnd(26)} ${String(l.druecken.length).padStart(5)} (${l.drueckenHalten})       ${l.untergrundWeg.toFixed(2)}`
    );
  }
}
console.log("Pfluegen:", await pfluege());
