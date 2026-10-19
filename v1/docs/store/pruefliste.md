# Prüfliste „Bereit zum Einreichen“

Stand 19.10.2026. Nur die Punkte, die für dieses Spiel zählen. Grundlage: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) und die anderen Dateien in diesem Ordner.

**Wer:** **[du]** = Patrick · **iOS** = wer den iOS-Build baut · **ui** = Bedienung/Menüs im Spiel · **Spiel** = Spielinhalt (Orchestrator verteilt) · **Store** = Texte und Bilder in diesem Ordner.
Abgehakt wird erst, wenn es erledigt **und** von dir abgenommen ist.

## A. Konto und Verträge — der längste Weg, zuerst

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Apple-ID | Apple-ID mit **@pripada.de**-Adresse, Zwei-Faktor an, amtlicher Name | offen | [du] |
| ☐ | D-U-N-S | nachschlagen, sonst beantragen (bis 5 + 2 Werktage) | offen | [du] |
| ☐ | Mitgliedschaft | über die Apple-Developer-App am iPad beantragen, nach Freigabe 99 € zahlen | offen | [du] |
| ☐ | Paid Apps Agreement | in App Store Connect unterschreiben — ohne geht nur „kostenlos“ | offen | [du] |
| ☐ | Steuer | W-8BEN-E (App Store Connect führt hin) | offen | [du] |
| ☐ | Bank | GmbH-Konto mit IBAN | offen | [du] |
| ☐ | EU-Händlerangaben (DSA) | „trader“, Telefon und E-Mail bestätigen, Handelsregisterauszug hochladen — sonst nicht in EU-Stores | offen | [du] |
| ☐ | Small Business Program | anmelden (15 % statt 30 %), möglichst vor dem ersten Verkauf | offen | [du] |
| ☐ | Preis | Basisland Deutschland, Preisstufe gesetzt (Empfehlung 4,99 €) — Pflicht vor dem Einreichen | offen | [du] |

Einzelheiten: `apple-konto.md`.

## B. Technik des Builds

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Xcode 26 / iOS-26-SDK | Seit 28.04.2026 Pflicht für jeden Upload ([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)) | offen | iOS |
| ☐ | Mindestversion | Deployment Target **iOS 13 oder höher** (seit 09.09.2026 Pflicht) | offen | iOS |
| ☐ | Bundle-ID | `de.pripada.schrottplatz` (steht in `capacitor.config.json`). **Nach dem ersten Upload nicht mehr änderbar** ([App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)) — vorher von dir bestätigen lassen | offen | iOS + [du] |
| ☐ | Alles im Paket | Spiel lädt aus dem App-Paket, **nichts** von GitHub Pages oder sonst aus dem Netz (Richtlinien [2.5.2](https://developer.apple.com/app-store/review/guidelines/#software-requirements), [4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)) | offen | iOS |
| ☐ | Offline-Probe | Flugmodus an, App frisch installieren, starten, spielen, speichern, neu starten — alles geht | offen | iOS + [du] |
| ☐ | Privacy Manifest | `PrivacyInfo.xcprivacy`: kein Tracking, keine erhobenen Daten, Begründungen für genutzte Systemfunktionen. Ohne wird der Upload abgelehnt | offen | iOS |
| ☐ | Verschlüsselung | `ITSAppUsesNonExemptEncryption` = `false` in der Info.plist | offen | iOS |
| ☐ | Querformat | nur Querformat auf iPhone und iPad; die Upload-Prüfung von App Store Connect meckert bei unpassenden Ausrichtungs-/Multitasking-Einstellungen — Fehlermeldungen beim Upload ernst nehmen | offen | iOS |
| ☐ | iPad | läuft auf dem iPad als echtes iPad-Spiel, nicht als vergrößerte iPhone-App ([2.4.1](https://developer.apple.com/app-store/review/guidelines/#hardware-compatibility)) | offen | iOS |
| ☐ | Icon | 1024 × 1024 **ohne Alphakanal** (heutiges `icon-1024.png` hat einen) | offen | iOS |
| ☐ | Versionsnummer | Version `1.0`, Build-Nummer steigt mit jedem Upload | offen | iOS |

## C. Vollständigkeit — Richtlinie 2.1 „App Completeness“

Apple: Eingereicht wird die **endgültige** Fassung; Platzhalter, leere Seiten, Abstürze führen zur Ablehnung ([2.1](https://developer.apple.com/app-store/review/guidelines/#app-completeness)).

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Keine Platzhalter | Keine halbfertigen Knöpfe, keine „kommt bald“-Menüs. Pausenmenü durchgehen: „Platz ausbauen“, „Radio“, Debug-Anzeige (Fünf-Finger-Geste) — was nicht zum Simulator gehört, ausblenden | offen | ui |
| ☐ | Aufgaben | entweder fertig (22c) **oder** ganz aus dem Build und aus allen Texten | offen | Spiel + [du] |
| ☐ | Erster Start | Ein neuer Spieler versteht in den ersten zwei Minuten, wie man greift (erste Aufgabe als Einführung oder kurzer Hinweis) | offen | Spiel |
| ☐ | Keine Abstürze | TestFlight auf iPhone mini und iPad, mindestens 30 Minuten am Stück, kein Absturz, kein Hänger | offen | [du] |
| ☐ | Leistung | Bildrate, Wärme und Akku auf dem iPhone mini annehmbar (22d) | offen | [du] + Spiel |
| ☐ | Speichern | Spielstand übersteht App-Beenden und Neustart des Geräts | offen | [du] |
| ☐ | Erstspieler | fünf Leute, die das Spiel nicht kennen, beim ersten Spielen beobachten (22g) | offen | [du] |
| ☐ | Funktionierende Adressen | Support-, Datenschutz- und Marketing-Adresse öffnen sich und zeigen Inhalt | offen | [du] |

## D. Richtige Angaben — Richtlinie 2.3 „Accurate Metadata“

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Text = Spiel | Jede Zeile der Beschreibung am Build prüfen; nichts versprechen, was fehlt (2.3.1) | offen | Store + [du] |
| ☐ | Bilder zeigen Spiel | Bildschirmfotos zeigen das Spiel in Benutzung, nicht nur Titelbild (2.3.3) | offen | Store |
| ☐ | Video nur aus dem Spiel | falls Vorschauvideo: nur Spielbilder (2.3.4) | offen | Store |
| ☐ | Name und Schlüsselwörter | ≤ 30 Zeichen, keine fremden Marken (kein „Fuchs“ u. Ä.), keine Füllwörter (2.3.7) | offen | Store |
| ☐ | Für alle Altersstufen | Texte und Bilder ohne Anstößiges (2.3.8) | offen | Store |
| ☐ | Kategorie | Spiele → Simulation | offen | [du] |
| ☐ | Sprache | Store-Sprachen = Sprachen im Spiel (siehe Frage Englisch in `store-texte.md`) | offen | [du] + ui |
| ☐ | Pflichtbilder | iPhone 2556 × 1179 (oder 2622 × 1206) und iPad 13" 2752 × 2064 (oder 2732 × 2048), je Sprache | offen | Store |

Texte: `store-texte.md` · Bilder: `bildmaterial.md`.

## E. Mindestfunktion und Eigenes — Richtlinien 4.1, 4.2

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Mehr als eine Website | Vollständiges Spiel, offline, im Paket — Hinweis an die Prüfer steht in `altersfreigabe-und-pruefung.md` ([4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)) | offen | iOS + Store |
| ☐ | Keine fremden Marken im Spiel | Seit E-143 nur Pripada auf Schildern; Fahrzeuge und Maschine ohne fremde Logos und Typenschilder — einmal gezielt durchsehen ([4.1](https://developer.apple.com/app-store/review/guidelines/#copycats), [5.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)) | offen | Spiel |

## F. Datenschutz — Richtlinie 5.1

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Datenschutzerklärung online | Text aus `datenschutz.md` freigeben, Platzhalter füllen, rechtlich prüfen lassen, veröffentlichen | offen | [du] |
| ☐ | Link im Spiel | Knopf „Datenschutz“ im Pausenmenü, öffnet die Erklärung in Safari ([5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage): Link in App Store Connect **und** in der App) | offen | ui |
| ☐ | App Privacy | „No, we do not collect data from this app“ → Publish | offen | [du] |
| ☐ | Impressum | Support-Seite mit Anschrift und Kontakt, Verweis auf Impressum ([1.5](https://developer.apple.com/app-store/review/guidelines/#developer-information)) | offen | [du] |

## G. Rechte an Inhalten — Richtlinie 5.2

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Klänge | Quellen in `v1/public/ton/QUELLEN.md` vollständig; Pixabay-Lizenz für ein Bezahlspiel bestätigt | offen | [du] (prüfen lassen) |
| ☐ | Lizenztexte | Seite „Lizenzen“ im Spiel: Three.js (MIT), Rapier (Apache-2.0), Capacitor (MIT), dazu die Klangquellen | offen | ui |
| ☐ | Content Rights | in App Store Connect: enthält Inhalte Dritter: ja; Rechte vorhanden: ja | offen | [du] |

## H. Angaben in App Store Connect

| ☐ | Punkt | Was zu tun | Status | Wer |
|---|---|---|---|---|
| ☐ | Altersfreigabe | Fragebogen nach `altersfreigabe-und-pruefung.md` → 4+ | offen | [du] |
| ☐ | Exportkontrolle | „None of the algorithms mentioned above“ (bzw. durch Info.plist erledigt) | offen | [du] / iOS |
| ☐ | Hinweise für Prüfer | Text aus `altersfreigabe-und-pruefung.md`, am Build gegengelesen | offen | Store + [du] |
| ☐ | Kontakt für Prüfer | Name, Telefon, E-Mail | offen | [du] |
| ☐ | Support-URL, Copyright | `2026 Pripada GmbH` | offen | [du] |
| ☐ | Käufe im Spiel | keine — also nichts anzulegen; 3.1.1 betrifft uns nicht | — | — |
| ☐ | Veröffentlichung | „Manuell veröffentlichen“ wählen, damit die App nach der Freigabe erst live geht, wenn du es sagst | offen | [du] |

## Reihenfolge der letzten Tage

1. Build ist in TestFlight, du hast ihn abgenommen (C).
2. Texte, Bilder, Datenschutz-URL, Altersfreigabe, Preis eingetragen (D, F, H).
3. Einreichen. Prüfung: die Hälfte unter 24 h, 90 % unter 48 h ([App Review](https://developer.apple.com/distribute/app-review/)). Bei Ablehnung: Begründung lesen, beheben, neu einreichen — einen Puffer von **mindestens einer Woche** bis zum Wunschtermin einplanen.

**Auf dem Gerät zu prüfen** (wenn der TestFlight-Build da ist): Flugmodus-Start, 30 Minuten ohne Absturz auf iPhone mini und iPad, Spielstand nach Neustart, Datenschutz-Knopf öffnet Safari, alle Texte im Store stimmen mit dem überein, was du im Spiel siehst.
