# Veröffentlichung im App Store (iPhone und iPad)

Stand: 19.10.2026 (Entscheidung E-161). Diese Anleitung beschreibt den Weg vom
Spiel in `v1/` bis zur Testversion in TestFlight und weiter in den App Store —
**ohne eigenen Mac**. Gebaut wird in der Cloud: GitHub leiht sich für jeden Bau
einen Mac, baut die App und gibt ihn danach zurück.

Die Schritte mit **[du]** kann nur der Kontoinhaber selbst ausführen. Wie man
das Apple-Entwicklerkonto bekommt (D-U-N-S, Mitgliedschaft, Verträge, Bank),
steht in `v1/docs/store/apple-konto.md`. Diese Anleitung setzt dort an, wo das
Konto freigeschaltet ist.

Vergleich: Das Spiel ist bisher eine Webseite. Für den App Store wird es in
eine dünne iOS-Hülle gesteckt (Capacitor), wie ein Bild in einen Rahmen. Das
Bild bleibt dasselbe; der Rahmen sorgt für Icon, Startbild, Querformat und
dafür, dass alles im Gerät liegt und ohne Netz läuft.

## 1. Was schon fertig ist

- **iOS-Projekt** `v1/ios/` — liegt im Repo. Es wurde auf Windows erzeugt; seit
  Capacitor 8 braucht das keinen Mac mehr (Swift Package Manager statt
  CocoaPods).
- **Einstellungen der App** (`v1/ios/App/App/Info.plist`):
  - nur **Querformat** (links und rechts herum), iPhone und iPad
  - **Vollbild**, auf dem iPad kein geteilter Bildschirm
  - **keine Statusleiste** (Uhr, Akku)
  - **keine Berechtigungen**: kein Mikrofon, keine Kamera, keine Ortung
  - **Verschlüsselung: nein** — die Exportfrage bei jedem Upload ist damit
    schon beantwortet
  - Sprachen **Deutsch und Englisch** angemeldet
  - **ab iOS 16** — siehe Abschnitt 8
- **App-Icon** aus `v1/public/icon-1024.png`, ohne Transparenz (Apple lehnt
  sonst ab). **Startbild**: dunkler Hintergrund `#1a1c1e`, das Icon in der
  Mitte. Beides erzeugt `npm run ios:bilder` aus dem vorhandenen Icon — keine
  neue Grafik.
- **Offline**: Alles, was das Spiel lädt — Programm, Physik (Rapier), Töne,
  Icons — steckt im App-Paket. Es wird nichts aus dem Netz geholt, keine
  Schriften, kein CDN.
- **Cloud-Bau** `.github/workflows/ios.yml` mit zwei Teilen:
  1. **simulator** — baut die App für den iPhone-Simulator, ohne Signatur. Das
     beweist: Es kompiliert. Läuft schon heute, ohne Apple-Konto.
  2. **testflight** — baut, signiert und lädt die App zu Apple hoch. Wartet,
     bis die vier Geheimnisse (Abschnitt 4) eingetragen sind; bis dahin wird
     er übersprungen (grau, kein Fehler).

Der Cloud-Bau läuft **nicht** bei jedem Speichern auf `main`. Die Webseite
(GitHub Pages) wird davon nicht berührt.

## 2. Bundle-ID anlegen **[du]**

Die Bundle-ID ist der feste Name der App bei Apple, wie ein Kennzeichen. Sie
lautet `de.pripada.schrottplatz` und lässt sich nach dem ersten Upload nie mehr
ändern.

1. [developer.apple.com/account](https://developer.apple.com/account) →
   **Certificates, IDs & Profiles** → **Identifiers** → blaues **+**
2. **App IDs** → Continue → **App** → Continue
3. Description: `Schrottplatz` · Bundle ID: **Explicit**,
   `de.pripada.schrottplatz`
4. Bei den Capabilities **nichts** anhaken → Continue → **Register**

## 3. App in App Store Connect anlegen **[du]**

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps**
   → **+** → **Neue App**
2. Plattform: **iOS**
3. Name: **Pripada Schrottplatz** (so heißt die App im Store; der Name muss im
   ganzen Store einmalig sein)
4. Primärsprache: **Deutsch**
5. Bundle-ID: `de.pripada.schrottplatz` aus der Liste wählen
6. SKU: `schrottplatz-ios` (eine interne Nummer, sieht niemand)
7. Benutzerzugriff: **Voller Zugriff** → **Erstellen**

## 4. Die vier Geheimnisse für GitHub **[du]**

Damit GitHub in deinem Namen bei Apple hochladen darf, braucht es einen
**API-Schlüssel** — wie ein Zweitschlüssel, den du dem Spediteur gibst. Er
kann nur das, was du ihm erlaubst, und du kannst ihn jederzeit sperren.

Mach das am **Windows-PC**, nicht am iPad: Du musst eine Textdatei öffnen und
ihren Inhalt kopieren.

### 4a. API-Schlüssel erzeugen

1. [App Store Connect → Benutzer und Zugriff → Integrationen](https://appstoreconnect.apple.com/access/integrations/api)
   (englisch: Users and Access → Integrations → App Store Connect API)
2. Beim ersten Mal: **Zugriff anfordern** und bestätigen (nur der
   Kontoinhaber kann das).
3. Reiter **Team-Schlüssel** → **+** (Schlüssel generieren)
4. Name: `GitHub Bau` · Zugriff: **Admin**
   *Warum Admin:* Nur damit darf GitHub das Signaturzertifikat bei Apple
   selbst anlegen. Mit weniger Rechten müsstest du Zertifikate von Hand
   erzeugen — dafür bräuchte man einen Mac.
5. **Generieren**. In der Zeile des neuen Schlüssels:
   - **Schlüssel-ID** (10 Zeichen, z. B. `AB12CD34EF`) → notieren
   - oben über der Tabelle: **Issuer ID** (lang, mit Bindestrichen) → notieren
   - **API-Schlüssel herunterladen** → Datei `AuthKey_AB12CD34EF.p8`.
     **Das geht nur ein einziges Mal.** Datei sicher ablegen (wie den
     Android-Signaturschlüssel: zwei Orte, nicht ins Repo).

### 4b. Team-ID nachsehen

[developer.apple.com/account](https://developer.apple.com/account) →
**Membership details** → **Team ID** (10 Zeichen) → notieren.

### 4c. In GitHub eintragen

1. [GitHub → Repo → Settings → Secrets and variables → Actions](https://github.com/pripadagmbh-ctrl/schrottplatz-app/settings/secrets/actions)
2. Viermal **New repository secret**, Name genau so schreiben:

| Name | Inhalt |
| --- | --- |
| `ASC_KEY_ID` | die Schlüssel-ID aus 4a |
| `ASC_ISSUER_ID` | die Issuer ID aus 4a |
| `ASC_KEY_P8` | die `.p8`-Datei mit dem **Editor** öffnen, **alles** markieren (Strg+A), kopieren, einfügen — inklusive der Zeilen `-----BEGIN PRIVATE KEY-----` und `-----END PRIVATE KEY-----` |
| `APPLE_TEAM_ID` | die Team-ID aus 4b |

GitHub zeigt eingetragene Geheimnisse nie wieder an, auch dir nicht. Tippfehler
behebt man durch Überschreiben (**Update**).

## 5. Einen Bau starten

**Von Hand** (geht, sobald `ios.yml` auf `main` liegt):

1. [GitHub → Actions → „iOS-App bauen“](https://github.com/pripadagmbh-ctrl/schrottplatz-app/actions/workflows/ios.yml)
2. Rechts **Run workflow** → Branch wählen (meist `main`) → grüner Knopf
   **Run workflow**

**Automatisch**: Jeder Push auf einen Branch, dessen Name mit `ios/` beginnt
(z. B. `ios/testflight-1`), startet den Bau. Das macht der Orchestrator.

Ein Bau dauert etwa 10–20 Minuten. Grüner Haken = fertig. Rotes Kreuz = Fehler;
dann den Lauf anklicken und den roten Schritt dem Orchestrator schicken.

**Versionsnummern** zählen von selbst: Die Buildnummer ist die Laufnummer
(z. B. `14.1`). Die Fassung im Store (`1.0`) steht oben in `ios.yml` unter
`APP_VERSION` und wird nur für ein neues Store-Update erhöht.

## 6. TestFlight: die App aufs eigene Gerät **[du]**

1. Nach einem grünen Bau mit Teil **testflight**:
   [App Store Connect](https://appstoreconnect.apple.com) → **Apps** →
   **Pripada Schrottplatz** → **TestFlight**. Der Build erscheint nach
   5–30 Minuten („Wird verarbeitet“, danach „Bereit zum Testen“).
2. Links **Interne Tests** → **+** → Gruppe `Pripada` → dich selbst als Tester
   hinzufügen → den Build der Gruppe zuweisen.
3. Auf iPad und iPhone die App
   [TestFlight](https://apps.apple.com/de/app/testflight/id899247664) aus dem
   App Store laden, mit derselben Apple-ID anmelden → **Installieren**.

Interne Tests brauchen keine Prüfung durch Apple; die Version ist sofort da.

## 7. In den App Store **[du]**

Wenn TestFlight auf beiden Geräten passt: In App Store Connect bei der App die
Store-Seite ausfüllen (Texte, Bilder, Preis, Altersfreigabe, Datenschutz —
Vorlagen unter `v1/docs/store/`), den Build auswählen und **Zur Prüfung
einreichen**.

## 8. Technische Entscheidungen (zum Nachlesen)

- **Capacitor 8.5.2**: aktuelle Hauptversion, über fünf Wochen alt (8.5.3 kam
  erst am 07.10.); braucht Node 22, das läuft auch beim Pages-Bau. Seit Version
  8 entsteht das iOS-Projekt ohne Mac.
- **Ab iOS 16**: Capacitor verlangt mindestens 15. WebGL2, WebAssembly und AAC
  gibt es dort überall. Mit 16 fallen Geräte weg, die nur 2 GB Speicher haben
  und das Spiel ohnehin nicht flüssig liefen (iPhone 6s/7, iPad Air 2). Das
  iPhone 12/13 mini bekommt iOS 26 und ist weit darüber.
- **Signatur ohne Mac**: Xcode signiert mit dem API-Schlüssel selbst
  („Cloud Signing“) und lädt direkt hoch. Verworfen: *fastlane match* — braucht
  ein zweites Repo für Zertifikate und ein Passwort mehr, das man verlieren kann.
- **Name unter dem Icon**: `Schrottplatz` — „Pripada Schrottplatz“ wäre auf
  dem Home-Bildschirm zu „Pripada Schr…“ abgeschnitten. Im Store steht der volle
  Name. Frage an dich offen (E-161).

## 9. Was erst mit dem Apple-Konto geht

- Abschnitte 2, 3, 4, 6 und 7
- Der erste echte Lauf des Teils **testflight**. Bis dahin ist er vorbereitet,
  aber nie gelaufen — der erste Lauf ist auch sein Test.
