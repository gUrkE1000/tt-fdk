# 🧑‍💻 Handbuch zur Nutzung (TTV Spielplaner)

Dieses Handbuch beschreibt die Nutzung des TTV Spielplaners aus der Sicht der vier verschiedenen Benutzerrollen: **Spieler**, **Mannschaftsführer**, **Sportwart** und **Administrator**.

---

## 🔒 1. Anmeldung & Passwortschutz

### Das globale Vereinspasswort (Password Gate)
Die gesamte Plattform ist vor unbefugtem Zugriff geschützt. Beim ersten Besuch der Seite wirst du aufgefordert, das **Vereinspasswort** einzugeben.  
* **Tipp für Bequemlichkeit (Bypass-Link):** Du kannst das Passwort in der URL mitsenden, um den Passworteingabebildschirm komplett zu überspringen (z. B. ideal zum Abspeichern als Lesezeichen oder zum Teilen in WhatsApp-Gruppen):  
  `https://deinverein.github.io/spielplaner/?pw=DasVereinsPasswort` oder `?password=DasVereinsPasswort`.  
* **Passwort-Gate zurücksetzen:** Administratoren können in der Fußzeile der Anwendung über den Button *"Sicherheit: Passwort-Gate zurücksetzen"* das gespeicherte Passwort aus dem lokalen Speicher entfernen.  

### Registrierung & Automatische Profil-Verknüpfung
Damit Spieler ihre Accounts registrieren können, ohne dass mühsam im Nachhinein manuell Berechtigungen, Q-TTR-Punkte oder Mannschaftszuordnungen verknüpft werden müssen, verwendet die Plattform eine **intelligente, automatische Namenserkennung**:

* **Vorarbeit durch den Verein:** Der Sportwart oder Administrator importiert bzw. pflegt die Spieler-Datenbank im Voraus (z. B. über den HTML-Kader-Import). Hierbei existieren die Spieler mit ihrem vollen Namen (z. B. `"Max Mustermann"`), werden jedoch im Tool datenschutzfreundlich abgekürzt dargestellt (z. B. `"Max M"`).  
* **Der Registrierungsprozess:**  
  * Ein Spieler registriert sich neu im System mit seiner E-Mail-Adresse, einem Passwort und seinem **vollen Namen** (z. B. `"Max Mustermann"`).  
  * Das System vergleicht diesen Namen (ohne Berücksichtigung von Groß-/Kleinschreibung und führenden/nachfolgenden Leerzeichen) mit der bereits existierenden Liste der importierten Profile.  
  * Wird eine Übereinstimmung gefunden, **verknüpft das System dieses bestehende Profil sofort und vollautomatisch mit dem neuen Benutzer-Account**.  
* **Vorteile der automatischen Verknüpfung:**  
  * **Erhalt aller Daten:** Alle historischen Rückmeldungen (RSVPs), Abwesenheiten, Mannschaftszuordnungen, TTR-Punkte und bereits vorgenommenen Aufstellungen (Lineups) bleiben nahtlos erhalten.  
  * **Kein Administrativer Aufwand:** Es muss kein Administrator manuell eingreifen, um dem neu registrierten Account sein Profil zuzuordnen.  
  * **Cascade-Sicherheit:** Durch datenbankseitige `ON UPDATE CASCADE`-Regeln sowie automatische JSONB-Lineup-Remappings werden alle Tabellenreferenzen sicher auf die neue Benutzer-ID umgeschrieben.  

---

## 🧑‍🤝‍🧑 2. Die Rollen und ihre Funktionen

### 🧑‍💻 A. Spieler (Rolle: `player`)
Als Spieler steht für dich die schnelle Rückmeldung und deine persönliche Planung im Vordergrund.

#### 1. Anmeldung  
* **Passwortlose Anmeldung (Schnellzugriff):** Wähle einfach deinen Namen aus der Liste aus und klicke auf "Anmelden". Du bist sofort eingeloggt und kannst deine Verfügbarkeiten eintragen.  
* **Passwort-Login (Optional):** Falls du dich mit E-Mail und Passwort registriert hast, kannst du dich auch darüber anmelden.  

#### 2. Spielbereitschaft zurückmelden (RSVP)  
* Im Reiter **"Mannschaften"** siehst du die anstehenden Spiele deines Teams.  
* Unter den Spieldetails findest du in der linken Spalte das Abgabeformular mit berührungsfreundlichen Schaltflächen:  
  * **Zusage (Grün):** Du bist spielbereit und stehst zur Verfügung.  
  * **Absage (Rot):** Du kannst an diesem Termin nicht spielen.  
  * **Unsicher (Gelb):** Du weißt es noch nicht genau (z. B. wegen Schichtarbeit).  
* Du kannst zu jeder Rückmeldung eine **Bemerkung** hinzufügen (z. B. "Kann erst ab 19:30 Uhr" oder "Fahre direkt zum Auswärtsspiel").  
* **Datenschutz & Übersicht:** Um Verwirrung zu vermeiden, ist die detaillierte Feedback-Liste ("Aktuelle Rückmeldungen:") im Mannschafts-Tab für reine Spieler-Accounts ausgeblendet.  

#### 3. Ersatzspieler-Meldung (Mannschaftsübergreifend)  
* Du möchtest in einer anderen Mannschaft als Ersatzspieler aushelfen? Navigiere einfach zu dem entsprechenden Team und klicke auf ein Spiel.  
* Trage dich dort mit **"Zusage" (Grün)** ein. Du wirst in der Teamübersicht und beim Sportwart sofort als verfügbarer Ersatzspieler aufgeführt.  

#### 4. Mein Kalender (Abwesenheiten)  
* Im Reiter **"Mein Kalender"** kannst du Zeiträume eintragen, an denen du generell nicht zur Verfügung stehst (Urlaub, Dienstreisen, Lehrgänge, Krankheit).  
* Gib ein Start- und Enddatum sowie einen optionalen Grund ein.  

#### 5. Aktualisieren-Button (Datenabgleich)  
* Für reine Spieler-Accounts ist der Button **"🔄 Aktualisieren"** im Mannschafts-Tab ausgeblendet. Er steht nur Benutzern zur Verfügung, die sich mit Passwort und erweiterten Rechten (Mannschaftsführer, Sportwart, Admin) angemeldet haben, um unnötige Anfragen und Schnittstellen-Sperren zu vermeiden.  

---

### 📋 B. Mannschaftsführer (Rolle: `team_manager`)
Als Mannschaftsführer bist du für die Aufstellung und Pflege deines Teams verantwortlich.

#### 1. Anmeldung & Benachrichtigungs-Banner seit letztem Login  
* **Wichtig:** Du musst dich zwingend mit deiner **E-Mail und deinem Passwort anmelden**, um deine erweiterten Rechte freizuschalten. Bei einer passwortlosen Anmeldung über das Dropdown wirst du vom System als normaler Spieler eingestuft!  
* **🔔 Rückmeldungs-Änderungen seit dem letzten Login:** Sobald du eingeloggt bist und deine Mannschaft auswählst, erscheint oben über der Spieleliste ein hervorgehobenes blaues Benachrichtigungs-Banner. Dort siehst du auf einen Blick alle neuen Zu-, Ab- und Ersatzmeldungen von Spielern für Spiele deiner Mannschaft, die seit deinem vorherigen Login eingegangen sind (z. B. *"Spieler Max Mustermann hat für das Heimspiel gegen TTC Musterstadt am 15.10. zugesagt"*).  

#### 2. Spieler & Ersatzspieler zu Spielen hinzufügen (RSVP-Steuerung)
Du kannst Rückmeldungen (Zusagen/Absagen) für dein Team direkt eintragen und steuern. Dies ist ideal, wenn dir ein Spieler mündlich, per E-Mail oder per WhatsApp Bescheid gibt:  
* **Wo finde ich das?** Navigiere zum Reiter **"Mannschaften"** und wähle deine Mannschaft aus. In der Aufstellungsliste des jeweiligen Spiels ("Aufstellung (Stamm 1-4 / Ersatz)") befindet sich neben jedem Spieler ein Dropdown-Feld mit den Statuswerten "Ja", "Nein", "Vielleicht" und "Keine Antwort".  
* **Berechtigungs-Einschränkung:** Du kannst die RSVPs deiner eigenen Stammspieler jederzeit ändern. Für Ersatzspieler (Spieler anderer Mannschaften) gilt: **Nur der Mannschaftsführer ihrer jeweiligen Stamm-Mannschaft** (oder Sportwarte/Admins) kann deren Rückmelde-Status ändern. Das verhindert ungewollte RSVP-Manipulationen zwischen den Mannschaften.  

#### 3. Automatische Mannschaftsaufstellung & Sortier-Logik (Lineup-Engine)
Die Aufstellung pro Spiel (maximal 5 Spieler auf dem Spielbericht) wird automatisch berechnet und sortiert:  
* **A. RSVP-Priorität & Taktische Option "Ja als Ersatz" (5-Stufen-Logik):**  
  1. **Ja (Zusage):** Haben höchste Priorität und bilden die ersten 4 Stamm-Positionen.  
  2. **Ja als Ersatz (`yes_sub`):** 5. Option im Dropdown-Menü für Mannschaftsführer, Sportwart und Admin. Haben sich z. B. 5 oder mehr Spieler mit "Ja" gemeldet, kannst du Spieler, die zwar können, aber taktisch nicht unter den ersten 4 spielen sollen, auf "Ja als Ersatz" setzen. Sie werden dann auf Position 5, 6 usw. einsortiert.  
  3. **Keine Antwort (unentschieden / null):** Folgen danach als Standby.  
  4. **Vielleicht:** Stehen an vierter Stelle.  
  5. **Nein (Absage):** Werden ans Ende der Liste einsortiert.  
* **B. Vereinsrangfolge (Tie-Breaker):** Haben mehrere Spieler denselben RSVP-Status, entscheidet die feste Rangfolge im Verein:  
  * **Team-Nummer** aufsteigend ➔ **Positions-Nummer** aufsteigend ➔ **Name** alphabetisch.  
* **C. Der Kader (4 Stamm + 1 Ersatz):** Aus der sortierten Liste werden die Top 5 Spieler genommen. Die ersten 4 Spieler bilden die Stammaufstellung des Spiels. Der 5. Spieler wird deutlich als **"Ersatz"** (mit amberfarbener Markierung und "Ersatz"-Badge) dargestellt.  

#### 4. Team-Matrix & WhatsApp-Nachrichten-Generator  
* Im Reiter **"Team-Matrix"** siehst du alle Spiele deiner Mannschaft und alle deine Spieler in einer kompakten Tabelle.  
* Änderungen an Verfügbarkeiten in der Matrix aktualisieren die Datenbank direkt ohne zusätzliche Bestätigungs-Popups.  
* **💬 Automatische WhatsApp-Nachrichten (WhatsApp-Zeile ganz unten in der Matrix):**  
  * Ein Klick auf das WhatsApp-Icon unter einem Spiel generiert einen vorgefertigten Text und kopiert ihn direkt in deine Zwischenablage.  
  * **Option 1 (≥ 4 Zusagen):** Generiert eine Aufstellungs-Nachricht mit den 4 Stammspielern und (falls vorhanden) einem 5. Backup-Spieler.  
  * **Option 2 (< 4 Zusagen):** Generiert einen dringenden Aufruf zur Rückmeldung mit Nennung der noch fehlenden Spieler (inkl. korrekter Singular-/Plural-Grammatik), Auflistung der bisherigen Zusagen sowie einer automatischen Rückmeldefrist (1 Woche vor dem Spiel).  
  * **Parallelspiel-Erkennung:** Findet zeitgleich ein Spiel einer anderen Vereinsmannschaft am selben Ort (Heim oder Auswärts) statt, fügt der Generator automatisch einen freundlichen Hinweis an (z. B. *"Die zweite Mannschaft hat zeitgleich ebenfalls ein Heimspiel..."*).  
  * **Ankunftszeit & Spielort:** Bei 4 oder mehr Zusagen wird am Ende der Nachricht automatisch die Ankunftszeit bzw. der Treffpunkt eingefügt (bei Heimspielen 1 Stunde vor Spielstart in der Halle; bei Auswärtsspielen 30 Minuten vor Spielstart am jeweiligen Spielort).  

#### 5. Abwesenheits-Kalender  
* Du hast Zugriff auf den Reiter **"Abwesenheits-Kalender"**, der die kommenden 4 Monate in einem kompakten **2x2-Grid** anzeigt. Klickst du auf einen Tag, siehst du alle abwesenden Spieler deines Vereins mit Grund.  

#### 6. On-Demand Online-Kalendersynchronisation  
* Wenn du als Mannschaftsführer im Mannschafts-Tab auf **"🔄 Aktualisieren"** klickst, wird der Online-Kalender von myTischtennis.de für deine Mannschaft live im Hintergrund auf Änderungen, neue Spiele oder Spielabsagen geprüft.  

---

### 🏓 C. Sportwart (Rolle: `sportwart`)
Als Sportwart hast du die sportliche Gesamtleitung des Vereins und planst die Aufstellungen mannschaftsübergreifend.

#### 1. Anmeldung  
* Melde dich mit deiner **E-Mail und deinem Passwort** an.  

#### 2. Spieler & Q-TTR-Punkte verwalten  
* Im Reiter **"Sportwart"** kannst du neue Spielerprofile anlegen (vollkommen unabhängig von einem registrierten Supabase-Konto).  
* Du kannst für jeden Spieler die aktuellen **Q-TTR-Punkte** eintragen.  
* Weise den Spielern ihre feste Position im Verein zu (`team_number` und `position_number`). Dies bestimmt die automatische Nachrücker-Hierarchie bei Ersatzspielern.  

#### 3. HTML-Kader-Import & Abgleich Engine  
* Über den Kader-Import kannst du die Mannschaftsmeldung von myTischtennis.de einpflegen.  
* **Multi-Layer Fetch & Fallback:** Das System versucht zunächst, den HTML-Kader automatisch über CORS-Proxies abzurufen. Sollte dies z. B. durch Adblocker blockiert werden, steht dir ein manuelle Kopier-Fallback ("HTML manuell einfügen") zur Verfügung.  
* **Transparenter Datenabgleich:** Nach dem Parsen vergleicht das System den HTML-Kader mit der Datenbank und gruppiert die Ergebnisse vor der Übernahme transparent:  
  * **Bereits aktuell:** Keinerlei Änderungen erforderlich.  
  * **Nur aktualisiert:** Positionen oder Q-TTR-Punkte haben sich geändert.  
  * **Ersetzt:** Spieler wurden ersetzt, umbenannt oder neu hinzugefügt.  

#### 4. 4-Monats-Abwesenheits-Planer  
* Du hast Zugriff auf den **Abwesenheits-Kalender** (2x2 Grid für die kommenden 4 Monate).  
* Klickst du auf einen Tag, siehst du im Detail, wer an diesem Tag aus welchen Gründen fehlt.  

#### 5. Aufstellungs-Kontrolle & mannschaftsübergreifendes Lineup  
* In der Gesamtübersicht und im Mannschafts-Tab siehst du für jedes Spiel die automatisch berechnete Aufstellung (4 Stamm + 1 Ersatz).  
* Als Sportwart kannst du die RSVPs beliebig anpassen.  

---

### ⚙️ D. Vereinsadministrator (Rolle: `club_admin`)
Als Administrator hast du vollen Zugriff auf alle technischen Einstellungen des Vereins.

#### 1. Anmeldung  
* Melde dich mit deiner **E-Mail und deinem Passwort** an.  

#### 2. Mannschafts- & Webcal-Verwaltung  
* Im Reiter **"Admin"** kannst du neue Mannschaften erstellen (z. B. "Erwachsene IV").  
* Hinterlege oder ändere die **Webcal-Kalender-Links von myTischtennis.de** für jede Mannschaft.  
* Du kannst Mannschaften aktiv oder inaktiv schalten.  

#### 3. Globale Rollenverteilung & Sicherheit  
* Du kannst die Berechtigungen aller Benutzer im Verein anpassen.  
* In der Fußzeile der Anwendung kannst du das globale Passwort-Gate zurücksetzen.  

#### 4. Manuelle Synchronisation & Berichte  
* Anstoß des Spieltermin-Imports für alle Teams direkt im Browser mit gestaffelten Verzögerungen (1500ms Pausen zwischen Teams).  
* Einsicht in detaillierte Synchronisationsberichte.  
