# Anforderungen (Requirements) - TTV Spielplaner

Dieses Dokument beschreibt die funktionalen und nicht-funktionalen Anforderungen für den **Tischtennis-Spielbereitschafts-Planer (TTV Spielplaner)**. Eine tiefergehende technische Ausarbeitung und Rollenbeschreibungen findest du in der [technischen Dokumentation](./docs/architektur.md) sowie dem [Benutzerhandbuch](./docs/nutzung.md).

---

## 1. Funktionale Anforderungen (Functional Requirements)

### 1.1. Mannschaftsverwaltung (Teams)  
* **FA-1.1.1:** Das System muss standardmäßig mindestens drei Tischtennis-Mannschaften unterstützen.  
* **FA-1.1.2:** Administratoren müssen in der Lage sein, neue Mannschaften hinzuzufügen, bestehende Mannschaften zu deaktivieren und deren zugehörige Webcal-Kalender-Links zu pflegen.  
* **FA-1.1.3:** Mannschaften müssen eine eindeutige ID, einen Namen (z. B. "Erwachsene I", "Erwachsene II") und ein Flag zur Aktivierung/Deaktivierung besitzen.  

### 1.2. Kalender-Synchronisation & Terminverwaltung (Calendar Sync & Match Management)  
* **FA-1.2.1:** Das System muss Spieltermine automatisch aus den bereitgestellten Webcal-Kalendern von myTischtennis.de auslesen.  
* **FA-1.2.2:** Die Synchronisation muss sowohl automatisiert (einmal täglich per Cronjob via GitHub Actions / Supabase Edge Functions) als auch manuell (durch einen Administrator im Admin-Dashboard) ausgelöst werden können.  
* **FA-1.2.3:** Falls die Edge-Function bei einer manuellen Synchronisation nicht erreichbar ist, muss ein clientseitiger Fallback im Browser einspringen (CORS-Proxy-gestützt), um die ICS-Dateien herunterzuladen, zu parsen und die Termine in die Datenbank zu schreiben.  
* **FA-1.2.4:** Der ICS-Parser muss zeitzonensicher arbeiten und alle Termine korrekt in die Zeitzone `Europe/Berlin` übersetzen.  
* **FA-1.2.5:** Das System muss Spielverlegungen anhand der stabilen `UID` des ICS-Events erkennen. Bei einer Terminverschiebung müssen historische Rückmeldungen archiviert werden, und die Spieler müssen im Frontend per Warnsymbol (⚠️) um eine erneute Bestätigung gebeten werden.  
* **FA-1.2.6:** Alle Synchronisations-Vorgänge – sowohl administrative als auch durch Mannschaftsführer initiierte Einzel-Team-Syncs – müssen lückenlos in `sync_runs` mit Status (Erfolg/Fehler/Warnung), Zeitstempel und Zusammenfassung protokolliert werden.  
* **FA-1.2.7 (Sicherheitssperre bei Kalender-Sync):** Wenn ein geladener ICS-Kalender 0 Termine liefert, obwohl für die jeweilige Mannschaft bereits aktive Spiele in der Datenbank existieren, greift eine automatische Sicherheitssperre. Es werden keine Spiele inaktiviert oder gelöscht, und der Sync-Lauf wird mit einer entsprechenden Warnung protokolliert.  
* **FA-1.2.8 (Anzeige abgesagter/inaktiver Spiele):** Werden Spiele im externen Kalender als inaktiv markiert (`active = false`), hebt das System diese im Frontend (`TeamTabView`) in einem hervorgehobenen Bereich als **„🚫 Abgesagte / Inaktive Spiele“** transparent hervor.  

### 1.3. Benutzerverwaltung & Berechtigungskonzept (User Management & Roles)  
* **FA-1.3.1:** Das Anmeldefenster unterstützt sowohl die passwortlose Direkt-Auswahl über ein Dropdown als auch eine klassische, passwortgeschützte Anmeldung (Email & Passwort) sowie eine Registrierungsfunktion.  
* **FA-1.3.1a:** Wenn sich ein Benutzer passwortlos über die Direkt-Auswahl einloggt, erhält er im Frontend ausschließlich standardmäßige Spieler-Rechte ('player'). Höhere Rollen (Admin, Sportwart, Mannschaftsführer) müssen sich zwingend mit ihrem Passwort anmelden, um ihre erweiterten Rechte zu aktivieren.  
* **FA-1.3.1b (Automatische Profil-Verknüpfung):** Registriert sich ein neuer Benutzer mit seinem vollen Namen (case-insensitive und bereinigt um Whitespaces), prüft das System, ob bereits ein unassoziiertes Spieler-Profil mit demselben Namen existiert (z. B. importiert durch den Sportwart). Falls ja, verknüpft das System dieses bestehende Profil automatisch mit dem neuen Auth-User. Sämtliche verknüpfte Daten wie RSVPs, Mannschaftszuordnungen, Abwesenheiten und Lineups bleiben dabei vollständig und unterbrechungsfrei erhalten (gewährleistet durch datenbankseitiges Cascade-Handling und Trigger-Logik).  
* **FA-1.3.2:** Die Profile-Tabelle muss unabhängig von `auth.users` arbeiten, sodass der Sportwart/Administrator neue Profile direkt anlegen kann, ohne dass diese vorab einen Auth-Account registrieren müssen.  
* **FA-1.3.3:** Es müssen vier unterschiedliche Rollen existieren:  
  * **Spieler (player):** Kann Mannschaften, Termine und Rückmeldungen einsehen und seine eigene Verfügbarkeit für Spiele eintragen/ändern, sowie eigene Abwesenheiten pflegen.  
  * **Mannschaftsführer (team_manager):** Besitzt alle Rechte eines Spielers und kann zusätzlich Spieler der eigenen Mannschaft zuordnen/entfernen sowie die Verfügbarkeiten von Ersatzspielern (Substitutes) verwalten. Sieht beim Login eine Übersicht aller Zu-/Absagen-Änderungen seiner Mannschaft seit dem letzten Login.  
  * **Sportwart (sportwart):** Besitzt alle Rechte eines Mannschaftsführers. Kann zusätzlich Spieler und deren TTR-Punkte anlegen und verwalten, Aufstellungen und Listenplätze editieren, die Anzahl gemeldeter Mannschaften konfigurieren und besitzt Zugriff auf die gesammelte Abwesenheits-Planung.  
  * **Vereinsadministrator (club_admin):** Besitzt alle Rechte der anderen Rollen, kann neue Mannschaften verwalten, Rollen aller Benutzer ändern, Synchronisationen anstoßen und Protokolle einsehen.  
* **FA-1.3.3a (Benachrichtigungs-Banner für Mannschaftsführer):** Loggt sich ein Benutzer als Mannschaftsführer ein, zeigt das System oben über der Spieleliste seiner Mannschaft ein Benachrichtigungs-Banner an. Dieses listet alle Rückmeldungs-Änderungen (Zu-/Absagen/Vielleicht/Ja als Ersatz) auf, die seit dem letzten Login des Mannschaftsführers an den Spielen seiner Mannschaft vorgenommen wurden.  
* **FA-1.3.4:** Das System muss sicherstellen, dass Spieler nur ihre eigenen Verfügbarkeiten und Abwesenheiten bearbeiten können (erzwungen durch PostgreSQL RLS-Richtlinien im Backend).  

### 1.4. Verfügbarkeiten & Rückmeldungen (Availabilities & Responses)  
* **FA-1.4.1:** Spieler müssen ihre Verfügbarkeit für anstehende Spiele mit vordefinierten Zuständen angeben können (z. B. "Verfügbar", "Nicht verfügbar", "Unsicher").  
* **FA-1.4.1a ("Ja als Ersatz" / 5. Option im Dropdown):** Für erweiterte Rollen (Mannschaftsführer, Sportwart, Admin) steht im Dropdown-Menü der Verfügbarkeiten neben "Ja", "Nein", "Vielleicht" und "Keine Antwort" eine 5. Option "Ja als Ersatz" (`yes_sub`) zur Verfügung. Werden Spieler auf "Ja als Ersatz" gesetzt, verbleiben sie als positive Zusagen im System, werden jedoch in der Aufstellungsreihenfolge hinter alle regulären "Ja"-Zusagen eingeordnet (auf Position 5, 6 etc.), um taktische Kaderanpassungen zu ermöglichen.  
* **FA-1.4.2:** Spieler müssen die Möglichkeit haben, optionale Bemerkungen (z. B. Grund für Ausfall oder spätere Anreise) einzugeben.  
* **FA-1.4.3:** Spieler müssen sich mannschaftsübergreifend für Spiele eintragen können, um als Ersatzspieler zur Verfügung zu stehen.  
* **FA-1.4.4:** Ein Abwesenheits-System muss Spielern ermöglichen, single- oder multi-day Abwesenheiten mit Startdatum, Enddatum und optionaler Begründung (z.B. Urlaub, Krankheit) im Tab "Mein Kalender" einzutragen und zu löschen.  
* **FA-1.4.5:** Mannschaftsführer, Sportwart und Admins haben Zugriff auf einen dedizierten Tab "Abwesenheits-Kalender", der eine aggregierte 4-Monats-Visualisierung aller Spieler-Abwesenheiten als Kalendermatrix bietet (zwei Monate nebeneinander, in einem Grid-Layout). Beim Anklicken eines Tages wird eine detaillierte Tagesansicht aller an diesem Tag abwesenden Spieler mit Gründen eingeblendet, um die Einsatzplanung mannschaftsübergreifend zu erleichtern.  
* **FA-1.4.6 (Ersatzspieler-Nachrückerlogik):** Das System ermittelt die standardmäßige Aufstellung eines Spiels anhand der Top 4 Stammspieler (gemeldet auf den Positionen 1 bis 4). Ist einer dieser Spieler nicht verfügbar (Rückmeldung 'no' oder 'maybe') oder fehlt ein Eintrag, rückt dynamisch der am besten platzierte Ersatzspieler nach, der mit 'yes' zugesagt hat. Die Priorisierung erfolgt hierbei nach globaler Einstufung (sortiert nach `team_number` aufsteigend, danach `position_number` aufsteigend).  

### 1.5. Gesamtübersicht & Konflikterkennung (Dashboard & Conflict Detection)  
* **FA-1.5.1:** Das System muss eine chronologische Gesamtübersicht aller Spiele für die Vereinsführung bereitstellen.  
* **FA-1.5.2:** Die Gesamtübersicht muss eine automatische Terminkonflikt-Erkennung enthalten. Steht ein Spieler am selben Kalendertag/zur selben Uhrzeit bei zwei verschiedenen Mannschaften als verfügbar eingetragen, muss eine optische Warnung ausgegeben werden.  
* **FA-1.5.3:** Das System muss eine Matrix-Ansicht bereitstellen, in der Mannschaftsführer die Rückmeldungen aller Spieler auf einen Blick sehen und verwalten können.  
* **FA-1.5.4 (Zuwenig-Zusagen-Warnung):** Wenn ein Spiel weniger als 4 positive Zusagen ('yes') aufweist, muss das System den Spieltitel in der Übersicht rot einfärben und ein Warndreieck-Symbol (`AlertTriangle`) einblenden.  

### 1.6. Globaler Passwortschutz (Password Gate)  
* **FA-1.6.1:** Die gesamte Web-Anwendung muss durch ein globales Vereinspasswort geschützt sein. Ohne dieses Passwort dürfen keine Spielerdaten, Namen oder Termine geladen oder angezeigt werden.  
* **FA-1.6.2:** Das System muss einen URL-Bypass unterstützen. Vereinsmitglieder müssen über personalisierte oder präparierte Links wie `https://[domain]/?pw=[passwort]` oder `https://[domain]/?password=[passwort]` direkt eingeloggt werden, ohne das Passwort manuell eingeben zu müssen.  

---

## 2. Nicht-funktionale Anforderungen (Non-Functional Requirements)

### 2.1. Benutzbarkeit & Design (Usability & Design)  
* **NFA-2.1.1 (Smartphone-Optimierung):** Die Benutzeroberfläche muss "Mobile-First" gestaltet und vollständig für mobile Endgeräte (Smartphones) optimiert sein. Buttons und Steuerelemente müssen großflächig und berührungsfreundlich gestaltet sein.  
* **NFA-2.1.2 (Responsive Design):** Die Oberfläche muss sich flüssig an verschiedene Bildschirmgrößen anpassen (vom Smartphone über Tablets bis hin zu Desktop-Monitoren).  

### 2.2. Sicherheit & Datenschutz (Security & Privacy)  
* **NFA-2.2.1 (Row Level Security):** Der Datenzugriff auf Supabase-Ebene muss über strikte PostgreSQL RLS (Row Level Security) Richtlinien abgesichert sein. Kein Client darf in der Lage sein, unbefugt Daten zu lesen oder zu manipulieren.  
* **NFA-2.2.2 (Datenminimierung):** Es dürfen keine unnötigen personenbezogenen Daten erhoben werden. Name und E-Mail-Adresse sind für die Funktionalität ausreichend.  
* **NFA-2.2.3 (Passwortschutz):** Passwörter müssen sicher gehasht in der Datenbank abgelegt werden (z. B. unter Verwendung von pgcrypto / bcrypt). Sensible Service-Keys (z. B. Supabase `service_role`-Schlüssel) dürfen keinesfalls im Frontend zugänglich sein.  

### 2.3. Zuverlässigkeit & Ausfallsicherheit (Reliability & Resilience)  
* **NFA-2.3.1 (Robustheit bei Netzwerkfehlern):** Bei Netzwerkproblemen oder Fehlern beim externen Kalender-Sync darf die Anwendung nicht abstürzen. Vorhandene Termine müssen aus dem Cache bzw. der Datenbank gelesen und angezeigt werden.  
* **NFA-2.3.2 (Fallback-Mechanismen):** Bei Ausfall der Edge-Function muss die clientseitige Synchronisation reibungslos einspringen können.  

### 2.4. Performance & Skalierbarkeit (Performance & Scalability)  
* **NFA-2.4.1 (Schnelle Ladezeiten):** Die Anwendung muss innerhalb von weniger als 2 Sekunden auf mobilen Geräten über eine standardmäßige 3G/4G-Verbindung einsatzbereit sein.  
* **NFA-2.4.2 (Geringe Serverlast):** Die Synchronisation der Kalender sollte effizient gestaltet sein, um unnötige Schreibzugriffe und API-Aufrufe bei Supabase zu vermeiden.  

### 2.5. Wartbarkeit & Erweiterbarkeit (Maintainability & Extensibility)  
* **NFA-2.5.1 (Erweiterbare Architektur):** Der Programmcode muss modular aufgebaut sein (Trennung von Komponenten, API-Clients, Parsern und Typdefinitionen), um zukünftige Erweiterungen (z. B. Push-Benachrichtigungen oder Chat-Funktion) zu erleichtern.  
* **NFA-2.5.2 (Testbarkeit):** Kritische Logikbausteine wie der `icsParser` und die `syncEngine` müssen durch automatisierte Unit- und Integrationstests (z. B. Vitest) abgedeckt sein.  
* **NFA-2.5.3 (CI/CD):** Der Build-, Test- und Deployment-Prozess muss über GitHub Actions automatisiert sein.  
