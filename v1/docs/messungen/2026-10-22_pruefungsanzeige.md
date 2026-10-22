# Prüfungsanzeige 22.10.2026 — Zielzeile, Kameraflug, Sortenfarben, alle sechs Prüfungen im Browser (Auftrag 41-Q)

**Kein Gerätetest.** Headless-Chromium am Entwicklungs-PC. fps und ms gelten für den PC, nicht für iPad oder iPhone mini. Während der Läufe arbeiteten andere Fachagenten im selben Baum (u. a. Commit `c22f580` E-208/E-209 mitten im Lauf, `index.html`/`lektion*.ts` in Arbeit) — die PC-Last schwankte, fps-Werte sind untereinander nur grob vergleichbar.

| | |
|---|---|
| Gerät | Entwicklungs-PC, Intel HD Graphics 5500 (ANGLE D3D11), Windows 10 |
| Browser | Chromium 153.0.8010.12 (Playwright-Vorrat), headless |
| Stand | Branch `v1/start`, HEAD `9b126b8` → `c22f580` (während des Laufs committet) + nicht eingecheckte Pakete 41-P1/P2/P3a/P3b samt Verdrahtung in `main.ts` |
| Emulation | iPhone mini quer 812×375 DPR 3, iPad quer 1180×820 DPR 2, beide Touch (`Input.dispatchTouchEvent`, force 0,5), Sprache de (Teil EN: en) |
| Quelle | `SMOKE_NUR=pruefungen SMOKE_GERAET=mini\|ipad node tools/aufgaben-smoke.mjs <Ordner>`; Teile über `SMOKE_TEIL` (haupt, tipp, tippkurz, englisch, andere, pausebild), `SMOKE_PRUEFUNG`, `SMOKE_OHNE_FAHRT`. Durchfahren: `tools/pruefungsfahrer.ts` = die Test-Fahrer aus `test/aufgabe1…6.test.ts` im echten Spiel (`__game.step(1)`, echte `input`-Tasten, Prüfungsuhr `lauf.takt(1/60)` je Schritt = Spielzeit). Kamera/Lauf über Prototyp-Haken (`OrbitCamera.update/flugTakt/starteFlug`, `ChallengeLauf.takt`), Verhalten unverändert |
| Rohdaten | `scratchpad/l6/Q_mini.json`, `Q_mini2.json`, `Q_ipad.json`, `Q_ipad2.json`, `Q_sorten.json` (+ `.log`) |
| Bilder | `scratchpad/l6/Q_*.png` / `.jpg` |

## 1. Durchfahren — alle sechs Prüfungen

Prüfung 2 auf beiden Formaten aus dem Zweitlauf (im Erstlauf bekam die Seite keinen WebGL-Kontext, siehe 6.), Prüfung 3 mini aus dem Zweitlauf (im Erstlauf fand der Fahrer keine Abwurfstelle in der MÜLL-Mulde, siehe Befund 4). Zeit = Prüfungsuhr in Spielzeit beim Abschluss. Schritt-ms = `__game.step(1)` (ganzer `schrittInhalt`). F3 = Overlay 3 s nach dem Flug, Spiel läuft normal. Zeichenrufe aus F3.

| Format | P | geschafft | Sterne (Tafel) | Zeit s | Schritte | Schritt-ms Mittel/p95/max | F3 fps | F3 Frame ms | F3 Physik ms | Körper (wach) | Zeichenrufe | max. Tempo m/s | NaN | Konsolenfehler |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mini | 1 | ja | ★★★ | 11,3 | 564 | 1,55 / 2,9 / 22,5 | 16 | 57,5 | 7,9 | 35 (23) | 1014 | 5,4 | nein | 0 bis zur Pause¹ |
| mini | 2 | ja | ★★★ | 62,8 | 3358 | 1,11 / 1,6 / 15,4 | 16 | 67,7 | 8,1 | 35 (23) | 1031 | 0,2 | nein | 0 |
| mini | 3 | ja | ★ | 319,1 | 19063 | 1,11 / 1,9 / 11,7 | 17 | 54,6 | 9,3 | 40 (23) | 1034 | 7,4 | nein | 0 |
| mini | 4 | ja | ★★★ | 18,8 | 1027 | 1,53 / 2,2 / 14,6 | 16 | 72,9 | 9,0 | 35 (24) | 1028 | 1,0 | nein | 0 |
| mini | 5 | ja | ★★★ | 115,3 | 6832 | 1,07 / 1,5 / 32,9 | 18 | 53,0 | 6,0 | 41 (23) | 924 | 10,3 | nein | 0 |
| mini | 6 | ja | ★★★ | 97,9 | 5607 | 1,23 / 1,9 / 15,2 | 15 | 73,1 | 9,6 | 35 (23) | 1028 | 0,9 | nein | 0 |
| iPad | 1 | ja | ★★★ | 11,9 | 564 | 1,24 / 2,4 / 19,5 | 8 | 216 | 8,3 | 35 (23) | 884 | 5,4 | nein | 0 bis zur Pause¹ |
| iPad | 2 | ja | ★★★ | 65,7 | 3377 | 1,18 / 1,9 / 19,3 | 10 | 219 | 9,6 | 35 (23) | 901 | 0,2 | nein | 0 |
| iPad | 3 | ja | ★ | 318,1 | 19055 | 1,14 / 1,9 / 11,9 | 11 | 135 | 9,3 | 40 (23) | 904 | 7,3 | nein | 0 |
| iPad | 4 | ja | ★★★ | 18,1 | 1027 | 1,58 / 2,7 / 14,7 | 12 | 222 | 12,6 | 35 (24) | 898 | 1,0 | nein | 0 |
| iPad | 5 | ja | ★★★ | 113,8 | 6832 | 1,02 / 1,4 / 7,0 | 12 | 201 | 7,2 | 41 (23) | 794 | 10,3 | nein | 0 |
| iPad | 6 | ja | ★★★ | 95,2 / 97,2 | 5607 | 1,01 / 1,8 / 13,4 | 12 | 235 | 10,3 | 35 (23) | 898 | 0,9 | nein | 0 |

¹ Die einzigen Konsolenfehler aller Prüfungsseiten sind `THREE.WebGLProgram: Shader Error … VALIDATE_STATUS false` mit leerem Log — jeweils NACH einem verlorenen WebGL-Kontext bei offenem Pausenmenü (Abschnitt 6). Seitenfehler (`error`/`unhandledrejection`): 0 überall.

**Gegen die Bezugswerte:** Zeichenrufe Prüfung 1 = 1014 (mini) und 884 (iPad) — genau die Werte aus P3a. Körper 35 in Prüfung 1 (P3a: 35; E-207 nannte 34 für den Lehrgang, hier im Lehrgang ebenfalls 34). Physik-ms aus F3 6,0–12,6 ms liegt über E-207 (1,7–6,8 ms): F3 summiert die Schritte eines Bildes, bei 8–18 fps headless sind das 3–8 Schritte je Bild; je Schritt gemessen 1,0–1,6 ms im Mittel. Unter derselben PC-Last zeigte der Lehrgang hier 7,5 ms (mini, F3) — der Unterschied zu E-207 ist die Last am PC, kein Mehr der Prüfungen.

**Sterne:** Die Sterne bewerten den Test-Fahrer, nicht das Spiel. Prüfung 3 bekommt ★, weil der Fahrer (aus `test/aufgabe3.test.ts`, langsam und vorsichtig) 5:19 braucht (★★ bis 4:00); dort prüft der Test auch keine Sterne. Prüfung 5: 6 harte Aufschläge, Prüfung 3: 5 — der Fahrer lässt aus 2,6 m fallen; sie kosten in diesen Prüfungen keinen Stern.

**Durchlaufkette:** Prüfung 2 — Knopf PRESSEN erscheint in der Zielzeile (mini x 374, 44×44), Finger-Tipp darauf → Bus `challenge:pressen` → Presse läuft → geschafft, Präzision 8 cm. Prüfung 6 — Pratzen per `toggleOutriggers()` wie im Test (Taste O ist ein Einmal-Druck, den nur die Bildschleife verbraucht). Abschlusstafel jedes Mal offen mit Sternzeile und Rekord; Zielzeile danach verborgen.

## 2. Kameraflug

Bilder bei gehaltener Flugzeit (der Rauchtest setzt `dt = 0` ab 0,5 / 1,0 / 2,0 s Flugzeit, nach dem Bild weiter); 3,0 = Ende = normale Lage. Wanduhr headless ist nicht 3 s: Der Flug rückt höchstens 1/30 s je Bild vor (`FLUG_DT_MAX`), braucht also mindestens 90 Bilder — bei 8–16 fps headless 6–34 s. Auf dem Gerät mit ≥ 30 fps sind es 3 s.

| Format | P | Flug kam | Teil→Ziel m | Bilder im Flug | Physikschritte im Flug | Prüfungstakte im Flug | Uhr im Flug | Blick (Modus, Gier, Nick, Abstand) vor = nach | Sprung letztes Flugbild → erstes normales | größter Kameraschritt je Bild | Drift 1 s danach |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mini | 1 | ja | 10,7 | 314² | 0 | 0 | 0:00 | gleich | 0,015 m / 0° | 0,59 m | 0 / 0° |
| mini | 2 | ja | 14,5 | 212² | 0 | 0 | 0:00 | gleich | 0,020 m / 0° | 0,87 m | 0 / 0° |
| mini | 3 | ja | 10,0 | 229² | 0 | 0 | 0:00 | gleich | 0,016 m / 0° | 0,59 m | 0 / 0° |
| mini | 4 | ja | 0 (Ziel = Wrack) | 91 | 0 | 0 | — | gleich | 0,024 m / 0° | 0,55 m | 0 / 0° |
| mini | 5 | ja | 16,3 | 111 | 0 | 0 | — | gleich | 0 / 0° | 0,94 m | 0 / 0° |
| mini | 6 | ja | 2,35 | 198² | 0 | 0 | 0:00 | gleich | 0 / 0° | 0,40 m | 0 / 0° |
| iPad | 1 | ja | 10,7 | 167² | 0 | 0 | 0:00 | gleich | 0,003 m / 0° | 0,65 m | 0 / 0° |
| iPad | 2–6 | ja | wie mini | 91–94 | 0 | 0 | — | gleich | ≤ 0,017 m / ≤ 0,23° | 0,40–0,98 m | 0 / 0° |

² mit Bildhalt (gehaltene Bilder zählen mit).

- **Rückkehr:** Blick-Kugel vor und nach dem Flug bitgleich; die Kameraposition 1 s nach vollem Flug ist dieselbe wie 1,5 s nach abgebrochenem Flug (Abweichung 0,000 m, 0,000°, alle vier Prüfungen mini + P1 iPad). Der letzte Flugschritt zur Normallage ist ≤ 2,4 cm.
- **Schwenktempo:** größter Kameraweg je Flugbild 0,4–0,98 m bei 1/30 s Flugzeit je Bild — am größten in Prüfung 5 (Teil→Halde 16,3 m) und 2 (14,5 m). Auf dem Gerät mit 60 fps die Hälfte je Bild (≈ 0,5 m); Spitzentempo der Kamera rund 29 m/s im Mittelabschnitt.
- **Simulation ruht:** 0 Physikschritte und 0 Prüfungstakte zwischen erstem und letztem Flugbild, in allen 12 Flügen; Bagger unverändert (alle Winkel, Schließung, Ort Δ 0). Uhr in allen Flugbildern 0:00.
- **Prüfung 4** fliegt Wrack → Wrack (kein Ziel, P3b so gewollt). **Prüfung 6**: Ziel = Kreismitte (`zielMarke` = `ablageziel`), nur 2,35 m vom Wrack; der Kreis selbst ist im Flug nicht zu sehen (er ist eine Marke, Befund 1) — im Bild t = 2,0 steht nur Beton.
- **In keinem Flugbild** Leuchten, Weg oder Pfeil (Befund 1): `challenge:stand` kommt erst mit dem ersten Takt nach dem Flug.

### Tipp mitten im Flug

| Format | P | Wo | Flugzeit beim Tipp | Abgebrochen | Ansicht gleich | Bagger nach 1,5 s (Winkel/Schließung/Weg) | Kamera direkt → 1,5 s | Kamera gegen vollen Flug | Funktionskranz |
|---|---|---|---|---|---|---|---|---|---|
| mini | 1 | rechter Stick | 1,26 s | ja | ja | Δ 0 | 0 m / 0° | 0 m / 0° | zu |
| mini | 2 | Mittelstreifen | 1,09 s | ja | ja | Δ 0 | 0 m / 0° | 0 m / 0° | zu |
| mini | 3 | rechter Stick | 2,28 / 2,62 s | ja | ja | Δ 0 | 0 m / 0° | 0 m / 0° | zu |
| mini | 6 | rechter Stick | 1,32 s | ja | ja | Δ 0 | 0 m / 0° | 0 m / 0° | zu |
| iPad | 1 | rechter Stick | 1,01 s | ja | ja | Δ 0 | 0 m / 0° | 0 m / 0° | zu |
| mini | 1 | rechter Stick, **80 ms** | 1,69 s | ja (38 fps) | — | Δ 0 | — | — | zu |
| iPad | 1 | rechter Stick, **80 ms** | 1,59 s | ja (16 fps) | — | Δ 0 | — | — | zu |

Gehaltene Finger (325–2252 ms) sind CDP-Verzug beim Abfragen, nicht nötig: der 80-ms-Tipp reicht. Der erste iPad-Versuch mit 80 ms brach ab, weil die Seite mitten im Lauf neu lud (vermutlich Vite nach einer fremden Dateiänderung) — wiederholt, grün.

## 3. Zielzeile

| Format | P | Wörter | Wörter sichtbar am Anfang | nach ≥ 4 s Uhr nur Bilder (`.zu`) | Text in der Mittelzone | alte Karte (`#tutorial`, `tut-*`) |
|---|---|---|---|---|---|---|
| mini/iPad | 1 | „Kupfer in BUNT + VA" (5) | ja³ | ja | keiner | nicht sichtbar |
| mini/iPad | 2 | „Auto in die Presse" (4) | ja | ja | keiner | nicht sichtbar |
| mini/iPad | 3 | „Jedes Teil in seine Mulde" (5) | ja | ja | keiner | nicht sichtbar |
| mini/iPad | 4 | „Wohnwagen platt machen" (3) | ja | ja | keiner | nicht sichtbar |
| mini/iPad | 5 | „Eisen auf STAHL" (3) | ja | ja | keiner | nicht sichtbar |
| mini/iPad | 6 | „LKW-Wrack in den Kreis" (4) | ja | ja | keiner | nicht sichtbar |

³ Prüfung 1 mit Flugbildern: Die erste Lesung kam erst bei Uhr 0:04–0:07 (Bildaufnahmen), da waren die Wörter schon weg; in allen Flugbildern (Uhr 0:00) stehen sie.

- Mittelzone = 25–85 % Höhe zwischen den Stick-Ringen (Maße aus `test/lehrgangsleiste.test.ts`, mini 118…644 × 94…319). Geprüft: im Flug (je Bild), am Anfang, nach 4 s, nach Antippen, nach ↻ — in keiner Phase ein sichtbarer Textknoten darin. Ausnahme nur das Entwickler-Overlay F3, das nach dem Ablesen in Prüfung 1 mini noch an war.
- **Antippen** `#zz-ziel`: Wörter wieder da, nach 4 s Prüfungsuhr wieder weg (mini und iPad).
- **⏸** `#zz-pause`: Bus `spiel:pause`, Pausenmenü offen, Prüfungsuhr steht (gleicher Wert nach 1,5 s), WEITER schließt (mini und iPad). Gegenprobe Escape (☰-Weg) gleich.
- **↻** `#zz-neu` (Finger): neuer `challenge:start` auf derselben Seite, **kein zweiter Flug**, Uhr ab 0, Wörter wieder sichtbar — alle sechs, beide Formate.
- **Englisch** (Spracheinstellung `sprache=en`, alle sechs, mini): Satz „Copper into NON-FERROUS", „Car into the press", „Each part to its bay", „Flatten the caravan", „Iron onto STEEL", „Truck wreck into the circle"; Vorlesetexte und Knopfnamen englisch. Abgeglichen gegen 79–85 deutsche Wörter je Prüfung (Katalog + `WORTE`, die im Englischen nicht vorkommen) und Umlaute: 0 Treffer, im Flug und danach.

## 4. Sortenfarben (Prüfung 3 und 5)

Teilfarbe = Farbe des Leuchtens unter dem Teil (Exemplarfarbe des `InstancedMesh`, Szene), Weg = Farben der Striche AUF der Strecke Teil → Ziel (quer < 5 cm), Schild = Pixel (20|20) der Schild-Leinwand der Zielmulde des Teils (`wegZiel` des Laufs).

| P | Teil | Sorte | Sortenfarbe | Leuchten | Weg (Striche) | Schild der Zielmulde |
|---|---|---|---|---|---|---|
| 3 | Kupfer-Boiler | bunt | #d55e00 | #d55e00 | 8× #d55e00 | r_bunt, bunt, #d55e00 |
| 3 | Holzkiste | müll | #0072b2 | #0072b2 | 3× #0072b2 | r_rubble, müll, #0072b2 |
| 3 | Schwungrad | stahl | #56b4e9 | #56b4e9 | 12× #56b4e9 (+1 Kreuzung) | c_steel, stahl, #56b4e9 |
| 3 | Traktor-Frontgewicht | stahl | #56b4e9 | #56b4e9 | 13× #56b4e9 | c_steel, stahl, #56b4e9 |
| 3 | Waschmaschine | misch | #cc79a7 | #cc79a7 | 14× #cc79a7 | c_mixed, misch, #cc79a7 |
| 3 | Gefriertruhe | misch | #cc79a7 | #cc79a7 | 16× #cc79a7 | c_mixed, misch, #cc79a7 |
| 5 | Späneknäuel (2×) | misch | #cc79a7 | #cc79a7 | 14× / 15× #cc79a7 (+1 Kreuzung) | c_mixed, misch, #cc79a7 |
| 5 | Stahlknüppel, LKW-Felge, Vierkantstahl | stahl | #56b4e9 | #56b4e9 | 13× / 15× / 13× #56b4e9 | c_steel, stahl, #56b4e9 |

Alle 11 Teile: Leuchten = Weg = Schild = Sortenfarbe. Aber: Ein Strich eines fremden Wegs liegt 1,24–1,52 m neben den Misch-Teilen (Stahl-Wege laufen an ihnen vorbei) — Befund 5. Bilder `Q_sorten_P3_mini.png`, `Q_sorten_P5_mini.png`.

## 5. Lehrgang, Sandkasten, Schicht

| Format | Art | Flug | Zielzeile | Lehrgangsleiste | Konsole / Seitenfehler | F3 |
|---|---|---|---|---|---|---|
| mini | Lehrgang (leerer Speicher) | keiner | verborgen | sichtbar, x 284 y 8, 236×66, Phase „du" | 0 / 0 | 18 fps, Physik 7,5 ms, 34 Körper, 1008 Zeichenrufe |
| mini | Sandkasten (Menü) | keiner | verborgen | — | 0 / 0 | 13 fps, 115 Körper, 1682 |
| mini | Schicht montag | keiner | verborgen | — | 0 / 0 | 15 fps, 48 Körper, 1500 |
| iPad | Lehrgang | keiner | verborgen | sichtbar, x 468 y 8, 236×66 | 0 / 0 | — |
| iPad | Sandkasten | keiner | verborgen | — | 0 / 0 | 9 fps, 135 Körper, 1553 |
| iPad | Schicht montag | keiner | verborgen | — | 0 / 0 | 9 fps, 64 Körper, 1417 |

„Lehrgangsleiste unverändert": Die CSS der Leiste ist durch Paket 41 nicht geändert (`git diff index.html`). Während des Laufs kam aber E-208/E-209 (`c22f580`, „Lehrgangsleiste zeigt ein kurzes Wort je Schritt") dazu — gemessen ist der Stand danach.

## 6. WebGL-Kontext verloren bei offenem Pausenmenü (headless)

| Lauf | Wann | Folge |
|---|---|---|
| mini P1, 1. Lauf | PNG-Bild bei offenem Pausenmenü (⏸) | Kontext verloren, 2 Shaderfehler; Gegenprobe Escape-Pause ohne Bild: kein Verlust |
| iPad P1, 1. Lauf | Escape-Pause offen (ohne Bild), danach ⏸ | Kontext zweimal verloren; **nächste Seite (P2) bekam keinen WebGL-Kontext** („Web page caused context loss and was blocked"), Prüfung 2 im Erstlauf beider Formate deshalb ABBRUCH |
| iPad, Teil E | JPEG-Bild bei offenem Pausenmenü | Kontext verloren, 33 Shaderfehler |
| mini, Teil E | JPEG-Bild bei offenem Pausenmenü | kein Verlust |

Das Pausenmenü (`#pause`, `backdrop-filter: blur(3px)` über der Leinwand) ist alt und von Paket 41 nicht geändert; ⏸ öffnet dasselbe Menü wie ☰. Ursache vermutlich der Headless-GPU-Prozess (Intel HD 5500, D3D11) — **nicht auf dem Gerät geprüft**. Der Rauchtest legt die Pause deshalb an das Ende (Teil E).

## Auf dem Gerät zu prüfen (Patrick)

1. Prüfung 1, 3 und 6 starten: Fliegt die Kamera in rund 3 s zum Teil, zum Ziel und zurück? Ist am Ende alles wie vorher (kein Ruck)? Erkennst du im Flug, welches Teil wohin gehört — obwohl dabei noch kein Leuchten, kein Weg und kein Pfeil zu sehen ist?
2. Mitten im Flug einmal kurz auf den Bildschirm tippen: Steht die Kamera sofort normal, ohne dass sich Bagger oder Ansicht bewegen?
3. Oben die Zeile: Sind Bild → Bild und die Wörter in 4 s gut lesbar? Holt ein Tipp auf die Bilder die Wörter zurück? Öffnet ⏸ das Pausenmenü und läuft das Spiel nach WEITER normal weiter (kein schwarzes Bild)?
4. Prüfung 3: Passt jede Leuchtfarbe zum Schild ihrer Mulde? Verwirren die gekreuzten Wege (blau läuft dicht an den rosa Teilen vorbei)?
5. Prüfung 6: Kommt beim Hinausfahren ohne Pratzen die Überlast-Meldung und das Stützen-Zeichen? (Am PC kam sie nicht: Im Spiel ist der Baggerausbau freigeschaltet, Traglast × 1,5 — Befund 3.)
