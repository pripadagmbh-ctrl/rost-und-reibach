/**
 * Wo schlägt die offene Spinne beim vollen Schwenk an der Bucht an? (E-189)
 *
 * Patrick, 20.10.2026: „… jeweils die außenwände der ausbuchtung etwas
 * angeschrägt sein, sodass man beim schwenken nicht immer anschlägt".
 *
 * Gerechnet wie die Maschine prüft (`hitsObstacle` mit Höhe): Die offene
 * Spinne ist eine Scheibe von 1,51 m Halbmesser (Fünfschalengreifer offen
 * 3,02 m), abgetastet in der Mitte und an 16 Randpunkten. Sie fährt im Kreis
 * um den Sitz, je Grad ein Schritt (0° = geradeaus, + = links vom Fahrer).
 * Gezählt werden nur die Mauern der Bucht und die Südmauer daneben.
 *
 * Aufruf:  npx vite-node tools/schwenkanschlag.ts
 */
import { hitsObstacle } from "../src/world/obstacles";
import { BAGGER_STAND } from "../src/world/baggerstand";

const GREIFER_R = 1.51;
const MAUER = /^(Südwand|Buchtwand|Buchtfase)/;
const AUSLADUNGEN = [6, 7, 8, 8.5, 9, 9.2];
const HOEHEN = [1.0, 3.0, 4.5];

/** Winkelbereiche mit Anschlag, z. B. „121–138° (Buchtwand Ost)". */
export function anschlaege(ausladung: number, hoehe: number): Array<{ von: number; bis: number; was: string }> {
  const treffer: Array<{ w: number; was: string }> = [];
  for (let w = -180; w < 180; w++) {
    const r = (w * Math.PI) / 180;
    const cx = BAGGER_STAND.x + ausladung * Math.sin(r);
    const cz = BAGGER_STAND.z + ausladung * Math.cos(r);
    let was: string | null = null;
    for (let i = -1; i < 16 && !was; i++) {
      const a = (i * Math.PI) / 8;
      const x = i < 0 ? cx : cx + GREIFER_R * Math.cos(a);
      const z = i < 0 ? cz : cz + GREIFER_R * Math.sin(a);
      const o = hitsObstacle(x, z, 0, hoehe);
      if (o && MAUER.test(o.label)) was = o.label;
    }
    if (was) treffer.push({ w, was });
  }
  const out: Array<{ von: number; bis: number; was: string }> = [];
  for (const t of treffer) {
    const letzt = out[out.length - 1];
    if (letzt && t.w === letzt.bis + 1) {
      letzt.bis = t.w;
      if (!letzt.was.includes(t.was)) letzt.was += ", " + t.was;
    } else out.push({ von: t.w, bis: t.w, was: t.was });
  }
  return out;
}

if (!process.env.VITEST) {
  console.log("Ausladung · Höhe Unterkante Spinne → Winkel mit Anschlag an Bucht/Südmauer");
  for (const a of AUSLADUNGEN) {
    for (const h of HOEHEN) {
      const b = anschlaege(a, h);
      const grad = b.reduce((s, x) => s + x.bis - x.von + 1, 0);
      console.log(
        `${a.toFixed(1).padStart(4)} m · ${h.toFixed(1)} m: ${grad === 0 ? "frei" : `${grad}° — ` + b.map((x) => `${x.von}…${x.bis}° (${x.was})`).join("; ")}`
      );
    }
  }
}
