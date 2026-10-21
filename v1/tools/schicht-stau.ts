/**
 * SCHICHT-STAU (Befund S5-1, E-202) — viele Freitage hintereinander, je einer
 * frisch (eigener Prozess je Saat, sonst verläuft eine Saat anders, siehe
 * `test/schichtleistung-befund.test.ts`), Test-Fahrer 1 Teil/4 s.
 *
 * Druckt je Saat: längster Stillstand eines Lasters außerhalb gewollten
 * Wartens (`RUHIGE_PHASEN`) und wer, Verlader-Abfahrten, die Lücke Abfahrt →
 * Nachrücker bereit, Fuhren, Körper. Am Ende eine Zeile je Saat als Tabelle.
 *
 * Aufruf:  npx vite-node tools/schicht-stau.ts
 *   SAATEN=1-10 (Vorgabe)   STUFE=freitag   GRIFF=4
 *   SAAT=n: nur diese eine (so ruft das Werkzeug sich selbst je Saat auf)
 */
import { spawn } from "node:child_process";
import { initPhysics } from "../src/physics/physicsWorld";
import { festerZufall, leistungsLauf, LEISTUNGS_SCHRANKEN } from "../test/schichtlauf";
import type { Schichtstufe } from "../src/economy/kasse";

async function eineSaat(saat: number): Promise<void> {
  await initPhysics();
  const stufe = (process.env.STUFE ?? "freitag") as Schichtstufe;
  const griffS = Number(process.env.GRIFF ?? 4);
  festerZufall(saat * 7919 + 13); // derselbe Zufall wie `freitagLauf` und `tools/schicht-lauf.ts`
  const b = leistungsLauf({ stufe, saat, griffS, ruheS: 0 });
  const l = b.luecken;
  const zeile = [
    saat,
    b.laengsterStand.toFixed(0),
    b.laengsterStand < LEISTUNGS_SCHRANKEN.stillstandS ? "ok" : "STAU",
    `${b.abfahrtenVorFeierabend}/${b.abfahrten}`,
    l.length ? `${Math.min(...l).toFixed(0)}–${Math.max(...l).toFixed(0)} (Ø ${(l.reduce((s, x) => s + x, 0) / l.length).toFixed(0)})` : "—",
    b.fuhren,
    b.koerperMax,
    b.wer,
  ];
  console.log(`ZEILE|${zeile.join("|")}`);
}

/** Eine Saat in einem eigenen Prozess — frischer Modulzustand. */
function lauf(saat: number): Promise<string> {
  return new Promise((fertig) => {
    const k = spawn("npx", ["vite-node", "tools/schicht-stau.ts"], { env: { ...process.env, SAAT: String(saat) }, shell: true });
    let aus = "";
    let fehler = "";
    k.stdout.on("data", (d) => (aus += String(d)));
    k.stderr.on("data", (d) => (fehler += String(d)));
    k.on("close", () => {
      const z = aus.split("\n").find((x) => x.startsWith("ZEILE|"));
      fertig(z ? z.slice(6).trim() : `${saat}|Fehler: ${fehler.slice(0, 200)}`);
    });
  });
}

async function alle(): Promise<void> {
  const [von, bis] = (process.env.SAATEN ?? "1-10").split("-").map(Number);
  const saaten: number[] = [];
  for (let s = von!; s <= (bis ?? von!); s++) saaten.push(s);
  const parallel = Number(process.env.PARALLEL ?? 4); // SW: so viele Kerne hat der Dev-PC frei
  const zeilen = new Map<number, string>();
  const warte = [...saaten];
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let s = warte.shift(); s !== undefined; s = warte.shift()) {
        zeilen.set(s, await lauf(s));
        console.log(zeilen.get(s));
      }
    })
  );
  console.log("\n| Saat | längster Stillstand s | | Verlader ab (vor FA/ges.) | Lücke Abfahrt→bereit s | Fuhren | Körper max | wer (längster) |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const s of saaten) console.log(`| ${zeilen.get(s)!.split("|").join(" | ")} |`);
}

if (process.env.SAAT) void eineSaat(Number(process.env.SAAT));
else void alle();
