# Datenübernahme aus dem TT-Planer

Aufgabe 10.2. Was hier steht, ist der Weg von den Daten im TT-Planer zu denselben Daten im
Vereinsplaner — einmal, an einem Nachmittag, von einer Person mit Admin-Rechten in beiden
Systemen.

> **Voraussetzung:** Die Anwendung läuft und der erste Administrator kann sich anmelden.
> Wie es dahin kommt, steht in [einrichtung.md](einrichtung.md). Dieses Dokument setzt dort
> auf, wo die Anwendung leer ist.

---

## 0. Der Grundgedanke

Es gibt **keinen Gesamtexport** aus dem TT-Planer (Bestandsaufnahme I). Was sich
herausholen lässt, ist eine einzige Excel-Datei: die Mitgliederliste aus *Mitglieder →
Excel Import & Update → Reiter **Update** → Jetzt runterladen*. Alles andere wird
abgeschrieben.

Das klingt nach mehr Arbeit, als es ist. Die Mitgliederliste ist der einzige Datenbestand,
der groß genug ist, dass Abtippen wehtut. Mannschaften, Orte und Trainings sind je eine
Handvoll Einträge, und sie **müssen ohnehin zuerst angelegt werden** — der Mitglieder-Import
ordnet Gruppen und Trainings über ihren Namen zu und überspringt stillschweigend, was er
nicht findet.

Daraus folgt die Reihenfolge der folgenden Abschnitte. Sie ist nicht beliebig.

---

## 1. Reihenfolge

| Schritt | Was | Woher | Aufwand |
|---|---|---|---|
| 1 | Vereinsdaten | abschreiben | 5 min |
| 2 | Orte | abschreiben | 10 min |
| 3 | Gruppen | abschreiben | 5 min |
| 4 | Trainings | abschreiben | 20 min |
| 5 | **Mitglieder** | **Excel-Import** | 30 min |
| 6 | Mannschaften und Webcal-URLs | abschreiben | 20 min |
| 7 | Kader (Stamm/Ersatz) | abschreiben | 20 min |
| 8 | Vereinsrollen (Ämter) | abschreiben | 10 min |
| 9 | Vereinstermine der nächsten Monate | abschreiben | 15 min |
| 10 | Einladungen verschicken | Anwendung | 5 min |

Schritt 5 steht bewusst in der Mitte: Vorher gibt es nichts, dem die Spalten *Gruppen* und
*Trainings* zugeordnet werden könnten; nachher gibt es die Personen, die in Schritt 6–8
gebraucht werden.

---

## 2. Schritt 1–4: Was vor dem Import stehen muss

### Vereinsdaten

TT-Planer: *Verwalten → Verein → Daten*. Hier: **Verein → Daten**.

| TT-Planer | Vereinsplaner | Hinweis |
|---|---|---|
| NAME | Name | |
| WEBSEITE DES VEREINS | Webseite | |
| FACEBOOK / INSTAGRAM / YOUTUBE / WHATSAPP URL | Facebook · Instagram · YouTube · WhatsApp-Kanal | |
| INFORMATIONEN ÜBER DEN VEREIN | Informationen über den Verein | Formatierung neu setzen; der TT-Planer liefert kein HTML zum Kopieren |
| INDIVIDUELLE WILLKOMMENS E-MAIL | Willkommens-E-Mail | Direkt übertragbar |
| VEREINS FAQ (Datei) | — | Als Quicklink unter *Verein → Betrieb* verlinken, wenn die Datei irgendwo liegt |
| LOGO VEREINSSPONSOR | — | Gibt es hier nicht. Wer den Vereinsplaner betreibt, zahlt keinen Jahresbeitrag, der gesponsert werden müsste |

**Vier Felder gibt es hier, die der TT-Planer nicht kennt.** Zwei davon sind keine
Kosmetik:

| Feld | Warum es wichtig ist |
|---|---|
| **Weitere Schreibweisen** | Kommagetrennte Aliasse des Vereinsnamens. **Daran erkennt der Spielimport, welche Spiele Heimspiele sind.** Steht der Verein in click-TT als „TTC Musterstadt 1949" und hier nur als „TTC Musterstadt", gehört die lange Form hier hinein. Fehlt sie, stehen halbe Spielpläne auf auswärts |
| **Bundesland** | Steuert Feiertage und Schulferien in der Trainingsplanung. Ohne die Angabe fällt kein Training aus, das ausfallen müsste |
| Kurzname | Erscheint in engen Ansichten und im Kalender |
| Standardort | Vorbelegung für neue Termine und Trainings — erst nach Schritt 2 setzbar |

Zusätzlich hier, aber nicht dort: **Datenschutzhinweis** und **Impressum** unter *Verein →
Betrieb → Einstellungen*. Beide Adressen gehören vor die erste Einladung eingetragen — die
Registrierungsseite verlinkt sie, und ohne sie verschweigt sie, was mit den Daten passiert
(siehe [datenschutz/](datenschutz/)).

Das Feld **Standardort** bleibt in diesem Schritt leer und wird nach Schritt 2 nachgetragen
— es kann nur einen Ort auswählen, den es schon gibt.

### Orte

TT-Planer: *Verwalten → Halle*. Hier: **Orte & Schlüssel**.

Name, Adresse, PLZ, Stadt abschreiben. „Maximale Anzahl gleichzeitiger Spieltermine" heißt
hier genauso. Zwei Felder sind neu: *Nur Training* und *Training trotz voller Halle
erlaubt*.

**Die Schlüssel kommen hier mit dazu** (Aufgabe 9.1) — im TT-Planer stand nur eine Spalte
„Schlüssel" in der Vereinsübersicht, ohne Nummer und ohne Übergabeverlauf. Wer welchen
Schlüssel hat, ist also abzuschreiben und dann einmal sauber anzulegen. Die Inhaber lassen
sich erst nach Schritt 5 eintragen — vorher gibt es niemanden, dem ein Schlüssel gehören
könnte.

Sobald die Orte stehen, den **Standardort** in den Vereinsdaten nachtragen.

### Gruppen

TT-Planer: *Mitglieder → Reiter Gruppen*. Hier: **Mitglieder → Reiter Gruppen**.

Nur der Name. **Achtung:** Die Schreibweise muss exakt der Spalte *Gruppen* in der
Excel-Datei entsprechen (Groß- und Kleinschreibung ist egal, alles andere nicht). Steht in
der Datei „Hobby " mit Leerzeichen und die Gruppe heißt „Hobby", ordnet der Import
trotzdem zu — Leerraum wird abgeschnitten. Steht dort aber „Hobbygruppe", passiert
nichts, und zwar ohne Fehlermeldung.

### Trainings

TT-Planer: *Training*. Hier: **Trainings**.

| TT-Planer | Vereinsplaner |
|---|---|
| Name | Name |
| Art (Erwachsene/Jugend) | Art |
| Wochentag, Beginn, Ende | Wochentag, Beginn, Ende |
| Ort | Ort (muss aus Schritt 2 existieren) |
| Rhythmus | Rhythmus (wöchentlich / zweiwöchentlich / monatlich) + **Startdatum** |
| Erinnerung X Stunden vorher | Erinnerung |
| Maximale Teilnehmerzahl | Maximale Teilnehmerzahl |
| Offenes Training | Offen für alle |
| — | Statistik sichtbar für (neu, Voreinstellung: nur Administratoren) |

Das **Startdatum** hat im TT-Planer keine Entsprechung. Es legt bei zweiwöchentlichem
Rhythmus fest, welche Woche die „gerade" ist — ohne es ständen die Termine auf der falschen
Woche. Als Startdatum das Datum eines Trainings eintragen, das tatsächlich stattgefunden
hat.

Termine werden **nicht** übernommen: Sie entstehen aus der Regel, und zwar **beim
Speichern** — die Datenbank legt die nächsten Wochen selbst an und lässt Feiertage und
Schulferien dabei heraus. Danach unter *Trainings → Reiter **Termine*** einmal
nachsehen, ob die Termine auf den richtigen Tagen stehen. Stimmt der Rhythmus nicht,
liegt es am Startdatum.

---

## 3. Schritt 5: Der Mitglieder-Import

### Die Datei holen

TT-Planer: *Mitglieder → Excel Import & Update → Reiter **Update** → Jetzt runterladen*.

Nicht der Reiter *Import* — der liefert nur eine leere Vorlage. Der Reiter *Update* liefert
die echten Daten inklusive Rollen, Rängen, Gruppen und Trainings.

### Spalten-Mapping

Der Import hier liest **14 Spalten**. Die Datei des TT-Planers enthält mehr. Was nicht in
der Tabelle steht, wird ignoriert — überzählige Spalten stören nicht, sie müssen nicht
gelöscht werden.

| Spalte im TT-Planer-Export | Spalte hier | Format | Übernahme |
|---|---|---|---|
| VORNAME | `Vorname` | Text | direkt |
| NACHNAME | `Nachname` | Text | direkt |
| E-MAIL | `E-Mail` | Text | direkt, wird kleingeschrieben |
| ROLLE | `Rolle` | Admin · Mannschaftsführer · Trainer · Organisator · Mitglied · Gast | direkt; leer = Mitglied |
| GESCHLECHT | `Geschlecht` | männlich · weiblich · *leer* | direkt |
| GEBURTSTAG | `Geburtstag` | `06.05.1988` | direkt; ISO (`1988-05-06`) und echte Excel-Datumszellen gehen auch |
| TELEFONNUMMER | `Telefonnummer` | Text | direkt |
| HANDYNUMMER | `Handynummer` | Text | direkt |
| MITGLIEDSNUMMER | `Mitgliedsnummer` | Text | direkt |
| QTTR | `QTTR` | Zahl | direkt; Komma wird als Dezimaltrenner akzeptiert |
| ERWACHSENE / DAMEN / SENIOREN … / JUGEND … / MÄDCHEN … | `Rang` | `1.2` | **eine Spalte statt fünfzehn** — siehe unten |
| Kein Mannschaftsspieler | `Kein Mannschaftsspieler` | ja · nein | leer = nein |
| GRUPPEN | `Gruppen` | `Hobby, Jugend` | Zuordnung über den Namen |
| TRAINING | `Trainings` | `"Training 1","Training 2"` | Zuordnung über den Namen; beide Schreibweisen (mit und ohne Anführungszeichen) werden gelesen |
| ANMELDEN ALS FUNKTION | — | | **wird nicht übernommen** — siehe 3.4 |
| SPRACHE | — | | Die Anwendung ist einsprachig deutsch |
| E-MAIL ADRESSE(N) FÜR KOPIE | — | | Steht hier im eigenen Profil unter *Benachrichtigungen*; von jedem selbst zu setzen |
| STATUS | — | | Alle importierten Mitglieder starten als *unbestätigt* |
| Profilfoto | — | | Gibt es hier nicht |

### 3.1 Die Rang-Spalten

Der TT-Planer führt **fünfzehn** Rangspalten, je Altersklasse eine. Der Import hier liest
**eine** Spalte namens `Rang`.

Das ist eine bewusste Entscheidung: Fast jedes Mitglied hat genau einen Rang, und welche
Klasse gemeint ist, ergibt sich aus Geschlecht und Alter. Der Import legt den Wert als
*Erwachsene* ab, bei `Geschlecht = weiblich` als *Damen*.

**Vor dem Hochladen** also in Excel eine Spalte `Rang` anlegen und die belegte Rangspalte
hineinkopieren. Bei einem Verein mit Jugend- und Erwachsenenbetrieb sind das zwei oder drei
Kopieraktionen, keine fünfzehn.

Wer mehrere Ränge pflegt (Erwachsene *und* Senioren 50), trägt den zweiten nach dem Import
am Mitglied nach: *Mitglieder → Zeile anklicken → Reiter **Ränge***. Die Datenbank kann
beliebig viele Ränge je Mitglied; nur die Datei kann es nicht.

### 3.2 Die Datei vorbereiten

1. Spalte `Rang` anlegen und füllen (3.1).
2. Spaltenüberschriften prüfen: Sie müssen **exakt** so heißen wie in der Tabelle oben.
   Die Reihenfolge ist egal, Groß-/Kleinschreibung nicht.
3. Mitglieder, die nicht mitkommen sollen (ausgetretene, Karteileichen), **jetzt löschen**.
   Es ist der einzige bequeme Zeitpunkt.
4. Leere Zeilen stören nicht; sie werden übersprungen.

Am schnellsten geht es, wenn man sich die leere Vorlage hier (*Mitglieder → Excel-Import
und -Update → Reiter Import → Vorlage herunterladen*) daneben legt und die Spalten aus dem
TT-Planer-Export hineinkopiert. Dann stimmen die Überschriften garantiert.

### 3.3 Hochladen

*Mitglieder → Excel-Import und -Update*. Beide Reiter nehmen dieselbe Datei; für den
Erstimport ist der Reiter **Import** der richtige.

Nach dem Hochladen zeigt der Dialog, **was passieren würde**, bevor etwas passiert:

- **Anlegen** — Zeilen, zu denen es hier noch niemanden gibt.
- **Aktualisieren** — Zeilen, die einem vorhandenen Mitglied zugeordnet wurden. Beim
  Erstimport in eine leere Anwendung sollte diese Zahl **0** sein. Ist sie es nicht, hat
  jemand schon von Hand Mitglieder angelegt.
- **Mehrdeutig** — Zeilen, die auf mehrere vorhandene Mitglieder passen. Die werden
  **nicht** angefasst. Kommt vor, wenn zwei Mitglieder gleich heißen und keines eine
  E-Mail-Adresse hat.
- **Probleme** — Zeile, Spalte und Grund, im Klartext. Zeilen mit einem Problem in einer
  Pflichtangabe kommen nicht durch, der Rest schon.

Zugeordnet wird in dieser Reihenfolge: **E-Mail → Mitgliedsnummer → vollständiger Name**.

Der Schalter **„Neue Mitglieder mit E-Mail einladen"** bleibt beim Erstimport am besten
**aus**. Sonst gehen beim Hochladen sofort Einladungen an den gesamten Verein hinaus — und
zwar bevor jemand geprüft hat, ob die Mannschaften stimmen. Einladen kommt in Schritt 10.

### 3.4 „Anmelden als" wird nicht übernommen

Der TT-Planer kennt eine Stellvertretung: Ein Elternteil kann sich als Kind anmelden. Die
Spalte *ANMELDEN ALS FUNKTION* im Export enthält diese Zuordnung.

**Hier gibt es das noch nicht.** Die Funktion hängt an einem Custom Access Token Hook in
Supabase (Aufgabe 9.10) und ist nicht gebaut.

Der Ersatz bis dahin: Eltern tragen ihre Adresse im Profil des Kindes unter
*Benachrichtigungen → Kopie-Adressen* ein. Dann bekommen sie alles mit, was das Kind
bekommt, und können über die Antwortlinks in der E-Mail auch zu- und absagen — ohne
eigenen Zugang. Für den Alltag deckt das den Fall ab, für den die Stellvertretung im
TT-Planer benutzt wurde.

**Die Spalte trotzdem aufheben.** Sie ist die einzige Aufzeichnung darüber, wer für wen
zuständig ist, und wird gebraucht, sobald 9.10 gebaut wird.

---

## 4. Schritt 6–9: Nach dem Import

### Mannschaften und Webcal-URLs

TT-Planer: *Verwalten → Mannschaften*. Hier: **Mannschaften**.

| TT-Planer | Vereinsplaner |
|---|---|
| Name | Name |
| Mannschaftsführer | Mannschaftsführer (Mehrfachauswahl) |
| Anzahl Spieler | Benötigte Spieler |
| Heimspieltag/-zeit, Ort | Heimspieltag, Heimspielzeit, Ort |
| Ankunftszeit Heim/Auswärts | Ankunft Heim / Auswärts (Minuten) |
| Hinweistext Heim/Auswärts | Hinweis Heim / Auswärts |
| **click-TT Kalender-URL** | **Webcal-URL** |
| Altersklasse | Rangart |

**Die Webcal-URL ist der wichtigste Wert dieses ganzen Dokuments.** Sie ist der Grund,
warum Spieltermine automatisch erscheinen (Zielkriterium Z1), und sie kommt nicht aus dem
TT-Planer, sondern aus click-TT: dort beim Spielplan der Mannschaft der Link
*Kalender abonnieren* / *ICS*. Steht sie im TT-Planer bereits hinterlegt, lässt sie sich
dort abschreiben — sonst einmal je Mannschaft aus click-TT holen.

Nach dem Eintragen **einmal von Hand abgleichen**: *Spieltermine → Spiele importieren*.
Erscheinen die Spiele der laufenden Saison, stimmt die Adresse. Danach läuft der Abgleich
täglich von allein; was er dabei getan hat, steht unter *Verein → Betrieb →
Kalenderabgleich*.

### Kader

TT-Planer: *Mannschaften → Mannschaft → STAMM / ERSATZ*. Hier: **Mannschaften →
Mannschaft → Kader**.

**Stammspieler** sind eine Menge — ihre Reihenfolge ergibt sich aus den Rängen, die der
Import mitgebracht hat. Hier ist nur auszuwählen, wer dazugehört.

**Ersatzspieler** sind eine Reihenfolge, und die ist keine Kosmetik: Sie bestimmt, wen die
Ersatzsuche zuerst fragt. Sie wird per Drag & Drop gesetzt und ist die einzige Stelle des
ganzen Umzugs, an der eine Reihenfolge von Hand zu übertragen ist.

### Vereinsrollen (Ämter)

TT-Planer: *Verwalten → Verein → Rollen*. Hier: **Verein → Ämter**.

Name, Beschreibung, Tätigkeiten (eine pro Zeile), Inhaber. Die beiden Checkboxen des
TT-Planers (*Zugriff auf Inventarverwaltung*, *Zugriff auf Bekleidungsverwaltung*) haben
hier keine Entsprechung — beide Module gibt es nicht.

### Vereinstermine und Neuigkeiten

Nur, was in der Zukunft liegt. Vergangene Termine abzuschreiben, hat keinen Nutzen: Die
Rückmeldungen kommen ohnehin nicht mit.

---

## 5. Schritt 10: Einladungen

*Mitglieder → Mitglieder hinzufügen → Per E-Mail einladen*. Mehrere Adressen auf einmal,
jede bekommt einen Anmeldelink. Für Aushang und Weitergabe gibt es daneben
*Registrierungslink und QR-Code* — wer sich darüber anmeldet, landet auf *nicht
freigeschaltet* und muss von einem Administrator durchgelassen werden.

Empfohlene Reihenfolge, damit nicht der ganze Verein gleichzeitig auf eine halb gefüllte
Anwendung trifft:

1. **Administratoren und Mannschaftsführer** zuerst. Sie prüfen Mannschaften, Kader und
   Spieltermine.
2. **Trainer.** Sie prüfen die Trainings und deren Termine.
3. **Alle übrigen**, wenn 1 und 2 nichts mehr melden.

Ein importiertes Mitglied steht so lange auf **unbestätigt**, bis es sich zum ersten Mal
anmeldet. Das ist kein Fehler, sondern die Anzeige dafür, wer noch nicht angekommen ist.

---

## 6. Was bewusst nicht mitkommt

| Was | Warum |
|---|---|
| Vergangene Spiele und Rückmeldungen | Ohne Nutzen und mit Aufwand verbunden. Die Spieltermine der **laufenden** Saison kommen ohnehin frisch aus click-TT |
| Vergangene Trainingsteilnahme | Die Trainingsstatistik beginnt bei null. Nach acht Wochen Parallelbetrieb ist sie aussagekräftig |
| Chat | Gibt es hier nicht — bewusst. WhatsApp ist dafür bereits da und funktioniert |
| Arbeitszeiten und Trainer-Abrechnung | Ausdrücklich außerhalb des Umfangs |
| Bekleidung und Inventar | Module des TT-Planers ohne Entsprechung hier |
| Profilfotos | Kein Bildspeicher, und niemand vermisst sie in einer Mitgliederliste |
| Benachrichtigungs-Einstellungen je Mitglied | Nicht exportierbar. Jeder stellt sie im Profil neu ein; die Voreinstellungen sind brauchbar |

Diese Liste gehört den Mitgliedern gesagt, **bevor** sie sich das erste Mal anmelden.
Sonst sucht jemand seinen Chatverlauf.

---

## 7. Checkliste

Zum Abhaken. Datum und Kürzel, damit später nachvollziehbar ist, wer was geprüft hat.

| # | Schritt | erledigt | Datum | Kürzel |
|---|---|---|---|---|
| 1 | Vereinsdaten eingetragen | ☐ | | |
| 2 | **Bundesland** gesetzt (sonst fallen keine Trainings an Feiertagen aus) | ☐ | | |
| 3 | **Weitere Schreibweisen** gepflegt (sonst stehen Heimspiele auf auswärts) | ☐ | | |
| 4 | Datenschutzhinweis und Impressum verlinkt | ☐ | | |
| 5 | Orte angelegt, danach Standardort in den Vereinsdaten nachgetragen | ☐ | | |
| 6 | Schlüssel und ihre aktuellen Inhaber erfasst | ☐ | | |
| 7 | Gruppen angelegt, Schreibweise mit der Excel-Datei abgeglichen | ☐ | | |
| 8 | Trainings angelegt, Startdatum je Training gesetzt | ☐ | | |
| 9 | Trainingstermine geprüft: richtige Tage, Feiertage/Ferien fehlen | ☐ | | |
| 10 | Mitgliederliste aus dem TT-Planer heruntergeladen (Reiter *Update*) | ☐ | | |
| 11 | Spalte `Rang` angelegt, Überschriften angeglichen, Karteileichen entfernt | ☐ | | |
| 12 | Spalte *Anmelden als* separat aufgehoben | ☐ | | |
| 13 | Import hochgeladen, Vorschau geprüft (Anlegen / Aktualisieren / Mehrdeutig / Probleme) | ☐ | | |
| 14 | Import ausgeführt **ohne** Einladungen | ☐ | | |
| 15 | Stichprobe: 5 Mitglieder mit Rolle, Rang, Gruppen, Trainings verglichen | ☐ | | |
| 16 | Mehrdeutige und fehlgeschlagene Zeilen von Hand nachgetragen | ☐ | | |
| 17 | Mannschaften angelegt, Webcal-URL je Mannschaft eingetragen | ☐ | | |
| 18 | Abgleich einmal ausgelöst; Spieltermine erscheinen, Heim/Auswärts stimmt | ☐ | | |
| 19 | Kader je Mannschaft gepflegt (Stamm; Ersatz in der richtigen Reihenfolge) | ☐ | | |
| 20 | Ämter und Inhaber eingetragen | ☐ | | |
| 21 | Künftige Vereinstermine eingetragen | ☐ | | |
| 22 | Administratoren und Mannschaftsführer eingeladen | ☐ | | |
| 23 | Trainer eingeladen | ☐ | | |
| 24 | Übrige Mitglieder eingeladen | ☐ | | |
| 25 | Mitgliedern gesagt, was nicht mitkommt (Abschnitt 6) | ☐ | | |

---

## 8. Wenn etwas schiefgeht

**Der Import hat Unsinn angelegt.** Die betroffenen Mitglieder unter *Mitglieder* löschen
und die Datei korrigiert erneut hochladen. Solange noch niemand eingeladen wurde, ist das
folgenlos — es hängt nichts an den Datensätzen.

**Der Import hat bestehende Mitglieder überschrieben.** Kann beim Erstimport nicht
passieren (die Zahl unter *Aktualisieren* ist dann 0). Später schon, und dann hilft nur
die Sicherung der Datenbank bei Supabase (*Database → Backups*). Deshalb die Vorschau ernst
nehmen — sie ist der einzige Halt vor dem Schreiben.

Der bequeme Ausweg, wenn nur einzelne Felder falsch sind: dieselbe Datei korrigieren und
über den Reiter *Update* erneut hochladen. Der Import überschreibt dann wieder — diesmal
mit den richtigen Werten.

**Gruppen oder Trainings sind leer geblieben.** Der Name in der Datei passte auf nichts.
Gruppe/Training anlegen oder umbenennen und dieselbe Datei über den Reiter *Update* erneut
hochladen — bestehende Mitglieder werden dabei aktualisiert, nicht verdoppelt.

**Spieltermine erscheinen nicht.** Die Webcal-URL prüfen: Sie muss auf `.ics` zeigen und
ohne Anmeldung abrufbar sein. `webcal://` am Anfang durch `https://` ersetzen. Fehler des
letzten Laufs stehen unter *Verein → Betrieb*.

---

*Der Parallelbetrieb, der hierauf folgt, steht in [parallelbetrieb.md](parallelbetrieb.md).*
