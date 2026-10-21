/**
 * MÜLL-ABROLLER IM BILD (E-190) — Bilder vom Hochziehen, im echten Browser.
 *
 * Startet den Dev-Server (Port 5198) und ein Chromium aus dem Playwright-Vorrat
 * (wie `tools/aufgaben-smoke.mjs`), geht in den Sandkasten, bestellt „Müll"
 * und hält die Physik an, wenn der Abroller den vollen Container halb
 * hochgezogen hat. Dann je ein Bild in drei Ansichten (Orbit, Kabine, Seite)
 * und eines beim Abstellen des leeren.
 *
 * Aufruf (in v1/):  node tools/muell-bild.mjs <Ausgabeordner>
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V1 = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUS = resolve(process.argv[2] ?? join(tmpdir(), "muell-bild"));
mkdirSync(AUS, { recursive: true });
const PORT = Number(process.env.BILD_PORT ?? 5198);
const BASIS = `http://127.0.0.1:${PORT}/`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/** Chromium aus dem Playwright-Vorrat — wie `tools/tonwerk/tonwerk.mjs`. */
function findeChromium() {
  const vorrat = join(homedir(), "AppData/Local/ms-playwright");
  const kandidaten = existsSync(vorrat)
    ? readdirSync(vorrat).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    : [];
  for (const d of kandidaten) {
    for (const unter of ["chrome-win64", "chrome-win"]) {
      const p = join(vorrat, d, unter, "chrome.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("Kein Chromium gefunden (ms-playwright).");
}

function toete(proc) {
  if (!proc?.pid) return;
  spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
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

/* ---------------- CDP ---------------- */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.offen = new Map();
    this.hoerer = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.offen.has(d.id)) {
        const { ok, nein } = this.offen.get(d.id);
        this.offen.delete(d.id);
        if (d.error) nein(new Error(`${d.error.message} ${d.error.data ?? ""}`));
        else ok(d.result);
      } else if (d.method) for (const h of this.hoerer) h(d);
    };
    // Verbindung weg: alle offenen Anfragen scheitern lassen, sonst haengt der Ablauf still
    ws.onclose = () => {
      for (const { nein } of this.offen.values()) nein(new Error("CDP-Verbindung geschlossen"));
      this.offen.clear();
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
    if (process.env.SMOKE_SPUR) console.log("CDP", method);
    const id = ++this.id;
    if (this.ws.readyState !== 1) return Promise.reject(new Error("CDP-Verbindung geschlossen"));
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    // Jede Anfrage hat eine Frist (SW: 5 min, der Durchlauf ist die laengste) — nie still haengen
    return new Promise((ok, nein) => {
      const frist = setTimeout(() => {
        this.offen.delete(id);
        nein(new Error(`CDP-Frist: ${method}`));
      }, 300000);
      this.offen.set(id, { ok: (v) => (clearTimeout(frist), ok(v)), nein: (e) => (clearTimeout(frist), nein(e)) });
    });
  }
}


let vite = null;
let chrome = null;
try {
  vite = spawn(process.execPath, [join(V1, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: V1, stdio: "ignore" });
  await warteHttp(BASIS, 30000);
  const profil = mkdtempSync(join(tmpdir(), "muell-bild-profil-"));
  chrome = spawn(findeChromium(), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check",
    "--use-angle=d3d11", "--enable-unsafe-swiftshader", "--enable-gpu", "--disable-gpu-sandbox", "--no-sandbox", "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required", "about:blank",
  ], { stdio: "ignore" });
  const portDatei = join(profil, "DevToolsActivePort");
  for (let k = 0; k < 200 && !existsSync(portDatei); k++) await pause(100);
  const cdpPort = readFileSync(portDatei, "utf8").split(String.fromCharCode(10))[0].trim();
  const version = await (await warteHttp(`http://127.0.0.1:${cdpPort}/json/version`, 20000)).json();
  const cdp = await Cdp.verbinde(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Emulation.setDeviceMetricsOverride", { width: 1180, height: 820, deviceScaleFactor: 1, mobile: false });
  // Eine Aufgabe als geschafft merken, sonst startet das Spiel in Aufgabe 1
  await s("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("schrottplatz_challenges", JSON.stringify({ "erster-griff": { sterne: 1 } }))` });
  const werte = async (expr) => {
    const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Seite: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const warte = async (expr, ms = 120000) => {
    const ende = Date.now() + ms;
    while (Date.now() < ende) {
      try { const v = await werte(expr); if (v) return v; } catch { /* laedt */ }
      await pause(100);
    }
    throw new Error(`Zeitueberschreitung: ${expr}`);
  };
  const bild = async (name) => {
    await pause(400);
    const { data } = await s("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(AUS, `${name}.png`), Buffer.from(data, "base64"));
    log("Bild", name);
  };
  const taste = async (code, key) => {
    await s("Input.dispatchKeyEvent", { type: "keyDown", code, key });
    await pause(80);
    await s("Input.dispatchKeyEvent", { type: "keyUp", code, key });
    await pause(300);
  };
  await s("Page.navigate", { url: BASIS });
  await warte(`document.getElementById("hauptmenue")?.classList.contains("open")`);
  await werte(`document.getElementById("hm-sandkasten").click()`);
  await warte(`!!window.__game`);
  await pause(2500);
  await werte(`(() => { const g = window.__game; g.autoStep(false); g.vehicles.raeumePlatz(); g.vehicles.acceptDeliveries = false; return g.vehicles.requestPickup("rubble"); })()`);
  // Schritte, bis er abstellt — dann ein Bild; weiter, bis der volle halb oben ist
  const bisPhase = async (bedingung, max = 60 * 400) => {
    for (let n = 0; n < max; n += 120) {
      const ok = await werte(`(() => { const g = window.__game; g.step(120); const t = g.vehicles.pickupTruck; return t ? (${bedingung}) : false; })()`);
      if (ok) return true;
    }
    throw new Error("Phase nie erreicht: " + bedingung);
  };
  await taste("KeyH", "h"); // Tastenhilfe aus
  // Kamera schraeg von Osten und etwas hoeher: mittlere Maustaste ziehen
  const ziehe = async (dx, dy) => {
    const x = 590, y = 410;
    await s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await s("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "middle", buttons: 4, clickCount: 1 });
    for (let k = 1; k <= 10; k++) {
      await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (dx * k) / 10, y: y + (dy * k) / 10, button: "middle", buttons: 4 });
      await pause(30);
    }
    await s("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button: "middle", buttons: 0, clickCount: 1 });
    await pause(300);
  };
  await ziehe(Number(process.env.BILD_DX ?? 260), Number(process.env.BILD_DY ?? 60));
  await bisPhase(`t.phaseName === "hakenAb" && t.hakenAlpha > 1.0`);
  await bild("1_leer_abstellen_orbit");
  await bisPhase(`t.phaseName === "hakenAuf" && t.hakenAlpha < 1.4`);
  await bild("2_hochziehen_orbit");
  await taste("KeyC", "c"); // Draufsicht
  await bild("3_hochziehen_draufsicht");
  await taste("KeyC", "c"); // Kabine
  await bild("4_hochziehen_kabine");
  await taste("KeyC", "c"); // Seite
  await bild("5_hochziehen_seite");
  await taste("KeyC", "c"); // zurueck Orbit
  await bisPhase(`t.phaseName === "ausfaedeln" || t.phaseName === "out"`);
  await werte(`window.__game.step(240)`);
  await bild("6_weg_leerer_steht");
  const stand = await werte(`(() => { const g = window.__game; const m = g.containers.muell(); return { ort: m.ort, kg: m.contentKg, koerper: g.physics.world.bodies.len() }; })()`);
  log(JSON.stringify(stand));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  toete(chrome);
  toete(vite);
}
