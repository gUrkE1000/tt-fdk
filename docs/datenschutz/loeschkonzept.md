# Löschkonzept

Welche Daten wann verschwinden — und wer dafür sorgt.

> Ein Löschkonzept, das eine Löschung beschreibt, die nicht stattfindet, ist schlimmer als
> keines: Es begründet eine Zusage, die der Verein dann bricht. Jede Frist in diesem
> Dokument ist deshalb im Code umgesetzt und durch einen Test abgedeckt. Wo etwas **nicht**
> automatisch gelöscht wird, steht das ausdrücklich dabei.

## Wie es durchgesetzt wird

Die Datenbankfunktion `run_retention()` läuft **täglich um 2 Uhr** (pg_cron-Job
`retention`). Sie gibt zurück, was sie getan hat; der Administrator kann sie zusätzlich
von Hand anstoßen — etwa, wenn nach einer Löschanfrage nicht bis zur Nacht gewartet werden
soll.

```sql
-- Was der letzte Lauf getan hat
SELECT jobname, status, return_message, start_time
  FROM cron.job_run_details d JOIN cron.job j USING (jobid)
 WHERE j.jobname = 'retention'
 ORDER BY start_time DESC LIMIT 5;
```

Die Fristen stehen als Einstellungen in `club_settings` und lassen sich ändern, ohne eine
Migration zu schreiben:

| Einstellung | Voreinstellung | Betrifft |
|---|---|---|
| `retention_deleted_profiles_days` | 30 | gelöschte Konten |
| `retention_notifications_days` | 365 | verschickte Benachrichtigungen |
| `retention_logs_days` | 365 | Betriebsprotokolle |
| `retention_absences_days` | 730 | abgelaufene Abwesenheiten |

## Die Fristen im Einzelnen

### Gelöschte Konten — 30 Tage

Löscht ein Mitglied sein Konto (oder tut es der Administrator), wird die Zeile zunächst nur
als gelöscht **markiert** (`deleted_at`). Sie verschwindet aus jeder Ansicht, aus jeder
Planung und aus jeder Benachrichtigung, bleibt aber 30 Tage erhalten.

*Warum die Frist:* Eine versehentliche Löschung ist sonst endgültig. Dreißig Tage sind
lang genug, dass es auffällt, und kurz genug, dass es kein Archiv wird.

Nach Ablauf verschwindet die Zeile endgültig — und mit ihr alles, was an ihr hängt:
Rückmeldungen, Aufstellungspositionen, Ränge, Gruppen- und Trainingszuordnungen,
Abwesenheiten, Nachrichten, Push-Anmeldungen, Kalender-Token. Das ist gewollt und der
Grund, warum die Fremdschlüssel `ON DELETE CASCADE` tragen.

**Was das bedeutet:** Vergangene Aufstellungen verlieren diese Person. Wer die Historie
eines Spiels später noch vollständig braucht, muss sie vorher ausdrucken oder exportieren.

### Benachrichtigungen — 12 Monate

`notifications` enthält Betreff und Volltext jeder verschickten Nachricht, inklusive Namen
und Terminangaben. Sie werden aufbewahrt, um die Frage „ich habe nie eine Mail bekommen"
beantworten zu können. Nach einem Jahr stellt diese Frage niemand mehr.

### Betriebsprotokolle — 12 Monate

- `match_changes` — wer wann eine Aufstellung geändert hat
- `sync_runs` — Läufe des Kalenderabgleichs
- `open_reminder_log` — wem an welchem Tag der Sammelhinweis geschickt wurde

### Abwesenheiten — 24 Monate nach Ende

`absences.comment_private` kann eine Gesundheitsangabe enthalten („Kur", „Operation"). Sie
ist ausschließlich für die betroffene Person sichtbar. Zwei Jahre nach Ende des Zeitraums
wird der Eintrag gelöscht — die Trainingsplanung des übernächsten Jahres braucht ihn nicht.

### Antwort-Token — 30 Tage nach Ablauf

`action_tokens` macht das Antworten aus einer E-Mail ohne Anmeldung möglich. Ein
abgelaufener Token ist wertlos, verknüpft aber weiterhin eine Person mit einem Termin.

### Nachrichten an einem Termin — mit dem Termin

`object_messages` hat bewusst keinen Fremdschlüssel (das Ziel kann ein Spiel, ein
Trainingstermin oder ein Vereinstermin sein). Drei Trigger löschen die Nachrichten, sobald
der Termin gelöscht wird. Ohne sie blieben sie unsichtbar, aber gespeichert liegen.

### Push-Anmeldungen — bei Abmeldung durch das Gerät

Meldet der Push-Dienst einen Endpunkt als unbekannt (HTTP 404 oder 410), löscht der
Versandlauf die Zeile sofort. Das Gerät kommt nicht wieder.

## Was **nicht** automatisch gelöscht wird

Bewusst, mit Begründung:

| Daten | Warum sie bleiben |
|---|---|
| Mitgliedsdaten im laufenden Mitgliedsverhältnis | Grundlage der Vereinsmitgliedschaft. Wer austritt, löscht sein Konto oder der Administrator tut es — dann greift die 30-Tage-Frist. |
| Vergangene Spiele, Trainingstermine, Vereinstermine | Vereinsgeschichte ohne besonderen Personenbezug. Die *Rückmeldungen* daran verschwinden mit dem jeweiligen Mitglied. |
| Vereinsneuigkeiten | Redaktioneller Inhalt; der Verfasser wird bei dessen Löschung auf „unbekannt" gesetzt (`ON DELETE SET NULL`). |
| Schlüsselprotokoll (`key_handovers`) | Wer zuletzt einen Hallenschlüssel hatte, muss nachvollziehbar bleiben, solange der Schlüssel existiert. Namen verschwinden mit dem Mitglied. |
| Vereinseinstellungen, Orte, Mannschaften | Kein Personenbezug. |
| Feiertage und Schulferien | Kein Personenbezug. |

## Sicherungen

Die wöchentliche Sicherung (`.github/workflows/backup.yml`) wird **90 Tage** aufbewahrt.

**Eine Löschung wirkt dort nicht rückwirkend.** Wer heute gelöscht wird, steht in den
Sicherungen der letzten Wochen weiterhin. Das ist zulässig, solange die Sicherungen nur
zur Wiederherstellung dienen und ihrerseits befristet sind — beides ist hier der Fall.
Wird eine Sicherung tatsächlich eingespielt, muss der Löschlauf danach von Hand angestoßen
werden:

```sql
SELECT public.run_retention();
```

## Auf eine Löschanfrage reagieren

1. Konto löschen — entweder das Mitglied selbst unter **Mein Profil → Profil & Zugang
   löschen**, oder der Administrator unter **Mitglieder**.
2. Wenn die Person auf die sofortige Löschung besteht, statt 30 Tage zu warten: im
   Reiter **Verein → Betrieb** oder per SQL `SELECT public.rpc_run_retention();` nach
   Ablauf der Markierung — oder die Frist vorübergehend auf `0` setzen.
3. Der Person schriftlich bestätigen, was gelöscht wurde und was (Sicherungen) noch
   befristet vorhanden ist.

---

*Zu prüfen bei jeder Änderung des Schemas, mindestens jährlich.*
