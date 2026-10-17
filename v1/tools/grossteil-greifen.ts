/** Aufruf: npx vite-node tools/grossteil-greifen.ts [Teilname-Filter] — Kern: grossteil-greifen-kern.ts */
import { ALLE_SPECS, messeGrossteil } from "./grossteil-greifen-kern";

const filter = process.argv[2];
const teile = ALLE_SPECS().filter((s) => (filter ? (s.name ?? "").includes(filter) : s.massKg >= 250));
console.log("Teil                                   kg   oben  abges.  stieg  Bilder  korr.  gefasst  gehoben  vMax");
for (const sp of teile) {
  const m = await messeGrossteil(sp);
  console.log(
    `${m.name.slice(0, 36).padEnd(36)}${String(m.massKg).padStart(6)}${m.oben.toFixed(2).padStart(7)}${m.spitzeAbgesenkt.toFixed(2).padStart(8)}` +
      `${m.stiegBeimSenken.toFixed(2).padStart(7)}${String(m.bilderGestiegen).padStart(8)}${m.spitzeKorrigiert.toFixed(2).padStart(7)}` +
      `${String(m.gefasst).padStart(9)}${m.gehoben.toFixed(2).padStart(9)}${m.vMax.toFixed(1).padStart(6)}`
  );
}
