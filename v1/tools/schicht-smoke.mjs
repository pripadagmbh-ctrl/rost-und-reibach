/**
 * SCHICHT-SMOKE (Auftrag S5, 21.10.2026) — die Schicht im echten Browser.
 *
 * Startet den Dev-Server (Port 5202) und ein Chromium aus dem Playwright-
 * Vorrat (playwright-core aus dem npx-Speicher, kein Paket im Projekt). Für
 * jede Stufe `#schicht=montag|mittwoch|freitag`:
 *   1. Laden ohne Konsolenfehler; der Verlader steht am Halt vorn.
 *   2. ~2 min vorspulen über `__game.step` — 1 s je Happen, die Schicht-Uhr
 *      (`daylight`, läuft sonst nur im Bildtakt, main.ts) jeweils mit.
 *   3. Mindestens eine Fuhre ist angekommen (Anlieferer an der Annahme bzw.
 *      am Lager in einer Abladephase).
 *   4. Bilder: Orbit und Draufsicht (Taste C).
 * Exit-Code 1, wenn eine Prüfung reißt.
 *
 * Aufruf (in v1/):  node tools/schicht-smoke.mjs <Ausgabeordner>
 * Schalter: SMOKE_PORT (5202), SMOKE_SEKUNDEN (120), SMOKE_STUFEN (montag,mittwoch,freitag),
 * SMOKE_ANGLE (d3d11 | swiftshader).
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V1 = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUS = resolve(process.argv[2] ?? join(tmpdir(), "schicht-smoke"));
mkdirSync(AUS, { recursive: true });
const PORT = Number(process.env.SMOKE_PORT ?? 5202); // Auftrag S5
const SEKUNDEN = Number(process.env.SMOKE_SEKUNDEN ?? 120); // Auftrag S5: ~2 min
const STUFEN = (process.env.SMOKE_STUFEN ?? "montag,mittwoch,freitag").split(",");
/** Halt des Verladers vorn (`routes.VERLADER_VORN`, gerechnet aus BAGGER_STAND, E-201). */
const VORN = { x: 0.7503, z: -15.4094 };
/** Phasen, in denen ein Anlieferer an seinem Halt ist (`vehicles.ts`, Typ Phase). */
const ANGEKOMMEN = ["pauseBeforeUnload", "tipping", "tipHold", "tipCreep", "tipBack", "waitUnload", "muldeHeben", "muldeRuhe", "muldeKippen", "muldeLeeren", "muldeSenken", "muldeLoesen"];

function findePlaywright() {
  const npx = join(homedir(), "AppData/Local/npm-cache/_npx");
  for (const d of existsSync(npx) ? readdirSync(npx) : []) {
    const p = join(npx, d, "node_modules/playwright-core");
    if (existsSync(p)) return createRequire(import.meta.url)(p);
  }
  throw new Error("playwright-core nicht im npx-Speicher (einmal `npx playwright-core --version` ausführen).");
}
function findeChromium() {
  const vorrat = join(homedir(), "AppData/Local/ms-playwright");
  for (const d of existsSync(vorrat) ? readdirSync(vorrat).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse() : []) {
    for (const unter of ["chrome-win64", "chrome-win"]) {
      const p = join(vorrat, d, unter, "chrome.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("Kein Chromium gefunden (ms-playwright).");
}
async function warteHttp(url, ms) {
  const bis = Date.now() + ms;
  while (Date.now() < bis) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* noch nicht da */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev-Server antwortet nicht: ${url}`);
}

const { chromium } = findePlaywright();
const vite = spawn(process.execPath, [join(V1, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: V1, stdio: "ignore" });
const ergebnis = { datum: new Date().toISOString(), sekunden: SEKUNDEN, stufen: {} };
let gerissen = 0;
try {
  await warteHttp(`http://127.0.0.1:${PORT}/`, 60000);
  for (const stufe of STUFEN) {
    // Je Stufe ein eigener Browser: im selben Browser bekam die zweite Seite keinen WebGL-Kontext mehr (aufgaben-smoke.mjs)
    const browser = await chromium.launch({ executablePath: findeChromium(), args: [`--use-angle=${process.env.SMOKE_ANGLE ?? "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const r = { fehler: [], pruefungen: {}, verlauf: [] };
    ergebnis.stufen[stufe] = r;
    try {
      const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
      page.on("pageerror", (e) => r.fehler.push("pageerror: " + e.message));
      page.on("console", (m) => {
        if (m.type() === "error") r.fehler.push(m.text());
      });
      const t0 = Date.now();
      await page.goto(`http://127.0.0.1:${PORT}/#schicht=${stufe}`);
      await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
      r.ladenS = (Date.now() - t0) / 1000;
      await page.waitForTimeout(2000);
      await page.keyboard.press("KeyH"); // Hilfetafel aus, damit die Bilder den Platz zeigen
      const halt = await page.evaluate((vorn) => {
        const g = window.__game;
        const v = g.vehicles.schichtVerlader;
        // Was der kopflose Prüfstand nicht hat: die Körper des Baggers (mit Spinne)
        let bagger = 0, baggerBeweglich = 0;
        g.physics.world.bodies.forEach((k) => {
          if (!g.excavator.selfHandles.has(k.handle)) return;
          bagger++;
          if (k.isDynamic()) baggerBeweglich++;
        });
        return v ? { wartet: v.waitingForLoad, abstand: Math.hypot(v.group.position.x - vorn.x, v.group.position.z - vorn.z), art: v.kind, bagger, baggerBeweglich, koerper: g.physics.counts() } : null;
      }, VORN);
      r.pruefungen.verladerAmHalt = !!halt && halt.wartet && halt.abstand < 0.5; // SW: 0,5 m wie schichtbetrieb.test.ts nach dem Nachrücken
      r.verladerStart = halt;
      let angekommen = false;
      for (let s = 0; s < SEKUNDEN; s++) {
        const z = await page.evaluate((ank) => {
          const g = window.__game;
          g.autoStep(false);
          g.step(60);
          g.daylight.update(1);
          g.autoStep(true);
          const v = g.vehicles;
          const c = g.physics.counts();
          const da = v.fahrzeuge.some((f) => f !== v.schichtVerlader && f !== v.schichtNachruecker && ank.includes(f.phaseName));
          return { t: Math.round(g.daylight.schichtSekunden), uhr: g.daylight.clock, koerper: c.bodies, dyn: c.dynamic, wach: c.dynAwake, laster: v.lasterAufDemHof, da, phasen: v.fahrzeuge.map((f) => `${f.kind}/${f.phaseName}`) };
        }, ANGEKOMMEN);
        angekommen ||= z.da;
        if (s % 10 === 9) r.verlauf.push(z);
      }
      r.pruefungen.fuhreAngekommen = angekommen;
      r.pruefungen.keineKonsolenfehler = r.fehler.length === 0;
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(AUS, `${stufe}-orbit.png`) });
      await page.keyboard.press("KeyC");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(AUS, `${stufe}-draufsicht.png`) });
    } catch (e) {
      r.fehler.push("Smoke: " + (e?.message ?? e));
      r.pruefungen.durchgelaufen = false;
    } finally {
      await browser.close();
    }
    const rot = Object.entries(r.pruefungen).filter(([, ok]) => !ok).map(([k]) => k);
    gerissen += rot.length;
    const letzte = r.verlauf.at(-1);
    console.log(`${stufe}: ${rot.length ? "ROT " + rot.join(", ") : "grün"} · geladen ${r.ladenS?.toFixed(1)} s · ${letzte ? `${letzte.uhr}, Körper ${letzte.koerper} (dyn ${letzte.dyn}, wach ${letzte.wach}), Laster ${letzte.laster}` : "—"} · Fehler ${r.fehler.length}`);
    for (const f of r.fehler.slice(0, 5)) console.log("   " + f);
  }
} finally {
  writeFileSync(join(AUS, "schicht-smoke.json"), JSON.stringify(ergebnis, null, 2));
  spawnSync("taskkill", ["/pid", String(vite.pid), "/T", "/F"], { stdio: "ignore" });
}
process.exit(gerissen > 0 ? 1 : 0);
