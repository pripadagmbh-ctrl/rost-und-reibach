/**
 * AUFGABEN-SMOKE (Auftrag Q1, 19.10.2026) — Aufgabe 1 im echten Browser.
 *
 * Startet den Dev-Server (Port 5199) und ein Chromium aus dem Playwright-
 * Vorrat (kein Playwright-Paket), redet per CDP (Node-24-WebSocket) mit ihm:
 *   1. Erststart mit leerem Speicher: Screenshots iPhone mini / iPad (Touch)
 *   2. Ladezeiten kalt/warm/gedrosselt, Erststart und Rueckfall-Neustart
 *   3. ↻ ohne Neuladen, 5x: Dauer, Koerper, Netze, Heap
 *   4. Zeichenrufe/Physik-ms (F3-Overlay) Aufgabe vs. Sandkasten
 *   5. Durchlauf Aufgabe 1 per Tasten + `__game.step`, Abschlusstafel, Menue
 *
 * Aufruf (in v1/):  node tools/aufgaben-smoke.mjs <Ausgabeordner>
 * Schalter (Umgebung): SMOKE_PORT (Vorgabe 5199), LAEUFE (3), SMOKE_NUR=durchlauf
 * (nur iPad-Bild + Durchlauf + Menue), SMOKE_ANGLE (d3d11 | swiftshader), SMOKE_SPUR=1 (CDP-Aufrufe zeigen).
 * Dauer: rund 12 min (Ladezeiten 12 Seiten, Durchlauf ~1 min).
 * Ergebnis: <Ausgabeordner>/aufgaben-smoke.json + PNGs. Liest nur, schreibt nichts im Spiel.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V1 = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUS = resolve(process.argv[2] ?? join(tmpdir(), "aufgaben-smoke"));
mkdirSync(AUS, { recursive: true });
// 5199 laut Auftrag; belegt (fremder Dev-Server auf ::1) -> SMOKE_PORT setzen
const PORT = Number(process.env.SMOKE_PORT ?? 5199);
const BASIS = `http://127.0.0.1:${PORT}/`;
const LAEUFE = Number(process.env.LAEUFE ?? 3); // Auftrag: 3 Laeufe je Bedingung
const GERAETE = {
  mini: { width: 812, height: 375, deviceScaleFactor: 3, mobile: true },
  ipad: { width: 1180, height: 820, deviceScaleFactor: 2, mobile: true },
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const ergebnis = { datum: new Date().toISOString() };
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

/** Was in jede Seite vor ihrem ersten Skript kommt: Zeitmarken und Bus-Mitschrift. */
const VORSKRIPT = `(() => {
  const S = (window.__smoke = { log: [], karteMs: null, gameMs: null, fehler: [] });
  window.addEventListener("error", (e) => S.fehler.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => S.fehler.push(String(e.reason)));
  const pruefe = () => {
    const k = document.getElementById("tutorial");
    if (S.karteMs === null && k && k.classList.contains("open")) {
      S.karteMs = -1;
      S.karteOffenMs = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { S.karteMs = performance.now(); }));
    }
    const m = document.getElementById("hauptmenue");
    if (!S.menueMs && m && m.classList.contains("open")) S.menueMs = performance.now();
  };
  const beobachte = () => {
    new MutationObserver(pruefe).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    pruefe();
  };
  if (document.body) beobachte(); else document.addEventListener("DOMContentLoaded", beobachte);
  const warte = setInterval(() => {
    const g = window.__game;
    if (!g) return;
    clearInterval(warte);
    S.gameMs = performance.now();
    for (const n of ["challenge:start", "challenge:schritt", "challenge:geschafft", "challenge:neustart"])
      g.bus.on(n, (e) => S.log.push({ n, t: performance.now(), nr: e && e.nr, sterne: e && e.sterne }));
  }, 2);
})();`;

/** Zaehlung im Spiel — Koerper, Teile, Netze, Karte. */
const ZAEHLE = `(() => {
  const g = window.__game;
  let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
  let netze = 0; sc.traverse((o) => { if (o.isMesh || o.isInstancedMesh) netze++; });
  const boiler = g.items.items.filter((i) => i.shape && i.shape.name === "Kupfer-Boiler");
  const w = g.physics.world;
  const c = g.physics.counts();
  return {
    items: g.items.items.length, boiler: boiler.length,
    boilerPos: boiler.map((b) => { const p = b.body.translation(); return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; }),
    boilerBox: boiler.map((b) => b.containerId),
    koerper: c.bodies, wach: c.awake, beweglich: c.dynamic, kollider: w.colliders.len(), gelenke: w.impulseJoints.len(),
    wracks: g.composites.cars.length, netze, szeneKinder: sc.children.length,
    schritt: document.getElementById("tut-schritt")?.textContent,
    uhr: document.querySelector("#tutorial .uhr")?.textContent,
    titel: document.getElementById("tut-titel")?.textContent,
    karteOffen: document.getElementById("tutorial")?.classList.contains("open"),
    gegriffen: g.grip.grippedCount,
    gierGrad: +(g.excavator.cabinBaseYaw * 180 / Math.PI).toFixed(1),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
})()`;

/** Rechtecke der Bedienelemente (CSS-px) fuer die Verdeckungsfrage. */
const LAGE = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), sichtbar: s.display !== "none" && s.visibility !== "hidden" && b.width > 0 }; };
  const geister = [...document.querySelectorAll("#geisterdaumen .geist")].map((e) => ({ klasse: e.className, pfeil: e.dataset.pfeil, ...r(e) }));
  return {
    bodyTouch: document.body.classList.contains("touch"),
    fenster: [innerWidth, innerHeight, devicePixelRatio],
    karte: r(document.getElementById("tutorial")),
    karteText: document.getElementById("tutorial")?.innerText,
    neuKnopf: r(document.getElementById("tut-neu")),
    geister,
    stickLinks: r(document.getElementById("zone-left")), stickRechts: r(document.getElementById("zone-right")),
    webgl: (() => { try { const c = document.createElement("canvas").getContext("webgl2"); const x = c.getExtension("WEBGL_debug_renderer_info"); return x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : "?"; } catch (e) { return String(e); } })(),
  };
})()`;

/** F3 an, 3 s warten, Overlay lesen. */
const F3_LESEN = `(async () => {
  const d = document.getElementById("debug");
  if (d.style.display !== "block") { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); await new Promise((r) => requestAnimationFrame(r)); window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3" })); }
  await new Promise((r) => setTimeout(r, 3000));
  return d.innerText;
})()`;

/** Aufgabe 1 fahren wie `test/aufgabe1.test.ts` (Abschnitt 3), Schritte per `__game.step`. */
const DURCHLAUF = `(async () => {
  const g = window.__game, S = window.__smoke, GRAD = 180 / Math.PI, PRO_BILD = 4;
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const unten = new Set();
  const tasten = (ks) => {
    for (const k of [...unten]) if (!ks.includes(k)) { window.dispatchEvent(new KeyboardEvent("keyup", { code: k })); unten.delete(k); }
    for (const k of ks) if (!unten.has(k)) { window.dispatchEvent(new KeyboardEvent("keydown", { code: k })); unten.add(k); }
  };
  const nr = () => parseInt(document.getElementById("tut-schritt").textContent, 10) || 0;
  // Zwei Aufrufe: A = Schritte 1-5 per Tasten, B = Oeffnen (der Finger auf dem Stick kommt per CDP dazwischen)
  const B = !!window.__dl;
  const dl = (window.__dl ??= { t0: performance.now(), schritte: 0, spur: [], gesehen: [] });
  const t0 = dl.t0;
  const fertig = () => S.log.some((e) => e.n === "challenge:geschafft" && e.t >= t0);
  let i = 0;
  const eins = async () => { g.step(1); dl.schritte++; if (++i % PRO_BILD === 0) await raf(); };
  const lauf = async (max, bed = () => false) => { for (let k = 0; k < max && !bed(); k++) await eins(); };
  const fehler = (soll) => { let d = (soll - g.excavator.cabinBaseYaw) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const dreheAuf = async (soll, halten = []) => {
    let alt = g.excavator.cabinBaseYaw;
    for (let k = 0; k < 900; k++) {
      const d = fehler(soll), dreht = Math.abs(g.excavator.cabinBaseYaw - alt) > 0.0002;
      alt = g.excavator.cabinBaseYaw;
      const ks = [...halten];
      if (Math.abs(d) > 1.5 / GRAD) ks.push(d > 0 ? "KeyQ" : "KeyE"); else if (!dreht) break;
      tasten(ks); await eins();
    }
    tasten(halten);
  };
  const p = g.excavator.position;
  const teil = g.items.items.filter((x) => x.shape && x.shape.name === "Kupfer-Boiler").at(-1);
  const tp = teil.body.translation();
  const box = g.containers.ortVon("r_bunt");
  const gesehen = dl.gesehen;
  const lage = () => { const t = teil.body.translation(); const sp = g.excavator.getSensorPosition(new g.THREE.Vector3());
    return { nr: nr(), teil: [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)], spinne: [+sp.x.toFixed(2), +sp.y.toFixed(2), +sp.z.toFixed(2)],
      gegriffen: g.grip.grippedCount, gierGrad: +(g.excavator.cabinBaseYaw * GRAD).toFixed(1), box: teil.containerId,
      touch: { grapple: +g.touch.axes.grapple.toFixed(2), grab: g.touch.axes.grab, padRechtsZu: document.getElementById("touch-right")?.hidden } }; };
  const spur = dl.spur;
  g.autoStep(false);
  try {
    if (B) { spur.push(lage()); await lauf(900, fertig); for (let k = 0; k < 10; k++) await raf(); spur.push(lage()); } else {
    await dreheAuf(Math.atan2(tp.x - p.x, tp.z - p.z)); await lauf(60); await raf(); gesehen.push(nr()); spur.push(lage());
    tasten(["KeyF"]); await lauf(600, () => nr() >= 3); await lauf(40); tasten([]); gesehen.push(nr()); spur.push(lage());
    tasten(["Space"]); await lauf(300, () => nr() >= 4); gesehen.push(nr()); spur.push(lage());
    tasten(["Space", "KeyR"]); await lauf(600, () => nr() >= 5); await lauf(20); tasten(["Space"]); gesehen.push(nr()); spur.push(lage());
    await dreheAuf(Math.atan2(box.x - p.x, box.z - p.z), ["Space"]); await lauf(60); await raf(); gesehen.push(nr()); spur.push(lage());
    // Auf Touch haelt „Taste los" die Spinne (Stick neutral = Position halten, excavator.ts) — geoeffnet wird in B
    tasten([]); }
  } finally { tasten([]); g.autoStep(true); }
  const ende = S.log.filter((e) => e.n === "challenge:geschafft" && e.t >= t0).at(-1);
  return { phase: B ? "B" : "A", schliessung: +g.excavator.closure.toFixed(2), spur, boxOrt: box, gesehen, geschafft: !!ende, sterne: ende ? ende.sterne : null, physikSchritte: dl.schritte, spielzeitS: +(dl.schritte / 60).toFixed(1),
    wandMs: Math.round(performance.now() - t0), teilIn: teil.containerId, teilGueltig: teil.body.isValid() };
})()`;

/* ---------------- Ablauf ---------------- */
let vite = null;
let chrome = null;
let profil = null;
try {
  log("Dev-Server starten …");
  vite = spawn(process.execPath, [join(V1, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: V1,
    stdio: "ignore",
  });
  await warteHttp(BASIS, 30000);

  profil = mkdtempSync(join(tmpdir(), "aufgaben-smoke-profil-"));
  chrome = spawn(
    findeChromium(),
    [
      "--headless=new",
      // Port 0: Chromium waehlt selbst (feste Ports kollidierten mit sterbenden Vorgaengern)
      "--remote-debugging-port=0",
      `--user-data-dir=${profil}`,
      "--no-first-run",
      "--no-default-browser-check",
      // Echte Grafikkarte (D3D11). SwiftShader (SMOKE_ANGLE=swiftshader) brauchte hier ~11 s je Bild auf dem iPad-Format
      `--use-angle=${process.env.SMOKE_ANGLE ?? "d3d11"}`,
      "--enable-unsafe-swiftshader",
      "--enable-gpu",
      // Ohne: GPU-Prozess endet mit 0xC0000022 (Zugriff verweigert), Chromium beendet sich ("GPU process isn't usable")
      "--disable-gpu-sandbox",
      "--no-sandbox", // dito fuer den Renderer: Page.enable kam sonst nie zurueck
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
      "--enable-precise-memory-info",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const portDatei = join(profil, "DevToolsActivePort");
  for (let k = 0; k < 200 && !existsSync(portDatei); k++) await pause(100);
  const cdpPort = readFileSync(portDatei, "utf8").split("\n")[0].trim();
  const version = await (await warteHttp(`http://127.0.0.1:${cdpPort}/json/version`, 20000)).json();
  const cdp = await Cdp.verbinde(version.webSocketDebuggerUrl);
  ergebnis.browser = version.Browser;

  /** Neue Seite in eigenem Kontext (= leerer Speicher, leerer Cache). */
  const neueSeite = async (geraet, drossel = 1) => {
    const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => cdp.send(m, p, sessionId);
    await s("Page.enable");
    await s("Runtime.enable");
    await s("Network.enable");
    await s("Emulation.setDeviceMetricsOverride", GERAETE[geraet]);
    await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await s("Emulation.setCPUThrottlingRate", { rate: drossel });
    await s("Page.addScriptToEvaluateOnNewDocument", { source: VORSKRIPT });
    const werte = async (expr) => {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`Seite: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const warte = async (expr, ms = 120000) => {
      const ende = Date.now() + ms;
      while (Date.now() < ende) {
        try {
          const v = await werte(expr);
          if (v) return v;
        } catch {
          /* Seite laedt gerade */
        }
        await pause(50);
      }
      throw new Error(`Zeitueberschreitung: ${expr}`);
    };
    const bild = async (name) => {
      const { data } = await s("Page.captureScreenshot", { format: "png" });
      const pfad = join(AUS, `${name}.png`);
      writeFileSync(pfad, Buffer.from(data, "base64"));
      return pfad;
    };
    /** Echter Finger: touchStart/touchEnd auf die Mitte eines Elements. */
    const tippe = async (sel) => {
      const r = await werte(`(() => { const b = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return b && b.width ? [b.x + b.width / 2, b.y + b.height / 2] : null; })()`);
      if (!r) throw new Error(`nicht tippbar: ${sel}`);
      const punkt = [{ x: r[0], y: r[1], id: 1, force: 0.5 }]; // force 1 (CDP-Vorgabe) waere „Druckgriff" (touch.ts checkPressure)
      await s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: punkt });
      await pause(60);
      await s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const zu = () => cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => null);
    return { s, werte, warte, bild, tippe, zu };
  };
  /** Bis die Karte offen ist und zwei Bilder gezeichnet sind (ms ab Navigationsstart). */
  const karteBereit = (p) => p.warte("window.__smoke && window.__smoke.karteMs > 0 && window.__game && window.__smoke.karteMs");
  const ladeMs = async (p) => {
    await karteBereit(p);
    return p.werte("({ karteMs: Math.round(__smoke.karteMs), karteOffenMs: Math.round(__smoke.karteOffenMs), dclMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? -1), anfragen: performance.getEntriesByType('resource').length, gameMs: Math.round(__smoke.gameMs), fehler: __smoke.fehler })");
  };

  const NUR = process.env.SMOKE_NUR ?? "";
  if (!NUR) {
  /* --- 0: Server-Erstlauf (Vite wandelt beim allerersten Abruf um; nicht Teil der Tabelle) */
  {
    const p = await neueSeite("mini");
    await p.s("Page.navigate", { url: BASIS });
    ergebnis.serverErstlauf = await ladeMs(p);
    await p.zu();
    log("Server-Erstlauf", ergebnis.serverErstlauf);
  }

  /* --- 1: Ladezeiten, Erststart und Rueckfall-Neustart */
  ergebnis.ladezeiten = [];
  for (const drossel of [1, 4]) {
    for (let lauf = 1; lauf <= LAEUFE; lauf++) {
      const p = await neueSeite("mini", drossel);
      // kalt: frischer Kontext, leerer Cache und Speicher
      await p.s("Page.navigate", { url: BASIS });
      const kalt = await ladeMs(p);
      // warm: Cache bleibt, Speicher geleert -> wieder Erststart
      await p.werte("window.__smoke.karteMs = 0");
      await p.s("Storage.clearDataForOrigin", { origin: BASIS.slice(0, -1), storageTypes: "local_storage" });
      await p.s("Page.navigate", { url: BASIS });
      const warm = await ladeMs(p);
      // Rueckfall-Neustart warm: genau das, was `nochmal(id)` tut
      await p.werte(`window.__smoke.karteMs = 0; location.hash = "challenge=erster-griff"; location.reload(); true`).catch(() => null);
      await pause(100);
      const rueckWarm = await ladeMs(p);
      // Rueckfall-Neustart kalt: Cache vorher geleert
      await p.s("Network.clearBrowserCache");
      await p.werte(`window.__smoke.karteMs = 0; location.hash = "challenge=erster-griff"; location.reload(); true`).catch(() => null);
      await pause(100);
      const rueckKalt = await ladeMs(p);
      const zeile = { drossel, lauf, kalt, warm, rueckWarm, rueckKalt };
      ergebnis.ladezeiten.push(zeile);
      log("Ladezeit", drossel, lauf, kalt.karteMs, warm.karteMs, rueckWarm.karteMs, rueckKalt.karteMs);
      await p.zu();
    }
  }

  } // Ende !NUR
  /* --- 2: Erststart-Bilder auf beiden Geraeten */
  ergebnis.bilder = {};
  for (const geraet of NUR ? ["ipad"] : ["mini", "ipad"]) {
    const p = await neueSeite(geraet);
    await p.s("Page.navigate", { url: BASIS });
    await karteBereit(p);
    const erstes = await p.bild(`${geraet}_1_erstes-bild`);
    const lage1 = await p.werte(LAGE);
    await pause(3000);
    const nach3 = await p.bild(`${geraet}_2_nach-3s`);
    const lage2 = await p.werte(LAGE);
    const zahl = await p.werte(ZAEHLE);
    ergebnis.bilder[geraet] = { erstes, nach3, lage1, lage2, zahl };
    if (geraet === "mini") await p.zu();
    else ergebnis.ipadSeite = p; // weiter unten benutzt
  }

  /* --- 3..6 auf dem iPad */
  const p = ergebnis.ipadSeite;
  delete ergebnis.ipadSeite;
  ergebnis.aufgabeF3 = await p.werte(F3_LESEN);
  ergebnis.aufgabeZahl = await p.werte(ZAEHLE);
  await p.bild("ipad_3_f3-aufgabe");

  // ↻ ohne Neuladen, 5x ueber den Bus, dann 1x per Finger auf den Knopf
  ergebnis.neustart = [];
  await p.s("HeapProfiler.collectGarbage");
  ergebnis.neustartVorher = await p.werte(ZAEHLE);
  await p.werte("window.__marke = 'gleiche Seite'; true");
  for (let n = 1; n <= (NUR ? 0 : 6); n++) {
    const weg = n <= 5 ? "bus" : "finger";
    let dauer;
    if (weg === "bus") {
      dauer = await p.werte(`(async () => {
        const g = __game;
        if (!g.items.__gemessen) { const alt = g.items.settle; g.items.settle = function (...a) { const t = performance.now(); const r = alt.apply(this, a); window.__settleMs = performance.now() - t; return r; }; g.items.__gemessen = true; }
        const t0 = performance.now(); const vor = __smoke.log.length;
        __game.bus.emit("challenge:neustart", {});
        const tStart = (__smoke.log.slice(vor).find((e) => e.n === "challenge:start") || {}).t;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { bisStartMs: tStart ? +(tStart - t0).toFixed(1) : null, settleMs: +(window.__settleMs ?? -1).toFixed(1), bisBildMs: +(performance.now() - t0).toFixed(1) };
      })()`);
    } else {
      const vor = await p.werte("__smoke.log.length");
      const t0 = Date.now();
      await p.tippe("#tut-neu");
      await p.warte(`__smoke.log.slice(${vor}).some((e) => e.n === "challenge:start")`, 5000);
      dauer = { finger: true, wandMs: Date.now() - t0 };
    }
    await pause(1500); // ein paar Bilder laufen lassen (Uhr, Ruhe)
    await p.s("HeapProfiler.collectGarbage");
    const z = await p.werte(ZAEHLE);
    z.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'");
    ergebnis.neustart.push({ n, weg, dauer, ...z });
    log("Neustart", n, weg, JSON.stringify(dauer), z.koerper, z.items, z.boiler, z.netze, z.schritt, z.uhr, z.heapMB);
  }
  await p.bild("ipad_4_nach-neustart");

  // Durchlauf Aufgabe 1
  ergebnis.durchlaufA = await p.werte(DURCHLAUF);
  log("Durchlauf A", JSON.stringify(ergebnis.durchlaufA));
  // Schritt 6 wie ein Mensch: dem Geisterdaumen folgen — aufsetzen, wo er steht, in Pfeilrichtung ziehen
  ergebnis.geistSchritt6 = await p.werte(`(() => { const e = document.querySelector("#geisterdaumen .geist.an"); if (!e) return null; const b = e.getBoundingClientRect();
    return { seite: e.classList.contains("links") ? "links" : "rechts", pfeil: e.dataset.pfeil, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await p.bild("ipad_4b_schritt6-geist");
  if (ergebnis.geistSchritt6) {
    const { x, y, pfeil } = ergebnis.geistSchritt6;
    const weg = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] }[pfeil] ?? [0, 0];
    await p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 7, force: 0.5 }] });
    for (let k = 1; k <= 6; k++) {
      await pause(30);
      await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14 * k, y: y + weg[1] * 14 * k, id: 7, force: 0.5 }] });
    }
  }
  ergebnis.durchlauf = await p.werte(DURCHLAUF);
  await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  log("Durchlauf", JSON.stringify(ergebnis.durchlauf));
  if (ergebnis.durchlauf.geschafft) {
    await p.warte("document.getElementById('abrechnung').classList.contains('open')", 10000);
    await pause(1500); // Sterne-Animation
    ergebnis.tafel = await p.werte(`(() => { const t = (id) => { const e = document.getElementById(id); return e ? { text: e.innerText, versteckt: e.hidden } : null; };
      return { kopf: t("abr-kopf"), sterne: t("abr-sterne"), zahlen: t("abr-zahlen"), nochmal: t("abr-weiter"), naechste: t("abr-naechste"), menue: t("abr-menue"),
        ablage: localStorage.getItem("schrottplatz_challenges") }; })()`);
    ergebnis.tafelBild = await p.bild("ipad_5_abschlusstafel");
    // NOCHMAL: der Bagger ist nur gedreht, nicht gefahren -> Neuaufbau ohne Neuladen
    const vor = await p.werte("__smoke.log.length");
    await p.tippe("#abr-weiter");
    await p.warte(`__smoke.log.slice(${vor}).some((e) => e.n === "challenge:start")`, 5000).catch(() => null);
    await pause(1500);
    ergebnis.nachNochmal = await p.werte(ZAEHLE);
    ergebnis.nachNochmal.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'");
    await p.bild("ipad_6_nach-nochmal");
  }

  // Rueckfall: Bagger > 1 m fahren, dann ↻ -> neu laden
  await p.werte(`(async () => { const g = __game; g.autoStep(false); window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    const s0 = g.excavator.position.clone(); window.__s0 = s0;
    for (let k = 0; k < 600 && g.excavator.position.distanceTo(s0) < 1.6; k++) { g.step(1); if (k % 4 === 3) await new Promise((r) => requestAnimationFrame(r)); }
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" })); g.autoStep(true); return true; })()`);
  ergebnis.rueckfallFahrweg = await p.werte("+__game.excavator.position.distanceTo(window.__s0).toFixed(2)");
  await p.werte("window.__smoke.karteMs = 0");
  await p.tippe("#tut-neu");
  await pause(300);
  ergebnis.rueckfall = await ladeMs(p);
  ergebnis.rueckfall.neueSeite = await p.werte("window.__marke !== 'gleiche Seite'");
  ergebnis.rueckfall.zahl = await p.werte(ZAEHLE);
  log("Rueckfall", JSON.stringify(ergebnis.rueckfall));

  // Menue: ohne Adresse neu laden (Ablage ist gesetzt)
  await p.s("Page.navigate", { url: BASIS });
  await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
  await pause(500);
  ergebnis.menue = await p.werte(`[...document.querySelectorAll("#hauptmenue button")].map((b) => ({ id: b.id, text: b.innerText.replace(/\\n/g, " / "), gesperrt: b.disabled }))`);
  ergebnis.menueBild = await p.bild("ipad_7_menue");
  await p.tippe("#hm-sandkasten");
  await p.warte("window.__game && window.__smoke.gameMs", 60000);
  await pause(4000); // Platz zur Ruhe kommen lassen
  ergebnis.sandkastenF3 = await p.werte(F3_LESEN);
  ergebnis.sandkastenZahl = await p.werte(ZAEHLE);
  await p.bild("ipad_8_f3-sandkasten");
  ergebnis.seitenfehler = await p.werte("__smoke.fehler");
  await p.zu();
} catch (e) {
  ergebnis.abbruch = String(e?.stack ?? e);
  console.error(e);
} finally {
  writeFileSync(join(AUS, "aufgaben-smoke.json"), JSON.stringify(ergebnis, null, 2));
  toete(chrome);
  toete(vite);
  try {
    if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* Chromium haelt das Profil noch — liegt im Temp-Ordner */
  }
  log(`Ergebnis: ${join(AUS, "aufgaben-smoke.json")}`);
}
