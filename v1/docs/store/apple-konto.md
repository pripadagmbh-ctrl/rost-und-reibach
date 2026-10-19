# Apple-Konto für die Pripada GmbH — Schritt für Schritt

Stand 19.10.2026, geprüft an Apples eigenen Seiten (Links bei jedem Schritt). Alles mit **[du]** kann nur der Kontoinhaber selbst tun — kein Agent legt Konten an, unterschreibt oder trägt Bank- und Steuerdaten ein.

**Ziel:** App im Store bis ca. 16.11.2026. **Der Engpass ist nicht das Spiel, sondern dieses Konto.** Ohne fertiges Konto gibt es keinen TestFlight-Test und kein Einreichen. Darum: heute anfangen.

## Zeitplan rückwärts gerechnet

| Wann | Was | Wer | Wie lange laut Apple |
|---|---|---|---|
| **sofort** | Apple-ID mit @pripada.de anlegen, Zwei-Faktor einschalten | [du] | Minuten |
| **sofort** | D-U-N-S-Nummer nachschlagen | [du] | Minuten |
| falls keine da | D-U-N-S kostenlos beantragen | [du] | **bis 5 Werktage**, Eilantrag verkürzt nichts; danach **bis 2 Werktage**, bis Apple sie sieht ([Apple: D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/)) |
| danach | Mitgliedschaft beantragen (am iPad) | [du] | Apple nennt **keine Frist**; erst nach Prüfung wird bezahlt ([Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)) |
| nach Freischaltung | Paid Apps Agreement, Steuer, Bank, DSA-Händlerangaben, Small Business Program | [du] | Bankänderungen werden binnen 24 h verarbeitet ([Banking](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/)) |
| bis ca. 10.11. | Einreichen | [du] klickt, Text liegt bereit | Prüfung: 50 % unter 24 h, 90 % unter 48 h ([App Review](https://developer.apple.com/distribute/app-review/)) |

Rechnung: Ohne vorhandene D-U-N-S-Nummer sind es bis zu 7 Werktage, bevor du die Mitgliedschaft überhaupt beantragen kannst — also etwa der **28.10.** Bleibt Apples Prüfung, für die es keine Zusage gibt. Jeder Tag, den du jetzt wartest, fehlt hinten.

---

## Schritt 1 — Apple-ID mit Firmenadresse **[du]**

Apple verlangt:
- **Zwei-Faktor-Authentifizierung** ist eingeschaltet.
- **Vor- und Nachname sind dein amtlicher Name** — kein Spitzname, kein Firmenname im Namensfeld (das verzögert sonst die Freigabe).
- Die **E-Mail-Adresse gehört zur Firmendomain**: „Your work email address needs to be associated with your organization's domain name.“

Quelle: [Apple — Enroll](https://developer.apple.com/programs/enroll/)

**Wichtig für dich:** Deine bisherige Adresse `pripadagmbh@gmail.com` ist **keine** Firmendomain. Nimm eine Adresse **@pripada.de** (es gibt schon `kontakt@pripada.de`; besser eine persönliche wie `patrick@pripada.de`, weil an dieser Adresse später alle Apple-Mails und Codes hängen).

Vergleich: Die Apple-ID ist wie der Schlüssel zum Firmentor. Wer ihn hat, ist „Account Holder“ — der Einzige, der Verträge unterschreiben kann. Sie gehört an eine Adresse, die der Firma gehört, nicht an ein privates Postfach.

## Schritt 2 — D-U-N-S-Nummer **[du]**

Die D-U-N-S-Nummer ist eine neunstellige Kennung von Dun & Bradstreet, eine Art weltweite Firmen-Ausweisnummer. Apple prüft darüber, ob die Pripada GmbH wirklich als GmbH existiert und welche Anschrift sie hat.

1. Bei Apple nachschlagen: [D-U-N-S-Suche bei Apple](https://developer.apple.com/enroll/duns-lookup/). Eingeben: **genauer Firmenname laut Handelsregister** (Pripada GmbH), Sitz-Anschrift, Postanschrift, deine Kontaktdaten.
2. Gefunden → Nummer notieren, weiter mit Schritt 3.
3. Nicht gefunden → im selben Formular **kostenlos** beantragen. Dun & Bradstreet kann nachfragen (Geschäftsart, Zahl der Mitarbeiter) — **Handelsregisterauszug bereithalten**.
4. Fehlermeldung „Your organization is not listed as a legal entity“ → Dun & Bradstreet führt euch mit falscher Rechtsform; per E-Mail an D&B mit Handelsregisterauszug korrigieren lassen.

Quelle: [Apple — D-U-N-S Number](https://developer.apple.com/help/account/membership/D-U-N-S/)

**Achtung:** Der Name, den du bei Apple einträgst, muss **genau** der eingetragene Firmenname sein. Er erscheint im Store als „Verkäufer“. Markennamen, Abkürzungen oder Zweigstellen nimmt Apple nicht an.

## Schritt 3 — Mitgliedschaft beantragen, am besten am iPad **[du]**

Du hast keinen Mac — brauchst du auch nicht. Firmen können sich in der **Apple-Developer-App** auf iPhone oder iPad anmelden ([Enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/)).

Was die App verlangt:
- iPad oder iPhone mit Face ID, Touch ID oder Code; **das ganze Verfahren auf demselben Gerät** (Anmelden, später Weitermachen und Bezahlen)
- an diesem Gerät in iCloud angemeldet, App auf neuestem Stand
- **Lichtbildausweis** (Personalausweis oder Reisepass) — die App fotografiert ihn
- Rechtsform, **genauer Firmenname**, **D-U-N-S-Nummer**, Anschrift und Telefon des Firmensitzes
- **Website:** `pripada.de` — sie muss öffentlich erreichbar sein und zur Firma gehören. Social-Media-Seiten oder fast leere Seiten werden abgelehnt ([Enroll](https://developer.apple.com/programs/enroll/)). pripada.de ist am 19.10.2026 erreichbar, mit Impressum und Datenschutz.
- **Unterschriftsberechtigung:** Du musst die Firma rechtlich binden dürfen — Inhaber, Gründer, Geschäftsführung oder jemand mit erteilter Vollmacht. Bist du nicht selbst Geschäftsführer, nennst du eine Person, die das bestätigt.

Ablauf:
1. Apple-Developer-App → **Account** → mit der Apple-ID aus Schritt 1 anmelden.
2. **Enroll Now** → persönliche Angaben, Ausweisfoto.
3. Firmenangaben eintragen → absenden.
4. Apple prüft und schreibt eine E-Mail. Apple kann **beglaubigte Firmenunterlagen** nachfordern (beglaubigte Kopie, z. B. Handelsregisterauszug) — [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/).
5. Nach der Freigabe: **auf demselben Gerät** App öffnen → **Continue Your Enrollment** → Lizenzvertrag annehmen → **Subscribe**.

**Kosten:** 99 US-Dollar pro Mitgliedsjahr, angezeigt in Landeswährung ([Enroll](https://developer.apple.com/programs/enroll/)). In Deutschland sind das seit Jahren **99 €** ([ifun.de](https://www.ifun.de/99e-statt-80e-apple-erhoeht-entwickler-gebuehren-71232/)); den genauen Betrag zeigt die App vor dem Bezahlen. Über die App ist es ein **Abo, das sich jährlich verlängert**; kündbar bis einen Tag vor Verlängerung. Bezahlt wird mit einer Zahlungsart der Apple-ID, die **am Gerät** angemeldet ist — für die Firmenkarte diese dort hinterlegen. Guthaben aus Geschenkkarten zählt nicht.

**Dauer der Prüfung:** Apple nennt keine. Erfahrungsgemäß wenige Tage bis zwei Wochen — das ist eine Schätzung, keine Zusage.

## Schritt 4 — In App Store Connect: Verträge, Steuer, Bank **[du]**

Ohne diese Schritte kann die App **nur kostenlos** angeboten werden ([Set a price](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/)). Reihenfolge ist vorgegeben: erst Vertrag, dann Steuer, dann Bank.

Alles unter [App Store Connect](https://appstoreconnect.apple.com) → **Business** → Reiter **Agreements**.

### 4a. Paid Apps Agreement
Nur der Account Holder (du) darf unterschreiben. **Paid Apps** → **View and Agree to Terms** → lesen → **Agree**. Nicht rückgängig zu machen. ([Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/))

### 4b. Steuerformulare
Unter **Tax Forms** → **Add Tax Info**. Du wählst das Formular nicht selbst aus: App Store Connect stellt Fragen und schlägt das passende vor. Für eine Firma außerhalb der USA ist das in der Regel das US-Formular **W-8BEN-E** — es bestätigt, dass die GmbH keine US-Firma ist, damit die USA keine Quellensteuer einbehalten. ([Provide tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/))

Bereithalten: Firmenname, Anschrift, Steuernummer bzw. **USt-IdNr.** der GmbH. Für Deutschland nennt Apples Seite keine Sonderformulare.

**Umsatzsteuer:** Apples Steuerseite ([Understanding taxes](https://developer.apple.com/help/app-store-connect/making-payments-to-apple/understanding-taxes)) sagt zu Deutschland nichts Genaues und verweist selbst auf den Steuerberater. Wie die Auszahlungen von Apple und Apples Provision bei der GmbH zu buchen sind — **Steuerberater fragen** (siehe `datenschutz.md`, Abschnitt „Prüfen lassen“).

### 4c. Bankkonto
Unter **Bank Accounts**: Land, Bank, **Kontowährung EUR**, Kontoart, **IBAN** (ins IBAN-Feld, nicht ins Kontonummernfeld), Kontoinhaber **genau wie auf dem Konto**. Das Konto muss der GmbH gehören. Nur ein Konto gleichzeitig. ([Enter banking information](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/))

### 4d. EU-Händlerangaben (Digital Services Act) — Pflicht
Die GmbH verkauft eine App, also ist sie „Händler“ (trader). Apple zeigt dann auf der Produktseite in der EU **öffentlich**: **Anschrift** (kommt aus der D-U-N-S-Nummer), **Telefonnummer**, **E-Mail-Adresse**. Telefon und E-Mail werden per Code geprüft; dazu ein **aktuelles Dokument, das Firmenname und Anschrift belegt** (Handelsregisterauszug passt). Ohne Händlerangaben verschwindet die App aus den EU-Stores.
Weg: **Business** → **Agreements** → **Compliance** → **Digital Services Act** → **This is a trader account**.
Quellen: [DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

→ **Entscheide, welche Telefonnummer und E-Mail öffentlich stehen sollen** (Vorschlag: Festnetz des Büros und `kontakt@pripada.de`).

### 4e. Small Business Program — 15 % statt 30 % Provision
Neue Entwickler und alle unter 1 Mio. USD Erlös im Jahr zahlen Apple nur **15 %**. Das gibt es **nicht automatisch**: anmelden unter [Small Business Program](https://developer.apple.com/app-store/small-business-program/) nach dem Paid Apps Agreement. Der Satz gilt ab 15 Tage nach Ende des Geschäftsmonats, in dem Apple zustimmt — **also früh anmelden**, am besten vor dem ersten Verkauf. Gefragt wird nach „verbundenen Entwicklerkonten“ (andere Konten, an denen du über 50 % hältst) — vermutlich keine.

### 4f. Kontaktdaten
Unter **Business** bzw. **Users and Access** Ansprechpartner für Finanzen, Recht und Technik eintragen. Bei einem Ein-Personen-Konto bist das überall du.

---

## Was du bereithalten musst — nur das, was Apple wirklich verlangt

| Unterlage | Wofür | Quelle |
|---|---|---|
| Apple-ID **@pripada.de** mit Zwei-Faktor | Anmeldung | [Enroll](https://developer.apple.com/programs/enroll/) |
| **Genauer Firmenname** und Sitz-Anschrift laut Handelsregister | D-U-N-S, Verkäufername | [D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/) |
| **D-U-N-S-Nummer** | Anmeldung | ebd. |
| **Personalausweis oder Reisepass** | Anmeldung über die App | [Enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/) |
| **Aktueller Handelsregisterauszug** | Nachfragen von D&B, DSA-Nachweis; Apple kann eine **beglaubigte** Kopie verlangen | [D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/), [DSA](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/) |
| Website **pripada.de** (läuft) | Anmeldung | [Enroll](https://developer.apple.com/programs/enroll/) |
| Firmenkreditkarte | 99 €/Jahr | ebd. |
| **IBAN** des GmbH-Kontos | Auszahlung | [Banking](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/) |
| Steuernummer / **USt-IdNr.** | Steuerformular | [Tax](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/) |
| Öffentliche Telefonnummer und E-Mail | DSA-Angaben im Store | [DSA](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/) |

---

## Preis

### So funktionieren Preise bei Apple
Du wählst ein **Basisland** (Deutschland) und einen **Preispunkt** aus rund 800 festen Stufen (z. B. 2,99 €, 3,99 €, 4,99 €). Apple rechnet daraus die Preise der anderen 174 Länder aus und passt sie bei Wechselkurs- und Steueränderungen an. Den Preis kannst du jederzeit ändern. Er muss **vor dem Einreichen** gesetzt sein. ([Set a price](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/))

### Was Vergleichbare kosten (Stand 19.10.2026)

| Spiel | Anbieter | Preis | Käufe im Spiel | Quelle |
|---|---|---|---|---|
| Bau-Simulator 4 | astragon (großes Studio, viele Lizenzmaschinen, Mehrspieler) | **5,99 €** | ja, Geldpakete 0,99–29,99 € | [App Store DE](https://apps.apple.com/de/app/id1607511516) |
| Farming Simulator 23 Mobile | GIANTS | **7,99 €** ($7.99) | ja | [App Store](https://apps.apple.com/app/id6444400410), [appgefahren](https://www.appgefahren.de/farming-simulator-23-endlich-wieder-trecker-im-app-store-332552.html) |
| Excavator Simulator REMAKE | Einzelentwickler | **$4.99** | nicht angegeben | [App Store US](https://apps.apple.com/us/app/-/id6447525843) |
| Harbor Crane Challenge | Magnin & Associates | **$1.99** | nicht angegeben | [App Store](https://apps.apple.com/app/id1161136908) |
| DiggerSim Excavator Simulator | Dreamsoft | kostenlos | — | [App Store](https://apps.apple.com/app/id6503343528) |
| Junkyard City Scrap Tycoon | — | kostenlos, Käufe im Spiel | ja | [App Store](https://apps.apple.com/us/app/junkyard-city-scrap-tycoon/id6444126454) |

Die kostenlosen Schrottplatz-Spiele sind „Idle“-Spiele (man tippt, Zahlen steigen) — eine andere Sorte. Echte Bagger-Simulatoren mit Einmalpreis liegen zwischen 2 und 8 €.

### Empfehlung: **4,99 €**

- Unter dem großen Bau-Simulator (5,99 €, mit Geldpaketen), auf Höhe des Einzelentwickler-Baggers ($4.99).
- Sagt: ein ganzes Spiel, kein Spielzeug — passt zu „einmal kaufen, alles drin“.
- Rechnung je Verkauf in Deutschland (ungefähr): 4,99 € enthalten 19 % USt → 4,19 € netto; minus 15 % Provision (Small Business Program) → **rund 3,56 €** für die GmbH. Den genauen Betrag zeigt App Store Connect beim Festlegen.

**Gegenvorschlag:** 2,99 € zum Start, nach den ersten Bewertungen auf 4,99 €. Senkt die Hürde, wenn noch niemand das Spiel kennt — kostet aber 40 % je Verkauf, und eine Preiserhöhung ärgert Leute, die die alte Stufe gesehen haben.

---

## Fragen an dich

1. **Bist du Geschäftsführer der Pripada GmbH** (also selbst unterschriftsberechtigt)? Wenn nein: Wer kann deine Vollmacht bestätigen?
2. **Welche E-Mail für die Apple-ID?** *Empfehlung: eine persönliche @pripada.de-Adresse, nicht `kontakt@`, nicht Gmail.*
3. **Welche Telefonnummer und E-Mail sollen öffentlich im Store stehen** (EU-Pflicht)? *Empfehlung: Büro-Festnetz und `kontakt@pripada.de`.*
4. **Preis:** 4,99 € oder 2,99 € zum Start? *Empfehlung: 4,99 €.*
