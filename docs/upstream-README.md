> Unveränderte Kopie des README aus [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner)
> (Stand `f8ec2a5`), hier zur Dokumentation des Funktionsumfangs abgelegt. Relative Links darin
> beziehen sich auf das Repository-Wurzelverzeichnis.

# Tischtennis-Spielbereitschafts-Planer (TTV Spielplaner)

Dieses Repository enthält eine vollständige, produktionsreife und smartphone-optimierte Web-Anwendung zur Organisation der Spielbereitschaft für Tischtennis-Vereine.

[![Version](https://img.shields.io/github/v/tag/dgaida/tt_hsv_planner?label=version)](https://github.com/dgaida/tt_hsv_planner/tags)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://dgaida.github.io/tt_hsv_planner/)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/dgaida/tt_hsv_planner/graphs/commit-activity)
![Last commit](https://img.shields.io/github/last-commit/dgaida/tt_hsv_planner)

Die Anwendung liest Spieltermine automatisch aus den jeweiligen **Webcal-Kalendern von myTischtennis.de** ein und bietet eine gemeinsame Plattform zur unkomplizierten Rückmeldung, Aufstellungsplanung und Organisation von Spieltagen und Abwesenheiten.

---

## 📖 Dokumentation (docs/)

Für eine detaillierte Übersicht und Anleitung haben wir eine umfassende Dokumentation im Ordner [`docs/`](./docs/) hinterlegt:

1. 🚀 **[Erst-Einrichtung & Installation](./docs/einrichtung.md)**  
   * Lokale Entwicklung einrichten (`npm run dev`, `npm run test`)  
   * Supabase-Datenbank-Setup (Tabellen, RLS, RPCs, schlüssellose Profile & Idempotenz)  
   * Bereitstellung der Edge Function (`sync-calendars`)  
   * CI/CD via GitHub Actions (Hosting, Code Quality Checks, Test-Automatisierung, Version-Badges & automatisierter Cronjob-Sync)  
2. 🧑‍💻 **[Nutzung & Benutzerhandbuch](./docs/nutzung.md)**  
   * **Spieler:** Persönlicher Abwesenheitskalender, Zu- und Absagen (RSVP), passwortloser Login, Ersatzspieler-Anmeldung  
   * **Mannschaftsführer:** Stammspieler- & Ersatzspieler-Verwaltung, manuelle Aufstellungsanpassung (▲/▼), Team-Matrix & WhatsApp-Nachrichten-Generator  
   * **Sportwart:** Spielerverwaltung, Q-TTR-Punkte, automatischer HTML-Kader-Import mit Kopier-Fallback, 4-Monats-Abwesenheitsmatrix, mannschaftsübergreifende Lineup- & WhatsApp-Aufstellungskontrolle  
   * **Administrator:** Teampflege, Webcal-Links, Rollenzuweisungen, Synchronisationsberichte, Passwort-Gate Zurücksetzen  
3. 🏗️ **[Technische Architektur](./docs/architektur.md)**  
   * Technologiestack (React, Vite, TypeScript, Tailwind CSS, Vitest, Supabase)  
   * Datenmodell & Datenbankschema (Lineup JSONB, Absences, decoupled Profiles)  
   * Automatische Profil-Verknüpfung via `handle_new_user()` (mit `ON UPDATE CASCADE` & Lineup JSONB Remapping)  
   * Kalender-Synchronisations-Engine (Proxy-Bypass, Staggered Delays, Edge-Function-Logik)  
   * Ersatzspieler-Nachrückerlogik (Priorisierung: Ja > Keine Antwort > Vielleicht > Nein & Vereinsrangliste)  
4. 🗄️ **[Datenbank & Spalten-Referenz](./docs/datenbank.md)**  
   * Detaillierte spaltenweise Erklärung aller 9 Datenbanktabellen  
   * Lifecycle von Spielen bei Terminverlegungen & Datums-/Uhrzeitänderungen  
   * Erkennung veralteter Zu-/Absagen & Verlegungs-Warnung (⚠️)  
5. ❓ **[FAQ & Fehlerbehebung](./docs/faq.md)**  
   * Fehlerbehebung beim PostgREST-Cache (`NOTIFY pgrst, 'reload schema'`)  
   * Behandlung von Blanket-Updates (`.neq('id', '00000000-0000-0000-0000-000000000000')`)  
   * Globale Passwort-Sperre & URL-Bypass-Links  
   * Probleme beim E-Mail-Versand, Webcal-Import oder HTML-Kader-Import  

---

## 🚀 Kern-Features im Überblick

* **Mehrere Mannschaften verwalten:** Mannschaften (z. B. "Erwachsene I", "Erwachsene II") können flexibel über das Admin-Panel oder direkt in der Datenbank angelegt, aktiviert/deaktiviert und mit eigenen Webcal-Kalendern verknüpft werden.  
* **Automatischer & Manueller Sync:** Kalender synchronisieren sich vollautomatisch einmal täglich via GitHub Actions Cronjob. Mannschaftsführer, Sportwarte und Admins können die Synchronisation direkt im Frontend auslösen (reguläre Spieler aktualisieren nur den lokalen Stand).  
* **Erkennung von Spielverlegungen (Termin-Versionierung):**  
  * Verschiebt sich ein Spiel auf myTischtennis.de, wird dies über die stabile `UID` des ICS-Events erkannt.  
  * Bereits abgegebene Rückmeldungen werden archiviert und im Frontend als *„erneute Antwort erforderlich“ (⚠️)* markiert.  
* **Abwesenheits-Kalender (Mein Kalender & 4-Monats-Planer):**  
  * Spieler tragen Abwesenheiten (Urlaub, Arbeit, Krankheit) im persönlichen Kalender ein.  
  * Für Mannschaftsführer, Sportwarte und Admins steht ein dedizierter **4-Monats-Abwesenheits-Kalender** (2x2 Grid) bereit.  
* **Änderungs-Benachrichtigungen seit dem letzten Login:**  
  * Mannschaftsführer sehen nach der Anmeldung direkt oben über der Spieleliste ihrer Mannschaft alle Zu-, Ab- und Ersatz-Meldungen von Spielern, die seit ihrem letzten Login eingegangen sind.  
* **Intelligente Aufstellungs- & Ersatzspieler-Logik ("Ja als Ersatz"):**  
  * **Kader-Struktur:** Ein Spielkader besteht aus 4 Stammspielern und 1 Ersatzspieler (hervorgehoben mit amberfarbenem Badge).  
  * **Priorisierung & Taktische Option "Ja als Ersatz":** Für Mannschaftsführer, Sportwart und Admin steht im Dropdown-Menü die Option **"Ja als Ersatz"** zur Verfügung. Damit lassen sich spielbereite Akteure gezielt auf Ersatz-Positionen (Position 5, 6) verschieben, wenn bereits 4 oder mehr Zusagen vorliegen. Die Rangfolge lautet: `Ja` > `Ja als Ersatz` > `Keine Antwort` > `Vielleicht` > `Nein` (sekundär sortiert nach der Vereinsrangfolge).  
* **💬 WhatsApp-Textgenerator & Parallelspiel-Erkennung:**  
  * **Team-Matrix Integration:** Mannschaftsführer und Sportwarte können per Klick direkt unter einem Spiel in der Matrix eine vorgefertigte WhatsApp-Nachricht generieren und kopieren.  
  * **Intelligente Vorlagen:** Bei ≥ 4 Zusagen wird die Stammaufstellung (mit optionalem Backup) erzeugt; bei < 4 Zusagen wird ein dringender Aufruf mit fehlender Spieleranzahl, Namensliste und automatischer 1-Wochen-Frist formatiert.  
  * **Parallelspiel-Erkennung:** Erkennt automatisch zeitgleiche Spiele anderer Teams am selben Ort (Heim/Auswärts) und fügt freundliche Zusatzhinweise an.  
* **HTML-Kader-Import & Abgleich Engine:**  
  * Der Sportwart kann den Vereinskader von myTischtennis.de automatisch über CORS-Proxies abrufen oder per Kopieren/Einfügen als HTML verarbeiten.  
  * Das System vergleicht die Daten und klassifiziert Änderungen transparent in *„Bereits aktuell“*, *„Nur aktualisiert“* (z. B. Q-TTR) oder *„Ersetzt“*.  
* **Automatische Terminkonflikt-Erkennung:** Zusage bei zwei zeitgleichen Spielen (±1 Stunde) erzeugt Warnungen und Hinweise im Frontend.  
* **Zweigeteiltes Login-Verfahren & Automatische Verknüpfung:**  
  * **Passwortloser Login:** Namensauswahl für schnelle Spielerrückmeldungen (Rolle `player`).  
  * **Passwort-Login:** Freischaltung erweiterter Rollen (`team_manager`, `sportwart`, `club_admin`).  
  * **Automatische Profil-Verknüpfung:** Bei der Registrierung wird das Profil per Namensabgleich nahtlos mit `auth.users` verknüpft – inkl. automatischer Kaskadierung auf Zusagen, Abwesenheiten und JSONB-Lineups.  
* **Integrierte Benutzeranleitung:** Direkt im Frontend aufrufbarer "Anleitung"-Tab (`GuideView.tsx`) mit rollenspezifischen Hinweisen.  
* **Smartphone-Optimierung & Passwort-Gate:** Mobile-First-Design für Smartphones, geschützt durch ein globales Passwort (unterstützt URL-Bypass `?pw=...`).  

---

## 🛠️ Schnelleinstieg für Entwickler

1. **Repository klonen und Abhängigkeiten installieren:**  
   ```bash
   git clone https://github.com/DEIN_USER/DEIN_REPO.git
   cd DEIN_REPO
   npm install
   ```
2. **Lokalen Entwicklungsserver starten:**  
   ```bash
   npm run dev
   ```
   Die Anwendung öffnet sich unter `http://localhost:5173`.  
3. **Automatisierte Tests ausführen:**  
   ```bash
   npm test
   ```

Für die komplette Anleitung zur Anbindung von Supabase und dem Deployment auf GitHub Pages siehe **[Erst-Einrichtung & Installation](./docs/einrichtung.md)**.
