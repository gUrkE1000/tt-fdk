# TT-Planer — Bestandsaufnahme

**Datum:** 17.09.2026
**Verwendete Rolle/Rechte:** Admin (höchste Benutzerrolle des Vereins; alle Verwaltungsbereiche sichtbar)
**Aktives Paket:** Kein gebuchtes Paket — laufender **Testzeitraum** ("Testzeitraum endet in 83 Tagen!"). Im Test sind offensichtlich alle Funktionen freigeschaltet, also faktisch **Champion-Funktionsumfang**. Kein einziger Menüpunkt war ausgegraut oder mit Schloss/Upgrade markiert.
**Dauer der Erhebung:** ca. 45–60 Minuten reine Klickarbeit.
**Vorgehen:** Ausschließlich lesend. Ansichten geöffnet, Tabs gewechselt, Filter-Dropdowns aufgeklappt, Formulare/Dialoge geöffnet und die Felddefinitionen ausgelesen. **Nichts gespeichert, angelegt, geändert, gelöscht oder abgeschickt.** Keine Benachrichtigung, Ersatzanfrage, Umfrage oder Zu-/Absage ausgelöst. Kein Paket gebucht.
**Datenschutz:** Personennamen, E-Mails und Telefonnummern sind ersetzt. Der Verein hatte zum Zeitpunkt der Erhebung nur **ein einziges Mitglied** (der eingeloggte Admin) — das begrenzt an mehreren Stellen, was beobachtbar war (siehe Abschnitt 5).

---

## 0. Zusammenfassung

- **Spieltagsbetrieb** ist der Kern: Mannschaften mit Stamm- und Ersatzspielern, Spieltermine aus click-TT, Rückmeldungen der Spieler, automatisierte Ersatzsuche, Fahrdienst und Verpflegung.
- **click-TT-Import läuft ausschließlich über die ICS-Kalender-URL** des Spielplans von mytischtennis.de — pro Mannschaft einzeln. Es gibt **keine echte API-Anbindung** und **keinen Rückweg nach click-TT**.
- **Ersatzspieler-Automatik** mit drei Modi: einzeln nach Reihenfolge, alle gleichzeitig, manuell. Die Reihenfolge wird per Drag & Drop gepflegt.
- **Benachrichtigungen** über genau **zwei Kanäle: App-Push und E-Mail**. 15 Ereignistypen, jeder pro Mitglied einzeln pro Kanal an/aus schaltbar. Kein SMS, kein WhatsApp.
- **Erinnerungsvorlauf** ist zweigeteilt: pro Training vereinsweit (`reminder_hours`, **Default 5 Stunden**), für Spiele pro Mitglied persönlich (Default im Testprofil 24 Stunden).
- **Trainingsverwaltung** mit Rhythmus, offenen/geschlossenen Trainings, Inkognito-Modus, Hallenschlüssel-Pflicht, automatischer Feiertags- und Schulferien-Aussetzung, Ausfällen einzeln und als Zeitraum.
- **Spielverlegung** läuft als Terminumfrage mit bis zu 3 Ersatzterminen an alle verfügbaren Spieler der Mannschaft.
- **Halle** ist nur als Ort mit Adresse und Kapazität ("maximale gleichzeitige Spieltermine") modelliert — **keine Tischbelegung, keine Buchung durch Mitglieder**.
- **Randmodule**: Chat (Verein/Mannschaft/persönlich), Umfragen, Arbeitszeiten, Trainer-Abrechnung, Inventar, Bekleidung, Schlüsselverwaltung, Vereinsneuigkeiten, Dateien.
- Es ist eine **PWA** ("Zum Home-Bildschirm hinzufügen"), keine native App. Push wird über ein Glockensymbol in der App-Kopfzeile aktiviert.

---

## 1. Menüstruktur

Wortgetreue Beschriftungen aus der Seitenleiste. **Kein Punkt war gesperrt, ausgegraut oder mit Upgrade-Hinweis versehen** (Testzeitraum).

- **Übersicht** — `/`
- **Meine Spiele** — `/my-games`
- **Meine Termine** — `/my-dates`
- **Abrechnung** — `/billing`
- **Arbeitszeiten** — `/work-logs`
- *Verein* (Abschnittsüberschrift, kein Link)
  - **Chat** — `/chat/unread`
    - **Verein** — `/chat`
    - **Mannschaften** — `/chat/teams`
    - **Persönlich** — `/chat/personal`
  - **Mein Verein** — `/my-club/news`
  - **Statistiken** — `/statistics/dashboard`
- *Planen* (Abschnittsüberschrift)
  - **Trainings** — `/trainings`
  - **Mannschaften** — `/teams`
  - **Spieltermine** — `/games`
  - **Vereinstermine** — `/dates`
  - **Kalender** — `/calendar`
  - **Umfragen** — `/votes`
- *Verwalten* (Abschnittsüberschrift)
  - **Mitglieder** — `/players`
  - **Verein** — `/club`
  - **Orte & Schlüssel** — `/venues`
  - **Inventar** — `/inventory`
  - **Bekleidung** — `/clothing`
- Fußbereich der Seitenleiste: Hinweisbox *"Testzeitraum endet in 83 Tagen!"* mit Button **Jetzt buchen** → `/club/customer-area`

### Kopfzeile (rechts oben)

- Chat-Icon (Sprungziel Chat)
- **Hilfe** (Dropdown): *Hilfe* → `www.tt-planer.de/hilfe/` · *Feedback* → `ttplaner.featurebase.app` · *Updates* → `/updates` · *Mobile App* → `/mobile-app` · *E-Mail Support* → `mailto:support@tt-planer.de`
- **Benachrichtigungs-Glocke** mit drei Zuständen (siehe Modul B)
- **Profilmenü**: Name, Rollenlabel, QTTR-Badge · *Mein Profil* → `/profile` · *Abmelden* → `/logout`

### Unterseiten mit eigenen Tab-Leisten

- **Mein Profil** (`/profile`): Profil · Abwesenheiten · Benachrichtigungen · Bekleidung · Automatische Trainingszusagen
- **Verein** (`/club`): Daten · Rollen · Neuigkeiten · Dateien · Kalender · Übersicht · Kundenbereich
- **Mein Verein** (`/my-club`): Neuigkeiten · Dateien · Mitglieder · Trainings · Vereinstermine · Mannschaften · Spiele · Rollen & Kontaktdaten
- **Trainings**: Termine · Planung
- **Spieltermine**: Offene Termine · Beendete Termine
- **Vereinstermine**: Offene Termine · Beendete Termine
- **Mitglieder**: Mitglieder · Gruppen
- **Kalender**: Planung · Abwesenheiten
- **Inventar**: Inventar · Typen
- **Bekleidung**: Übersicht · Anfragen · Typen

---

## 2. Module

### A — Navigation, Startseite/Dashboard

- **Pfad im Menü:** Übersicht (`/`)
- **Zweck:** Persönliche Startseite: was steht als Nächstes an, was muss ich beantworten.
- **Objekte und Felder:** Keine eigenen Objekte, reine Aggregation.
- **Aufbau:**

  1. **Countdown-Kachel** oben: *"Mannschaftsspiele — 21 Tage bis zum nächsten Spiel"*, darunter Badge *"1 Spiel in den nächsten 30 Tagen"*.
  2. **Tab-Leiste mit Zählern**: **Trainings** (n) · **Spiele** (n) · **Kalender** · **Schlüssel** · **Offene Trainings** (n).
  3. **Quicklinks**-Kachel unten mit Links nach mytischtennis.de: *Tabelle & Spielplan*, *TTR-Rechner*, *Vereinsrangliste* (letzterer mit der Vereinsnummer im Query-String).

- **Tab „Trainings":** Karte je Trainingstermin mit Datum/Uhrzeit, Name, **Ort**, **Nachrichten** (Zähler), **Teilnehmer** (Zähler + Liste), Block **Deine Teilnahme** mit den Buttons **Bin dabei / Komme später / Bin nicht dabei**. Im DOM zusätzlich vorhanden: *Zurücksetzen*, *Gäste*, *Speichern* — Gäste können also offenbar mitgemeldet werden.
- **Tab „Spiele":** Filter-Chips **Alle (n) / Heim (n) / Auswärts (n)**. Je Spiel: Datum, Uhrzeit, Badge HEIM/AUSWÄRTS, Mannschaftsbadge, Gegner + Liga, **Ort** mit Button *Adresse anzeigen*, **Nachrichten**, **Aufstellung n/4** mit Fortschrittsbalken und Avataren, **Fahrer** mit *Ich kann fahren* / *Kann doch nicht fahren* und Badge *ALS FAHRER*, **Verpflegung** mit *Ich bringe etwas mit*.
- **Tab „Kalender":** Monats-/Wochen-/Listenansicht mit farbigen Kategorien **Trainings · Spiele · Vereinstermine · Geburtstage · Halle nicht verfügbar**, Navigation `<` `>` `Heute`, Kalenderwochen-Spalte.
- **Tab „Schlüssel":** *Deine Schlüssel* — je Schlüssel: Name + Halle, **Verantwortliche Person**, **Aktueller Inhaber**, Block **Schlüssel an Person übergeben** mit Personen-Auswahl und Button *Jetzt übergeben*.
- **Tab „Offene Trainings":** Tabelle **Name | Zeitpunkt | Rhythmus | Ort | Trainer | Teilnahme** mit Button *Teilnehmen* bzw. *Nicht mehr teilnehmen*. Erklärtext: *"An diesen Trainings ist jedes Vereinsmitglied herzlich eingeladen teilzunehmen! Klicke hierfür auf 'Teilnehmen' und das Training erscheint in der obigen Liste."*
- **Aktionen:** Teilnahme setzen, Fahrer melden, Verpflegung melden, Schlüssel übergeben, offenem Training beitreten. Alles für das eigene Konto.
- **Beobachtungen:** Das Dashboard ist rein persönlich zugeschnitten, es gibt keine Admin-Kacheln (z. B. "5 Spieler haben nicht geantwortet"). Kein konfigurierbares Widget-Layout gefunden.

---

### B — Benachrichtigungen und Erinnerungen

- **Pfad im Menü:** Mein Profil → **Benachrichtigungen** (`/profile`, Tab). Zusätzlich verstreut: pro Training (`reminder_hours`), pro Ausfall (Checkbox), pro Mannschaft (Chat aus), im Vereinsprofil (Kopie-Empfänger).
- **Zweck:** Steuert, welche Ereignisse ein Mitglied über welchen Kanal erreichen.

#### Kanäle

Genau **zwei**: **APP** (Push) und **E-MAIL**. Beide werden in einer Matrix pro Ereignistyp einzeln geschaltet. Kein SMS, kein WhatsApp, keine In-App-Inbox als eigener dritter Kanal (die App-Benachrichtigung ist der Push).

**Push-Einrichtung:** Über die Glocke in der Kopfzeile. Drei Zustände als drei Buttons:

| Button-ID | Titel | Farbe | Bedeutung |
|---|---|---|---|
| `enableNotificationsButton` | aktivieren | blau | Push noch nicht erlaubt, klickbar |
| `enabledNotificationsButton` | aktiv | grün | Push läuft (nicht klickbar) |
| `deniedNotificationsButton` | inaktiv | rot | Push blockiert |

Die Anleitung unter *Mobile App* (`/mobile-app`) beschreibt es als PWA-Weg: Seite im Browser öffnen → anmelden → "Zum Home-Bildschirm hinzufügen" → App öffnen → **auf das Glocken-Symbol tippen, um Mitteilungen zu erlauben**.

#### Auslöser — vollständige Liste (Reihenfolge wie in der Oberfläche)

Alle 15 sind im Auslieferungszustand für **beide** Kanäle aktiviert.

| # | Typ | APP | E-Mail |
|---|---|---|---|
| 1 | Teilnahme am Training? | ✔ | ✔ |
| 2 | Terminumfrage für Spielverlegung | ✔ | ✔ |
| 3 | Bestätigung der Spielverlegung | ✔ | ✔ |
| 4 | Ersatzanfrage an dich gestellt | ✔ | ✔ |
| 5 | Ersatz erfolgreich für dich gefunden | ✔ | ✔ |
| 6 | Neues Mannschaftsspiel angelegt | ✔ | ✔ |
| 7 | Einladung für Vereinstermin | ✔ | ✔ |
| 8 | Erinnerung an Spieltermin | ✔ | ✔ |
| 9 | Erinnerung an Vereinstermin | ✔ | ✔ |
| 10 | Mannschaftsspiel zugeordnet | ✔ | ✔ |
| 11 | Erinnerung an ungelesene Nachrichten im Chat | ✔ | ✔ |
| 12 | Neue Nachricht im Training, Spiel oder Vereinstermin | ✔ | ✔ |
| 13 | Benachrichtigung bei Trainingsausfall | ✔ | ✔ |
| 14 | Erinnerung an offene Spiel- und Terminteilnahmen | ✔ | ✔ |
| 15 | Bekleidungsanfragen | ✔ | ✔ |

**Zusätzliche, nicht in dieser Matrix stehende E-Mail-Auslöser**, die an anderer Stelle explizit dokumentiert sind (Block „Erklärung Aktionen" im Dialog *Spieler verwalten*):

- Spieler wird beim Spiel hinzugefügt → *"informiert diesen per E-Mail darüber"*
- Spieler wird vorerst beim Spiel entfernt → E-Mail
- Spieler wird beim Spiel auf Absage gesetzt → E-Mail
- Trainingsausfall anlegen → optionale Checkbox *"Mitglieder über den Ausfall per E-Mail direkt benachrichtigen"* (Default **aus**)
- Mitglied wird manuell freigeschaltet → Willkommens-E-Mail (Text vereinsweit überschreibbar, sonst Standard-E-Mail des Anbieters)
- Neue Mitglieder aus dem Excel-Import erhalten eine E-Mail-Einladung

#### Objekte und Felder

**Persönliche Benachrichtigungseinstellungen** (`/profile` → Benachrichtigungen, Abschnitt *Weitere Einstellungen*):

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| Matrix Typ × Kanal (15 × 2) | Checkbox | nein | alle Default **an** |
| App Benachrichtigung direkt bei jeder neuen Chat Nachricht aktivieren? | Checkbox | nein | Default **an** |
| Für welche Trainings möchtest du eine Teilnahmeerinnerung erhalten? (`training_ids[]`) | Mehrfachauswahl Trainings | nein | leer = Anzeige *"Allen zugeordneten Trainings"* |
| Wie viele Stunden vor einem Spiel möchtest du erinnert werden? (`reminder_games_hours`) | Zahl | nein | **24** im Testprofil; **keine** min/max/step-Begrenzung im Feld → beliebige Stundenzahl, keine festen Schritte |
| — | Button *Speichern* | | |

**Vereinsweit / pro Mitglied** (`/profile` → Profil):

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| E-Mail Adresse(n) für Kopie aller Benachrichtigungen (`emails_copies`) | Text | nein | mehrere kommagetrennt; Hilfetext: *"An die hinterlegten E-Mail Adressen werden alle E-Mail Benachrichtigungen in Kopie gesendet. Diese Funktion ist z.B. sehr hilfreich für Eltern."* |

**Pro Training** (Training anlegen/bearbeiten):

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| Wie viele Stunden vor Beginn soll erinnert werden? (`reminder_hours`) | Zahl | nein | **Default 5** — bestätigt deine Vermutung; keine min/max/step-Begrenzung |

- **Einstellebenen:** vereinsweit gibt es **keine** zentrale Benachrichtigungskonfiguration. Die Ebenen sind: **pro Mitglied** (Matrix + Spiel-Vorlauf + Trainingsauswahl), **pro Training** (Vorlauf in Stunden), **pro Mannschaft** (nur "Team Chat deaktivieren"), **pro Einzelaktion** (Ausfall-Checkbox, Aufstellungsaktionen).
- **Nur Nichtantworter oder alle?** *Nicht verifiziert.* Der Typ Nr. 14 heißt **"Erinnerung an offene Spiel- und Terminteilnahmen"** — die Formulierung „offene" spricht dafür, dass nur Mitglieder ohne Rückmeldung erinnert werden. Nr. 8 **"Erinnerung an Spieltermin"** klingt dagegen nach einer Erinnerung an alle. Mit nur einem Mitglied im Verein und ohne Auslösen einer echten Benachrichtigung war das **nicht nachprüfbar**.
- **Kann ein Mitglied eigene Benachrichtigungen abschalten?** Ja, vollständig und granular: jede der 15 Zeilen einzeln pro Kanal. Es gab keinen Hinweis darauf, dass ein Admin diese Wahl überschreiben oder erzwingen kann.
- **Beobachtungen:** Der Spiel-Vorlauf ist **pro Mitglied** einstellbar, der Trainings-Vorlauf **pro Training**. Das ist eine bewusste Asymmetrie und für einen Nachbau die wichtigste Design-Entscheidung in diesem Bereich.

---

### C — Mannschaften und Mannschaftsspiele

- **Pfad im Menü:** Planen → **Mannschaften** (`/teams`), Unterseite **Mannschaften bearbeiten** (`/teams/players-management`); Planen → **Spieltermine** (`/games`).
- **Zweck:** Kader, Aufstellung, Rückmeldungen, Ersatzsuche, Fahrdienst.

#### Objekt: Mannschaft

Listenansicht `/teams`: **Name | Mannschaftsführer | Spieler | Ersatzspieler | Ligen | Aktion**, darunter je Zeile Untertitel „4er Mannschaft" und „Rang: 2 | Erwachsene". Aktion-Menü: **Bearbeiten**, **Löschen**. Kopfbuttons: **Mannschaft anlegen**, **Mannschaften bearbeiten**.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `name` — NAME | Text | ja | |
| `color` — FARBE | Farbwähler | nein | Default schwarz, löschbar |
| `team_leader_user_ids[]` — MANNSCHAFTSFÜHRER | Mehrfachauswahl Mitglieder | nein | mehrere MF möglich |
| `leagues[]` — LIGEN | Mehrfachauswahl | nein | vorgeladener Ligenkatalog mit **1.657 Einträgen** (Bundesligen bis Kreisklassen, mit Verband + Bezirk im Namen, z. B. „Bezirks-Pokal der Bezirksklassen Erwachsene (Bayerischer TTV – Oberbayern-Mitte)"); Hinweis *"Sollte eine Liga fehlen, kannst du sie selbst anlegen."* + Button **Liga anlegen** (nur Feld *Name der Liga*) |
| `size` — ANZAHL SPIELER | Zahl | **ja** | steuert das „n/4" der Aufstellung |
| `is_braunschweiger_system` — Braunschweiger System? | Checkbox | nein | Default aus |
| `ranking_type` — RANG TYP | Auswahl | nein | Erwachsene, Senioren 40/50/60/70/75, Jugend 19/15/13/11, Damen, Mädchen 19/15/13/11 (15 Werte) |
| `ranking` — RANG | Zahl | nein | z. B. 2 für „II. Mannschaft" |
| `hide_users_no_ranking` — Mitglieder ohne Rang für Mannschaft ausblenden | Checkbox | nein | Default aus |
| `block_participants_after` — TEILNAHMESTATUS BEI SPIELTERMINEN AB DATUM BLOCKIEREN | Datum | nein | leer |
| `players_option` — SPIELER LOGIK | Auswahl | nein | **Feste Stammspieler** (Default) / **Offene Spieler** |
| `players[]` — SPIELER | Mehrfachauswahl Mitglieder | nein | max. = `size` (Hinweis „Maximal 4 Stammspieler") |
| `replacements_option` — ERSATZANFRAGEN LOGIK | Auswahl | nein | **Einzeln nach Reihenfolge** (Default) / Alle Ersatzspieler gleichzeitig / Manuell |
| ERSATZSPIELER | sortierbare Mehrfachauswahl | nein | Reihenfolge = Priorität, per Drag & Drop |
| `comment_home_games` — STANDARD HINWEIS BEI HEIMSPIELEN | Textfeld mehrzeilig | nein | leer |
| `comment_outside_games` — STANDARD HINWEIS BEI AUSWÄRTSSPIELEN | Textfeld mehrzeilig | nein | leer |
| `disable_chat` — Team Chat deaktivieren | Checkbox | nein | Default **aus** |
| `manual_replacement_request_auto_add` — Spieler bei manuellen Ersatzanfragen bei Zusage automatisch zur Aufstellung hinzufügen | Checkbox | nein | Default **an** |
| `hide_drivers_catering` — Fahrdienst und Mitbringen bei Spielen ausblenden | Checkbox | nein | Default aus |

#### „Feste Stammspieler" vs. „Offene Spieler"

Beide Hilfetexte wörtlich aus der Oberfläche:

> **Feste Stammspieler:** Mit dieser Option könnt ihr Mannschaften verwalten, die primär mit den gleichen Spielern antreten soll. Sofern ein Stammspieler nicht spielen kann, wird automatisch ein Ersatz gesucht.

> **Offene Spieler:** Mit dieser Option könnt ihr Mannschaften verwalten, bei denen die Aufstellung offen ist. Alle Spieler werden für das Spiel angefragt und können zu- oder absagen. Der Mannschaftführer kann bei einer Überbesetzung die finale Aufstellung festlegen.

Es gibt **genau diese zwei Modi**, keine weiteren.

#### Ersatzspieler-Automatik

Die drei Modi mit Originaltext:

> **Einzeln nach Reihenfolge:** Die Reihenfolge der Ersatzspieler ist für die automatischen Ersatzanfragen relevant. Spieler werden der Reihe nach angefragt. Sofern dieser nicht Ersatz spielen kann, wird der nächste aus der Liste angefragt.

> **Alle Ersatzspieler gleichzeitig:** Alle hinterlegten Ersatzspieler werden bei automatischen Ersatzanfragen gleichzeitig benachrichtigt. Sofern eine Ersatzanfrage für einen Spieler angenommen wird, werden alle anderen Anfragen gelöscht.

> **Manuell:** Mit dieser Option werden keine automatischen Ersatzanfragen erstellt, sobald ein Stammspieler absagt. Der Mannschaftsführer oder Admin kann die Ersatzanfragen manuell erstellen und verwalten.

Zur Reihenfolge, wörtlich neben dem Ersatzspieler-Feld: *"Reihenfolge entspricht der Priorität für Ersatzanfragen. Die Reihenfolge kann per Drag & Drop geändert werden."*

**Zeitsteuerung der Kette: nicht gefunden.** Es gibt im gesamten Mannschaftsdialog, in den Vereinseinstellungen und im Spieltermin-Dialog **kein Feld** für „nach X Stunden weiterrücken", kein Timeout, keine Frist. Ich habe danach gezielt gesucht. Entweder ist die Wartezeit im Backend fest verdrahtet oder sie ist an den Spieltermin gekoppelt — **beobachtet habe ich es nicht**, siehe Abschnitt 6.

**Was bei leerlaufender Kette passiert: nicht gesehen.** Mit einem einzigen Mitglied konnte keine Kette angelegt und kein Leerlauf provoziert werden. Es gibt jedoch den Benachrichtigungstyp *"Ersatz erfolgreich für dich gefunden"* — ein Gegenstück „kein Ersatz gefunden" existiert in der Typenliste **nicht**.

**Manuelle Übersteuerung: ja.** Im Dialog *Spieler verwalten* (siehe unten) kann der Mannschaftsführer/Admin jederzeit eingreifen: Ersatz anfragen (`?`), Ersatzanfrage löschen (Papierkorb), Spieler direkt hinzufügen, Spieler entfernen, Teilnahmestatus zurücksetzen. Der Modus **Manuell** schaltet die Automatik ganz ab.

**Aussehen der Anfrage beim Ersatzspieler: nicht gesehen** (keine zweite Person im Verein). Bekannt ist nur: Es gibt den Typ *"Ersatzanfrage an dich gestellt"* für App + E-Mail, und die Aktion ist im Dialog beschrieben als *"Fragt den Spieler an, ob dieser bei dem Spiel Ersatz spielen könnte"*.

#### Objekt: Spieltermin

Listenansicht `/games`, Tabs **Offene Termine (16)** / **Beendete Termine (0)**. Kopfbuttons: **Spiel anlegen**, **Spiele importieren**, **Codes & PINs Import**. Filterleiste: Suche, Mannschaftsauswahl, **Zeitraum von/bis**, **Filter hinzufügen** mit den Zusatzfiltern **Rangtyp · Spielort · Spielerstand · Terminabweichung · Ohne Code/PIN**, und **Zurücksetzen**. Je Zeile eine Auswahl-Checkbox (Massenaktionen).

Spalten: **Termin** (mit Sync-Symbol bei importierten Terminen) · **Mannschaft** (mit „MF:" und Avatar) · **Gegner** (Badge HEIM/AUSWÄRTS, Liga, Halle) · **Aufstellung** (Avatare + Fortschrittsbalken, Buttons *Spieler verwalten* und *Aufstellung teilen*) · **Aktion**. Aktionsmenü: **Bearbeiten**, **Spielverlegung**, **Löschen**.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| TERMIN | Datum + Uhrzeit | ja | |
| SPIELORT | Auswahl | nein | **Heim** (Default) / Auswärts |
| ORT | Auswahl aus angelegten Orten | nein | Default = erste Halle |
| MANNSCHAFT | Auswahl | **ja** | |
| ANZAHL NOTWENDIGE SPIELER | Zahl | **ja** | |
| BETREUER | Auswahl Mitglieder | nein | „Nicht definiert" |
| GEGNER | durchsuchbare Auswahl | nein | Hinweis *"Sollte ein Gegner fehlen, kannst du ihn selbst anlegen."* + Button **Gegner anlegen** |
| KOMMENTAR FÜR DIE MANNSCHAFT | Textfeld mehrzeilig | nein | |
| SPIEL CODE (DIGITALER SPIELBERICHT) | Text | nein | |
| SPIEL PIN (DIGITALER SPIELBERICHT) | Text | nein | |

**Was aus click-TT kommt:** Datum, Uhrzeit, Heim/Auswärts, Gegner, Liga, Spielort — alles, was im ICS-Spielplan steht. **Selbst zu pflegen:** Mannschaftszuordnung (beim Import einmalig gewählt), Anzahl notwendige Spieler, Betreuer, Kommentar, Treffpunkt/Hinweise (über die Standard-Hinweise der Mannschaft), Code/PIN (oder per PDF-Import), Aufstellung, Fahrdienst, Verpflegung.

**Ein eigenes Feld „Treffpunkt" oder „Fahrgemeinschaft" existiert nicht.** Treffpunkt wird über *Standard Hinweis bei Heim-/Auswärtsspielen* der Mannschaft bzw. *Kommentar für die Mannschaft* am Termin abgebildet. Fahrgemeinschaft wird als **Fahrdienst** über die Self-Service-Buttons *Ich kann fahren* / *Kann doch nicht fahren* gelöst, die Verpflegung über *Ich bringe etwas mit*. Beides lässt sich pro Mannschaft komplett ausblenden.

#### Rückmelde-Optionen der Spieler

Bei **Trainings** gibt es drei Zustände: **Bin dabei / Komme später / Bin nicht dabei**, plus *Zurücksetzen* und ein Feld für **Gäste**.

Bei **Spielen** habe ich die Zusage-Buttons in der Spielerrolle nicht gesehen (der Testnutzer war schon in der Aufstellung). Aus der Struktur des Dialogs *Spieler verwalten* ergeben sich die Zustände: **Aufstellung/bestätigt**, **Offen**, **Absage**, **Unklar**, **Abwesend** (aus hinterlegter Abwesenheit), **manuell entfernt**. Ein **Bemerkungsfeld zur Rückmeldung** habe ich nirgends gefunden — Kommunikation läuft über den Nachrichten-Thread am Termin.

#### Aufstellung festlegen — Dialog „Spieler verwalten"

Kopf: Mannschaft | Gegner (Heim-/Auswärtsspiel) | Termin. Abschnitte in dieser Reihenfolge:

1. **Aufstellung** — Fortschrittsbalken, „0 / 4 Spieler besetzt"
2. **Offene Spieler** — mit Link **+ Andere Spieler (ohne Mannschaftszuordnung)**
3. **Abwesende Spieler** — aus den hinterlegten Abwesenheiten
4. **Bestätigte Spieler manuell entfernt**
5. **Spieler Absagen**
6. **Spieler noch unklar**
7. **Spieler mit Spieltermin am gleichen Tag** — Konfliktwarnung
8. **Erklärung Aktionen** (wörtlich):
   - `👤+` Fügt den Spieler beim Spiel hinzu und informiert diesen per E-Mail darüber
   - `👤−` Entfernt den Spieler vorerst beim Spiel und informiert diesen per E-Mail darüber
   - `⊖` Setzt den Spieler beim Spiel auf Absage und informiert diesen per E-Mail darüber
   - `?` Fragt den Spieler an, ob dieser bei dem Spiel Ersatz spielen könnte
   - `↺` Setzt den Teilnahme Status des Spielers zurück
   - `🗑` Löscht die Ersatzanfrage

Die Aufstellung ist also **halbautomatisch**: Stammspieler werden automatisch gesetzt bzw. angefragt, Ersatz wird automatisch nachgezogen, die finale Entscheidung trifft der Mannschaftsführer manuell in diesem Dialog.

#### „Mail an die Mannschaft"

**Existiert so nicht.** Es gibt stattdessen **Aufstellung teilen** — ein Dialog mit einem fertigen Textblock und dem Button **In Zwischenablage kopieren**, überschrieben *"Text zum Kopieren (z. B. für Messenger oder E-Mail)."* Format:

```
📍 Spielzusammenfassung

Am Do., 08.10.2026 | 20:00 Uhr: <Mannschaft> auswärts gegen <Gegner> | <Liga>
Spielort: <Hallenname>, <Straße>, <PLZ Ort>

Aufstellung: Mitglied A
Fahrer: Mitglied A
```

Es wird also **keine E-Mail verschickt** — der Text wandert in die Zwischenablage und von dort in WhatsApp o. ä. Für einen Nachbau ist das eine sehr billig zu bauende, offenbar in der Praxis viel genutzte Funktion.

#### Spielverlegung

Dialog *„Spielverlegung gegen <Gegner>"*. Wörtlicher Erklärtext:

> Definiere bis zu 3 Ersatztermine für die Spielverlegung. Alle verfügbaren Spieler der Mannschaft erhalten anschließend eine Benachrichtigung um über den neuen Termin abzustimmen. Sobald alle abgestimmt haben, erhältst du eine Benachrichtigung und kannst den neuen Spieltermin festlegen.

| Feld | Typ | Pflicht | Default |
|---|---|---|---|
| Ursprünglicher Termin | Anzeige | — | vorbelegt |
| ERSATZTERMIN OPTION 1 | Datum + Uhrzeit | ja | leer |
| ERSATZTERMIN OPTION 2 | Datum + Uhrzeit | nein | leer |
| ERSATZTERMIN OPTION 3 | Datum + Uhrzeit | nein | leer |
| — | Button **Umfrage jetzt starten** | | |

Korrespondierende Benachrichtigungstypen: *Terminumfrage für Spielverlegung* und *Bestätigung der Spielverlegung*.

#### Sammelbearbeitung: „Mannschaften bearbeiten"

Eigene Seite (`/teams/players-management`), Untertitel *"Stamm- und Ersatzspieler aller Mannschaften auf einer Seite anpassen."* Tabelle **Mannschaft | Stammspieler | Ersatzspieler**, je Zeile zwei Auswahlfelder, Hinweis „Maximal 4 Stammspieler" und die aktive *Ersatzanfragen Logik* der jeweiligen Mannschaft. Buttons *Zur Übersicht* und *Speichern*.

- **Rollen:** Mannschaften anlegen/bearbeiten/löschen offensichtlich Admin; *Spieler verwalten*, *Aufstellung teilen* und *Spielverlegung* laut Hilfetexten **Mannschaftsführer oder Admin**.

---

### D — click-TT-Anbindung

- **Pfad im Menü:** Planen → Spieltermine → Buttons **Spiele importieren** und **Codes & PINs Import**.
- **Zweck:** Spielpläne und die Zugangsdaten für den digitalen Spielbericht aus click-TT/mytischtennis übernehmen.

#### Import des Spielplans

Wörtlicher Hinweistext:

> Mit dem Import kannst du deine Spieltermine ganz einfach und schnell importieren. Gebe hierzu einfach die Kalender URL des Spielplans deiner Mannschaft ein und starte den Prozess. Es ist wichtig, dass du nicht den gesamten Spielplan aller Mannschaften verwendest, sondern nur den Spielplan deiner Mannschaft!

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| MANNSCHAFT | Auswahl | **ja** | die eigenen Mannschaften |
| KALENDER SPIELPLAN URL | Text | **ja** | Platzhalter: `https://www.mytischtennis.de/community/exportICSCalendar?teamIds=…` |
| — | Button **Import starten** | | |

Darunter ein Screenshot der mytischtennis-Seite *„Spielplan und Tabelle"* mit rot markiertem Link **„Termine herunterladen"** — das ist die Stelle, an der man die ICS-URL abgreift.

**Was importiert wird:** **nur der Spielplan** (Termine, Gegner, Heim/Auswärts, Ort, Zeit). **Kein Kaderimport.** Mitglieder kommen ausschließlich per Einladung, Einzelanlage oder Excel-Import in den TT-Planer. Die Ligen sind bereits als Katalog vorgeladen, kommen also nicht aus dem Vereinsimport.

**Was einzugeben ist:** nur die ICS-URL. **Keine Vereinsnummer, kein click-TT-Login, keine Verbandsauswahl, keine Datei.** Der TT-Planer meldet sich also nicht bei click-TT an.

#### Codes & PINs Import

Hinweistext: *"Mit dem Codes & PINs Import kannst du mithilfe der beiden PDFs Dateien die NuScore Informationen automatisch den bereits angelegten Spielterminen hinzufügen!"* Zwei Reiter:

**Einzeln:** MANNSCHAFT (Auswahl, Pflicht) · CODES PDF DATEI (Datei) · PINS PDF DATEI (Datei) · Button *Import starten*.

**Mehrfach:** Hinweis *"Lade hier mehrere PDF Dateien mit den Codes und PINs hoch. Anhand der Mannschaftsnummer ordnen wir diese automatisch zu. Dies funktioniert nur, wenn der Dateiname nicht geändert wurde und der Click-TT Kalender mit der jeweiligen Mannschaft verknüpft ist."* Felder: WAS MÖCHTEST DU IMPORTIEREN? (`import_type`: **Codes** / **PINs**) · PDF DATEIEN (mehrere Dateien) · Button *Import starten*.

#### Der Rückweg nach click-TT

**Es gibt keinen.** Ich habe die gesamte Oberfläche durchgesehen: kein Export nach click-TT, keine Schnittstelle, kein Browser-Plugin, kein Copy-Paste-Text für die Aufstellung im click-TT-Format, kein Button mit entsprechender Beschriftung. Der einzige „Rückweg" ist der **digitale Spielbericht (NuScore)**, für den der TT-Planer lediglich **Spiel Code und Spiel PIN** speichert und anzeigt — man tippt sie also in NuScore ein, statt sie auf dem Zettel zu suchen. Die Aufstellung selbst muss weiterhin von Hand in NuScore/click-TT eingetragen werden.

Falls im Marketing von „bequem in click-TT" die Rede ist, meint das nach allem, was in der Oberfläche steht, genau diese Code/PIN-Ablage — **das ist aber meine Interpretation, nicht in der Oberfläche so formuliert** (siehe Abschnitt 6).

#### Kalender-Export aus dem TT-Planer

**Ja, als ICS-Abo.** Pfad: **Meine Termine** → Button **Kalender abonnieren**. Wörtlich:

> Um deine zugesagten Spiele, Vereinstermine und Trainings automatisch in deinem Kalender sehen zu können, musst du folgenden Link kopieren und in deinem Kalender Tool (z.B. Google Kalender) abonnieren. Der Kalender aktualisiert sich automatisch ca. alle 24 Stunden. […] Terminänderungen oder neue Spiele werden so automatisch in deinem Kalender aktualisiert!

URL-Muster (Token hier bewusst nicht wiedergegeben):

```
https://app.tt-planer.de/my-games/calendar/subscribe?token=<UUID>&user=<UUID>
```

Der Dialog verlinkt Anleitungen für **Google Kalender, Microsoft Outlook, Mac, iPhone / iCloud**.

Ergänzend: Am **Vereinstermin** gibt es die Checkbox *"Termine nicht im Kalender exportieren"*, am **Training** *"Training im Kalender nicht anzeigen"* — der Export ist also pro Objekt abwählbar. Das Abo enthält laut Text nur **zugesagte** Termine.

- **Beobachtungen für den Nachbau:** Der ICS-Import ist der einzige Berührungspunkt mit click-TT und technisch trivial nachzubauen — ein ICS-Parser plus Zuordnung zu einer Mannschaft. Das Abo-Token liegt im Query-String, also ein simpler Bearer-im-Link.

---

### E — Training

- **Pfad im Menü:** Planen → **Trainings** (`/trainings`), Tabs **Termine** und **Planung**.
- **Zweck:** Wiederkehrende Trainings, Teilnahmeabfrage, Ausfälle.

Listenansicht: **Name | Zeitpunkt | Trainer | Mitglieder | Rhythmus | Aktiv | Aktion**. Je Zeile Badges für den Trainingstyp (z. B. ERWACHSENE) und ggf. **OFFENES TRAINING**, Link *Ausfälle verwalten*, Link *Mitglieder anzeigen*, sowie ein **Aktiv**-Schalter zum Stilllegen ohne Löschen. Aktionsmenü: **Bearbeiten**, **Ausfälle**, **Löschen**. Kopfbuttons: **Training anlegen**, **Mitglieder zuweisen**, **Ausfall anlegen**.

#### Objekt: Training

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `name` — NAME DES TRAININGS | Text | **ja** | |
| `type` — TRAININGSTYP | Auswahl | **ja** | **Erwachsene** (Default) / Jugend |
| `weekday` — WOCHENTAG | Auswahl | **ja** | Montag … Sonntag |
| `time` — UHRZEIT START | Uhrzeit | **ja** | |
| `time_end` — UHRZEIT ENDE | Uhrzeit | nein | |
| `trainers[]` — TRAINER | Mehrfachauswahl Mitglieder | nein | |
| `players[]` — MITGLIEDER ZUORDNEN | Mehrfachauswahl | nein | Sonderoption **Alle** |
| `max_participants` — MAXIMALE TEILNEHMERANZAHL | Zahl | nein | leer = unbegrenzt |
| `trainer_participants_invite` — Kein offenes Training - Trainer läd die Teilnehmer manuell ein | Checkbox | nein | Default aus |
| `venue_id` — TRAININGSORT | Auswahl | nein | „nicht definiert" / Orte |
| `reminder_hours` — WIE VIELE STUNDEN VOR BEGINN SOLL ERINNERT WERDEN? | Zahl | nein | **5** |
| `rhythm_weeks` — RHYTHMUS | Auswahl | nein | **wöchentlich** / zweiwöchentlich / monatlich |
| `next_training_date` — Start Datum | Datum | nein | |
| `details` — DETAILS / HINWEIS AN DIE TEILNEHMER | Textfeld mehrzeilig | nein | |
| `statistics_visibility` — TRAININGSTEILNAHMEN IM STATISTIK BEREICH ANZEIGEN *(nur beim Bearbeiten sichtbar)* | Auswahl | nein | **Für Alle** / Nur für Admins / Gruppe(n) |
| `statistics_group_ids[]` — Gruppen | Mehrfachauswahl | nein | nur bei Option „Gruppe(n)" |
| `is_open` — Offenes Training (jedes Mitglied kann teilnehmen) | Checkbox | nein | im geprüften Training **an** |
| `is_incognito` — Inkognito Training (Teilnehmeranzahl und Liste ist nur für Trainer sichtbar) | Checkbox | nein | aus |
| `requires_key_owner` — Teilnehmer mit Hallenschlüssel immer notwendig? | Checkbox | nein | aus |
| `consider_public_holidays` — Kein Training an gesetzlichen Feiertagen? | Checkbox | nein | aus |
| `consider_public_school_holidays` — Kein Training während Schulferien? | Checkbox | nein | aus |
| `ignore_calendar` — Training im Kalender nicht anzeigen | Checkbox | nein | aus |
| `auto_absence_no_trainers` — Training automatisch absagen, wenn alle Trainer abgesagt haben | Checkbox | nein | aus |

**Bundesland-Auswahl für Feiertage/Schulferien: nicht gefunden.** Weder im Trainingsdialog noch in den Vereinsdaten noch beim Ort gibt es ein Feld „Bundesland". Der Ort hat eine Postleitzahl — es ist naheliegend, dass daraus abgeleitet wird, **verifiziert habe ich das nicht** (siehe Abschnitt 6).

#### Teilnahmeabfrage

- Rückmeldung über **Bin dabei / Komme später / Bin nicht dabei**, dazu *Zurücksetzen* und ein **Gäste**-Feld.
- Erinnerung `reminder_hours` vor Beginn (Default 5 h), Kanal je Mitglied wählbar; das Mitglied kann außerdem einschränken, für **welche** Trainings es überhaupt Erinnerungen bekommen will.
- **Ab wann sichtbar / wie lange möglich:** kein Feld dafür gefunden. Trainings sind wiederkehrend und erscheinen offenbar dauerhaft in der Übersicht; ein „Anmeldefenster" wie bei Vereinsterminen (*Teilnahme hinterlegen bis*) gibt es beim Training **nicht**.
- **Automatische Zusagen:** Mein Profil → **Automatische Trainingszusagen**. Tabelle **Training | Zusagen bis | Status | Aktion**, Button *Automatische Zusage aktivieren*. Felder: TRAINING (Auswahl, Pflicht), AUTOMATISCH ZUSAGEN BIS (Datum, Pflicht), Checkbox **Komme später**. Hinweis: *"Nach der automatischen Zusage zu einem Training, kannst du den Status jederzeit in deiner Übersicht ändern und z.B. eine Absage hinterlegen."*

#### Trainingsausfälle

Zwei Wege:

1. **Pro Training** (`Ausfälle verwalten` / Aktionsmenü → *Ausfälle*): eigene Seite „Trainingsausfälle" mit Tabelle **Von | Bis | Grund | Aktion** und Button *Ausfall anlegen*. Einzeltag = Von und Bis gleich; Zeitraum = Von/Bis unterschiedlich.
2. **Pro Ort** (`Ausfall anlegen` in der Trainingsliste oder unter Orte & Schlüssel): Hinweis *"Der hinterlegte Ausfall wird bei allen Trainings hinterlegt, die dem ausgewählten Ort zugeordnet sind."*

| Feld | Typ | Pflicht | Default |
|---|---|---|---|
| ORT | Auswahl | **ja** | erste Halle |
| VON | Datum | **ja** | |
| BIS | Datum | nein | |
| GRUND | Textfeld mehrzeilig | nein | |
| Mitglieder über den Ausfall per E-Mail direkt benachrichtigen | Checkbox | nein | **aus** |

Diese Hallenausfälle erscheinen im Kalender als rote Ganztagseinträge **„Halle nicht verfügbar"**.

#### Trainingsgruppen

Es gibt **Gruppen** als eigenes Objekt (Mitglieder → Gruppen), unabhängig von Mannschaften. Eine Gruppe hat **nur ein Feld: Name**. Gruppen dienen als Zuordnungs- und Adressierungsdimension für Trainings, Umfragen und Statistik-Sichtbarkeit. Der Dialog *Mitglieder zuweisen* kombiniert **Training | Mannschaft(en) | Gruppe(n) | Mitglied(er)** mit der Checkbox *"Bisherige Mitglieder des Trainings überschreiben"*.

Zusätzlich gibt es am Mitglied das Kennzeichen **„Kein Mannschaftsspieler"** (`no_games`) — damit ist die Trennung reiner Trainingsteilnehmer von Mannschaftsspielern abgebildet.

#### Hallenschlüssel

Ja, sichtbar an mehreren Stellen: eigene Verwaltung unter **Orte & Schlüssel**, Anzeige der eigenen Schlüssel im Dashboard-Tab *Schlüssel*, Spalte **Schlüssel** in der Mitgliederübersicht des Vereins (mit *Verantwortlich* und *Aktueller Inhaber*), und am Training die Option *„Teilnehmer mit Hallenschlüssel immer notwendig?"*.

#### Auswertung der Trainingsbeteiligung

Ja, unter **Statistiken**:

- Widget **Training** — *"Zusagen, Absagen & Abwesenheiten je Training"*, Filter Training + **Zeitraum** (Default „Letzte 90 Tage"), Button **Exportieren**.
- Widget **Top 10 Trainingsteilnehmer** — *"Letzte 12 Monate für alle Trainings"*.

Sichtbarkeit steuerbar über `statistics_visibility` am Training (Für Alle / Nur für Admins / Gruppe(n)).

---

### F — Halle und Tischbelegung

- **Pfad im Menü:** Verwalten → **Orte & Schlüssel** (`/venues`)
- **Zweck:** Spiel- und Trainingsstätten, Kapazität, Schlüsselverwaltung.

Zwei Abschnitte: **Orte (n)** mit Buttons *Ort anlegen* / *Ausfall anlegen* und **Schlüssel (n)** mit *Schlüssel anlegen*.

#### Objekt: Ort

Tabelle: **Name | Adresse | Maximale Spieltermine | Aktion**

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `name` — NAME | Text | **ja** | |
| `address` — STRASSE + HAUSNUMMER | Text | **ja** | |
| `postal_code` — POSTLEITZAHL | Zahl | nein | |
| `city` — STADT | Text | **ja** | |
| `max_games` — MAXIMALE ANZAHL GLEICHZEITIGER SPIELTERMINE | Zahl | nein | leer = „nicht definiert" |
| `allow_training_at_max_games` — Bei maximalen Spielterminen ist Training weiterhin möglich? | Checkbox | nein | aus |
| `training_only` — Ort nur für Training bestimmt? | Checkbox | nein | aus |

#### Objekt: Schlüssel

Tabelle: **Name | Ort | Verantwortlicher | Aktueller Inhaber | Weitergabe? | Aktion**

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `name` — NAME | Text | **ja** | |
| `venue_id` — ORT | Auswahl | nein | „nicht definiert" / Orte |
| `responsible_user_id` — VERANTWORTLICHER | Auswahl Mitglied | **ja** | |
| `no_forwarding` — Keine Weitergabe des Schlüssels ermöglichen | Checkbox | nein | aus |

- **Aktionen:** Ort/Schlüssel anlegen, bearbeiten, löschen (Admin). Schlüsselübergabe: jedes Mitglied, das aktueller Inhaber ist, kann den Schlüssel im Dashboard an eine andere Person übergeben — sofern *Keine Weitergabe* nicht gesetzt ist.
- **Tischbelegung / Buchung durch Mitglieder: existiert nicht.** Es gibt keine Tische, keine Zeitfenster, keine Reservierung, keine Freitextregeln. Die einzige Kapazitätsgrenze ist *maximale Anzahl gleichzeitiger Spieltermine* pro Ort, und die betrifft die Terminplanung, nicht eine Buchung. Wenn eure schlanke Lösung Tischbelegung braucht, ist das eine echte Neuentwicklung, kein Nachbau.

---

### G — Mitglieder und Rollen

- **Pfad im Menü:** Verwalten → **Mitglieder** (`/players`), Tabs **Mitglieder** und **Gruppen**; Verwalten → Verein → **Rollen**.

Kopfbuttons: **Mitglieder hinzufügen** (Dropdown), **Excel Import & Update**, **Ränge bearbeiten**, **QTTR Update**.
Filter: Suche · **Alle Rollen** · **Alle Status** · **Alle Mannschaften** · **Alle Trainings** · Zurücksetzen.
Spalten: **Name** (mit QTTR-Badge) | **E-Mail** | **Rolle** | **Status** | **Mannschaft** (Untergliederung STAMM / ERSATZ) | **Training** | **Gruppen** | **Aktion**.

#### Objekt: Mitglied — vollständige Feldliste

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `gender` — GESCHLECHT | Auswahl | nein | Bitte auswählen / männlich / weiblich |
| `first_name` — VORNAME | Text | ja (im eigenen Profil) | |
| `last_name` — NACHNAME | Text | ja (im eigenen Profil) | |
| `role` — ROLLE | Auswahl | nein | Admin / Mannschaftsführer / Trainer / Organisator / Mitglied / Gast |
| `email` — E-MAIL | Text | nein | Mitglieder ohne E-Mail sind möglich |
| `phone` — TELEFONNUMMER | Text | nein | |
| `mobile_phone` — HANDYNUMMER | Text | nein | |
| `birthday` — GEBURTSTAG | Datum | nein | |
| `no_games` — Kein Mannschaftsspieler | Checkbox | nein | aus |
| `ranking_men` — ERWACHSENE | Text | nein | Rang, z. B. „1.2" |
| `ranking_women` — DAMEN | Text | nein | |
| `ranking_seniors` … `ranking_seniors_75` — SENIOREN 40/50/60/70/75+ | Text | nein | |
| `ranking_youth`, `_15`, `_13`, `_11` — JUGEND 19/15/13/11 | Text | nein | |
| `ranking_girls`, `_19`…`_11` — MÄDCHEN 19/15/13/11 | Text | nein | |
| `training_ids[]` — TRAINING | Mehrfachauswahl | nein | |
| `group_ids[]` — GRUPPEN | Mehrfachauswahl | nein | |
| `login_as_users[]` — ANMELDEN ALS FUNKTION FREISCHALTEN FÜR | Mehrfachauswahl Mitglieder | nein | Eltern-/Kind-Stellvertretung |
| `member_number` — MITGLIEDSNUMMER | Text | nein | in Liste sonst „nicht vorhanden" |
| `qttr` — QTTR | Zahl | nein | |

**Nur im eigenen Profil (`/profile`) zusätzlich:**

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| Profilfoto | Datei | nein | JPG/PNG, max. 5 MB, *Zurücksetzen* |
| `language` — SPRACHE | Auswahl | **ja** | **Deutsch** / English |
| `emails_copies` — E-MAIL ADRESSE(N) FÜR KOPIE ALLER BENACHRICHTIGUNGEN | Text | nein | kommagetrennt |
| Kontaktdaten (E-Mail & Telefonnummern) für alle Mitglieder unter "Mein Verein" sichtbar machen | Checkbox | nein | **aus** |
| Geburtstag für Mitglieder nicht anzeigen | Checkbox | nein | aus |
| Aktuelles Passwort / Neues Passwort / Neues Passwort (Bestätigung) | Passwort | nein | |
| — | Button **Profil & Zugang löschen** | | Selbstlöschung möglich |

#### Mitglieder anlegen / einladen

Dropdown **Mitglieder hinzufügen** mit fünf Wegen:

1. **Mitglieder per E-Mail einladen**
2. **Mitglied ohne E-Mail anlegen**
3. **Vereinswechsel bei Mitglied**
4. **Registrierungslink kopieren**
5. **QR Code Registrierung anzeigen**

**Status** eines Mitglieds: **aktiv**, **nicht freigeschaltet**, **unbestätigt**. Beim manuellen Freischalten geht eine Willkommens-E-Mail raus; der Text lässt sich vereinsweit überschreiben (Verein → Daten → *Individuelle Willkommens E-Mail für freigeschaltete Benutzer*), sonst greift die Standard-E-Mail des Anbieters.

#### Import / Export (Excel)

**Reiter Import:** *"Mit dem Import kannst du neue Mitglieder einfach & schnell in größeren Mengen im TT-Planer anlegen. […] Die neu angelegten Mitglieder erhalten eine E-Mail Einladung."* Ablauf in drei Schritten: Vorlage herunterladen → befüllen → hochladen. Dokumentierte Spalten: **Rolle** (Admin, Mannschaftsführer, Trainer, Mitglied, Gast — *Organisator fehlt hier*), **Geschlecht** (männlich, weiblich), **Rang** (z. B. 1.2), **QTTR** (optional), **Geburtstag** (z. B. 06.05.1988); *"Die restlichen Spalten sind selbsterklärend."*

**Reiter Update:** aktuelle Mitgliederliste als Excel **herunterladen**, bearbeiten, wieder hochladen. Zusätzlich dokumentierte Spalten: **Gruppen**, **Trainings** (Format `"Training 1","Training"`), **Anmelden als Funktion** (*"Vollständiger Name des Mitglieds oder der Mitglieder (kommagetrennt), als die sich das Mitglied anmelden darf"*). Dieser Download ist faktisch der Mitglieder-Export.

#### Benutzerrollen

Sechs feste Rollen: **Admin · Mannschaftsführer · Trainer · Organisator · Mitglied · Gast**. Es gibt genau eine Rolle pro Mitglied (Einfachauswahl).

#### Vereinsrollen (Ämter) — klar getrennt von Benutzerrollen

Pfad: Verwalten → Verein → **Rollen** (Seitentitel „Vereinsrollen"). Button *Rolle anlegen*.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| NAME | Text | **ja** | Platzhalter *„z.B. Jugendwart"* |
| BESCHREIBUNG | Textfeld mehrzeilig | nein | *„Kurzbeschreibung der Rolle"* |
| TÄTIGKEITEN (EINE PRO ZEILE ODER KOMMA) | Textfeld mehrzeilig | nein | Platzhalter *Training organisieren / Pressearbeit / Materialpflege* |
| Zugriff auf Inventarverwaltung | Checkbox | nein | aus — *"Mitglieder mit dieser Rolle können Administration → Inventar nutzen und werden bei Mängeln als Verantwortliche angeboten."* |
| Zugriff auf Bekleidungsverwaltung | Checkbox | nein | aus — *"Mitglieder mit dieser Rolle können Verwalten → Bekleidung nutzen, um Größen und ausgegebene Vereinskleidung zu verwalten."* |

**Unterschied:** Benutzerrollen steuern die Rechte in der Anwendung und sind fest vorgegeben. Vereinsrollen sind **frei definierbare Ämter** (Jugendwart, Kassier …) mit Beschreibung und Tätigkeitsliste — sie sind primär eine **Darstellungs- und Organisationsfunktion** (sichtbar unter *Mein Verein → Rollen & Kontaktdaten*) und tauchen als Dimension bei den **Arbeitszeiten** auf. Sie schalten nur **zwei** echte Berechtigungen frei: Inventar und Bekleidung.

#### Gruppen

Eigener Tab. Buttons *Gruppe anlegen* (einziges Feld: **NAME**, Pflicht) und *Mitglieder zuweisen*. Tabelle **Name | Mitglieder**. Abteilungen im engeren Sinn gibt es nicht — Gruppen erfüllen diesen Zweck.

---

### H — Weitere Module

#### Vereinskalender

- **Pfad:** Planen → **Kalender** (`/calendar`), Tabs **Planung** / **Abwesenheiten**.
- **Planung:** Kategorien **Trainings · Spiele · Vereinstermine · Geburtstage · Ereignisse · Halle nicht verfügbar** (als klickbare Farb-Chips zum Ein-/Ausblenden). Button **Ereignis anlegen**, Checkbox **Nur Heimspiele anzeigen**. Ansichten **Monat / Woche / Liste**, Navigation `<` `>` `Heute`, KW-Spalte.
- **Abwesenheiten:** eigener Kalender, Erklärtext *"In diesem Kalender findest du alle eingetragenen Abwesenheiten des Vereins. Hier kannst du Abwesenheiten anlegen, bearbeiten oder löschen — auch solche, die Mitglieder selbst in ihrem Profil angelegt haben."* Button *Abwesenheit anlegen*.
- Unter Verein → **Kalender** gibt es einen weiteren Kalender-Tab (Vereinsverwaltungssicht) — inhaltlich nicht separat geprüft.

#### Vereinstermine

- **Pfad:** Planen → **Vereinstermine** (`/dates`), Tabs Offene/Beendete Termine. Filter: Suche, Zeitraum von/bis. Hinweistext: *"Plane hier z.B. deine Clubmeisterschaften, Sommerfeste oder andere Vereinstermine."*

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `name` — NAME | Text | **ja** | |
| `full_day` — Ganztägig | Checkbox | nein | aus |
| `from_date` — VON | Datum + Uhrzeit | **ja** | |
| `till_date` — BIS | Datum + Uhrzeit | nein | |
| `participate_until` — TEILNAHME HINTERLEGEN BIS | Datum | nein | Anmeldefrist |
| `max_participants` — MAXIMALE TEILNEHMERZAHL (OPTIONAL) | Zahl | nein | |
| `address` — VERANSTALTUNGSORT ADRESSE | Text | nein | |
| `description` — DETAILS | WYSIWYG-Editor (fett/kursiv, Listen, Tabellen, Links, Bild, Video) | nein | |
| `files[]` — DATEIANHÄNGE | Dateien | nein | |
| `hide_date` — Termin unter "Mein Verein" → "Vereinstermine" nicht anzeigen | Checkbox | nein | aus |
| `exclude_calendar_export` — Termine nicht im Kalender exportieren | Checkbox | nein | aus |

Auffällig: Im **Anlegen**-Dialog gibt es **keine Adressatenauswahl**. Es existiert aber der Benachrichtigungstyp *"Einladung für Vereinstermin"* — die Einladung wird also vermutlich nach dem Anlegen separat verschickt. *Nicht verifiziert.*

#### Umfragen

- **Pfad:** Planen → **Umfragen** (`/votes`), Button *Umfrage anlegen*.
- **Adressierung:** *"Ohne Auswahl geht die Umfrage an den gesamten Verein. Du kannst mehrere Mannschaften und Gruppen kombinieren."*

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| MANNSCHAFT(EN) | Mehrfachauswahl | nein | leer = ganzer Verein |
| GRUPPE(N) | Mehrfachauswahl | nein | |
| NAME DER UMFRAGE | Text | **ja** | |
| DETAILS | WYSIWYG-Editor | nein | |
| TYP | Auswahl | nein | **Umfrage / Abstimmung** (Default) · **Personen** |
| ANTWORTEN | beliebig viele Textzeilen, Button *Antwort hinzufügen*, je Zeile Löschen | ja (mind. 1) | |
| MAXIMALE ANTWORTMÖGLICHKEITEN | Zahl | nein | **1** → 1 = Einfachauswahl, >1 = Mehrfachauswahl |
| ABLAUFDATUM | Datum | nein | |
| Antworten für Mitglieder nicht anzeigen | Checkbox | nein | aus |

Hilfetexte zu den Typen: *"**Umfrage / Abstimmung:** Umfrage mit einer oder mehreren Antwortmöglichkeiten"* · *"**Personen:** Umfrage bei der sich Personen hinterlegen können (z.B. Wer kann bei Aktion X helfen?)"*.

**Die Spielverlegungs-Umfrage ist ein eigener, separater Mechanismus** (siehe Modul C) und läuft **nicht** über dieses Umfragemodul.

**Ergebnisdarstellung: nicht gesehen** — es existierte keine Umfrage, und ich habe keine angelegt.

#### Arbeitszeiten

- **Pfad:** **Arbeitszeiten** (`/work-logs`), Untertitel *"Erfasste Stunden aller Rollen"*.
- Drei Kennzahlkacheln: **Stunden diesen Monat**, **Stunden letzter Monat**, **Stunden dieses Jahr**.
- Buttons: **Exportieren** (Dropdown mit Monaten, z. B. 09.2026 … 04.2026) und **Eintrag anlegen**.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| MITGLIED | Auswahl | ja | |
| ROLLE | Auswahl | ja | Vereinsrollen |
| DATUM | Datum | **ja** | |
| STUNDEN | Zahl/Dezimal | **ja** | Platzhalter „z.B. 2.5" |
| KOMMENTAR | Textfeld mehrzeilig | nein | |

Erfassen kann hier offensichtlich der Admin für beliebige Mitglieder; Auswertung als Monatssummen + Monatsexport.

#### Abrechnung

- **Pfad:** **Abrechnung** (`/billing`), Untertitel *"Erfassten Trainingsstunden aller Trainer"*.
- Gleiche drei Kennzahlkacheln, Filter **Alle Trainer**, **Exportieren** (monatsweise), **Eintrag anlegen**.
- Das ist das Trainer-Honorar-Pendant zu den Arbeitsstunden.

#### News / Mitteilungen

- **Anlegen:** Verwalten → Verein → **Neuigkeiten**. **Anzeige:** Mein Verein → **Neuigkeiten** (*"Es wurden noch keine Neuigkeiten geteilt."*).
- Reichweite, Formatierung und Benachrichtigungsverhalten **nicht geprüft** (kein Beitrag vorhanden, Anlegedialog nicht geöffnet). In der Benachrichtigungsmatrix gibt es **keinen** Typ für Vereinsneuigkeiten — Neuigkeiten lösen vermutlich keine Push/E-Mail aus. *Vermutung, siehe Abschnitt 6.*

#### Dateien

- Verwalten → Verein → **Dateien** (Ablage), Anzeige unter Mein Verein → **Dateien**. Inhaltlich nicht geprüft.

#### Abwesenheiten

- **Mitgliedersicht:** Mein Profil → **Abwesenheiten**, Tabelle **Von | Bis | Kommentar | Aktion**, Button *Abwesenheit anlegen*.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| VON | Datum | **ja** | |
| BIS | Datum | nein | |
| KOMMENTAR (NUR FÜR DICH SICHTBAR) | Textfeld mehrzeilig | nein | |

- **Sichtbarkeit:** Der Kommentar ist laut Feldbeschriftung ausdrücklich **nur für das Mitglied selbst** sichtbar. Die Abwesenheit selbst sehen Admins im Kalender-Tab *Abwesenheiten* und der Mannschaftsführer im Dialog *Spieler verwalten* (Abschnitt „Abwesende Spieler").

#### Chat

- **Pfad:** Verein → **Chat**, mit den drei Kanälen **Verein**, **Mannschaften**, **Persönlich** und einem Zähler für Ungelesenes.
- Je Chat: **Zeitraum**-Filter (Default „Letzte 30 Tage"), Nachrichtenfeld, Button **Senden**, Button **Datei(en) anhängen**, Tastenkürzel *„Strg oder Shift + Enter zum Senden"*.
- Zusätzlich gibt es **Nachrichten-Threads direkt am Objekt** (Training, Spiel, Vereinstermin) — sichtbar als *Nachrichten (n)* auf den Karten. Dafür gibt es den Benachrichtigungstyp *"Neue Nachricht im Training, Spiel oder Vereinstermin"*.
- Pro Mannschaft abschaltbar (`disable_chat`).

#### Inventar

- **Pfad:** Verwalten → **Inventar**, Tabs **Inventar** / **Typen**. Filter: Suche, Alle Typen, Alle Hallen, **Zustand: von–bis (0–100)**, Checkbox **Mangel vorhanden**.

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| `inventory_type_id` — TYP | Auswahl | **ja** | selbst anzulegende Typen |
| `name` — NAME | Text | **ja** | |
| `inventory_number` — INVENTARNUMMER | Text | nein | |
| `clubs_venue_id` — HALLE | Auswahl | nein | „– Keine –" / Orte |
| `condition_percent` — ZUSTAND (%) | Zahl | nein | 0–100 |
| `description` — BESCHREIBUNG | Textfeld mehrzeilig | nein | |
| `image` — BILD | Datei | nein | |

Es gibt außerdem ein Mängel-Konzept (Filter *Mangel vorhanden*; Vereinsrollen können *"bei Mängeln als Verantwortliche angeboten"* werden) — den Mängel-Workflow selbst habe ich **nicht gesehen**.

#### Bekleidung

- **Pfad:** Verwalten → **Bekleidung**, Tabs **Übersicht** / **Anfragen** / **Typen**. Übersicht hat einen Button **Excel Export**. Hinweis: *"Lege zuerst Bekleidungstypen an (z.B. Trikot, Trainingsanzug Jacke), damit Mitglieder ihre Größen eintragen können."*
- **Mitgliedersicht:** Mein Profil → **Bekleidung** mit *Meine Größen* (*"Bitte trage deine Größen ein, damit der Verein Trikots und Trainingskleidung passend bestellen kann."*) und *Meine Anfragen*.
- Benachrichtigungstyp: *Bekleidungsanfragen*.

#### Mein Verein (Mitgliedersicht)

Acht Tabs: **Neuigkeiten · Dateien · Mitglieder · Trainings · Vereinstermine · Mannschaften · Spiele · Rollen & Kontaktdaten**. Der Spiele-Tab hat eigene Filter (Suche, Alle Mannschaften, **Alle Spielorte**, Zeitraum von/bis, *Einträge pro Seite*) und zeigt dieselben Spielkarten wie das Dashboard. Kontaktdaten erscheinen hier nur, wenn das Mitglied die entsprechende Checkbox in seinem Profil gesetzt hat.

#### Meine Spiele / Meine Termine

- **Meine Termine** (`/my-dates`): Tabs **Zugesagte Termine** / **Abgesagte Termine**, plus der Button **Kalender abonnieren** (ICS, siehe Modul D).
- **Meine Spiele** (`/my-games`): nicht separat geöffnet; die ICS-URL liegt unter diesem Pfad.

#### Updates / Feedback

Über das Hilfe-Menü: **Updates** (`/updates`, interne Changelog-Seite, nicht geöffnet) und **Feedback** → externes Portal `ttplaner.featurebase.app`.

---

### I — Einstellungen, Pakete, Daten

#### Vereinsweite Einstellungen (Verwalten → Verein → Daten)

| Feld | Typ | Pflicht | Optionen / Default |
|---|---|---|---|
| NAME | Text | nein | Vereinsname |
| WEBSEITE DES VEREINS | URL | nein | |
| FACEBOOK URL | URL | nein | |
| INSTAGRAM URL | URL | nein | |
| YOUTUBE KANAL URL | URL | nein | |
| WHATSAPP KANAL URL | URL | nein | |
| VEREINS FAQ (VERLINKT IM HEADER DES TT-PLANERS) | Datei | nein | |
| LOGO VEREINSSPONSOR | Datei | nein | *"Wenn z.B. eine Firma den TT-Planer Jahresbeitrag sponsort, kann hier das Logo hochgeladen werden. Das Logo wird dann für alle Mitglieder im TT-Planer angezeigt."* |
| LOGO VEREINSSPONSOR LINK | Text | nein | |
| INFORMATIONEN ÜBER DEN VEREIN | WYSIWYG | nein | |
| INDIVIDUELLE WILLKOMMENS E-MAIL FÜR FREIGESCHALTETE BENUTZER | WYSIWYG | nein | *"Sofern hier nichts hinterlegt ist, geht unsere Standard E-Mail raus."* |

Das ist **alles** an vereinsweiten Einstellungen. Es gibt hier **kein** Bundesland, **keine** Benachrichtigungs-Defaults, **keine** Fristen, **keine** DSGVO-/Löschkonfiguration.

Weiter unter Verein → **Übersicht**: Mitgliedertabelle mit den Spalten **Name | Mitglieds Nr. | Zugang seit | Rolle | Schlüssel | Training | Mannschaft | Ersatz** plus Abschnitt **Gruppen** (Name | Mitglieder).

#### Pakete

Pfad: Verwalten → Verein → **Kundenbereich** (`/club/customer-area`) bzw. Button *Jetzt buchen*.

Einleitung: *"Dein Verein kann sich für einen der 2 Pakete (Starter & Champion) entscheiden. Bei der Buchung wird ein Jahresvertrag abgeschlossen, welcher nach der Buchung in Rechnung gestellt wird. Die Rechnung kann bequem per SEPA Überweisung bezahlt werden."*

| | **Starter** | **Champion** |
|---|---|---|
| Monatsbeitrag | 5 € | 15 € |
| Vertragslaufzeit | 12 Monate | 12 Monate |
| Jahresbeitrag | 60 € | 180 € |
| Mitgliederverwaltung (unbegrenzte Anzahl) | ✔ | ✔ |
| Trainingsverwaltung & Teilnahme | ✔ | ✔ |
| Vereinstermine | ✔ | ✔ |
| Vereinsneuigkeiten | ✔ | ✔ |
| Chat (Verein & Gruppen) | ✔ | ✔ |
| **Mannschaftsverwaltung** (unbegrenzte Anzahl) | — | ✔ |
| **Spielverwaltung** | — | ✔ |
| **Click-TT Spieleimport** | — | ✔ |
| **Ersatzanfragen** | — | ✔ |
| **Spielverlegungen** | — | ✔ |
| **Kalender & Abwesenheiten** | — | ✔ |
| **Chat (Mannschaften)** | — | ✔ |
| **Umfragen** | — | ✔ |

Fußnote: *"Die Preise verstehen sich zzgl. Umsatzsteuer. Die Vertragslaufzeit wird nach der Buchung mit einer Jahresrechnung abgerechnet. Ein Wechsel in ein höheres Paket ist jederzeit möglich. Ein Wechsel in ein günstigeres Paket ist zum Vertragsende möglich."*

**Das Starter-Paket enthält also genau das nicht, was ihr für den Spieltagsbetrieb braucht.** Alles rund um Mannschaften, Spiele, click-TT, Ersatz und Verlegung ist Champion-only.

Buchungsformular (**nicht ausgefüllt, nicht abgeschickt**): Welches Paket (Starter/Champion) · Rechnungsempfänger · Strasse + Hausnummer · PLZ + Stadt · Land (Deutschland/Österreich) · Umsatzsteuer-ID · Ansprechpartner · E-Mail Adresse für Rechnungen · Checkbox *Hiermit akzeptiere & bestätige ich die AGB* · Button **Jetzt kostenpflichtig buchen!**

Der aktuelle Paketstatus steht **nicht** im Kundenbereich, sondern nur als Testzeitraum-Hinweis in der Seitenleiste.

#### Datenexport / Datenlöschung

Gefundene Exportwege:

| Was | Wo | Format |
|---|---|---|
| Mitglieder (inkl. Rollen, Ränge, Gruppen, Trainings) | Mitglieder → Excel Import & Update → Reiter *Update* → *Jetzt runterladen* | Excel |
| Arbeitszeiten | Arbeitszeiten → *Exportieren* (monatsweise) | vermutlich Excel/CSV — Format nicht geprüft |
| Trainer-Abrechnung | Abrechnung → *Exportieren* (monatsweise) | dito |
| Bekleidung | Bekleidung → Übersicht → *Excel Export* | Excel |
| Trainingsstatistik | Statistiken → Widget Training → *Exportieren* | nicht geprüft |
| Eigene Termine | Meine Termine → *Kalender abonnieren* | ICS-Abo |

**Einen Gesamtexport aller Vereinsdaten habe ich nicht gefunden.** Es gibt auch **keine** Funktion „Verein löschen" in der Oberfläche. Für das einzelne Mitglied existiert im eigenen Profil der Button **Profil & Zugang löschen**.

#### Datenschutzerklärung, AV-Vertrag, Auftragsverarbeitung

**Nicht gefunden.** In der gesamten eingeloggten Anwendung gibt es **keinen Link** zu Datenschutzerklärung, Impressum, AGB oder AVV — mit einer Ausnahme: im Buchungsformular ist das Wort **AGB** verlinkt. Es gibt keinen Footer mit Rechtstexten. Betreiber, Hosting-Standort und Verarbeitungsumfang lassen sich aus der eingeloggten Anwendung heraus **nicht** bestimmen. Das gehört auf die Website `www.tt-planer.de`, die ich auftragsgemäß nicht als Ersatz herangezogen habe. **Das ist eine echte Lücke dieser Erhebung** (Abschnitt 5).

---

### J — Technisches

- **PWA:** Ja. Seite `/mobile-app` mit zwei Anleitungen (**Installation für iOS** / **Installation für Android**). iOS-Weg: `https://app.tt-planer.de` in Safari öffnen → anmelden → Teilen-Icon → „Zum Home-Bildschirm" → App hinzufügen → *"Öffne diese und tippe auf das Glocken-Symbol, um Mitteilungen zu erlauben."* Keine native App im App Store erwähnt.
- **Push:** Web-Push über die Browser-Berechtigung, ausgelöst durch die Glocke in der Kopfzeile (drei Zustände, siehe Modul B).
- **URL-Muster:** Durchgehend klassische server-gerenderte Routen, keine sichtbare REST-API. Beispiele: `/teams`, `/teams/players-management`, `/games`, `/trainings`, `/players`, `/club`, `/club/customer-area`, `/venues`, `/votes`, `/dates`, `/calendar`, `/statistics/dashboard`, `/my-club/news`, `/chat/{unread|teams|personal}`, `/profile`, `/billing`, `/work-logs`, `/inventory`, `/clothing`, `/updates`, `/mobile-app`, `/logout`. Einziger API-artiger Endpunkt: `GET /my-games/calendar/subscribe?token=<UUID>&user=<UUID>` (ICS). **Ich habe keine URL selbst aufgerufen, außer den regulären Seiten der Navigation.**
- **Technologie-Indizien:** CSS-Klassen wie `menu-link`, `layout-menu-toggle`, `btn btn-icon btn-sm btn-primary`, `modal show`, `dropdown-menu` — Bootstrap-basiertes Admin-Template (Stil „Sneat"/vergleichbar). Formularfelder haben sprechende `name`-Attribute (`players_option`, `replacements_option`, `reminder_hours` …), was auf ein klassisches Server-Framework mit Formular-Binding hindeutet.
- **Smartphone-Verhalten:** Die Seitenleiste ist als Overlay mit Hamburger-Toggle ausgeführt (`d-block d-xl-none`), Tabellen scrollen horizontal mit sichtbarer Scrollbar, Kalender hat Monat/Woche/Liste. Das Layout ist responsiv angelegt. **Ich habe die Oberfläche nicht auf einem echten Smartphone oder in einer verkleinerten Ansicht getestet**, die Beurteilung stützt sich nur auf diese Struktur-Indizien.

---

## 3. Rollen-Berechtigungs-Matrix

Diese Matrix ist **teilweise erschlossen**, nicht durchgetestet: Es gab nur ein Mitglied, und das war Admin. Ich konnte mich nicht als Trainer, Mannschaftsführer, Organisator oder Gast anmelden. Was ich mit „ja" markiere, stützt sich entweder auf explizite Hilfetexte oder auf die Struktur der Oberfläche. Alles Übrige ist **unklar**.

| Funktion | Admin | Mannschaftsführer | Trainer | Organisator | Mitglied | Gast |
|---|---|---|---|---|---|---|
| Alle Verwaltungsmenüs sehen (Mitglieder, Verein, Orte, Inventar, Bekleidung) | ja | unklar | unklar | unklar | nein (angenommen) | nein (angenommen) |
| Mannschaft anlegen/bearbeiten/löschen | ja | unklar | unklar | unklar | unklar | unklar |
| Kader pflegen (Stamm/Ersatz) | ja | unklar | unklar | unklar | unklar | unklar |
| Aufstellung verwalten (*Spieler verwalten*) | ja | **ja** (Hilfetext) | unklar | unklar | nein (angenommen) | unklar |
| Ersatzanfragen manuell erstellen/verwalten | ja | **ja** (Hilfetext: *„Der Mannschaftsführer oder Admin"*) | unklar | unklar | nein | unklar |
| Spielverlegung starten | ja | unklar | unklar | unklar | unklar | unklar |
| Aufstellung teilen | ja | unklar | unklar | unklar | unklar | unklar |
| Spieltermine anlegen / click-TT importieren | ja | unklar | unklar | unklar | unklar | unklar |
| Trainings anlegen/bearbeiten | ja | unklar | unklar | unklar | unklar | unklar |
| Trainingsausfall anlegen | ja | unklar | **wahrscheinlich ja** | unklar | unklar | unklar |
| Teilnehmerliste eines Inkognito-Trainings sehen | ja | unklar | **ja** (Feldtext: *„nur für Trainer sichtbar"*) | unklar | nein | nein |
| Trainingsteilnahmen in Statistik sehen | ja | unklar | unklar | unklar | abhängig von `statistics_visibility` (*Für Alle / Nur für Admins / Gruppe(n)*) | unklar |
| Mitglieder anlegen/einladen/bearbeiten | ja | unklar | unklar | unklar | nein | nein |
| Vereinsrollen anlegen | ja | unklar | unklar | unklar | nein | nein |
| Inventar verwalten | ja | nur mit Vereinsrolle „Zugriff auf Inventarverwaltung" | dito | dito | dito | dito |
| Bekleidung verwalten | ja | nur mit Vereinsrolle „Zugriff auf Bekleidungsverwaltung" | dito | dito | dito | dito |
| Abwesenheiten anderer sehen/bearbeiten | **ja** (Kalender-Hilfetext) | teilweise (im Dialog *Spieler verwalten*) | unklar | unklar | nein | nein |
| Umfragen anlegen | ja | unklar | unklar | **wahrscheinlich ja** (Rollenname) | unklar | unklar |
| Arbeitszeiten für andere erfassen | ja | unklar | unklar | unklar | unklar | unklar |
| Eigene Teilnahme melden | ja | ja | ja | ja | ja | unklar |
| Eigene Benachrichtigungen konfigurieren | ja | ja | ja | ja | ja | unklar |
| Eigene Abwesenheiten anlegen | ja | ja | ja | ja | ja | unklar |
| Kalender abonnieren (ICS) | ja | ja | ja | ja | ja | unklar |
| Schlüssel weitergeben | nur als aktueller Inhaber | dito | dito | dito | dito | dito |
| Paket buchen / Rechnungsdaten | ja | nein (angenommen) | nein | nein | nein | nein |

Die Rolle **Organisator** taucht in der Rollenauswahl und im Rollenfilter auf, fehlt aber in der Spaltenbeschreibung des Excel-Imports. Was sie konkret darf, ist **nirgends erklärt**.

---

## 4. Automatismen im Überblick

| Auslöser | Was passiert | Empfänger | Einstellbar? |
|---|---|---|---|
| Stammspieler sagt ab (Modus *Einzeln nach Reihenfolge*) | Ersatzanfrage an den ersten Ersatzspieler der Liste; lehnt er ab, rückt die Anfrage zum nächsten weiter | jeweils ein Ersatzspieler | Modus ja; **Weiterrück-Frist: kein Feld gefunden** |
| Stammspieler sagt ab (Modus *Alle gleichzeitig*) | alle hinterlegten Ersatzspieler werden gleichzeitig angefragt; bei erster Zusage werden **alle anderen Anfragen gelöscht** | alle Ersatzspieler | Modus ja |
| Stammspieler sagt ab (Modus *Manuell*) | **nichts** — MF/Admin muss selbst anfragen | — | ja |
| Ersatzanfrage wird angenommen | Meldung *„Ersatz erfolgreich für dich gefunden"* | der ursprüngliche Stammspieler | pro Mitglied pro Kanal |
| Ersatzanfrage wird gestellt | Meldung *„Ersatzanfrage an dich gestellt"* | angefragter Ersatzspieler | pro Mitglied pro Kanal |
| Manuelle Ersatzanfrage wird angenommen | Spieler wird automatisch zur Aufstellung hinzugefügt | — | ja, `manual_replacement_request_auto_add` pro Mannschaft (Default **an**) |
| Neues Mannschaftsspiel angelegt / importiert | Meldung *„Neues Mannschaftsspiel angelegt"* | Mannschaft | pro Mitglied pro Kanal |
| Spieler wird einem Spiel zugeordnet | Meldung *„Mannschaftsspiel zugeordnet"* | betroffener Spieler | pro Mitglied pro Kanal |
| Spieler wird im Dialog hinzugefügt / entfernt / auf Absage gesetzt | **E-Mail an den Spieler** | betroffener Spieler | nicht ersichtlich abschaltbar |
| X Stunden vor Spielbeginn | *„Erinnerung an Spieltermin"* | Mitglied | **ja — Stundenzahl pro Mitglied**, Default 24 im Testprofil |
| `reminder_hours` vor Trainingsbeginn | *„Teilnahme am Training?"* | zugeordnete Mitglieder | **ja — Stundenzahl pro Training**, Default **5**; Mitglied kann außerdem auswählen, für welche Trainings |
| Offene Rückmeldungen vorhanden | *„Erinnerung an offene Spiel- und Terminteilnahmen"* | vermutlich nur Mitglieder ohne Rückmeldung | pro Mitglied pro Kanal; **Zeitpunkt/Frequenz nicht gefunden** |
| Trainingsausfall angelegt | *„Benachrichtigung bei Trainingsausfall"*; bei Hallenausfall zusätzlich optionale Sofort-E-Mail | zugeordnete Mitglieder | Typ pro Mitglied; Sofort-E-Mail per Checkbox (Default **aus**) |
| Alle Trainer eines Trainings haben abgesagt | Training wird **automatisch abgesagt** | — | ja, `auto_absence_no_trainers` pro Training (Default aus) |
| Gesetzlicher Feiertag | Training findet nicht statt | — | ja, `consider_public_holidays` pro Training (Default aus) |
| Schulferien | Training findet nicht statt | — | ja, `consider_public_school_holidays` pro Training (Default aus) |
| Automatische Trainingszusage aktiv | Mitglied wird bis zum Stichtag automatisch auf „dabei" (oder „komme später") gesetzt | Mitglied selbst | ja, pro Mitglied pro Training mit Enddatum |
| Spielverlegung gestartet | Terminumfrage über bis zu 3 Ersatztermine | alle **verfügbaren** Spieler der Mannschaft | Typ pro Mitglied |
| Alle haben über die Verlegung abgestimmt | Benachrichtigung an den Initiator, der dann den Termin festlegt | Initiator | — |
| Spielverlegung bestätigt | *„Bestätigung der Spielverlegung"* | Mannschaft | pro Mitglied pro Kanal |
| Vereinstermin angelegt | *„Einladung für Vereinstermin"* | unklar (kein Adressatenfeld im Anlegedialog) | Typ pro Mitglied |
| X vor Vereinstermin | *„Erinnerung an Vereinstermin"* | Teilnehmer | Typ pro Mitglied; **Vorlaufzeit nicht gefunden** |
| Neue Chat-Nachricht | Push, falls *„App Benachrichtigung direkt bei jeder neuen Chat Nachricht"* aktiv (Default an) | Chat-Teilnehmer | ja |
| Ungelesene Chat-Nachrichten liegen länger | *„Erinnerung an ungelesene Nachrichten im Chat"* | Mitglied | Typ pro Mitglied; **Frist nicht gefunden** |
| Nachricht an Training/Spiel/Vereinstermin | *„Neue Nachricht im Training, Spiel oder Vereinstermin"* | Beteiligte | pro Mitglied pro Kanal |
| Mitglied wird manuell freigeschaltet | Willkommens-E-Mail | das Mitglied | Text vereinsweit überschreibbar |
| Mitglieder-Excel-Import | E-Mail-Einladung an alle neu angelegten Mitglieder | neue Mitglieder | nicht ersichtlich abschaltbar |
| Kalender-Abo | ICS aktualisiert sich **ca. alle 24 Stunden** | Abonnent | nein |
| Bekleidungsanfrage | *„Bekleidungsanfragen"* | zuständige Rolle | pro Mitglied pro Kanal |
| Jede E-Mail-Benachrichtigung | Kopie an die im Profil hinterlegten Zusatzadressen | z. B. Eltern | ja, pro Mitglied |

---

## 5. Offene Punkte

Was ich **nicht** sehen konnte, und warum:

1. **Verhalten der Ersatzkette in Aktion.** Der Verein hatte nur ein Mitglied. Kein Kader, keine Ersatzliste, keine Anfrage — folglich keine Beobachtung von Weiterrücken, Timing, Leerlauf oder dem Aussehen der Anfrage beim Ersatzspieler. Das Auslösen hätte echte Benachrichtigungen verschickt und war ausgeschlossen.
2. **Frist, nach der die Ersatzanfrage weiterrückt.** In der gesamten Oberfläche kein Feld dafür. Entweder Backend-Konstante oder an den Spieltermin gekoppelt.
3. **Wer genau erinnert wird** (alle vs. nur Nichtantworter) bei Typ 8 und Typ 14. Nur aus der Beschriftung erschließbar, nicht nachprüfbar.
4. **Zeitpunkt/Frequenz** von *„Erinnerung an offene Spiel- und Terminteilnahmen"* und *„Erinnerung an ungelesene Nachrichten im Chat"* — keine einstellbare Vorlaufzeit gefunden.
5. **Vorlaufzeit für „Erinnerung an Vereinstermin"** — kein Feld gefunden.
6. **Ergebnisdarstellung von Umfragen** — es existierte keine Umfrage, und ich habe keine angelegt.
7. **Rechte der Rollen Mannschaftsführer, Trainer, Organisator, Gast** — kein zweites Konto zum Gegentest, keine Rechte-Matrix in der Oberfläche. Die Rolle **Organisator** ist nirgends erklärt.
8. **Zuweisung von Vereinsrollen an Mitglieder** — im Mitglieds-Dialog gibt es kein Feld dafür. Vermutlich geschieht das im Vereinsrollen-Dialog (dessen unteren Teil ich gesehen habe — dort standen nur die beiden Berechtigungs-Checkboxen) oder unter *Mein Verein → Rollen & Kontaktdaten*. **Nicht gefunden.**
9. **News/Mitteilungen anlegen** — Dialog nicht geöffnet, kein Beitrag vorhanden. Reichweite, Formatierung und Benachrichtigungsverhalten unbekannt.
10. **Dateien-Modul** — nicht geprüft.
11. **Mängel-Workflow im Inventar** — nur der Filter *Mangel vorhanden* und der Rollen-Hilfetext gesehen, nicht der Ablauf.
12. **Bekleidungstypen und Anfrage-Workflow** — es waren keine Typen angelegt.
13. **Verein → Kalender-Tab und Verein → Dateien-Tab** — nicht geöffnet.
14. **Adressatenauswahl bei Vereinsterminen** — im Anlegedialog nicht vorhanden; wie die Einladung ausgelöst wird, blieb offen.
15. **Datenschutzerklärung, AVV, Betreiber, Hosting** — in der eingeloggten Anwendung **nicht verlinkt**. Nur „AGB" im Buchungsformular. Ich habe die öffentliche Website nicht als Ersatz herangezogen, weil der Auftrag die Anwendung betraf. **Das solltest du separat auf `www.tt-planer.de` nachlesen, bevor du das als geklärt betrachtest.**
16. **Format der Exporte** (Arbeitszeiten, Abrechnung, Statistik) — nicht heruntergeladen, also Dateiendung unbekannt. Nur bei Mitgliedern und Bekleidung steht „Excel" explizit dran.
17. **Beendete Termine** (Spiele/Vereinstermine) — beide Listen waren leer; wie ein abgeschlossenes Spiel mit Ergebnis dargestellt wird, ist unbekannt. Insbesondere: **ob überhaupt Ergebnisse erfasst oder importiert werden**, konnte ich nicht feststellen.
18. **Massenaktionen** über die Zeilen-Checkboxen in der Spielterminliste — Aktionsleiste nicht sichtbar gemacht (hätte Auswahl erfordert, was ungefährlich gewesen wäre, aber die dann angebotenen Aktionen wären teils schreibend).
19. **Verhalten auf echtem Smartphone** — nicht getestet.
20. **„Ränge bearbeiten"** — Button aktiviert offenbar einen Inline-Bearbeitungsmodus in der Mitgliedertabelle; mit einem Mitglied ohne Rang war nichts sichtbar.

---

## 6. Unsicherheiten

Ausdrücklich als **Vermutung** markiert — nicht verifiziert:

- **Bundesland für Feiertage und Schulferien:** Es gibt kein Bundesland-Feld. Da der Ort eine **Postleitzahl** hat, vermute ich, dass die Region daraus abgeleitet wird. Möglich wäre auch eine serverseitige Zuordnung über die Vereinsadresse — die es in den Vereinsdaten aber gar nicht gibt. **Ungeklärt.**
- **„Bequem in click-TT":** Meine Einschätzung ist, dass damit die Ablage von **Spiel Code und Spiel PIN** für den digitalen Spielbericht (NuScore) gemeint ist, nicht ein Datenrückfluss. Eine Export- oder Übertragungsfunktion nach click-TT habe ich **nicht gefunden** — aber „nicht gefunden" ist nicht dasselbe wie „existiert nicht". Prüfe das gegen die Hilfeseiten des Anbieters, bevor du es als gesichert nimmst.
- **Erinnerung nur an Nichtantworter:** Der Typname *„Erinnerung an offene Spiel- und Terminteilnahmen"* legt das nahe. Vermutung.
- **Vereinsneuigkeiten lösen keine Benachrichtigung aus:** In der 15-zeiligen Benachrichtigungsmatrix gibt es keinen entsprechenden Typ. Daraus schließe ich, dass News still veröffentlicht werden. Vermutung.
- **Starter-Paket-Sperren in der Oberfläche:** Da der Verein im Testzeitraum ist, war **nichts** gesperrt. Wie eine Sperre im Starter-Paket konkret aussieht (ausgegraut, Schloss, Menüpunkt fehlt ganz), habe ich **nicht gesehen**. Die Paketabgrenzung in Abschnitt I stammt ausschließlich aus der Vergleichstabelle im Kundenbereich.
- **Rollenrechte:** Die gesamte Matrix in Abschnitt 3 ist über weite Strecken erschlossen, nicht getestet. Behandle sie als Hypothese.
- **Aufstellung automatisch oder manuell:** Ich schließe aus der Struktur des Dialogs *Spieler verwalten* auf „halbautomatisch mit manueller Endentscheidung". Bei *Feste Stammspieler* deutet der Hilfetext auf automatisches Setzen der Stammspieler hin, bei *Offene Spieler* legt der Mannschaftsführer laut Hilfetext bei Überbesetzung die finale Aufstellung fest. Den tatsächlichen Ablauf habe ich nicht beobachtet.
- **Technologie-Stack:** Bootstrap-Admin-Template mit klassischem serverseitigem Rendering — Indizienschluss aus CSS-Klassen und Formularaufbau, keine Bestätigung.
- **Rückmelde-Optionen bei Spielen:** Dass Spieler bei Spielen dieselben drei Buttons haben wie beim Training, habe ich **nicht gesehen**. Die Zustände in Abschnitt C sind aus den Abschnittsüberschriften des Verwaltungsdialogs abgeleitet.
- **Ob ein Bemerkungsfeld zur Rückmeldung existiert:** Ich habe keines gefunden, kann aber nicht ausschließen, dass es in der Spielersicht auf einen Spieltermin erscheint, die ich nicht in der Spielerrolle gesehen habe.

---

## Kurzfazit für euren Nachbau

Das Herzstück, das ihr wirklich nachbauen müsst, ist überschaubar: **Mannschaft mit Stamm-/Ersatzkader und Prioritätsreihenfolge · Spieltermin aus ICS · Rückmeldung mit drei Zuständen · eine Ersatzkette mit drei Modi · Push und E-Mail mit pro Person abschaltbaren Ereignistypen · Erinnerung mit konfigurierbarem Stundenvorlauf · ein Text-Baukasten für „Aufstellung teilen".** Alles andere — Inventar, Bekleidung, Arbeitszeiten, Abrechnung, Statistik, Chat — ist Beiwerk, das ihr euch sparen könnt.

Die zwei Stellen, an denen ihr es **besser** machen könnt, weil der TT-Planer dort schwach ist: erstens die **fehlende Transparenz der Ersatzkette** (keine sichtbare Frist, kein „Kette leergelaufen"-Signal), zweitens der **fehlende Rückweg nach click-TT** — wer die Aufstellung ohnehin von Hand in NuScore tippt, hat die Hälfte der Ersparnis wieder verloren.
