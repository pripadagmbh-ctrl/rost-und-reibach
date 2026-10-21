# Datenschutz — Erklärung, Apple-Angaben, Prüfliste

Stand 19.10.2026, Anbieter seit 21.10.2026 (E-194) Privatperson. **Das hier ist ein Entwurf, keine Rechtsberatung.** Er beschreibt ehrlich, was das Spiel technisch tut; ob er rechtlich ausreicht, muss jemand prüfen, der das darf (Liste am Ende).

## Was das Spiel tatsächlich tut — die Grundlage für alles Weitere

Nachgeschaut im Code am 19.10.2026:

- **Kein Netz.** Das Spiel lädt keine Daten aus dem Internet und schickt nichts weg. Die einzige Ladeanweisung (`fetch` in `src/audio/audioManager.ts`) holt die Klangdateien aus dem eigenen App-Paket. `index.html` bindet keine fremden Schriften, Skripte oder Zähler ein.
- **Kein Konto, keine Werbung, keine Analyse, keine Käufe im Spiel.**
- **Gespeichert wird nur auf dem Gerät:** Spielstand, Steuerungsbelegung, Lautstärke (`localStorage`, `src/core/save.ts`, `src/core/controlConfig.ts`, `src/audio/lautstaerke.ts`). Das bleibt im Speicher der App und verschwindet, wenn man die App löscht.

**Bedingung:** Das gilt nur, solange der iOS-Build das Spiel **aus dem App-Paket** lädt und nicht von GitHub Pages. Wer den iOS-Build macht, muss das sicherstellen (siehe `pruefliste.md`).

---

## Wo die Erklärung liegen muss

Apple verlangt eine **öffentlich erreichbare Adresse (URL)** der Datenschutzerklärung — auch wenn nichts erhoben wird ([App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)). Zusätzlich muss **im Spiel selbst** ein Link darauf stehen ([Richtlinie 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)).

**Entschieden (E-171, Adresse E-194):** Die Erklärung liegt auf GitHub Pages neben dem Spiel und zugleich im App-Paket:
[pripadagmbh-ctrl.github.io/rost-und-reibach/v1/datenschutz.html](https://pripadagmbh-ctrl.github.io/rost-und-reibach/v1/datenschutz.html).
GitHub protokolliert beim Aufruf im Browser IP-Adressen — das steht als Abschnitt 7 auf der Seite. Der Kontoname `pripadagmbh-ctrl` in der Adresse ändert sich noch, wenn Patrick das GitHub-Konto umbenennt; dann diese Adresse auch in App Store Connect nachziehen.

Im Spiel: Knopf **„Datenschutz“** im Pausenmenü (E-171), zeigt die Seite aus dem App-Paket.

**Maßgeblich ist die Seite `v1/public/datenschutz.html`.** Die Texte unten sind der Entwurf vom 19.10.; der Abschnitt „Verantwortlicher“ ist seit E-194 auf die Privatperson umgestellt, alles andere steht auf der Seite in neuerer Fassung (u. a. Abschnitt 7 „Diese Webseite“).

---

## Datenschutzerklärung — Deutsch

> Platzhalter in [eckigen Klammern] bitte ersetzen.

```
Datenschutzerklärung für die App „Rost & Reibach“

Stand: [Datum]

1. Verantwortlicher
[Vor- und Nachname]
[Anschrift]
Deutschland
E-Mail: [E-Mail]
Telefon: [Telefon]

2. Kurz gesagt
Die App erhebt keine personenbezogenen Daten. Sie braucht kein Konto, zeigt keine Werbung, enthält keine Analyse- oder Tracking-Werkzeuge und baut während des Spielens keine Verbindung zum Internet auf. Wir erhalten von der App keinerlei Daten über Sie.

3. Was auf Ihrem Gerät gespeichert wird
Damit Sie dort weiterspielen können, wo Sie aufgehört haben, speichert die App Ihren Spielstand, Ihre Tastenbelegung und Ihre Lautstärke-Einstellungen ausschließlich lokal im Speicher der App auf Ihrem Gerät. Diese Daten verlassen das Gerät nicht und sind für uns nicht einsehbar. Sie werden gelöscht, wenn Sie die App löschen.

Falls Sie in den Einstellungen Ihres Geräts Datensicherungen (z. B. iCloud-Backup) eingeschaltet haben, kann Apple diese Daten im Rahmen Ihrer Gerätesicherung mitsichern. Darauf haben wir keinen Zugriff; es gilt die Datenschutzerklärung von Apple.

4. Kauf und Download über den App Store
Kauf, Bezahlung und Download der App wickelt Apple ab. Dabei verarbeitet Apple Daten in eigener Verantwortung nach der Datenschutzrichtlinie von Apple (https://www.apple.com/legal/privacy/). Wir erhalten von Apple keine personenbezogenen Daten über Sie, sondern nur zusammengefasste Verkaufszahlen.

5. Absturzberichte
Wenn Sie in den Einstellungen Ihres Geräts erlaubt haben, Analysedaten mit App-Entwicklern zu teilen, stellt Apple uns gegebenenfalls Absturzberichte und Nutzungsstatistiken zur Verfügung, die keinen Rückschluss auf Ihre Person zulassen. Diese Freigabe steuern allein Sie in den Einstellungen Ihres Geräts.

6. Kontakt per E-Mail
Wenn Sie uns schreiben, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer Nachricht nur, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO). [Speicherdauer: z. B. Löschung nach Erledigung, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.]

7. Ihre Rechte
Sie haben nach der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Da die App keine Daten über Sie an uns übermittelt, liegen uns aus der Nutzung der App keine Daten über Sie vor. Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel bei der für uns zuständigen Behörde: [Name der Landesdatenschutzbehörde am Wohnsitz].

8. Änderungen
Ändert sich die App so, dass Daten verarbeitet werden, passen wir diese Erklärung vorher an.
```

## Privacy Policy — English

```
Privacy Policy for the app "Rost & Reibach"

Last updated: [date]

1. Controller
[Vor- und Nachname]
[Anschrift]
Germany
Email: [E-Mail]
Phone: [Telefon]

2. In short
The app does not collect any personal data. It requires no account, shows no ads, contains no analytics or tracking tools and does not connect to the internet while you play. We receive no data about you from the app.

3. What is stored on your device
So that you can continue where you left off, the app stores your game progress, control layout and volume settings only locally in the app's storage on your device. This data never leaves your device and we cannot access it. It is deleted when you delete the app.

If you have enabled device backups (e.g. iCloud Backup), Apple may include this data in your device backup. We have no access to it; Apple's privacy policy applies.

4. Purchase and download via the App Store
Apple handles the purchase, payment and download of the app and processes data under its own responsibility according to Apple's privacy policy (https://www.apple.com/legal/privacy/). We do not receive personal data about you from Apple, only aggregated sales figures.

5. Crash reports
If you have allowed your device to share analytics with app developers, Apple may provide us with crash reports and usage statistics that do not identify you. You alone control this setting on your device.

6. Contact by email
If you email us, we process your email address and the content of your message only to answer your request (Art. 6(1)(b) or (f) GDPR). [Retention: e.g. deleted once resolved, unless statutory retention obligations apply.]

7. Your rights
Under the GDPR you have the right of access, rectification, erasure, restriction of processing, data portability and objection. Because the app does not transmit any data about you to us, we hold no data about you from your use of the app. You also have the right to lodge a complaint with a data protection supervisory authority, for example the authority responsible for us: [name of the state data protection authority].

8. Changes
If the app changes in a way that involves processing data, we will update this policy beforehand.
```

---

## Apples „App Privacy“-Angaben (Datenschutz-Etikett im Store) **[du]**

In App Store Connect → deine App → **App Privacy** → **Get Started**:

| Frage | Antwort |
|---|---|
| Do you or your third-party partners collect data from this app? | **„No, we do not collect data from this app“** → **Save** → **Publish** |
| Privacy Policy URL | die Adresse von oben (je Sprache eintragbar) |
| Privacy Choices URL | leer lassen (freiwillig) |

Danach steht im Store **„Keine Daten erfasst“ / „Data Not Collected“**.

Warum das stimmt: Apple zählt nur als „erfasst“, was **das Gerät verlässt** und gespeichert wird. Was nur auf dem Gerät bleibt, gilt ausdrücklich nicht als erfasst: „Data that is processed only on device is not 'collected'“. ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/))

Für den iOS-Build gehört dazu eine **Privacy-Manifest-Datei** (`PrivacyInfo.xcprivacy`): kein Tracking, keine erhobenen Daten, und — falls die verwendeten Bausteine (Capacitor) bestimmte Systemfunktionen nutzen — deren Begründung. Ohne sie lehnt App Store Connect den Upload ab ([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). Das ist Sache des iOS-Builds.

---

## Was du rechtlich prüfen lassen solltest

Ich kann den Stand der Technik ehrlich beschreiben, aber nicht sagen, ob er rechtlich genügt. Prüfen lassen — Datenschutz/IT-Recht durch Anwalt oder Datenschutzberater, Steuerliches durch den Steuerberater:

1. **Die Datenschutzerklärung** (`v1/public/datenschutz.html`) — insbesondere Abschnitt 5 (Absturzberichte über Apple) und 6 (E-Mail-Kontakt).
2. **Impressum / Anbieterkennzeichnung (§ 5 DDG):** Wer ein kostenpflichtiges Angebot macht, braucht vermutlich ein Impressum mit **ladungsfähiger Anschrift** (kein Postfach), E-Mail und einem zweiten schnellen Kontaktweg (meist Telefon) — auch als Privatperson. Seit E-194 steht ein Impressum mit Platzhaltern auf der Support-Seite (`v1/public/support.html#impressum`), erreichbar im Spiel über den Knopf „Support“. Prüfen lassen: Reicht das, und muss es die Wohnanschrift sein (oder geht eine Geschäfts- bzw. Zustelladresse)?
3. **DSA-Händlerangaben** — welche Telefonnummer/E-Mail öffentlich stehen (siehe `apple-konto.md`, 3d) — sie werden im EU-Store öffentlich.
4. **Markenrecht:** Ist „Rost & Reibach“ als App-Name unbedenklich, und soll „Rost & Reibach“ für Spiele (Klasse 9/41) schützen lassen? Recherche beim DPMA/EUIPO.
5. **Klänge:** Alle CC0 außer einer Pixabay-Aufnahme (Pixabay Content License: Einbau ins Spiel erlaubt, die Datei für sich allein weitergeben nicht). Quellen: `v1/public/ton/QUELLEN.md`. Bestätigen lassen, dass ein **kostenpflichtiges** Spiel davon gedeckt ist ([Pixabay-Lizenz](https://pixabay.com/service/license-summary/)).
6. **Fremde Software im Spiel:** Three.js (MIT-Lizenz), Rapier (Apache-2.0), Capacitor (MIT). Diese Lizenzen verlangen, dass ihr Lizenztext mitgeliefert wird. Vorschlag: Seite „Lizenzen“ im Pausenmenü — Arbeit im Spiel.
7. **Steuer:** Gewerbeanmeldung nötig? Wie die Auszahlungen von Apple zu versteuern sind (Einkommensteuer, Umsatzsteuer/Kleinunternehmerregelung, W-8BEN). Apple verweist dafür selbst auf den Steuerberater ([Understanding taxes](https://developer.apple.com/help/app-store-connect/making-payments-to-apple/understanding-taxes)).
8. **Verbraucherrecht beim Verkauf** (Widerruf, Gewährleistung): Den Verkauf wickelt Apple ab; prüfen lassen, ob du als Händler darüber hinaus etwas angeben muss.

## Fragen an dich

1. **Wer prüft die Texte rechtlich?** (Anwalt, Datenschutzberater, IHK-Merkblatt …)
2. **Name, Anschrift, Telefon und die neue Spiel-E-Mail** für Datenschutz und Impressum — sobald es sie gibt.
