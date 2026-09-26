# Verzeichnis von Verarbeitungstätigkeiten

nach Art. 30 Abs. 1 DSGVO

> Entwurf. Die Platzhalter in eckigen Klammern sind vor der Verwendung zu füllen.
> Stand der Anwendung: Phasen 0–9, siehe `docs/umsetzungsplan.md`.

## 1. Verantwortlicher

| | |
|---|---|
| Verein | [Name des Vereins] |
| Anschrift | [Straße, PLZ, Ort] |
| Vertreten durch | [Vorstand nach § 26 BGB] |
| Kontakt | [E-Mail, Telefon] |
| Datenschutzbeauftragter | [nicht benannt — nicht erforderlich nach § 38 BDSG] |

## 2. Verarbeitungstätigkeit

**Bezeichnung:** Vereinsverwaltung und Terminplanung mit der Anwendung „Vereinsplaner"
(Eigenbetrieb, ersetzt den zuvor genutzten Dienst TT-Planer).

**Zweck:** Organisation des Spiel- und Trainingsbetriebs einer Tischtennisabteilung:
Mitgliederverwaltung, Mannschaftsaufstellungen, Rückmeldungen zu Terminen, Ersatzsuche,
Trainingsteilnahme, Vereinstermine, Umfragen und die dazugehörigen Benachrichtigungen.

## 3. Rechtsgrundlagen

| Verarbeitung | Grundlage |
|---|---|
| Mitgliederstammdaten, Mannschafts- und Trainingszuordnung, Terminplanung | Art. 6 Abs. 1 lit. b DSGVO — Erfüllung des Mitgliedschaftsverhältnisses |
| Benachrichtigungen zu Terminen, an denen die Person beteiligt ist | Art. 6 Abs. 1 lit. b DSGVO |
| Veröffentlichung von Kontaktdaten im Mitgliederverzeichnis | Art. 6 Abs. 1 lit. a DSGVO — **Einwilligung**, im Profil einzeln schaltbar (`contact_visible`) |
| Anzeige des Geburtstags im Vereinskalender | Art. 6 Abs. 1 lit. a DSGVO — Einwilligung, abwählbar (`hide_birthday`) |
| Push-Benachrichtigungen auf Endgeräte | Art. 6 Abs. 1 lit. a DSGVO — Einwilligung durch Drücken der Glocke |
| Statistik der Trainingsbeteiligung | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an der Trainingsplanung; Sichtbarkeit je Training begrenzt |
| Protokolle über Änderungen an Aufstellungen | Art. 6 Abs. 1 lit. f DSGVO — Nachvollziehbarkeit gegenüber den Betroffenen selbst |

**Besondere Kategorien nach Art. 9 werden nicht verarbeitet.** Das Feld für den Grund
einer Abwesenheit (`absences.comment_private`) kann vom Mitglied freiwillig mit einer
Gesundheitsangabe gefüllt werden; es ist ausschließlich für das Mitglied selbst sichtbar
und wird niemandem sonst angezeigt — auch nicht dem Administrator.

## 4. Kategorien betroffener Personen

- Vereinsmitglieder der Tischtennisabteilung
- Gäste (Personen mit eingeschränktem Zugang, z. B. Probetrainierende)
- Erziehungsberechtigte, soweit sie als Kopie-Empfänger für Benachrichtigungen eingetragen sind

## 5. Kategorien personenbezogener Daten

| Kategorie | Felder | Bemerkung |
|---|---|---|
| Stammdaten | Vor-/Nachname, Geschlecht, Geburtsdatum, Mitgliedsnummer | `profiles` |
| Kontaktdaten | E-Mail, Telefon, Handynummer, Kopie-Adressen | `profiles`; Sichtbarkeit für andere Mitglieder nur mit Einwilligung |
| Sportbezogene Daten | QTTR-Wert, Ränge je Altersklasse, Mannschafts- und Trainingszuordnung, „kein Mannschaftsspieler" | `member_rankings`, `team_members`, `training_members` |
| Zugangsdaten | Rolle, Status, Zeitpunkt der Verknüpfung und des letzten Logins | `profiles`; das Passwort selbst liegt bei Supabase Auth, nicht in diesen Tabellen |
| Terminbezogene Daten | Rückmeldungen zu Spielen, Trainings und Vereinsterminen, Aufstellungspositionen, Fahrdienst, Verpflegung, Gästezahl | `match_participations`, `training_attendance`, `event_participations`, `match_volunteers` |
| Abwesenheiten | Zeitraum und ein privater Grund | `absences`; der Grund ist nur für die Person selbst sichtbar |
| Kommunikation | Betreff und Text verschickter Benachrichtigungen, Nachrichten an Terminen | `notifications`, `object_messages` |
| Endgeräte | Push-Endpunkt, Verschlüsselungsschlüssel, Browserkennung | `push_subscriptions`; nur nach ausdrücklicher Einwilligung |
| Abo-Token | Zufallsschlüssel für den persönlichen Kalender-Feed, Schalter „Trainings mitabonnieren“ | `calendar_tokens` |
| Ämter und Schlüsseldienst | Vereinsamt, Schlüsseldienst (fester Wochentag, Vertretung), wer zum Training den Schlüssel bringt | `club_roles`, `profiles.key_service`, `key_duty_weekdays`, `key_duty_overrides`, `training_session_keys` |
| Statistik | Anwesenheit je Trainingstermin | abgeleitet aus `training_attendance` |

## 6. Kategorien von Empfängern

| Empfänger | Was | Grundlage |
|---|---|---|
| Andere Vereinsmitglieder | Name, Mannschafts- und Trainingszuordnung, Rückmeldungen zu gemeinsamen Terminen; Kontaktdaten und Geburtstag **nur mit Einwilligung** | Vereinszweck, Art. 6 Abs. 1 lit. b |
| Supabase (Auftragsverarbeiter) | alle gespeicherten Daten — Datenbank, Anmeldung, Serverfunktionen | AV-Vertrag, siehe [`av-supabase.md`](av-supabase.md) |
| Resend (Auftragsverarbeiter) | Empfängeradresse, Betreff und Text jeder verschickten E-Mail | AV-Vertrag, siehe [`av-resend.md`](av-resend.md) |
| Push-Dienste der Browserhersteller (Google, Apple, Mozilla) | verschlüsselte Nachricht an den Endpunkt des Geräts | technisch unvermeidbar bei Web Push; Inhalt ist Ende-zu-Ende verschlüsselt (VAPID/`aes128gcm`) |
| [Hosting der Anwendungsdateien] | Auslieferung der Programmdateien; **keine personenbezogenen Daten**, da die Anwendung im Browser läuft und direkt mit Supabase spricht | — |
| Tischtennisverband / click-TT | **keine Übermittlung.** Der Spielplan wird nur *gelesen* (ICS-Abruf) | — |

**Es findet keine Übermittlung an Dritte zu Werbezwecken statt. Es gibt kein Tracking,
keine Analysedienste und keine Cookies außer dem Anmeldetoken.**

## 7. Drittlandübermittlung

| Dienst | Ort der Verarbeitung | Grundlage |
|---|---|---|
| Supabase | Projektregion **Frankfurt (eu-central-1)** — bei der Einrichtung so zu wählen (`docs/einrichtung.md`, Schritt 1). Muttergesellschaft in den USA; Zugriff für Support theoretisch möglich | AV-Vertrag mit Standardvertragsklauseln |
| Resend | Verarbeitung in den USA | AV-Vertrag mit Standardvertragsklauseln; Resend ist unter dem EU-US Data Privacy Framework zertifiziert — **vor Abschluss prüfen, ob die Zertifizierung noch gültig ist** |
| Push-Dienste | je nach Browserhersteller, überwiegend USA | keine Vertragsbeziehung möglich; übermittelt wird nur ein verschlüsselter Datenblock |

## 8. Löschfristen

Ausführlich in [`loeschkonzept.md`](loeschkonzept.md). Kurzfassung:

| Daten | Frist |
|---|---|
| Konto nach Löschung durch das Mitglied oder den Verein | 30 Tage, dann vollständige Entfernung |
| Verschickte und fehlgeschlagene Benachrichtigungen | 12 Monate |
| Betriebsprotokolle (Aufstellungsänderungen, Sync-Läufe) | 12 Monate |
| Abwesenheiten nach Ende des Zeitraums | 24 Monate |
| Abgelaufene Antwort-Token | 30 Tage nach Ablauf |
| Nachrichten an einem Termin | mit dem Termin |
| Mitgliedsdaten im laufenden Mitgliedsverhältnis | für dessen Dauer |

Die Fristen sind in `club_settings` hinterlegt und werden täglich um 2 Uhr von
`run_retention()` durchgesetzt — **automatisch, nicht auf Zuruf.**

## 9. Technische und organisatorische Maßnahmen

nach Art. 32 DSGVO

**Zugriffskontrolle**

- Jede Tabelle hat Row Level Security; die Rechte werden in der Datenbank erzwungen, nicht
  in der Oberfläche. Jede Regel hat mindestens einen positiven und einen negativen
  automatisierten Test (derzeit 403 Zusicherungen).
- Sechs Rollen mit abgestuften Rechten. Ein Vereinsamt gibt **keine** technischen Rechte.
- Der Schlüssel mit Vollzugriff (`service_role`) liegt ausschließlich in der
  Serverumgebung und ist nie im Browser verfügbar.
- Anmeldung über Einmal-Link per E-Mail oder Passwort; neue Konten entstehen nur durch
  Einladung oder Vereinscode, nie durch Selbstregistrierung mit beliebiger Adresse.

**Datenminimierung in der Anzeige**

- Kontaktdaten und Geburtstage werden bereits in der Datenbank maskiert
  (`v_members_directory`), wenn keine Einwilligung vorliegt — nicht erst in der Anzeige.
- Trainings können „inkognito" geführt werden: dann sieht niemand außer Trainer und
  Administrator, wer teilnimmt.
- Der Grund einer Abwesenheit ist ausschließlich für die betroffene Person sichtbar.

**Übertragung und Speicherung**

- Ausschließlich HTTPS; die Anwendung ist ohne HTTPS nicht betreibbar (Service Worker).
- Verschlüsselung ruhender Daten durch Supabase.
- Die App speichert **keine** Vereinsdaten im Browser-Zwischenspeicher — bewusst, damit
  keine veralteten Teilnehmerlisten auf fremden Geräten liegen bleiben.

**Verfügbarkeit**

- Tägliche Sicherung durch Supabase, zusätzlich eine wöchentliche eigene Sicherung
  (`.github/workflows/backup.yml`, 90 Tage Aufbewahrung, privates Repository).

**Nachvollziehbarkeit**

- Änderungen an Aufstellungen werden protokolliert (`match_changes`), ebenso jeder
  Versandversuch (`notifications`).

## 10. Betroffenenrechte

| Recht | Wie es erfüllt wird |
|---|---|
| Auskunft (Art. 15) | Der Administrator exportiert die Mitgliederdaten über **Mitglieder → Excel Import & Update → Mitglieder herunterladen**; termin- und nachrichtenbezogene Daten auf Anfrage per SQL-Abfrage |
| Berichtigung (Art. 16) | Jedes Mitglied ändert seine Daten selbst unter **Mein Profil** |
| Löschung (Art. 17) | Selbstlöschung unter **Mein Profil → Profil & Zugang löschen**; danach 30 Tage Frist, dann automatisch und vollständig |
| Einschränkung (Art. 18) | Konto auf „nicht freigeschaltet" setzen — das Mitglied erscheint dann in keiner Planung |
| Datenübertragbarkeit (Art. 20) | Excel-Export wie bei der Auskunft |
| Widerspruch (Art. 21) | Einwilligungen (Kontaktdaten, Geburtstag, Push) sind im Profil einzeln abwählbar; Benachrichtigungen je Ereignistyp und Kanal |

---

*Erstellt am [Datum]. Zu prüfen bei jeder Änderung der Verarbeitung, mindestens jährlich.*
