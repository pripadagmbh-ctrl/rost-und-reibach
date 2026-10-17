/**
 * Wo der Abholer haelt, und ob der Spieler ihn von dort aus beladen kann.
 *
 * Gebaut am 15.09.2026 fuer E-056. Der Halteplatz haengt seitdem an der
 * bestellten Fraktion; dieses Werkzeug rechnet fuer jeden moeglichen Platz
 * nach, was daran haengt:
 *
 *   - Abstand Bagger → Silo-Vorderkante (muss ins Schwenkband 5,80 … 9,20 m)
 *   - Abstand Bagger → jede der vier Ecken der Ladeflaeche
 *   - Hoechste Krallenspitze auf diesen Abstaenden (kommt der Arm ueber die
 *     Bordwand von 1,00 m?)
 *
 * Aufruf: npx vite-node tools/verladeplaetze.ts
 */
import { CONFIGS, bayVorderkante } from "../src/world/containers";
import {
  alleAbholPlaetze,
  BED_HALF_W,
  bedLenFor,
  verladeStandFuer,
} from "../src/delivery/routes";
import { SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { hoechsteKrallenspitze } from "../src/excavator/excavator";

const f = (n: number): string => n.toFixed(2).padStart(6);

console.log("HALTEPLAETZE DES ABHOLERS");
console.log(`Schwenkband ${SCHWENK_INNEN} … ${SCHWENK_AUSSEN} m\n`);

for (const p of alleAbholPlaetze()) {
  const bl = bedLenFor("abholer");
  const [hx, hz] = p.halt;
  /*
   * Die Ladeflaeche liegt quer zur Fahrtrichtung des Wagens am Halt. Am
   * Abladeplatz und an beiden Verladeplaetzen steht er mit der LAENGSSEITE
   * zum Bagger — die lange Achse zeigt also in die Richtung, in der er
   * zurueckgesetzt hat.
   */
  const laengsX = Math.abs(p.rueckweg.at(-2)![0] - p.rueckweg.at(-1)![0]) > 0.01;
  const ecken: Array<[number, number]> = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      ecken.push(
        laengsX
          ? [hx + a * (bl / 2), hz + b * BED_HALF_W]
          : [hx + a * BED_HALF_W, hz + b * (bl / 2)]
      );
    }
  const d = ecken
    .map(([x, z]) => Math.hypot(x - p.stand.x, z - p.stand.z))
    .sort((a, b) => a - b);
  const drin = d.every((v) => v >= SCHWENK_INNEN && v <= SCHWENK_AUSSEN);
  console.log(
    `${(p.order ?? "gemischt").padEnd(9)} ${p.name.padEnd(26)} ` +
      `Halt (${f(hx)} |${f(hz)})  Stand (${f(p.stand.x)} |${f(p.stand.z)})`
  );
  console.log(
    `            Ladeflaechenecken ${d.map(f).join(" ")}  ${drin ? "alle im Band" : "AUSSERHALB"}`
  );
  console.log(
    `            Krallenspitze auf der fernsten Ecke ` +
      `${f(hoechsteKrallenspitze(d[3]!))} m (Bordwand 1,00 m)`
  );
  if (p.ziel) {
    // Von diesem Stand aus muessen ALLE Silos des Schenkels erreichbar sein.
    const schenkel = CONFIGS.filter((c) => c.lager === true && c.facing === p.ziel!.facing);
    for (const s of schenkel) {
      const k = bayVorderkante(s);
      const ds = Math.hypot(k.x - p.stand.x, k.z - p.stand.z);
      const ok = ds >= SCHWENK_INNEN && ds <= SCHWENK_AUSSEN;
      console.log(
        `            ${s.label.padEnd(14)} Vorderkante ${f(ds)} m ${ok ? "✓" : "✗"}` +
          `  Krallenspitze ${f(hoechsteKrallenspitze(ds))} m`
      );
    }
  }
  console.log("");
}

console.log("STAENDE JE SCHENKEL (aus der Silo-Geometrie gerechnet)");
const gesehen = new Set<string>();
for (const c of CONFIGS.filter((s) => s.lager === true)) {
  const seite = c.facing ?? "west";
  if (gesehen.has(seite)) continue;
  gesehen.add(seite);
  const st = verladeStandFuer(c);
  console.log(`  ${seite.padEnd(6)} Bagger (${f(st.x)} |${f(st.z)})`);
}
