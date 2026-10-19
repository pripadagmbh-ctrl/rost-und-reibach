/**
 * WRACKFOTOS (E-185) — Bilder vom Pkw-Wrack aus dem laufenden Spiel.
 *
 * Für die Abnahme der Zerlegung (Zerstörungskonzept 1.0): heil, Haube auf,
 * Motorraum, Motorraum leer, Innenraum durch die geborstene Scheibe, Rad mit
 * Felge. Dieselben Kamerapunkte (Wrack-lokal) in jedem Lauf — so lassen sich
 * zwei Stände vergleichen, etwa ein ausgepackter alter Stand gegen den
 * Arbeitsstand.
 *
 * Startet einen Dev-Server und ein Chromium aus dem Playwright-Vorrat (wie
 * `tools/aufgaben-smoke.mjs`), geht in den Sandkasten und fotografiert die
 * Spielszene mit einem zweiten Renderer (ohne HUD). Liest nur, schreibt
 * nichts im Spiel außer dem, was die Fotos verlangen (Bisse, Abrisse).
 *
 * Aufruf (in v1/):  node tools/wrackfotos.mjs <Ausgabeordner> [v1-Ordner] [Vorsilbe]
 *   v1-Ordner   anderer Stand (Vorgabe: dieser); braucht dort node_modules
 *   Vorsilbe    vor jedem Dateinamen, z. B. „vorher_"
 * Umgebung: FOTO_PORT (Vorgabe 5196)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUS = resolve(process.argv[2] ?? join(tmpdir(), "wrackfotos"));
const V1 = resolve(process.argv[3] ?? HIER);
const VOR = process.argv[4] ?? "";
mkdirSync(AUS, { recursive: true });
const PORT = Number(process.env.FOTO_PORT ?? 5196);
const BASIS = `http://127.0.0.1:${PORT}/`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function findeChromium() {
  const vorrat = join(homedir(), "AppData/Local/ms-playwright");
  const kandidaten = existsSync(vorrat) ? readdirSync(vorrat).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of kandidaten) {
    for (const unter of ["chrome-win64", "chrome-win"]) {
      const p = join(vorrat, d, unter, "chrome.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("Kein Chromium gefunden (ms-playwright).");
}
function toete(proc) {
  if (proc?.pid) spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
}
async function warteHttp(url, ms) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {
      /* noch nicht da */
    }
    await pause(200);
  }
  throw new Error(`keine Antwort von ${url}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.offen = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.offen.has(d.id)) {
        const { ok, nein } = this.offen.get(d.id);
        this.offen.delete(d.id);
        if (d.error) nein(new Error(`${d.error.message} ${d.error.data ?? ""}`));
        else ok(d.result);
      }
    };
  }
  static verbinde(url) {
    return new Promise((ok, nein) => {
      const ws = new WebSocket(url);
      ws.onopen = () => ok(new Cdp(ws));
      ws.onerror = (e) => nein(e);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, nein) => {
      const frist = setTimeout(() => nein(new Error(`CDP-Frist: ${method}`)), 120000);
      this.offen.set(id, { ok: (v) => (clearTimeout(frist), ok(v)), nein: (e) => (clearTimeout(frist), nein(e)) });
    });
  }
}

/** Im Spiel: ein Foto aus Wrack-lokalen Kamerapunkten, als PNG-Daten-URL. */
const HELFER = `(() => {
  window.__wrack = () => window.__game.composites.cars.find((k) => k.art === "pkw");
  window.__welt = (v) => {
    const T = window.__game.THREE, c = window.__wrack();
    const p = c.body.translation(), r = c.body.rotation();
    return new T.Vector3(v[0], v[1], v[2]).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).add(new T.Vector3(p.x, p.y, p.z));
  };
  window.__foto = (kamera, ziel) => {
    const g = window.__game, T = g.THREE;
    let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
    const cam = new T.PerspectiveCamera(40, 1.5, 0.05, 300);
    cam.position.copy(window.__welt(kamera));
    cam.lookAt(window.__welt(ziel));
    if (!window.__fotoR) {
      const R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      R.setSize(1200, 800, false);
      R.shadowMap.enabled = true;
      R.shadowMap.type = T.PCFSoftShadowMap;
      window.__fotoR = R;
    }
    window.__fotoR.render(sc, cam);
    return window.__fotoR.domElement.toDataURL("image/png");
  };
  /** Lose Teile aus dem Bild räumen: 30 m neben das Wrack. */
  window.__wegraeumen = () => {
    const g = window.__game, c = window.__wrack(), p = c.body.translation();
    for (const it of g.items.items) {
      if (it.body.handle === c.body.handle || !it.shape) continue;
      const t = it.body.translation();
      if (Math.hypot(t.x - p.x, t.z - p.z) < 4) it.body.setTranslation({ x: p.x + 30, y: 1, z: p.z + 30 }, true);
    }
  };
  return true;
})()`;

/** Kamerapunkte, Wrack-lokal (+z Schnauze, +x rechts). */
const VORN = [[2.7, 2.1, 4.7], [0, 0.7, 0.9]];
const MOTORRAUM = [[1.0, 2.7, 3.1], [0, 0.55, 1.3]];
const INNEN = [[2.3, 1.85, 0.1], [-0.1, 0.7, -0.35]];
const RAD = [[2.0, 0.75, 2.3], [0.82, 0.33, 1.25]];

let vite = null;
let chrome = null;
let profil = null;
try {
  console.log(`Dev-Server für ${V1} …`);
  vite = spawn(process.execPath, [join(V1, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: V1,
    stdio: "ignore",
  });
  await warteHttp(BASIS, 60000);
  profil = mkdtempSync(join(tmpdir(), "wrackfotos-profil-"));
  chrome = spawn(
    findeChromium(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profil}`,
      "--no-first-run",
      "--use-angle=d3d11",
      "--enable-unsafe-swiftshader",
      "--enable-gpu",
      "--disable-gpu-sandbox",
      "--no-sandbox",
      "--ignore-gpu-blocklist",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const portDatei = join(profil, "DevToolsActivePort");
  for (let k = 0; k < 200 && !existsSync(portDatei); k++) await pause(100);
  const cdpPort = readFileSync(portDatei, "utf8").split("\n")[0].trim();
  const version = await (await warteHttp(`http://127.0.0.1:${cdpPort}/json/version`, 20000)).json();
  const cdp = await Cdp.verbinde(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Emulation.setDeviceMetricsOverride", { width: 1180, height: 820, deviceScaleFactor: 1, mobile: false });
  const werte = async (expr) => {
    const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Seite: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const warte = async (expr, ms = 120000) => {
    const ende = Date.now() + ms;
    while (Date.now() < ende) {
      try {
        if (await werte(expr)) return;
      } catch {
        /* lädt */
      }
      await pause(100);
    }
    throw new Error(`Zeitüberschreitung: ${expr}`);
  };
  const foto = async (name, [kamera, ziel]) => {
    const url = await werte(`window.__foto(${JSON.stringify(kamera)}, ${JSON.stringify(ziel)})`);
    const pfad = join(AUS, `${VOR}${name}.png`);
    writeFileSync(pfad, Buffer.from(url.split(",")[1], "base64"));
    console.log("  ", pfad);
  };

  // Kein Erststart in Aufgabe 1 (E-162): Aufgabe 1 gilt als begonnen, dann kommt das Menü.
  await s("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { localStorage.setItem("schrottplatz_challenges", JSON.stringify({ "erster-griff": { sterne: 1 } })); } catch (e) {}`,
  });
  await s("Page.navigate", { url: BASIS });
  await warte("document.getElementById('hauptmenue')?.classList.contains('open')");
  await werte("document.getElementById('hm-sandkasten').click(), true");
  await warte("!!window.__game && window.__game.composites.cars.some((k) => k.art === 'pkw')");
  // Mittag statt Morgengrauen (Start 0,28): sonst liegt der Innenraum im Dunkeln
  await werte("(window.__game.daylight.time = 0.5), true");
  await pause(3000);
  await werte(HELFER);
  const neu = await werte("!!window.__wrack().teileDran");
  console.log(neu ? "Arbeitsstand (E-185)" : "alter Stand");

  await foto("1_heil_vorn", VORN);
  await foto("5a_rad_mit_felge", RAD);
  if (neu) {
    // Erster voller Biss auf die Haube: sie springt auf
    await werte("(() => { const c = window.__wrack(); c.beissen(15.7, window.__welt([0, 0.87, 1.33])); return c.haubeOffen; })()");
    await pause(600);
    await foto("2_haube_auf", VORN);
    await werte("(() => { const c = window.__wrack(); c.beissen(15.7, window.__welt([0, 0.87, 1.33])); return true; })()");
    await pause(1500);
    await werte("window.__wegraeumen(), true");
    await pause(500);
    await foto("3_haube_ab_vorn", VORN);
    await foto("4_motorraum", MOTORRAUM);
    await werte("(() => { const c = window.__wrack(); c.tearPart('batterie'); c.tearPart('kuehler'); c.tearPart('engine'); return true; })()");
  } else {
    await foto("4_motorraum", MOTORRAUM);
    await werte("(() => { const c = window.__wrack(); c.tearPart('engine'); c.tearPart('gearbox'); return true; })()");
  }
  await pause(1500);
  await werte("window.__wegraeumen(), true");
  await pause(500);
  await foto("4b_motorraum_leer", MOTORRAUM);
  // Scheiben bersten lassen und durch die rechte Seitenscheibe hineinschauen
  await werte("(() => { window.__wrack().shatterWindows(4); return true; })()");
  await pause(500);
  await foto("6_innenraum", INNEN);
  // Halb geknautscht: knautscht der Innenraum mit?
  await werte("(() => { window.__wrack().zusammendruecken(0.5); return true; })()");
  await pause(500);
  await foto("7_innenraum_halb_geknautscht", INNEN);
  console.log("fertig");
} finally {
  toete(chrome);
  toete(vite);
  if (profil) {
    await pause(500);
    try {
      rmSync(profil, { recursive: true, force: true });
    } catch {
      /* Chromium hält noch Dateien */
    }
  }
}
