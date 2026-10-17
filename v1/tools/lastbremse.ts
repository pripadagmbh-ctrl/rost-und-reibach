/** Aufruf: npx vite-node tools/lastbremse.ts — Kern und Beschreibung: lastbremse-kern.ts (E-152) */
import { messeBremse, type Lage } from "./lastbremse-kern";

console.log("Lage        Schwenk °/s  Anlauf s  Heben 1 s (m)  Pflug min  geschoben m");
for (const lage of ["leer", "1t", "3t", "anliegend", "seitlich"] as Lage[]) {
  const m = await messeBremse(lage);
  console.log(
    `${lage.padEnd(12)}${m.schwenkGradS.toFixed(1).padStart(11)}${m.anlaufS.toFixed(2).padStart(10)}${m.hebenM.toFixed(2).padStart(15)}${m.pflugMin.toFixed(2).padStart(11)}${m.geschobenM.toFixed(2).padStart(13)}`
  );
}
