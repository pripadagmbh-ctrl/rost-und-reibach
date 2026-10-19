# Aufgaben für Version 1.0 — Konzept zur Abnahme

Stand 19.10.2026 · nur Konzept, noch kein Code · Grundlage: E-118, E-119, E-125, E-129, Patricks Entscheidung vom 19.10.2026 („Aufgaben + Sandkasten").

## Das Prinzip in einem Satz

Jede Aufgabe ist eine Karte mit **einem klaren Ziel** („Bring alle sechs Teile in die richtige Mulde"). Die Karte zeigt **schon während des Spielens** Uhr, Zähler und was drei Sterne braucht. Am Ende gibt es **1 bis 3 Sterne** nach Zeit, Genauigkeit und Schäden, und mit **einem Tipp auf ↻** fängt man neu an.

Ziel dahinter: Ein Fremder versteht in 2 Minuten, wie man greift und was er tun soll, und bleibt mindestens 10 Minuten dran. Die sechs Aufgaben für 1.0 dauern beim ersten Mal zusammen rund 15 Minuten (geschätzt).

---

## Was am alten System unreif war, und wie das Konzept es behebt

Patrick hat am 16.10. nur gesagt: „noch nicht ausgereift". Einen Grund hat er nicht genannt, und die fünf Gerätefragen aus E-125 sind nie beantwortet worden. Was folgt, ist aus dem Log und dem Code abgeleitet. **Bitte beim Lesen sagen, ob das trifft.**

| Was unreif war | Woran man es sieht | Wie das Konzept es behebt |
|---|---|---|
| **Es gab nur eine einzige Challenge.** | `katalog.ts` hat genau einen Eintrag. Nach ihr kam nichts mehr. | 6 Aufgaben für 1.0, 2 weitere später, in steigender Schwierigkeit. |
| **Die erste Aufgabe war gleich die schwerste Übung.** Das Wrack stand *hinter* dem Bagger, also außerhalb des ersten Bilds, dazu ein 1-t-Wrack, die Kammer und der Funktionskranz. | Schritt 1 hatte sechs Textzeilen und erklärte fünf Bewegungen auf einmal. | Aufgabe 1 lehrt nur Greifen, Heben, Schwenken und Ablegen, mit **einem** kleinen Teil, das **vorne im Bild** liegt. Die Presse kommt erst in Aufgabe 2. |
| **Erklärt wurde mit Text statt mit Zeigen.** „Linker Stick seitlich: Oberwagen drehen". Die Sticks schweben aber, sie erscheinen erst dort, wo der Daumen aufsetzt. | Es gibt nichts im Bild, worauf man schauen könnte. | Eingeblendete Geisterdaumen mit Pfeil in der linken bzw. rechten Stick-Zone, und eine Markierung am Ziel. Pro Schritt nur eine Bewegung. |
| **Der letzte Schritt war versteckt.** „Rechten Daumen auflegen und stillhalten, dann zu SCHERE ziehen". Die Presse hieß auf dem Kranz **Schere**. | E-125 Schritt 4/4. | Ein Knopf **PRESSEN** direkt auf der Karte, sobald das Wrack drin liegt (Frage 3). |
| **Die Sterne waren unsichtbar und teils nicht zu schaffen.** Ruhe (Pendel in Grad) und Präzision (cm) kamen erst am Ende. Ohne gemessenen Zyklus gab es „✗ nicht gemessen", also höchstens 1 Stern, ohne dass man wusste, warum. Die Zeitgrenze war nur geschätzt. Seit dem freien Pendel (E-132) ist „unter 3°" deutlich schwerer (so vermerkt bei E-132). | E-125 Entscheidung 5, E-132 „Bewusst nicht entschieden" Nr. 4 | Die Sternziele stehen von Anfang an auf der Karte. Gezählt wird nur, was man sieht: Uhr, richtige/falsche Mulde, harte Aufschläge, Abstand zur Markierung. Pendelgrad fällt als Sternbedingung weg (Frage 5). |
| **Neustart hieß, die ganze App neu zu laden**, und zwar nur am Ende über NOCHMAL. Mittendrin ging es nur über Pausenmenü → Zum Hauptmenü. | `nochmal()` in `hauptmenue.ts` | Ein Knopf ↻ ist immer auf der Karte. Er nutzt zunächst denselben Neustart. Die Ladezeit wird auf dem iPhone mini gemessen; ist sie zu lang, kommt der Neuaufbau ohne Neuladen später (Frage 4). |
| **Das Spiel hat sich seit dem 06.10. verändert, die Challenge nicht.** Hohles Wrack, das knautscht (E-124/128), freies Pendel (E-132), breitere Presse (E-138), Traglast nach Ausladung (E-152/154), Sichelkralle weg (E-155). | Schwellen von E-125 stammen von vor diesen Einträgen. | Alle Startwerte werden neu gesetzt (SW) und nach Patricks ersten Läufen nachgestellt. Seit E-138 fällt das Wrack auch quer in die Kammer. Damit ist die offene Frage „längs einlegen?" aus E-125 erledigt. |

**Was gut war und bleibt:** Aufgaben sind Daten (`katalog.ts`). Eine neue Aufgabe ist ein neuer Eintrag und kein neuer Code. Ein Schritt gilt erst als geschafft, wenn das Spiel ihn *gesehen* hat. Was man schon richtig macht, wird übersprungen. Die Texte richten sich nach der eigenen Stickbelegung. Es gibt eine Abschlusstafel mit Sternen. Und: **Nichts an Spinne, Greifen, Pendel oder Kamera wird verändert** (Regel 2). Aufgaben beobachten nur.

---

## Die Aufgaben

Standort ist immer der Hauptstand des Baggers (Blick zur Waage). Alles, was in 1.0 vorkommt, ist ohne Fahren erreichbar:

- vorne die blaue **MÜLL**-Mulde,
- vorne rechts die Box **BUNT + VA**,
- rechts hinten die **Presse**,
- hinten die Halden **MISCHSCHROTT** und **STAHLSCHROTT**.

Die genauen Plätze der Teile werden beim Bau so gerechnet, dass sie im Schwenkband liegen (5,8 bis 9,2 m vom Sitz). Bewacht wird das wie heute in `test/startplatz.test.ts`.

Alle Zahlen bei den Sternen sind **SW** (Startwert zum Austesten, Regel 3).

### 1 · Erster Griff (geführte Einführung)

- **Ziel:** Heb das Kupferteil auf und leg es in die Box BUNT + VA.
- **Lehrt:** Oberwagen drehen, Hauptarm senken und heben, Spinne schließen und öffnen. Das sind die vier Bewegungen, ohne die nichts geht.
- **Aufbau:** Ein einzelnes kleines Buntmetallteil (aus dem vorhandenen Teilekatalog, unter 200 kg) liegt **vorne im ersten Bild**. Die Box BUNT + VA ist markiert. Sonst liegt nichts auf dem Platz.
- **Ablauf:** Sechs Mini-Schritte, je eine Bewegung, je ein Geisterdaumen mit Pfeil an der richtigen Stick-Zone:
  1. Dreh dich zum Teil.
  2. Senk die Spinne ab.
  3. Schließ die Spinne.
  4. Heb an.
  5. Schwenk zur Box.
  6. Öffne die Spinne.

  Jeder Schritt klickt, wenn er geschafft ist. Wer schneller ist, überspringt die Schritte, wie heute.
- **Sterne:** ★ geschafft · ★★ unter 3:00 min · ★★★ unter 1:30 min. Bewusst großzügig, denn hier soll keiner scheitern.
- **Dauer:** 1–2 min.
- **Wiederverwendet:** Karte, Schrittfolge, Überspringen, Stickbelegung im Text, Abschlusstafel, Speicher.
- **Neu:** die Einblendungen (Geisterdaumen, Zielmarkierung), 3 neue Beobachtungen (Spinne über dem Teil, Teil gehoben, Teil in der richtigen Mulde über das vorhandene Ereignis `itemEntered`), Teile im Aufbau. **Aufwand: groß.** Das meiste davon ist die einmalige Grundlage für alle Aufgaben, siehe unten.

### 2 · Auto in die Presse (die alte Challenge, überarbeitet)

- **Ziel:** Leg das Wrack in die Presse und press es.
- **Lehrt:** große Last ruhig führen, genau ablegen, Presse auslösen.
- **Aufbau:** wie E-125, ein PKW-Wrack. **Neu:** Es steht schräg vorne statt hinter dem Bagger, damit man es sofort sieht.
- **Sterne:**
  - ★ gepresst
  - ★★ unter 3:00 min **und** höchstens 1 Meter neben der Kammermitte
  - ★★★ unter 1:30 min **und** höchstens 40 cm neben der Mitte **und** kein harter Aufschlag

  Die cm-Zahlen sind die aus E-125. „Harter Aufschlag" ist das vorhandene Ereignis `schrott:aufprall`; die Schwelle setzen wir beim Bau, SW.
- **Dauer:** 2–3 min.
- **Wiederverwendet:** fast alles (Beobachtungen, Kammerprüfung, Präzision aus E-119).
- **Neu:** Knopf PRESSEN auf der Karte, neuer Standort, neue Schwellen. **Aufwand: klein.**

### 3 · Sortieren

- **Ziel:** Bring alle sechs Teile in die richtige Mulde.
- **Lehrt:** Schrottsorten erkennen, in beide Richtungen schwenken, Ausleger heran und weg, Teile nacheinander abarbeiten.
- **Aufbau:** Sechs Teile liegen locker vorne:
  - 2 × Stahl → STAHLSCHROTT
  - 2 × Misch → MISCHSCHROTT
  - 1 × Alu oder Kupfer → BUNT + VA
  - 1 × Müll → MÜLL (blau)

  Die Karte zählt mit: „4/6 richtig".
- **Sterne:** ★ alle sechs richtig drin · ★★ unter 4:00 min und höchstens 1 Fehlwurf · ★★★ unter 2:30 min und kein Fehlwurf. Ein falsch eingeworfenes Teil darf man wieder herausholen. Es zählt trotzdem als Fehlwurf.
- **Dauer:** 3–4 min.
- **Wiederverwendet:** Rahmen. Richtig/falsch meldet die Mulde schon heute (`itemEntered`, Feld `correct`).
- **Neu:** Zähler auf der Karte, Teile im Aufbau. **Aufwand: mittel.**

### 4 · Platt machen (Zerstörung)

- **Ziel:** Mach den Wohnwagen platt, nur mit der Spinne.
- **Lehrt:** Hämmern (mit der leeren Spinne zuschlagen) und Drücken. Dazu: Die Spinne ist auch ein Werkzeug, nicht nur ein Greifer.
- **Aufbau:** Ein Wohnwagen (knautscht schneller als ein Auto) steht vorne. Auf der Karte ein Balken „platt: 0 … 100 %". Das ist der vorhandene Knautschgrad aus E-128.
- **Sterne:** ★ zu 80 % platt · ★★ unter 2:00 min · ★★★ unter 1:00 min.
- **Dauer:** 1–2 min. Das ist die Belohnungsrunde zwischen den Präzisionsaufgaben.
- **Wiederverwendet:** das Ereignis `wrack:geknautscht` mit dem Knautschgrad, Wohnwagen als Wrackart.
- **Neu:** Balken auf der Karte, eine Beobachtung. **Aufwand: klein.**

### 5 · Magnet

- **Ziel:** Hol mit dem Magnet alles Eisen aus dem Haufen und lass das Kupfer liegen.
- **Lehrt:** Lasthebemagnet ein- und ausschalten, über dem Haufen pendeln, abwerfen. Und: Nur Eisen und Stahl haften.
- **Aufbau:** Die Aufgabe beginnt **schon mit dem Magnet** am Arm, damit man nicht durchs Pausenmenü muss. Ein kleiner Haufen vorne: Späneknäuel, Stahlteile, 2 Kupferteile. Ziel ist die Halde STAHLSCHROTT. Zähler „Eisen: 5/8".
- **Sterne:** ★ alles Eisen drüben · ★★ unter 3:00 min · ★★★ unter 2:00 min und kein Kupfer in der Stahlhalde.
- **Dauer:** 2–3 min.
- **Wiederverwendet:** Magnet (E-146), Späne (E-147), `itemEntered`.
- **Neu:** Greifer-Wahl im Aufbau. **Aufwand: klein bis mittel.**

### 6 · Schwere Last

- **Ziel:** Heb das LKW-Wrack auf die Stahlhalde. Allein geht es nicht.
- **Lehrt:** Traglast hängt von der Ausladung ab. Pratzen ausfahren (Taste O bzw. Kranz STÜTZEN) und die Last nah heranholen.
- **Aufbau:** Das LKW-Wrack steht am Rand der Reichweite. Der erste Hebeversuch löst die vorhandene Überlast-Meldung aus (E-152). Erst dann zeigt die Karte den Tipp „Stütz dich ab und hol es näher heran".
- **Sterne:** ★ abgelegt · ★★ unter 3:00 min · ★★★ unter 2:00 min und höchstens eine Überlast-Meldung.
- **Dauer:** 2 min.
- **Wiederverwendet:** Überlast-Ereignis `greifer:ueberlast`, Pratzen, LKW-Wrack.
- **Neu:** eine Beobachtung, ein Tipp, der erst nach einem Ereignis erscheint. **Vorher messen:** Das Gewicht des LKW-Wracks steht nirgends. Die Aufgabe geht nur, wenn es ohne Pratzen in dieser Entfernung Überlast meldet und mit Pratzen nicht. Sonst nehmen wir einen anderen Platz. **Aufwand: mittel.**

### 7 · Zerlegen *(später)*

- **Ziel:** Reiß dem LKW-Wrack Motor, Tank und Räder ab und sortiere sie.
- **Lehrt:** gezielt an ein Anbauteil greifen, drehen (↺ ↻), dosiert ziehen.
- **Sterne:** nach Zeit. ★★★ zusätzlich, wenn das Fahrerhaus kaum geknautscht ist (Knautschgrad unter 20 %, SW), also vorsichtig gearbeitet.
- **Dauer:** 4–5 min.
- **Wiederverwendet:** `partTorn`, `wrack:geknautscht`, `itemEntered`.
- **Aufwand: mittel.** Später, weil es lang ist und für den 10-Minuten-Test nicht nötig.

### 8 · Weitwurf *(später)*

- **Ziel:** Wirf fünf Teile in eine Mulde, die außerhalb deiner Reichweite steht.
- **Lehrt:** Schwung holen, im richtigen Moment öffnen (Wurf aus E-115).
- **Sterne:** ★ 1 Treffer · ★★ 3 Treffer · ★★★ 5 Treffer.
- **Dauer:** 2–3 min.
- **Wiederverwendet:** Wurfweite aus E-119, `itemEntered`.
- **Aufwand: mittel.** Später, weil dein Wunsch vom 16.10. („mehr schleudern", offene Punkte) erst gebaut sein sollte. Sonst fühlt sich die Aufgabe nach der alten Grenze an.

---

## Grundlage für alle Aufgaben (einmal bauen)

| Baustein | Was | Aufwand |
|---|---|---|
| Beobachtungen aus Ereignissen | Heute kann eine Challenge nur vier Dinge über *ein* Wrack sehen. Neu hört sie auf die Ereignisse, die es schon gibt (`itemEntered`, `wrack:geknautscht`, `greifer:ueberlast`, `schrott:aufprall`, `partTorn`, Magnet). | mittel |
| Aufbau erweitern | Neben Wracks auch einzelne Teile, Wohnwagen, LKW-Wrack, Startgreifer. | klein bis mittel |
| Karte mit Live-Anzeige | Uhr, Zähler oder Balken, die Sternziele, der Knopf ↻. | klein |
| Einblendungen | Geisterdaumen mit Pfeil in der Stick-Zone, Markierung an Teil und Mulde. Gebaut für Aufgabe 1, nutzbar für alle. | mittel bis groß |
| Aufgabenliste im Menü | Ist da (Knöpfe mit Sternen). Neu: Schloss, falls nacheinander freigeschaltet wird. | klein |
| Englische Texte | Alle Karten DE + EN, weil 1.0 zweisprachig erscheint. | klein |
| Schalter umlegen | `CHALLENGES_PAUSIERT = false` (E-129). | – |

## Gesamtaufwand und Vorschlag

Grob geschätzt, nicht gemessen (klein ≈ ½ Tag, mittel ≈ 1–2 Tage, groß ≈ 3 Tage):

- Grundlage ≈ 6–7 Tage
- Aufgaben 1–6 ≈ 4 Tage
- zusammen also **rund 2 Wochen** plus Gerätetest-Runden

Das passt in den Vier-Wochen-Plan, aber nur, wenn Aufgabe 1 und die Grundlage **diese Woche** anfangen. Der Store-Teil läuft parallel.

- **Für 1.0:** Aufgaben 1–6. Das ist das Minimum von 6, beim ersten Durchgang rund 15 Minuten Spielzeit.
- **Später (1.1):** 7 Zerlegen, 8 Weitwurf, dazu Kipper beladen, sobald die Kipper-Befunde erledigt sind.
- **Reihenfolge beim Bau:**
  1. Grundlage + Aufgabe 1. Auf dem iPad abnehmen, denn das ist das 2-Minuten-Tor.
  2. Aufgabe 2 (am billigsten, fast fertig).
  3. Aufgaben 3, 4, 5, 6.

---

## Fragen an Patrick

**Frage 1: Wie werden die Aufgaben freigeschaltet?**
- **A (Empfehlung):** Nacheinander. Die nächste öffnet sich, sobald die vorige geschafft ist (1 Stern reicht). Der Sandkasten ist immer offen. So hat ein Fremder einen klaren Weg und bleibt nie hängen.
- B: Nach Aufgabe 1 sind alle offen.
- C: Alle sofort offen.

**Frage 2: Was passiert beim allerersten Start?**
- **A (Empfehlung):** Direkt in Aufgabe 1, ohne Menü, so wie es in E-125 schon gebaut war. Wer sie geschafft hat, sieht danach das Menü.
- B: Menü mit einem großen Knopf „Los geht's" auf Aufgabe 1.
- C: Direkt in den Sandkasten. Die Aufgaben stehen im Menü.

**Frage 3: Wie wird die Presse in Aufgabe 2 ausgelöst?**
- **A (Empfehlung):** Ein Knopf PRESSEN erscheint auf der Karte, sobald das Wrack drin liegt. Der Kranz geht weiterhin.
- B: Wie bisher über den Funktionskranz, aber der Eintrag heißt PRESSE statt SCHERE.
- C: Die Presse startet von selbst, sobald das Wrack losgelassen in der Kammer liegt.

**Frage 4: Wie soll ↻ Neustart funktionieren?**
- **A (Empfehlung):** Ein Knopf ↻ ist immer auf der Karte und startet die App neu, direkt in dieselbe Aufgabe. Das ist billig. Ich messe die Ladezeit auf dem iPhone mini; ist sie zu lang, kommt B nach 1.0.
- B: Sofort einen schnellen Neuaufbau ohne Neuladen bauen. Das ist schneller beim Spielen, aber teuer (etwa 3 Tage).
- C: Neustart nur am Ende (NOCHMAL) und im Pausenmenü.

**Frage 5: Wonach gibt es Sterne?**
- **A (Empfehlung):** Nur nach dem, was man sieht: Zeit, Fehler (falsche Mulde, harte Aufschläge) und Abstand zur Markierung. Alles steht von Anfang an auf der Karte.
- B: Wie bisher zusätzlich die Pendel-Ruhe in Grad.
- C: Nur nach Zeit.

---

## Auf dem Gerät zu prüfen

Erst, wenn gebaut ist. Für dieses Konzept gibt es nichts am Gerät zu prüfen.

1. Aufgabe 1 einem Fremden geben, ohne etwas zu erklären: Hat er das Teil nach 2 Minuten in der Box?
2. Wohin schaut er, wenn er nicht weiterweiß: auf die Karte, auf die Geisterdaumen oder auf gar nichts?
3. Spielt er nach Aufgabe 1 von selbst weiter, und wie lange?
