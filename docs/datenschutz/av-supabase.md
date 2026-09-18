# Auftragsverarbeitung: Supabase

> **Dieses Dokument ist kein Vertrag.** Ein Auftragsverarbeitungsvertrag wird vom
> Auftragsverarbeiter gestellt und vom Verein abgeschlossen — er wird nicht selbst
> geschrieben. Hier steht, **was abzuschließen ist, wie, und was dabei zu prüfen war.**

## Wer und wofür

| | |
|---|---|
| Auftragsverarbeiter | Supabase, Inc., 970 Toa Payoh North, Singapur / US-Gesellschaft |
| Leistung | Datenbank (PostgreSQL), Anmeldung (Auth), Serverfunktionen (Edge Functions) |
| Verarbeitete Daten | **alle** in [`verarbeitungsverzeichnis.md`](verarbeitungsverzeichnis.md) genannten Kategorien |
| Ort der Verarbeitung | Projektregion, hier **Frankfurt (eu-central-1)** |

Supabase ist der einzige Dienst mit Zugriff auf den gesamten Datenbestand. Das ist der
zentrale Punkt dieser Auftragsverarbeitung.

## Was zu tun ist

1. **AV-Vertrag abschließen.** Supabase stellt ihn als Teil der Nutzungsbedingungen
   bereit; für zahlende Projekte ist er im Dashboard unter *Organization → Legal
   Documents* abrufbar und zu akzeptieren. Auf dem kostenlosen Tarif ist zu prüfen, ob
   ein DPA angeboten wird — **wenn nicht, ist der kostenlose Tarif für personenbezogene
   Mitgliederdaten nicht nutzbar.**
2. **Region auf Frankfurt setzen.** Das geht nur beim Anlegen des Projekts und lässt sich
   nachträglich nicht ändern. Siehe `docs/einrichtung.md`, Schritt 1.
3. **Abgeschlossenen Vertrag ablegen** — PDF oder Screenshot mit Datum, zusammen mit
   diesen Unterlagen.
4. **Unterauftragsverarbeiter zur Kenntnis nehmen.** Supabase nutzt AWS als
   Infrastrukturanbieter. Die Liste steht in der Datenschutzerklärung von Supabase und
   ist bei Änderungen zu prüfen.

## Was dabei geprüft wurde

| Frage | Antwort |
|---|---|
| Liegen die Daten in der EU? | Ja, wenn die Region Frankfurt gewählt wurde. Die Datenbank selbst verlässt die Region nicht. |
| Kann US-Personal zugreifen? | Theoretisch ja, über Support-Zugänge. Das ist der Grund, warum es Standardvertragsklauseln braucht. |
| Sind die Daten ruhend verschlüsselt? | Ja, durch AWS-Verschlüsselung der Volumes. |
| Wer hat den Schlüssel mit Vollzugriff? | Der `service_role`-Schlüssel liegt ausschließlich in den Secrets der Edge Functions. Er ist nie im Browser, nie im Repository und nie in einer E-Mail. Wer ihn hat, liest und ändert alle Mitgliederdaten an jeder Policy vorbei. |
| Gibt es Löschmöglichkeiten? | Ja, über die Anwendung (siehe [`loeschkonzept.md`](loeschkonzept.md)) und durch Löschen des gesamten Projekts. |

## Was der Verein selbst verantwortet

Die Auftragsverarbeitung deckt nur, was Supabase tut. Nicht gedeckt und Sache des Vereins:

- **Wer Administratorrechte bekommt.** Ein Administrator sieht alle Mitgliederdaten.
- **Das Datenbank-Passwort und der `service_role`-Schlüssel.** Gelangen sie nach außen, ist
  das ein meldepflichtiger Vorfall nach Art. 33 DSGVO — unabhängig davon, was Supabase tut.
- **Der Zugang zum Supabase-Dashboard.** Zwei-Faktor-Authentisierung aktivieren.
- **Die eigene Sicherung** (`.github/workflows/backup.yml`) und das Repository, in dem sie
  liegt. Das Repository muss privat bleiben.

## Bei einem Wechsel

Der Datenbestand lässt sich jederzeit vollständig mit `pg_dump` herausholen (siehe
`docs/betrieb.md`, Abschnitt 9). Es gibt keine Abhängigkeit, die einen Wechsel verhindert
— außer den Supabase-spezifischen Teilen Auth und Edge Functions, die bei einem Umzug neu
zu bauen wären.

---

*Zu prüfen bei jeder Änderung der Supabase-Bedingungen, mindestens jährlich.*
