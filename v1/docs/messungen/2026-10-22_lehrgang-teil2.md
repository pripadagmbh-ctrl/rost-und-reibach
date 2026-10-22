# Lehrgang Teil 2 im Browser 22.10.2026 — Stationen, Lotse, Kranz, Ende (Auftrag L8-Q)

**Kein Gerätetest.** Headless-Chromium am Entwicklungs-PC. fps und ms gelten für den PC, nicht für iPad oder iPhone mini. Während der Läufe arbeiteten andere Fachagenten im selben Baum (nicht eingecheckt), und parallel lief zeitweise die volle Vitest-Suite bzw. ein Einzeltest — die PC-Last schwankte, ms-Werte sind untereinander nur grob vergleichbar.

| | |
|---|---|
| Gerät | Entwicklungs-PC, Intel Core i5-5300U, Intel HD Graphics 5500 (ANGLE D3D11), Windows 10 |
| Browser | Chromium aus dem Playwright-Vorrat (`ms-playwright/chromium-1243`), headless, über `playwright-core` (npx-Speicher) |
| Stand | Branch `v1/start`, HEAD `63971ae` + nicht eingecheckte Pakete L8 (u. a. `station.ts`, `lektion.ts`, `lehrgang.ts`, `main.ts`, `geisterdaumen.ts`, `lektionskarte.ts`) |
| Emulation | iPhone mini quer 812×375 DPR 3, iPad quer 1180×820 DPR 2, beide `hasTouch`/`isMobile` (Tipps per `page.touchscreen.tap`); PC 1280×800 DPR 1 ohne Touch; Sprache de |
| Einstieg | `localStorage.schrottplatz_lehrgang = {v:2, schritt:<Index>, …, begonnen:true}`, dann `#lektion=lehrgang` → `lehrgangEinstieg` setzt den Lauf auf den Schritt (kein Abkürzen im Spiel) |
| Quelle | Skript `scratchpad/l8q.mjs` (Teile `stationen`, `kranz`, `hupe`, `fahrer`, `pc`). Mitschrift über Prototyp-Haken (`EventBus.emit`, `ChallengeLauf.takt` → Station, `LektionLauf.takt`), Verhalten unverändert. Physik-ms = 120 × `__game.step(1)` bei angehaltener Bildschleife; F3 = Overlay nach 2,5 s. Welt-Schritte: `tools/pruefungsfahrer.ts` (`fahre`, `weiter`) auf dem Stationslauf |
| Rohdaten / Bilder | `scratchpad/l8/l8q_*.json`, `scratchpad/l8/Q_*.png` |

## 1. Wiedereinstieg je Station

Je Station eigener Browser, Einstieg direkt auf den Schritt. „Schritt-ms" = ein `__game.step(1)` (ganzer Schrittinhalt). F3-Physik = geglättet je Bild (headless 11–19 fps → mehrere Schritte je Bild).

| Format | Schritt | Station gebaut | Greifer | Teile / Wracks | Körper (wach) / beweglich | Schritt-ms Mittel/p95/max | F3 fps · Frame ms · Physik ms | Zeichenrufe | Leiste: Symbol · Wort · Striche | Text in Mittelzone | Geist | Konsolenfehler |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mini | 11 Greifen | erster-griff | Fünfschalen | 1 / 0 | 35 (23) / 12 | 1,34 / 2,7 / 6,1 | 18 · 56 · 6,7 | 1014 | ja · Greifen · 24 | keiner | links, Pfeil ← | 0 |
| mini | 14 Funktionen | schwere-last | Fünfschalen | 1 / 1 | 35 (23) / 12 | 1,37 / 2,1 / 6,1 | 16 · 62 · 12,9 | 1028 | ja · Funktionen · 24 | keiner | Tippfinger auf #btn-kranz | 0 |
| mini | 17 Hämmern | platt-machen | Fünfschalen | 1 / 1 | 35 (24) / 12 | 1,46 / 2,1 / 5,0 | 16 · 66 · 9,7 | 1028 | ja · Hämmern · 24 | keiner | links, Pfeil ↑ | 0 |
| mini | 19 Zerlegen | verladen | Fünfschalen | 1 / 1 | 35 (23) / 12 | 1,38 / 2,0 / 4,6 | 16 · 67 · 11,0 | 1031 | ja · Zerlegen · 24 | keiner | **keiner** | 0 |
| mini | 22 Magnet | magnet | **Magnet** | 7 / 0 | 41 (23) / 18 | 0,99 / 1,2 / 2,5 | 18 · 52 · 5,5 | 924 | ja · Magnet · 24 | keiner | links, Pfeil ← | 0 |
| mini | 23 Sortieren | sortieren | **Fünfschalen** | 6 / 0 | 40 (23) / 17 | 1,25 / 1,5 / 3,2 | 19 · 57 · 6,0 | 1034 | ja · Sortieren · 24 | keiner | links, Pfeil ← | 0 |
| iPad | 11 | erster-griff | Fünfschalen | 1 / 0 | 35 (23) / 12 | 2,17 / 5,9 / 10,7 | 12 · 194 · 9,4 | 884 | ja · Greifen · 24 | keiner | links, ← | 0 |
| iPad | 14 | schwere-last | Fünfschalen | 1 / 1 | 35 (23) / 12 | 2,47 / 7,5 / 15,8 | 11 · 226 · 11,9 | 898 | ja · Funktionen · 24 | keiner | Tippfinger auf #btn-kranz | 0 |
| iPad | 17 | platt-machen | Fünfschalen | 1 / 1 | 35 (24) / 12 | 2,42 / 7,9 / 13,9 | 11 · 250 · 13,2 | 898 | ja · Hämmern · 24 | keiner | links, ↑ | 0 |
| iPad | 19 | verladen | Fünfschalen | 1 / 1 | 35 (23) / 12 | 2,63 / 8,3 / 11,6 | 11 · 229 · 12,7 | 901 | ja · Zerlegen · 24 | keiner | **keiner** | 0 |
| iPad | 22 | magnet | Magnet | 7 / 0 | 41 (23) / 18 | 1,75 / 4,6 / 7,1 | 11 · 191 · 8,8 | 794 | ja · Magnet · 24 | keiner | links, ← | 0 |
| iPad | 23 | sortieren | Fünfschalen | 6 / 0 | 40 (23) / 17 | 1,33 / 1,8 / 12,1 | 12 · 192 · 9,1 | 904 | ja · Sortieren · 24 | keiner | links, ← | 0 |

Die iPad-Zeile lief parallel zu einem Vitest-Einzellauf (höhere ms). „Teile 1" bei Wrack-Stationen = der Wrackkörper als Teil (`item_0/1`). In keiner Station: NaN, Körper unter dem Boden, wacher Körper > 0 m/s nach 3 s Ruhe. Ladezeit 14–31 s je Seite (Dev-Server, kalt).

## 2. Stationswechsel im Ablauf (echte Übergänge, kein Abkürzen)

| Übergang | vorher | nachher | Vorige weg? | Greifer |
|---|---|---|---|---|
| 13 → 14 (mini) | erster-griff: Kupfer-Boiler, 35 Körper | schwere-last: 1 Wrack, 35 Körper | ja (Boiler weg) | Fünfschalen |
| 21 → 22 (PC) | verladen: gepresstes Wrack | magnet: 7 Teile, 0 Wracks, 41 Körper | ja | **→ Magnet** |
| 22 → 23 (PC) | magnet: 7 Teile | sortieren: 6 Teile (Boiler, Kiste, Schwungrad, Frontgewicht, Waschmaschine, Truhe), 40 Körper | ja (Späne/Stahl weg) | **→ Fünfschalen** |

Körperzahl nach jedem Wechsel = Körperzahl beim frischen Einstieg in dieselbe Station (35 / 41 / 40) — kein Rest, kein Leck. **Nicht gesehen:** die Wechsel 16 → 17 und 18 → 19 (nur per Einstieg geprüft).

## 3. Lotse und Kranz (Touch)

| Format | Ablauf | Ergebnis |
|---|---|---|
| mini, iPad | 14: Tippfinger steht auf der Mitte von #btn-kranz (mini 782/82, iPad 1144/90) | ja; Häkchen 14 erst nach echtem Tipp auf den Knopf (vorher keins) |
| mini, iPad | 15: Kranz offen, Tippfinger auf Sektor STÜTZEN (mini 715/204, iPad 1071/375 = Sektormitte) | ja; Tipp auf STÜTZEN → Pratzen unten, Häkchen 15, Kranz schließt |
| mini | 24: Finger auf Knopf → Tipp → Finger auf HUPE (501/204) → Tipp | `bagger:hupe`, Häkchen 24, `lehrgang:geschafft` |
| mini, iPad | 11: Geisterdaumen | linker Stick, Pfeil ← (erst schwenken zum Teil) |

## 4. Welt-Schritte wirklich geschafft (`tools/pruefungsfahrer.ts` auf dem Stationslauf)

| Format | Einstieg | Fahrer | Häkchen | Schritte | Schritt-ms Mittel/p95/max | max. Tempo m/s | NaN | Körper Start→Ende |
|---|---|---|---|---|---|---|---|---|
| mini | 11 | erster-griff | 11 ✓, dann 12 Drehen (Rotator 0,6 s voll über `touch.axes.rotator` = 72°) ✓, 13 Ablegen ✓ sofort (Boiler lag schon in der Box) | 2529 | 1,24 / 1,8 / 12,5 | 8,05 | nein | 35 → 35 |
| PC | 20 | verladen (+ Taste B, `weiter()`) | 20 ✓, 21 ✓ | 3189 + 4070 | 1,19 / 1,6 / 11,4 | 0,21 / 3,02 | nein | 35 → 35 |
| PC | 22 | magnet | 22 ✓ (5 richtige Einwürfe) | 6952 | 1,19 / 1,6 / 6,0 | 10,25 | nein | 41 → 41 |

Schrittzahl erster-griff höher als im Prüfungslauf 41-Q (564): Der Fahrer wartet auf `challenge:schritt`, das die Station verschluckt — seine Wartezeiten laufen bis zur Frist (Werkzeug, nicht Spiel). Tempo > 6 m/s = losgelassene Teile im freien Fall (41-Q: P5 ebenfalls 10,3).

## 5. PC ohne Touch

| Schritt | Ergebnis |
|---|---|
| 14 Funktionen | sofort Häkchen (`touch.active` false → gilt als erfüllt) |
| 15 Stützen | Taste O → Pratzen unten, Häkchen. **Kein Hinweis auf O** im Bild (kein Schild, kein Geist) |
| 21 Pressen | Taste B → Presse läuft, Häkchen 21 (mit Wrack in der Kammer, s. 4.) |
| 24 Hupen | Taste 2 → `bagger:hupe`, Häkchen, Tafel MONTAG |

## 6. Ende

Tafel „LEHRGANG GESCHAFFT", ✓, Zeit, Knöpfe MONTAG · NOCHMAL · ZUM MENÜ (mini und PC). Speicher danach `{"v":2,"schritt":24,"fertig":true,…}`. MONTAG führt nach `#schicht=montag`; die Seite lädt die Schicht (Verlader steht da), Adresse danach geleert. Zeit auf der Tafel nach Einstieg bei 24: „0:11 min" — nur die Zeit seit dem Wiedereinstieg. Leiste nach dem Ende ausgeblendet. 0 Konsolenfehler in allen 20 Seiten.

## Prüfkette

`npm run build` grün (2 min 12 s, vite 42,6 s). `npm test`: 229 Dateien, 2833 von 2834 grün, 2977 s — rot `test/schichtleistung-saat5.test.ts` („nach Ruhe wach auf dem Platz 11 > 6") im Gesamtlauf parallel zu den Browserläufen und fremden Änderungen im Baum; einzeln nachgelaufen grün (139 s).

## Patricks Beobachtungen

Noch keine — kein Gerätetest in diesem Paket.

## Abgeleitete Aufgaben

| # | Aufgabe | Zuständig |
|---|---|---|
| 1 | Schritt 19 „Zerlegen": kein Geist, kein Pfeil; das Auto steht aus der Startkamera halb hinter dem Ausleger — am Gerät fragen, ob man weiß, was zu tun ist | ui / Orchestrator |
| 2 | PC: Kranz-Schritte (15, 21, 24) zeigen keine Taste (O, B, 2) | ui |
| 3 | Tafel nach Wiedereinstieg zeigt nur die Zeit seit dem Einstieg | Orchestrator (challenges/ui) |
| 4 | `schichtleistung-saat5` im Gesamtlauf unter Last beobachten | welt |
| 5 | `pruefungsfahrer.ts` kennt den Stationsbus nicht (Fortschritt `challenge:schritt` verschluckt) | qa |
