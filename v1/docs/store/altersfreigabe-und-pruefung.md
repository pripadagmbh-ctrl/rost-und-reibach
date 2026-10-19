# Altersfreigabe, Verschlüsselung, Hinweise für die Prüfer, Adressen

Stand 19.10.2026. Entwurf; eingetragen wird in App Store Connect **[du]**.

## 1. Altersfreigabe

### Was sich geändert hat
Seit Juli 2025 gibt es bei Apple die Stufen **4+, 9+, 13+, 16+, 18+** (12+ und 17+ sind weggefallen), und der Fragebogen ist neu. Wer die neuen Fragen nicht beantwortet hatte, durfte nach dem 31.01.2026 keine Updates mehr einreichen. Für eine neue App heißt das einfach: den neuen Fragebogen ausfüllen. Ohne Altersfreigabe kein Store („Unrated“ darf nicht in den App Store).
Quellen: [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/), [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

Weg: App Store Connect → App → **App Information** → **Age Ratings** → **Set Up Age Ratings**.

### Antworten

Der Fragebogen fragt erst nach Funktionen, dann je Inhalt nach der Häufigkeit (keine / selten = Infrequent / häufig = Frequent) oder Ja/Nein. Die Gruppen unten sind Apples Gruppen; der genaue Wortlaut in App Store Connect kann leicht abweichen.

| Gruppe | Frage | Antwort | Warum |
|---|---|---|---|
| In-App Controls | Parental Controls | **nein** | gibt es nicht |
| | Age Assurance | **nein** | gibt es nicht |
| Capabilities | Unrestricted Web Access | **nein** | kein Browser im Spiel. Der geplante Datenschutz-Link muss **Safari außerhalb des Spiels** öffnen, nicht ein Browserfenster im Spiel |
| | User-Generated Content | **nein** | Spieler teilen nichts |
| | Social Media | **nein** | |
| | Messaging and Chat | **nein** | |
| | Advertising | **nein** | keine Werbung. Die Rost-&-Reibach-Schilder auf dem Platz tragen den Spielnamen und sind Kulisse, keine Werbeeinblendung |
| Mature Themes | Profanity or Crude Humor | **keine** | |
| | Horror/Fear Themes | **keine** | |
| | Alcohol, Tobacco, or Drug Use or References | **keine** | |
| Medical or Wellness | Medical or Treatment Information | **keine** | |
| | Health or Wellness Topics | **nein/keine** | |
| Sexuality or Nudity | alle drei Fragen | **keine** | |
| Violence | Cartoon or Fantasy Violence | **keine** | Zerstört werden nur Gegenstände (Autowracks, Schrott). Gewalt meint bei Apple Gewalt gegen Lebewesen |
| | Realistic Violence | **keine** | wie oben |
| | Prolonged Graphic or Sadistic Realistic Violence | **keine** | |
| | Guns or Other Weapons | **keine** | |
| Chance-Based Activities | Gambling | **nein** | |
| | Simulated Gambling | **keine** | |
| | Contests | **keine** | Apple meint Wettbewerbe „with one another“. Die Sterne der Aufgaben sind persönliche Ziele ohne Rangliste. Wer vorsichtig sein will, wählt „selten“ — das ergibt immer noch 4+ |
| | Loot Boxes | **nein** | |
| Age Categories and Override | | **Not Applicable** | Keine Kinder-App („Made for Kids“ würde strenge Zusatzregeln bringen und lässt sich nach Freigabe nicht zurücknehmen) |

**Ergebnis: 4+.** Laut Apple bekommt eine App ohne bedenkliche Inhalte 4+ ([Definitionen](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)).

**Vor dem Ausfüllen am Build prüfen:** Gibt es im Sandkasten Menschen-Figuren, die man mit dem Greifer treffen, umwerfen oder quetschen kann? Wenn ja, ist das „Cartoon or Fantasy Violence“ und mindestens 9+. Nach heutigem Stand sind die Figuren im Simulator abgeschaltet (`src/core/spielart.ts`).

Korea kann später eine eigene Einstufung verlangen; das meldet Apple dann.

---

## 2. Exportkontrolle / Verschlüsselung

Die USA kontrollieren die Ausfuhr von Verschlüsselungs-Software; Apple fragt deshalb bei jeder App danach. Das Spiel verschlüsselt nichts selbst und baut keine Verbindungen auf.

**Für den iOS-Build:** In die `Info.plist` gehört

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Dann fragt App Store Connect nicht bei jedem Build neu. Falls die Frage doch kommt („What type of encryption algorithms does your app implement?“): **„None of the algorithms mentioned above“**. Keine Unterlagen nötig.

Quellen: [Overview of export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/), [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations). Apple betont, dass die Einschätzung in deiner Verantwortung liegt; für eine Offline-App ohne eigene Verschlüsselung ist „nein“ der übliche Fall.

---

## 3. Hinweise für die Prüfer (App Review → Notes)

Englisch, weil die Prüfer international sind. Höchstens 4000 Byte ([Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)). **Vor dem Einreichen am Build gegenlesen** — Knopfnamen und Sticks müssen genau stimmen.

Weitere Felder im Abschnitt **App Review Information**:
- **Sign-in required:** nein (kein Konto) — kein Demo-Zugang nötig.
- **Contact:** dein Name, Telefon, E-Mail (nur für Apple sichtbar) **[du]**.

```
Rost & Reibach is a complete, self-contained 3D simulation game. All assets are bundled in the app; it works fully offline, requires no account, contains no ads and no in-app purchases, and collects no data.

The game is played in LANDSCAPE on iPhone and iPad. Best tested on iPad.

HOW TO PLAY (about 2 minutes)
1. The game opens directly on a scrapyard (sandbox). You control a material handler (a scrap-handling excavator) with a five-tine grapple.
2. Touch controls: put a thumb anywhere on the LEFT half of the screen – a stick appears under your thumb. Left/right slews the machine, up/down raises/lowers the boom.
3. RIGHT half: up/down moves the stick in/out. Push right to CLOSE the grapple, push left to OPEN it.
4. Lower the open grapple onto a pile of scrap, close it, lift, slew to a skip and open it to drop the load.
5. The buttons ↺ / ↻ rotate the grapple. One finger in the middle strip between the sticks orbits the camera, pinch zooms. Double-tap on the right switches between cab view and outside view.
6. The menu button (☰) opens the pause menu (controls, volume, save/load, privacy policy).
7. Further functions are on the button ring: e.g. SCHERE operates the baling press, NACHSCHUB brings a new truck load.
[8. "Aufgaben"/"Tasks": short tasks with up to three stars; the first one teaches the controls.]

The user interface is in [German only / German and English]. The grapple physics (load swinging, weight, reach) is intentional – it takes a few tries to place loads precisely.

Sounds are CC0 recordings (BigSoundBank, OpenGameArt, Kenney) and one recording under the Pixabay Content License. 3D rendering uses WebGL inside the app; no remote content is loaded.
```

Die eckigen Klammern beim Einreichen auflösen: Zeile 8 nur, wenn Aufgaben im Build sind; Sprache passend eintragen. Der Hinweis „privacy policy“ im Pausenmenü setzt voraus, dass der Knopf gebaut ist.

Warum der erste Absatz so betont, dass alles im Paket liegt: Apple lehnt Apps ab, die nur eine „umverpackte Website“ sind ([Richtlinie 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)). Das Spiel läuft technisch in einer Web-Ansicht. Das ist erlaubt, wenn es ein vollständiges, eigenständiges Spiel ist — genau das sagt der Absatz, und genau das muss der Build auch sein (lädt nichts von GitHub Pages).

---

## 4. Adressen, Copyright, Kontakt

| Feld | Pflicht? | Vorschlag | Quelle |
|---|---|---|---|
| **Support URL** | ja | `https://www.pripada.de/app.html` (neue Seite, Entwurf unten). Muss echte Kontaktangaben zeigen | [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/), [Richtlinie 1.5](https://developer.apple.com/app-store/review/guidelines/#developer-information) |
| **Marketing URL** | nein | `https://www.pripada.de` oder leer | ebd. |
| **Privacy Policy URL** | ja | siehe `datenschutz.md` | [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) |
| **Copyright** | ja | `2026 Pripada GmbH` (das © setzt Apple selbst davor) | [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) |
| **Kontakt für die Prüfer** | ja | Name, Telefon, E-Mail **[du]** | [App Review](https://developer.apple.com/distribute/app-review/) |
| **Content Rights** | ja | „enthält Inhalte Dritter: **ja**“ (Klänge, freie Software) und „Rechte vorhanden: **ja**“ | [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) |

Wenn pripada.de nicht erweiterbar ist: Support- und Datenschutzseite können auch auf GitHub Pages liegen; die Support-Seite muss dann trotzdem Firmenanschrift und E-Mail zeigen und auf das Impressum von pripada.de verweisen.

### Entwurf Support-Seite (`pripada.de/app.html`)

```
Rost & Reibach – Hilfe und Kontakt

Fragen, Fehler, Ideen? Schreiben Sie uns: [kontakt@pripada.de]
Wir antworten in der Regel innerhalb von [zwei Werktagen].

Häufige Fragen
· Wie greife ich? Rechte Bildschirmhälfte: Daumen nach rechts schließt den Greifer, nach links öffnet er.
· Wo ist mein Spielstand? Nur auf Ihrem Gerät. Wenn Sie die App löschen, ist er weg.
· Braucht das Spiel Internet? Nein.
· Gibt es Werbung oder Käufe im Spiel? Nein.

Datenschutz: [Link]
Impressum: https://www.pripada.de/impressum.html

Pripada GmbH · [Straße] · [PLZ Ort]
```

(Englische Fassung derselben Seite, falls Englisch zum Start kommt.)

---

## Fragen an dich

1. **Kann auf pripada.de eine Seite `app.html` (Support) und eine Datenschutzseite angelegt werden?** Wer pflegt die Website? *Empfehlung: ja, dort; sonst GitHub Pages.*
2. **Welche Telefonnummer gibst du Apple für Rückfragen der Prüfer?** (nicht öffentlich)
