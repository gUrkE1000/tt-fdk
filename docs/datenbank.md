# 🗄️ Datenbank-Dokumentation & Spalten-Referenz (TTV Spielplaner)

Dieses Dokument bietet eine vollständige, spaltenweise Aufschlüsselung aller Tabellen in der PostgreSQL / Supabase-Datenbank des TTV Spielplaners sowie eine detaillierte Erklärung des Verhaltens bei Spieländerungen und Spielverlegungen.

---

## 📑 Inhaltsverzeichnis

1. [Übersicht aller Tabellen](#-1-übersicht-aller-tabellen)  
2. [Spaltenweise Erläuterung aller Tabellen](#-2-spaltenweise-erläuterung-aller-tabellen)  
   - [1. `club_settings`](#1-club_settings-globale-vereinseinstellungen)  
   - [2. `profiles`](#2-profiles-benutzer--spielerprofile)  
   - [3. `teams`](#3-teams-mannschaften)  
   - [4. `team_players`](#4-team_players-mannschaftszuordnungen)  
   - [5. `matches`](#5-matches-spieltermine)  
   - [6. `availabilities`](#6-availabilities-rückmeldungen--verfügbarkeiten)  
   - [7. `sync_runs`](#7-sync_runs-synchronisations-protokoll)  
   - [8. `match_changes`](#8-match_changes-spieländerungs-historie)  
   - [9. `absences`](#9-absences-abwesenheiten)  
3. [Was passiert bei einer Spieländerung? (Erklärung & Lifecycle)](#-3-was-passiert-bei-einer-spieländerung-erklärung--lifecycle)  
   - [Erhält das Spiel eine neue ID?](#erhält-das-spiel-eine-neue-id)  
   - [Warum schienen Zu-/Absagen nach einer Aktualisierung zu verschwinden?](#warum-schienen-zu-absagen-nach-einer-aktualisierung-zu-verschwinden)  
   - [Wie bleiben Zu-/Absagen erhalten und wie funktioniert die Warnung?](#wie-bleiben-zu-absagen-erhalten-und-wie-funktioniert-die-warnung)  
   - [Protokollierung in `match_changes`](#protokollierung-in-match_changes)  

---

## 📊 1. Übersicht aller Tabellen

Die Datenbank besteht aus **9 relationalen Tabellen** in PostgreSQL:

| Tabellenname | Beschreibung | Primary Key | Hauptsächlicher Verwendungszweck |
| :--- | :--- | :--- | :--- |
| `club_settings` | Vereinseinstellungen & Passwort-Hash | `key` (`TEXT`) | Speicherung des globalen Zugangspassworts |
| `profiles` | Spieler- & Benutzerprofile | `id` (`UUID`) | Stamm- und Ranglistendaten aller Vereinsmitglieder |
| `teams` | Vereinsmannschaften | `id` (`UUID`) | Zuordnung von Mannschaften und deren Webcal-Links |
| `team_players` | Zuordnung Spieler ↔ Mannschaft | `id` (`UUID`) | n:m-Verknüpfung von Spielern zu Teams |
| `matches` | Spieltermine | `id` (`UUID`) | Aus ICS importierte und von Teams bestrittene Spiele |
| `availabilities` | Rückmeldungen (RSVP) | `id` (`UUID`) | Zu-/Absagen/Vielleicht-Stimmen pro Spieler und Spiel |
| `sync_runs` | Sync-Protokolle | `id` (`UUID`) | Verlaufs-Log aller Kalender-Synchronisationen |
| `match_changes` | Änderungsverlauf von Spielen | `id` (`UUID`) | Historie von Terminverlegungen & Absagen |
| `absences` | Abwesenheiten | `id` (`UUID`) | Urlaubs- und Fehlzeiten-Kalender der Spieler |

---

## 🔍 2. Spaltenweise Erläuterung aller Tabellen

### 1. `club_settings` (Globale Vereinseinstellungen)

Speichert globale Konfigurationsparameter der Anwendung in Key-Value-Form.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `key` | `TEXT` | `PRIMARY KEY` | Eindeutiger Schlüssel (z. B. `'club_password_hash'`). |
| `value` | `TEXT` | `NOT NULL` | Speichert den zugehörigen Wert (z. B. Blowfish-Passworthash). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Eintrags. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Aktualisierung. |

---

### 2. `profiles` (Benutzer- & Spielerprofile)

Speichert die Profil- und Ranglistendaten aller Spieler im Verein. Die Profile sind entkoppelt von Supabase `auth.users`, um das Anlegen passwortloser Spieler durch den Sportwart zu ermöglichen.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige Kennung des Profils (entspricht der Auth-User-ID nach Registrierung). |
| `name` | `TEXT` | `NOT NULL` | Vollständiger Name des Spielers (z. B. "Max Mustermann"). |
| `role` | `public.user_role` | `NOT NULL DEFAULT 'player'` | Rolle im System (`'player'`, `'team_manager'`, `'sportwart'`, `'club_admin'`). |
| `ttr_points` | `INTEGER` | `NOT NULL DEFAULT 0` | Q-TTR-Punkte des Spielers für Ranglisten und Aufstellungsreihenfolge. |
| `team_number` | `INTEGER` | `NULLABLE` | Nummer der Stamm-Mannschaft (z. B. `1` für Erwachsene I, `2` für Erwachsene II). |
| `position_number` | `INTEGER` | `NULLABLE` | Listenposition innerhalb der Stamm-Mannschaft (z. B. `1` bis `4`). |
| `last_login_at` | `TIMESTAMPTZ` | `NULLABLE` | Zeitstempel der letzten Anmeldung (wird für das Benachrichtigungs-Banner genutzt). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Profils. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Profilaktualisierung. |

---

### 3. `teams` (Mannschaften)

Verwaltet die Mannschaften des Vereins inklusive deren Webcal-Kalender-URLs von myTischtennis.de.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige Kennung der Mannschaft. |
| `name` | `TEXT` | `NOT NULL` | Offizieller Name der Mannschaft (z. B. "Erwachsene I"). |
| `short_name` | `TEXT` | `NOT NULL` | Kurzbezeichnung für kompakte Darstellungen (z. B. "Erwachsene 1"). |
| `webcal_url` | `TEXT` | `NOT NULL` | `webcal://`- oder `https://`-Link zum myTischtennis-ICS-Kalender. |
| `active` | `BOOLEAN` | `NOT NULL DEFAULT true` | Zeigt an, ob die Mannschaft aktiv am Spielbetrieb teilnimmt. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt der Mannschaft. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Änderung an den Mannschaftsdaten. |

---

### 4. `team_players` (Mannschaftszuordnungen)

Koppelt Spieler an Mannschaften. Ein Spieler kann in einer Stamm-Mannschaft eingetragen sein und gleichzeitig als Ersatzspieler in weiteren Mannschaften hinterlegt werden.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige Kennung der Zuordnung. |
| `team_id` | `UUID` | `NOT NULL`, `REFERENCES public.teams(id) ON DELETE CASCADE` | Fremdschlüssel zur zugewiesenen Mannschaft. |
| `player_id` | `UUID` | `NOT NULL`, `REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE` | Fremdschlüssel zum zugewiesenen Spielerprofil. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt der Zuordnung. |

*Constraint:* `UNIQUE(team_id, player_id)` verhindert doppelte Eintragszuordnungen derselben Kombination.

---

### 5. `matches` (Spieltermine)

Speichert alle aus den Kalendern importierten oder manuell gepflegten Spieltermine.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige interne Datenbank-ID des Spiels. **Bleibt bei Terminänderungen unverändert.** |
| `team_id` | `UUID` | `NOT NULL`, `REFERENCES public.teams(id) ON DELETE CASCADE` | Fremdschlüssel zur Mannschaft, die das Spiel bestreitet. |
| `external_uid` | `TEXT` | `NOT NULL` | Stabile UID aus dem myTischtennis-ICS-Event (z. B. `match-12345@mytischtennis.de`). |
| `summary` | `TEXT` | `NOT NULL` | Titel/Zusammenfassung des Events (z. B. "Heiligenhauser SV vs. Post SV"). |
| `description` | `TEXT` | `NULLABLE` | Beschreibungstext aus dem Kalendereintrag (enthält oft Spieltag-Infos). |
| `location` | `TEXT` | `NULLABLE` | Austragungsort / Halle (z. B. "Turnhalle Schulstraße 10"). |
| `dtstart` | `TIMESTAMPTZ` | `NOT NULL` | Startzeitpunkt des Spiels (in UTC mit Zeitzonen-Offset für `Europe/Berlin`). |
| `dtend` | `TIMESTAMPTZ` | `NOT NULL` | Endzeitpunkt des Spiels. |
| `is_home` | `BOOLEAN` | `NOT NULL DEFAULT true` | `true` = Heimspiel, `false` = Auswärtsspiel (automatisch ermittelt). |
| `matchday` | `INTEGER` | `NULLABLE` | Nummer des Spieltags (z. B. `3` für den 3. Spieltag). |
| `active` | `BOOLEAN` | `NOT NULL DEFAULT true` | `true` = Aktives Spiel im Spielplan; `false` = Aus dem Kalender entfernt/abgesagt. |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | **Termin-Versionszähler.** Erhöht sich bei Datums-/Uhrzeitänderungen um `1`. |
| `lineup` | `JSONB` | `NULLABLE` | Historisches Lineup-Array; die Sortierung erfolgt strikt automatisch nach RSVP-Status und Meldereihenfolge. |
| `last_synced_at`| `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten erfolgreichen Kalendersynchronisation. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Spiels. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Aktualisierung. |

*Constraint:* `UNIQUE(team_id, external_uid)` stellt sicher, dass jedes ICS-Event pro Mannschaft genau einmal in der Datenbank existiert.

---

### 6. `availabilities` (Rückmeldungen / Verfügbarkeiten)

Speichert die Zu- und Absagen der Spieler für die einzelnen Spieltermine.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige Kennung der Rückmeldung. |
| `match_id` | `UUID` | `NOT NULL`, `REFERENCES public.matches(id) ON DELETE CASCADE` | Fremdschlüssel zum Spieltermin in `matches`. |
| `player_id` | `UUID` | `NOT NULL`, `REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE` | Fremdschlüssel zum Spielerprofil in `profiles`. |
| `response` | `public.availability_response` | `NOT NULL` | Ausgewählter Status (`'yes'`, `'yes_sub'`, `'no'`, `'maybe'`). |
| `comment` | `TEXT` | `NULLABLE` | Optionale Bemerkung des Spielers (z. B. "Verspäte mich um 15 Min."). |
| `version_responded` | `INTEGER` | `NOT NULL` | **Die `version` des Spiels zum Zeitpunkt der Abstimmung.** |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der ersten Stimmabgabe. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Änderung der Stimmabgabe. |

*Constraint:* `UNIQUE(match_id, player_id)` stellt sicher, dass jeder Spieler pro Spiel maximal eine Rückmeldung gespeichert hat.

---

### 7. `sync_runs` (Synchronisations-Protokoll)

Protokolliert jeden Durchlauf der Kalendersynchronisation (sowohl automatische Edge-Function-Cronjobs als auch manuelle Client-Syncs).

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige ID des Sync-Laufs. |
| `started_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Startzeitpunkt der Synchronisation. |
| `completed_at` | `TIMESTAMPTZ` | `NULLABLE` | Endzeitpunkt der Synchronisation. |
| `status` | `TEXT` | `NOT NULL` | Status des Durchlaufs (`'pending'`, `'success'`, `'warning'`, `'failed'`). |
| `summary_text` | `TEXT` | `NULLABLE` | Zusammenfassung der Ergebnisse (Anzahl hinzugefügter, verlegter, inaktivierter Spiele). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Eintrags. |

---

### 8. `match_changes` (Spieländerungs-Historie)

Speichert ein Log historischer Terminverlegungen und Absagen für Auswertungs- und Benachrichtigungszwecke.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige ID des Protokolleintrags. |
| `match_id` | `UUID` | `NOT NULL`, `REFERENCES public.matches(id) ON DELETE CASCADE` | Fremdschlüssel zum betroffenen Spiel. |
| `old_dtstart` | `TIMESTAMPTZ` | `NULLABLE` | Ursprünglicher Startzeitpunkt vor der Verlegung. |
| `new_dtstart` | `TIMESTAMPTZ` | `NULLABLE` | Neuer Startzeitpunkt nach der Verlegung. |
| `change_type` | `TEXT` | `NOT NULL` | Art der Änderung (`'date_time_changed'`, `'cancelled'`, `'details_updated'`). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Eintrags. |

---

### 9. `absences` (Abwesenheiten)

Speichert geplante Urlaubstage, Krankheits- oder sonstige Ausfallzeiten von Spielern.

| Spalte | Datentyp | Constraints / Default | Beschreibung |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Eindeutige ID der Abwesenheit. |
| `player_id` | `UUID` | `NOT NULL`, `REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE` | Fremdschlüssel zum Spielerprofil. |
| `start_date` | `DATE` | `NOT NULL` | Erster Tag der Abwesenheit (inklusive). |
| `end_date` | `DATE` | `NOT NULL` | Letzter Tag der Abwesenheit (inklusive). |
| `reason` | `TEXT` | `NULLABLE` | Grund der Abwesenheit (z. B. "Urlaub", "Beruflich", "Verletzt"). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Erstellungszeitpunkt des Eintrags. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Zeitpunkt der letzten Aktualisierung. |

---

## 🔄 3. Was passiert bei einer Spieländerung? (Erklärung & Lifecycle)

In der Praxis verschieben sich Tischtennis-Spiele häufiger (z. B. Verlegung von Freitag auf Samstag oder Änderung der Anstoßzeit von 19:00 auf 19:30 Uhr).

### Erhält das Spiel eine neue ID?

**Nein!** Das Spiel behält exakt dieselbe primäre Schlüssel-ID (`matches.id`) und dieselbe `external_uid` in der Datenbank.

* **Grund:** Die `external_uid` stammt direkt aus dem `.ics`-Kalendereintrag von myTischtennis.de (z. B. `match-12345@mytischtennis.de`). Sie bleibt über die gesamte Saison hinweg konstant, egal wie oft ein Spiel verlegt oder umbenannt wird.  
* Beim Sync führt die Engine ein SQL `UPDATE` auf den bestehenden Datensatz aus, anstatt den Eintrag zu löschen und neu anzulegen.  

---

### Warum schienen Zu-/Absagen nach einer Aktualisierung zu verschwinden?

Das Phänomen, dass Zu- oder Absagen nach einer Verlegung scheinbar "weg" oder "nicht mehr sichtbar" waren, liegt an der **Versions-Filterung der Benutzeroberfläche**:

1. Jedes Spiel in `matches` besitzt ein Feld `version` (Standard bei Erstellung: `1`).  
2. Jede Rückmeldung in `availabilities` speichert in `version_responded` den Versionsstand des Spiels, für den der Spieler abgestimmt hat.  
3. Verschiebt sich die Uhrzeit oder der Tag eines Spiels:  
   - Die Sync-Engine erkennt die Terminänderung (`oldStart !== newStart || oldEnd !== newEnd`).  
   - Die Sync-Engine erhöht `matches.version` um `1` (z. B. von `1` auf `2`).  
   - Die bisherigen Einträge in `availabilities` bleiben in der Datenbank **vollständig erhalten**, tragen jedoch weiterhin `version_responded = 1`.  
4. **Verhalten in der Benutzeroberfläche:**  
   - In Summenzählern (z. B. `✅ 4`) und der Live-Aufstellungsberechnung berücksichtigt die Anwendung nur Antworten mit `version_responded === match.version`.  
   - Dadurch sah es für den Benutzer im ersten Moment so aus, als wären die Stimmen gelöscht worden. In Wahrheit wurden sie lediglich als **veraltet** eingestuft, damit eine Zusage für einen alten Termin nicht fälschlicherweise für einen völlig neuen Spieltermin gewertet wird.  

---

### Wie bleiben Zu-/Absagen erhalten und wie funktioniert die Warnung?

Damit Spieler und Mannschaftsführer transparent sehen, was sich geändert hat und was die vorherige Antwort war, nutzt die Anwendung folgende Mechanismen:

#### 1. Warnbanner am Spiel (`TeamTabView.tsx`)
Sobald `version_responded < match.version` ist, blendet das System am Spielkarte ein hervorgehobenes Warnbanner ein:

> **⚠️ Termin geändert!**
> Dieses Spiel wurde auf einen neuen Termin verschoben. *(Zuvor: Freitag, 10.10.2025, 19:00 Uhr)*.
> Bitte bestätige deine Verfügbarkeit für den neuen Termin erneut. Deine alte Stimme war: **✅ Ja**

#### 2. Optische Kennzeichnung in der Mannschafts- & Rückmeldeliste  
- In der Rückmeldungsliste für Betreuer/Mannschaftsführer werden veraltete Stimmen ausgegraut und mit einem **⚠️-Symbol** versehen.  
- Auch in der Verfügbarkeits-Matrix (`TeamMatrixView.tsx`) wird bei veralteten Eintragsversionen ein **⚠️** am jeweiligen Feld eingeblendet.  
- Sobald der Spieler erneut auf **Ja**, **Vielleicht** oder **Nein** klickt, wird `version_responded` auf den aktuellen Stand `match.version` angehoben und das Warnsymbol verschwindet.  

---

### Protokollierung in `match_changes`

Zusätzlich zur Erhöhung von `version` schreibt das System bei jeder Verlegung automatisch einen Datensatz in die Tabelle `match_changes`:

```json
{
  "match_id": "a1b2c3d4-...",
  "old_dtstart": "2025-10-10T17:00:00Z",
  "new_dtstart": "2025-10-11T16:00:00Z",
  "change_type": "date_time_changed"
}
```

Dadurch bleibt der ursprüngliche Spieltermin nachvollziehbar im System protokolliert.
