# Zerstörung von Autos und Hohlkörpern — Konzept zur Abnahme

Stand 20.10.2026 · nur Konzept, kein Code · Auftrag Patrick, 20.10.2026, wörtlich:
„Neues Zerstörungskonzept für autos und holkörper bauen, mehr spass am zerstören ist ziel. Reifen haben immer felge. Um motor/getriebe zu entfernen, muss erst motorhaube entfernt werden. Autos haben innenausstattung" (offene Punkte 27, 28a–c).

Grundlage: E-112/E-114 (Biss, kein Wertverlust), E-117 (Fassung C), E-124/E-127/E-128 (hohl, Knautschen), E-130/E-159/E-160 (Ton), E-135 (LKW, Wohnwagen), E-137/E-138/E-145/E-157/E-158 (Hämmern, Innenraum, Wände, Boden, Anschlag), Code in `src/dismantle/`.

**Skizzen** (zum Ansehen, nicht im Repo): `baugruppenbaum.svg` und `explosion.svg` im Arbeitsordner `scratchpad/zerstoerung/`.

---

## Das Prinzip in einem Satz

**Erst aufmachen, dann ausweiden, zum Schluss platt machen.** Ein Auto ist kein Klotz mit sechs Teilen, sondern eine Schale mit Deckeln. Hinter jedem Deckel liegt etwas, das man herausreißt und in die richtige Mulde wirft. Gewalt bleibt erlaubt und kostet nichts (E-114). Sie öffnet nur schneller und sortiert gröber.

---

## 1. Was heute geht, und was daran keinen Spaß macht

**Was gut ist und bleibt:** Das Wrack knautscht wie eine Blechdose, dort wo die Spinne zubeißt (E-128). Spinne und Presse rechnen dieselbe Verformung. Der Ton besteht aus echten Aufnahmen (E-130, E-159, E-160). Wracks gehen nicht durch Wände und versinken nicht im Boden (E-145, E-158). Hämmern geht ungebremst (E-137). Kaputtmachen kostet keinen Wert (E-114).

**Was heute keinen Spaß macht** (aus Log und Code abgeleitet, bitte sagen, ob es trifft):

| Befund | Woran man es sieht | Folge für den Spaß |
|---|---|---|
| **Teile kommen durch geschlossenes Blech.** Der Motor kommt durch die zugeklappte Haube, das Getriebe beim Biss aufs **Dach**. | `findPartNear` misst nur den Abstand, nicht ob etwas davor ist. E-124 „nicht entschieden" 2, E-128 Messtabelle (Dach → Getriebe). | Kein Gefühl von „ich mach das Auto auf". Es fliegt etwas heraus, ohne dass man weiß, warum. |
| **Im Auto ist fast nichts.** Sechs Teile: Motor, Getriebe, vier Räder. Bei jedem Auto dieselben. Der Innenraum ist leer. | `CAR_DEF.parts` in `carDef.ts`. E-138: „Sitze sind nicht gebaut". Offene Punkte 14.09.: „Heute ist jedes Auto identisch". | Nach 30 Sekunden ist alles raus. Es gibt nichts zu entdecken. |
| **Teile sind graue Kisten.** Der Motor ist ein Quader. Das Rad ist ein schwarzer Zylinder **ohne Felge**. | `buildMeshes` (Box bzw. Cylinder, eine Farbe). | Man erkennt nicht, was man in der Spinne hat. |
| **Dran oder ab, nichts dazwischen.** Ein Teil gibt nicht nach, wackelt nicht und hängt nicht schief. Es klebt fest, bis der Zähler voll ist, und ist dann sofort frei. | `gripSystem.ts`: `tearState.progress` ist nur ein Balken im HUD. | Die Spannung beim Reißen sieht man nicht, man liest sie. |
| **Das Abreißen gibt wenig Rückmeldung.** Ton ja (`playTear`), aber keine Funken und kein Staub. Das Teil fällt einfach in die Spinne. | Partikel nur bei `crushed` und `glassShattered` (`main.ts`). | Der beste Moment, der Ruck beim Abreißen, ist der leiseste. |
| **Knautschen springt je Biss.** Sechs Bisse bis flach, jeder sieht ähnlich aus. Zwischen den Bissen rutscht das Wrack weg und kippt an der Tür bis 37°. | E-128 „nicht entschieden" 1 und 4, E-127 „nicht entschieden" 1. | Ab dem dritten Biss ist es Routine. |
| **Sortieren lohnt nicht sichtbar.** Die Karosse bleibt immer Mischschrott, egal wie gründlich man ausweidet. Die Wirtschaft ist aus (E-118). | `hullMaterialId: "mixed"`, Ansage 12.09.2026. | Es gibt keinen Grund, sauber zu arbeiten, und keine Belohnung dafür. |

---

## 2. Wie es echte Verwerter machen

| Schritt | In Wirklichkeit | Im Spiel (Vorschlag) |
|---|---|---|
| 1 | **Trockenlegen** (Öl, Kraftstoff, Kühlwasser, Kältemittel, Bremsflüssigkeit), Batterie raus, Airbags unschädlich machen. Das passiert in der Werkstatt, **bevor** der Bagger kommt. | Wracks kommen trockengelegt an. Die Batterie bleibt als erstes Teil im Motorraum, damit es etwas zu holen gibt. |
| 2 | **Wiederverwendbare Teile** zuerst: Motor, Getriebe. | Haube auf → Motor → Getriebe. |
| 3 | Der Bagger mit **Niederhalter und Sortiergreifer** reißt Kabelbaum, Kühler, Heizungskühler, Motor und Getriebe heraus. Ein geübter Fahrer schafft 10–12 Autos pro Stunde. | Genau das ist das Spiel. Tempo-Ziel: **ein Auto in 3–5 min** ausweiden. |
| 4 | **Kunststoff und Stoff** (Sitze, Verkleidung) kommen in einen eigenen Behälter. Glas, Katalysator und Reifen werden als Verwertungsteile ausgebaut. | Innenraum → MÜLL bzw. Mischschrott, Räder → Reifen. |
| 5 | Die **Karosse** geht in die Schere bzw. Presse und dann in den Schredder. | Presse (wie heute). |

Quellen dazu unten (Umweltbundesamt, BMW, Builtrite, Sennebogen, Molson).

---

## 3. Das neue System: der Baugruppen-Baum eines Pkw

Skizze: `baugruppenbaum.svg`. Vier Gruppen. Jedes Teil hat **eine Sperre**: Es lässt sich erst greifen oder abbeißen, wenn sein Deckel weg ist.

| Teil | Sperre (erst wenn …) | Wie es abgeht | Kraft / Bewegung | Was man sieht und hört | Mulde | Masse (SW) | Wann |
|---|---|---|---|---|---|---|---|
| **4 Räder** = Reifen + Stahlfelge, **immer zusammen** | frei | abreißen (greifen, ziehen) oder abbeißen | Zug 1,2 s wie heute | Rad mit silberner Felge. Es rollt nach dem Abreißen ein Stück weg. | Reifen (MÜLL-Mulde, wie heute ungetrennt) | 25 kg (wie heute). Anteile Reifen 70 % / Felge 30 % (Ansage 12.09.) | 1.0 |
| **Motorhaube** | frei | **aufspringen** beim 1. vollen Biss, **ab** beim 2. Biss oder durch Ziehen | Biss ≥ Quetschschwelle oder Zug 1,0 s | Haube springt auf und hängt schief am Scharnier. Beim Abreißen fliegt sie verbeult weg, mit Funken und Blechknall. | Stahl | 15 kg | 1.0 |
| **Batterie** | Haube ab | greifen, ziehen | Zug 0,8 s | kleiner dunkler Kasten | BATTERIEN-Box | 15 kg | 1.0 |
| **Kühler** | Haube ab | abbeißen oder ziehen | Zug 1,0 s | flaches Gitter vorn | Alu | 7 kg | 1.0 |
| **Motor** | Haube ab | ziehen (Drehen hilft, wie heute) oder abbeißen | Zug 2,6 s wie heute | Motorblock mit Ansaugbrücke statt Kiste. Danach ist der Motorraum leer und sichtbar. | Alu (wie heute) | 150 kg | 1.0 (Sperre), 1.1 (Form) |
| **Getriebe** | Haube ab **und** Motor raus (Frage 1) | ziehen | Zug 1,8 s | sitzt hinter dem Motor | Alu | 70 kg | 1.0 |
| **Kabelbaum** | Haube ab. Kommt mit, wenn man den Motor brutal reißt. | hängt am Motor, fällt ab | – | orange Schlinge | Kabel | 20 kg | 1.1 |
| **4 Scheiben** | frei | bersten (Biss, Aufprall, wie heute) | Δv 4,5 m/s | Splitterregen, Glasklirren (gibt es schon) | keine Mulde. Splitter bleiben im Wrack. | – | gibt es |
| **2 Vordersitze, Rückbank** | Scheibe derselben Seite geborsten (1.1: oder Tür ab) | greifen, herausziehen | Zug 1,2 s | Sitzbank kommt durchs Fenster | Mischschrott (Stahlrahmen + Schaum) | 18 / 18 / 22 kg | sichtbar 1.0, herausholbar 1.1 (Frage 2) |
| **Armaturenbrett** | Frontscheibe geborsten | ziehen | Zug 1,5 s | lange dunkle Leiste. Zerdrückt fällt sie in Kunststoff und Kabelbund auseinander (`trennbar`, das gibt es schon). | MÜLL bzw. Kabel | 18 kg | sichtbar 1.0, herausholbar 1.1 |
| **4 Türen** | frei | abreißen | Zug 1,5 s | Tür klappt erst auf, dann reißt sie ab | Stahl | je 22 kg | 1.1 |
| **Kofferraumdeckel** | frei | aufspringen, ab | wie Haube | dahinter ein **Fundstück** (Kupferkabel, Batterie, Werkzeugkiste …) | Stahl | 12 kg | 1.1 |
| **2 Stoßstangen** | frei | abbeißen | Biss | Plastik bricht | MÜLL (Kunststoff) | je 5 kg | 1.1 |
| **Auspuff mit Kat** | Auto liegt auf der Seite oder dem Dach | abreißen | Zug 1,2 s | langes Rohr | Stahl | 18 kg | 1.1 |
| **Tank (leer)** | Auto liegt auf der Seite | abreißen | Zug 1,0 s | Kunststoffwanne | MÜLL | 8 kg | 1.1 |
| **Karosse** (Rest) | – | knautschen (wie heute), Presse | 6 Bisse bis flach | wie heute | Mischschrott. Ganz leer vielleicht Stahl (Frage 3). | 600 → 563 kg (1.0) → ~330 kg (1.1) | gibt es |

Die Masse wird nur umverteilt. Das Wrack wiegt weiter 950 kg, was abgeht, nimmt seine Masse aus der Karosse mit (E-114: nichts verschwindet). Alle neuen Massen sind Startwerte (SW) aus üblichen Bauteilgewichten und am Gerät nachzustellen.

**Die vier Arten, wie etwas abgeht:**

| Art | Was der Spieler tut | Gibt es schon? |
|---|---|---|
| **abreißen** | greifen, halten, ziehen. Drehen und Reißen mit dem Arm geht schneller. | ja (`tearSeconds`, „Gewalt" ×3,5) |
| **abbeißen** | voll zudrücken, wenn das Teil zwischen den Schalen liegt | ja (E-114), neu nur die Sperre |
| **aufspringen lassen** | ein voller Biss auf einen Deckel: er löst sich und hängt am Scharnier, ist aber noch dran | neu |
| **bersten** | Scheiben durch Biss oder Aufprall | ja |

---

## 4. Spaß-Hebel

| # | Hebel | Vorbild | Kosten | Wann |
|---|---|---|---|---|
| 1 | **Aufmachen, dann ausweiden.** Deckel sperren den Inhalt. Die Griff-Info sagt „Motor — erst Haube ab". Wer die Haube abreißt, **sieht** den Motor, bevor er ihn holt. | echte Verwertung. *Car Mechanic Simulator* erlaubt Ausbau nur in logischer Reihenfolge. *Hardspace: Shipbreaker*: erst die Hülle auf, dann die wertvollen Innereien. | klein | 1.0 |
| 2 | **Nachgeben, bevor es reißt.** Drei Zustände: fest → lose → ab. Die Haube springt auf und baumelt beim Schwenken. Ein Rad hängt schief, bevor es fällt. | *Wreckfest*, *BeamNG*: Teile hängen erst lose, dann fallen sie ab. | mittel | 1.0 nur Haube, 1.1 alle Deckel |
| 3 | **Funken, Staub, Splitter beim Abreißen.** Das Teil fliegt in Zugrichtung weg, Räder rollen. | „Juice": kleine Effekte, die einen Treffer spürbar machen | klein (Partikel gibt es, 400er-Pool) | 1.0 |
| 4 | **Ton in drei Schichten:** Spannung (Knarzen, das mit dem Ziehen anschwillt, nie als Dauerton, E-130), der Knall beim Reißen, der Aufschlag des Teils (gibt es seit E-160). | *Teardown*, *Wreckfest*: Ton trägt die Hälfte der Wucht | klein für den Knall, mittel für das Knarzen | 1.0 Knall, 1.1 Knarzen |
| 5 | **Kettenreaktion.** Brutal gerissen zieht der Motor Kabelbaum und Batterie mit (gröber sortiert, aber schneller). Nach zwei Bissen springen die Türen auf. Das Dach knickt (gibt es). | *BeamNG*: Last läuft durchs Gerippe | mittel | 1.1 |
| 6 | **Überraschung im Kofferraum.** Ein zufälliges Fundstück aus dem Katalog: Kupferkabel, Batterie, Felgen, Werkzeugkiste. | Beute-Moment | klein bis mittel | 1.1 |
| 7 | **Fortschritt und Belohnung.** Ein Zähler „ausgeweidet 5/9" am Wrack. Eine **leere Karosse wird Stahlschrott** (Frage 3). Eine Aufgabe „Ausweiden" mit Sternen für **Sortenreinheit**, nicht für Vorsicht, damit Gewalt erlaubt bleibt (E-114). | *Shipbreaker*: drei Ziele (Barge, Prozessor, Ofen), Lohn fürs richtige Sortieren | klein (Zähler), mittel (Aufgabe) | 1.1 |
| 8 | **Kurzer Ruck beim Abreißen.** Eine Zeitlupe von 0,08 s am Teil oder ein kleines Kamerazittern. | „Hit-Stop" und „Screenshake" (Vlambeer) | klein | Frage 5 |

---

## 5. Hohlkörper allgemein: ein Prinzip für alles

Jeder Hohlkörper besteht aus **vier Dingen**, und die stehen als **Daten** im Datensatz, nicht im Code:

1. **Schale.** Sie knautscht, mit derselben Rechnung wie heute (`knautschPunkt`, hohle Kollider).
2. **Deckel.** Tür, Haube, Klappe, Luke, beim LKW das ganze Fahrerhaus. Ein Deckel sperrt, was dahinter liegt.
3. **Inhalt.** Er ist erst zu holen, wenn ein Deckel weg ist oder die Schale an dieser Stelle aufgeknautscht ist.
4. **Anbau.** Was außen sitzt (Räder, Tank, Deichsel), ist sofort frei.

| Hohlkörper | Schale | Deckel | Inhalt | Anbau | Wann |
|---|---|---|---|---|---|
| Pkw | Karosse | Haube, Türen, Kofferraumdeckel, Scheiben | Motor, Getriebe, Batterie, Kühler, Kabelbaum, Sitze, Armaturenbrett | Räder, Stoßstangen, Auspuff, Tank | 1.0 / 1.1 |
| LKW-Zugmaschine | Fahrerhaus | **das Fahrerhaus selbst**: kippen wie in echt, oder plattdrücken (das geht heute schon so, E-135: „erst zerdrücken, dann kommt man an den Motor") | Motorblock 1 050 kg | Tank, Batteriekasten, Sattelkupplung, Räder (gibt es) | 1.1 |
| Wohnwagen | Kasten aus Alu und Holz | Aufbautür, Dachluke, eingedrückte Wand | Möbel (Holz), Kühlschrank, Matratze (MÜLL), Gasflasche (vor dem Pressen raus) | Deichsel, Achse, Räder (gibt es) | 1.1 |
| Bau- und Bürocontainer | Wände | Stirntür | Ladung, zufällig aus dem Katalog | – | später |
| Tank, Fass | Mantel | Deckel, Stutzen | Restinhalt, nur als Bild (tropft) | Armaturen | später. Fässer beulen heute gar nicht (E-114 „nicht entschieden" 4). |

**Sperren gibt es in vier Sorten**, eine Liste je Teil, und eine davon reicht:

| Sorte | Beispiel |
|---|---|
| ein anderes Teil ist ab | Motor ← Haube |
| eine Scheibe ist geborsten | Sitz ← Seitenscheibe |
| die Schale ist dort mindestens zur Hälfte geknautscht | LKW-Motor ← Fahrerhaus |
| der Körper liegt auf der Seite (gekippt über 60°) | Auspuff, Tank |

---

## 6. Technische Machbarkeit

**Was das Bestehende schon trägt:**

| Baustein heute | Wofür er reicht |
|---|---|
| `PartDef` (Anker, Greifradius, Zugzeit, Masse, Zusammensetzung, `trennbar`) | alle neuen Teile sind neue Zeilen in `carDef.ts` |
| `findPartNear` ist **die eine Stelle**, über die Greifen (`partResolver`) **und** Biss gehen | Die Sperre kommt nur hier hinein und wirkt dann auf beide Wege. Kein zweiter Weg. |
| `tearPart` (eigener Körper, CCD, Masse wandert, `partTorn`) | jedes neue Teil, auch Haube und Sitze |
| hohler Rumpf mit 8 Kollidern, `kolliderNachfuehren` | Ist die Haube ab, sinkt der Vorderwagen-Kollider auf Motorhöhe, und die Spinne kommt in den Motorraum. Dieselbe Rechnung wie beim Knautschen. |
| `dentables` (Netze, die mitknautschen) | Die Haube knautscht mit, solange sie dran ist, und fliegt **verbeult** weg. |
| Fugen in Fassung C („Fuge Haube" bei 0,40, „Fuge Klappe" bei −0,52) | Dort wird die Haube aus der Haut geschnitten. Die Kante ist schon gezeichnet. |
| `trennbar` beim Zerquetschen | Armaturenbrett → Kunststoff + Kabelbund, ohne neue Mechanik |
| Partikel (`world/particles.ts`), echte Aufnahmen, `partTorn`, `glassShattered` | Funken und Knall beim Abreißen sind zwei Zeilen am Bus (Regel 10) |
| BATTERIEN-Box, ALU-, KABEL-LAGER, MÜLL-Mulde, Stahl- und Mischhalde | alle Fraktionen haben schon eine Mulde |

**Engpässe:**

- **Zeichenrufe (E-025).** Ein Pkw hat heute 12 Netze: Karosse, Anbau, 4 Scheiben, 6 Teile. Ein Wächter erlaubt höchstens 13, der LKW steht schon bei 13. Jedes neue Teil als eigenes Netz würde das sprengen (bei 2 Autos auf dem Platz +16 Netze, im Schattendurchlauf doppelt).
  **Lösung wie beim Bagger: verschmelzen.** Alle angebauten Teile (Motor, Getriebe, Batterie, Kühler, Räder, Innenraum) kommen in **ein** Netz mit Eckpunktfarben. Reißt eines ab, werden seine Eckpunkte im Sammelnetz auf null gelegt, und das lose Teil bekommt sein eigenes Netz, wie heute. Ergebnis: **8 statt 12 Netze** je Pkw (Karosse, Anbau, 4 Scheiben, Haube, Sammelnetz), also **weniger als heute**.
- **Physikkörper.** Jedes abgerissene Teil ist ein loser Körper. Heute sind es bis zu 6 je Pkw, mit 1.0 bis zu 9, mit 1.1 bis zu 23. Der Platz hat 64–73 lose Körper (E-135). Vor dem Einbau mit `tools/platzlast.ts` messen. Kleinteile dürfen nach dem Liegen mit dem Haufen gemeinsam einschlafen (v2 E-012).
- **Regel 2.** Am Greifen ändert sich nichts: Die Sperre entscheidet nur, **welches** Teil `findPartNear` meldet. `tools/greifzyklus.ts` muss Ziffer für Ziffer gleich bleiben.

**Aufwand je Baustein** (klein ≈ ½ Tag, mittel ≈ 1–2 Tage, groß ≈ 3 Tage, geschätzt):

| # | Baustein | Aufwand | Wann |
|---|---|---|---|
| B1 | Sperre am `PartDef` (Liste von Bedingungen), Filter in `findPartNear`, Hinweis „erst Haube ab" in der Griff-Info | klein | 1.0 |
| B2 | Rad mit Felge: Felge im Netz (Eckpunktfarbe), Zusammensetzung Reifen 70 / Stahl 30 | klein | 1.0 |
| B3 | Motorhaube als Teil: aus der Haut schneiden, Scharnier, aufspringen beim Biss, Kollider senkt sich, fliegt verbeult weg | mittel (2 Tage) | 1.0 |
| B4 | Batterie und Kühler als Teile, Getriebe hinter dem Motor | klein | 1.0 |
| B5a | Innenraum **sichtbar**: Sitze, Rückbank, Armaturenbrett im Anbau-Netz, knautschen mit (+0 Netze) | klein | 1.0 |
| B6 | Funken, Staub und Blechknall bei `partTorn`, Teil fliegt in Zugrichtung | klein | 1.0 |
| B7 | Verschmelzen der angebauten Teile in ein Sammelnetz | mittel (1,5 Tage) | 1.0, wenn das Netzbudget es verlangt, sonst 1.1 |
| B5b | Innenraum **herausholbar** (Sperre über Scheibe) | mittel | 1.1 (Frage 2) |
| B8 | Türen und Kofferraumdeckel als Teile, Fundstück im Kofferraum | groß | 1.1 |
| B9 | „lose"-Zustand mit Baumeln für alle Deckel, Rad hängt schief | mittel | 1.1 |
| B10 | Knarz-Schicht beim Ziehen (Ton-Agent, Aufnahme, Hülle nach Fortschritt) | mittel | 1.1 |
| B11 | Kettenreaktion: Motor zieht Kabelbaum und Batterie mit | mittel | 1.1 |
| B12 | Auspuff, Tank, Stoßstangen; Sperre „liegt auf der Seite" | klein bis mittel | 1.1 |
| B13 | Zähler „ausgeweidet n/m", Karosse wird bei leer Stahlschrott, Aufgabe „Ausweiden" mit Sternen | mittel | 1.1 |
| B14 | LKW: Fahrerhaus kippen bzw. abreißen. Wohnwagen: Inhalt. | groß | 1.1 / später |
| B15 | Knautschen fließt über 0,3 s statt zu springen (E-128 „nicht entschieden" 4) | mittel | später |

---

## 7. Vorschlag: was in 1.0, was ins Update

App Store bis etwa 16.11.2026. Die Aufgaben 1–6 brauchen schon rund zwei Wochen (Aufgaben-Konzept). Die Zerstörung kann der Welt-Agent **parallel** bauen. Sie darf aber keinen Gerätetest-Zyklus der Aufgaben blockieren.

**1.0 (rund 4–5 Arbeitstage, B1–B6, dazu B7 nur bei Bedarf):**
- Räder haben Felgen (28a).
- **Motor und Getriebe erst nach der Motorhaube** (28b). Die Haube springt beim ersten Biss auf und geht beim zweiten oder durch Ziehen ab. Kein Getriebe mehr aus dem Dach.
- Batterie und Kühler im Motorraum. Die Reihenfolge Haube → Batterie → Kühler → Motor → Getriebe ist die echte.
- **Innenausstattung sichtbar** (28c): Sitze, Rückbank und Armaturenbrett sieht man durch die Scheiben, und sie knautschen mit. Herausholen kommt in 1.1 (Frage 2).
- Funken, Staub und Knall beim Abreißen.
- Gerätetest: ein Auto in Reihenfolge ausweiden, unter 5 min.

**Update 1.1 (2–3 Wochen nach dem Start):** Innenraum herausholbar, Türen, Kofferraum mit Fundstück, Baumeln aller Deckel, Knarzen, Kettenreaktion, Auspuff/Tank durch Kippen, „Karosse wird Stahl", Aufgabe 7 „Ausweiden" mit Sternen, LKW-Fahrerhaus kippen, Wohnwagen mit Inhalt.

**Später:** Container, Tanks, Fässer als Hohlkörper. Fließendes Knautschen.

**Bewusst nicht vorgesehen:** Flüssigkeiten ablassen (in Wirklichkeit vor dem Bagger erledigt), Wertabzug für Gewalt (E-114), Airbags.

---

## 8. Fragen an Patrick

**Frage 1: Motor und Getriebe — wie hängen sie zusammen?**
- **A (Empfehlung):** Einzeln, nacheinander. Nach der Haube kommt erst der Motor, dahinter wird das Getriebe frei. Das ist die echte Lage und gibt zwei Momente statt einem.
- B: Als ein Block. Motor und Getriebe kommen zusammen heraus und trennen sich erst beim Zerdrücken. Das geht schneller, ist aber ein Teil weniger zum Sortieren.
- C: Einzeln, beide sofort nach der Haube frei. Die Reihenfolge ist egal.

**Frage 2: Innenausstattung in 1.0?**
- **A (Empfehlung):** Sie ist ab 1.0 zu sehen und knautscht mit. Herausholen kann man sie ab 1.1. Das kostet ½ Tag und kein Netz.
- B: Gleich in 1.0 herausholbar (durch die geborstene Scheibe). Das kostet 2–3 Tage mehr und macht den Termin knapper.
- C: Erst in 1.1, in 1.0 bleibt der Innenraum leer.

**Frage 3: Wird eine ganz ausgeweidete Karosse zu Stahlschrott?**
- **A (Empfehlung):** Ja. Sind Innenraum, Motorraum und Räder raus, ist die Karosse Stahlschrott, auch gepresst. Deine Begründung vom 12.09. waren die Sitze („da sind so viele Komponenten dran mit Sitzen"). Sind die raus, entfällt sie, und Sorgfalt hat einen Lohn.
- B: Nein, ein Auto bleibt immer Mischschrott (Ansage 12.09.2026).

**Frage 4: Was macht ein Biss auf die geschlossene Motorhaube?**
- **A (Empfehlung):** Der erste volle Biss lässt sie aufspringen, der zweite reißt sie ab. Gewalt öffnet schnell, ohne zu bestrafen (E-114).
- B: Der Biss beult nur. Abreißen geht nur durch Greifen und Ziehen.
- C: Der erste Biss reißt sie sofort ab.

**Frage 5: Soll das Abreißen einen kurzen Ruck haben?**
- **A (Empfehlung):** Nur am Teil: Funken, Knall, das Teil fliegt weg. Kamera und Spinne bleiben, wie sie sind (Regel 2).
- B: Dazu ein kleines Kamerazittern (0,15 s), im Pausenmenü abschaltbar.
- C: Dazu eine Mini-Zeitlupe (0,08 s) im Moment des Reißens.

**Frage 6: „Reifen haben immer Felge" — gilt das auch für lose Reifen auf dem Platz?**
- **A (Empfehlung):** Ja, überall. Jeder lose Pkw-Reifen ist ein Rad mit Stahlfelge. Nur was Lambert trennt, liegt als nackter Reifen da.
- B: Nur an Wracks. Lose Einzelreifen auf dem Platz bleiben ohne Felge.

---

## Auf dem Gerät zu prüfen (wenn gebaut)

Für dieses Konzept gibt es nichts am Gerät zu prüfen. Nach dem Bau von 1.0:

1. Auf die geschlossene Haube beißen: Springt sie auf und hängt schief? Kommt beim zweiten Biss die Haube und **nicht** der Motor?
2. Aufs Dach beißen, bis es flach ist: Kommt **kein** Getriebe mehr heraus?
3. Haube ab: Siehst du Batterie, Kühler und Motor? Gehen sie nur in dieser Reihenfolge?
4. Ein Rad abreißen: Erkennst du Reifen und Felge? Rollt es?
5. Durch eine geborstene Scheibe schauen: Siehst du Sitze und Armaturenbrett, und knautschen sie mit?
6. Beim Abreißen: Funken, Knall, fliegt das Teil — und fühlt sich das Greifen genau wie vorher an?
7. iPhone mini: Läuft es mit beiden Autos auf dem Platz so flüssig wie vorher?

---

## Quellen

Verwertung in Wirklichkeit:
- [Umweltbundesamt: Altauto-Verwertung](https://www.umweltbundesamt.de/en/altauto-altautoverwertung) — Trockenlegung, Batterie, Demontage vor dem Schredder
- [Umweltbundesamt: Stoffstrom Altfahrzeuge (PDF)](https://www.umweltbundesamt.de/system/files/medien/377/dokumente/stoffstrom_altfahrzeuge_car.pdf)
- [BMW: Recycling und Rücknahmestellen (PDF)](https://www.bmw.de/content/dam/bmw/marketDE/bmw_de/BMW_Recycling_und_Ruecknahmestellen_Uebersicht_260212.pdf.asset.1771311194085.pdf) — Reihenfolge Batterie, Airbags, Betriebsstoffe, dann Ausbau
- [VDI 4082: Trockenlegung und Vorbereitung zur Demontage](https://vdi.de/en/home/vdi-standards/details/vdi-4082-recycling-of-cars-draining-and-preparation-of-vehicles-for-the-disassembly)
- [Recycling Product News: Bagger mit Niederhalter und Sortiergreifer](https://www.recyclingproductnews.com/article/15002/auto-dismantling-system-announced) — reißt Kabelbaum, Kühler, Motor, Getriebe; 10–12 Autos pro Stunde
- [Sennebogen 825 mit Powerhand bei der Autoverwertung Neumann (Video)](https://sennebogen.com/en/news/videos/sennebogen-825-mobile-vehicle-recycling-with-powerhand-at-autoverwertung-neumann-germany)
- [Molson: Ace Recycling](https://molsongroup.com/car-breakers-aces-recycling-with-830e-scrap-handlers/) — Manipulator lässt eine fast blanke Karosse, Kunststoff und Stoff in einen eigenen Behälter, dann Schere
- [Sennebogen 830 E: LKW zerlegen bei F.W. Thomas](https://sennebogen.com/en/news/news-press/changing-made-easy-dismantling-trucks-at-fw-thomas-with-a-sennebogen-830-e-and-various-attachments)

Was Zerstörung im Spiel befriedigend macht:
- [BeamNG: Physik (Knoten und Balken)](https://beamng.com/game/about/physics) und [Wikipedia: BeamNG.drive](https://en.wikipedia.org/wiki/BeamNG.drive) — Türen lösen sich, Scheiben bersten, Last läuft durchs Gerippe
- [Wikipedia: Wreckfest](https://en.wikipedia.org/wiki/Wreckfest) — Weichkörper-Schaden je Stelle
- [Cubed3: Wreckfest 2](https://www.cubed3.com/games/reviews/pc/wreckfest-2) — Teile fliegen und zerspringen
- [Shacknews: Interview Tuxedo Labs (Teardown)](https://shacknews.com/article/135274/tuxedo-labs-teardown-interview)
- [PC Gamer: Hardspace: Shipbreaker](https://pcgamer.com/hands-on-hardspace-shipbreaker) und [Gaming Trend: Review](https://gamingtrend.com/reviews/hardspace-shipbreaker-review-breaking-things-has-never-been-this-fun/) — erst aufschneiden, dann sortieren in drei Ziele
- [iTWire: Car Mechanic Simulator](https://itwire.com/reviews-sp-288/games/review-car-mechanic-simulator-2014) — Ausbau nur in logischer Reihenfolge
- [Wayline: Game Feel & Juice](https://www.wayline.io/learn/game-feel/1) und [Easton Dev: Woher Spielgefühl kommt](https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/) — Hit-Stop 0,05–0,1 s, wenig Wackeln, Partikel, Ton
