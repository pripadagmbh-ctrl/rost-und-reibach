/**
 * RIESENTEILE (45c, S5-5) — wie schwer wird ein einzelnes Teil beim Beladen?
 *
 * Kopflos, ohne Physikschritt: je Saat ein frischer Fuhrpark, ein Kunde, ein
 * `loadCargo`. Gezählt wird, was auf der Fläche liegt: Teile, Masse, Anteil
 * Mischschrott, schwerstes Teil und sein Vielfaches des Katalog-Gewichts.
 *
 *   npx vite-node tools/riesenteile.ts            (200 Saaten, beide Kundschaften)
 *   SAATEN=500 npx vite-node tools/riesenteile.ts
 *
 * Kundschaft „schicht": `rollSchichtKunde("kipper")` wie Montag.
 * Kundschaft „sandkasten": `rollAnlieferung()` wie die Uhr im Sandkasten.
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { HUGE_SPECS, type ScrapItem } from "../src/world/scrapItems";
import { rollAnlieferung, rollSchichtKunde, vehicleForCustomer, type CustomerProfile } from "../src/delivery/customers";
import { katalogKg, beladeFuhre } from "../test/riesenteile-hilfe";

function zufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

await initPhysics();
const saaten = Number(process.env.SAATEN ?? 200);
for (const art of ["schicht", "sandkasten"] as const) {
  const teile: number[] = [];
  const misch: number[] = [];
  const faktor: number[] = [];
  const kgListe: number[] = [];
  const angek: number[] = [];
  let ohneMisch = 0;
  let einTeilUeber60 = 0;
  let mitSchwergewicht = 0;
  const schwerNamen = new Set(HUGE_SPECS.map((h) => h.name));
  let schwerstes = { kg: 0, name: "" };
  let n = 0;
  for (let s = 1; s <= saaten; s++) {
    const zurueck = zufall(20261022 + s * 7919);
    const c: CustomerProfile = art === "schicht" ? rollSchichtKunde("kipper") : rollAnlieferung();
    zurueck();
    if (c.wrackArt || vehicleForCustomer(c) === "wrack") continue;
    const vorher = c.massKg;
    const liste: ScrapItem[] = beladeFuhre(c, 31 * s);
    if (!liste.length) continue;
    n++;
    const kg = liste.reduce((a, it) => a + it.massKg, 0);
    teile.push(liste.length);
    kgListe.push(kg);
    angek.push(kg / vorher);
    const m = liste.filter((it) => it.materialId === "mixed").reduce((a, it) => a + it.massKg, 0);
    misch.push(m / kg);
    if (m === 0 && !c.sortedMaterial && !c.einzelstueck) ohneMisch++;
    const top = [...liste].sort((a, b) => b.massKg - a.massKg)[0]!;
    if (liste.length > 1 && top.massKg / kg > 0.6) einTeilUeber60++;
    if (liste.some((it) => schwerNamen.has(it.shape?.name ?? ""))) mitSchwergewicht++;
    if (top.massKg > schwerstes.kg) schwerstes = { kg: top.massKg, name: `${top.shape?.name} (Katalog ${katalogKg(top)} kg)` };
    for (const it of liste) {
      const k = katalogKg(it);
      if (k) faktor.push(it.massKg / k);
    }
  }
  const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))]!;
  const mittel = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(
    `\n${art}: ${n} Fuhren` +
      `\n  Teile je Fuhre  min ${Math.min(...teile)} · p10 ${q(teile, 0.1)} · Median ${q(teile, 0.5)} · max ${Math.max(...teile)} · Fuhren mit 1–2 Teilen ${teile.filter((t) => t <= 2).length}` +
      `\n  Masse t         Mittel ${(mittel(kgListe) / 1000).toFixed(2)} · p10 ${(q(kgListe, 0.1) / 1000).toFixed(2)} · Median ${(q(kgListe, 0.5) / 1000).toFixed(2)} · Summe ${(kgListe.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}` +
      `\n  geliefert/angekündigt Mittel ${(mittel(angek) * 100).toFixed(0)} % · p10 ${(q(angek, 0.1) * 100).toFixed(0)} %` +
      `\n  Misch-Anteil    Median ${(q(misch, 0.5) * 100).toFixed(0)} % · gemischte Fuhren ohne Misch ${ohneMisch} · ein Teil > 60 % der Masse ${einTeilUeber60}` +
      `\n  × Katalog je Teil  Median ${q(faktor, 0.5).toFixed(2)} · p90 ${q(faktor, 0.9).toFixed(2)} · max ${Math.max(...faktor).toFixed(2)}` +
      `\n  schwerstes Teil ${Math.round(schwerstes.kg)} kg — ${schwerstes.name} · Fuhren mit Schwergewicht (HUGE_SPECS) ${mitSchwergewicht}`
  );
}
