# Bildmaterial — Bildschirmfotos, Vorschauvideo, Icon

Stand 19.10.2026. Größen nachgeschlagen bei Apple ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/), [App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/)).

## 1. Bildschirmfotos — was Apple verlangt

| Gerät | Pflicht? | Querformat, Pixel (Breite × Höhe) |
|---|---|---|
| **iPhone mit Dynamic Island, mittlere Größe** | **Pflicht**, mindestens 1 Bild | **2556 × 1179** oder **2622 × 1206** |
| iPhone mit Face ID, groß | nur wenn keine „Dynamic Island groß“-Bilder geliefert werden; nicht nötig, wenn die Pflichtgröße oben da ist | 2778 × 1284 oder 2688 × 1242 |
| **iPad 13 Zoll** | **Pflicht**, weil das Spiel auf dem iPad läuft | **2752 × 2064** oder **2732 × 2048** |
| alle anderen Größen | freiwillig; Apple verkleinert die großen Bilder selbst | — |

- **1 bis 10 Bilder** je Gerätegröße und Sprache.
- Format **PNG oder JPEG, ohne Transparenz** (kein Alphakanal).
- Ab April 2027 kommt für Builds mit dem iOS-27.1-SDK eine Pflichtgröße für das „iPhone Duo“ hinzu — betrifft den Start nicht.

Apples Regeln für den Inhalt:
- Die Bilder müssen **das Spiel in Benutzung** zeigen, nicht nur Titelbild oder Ladebildschirm ([Richtlinie 2.3.3](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata)).
- Die **ersten ein bis drei Bilder** erscheinen in den Suchergebnissen, wenn es kein Vorschauvideo gibt — dort muss das Wesentliche sitzen ([Product page](https://developer.apple.com/app-store/product-page/)).
- Alles muss für alle Altersstufen passen (2.3.8).

### Wie wir an die genauen Größen kommen

Dein iPhone mini und (je nach Modell) dein iPad liefern **nicht** die Pflichtgrößen. Ein Bildschirmfoto vom mini hat z. B. 2340 × 1080 — das nimmt Apple für die Pflichtgröße nicht an.

**Vorschlag:** Wir lassen das echte Spiel am PC in einem Browserfenster mit **genau** 2556 × 1179 bzw. 2752 × 2064 Pixeln laufen und fotografieren es dort. Das ist eine echte Aufnahme des Spiels (es ist derselbe Code), nur auf einer anderen Bildschirmgröße — vergleichbar mit einem Foto derselben Maschine von einem anderen Standpunkt. Die Spielstände für die Motive richten wir vorher ein. Die Bildunterschriften setzen wir als schlichten Balken oben ins Bild.

Prüfen: Sehen die Bedienelemente (Kranz, Knöpfe) auf diesen Größen genauso aus wie auf deinem Gerät?

### Motive — Vorschlag mit Bildunterschrift

Reihenfolge = Reihenfolge im Store. Die ersten drei tragen die Last.

| # | Motiv | Bildunterschrift DE | Caption EN |
|---|---|---|---|
| 1 | Kabinensicht: Greifer schwebt voll beladen über dem Haufen, Hände an den Joysticks, Spinne leicht ausgependelt | **Du sitzt am Hebel.** | **You're at the controls.** |
| 2 | Außensicht, Greifer schließt sich um ein Autowrack, Glas splittert | **Greifen, was Gewicht hat.** | **Grab anything with weight.** |
| 3 | Wrack wird in die Presse gelegt, daneben fertige Pakete | **Pressen, bis es passt.** | **Crush it into bales.** |
| 4 | Sortierte Mulden mit Schildern (Stahl, Alu, Kupfer, Edelstahl, Kabel), Greifer lässt Kupfer fallen | **Jede Sorte in ihre Mulde.** | **Every metal in its skip.** |
| 5 | Lasthebemagnet hebt Eisenteile, Nichteisen bleibt liegen | **Der Magnet nimmt nur Eisen.** | **The magnet takes only iron.** |
| 6 | Kipper kippt Nachschub ab, Bagger wartet | **Nachschub kommt per Kipper.** | **Fresh loads by tipper truck.** |
| 7 *(nur wenn im Build)* | Aufgabe abgeschlossen, drei Sterne | **Aufgaben mit bis zu drei Sternen.** | **Tasks with up to three stars.** |
| 8 | Weiter Blick über den ganzen Platz, Abendlicht | **Offline. Ohne Werbung. Einmal kaufen.** | **Offline. No ads. Buy once.** |

Bild 7 entfällt, wenn die Aufgaben nicht im Build sind — dann sind es sieben. Keine Bilder mit Kaufpreis, Datum oder „Neu“ (veraltet schnell).

---

## 2. Vorschauvideo (freiwillig, aber stark)

Apples Vorgaben ([App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/), [App previews](https://developer.apple.com/app-store/app-previews/)):

| | |
|---|---|
| Länge | **15 bis 30 Sekunden** |
| Anzahl | bis 3 je Gerätegröße und Sprache |
| iPhone quer | **1920 × 886** |
| iPad quer | **1600 × 1200** |
| Format | H.264 (.mov, .m4v, .mp4), 10–12 Mbit/s, höchstens **30 Bilder/s**, höchstens 500 MB |
| Ton | Stereo, AAC 256 kbit/s, 44,1 oder 48 kHz |

Inhaltlich:
- **Nur Bilder aus dem Spiel selbst.** Keine gefilmten Hände, kein Blick über die Schulter. Eingeblendete Berührungspunkte sind erlaubt.
- **Texteinblendungen sind erlaubt** und empfohlen — lesbar und lange genug stehend.
- Das Video läuft im Store **stumm** los. Es muss ohne Ton verständlich sein; der Ton ist Zugabe.
- Musik nur mit Rechten; Spielgeräusche sind unproblematisch. **Vorschlag: nur Spielton** (echte Aufnahmen), keine Musik.
- Ein **Standbild** („Poster Frame“) wählen, das zeigt, worum es geht — Vorschlag: Motiv 2.

### Drehbuch, 25 Sekunden

| Zeit | Bild | Einblendung DE / EN | Ton |
|---|---|---|---|
| 0–3 s | Kabinensicht, Motor läuft an, Blick auf den vollen Platz | *Schrottplatz. Umschlagbagger. Du.* / *Scrapyard. Material handler. You.* | Diesel im Stand |
| 3–8 s | Greifer senkt sich offen auf den Haufen, schließt, hebt — die Last pendelt nach | *Alles hat Gewicht.* / *Everything has weight.* | Hydraulik, Zupacken, Rasseln |
| 8–12 s | Außensicht: Greifer packt ein Autowrack, Scheibe birst | — | Glas, Blech |
| 12–16 s | Wrack in die Presse, Deckel drückt, Paket fällt heraus | *Pressen.* / *Crush.* | Knautschen |
| 16–20 s | Schnelle Folge: Kupfer in die Kupfermulde, Magnet hebt Eisen, Alu in die Alumulde | *Sortieren.* / *Sort.* | Kupfer-, Stahl-, Alu-Aufschläge |
| 20–23 s | Kipper fährt rückwärts heran und kippt ab | *Nachschub kommt.* / *More is coming.* | LKW-Hupe, Abkippen |
| 23–25 s | Weiter Blick über den Platz, Name eingeblendet | *Rost & Reibach — offline, ohne Werbung.* / *Rost & Reibach — offline, no ads.* | ausklingen |

Aufnahme wie die Bildschirmfotos: am PC im Fenster mit 1920 × 886 bzw. 1600 × 1200, mit 30 Bildern/s aufgenommen. Alternativ auf dem iPad mit der eingebauten Bildschirmaufnahme und dann auf 1600 × 1200 zugeschnitten — das geht aber nur verlustfrei, wenn das Seitenverhältnis passt (4:3).

**Empfehlung:** Zum Start nur Bilder, das Video nachreichen. Bilder sind Pflicht, das Video nicht — und ein schlechtes Video schadet mehr als keins.

---

## 3. App-Icon

Was Apple und die Praxis verlangen:
- **1024 × 1024 Pixel**, PNG, **quadratisch, ohne abgerundete Ecken** — die Rundung setzt das System selbst.
- **Ohne Transparenz** (kein Alphakanal). App Store Connect weist Icons mit Alphakanal erfahrungsgemäß ab; Apples Seiten zur Produktseite sagen dazu nichts Ausdrückliches.
- Einfach und auf jeder Größe erkennbar, ohne unnötige Details ([Product page](https://developer.apple.com/app-store/product-page/)).
- Seit iOS 26 können Icons in Ebenen gebaut werden (Werkzeug „Icon Composer“, nur auf dem Mac) für Dunkel- und Glas-Darstellung. Für den Start reicht ein einzelnes 1024er-Bild; das System leitet die Varianten ab. ([Human Interface Guidelines — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons))

**Befund am vorhandenen Icon** (`v1/public/icon-1024.png`): 1024 × 1024, aber **mit Alphakanal (RGBA)**. Für Apple muss es ohne Alphakanal gespeichert werden — kleine Arbeit, wird beim iOS-Build erledigt.

**Gestalterisch:** Das heutige Icon ist ein grau-grüner Greifer auf fast schwarzem Grund mit gelbem Streifen. Auf dem Homescreen ist es klein und dunkel; der Greifer hebt sich wenig ab. Vorschläge zur Wahl:
- (a) so lassen, nur Alphakanal entfernen — schnell, sicher;
- (b) Greifer heller und größer, bis fast an den Rand, Hintergrund ein dunkles Firmengrün (`#2f7a4f` wie die Rost-&-Reibach-Mulden);
- (c) Greifer mit einem Autowrack in den Schalen — erzählt mehr, wird aber klein unleserlich.

*Empfehlung: (b).* Entscheidung bei dir.

---

## Fragen an dich

1. **Dürfen wir die Bildschirmfotos am PC in den Pflichtgrößen aufnehmen** (echtes Spiel, nur anderes Fenster)? *Empfehlung: ja — anders kommen wir ohne die passenden Apple-Geräte nicht an die Größen.*
2. **Welche Motive, welche Reihenfolge?** *Empfehlung: wie oben, 1–3 unverändert.*
3. **Vorschauvideo zum Start oder später?** *Empfehlung: später.*
4. **Icon:** (a), (b) oder (c)? *Empfehlung: (b).*
