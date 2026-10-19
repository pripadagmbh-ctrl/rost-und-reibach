# Aufgaben-Smoke 19.10.2026 — Aufgabe 1 „ERSTER GRIFF" im echten Browser (Auftrag Q1, E-162)

**Kein Gerätetest.** Headless-Chromium am Entwicklungs-PC, die Zahlen gelten für den PC, nicht für iPad oder iPhone mini.

| | |
|---|---|
| Gerät | Entwicklungs-PC, Intel HD Graphics 5500 (ANGLE D3D11), Windows 10 |
| Browser | Chromium 153.0.8010.12 (Playwright-Vorrat), headless, `--disable-gpu-sandbox --no-sandbox` |
| Stand | Branch `v1/start`, HEAD `d6b420b` + nicht eingecheckte E-162-Arbeit (Arbeitskopie 19.10.2026 abends) |
| Server | Vite-Dev-Server, Port 5197 (5199 war von einem fremden Dev-Server auf `[::1]` belegt) |
| Emulation | iPhone mini quer 812×375 DPR 3, iPad quer 1180×820 DPR 2, beide mit Touch (5 Punkte), `body.touch` gesetzt |
| Bedingung | Leeres Profil je Lauf (eigener Browser-Kontext). Parallel liefen Tests und Messungen anderer Agenten, der PC war ausgelastet. |
| Quelle | `node tools/aufgaben-smoke.mjs <Ordner>`, Rohdaten `aufgaben-smoke.json` |

## Ladezeit bis zum ersten gezeichneten Bild mit Karte (ms ab Navigationsstart)

Gemessen wird bis `#tutorial.open` plus zwei `requestAnimationFrame`. Format der Zellen: Karte offen / `__game` da / **erstes Bild mit Karte**. iPhone-mini-Format.

| Drossel | Lauf | kalt (leerer Cache) | warm (Cache, leerer Speicher) | Rückfall-Neustart warm | Rückfall-Neustart kalt |
|---|---|---|---|---|---|
| 1× | 1 | 5178 / 7791 / **8069** | 4506 / 6853 / **7493** | 4407 / 6310 / **7002** | 6965 / 9174 / **9839** |
| 1× | 2 | 4382 / 7015 / **7255** | 2934 / 5259 / **5918** | 4798 / 7064 / **7463** | 9598 / 12001 / **12475** |
| 1× | 3 | 4336 / 6890 / **7158** | 2946 / 5229 / **5873** | 3670 / 6186 / **6524** | 3862 / 5926 / **6831** |
| 4× CPU | 1 | 6130 / 9389 / **9674** | 3299 / 6033 / **6320** | 5244 / 7362 / **8109** | 4959 / 7868 / **8225** |
| 4× CPU | 2 | 5347 / 8186 / **8531** | 3030 / 5140 / **5346** | 3585 / 5251 / **5745** | 2639 / 4754 / **4973** |
| 4× CPU | 3 | 4157 / 6877 / **7182** | 2743 / 4856 / **5156** | 2788 / 4519 / **4985** | 3002 / 4715 / **5828** |

- Median erstes Bild: kalt 7,3 s · warm 5,9 s · Rückfall warm 7,0 s · Rückfall kalt 9,8 s (1×). Mit 4× gedrosselt: 8,5 / 5,3 / 5,7 / 5,8 s.
- Ein früherer Durchgang am selben Abend mit weniger Last lag bei 3,8–6,5 s (1×) und 4,6–8,3 s (4×).
- **Die 4×-Drossel ist kein Ersatz für das iPhone mini.** Sie bremst nur den Hauptfaden. Die Zeit geht hier ins Laden von 188 Einzelmodulen des Dev-Servers und in die Grafik. Die Zahlen streuen mit der Last der anderen Agenten stärker als mit der Drossel.
- Allererster Abruf nach dem Serverstart (Vite wandelt um): erstes Bild nach 23,4 s. Das kommt im Build nicht vor.
- Zwischen „Karte offen" und „erstes Bild" vergehen 2,5–4 s. In dieser Zeit wartet `main()` nach `starteAufgabe` noch auf etwas. Was der Spieler dabei sieht, ist nicht geprüft.

## ↻ ohne Neuladen (iPad-Format)

Vorher: 32 Körper, 107 Kollider, 1 Teil (1 Kupfer-Boiler), 797 Netze, 215 Szenenkinder, Heap 33,6 MB, Uhr 0:17. Gelesen wurde 1,5 s nach dem Neustart, nach erzwungener Speicherbereinigung.

| # | Weg | bis `challenge:start` | davon `items.settle` | bis 2 Bilder | Körper | Kollider | Teile | Boiler | Netze | Schritt | Uhr | Heap MB | gleiche Seite |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bus | 106 ms | 94 ms | 325 ms | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 33,5 | ja |
| 2 | Bus | 103 ms | 93 ms | 396 ms | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 34,4 | ja |
| 3 | Bus | 132 ms | 97 ms | 301 ms | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 33,7 | ja |
| 4 | Bus | 124 ms | 105 ms | 235 ms | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 33,7 | ja |
| 5 | Bus | 123 ms | 115 ms | 228 ms | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 33,8 | ja |
| 6 | Finger auf ↻ (CDP-Touch) | — | — | 1531 ms Wandzeit inkl. Abfrage | 32 | 107 | 1 | 1 | 797 | 1/6 | 0:02 | 34,7 | ja |

- Die Körperzahl wächst nicht. Heap +3 % über 6 Neustarts.
- Der Neustart blockiert den Hauptfaden 100–130 ms, fast ganz durch `items.settle` (240+ Physikschritte am Stück). Auf dem iPhone mini nicht gemessen.
- **NOCHMAL nach geschaffter Aufgabe:** gleiche Seite, 1 Boiler an der Startlage, 1/6, Uhr läuft von 0. Der Oberwagen bleibt auf −69,6° gedreht (so gewollt, `main.ts`).
- **Rückfall:** Bagger 1,63 m gefahren, dann ↻ → neue Seite. Erstes Bild nach 17,4 s (Karte offen nach 3,1 s). Danach 1 Boiler, 1/6, Uhr 0:00.

## Zeichenrufe, Physik, Körper (F3-Overlay, iPad-Format 2360×1640 px)

| | Aufgabe 1 | Sandkasten |
|---|---|---|
| Zeichenrufe | 870 | 1382 |
| Dreiecke | 191k | 229k |
| Körper (wach) | 32 (24) | 138 (64) |
| Beweglich (wach) | 8 (0) | 74 (0) |
| Kollider | 107 | 233 |
| Netze in der Szene | 797 | 1155 |
| Physik je Bild | 6,1 ms | 33,0 ms |
| Bild (CPU) | 23,6 ms | 67,1 ms |
| FPS | 11 | 12 |

Die FPS sagen hier nichts: Intel HD 5500 bei 3,9 MP, der PC ausgelastet. „Physik je Bild" enthält bei 11 FPS bis zu 5 feste Schritte.

## Durchlauf Aufgabe 1 (iPad-Format)

Schritte 1–5 per Tasten und `__game.step` (dieselbe Steuerlogik wie `test/aufgabe1.test.ts`, Abschnitt 3). Schritt 6 per CDP-Touch auf dem rechten Stick, und zwar dort, wo der Geisterdaumen steht (rechts, Pfeil nach links).

- Gesehen: 2 → 3 → 4 → 5 → 6 → geschafft, ★★★, 0:28 min. Die Uhr ist Wandzeit, die Schritte liefen langsamer als Echtzeit.
- Abschlusstafel: „GESCHAFFT · ERSTER GRIFF", „★★★ drei von drei Sternen", „Zeit ✓ 0:28 min (★★★ bis 1:30 min)", NOCHMAL, NÄCHSTE AUFGABE, ZUM MENÜ. Ablage `{"erster-griff":{"sterne":3}}`.
- Menü danach: SANDKASTEN offen, Aufgabe 1 mit ★★★, Aufgabe 2 freigeschaltet.
- `challenge:geschafft` kam, während der Boiler noch über der Wand fiel (y 2,08 bzw. 2,62 m, Wand 2,0 m).

## Patricks Beobachtungen

Keine — kein Gerätetest in diesem Paket.

## Abgeleitete Aufgaben

| Aufgabe | Zuständig |
|---|---|
| iPhone mini quer: Die Karte (466×154 px ab 8/8) deckt den gelben Kegel über dem Boiler ganz ab. Vom Boiler bleibt nur die Oberkante unter dem Kartenrand sichtbar. | ui + welt über Orchestrator |
| Schild der Box zeigt im Simulator als dritte Zeile „undefined", sobald die Spinne darüber steht (`containers.ts:1956`) | welt |
| Prüfen, ob „geschafft" erst gelten soll, wenn das Teil liegt | Orchestrator |
| ↻-Dauer und Ladezeit auf dem iPhone mini messen (F3) | Patrick / qa |
