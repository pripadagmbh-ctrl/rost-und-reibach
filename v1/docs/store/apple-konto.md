# Apple-Konto als Einzelperson — Schritt für Schritt

Stand 21.10.2026 (E-194): Patrick vertreibt „Rost & Reibach" **als Privatperson**, nicht über eine Firma. Die Fassung vom 19.10. für eine Firma (D-U-N-S-Nummer, Handelsregister, Firmendomain) ist damit hinfällig; sie steht in der Git-Geschichte. Geprüft an Apples eigenen Seiten (Links bei jedem Schritt). Alles mit **[du]** kann nur der Kontoinhaber selbst tun — kein Agent legt Konten an, unterschreibt oder trägt Bank- und Steuerdaten ein.

**Ziel:** App im Store bis ca. 16.11.2026. **Der Engpass ist nicht das Spiel, sondern dieses Konto.** Ohne fertiges Konto gibt es keinen TestFlight-Test und kein Einreichen. Als Einzelperson fällt der langsamste Schritt (D-U-N-S-Nummer, bis zu 7 Werktage) weg.

## Zeitplan rückwärts gerechnet

| Wann | Was | Wer | Wie lange laut Apple |
|---|---|---|---|
| **sofort** | Apple-ID prüfen: amtlicher Vor- und Nachname, Zwei-Faktor an | [du] | Minuten |
| **sofort** | Mitgliedschaft als **Einzelperson** beantragen (am iPad) | [du] | Apple nennt **keine Frist**; erst nach Prüfung wird bezahlt ([Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)) |
| nach Freischaltung | Paid Apps Agreement, Steuer, Bank, DSA-Händlerangaben, Small Business Program | [du] | Bankänderungen werden binnen 24 h verarbeitet ([Banking](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/)) |
| bis ca. 10.11. | Einreichen | [du] klickt, Text liegt bereit | Prüfung: 50 % unter 24 h, 90 % unter 48 h ([App Review](https://developer.apple.com/distribute/app-review/)) |

---

## Einzelperson oder Firma — was der Unterschied ist

Vergleich: Bei Apple gibt es zwei Türen. Die Firmentür verlangt einen Firmenausweis (D-U-N-S-Nummer), einen Handelsregisterauszug und eine E-Mail an der Firmendomain. Die Tür für Einzelpersonen verlangt nur dich selbst: deine Apple-ID, deinen Ausweis, deine Anschrift.

| | Einzelperson (jetzt) | Organisation (bisheriger Plan) |
|---|---|---|
| D-U-N-S-Nummer | **nicht nötig** — Apple verlangt sie nur von Organisationen ([Enroll](https://developer.apple.com/programs/enroll/)) | nötig |
| Name im Store als „Verkäufer" | **dein echter Vor- und Nachname** — „Your name will be displayed as the seller name" ([Enroll](https://developer.apple.com/programs/enroll/)) | Firmenname |
| E-Mail der Apple-ID | frei wählbar, mit Zwei-Faktor | muss zur Firmendomain gehören |
| Website | nicht verlangt | Firmenwebsite verlangt |
| Kosten | **99 US-Dollar je Mitgliedsjahr**, in Deutschland **99 €** | gleich |

Einen Künstlernamen oder „Rost & Reibach" als Verkäufernamen gibt es bei Einzelpersonen nicht. Der Name des **Spiels** bleibt „Rost & Reibach"; darunter steht im Store klein dein Name.

## Schritt 1 — Apple-ID **[du]**

Apple verlangt ([Enroll](https://developer.apple.com/programs/enroll/)):
- **Zwei-Faktor-Authentifizierung** ist eingeschaltet.
- Du bist **volljährig**.
- **Vor- und Nachname sind dein amtlicher Name** — Spitzname oder Firmenname im Namensfeld verzögert die Freigabe. Steht dort noch ein Firmenname, vorher ändern.
- E-Mail, Telefon und Anschrift werden geprüft; **ein Postfach als Anschrift nimmt Apple bei der Anmeldung nicht an**.

**E-Mail:** Die Apple-ID braucht keine Firmendomain. Nimm die Adresse, an der du alle Apple-Mails und Codes zuverlässig liest. Die **öffentliche** Spiel-Adresse (`[E-Mail]`, kommt noch) ist davon getrennt und wird erst in Schritt 3d eingetragen.

## Schritt 2 — Mitgliedschaft beantragen, am besten am iPad **[du]**

Du hast keinen Mac — brauchst du auch nicht. Die Anmeldung geht in der **Apple-Developer-App** auf iPhone oder iPad ([Enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/)).

Was die App verlangt:
- iPad oder iPhone mit Face ID, Touch ID oder Code; **das ganze Verfahren auf demselben Gerät** (Anmelden, später Weitermachen und Bezahlen)
- an diesem Gerät in iCloud angemeldet, App auf neuestem Stand
- **Lichtbildausweis** (Personalausweis oder Reisepass) — die App fotografiert ihn

Ablauf:
1. Apple-Developer-App → **Account** → mit der Apple-ID aus Schritt 1 anmelden.
2. **Enroll Now** → als Art **Individual / Einzelperson** wählen → persönliche Angaben, Ausweisfoto → absenden.
3. Apple prüft und schreibt eine E-Mail ([Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)).
4. Nach der Freigabe: **auf demselben Gerät** App öffnen → **Continue Your Enrollment** → Lizenzvertrag annehmen → **Subscribe**.

**Kosten:** 99 US-Dollar pro Mitgliedsjahr, angezeigt in Landeswährung ([Enroll](https://developer.apple.com/programs/enroll/)). In Deutschland sind das seit Jahren **99 €** ([ifun.de](https://www.ifun.de/99e-statt-80e-apple-erhoeht-entwickler-gebuehren-71232/)); den genauen Betrag zeigt die App vor dem Bezahlen. Über die App ist es ein **Abo, das sich jährlich verlängert**; kündbar bis einen Tag vor Verlängerung. Bezahlt wird mit einer Zahlungsart der Apple-ID, die **am Gerät** angemeldet ist. Guthaben aus Geschenkkarten zählt nicht.

**Dauer der Prüfung:** Apple nennt keine. Für Einzelpersonen erfahrungsgemäß eher kurz (Stunden bis wenige Tage) — eine Schätzung, keine Zusage.

## Schritt 3 — In App Store Connect: Verträge, Steuer, Bank **[du]**

Ohne diese Schritte kann die App **nur kostenlos** angeboten werden ([Set a price](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/)). Reihenfolge ist vorgegeben: erst Vertrag, dann Steuer, dann Bank.

Alles unter [App Store Connect](https://appstoreconnect.apple.com) → **Business** → Reiter **Agreements**.

### 3a. Paid Apps Agreement
Nur der Account Holder (du) darf unterschreiben. **Paid Apps** → **View and Agree to Terms** → lesen → **Agree**. Nicht rückgängig zu machen. ([Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/))

### 3b. Steuerformulare
Unter **Tax Forms** → **Add Tax Info**. App Store Connect stellt Fragen und schlägt das passende Formular vor; für eine Einzelperson außerhalb der USA ist das in der Regel **W-8BEN** (ohne „-E", das ist die Firmenfassung) — es bestätigt, dass du nicht in den USA steuerpflichtig bist. ([Provide tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/))

Bereithalten: Name, Anschrift, **Steuer-Identifikationsnummer**; falls vorhanden **USt-IdNr.**

**Steuer:** Wer regelmäßig Apps verkauft, betreibt nach deutschem Recht vermutlich ein Gewerbe (Gewerbeanmeldung, Einkommensteuer, Kleinunternehmerregelung). Apples Steuerseite ([Understanding taxes](https://developer.apple.com/help/app-store-connect/making-payments-to-apple/understanding-taxes)) verweist selbst auf den Steuerberater — **Steuerberater fragen** (siehe `datenschutz.md`, Abschnitt „Prüfen lassen").

### 3c. Bankkonto
Unter **Bank Accounts**: Land, Bank, **Kontowährung EUR**, Kontoart, **IBAN** (ins IBAN-Feld, nicht ins Kontonummernfeld), Kontoinhaber **genau wie auf dem Konto** — also dein Name. Nur ein Konto gleichzeitig. ([Enter banking information](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/))

### 3d. EU-Händlerangaben (Digital Services Act) — Pflicht, und öffentlich
Wer eine App **verkauft**, ist „Händler" (trader) — auch als Einzelperson. Apple verlangt dann von Einzelpersonen Anschrift (oder Postfach), Telefonnummer und E-Mail-Adresse und veröffentlicht sie auf der Produktseite in allen 27 EU-Ländern ([DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)). **Das heißt: Anschrift, Telefonnummer und E-Mail stehen für jeden lesbar im Store.**

- Telefon und E-Mail werden per Code geprüft.
- Dazu ein **aktuelles Dokument, das Name und Anschrift belegt**. Wer statt der Wohnanschrift ein **Postfach** zeigen will, belegt zusätzlich, dass es ihm gehört (z. B. Rechnung) — für die Store-Anzeige ist ein Postfach erlaubt, anders als bei der Anmeldung in Schritt 1.
- Ohne Händlerangaben verschwindet eine kostenpflichtige App aus den EU-Stores.

Weg: **Business** → **Agreements** → **Compliance** → **Digital Services Act** → **This is a trader account**.
Quellen: [DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

→ **Entscheide, welche Anschrift, Telefonnummer und E-Mail öffentlich stehen sollen.** Vorschlag: die neue Spiel-Adresse `[E-Mail]`, eine eigene Telefonnummer statt der privaten Handynummer und — wenn die Wohnanschrift nicht im Store stehen soll — ein Postfach. Dieselben Angaben gehören ins Impressum auf der Support-Seite (`v1/public/support.html`); dort reicht ein Postfach in der Regel **nicht** (verlangt ist eine ladungsfähige Anschrift) — rechtlich prüfen lassen.

### 3e. Small Business Program — 15 % statt 30 % Provision
Neue Entwickler und alle unter 1 Mio. USD Erlös im Jahr zahlen Apple nur **15 %**. Das gibt es **nicht automatisch**: anmelden unter [Small Business Program](https://developer.apple.com/app-store/small-business-program/) nach dem Paid Apps Agreement. Der Satz gilt ab 15 Tage nach Ende des Geschäftsmonats, in dem Apple zustimmt — **also früh anmelden**, am besten vor dem ersten Verkauf. Gefragt wird nach „verbundenen Entwicklerkonten" — vermutlich keine.

### 3f. Kontaktdaten
Unter **Business** bzw. **Users and Access** Ansprechpartner für Finanzen, Recht und Technik eintragen. Bei einem Ein-Personen-Konto bist das überall du.

---

## Was du bereithalten musst — nur das, was Apple wirklich verlangt

| Unterlage | Wofür | Quelle |
|---|---|---|
| Apple-ID mit **amtlichem Namen** und Zwei-Faktor | Anmeldung | [Enroll](https://developer.apple.com/programs/enroll/) |
| **Personalausweis oder Reisepass** | Anmeldung über die App | [Enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/) |
| Wohnanschrift (kein Postfach), Telefon | Anmeldung | [Enroll](https://developer.apple.com/programs/enroll/) |
| Zahlungsart an der Apple-ID | 99 €/Jahr | ebd. |
| **IBAN** deines Kontos | Auszahlung | [Banking](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/) |
| Steuer-ID, ggf. USt-IdNr. | Steuerformular | [Tax](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/) |
| Öffentliche Anschrift (oder Postfach), Telefon, E-Mail + Nachweis | DSA-Angaben im Store | [DSA](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/) |

**Nicht mehr nötig:** D-U-N-S-Nummer, Handelsregisterauszug, Firmendomain, Firmenwebsite.

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
- Rechnung je Verkauf in Deutschland (ungefähr): 4,99 € enthalten 19 % USt → 4,19 € netto; minus 15 % Provision (Small Business Program) → **rund 3,56 €** für dich (vor Einkommensteuer). Den genauen Betrag zeigt App Store Connect beim Festlegen.

**Gegenvorschlag:** 2,99 € zum Start, nach den ersten Bewertungen auf 4,99 €. Senkt die Hürde, wenn noch niemand das Spiel kennt — kostet aber 40 % je Verkauf, und eine Preiserhöhung ärgert Leute, die die alte Stufe gesehen haben.

---

## Fragen an dich

1. **Welche Anschrift, Telefonnummer und E-Mail sollen öffentlich im Store und im Impressum stehen** (EU-Pflicht)? *Empfehlung: neue Spiel-Adresse, eigene Telefonnummer; für die Anschrift rechtlich klären, ob die Wohnanschrift nötig ist.*
2. **Steht in deiner Apple-ID dein amtlicher Vor- und Nachname** (kein Firmenname)?
3. **Preis:** 4,99 € oder 2,99 € zum Start? *Empfehlung: 4,99 €.*
