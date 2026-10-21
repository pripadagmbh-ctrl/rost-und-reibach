# Messprotokoll S5 — Leistung der Schicht (21.10.2026)

**Kein Gerätetest.** Entwicklungs-PC (Windows 10, 4 Kerne), kopflos unter Node (`vite-node`) bzw. Headless-Chromium. Alle ms-Werte gelten für diesen PC, nicht für iPad oder iPhone mini. **Auf dem iPhone mini ist bisher nichts gemessen** — weder hier noch in einem früheren Protokoll (`docs/messungen/*`, `docs/log/*` durchsucht: alle fps-/ms-Werte stammen vom PC). Die Vorlage für Patricks Messung steht unten.

- **Stand:** Branch `v1/schicht`, Commit `fa3deae` (E-204) plus die S5-Änderungen an `test/schichtlauf.ts` und `tools/schicht-lauf.ts`. Parallel offene Arbeit von S4 in `src/ui/*`, `src/core/*` (nicht im Prüfstand geladen).
- **Auftrag** (Orchestrator, Patricks Vorgabe): „Fuhrengröße wie heute (~8 t) — miss die Leistung auf dem Weg zum iPhone mini (Körperzahl/Physik-ms bei voller Freitag-Welle) besonders sorgfältig."
- **Werkzeug:** `npx vite-node tools/schicht-lauf.ts` mit `STUFE`, `SAAT`, `GRIFF` (Prüfstand `test/schichtlauf.ts`: Platz, Büro, Boxen, Presse, Fuhrpark, Schichtbetrieb mit den Kontaktwerten des Spiels; **ohne Bagger, ohne Spinne, ohne Zeichnen**). Test-Fahrer: ein Teil je `GRIFF` s von der Annahme dorthin, wo es hingehört; Lagerfahrt 20 s je Richtung; `GRIFF=0` = niemand räumt. Zufall fest: `saat · 7919 + 13`. Fuhren unverändert (`loadCargo`, ~8 t).
- **Gezählt** alle 0,1 s (6 Takte): Körper gesamt, beweglich, beweglich-wach — je Minute der **Höchststand** (neu in S5; E-202 druckte den Wert am Minutenende). Physik-ms = `world.step()` je Takt, Takt-ms = Physik + Fuhrpark + Boxen + Betrieb, ohne die erste Sekunde (WASM-Aufwärmen).
- **Fremdlast:** Während der Messreihe (22:05–22:31) liefen Tests anderer Agenten auf demselben Rechner. Einzelne Takte bis 840 ms, „> 8 ms"-Takte je Minute bis 311 — das ist Rechnerlast, keine Spiellast (gleiche Saat, gleiche Körper, die Zahlen schwanken zwischen Läufen um das Mehrfache). Die Körperzahlen sind davon unberührt: Gleiche Saat ergibt dieselben Höchststände (Saat 1 und 5 je zweimal gefahren, Körper/beweglich/wach gleich).

## Übersicht

| Lauf | Körper max | beweglich max | wach max | Physik ms Mittel / p95 (schlechteste Minute) | Takt ms Mittel / p95 (schlechteste Minute) | eingefahren (Plan) | Verlader ab vor 16:00 | Standgeld s | lose am Ende |
|---|---|---|---|---|---|---|---|---|---|
| Montag, Saat 1, 4 s | 77 | 46 | 27 | 1,42 / 2,03 | 3,48 / 10,44 | 4 von 4 | 2 | 38 | 0,0 t |
| Freitag, Saat 1, 4 s | 122 | 85 | 40 | 3,16 / 4,40 | 6,91 / 40,32 | 6 von 7 | 3 | 627 | 0,0 t |
| Freitag, Saat 2, 4 s | **124** | **87** | **48** | 4,18 / 21,18 | 6,48 / 35,72 | 6 von 7 | **0** | 556 | 9,3 t |
| Freitag, Saat 3, 4 s | 103 | 62 | 36 | 2,61 / 2,65 | 6,58 / 36,44 | 6 von 7 (eine davon holt nur die Mulde) | 1 — **Stau ab 350 s** (Befund S5-1) | 582 | 0,4 t |
| Freitag, Saat 1, 8 s | **126** | **89** | 46 | 4,38 / 22,76 | 7,17 / 36,29 | 6 von 7 | 0 | 859 | 7,2 t |
| Freitag, Saat 2, 8 s | 117 | 80 | 41 | 8,04 / 25,76 | 14,22 / 46,57 | 6 von 7 | 0 | 524 | 10,2 t |
| Freitag, Saat 3, 8 s | 108 | 72 | 40 | 2,34 / 3,74 | 9,71 / 30,76 | 7 von 7 | 0 | 769 | 0,1 t |
| Freitag, Saat 1, niemand räumt | 77 | 40 | 36 | 8,21 / 17,48 | 14,26 / 42,76 | 5 von 7 | 0 | 1 198 | 9,5 t |

**Dieselben Läufe ohne Fremdlast-Spitzen** (Wächter unter Vitest, ganze Schicht gemittelt, 21.10.2026 ~22:00): Freitag Saat 1, 4 s — Physik **1,06 ms** Mittel / 2,06 p95, Takt 2,31 / 3,96; Freitag Saat 5 — Physik 0,99 / 2,22, Takt 2,19 / 4,09; Freitag Saat 1 doppelter Fahrplan — Physik 1,86 / 3,44, Takt 3,27 / 6,04. E-202 maß auf ruhigerem Rechner für Freitag in der schlechtesten Minute 0,78–1,22 ms Mittel.

**Weitere Saaten (Wächter-Lauf, `leistungsLauf`, 4 s):** Saat 4: Körper 115, beweglich 84, wach 41, Verlader vor 16:00 0; Saat 5: 117 / 81 / 44, Verlader 3. **Doppelter Fahrplan** (jede Fuhre zweimal angemeldet, Fuhren bleiben ~8 t): Saat 1 → 139 / 107 / 64, Saat 2 → 142 / 106 / 59, Saat 3 → 162 / 125 / 58. Die Annahme macht ab 10 t losem Schrott zu (E-202, `ANNAHME_ZU_KG`) — darum wird aus doppelt so vielen Fuhren nicht doppelt so viele Körper, sondern +12 bis +57 %.

**Ruhe nach Feierabend** (20 s ohne Griff, ohne Fuhre; bewegliche, nicht schlafende Körper): Saaten 1–5 auf dem Platz 0 / 2 / 0 / 1 / 3, auf Lastern 0 / 5 / 0 / 3 / 21. Die wachen „Platz"-Körper liegen an der Annahme (6–7 | −25…−26) bzw. am KUPFER-LAGER (−17…−18 | −4,8) — also neben einem stehenden Laster (E-177: Rapier hält, was einen kinematischen Körper berührt, wach). Doppelter Fahrplan Saat 1: **35** wach im KABEL-LAGER (−36 | −8) — dort wurde bis 16:00 entladen; 20 s reichen für diesen Haufen nicht.

## Browser-Rauchtest (`tools/schicht-smoke.mjs`, Headless-Chromium, D3D11)

Je Stufe `#schicht=<stufe>`, 120 s über `__game.step` (Uhr mitgeführt), Konsolenfehler, Verlader am Halt, eine Fuhre angekommen. Zwei Läufe am 21.10.2026 abends (der Fahrplan würfelt im Spiel jedes Mal neu), beide Exit-Code 0. Bilder des zweiten Laufs (Hilfetafel aus): `montag|mittwoch|freitag-orbit.png`, `…-draufsicht.png` im Scratchpad `schicht/s5/`. Spielstart nach 2 s: 55–56 Körper, 10 beweglich, davon Bagger 5 Körper (0 beweglich).

| Stufe | Laden | Verlader am Halt | Fuhre angekommen | Konsolenfehler | nach 120 s: Körper / beweglich / wach | Laster |
|---|---|---|---|---|---|---|
| Montag | 19,8 s / 12,3 s | ja (0,00 m) | ja (Kipper kippt bei 45 s) | 0 / 0 | 48 / 15 / 0 · 52 / 19 / 0 | 2 / 2 |
| Mittwoch | 25,4 s / 11,0 s | ja | ja (Pritsche wartet ab 62 s) | 0 / 0 | 57 / 19 / 9 · 55 / 17 / 7 | 3 / 3 |
| Freitag | 36,2 s / 9,9 s | ja | ja (Pritsche wartet ab 47 s) | 0 / 0 | 66 / 28 / **18** · 87 / 44 / **32** | 3 / 4 |

Freitag im echten Spiel: Solange die Pritsche auf das Abladen wartet, sind **18 Körper ununterbrochen wach** (ihre Ladung, E-177) — das ist genau die Last, die auf dem iPhone mini bis zu 240 s anliegt, wenn der Spieler sie warten lässt (E-082).

Laden 20–36 s = Dev-Server mit Einzelmodulen am belasteten PC, keine Aussage über das Gerät (vgl. `2026-10-19_aufgaben-smoke.md`).

## Wächter (S5)

Schranken in `test/schichtlauf.ts` (`LEISTUNGS_SCHRANKEN`, Herkunft dort): Körper ≤ 160, beweglich ≤ 110, nach 20 s Ruhe wach auf dem Platz ≤ 6 (Ladung auf Lastern getrennt gezählt, ohne Schranke), kein Laster > 60 s fest außerhalb gewollten Wartens, Feierabend erreicht, mindestens ein Verlader fährt **vor** 16:00. Physik-ms nur ausgegeben.

| Datei | Lauf | Ergebnis | Dauer in der vollen Suite |
|---|---|---|---|
| `test/schichtleistung.test.ts` | Freitag Saat 1, 4 s | grün — 122 / 85, Ruhe 0 + 0 auf Lastern, Stillstand 21,3 s, Verlader 3 | 69,9 s |
| `test/schichtleistung-saat5.test.ts` | Freitag Saat 5, 4 s | grün — 117 / 81, Ruhe 3 + 21 auf Lastern, Stillstand 29,7 s, Verlader 3 | 47,7 s |
| `test/schichtleistung-gegenprobe.test.ts` | Saat 1, doppelter Fahrplan | grün = Messung ändert sich: 139 / 107 statt höchstens 124 / 87; **reißt** zugleich die Ruhe-Schranke (35 wach > 6) | 77,7 s |
| `test/schichtleistung-befund.test.ts` | Saat 3 bis 420 s, `it.fails` | grün = Stau noch da (73 s Stillstand bei 420 s) | 38,6 s |

Gegenprobe im selben Lauf (Saat 1): Körper wachsen von 31 auf 122 (+91, Schranke ≥ +40), wach max 40 (≥ 24) — ein Zähler, der nichts misst, bliebe beim Startwert.

Volle Suite 21.10.2026 nach S5: 208 Dateien, 2 530 Tests grün (2 übersprungen: `tonaufnahmen.test.ts`, kein ffmpeg), 915 s mit Fremdlast; `npm run build` grün.

## Bewertung für das iPhone mini

1. **Körperzahl:** Freitag mit dem Test-Fahrer höchstens 103–126 Körper, 62–89 beweglich (Prüfstand). Im Spiel kommt dazu, was der Prüfstand nicht hat (Bagger mit Spinne: 5 Körper, keiner beweglich, `excavator.selfHandles`; dazu Platzinventar und Kulisse): **+12 bis +24 Körper, +6 beweglich** (Herleitung: Spielstart 55 / 10 gegen Prüfstand-Start 31 / 4 — im Spiel ist die erste Fuhre dabei schon unterwegs, also Obergrenze; Montag im Spiel nach Abfahrt des ersten Kippers 48 / 15 gegen Prüfstand 31 / 4 plus dieselben 5 gekippten Teile = 36 / 9). Freitag-Spitze im Spiel damit geschätzt **rund 115–150 Körper, 70–95 beweglich**. Vergleich: Der Sandkasten-Start hatte im Spiel 123–132 Körper / 72–76 beweglich (E-201) — das ist der Stand, mit dem Patrick bisher auf dem Gerät gespielt hat; einen Ruckel-Befund dazu gibt es im Log nicht (das ist keine Messung, nur: keiner gemeldet). **Die Freitag-Spitze liegt in derselben Größenordnung, beweglich aber bis ~20 Körper darüber, und anders als der ruhende Sandkasten-Haufen sind bis 48 davon gleichzeitig wach** (Kippen, Abladen, wartende Pritsche).
2. **Spitzen sind kurz, Grundlast ist lang:** Wach > 30 tritt in den Minuten 2–4 (07:00–10:00, erste Welle) und 6–10 (ab der Spitze um 11:00/11:20 bis zu den späten Fuhren) auf, jeweils solange gekippt oder abgeladen wird. Lang anliegend sind die 18–23 wachen Teile auf einem wartenden Laster.
3. **Langsamer Spieler = mehr Körper:** Mit 1 Teil/8 s steigt der Höchststand (Saat 1: 122 → 126), und kein Verlader fährt vor 16:00 voll weg. Die Annahme-Schranke (10 t) hält die Zahl trotzdem unter ~130.
4. **Physik-ms:** Am PC 1–2 ms je Schritt im Mittel, unter Last bis 8 ms. Ein Faktor PC → iPhone mini ist **nicht gemessen**; erst Patricks F3-Werte sagen, ob die 16,7 ms je Bild (60 Hz) reichen. Bei unter 12 Bildern/s läuft die Physik der Schicht-Uhr hinterher (`main.ts:88` höchstens 5 Schritte je Bild, Uhr in `main.ts:1912` im Bildtakt) — dann wird die Schicht auf langsamen Geräten härter, nicht nur ruckeliger.
5. **Einschätzung:** Nicht kritisch nach den PC-Zahlen; ob das iPhone mini flüssig bleibt, ist offen. Wenn die Gerätemessung bei voller Welle unter ~30 FPS fällt, sind die Stellschrauben in dieser Reihenfolge: (a) wartende Laster-Ladung fest machen wie die abgesetzte Mulde (E-141/E-177, `src/delivery/vehicles.ts`, Fuhrpark — spart 18–23 wache Körper je wartendem Laster); (b) Annahme früher schließen (`src/delivery/schichtbetrieb.ts:43` `ANNAHME_ZU_KG = 10_000`, SW); (c) ruhende Teile in den Boxen bündeln (`items.consolidate`, `src/world/scrapItems.ts:2375`, greift erst ab 260 Teilen — in der Schicht nie). Fuhrengröße bleibt (Patricks Vorgabe).

## Je Minute

Höchststand der Minute; Physik/Takt in ms je Schritt (60 Hz); Laster = auf dem Hof (inkl. Verlader, Nachrücker, abgesetzte Mulde); wartend = fällige Fuhren am Tor. Die ms-Spalten tragen die Fremdlast (siehe oben).

### Montag, Saat 1, 1 Teil/4 s
Schicht montag, Saat 1, Test-Fahrer 1 Teil je 4 s — Fahrplan: 0 s kipper, 220 s kipper, 300 s kipper, 320 s kipper

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 49 | 18 | 18 | 0,79 | 1,25 | 2,09 | 4,13 | 3 | 0 | 0 |
| 2 | 49 | 18 | 10 | 0,75 | 0,74 | 1,35 | 1,90 | 2 | 0 | 0 |
| 3 | 45 | 18 | 5 | 0,59 | 0,53 | 0,98 | 1,00 | 2 | 0 | 0 |
| 4 | 60 | 29 | 16 | 0,57 | 0,65 | 1,10 | 1,69 | 3 | 0 | 0 |
| 5 | 60 | 29 | 16 | 0,96 | 1,26 | 2,30 | 3,67 | 2 | 1 | 1 |
| 6 | 73 | 42 | 27 | 0,82 | 1,03 | 2,83 | 6,63 | 3 | 1 | 2 |
| 7 | 77 | 46 | 26 | 1,42 | 2,03 | 3,48 | 10,44 | 3 | 0 | 2 |
| 8 | 77 | 46 | 21 | 1,38 | 1,53 | 2,93 | 6,95 | 2 | 0 | 2 |
| 9 | 73 | 46 | 9 | 1,28 | 1,36 | 2,18 | 3,54 | 2 | 0 | 2 |
| 10 | 73 | 46 | 8 | 1,06 | 1,16 | 1,77 | 2,43 | 2 | 0 | 2 |
| 11 | 73 | 40 | 2 | 1,16 | 3,62 | 2,34 | 5,19 | 2 | 0 | 3 |

Fuhren: kipper 14 Teile 7.2 t · kipper 11 Teile 9.5 t · kipper 22 Teile 7.6 t · kipper 10 Teile 9.1 t
Abfahrten: 291 s mixed 9 Teile 10.14 t · 336 s copper 6 Teile 1.85 t · 600 s mixed 6 Teile 2.43 t
Höchststand der Schicht: Körper 77, dynamisch 46, wach 27
Griffe: 63 · lose am Ende 0.0 t · Meldungen 11

### Freitag, Saat 1, 1 Teil/4 s
Schicht freitag, Saat 1, Test-Fahrer 1 Teil je 4 s — Fahrplan: 0 s pritsche, 127 s pritsche (cable), 130 s kipper, 300 s pritsche, 320 s absetzer, 348 s pritsche (va), 420 s absetzer

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 46 | 14 | 14 | 0,57 | 0,75 | 1,60 | 2,73 | 3 | 0 | 0 |
| 2 | 46 | 14 | 5 | 0,45 | 0,49 | 1,14 | 1,60 | 2 | 0 | 0 |
| 3 | 88 | 52 | 40 | 1,80 | 3,45 | 3,42 | 8,77 | 4 | 0 | 0 |
| 4 | 88 | 52 | 39 | 1,84 | 2,61 | 3,60 | 8,67 | 3 | 0 | 0 |
| 5 | 84 | 52 | 19 | 1,50 | 2,09 | 2,85 | 7,11 | 2 | 1 | 0 |
| 6 | 122 | 85 | 38 | 1,98 | 2,90 | 4,34 | 14,92 | 4 | 1 | 1 |
| 7 | 122 | 74 | 32 | 3,16 | 4,40 | 6,91 | 40,32 | 4 | 1 | 1 |
| 8 | 108 | 74 | 22 | 2,76 | 2,13 | 5,58 | 41,74 | 4 | 2 | 1 |
| 9 | 108 | 74 | 22 | 1,74 | 1,56 | 4,13 | 14,15 | 3 | 2 | 2 |
| 10 | 103 | 67 | 11 | 1,22 | 1,08 | 4,23 | 19,97 | 3 | 1 | 3 |
| 11 | 97 | 61 | 0 | 0,89 | 0,89 | 2,27 | 2,98 | 3 | 0 | 3 |

Fuhren: pritsche 10 Teile 8.5 t · pritsche (cable) 25 Teile 4.6 t · kipper 13 Teile 7.1 t · pritsche 10 Teile 8.5 t · pritsche (va) 23 Teile 7.4 t · absetzer 5 Teile 2.0 t
Abfahrten: 356 s mixed 11 Teile 8.93 t · 536 s copper 7 Teile 2.66 t · 580 s steel 5 Teile 6.28 t
Höchststand der Schicht: Körper 122, dynamisch 85, wach 40
Griffe: 92 · lose am Ende 0.0 t · Meldungen 14

### Freitag, Saat 2, 1 Teil/4 s
Schicht freitag, Saat 2, Test-Fahrer 1 Teil je 4 s — Fahrplan: 0 s absetzer, 115 s pritsche (va), 130 s kipper, 300 s kipper, 320 s pritsche, 420 s absetzer, 430 s pritsche (cable)

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 11 | 11 | 0,71 | 0,69 | 1,95 | 1,83 | 3 | 0 | 0 |
| 2 | 69 | 37 | 30 | 0,80 | 0,58 | 1,95 | 2,31 | 3 | 0 | 0 |
| 3 | 74 | 38 | 30 | 2,39 | 2,28 | 4,67 | 31,80 | 4 | 0 | 0 |
| 4 | 74 | 38 | 27 | 2,15 | 1,61 | 3,75 | 17,70 | 3 | 0 | 0 |
| 5 | 70 | 38 | 24 | 1,49 | 1,67 | 2,73 | 2,98 | 3 | 1 | 0 |
| 6 | 79 | 43 | 12 | 1,44 | 1,09 | 3,72 | 9,18 | 4 | 1 | 0 |
| 7 | 98 | 61 | 28 | 1,75 | 1,96 | 4,29 | 17,84 | 3 | 0 | 0 |
| 8 | 124 | 87 | 48 | 3,78 | 11,87 | 6,48 | 35,72 | 4 | 1 | 0 |
| 9 | 124 | 87 | 42 | 4,18 | 21,18 | 6,08 | 31,52 | 4 | 1 | 0 |
| 10 | 124 | 87 | 40 | 2,64 | 2,72 | 5,26 | 25,96 | 3 | 1 | 0 |
| 11 | 119 | 78 | 7 | 0,92 | 1,17 | 5,27 | 40,23 | 3 | 0 | 1 |

Fuhren: absetzer 7 Teile 3.2 t · pritsche (va) 26 Teile 8.5 t · kipper 1 Teile 9.0 t · kipper 5 Teile 9.0 t · pritsche 18 Teile 8.5 t · pritsche (cable) 27 Teile 4.4 t
Abfahrten: 600 s mixed 9 Teile 5.04 t
Höchststand der Schicht: Körper 124, dynamisch 87, wach 48
Griffe: 68 · lose am Ende 9.3 t · Meldungen 9

### Freitag, Saat 3, 1 Teil/4 s (Stau ab 350 s, Befund S5-1)
Schicht freitag, Saat 3, Test-Fahrer 1 Teil je 4 s — Fahrplan: 0 s absetzer, 114 s pritsche (alu), 130 s kipper, 300 s pritsche, 311 s pritsche (copper), 320 s kipper, 420 s absetzer

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 10 | 10 | 0,60 | 0,59 | 1,96 | 2,30 | 4 | 0 | 0 |
| 2 | 57 | 22 | 12 | 0,42 | 0,44 | 1,58 | 1,91 | 4 | 0 | 0 |
| 3 | 66 | 30 | 20 | 1,30 | 1,14 | 3,58 | 8,97 | 4 | 0 | 0 |
| 4 | 66 | 30 | 18 | 1,20 | 1,25 | 3,19 | 5,44 | 3 | 0 | 0 |
| 5 | 62 | 30 | 12 | 0,99 | 0,76 | 1,82 | 1,81 | 2 | 1 | 0 |
| 6 | 103 | 62 | 36 | 1,94 | 2,49 | 4,99 | 21,59 | 4 | 1 | 1 |
| 7 | 103 | 62 | 29 | 2,61 | 2,65 | 6,58 | 36,44 | 4 | 1 | 1 |
| 8 | 103 | 62 | 24 | 1,79 | 1,88 | 4,94 | 23,57 | 4 | 2 | 1 |
| 9 | 103 | 62 | 5 | 1,34 | 0,97 | 4,70 | 24,94 | 4 | 2 | 1 |
| 10 | 103 | 62 | 2 | 1,08 | 0,71 | 4,27 | 21,17 | 4 | 2 | 1 |
| 11 | 103 | 60 | 0 | 0,89 | 0,74 | 3,61 | 21,62 | 4 | 0 | 1 |

Fuhren: absetzer 6 Teile 3.0 t · absetzer 0 Teile 0.0 t · pritsche (alu) 12 Teile 2.7 t · kipper 8 Teile 9.5 t · pritsche 10 Teile 8.5 t · pritsche (copper) 26 Teile 8.5 t
Abfahrten: 343 s mixed 4 Teile 8.53 t
Höchststand der Schicht: Körper 103, dynamisch 62, wach 36
Griffe: 55 · lose am Ende 0.4 t · Meldungen 10

### Freitag, Saat 1, 1 Teil/8 s
Schicht freitag, Saat 1, Test-Fahrer 1 Teil je 8 s — Fahrplan: 0 s pritsche, 127 s pritsche (cable), 130 s kipper, 300 s pritsche, 320 s absetzer, 348 s pritsche (va), 420 s absetzer

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 46 | 14 | 14 | 0,75 | 0,73 | 2,02 | 1,92 | 3 | 0 | 0 |
| 2 | 46 | 14 | 7 | 0,68 | 0,59 | 1,55 | 1,96 | 3 | 0 | 0 |
| 3 | 88 | 52 | 40 | 1,39 | 2,46 | 2,82 | 4,56 | 4 | 0 | 0 |
| 4 | 88 | 52 | 40 | 1,74 | 2,45 | 3,27 | 5,28 | 3 | 0 | 0 |
| 5 | 84 | 52 | 21 | 1,25 | 1,39 | 2,18 | 2,98 | 3 | 1 | 0 |
| 6 | 103 | 66 | 46 | 2,11 | 2,74 | 3,87 | 9,86 | 4 | 2 | 0 |
| 7 | 126 | 89 | 40 | 2,48 | 3,75 | 4,84 | 18,25 | 4 | 1 | 0 |
| 8 | 126 | 89 | 43 | 4,38 | 22,76 | 6,82 | 36,88 | 4 | 2 | 0 |
| 9 | 126 | 89 | 44 | 3,44 | 5,45 | 5,99 | 34,82 | 4 | 2 | 0 |
| 10 | 126 | 89 | 31 | 3,44 | 11,75 | 7,17 | 36,29 | 4 | 1 | 0 |
| 11 | 122 | 76 | 19 | 2,25 | 2,80 | 6,24 | 36,39 | 4 | 0 | 1 |

Fuhren: pritsche 10 Teile 8.5 t · pritsche (cable) 25 Teile 4.6 t · kipper 13 Teile 7.1 t · pritsche 14 Teile 8.5 t · pritsche (va) 23 Teile 7.4 t · absetzer 10 Teile 2.6 t
Abfahrten: 600 s mixed 2 Teile 1.80 t
Höchststand der Schicht: Körper 126, dynamisch 89, wach 46
Griffe: 58 · lose am Ende 7.2 t · Meldungen 8

### Freitag, Saat 2, 1 Teil/8 s
Schicht freitag, Saat 2, Test-Fahrer 1 Teil je 8 s — Fahrplan: 0 s absetzer, 115 s pritsche (va), 130 s kipper, 300 s kipper, 320 s pritsche, 420 s absetzer, 430 s pritsche (cable)

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 11 | 11 | 0,68 | 0,76 | 1,92 | 2,31 | 3 | 0 | 0 |
| 2 | 68 | 36 | 29 | 0,70 | 0,54 | 1,66 | 2,27 | 3 | 0 | 0 |
| 3 | 73 | 37 | 29 | 2,28 | 2,60 | 4,38 | 20,86 | 4 | 0 | 0 |
| 4 | 73 | 37 | 26 | 2,30 | 2,01 | 3,90 | 13,44 | 3 | 0 | 0 |
| 5 | 69 | 37 | 24 | 1,89 | 1,79 | 3,03 | 5,23 | 3 | 1 | 0 |
| 6 | 87 | 51 | 35 | 1,63 | 1,92 | 3,67 | 10,95 | 4 | 1 | 0 |
| 7 | 108 | 71 | 38 | 1,62 | 2,77 | 3,52 | 7,68 | 3 | 0 | 0 |
| 8 | 117 | 80 | 41 | 2,80 | 4,37 | 4,63 | 14,20 | 4 | 1 | 0 |
| 9 | 117 | 80 | 36 | 5,42 | 20,79 | 8,52 | 36,05 | 4 | 1 | 0 |
| 10 | 117 | 80 | 32 | 8,04 | 25,76 | 14,22 | 46,57 | 3 | 1 | 0 |
| 11 | 112 | 77 | 20 | 3,08 | 17,89 | 5,49 | 19,52 | 3 | 0 | 1 |

Fuhren: absetzer 7 Teile 3.2 t · pritsche (va) 26 Teile 8.5 t · kipper 1 Teile 9.0 t · kipper 14 Teile 9.5 t · pritsche 20 Teile 8.5 t · pritsche (cable) 10 Teile 1.3 t
Abfahrten: 600 s mixed 3 Teile 1.59 t
Höchststand der Schicht: Körper 117, dynamisch 80, wach 41
Griffe: 47 · lose am Ende 10.2 t · Meldungen 12

### Freitag, Saat 3, 1 Teil/8 s
Schicht freitag, Saat 3, Test-Fahrer 1 Teil je 8 s — Fahrplan: 0 s absetzer, 114 s pritsche (alu), 130 s kipper, 300 s pritsche, 311 s pritsche (copper), 320 s kipper, 420 s absetzer

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 10 | 10 | 0,40 | 0,57 | 1,34 | 2,37 | 4 | 0 | 0 |
| 2 | 57 | 22 | 12 | 0,39 | 0,50 | 1,38 | 2,12 | 5 | 0 | 0 |
| 3 | 62 | 26 | 15 | 0,72 | 1,00 | 1,92 | 3,00 | 4 | 0 | 0 |
| 4 | 62 | 26 | 13 | 1,01 | 1,50 | 2,65 | 5,59 | 3 | 0 | 0 |
| 5 | 58 | 26 | 11 | 0,57 | 0,94 | 1,24 | 2,00 | 2 | 1 | 0 |
| 6 | 101 | 64 | 40 | 1,51 | 2,65 | 3,27 | 6,46 | 4 | 1 | 0 |
| 7 | 101 | 64 | 40 | 2,34 | 3,74 | 3,84 | 6,92 | 4 | 1 | 0 |
| 8 | 101 | 64 | 35 | 1,97 | 3,06 | 3,39 | 7,00 | 4 | 2 | 0 |
| 9 | 101 | 64 | 32 | 1,88 | 3,05 | 3,47 | 8,07 | 4 | 2 | 0 |
| 10 | 108 | 72 | 28 | 2,17 | 2,74 | 4,81 | 15,56 | 4 | 1 | 0 |
| 11 | 108 | 53 | 1 | 1,31 | 7,14 | 9,71 | 30,76 | 4 | 0 | 1 |

Fuhren: absetzer 6 Teile 3.0 t · absetzer 0 Teile 0.0 t · pritsche (alu) 12 Teile 2.7 t · kipper 4 Teile 7.3 t · pritsche 10 Teile 8.5 t · pritsche (copper) 28 Teile 8.5 t · kipper 15 Teile 7.8 t
Abfahrten: 600 s mixed 4 Teile 7.14 t
Höchststand der Schicht: Körper 108, dynamisch 72, wach 40
Griffe: 51 · lose am Ende 0.1 t · Meldungen 9

### Freitag, Saat 1, niemand räumt
Schicht freitag, Saat 1, niemand räumt — Fahrplan: 0 s pritsche, 127 s pritsche (cable), 130 s kipper, 300 s pritsche, 320 s absetzer, 348 s pritsche (va), 420 s absetzer

| Min | Körper | beweglich | wach | Physik ms Mittel | Physik ms p95 | Takt ms Mittel | Takt ms p95 | Laster | wartend | Verlader ab |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 46 | 14 | 14 | 1,20 | 0,91 | 3,64 | 5,97 | 3 | 0 | 0 |
| 2 | 46 | 14 | 10 | 1,75 | 1,06 | 3,23 | 5,33 | 3 | 0 | 0 |
| 3 | 77 | 40 | 36 | 8,21 | 17,48 | 14,26 | 42,76 | 4 | 1 | 0 |
| 4 | 77 | 40 | 36 | 4,92 | 5,13 | 6,76 | 9,74 | 4 | 1 | 0 |
| 5 | 77 | 40 | 36 | 1,93 | 2,14 | 3,08 | 3,72 | 4 | 1 | 0 |
| 6 | 72 | 36 | 32 | 1,87 | 1,99 | 3,11 | 4,08 | 4 | 3 | 0 |
| 7 | 76 | 39 | 29 | 1,26 | 1,77 | 2,33 | 3,36 | 4 | 1 | 0 |
| 8 | 60 | 23 | 18 | 1,14 | 1,27 | 1,99 | 2,59 | 4 | 2 | 0 |
| 9 | 60 | 23 | 18 | 2,37 | 3,15 | 3,70 | 9,33 | 4 | 2 | 0 |
| 10 | 60 | 23 | 18 | 1,89 | 1,98 | 3,02 | 4,81 | 4 | 2 | 0 |
| 11 | 60 | 23 | 18 | 1,01 | 1,05 | 1,61 | 1,95 | 4 | 0 | 0 |

Fuhren: pritsche 10 Teile 8.5 t · pritsche (cable) 26 Teile 6.6 t · kipper 6 Teile 9.5 t · pritsche 3 Teile 6.0 t · pritsche (va) 10 Teile 4.0 t
Abfahrten: 
Höchststand der Schicht: Körper 77, dynamisch 40, wach 36
Griffe: 0 · lose am Ende 9.5 t · Meldungen 7

## Vorlage für Patricks Gerätemessung (iPhone mini, Freitag)

**Vorbereiten:** iPhone mini geladen, keine anderen Apps offen, Ton egal. Schicht **Freitag** starten (sobald sie im Menü steht; sonst die Adresse mit `#schicht=freitag` am Ende). Die Zahlen einblenden: **fünf Finger gleichzeitig** aufs Glas legen — es vibriert kurz, oben links erscheinen die Zahlen. Noch einmal fünf Finger blendet sie aus.

**Ablesen** (die Uhr steht oben rechts; eine Schicht-Minute ist eine echte Sekunde):

| Wann (Schicht-Uhr) | Was gerade passiert | FPS | Frame ms | Physik ms | Körper (wach) | Beweglich (wach) | Ruckelt es? |
|---|---|---|---|---|---|---|---|
| 06:05 | Start, Verlader vor dir | | | | | | |
| wenn der erste Laster abkippt/abgeladen wird | | | | | | | |
| 11:00–11:30 | Spitze: zwei Fuhren kurz hintereinander | | | | | | |
| wenn eine Pritsche am Lager wartet | | | | | | | |
| wann immer es ruckelt | (bitte notieren, was gerade passiert) | | | | | | |
| 15:30 | kurz vor Feierabend | | | | | | |

**Was die Zeilen bedeuten:** `FPS` = Bilder je Sekunde (60 ist flüssig, unter 30 merkt man es). `Frame` = wie lange ein Bild dauert. `Arbeit: Physik … ms` = die Rechenzeit der Schrott-Physik je Bild. `Koerper` und `Beweglich` = wie viele Teile gerechnet werden, in Klammern die, die sich gerade bewegen. Ein Foto vom Bildschirm (Seitentaste + Lautstärke hoch) reicht statt Abschreiben.

**Am Ende:** Wie viele Fuhren kamen, ob es irgendwann hing (Laster bewegt sich nicht mehr), und ein Satz zum Gefühl.

## Befunde und Aufgaben

| # | Schwere | Was | Reproduktion | Zuständig |
|---|---|---|---|---|
| S5-1 | Blocker (Schicht) | Freitag Saat 3: Der volle Verlader fährt um 343 s los und bleibt bei (−10,0 \| −5,9) in `out` stehen, der Nachrücker (für Kupfer) ab ~355 s in `approach` bei (−4,1 \| 2,3); die Kupfer-Pritsche am Lager kommt danach nicht weg (`ausfaedeln` bei (−18,0 \| −3,4)). 254 s Stillstand bis Feierabend, Standgeld läuft. In 1 von 5 Saaten (1–5), mit 8 s/Teil nicht (dort fährt der Verlader nie). | `STUFE=freitag SAAT=3 GRIFF=4 npx vite-node tools/schicht-lauf.ts` · Wächter `test/schichtleistung-befund.test.ts` (`it.fails`) | welt (Fuhrpark, `src/delivery/vehicles.ts`) |
| S5-2 | Wichtig | Der Freitag-Wächter in `schichtbetrieb.test.ts` fährt genau einen Zufallsverlauf (`festerZufall(202)`, Saat 3) und ist grün; derselbe Fahrplan mit anderem Zufall staut sich (S5-1). Der Stau hängt am Modulzustand: im selben Testlauf nach einem anderen Lauf verlief Saat 3 ohne Stau. | wie S5-1 | qa (Wächter um Saaten erweitert, sobald S5-1 behoben) |
| S5-3 | Hinweis | `__game.step(n)` bewegt die Schicht-Uhr nicht (Uhr nur im Bildtakt, `main.ts:1912`). Der Rauchtest führt sie mit `daylight.update(1)` je 60 Schritte nach. | `tools/schicht-smoke.mjs` | Orchestrator (main.ts), nur falls Messungen per `step` die Uhr brauchen |
| S5-4 | Hinweis | Test-Fahrer hupt den Misch-Verlader nie: Mit Saat 2 und 4 fährt er vor 16:00 nie, 9,3 t bleiben lose. Ein Spieler würde hupen. Deshalb Saaten 1 und 5 im Wächter. | Saat 2, 4 s | qa (Test-Fahrer, falls gewünscht) |
