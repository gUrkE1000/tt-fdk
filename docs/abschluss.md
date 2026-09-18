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
GitHub-Nutzungsbedingungen erlauben Ansehen und Forken auf GitHub, sonst nichts. Die
Einzelheiten stehen in [../NOTICE.md](../NOTICE.md).

Praktisch heißt das: **Dieses Repository muss privat bleiben, solange die Frage offen
ist.** Der Betrieb im eigenen Verein ist ein anderes Thema als die Veröffentlichung, aber
sauber ist er auch nicht.

### Was noch übrig ist

Vom ursprünglichen Code sind nach dem Umbau **vier Dateien mit zusammen 410 Zeilen**
übrig:

| Datei | Zeilen | Was sie tut |
|---|---|---|
| `supabase/functions/_shared/ics.ts` | 258 | ICS-Kalenderdateien lesen |
| `supabase/functions/_shared/homeAway.ts` | 54 | Heim oder auswärts aus dem Termintitel erkennen |
| `supabase/functions/_shared/lineupOrder.ts` | 53 | Reihenfolge der Aufstellungskandidaten |
| `src/lib/names.ts` | 45 | Kurznamen, Vornamen, Namensvergleich |

Alles andere — Datenbankschema, Oberfläche, Benachrichtigungen, Ersatzkette, Training,
Termine — ist in diesem Projekt entstanden und über die Git-Historie ab dem Merge-Commit
zweifelsfrei zuzuordnen.

### Zwei Wege

**Weg A — anfragen.** Der Autor ist über GitHub erreichbar. Ein Issue im
Upstream-Repository oder eine Nachricht über das Profil. Textvorschlag steht in
[../NOTICE.md](../NOTICE.md). Die meisten Hobbyprojekte haben schlicht vergessen, eine
Lizenz zu setzen, und ergänzen sie auf Nachfrage binnen Tagen.

- **Dauer:** unbestimmt. Es kann auch nie eine Antwort kommen.
- **Ergebnis bei Erfolg:** Lizenztext als `LICENSE` ins Repository, `NOTICE.md`
  aktualisieren, Warnung in der README entfernen. Die vier Dateien dürfen bleiben.
- **Ergebnis bei Schweigen:** nichts. Keine Antwort ist keine Erlaubnis.

**Weg B — neu schreiben.** 410 Zeilen reiner Funktionen, für die vollständige Tests
existieren. Sie beschreiben das Verhalten so genau, dass eine Neufassung daran zu prüfen
ist, ohne in den alten Code zu sehen.

- **Dauer:** überschaubar.
- **Ergebnis:** die Frage ist erledigt, unabhängig davon, ob je jemand antwortet.
- **Zu beachten:** Auch die zugehörigen **Testdateien** stammen aus dem Upstream
  (`tests/shared/ics.test.ts`, `homeAway.test.ts`, `lineupOrder.test.ts`,
  `tests/lib/names.test.ts`). Eine Neufassung, die nur die Implementierung ersetzt und die
  alten Tests behält, löst das Problem zur Hälfte. Die Testfälle sind mitzuschreiben; die
  *Daten* darin (reale Kalendereinträge, reale Namen) sind Tatsachen und keine Werke.

**Empfehlung: beides, in dieser Reihenfolge.** Weg A kostet zehn Minuten und ist die
höfliche Variante — der Code war nützlich, und das gehört gesagt. Weg B ist der einzige,
der ein Datum hat. Wer nur A geht, wartet unter Umständen dauerhaft; wer nur B geht,
verschweigt eine Herkunft, die ohnehin in der Git-Historie steht.

### Checkliste

| # | Schritt | erledigt | Datum |
|---|---|---|---|
| 1 | Anfrage an den Autor gestellt (Weg A) | ☐ | |
| 2 | Antwort erhalten? *(ja / nein / Lizenz ergänzt)* | ☐ | |
| 3 | Die vier Dateien neu geschrieben (Weg B) | ☐ | |
| 4 | Die vier Testdateien neu geschrieben | ☐ | |
| 5 | `NOTICE.md` auf den neuen Stand gebracht | ☐ | |
| 6 | Eigene Lizenz für dieses Projekt gewählt und als `LICENSE` abgelegt | ☐ | |
| 7 | Entschieden, ob das Repository öffentlich wird | ☐ | |

Schritt 6 ist unabhängig von allem anderen fällig: Auch ein Projekt, das privat bleibt,
braucht eine Aussage darüber, wem es gehört und was ein künftiger Vorstand damit tun darf.
Ohne `LICENSE` erbt der nächste Vorstand dieselbe Unklarheit, die hier gerade aufgeräumt
wird.

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
