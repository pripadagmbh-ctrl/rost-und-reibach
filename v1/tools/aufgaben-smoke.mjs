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
 * (nur iPad-Bild + Durchlauf + Menue), SMOKE_NUR=aufgaben (Q2: je Aufgabe aus SMOKE_AUFGABE=id,id …,
 * Vorgabe 2-6, auf mini und iPad: Erstbild, Projektion der Marken, F3, ↻ Bus + Finger, Geisterdaumen-Probe; ~10 min), SMOKE_ANGLE (d3d11 | swiftshader), SMOKE_SPUR=1 (CDP-Aufrufe zeigen).
 * SMOKE_NUR=lehrgang (Q3, E-196): je Geraet (SMOKE_GERAET=mini,ipad) Erststart → Lektion 1–3 per Touch
 * (Vorfuehrung beobachten, je eine abbrechen, nachmachen, WEITER), danach Pruefung 1, Menue, Englisch.
 * Je Geraet einen eigenen Aufruf (SMOKE_GERAET=mini, dann =ipad): Im selben Browser bekam das zweite Geraet
 * keinen WebGL-Kontext mehr („context loss … blocked"). ~4 min (mini) bzw. ~6 min (iPad) je Aufruf.
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
  // Q3: iPhone-mini-Format mit DPR 1 — nur um headless mehr Bilder je Sekunde zu bekommen (Vorfuehrung vs. Bildrate)
  mini1: { width: 812, height: 375, deviceScaleFactor: 1, mobile: true },
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

/** Q2: Zustand fuer ↻-Vergleich — Koerper, Karte, Uhr, Greifer, Pratzen, Magnet. */
const ZUSTAND = `(() => {
  const g = window.__game, x = g.excavator, c = g.physics.counts();
  return { koerper: c.bodies, wach: c.awake, kollider: g.physics.world.colliders.len(), gelenke: g.physics.world.impulseJoints.len(),
    items: g.items.items.length, wracks: g.composites.cars.length,
    schritt: document.getElementById("tut-schritt")?.textContent, uhr: document.querySelector("#tutorial .uhr")?.textContent,
    karteText: document.getElementById("tutorial")?.innerText.replace(/\\n+/g, " | "),
    greifer: x.form && (x.form.id ?? x.form.name), magnetForm: !!(x.form && x.form.magnet), magnetAn: x.magnetAn,
    schliessung: +x.closure.toFixed(3), gierGrad: +(x.cabinBaseYaw * 180 / Math.PI).toFixed(2),
    abgestuetzt: x.abgestuetzt, pratzeUnten: +x.outriggerDown.toFixed(2), pratzeSoll: x.outriggerTarget, gegriffen: g.grip.grippedCount,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    nan: [x.position.x, x.position.y, x.position.z, x.cabinBaseYaw, x.closure].some((v) => !Number.isFinite(v)) };
})()`;

/** Q2: Aufgabenobjekte (Teile, Wracks, Marken, Zielmarke) auf den Bildschirm rechnen — Kamera ueber onBeforeRender abgegriffen. */
const PROJEKTION = (id) => `(async () => {
  const g = window.__game, T = g.THREE;
  let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
  let netz = null; g.excavator.root.traverse((o) => { if (!netz && o.isMesh && o.visible) netz = o; });
  const alt = netz.onBeforeRender; let cam = null;
  netz.onBeforeRender = function (r, s, c) { cam = c; return alt.apply(this, arguments); };
  for (let k = 0; k < 3 && !cam; k++) await new Promise((r) => requestAnimationFrame(r));
  netz.onBeforeRender = alt;
  if (!cam) return { fehler: "keine Kamera" };
  const { challengeNach } = await import("/src/challenges/katalog.ts");
  const d = challengeNach(${JSON.stringify(id)});
  const marken = await new Promise((ok) => { const ab = g.bus.on("challenge:stand", (e) => { ok(e.marken.map((m) => ({ ...m }))); if (typeof ab === "function") ab(); }); setTimeout(() => ok(null), 1500); });
  const auf = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), vorKamera: v.z < 1 && v.z > -1 }; };
  const namen = (d.aufbau.teile ?? []).map((t) => t.name);
  const teile = g.items.items.slice(-namen.length).map((i) => { const p = i.body.translation(); return { name: i.shape && i.shape.name, ...auf(p.x, p.y, p.z) }; });
  const wracks = g.composites.cars.map((c) => { const p = c.body.translation(); return { art: c.def && c.def.id, ...auf(p.x, p.y, p.z) }; });
  const k = document.getElementById("tutorial").getBoundingClientRect();
  const unterKarte = (q) => q.x >= k.left && q.x <= k.right && q.y >= k.top && q.y <= k.bottom;
  const alle = [...teile.map((q) => ({ was: "teil " + q.name, ...q })), ...wracks.map((q) => ({ was: "wrack", ...q })),
    ...(marken ?? []).map((m) => ({ was: "marke " + m.art, ...auf(m.x, m.y, m.z) })),
    ...(d.zielMarke ? [{ was: "zielMarke", ...auf(d.zielMarke.x, d.zielMarke.y, d.zielMarke.z) }] : []),
    ...(d.ablageziel ? [{ was: "ablageziel", ...auf(d.ablageziel.x, 0, d.ablageziel.z) }] : [])];
  return { karte: { links: Math.round(k.left), oben: Math.round(k.top), rechts: Math.round(k.right), unten: Math.round(k.bottom) },
    punkte: alle.map((q) => ({ ...q, imBild: q.vorKamera && q.x >= 0 && q.x <= innerWidth && q.y >= 0 && q.y <= innerHeight, unterKarte: unterKarte(q) })),
    namenSoll: namen };
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

/* ---------------- Q3: Lehrgang (E-196) ---------------- */

/**
 * Vor dem ersten Skript: Bus und Kamera abhoeren, ohne `src/` anzufassen.
 * Gleiche Modul-URL wie main.ts -> dieselbe Instanz; gepatcht wird nur das
 * Prototyp-Objekt (Mitschrift), das Verhalten bleibt gleich.
 */
const LEHRGANG_HAKEN = `(() => {
  const S = window.__smoke;
  const snap = () => { const g = window.__game, o = window.__orbit; if (!g) return null; const x = g.excavator;
    return { cab: x.cabYaw, boom: x.boomAngle, stick: x.stickAngle, x: x.position.x, z: x.position.z, heading: x.heading,
      kam: o ? { ...o.blick } : null }; };
  S.snap = snap;
  // Bildrate: Abstand der letzten 60 Bilder (ms) — headless ist sie niedriger als auf dem Geraet
  S.bilder = []; const raf = (t) => { S.bilder.push(t); if (S.bilder.length > 61) S.bilder.shift(); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  S.fps = () => { const b = S.bilder; return b.length > 1 ? +((1000 * (b.length - 1)) / (b[b.length - 1] - b[0])).toFixed(1) : null; };
  import("/src/excavator/orbitCamera.ts").then((m) => {
    const P = m.OrbitCamera.prototype, u = P.update, d = Object.getOwnPropertyDescriptor(P, "blick");
    P.update = function (...a) { window.__orbit = this; return u.apply(this, a); };
    if (d && d.get) Object.defineProperty(P, "blick", { configurable: true, get() { window.__orbit = this; return d.get.call(this); } });
  });
  import("/src/core/events.ts").then((m) => {
    const P = m.EventBus.prototype, em = P.emit;
    S.hakenDa = true;
    P.emit = function (n, e) {
      if (n.startsWith("lehrgang:") || (n.startsWith("challenge:") && n !== "challenge:stand"))
        S.log.push({ n, t: performance.now(), id: e && e.id, nr: e && e.nr, phase: e && e.phase, abgebrochen: e && e.abgebrochen,
          marke: e && e.marke ? { ...e.marke } : undefined, zeitS: e && e.zeitS, zust: snap(),
          karte: document.getElementById("tutorial") ? document.getElementById("tutorial").innerText.replace(/\\n+/g, " | ") : null });
      return em.call(this, n, e);
    };
  });
})();`;

const GEIST_LESEN = `(() => ({ t: performance.now(), geister: [...document.querySelectorAll("#geisterdaumen .geist.an")].map((e) => { const b = e.getBoundingClientRect();
  return { seite: e.classList.contains("links") ? "links" : "rechts", folgt: e.classList.contains("folgt"), dx: +(e.style.getPropertyValue("--dx") || 0), dy: +(e.style.getPropertyValue("--dy") || 0),
    pfeil: e.dataset.pfeil ?? null, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; }),
  kamgeist: document.querySelector("#geisterdaumen .kamgeist.an")?.dataset.geste ?? null,
  schild: document.querySelector("#geisterdaumen .tastengeist.an")?.textContent ?? null,
  pedaleLeuchten: !!document.querySelector("#pedals.geist-zeigt"),
  karte: document.getElementById("tutorial")?.innerText.replace(/\\n+/g, " | ") }))()`;

const ZONEN = `(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const k = document.getElementById("tutorial").getBoundingClientRect();
  return { mitte: r("zone-mitte"), links: r("zone-left"), rechts: r("zone-right"), W: innerWidth, H: innerHeight, karteUnten: k.bottom, karteRechts: k.right, karteLinks: k.left }; })()`;

const MENUE_LESEN = `(() => { const el = document.getElementById("hauptmenue");
  const kn = [...el.querySelectorAll("button")].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 0).map((b) => { const q = b.getBoundingClientRect();
    return { id: b.id, text: b.innerText.replace(/\\n/g, " / "), aria: b.getAttribute("aria-label"), x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height),
      drin: q.top >= -0.5 && q.bottom <= innerHeight + 0.5 && q.left >= -0.5 && q.right <= innerWidth + 0.5, gesperrt: b.disabled }; });
  const ueber = []; for (let i = 0; i < kn.length; i++) for (let j = i + 1; j < kn.length; j++) { const a = kn[i], b = kn[j];
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) ueber.push([a.text, b.text]); }
  const roll = [el, ...el.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 1 && !["visible"].includes(getComputedStyle(e).overflowY)).map((e) => e.id || e.className);
  return { offen: el.classList.contains("open"), liste: !document.getElementById("hm-liste").hidden, titel: document.getElementById("hm-listentitel")?.textContent,
    knoepfe: kn, ueberlappen: ueber, rollbar: roll, seiteRollt: document.documentElement.scrollHeight > innerHeight + 1, fenster: [innerWidth, innerHeight] }; })()`;

/** Lektion 1-3 je Geraet per Touch, dann Pruefung 1, Menue, Englisch. */
async function lehrgangSmoke(cdp, neueSeite) {
  ergebnis.lehrgang = {};
  const geraete = (process.env.SMOKE_GERAET ?? "mini,ipad").split(",");
  for (const geraet of geraete) {
    const R = (ergebnis.lehrgang[geraet] = { lektionen: {} });
    const p = await neueSeite(geraet);
    const konsole = [];
    const hoer = (d) => {
      if (d.sessionId !== p.sid) return;
      if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "assert"].includes(d.params.type))
        konsole.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
      if (d.method === "Runtime.exceptionThrown") konsole.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 300));
    };
    cdp.hoerer.push(hoer);
    R.konsole = konsole;
    await p.s("Page.addScriptToEvaluateOnNewDocument", { source: LEHRGANG_HAKEN });
    // Patricks Geraete sind deutsch; Chromium headless meldet sonst en-US (ui/sprache.ts ermittleSprache)
    const ua = (await cdp.send("Browser.getVersion")).userAgent;
    await p.s("Network.setUserAgentOverride", { userAgent: ua, acceptLanguage: "de-DE,de" });
    await p.s("Emulation.setLocaleOverride", { locale: "de-DE" }).catch(() => null);

    const T = (type, pts) => p.s("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, force: 0.5 })) });
    const logLaenge = () => p.werte("__smoke.log.length");
    const warteEv = (ab, bed, ms = 20000) =>
      p.warte(`(() => { const L = __smoke.log; for (let k = ${ab}; k < L.length; k++) { const e = L[k]; if (${bed}) return { ...e, k }; } return null; })()`, ms);
    const hatEv = (ab, bed) => p.werte(`(() => { const L = __smoke.log; for (let k = ${ab}; k < L.length; k++) { const e = L[k]; if (${bed}) return true; } return false; })()`);
    /** Finger aufsetzen, ziehen (Versatz je Finger), halten bis `bis()` oder `maxMs`, loslassen. */
    const zieh = async (finger, { haltMs = 0, bis = null, maxMs = 12000, schritte = 6 } = {}) => {
      const pts = [];
      const laeuft = [];
      for (const f of finger) {
        pts.push([f.x, f.y, f.id]);
        laeuft.push(T("touchStart", pts.map((q) => [...q])));
      }
      // erster Zug ohne Warten: sonst klappt rechts der Funktionskranz auf (RADIAL_HOLD_S, siehe Q2)
      for (let k = 1; k <= schritte; k++) {
        const z = T("touchMove", finger.map((f) => [f.x + (f.dx * k) / schritte, f.y + (f.dy * k) / schritte, f.id]));
        if (k === 1) await Promise.all(laeuft);
        await z;
        await pause(30);
      }
      const t0 = Date.now();
      let erreicht = false;
      if (bis) while (Date.now() - t0 < maxMs) { if (await bis()) { erreicht = true; break; } await pause(50); }
      else await pause(haltMs);
      await T("touchEnd", []);
      return { erreicht, haltMs: Date.now() - t0 };
    };
    const tipp = async (x, y, ms = 60) => {
      await T("touchStart", [[x, y, 9]]);
      await pause(ms);
      await T("touchEnd", []);
    };
    // Doppeltipp ohne auf die Quittung zu warten: Bei wenigen Bildern je Sekunde (headless) kaemen die Tipps
    // sonst > 320 ms auseinander an (DOUBLE_TAP_MS, touch.ts) — auf dem Geraet liegen 60 Bilder/s dazwischen
    const doppel = async (x, y) => {
      const a = [T("touchStart", [[x, y, 9]])];
      await pause(50);
      a.push(T("touchEnd", []));
      await pause(110);
      a.push(T("touchStart", [[x, y, 9]]));
      await pause(50);
      a.push(T("touchEnd", []));
      await Promise.all(a);
    };
    const freierPunkt = async (zone, kandidaten) => {
      for (const [fx, fy] of kandidaten) {
        const pkt = await p.werte(`(() => { const b = document.getElementById(${JSON.stringify(zone)}).getBoundingClientRect(); const x = b.x + b.width * ${fx}, y = b.y + b.height * ${fy};
          const e = document.elementFromPoint(x, y); return e && e.id === ${JSON.stringify(zone)} ? [Math.round(x), Math.round(y)] : null; })()`);
        if (pkt) return pkt;
      }
      throw new Error(`kein freier Punkt in ${zone}`);
    };

    const runde = (z) => z && { cabGrad: +((z.cab * 180) / Math.PI).toFixed(2), boomGrad: +((z.boom * 180) / Math.PI).toFixed(2), stickGrad: +((z.stick * 180) / Math.PI).toFixed(2),
      x: +z.x.toFixed(3), z: +z.z.toFixed(3), headingGrad: +((z.heading * 180) / Math.PI).toFixed(2),
      kam: z.kam && { modus: z.kam.modus, gierGrad: +((z.kam.gier * 180) / Math.PI).toFixed(2), nickGrad: +((z.kam.nick * 180) / Math.PI).toFixed(2), abstand: +z.kam.abstand.toFixed(3) } };
    const diff = (a, b) => {
      if (!a || !b) return null;
      const d = { cabGrad: b.cabGrad - a.cabGrad, boomGrad: b.boomGrad - a.boomGrad, stickGrad: b.stickGrad - a.stickGrad, wegM: Math.hypot(b.x - a.x, b.z - a.z), headingGrad: b.headingGrad - a.headingGrad };
      if (a.kam && b.kam) Object.assign(d, { kamModusGleich: a.kam.modus === b.kam.modus, gierGrad: b.kam.gierGrad - a.kam.gierGrad, nickGrad: b.kam.nickGrad - a.kam.nickGrad, abstandRel: b.kam.abstand / a.kam.abstand - 1 });
      for (const k of Object.keys(d)) if (typeof d[k] === "number") d[k] = +d[k].toFixed(3);
      return d;
    };
    /** Startlage gilt als erreicht: Winkel < 0,5°, Weg < 2 cm, Kamera < 0,5° / 1 % (SW, wie lektion.ts START_TOL) */
    const inStartlage = (d) => !!d && Math.abs(d.cabGrad) < 0.5 && Math.abs(d.boomGrad) < 0.5 && Math.abs(d.stickGrad) < 0.5 && d.wegM < 0.02 && Math.abs(d.headingGrad) < 0.5 &&
      (d.gierGrad === undefined || (d.kamModusGleich && Math.abs(d.gierGrad) < 0.5 && Math.abs(d.nickGrad) < 0.5 && Math.abs(d.abstandRel) < 0.01));

    /* --- Lektion fahren. `plan[nr]`: { abbruch: "mitte"|"links", bildZeigen, bildDu, f3, tu: async (ctx) => … } */
    const fahreLektion = async (id, plan) => {
      const L = (R.lektionen[id] = { schritte: [] });
      const st = await warteEv(0, `e.n === "lehrgang:start" && e.id === ${JSON.stringify(id)}`, 90000);
      const wandStart = Date.now();
      L.start = { karte: st.karte, menueOffen: await p.werte(`document.getElementById("hauptmenue").classList.contains("open")`), adresse: await p.werte("location.hash"), sprache: await p.werte("navigator.language") };
      let ab = st.k;
      for (let nr = 1; ; nr++) {
        const pl = plan[nr] ?? {};
        const ev = await warteEv(ab, `(e.n === "lehrgang:schritt" && e.nr === ${nr}) || e.n === "lehrgang:geschafft"`, 30000);
        if (ev.n === "lehrgang:geschafft") break;
        const S = { nr, phase1: ev.phase, karteBeginn: ev.karte, marke: ev.marke ?? null };
        L.schritte.push(S);
        ab = ev.k;
        const tBeginn = Date.now();
        const proben = [];
        if (ev.phase === "zeigen") {
          const vf = await warteEv(ab, `e.n === "lehrgang:vorfuehren"`, 5000);
          S.vorher = runde(vf.zust);
          let abgebrochen = false;
          let bildGemacht = false;
          for (;;) {
            const g = await p.werte(GEIST_LESEN);
            proben.push({ ms: Date.now() - tBeginn, ...g });
            if (!bildGemacht && pl.bildZeigen && Date.now() - tBeginn > (pl.bildNachMs ?? 600)) {
              S.geistVorBild = await p.werte(GEIST_LESEN);
              S.fpsZeigen = await p.werte("__smoke.fps()");
              S.bildZeigen = await p.bild(`${geraet}_${id}_s${nr}_zeigen`);
              S.geistBeimBild = await p.werte(GEIST_LESEN);
              bildGemacht = true;
            }
            if (pl.abbruch && !abgebrochen && Date.now() - tBeginn > (pl.bildNachMs ?? 600) + 200) {
              const z = await p.werte(ZONEN);
              const [ax, ay] = pl.abbruch === "mitte" ? await freierPunkt("zone-mitte", [[0.5, 0.65], [0.5, 0.8]]) : await freierPunkt("zone-left", [[0.5, 0.55], [0.6, 0.45], [0.4, 0.4]]);
              S.abbruch = { wo: pl.abbruch, x: ax, y: ay, msNachBeginn: Date.now() - tBeginn, tSeite: await p.werte("performance.now()"), zonen: z };
              await tipp(ax, ay, 400); // 400 ms: auch bei wenigen Bildern je Sekunde sieht die Wiedergabe den Finger
              abgebrochen = true;
            }
            if (await hatEv(ab, `e.n === "lehrgang:vorfuehrungEnde"`)) break;
            if (Date.now() - tBeginn > 30000) throw new Error(`Vorfuehrung ${id}/${nr} endet nicht`);
            await pause(80);
          }
          const ende = await warteEv(ab, `e.n === "lehrgang:vorfuehrungEnde"`, 1000);
          S.vorfuehrungMs = Date.now() - tBeginn;
          // Seitenuhr: wirkliche Dauer der Vorfuehrung (Spur 2,6-5 s) und wann der Abbruch-Finger kam
          S.vorfuehrungSeiteMs = Math.round(ende.t - vf.t);
          S.erkanntNachMs = Math.round(proben[0] ? proben[0].t - vf.t : -1);
          if (S.abbruch) S.abbruch.nachVorfuehrenMs = Math.round(S.abbruch.tSeite - vf.t);
          S.abgebrochen = ende.abgebrochen;
          S.nachher = runde(ende.zust);
          S.delta = diff(S.vorher, S.nachher);
          S.inStartlage = inStartlage(S.delta);
          const du = await warteEv(ab, `e.n === "lehrgang:schritt" && e.nr === ${nr} && e.phase === "du"`, 5000);
          ab = du.k;
          S.karteDu = du.karte;
          // Geist in der Vorfuehrung: Ausschlag je Seite, Kamera-Gesten, Schild
          const max = { links: null, rechts: null };
          // erster deutlicher Ausschlag = Hinweg (der Rueckweg kommt spaeter und zeigt entgegen)
          // Nur Proben aus der ersten Sekunde — sonst kann es der Rueckweg sein (Schritt 1 beginnt beim Laden, bevor wir zusehen)
          for (const q of proben) for (const g of q.geister) if (g.folgt && !max[g.seite] && Math.hypot(g.dx, g.dy) > 0.3 && q.t - vf.t < 1000) max[g.seite] = { ...g, nachMs: Math.round(q.t - vf.t) };
          S.geistFolgt = max;
          S.kamGesten = [...new Set(proben.map((q) => q.kamgeist).filter(Boolean))];
          S.schilder = [...new Set(proben.map((q) => q.schild).filter(Boolean))];
          S.pedaleLeuchteten = proben.some((q) => q.pedaleLeuchten);
          S.proben = proben.length;
        }
        await pause(400); // Karte „Jetzt du" steht
        S.geistDu = await p.werte(GEIST_LESEN);
        if (pl.bildDu) S.bildDu = await p.bild(`${geraet}_${id}_s${nr}_du`);
        if (pl.f3) {
          S.f3 = await p.werte(F3_LESEN);
          S.f3Zahl = await p.werte(`(() => { const c = __game.physics.counts(); return { koerper: c.bodies, wach: c.awake, kollider: __game.physics.world.colliders.len(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; })()`);
          await p.bild(`${geraet}_${id}_f3`);
          // F3 wieder aus, damit die folgenden Bilder ohne Overlay sind
          await p.werte(`(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3" })); return true; })()`);
        }
        const haken = () => hatEv(ab, `e.n === "lehrgang:haekchen" && e.nr === ${nr}`);
        const tDu = Date.now();
        S.aktion = await pl.tu({ haken, S });
        const hk = await warteEv(ab, `e.n === "lehrgang:haekchen" && e.nr === ${nr}`, 15000).catch(() => null);
        S.haekchen = !!hk;
        S.duMs = Date.now() - tDu;
        if (hk) {
          S.nachHaken = runde(hk.zust);
          await pause(150);
          S.karteHaken = await p.werte(`document.getElementById("tutorial").innerText.replace(/\\n+/g, " | ")`);
          if (pl.bildHaken) S.bildHaken = await p.bild(`${geraet}_${id}_s${nr}_haken`);
          ab = hk.k;
        } else {
          S.bildFehlt = await p.bild(`${geraet}_${id}_s${nr}_KEIN-HAKEN`);
          S.stand = await p.werte(`__smoke.snap()`);
          throw new Error(`kein Haekchen ${id}/${nr}`);
        }
        log(geraet, id, nr, "zeigen:", S.vorfuehrungMs ?? "-", "ms abgebrochen:", S.abgebrochen ?? "-", "Startlage:", S.inStartlage ?? "-", "Haken:", S.haekchen, S.duMs, "ms");
      }
      const gs = await warteEv(ab, `e.n === "lehrgang:geschafft"`, 5000);
      L.geschafftSpielzeitS = +gs.zeitS.toFixed(1);
      L.wandS = +((Date.now() - wandStart) / 1000).toFixed(1);
      await p.warte("document.getElementById('abrechnung').classList.contains('open')", 10000);
      await pause(1500);
      L.tafel = await p.werte(`(() => { const t = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { text: e.innerText, versteckt: e.hidden, drin: b.bottom <= innerHeight && b.top >= 0 }; };
        return { kopf: t("abr-kopf"), sterne: t("abr-sterne"), zahlen: t("abr-zahlen"), weiter: t("abr-weiter"), naechste: t("abr-naechste"), menue: t("abr-menue"), lehrgang: localStorage.getItem("schrottplatz_lehrgang") }; })()`);
      L.tafelBild = await p.bild(`${geraet}_${id}_tafel`);
      log(geraet, id, "geschafft", L.geschafftSpielzeitS, "s Spielzeit,", L.wandS, "s Wand; Tafel:", JSON.stringify([L.tafel.kopf?.text, L.tafel.weiter?.text, L.tafel.naechste?.text, L.tafel.menue?.text]));
      writeFileSync(join(AUS, "aufgaben-smoke.json"), JSON.stringify(ergebnis, null, 2));
    };

    /* Bausteine fuer „du" */
    const mitte = async () => {
      const [x, y] = await freierPunkt("zone-mitte", [[0.5, 0.6], [0.5, 0.75], [0.5, 0.45]]);
      return { x, y };
    };
    const VEKTOR = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1], quer: [1, 0], laengs: [0, -1] };
    /** Dem Geist folgen: Richtung aus der Vorfuehrung (gemessener Ausschlag), sonst aus dem Pfeil in „du". */
    const folgeGeist = async ({ haken, S }) => {
      const finger = [];
      let id = 21;
      for (const seite of ["links", "rechts"]) {
        const f = S.geistFolgt?.[seite];
        const du = S.geistDu.geister.find((g) => g.seite === seite);
        let v = null;
        // Wie ein Mensch: zuerst der Pfeil in „du", sonst die Richtung, die der Geist in der Vorfuehrung zeigte
        if (du?.pfeil) v = VEKTOR[du.pfeil];
        else if (f && Math.hypot(f.dx, f.dy) > 0.1) v = [Math.sign(Math.round(f.dx * 2) / 2) * Math.min(1, Math.abs(f.dx) * 2), Math.sign(Math.round(f.dy * 2) / 2) * Math.min(1, Math.abs(f.dy) * 2)];
        if (!v || (v[0] === 0 && v[1] === 0)) continue;
        const [x, y] = du ? [du.x, du.y] : await freierPunkt(seite === "links" ? "zone-left" : "zone-right", [[0.5, 0.55], [0.6, 0.45]]);
        finger.push({ x, y, dx: v[0] * 84, dy: v[1] * 84, id: id++, seite });
      }
      if (!finger.length) throw new Error("kein Geist zum Folgen");
      const r = await zieh(finger, { bis: haken });
      return { finger: finger.map((f) => ({ seite: f.seite, x: f.x, y: f.y, dx: f.dx, dy: f.dy })), ...r };
    };
    const pedal = async () => {
      await p.tippe("#pedal-l");
      await pause(300);
      return p.werte(`document.getElementById("touch").classList.contains("fahren")`);
    };

    const PLAN = {
      kamera: {
        1: { bildZeigen: true, bildNachMs: 0, bildDu: true, bildHaken: true, tu: async ({ haken }) => { const m = await mitte(); return zieh([{ ...m, dx: 120, dy: 0, id: 31 }], { haltMs: 300 }).then(async (r) => ({ ...r, haken: await haken() })); } },
        2: { bildZeigen: true, tu: async () => { const m = await mitte(); return zieh([{ x: m.x, y: m.y - 30, dx: 0, dy: 70, id: 32 }], { haltMs: 300 }); } },
        3: { bildZeigen: true, abbruch: "mitte", bildNachMs: 500, tu: async () => { const m = await mitte(); return zieh([{ x: m.x, y: m.y - 20, dx: 0, dy: -60, id: 33 }, { x: m.x, y: m.y + 20, dx: 0, dy: 60, id: 34 }], { haltMs: 300 }); } },
        4: { bildZeigen: true, bildNachMs: 800, tu: async ({ haken }) => { const [x, y] = await freierPunkt("zone-right", [[0.5, 0.4], [0.4, 0.3], [0.6, 0.5]]); let n = 0; for (; n < 4 && !(await haken()); n++) { await doppel(x, y); await pause(900); } return { x, y, doppeltipps: n }; } },
        5: { tu: async ({ haken }) => { const [x, y] = await freierPunkt("zone-right", [[0.5, 0.4], [0.4, 0.3], [0.6, 0.5]]); let n = 0; for (; n < 8 && !(await haken()); n++) { await doppel(x, y); await pause(700); } return { doppeltipps: n }; } },
        6: { bildZeigen: true, bildNachMs: 400, tu: async ({ haken }) => { const m = await mitte(); await zieh([{ ...m, dx: -100, dy: 0, id: 35 }], { haltMs: 200 }); await pause(300); let n = 0; for (; n < 4 && !(await haken()); n++) { await doppel(m.x, m.y); await pause(900); } return { m, doppeltipps: n }; } },
      },
      "fahren-schwenken": {
        1: { bildZeigen: true, bildNachMs: 0, bildDu: true, tu: folgeGeist },
        2: { abbruch: "links", bildNachMs: 100, tu: folgeGeist },
        3: { bildZeigen: true, bildNachMs: 800, tu: async (c) => ({ fahrenAn: await pedal(), ...(await folgeGeist(c)) }) },
        4: { tu: folgeGeist },
        5: { tu: async (c) => ({ fahrenAn: await pedal(), ...(await folgeGeist(c)) }) },
      },
      "ausleger-stiel": {
        1: { bildZeigen: true, bildDu: true, f3: true, tu: folgeGeist },
        2: { tu: folgeGeist },
        3: { tu: folgeGeist },
        4: { tu: folgeGeist },
        5: { bildZeigen: true, bildNachMs: 500, bildDu: true, bildHaken: true, tu: folgeGeist },
      },
    };

    // 1. Erststart, leerer Speicher
    await p.s("Page.navigate", { url: BASIS });
    R.erststart = { hakenDa: await p.warte("window.__smoke && window.__smoke.hakenDa", 30000) };
    await fahreLektion("kamera", PLAN.kamera);
    R.erststart.menueNieOffen = await p.werte("!__smoke.menueMs");
    for (const [id, weiter] of [["fahren-schwenken", true], ["ausleger-stiel", true]]) {
      if (weiter) await p.tippe("#abr-weiter");
      await fahreLektion(id, PLAN[id]);
    }
    R.konsoleNachLektionen = konsole.length;

    // 7. WEITER nach Lektion 3 -> Pruefung 1 (erster-griff)
    await p.tippe("#abr-weiter");
    await warteEv(0, `e.n === "challenge:start"`, 90000);
    await pause(2500);
    R.pruefung = { adresse: await p.werte("location.hash"), lage: await p.werte(LAGE), geist: await p.werte(GEIST_LESEN) };
    R.pruefung.bild = await p.bild(`${geraet}_pruefung1_nach-weiter`);
    R.pruefung.neuSichtbar = R.pruefung.lage.neuKnopf?.sichtbar;
    // ↻ per Finger: Neustart ohne Neuladen
    await p.werte("window.__marke = 'gleiche Seite'; true");
    const vorNeu = await logLaenge();
    await p.tippe("#tut-neu");
    R.pruefung.neustart = !!(await warteEv(vorNeu, `e.n === "challenge:start"`, 8000).catch(() => null));
    R.pruefung.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'").catch(() => false);
    await pause(1500);
    R.pruefung.bildNachNeu = await p.bild(`${geraet}_pruefung1_nach-neustart`);
    R.pruefung.seitenfehler = await p.werte("__smoke.fehler");

    // 4. Menue nach dem ersten Start
    await p.s("Page.navigate", { url: BASIS });
    await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
    await pause(500);
    R.menue = { haupt: await p.werte(MENUE_LESEN), hauptBild: await p.bild(`${geraet}_menue_1_haupt`) };
    await p.tippe("#hm-lehrgang");
    await pause(400);
    R.menue.lektionen = await p.werte(MENUE_LESEN);
    R.menue.lektionenBild = await p.bild(`${geraet}_menue_2_lektionen`);
    await p.tippe("#hm-zurueck");
    await pause(300);
    await p.tippe("#hm-pruefungen");
    await pause(400);
    R.menue.pruefungen = await p.werte(MENUE_LESEN);
    R.menue.pruefungenBild = await p.bild(`${geraet}_menue_3_pruefungen`);
    log(geraet, "Menue", JSON.stringify(R.menue.haupt.knoepfe.map((k) => k.text)), JSON.stringify(R.menue.lektionen.knoepfe.map((k) => k.text)));

    // 5. Englisch: Karte (Lektion 1, Vorfuehrung) und Menue
    await p.werte(`localStorage.setItem("sprache", "en"); true`);
    // Nur die Raute aendern laedt nicht neu (gleiche Seite) — darum wie `zurLektion` mit reload
    await p.werte(`location.hash = "lektion=kamera"; location.reload(); true`).catch(() => null);
    await pause(300);
    const enStart = await warteEv(0, `e.n === "lehrgang:start"`, 90000);
    await warteEv(enStart.k, `e.n === "lehrgang:schritt" && e.phase === "zeigen"`, 5000);
    await pause(700);
    R.englisch = { karte: await p.werte(GEIST_LESEN), karteBild: await p.bild(`${geraet}_en_karte-zeigen`) };
    await warteEv(enStart.k, `e.n === "lehrgang:schritt" && e.phase === "du"`, 15000);
    await pause(400);
    R.englisch.karteDu = await p.werte(GEIST_LESEN);
    R.englisch.karteDuBild = await p.bild(`${geraet}_en_karte-du`);
    await p.s("Page.navigate", { url: BASIS });
    await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
    await pause(500);
    R.englisch.menue = await p.werte(MENUE_LESEN);
    R.englisch.menueBild = await p.bild(`${geraet}_en_menue_haupt`);
    await p.tippe("#hm-lehrgang");
    await pause(400);
    R.englisch.lektionen = await p.werte(MENUE_LESEN);
    R.englisch.lektionenBild = await p.bild(`${geraet}_en_menue_lektionen`);
    R.seitenfehler = await p.werte("__smoke.fehler");
    cdp.hoerer.splice(cdp.hoerer.indexOf(hoer), 1);
    writeFileSync(join(AUS, "aufgaben-smoke.json"), JSON.stringify(ergebnis, null, 2));
    await p.zu();
  }
}

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
    return { s, sid: sessionId, werte, warte, bild, tippe, zu };
  };
  /** Bis die Karte offen ist und zwei Bilder gezeichnet sind (ms ab Navigationsstart). */
  const karteBereit = (p) => p.warte("window.__smoke && window.__smoke.karteMs > 0 && window.__game && window.__smoke.karteMs");
  const ladeMs = async (p) => {
    await karteBereit(p);
    return p.werte("({ karteMs: Math.round(__smoke.karteMs), karteOffenMs: Math.round(__smoke.karteOffenMs), dclMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? -1), anfragen: performance.getEntriesByType('resource').length, gameMs: Math.round(__smoke.gameMs), fehler: __smoke.fehler })");
  };

  const NUR = process.env.SMOKE_NUR ?? "";
  ablauf: {
  if (NUR === "aufgaben") {
    // Q2: Aufgaben 2-6 je Geraet — Erstbild, Lage, F3, ↻, Geisterdaumen-Probe
    const ids = (process.env.SMOKE_AUFGABE ?? "verladen,sortieren,platt-machen,magnet,schwere-last").split(",");
    ergebnis.aufgaben = {};
    for (const id of ids) {
      for (const geraet of ["mini", "ipad"]) {
        const p = await neueSeite(geraet);
        const konsole = [];
        const hoer = (d) => {
          if (d.sessionId !== p.sid) return;
          if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "assert"].includes(d.params.type))
            konsole.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
          if (d.method === "Runtime.exceptionThrown") konsole.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 300));
        };
        cdp.hoerer.push(hoer);
        await p.s("Page.navigate", { url: `${BASIS}#challenge=${id}` });
        await karteBereit(p);
        const r = { erstes: await p.bild(`${id}_${geraet}_1_erstes-bild`), lage1: await p.werte(LAGE), proj1: await p.werte(PROJEKTION(id)) };
        await pause(3000);
        r.nach3 = await p.bild(`${id}_${geraet}_2_nach-3s`);
        r.lage2 = await p.werte(LAGE);
        r.proj2 = await p.werte(PROJEKTION(id));
        r.f3 = await p.werte(F3_LESEN);
        await p.s("HeapProfiler.collectGarbage");
        r.vorher = await p.werte(ZUSTAND);
        if (id === "schwere-last") {
          // Pratzen ab (Taste O), warten bis ganz unten — ↻ muss sie einfahren (main.ts starteAufgabe)
          await p.werte(`(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyO" })); setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyO" })), 100); return true; })()`);
          await p.warte("__game.excavator.abgestuetzt", 15000).catch(() => null);
          r.pratzenVorNeustart = await p.werte(ZUSTAND);
        }
        await p.werte(`__game.bus.emit("challenge:neustart", {}); true`);
        await pause(2000);
        await p.s("HeapProfiler.collectGarbage");
        r.nachBus = await p.werte(ZUSTAND);
        r.nachBusBild = await p.bild(`${id}_${geraet}_3_nach-neustart`);
        // Geisterdaumen: dort aufsetzen, in Pfeilrichtung ziehen, ~1 s halten — bewegt sich die Funktion des Schritts richtig?
        r.geist = await p.werte(`(() => { const e = document.querySelector("#geisterdaumen .geist.an"); if (!e) return null; const b = e.getBoundingClientRect();
          return { seite: e.classList.contains("links") ? "links" : "rechts", pfeil: e.dataset.pfeil, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
        if (r.geist && ["links", "rechts", "hoch", "runter"].includes(r.geist.pfeil)) {
          const { x, y, pfeil } = r.geist;
          const weg = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] }[pfeil];
          const vor = await p.werte(ZUSTAND);
          // Start und erster Zug ohne Warten dazwischen: bei 6-12 fps (headless) waeren sonst zwei Bilder
          // "still" = 0,5 s >= RADIAL_HOLD_S, und rechts klappt der Funktionskranz auf (touch.ts update)
          const anf = p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 7, force: 0.5 }] });
          await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14, y: y + weg[1] * 14, id: 7, force: 0.5 }] });
          await anf;
          for (let k = 2; k <= 6; k++) {
            await pause(30);
            await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14 * k, y: y + weg[1] * 14 * k, id: 7, force: 0.5 }] });
          }
          await pause(1200);
          const nach = await p.werte(ZUSTAND);
          await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          const los = await p.werte(ZUSTAND);
          await pause(1500);
          const spaeter = await p.werte(ZUSTAND);
          r.geistBild = await p.bild(`${id}_${geraet}_4_geist-gezogen`);
          r.geistProbe = { gierVor: vor.gierGrad, gierNach: nach.gierGrad, gierLos: los.gierGrad, gierLos15: spaeter.gierGrad, zuVor: vor.schliessung, zuNach: nach.schliessung, zuLos15: spaeter.schliessung,
            magnetVor: vor.magnetAn, magnetNach: nach.magnetAn, magnetLos15: spaeter.magnetAn, pratzeSollNach: spaeter.pratzeSoll, kranz: await p.werte("!!document.querySelector(\".radial.open, #radial.open\")").catch(() => null) };
        }
        await pause(500);
        // ↻ per Finger auf den Knopf (nach Drehen/Schliessen — kein Fahren, also ohne Neuladen)
        await p.werte("window.__marke = 'gleiche Seite'; true");
        await p.tippe("#tut-neu");
        await pause(2000);
        await p.s("HeapProfiler.collectGarbage");
        r.nachFinger = await p.werte(ZUSTAND);
        r.nachFinger.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'").catch(() => false);
        r.seitenfehler = await p.werte("__smoke.fehler");
        r.konsole = konsole;
        cdp.hoerer.splice(cdp.hoerer.indexOf(hoer), 1);
        ergebnis.aufgaben[`${id}/${geraet}`] = r;
        log(id, geraet, "Karte", JSON.stringify(r.lage1.karte), "Koerper", r.vorher.koerper, r.nachBus.koerper, r.nachFinger.koerper, "Geist", JSON.stringify(r.geist), JSON.stringify(r.geistProbe ?? null), "Konsole", konsole.length);
        writeFileSync(join(AUS, "aufgaben-smoke.json"), JSON.stringify(ergebnis, null, 2));
        await p.zu();
      }
    }
    break ablauf;
  }
  if (NUR === "lehrgang") {
    await lehrgangSmoke(cdp, neueSeite);
    break ablauf;
  }
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
  } // Ende ablauf
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
