# 🏗️ Technische Architektur (TTV Spielplaner)

Dieses Dokument beschreibt den technischen Aufbau, das Datenmodell, die Sicherheitsarchitektur und die Algorithmen des TTV Spielplaners.

---

## 🛠️ 1. Technologiestack

Die Anwendung ist als moderne, serverlose Single-Page-Application (SPA) konzipiert:

```text
┌────────────────────────────────────────────────────────┐
│                        Frontend                        │
│      React 18 + TypeScript + Vite + Tailwind CSS      │
│            Testing: Vitest + Testing Library           │
└───────────────────────────┬────────────────────────────┘
                            │ (HTTPS / WebSockets)
                            ▼
┌────────────────────────────────────────────────────────┐
│                        Backend                         │
│                    Supabase (SaaS)                     │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐ │
│ │  PostgreSQL DB   │ │  Edge Functions  │ │ Auth/RLS │ │
│ └──────────────────┘ └──────────────────┘ └──────────┘ │
└────────────────────────────────────────────────────────┘
```

* **Frontend:**  
  * **React & Vite:** Schnelles Bootstrapping, Hot Module Replacement (HMR) und performantes Asset-Bundling.  
  * **TypeScript:** Typensicherheit über die gesamte Codebasis (mit `"noUnusedLocals": false` und `"noUnusedParameters": false` in `tsconfig.json`).  
  * **Tailwind CSS:** Utility-First CSS-Framework für hochgradig responsive und mobil-optimierte Oberflächen.  
  * **Lucide React:** Modernes und einheitliches Icon-Set.  
  * **Vitest & React Testing Library:** Umfassende Unit- und Integrationstests inklusive Abdeckungsmessung (`@vitest/coverage-v8`).  
* **Backend:**  
  * **Supabase:** Liefert die PostgreSQL-Datenbank, Echtzeitsynchronisation (Realtime), Authentifizierung und serverlose TypeScript/Deno-Laufzeitumgebungen (Edge Functions).  

---

## 🗄️ 2. Datenmodell & Schema

Das relationale Datenbankschema ist in `supabase/migrations/20260808000000_init.sql` definiert. Eine vollständige, spaltenweise Referenz aller 9 Tabellen befindet sich in **[`docs/datenbank.md`](./datenbank.md)**. Die wichtigsten Tabellen im Überblick:

### `profiles` (Benutzerprofile)
Speichert die Stammdaten aller Vereinsmitglieder.  
* **Besonderheit:** Die Spalte `id` ist ein generierter UUIDv4-Hauptschlüssel (`DEFAULT gen_random_uuid()`), der **nicht** per Foreign-Key-Constraint an `auth.users` gebunden ist (`ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;`). Dies ermöglicht es dem Sportwart, Spieler vorab passwortlos anzulegen.  
* **Wichtige Spalten:**  
  * `id`: `UUID` (Primary Key)  
  * `name`: `TEXT`  
  * `role`: `user_role` (`'player'`, `'team_manager'`, `'sportwart'`, `'club_admin'`)  
  * `team_number`: `INT` (Vereinsmannschaft, z. B. `1` für Erwachsene I)  
  * `position_number`: `INT` (Listenposition im Verein, z. B. `3` für Position 3)  
  * `ttr_points`: `INT` (Q-TTR-Punkte)  

### `matches` (Spieltermine)
Speichert alle importierten und manuell erstellten Spiele.  
* **Wichtige Spalten:**  
  * `id`: `UUID` (Primary Key)  
  * `uid`: `TEXT` (Stabile, eindeutige Kennung aus dem ICS-Event von myTischtennis)  
  * `team_id`: `UUID` (Fremdschlüssel auf `teams`)  
  * `opponent`: `TEXT` (Gegner)  
  * `date`: `TIMESTAMPTZ` (Spielzeitpunkt, zeitzonensicher `Europe/Berlin`)  
  * `is_home`: `BOOLEAN` (Heimspiel-Flag, ermittelt über die Vereins-Substring-Prüfung `'heiligenhaus'` / `'heiligenhauser'`)  
  * `match_version`: `INT` (Zähler für Terminverschiebungen, startet bei `1`)  
  * `lineup`: `JSONB` (Historisches Lineup-Array; die Sortierung erfolgt nun strikt automatisch nach RSVP-Status und Meldereihenfolge)  

### `availabilities` (Rückmeldungen)
Speichert die Bereitschaft der Spieler für ein bestimmtes Spiel.  
* **Wichtige Spalten:**  
  * `id`: `UUID` (Primary Key)  
  * `match_id`: `UUID` (Fremdschlüssel auf `matches`)  
  * `profile_id`: `UUID` (Fremdschlüssel auf `profiles`)  
  * `status`: `TEXT` (`'yes'` / `'no'` / `'maybe'`)  
  * `comment`: `TEXT` (Optionale Bemerkung)  
  * `answered_version`: `INT` (Die Version des Spiels zum Zeitpunkt der Stimmabgabe)  
* **Keine-Antwort-Logik:** Der Status "Keine Antwort" wird in der Datenbank durch das Fehlen eines Eintrags in `availabilities` (oder eine veraltete `answered_version`) dargestellt. Beim Zurücksetzen einer Antwort löscht das System die entsprechende Zeile.  

### `absences` (Abwesenheiten)
Speichert geplante Abwesenheiten von Spielern für den Abwesenheitskalender.  
* **Wichtige Spalten:**  
  * `id`: `UUID` (Primary Key)  
  * `profile_id`: `UUID` (Fremdschlüssel auf `profiles`)  
  * `start_date`: `DATE`  
  * `end_date`: `DATE`  
  * `reason`: `TEXT` (Grund der Abwesenheit)  

---

## 🔄 3. Kalender-Synchronisations-Engine

Der Abgleich mit myTischtennis.de ist hochgradig ausfallsicher implementiert:

### Server-Sync (Edge Function `sync-calendars`)  
* Deno-Laufzeitumgebung unter `supabase/functions/sync-calendars/index.ts`.  
* Umgeht Browser-CORS-Blockaden und lädt die `.ics`-Dateien direkt über HTTPS.  
* Verwendet die Header `Authorization: Bearer <ANON_KEY>`, `apikey: <ANON_KEY>` und `x-sync-secret: <SYNC_SECRET>`, um kong-seitige Gateways sicher zu passieren.  

### Clientseitiger Fallback (`src/lib/syncEngine.ts`)  
* Schlägt der Aufruf der Edge Function fehl oder löst ein Benutzer mit entsprechender Rolle einen On-Demand-Sync aus, springt das Frontend ein.  
* Verwendet CORS-Proxies (`api.allorigins.win/raw` mit Fallback auf `/get` mit Base64-Decoding und `api.codetabs.com`).  
* Führt Retries (bis zu 3 Versuche) mit gestaffelten Pausen (1500ms zwischen Mannschaften) aus, um API-Sperren zu verhindern.  
* Reagiert auch auf Änderungen am `is_home`-Status (`otherDetailsChanged`) und aktualisiert bestehende Datensätze.  

### Termin-Versionierung (Erkennung von Spielverlegungen)  
1. Ein Kalender-Event wird über seine stabile `uid` identifiziert.  
2. Weichen Datum, Uhrzeit oder der `is_home`-Status ab, wird `match_version` um `1` erhöht und ein Eintrag in `match_changes` erstellt.  
3. Stimmt `answered_version` nicht mit der aktuellen `match_version` überein, markiert das Frontend die Antwort als veraltet (⚠️).  

---

## 🏓 4. Aufstellungs- Engine & Ersatzspieler-Logik

Die Aufstellungs-Engine in `TeamTabView.tsx` kombiniert Stamm- und Ersatzspieler zu einem 5er-Kader (4 Stammspieler + 1 Ersatzspieler):

1. **Kandidaten-Pool:** Lädt alle Stammspieler der Mannschaft sowie alle externen Spieler des Vereins, die für das Spiel eine Rückmeldung abgegeben haben.  
2. **RSVP-Priorisierung:** Die Spieler werden nach ihrem Verfügbarkeits-Status gruppiert:  
   $$\text{Status-Priorität:} \quad \text{'yes'} > \text{null/undefined (Keine Antwort)} > \text{'maybe'} > \text{'no'}$$  
3. **Vereinsrangliste (Tie-Breaker):** Innerhalb derselben Statusgruppe entscheidet die feste Vereinsrangliste:  
   $$\text{Priorität} = \text{team\_number} \uparrow \longrightarrow \text{position\_number} \uparrow \longrightarrow \text{name (alphabetisch)}$$  
4. **Kader-Zusammenstellung (4 Stamm + 1 Ersatz):**  
   * Die obersten 4 verfügbaren Spieler bilden die primäre Stammaufstellung.  
   * Der 5. Spieler rückt als **Ersatzspieler** nach und wird optisch hervorgehoben (amberfarbener Hintergrund mit `"Ersatz"`-Badge).  

---

## 🔒 5. Automatische Profil-Verknüpfung bei Registrierung

1. **Unabhängiges Profil-Konzept:**  
   Profiles werden vorab vom Sportwart/Admin angelegt und besitzen temporäre UUIDs.  
2. **Der `public.handle_new_user()` Trigger:**  
   Bei Registrierung eines neuen Benutzers in `auth.users` gleicht die Trigger-Funktion den bereinigten Namen ab:
   `LOWER(TRIM(profiles.name)) = LOWER(TRIM(default_name))`  
3. **Datenbank-Kaskadierung (`ON UPDATE CASCADE`):**  
   Wird eine Übereinstimmung gefunden, wird die `profiles.id` auf `new.id` aktualisiert. Die Foreign Keys von `team_players`, `availabilities` und `absences` aktualisieren sich automatisch durch `ON UPDATE CASCADE`.  
4. **Lineup-JSONB Remapping:**  
   Die Trigger-Funktion durchsucht die JSONB-Arrays in `matches.lineup` und ersetzt Vorkommen der alten Profil-ID durch die neue Benutzer-ID.

---

## 🔒 6. Sicherheitskonzept & RLS-Richtlinien

Die Datenbank verwendet PostgreSQL Row Level Security (RLS):

* **Erzwingung der eigenen Identität:** Ein Spieler kann nur Zeilen in `availabilities` oder `absences` einfügen oder ändern, bei denen die `profile_id` mit seiner eigenen Benutzer-ID übereinstimmt.  
* **Ersatzspieler-Schutz:** Nur der Mannschaftsführer der Stamm-Mannschaft eines Spielers (oder Sportwarte/Admins) kann den RSVP-Status dieses Spielers verändern.  
* **Rollenbasierter Schreibzugriff:**  
  * `sportwart` & `club_admin`: Vollzugriff auf `profiles` und Lineups aller Teams.  
  * `club_admin`: Verwaltung von Webcal-Links in `teams` und globale Rollen.  
