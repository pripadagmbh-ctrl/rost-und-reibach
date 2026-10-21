# Offene Punkte (Stand 11.09.2026)

Gesammelt aus den Gerätetests. Abgearbeitet wird von oben nach unten; was
erledigt ist, bekommt den Commit dazu.

## Erledigt

- [x] **Keine Fahrzeuge ineinander** — Bagger und Radlader fuhren durch
      stehende LKW. Gedrehte Standflächen in `world/boxen.ts`. (`d7a05f8`)
- [x] **Ladehöhe und Ladeform** — gepackt wird wie in eine Kiste
      (`delivery/ladung.ts`), Oberkante knapp über der Bordwand.
- [x] **Abholer verliert Schrott** — was auf der Fläche liegt, wird beim
      Losfahren verriegelt und fährt mit.
- [x] **"Vorfahren" ersetzt** durch "Zur Waage", **"Kippen" entfernt**.
- [x] **Janine ist im Kaffeewagen zu sehen** — sie hing in Weltkoordinaten
      hinter der Aussenwand.
- [x] **Schnappgeräusch** beim Zusammenschlagen der Zähne.

## Physik und Ladung

- [x] **Nichts schwebt, nichts fällt vom Himmel** — der Vorlauf legte am Ende
      *alles* schlafen, auch was noch in der Luft war. Gemessen hing ein
      75-kg-Stück in 7,01 m Höhe und fiel 6,66 m, sobald es geweckt wurde.
      Jetzt wird nach dem Setzen noch einmal alles geweckt und weitergerechnet,
      bis nichts mehr fällt. Danach: höchstes Teil 2,38 m statt 7,01, und von
      den zwölf höchsten sackt noch eines um 41 cm.
- [ ] **Teile liegen beim Start ineinander** — beim Wecken drückt der Löser
      einzelne um bis zu 55 cm nach oben. Kein Schweben, aber unsauber: Der
      Haufen wird beim Setzen zu dicht gepackt.

## Presse und Schere

- [x] **Gelbes Anbauteil der Presse** verdeckt die Ballen und stört beim
      Greifen — weg, schmaler oder nur bei Bedarf. **Nachgemessen 15.09.2026
      (E-071):** Gelb war an der Maschine nichts mehr — die drei gelben Stücke
      sind am 12.09. auf deine Ansage hin entfernt worden, der Punkt stand nur
      noch aus Versehen hier. Im Weg stand etwas anderes, und zwar etwas, das
      man **gar nicht sehen konnte**: die zweite Deckelklappe. Ihre Netze waren
      unsichtbar gestellt, ihr Kollider aber blieb 4,45 × 2,16 m gross und
      stand 0,905 m weit in der Kammermündung — auf genau der Seite, von der
      die Spinne kommt. Sie ist weg. Dazu vier Versteifungsriegel, die frei in
      der Luft hinter der Presse schwebten (bis 2,00 m neben der Platte).
- [x] **Ballen sehen zu sauber aus** — Fransen, Reste der Ursprungsform,
      unterschiedliche Farben. **Stand 15.09.2026 (E-071):** Fransen und Farben
      waren am 12.09. gebaut worden; ein Kupferballen ist kupfern, ein
      gemischter trägt die Farben seiner Zusammensetzung. Gefehlt hat die
      **Ursprungsform** — jetzt zeigt jede Fraktion mit mindestens einem
      Sechstel der Masse ein Stück von sich: Blech, Rohr, Felge oder
      Kantstück, in derselben verschmolzenen Geometrie, also weiter ein
      Zeichenruf je Ballen.
- [x] **Schere trennt nicht sortenrein** — was in die Presse geht, kommt als
      Mischschrott heraus. **Nachgemessen und behoben 16.09.2026 (E-091).**
      Beim Geld war die Presse schon sauber: Fünf Kupferteile ergaben ein
      Kupferpaket, und der Erlös war vor und nach dem Zuschlagen auf den Cent
      derselbe. Kaputt waren zwei andere Dinge. **Erstens** galt an der Presse
      eine strengere Regel als auf dem Platz — sie verlangte 95 % EINES
      STOFFES, während ein Teil auf dem Platz bis 10 % Fremdstoff Stahlschrott
      bleibt (E-042). Fünf Stücke, die jedes für sich Stahlschrott sind, kamen
      als Mischschrott heraus. **Zweitens** verlor das Paket seine
      Zusammensetzung beim Speichern: Sie stand nur am Teil, gesichert wird
      aber nur die Form. Ein Ballen aus 64 kg Kupfer und 217 kg Messing war
      556,46 € wert und nach einem Neuladen 44,96 €; ein Ballen aus vier
      Abfallsorten kostete 0,60 € Gebühr und brachte nach dem Laden 12,48 €
      Gutschrift — man konnte Müll pressen, neu laden und wurde dafür bezahlt.
      Beides zu, `test/presspaket.test.ts` hält es fest.
      **Offen und bewusst nicht entschieden:** Kupfer und Messing gehören in
      DIESELBE Mulde (KUPFER-LAGER, E-029), das Schild zeigt „100 %
      sortenrein" — zusammen gepresst ergeben sie trotzdem einen Mischballen.
      Dasselbe für ALU-LAGER, BUNT+VA und die Müllmulde.
- [ ] **Misch- und Stahlschrott unterscheiden** — getrennt verkaufen, Stahl
      erzielt den besseren Preis.

## Abfall

- [x] **"Störstoff" auflösen** in Holz, Baumischabfall, Reifen und
      Kunststoffe — Störstoff sagt niemandem etwas. **Erledigt 16.09.2026
      (E-077).** Die vier Namen gab es seit E-067; was fehlte, war alles
      andere. Jetzt hat jede eine eigene Schüttdichte, eine eigene Farbe, die
      man am Gegenstand auch **sieht**, und acht eigene Gegenstände in der
      Größenklasse, aus der eine Anlieferung zieht — Baumischabfall hatte dort
      **null**. Reifen konnten bis dahin gar nicht angeliefert werden: Sie
      fehlten im Fraktionsmix. Der Verdienst hat sich dabei nicht verschoben
      (Abfallanteil weiter 6,7 %, gemessen).
      **Offen und bewusst nicht entschieden:** ob die vier weiter zusammen in
      den Müllcontainer gehören oder ob z. B. Reifen wieder einen eigenen
      bekommen. Das Blatt dazu liegt vor: `docs/abfallmulde-2026-09-16.svg`.
- [ ] **Abfall-Anlieferung** — ein LKW kommt nur mit Abfällen, fährt von
      hinten an die Mulde bzw. auf deren Vorplatz und kippt dort ab.
- [ ] **Lambert sortiert den Abfall** mit dem Radlader in die Mulden.
- [ ] **Geld** — Abfallannahme bringt Geld, Abholung/Entsorgung kostet
      weniger als der Erlös.

## Radlader

- [ ] **Mulden befüllen, solange Platz ist**; sonst andere Arbeit aufnehmen —
      z. B. Schrott von der Büroseite an den Bagger heranschieben.

- [ ] **Wurfrichtung beim Loslassen** — beschleunigte Teile sollen seitlich
      wegfliegen, nicht senkrecht fallen.

## Leute und Stimmung

- [x] **Schrotthändler sehen verschieden aus** — gepflegt bis ölig, klein und
      dick bis lang und dünn, Wiedererkennungsmerkmale (Goldkette, dicke Uhr,
      Schäferhund). Insgesamt mehr Detailtiefe als Playmobil.

      *Gebaut 15.09.2026 (E-077).* Alle 23 Kunden haben ein `aussehen` in
      ihrem Datensatz (`delivery/customers.ts`): Statur 1,58–1,92 m, Fülle,
      Pflegegrad, Hautton, Haarfarbe, Jacke, Warnweste und **genau ein**
      Wiedererkennungsmerkmal. Die Figur ist dabei von 10 Netzen auf **2**
      gefallen (`world/kundenfigur.ts`), der Hund kostet ein weiteres.
      Ein Wächter mit sechs Gegenproben hält fest, dass aus dem Aussehen
      weder Gruppe noch Verhandlungsverhalten abzulesen ist.

      *Offen geblieben:* Die Figur ist nur bei der Kaffeepause zu sehen; ein
      Privatmann mit Hund fährt ohne (PKW-Kabine gehört dem Kran-Paket); die
      Glieder schwingen nicht mehr beim Gehen (Netzbudget, siehe E-077).
- [x] **Musik nach Fasson** — **gebaut 17.09.2026 (E-098).** Fünf Sender, alle
      selbst gespielt, keine Fremddatei: Schlagerwelle, Hallenfunk,
      Nachtschicht, Werkhof, Niederrhein Eins (`audio/songs.ts`). Umgeschaltet
      wird im Führerhaus über SCHILDER → MUSIK; die Taste schaltet **weiter**
      statt an/aus, weil „aus" sonst eine Sackgasse wäre. Nach dem letzten
      Sender kommt „Radio aus". Patrick am Gerät: „musik klingt verschieden" —
      damit ist der Punkt bestätigt.
- [~] **Funkgerät im Führerhaus** — **die Sprüche sind gebaut**
      (`ui/funk.ts`): Mario, Janine und Lambert melden sich zu Kundschaft,
      Wiegung und Platzlage, verdrahtet in `main.ts`.

      **Offen bleibt die Gegenrichtung:** Lambert nimmt **keine** Anweisungen
      an — Alu rauspicken, Kupfer holen, Schrott zusammenschieben, Baumisch
      abladen. Heute ist das Funkgerät ein Lautsprecher, kein Gerät zum
      Sprechen. Sein Verhalten liegt in `world/staff.ts` und hört auf nichts
      von außen (`ui/funk.ts:39` hält das ausdrücklich fest).

## Handel

- [ ] **Heisse Ware** — Händler mit heissem Haufen wollen schnellen Umschlag:
      direkt verladen, Autos direkt in die Presse. Volle Ladungen, sonst
      lohnt es nicht; zu durchmischt drückt den Preis.

## Wirtschaft

- [ ] **Mischschrott wird pauschal bepreist, nicht nach Inhalt** — gemessen
      12.09.2026: Ein Rad (Reifen 70 %, Felge 30 %) bringt ungetrennt 4,00 €,
      zerlegt nur 1,00 €, weil Reifen Entsorgungskosten verursachen. Damit
      lohnt es sich, Reifen **nicht** zu trennen — das Gegenteil der Absicht.
      Vorschlag: Der Wert eines Mischschrott-Teils ist die Summe seiner
      Bestandteile, vermindert um einen Abschlag fürs Unsortierte. Dann ist
      Zerlegen nie ein Verlust, nur manchmal wenig Gewinn.

## Personal

- [x] **Lambert trennt mit Werkzeug** — zwei neue Zustände `werkzeug`
      (hinlaufen) und `trennt` (neun Sekunden arbeiten, mit Funken). Danach
      liegen die Fraktionen getrennt da, und er sortiert sie im nächsten
      Arbeitsgang selbst in die Mulden. Gemessen: patrol → werkzeug → trennt →
      patrol → carry.
- [ ] **Heinz als Hilfsarbeiter** — zweiter Mann, damit zwei Arbeitsgänge
      parallel laufen. Ausbaustufe wie Radlader und Bulldozer.

## Platz

- [ ] **Absetzcontainer stehen außerhalb des Schwenkkranzes** — Kabel, Kupfer
      und Messing sind 11,6 bis 17,9 m entfernt abgestellt, weil der Ring
      zwischen 4,0 und 9,5 m mit Stahl, Alu und VA voll ist. Gedacht ist es so:
      Lambert trägt Buntmetall hin (er bevorzugt jetzt Container vor Mulden),
      und wer selbst hinein sortieren will, zieht sich den Behälter heran. Ob
      das im Spiel trägt, muss sich zeigen — sonst müsste die VA-Mulde weichen.
- [ ] **Bewegliche Container sind für Fußgänger und LKW unsichtbar** — sie
      stehen nicht in `obstacles.ts` (die Liste ist für Feststehendes), also
      laufen Lambert und die Fahrer dagegen und schieben sie an. Bisher steht
      keiner in einer Fahrspur; sobald der Spieler einen dorthin zieht, fällt es
      auf.
- [ ] **Hortmulden für Kupfer und Messing sind 21 bzw. 25 m entfernt** — an der
      Südwand, wie besprochen zum Horten großer Teile. Dorthin muss gefahren
      werden; ob sich das lohnt, entscheidet sich erst, wenn es wirklich
      sperriges Buntmetall gibt (bisher nur die Schiffsschraube mit 180 kg).

## Notizen 14.09.2026

- [ ] **Federnde LKW beim Abladen** — Wenn der Bagger etwas Schweres in eine
      Mulde legt oder fallen lässt, soll das Fahrzeug auf seinen Federn
      einsacken und ausschwingen, je nach eingeleiteter Kraft. Heute passiert
      gar nichts: Die Fahrzeugkörper sind kinematisch (`delivery/vehicles.ts`),
      also für die Physik unendlich schwer — ein 400-kg-Maschinenblock landet
      so weich wie eine Feder.

      *Warum es zählt:* Es ist die einzige Stelle, an der man dem Spiel ansieht,
      wie schwer das Teil war, das man gerade getragen hat. Gewicht ist sonst
      nur eine Zahl im HUD.

      *Wie es gehen könnte, ohne die Fahrzeuge dynamisch zu machen:* Die
      Fahrzeuge müssen kinematisch bleiben, sonst laufen ihre Routen nicht mehr.
      Ein **rein optisches Federn** reicht aber: Beim Aufschlag auf der
      Ladefläche die eingeleitete Energie messen (Masse mal Geschwindigkeit
      beim Kontakt), daraus einen gedämpften Höhenversatz auf das Fahrzeug-Mesh
      legen und ausschwingen lassen. Der Kollider bleibt, wo er ist. Kostet
      keine Physik und keinen Zeichenruf.

      Sinnvoll auch am Kipper, wenn die Mulde hochgeht und die Ladung
      abrutscht — und am Bagger selbst, wenn er mit voller Spinne absetzt.

      Gehört in Abschnitt 1 („die Welt", E-016), aber erst nach Platz, Bagger
      und Maschinen.

- [ ] **Unterschiedliche Kranfarben und -typen** — Die Händler kommen „mit
      Aufbau, mit Ladekran" (Patrick, 14.09.2026, zum echten Betrieb). Heute
      sehen sie alle gleich aus. Sie sollen sich in **Farbe** und **Bauart** des
      Krans unterscheiden — und damit auch die Fahrzeuge selbst.

      *Warum es zählt:* Die Kunden haben schon Namen und Eigenheiten (Manni,
      Toni, Ewald, Kfz-Werkstatt Rehm — `delivery/customers.ts`). Wenn jeder
      sein eigenes Fahrzeug hat, erkennt man ihn **an der Einfahrt**, bevor man
      den Namen liest: „Der rote mit dem kurzen Kran, der bringt immer Alu."
      Aus einer Liste von Namen werden Stammkunden. Der Punkt „Händler sehen
      verschieden aus" steht seit dem 11.09. auf dieser Liste — das hier ist
      die konkrete Form davon.

      *Wie es gehen könnte, ohne Mehraufwand je Fahrzeug:* Farbe und Krantyp
      **fest je Kunde**, nicht zufällig je Anlieferung — sonst kommt Manni
      jedes Mal in einem anderen Wagen und man kann sich nichts merken.
      Ableitbar aus dem Kundennamen mit festem Zufallsstartwert, dann braucht es
      keine Datenpflege. Krantypen: kurzer Heckkran, langer Kran hinter dem
      Haus, Abrollkipper ohne Kran.

      Gehört zu „Maschinen" in Abschnitt 1 (E-016).

- [ ] **Wracks kommen in verschiedenen Zuständen an** — fehlende Türen, fehlende
      Reifen, Motor schon ausgeschlachtet (Patrick, 14.09.2026). Heute ist jedes
      Auto identisch: `dismantle/carDef.ts` hat **genau einen Datensatz**, und
      jedes Wrack bringt vollständig Motor, Getriebe und vier Räder mit.

      *Warum es zählt:* Es macht aus dem Abladen eine **Einschätzung**. Heute
      weiß man vorher, was drin ist, und arbeitet es ab. Mit wechselnden
      Zuständen muss man hinsehen: Ist an dem noch was dran, oder ist das ein
      leergeräumter Rumpf? Genau das ist die eigentliche Arbeit auf einem
      Schrottplatz — und es gibt dem Verhandeln über den Ankaufspreis zum ersten
      Mal einen Grund, denn ein ausgeschlachtetes Wrack ist weniger wert.

      *Wie es gehen könnte, ohne neuen Code:* `CarDef` ist datengetrieben
      angelegt (`dismantle/composites.ts:538`), die Baugruppen stehen einzeln in
      `carDef.ts:88–149`. Es braucht also keine neue Mechanik, sondern nur die
      Möglichkeit, **Teile beim Erzeugen wegzulassen** — plus sichtbare Spuren
      dort, wo etwas fehlt: offene Radnabe statt Rad, leerer Türrahmen, offene
      Motorhaube mit leerem Raum.

      Der Zustand gehört an die **Anlieferung**, nicht ans Wrack: Welcher Händler
      bringt gute Wracks und welcher nur Reste, ist eine Eigenschaft des Kunden
      — wie Farbe und Krantyp eine Zeile weiter oben. Wer immer Ausgeschlachtetes
      liefert, muss im Preis heruntergehen.

      Gehört zu „Schrott" in Abschnitt 1 (E-016), und es ist der natürliche
      erste Schritt zu Briefing Kap. 8.2 (sieben Zerlegeschritte mit
      Reihenfolge), das bisher ganz offen ist.

- [ ] **Motorräder sind einspurige Fahrzeuge** (Patrick, 14.09.2026). Im Spiel
      gibt es sie noch nicht; die Notiz hält die Eigenschaft fest, auf die es
      ankommt, wenn sie kommen.

      *Was daraus folgt:* Ein einspuriges Fahrzeug **steht nicht von selbst**.
      Ein Autowrack sitzt auf vier Rädern und bleibt, wo es liegt; ein Motorrad
      fällt um, sobald man es loslässt. Auf dem Platz liegt es also auf der
      Seite, im Stapel verkeilt, oder es lehnt an etwas. Aufrecht steht es nur
      auf einem Ständer — und den hat ein Schrottmotorrad meistens nicht mehr.

      Für die Physik heißt das: kein aufrechter Ruhezustand. Wer es hinstellt,
      muss damit rechnen, dass es umkippt, und das ist richtig so.

      Als Schrott ist es interessant, weil fast alles daran Buntmetall ist —
      Motorblock aus Aluminium, Kabelbaum, Auspuff aus Edelstahl. Ein Motorrad
      ist leicht, aber nicht billig.

      *Offen:* Ob du sie als **Wrack zum Zerlegen** meinst (wie die Autos), als
      **Schrottteil** (ein Stück, das man greift und einsortiert) oder als
      **Anlieferfahrzeug**. Die Eigenschaft „einspurig" gilt für alle drei, der
      Aufwand unterscheidet sich stark. Frag mich beim nächsten Mal danach, oder
      schreib es dazu.

      Gehört zu „Schrott" in Abschnitt 1 (E-016).

- [ ] **Velos fehlen auch** (Patrick, 14.09.2026). Ebenfalls einspurig, siehe
      die Notiz darüber — ein Fahrrad steht nicht von selbst, es liegt oder
      lehnt.

      *Warum ein Fahrrad als Schrottteil besonders ist:* Es ist der
      Musterfall für „lohnt sich der Aufwand?". Ein einzelnes Rad wiegt kaum
      etwas und bringt fast nichts. Ein **Haufen** alter Räder dagegen ist eine
      Anlieferung, wie sie jeder Platz kennt — sie kommen nie einzeln.

      Und es ist gemischt gebaut: Stahlrahmen oder Alurahmen, Alufelgen,
      **Gummireifen als Störstoff**, Plastik am Sattel und an den Griffen. Damit
      wird es zur Entscheidung: reinwerfen in den Mischschrott, oder die Reifen
      abziehen und die Alurahmen heraussortieren. Genau die Rechnung, die den
      Reinheitsgedanken im Spiel erst spürbar macht — an einem Gegenstand, den
      jeder kennt.

      *Wie es sparsam ginge:* Velos als **Bündel** anliefern, nicht als
      Einzelteile — ein verkeiltes Knäuel wie die Maschendraht-Bündel, die es
      schon gibt. Der Greifer holt daraus einzelne heraus. Das hält die Zahl der
      Körper klein und sieht nebenbei richtig aus.

      Gehört zu „Schrott" in Abschnitt 1 (E-016).

- [ ] **Bordwände und Türen an den LKW** (Patrick, 14.09.2026). Wie sich ein
      Aufbau öffnet, hängt an seiner Bauart — und beides wird heute gleich
      behandelt.

      **Pritsche:** Die Seitenwände lassen sich links und rechts herunterklappen,
      die Heckwand ebenso. **Heruntergeklappt hängen sie senkrecht nach unten**,
      nicht waagerecht — sie bleiben an den Scharnieren hängen und pendeln an
      der Bordwand. Heute klappen sie in die Waagerechte, und das ist der Fehler.

      **Fester Aufbau (Koffer):** Klappt gar nicht, hat Türen. Und Türen öffnen
      **seitlich**, nie nach oben oder unten.
      - **Hinten:** zwei Flügel, die um 270° herumschlagen und **an der
        Seitenwand einrasten**. So steht kein Flügel im Weg, wenn der Stapler
        oder der Greifer heranmuss.
      - **Seitentür:** wenn vorhanden, dann **nur auf einer Seite** — links
        *oder* rechts, nicht beides.
      - Ohne Seitentür ist ein fester Aufbau **ausschließlich über die Hecktür**
        zu öffnen.

      *Warum es zählt:* Es entscheidet, von wo aus der Bagger überhaupt an die
      Ladung kommt. Ein Koffer ohne Seitentür muss mit dem Heck zum Bagger
      stehen; eine Pritsche kann von drei Seiten entladen werden. Das ist keine
      Optik, das ist die Anfahrt — und damit dieselbe Frage wie beim Abkippplatz
      am Mischschrott.

      Gehört zu „Maschinen" in Abschnitt 1 (E-016), zusammen mit der Notiz zu
      Kranfarben und -typen: Welchen Aufbau ein Händler fährt, ist ebenfalls
      eine Eigenschaft des Kunden.

## Was als Nächstes ansteht (Stand 15.09.2026)

Geordnet nach Reihenfolge, nicht nach Größe. Wer hier weiterarbeitet — auch eine
spätere Sitzung — fängt oben an. Die Abschnitte folgen E-016: erst die Welt,
dann der Kreislauf, dann die App.

**Live, Stand 15.09.2026:** 534 Tests in 49 Dateien grün. Fahrpedale unten links
(E-017), Bildinterpolation gegen das Ruckeln, die fünf Baufehler (E-018 … E-021),
Seitenabladung (E-022 … E-024), Baggerkonzept als Zeichnung (E-025), Hallen und
Silos umgezogen samt Tor-Fehler (E-026), Greifanzeige aus der Bildmitte (E-027).
Alle Zeichnungen liegen unter `/v1/plaene/` und sind auf dem Telefon aufrufbar.

**In Arbeit, nichts davon oben:**
- **Platz:** eine Buntmetallmulde als Puffer statt dreier Sortiermulden · Silos
  neben die Hallen und ums Eck über die Südseite · Janine ans Tor zu den
  Warteplätzen · Kipper auf die Seitenabladung (E-028)
- **Bagger:** Zylinder, Drehkranz, Ausleger; danach Fahrer, Unterwagen, Oberwagen,
  Kabine; der Kabinenhub zuletzt und allein (E-029 ff., nach E-025)

### Abschnitt 1 — die Welt

1. ~~**Presse als offener Behälter statt Vollklotz.**~~ **ERLEDIGT 15.09.2026
   (E-029).** Sie stand als volles Rechteck in der Hindernisliste, 2,2 m hoch
   über die ganze Kammer — der Greifer kam nicht auf den Kammerboden, das
   fertige Paket lag unerreichbar darin (Befund Patrick: „Es war auch nicht
   möglich, ein zusammengepresstes Auto wieder aus der Presse zu holen").
   Jetzt ein Wandring aus `pressWaende()`, derselben Quelle wie die
   Rapier-Kollider. Lichte Kammer 4,05 × 4,20 m, Tastfenster der Spinne innen
   3,55 × 3,70 m, das Paket liegt 7,40 bis 9,15 m vom Sitz (Boden erreichbar
   von 3,0 bis 9,5 m). Für Fahrzeuge bleibt sie zu. `test/presse.test.ts`.
   **Bleibt offen:** Während die Deckelklappe geschlossen ist, hält die
   Hindernisliste den Greifer nicht mehr davon ab, in die Kammer zu greifen —
   die Klappe ist ein kinematischer Körper und steht in keiner Liste. Physisch
   stoßen die Krallen an sie; die Warnlogik sieht sie nicht.
2. **Pressengröße festlegen.** 4,20 × 4,05 m ist gebaut, harte Grenze 3,98 m
   (offene Spinne + 30 cm je Seite), alt waren 5,95. Alles dazwischen ist eine
   Zeile in `press.ts`. Am Bild zu entscheiden:
   `docs/messungen/2026-09-14_presse.svg`.
3. ~~**VA hat am Bagger kein Ziel.**~~ **ERLEDIGT** (E-028: Edelstahl liegt in
   „BUNT + VA"). Dasselbe galt für **Batterien** und ist mit E-029 erledigt:
   Patrick hat entschieden, sie in dieselbe Mulde zu legen, statt eine eigene
   Batteriemulde zu bauen. Das Lagersilo bleibt getrennt. **Offen bleibt der
   Preis dieser Entscheidung:** Das Schild warnt nicht mehr vor Blei. Geht ein
   Akku in derselben Fuhre mit, kostet er 155,00 € je 100 kg
   (`test/blei.test.ts`). Ob die Aufschrift „BUNT + VA" das Gefahrgut nennen
   soll, ist Patricks Entscheidung.
4. **Metallmulden zum Bagger hin niedrig schließen** — ein bis zwei Lagen, bei
   abgesenkter Kabine noch zu sehen.
5. **Pyramidenform auch an den Mulden?** Zwischen den Halden ist sie gebaut
   (Lagen 1·2·4·4·2·1), an den Mulden nicht. Am Bild zu entscheiden:
   `docs/messungen/2026-09-14_pyramiden.svg`.
6. **Firmenschild 8 × 4 statt 14 × 7?** Kleiner, dafür zu 100 % frei im Bild.
   Größer geht nur in der Nordostecke, und dann müssen drei Bäume weichen.
7. **Elektromotoren fehlen als Fraktion.** Das Silo ist mit E-026 entfallen, die
   Fraktion gibt es weiter nicht. Offen: Preis, Form, Herkunft, und ob
   Verbrennungs- und Elektromotor dasselbe Silo teilen.
8. **Der Starthaufen schläft nicht zuverlässig ein** — einer von vier Läufen.
   Kein Rückschritt. Eigenes Paket: Haufen erst fallen lassen, Wracks setzen,
   wenn er ruht.
9. **Federnde LKW beim Abladen**, Wrackzustände (fehlende Türen, Reifen,
   ausgeschlachteter Motor), Motorräder und Velos, Kranfarben und -typen,
   Bordwände und Türen — die Notizen weiter oben in dieser Datei.
10. ~~**Greifer:** Traverse Ø 0,70 → Ø 1,10, ja oder nein?~~ **Entschieden am
    15.09.2026 am Blatt `docs/f5-traverse-2026-09-15.svg`: Variante B, Ø 0,95**
    (E-039). Gebaut und gemessen: Zylinderneigung 38,9° → 24,4°, Hebelarm an
    der schwächsten Stelle 0,092 → 0,118 m (+28 % Schließkraft), Nettokorb
    1.524 → 1.529 l. Das 20°-Ziel aus E-009 bleibt verfehlt — dafür hätte es
    Ø 1,10 gebraucht. **Offen geblieben** ist, wie Traverse und
    Drehwerksgehäuse ineinandergreifen, seit die Traverse 10 cm höher sitzt
    (−0,96 → −0,865): gezeichnet, nicht konstruiert.

### Abschnitt 2 — der Kreislauf

11. **Die Zahlen stimmen.** Container-Schild rechnet Reinheit², ausgezahlt wird
    Reinheit³ — bei 76 % Reinheit 24 % weniger als angeschrieben. Die
    Sortierprämie steht im Code und wird nirgends benutzt. Abfall wird zum
    Pauschalpreis angekauft und mit negativem Preis verkauft.
12. **Der Kipper kippt sauber.** Der Schlitz am Kipplager ist die Ursache: Ein
    eingeklemmtes Teil wird vom Löser mit einem einzigen sehr großen Stoß
    befreit. Neu gemessen am 15.09.2026 über **sechzehn** Ladungen statt einer
    (E-029) — der alte Wächter prüfte *einen* Zufallsstartwert und war grün,
    weil er einen ruhigen Wurf erwischt hatte:

    | Rückweg zum Halt | Mittel | Höchstwert | über 130 km/h |
    |---|---|---|---|
    | 13,0 m | 154 | 424 km/h | 8 von 16 |
    | 9,5 m | 146 | 298 km/h | 7 von 16 |
    | **5,5 m (gebaut)** | **109** | **255 km/h** | **3 von 16** |
    | alte Kipperspur | 117 | 305 km/h | 6 von 16 |

    Während des Rückwärtssetzens ist die Fuhre verriegelt; je länger der Weg,
    desto tiefer arbeiten sich Stücke in den Schlitz. Der Rangierpunkt steht
    deshalb auf z −17,5. Der Katapult selbst ist damit **nicht behoben**, nur
    nicht mehr gefüttert. Dazu weiter offen: Heckklappe und Aufgeben-Regel.

    **Neu gemessen am 15.09.2026 (E-062), mit einem Gerät statt zweien.** Die
    Tabelle darüber stammt aus einer Zeit, in der zwei Messgeräte sich über
    denselben Vorgang um den Faktor zwei widersprachen; die Ursache war eine
    erfundene Fuhre, nicht das Verfahren. Drei Punkte sind damit erledigt oder
    anders zu sehen:

    - Dass der Wächter **andere Solver-Einstellungen** misst als das Spiel,
      stand hier als Verdacht. Nachgemessen ändert das die Bahn, nicht die
      Höhe (Mittel 147 → 138, Höchst 328 → 358 über dieselben acht Saaten).
      Kein Blocker, aber weiter eine Abschrift: `tools/kipper-messreihe.ts`
      kann die Werte aus `PhysicsWorld` setzen, der Wächter tut es nicht.
    - **Die Bodendicke ist ein echter Hebel.** Der Muldenboden-Kollider ist
      0,60 m dick (`vehicles.ts`, Oberkante +0,04). Mit 0,16 m, gleicher
      Oberkante und gleicher Ladung Stück für Stück: Mittel 149 → 94, Höchst
      463 → 226, paarweise −55 ± 19 km/h, besser in 18 von 24 Ladungen.
      **Warum** ein dickerer Quader schlechter ist, ist nicht verstanden — der
      Rahmen darunter endet 4 cm unter dem Muldenboden, da wäre Platz. Vor
      einer Änderung gehört die Ursache gefunden, nicht die Zahl kopiert.
    - **Der Wächter misst eine mildere Fuhre als das Spiel.**
      `test/kipper.test.ts` fährt 5.000 kg bei Füllgrad 0,60. Der Händler des
      Spiels kommt im Mittel mit 0,74 und 6.229 kg, und derselbe Apparat misst
      damit Mittel 159 / Höchst **585** km/h — über der Schranke von 500, die
      der Wächter hält. Er hält also einen Rückschritt an einer festen Fuhre
      fest und sagt **nicht**, dass im Spiel nichts fliegt. Ob er umgestellt
      wird (und die Schranken damit auf einen schlechteren, aber wahren Stand),
      gehört in dieses Paket.

    Patrick hat am 15.09.2026 entschieden, dass der Kipper **weiter kippt**
    (statt seitlich leergegriffen zu werden) — das Kippen ist der einzige Weg,
    auf dem Material ohne Spielerarbeit auf den Platz kommt.

    **ERLEDIGT AM 15.09.2026 ABENDS (E-071).** Alles darüber ist Geschichte und
    bleibt nur als Lehrstück stehen. Der Fehler war weder die Bodendicke noch
    der Schlitz am Kipplager: **Die ganze Fuhre fiel beim Kippen durch die
    Brücke hindurch** — im freien Fall, Bild für Bild genau 9,81 m/s², durch
    einen 0,60 m dicken, eingeschalteten Kollider. Rapier verlor die Paarung
    zwischen Muldenkollider und Ladung, weil sie entstanden war, während beide
    Körper kinematisch waren (die Fuhre fährt an der Mulde verriegelt mit). Was
    auf dem Weg nach unten wieder gefasst wurde, drückte der Löser mit einem
    einzigen Stoß heraus — gemessen 65,7 m/s. Der „Katapult" war die
    Entdurchdringung, nicht das Kippen.

    Die Energierechnung, die das vorher hätte zeigen können: Die Kippbewegung
    kann einem Stück höchstens 12,4 m/s (45 km/h, 60 J/kg) mitgeben. Gemessen
    waren 585 km/h — 13.200 J/kg, Faktor 220.

    Reparatur: zehn Zeilen (`vehicles.meldeMuldeNeuAn`, beim Freigeben der
    Ladung). Gewürfelte Händlerfuhre, 24 Saaten: Mittel 147 → **29** km/h,
    Median 123 → **19**, Höchst 430 → **106**, Durchfall 86 % → **0 %**,
    weitestes Stück 27,0 → **5,8 m**. Der Wächter fährt jetzt die gewürfelte
    Fuhre und prüft vier Eigenschaften mit je einer Gegenprobe.

    Offen bleibt aus diesem Paket: **31 % der Fuhre bleiben auf der Brücke
    liegen.** Reibung 2,2 gegen tan 58° = 1,60 — eine ruhende Fuhre rutscht auf
    dieser Neigung rechnerisch gar nicht. Steiler kippen (über 65,6°) oder
    weniger Reibung; beides ist eine Gestaltungsfrage.

12b. **Der LKW knickt seine Ausrichtung, statt zu lenken — und wirft dabei
    liegenden Schrott über den Platz.** Gemessen 15.09.2026 (E-071), Befund
    Patrick: „beim Kippen sind Teile ganz woanders gelandet."

    `placeAt` setzt `group.rotation.y` hart auf die Richtung des
    Streckenabschnitts. Am Wechsel `shiftPause` → `reverseIn` sind das
    **168,7° in EINEM Rechenschritt**, an jeder Ecke der Fahrstrecke 45–65°.
    Ein an die Mulde verriegeltes Stück in 3 m Abstand legt dabei rund 6 m in
    einem Bild zurück; Rapier leitet daraus über 1.000 km/h ab. Ist der Weg
    frei, bleibt es folgenlos — liegt schon etwas da, wird es getroffen:

    | zweiter Kipper über die Fuhre des ersten, 12 Saaten | |
    |---|---|
    | Höchsttempo an schon liegendem Schrott | **6.596 km/h** |
    | weiteste Verschiebung eines ruhenden Stücks | **9,3 m** |
    | Spitze fällt in | `reverseIn` 7/12, `settleCargo` 5/12 |

    Zu tun: Der Wagen muss in die neue Richtung **einlenken** statt zu
    springen — beim Rangieren während der halben Sekunde `shiftPause`, an den
    Ecken mit einer Grenze für die Drehrate. Das ändert, wie das Fahren
    aussieht, und gehört deshalb Patrick vorgelegt. Der Anteil aus
    `settleCargo` ist noch nicht eingegrenzt.
13. **Die Hallen sind leer.** Es gibt keine Route hinein, keine Funk-Einweisung,
    keine Kapazität. Baulich steht alles: Tore zeigen auf den Platz, die Luftlinie
    von der Waage ist frei. Was fehlt, ist der Ablauf aus E-011 — Händler fährt
    hinein und lädt selbst ab, Lambert räumt die Halle ins Silo.
14. **Sortieren aus der Buntmetallmulde ins Silo.** Folgt aus E-028: Die Mulde ist
    Puffer, getrennt wird danach — vom Spieler oder von Lambert. Ob Lambert das
    heute kann, ist offen.
15. **Lambert auf die Schiene.** Mit Hallen links und Silos rechts fährt er quer
    über den Platz, aber nur nördlich von z −9,0 — die Zusage aus E-011 gilt der
    Sache nach, nicht mehr als Randspur. Neu zu bewerten.
16. **Der Tag hat ein Ende** — Bilanz, Pacht, Tagesziel. Und `ALLES_FREI = false`,
    damit Geld einen Zweck bekommt.

### Abschnitt 3 — die Verpackung

17. **Android als Probelauf** (geht ohne Mac und ohne Entwicklerkonto), dann iOS.
    Stand und Hindernisse in E-015. Capacitor macht das Spiel **nicht** schneller
    — dieselbe Engine.
18. **Die 14,6 ms je Bild**, die weder Physik noch Grafik sind. Frame 21,0 ms
    gegen 6,4 ms gemessene Arbeit. Das F3-Overlay zeigt die Zahl seit E-0xx als
    `Rest`; **sie ist noch nicht auf dem Gerät abgelesen worden.** Verdächtige in
    der Reihenfolge des erwarteten Gewinns: sechs Scheinwerfer rund um die Uhr im
    Shader · Auflösung `devicePixelRatio` 2 (5,6 Mio. Bildpunkte je Bild) ·
    Schatten 2048² mit der teuersten Filterstufe.

### Kleinkram, jederzeit nebenbei

- **Griff-Info im Querformat steht auf 12 px**, das Briefing verlangt ≥ 14.
  Auf 14 zu gehen kostet quer rund 40 px Bildhöhe (E-027).
- **Konto und Tagesablauf überlappen sich um 6 px** — `#money` ist wegen
  Zeilenabstand 1,5 tatsächlich 40,5 px hoch, `#shift` beginnt bei 46 (E-027).
- **Sichere Ränder** (Notch, Home-Indicator) werden nirgends berücksichtigt,
  obwohl `viewport-fit=cover` gesetzt ist. Gehört für alle unteren Elemente
  gemeinsam gelöst, nicht für eines allein (E-027).
- **Vier CPU-Kleinigkeiten sind erledigt** (HUD schreibt nur bei Änderung,
  Körperzählung nur bei offenem Overlay, Ladung viermal je Sekunde).

## Aus Patricks Gerätetests — laufend nachgehalten (ab 15.09.2026)

Angelegt, nachdem ein Befund von ihm verlorenging: Er hatte in einer Skizze die
Mittelsäule des Greifers durchgekreuzt und *danach* über den Zahn gesprochen;
gebaut wurde nur der Zahn. Seine Ansage: „es wäre schon gut, wenn wir nicht
einfach Punkte fallen lassen."

Regel: Jede seiner Meldungen kommt hier hinein, bevor irgendein Agent losläuft.
Ein Satz von ihm enthält oft mehrere Punkte — jeder bekommt eine eigene Zeile.
Abgehakt wird erst, wenn **er** es am Gerät bestätigt hat, nicht wenn es live ist.

### Offen

- [ ] **Gerätebefund 21.10.2026, Lehrgang** — Patrick, wörtlich: „also grundsätzlich
      sollte es mit kaum oder keinen text auskommen, weil der text die ganze sicht
      verdeckt, auch sollte irgendwie gehighlighten sein, wenn eine aktion
      erfolgrecih war. Grundlegende Lehrgang steuerung in einem abhandeln.
      Prüfungen anschliessend. sollte auch geskippt werden können."

      | # | Punkt |
      |---|---|
      | 39a | Kaum oder kein Text — Text verdeckt die Sicht |
      | 39b | Erfolgreiche Aktion sichtbar hervorheben |
      | 39c | Grundlegende Steuerung in einem einzigen Durchgang |
      | 39d | Prüfungen direkt anschließend |
      | 39e | Lehrgang überspringbar |

      Antwort: **„Alles in einem Durchgang"** — ein einziger Lehrgang mit allen
      Funktionen (Grundsteuerung und Stützen, Presse, Magnet, Zerlegen, Abholer …),
      danach die Prüfungen.

- [ ] **Vorschläge 21.10.2026: Intro und Spielprinzip** — Patrick (Sprachnachricht,
      sinngemäß wörtlich): ausführliches Intro zu allen Funktionen (Perspektivwechsel,
      Stützen, Pressen und was sonst verfügbar ist) mit Erklärung, gern mit
      Beispielvideo vorweg; so sollen die ersten Challenges aufgebaut sein. Kein
      reines Sandkastenspiel mehr: sehr viele Fuhren, viel Schrott umschlagen,
      Schnelligkeit und Präzision, Sortierskills; fast alles kommt als Mischschrott,
      sortenreine Lieferungen weiter zu den einzelnen Mulden (dort hinfahren);
      Stahl und Buntmetalle aus dem Misch herausfischen; zeitkritisch wieder
      verladen; offen, ob der Verlade-LKW gerufen werden muss oder von selbst
      kommt; Kasse gern wieder einbauen, aber Handelskonzept außen vor — nur Baggern.
      Bitte Platzgestaltung mit überarbeiten und mehr Vorschläge machen.

      | # | Punkt |
      |---|---|
      | 37a | Ausführliches Intro zu allen Funktionen, mit Erklärung |
      | 37b | Vorab-Beispielvideo je Funktion, wenn möglich |
      | 37c | Erste Challenges nach diesem Intro aufbauen |
      | 38a | Kein reines Sandkasten-Spiel: viele Fuhren, viel umschlagen |
      | 38b | Schnelligkeit, Präzision, Sortierskills zählen |
      | 38c | Fast alles kommt als Mischschrott, sortenreine weiter zu den Mulden |
      | 38d | Stahl/Buntmetalle aus dem Misch fischen, zeitkritisch verladen |
      | 38e | Verlade-LKW: rufen oder kommt von selbst? |
      | 38f | Kasse ja, Handelskonzept nein |
      | 38g | Platzgestaltung dazu überarbeiten, weitere Vorschläge |

      Antworten 21.10. (nach Vorschlag): Lehrgang mit 10–12 Lektionen, Vorführung
      im Spiel (Bagger macht es vor, Geisterdaumen) statt Videos; die 6 Aufgaben
      werden Prüfungen danach. Schichtbetrieb: Verlade-LKW (Misch-Abroller) steht
      fast immer bereit, für Sortiertes kommt er bei voller Mulde, Hupe schickt
      früher weg; Kasse mit festen Preisen je Sorte, Abzug für Standgeld,
      Fehlwürfe, Schäden; kein Verhandeln. Store-Start **Ende November** mit allem.
      Schicht-Konzept (v1/docs/schicht-konzept.md), Antworten: Platz **A „Kreis in
      der Ecke"**; sortenreine Fuhren **selten, du fährst hin** (Pritsche wartet am
      Lager, Standgeld läuft); Geld für Sortiertes **wenn es vom Hof fährt** (Rest
      in den Boxen 70 %); Fuhren **wie heute ca. 8 t**; Stufen nacheinander
      freischalten (Empfehlung übernommen).

- [ ] **Ansage 21.10.2026** — Patrick, wörtlich: „High Score Board Konzept und pay
      to win Konzept vorschlagen". Antworten nach Vorschlag: Bestenliste in 1.0
      „eigene auf dem Gerät" (Top 5 je Aufgabe + Sandkasten-Rekorde), Game Center
      mit 1.1; Geld nach dem Kaufpreis „Erweiterungen + Aussehen, kein Pay-to-Win"
      (ab 1.1: Maschinen, Plätze, Aufgabenpakete, Lackierungen).

- [ ] **Ansage 21.10.2026, Müll und Fahrwege** — Patrick, wörtlich: „Die müllmulde
      die vor dem Bagger steht kann raus" und auf Nachfrage: „Der blaue initiale
      Müllcontainer kommt weg, der neue wird vor die, Bagger abgestellt.
      Fahrspuren müssen frei bleiben, der Zulieferer bleibt stecken an der Waage.
      Sortenreine lkws fahren zur entsprechenden Mulde, muss Platz für Bagger
      bleiben und gute Erreichbarkeit. Gilt auch für alle abholplätze"

      | # | Punkt |
      |---|---|
      | 36a | Der blaue Müllcontainer vom Start kommt weg |
      | 36b | Der neue Müllcontainer (vom Abroller) wird vor dem Bagger abgestellt |
      | 36c | Fahrspuren bleiben frei |
      | 36d | Fehler: Zulieferer bleibt an der Waage stecken |
      | 36e | Sortenreine LKW fahren zur passenden Mulde |
      | 36f | Platz für den Bagger und gute Erreichbarkeit — auch an allen Abholplätzen |

      Antworten nach E-192 (21.10.): Müll — „der alte müllcontainer weg. der lkw
      bringt die neue mulde selbständig und wird abgeholt, sobald ich die abholung
      beantrage" (also: beim Start bringt der Abroller den leeren von selbst, ohne
      Bestellung). Silos: Kipper wartet am Tor. Waage — kein „Platz voll", sondern:
      „er drehte direkt nach der waage und blieb bei einem anderen lkw stecken"
      (Fahrzeug-gegen-Fahrzeug nach der Waage).

- [ ] **Ansage 21.10.2026** — Patrick, wörtlich: „Bagger bekommt auch Hupe für
      Abfahrt, Schere wird Presse heißen. Maschendraht verschwindet."

      | # | Punkt |
      |---|---|
      | 35a | Bagger bekommt eine Hupe — Signal zur Abfahrt für den wartenden Laster |
      | 35b | „Schere" heißt überall „Presse" |
      | 35c | Maschendraht(zaun) verschwindet |

      Antworten: gemeint ist der **Maschendraht-Besen** (grüne Rolle, 15.09.) samt
      Maschendraht-Ballen; die Zaunfelder bleiben. Hupe: **Hupen = Laster darf abfahren**.

- [ ] **Ansage 21.10.2026, Müll** — Patrick, wörtlich: „Der Müllcontainer soll ein
      abholcontainer werden der raufgezogen wird."
      Antworten: „Voll weg, leer zurück" (erst leeren abstellen, dann vollen
      hochziehen); kleiner Abroller ca. 10 m³, Platz vor dem Bagger an der Bunt-Box.

- [ ] **Antwort 21.10.2026 zu E-188** — Unter Überlast „langsam schleppen" (10 %),
      nicht ganz stehen bleiben. Gebaut so, live b0978ff.

- [ ] **Korrektur 20.10.2026, Mauern** — Patrick, wörtlich: „die wände waren
      anders gemeint, die ausbuchtungen sollen weiterhin da sein allerdings
      sollen jeweils die aussenwände der ausbuchtung etwas angeschrägt sein,
      sodass man beim schwenken nicht immer anschlägt" (betrifft E-182)

      | # | Punkt |
      |---|---|
      | 24c | Ausbuchtungen bleiben wie vorher (E-182 zurücknehmen, soweit es sie verändert) |
      | 24d | Außenwände jeder Ausbuchtung leicht angeschrägt, damit man beim Schwenken nicht anschlägt |

      Antworten 20.10.: „Alles wie vorher + angeschrägt" (Ausbuchtungen in
      alter Größe, E-182 zurück, Außenwände angeschrägt; MÜLL-Platz E-183 bleibt).
      Aufgaben: Karte klappt auf kleinen Bildschirmen zusammen; Späne in der
      Magnet-Aufgabe gehören in die Mischhalde; Hämmern soll auch knautschen.

- [ ] **Ansage 20.10.2026, Sorten und Abholer-Bestellung** — Patrick, wörtlich:
      „muldencontainer sind eher stahlschrott. Auch fehlt es an der balance
      zwischen misch und stahlschrott. Mischschrott ist häufiger.
      Reifenstapel gibt es nicht mehr, nur einzel reifen. es können abholer für
      jede sorte und auch für müll bestellt werden. Inklusive m hoch drei
      angabe, also manchmal einfach ein absetzkipper, und manchmal ein grosser
      container"

      | # | Punkt |
      |---|---|
      | 32a | Muldencontainer (Absetzmulden als Schrott) sind Stahlschrott |
      | 32b | Mischschrott häufiger als Stahlschrott (Balance) |
      | 32c | Keine Reifenstapel mehr, nur Einzelreifen |
      | 33a | Abholer bestellbar für jede Sorte und für Müll |
      | 33b | Mit m³-Angabe: mal Absetzkipper, mal großer Container |

      Antworten 20.10. (nach Bildern): schräge Mauer Variante A (14°) bleibt;
      Quermauer 2,4 m bleibt; **Rad mit Felge zählt als Reifen** (Ausnahme zur
      95-%-Regel, gilt für lose Räder und Räder vom Wrack); Motorhaube bleibt
      Mischschrott; Abholer kommt nur auf ABHOLEN, nicht von selbst.

- [ ] **Ansage 20.10.2026, Anlieferung und Abholer** — Patrick, wörtlich:
      „Anlieferung sortenrein direkt zu den metallboxen die dafür gedacht
      waren, faher hupen und fnkspruch aus dem Büro. Abholer kommt immer zum
      bagger und fährt hinterher, wenn ich den verladeplatz wechsle"

      | # | Punkt |
      |---|---|
      | 30a | Sortenreine Anlieferung fährt direkt zur passenden Metallbox |
      | 30b | Fahrer hupt (bei Ankunft) |
      | 30c | Funkspruch aus dem Büro |
      | 31a | Abholer kommt immer zum Bagger |
      | 31b | Abholer fährt hinterher, wenn der Bagger den Verladeplatz wechselt |

- [ ] **Aufgabenliste 20.10.2026** — Patrick, wörtlich: „Aufgaben:
      Nenn das SPiel wieder Rost&Reibach. Auch die Werbetafeln entsprechend
      umbennen. Auch weniger Werbetafeln. Den Platz und die Ausbuchtung am
      stahlschrott reruzieren, beim misschrott eine quermauer setzenm damit
      eine mauer grade, und eine mauer zur presse diagonal zur presse hingeht,
      und mit der aussenkante der presse abschliesst. Absetzcontainer sollten
      hebbar sein. LKWs sollten verladen werden können, eim abholer. Neues
      Zerstörungskonzept für autos und holkörper bauen, mehr spass am zerstören
      ist ziel. Reifen haben immer felge. Um motor/getribe zu entfernen, muss
      erst motorhaube entfernt werdne. Autos haben innenausstattung, Mulde für
      Müll steht direkt vor dem bagger an der wand zum buntmetall"

      | # | Punkt |
      |---|---|
      | 23a | Spiel heißt wieder „Rost&Reibach" |
      | 23b | Werbetafeln entsprechend umbenennen |
      | 23c | Weniger Werbetafeln |
      | 24a | Platz und Ausbuchtung am Stahlschrott verkleinern |
      | 24b | Mischschrott: Quermauer — eine Mauer gerade, eine diagonal zur Presse, schließt mit der Außenkante der Presse ab |
      | 25 | Absetzcontainer hebbar |
      | 26 | LKWs verladen können beim Abholer |
      | 27 | Neues Zerstörungskonzept für Autos und Hohlkörper — mehr Spaß am Zerstören |
      | 28a | Reifen haben immer eine Felge |
      | 28b | Motor/Getriebe erst nach Abnahme der Motorhaube entfernbar |
      | 28c | Autos haben Innenausstattung |
      | 29 | Müll-Mulde direkt vor dem Bagger an der Wand zum Buntmetall |

      Zerstörungskonzept (v1/docs/zerstoerung-konzept.md), Antworten 20.10.:
      Motor + Getriebe „als ein Block"; Haube „erster Biss springt auf, zweiter
      reißt ab"; ausgeweidete Karosse „bleibt Mischschrott"; Ruck „nur am Teil,
      Kamera ruhig". Vorgaben (Empfehlung): Innenausstattung in 1.0 sichtbar,
      herausholbar erst 1.1; Reifen überall mit Felge.

      Antworten 20.10.: Store-Name „Rost & Reibach" (Pripada GmbH als Anbieter);
      auf dem Platz wird ALLES Rost & Reibach (Mulden, Abholer, Waage, Halle);
      Verladen = Schrott mit dem Bagger auf den Abholer UND Wracks (LKW-Wrack,
      Autos) auf den Abholer; hebbar: „alle elemente die nicht fest verankert
      sind wie gebäude und mauern" + Mulde vom Absetzkipper.

- [ ] **Ziel 19.10.2026: App Store in vier Wochen** — Patrick, wörtlich:
      „Stelle dir vor du bist Profi Spiele publisher, Ziel ist es eine Version
      zu bekommen, die ap live in den app store zu bekommen. Wie würdest du das
      prüfen, wie evaluieren? Was fehlt um das Ziel in den nächsten vier Wochen
      zu erreichen?" Antworten: Apple-Konto GmbH „nein" (noch keins);
      Umfang „Aufgaben + Sandkasten"; Preis „Einmalpreis, Deutsch + Englisch";
      Start „Ja, alles parallel".

      | # | Punkt |
      |---|---|
      | 22a | Apple-Entwicklerkonto als Einzelperson beantragen (Patrick; seit E-194 keine D-U-N-S nötig) |
      | 22b | iOS-Build in der Cloud bis TestFlight |
      | 22c | Aufgaben (6–8 Challenges mit Sternen) zurück, erste als Einführung |
      | 22d | Leistung iPhone mini, offline, Speichern |
      | 22e | Store-Auftritt DE/EN, Datenschutz, Impressum, Altersfreigabe |
      | 22f | Einmalpreis: Paid Apps Agreement, Bank, Steuer (Patrick) |
      | 22g | TestFlight-Tests, fünf Erstspieler beobachten |

      Aufgaben-Konzept (v1/docs/aufgaben-konzept.md), Antworten 19.10.:
      Freischalten „nacheinander ab 1 Stern" (Sandkasten immer offen); erster
      Start „direkt Aufgabe 1"; Presse „Knopf PRESSEN auf der Karte"; Sterne
      „nur Sichtbares" (Zeit, Fehlwürfe, Abstand). Neustart: Empfehlung A
      (Knopf startet neu) als Vorgabe. → Bau E-162 ff.

      Store-Antworten 19.10.: Geschäftsführer „ja"; Preis 4,99 €; Name
      „Pripada Schrottplatz" (Untertitel Umschlagbagger-Simulator, EN Pripada
      Scrapyard / Material handler simulator, unter dem Icon „Schrottplatz");
      Englisch zum Start „ja, wenn bis 09.11. übersetzt"; Stummschalter →
      Spiel still (ambient); ab iOS 16; Datenschutz/Support auf GitHub Pages;
      Kontakt im Store: Büro-Festnetz + kontakt@pripada.de.
      Überholt 21.10. (E-194): „Pripada und gmbh raus, ich vertreibe es als
      Privatperson“ — Anbieter, Kontakt und Impressum jetzt Platzhalter
      [Vor- und Nachname], [Anschrift], [E-Mail], [Telefon]; Repo
      rost-und-reibach; Bundle-ID de.rostundreibach.app.
      Antworten 19.10. (Englisch, E-170): Schild „BUNT + VA" auf Englisch
      „NON-FERROUS + SS"; Hörprobe vor dem Einreichen raus (bleibt bis dahin).

- [ ] **Gerätebefund 18.10.2026, Klangqualität** — Patrick, wörtlich: „Also
      das anschlagen klingt jetzt, nur sind die Geräusche manchmal wenig
      realistisch. es klingt anders, wenn man gegen beton schlägt vs metal auf
      metall. Auch die Metallarten klingen oft nicht realistisch und kindlich
      manchmal. Aluminium klingt natürlich leicht aber eben nicht wie fallende
      kleine eisen. Autos falle lassen, dass muss wie blech klingen und nicht
      wie eine Coladose, die zerdrückt wird. Auch gibt es einen Ton beim
      pressen (Schere) was eher wie ein lallender betrunkener klingt. Drum gibt
      es noch ein paar Schwachstellen bei der SOund kullise aber auch viele
      gute Elemente."

      | # | Punkt |
      |---|---|
      | 21a | Anschlag klingt jetzt (bestätigt) |
      | 21b | Beton und Metall-auf-Metall müssen klar verschieden klingen |
      | 21c | Metallarten klingen oft unecht, teils kindlich |
      | 21d | Aluminium: leicht, aber nicht wie fallende kleine Eisenteile |
      | 21e | Auto fallen lassen: Blech, nicht zerdrückte Coladose |
      | 21f | Ton beim Pressen (Schere) klingt wie ein lallender Betrunkener |
      | 21g | Viele gute Elemente — bleiben |

      Antworten 18.10.: „Alles auf einmal" (Hörparcours, Tonhöhe ±5 %, kein
      Gleiten beim Pressen, AAC, neue Aufnahmen — E-159). Eigene Aufnahmen auf
      einem Schrottplatz: „Nein". Freesound (CC0, Anmeldung nötig, Patrick lädt
      selbst): „Ja, alle sechs" — #587442, #587443, #378670, #167917, #530209,
      #532874. Alu noch ohne Kandidat.
      Nachtrag: Freesound-Anmeldung gerade nicht möglich → freigegeben und geladen
      (CC0, ohne Anmeldung): BigSoundBank #2358–#2360, #1774 (ton-roh/S),
      #0971, #1524 Autotüren (T); OpenGameArt „75 CC0 breaking/falling/hit"
      (U), „Wood and Metal Vol. 2" (V). Freesound bleibt für später.

- [ ] **Ansage 18.10.2026, Boden** — Patrick, wörtlich: „auch soll es nicht
      mehr möglich sien, das körper im boden versinken können, wie aktuell bei
      autos der fall" (E-158; bekannt aus E-145: die Wandsperre zählt den Boden
      nicht, ein gehaltenes Auto lässt sich in den Beton senken)

- [ ] **Ansage 18.10.2026, Anschlagen** — Patrick, wörtlich: „anschlagen soll
      immer geräusche erzeigen, also auto vor schere oder wand" (E-157)
      Nachtrag: „greifer vor lkw container wand" — Greifer gegen
      LKW-Bordwand und Containerwand klingt ebenfalls.

- [ ] **Gerätebefund 18.10.2026, Traglast** — Patrick, wörtlich: „also die
      leistungsgrenzen,dass scheint nicht so zu funktionieren, ein
      umschlagbagger sollte grundsätzlich mit mehreren Tonnen klarkommen".
      Antworten: „Große Schrottmaschine" (MHL 335/340-Klasse: nah ~10 t, bei
      8 m ~5–6 t mit Pratzen), Pratzen-Regel bleibt (ohne ein Drittel
      weniger). → E-156, dazu Prüfung, ob die Sperre falsch greift.

- [ ] **Ansage 18.10.2026** — Patrick, wörtlich: „sichelkralle aus spiel
      entfernen" (E-155)

- [ ] **Ansage 17.10.2026, Ton** — Patrick, wörtlich: „ton agent nochmal
      anschmeissen, möglichst nur realistische töne verwenden und so wenig wie
      möglich selbst komponierte die unrealistisch klingen und sich nicht mit
      den realtönen vertragen" (E-153)

      | # | Punkt |
      |---|---|
      | 20a | Möglichst nur echte Aufnahmen |
      | 20b | Selbst erzeugte Klänge, die unecht klingen und nicht zu den Aufnahmen passen, raus |

- [ ] **Gerätebefund 17.10.2026: schwere Großteile** — Patrick, wörtlich:
      „extrem schwere bzw. grosse objekte lassen sich oft nicht greifen oder
      verlangsamen den bager unnatürlich" (Stand live 16216bd, mit E-137)

      | # | Punkt |
      |---|---|
      | 19a | Extrem schwere/große Objekte lassen sich oft nicht greifen |
      | 19b | Sie verlangsamen den Bagger unnatürlich |

      Nachtrag Patrick (17.10.): „entweder kann ich mehr als 3,5 tonnen heben oder
      es sollten keine teile über 3,5 tonnen ankommen … hat eh was mit dem winkel
      zu tun und ein umschlagbagger kann definitiv mehr heben" → E-152
      Traglasttabelle nach Ausladung (Fuchs MHL 250 F, auf MHL-320-Klasse
      gestreckt), Überlastmeldung, Pflugbremse nur noch echt; live 33207b4.
      Antwort 18.10.: ohne Pratzen ein Drittel weniger (E-154, in Arbeit).

- [ ] **Gerätebefund 17.10.2026: verzinkt** — Patrick, wörtlich: „verzinkt ist
      kein buntmetall". Betroffen: Gerüstrahmen (Paket, verzinkt), Gerüstrohre
      verzinkt (Bund), Gerüstfeld, Verzinkte Gitterroste, Verzinkte
      Leitungsrinnen — alle standen als Zink (Buntmetall). Verzinkter Stahl ist
      Stahl; die eine Regel (E-042/E-138) entscheidet Stahl- oder Mischschrott.
      Echtes Zink (Dachrinne, Zinkblech, Fallrohr, Anoden) bleibt Zink.

- [ ] **Antworten 17.10.2026 zu Ton und Kabine** — Radio: „Aus beim Start".
      Hupe: „Echte Hupe holen". Feierabend: „Werkssirene oder Glocke".
      Hebelseiten: „Tauschen" (E-144). Freigegebene Downloads (CC0,
      BigSoundBank): Truck Horn #2721, Industrial Doorbell #1269, National
      alert signal end #3260 — geladen nach `ton-roh/J`, `K`, `L` (E-148).
      Kipper-Wächter „Brücke frei" rot (45 % bleiben liegen) — echter Fehler,
      Kipper soll rütteln wie der Absetzkipper (E-149).

- [ ] **Ansage 17.10.2026, Schilder und Lautstärke** — Patrick, wörtlich: „alles
      gut lesbar, aber nimm rent4ring und ledprofi raus. Mach nur pripada.de
      rein" (auf Nachfrage: glasklar-mg.de auch) und „lautstärke
      knfigurationen für bagger, metall und musik im menü"

      | # | Punkt |
      |---|---|
      | 17a | Rent4Ring raus (Nordmauer, Halle 3) |
      | 17b | led-profi.de raus (Ostmauer, Halle 2) |
      | 17c | glasklar-mg.de raus |
      | 17d | Überall nur Pripada.de |
      | 18a | Lautstärke Bagger im Menü einstellbar |
      | 18b | Lautstärke Metall im Menü einstellbar |
      | 18c | Lautstärke Musik im Menü einstellbar |

- [ ] **Gerätebefund 17.10.2026, Fahrer** — Patrick, wörtlich: „Ansonsten fällt
      mir noch ein, die arme des baggerfarers sind verformt. es sollen wie echte
      ände anmuten die die joysticks umschliessen."

      | # | Punkt |
      |---|---|
      | 15a | Arme des Baggerfahrers sind verformt |
      | 15b | Echte Hände, die die Joysticks umschließen |

- [ ] **Ansage 17.10.2026, Fahrzeuge, Absetzkipper, Späne, Magnet** — Patrick,
      wörtlich: „eine sache noch, lkws drehen sich unrealistisch um ihrne
      mittelpunkt. allerdings sollten die LKws und auch anhänger lenkende
      Achsen habenund die bewegeung aus der lenkbewegeung der achsen kommen.
      Wie bei echten fahrzeugen.Auch die Achse bei anhängern berücksichtigen.
      Auhc sollen LKWs mit kleinen absetzcontainern kommen. die durhc ketten
      gekippt oder eben nur abgesetzt werden, damit ich sie leer mache.
      Spähne ins spiel inegrieren und auch magnet als greifer"

      | # | Punkt |
      |---|---|
      | 11a | LKW drehen sich unrealistisch auf der Stelle um ihre Mitte |
      | 11b | LKW mit lenkenden Achsen, Bewegung entsteht aus dem Lenkeinschlag |
      | 11c | Anhänger: Achse mitrechnen, Anhänger läuft nach |
      | 12a | LKW kommen mit kleinen Absetzcontainern |
      | 12b | Container werden an Ketten gekippt oder nur abgesetzt |
      | 12c | Abgesetzte Container macht der Spieler leer |
      | 13 | Späne ins Spiel |
      | 14 | Magnet als Greifer |

      Seine Antworten (17.10.2026): Späne als **lose Haufen aus Knäueln**, im
      Absetzcontainer angeliefert; sie gelten als **Mischschrott** (keine eigene
      Mulde). Magnet **wie echt**: nur Eisen und Stahl, Kupfer, Aluminium und
      VA fallen ab. Gewechselt wird **im Pausenmenü** als dritter Greifer.

- [ ] **Gerätebefund 17.10.2026, zehn Punkte** — Patrick, wörtlich:
      „1. Baue eine möglichkeit ein, die perspektive zu wechseln oder die
      Kamera zu drehen, ohne zwischen den Ansichten switchen zu müssen.
      2. Die Fahrgastzelle sollten bei holkörper leer sien, sprich wenn die
      Glasscheiben splitern, soll es dahinter halt auch leerer raum sein.
      3. Manche grossteile können nicht oder nur sehr schwer gegriffen werden,
      auchverhällt sich der Kran ungewöhnlich, er steigt schrittweise nach oben
      ohne den ausleger korrigieren zu könnne. 4. Insgesamt sind die
      Klassifizierungen nicht immer eindeutig. Minibagger sind eher stahl als
      misschrott., weil viel stahlblech oder vollmaterial. 5. Geräuschekullisse
      von Pixabay hebt das spiel auf ein anderes level, anderseits sind
      kindliche klänge und tonketten zu hören. das pass tnciht ganz, eher mit
      echten klängen arbeiten. 6. die Schere muss etwas grösser werden. 7. für
      Müll soll es doch eine Mulde geben. 8. die Zacken bei dem greifer sind zu
      spitz. entweder aufweichen oder entfernen. 9. Hämmern und drücken soll
      und muss mit der Spinne möglich sein, entsprechend gehört das auch bei
      der Sound Kulisse dazu. Aktuell hört man nichts. Auch wirkt es, dass die
      spinne beim hämmern abbremst. Bremsen kann nur das material oder den
      boden die spinne. 10. Körper wie autos gehen durch Betonwände oder
      scherenwände. Das fhelt offensichtlich eine sperre oder wie du das nennen
      würdest"

      | # | Punkt |
      |---|---|
      | 1a | Perspektive wechseln ohne Umschalten zwischen Ansichten |
      | 1b | Kamera frei drehen können |
      | 2 | Fahrgastzelle hohl: hinter zersplitterter Scheibe leerer Raum |
      | 3a | Manche Großteile lassen sich nicht oder kaum greifen |
      | 3b | Kran steigt schrittweise nach oben, Ausleger nicht korrigierbar |
      | 4a | Klassifizierung nicht immer eindeutig |
      | 4b | Minibagger sind Stahl, nicht Mischschrott |
      | 5a | Pixabay-Aufnahme (Greifkran) ist sehr gut — so weiter |
      | 5b | Kindliche Klänge und Tonketten raus, echte Klänge statt dessen |
      | 6 | Schere etwas größer |
      | 7 | Eine Mulde für Müll |
      | 8 | Zacken am Greifer zu spitz — abrunden oder weg |
      | 9a | Hämmern mit der Spinne muss gehen |
      | 9b | Drücken mit der Spinne muss gehen |
      | 9c | Hämmern und Drücken müssen zu hören sein (heute still) |
      | 9d | Spinne bremst beim Hämmern ab — bremsen darf nur Material oder Boden |
      | 10 | Autos gehen durch Betonwände und Scherenwände |

- [ ] **Ansage 17.10.2026: voller Start, LKW-Wrack, Wohnwagen** — Patrick,
      wörtlich: „am anfang sollen auch mehr schrott schon da sein, die zwei
      autos, ein lkw wrack und ab und zu bringt jmd auch nen wohnwagen zum
      verschrotten"

      | # | Punkt |
      |---|---|
      | 1 | Am Anfang mehr Schrott auf dem Platz |
      | 2 | Die zwei Autos bleiben |
      | 3 | Ein LKW-Wrack steht von Anfang an da |
      | 4 | Ab und zu bringt jemand einen Wohnwagen zum Verschrotten |


- [ ] **Gerätebefund 17.10.2026: Krach, wenn gehaltener Schrott auf den Boden
      schlägt** — Patrick, wörtlich: „schrott krach auch wenn ich mit der
      spinne schrott auf den boden haue ohne loszulassen". Heute klingt nur
      der Aufprall loser Teile (`items.onAufprall` → `schrott:aufprall`,
      E-121); gegriffene Teile sind kinematisch und melden nichts — Paket Ton.


- [ ] **Ansage 17.10.2026, Schilder und Pripada-Marke** — Patrick, wörtlich:
      „Schilder ändern, Pripada prominent direkt an der waage und da wo
      gearbeitet wird. Ansonsten Schilder von Rent4ring, glasklar-mg.de,
      MecLight bzw. led.profi.de. Baue auch container auf dem schrottplatz
      mit ein, aber mit pripada drauf, abholer und eigene LKW sollen auch
      pripada Logo tragen" — dazu drei Bilder: Logo Rent4Ring, Logo
      led-profi.de, ein grüner Absetzcontainer mit Firmenlogo als Vorlage.

      | # | Punkt |
      |---|---|
      | 1 | Schilder ändern (die erfundenen Betriebe aus E-131 weichen) |
      | 2 | Pripada groß direkt an der Waage |
      | 3 | Pripada groß dort, wo gearbeitet wird |
      | 4 | Rent4Ring (Logo geliefert: `public/logos/rent4ring.webp`) |
      | 5 | glasklar-mg.de (kein Logo geliefert — vorerst Schrift) |
      | 6 | MecLight bzw. led-profi.de (Logo geliefert: `public/logos/led-profi.jpg`) |
      | 7 | Container auf dem Platz, mit Pripada drauf |
      | 8 | Abholer mit Pripada-Logo |
      | 9 | Eigene LKW mit Pripada-Logo |


- [ ] **Gerätebefund 16.10.2026: Dauerton beim Greifen** — Patrick,
      wörtlich: „Ansonsten fällt mir beim greifen ein durchgängiger ton auf,
      der sollte nie durchgängig sein wie in einem ufo oder spaceship wo der
      ton unendlich langgezogen wird". Gehört zum Summen-Befund vom selben Tag
      (E-121: `setGreifer` hält einen Ton, solange die Schließkraft hoch ist) —
      Paket Ton.


- [ ] **Ansage 16.10.2026: mehr schleudern** — Patrick, wörtlich: „ich will
      auch mehr schleudern können. Dafür muss die Winkelbegrenzung der Spinne
      raus und ich muss in der Lage sein, Teile zur Seite zu schleudern"

      | # | Punkt | Bezug |
      |---|---|---|
      | 1 | Winkelbegrenzung der Spinne raus | E-105 nahm `PENDEL_MAX`, E-115 die Rückstellfeder; gemessen schwingt das Pendel bis 24° — er spürt weiter eine Grenze |
      | 2 | Teile zur Seite schleudern können | E-115: Abwurf `v = v_Gelenk + ω × r`, Obergrenze aus der Maschine hergeleitet (10,45 m/s), gemessen 4,2–5,1 m/s |


- [ ] **Ansage 16.10.2026, drei Punkte** — Patrick, wörtlich: „Baue mehr
      Werbeschilder ein und mache anstelle von ROST&Reibach wieder Pripada.de
      rein. Es sollen mehr LKWs kommen am ANfang"

      | # | Punkt | Paket |
      |---|---|---|
      | 1 | Mehr Werbeschilder auf dem Platz | Platz und Marke |
      | 2 | Pripada.de statt Rust'n'Reibach (überall, wo der Name steht) | Platz und Marke |
      | 3 | Am Anfang mehr Laster | Platz und Marke |

      Dazu am selben Tag freigegeben: acht Aufnahmen (Kenney Impact Sounds,
      OpenGameArt 100 CC0 metal & wood, BigSoundBank #2148, #2147, #914,
      #1771/#1776/#0235, #0118/#0148/#0771, Pixabay „Grua recicladora")
      — Paket Ton.


- [ ] **Gerätebefund 16.10.2026, drei Punkte** — Patrick, wörtlich: „Die
      Geräuschkulisse muss viel viel besser werden, aktuell höre ich beim
      greifen eher ein summen, autos müssen holkörper werden. Und die
      Challenges sind noch nicht ausgereift, pausieren"

      | # | Punkt | Bezug |
      |---|---|---|
      | 1 | Geräuschkulisse insgesamt „viel viel besser" | E-121 hat nicht gereicht |
      | 2 | Beim Greifen hört er ein **Summen** | E-121: Schalenfahrt als „Öl-Singen", Druck als „Stöhnen" — beides Oszillatoren |
      | 3 | **Autos müssen Hohlkörper werden** — zum zweiten Mal gesagt | E-124/E-127 haben acht Kollider gebaut; das hat sein Bild offenbar nicht getroffen |
      | 4 | Challenges sind nicht ausgereift — **pausieren** | E-125 |


- [ ] **Elf Punkte aus einer Ansage, 06.10.2026** — Patrick, wörtlich:
      „Also, wir müssen uns um das Spiel als solches kümmern, geräusche beim
      greifen, schrott geräusche. Plätze für Mischschrott und Stahlschrott
      tauschen. Die Schrottsorten sollen mehr grossteile beinhalten,
      container, gerüste, kleine bagger. LKWs kommen automatisch. Kupfer, Va,
      Aluminium, misschrott und stahlschrott müssen als solches besser
      erkennbar sein. Autos müssen hole elemente werden, die man zerdrücken
      kann. Geäusche entscheidend. Kehr geräusch der Spinne überarbeiten. Mit
      Challenges soll das Spiel anfangen, damit die Steuerung klar wird. Wir
      starten bswp. mit dem verladen eines autos in die Presse"

      Zerlegt, damit keiner verlorengeht. Je Punkt das Paket, das ihn trägt:

      | # | Punkt | Paket |
      |---|---|---|
      | 1 | Geräusche beim Greifen | Ton |
      | 2 | Schrottgeräusche | Ton |
      | 3 | Geräusche sind entscheidend | Ton (Vorrang) |
      | 4 | Kehrgeräusch der Spinne überarbeiten | Ton |
      | 5 | Plätze Mischschrott/Stahlschrott tauschen | Platz und Verkehr |
      | 6 | LKWs kommen automatisch (kehrt E-118 im Sandkasten um) | Platz und Verkehr |
      | 7 | Mehr Großteile: Container, Gerüste, kleine Bagger | Schrottteile |
      | 8 | Kupfer, VA, Alu, Misch, Stahl besser erkennbar | Schrottteile |
      | 9 | Autos als hohle Körper, die man zerdrücken kann | Wracks |
      | 10 | Das Spiel beginnt mit Challenges, damit die Steuerung klar wird | Challenges |
      | 11 | Erste Challenge: Auto in die Presse verladen | Challenges |

      Abgehakt wird jeder Punkt erst, wenn **er** ihn am Gerät bestätigt hat.


- [x] **„Kollisionsprüfung ohne Mauer bei Buntmetallmulde?"** (22.09.2026) —
      **gemessen und behoben (E-110).** Nachgemessen mit
      `tools/muldenwand-abgleich.ts`, Abschnitt A: Die Hindernisliste rechnete
      mit 0,35 m Wanddicke (`BAY_T`) auf der Muldenkante, gebaut sind 0,55 m
      (`MULDE_STEIN.dicke`) **vor** der Kante. Je Wand ergab das **0,35 m
      Sperre ohne Stein** nach innen in die Mulde und **0,20 m Stein ohne
      Sperre** nach außen — an allen sieben Mulden, nicht nur an dieser. An der
      Schwelle von `BUNT + VA`: gemeldet x −5,85 … −5,15, gebaut −5,50 … −4,95.
      Patricks Rechnung stimmte auf den Zentimeter. Behoben, indem
      `bayObstacles` die Wände jetzt aus `muldenWaendeWelt()` liest, also aus
      derselben Quelle wie Steine und Kollider. Gewinn: die lichte Weite jeder
      Mulde wächst um 0,70 m (5,30 → 6,00 m bei `BUNT + VA`), die Spinne kommt
      0,35 m je Flanke weiter hinein. Preis: Der MUELL-Container stand 4 cm in
      der wirklichen Wand und ist 10 cm nach Norden gerückt (z −14,04);
      **offen für Patrick:** In der Tasche neben der Mulde sind nur noch 0,12 m
      Luft zu verteilen, jetzt 0,06 m zu jeder Seite. Wer mehr will, muss den
      Container aus der Tasche nehmen.

- [x] **„die spinne bleibt über dem abgesenkten muldenwand stehen"**
      (22.09.2026) — **gemessen und behoben (E-110).** Gemessen wie
      `surfaceUnderClaws` es tut, mit einem Strahl von oben
      (`tools/muldenwand-abgleich.ts`, Abschnitt B): Der Kollider stand über
      der 1,00 m hohen Schwelle auf **3,00 m**. Ursache: Der
      Rückwand-Kollider entstand in `containers.ts` **ohne Bedingung**, während
      Steine und Hinderniseintrag unter `if (!cfg.shareEast)` hängen — und
      `BUNT + VA` ist die einzige Mulde mit `shareEast`. Jetzt entsteht je
      gebauter Wand genau ein Kollider, nachgemessen 1,00 m. Gegenprobe zur
      Nebenwirkung: Bei einer bis über die Schwelle gefüllten Mulde (160 Kisten,
      drei Saaten) gehen jetzt **1 bis 2 Stücke** über die Schwelle nach Osten,
      vorher 0 — über die offene Westseite gehen in beiden Fällen 17 bis 29.
      **Offen für Patrick:** Schwelle höher oder diesen Verlust in Kauf nehmen?

- [ ] **Die Öse des MUELL-Containers steckt in der Muldenwand** — gefunden beim
      Messen zu E-110, nicht von Patrick gemeldet, **nicht behoben.** Der
      Container ist als Hindernis und als Kollider 3,60 × 4,30 m, gebaut ist
      seine Hülle 3,74 × 4,77 m: Oberriegel und Rungen stehen 0,07 bis 0,10 m
      vor, die Haken-Öse an der Stirnseite 0,37 m. An seinem Startplatz ragt sie
      damit rund 0,30 m in die Nordflanke von `BUNT + VA` — sichtbar nur, wenn
      man genau hinsieht, und seit E-041 unverändert (die Steine haben sich
      nicht bewegt, nur die Karte hat dazugelernt). Physisch berührt nichts:
      Der Kollider ist der Kasten, nicht die Öse. Zuständig: `welt`, zusammen
      mit der Frage, ob der Container überhaupt in dieser Tasche bleiben soll.

- [ ] **Der Kipper streift beim Eindrehen in das VA-LAGER die Ecke der
      ALU-LAGER-Flanke** — sichtbar geworden mit E-110, **nicht behoben.**
      Gemessen 0,02 m Durchdringung an zwei Rechenschritten
      (`test/rangierknick.test.ts`, dort als benannter Streifer mit Datum
      eingetragen). Es ist kein neues Verhalten: Die Steine standen immer dort,
      nur die Hindernisliste führte die Flanke 0,20 m schmaler. Die Ecke ist in
      **beide** Richtungen dicht — die Gasse 0,30 m nach Süden gerückt macht
      diesen Streifer null und dafür 0,04 m in `BATTERIEN West`. Ein 8,60 m
      langer Wagen dreht sich dort in einer 6,75 m breiten Ecke. Zuständig:
      `welt`; es braucht eine eigene Messung über Gassenlage und Silo-Abstand,
      und der Abstand der Silos ist Patricks Platzanordnung.

- [x] **`test/lambertAufraeumen.test.ts` ist unzuverlässig** (beobachtet
      17.09.2026, beim Arbeiten an E-105) — **behoben E-109, 21.09.2026.**

      Nachgestellt: **3 von 40** Läufen der Datei rot (7,5 %), dazu 1 von 100
      Wiederholungen innerhalb eines Laufs. Es war **keine Zeitschranke**: Der
      Lauf hängt an gerechneten Schritten (dt = 1/60), an keiner Wanduhr, und
      er ist nach 22,1 s fertig bei 120 s Budget (`tools/lambert-streuung.ts`,
      60 Saaten, auf die Zehntelsekunde gleich).

      Es war die **fehlende Mulde**: `baueAbfall()` legte einen Boden an und
      sonst nichts, gezählt wurde in einem gedachten Rechteck mit 0,78 m
      Zuschlag. Lambert wirft aus 3,90 m Höhe ab, gestreut um ±0,60 m
      (`people.ts:1327`) — ohne Wände rutschte das Stück 0,85 m neben die
      Mulde hinaus. Jetzt steht der echte `ContainerManager` im Aufbau, gezählt
      wird im Grundriss (`bayHalb`), gefahren werden sechs feste Saaten.
      Nachher **30 von 30** grün.

- [ ] **Lambert wirft Abfall gelegentlich neben die Mulde** — gefunden in
      E-109, nicht von Patrick gemeldet, **nicht behoben.** Gemessen über 200
      Läufe mit echtem Zufall: In **1 von 200** springt ein abgeworfenes Stück
      über die offene Nordseite der Betonlego-Mulde wieder heraus und bleibt
      0,74 m davor liegen. Ursache ist die Abwurfhöhe `mulde.size[2] + 0,9` =
      3,90 m (`src/world/people.ts:1327`) samt ±0,60 m Streuung — das ist ein
      freier Fall von fast vier Metern auf einen Haufen. Zuständig: `welt`.
      Frage an Patrick: Stört es, wenn ab und zu ein Brett neben der Mulde
      liegt, oder gehört das zum Platz?

- [~] **Autos brauchen verschiedene Modelle, Farben und Wrackzustände** —
      Ansage Patrick, 17.09.2026: „und autos, brauchen wir verschiedene
      modelle, farben und wrackzustände, bitte notieren".

      **Farben sind gebaut** (E-105): sechzehn echte Autolacke, nach
      Häufigkeit gewichtet, ausgeblichen und rostig, fest am Standort
      (`composites.wrackLack`, `objektbau.AUTOLACK`/`verwittert`).
      Wächter `test/wracklack.test.ts` mit drei Gegenproben.

      **Modelle und Wrackzustände sind NICHT gebaut**, und zwar aus einem
      gemessenen Grund. `tools/wrackbild.ts`: Ein Wrack ist heute **25 Netze,
      1 440 Eckpunkte, 21 Geometrien, 12 Materialien** — mit Schattenwurf
      50 Zeichenrufe, zwei Wracks 100, das sind 7,6 % der gemessenen 1 322.
      Es ist also nicht ein verschmolzenes Netz je Material, wie E-025 es für
      den Bagger durchgesetzt hat. Dazu stecken die Karosseriemaße **im
      Code** (`composites.buildMeshes`: `BoxGeometry(1.7, 0.55, 4.0)` und
      `(1.5, 0.55, 2.0)`, dazu zwanzig feste Koordinaten in
      `baueAnbauteile`) und nicht in `CarDef` — Regel 3 ist nur halb erfüllt.

      **Reihenfolge, die sich daraus ergibt:**

      1. Die 13 Anbauteile (Stoßstangen, Grill, Leuchten, Radläufe, Spiegel)
         zu EINEM Netz mit Eckpunktfarben verschmelzen. Sie hängen alle im
         `crushGroup` und werden nie einzeln entfernt. 25 → 13 Netze.
      2. Die Karosseriemaße nach `CarDef` heben (Chassis, Kabine,
         Anbauteil-Anker als Anteile der Länge, nicht als feste Meter).
      3. Erst dann die fünf Modelle als reine Maßvarianten:
         Kleinwagen 1,60 × 3,60 m, Limousine 1,75 × 4,60 m,
         Kombi 1,78 × 4,80 m, Geländewagen 1,90 × 4,70 m (höher),
         Transporter 1,95 × 5,20 m (Kabine vorn statt mittig). // SW,
         Maße aus `KATALOG_HUGE` (Kleinwagen-, Kombi-, SUV-Karosserie,
         Transporter-Kastenwagen) — dort stehen sie schon.
         **Das ändert die Silhouette. Patrick entscheidet am Bild.**
      4. Wrackzustände als Datenfeld in `CarDef`: `raederAb`, `motorRaus`,
         `scheibenWeg`, `tuerenFehlen`, `ausgebrannt`. Jeder Zustand nimmt
         genau die `PartDef`s heraus, die er meint, und zieht deren Masse von
         `totalMassKg` ab — ein Auto ohne Motor wiegt 150 kg weniger und
         bringt 150 kg Alu weniger. **Vorher/nachher am Tagesverdienst
         messen** (`tools/grossteile.ts` kann die Rechnung).
         Ausgebrannt ist der Sonderfall: Lack weg (Ton aus
         `metallton("steel")`), Kunststoff- und Polsteranteil aus
         `hullZusammensetzung` heraus, dafür mehr Stahl.
- [x] **Kommen die Großteile beim Spieler überhaupt an?** — **gemessen und
      behoben (E-105, 17.09.2026).** Gefunden: `packeLadung` räumte für jedes
      Stück ein QUADRAT seiner Grundriss-Diagonale frei, obwohl das Teil
      achsparallel abgesetzt wird. 60 von 64 Schwergewichten passten damit auf
      keine einzige Ladefläche des Spiels; von 365 gezogenen kamen 7 an
      (1,9 %), also eines auf jede 137. Fuhre. Jetzt: wirkliches Rechteck,
      Vierteldrehung erlaubt, 17,9 % kommen an. **Bleibt offen:** 42
      Katalogeinträge scheitern weiter an der LADEHÖHE (Bordwand + 0,35 m);
      ob ein einzelnes Großteil höher liegen darf als Schüttgut, ist eine
      Gestaltungsfrage — Empfehlung im Log.


- [ ] **„LKWS fahren durch Müllcontainer"** (17.09.2026) — **gemessen, nicht
      repariert** (E-093). Gefunden: `toPark` und `parkRueck` in
      `src/delivery/vehicles.ts:2382`/`:2415` fahren eine **Luftlinie** vom
      Abladeplatz zum Warteplatz und gehen dabei an `advance()` und damit an
      jeder Hindernisprüfung vorbei. Die Linie zum Westwarteplatz (−26 | 6)
      schneidet den Container — **auch an seinem Startplatz**, ohne dass
      Patrick etwas versetzt. Tiefe **3,10 m**, das ist die ganze
      Fahrzeugbreite. Werkzeug: `npx vite-node tools/durchfahrt.ts`, Wächter:
      `test/durchfahrt.test.ts`.

      **Repariert 17.09.2026 (E-103), wartet auf sein Urteil am Gerät.** Weder
      hupen noch beiseiteschieben: Beide Phasen fahren jetzt über `advance()`
      auf einer echten Strecke (`routes.routeToPark()` / `routeParkRueck()`)
      und damit durch dieselbe Hindernisprüfung wie jede andere Etappe. Eine
      Sonderregel nur für den Weg zum Warteplatz wäre eine zweite Wahrheit
      gewesen. Gemessen **3,10 m → 0,00 m** in allen dreizehn Fahrproben.
- [ ] **„Objekte fahren durch einander hindurch"** (17.09.2026) — **gemessen,
      nicht repariert** (E-093). Es ist **kein fehlender Kollider**: Container
      und LKW haben welche, Rapier führt 32 Berührpunkte. Ein Fahrzeug ist
      kinematisch und wird von Rapier an **nichts** aufgehalten; dazu ist sein
      abgeleitetes Tempo in `toPark` 0,000 m/s statt 4,89 — es wird versetzt
      statt bewegt. Gleiches Paar betroffen: Fahrzeug gegen liegenden Schrott
      (400-kg-Brocken 1,22 m verschoben) und Fahrzeug gegen Fahrzeug (steht in
      keiner der beiden Abfragen der Fahrt).

      **Halb erledigt (E-103).** Fahrzeug gegen Container ist weg — nicht weil
      der Kollider jetzt greift, sondern weil die Fahrt wieder über die
      Streckenprüfung läuft. **Offen bleiben die anderen beiden Paare:**
      Fahrzeug gegen liegenden Schrott (400-kg-Brocken 1,22 m verschoben) und
      Fahrzeug gegen Fahrzeug — beide stehen in keiner der Abfragen, die eine
      Fahrt heute macht. *Wartet auf sein Urteil am Gerät, welches der drei er
      gesehen hat.*
- [ ] **LKW schleift beim Eindrehen durch die Ostwand** — 0,27 m gefahren,
      0,60 m über alle Gierlagen, am Abladeplatz. Nicht von ihm gemeldet, beim
      Nachmessen zu E-093 gefunden. Die Kehre auf der Stelle (E-081) ist weder
      Strecke noch Wegpunkt, `test/fahrumriss.test.ts` sieht diese Lagen nie.
      *Wartet auf sein Urteil: sichtbar oder nicht?*
- [ ] **Bagger-Unterwagen darf 1,30 m in den Müllcontainer** — `CHASSIS_PAD`
      1,30 m (`excavator/collision.ts:43`) gegen `UNTERWAGEN_R` 2,60 m
      (`excavator/excavator.ts:540`): zwei Zahlen für dieselbe Maschine. Nicht
      von ihm gemeldet, bei E-093 mitgefunden.

      **Behoben 21.09.2026 (E-107), wartet auf sein Urteil am Gerät.** Gemessen
      waren es 1,35 m in den Müllcontainer, 0,70 m in die Muldenstirn, 0,60 m
      in die Westmauer — und **beide** alten Zahlen waren falsch: Der gebaute
      Unterwagen misst am Netz 2,65 m Hüllkreis, 1,30 war quer 20 cm zu klein,
      2,60 war 6 cm zu groß. Der naheliegende Einzeiler
      (`CHASSIS_PAD = UNTERWAGEN_R`) wurde gebaut, gemessen und **verworfen**:
      Ein runder Radius um ein rechteckiges Fahrgestell lässt die Maschine bis
      0,76 m vor Wänden stehen und nimmt dem Müllcontainer jeden erlaubten
      Startplatz. Geprüft wird jetzt der wirkliche, mitgedrehte Grundriss aus
      EINER Quelle (`excavator/unterwagenParts.ts`). Eindringung 0 m, zu früh
      gebremst weiter 0,02 m, anfahrbare Fläche 2 147 → 2 076 m² (−3 %), kein
      Behälter außer Reichweite, Rechenzeit 0,003 → 0,012 ms je Bild.
      **Nebenwirkung, bewusst:** Der Müllcontainer steht morgens 17 cm weiter
      westlich — die Tasche aus den vier Schranken (E-041) war aus der falschen
      Zahl hergeleitet und musste mit.
- [ ] **Der gemeldete Container-Umriss ist flacher als der gebaute** — 1,00 m
      statt 1,175 m Oberkante (`world/containers.ts:1484`). Der Baggerarm
      schwenkt in den 17,5 cm dazwischen durch den Oberriegel hindurch. Bei
      E-093 mitgefunden.

      **Behoben 21.09.2026 (E-108), wartet auf sein Urteil am Gerät.** Alle drei
      Bauarten nachgemessen: Halden (2 Einträge) und Buchten (7) stimmten auf
      den Millimeter, falsch war allein der Absetzcontainer — und zwar um einen
      FESTEN Betrag, unabhängig von der Wandhöhe; ein 40er hätte dieselben
      17,5 cm. Jetzt rechnet `rolloffOberkante()` die Höhe, und der gebaute
      Riegel wie die Meldung lesen dieselbe Zeile. Nichts wird dadurch
      zugemacht: Lambert und die Fahrer prüfen im Grundriss, die Spinne wird an
      `pos.y − 1,20` geprüft und reicht 2,83 m tiefer.
- [ ] **Mittelsäule raus, Zacken direkt an die Traverse** — gemessen sitzen
      zwischen `TRAVERSE_Y` (−0,865) und `STEMPEL_AUGE.y` (−1,5335) **66,9 cm
      Säule**. In seiner Skizze durchgekreuzt, von mir übersehen.
      *Stand: wird skizziert, nicht gebaut — auf seinen Blick am Bild.*
- [ ] **Zahn hängt offen 12° nach innen** — der Preis von E-069. Stört das beim
      Einstechen in den Haufen? *Wartet auf sein Urteil am Gerät.*
- [ ] **Kran fährt durch die Ladefläche** — **gebaut, wartet auf sein Urteil am
      Gerät** (E-076). Gemessen mit `tools/fahrzeug-durchdringung.ts`: Bock
      12,0 cm im Muldenboden, Säule 25,5 cm in der Kabine, beim Kippen 12,0 cm
      Muldenboden durch die Säule, Ausleger 91 bis 182 cm IN der Fuhre. Ursache:
      `sockelZ = bedLen/2 + 0,05` in `vehicleModel.ts` — zwischen Mulde und
      Kabine lagen 11 cm, der Bock ist 70 cm tief. Jetzt kurzes Nahverkehrshaus
      (1,00 statt 1,50 m), Bock auf `+0,33`, Säule als Achtkant, Auslegerhöhe
      nach der Ladung, und der Kipper hebt erst, wenn der Kran ausgeschwenkt
      ist. Alle Paare frei, 29 cm Luft über der Fuhre; bewacht von
      `test/fahrzeugteile.test.ts`.
- [ ] **`test/kipper.test.ts` misst zu einem Fünftel den Zufall** — gefunden in
      E-076, nicht von ihm gemeldet. Jedes `THREE.Object3D` zieht beim Anlegen
      vier Zufallszahlen (`MathUtils.generateUUID`); ein Netz mehr oder weniger
      am LKW würfelt deshalb 24 andere Ladungen. Über 96 frische Saaten reisst
      eine zufällige Reihe von 24 die Schranken **in 21 % der Fälle** — auch
      beim alten Stand. Dabei sind alter und neuer Stand ununterscheidbar
      (Mittel 30 gegen 31, Median 22 gegen 21). Zu tun: entweder nach Mittel
      und Median urteilen (so steht es schon im Kommentar der Datei, der Code
      urteilt aber auch nach dem Höchstwert) oder mit mehr Saaten messen.
      Gehört zum Kipper-Paket, nicht zum Kran.

      **Erledigt E-109, 21.09.2026 — und die Antwort war „beides".** Gemessen
      mit `tools/kipper-streuung.ts` (144 frische Saaten, 20.000 Gruppen je
      Größe), Fehlalarmquote ohne jede Änderung am Spiel:

      | | 24 Saaten | 48 Saaten | 96 Saaten |
      |---|---|---|---|
      | Mittel ≥ 55 | 13,99 % | 7,00 % | 2,04 % |
      | Median ≥ 40 | 3,54 % | **0,36 %** | 0,00 % |
      | Höchst ≥ 280 | 28,89 % | 48,63 % | **73,91 %** |
      | Endabstand ≥ 12 m | 0,00 % | 0,00 % | 0,00 % |

      Beim **Höchstwert hilft Messen nicht** — er ist das Maximum einer
      langschwänzigen Verteilung und wächst mit jeder weiteren Saat. Er fliegt
      aus dem Urteil und wird nur noch berichtet; das **Mittel** ebenso (14 %
      Fehlalarm, und genau das war der Rotlauf vom 21.09., ausgelöst von
      E-108). Geurteilt wird nach dem **Median über 48 Saaten** sowie nach
      Durchfall, Liegenbleiben und Endabstand. Neue Gegenprobe: eine erfundene
      Reihe mit einem wegfliegenden Stück (585 km/h **und** 27 m Endabstand)
      wird weiter rot, ein reiner Tempo-Ausreisser ohne Ortswechsel nicht.

      Nebenbefund, behoben: Mit 48 Saaten rechnete der `beforeAll` 40 s am
      Stück und konnte dem Vitest-Berichterstatter nicht mehr antworten —
      `[vitest-worker]: Timeout calling "onTaskUpdate"` in 1 von 3 vollen
      Läufen, bei grünen Zusicherungen. `reiheMitLuft` holt jetzt alle vier
      Saaten Luft (`setTimeout(0)`).

- [ ] **`LIEGT_MAX` ist die nächste Zufallsschranke im Kipper-Wächter** —
      gefunden in E-109, **nicht behoben und absichtlich nicht hochgesetzt.**
      Über 144 frische Saaten liegt der Anteil der Fuhre, der am Ende noch auf
      der Brücke liegt, bei einem Median von **45,7 %** (p05 40,8 %, p99
      52,7 %); die Schranke steht bei 45 %. Über zufällige Sätze von 48 Saaten
      reisst sie in **59,4 %** der Fälle — der Wächter hält sie heute nur,
      weil sein Saatensatz mit 42 % günstig liegt.

      Ursache bekannt und unverändert: Reibung 2,2 gegen tan 58° = 1,60, eine
      ruhende Fuhre rutscht auf dieser Neigung rechnerisch nicht; seit E-106
      liegt sie mit 14,1 statt 11,0 Stücken dichter und kollert weniger nach.
      Das ist eine **Gestaltungsfrage für Patrick** — steilerer Kippwinkel,
      weniger Reibung oder ein Rüttler —, keine QA-Entscheidung. Zuständig:
      `welt`. *Auf dem Gerät zu prüfen: Bleibt beim Abkippen sichtbar fast die
      halbe Fuhre auf der Brücke liegen, und stört ihn das?*
- [ ] **Innerer Zwillingsreifen steckt 30 cm im Rahmen** — gemessen in E-076.
      Der Rahmen ist ein Quader von 2,20 m Breite (x ±1,10), der innere
      Hinterreifen liegt bei x 0,52 … 0,82 und damit ganz darin. Ein echtes
      Fahrgestell ist ein Leiterrahmen mit zwei Trägern auf ±0,43, dazwischen
      läuft das Rad frei. Von aussen sieht man den Reifen über und unter dem
      Rahmenblech herausstehen. Kein Kranbefund, deshalb liegengelassen.

      **Gebaut 21.09.2026 (E-108), wartet auf sein Urteil am Gerät.** Zwei
      Längsträger auf x ±0,43 (0,14 m breit) plus drei Querträger, mit
      `mergeGeometries` zu **einem** Netz verschmolzen — 1 596 Netze über alle
      18 Bauarten, vorher wie nachher, Zeichenrufe unverändert. Der Kranbock
      saß nebenbei 13 cm im Rahmen, jetzt 2 cm.
- [ ] **Greifer komplett zur Seite kippen** — zum Kehren und Schleudern.
      Vorgemessen (E-065), zurückgestellt bis die Säulenfrage entschieden ist,
      weil die Kollisionsrechnung sonst zweimal gemacht werden müsste.
- [ ] **Edelstahl-Halt, 16 cm Heckabstand zur Südwand des Kupferlagers** —
      gemessen, keine Durchdringung. *Wartet auf sein Urteil: Rangieren oder
      Unfall?*
- [ ] **Abholer brachte kein Geld** (15.09.) — die Ursache mit den drei
      verschiedenen Ladeflächen-Fenstern war behoben (E-070), sein
      **Totalausfall aber nicht reproduziert**.

      **Zweite Ursache gefunden und behoben 16.09.2026 (E-087), wartet auf sein
      Urteil am Gerät.** „Zur Waage" über die Taste J rief `sendAway()`, und das
      setzte nur `phase = "out"` — nie `justDeparted`, an dem die Abrechnung
      hängt. Deshalb ließ es sich vorher fünfmal nicht nachstellen: **8 von 8
      J-Fällen** brachen, **0 von 20 V-Fällen**. Alle drei Symptome (kein Geld,
      keine weiteren Händler, 0 t umgeschlagen) kamen aus dieser einen Zeile.
- [ ] **Anlieferer ohne Frist blockiert den Hof** — wer nie abgeladen wird,
      stand unbegrenzt; im kopflosen Lauf zehn Minuten, und eine vorgemerkte
      Abholung kam nicht durch. Gefunden beim Nachstellen, nicht von ihm
      gemeldet — gehört trotzdem hierher.

      **Gebaut (E-082), wartet auf sein Urteil am Gerät.** `STANDZEIT_S = 240`
      in `delivery/vehicles.ts`: Nach vier Minuten fährt der Wagen
      unverrichteter Dinge ab (`faehrtUnverrichtet()`), eine Minute vorher
      kommt die Mahnung. **Am Gerät zu beurteilen ist der Wert, nicht die
      Mechanik:** Sind vier Minuten zu knapp, wenn man gerade an der Presse
      steht, oder zu lang, weil der Hof so lange dicht bleibt?
- [ ] **Beim Kippen landen Teile quer über den Platz** — „nicht mal in der
      Nähe von dem LKW" (15.09.). Vermutlich der sichtbare Ausgang des
      Katapults: 500 km/h sind 139 m/s, der Platz ist rund 70 m lang. Wird als
      eigene Messgröße mitgemessen (Endlage statt Geschwindigkeit) und dient
      zugleich als Gegenprobe — passen die Endlagen nicht zum Tempo, gibt es
      einen zweiten Fehler.
- [ ] **Es fallen noch Teile durch die Ladefläche** — Patrick am Gerät nach
      E-073: „Es ist auf jeden Fall besser, nicht alles fällt durch, aber immer
      noch ein paar Teile, aber ich beobachte es noch." Gemessen wurde 86 % → 0 %
      Durchfall. Sein Fall wird also vom Messgerät nicht erfasst. Zwei
      Kandidaten: (a) die Reparatur ist unvollständig, (b) er sieht den
      Lenk-Sprung beim Rangieren (168,7° in einem Schritt, 6.596 km/h, E-073,
      nicht behoben). Trennende Beobachtung: **beim Kippen oder beim
      Rangieren?**

      **Zweite Ursache gefunden und behoben 17.09.2026 (E-094), wartet auf sein
      Urteil am Gerät.** Es war keins von beiden ganz: Das Messfenster hörte
      einen Schritt zu früh auf, die wirkliche Zahl war **24,5 %** Durchfall,
      weitestes Stück 18,56 m. `leaveUnloadingBay` setzte `routeS = 0` zurück,
      während `tipCreep` den Kipper schon 1,40 m weitergeschoben hatte — ein
      Rücksprung von 1,32 m in den frischen Haufen, bei **jeder** Fuhre.
      Jetzt 0,0 %.
- [ ] **Der Container-Grundriss wird zu klein gemeldet** — bei E-108
      mitgefunden, eigene Messung. Über das gemeldete Rechteck hinaus stehen
      der Riegel 7,0 cm, die Rungen 10,5 cm und die **Haken-Öse 36,5 cm**. Das
      geht in die Fahrwege der LKW und verschiebt jede Zahl in
      `test/fahrumriss.test.ts` — deshalb bewusst NICHT als Nebenwirkung
      mitgemacht. Der Fall steht mit Zahlen in `test/durchfahrt.test.ts`.

- [ ] **Tank und Werkzeugkasten hängen frei in der Luft** — Folge des
      Leiterrahmens (E-108): Sie saßen 28 cm in der alten Rahmenplatte, jetzt
      hängen sie 31 cm neben dem Längsträger. Vom äußeren Zwillingsrad
      verdeckt, deshalb liegengelassen; eine Konsole wäre ein eigener Schritt.

- [ ] **Drei Startwerte am Feierabend warten auf einen gespielten Tag** (E-113,
      22.09.2026). Der Tag endet jetzt: 17:00 Torschluss, 18:00 Glocke und
      Abrechnung mit ein bis drei Sternen. Drei Zahlen darin sind `// SW` und
      lassen sich nur am Gerät beurteilen:
      **Schicht 7 Minuten** (`FEIERABEND_TIME`; auf 0,79 gestellt wären es
      ≈19:00 und 8,2 min — die Tageslänge selbst NICHT anfassen, sonst wandert
      der Sonnenstand) · **zwei Sterne ab 300 € und 65 %** · **drei ab 800 € und
      90 %**. Wenn drei Sterne beim ersten Versuch fallen, ist 800 € zu wenig.

- [ ] **Die Sortierquote misst den Ausgang, nicht den Platz** (E-113). Definiert
      als Σ Masse × Reinheit ÷ Σ Masse, gemessen an dem, was **abgefahren**
      wird. Damit wird Umschlag belohnt und Aufräumen nicht. Die Gegenposition
      wäre, die Reinheit der Behälter zu messen — dann zählt der Zustand des
      Platzes am Abend. Bewusst so gebaut und bewusst umdrehbar; es ist eine
      Gestaltungsfrage, keine Rechenfrage.

- [ ] **`ruf.decay(1)` wird weiterhin nirgends aufgerufen** — bei E-113
      mitgefunden. Der Ruf soll „pro Tag" verblassen, aber es gab keinen Tag.
      Jetzt gäbe es einen. Nicht eingebaut, weil es Balancing ändert; eine
      Zeile, sobald du es willst.

- [ ] **Am Feierabend wird nicht selbst gespeichert** (E-113). Bewusst nicht
      gebaut. Wenn der Tag gesichert enden soll, ist es eine Zeile.

- [ ] **Zwei volle Bisse flachen ein Auto** (E-114, 22.09.2026). Ein Biss auf
      ein Wrack sind 15,70 kN und damit genau die Quetschschwelle — nach dem
      zweiten fliegen bis zu zwei Räder aus der Aufhängung. Die Presse macht es
      sofort, aber zwei ist schnell. *Wartet auf sein Urteil am Gerät.*
      Ebenfalls offen: Gebissen wird je Zudrücken, nicht im Dauerdruck — zum
      Weiterquetschen muss man loslassen und erneut drücken.

- [ ] **Ordinärer Schrott beult nicht** (E-114). Verformung gibt es nur an
      Wracks. Fässer, Kühler, Bleche und Rohre bräuchten eigene formbare Netze,
      und die kosten Zeichenrufe — deshalb bewusst nicht mitgemacht.

- [ ] **Der Greifer schwingt jetzt 24° aus und braucht 2,5 s bis zur Ruhe**
      (E-115, 22.09.2026). `GELENK_STEIFE` ist von 1,0 auf 0,0 — die künstliche
      Rückstellfeder ist weg, das Pendel rechnet nur noch `g/L`. Gemessen über
      beide Greiferformen, leer und mit 900 kg. *Wartet auf sein Urteil: das
      richtige Gefühl, oder schwingt es zu lange nach?*

- [ ] **Keine stehende Anzeige für Zahlungsunfähigkeit** — „Konto leer" war ein
      Toast und verschwand, der Zustand blieb. `Account.lowOnCash` war gebaut
      und wurde nirgends benutzt.

      **Gebaut 16.09.2026 (E-081), wartet auf sein Urteil am Gerät.** Die
      Zahlungslage steht jetzt in derselben Dauerzeile wie „Platz dicht", in
      drei Stufen: `ok` (still), `knapp` ab 800 € Vorwarnung in Orange, `leer`
      in Rot. Entschieden wird sie an EINER Stelle (`main.ts`, aus
      `account.canBuy` und `account.lowOnCash`) — dieselben zwei Fragen, die
      auch die Einfahrt aufmachen oder zumachen; das HUD bekommt nur das Wort.
      Wächter: `test/kassenlage.test.ts`, `test/tagesablaufzeile.test.ts`.
