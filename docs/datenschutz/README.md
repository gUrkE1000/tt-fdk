# Datenschutz-Unterlagen

Was der Verein braucht, um den Vereinsplaner rechtssicher zu betreiben, und was davon in
diesem Ordner liegt.

> **Diese Dokumente sind Entwürfe, keine Rechtsberatung.** Sie sind aus dem gebaut, was
> die Anwendung tatsächlich tut — jede Tabelle, jede Frist und jeder Empfänger stammt aus
> dem Code, nicht aus einer Vorlage. Genau deshalb sind sie brauchbar. Aber ob sie für
> **euren** Verein vollständig sind, kann nur jemand beurteilen, der den Verein kennt.
> Vor dem Go-live einmal von einer Person mit Datenschutzkenntnis durchsehen lassen;
> viele Landessportbünde bieten das für Mitgliedsvereine kostenlos an.

| Dokument | Wofür | Pflicht? |
|---|---|---|
| [`verarbeitungsverzeichnis.md`](verarbeitungsverzeichnis.md) | Art. 30 DSGVO: Was wird verarbeitet, warum, wie lange, wer bekommt es | **ja**, muss auf Anforderung vorgelegt werden |
| [`datenschutzhinweis.md`](datenschutzhinweis.md) | Art. 13 DSGVO: Was die Mitglieder erfahren müssen | **ja**, in der Anwendung verlinkt |
| [`loeschkonzept.md`](loeschkonzept.md) | Welche Daten wann verschwinden — und wer das tut | faktisch ja (Art. 5, 17) |
| [`av-supabase.md`](av-supabase.md) | Auftragsverarbeitung Datenbank/Hosting | **ja**, Vertrag abzuschließen |
| [`av-resend.md`](av-resend.md) | Auftragsverarbeitung E-Mail-Versand | **ja**, Vertrag abzuschließen |

## Was noch dazugehört, aber nicht hier liegt

- **Benennung eines Datenschutzbeauftragten**: für einen Sportverein in der Regel
  **nicht** erforderlich (§ 38 BDSG: erst ab 20 Personen, die ständig mit der
  Verarbeitung befasst sind). Wer dennoch eine Ansprechperson benennt, trägt sie in
  `datenschutzhinweis.md` ein.
- **Verpflichtung auf Vertraulichkeit** für alle, die Administratorrechte bekommen. Eine
  halbe Seite, formlos möglich.
- **Datenschutz-Folgenabschätzung** (Art. 35): hier nicht nötig — keine systematische
  Bewertung, kein Scoring, keine besonderen Kategorien nach Art. 9.

## Warum es überhaupt einfacher wird als beim TT-Planer

Der Verein war bisher Verantwortlicher für Daten, die bei einem Anbieter lagen, dessen
Verarbeitung er nicht einsehen konnte. Mit dem eigenen Supabase-Projekt sind es zwei
Auftragsverarbeiter statt einem undurchsichtigen Dienst, und das
Verarbeitungsverzeichnis lässt sich aus dem Schema ablesen statt erfragen.
