# Store-Texte — Entwurf zur Freigabe

Stand 19.10.2026. Alles hier ist **Entwurf**. Du wählst aus und gibst frei; erst dann wird es in App Store Connect eingetragen **[du]**.

Die Zeichenzahlen sind nachgezählt. Grenzen laut Apple ([App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)):

| Feld | Grenze | Änderbar ohne neue Version? |
|---|---|---|
| Name | 2–30 Zeichen | nein (nur mit neuer Version) |
| Untertitel | 30 Zeichen | nein |
| Werbetext („Promotional Text“) | 170 Zeichen | **ja**, jederzeit |
| Beschreibung | 4000 Zeichen, nur reiner Text | nein |
| Schlüsselwörter | **100 Byte**, nicht Zeichen | nein |

**Achtung Byte:** Bei den Schlüsselwörtern zählt Apple Bytes. Ein ä, ö, ü oder ß kostet zwei. Deshalb stehen unten bei den Schlüsselwörtern beide Zahlen.

## Vorab: drei Regeln, die für alle Texte gelten

1. **Nur versprechen, was im eingereichten Build steckt.** Apple lehnt ab, wenn Text und Spiel nicht zusammenpassen ([Richtlinie 2.3](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata)). Die Zeile über die **Aufgaben mit Sternen** ist deshalb in eckige Klammern gesetzt: Sie bleibt nur drin, wenn die Aufgaben (Punkt 22c) im Build sind. Zurzeit sind sie pausiert (`CHALLENGES_PAUSIERT = true`).
2. **Keine fremden Marken.** Kein „Fuchs“, „Liebherr“, „Sennebogen“ — weder im Text noch in den Schlüsselwörtern. Apple verbietet fremde Marken in den Metadaten ([2.3.7](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata), [5.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)). Wir sagen „Umschlagbagger“ und „Fünfschalengreifer“; das ist Handwerk, keine Marke. Im Spiel selbst sind fremde Logos seit E-143 raus.
3. **Englisch nur, wenn das Spiel Englisch kann.** Das Spiel ist heute durchgehend deutsch beschriftet. Ein englischer Store-Eintrag zu einem rein deutschen Spiel ist erlaubt, aber unfair: Apple zeigt unter „Sprachen“ nur Deutsch, und ein Käufer aus England bekommt Menüs, die er nicht lesen kann. Siehe Frage an dich unten.

---

## 1. Name und Untertitel — drei Varianten zur Wahl

**Entschieden 20.10.2026 (Patrick, E-173):** Der Name im Store ist **„Rost & Reibach"** (14 Zeichen), deutsch wie englisch; Anbieter bleibt die Pripada GmbH. Unter dem App-Symbol steht „Rost&Reibach" (`Info.plist`, CFBundleDisplayName), weil „Rost & Reibach" dort zu „Rost & Rei…" gekürzt würde. Die Untertitel unten gelten weiter; die Namensspalte ist der Stand vor der Entscheidung.

Der Name ist das Stärkste, was Apple bei der Suche liest; der Untertitel das Zweitstärkste. Wörter aus Name und Untertitel müssen nicht noch einmal in die Schlüsselwörter.

### Deutsch

| | Name | Zeichen | Untertitel | Zeichen |
|---|---|---|---|---|
| **A (Empfehlung)** | Pripada Schrottplatz | 20 | Umschlagbagger-Simulator | 24 |
| B | Schrottplatz-Bagger Pripada | 27 | Greifen, sortieren, pressen | 27 |
| C | Pripada: Umschlagbagger | 23 | Greifer, Magnet und Presse | 26 |

**Warum A:** Der Name ist der, unter dem das Spiel schon heißt (Titel, Manifest, Schilder im Spiel). „Schrottplatz“ ist das Wort, das Leute suchen; „Umschlagbagger-Simulator“ sagt in einem Wort, was man tut, und „Simulator“ ist der Gattungsbegriff, unter dem solche Spiele gesucht werden. Wer „Bagger“ sucht, findet es über die Schlüsselwörter.

### Englisch

| | Name | Zeichen | Untertitel | Zeichen |
|---|---|---|---|---|
| **A (Empfehlung)** | Pripada Scrapyard | 17 | Material handler simulator | 26 |
| B | Pripada Scrapyard Excavator | 27 | Grab, sort and crush scrap | 26 |
| C | Pripada: Scrap Handler | 22 | Grapple, magnet and baler | 25 |

„Material handler“ ist das englische Fachwort für Umschlagbagger. Kaum ein Laie sucht danach — darum stehen „excavator“ und „crane“ in den Schlüsselwörtern.

---

## 2. Werbetext (170 Zeichen, jederzeit änderbar)

Steht über der Beschreibung. Weil man ihn ohne neue Version ändern kann, eignet er sich später für Neuigkeiten („Neu: der Magnet …“).

**Deutsch** (139 Zeichen)

> Ein Umschlagbagger, ein voller Schrottplatz, keine Eile. Greifen, sortieren, pressen – komplett offline, ohne Werbung, ohne Käufe im Spiel.

**Englisch** (116 Zeichen)

> One material handler, a yard full of scrap, no rush. Grab, sort, crush – fully offline, no ads, no in-app purchases.

---

## 3. Beschreibung (Ziel ~1500 Zeichen)

Reiner Text, kein Fett, keine Links — Apple zeigt nur Zeilen. Die Punkte „·“ sind normale Zeichen.

Die Zeile in **[eckigen Klammern]** nur übernehmen, wenn die Aufgaben im Build sind; die Klammern selbst entfallen.

Der Absatz „Gemacht auf einem echten Schrottplatz“ ist ein Vorschlag — nur, wenn du das so sagen willst. Er ist das Einzige, was kein anderer Bagger-Simulator von sich behaupten kann.

### Deutsch

```
Du sitzt in der Kabine eines Umschlagbaggers auf einem Schrottplatz. Vor dir liegen Blech, Rohre, Motorblöcke und Autowracks – und alles davon hat Gewicht.

DER GREIFER
Der Fünfschalengreifer hängt frei am Ausleger und pendelt nach. Wer zu schnell schwenkt, bekommt die Last nicht ruhig. Gewicht und Ausladung spielen zusammen: Nah an der Maschine hebst du mehr als weit draußen, und ohne Stützen kippt die Rechnung früher. Für Eisen und Stahl gibt es den Lasthebemagneten.

DIE ARBEIT
· Schrott nach Sorten in die Mulden legen: Stahl, Aluminium, Kupfer, Edelstahl, Kabel
· Autowracks greifen, zerlegen und in der Presse zu Paketen pressen
· Nachschub kommt per Kipper und Absetzkipper
[· Aufgaben mit bis zu drei Sternen – vom ersten Griff bis zur sauberen Sortierung]
· Sandkasten: der ganze Platz, ohne Ziel und ohne Uhr

DIE STEUERUNG
Zwei Sticks auf dem Bildschirm, wie die Joysticks in der Kabine. Sie erscheinen dort, wo dein Daumen aufsetzt. Dazu Kabinensicht oder freie Kamera.

DER TON
Echte Aufnahmen: Bagger, Hydraulik, Stahl, Blech und Glas.

GEMACHT AUF EINEM ECHTEN SCHROTTPLATZ
Hinter dem Spiel steht die Pripada GmbH, ein Schrott- und Metallhandel. Was im Spiel in welche Mulde gehört, ist so sortiert, wie wir es auch draußen sortieren.

· Einmal kaufen, alles drin: keine Werbung, keine Käufe im Spiel, kein Konto
· Läuft komplett offline
· Dein Spielstand bleibt auf deinem Gerät
```

### Englisch

```
You sit in the cab of a material handler on a scrapyard. In front of you: sheet metal, pipes, engine blocks and car wrecks – and every piece of it has weight.

THE GRAPPLE
The five-tine orange peel grapple hangs freely from the stick and swings. Slew too fast and the load won't settle. Weight and reach work together: close to the machine you lift more than far out, and without outriggers the limit comes sooner. For iron and steel there is a lifting magnet.

THE WORK
· Sort scrap into the right skips: steel, aluminium, copper, stainless, cable
· Grab car wrecks, take them apart and crush them into bales
· Fresh loads arrive by tipper truck and skip loader
[· Tasks with up to three stars – from your first grab to a clean sort]
· Sandbox: the whole yard, no goals, no clock

THE CONTROLS
Two on-screen sticks, like the joysticks in the cab. They appear wherever your thumb lands. Play from the cab or with a free camera.

THE SOUND
Real recordings: excavators, hydraulics, steel, sheet metal and glass.

MADE ON A REAL SCRAPYARD
The game comes from Pripada GmbH, a German scrap and metal trader. What goes into which skip is sorted the way we sort it in the yard.

· Buy once, get everything: no ads, no in-app purchases, no account
· Works fully offline
· Your progress stays on your device
```

Länge (nachgezählt mit der Aufgaben-Zeile): Deutsch 1399, Englisch 1298 Zeichen. Weit unter 4000 — auf der Produktseite sieht man ohnehin nur den Anfang, bevor man „mehr“ tippt. Darum stehen Ort, Maschine und Gewicht ganz oben.

**Prüfe bitte am Spiel**, ob jede Zeile stimmt:
- ~~Knopfname der Presse~~ — beantwortet 21.10.2026: Der Knopf heißt jetzt PRESSE (E-191).
- „Mulden“ und die fünf Sorten — stimmen die Namen mit den Schildern im Spiel?
- „Ohne Stützen kippt die Rechnung früher“ — beruht auf E-154 (ohne Pratzen ein Drittel weniger Traglast).
- „Kipper und Absetzkipper“ — kommen beide im Sandkasten über NACHSCHUB?

---

## 4. Schlüsselwörter (100 Byte)

Kommagetrennt, **ohne Leerzeichen** (jedes Leerzeichen kostet ein Byte). Jedes Wort muss länger als zwei Zeichen sein. App-Name, Firmenname und fremde Marken gehören nicht hinein ([Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)).

**Deutsch** (98 Zeichen, 98 Byte — bewusst ohne Umlaute)

```
bagger,simulator,greifer,magnet,schrott,kran,presse,autowrack,recycling,metall,lkw,baumaschine,sim
```

Bei Untertitel-Variante A steht „Simulator“ schon im Untertitel; dann `simulator` und `sim` gegen `schrottbagger` tauschen:

```
bagger,schrottbagger,greifer,magnet,schrott,kran,presse,autowrack,recycling,metall,lkw,baumaschine
```

(98 Zeichen, 98 Byte)

**Englisch** (98 Zeichen, 98 Byte)

```
excavator,crane,grapple,magnet,scrap,junkyard,simulator,crusher,car,truck,recycling,metal,sim,yard
```

---

## 5. Kategorie

| | Empfehlung | Begründung |
|---|---|---|
| Primär | **Spiele** | Es ist ein Spiel; dort sucht man Simulatoren. |
| Spiele-Unterkategorien (bis zu zwei) | **Simulation** (+ optional **Gelegenheitsspiele/Casual**) | Simulation ist der Kern. Casual nur, wenn du auch Gelegenheitsspieler ansprechen willst. |
| Sekundär | **leer lassen** oder **Unterhaltung** | Bringt kaum Sichtbarkeit; Hauptsache, sie ist nicht falsch. |

Quelle: [Apple — App Store categories](https://developer.apple.com/app-store/categories/). Eine falsche Kategorie ist selbst ein Ablehnungsgrund (Richtlinie 2.3).

---

## 6. „Was ist neu“

Bei der ersten Version nicht nötig, ab dem ersten Update Pflicht (bis 4000 Zeichen). Vorschlag für später: kurz und konkret, wie ein Lieferschein — „Neu: …, behoben: …“.

---

## Fragen an dich

1. **Name/Untertitel:** A, B oder C? *Empfehlung: A.*
2. **Englisch zum Start?** Möglichkeiten: (a) Spiel und Store sofort zweisprachig — dafür müssen alle Knöpfe, Menüs und Hinweise im Spiel übersetzt werden, das ist eigene Arbeit im Spiel; (b) Start nur auf Deutsch, Englisch kommt mit dem ersten Update; (c) englischer Store-Text zu deutschem Spiel. *Empfehlung: (a), wenn die Übersetzung bis zum 09.11. im Build ist, sonst (b). Von (c) rate ich ab — es führt zu enttäuschten Käufern und schlechten Bewertungen.*
3. **Absatz „Gemacht auf einem echten Schrottplatz“** — drin lassen? *Empfehlung: ja, er ist wahr und unterscheidet das Spiel.*
