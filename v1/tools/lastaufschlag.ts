/** Messung E-134 ausgeben — der Kern steht in `lastaufschlag-kern.ts`. Aufruf: npx vite-node tools/lastaufschlag.ts */
import { messe } from "./lastaufschlag-kern";

void messe().then((l) => {
  for (const [n, s] of Object.entries(l.szenen)) {
    console.log(
      `${n.padEnd(30)} hoechstes Senktempo ${s.hoechstAbwaerts.toFixed(2)} m/s, ` +
        `${s.schlaege.length} Aufschlag/-schlaege: ` +
        s.schlaege.map((x) => `${x.tempo.toFixed(2)} m/s${x.aufSchrott ? " (Schrott)" : ""} @${x.bild}`).join(", ")
    );
  }
});
