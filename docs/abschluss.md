# Kündigung und Abschluss

Aufgabe 10.4. Drei Dinge, die zusammengehören und in dieser Reihenfolge zu erledigen sind:
retten, was nur im TT-Planer liegt — kündigen — die Lizenzfrage klären.

> **Voraussetzung:** Die Entscheidung aus [parallelbetrieb.md](parallelbetrieb.md) §7
> lautet *Kündigen* und ist mit Datum eingetragen.

---

## 1. Zuerst: retten, was nur dort liegt

**Vor** der Kündigung, nicht danach. Nach dem Vertragsende ist der Zugang weg, und was
dann noch fehlt, ist unwiederbringlich. Es gibt keinen Gesamtexport
(Bestandsaufnahme I) — also einzeln:

| Was | Wo im TT-Planer | Warum |
|---|---|---|
| Mitgliederliste | Mitglieder → Excel Import & Update → *Update* → Jetzt runterladen | Die Fassung zum Stichtag. Sie ist der Beleg, dass die Übernahme vollständig war |
| **Spalte *Anmelden als*** | in derselben Datei | Wird für Aufgabe 9.10 gebraucht und existiert sonst nirgends |
| Arbeitszeiten | Arbeitszeiten → Exportieren, **monatsweise** | Kommt hier nicht nach. Wer sie für die Vereinsbuchhaltung braucht, holt sie jetzt |
| Trainer-Abrechnung | Abrechnung → Exportieren, monatsweise | dito |
| Bekleidung | Bekleidung → Übersicht → Excel Export | Wer welche Größe hat und was ausgegeben wurde |
| Trainingsstatistik | Statistiken → Widget Training → Exportieren | Die Historie. Die Statistik hier beginnt bei null |
| Vereins-FAQ (Datei) | Verein → Daten | Liegt sonst nur dort |
| Logo des Vereinssponsors | Verein → Daten | dito |
| Vereinsneuigkeiten | Neuigkeiten, Seite für Seite | Kein Export. Was aufgehoben werden soll, kopieren |
| Chatverläufe | Chat | Kein Export. **Realistisch: geht verloren.** Wer etwas Wichtiges darin hat, holt es jetzt heraus |

Alles in einen Ordner, mit Datum im Namen, und dorthin, wo die Vereinsunterlagen liegen —
nicht in das private Postfach der Person, die die Kündigung schreibt.

Die Chatverläufe sind der Punkt, der den Mitgliedern **vorher** gesagt gehört. Eine Woche
Vorlauf mit einem Satz („Ab dem [Datum] ist der TT-Planer weg, der Chat darin auch") ist
der Unterschied zwischen einem geordneten Ende und drei verärgerten Leuten.

### Löschung verlangen

Nach Art. 17 DSGVO ist der Anbieter zur Löschung verpflichtet, sobald der Zweck entfällt.
Das passiert nicht automatisch, sondern auf Verlangen. In die Kündigung gehört deshalb der
Satz:

> Wir bitten um Bestätigung, dass sämtliche personenbezogenen Daten unseres Vereins nach
> Vertragsende gelöscht werden, und um Mitteilung des Löschzeitpunkts.

Die Antwort darauf gehört zu den Vereinsunterlagen. Sie ist der Nachweis, dass die
Mitgliederdaten dort nicht liegen geblieben sind.

---

## 2. Kündigen

**Die Frist zuerst nachsehen.** Der TT-Planer läuft auf Jahresvertrag
(Bestandsaufnahme I: *„Bei der Buchung wird ein Jahresvertrag abgeschlossen"*). Eine
versäumte Frist kostet weitere zwölf Monate — bei Champion 180 € zuzüglich Umsatzsteuer.

Zu klären, **bevor** der Parallelbetrieb überhaupt beginnt, nicht erst jetzt:

| Frage | Antwort | geprüft am |
|---|---|---|
| Vertragsbeginn | | |
| Vertragsende | | |
| Kündigungsfrist | | |
| Letzter möglicher Kündigungstag | | |
| Form (E-Mail genügt? Textform? Schriftform?) | | |
| Anschrift / Adresse für die Kündigung | | |

Steht in den AGB, die im Buchungsformular verlinkt sind, und in der Auftragsbestätigung.

### Checkliste

| # | Schritt | erledigt | Datum |
|---|---|---|---|
| 1 | Alle Exporte aus Abschnitt 1 gezogen und abgelegt | ☐ | |
| 2 | Mitgliedern angekündigt, dass der Chat verschwindet | ☐ | |
| 3 | Kündigungsfrist geprüft, letzter Tag notiert | ☐ | |
| 4 | Kündigung abgeschickt, in der geforderten Form | ☐ | |
| 5 | Löschung der Daten verlangt (Abschnitt 1) | ☐ | |
| 6 | **Eingangsbestätigung erhalten** | ☐ | |
| 7 | Bestätigung des Vertragsendes erhalten, mit Datum | ☐ | |
| 8 | Löschbestätigung erhalten | ☐ | |
| 9 | Alles bei den Vereinsunterlagen abgelegt | ☐ | |
| 10 | Zahlungsweg beendet (SEPA-Mandat, Dauerauftrag) | ☐ | |

Schritt 6 ist kein Formalismus: Ohne Bestätigung ist eine Kündigung im Streitfall nicht
zugegangen.

---

## 3. Die Lizenzfrage

### Der Stand

Dieses Projekt begann als Fork von
[dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner). Das Repository dort
enthält **kein LICENSE-File**. Ohne Lizenz verbleiben alle Rechte beim Autor; die
GitHub-Nutzungsbedingungen erlauben Ansehen und Forken auf GitHub, sonst nichts.

**Der Teil, der blockierte, ist erledigt.** Am 18.09.2026 wurden die vier zuletzt
verbliebenen Dateien samt ihren Tests neu geschrieben — 410 Zeilen, deren Verhalten die
Tests so genau beschrieben, dass die Neufassung daran zu prüfen war. Seitdem enthält
dieses Repository keinen Code aus dem Upstream mehr. Die Einzelheiten, einschließlich der
drei Fehler, die dabei auffielen, stehen in [../NOTICE.md](../NOTICE.md).

### Was noch aussteht

**Die Anfrage an den Autor.** Sie ist nicht mehr nötig, aber angemessen — der Code war der
Ausgangspunkt dieses Projekts. Ein Issue im Upstream-Repository oder eine Nachricht über
das GitHub-Profil; der Textvorschlag steht in [../NOTICE.md](../NOTICE.md). Das kann nur
der Verein tun, und es kostet zehn Minuten.

**Eine eigene Lizenz.** Die ist unabhängig von allem anderen fällig. Auch ein Projekt, das
privat bleibt, braucht eine Aussage darüber, wem es gehört und was ein künftiger Vorstand
damit tun darf. Ohne `LICENSE` erbt der nächste Vorstand genau die Unklarheit, die hier
gerade aufgeräumt wurde.

Zur Auswahl, wenn der Verein das Projekt später weitergeben will:

| Lizenz | Bedeutet |
|---|---|
| **MIT** | Jeder darf alles, solange der Urhebervermerk erhalten bleibt. Die übliche Wahl für so etwas |
| **Apache-2.0** | Wie MIT, zusätzlich eine ausdrückliche Patentklausel und eine Pflicht, Änderungen zu kennzeichnen |
| **AGPL-3.0** | Wer die Anwendung betreibt, muss seinen Quelltext offenlegen. Sinnvoll, wenn kein Anbieter daraus ein bezahltes Produkt machen soll |
| *keine* | Bleibt privat, niemand außer dem Verein darf etwas damit tun — auch kein anderer Verein |

### Die Git-Historie — der Punkt, den das Neuschreiben nicht löst

Die Übernahme lief als `git merge --allow-unrelated-histories`. Das heißt: Der
**vollständige ursprüngliche Quelltext liegt weiterhin in diesem Repository**, nämlich in
den Commits davor.

```
169 Commits   Upstream, bis 17.09.2026
 33 Commits   eigene, seither
```

Ein `git checkout` auf einen alten Commit fördert `AdminDashboard.tsx`,
`SportwartView.tsx` und die ganze alte Oberfläche wieder zutage. Dateien neu zu schreiben
ändert daran nichts — Git vergisst nicht.

**Solange das Repository privat ist, ist das kein Problem.** Es wird nichts verbreitet, und
genau darum geht es beim Urheberrecht. Beim Umschalten auf öffentlich würden die 169
Commits jedoch mitveröffentlicht — also genau das, was ohne Lizenz nicht erlaubt ist.

Drei Wege, falls es je so weit kommt:

| Weg | Was passiert | Preis |
|---|---|---|
| **Neue Wurzel ohne Vorgeschichte** (`git checkout --orphan`) | Ein einziger Commit mit dem heutigen Stand | Auch die eigenen 33 Commits sind weg — mit ihnen die Begründungen, die das Projekt in zwei Jahren wartbar machen |
| **Die eigenen 33 Commits auf eine neue Wurzel setzen** | Vorgeschichte weg, eigene Entwicklung bleibt lesbar | Fummelig, aber einmalig. **Der empfohlene Weg** |
| **Altes Repository privat als Archiv behalten**, neues öffentliches daneben | Nichts geht verloren | Zwei Repositories, von denen eines nie wieder angefasst wird |

### Die Entscheidung über die Veröffentlichung

Sie hängt jetzt nur noch am Verein, nicht mehr an einer fremden Rechtslage. Dafür spricht,
dass andere Vereine vor demselben Problem stehen und 80 €/Jahr statt 180 € ein Argument
sind. Dagegen spricht nichts Rechtliches mehr — wohl aber, dass ein öffentliches
Repository Fragen von Fremden nach sich zieht, die jemand beantworten muss, und dass die
Historie vorher zu bereinigen ist.

**Für den Betrieb im eigenen Verein ist nichts davon nötig.** Das Repository kann privat
bleiben, und dann ist die Sache mit dem Neuschreiben der vier Dateien erledigt.

### Checkliste

| # | Schritt | erledigt | Datum |
|---|---|---|---|
| 1 | ~~Die vier Dateien neu geschrieben~~ | ☑ | 18.09.2026 |
| 2 | ~~Die zugehörigen Testdateien neu geschrieben~~ | ☑ | 18.09.2026 |
| 3 | ~~`NOTICE.md` und README auf den neuen Stand gebracht~~ | ☑ | 18.09.2026 |
| 4 | Anfrage an den Autor gestellt | ☐ | |
| 5 | Eigene Lizenz gewählt und als `LICENSE` abgelegt | ☐ | |
| 6 | Entschieden, ob das Repository öffentlich wird | ☐ | |
| 7 | *Nur bei „öffentlich":* Git-Historie bereinigt | ☐ | |

---

## 4. Release v1.0.0

Erst wenn Abschnitt 2 und 3 abgehakt sind. Ein Tag auf einem Stand, dessen Rechtslage
unklar ist, macht die Unklarheit dauerhaft zitierbar.

```bash
git tag -a v1.0.0 -m "Vereinsplaner 1.0.0 — ersetzt den TT-Planer"
git push origin v1.0.0
```

Was in die Release-Notiz gehört — und zwar beides:

**Was die Anwendung kann.** Die elf Kriterien aus [zielbild.md](zielbild.md) §1.2, mit dem
Datum ihrer Abnahme aus [parallelbetrieb.md](parallelbetrieb.md) §3.

**Was sie nicht kann.** Vollständig, an einer Stelle, damit niemand danach sucht:

| Fehlt | Grund |
|---|---|
| Stundenabrechnung / Arbeitszeiten | ausdrücklich außerhalb des Umfangs |
| Chat | bewusst nicht gebaut — WhatsApp ist da und funktioniert |
| Bekleidung, Inventar | Module ohne Entsprechung |
| Mehrsprachigkeit | die Anwendung ist deutsch |
| Profilfotos | kein Bildspeicher |
| „Anmelden als" (Stellvertretung) | Aufgabe 9.10, nicht gebaut. Ersatz: Kopie-Adressen |
| NuScore-PDF-Import | Aufgabe 9.7, nicht gebaut |
| Dateien am Verein | Aufgabe 9.4, nicht gebaut |

Die drei letzten Zeilen sind kein Verzicht, sondern eine Reihenfolge: Sie hängen an einem
eingerichteten Supabase-Projekt und sind nach dem Go-live nachrüstbar.

### Danach

Der laufende Betrieb steht in [betrieb.md](betrieb.md): was täglich, wöchentlich und
jährlich zu tun ist, und woran man merkt, dass etwas klemmt.

Eine Sache gehört in den Kalender des Vorstands, nicht in eine Datei: **einmal jährlich**
die Datenschutzunterlagen in [datenschutz/](datenschutz/) durchsehen. Sie sind Entwürfe
mit Platzhaltern, und Entwürfe veralten schneller als Code.
