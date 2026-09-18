# Auftragsverarbeitung: Resend

> **Dieses Dokument ist kein Vertrag.** Es hält fest, was abzuschließen ist und was dabei
> zu prüfen war.

## Wer und wofür

| | |
|---|---|
| Auftragsverarbeiter | Resend, Inc., Delaware / USA |
| Leistung | Versand der Benachrichtigungs-E-Mails |
| Verarbeitete Daten | Empfängeradresse, Betreff, Text der Nachricht, Zustellstatus |
| Ort der Verarbeitung | USA |

**Deutlich weniger als bei Supabase:** Resend bekommt nur, was ohnehin in der E-Mail
steht. Es gibt keinen Zugriff auf die Datenbank, keine Mitgliederliste und keine
Rückmeldungen — nur die einzelne Nachricht im Moment des Versands.

Was tatsächlich hinausgeht, steht in `supabase/migrations/20261006000000_notifications.sql`
(19 Vorlagen). Typischer Inhalt: Vorname, Name des Termins, Datum, ein Link.

## Was zu tun ist

1. **AV-Vertrag abschließen.** Resend stellt ein DPA bereit; es ist über die
   Rechtsdokumente im Konto abzurufen und zu akzeptieren.
2. **Prüfen, ob Resend unter dem EU-US Data Privacy Framework zertifiziert ist.** Falls
   ja, trägt die Übermittlung darauf; falls nein, greifen die Standardvertragsklauseln aus
   dem DPA. Der Zertifizierungsstatus ist unter
   [dataprivacyframework.gov](https://www.dataprivacyframework.gov/list) einsehbar und
   **vor Abschluss zu prüfen** — er kann sich ändern.
3. **Abgeschlossenen Vertrag ablegen.**
4. **Absenderdomain verifizieren** (SPF, DKIM, DMARC). Das ist nicht nur Technik: Ohne sie
   landen die Nachrichten im Spam, und der Verein verschickt dann personenbezogene Daten
   an Postfächer, in denen sie niemand liest, aber jeder Spamfilter sie prüft.

## Was dabei geprüft wurde

| Frage | Antwort |
|---|---|
| Wie lange speichert Resend die Inhalte? | Nach den Angaben des Anbieters für die Zustellprotokolle begrenzt. **Die tatsächliche Frist ist im DPA nachzulesen und hier einzutragen: [__ Tage]** |
| Kann der Versand ohne US-Dienst erfolgen? | Ja. Der Code spricht Resend über eine einzige Funktion in `process-notifications` an; ein europäischer Anbieter wäre ein Austausch von etwa dreißig Zeilen. Das ist bewusst so gebaut. |
| Was passiert bei einem Ausfall? | Die Nachricht bleibt im Postfach der Anwendung stehen und wird bis zu dreimal erneut versucht. Es geht nichts verloren. |
| Bekommt Resend Kopie-Adressen (Eltern)? | Ja, als CC derselben Nachricht. |

## Alternative, falls die USA nicht tragbar sind

Sollte der Verein die Übermittlung in die USA vermeiden wollen, kommen europäische
Anbieter in Frage (z. B. Brevo/Frankreich, Mailjet/Frankreich, oder ein SMTP-Postfach beim
eigenen Provider). Zu ändern wäre nur die Funktion `sendEmail` in
`supabase/functions/process-notifications/index.ts` und das Secret `RESEND_API_KEY`.

Das ist kein theoretischer Ausweg, sondern der Grund, warum der Versand überhaupt an einer
Stelle gebündelt ist.

---

*Zu prüfen bei jeder Änderung der Resend-Bedingungen, mindestens jährlich.*
