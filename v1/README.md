# Rust'n'Reibach — v1

**`v1/` ist der Arbeitsordner.** Nachfolger des Prototyps, kopiert am 14.09.2026 vom Stand
`f3c3c52`. `prototype/` und `v2/` bleiben eingefroren und werden nie geändert — die Regeln
stehen in `../CLAUDE.md`, die Entscheidungen in `docs/entscheidungen.md` (ab E-001).

Stand: **M1 gebaut, Gerätetest offen. M2 Phase A gebaut, Gerätetest offen.** Zapfen statt
breiter Ring an der Spinne (E-007), Rückwände raus an den vier Sortiermulden (E-006),
Kommentar-Regel für Messwerte (E-008), der Fünfschalengreifer als Vorschaumodell (E-009),
Platzumbau auf die L-Silos und die Mulde „BUNT + VA" (E-026 bis E-028), Bestandsaufnahme
der Sortierung (E-029), Typprüfung für `test/` und `tools/` (E-038). Prüfkette grün
(21.09.2026, beide Rückgabewerte 0 einzeln geprüft): `npm test` **1.479 Prüfungen in 127
Dateien** in 187 bis 316 s, `npm run build` sauber. Abgenommen ist nichts davon vor Patricks
Gerätetest — die Handgriffe stehen bei E-006, E-007, E-009 und E-029 im Log.

**Die Wächter sind verlässlich (E-109, 21.09.2026).** Zwei von ihnen wurden zufällig rot
und sind repariert: `test/lambertAufraeumen.test.ts` prüfte „bringt den Abfall in die
Mulde", ohne dass im Aufbau eine Mulde stand (vorher 3 von 40 Läufen rot, nachher 30 von
30 grün); `test/kipper.test.ts` urteilte nach Mittel und Höchstwert von 24 gewürfelten
Fuhren — Zahlen, die bei jedem Umbau am Lkw neu ausfallen, gemessen mit 14 % und 29 %
Fehlalarm. Geurteilt wird jetzt nach dem Median über 48 Saaten (0,36 %) und nach den drei
Zahlen, die Patrick sieht: Durchfall, Liegenbleiben, Endabstand. **Nachweis: zehn volle
`npm test`-Läufe hintereinander grün.** Die Messwerkzeuge dazu: `tools/lambert-streuung.ts`
und `tools/kipper-streuung.ts`.

**Offen und gemessen, nicht repariert (E-093):** Patricks Befund vom 17.09.2026 — „LKWS
fahren durch Müllcontainer. Objekte fahren durch einander hindurch" — ist nachgemessen.
Es liegt **weder an der Hindernismeldung noch an fehlenden Kollidern**: Der Container
steht in der Liste, er hat fünf Kollider, der LKW drei, und Rapier führt während der
Durchfahrt 32 Berührpunkte. Die beiden Phasen `toPark` und `parkRueck`
(`src/delivery/vehicles.ts:2382`/`:2415`) fahren eine **Luftlinie** vom Abladeplatz zum
Warteplatz und gehen dabei an jeder Hindernisprüfung vorbei; die Linie zum Westwarteplatz
trifft den Container auch an seinem **Startplatz**. Tiefe **3,10 m** — die volle
Fahrzeugbreite. Dazu ist das abgeleitete Tempo des Wagens in diesen Phasen 0,000 m/s statt
4,89: Er wird versetzt statt bewegt, also sieht der Löser keinen Stoß. Drei mögliche
Reparaturen stehen im Log, entschieden ist keine — ob ein LKW davor stehenbleibt und hupt
oder den Container beiseiteschiebt, ist eine Spielgefühlsfrage. Gemessen mit
`tools/durchfahrt.ts`, bewacht von `test/durchfahrt.test.ts`, Protokoll in
`docs/messungen/2026-09-17_durchfahrt.md`.

**Offen und gemessen, nicht entschieden (E-091):** Der offene Greifer ist am gebauten Netz
breiter als die Formel sagt, mit der zwei Wächter rechnen — Sichelkralle **3,5335 m** statt
3,3805 m. In jede Mulde, jede Halde und die Presskammer passt er (knappste Stelle: Presse
am geparkten Stempel, 5,3 cm je Seite). **Nicht** in den Müllcontainer: dort fehlen 5,7 cm
je Seite, bis 95 % Öffnung geht es. Der Fünfschalengreifer ist mit 3,3064 m der schmalere
und passt überall. Drei Möglichkeiten stehen im Log, entschieden ist keine — das ist
Patricks Sache. Gemessen mit `tools/greifer-engstellen.ts`, bewacht von
`test/engstellen.test.ts`.

**Offen und gemessen, nicht behoben (E-029, `docs/fraktionen.md`):** Das Schild an einer
Mulde und die Kasse beim Verkauf rechnen verschieden — bei „BUNT + VA" um Faktor 87. Und
die Fraktion eines Teils ist am Bild nicht zu erkennen: Nur 16 von 271 Katalogeinträgen
tragen überhaupt die Fraktionsfarbe, ein Elektroherd (Stahlschrott) und eine Waschmaschine
(Mischschrott) unterscheiden sich um ΔE 0,18. Das Blatt dazu fürs Telefon:
`docs/fraktionen-2026-09-15.svg`.

Der Spielinhalt (M0–M3 weiter unten) ist vom Prototyp geerbt und unverändert gültig; diese
Abschnitte beschreiben, was v1 mitbringt, nicht was in v1 entstanden ist.

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:5173 im Browser öffnen.

Für den Gerätetest auf iPad oder iPhone im selben WLAN:

```bash
npm run dev -- --host
```

Vite nennt dann eine Adresse der Form `http://<PC-IP>:5173` — die im Safari des Geräts
öffnen. `npm run build` erzeugt den Produktions-Build in `dist/`, `npm test` fährt die
Wächter. Beide müssen vor jeder Übergabe grün sein (Regel 8).

**Zwei Typprüfungen, nicht eine** (E-038). `npm run build` prüft `src/` — Browsercode,
ohne Node-Typen. `npm test` prüft davor `test/` und `tools/` gegen
`tsconfig.test.json` (npm-Skript `pretest`); schlägt das fehl, startet Vitest gar nicht
erst. Grund: Vitest prüft keine Typen, und bis zum 15.09.2026 sah `tsc` diese beiden
Ordner nie an — an einem einzigen Tag waren deshalb dreimal Wächter grün, deren Eingaben
`NaN` waren. Einzeln aufrufbar mit `npm run typecheck:test`. Kosten auf dem Dev-PC:
`tsc` über `src` 8,0 s, über `test`+`tools` 13,2 s, `vite build` 6,7 s (gemessen
15.09.2026, ruhige Maschine). Der Bau ist dadurch **nicht** langsamer geworden — sein
Umfang hat sich nicht geändert.

Die Werkzeuge unter `tools/` laufen mit `npx vite-node tools/<name>.ts`. Sie werden seit
E-038 mitgeprüft: Vier von ihnen ließen sich nicht mehr starten, ohne dass es jemandem
aufgefallen wäre.

Veröffentlicht wird v1 nach einem Merge auf `main` unter
`pripadagmbh-ctrl.github.io/rost-und-reibach/v1/` (E-005). Der Merge braucht Patricks
Freigabe und ist nach rund 70 Sekunden live.

## Die zweite Greiferform ansehen

```bash
npm run dev -- --host
```

Dann auf dem Gerät `/greifer.html` öffnen — dort liegt der Fünfschalengreifer zum Drehen und
Öffnen, mit Schieberegler und Touch. **Der Bagger trägt ihn nicht:** Im Spiel hängt
unverändert die Sichelkralle am Zapfen (E-007). Die Vorschau ist die Auflage aus E-009 —
erst ansehen, dann entscheiden, ob die Form ins Spiel geht.

Das Modell wird nicht von Hand gepflegt, sondern aus `src/fuenfschalen/` exportiert. Neu
bauen nach einer Änderung an Teilen oder Rig:

```bash
npx vite-node tools/fuenfschalen/export.ts
```

Das schreibt `src/greifer/fuenfschalen.glb` neu; Maße und Befunde stehen in
`docs/messungen/2026-09-14_fuenfschalen-vorschau.md`.

## Steuerung (M0)

| Eingabe | Funktion |
|---|---|
| W/S | Fahren vor/zurück |
| A/D | Lenken |
| Q/E | Oberwagen drehen |
| R/F | Ausleger heben/senken |
| T/G | Stiel weg/ran |
| LMB halten (oder Leertaste) | Greifspinne schließen |
| Mausrad | Rotator drehen |
| Shift+Mausrad | Kamera-Zoom |
| MMB ziehen | Kamera drehen |
| C | Ansicht: Orbit → Draufsicht → Kabine |
| X | Fahrerkabine hoch/runter (2,6 m Hub) |
| K | Stand speichern (L lädt, N startet neu) |
| V | Abholung rufen bzw. beladenen Container abfahren lassen |
| B | Schere/Paketierpresse |
| H | Hilfe ein/aus · F3 Debug-Overlay |

Auf dem Touchgerät (Stand 14.09.2026): linke Bildhälfte = Armstick, rechte
Hälfte = Auslegerstick (beide schweben, beide frei belegbar). **Zwei Pedale
unten in der Bildmitte** schalten das Fahren ein und aus — danach gibt derselbe
linke Stick Gas (hoch/runter) und lenkt (seitlich), noch ein Tipp gibt ihm
Hauptarm und Oberwagen zurück. Die Pedale sind Umschalter und Anzeige, sie
geben selbst kein Gas; eingeschaltet leuchten sie und ihre Trittplatten stehen
unten. Von selbst schaltet nichts zurück. Verworfen: der Fahrmodus per
Doppeltipp mit Ablauf nach vier Sekunden und die eigene Fahrfläche unten links.
Doppeltipp rechts wechselt die Ansicht, rechten Daumen stillhalten öffnet den
Funktionskranz.

**Funktionskranz (sieben Einträge, E-105):** KABINE · STÜTZEN · SCHILD · SCHERE ·
ABHOLEN · ZUR WAAGE · LAMBERT. Umschalter zeigen mit einem Balken am unteren
Rand, ob sie an sind (heute niemand — KABINE und STÜTZEN, sobald der Bagger
ihren Zustand herausgibt). Hinter dem Menüknopf oben rechts:
AUSBAU · MUSIK · PAUSE. Ein **zehnter** Kranzeintrag passt nicht mehr
(`test/funktionskranz.test.ts`, Messung
`docs/messungen/2026-09-16-funktionskranz/`); dann muss die Gliederung geändert
werden. Dass jede Taste entweder einen Knopf hat oder mit Grund auf der
Ausnahmeliste steht, hält `test/tastenerreichbarkeit.test.ts` fest.

## Der Platz (Stand 15.09.2026, E-028)

Der Bagger steht auf **(−0,5 | −22,5)** und schaut nach Norden, zur Waage und zur
Einfahrt. Sein Standplatz kommt aus `src/world/baggerstand.ts` — dieselbe Quelle,
aus der auch die Abnahmemessung rechnet. Wer ihn verschiebt, verschiebt ihn dort
und nirgendwo sonst.

**Aus dem Sitz gesehen ist +x LINKS und −x RECHTS** (der Bagger schaut nach +z;
rechts = vorn × oben = z × y = −x). Die Bezeichner im Quelltext meinen etwas
anderes: `facing: "east"` ist die Richtung, in die eine Mulde OFFEN ist, nicht
ihr Standort. **Im Zweifel die Koordinaten lesen, nie den Namen.**

```
                          EINFAHRT (x −22, Nordwand)
   BÜRO   WAAGE     [P] [P]   JANINE                       (z 26,8)
 ┌──────────────────────────────────────────────────────┐
 │ HALLE 1  ▶                                           │
 │ HALLE 2  ▶                                           │
 │ HALLE 3  ▶      [P]                                  │
 │ KUPFER ▶                                             │
 │ KABEL  ▶   [B2] Verladen x −25,5        ◀ Abholer    │
 │ ALU    ▶        │  (längs beim bestellten Silo) x −18│
 │            ╌╌╌╌╌┘ Gasse x −28                        │
 │      ╌╌╌╌╌╌╌╌╌╌╌╌╌ Gasse z −17        BUNT+VA        │
 │  ▲VA  ▲BATT  ▲ABFALL          MÜLL  ▏     [B]        │
 │      z −25                          ▏Kipper ABLADE-  │
 │                            PRESSE           PLATZ    │
 └──────────────────────┬──────────────────┬────────────┘
                        │  STAHL │ MISCH   │   Ausbuchtung
                        └────────┴─────────┘   (z −29 … −35,5)
```

`[B]` = Baggerstand, `[B2]` = Verladeplatz, `[P]` = Warteplatz, `▶`/`▲` = offene
Seite (Hallentor bzw. Muldenöffnung).

**Vier Pflichtziele im Schwenkbereich** plus Abladeplatz, alle gemessen von
`(−0,5 | −22,5)` — bei Halden zur vorderen Kante, bei Mulden zur Mitte:

| Ziel | Abstand |
|---|---|
| Halde Mischschrott | 7,91 m |
| Halde Stahlschrott | 6,96 m |
| Presse | 8,28 m |
| Müllmulde | 8,35 m |
| Abladeplatz (Mitte der Ladefläche) | 6,82 m |
| Mulde BUNT + VA (−7,6 \| −19,2) | 7,83 m — 93 % ihrer Achse erreichbar |

**Die Ausbuchtung** hinter dem Bagger wölbt sich nach Süden aus der Platzgrenze
heraus, rundum mit 4,8 m hoher Wand. Darin die beiden Halden, getrennt durch eine
Pyramide aus Betonlego — 0,6 bis 2,4 m hoch. Niedrig genug, dass der Zugriff von
einer Halde zur anderen durchläuft.

**Eine Mulde am Bagger statt dreier** (E-028): `BUNT + VA` fasst Alu, Zink,
Kupfer, Messing, Kabel und Edelstahl. Sie ist ein **Puffer**, kein
Abrechnungsort — „erstmal alles rausfischen in die Mulde tun und dann später
entweder ich oder Lambert das sortieren" (Ansage 15.09.2026). Sortiert wird auf
dem Weg ins Silo; deshalb bleiben die Lagersilos getrennt. Ein gemeinsames
Lagersilo kostete gemessen 93 % des Erlöses (`test/buntmetall.test.ts`), eine
gemeinsame Mulde kostet nichts.

Zum Bagger hin hat sie seit E-028 eine **Schwelle von 0,50 m** (eine Lage
Betonlego), damit nichts über die Vorderkante zurückrollt. Die Höhe ist
gerechnet, nicht gegriffen: Der Augpunkt bei abgesenkter Kabine liegt auf
3,28 m (`excavator.ts`), die Wand ist 5,01 bis 8,04 m entfernt, und aus
`blind = h × D / (H − h)` bleiben 65 bis 79 % des Muldenbodens im Blick. Zwei
Lagen wären es nur noch 16 bis 48 %.

**Die Silo-Reihe ist ein L** (E-028): drei an der WESTwand neben den Hallen
(x −36, z −3,4 · −8,0 · −12,6, Öffnung nach Osten) — Kupfer+Messing, Kabel,
Alu+Zink — und drei um die Südwestecke an der SÜDmauer (z −25, x −30,0 · −25,4 ·
−20,8, Öffnung nach Norden) — VA, Batterien, Abfall. Die Gasse folgt dem L:
x −28 und z −17, jeweils 5,0 m vor den Öffnungen. Stahl und Mischschrott haben
bewusst kein Silo — sie werden direkt an der Halde verladen. Nach Osten ist an
der Südmauer Platz für zwei weitere Silos.

**Der Verladeplatz gehört zur bestellten Mulde** (E-063): Er liegt 7,5 m vor
ihrer Öffnung, die LKW-Spur noch einmal 7,5 m weiter — im Westschenkel also auf
x −25,5 (Spur x −18), im Südschenkel auf z −14,5 (Spur z −7), und die Lage
längs der Reihe ist die des bestellten Silos. Der Bagger steht dazwischen und
greift aus dem Silo in den Container, ohne umzusetzen; die bestellte Mulde ist
immer genau 7,50 m weg. Bis E-063 stand der Platz fest vor der Mitte des
Schenkels — dann hielt der Wagen bei 10 von 12 Fraktionen 4,60 m neben ihrer
Mulde.

**Die Hallen** stehen südlich ans Bürogebäude gebaut an derselben Wand, Tor nach
Osten auf den Platz (`TOR_RICHTUNG` in `src/world/office.ts`). Sie sperren nur
ihre Wände, nicht ihre Grundfläche — ein LKW fährt hinein. Zufahrt ist der freie
Mittelplatz: von der Waage nach rechts und geradeaus. Was darin passieren soll —
Händler laden selbst ab, Lambert räumt in die Silos — steht in E-011 und ist noch
nicht gebaut.

**Janines Kaffeewagen** steht an der Nordmauer (−9,5 | 26,8), östlich der
Einfahrt neben den beiden Warteplätzen — dort, wo die Fahrer nach dem Abladen
ohnehin warten. Seine Lage ist ein Wächter wert (`test/janine.test.ts`): An zwei
früheren Stellen hat er einmal einen Kipper 292 Sekunden lang aufgehalten und
einmal die Abholer-Spur gedreht.

### Geldkreislauf

Anlieferer werden auf der Brückenwaage voll und nach dem Abladen leer gewogen —
für die Nettomenge bekommt der Kunde 0,16 €/kg (Ausgabe). Verkauft wird über den
Abhol-LKW: **V** ruft ihn, der Spieler belädt den Container mit der Spinne, **V**
schickt ihn los.

Der Abholer wiegt seit E-064 andersherum: **leer herein (Tara), voll hinaus
(Brutto)**, die Differenz ist die abgeholte Menge. Das ist eine reine Meldung —
Geld bewegt sich weiterhin nur beim Losfahren vom Verladeplatz.

> **Zwei bekannte Fehler in dieser Rechnung**, festgehalten in der Bestandsaufnahme
> vom 14.09.2026: Das Schild am Container rechnet mit Reinheit **hoch zwei**
> (`materials/purity.ts:26`), ausgezahlt wird mit Reinheit **hoch drei**
> (`economy/account.ts:138`) — bei 76 % Reinheit sind das 24 % weniger als
> angeschrieben. Und die Sortierprämie von 0,05 €/kg steht zwar in
> `account.ts:18`, wird aber nirgends benutzt. Beides gehört zu Abschnitt 2 in
> E-016 und ist noch offen.


## Geerbt vom Prototyp — Spielinhalt M0 bis M3

Die vier folgenden Abschnitte stammen unverändert aus dem Prototyp (Stand 29.08.2026)
und beschreiben, was v1 an Spielinhalt mitbringt. Sie gelten weiter. Was seither **in
v1** entschieden oder geändert wurde, steht ausschließlich in `docs/entscheidungen.md`
und in den Messprotokollen unter `docs/messungen/` — dort und nicht hier nachschlagen,
wenn die Beschreibung unten von dem abweicht, was das Spiel tut.

## M3-Umfang (verifiziert 2026-08-29)

- **Anlieferungen** (`delivery/vehicles.ts`): Kundenfahrzeuge fahren vorwärts ein,
  rangieren und setzen **rückwärts** an. Drei Typen: Kipper (Mulde hebt sich um 58°,
  Ladung rutscht physisch ab), Pritsche (Spieler lädt selbst mit der Spinne ab),
  Tieflader mit Wrack. Händler-Ladungen: 16–20 Teile, halb davon Großteile
  (Träger, Blechtafeln, Maschinenblöcke bis 420 kg). Ladung wird überlappungsfrei
  gestapelt, setzt sich physisch, fährt kinematisch verriegelt mit und wird am
  Abladepunkt freigegeben. Takt: erste nach ~20 s, dann alle 35–60 s.
- **Konto + Verkauf (V):** Abnehmer holt alle Haufen/Boxen, Erlös nach Reinheitsformel
  aufs Konto (Start 5.000 €). Kern-Sound „Münz-Dreiklang", Toast-Anzeige.
- **Schere / Paketierpresse (B)** (`world/press.ts`): oben offene Containermulde hinter
  dem Startplatz. Zyklus: zwei dicke Eisenplatten schließen von beiden Seiten von oben
  (drücken teilweise ins Material) → Pressstempel läuft von **rechts nach links** durch
  die Mulde → Paket. Teile werden plattgedrückt (Mesh + Kollider), Karossen auf
  Quetschstufe 2. Stempelweg ergibt sich aus der Materialmenge (Klemmschutz).
- **Anlieferungs-Fahrspur:** eigene Ostspur als Sackgasse, markiert am Boden — sie
  kreuzt weder Haufen-Zonen noch Bagger-Standplatz. Fahrer warten vor dem Bagger
  und hupen nach 10 s, statt hindurchzufahren.
- **Physik-Härtung** (`clampSpeeds`): globale Geschwindigkeitsbremse (28 m/s) plus
  Rückholung von Ausreißern. Verhindert, dass Klemmsituationen Material vom Platz
  schleudern.
- **Platz-Ausbau:** Betonlego-Boxen (gestapelte Noppensteine) für Guss + Alu,
  permanente Schrottberge hinter dem Bagger, Zaunreihe an der Ostseite,
  Maschendraht-Bündel (Drahtknäuel) als Kehr-Werkzeug zum Freischieben.
- **Vorgaben einer neuen Runde (E-105):** **Fünfschalengreifer** am Arm (umschaltbar im
  Pausenmenü, E-059) und **Werkhof 90,4** im Radio (weiterschalten mit U bzw. MUSIK,
  E-094). Beides sind Ansagen Patricks vom 17.09.2026. Ein vorhandener Spielstand behält,
  was darin steht; ein Stand ohne Greiferfeld — also einer von vor E-059 — behält die
  Sichelkralle, mit der er gespielt wurde.
- **Save/Load:** K speichert (localStorage, Schema v1 mit Migrationspfad), L lädt,
  N startet neu. Auf dem Gerät liegen alle drei im Pausenmenü.
  Der Doppelgriff auf K aus E-088 ist erledigt: Das Seitwärtskippen ist mit
  E-105 wieder ausgebaut, K tut nur noch eine Sache.
  Boot rekonstruiert Items (inkl. plattgedrückt), Karossen
  (Quetschstufe, gerissene Teile, Scheiben) und Zaunzustand. Vitest-geprüft.

## M2-Umfang „Wrack-Slice" (verifiziert 2026-08-27)

- **Auto als Verbundobjekt** (`dismantle/`): datengetrieben (CarDef), 950 kg greifbar,
  Achsen spürbar träger. Aufprall-Erkennung über Δv: Scheiben bersten einzeln,
  **3 Quetschstufen** (Squash + Kollidertausch), Stufe 2 sprengt bis zu 2 Räder ab.
- **Abreißen:** Spinne nahe Motor/Rad fasst die Baugruppe statt des Rumpfs;
  geschlossen halten reißt sie heraus (Motor 2 s, Rad 1,2 s) → eigenständiges,
  sortierbares Teil, direkt im Greifer. HUD zeigt Reiß-Fortschritt.
- **Haufen-Zonen statt Container** für Stahl/Guss/Alu/Störstoff (Schrott draufwerfen),
  Kupfer/Kabel bleiben Kleinboxen. Reinheits-/Erlöslogik unverändert.
- **Zerstörbare Zaunfelder:** Griff reißt sie aus der Verankerung, schnelle Objekte
  (auch weggesprengte Räder!) schlagen sie um — danach ganz normaler Stahlschrott.
- Neue Sounds: Blech-Crash, Glasbersten, Metall-Kreischen (Abriss), Zaun-Scheppern.
- Physik-Kosten mit allem: 0,13 ms/Step.

## M1-Umfang (verifiziert 2026-08-27)

- 6 Materialklassen (Stahl, Guss, Alu, Kupfer, Kabel, Störstoff) mit materialtypischen
  Formen und Farbleitsystem; 20-Objekte-Misch-Haufen auf der Annahmefläche.
- 4 große Container + 2 Kleinboxen mit **Reinheitssystem**: Erlös = Inhalt × Preis × Reinheit²,
  Nachsortieren senkt die Kontamination wieder. World-Space-Labels (kg / % / €).
- Griff-Info-HUD (Material, Gewicht, €-Indikator), Objekt-Highlight, **Abwurf-Ampel**
  (Grün/Gelb/Rot am Container), Sortierwert-Ticker.
- Prozedurale Kern-Sounds (WebAudio, keine Assets): Diesel-Loop, Hydraulik, Greif-Thump,
  Abwurfklang je Material, Richtig-/Falsch-Feedback.
- Wirtschaftsrechnung Vitest-geprüft: `npm test` (11 Tests).

## M0-Abnahme (verifiziert 2026-08-27)

- 20 Zyklen Greifen → Heben → 5 m Tragen → Ablegen in Folge: **bestanden**, max. Griff-Schlupf 2 mm, keine NaNs/Explosionen.
- Mehrfachgriff: 3 Objekte / 115 kg in einem Griff.
- Last-Trägheit: Oberwagen dreht unter Last messbar langsamer.
- Physik-Kosten: 0,07 ms pro 60-Hz-Step (16 Bodies).

## Architektur-Notizen

- Arm ist **kinematisch** (animierte Winkel), nur Chassis + Greifer-Palm haben Kollider.
- Greifen = Sensorkugel-Abfrage beim Schließen + **Fixed Joint** pro Objekt (Briefing Kap. 6.2).
- Greifspinne: 5 Schalen-Zacken, seit E-007 am schlanken Zapfen statt am breiten Ring,
  je acht Segmente. Die Kollider der Zacken folgen der Zeichnung (`updateClawColliders`) —
  dass beide deckungsgleich sind, hält ein eigener Wächter in `test/greifer.test.ts` fest.
- **Pendel ohne Winkelsperre** (E-105): Der Greifer hängt frei am Kardangelenk; wer den
  Oberwagen schwenkt, erzeugt Fliehkraft und schlägt ihn aus. Bis zum 17.09.2026 deckelte
  `PENDEL_MAX` bei 17° je Achse — gemessen kam der Greifer auf 17,3° und stand am Anschlag,
  ohne Deckel sind es **20,2°** (`tools/pendelausschlag.ts`). Was den Ausschlag jetzt
  begrenzt, ist Rückstellung und Dämpfung, kein Anschlag.
  Das *gesteuerte* Seitwärtskippen auf Taste K (E-085/E-088) ist **zurückgenommen** —
  es war ein Missverständnis; gemeint war die Bauart, nicht ein Bedienelement.
- **Greiferachse statt Weltsenkrechte** (aus E-085, bleibt): `form.maxTiefe` ist eine Länge
  *längs der Greiferachse*; schräg hängend ist das nicht mehr „so weit langt er nach unten".
  `surfaceUnderClaws` schickt seinen Strahl deshalb aus dem **Fußpunkt der Achse**
  (`Gelenk + Tiefe · pendelAchse`), `syncMeshes` setzt die Krallen in die Schräglage, und
  `form.ausladung/maxAusladung` rechnen die Achse in die Weltsenkrechte um. **Bei
  lotrechtem Greifer springt jede Stelle vorab auf den alten Weg** —
  `test/greiferachse.test.ts` prüft das auf Gleichheit, nicht auf Nähe.
  Der **Bodenanschlag** folgt der Schräglage bewusst NOCH NICHT
  (`ANSCHLAG_FOLGT_PENDEL = false`): Mit `true` setzt der geschlossene Greifer auf 7,90
  statt 6,37 cm ab, weil der Anschlag den Arm während des Absenkens anhebt und
  `bodenSperre` ihn oben festhält. Das ist ein eigenes Paket.
- Module kommunizieren über den typisierten **EventBus** (`core/events.ts`) — itemEntered/
  itemLeft/grabbed/released; Audio und HUD hängen nur an Events.
- Container-Zuordnung per **Zonen-Zählung** alle 10 Steps (gegriffene Items zählen nicht);
  Herausgreifen macht die Zählung rückgängig → Nachsortieren funktioniert ohne Extra-Code.
- Dev-only: `window.__game` (excavator, grip, physics, input, items, containers, bus,
  THREE, `step(n)`) für automatisierte Smoke-Tests.
- Bodenkollider ist größer als der sichtbare Platz — nichts kann ins Leere fallen.
