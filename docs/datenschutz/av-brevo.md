# Auftragsverarbeitung: Brevo

> **Dieses Dokument ist kein Vertrag.** Es hält fest, was abzuschließen ist und was dabei
> zu prüfen war.

## Wer und wofür

| | |
|---|---|
| Auftragsverarbeiter | Brevo SAS (vormals Sendinblue), Paris / Frankreich |
| Leistung | Versand der Benachrichtigungs-E-Mails (API) und der Anmelde-Mails von Supabase Auth (SMTP) |
| Verarbeitete Daten | Empfängeradresse, Betreff, Text der Nachricht, Zustellstatus |
| Ort der Verarbeitung | EU |

**Deutlich weniger als bei Supabase:** Brevo bekommt nur, was ohnehin in der E-Mail
steht. Es gibt keinen Zugriff auf die Datenbank, keine Mitgliederliste und keine
Rückmeldungen — nur die einzelne Nachricht im Moment des Versands.

Was tatsächlich hinausgeht, steht in `supabase/migrations/20261006000000_notifications.sql`
(19 Vorlagen). Typischer Inhalt: Vorname, Name des Termins, Datum, ein Link.

**Gegenüber Resend (bis Oktober 2026) entfällt die Übermittlung in die USA.** Brevo ist
ein französisches Unternehmen; Standardvertragsklauseln und die Frage nach dem
Data Privacy Framework stellen sich für den Versand nicht mehr.

## Was zu tun ist

1. **AV-Vertrag ablegen.** Brevos *Data Processing Agreement* ist Bestandteil der
   Nutzungsbedingungen und gilt mit dem Konto. Die aktuelle Fassung einmal herunterladen
   (brevo.com → *Legal* → *DPA*) und zu den Vereinsunterlagen legen.
2. **Unterauftragsverarbeiter ansehen.** Brevo veröffentlicht die Liste im selben
   Rechtsbereich. Prüfen, ob für den Versand Dienstleister außerhalb der EU beteiligt
   sind, und das Ergebnis hier eintragen: **[__]**
3. **Absenderdomain authentifizieren** (DKIM, DMARC). Das ist nicht nur Technik: Ohne sie
   landen die Nachrichten im Spam, und der Verein verschickt dann personenbezogene Daten
   an Postfächer, in denen sie niemand liest, aber jeder Spamfilter sie prüft.
4. **Keine Kontaktlisten in Brevo pflegen.** Brevo ist auch ein Newsletter-Werkzeug. Die
   Anwendung legt dort keine Kontakte an, und das soll so bleiben: Wer Mitglieder für
   einen Newsletter importiert, schafft eine zweite Verarbeitung mit eigener
   Rechtsgrundlage.

## Was dabei geprüft wurde

| Frage | Antwort |
|---|---|
| Wie lange speichert Brevo die Inhalte? | Die Versandprotokolle sind im Konto begrenzt einsehbar. **Die tatsächliche Frist ist im DPA nachzulesen und hier einzutragen: [__ Tage]** |
| Ist der Anbieter austauschbar? | Ja. Der Code spricht Brevo über eine einzige Funktion `sendEmail` in `supabase/functions/process-notifications/index.ts` an, dazu das Secret `BREVO_API_KEY`. Der Wechsel von Resend war ein Austausch von etwa dreißig Zeilen. |
| Was passiert bei einem Ausfall oder vollem Tageskontingent? | Die Nachricht bleibt im Postfach der Anwendung stehen und wird bis zu dreimal erneut versucht. Es geht nichts verloren. |
| Bekommt Brevo Kopie-Adressen (Eltern)? | Ja, als CC derselben Nachricht. |

---

*Zu prüfen bei jeder Änderung der Brevo-Bedingungen, mindestens jährlich.*
