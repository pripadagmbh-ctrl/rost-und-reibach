# Veröffentlichung im Google Play Store

Stand: 29.08.2026. Diese Anleitung beschreibt den Weg vom fertigen Web-Build
zum Eintrag im Play Store. Alles, was im Projekt vorbereitet werden konnte,
ist vorbereitet; die Schritte mit **[du]** kann nur der Kontoinhaber selbst
ausführen.

## 1. Was schon fertig ist

- **Web-App** läuft und ist unter der GitHub-Pages-Adresse spielbar
- **manifest.webmanifest** mit Name, Farben, Vollbild und Querformat
- **App-Icons** (192, 512, maskierbar 512, 1024) — erzeugt aus Code über
  `npm run icons`, kein Grafikprogramm nötig
- **capacitor.config.json** mit der Anwendungskennung — für die Store-Fassung
  (`v1/`) seit E-194 (21.10.2026) `de.rostundreibach.app`; der eingefrorene
  Prototyp trägt noch die alte Kennung `de.pripada.schrottplatz`
- **Skripte** in `prototype/package.json`: `android:add`, `android:sync`,
  `android:open`

## 2. Android-Projekt anlegen

Einmalig, im Ordner `prototype/`:

```bash
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android
npm run android:add
```

Danach existiert `prototype/android/` als vollwertiges Android-Studio-Projekt.
Nach jeder Spieländerung genügt:

```bash
npm run android:sync
```

Voraussetzungen auf dem Rechner: **Android Studio** samt SDK und ein **JDK 17**.
Beides ist kostenlos.

## 3. Signaturschlüssel **[du]**

Der Schlüssel beweist, dass Aktualisierungen von dir stammen. Geht er
verloren, lässt sich die App nicht mehr aktualisieren — sichere ihn an zwei
Orten und notiere die Passwörter im Passwortmanager.

```bash
keytool -genkey -v -keystore rostundreibach-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rostundreibach
```

Die Datei gehört **nicht** ins Git-Verzeichnis. Trage sie in Android Studio
unter *Build → Generate Signed Bundle* ein.

## 4. Paket bauen

In Android Studio: *Build → Generate Signed Bundle / APK → Android App Bundle*.
Ergebnis ist eine `.aab`-Datei — genau die verlangt der Play Store.

Vor dem ersten Hochladen in `android/app/build.gradle` prüfen:

- `versionCode` (ganze Zahl, muss bei jeder Veröffentlichung steigen)
- `versionName` (die Fassung, die Nutzer sehen, etwa `1.0`)
- `minSdkVersion` 24 oder höher, `targetSdkVersion` auf dem von Google
  verlangten Stand

## 5. Play-Console-Eintrag **[du]**

1. Entwicklerkonto anlegen: einmalig 25 US-Dollar
2. Neue App anlegen, Sprache Deutsch, Kategorie *Spiele → Simulation*
3. Pflichtangaben ausfüllen:
   - **Datenschutzerklärung**: erforderlich, auch wenn nichts erhoben wird.
     Eine schlichte Seite genügt, die genau das aussagt.
   - **Data Safety**: Das Spiel sammelt keine Daten und sendet nichts. Der
     Spielstand liegt ausschließlich im Gerät (localStorage).
   - **Inhaltsfreigabe**: Fragebogen ausfüllen; keine Gewalt gegen Personen,
     keine Werbung, keine Käufe im Spiel.
   - **Zielgruppe**: keine Kinder-App, damit die strengeren Auflagen für
     Kinderinhalte entfallen.
4. Store-Eintrag: Kurzbeschreibung (80 Zeichen), Beschreibung (4000),
   Grafiken (siehe Abschnitt 6)
5. Preis: einmalig, Vorschlag 4,99 € — bei einer Kauf-App vor der ersten
   Veröffentlichung festlegen, ein späterer Wechsel von gratis auf kostenpflichtig
   ist nicht möglich

## 6. Benötigte Grafiken **[du]**

| Element | Format | Hinweis |
| --- | --- | --- |
| App-Symbol | 512 × 512 PNG | liegt bereit: `prototype/public/icon-512.png` |
| Funktionsgrafik | 1024 × 500 PNG | Titelbild im Store, muss noch entstehen |
| Screenshots Handy | mind. 2, quer | am besten Kabinensicht, Greifen, Presse |
| Screenshots Tablet | empfohlen | dieselben Motive in größerer Auflösung |

Screenshots lassen sich direkt aus dem Spiel aufnehmen — im Querformat, mit
eingeschalteten Schildern, damit man erkennt, was wo passiert.

## 7. Textbausteine für den Eintrag

**Kurzbeschreibung (80 Zeichen)**

> Umschlagbagger auf dem Schrottplatz: greifen, sortieren, pressen, verladen.

**Beschreibung (Entwurf)**

> Du sitzt am Steuer eines Umschlagbaggers auf dem Schrottplatz Rost & Reibach.
> Lastwagen fahren an die Waage, kippen ab und lassen dir einen Berg aus
> Blech, Kabeln, Motorblöcken und Altfahrzeugen.
>
> Mit zwei Joysticks führst du Hauptarm, Ausleger und die fünfarmige Spinne.
> Du greifst, was du fassen kannst, wirfst Stahl auf den großen Haufen und
> sortierst Aluminium, Kupfer, Edelstahl und Kabel in die Betonboxen.
> Was zu sperrig ist, kommt in die Schere und wird zu Paketen gepresst.
>
> Liegt genug auf dem Platz, macht die Einfahrt zu und du hast Ruhe zum
> Aufräumen. Danach rufst du den Abholer — und je sauberer du getrennt hast,
> desto besser fällt die Abrechnung aus.
>
> · Frei belegbare Steuerung mit zwei Sticks
> · Gewichtsphysik: alles hat Masse, alles verkantet, alles gibt nach
> · Kabinensicht mit Bordinstrument, dazu Orbit-, Seiten- und Draufsicht
> · Waage, Ankauf und Verkauf nach Sortenreinheit
> · Keine Werbung, keine Käufe im Spiel, kein Konto nötig

## 8. Was noch fehlt, bevor sich das Hochladen lohnt

Die Technik ist bereit, das Spiel aber noch nicht rund. Vor einer
Veröffentlichung sollten stehen:

1. **Geführter Einstieg** — die ersten Minuten erklären sich nicht von selbst
2. **Ziel und Fortschritt** — Upgrades, für die sich das Verdienen lohnt
3. **Längerer Spieltest auf echten Geräten** — Bildrate, Wärme, Akku
4. **Kundengruppen mit Charakter** — Privat, Gewerbe, Händler

Ohne Punkt 1 und 2 ist es eine Sandkiste, keine Kauf-App.
