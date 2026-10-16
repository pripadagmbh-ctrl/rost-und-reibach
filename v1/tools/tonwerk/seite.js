/**
 * Tonwerk, Browserseite (E-130). Laeuft im kopflosen Chromium, den
 * `tonwerk.mjs` startet. Zwei Modi:
 *  - analyse: je Rohdatei Kennzahlen und ein Spektrogramm (PNG)
 *  - schneiden: je Rezept eine WAV-Datei (16 bit, mono)
 */
const post = (pfad, body) => fetch(pfad, { method: "POST", body });
const log = (t) => post("/log", String(t));

await log("seite geladen");
const auftrag = await (await fetch("/auftrag.json")).json();
const RATE = auftrag.abtastrate;
const rohCache = new Map();

/** Rohdatei dekodiert, mono, auf RATE abgetastet. */
async function roh(pfad) {
  if (rohCache.has(pfad)) return rohCache.get(pfad);
  const r = await fetch(pfad.startsWith("ton/") ? "/" + pfad : "/roh/" + pfad);
  if (!r.ok) throw new Error("fehlt: " + pfad);
  const dek = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await r.arrayBuffer());
  // auf mono mischen
  const n = dek.length;
  const m = new Float32Array(n);
  for (let k = 0; k < dek.numberOfChannels; k++) {
    const d = dek.getChannelData(k);
    for (let i = 0; i < n; i++) m[i] += d[i] / dek.numberOfChannels;
  }
  const buf = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: RATE });
  buf.copyToChannel(m, 0);
  rohCache.set(pfad, buf);
  return buf;
}

// ------------------------------------------------------------------ Analyse

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const w = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(w * k), s = Math.sin(w * k);
        const a = i + k, b = a + len / 2;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

/** Betragsspektrum (dB) eines Fensters ab Probe `ab`. */
function spektrum(d, ab, N) {
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = (d[ab + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  fft(re, im);
  const mag = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

function kennzahlen(buf) {
  const d = buf.getChannelData(0);
  let peak = 0, tPeak = 0, summe = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    summe += d[i] * d[i];
    if (a > peak) { peak = a; tPeak = i; }
  }
  // Abklingen: wann faellt die 10-ms-Huelle 30 dB unter die Spitze?
  const fen = Math.round(RATE * 0.01);
  let abkl = d.length / RATE;
  for (let i = tPeak; i < d.length; i += fen) {
    let m = 0;
    for (let k = 0; k < fen && i + k < d.length; k++) m = Math.max(m, Math.abs(d[i + k]));
    if (m < peak * 0.0316) { abkl = (i - tPeak) / RATE; break; }
  }
  // Schwerpunkt und Tiefenanteil in den ersten 200 ms nach der Spitze
  const N = 4096;
  const mag = spektrum(d, Math.max(0, tPeak - 256), N);
  let z = 0, n = 0, tief = 0;
  for (let i = 1; i < N / 2; i++) {
    const f = (i * RATE) / N, e = mag[i] * mag[i];
    z += f * e; n += e;
    if (f < 300) tief += e;
  }
  return {
    dauer: +(d.length / RATE).toFixed(3),
    spitze: +peak.toFixed(3),
    tSpitze: +(tPeak / RATE).toFixed(3),
    rmsDb: +(10 * Math.log10(summe / d.length + 1e-12)).toFixed(1),
    abkling30dB: +abkl.toFixed(3),
    schwerpunktHz: Math.round(z / (n || 1)),
    tiefAnteil: +(tief / (n || 1)).toFixed(2),
  };
}

/** Spektrogramm: x = Zeit, y = Frequenz (log 40 Hz..12 kHz), unten Pegel. */
async function spektrogramm(buf, name) {
  const d = buf.getChannelData(0);
  const N = 2048;
  const W = Math.min(1600, Math.max(400, Math.round(buf.duration * 40)));
  const H = 300, P = 80;
  const cv = new OffscreenCanvas(W, H + P + 14);
  const g = cv.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H + P + 14);
  const img = g.createImageData(W, H);
  const fMin = 40, fMax = RATE / 2;
  const pegel = [];
  const spalten = [];
  let maxDb = -200;
  for (let x = 0; x < W; x++) {
    const ab = Math.floor((x / W) * (d.length - N));
    const mag = spektrum(d, ab, N);
    spalten.push(mag);
    for (let i = 2; i < N / 2; i++) maxDb = Math.max(maxDb, 20 * Math.log10(mag[i] + 1e-9));
  }
  for (let x = 0; x < W; x++) {
    const ab = Math.floor((x / W) * (d.length - N));
    const mag = spalten[x];
    let s = 0;
    for (let i = 0; i < N; i++) s += (d[ab + i] ?? 0) ** 2;
    pegel.push(10 * Math.log10(s / N + 1e-12));
    for (let y = 0; y < H; y++) {
      const f = fMin * Math.pow(fMax / fMin, 1 - y / H);
      const bin = Math.min(N / 2 - 1, Math.round((f * N) / RATE));
      const db = 20 * Math.log10(mag[bin] + 1e-9);
      const v = Math.max(0, Math.min(1, (db - maxDb + 75) / 75));
      const o = (y * W + x) * 4;
      img.data[o] = 255 * Math.min(1, v * 2);
      img.data[o + 1] = 255 * Math.max(0, v * 2 - 0.6);
      img.data[o + 2] = 255 * Math.max(0, 1 - v * 3) * v * 3;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Frequenzlinien 100 Hz, 300 Hz, 1 kHz, 3 kHz, 10 kHz
  g.fillStyle = "#4af";
  g.font = "10px sans-serif";
  for (const f of [100, 300, 1000, 3000, 10000]) {
    const y = H * (1 - Math.log(f / fMin) / Math.log(fMax / fMin));
    g.fillRect(0, y, 6, 1);
    g.fillText(f >= 1000 ? f / 1000 + "k" : String(f), 8, y + 3);
  }
  // Pegel
  g.strokeStyle = "#0f0";
  g.beginPath();
  pegel.forEach((p, x) => {
    const y = H + P - Math.max(0, Math.min(P, ((p + 70) / 70) * P));
    x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  });
  g.stroke();
  // Sekundenmarken
  g.fillStyle = "#fff";
  const schritt = buf.duration > 60 ? 10 : buf.duration > 10 ? 1 : 0.1;
  const ab0 = Number((name.split("@")[1] ?? "0").split("-")[0]);
  for (let t = 0; t < buf.duration; t += schritt) {
    const x = (t / buf.duration) * W;
    g.fillRect(x, H, 1, 6);
    if (Math.round(t / schritt) % (schritt < 1 ? 5 : buf.duration > 60 ? 1 : 5) === 0)
      g.fillText(schritt < 1 ? (ab0 + t).toFixed(1) : String(Math.round(ab0 + t)), x + 2, H + P + 11);
  }
  g.fillText(name, W - 220, 12);
  const blob = await cv.convertToBlob({ type: "image/png" });
  await post("/out/" + name.replace(/[^A-Za-z0-9._-]/g, "_") + ".png", blob);
}

// ---------------------------------------------------------------- Schneiden

/** Eine Schicht in den Offline-Kontext legen. */
async function legeSchicht(ctx, s, ziel) {
  const buf = await roh(s.q);
  const q = new AudioBufferSourceNode(ctx, { buffer: buf, playbackRate: s.rate ?? 1 });
  let kette = q;
  const filter = (type, frequency) => {
    const f = new BiquadFilterNode(ctx, { type, frequency, Q: 0.707 });
    kette.connect(f);
    kette = f;
  };
  if (s.hp) filter("highpass", s.hp);
  if (s.tp) filter("lowpass", s.tp);
  const g = new GainNode(ctx, { gain: 0 });
  kette.connect(g).connect(ziel);
  const von = s.von ?? 0;
  const quelleDauer = s.dauer ?? buf.duration - von;
  const dauer = quelleDauer / (s.rate ?? 1);
  const t0 = s.versatz ?? 0;
  const ein = s.ein ?? 0.003, aus = Math.min(s.aus ?? 0.02, dauer / 2);
  const laut = s.gain ?? 1;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(laut, t0 + ein);
  g.gain.setValueAtTime(laut, t0 + dauer - aus);
  g.gain.linearRampToValueAtTime(0, t0 + dauer);
  q.start(t0, von, quelleDauer);
  return t0 + dauer;
}

/** Zufall mit festem Samen: Streuungen sind bei jedem Lauf gleich. */
function zufall(samen) {
  let x = samen >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function rendere(r) {
  const RATE = r.abtastrate ?? auftrag.abtastrate;
  // Laenge: aus den Schichten, oder fest (Schleifen, Streuungen)
  const schichten = [...(r.schichten ?? [])];
  if (r.streu) {
    const z = zufall(r.streu.samen ?? 7);
    for (let i = 0; i < r.streu.anzahl; i++) {
      const s = r.streu.quellen[Math.floor(z() * r.streu.quellen.length)];
      const rate = r.streu.rate[0] + z() * (r.streu.rate[1] - r.streu.rate[0]);
      schichten.push({
        ...s,
        rate,
        gain: (r.streu.gain[0] + z() * (r.streu.gain[1] - r.streu.gain[0])) * (s.gain ?? 1),
        versatz: z() * ((r.dauer ?? 2) + 2 * (r.art === "schleife" ? r.ueberblend ?? 0.25 : 0)),
      });
    }
  }
  const ueber = r.art === "schleife" ? r.ueberblend ?? 0.25 : 0;
  const lang = (r.dauer ?? 4) + ueber + 1.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(lang * RATE), RATE);
  let kette = new GainNode(ctx);
  const summe = kette;
  for (const [typ, f] of [["highpass", r.hp], ["lowpass", r.tp]]) {
    if (!f) continue;
    const n = new BiquadFilterNode(ctx, { type: typ, frequency: f, Q: 0.707 });
    kette.connect(n);
    kette = n;
  }
  kette.connect(ctx.destination);
  let ende = 0;
  for (const s of schichten) ende = Math.max(ende, await legeSchicht(ctx, s, summe));
  const aus = await ctx.startRendering();
  let d = aus.getChannelData(0);
  if (r.art === "schleife") {
    // Nahtlose Schleife: das Ende wird ueber den Anfang geblendet (gleiche Leistung)
    const n = Math.round(r.dauer * RATE), x = Math.round(ueber * RATE);
    const neu = new Float32Array(n);
    for (let i = 0; i < n; i++) neu[i] = d[i + x] ?? 0;
    for (let i = 0; i < x; i++) {
      const t = i / x;
      neu[i] = d[i + x] * Math.sin((t * Math.PI) / 2) + (d[i + n + x] ?? 0) * Math.cos((t * Math.PI) / 2);
    }
    // Anfang so verschieben, dass die Naht im Ueberblendbereich liegt — oben
    // schon: neu[0..x] mischt Ende und Anfang, neu[n-1] → neu[0] ist stetig.
    d = neu;
  } else {
    // Einmal-Klang: nach der Spitze bei −60 dB abschneiden, kurz ausblenden
    const n = Math.min(d.length, Math.ceil((r.dauer ?? ende) * RATE));
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    let schluss = n;
    while (schluss > 1 && Math.abs(d[schluss - 1]) < peak * 0.001) schluss--;
    const blende = Math.min(Math.round(0.03 * RATE), schluss);
    d = d.slice(0, schluss);
    for (let i = 0; i < blende; i++) d[schluss - 1 - i] *= i / blende;
  }
  // Pegel: Spitze auf r.spitze (Standard −1 dBFS)
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  const f = (r.spitze ?? 0.89) / (peak || 1);
  for (let i = 0; i < d.length; i++) d[i] *= f;
  return d;
}

function wav(d, RATE) {
  const b = new DataView(new ArrayBuffer(44 + d.length * 2));
  const s = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); b.setUint32(4, 36 + d.length * 2, true); s(8, "WAVE");
  s(12, "fmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, RATE, true); b.setUint32(28, RATE * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
  s(36, "data"); b.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return b.buffer;
}

try {
  if (auftrag.modus === "messen") {
    // Ladezeit wie im Spiel: alle Dateien parallel holen, dann bei 48 kHz dekodieren
    const namen = auftrag.analyse;
    const t0 = performance.now();
    const bytes = await Promise.all(namen.map((n) => fetch("/ton/" + n + ".wav").then((r) => r.arrayBuffer())));
    const t1 = performance.now();
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const bufs = await Promise.all(bytes.map((b) => ctx.decodeAudioData(b)));
    const t2 = performance.now();
    const proben = bufs.reduce((s, b) => s + b.length, 0);
    await log(`holen ${(t1 - t0).toFixed(0)} ms, dekodieren ${(t2 - t1).toFixed(0)} ms, ${namen.length} Dateien, dekodiert ${(proben * 4 / 1048576).toFixed(1)} MB`);
    await post("/fertig", "{}");
  } else if (auftrag.modus === "analyse") {
    const tabelle = {};
    for (const p of auftrag.analyse) {
      const [datei, bereich] = p.split("@");
      let buf = await roh(datei);
      if (bereich) {
        const [a, b] = bereich.split("-").map(Number);
        const d = buf.getChannelData(0).slice(Math.round(a * RATE), Math.round(b * RATE));
        buf = new AudioBuffer({ length: d.length, numberOfChannels: 1, sampleRate: RATE });
        buf.copyToChannel(d, 0);
      }
      tabelle[p] = kennzahlen(buf);
      if (buf.duration > 3 || bereich) await spektrogramm(buf, p);
    }
    await post("/out/kennzahlen.json", JSON.stringify(tabelle, null, 1));
    await post("/fertig", "{}");
  } else {
    const bericht = {};
    for (const r of auftrag.rezepte) {
      const d = await rendere(r);
      const rate = r.abtastrate ?? RATE;
      await post("/out/" + r.name + ".wav", wav(d, rate));
      bericht[r.name] = { dauer: d.length / rate, rate };
    }
    await post("/fertig", JSON.stringify(bericht));
  }
} catch (e) {
  await post("/fehler", String(e && e.stack ? e.stack : e));
}
