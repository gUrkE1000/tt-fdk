# Vor der ersten Einladung

Was zwischen „die Anwendung läuft" und „ich schicke einem Menschen die Adresse" noch liegt.

> Geprüft am 19.09.2026 gegen den Code, nicht aus dem Gedächtnis. Jede Zeile nennt, **was
> passiert, wenn man sie überspringt** — denn genau das entscheidet, ob ein Punkt vor oder
> nach der ersten Einladung erledigt werden kann.

---

## Die Kurzfassung

| | Punkt | Ohne das passiert |
|---|---|---|
| 🔴 | [Site URL und Redirect URLs](#0-site-url-und-redirect-urls) | Jeder Einladungs- und Anmeldelink landet auf `localhost:3000` und lädt endlos |
| 🔴 | [SMTP auf Resend umstellen](#1-smtp-auf-resend-umstellen) | Nach 2–4 Einladungen kommt keine mehr an |
| 🔴 | [Vereinsdaten ausfüllen](#2-vereinsdaten) | „Mein Tischtennisverein" in jeder E-Mail; Heimspiele auf auswärts |
| 🔴 | [Betriebseinstellungen](#3-betriebseinstellungen) | Links in Benachrichtigungen führen ins Leere |
| 🔴 | [Datenschutzhinweis](#4-datenschutzhinweis-und-impressum) | Die Registrierung verschweigt, was mit den Daten passiert |
| 🟠 | [Probelauf](#5-der-probelauf) | Fehler fallen erst bei den Mitgliedern auf |
| 🟡 | [Orte, Mannschaften, Trainings](#6-inhalte-anlegen) | Der Eingeladene sieht eine leere Anwendung |
| 🟡 | [Resend-Schlüssel verengen](#7-kleinigkeiten) | Ein verlorener Schlüssel kann mehr, als er müsste |

🔴 = vor der ersten Einladung · 🟠 = vor der zweiten · 🟡 = vor der dritten

---

## 0. Site URL und Redirect URLs

**Der Punkt, an dem eine sonst fertige Anwendung unbenutzbar aussieht.**

Jeder Link, den Supabase Auth verschickt — Einladung, Magic Link, Passwort zurücksetzen —
zeigt nicht auf die Anwendung, sondern auf Supabase. Erst dort wird der Token eingelöst und
weitergeleitet. **Wohin**, entscheidet die *Site URL*.

Steht die noch auf der Voreinstellung, ist das `http://localhost:3000`. Der Eingeladene
klickt, landet auf seinem eigenen Rechner, auf dem nichts läuft — und der Browser dreht
sich, bis er aufgibt. Keine Fehlermeldung, kein Hinweis, nur eine ewig ladende Seite.

Dasselbe passiert, wenn die Adresse zwar als Site URL steht, aber nicht in den
**Redirect URLs**: Supabase weist jedes Ziel ab, das dort nicht aufgeführt ist, und fällt
auf die Site URL zurück.

### Einstellen

Supabase → *Authentication* → *URL Configuration*:

| Feld | Wert |
|---|---|
| **Site URL** | `https://tt-tsvfeldkirchen.de` |
| **Redirect URLs** | `https://tt-tsvfeldkirchen.de/**` und `http://localhost:5173/**` |

Ohne abschließenden Schrägstrich. Der zweite Eintrag ist die Entwicklung; wer nie lokal
entwickelt, lässt ihn weg.

### Prüfen

Der Test dauert eine halbe Minute und braucht niemanden sonst:

1. Abmelden, auf der Anmeldeseite die **eigene** Adresse eintragen, Link anfordern.
2. Die Mail öffnen und **mit der rechten Maustaste auf den Link → Adresse kopieren**.
3. Irgendwo einfügen und lesen. Hinter `redirect_to=` muss deine Domain stehen.

Steht dort `localhost:3000`, ist die Site URL nicht gesetzt — und zwar **für alle bereits
verschickten Links**, die damit wertlos sind. Nach dem Umstellen neu einladen.

**Wichtig:** Ändert sich die Domain später, ändert sich das hier mit. Die Liste steht in
[docs/domain-einrichten.md](domain-einrichten.md) unter „Domainwechsel".

---

## 1. SMTP auf Resend umstellen

**Das ist der Punkt, der in keiner bisherigen Anleitung stand.**

In dieser Anwendung gehen E-Mails über **zwei getrennte Wege**:

| Was | Weg | Steht schon |
|---|---|---|
| Erinnerungen, Aufstellungen, Ersatzanfragen | `process-notifications` → **Resend** | ✅ |
| **Einladung, Anmeldelink, Passwort zurücksetzen** | **Supabase Auth** | ❌ |

Nachzusehen im Code: `invite-member/index.ts` ruft `admin.auth.admin.inviteUserByEmail()`,
`auth/api.ts` ruft `signInWithOtp()` und `resetPasswordForEmail()`. Keiner dieser drei
Aufrufe berührt Resend.

Supabase Auth verschickt ab Werk über einen **eingebauten Dienst, der ausdrücklich nur zum
Testen gedacht ist**. Er ist auf wenige E-Mails pro Stunde begrenzt und verschickt von
einer geteilten Absenderadresse, die bei manchen Anbietern im Spam landet.

> **Konkret:** Die Einladung an dich hat funktioniert. Die Einladung an achtzig
> Vereinsmitglieder wird es nicht. Nach den ersten paar Adressen schlägt der Versand fehl —
> und zwar ohne dass die Anwendung es merkt, denn der Fehler entsteht bei Supabase, nicht
> in `process-notifications`. Unter *Verein → Betrieb → Benachrichtigungen* steht er
> deshalb **nicht**.

### Umstellen

Supabase → *Project Settings* → *Authentication* → **SMTP Settings** → *Enable Custom SMTP*

| Feld | Wert |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | dein Resend-API-Schlüssel (`re_…`) |
| Sender email | `planer@tt-tsvfeldkirchen.de` |
| Sender name | `TSV Feldkirchen` |

Danach laufen **alle** E-Mails über Resend: dieselbe verifizierte Domain, dieselben
SPF/DKIM/DMARC-Einträge, dieselbe Zustellbarkeit — und alles ist im Resend-Protokoll
nachvollziehbar.

Anschließend unter *Authentication → Rate Limits* nachsehen, ob die Grenze für
E-Mails hochgesetzt werden kann. Mit eigenem SMTP ist sie nicht mehr an den Testdienst
gebunden.

### Prüfen

Schick dir selbst eine Einladung an eine **zweite** Adresse und sieh im
Resend-Dashboard unter *Emails* nach. Taucht sie dort auf, läuft der Weg richtig.
Taucht sie nicht auf, geht sie weiterhin über Supabase.

☐ Umgestellt am: ________  ☐ Testmail im Resend-Protokoll gesehen: ________

---

## 2. Vereinsdaten

*Verein → Daten*. Steht nach der Einrichtung auf Vorgabewerten.

| Feld | Wert | Ohne das |
|---|---|---|
| Name | `TSV Feldkirchen` | „Mein Tischtennisverein" steht auf der Anmeldeseite und in jeder E-Mail |
| Kurzname | `TSV Feldkirchen` | „MTTV" in engen Ansichten und im Kalender |
| **Weitere Schreibweisen** | `TSV Feldkirchen` | **Heimspiele stehen auf auswärts.** Daran erkennt der Spielimport eure Seite |
| **Bundesland** | `Bayern` | Steht auf `NW`. Training fällt an bayerischen Feiertagen nicht aus |
| Webseite | `https://tsvfeldkirchen.de` | — |
| Standardort | Mehrzweckhalle | Jeder neue Termin braucht die Ortsauswahl von Hand |
| Vereinscode | frei wählbar | Selbstregistrierung per QR-Code geht nicht |

⚠️ **Nicht bloß `Feldkirchen` als Schreibweise.** Es gibt einen *TV Feldkirchen*. Passt der
Alias auf beide Seiten eines Spieltitels, nimmt die Anwendung ein Heimspiel an — und
niemand fährt zum Auswärtsspiel. Lieber mehrere genaue Schreibweisen als eine breite.

☐ Erledigt am: ________

---

## 3. Betriebseinstellungen

*Verein → Betrieb → Einstellungen*

| Feld | Wert | Ohne das |
|---|---|---|
| **Adresse der Anwendung** | `https://tt-tsvfeldkirchen.de` | **Jeder Link in jeder Benachrichtigung führt ins Leere.** Die E-Mail kommt an, kein Knopf funktioniert |
| Absendername | `TSV Feldkirchen` | „Vereinsplaner" als Absender |
| Absenderadresse | `planer@tt-tsvfeldkirchen.de` | Der Versand scheitert dauerhaft — `process-notifications` bricht ohne Absenderadresse ab |
| **Antwortadresse** | deine echte Adresse | Antworten auf Benachrichtigungen fallen lautlos aus der Welt |

Die *Adresse der Anwendung* ist zusätzlich als Secret `APP_URL` gesetzt (für die Edge
Functions). Beide müssen übereinstimmen.

☐ Erledigt am: ________

---

## 4. Datenschutzhinweis und Impressum

*Verein → Betrieb → Einstellungen → Rechtliches*

Die Registrierungsseite und die Fußzeile verlinken beides. Fehlen die Adressen, **erfährt
niemand, was mit seinen Daten passiert** — und die Anwendung verschweigt es, weil sie
nichts zu verlinken hat.

**Vorher zu tun:**

1. `docs/datenschutz/datenschutzhinweis.md` — Platzhalter in eckigen Klammern füllen
   (Vereinsname, Anschrift, Vorstand, Kontaktadresse, zuständige Aufsichtsbehörde)
2. Auf der Vereinswebsite veröffentlichen
3. Die URL hier eintragen
4. Impressum verlinken — für einen eingetragenen Verein mit Website ohnehin Pflicht

**Parallel, weil es Laufzeit hat:**

- AV-Vertrag mit **Supabase** abschließen
- AV-Vertrag mit **Resend** abschließen, vorher den Data-Privacy-Framework-Status prüfen
- `docs/datenschutz/verarbeitungsverzeichnis.md` zu den Vereinsunterlagen

> Die Entwürfe in `docs/datenschutz/` sind sorgfältig und decken die tatsächliche
> Verarbeitung ab — aber sie sind keine Rechtsberatung.

☐ Hinweis veröffentlicht unter: ____________________
☐ URL eingetragen am: ________
☐ AV Supabase: ________  ☐ AV Resend: ________

---

## 5. Der Probelauf

Bis hierher ist **nichts davon je in echt gelaufen**. Vor der ersten Einladung reichen die
Punkte 1 und 2; der Rest darf danach kommen, aber vor der zweiten Welle.

| # | Test | Erwartung | Muss vor Einladung 1 |
|---|---|---|---|
| 1 | Zweites Mitglied anlegen und einladen | Mail kommt an, im **Resend-Protokoll** sichtbar | ✅ |
| 2 | Antwortlink in der Mail anklicken | Speichert die Antwort ohne Anmeldung | ✅ |
| 3 | Mannschaft + Webcal-URL, dann *Spiele importieren* | Lauf mit „n neu", **Heim/Auswärts stimmt** | — |
| 4 | Training anlegen | Termine erscheinen, Feiertage fehlen | — |
| 5 | Auf dem Handy die Glocke drücken | wird grün. iOS: nur nach „Zum Home-Bildschirm" | — |
| 6 | Kalender abonnieren | Termine im eigenen Kalenderprogramm | — |
| 7 | **Am nächsten Morgen** *Betrieb → Jobs* | alle sechs mit einem Lauf der Nacht | — |

Punkt 7 lässt sich nicht beschleunigen und ist der einzige Beweis, dass die Automatik
wirklich läuft.

☐ 1–2: ________  ☐ 3–6: ________  ☐ 7: ________

---

## 6. Inhalte anlegen

Wer als Erstes eingeladen wird, sieht sonst eine leere Anwendung und weiß nicht, wozu.

| | Wo | Aufwand |
|---|---|---|
| Orte & Schlüssel | *Orte & Schlüssel* | Mehrzweckhalle, Richthofenstraße 1, 85622 Feldkirchen |
| Gruppen | *Mitglieder → Gruppen* | Schreibweise muss zur Excel-Datei passen |
| Trainings | *Trainings* | Mit **Startdatum** — bestimmt bei zweiwöchentlichem Rhythmus die Woche |
| Mannschaften | *Mannschaften* | Mit **Webcal-URL** aus click-TT (BTTV) |
| Kader | *Mannschaften → Kader* | Ersatzspieler in der richtigen **Reihenfolge** |

⚠️ **Reihenfolge beachten**, wenn danach der Excel-Import kommt: Gruppen und Trainings
müssen **vor** dem Mitglieder-Import existieren. Der Import ordnet sie über den Namen zu
und überspringt stillschweigend, was er nicht findet. Vollständig in
[`migration.md`](migration.md).

☐ Erledigt am: ________

---

## 7. Kleinigkeiten

| | Was | Warum |
|---|---|---|
| ☐ | **Resend-Schlüssel verengen** | Deiner hat *Full access*. *Sending access* genügt — dann kann ein verlorener Schlüssel keine Domains ändern und keine Protokolle lesen |
| ☐ | `BACKUP_ENABLED` = `true` | GitHub → *Settings → Variables*. Ohne die Variable läuft die wöchentliche Sicherung ins Leere |
| ☐ | `push`-Auslöser in `deploy.yml` und `deploy-supabase.yml` aktivieren | Sonst musst du jedes Mal von Hand deployen |
| ☐ | `www`-CNAME bei IONOS | Kosmetik — aber Leute tippen `www.` |
| ☐ | Kündigungsfrist TT-Planer nachsehen | ⏰ **Der einzige Punkt mit einer Uhr.** Jahresvertrag; versäumt kostet 180 € und zwölf Monate |
| ☐ | Eigene `LICENSE` | Regelt, was ein künftiger Vorstand mit dem Projekt darf |

---

## Was du dem ersten Menschen schreibst

Wenn 1 bis 4 stehen:

> Hallo [Name],
>
> wir testen gerade einen eigenen Vereinsplaner als Ersatz für den TT-Planer. Du bekommst
> gleich eine Einladung per E-Mail — klick den Link darin an, dann bist du drin. Ein
> Passwort brauchst du nicht.
>
> Die Adresse ist **https://tt-tsvfeldkirchen.de** — am Handy am besten gleich zum
> Startbildschirm hinzufügen, dann verhält es sich wie eine App und du bekommst
> Erinnerungen.
>
> Es ist noch nicht alles drin. Sag mir, was nicht funktioniert oder komisch aussieht.

**Wen zuerst:** einen Mannschaftsführer oder Trainer, nicht den ganzen Verein. Wer als
Erster kommt, findet die Fehler — und das soll jemand sein, der es dir sagt, statt es
weiterzuerzählen.

---

## Noch nicht gebaut

Keines davon blockiert; alles nach dem Go-live nachrüstbar.

| | Ersatz bis dahin |
|---|---|
| Dateien am Verein (9.4) | verlinken statt ablegen |
| NuScore-PDF-Import (9.7) | Ergebnisse von Hand eintragen |
| „Anmelden als" (9.10) | Eltern als Kopie-Adresse im Profil des Kindes |
| Schulferien | nur nötig, wenn ein Training „Schulferien überspringen" nutzt |

---

*Der vollständige Weg bis zur Kündigung steht in [`go-live.md`](go-live.md). Diese Datei
ist nur der Ausschnitt bis zur ersten Einladung.*
