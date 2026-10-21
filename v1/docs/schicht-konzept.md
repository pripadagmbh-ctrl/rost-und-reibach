# Schichtbetrieb — Konzept zur Abnahme (Etappe 1, 21.10.2026)

Grundlage: Patricks Sprachnachricht vom 21.10.2026 (Offene Punkte 38a–g) und seine
Antworten vom selben Tag: Verlade-LKW kommt von selbst, Kasse mit festen Preisen,
kein Verhandeln, Schicht ≈ 10 Minuten, Tafel am Ende, Wert in die Bestenliste (E-195).
Dieses Papier entscheidet noch nichts — es schlägt vor und stellt fünf Fragen (Abschnitt 8).
Gebaut wird erst nach Patricks Antworten (Etappe 2).

> „… sehr viele Fuhren gehen rein, Sortieren wird ein bisschen optional. Man muss sehr
> viel Schrott umschlagen, es geht um Schnelligkeit, Präzision und Sortierskills."

---

## 1. Die Idee in drei Sätzen

Laster bringen Mischschrott und kippen ihn **an der Annahme** neben dem Bagger ab. Du
fischst Stahl, Buntmetall und Müll heraus und wirfst sie in ihre Boxen; der Rest geht
auf den **Verlader**, einen Abroller, der fast immer vor dir steht und abfährt, sobald
er voll ist. Das Geld gibt es für alles, was vom Hof fährt — wer schnell arbeitet,
lässt keine Laster warten (Standgeld), wer sauber sortiert, verdient mehr.

Vergleich: wie an einer Supermarktkasse. Die Waren kommen aufs Band (Annahme), du
ziehst sie über den Scanner (Spinne), und die Schlange darf nicht zu lang werden.
Sortieren ist das Einpacken in die richtigen Tüten — man kann auch alles in eine
werfen, bekommt dann aber weniger.

## 2. Eine Schicht im Ablauf

**Dauer:** 10 Minuten Spielzeit (SW, Patrick 21.10.). Die Uhr im Bild läuft von
06:00 bis 16:00 Uhr. Das ist dieselbe eine Uhr wie heute (`world/daylight.ts`),
nur mit einem Schicht-Tag von 24 Spielstunden in 1 440 s statt 900 s
(SW: 06:00 → 16:00 = 0,25 → 0,667 Tag = genau 600 s). Die Sonne wandert also mit.

| Zeit | Was passiert |
|---|---|
| 06:00 (0:00) | Der Verlader steht schon vor dir, die Boxen sind leer, der Platz ist leer. Die erste Fuhre rollt durchs Tor. |
| 06:00–09:00 (0:00–3:00) | **Welle 1:** Fuhren im Grundtakt der Stufe. |
| 09:00–10:00 (3:00–4:00) | **Frühstück:** halber Takt — Zeit, den Haufen abzuarbeiten. |
| 10:00–15:00 (4:00–9:00) | **Welle 2 mit Spitze:** Grundtakt, um 12:00 drei Fuhren kurz hintereinander. |
| 15:00 (9:00) | **Torschluss:** keine neue Fuhre mehr (wie `TORSCHLUSS_TIME`, E-113). |
| 16:00 (10:00) | **Feierabend:** Werkssirene (E-148), die Tafel kommt. |

**Stufen** (alle Zahlen SW, werden in Etappe 2 mit dem Test-Fahrer und an deinem Gerät eingestellt):

| Stufe | Grundtakt Misch-Fuhre | Sortenrein | Wer kommt |
|---|---|---|---|
| Montag (ruhig) | alle 120 s | 0 je Schicht | nur Kipper (kippen selbst) |
| Mittwoch | alle 90 s | 1 je Schicht | Kipper und Pritschen (musst du ausräumen) |
| Freitag (voll) | alle 60 s | 2 je Schicht | dazu Absetzkipper (kippt oder setzt die Mulde ab, E-141) |

**Ladung:** Misch-Fuhren tragen den Platzmix (E-181: rund die Hälfte Mischschrott,
ein Drittel Stahl, der Rest Alu, Buntmetall, Kabel, Akkus, Müll). Ob die Fuhren so
groß bleiben wie heute (Kipper rund 8 t, E-122) oder kleiner und häufiger kommen,
ist Frage 5.

## 3. Der Platz: ein Arbeitskreis um den Bagger

Bilder (Draufsicht, Norden oben, links = links vom Fahrer, wie alle Platzbilder seit
E-122) im Scratchpad unter `scratchpad/schicht/`: **`vorher.png`**, **`variante-A.png`**,
**`variante-B.png`**. Erzeugt und geprüft mit `tools/schicht-platz.ts`, das dieselben
Bausteine benutzt wie das Spiel: Bauwerke, Rangierplaner (E-140), Ausfahrt, Fahrzeugumrisse,
Schwenkband 5,8 … 9,2 m, Tastbereich 5,5 m.

### Was heute fehlt — und warum das die ganze Frage ist

Heute steht am Bagger **immer nur ein Laster**: Anlieferer und Abholer teilen sich den
Abladeplatz Ost (E-122 „einer zur Zeit", E-177). Für die Schicht müssen **zwei** gleichzeitig
dastehen — einer bringt, einer holt ab. Der Bagger steht in der Südostecke: hinter ihm die
Bucht, rechts Presse und BUNT + VA, links die Ostmauer. Laster kommen nur von Norden heran.
Es gibt deshalb genau **zwei Stellen**, an denen ein Laster mit der ganzen Ladefläche im
Greifband stehen kann: die **Ostspur** (heute Abladeplatz) und **quer vor dem Bagger**.
Vor dem Bagger steht aber der Müll-Container (E-192).

**Gemessen:** Eine Suche über 250 Lagen vor dem Bagger (25° rechts bis 35° links,
6,6 bis 7,8 m, beide Kabinenrichtungen, echter Rangierplaner) findet **acht** Stellen
mit freier Zufahrt — **alle nur, wenn der Müll-Container dort nicht steht.** Mit ihm: null.
Vorn ist also Platz für den Verlader **oder** den Müll-Container, nicht für beide.

### Variante A — „Kreis in der Ecke" (Empfehlung)

| Platz | Wo | Schwenk vom Sitz | Prüfung |
|---|---|---|---|
| **Annahme** (Misch) | Abladeplatz Ost, wie heute | +121° (links hinten), 7,9 m | Fahrweg unverändert (E-140); Kipper-Streuung gemessen (E-140/E-149) |
| **Verlader** (Abroller 34 m³) | quer vor dir, 10° links, 7,2 m, Kabine nach Westen | +10° | freier Rangierzug (20,6 m vorwärts, 30°-Bogen, 12 m zurück); alle vier Ecken der Ladefläche 6,52–8,89 m im Band; 45 andere Fahrten (Silos, Abholer, Absetzkipper, Warteplätze) streifen ihn nicht |
| **STAHL** | linke Halde hinten, wie heute | +149°, 8,7 m | — |
| **BUNT + VA** (mit Kabel, Akkus) | Box rechts, wie heute | −65°, 6,5 m | — |
| **MÜLL** | **rechte Halde hinten** (heute MISCHSCHROTT) | −162°, 7,9 m | Mischschrott braucht in der Schicht keine Halde — er geht auf den Verlader |

Schwenk von der Annahme: zu STAHL 28°, zu MÜLL 77°, zum Verlader 111°, zu BUNT 174°.
Bei 33°/s (`CAB_MAX`) sind das 0,9 bis 5,3 s — der häufigste Weg (Misch auf den
Verlader) dauert 3,4 s.

- **Bagger hinaus** (zu den Silos): über die Ostspur nach Norden, solange dort kein
  Anlieferer steht — geprüft frei. Geradeaus nach vorn versperrt der Verlader.
- **Was A kostet:** In der Schicht steht vorn kein Müll-Container, und es fährt
  kein Müll-Abroller. Im **Sandkasten bleibt alles wie heute** (E-190/E-192/E-193) —
  die Schicht bekommt ihren eigenen Aufbau, so wie jede Prüfung (die Wahl im Menü
  fällt vor dem Bau der Welt).

### Variante B — „Haufen vorn mittig"

Die Anlieferer setzen von Norden auf dich zu und kippen über eine niedrige
**Abkippkante** (Betonlego, 0,8 m) — der Haufen liegt genau vor dir. Der Verlader steht
an der Ostspur (dort, wo heute der Abholer hält). Der Müll-Container bleibt.

| | Ergebnis |
|---|---|
| Anlieferer an die Kante | freier Zug, aber 66 m Umweg über den Platz |
| Verlader an die Ostspur | heutiger Weg führt durch Kante und Haufen; neu geplant 66 m Umweg, und **kein** Weg, solange ein Kipper an der Kante steht — er muss warten |
| Bagger hinaus zu den Silos | **versperrt** (Kante und Haufen liegen in der Fahrlinie) |
| Kippen zum Bagger hin | **neu und ungemessen** — heute kippt der Kipper gegen die Südmauer; zum Bagger hin flogen beim Kipper-Katapult einzelne Stücke bis 279 km/h (E-140) |
| Schwenk vom Haufen | Müll 34°, BUNT 74°, Verlader 86°, Stahl 140° |

Schöner fürs Auge (der Haufen liegt mitten im Blick), aber zwei neue Fahrwege, eine neue
Kippstelle mit Katapult-Risiko, und du kommst nie vom Platz.

### Verworfen: Variante C — eigener Sortierplatz in der Hofmitte

Ein zweiter Baggerstand auf der freien Fläche im Norden, mit Annahme, Verlader und neuen
Boxen rundherum (von allen Seiten anfahrbar). Spielerisch am saubersten, aber ein neuer
Platz mit neuen Mauern, allen Fahrwegen neu und allen Platz-Wächtern neu — geschätzt
zwei bis drei Wochen mehr. Für 1.1 notiert.

## 4. Die Regeln

**Annahme.** Jede Misch-Fuhre fährt an die Annahme. Kipper kippen selbst, Pritschen und
abgesetzte Mulden räumst du aus. Liegt auf dem Platz mehr als 10 t loser Schrott (SW;
heute 16 t im Sandkasten, `shift.JAM_KG`), wartet die nächste Fuhre am Tor — und ihr
Standgeld läuft. Ansage wie heute (E-192): „Der Platz ist voll — neue Fuhren warten am Tor."

**Verlader-Takt** (Patrick: „steht fast immer bereit").
- Zur Schicht steht er schon da. Voll ist er wie heute (E-120): 80 % Füllgrad oder 8,5 t,
  dann 3 s Ruhe, dann fährt er.
- Der nächste wartet auf dem Warteplatz an der Nordmauer (E-193) und rückt nach, sobald
  der Platz vorn frei ist — Lücke rund 25 s (SW, wird gemessen). In der Lücke: weiter
  sortieren oder den Misch auf dem Haufen lassen.
- **Hupe** (E-191) schickt ihn früher weg (ab 1 kg Ladung). **ABHOLEN** bleibt im Kranz.

**Boxen und ihr Abholer** (Patrick: „für Sortiertes kommt er, wenn eine Mulde voll ist").
- Jede Box hat einen **Füllstandsbalken** im Bild (Rechnung nach Volumen wie heute,
  `world/fuellstand.ts`). „Voll" heißt in der Schicht: eine Abholer-Fuhre ist beisammen —
  Stahl 6 t, BUNT + VA 1,5 t, Müll 3 t (alle SW).
- Ist eine Box voll, ist der **nächste Verlader einer für diese Sorte** (Abroller oder
  Absetzkipper nach Menge, E-177). Du lädst ihn aus der Box. So lange gibt es keinen
  Misch-Verlader — das ist der Druck.
- Nebenbei hält das die Zahl der Körper klein: Was abgeholt wird, verlässt die Welt
  (wichtig fürs iPhone mini, siehe Risiken).

**Sortenreine Fuhren** (Patrick: „kommen weiterhin zu den einzelnen Mulden, wo man dann
hinfahren muss"). Wie genau — Frage 2.

**Kasse mit festen Preisen** (Verkaufspreise aus `materials/catalog.ts`, dort als SW
geführt). Kein Ankauf, kein Verhandeln, kein Ruf — die Kasse beginnt jede Schicht bei 0 €.

| Sorte | Preis | Woher |
|---|---|---|
| Mischschrott | 160 €/t | `mixed.sellPricePerKg` 0,16 |
| Stahlschrott | 250 €/t | `steel` 0,25 |
| Aluminium · Zink | 1 500 · 820 €/t | `alu`, `zinc` |
| Edelstahl VA | 1 400 €/t | `va` |
| Kabel | 2 200 €/t | `cable` |
| Messing · Kupfer | 4 300 · 7 200 €/t | `brass`, `copper` |
| Akkus | 550 €/t | `battery` |
| Müll (Holz, Reifen, Bauschutt, Kunststoff) | kostet 20–60 €/t | negative Preise im Katalog |

Bezahlt wird jedes Teil nach **seiner** Sorte, wenn es in der passenden Box liegt bzw.
abgeholt wird; auf dem Misch-Verlader zählt alles als Mischschrott. Wer also Kupfer auf den
Misch-Verlader wirft, bekommt 160 statt 7 200 €/t — das ist „Sortieren ist optional":
erlaubt, aber teuer. Grob geschätzt bringt eine sauber sortierte Fuhre zwei- bis dreimal so
viel wie dieselbe Fuhre ganz auf den Verlader (nachzurechnen in Etappe 2 mit
`tools/sortenanteile.ts`).

**Abzüge** (alle SW):

| Abzug | Regel | Betrag |
|---|---|---|
| **Standgeld** | Ein Anlieferer wartet — am Tor (Platz voll), auf dem Platz (Annahme besetzt) oder an der Annahme (noch nicht ausgeräumt). Die ersten 60 s sind frei. | 1 € je Sekunde danach |
| **Fehlwurf** | Ein Teil liegt, wo es nicht hingehört: Müll in Misch, Stahl oder BUNT; Misch oder Stahl in BUNT. (Stahl und Bunt auf dem Misch-Verlader sind kein Fehlwurf — nur verschenktes Geld.) | 25 € je Teil |
| **Schaden** | Harter Aufschlag auf einen Laster oder Container — dieselbe Grenze wie in den Prüfungen: 5 m/s oder 0,5 m Fall (`HART_AB_MS`, E-163) | 50 € je Aufschlag |

**Ende und Tafel.** Um 16:00 kommt die Feierabend-Tafel (E-113, mit Sirene E-148):

| Zeile | Bedeutung |
|---|---|
| Tonnen umgeschlagen | was vom Hof gefahren ist (Verlader und Box-Abholer) |
| Sortierquote | Anteil (nach Masse), der in der richtigen Sorte gelandet ist |
| Wartezeit | Summe der Standzeiten aller Anlieferer (über die freien 60 s) |
| Erlös · Abzüge | Kasse aufgeschlüsselt: Verkauf, Standgeld, Fehlwürfe, Schäden |
| **Tagesverdienst** | Erlös minus Abzüge — **dieser Wert geht in die Bestenliste** |
| Sterne | ★ Schicht durchgehalten · ★★ Verdienst ≥ Schwelle der Stufe · ★★★ dazu Quote ≥ 90 % (`REIN_GUT`) und Wartezeit ≤ 2 min — Schwellen werden in Etappe 2 gemessen |

Was am Ende noch in den Boxen liegt, zählt — siehe Frage 3. Was auf der Annahme liegt,
bringt nichts.

**Bestenliste** (E-195): neuer Abschnitt **SCHICHTEN** — je Stufe die besten 5 nach
Tagesverdienst, dazu Tonnen, Quote, Wartezeit, Datum. Für Game Center (1.1) als ganze
Euro mit fester Kennung (`de.rostundreibach.app.schicht.<stufe>.verdienst`).

## 5. Was vom alten Betrieb wiederverwendet wird — und was nicht

Der Betrieb bis E-117 ist seit E-118 abgeschaltet, aber im Code (`SPIELART = "betrieb"`).

**Wird gebraucht:**
- `economy/shift.ts`: Stau-Hysterese („Platz voll" → Einfahrt zu), `noteTurnover` und
  `sortierquote`, das Sterne-Muster (Geld + Quote), Torschluss und Feierabend über die eine
  Uhr. Neu dazu: eine Schicht-Kasse mit festen Preisen und Abzügen (kleines, reines Modul
  mit Tests).
- `ui/abrechnung.ts`: die Feierabend-Tafel mit Zeilen, Sternen, Sirene — neue Zeilen.
- HUD: `#money` (Kasse), `#shift` (Uhr), `#load` (Ladeanzeige des Abholers → Füllbalken
  des Verladers). Heute im Simulator verborgen (`NUR_IM_BETRIEB`).
- Fuhrpark: Abholer nach Sorte und m³ (E-177), voll fährt los (E-120), Hupe (E-191),
  Büro-Funk (E-178), Laster warten aufeinander und Warteplätze (E-193), Absetzkipper (E-141).
- `world/fuellstand.ts` für die Boxbalken, `materials/catalog.ts` für die Preise.

**Bleibt aus:** Verhandeln (`haggle`), Ruf (`reputation`), Platz ausbauen (`upgrades`),
Ankauf an der Waage (`onWeighIn/Out`), Konto über Tage (`account`), Kundendialoge,
Mario/Janine/Lambert, Polizei, das Handels-Tutorial, Reinheit² als Preisregel
(`purity.containerValue` ist Handelslogik — die Schicht zahlt je Teil nach seiner Sorte).

## 6. Risiken — und wie sie gemessen werden

1. **Waage als Engpass.** Tor und Waage lassen nur einen Laster zur Zeit durch (E-193), jeder
   hält 6 s (`WIEGE_HALT_S`, E-120). Freitag mit Fuhre alle 60 s plus Verlader-Wechsel plus
   Box-Abholer: Mehrfahrzeug-Lauf (Wächter wie `fahrspuren.test.ts`) mit dem Freitags-Fahrplan.
   Notfalls in der Schicht kürzer wiegen (3 s, SW).
2. **Leistung iPhone mini.** Ladung auf einem stehenden Laster schläft nie ein (E-177, Befund);
   der Verlader steht fast immer. Gemessen werden Physik-ms und Körper über eine ganze
   Freitagsschicht (`tools/platzlast.ts`-Muster); wenn nötig, wird die Ladefläche des stehenden
   Verladers fest wie die abgesetzte Mulde (E-141).
3. **Kipper-Katapult** bleibt, wo er ist (Annahme unverändert, Variante A). Bei Variante B
   müsste er neu gemessen werden (`tools/kipper-streuung.ts`).
4. **Spielbarkeit.** Ein Test-Fahrer-Durchlauf (wie bei den Prüfungen) spielt eine Montagsschicht;
   daraus kommen Takt und Sternschwellen. Am Gerät entscheidet Patrick.

## 7. Aufwand und Pakete (Etappe 2)

Rund **25 Agentenstunden** in fünf Teil-Commits, jeder mit grüner Prüfkette; mit zwei
Gerätetest-Runden etwa 1,5–2 Wochen — passt vor den Store-Start Ende November, parallel
zum Lehrgang.

| Paket | Bereich | Fertig, wenn … | h |
|---|---|---|---|
| S1 Schicht-Platz | welt + delivery | Schicht-Aufbau nach gewählter Variante; Verlader-Halt als Abholplatz; alle Fahrweg-Wächter grün; Bild aus dem Spiel = Bild aus dem Werkzeug | 5 |
| S2 Fahrplan und Verlader | delivery | Wellen je Stufe, Verlader immer bereit, Nachrücker vom Warteplatz, Box-Abholer bei voller Box, Standzeit je Laster gemessen; Mehrfahrzeug-Lauf Freitag: kein Laster > 60 s stecken | 6 |
| S3 Kasse und Bilanz | welt (economy) | feste Preise, Abzüge, Tafelzeilen, Sterne als reine Funktionen mit Tests; Schicht-Uhr 06–16 Uhr in 600 s | 4 |
| S4 Anzeige und Menü | ui | SCHICHT im Hauptmenü mit drei Stufen, HUD (Kasse, Uhr, Verlader- und Boxbalken) ohne Überlappung auf iPad und iPhone mini quer, Tafel, Bestenliste SCHICHTEN, alles DE/EN | 6 |
| S5 Wächter und Messung | qa | Physik-ms und Körper über eine Freitagsschicht, Test-Fahrer-Montag, Messprotokoll | 4 |

`main.ts` verdrahtet der Orchestrator (rund 1–2 h).

## 8. Fragen an Patrick

**Frage 1 — Welcher Platz?**
Vorn ist nur Platz für den Verlader **oder** den Müll-Container.
- **A — Kreis in der Ecke:** Annahme wie heute links, Verlader quer vor dir, Müll in der Schicht in die rechte Halde. Gemessen frei, Kippen unverändert, du kommst über die Ostspur vom Platz. *(Empfehlung: alles daran ist geprüft, nichts an der Kippphysik neu.)*
- **B — Haufen vorn:** Kipper kippen über eine Kante direkt vor dir, Verlader links, Müll bleibt vorn. Schöner im Blick, aber neue Kippstelle (Katapult-Risiko), Umwege für die Laster, und du kommst in der Schicht nicht vom Platz.
- **C — eigener Sortierplatz in der Hofmitte:** am saubersten, aber zwei bis drei Wochen mehr — nach 1.0.

**Frage 2 — Sortenreine Fuhren in der Schicht?**
- **a — Kipper kippt selbst ins Lager** (wie heute, E-178): kein Handgriff für dich, nur Verkehr.
- **b — Pritsche wartet am Lager, du fährst hin und lädst ab** — Standgeld läuft, während am Haufen der Misch wartet. *(Empfehlung: Das ist dein „wo man dann hinfahren muss", und es ist die spannendste Entscheidung der Schicht: „Fahr ich jetzt rüber oder mach ich erst den Kipper fertig?" Selten: Montag 0, Mittwoch 1, Freitag 2.)*
- **c — keine sortenreinen** in der Schicht.

**Frage 3 — Wann gibt es Geld für Sortiertes?**
- **a — Wenn es vom Hof fährt:** Box voll → Abholer kommt, du lädst ihn; was am Ende noch in den Boxen liegt, zählt zu 70 % (SW). *(Empfehlung: passt zu „zeitkritisch alles wieder verladen", und der Box-Abholer hat einen Grund.)*
- **b — Sofort beim Einwerfen** in die Box; keine Box-Abholer. Einfacher, aber dann gibt es für Sortiertes nichts zu verladen, und die Boxen füllen sich mit Körpern (Leistung).
- **c — Beim Einwerfen, und bei voller Box kommt trotzdem ein Abholer** (Arbeit ohne Extra-Geld).

**Frage 4 — Stufen und Freischalten?**
- **a — Montag, Mittwoch, Freitag nacheinander frei** (nächste Stufe ab einem Stern), wie die Prüfungen. *(Empfehlung: gibt dem Spiel nach dem Lehrgang einen Weg.)*
- **b — alle drei gleich offen.**
- **c — eine einzige Schicht**, die von Tag zu Tag schwerer wird (Montag … Freitag als Woche).

**Frage 5 — Wie groß sind die Fuhren?**
- **a — wie heute** (Kipper rund 8 t): drei bis sieben Fuhren je Schicht.
- **b — kleiner und häufiger** (rund 4 t): sechs bis vierzehn Fuhren, mehr Verkehr. *(Empfehlung: „sehr viele Fuhren gehen rein" — und weniger Teile je Fuhre schonen das iPhone mini.)*

## 9. Schnittstelle zum Hauptmenü (Abstimmung mit dem Lehrgang)

Der Lehrgang baut das zweistufige Hauptmenü (LEHRGANG · PRÜFUNGEN · SCHICHT · SANDKASTEN ·
BESTENLISTE) und hat einen Platz für SCHICHT vorgesehen. Die Schicht hängt sich so an:

- **Wahl:** `Spielwahl` bekommt den Fall `{ art: "schicht"; stufe: Schichtstufe }` mit
  `type Schichtstufe = "montag" | "mittwoch" | "freitag"` (Typ in `src/economy/schicht.ts`).
- **Knopf:** `<button id="hm-schicht">` in `#hm-haupt` zwischen PRÜFUNGEN und SANDKASTEN;
  er öffnet die zweite Stufe (`zeigeListe`) mit drei Knöpfen (Stufe, Bestverdienst, Schloss).
  Bis Etappe 2 bleibt er verborgen.
- **Texte:** `wort("schicht")` = SCHICHT / SHIFT, `wort("schichtText")` = „Fuhren annehmen,
  sortieren, verladen — 10 Minuten" / „Take in loads, sort, load out — 10 minutes".
- **Start:** `main.ts` baut für die Schicht die Sandkasten-Welt mit Schicht-Aufbau und ruft
  `starteSchicht(stufe, …)` (in `src/economy/schicht.ts`, Etappe 2). Kranz in der Schicht:
  ohne NACHSCHUB; ABHOLEN, HUPE, ZUR WAAGE bleiben; kein Speichern und kein „Neues Spiel"
  im Pausenmenü (eine Schicht ist ein Lauf).
- **Bestenliste:** `core/bestenliste.ts` bekommt einen Abschnitt `schichten` (Schema 2).

---

**Auf dem Gerät zu prüfen** (nach Etappe 2, je nach gewählter Variante):
1. SCHICHT → Montag: Steht der Verlader vor dir, kommt der erste Kipper und kippt an der Annahme?
2. Misch auf den Verlader, Stahl in die Halde: läuft die Kasse mit, fährt der Verlader voll los und kommt der nächste nach etwa 25 s?
3. Einen Kipper warten lassen: siehst du das Standgeld laufen?
4. Nach 10 Minuten: Sirene, Tafel mit Tonnen, Quote, Wartezeit, Verdienst — und steht die Schicht in der Bestenliste?
