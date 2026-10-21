/**
 * SCHICHT-LAUF (E-202) — eine ganze Schicht kopflos, mit echter Physik
 * (Messgerät, kein Wächter). Muster: `tools/abholer-lauf.ts`, `tools/platzlast.ts`.
 *
 * Spielt 06:00 bis 16:00 (600 s) einer Stufe auf dem Schicht-Platz (E-201)
 * mit dem Test-Fahrer aus `test/schichtlauf.ts`: ein Teil je `GRIFF` Sekunden
 * von der Annahme dorthin, wo es hingehört. `GRIFF=0` heißt „niemand räumt".
 *
 * Druckt je Minute: Körper gesamt, dynamisch, wach (Höchststand der Minute,
 * alle 0,1 s gezählt — S5); Physik-ms je Schritt
 * (Mittel, p95, Spitze); Laster auf dem Hof; wartende Fuhren; Abfahrten der
 * Verlader; Standzeit-Summe (roh) und Standgeld-Sekunden (über 60 s je Laster).
 * Am Ende: Teile je Fuhre, Gewicht je Fuhre, Lücke Abfahrt → Nachrücker am Halt.
 *
 * Aufruf:  npx vite-node tools/schicht-lauf.ts
 *   STUFE=montag|mittwoch|freitag (Vorgabe freitag)   GRIFF=4 (s je Teil, 0 = niemand)
 *   SAAT=1 (Fahrplan und Kundschaft)   SEKUNDEN=600
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { baueSchichtPlatz, festerZufall, TestFahrer, DT } from "../test/schichtlauf";
import { standgeldSekunden, type Schichtstufe } from "../src/economy/kasse";
import { SCHICHT_FEIERABEND_S } from "../src/world/schichtzeit";

async function main(): Promise<void> {
  await initPhysics();
  const stufe = (process.env.STUFE ?? "freitag") as Schichtstufe;
  const griffS = Number(process.env.GRIFF ?? 4);
  const saat = Number(process.env.SAAT ?? 1);
  const sekunden = Number(process.env.SEKUNDEN ?? SCHICHT_FEIERABEND_S + 1);
  festerZufall(saat * 7919 + 13);
  const p = baueSchichtPlatz({ stufe, saat });
  const fahrer = new TestFahrer(p, { griffS, lagerFahrtS: 20 });
  console.log(
    `Schicht ${stufe}, Saat ${saat}, ${griffS > 0 ? `Test-Fahrer 1 Teil je ${griffS} s` : "niemand räumt"} — Fahrplan: ` +
      p.betrieb.plan.map((f) => `${f.tS} s ${f.fahrzeug}${f.sorte ? ` (${f.sorte})` : ""}`).join(", ")
  );
  // Teile je Fuhre: was ein Anlieferer an Bord hat, wenn er ankommt
  const fuhren: Array<{ fahrzeug: string; teile: number; kg: number }> = [];
  let letzterAnlieferer: unknown = null;
  let letzterSilo: unknown = null;
  // Lücke: Abfahrt des Verladers bis der nächste am Halt bereitsteht
  const luecken: number[] = [];
  let abfahrtAb: number | null = null;
  let abfahrtenVorher = 0;

  console.log(
    "Min | Körper max | dyn max | wach max | ms Mittel | ms p95 | ms max | >8 ms | Takt ms | Takt p95 | Laster | wartend | Verlader ab | Standzeit s | Standgeld s"
  );
  let ms: number[] = [];
  /** Höchststände der laufenden Minute und der ganzen Schicht (S5). */
  let kMax = 0, dMax = 0, wMax = 0;
  let kGes = 0, dGes = 0, wGes = 0;
  /** Der ganze Takt (Physik + Fuhrpark + Boxen + Betrieb), ohne Test-Fahrer — das, was das Spiel je Bild zusätzlich rechnet. */
  let taktMs: number[] = [];
  const zeile = (min: number): void => {
    ms.sort((a, b) => a - b);
    const mittel = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
    const p95 = ms[Math.floor(ms.length * 0.95)] ?? 0;
    const max = ms[ms.length - 1] ?? 0;
    const ueber = ms.filter((x) => x > 8.3).length; // länger als ein halbes Bild (60 Hz)
    taktMs.sort((a, b) => a - b);
    const tm = taktMs.reduce((a, b) => a + b, 0) / Math.max(1, taktMs.length);
    const tp = taktMs[Math.floor(taktMs.length * 0.95)] ?? 0;
    const roh = p.protokoll.standzeiten.reduce((s, e) => s + e.standzeitS, 0);
    const geld = p.protokoll.standzeiten.reduce((s, e) => s + standgeldSekunden(e.standzeitS), 0);
    console.log(
      `${String(min).padStart(3)} | ${String(kMax).padStart(10)} | ${String(dMax).padStart(7)} | ${String(wMax).padStart(8)} | ` +
        `${mittel.toFixed(2).padStart(9)} | ${p95.toFixed(2).padStart(6)} | ${max.toFixed(1).padStart(6)} | ${String(ueber).padStart(5)} | ${tm.toFixed(2).padStart(7)} | ${tp.toFixed(2).padStart(8)} | ` +
        `${String(p.vehicles.lasterAufDemHof).padStart(6)} | ${String(p.betrieb.wartend).padStart(7)} | ` +
        `${String(p.vehicles.verladerAbfahrten).padStart(11)} | ${roh.toFixed(0).padStart(11)} | ${geld.toFixed(0).padStart(11)}`
    );
    ms = [];
    taktMs = [];
    kMax = dMax = wMax = 0;
  };
  const schritte = Math.round(sekunden / DT);
  for (let i = 0; i < schritte; i++) {
    const t0 = performance.now();
    p.takt();
    const dauer = performance.now() - t0;
    fahrer.schritt(DT);
    if (i > 60) taktMs.push(dauer);
    if (i > 60) ms.push(p.letzteMs); // die erste Sekunde ist WASM-Aufwärmen (`platzlast.ts`)
    if (i % 6 === 0) {
      const c = p.phys.counts();
      kMax = Math.max(kMax, c.bodies);
      dMax = Math.max(dMax, c.dynamic);
      wMax = Math.max(wMax, c.dynAwake);
      kGes = Math.max(kGes, c.bodies);
      dGes = Math.max(dGes, c.dynamic);
      wGes = Math.max(wGes, c.dynAwake);
    }
    const a = p.vehicles.schichtAnlieferer;
    if (a && a !== letzterAnlieferer && a.phaseName === "in") {
      letzterAnlieferer = a;
      fuhren.push({ fahrzeug: a.kind, teile: a.cargo.items.length, kg: a.cargoMassKg() });
    }
    const s = p.vehicles.schichtSiloWagen;
    if (s && s !== letzterSilo && s.phaseName === "in") {
      letzterSilo = s;
      fuhren.push({ fahrzeug: `${s.kind} (${s.sortedMaterial})`, teile: s.cargo.items.length, kg: s.cargoMassKg() });
    }
    if (p.vehicles.verladerAbfahrten > abfahrtenVorher) {
      abfahrtenVorher = p.vehicles.verladerAbfahrten;
      abfahrtAb = p.schichtS;
    }
    if (abfahrtAb !== null && p.vehicles.schichtVerlader?.waitingForLoad) {
      luecken.push(p.schichtS - abfahrtAb);
      abfahrtAb = null;
    }
    if ((i + 1) % 3600 === 0) zeile((i + 1) / 3600);
  }
  if (ms.length > 0) zeile(Math.ceil(schritte / 3600));
  console.log("\nFuhren (beim Einfahren):");
  for (const f of fuhren) console.log(`  ${f.fahrzeug.padEnd(20)} ${String(f.teile).padStart(3)} Teile  ${(f.kg / 1000).toFixed(1)} t`);
  console.log("Abfahrten Verlader:");
  for (const a of p.protokoll.abfahrten)
    console.log(`  ${a.t.toFixed(0).padStart(4)} s  ${String(a.order).padEnd(7)} ${String(a.teile).padStart(3)} Teile  ${(a.kg / 1000).toFixed(2)} t`);
  console.log(`Lücke Abfahrt → Nachrücker bereit: ${luecken.map((l) => l.toFixed(0) + " s").join(", ") || "—"}`);
  console.log("Standzeiten je Anlieferer:");
  for (const s of p.protokoll.standzeiten)
    console.log(`  ${s.t.toFixed(0).padStart(4)} s  ${s.fahrzeug.padEnd(9)} ${s.standzeitS.toFixed(0).padStart(4)} s (Standgeld ${standgeldSekunden(s.standzeitS).toFixed(0)} s)`);
  console.log(`Höchststand der Schicht: Körper ${kGes}, dynamisch ${dGes}, wach ${wGes}`);
  console.log(`Griffe: ${fahrer.griffe} · lose am Ende ${(p.loseKg / 1000).toFixed(1)} t · Meldungen ${p.protokoll.meldungen.length}`);
  if (process.env.MELDUNGEN === "1") console.log(p.protokoll.meldungen.join("\n"));
}

void main();
