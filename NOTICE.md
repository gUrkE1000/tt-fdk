# Herkunft und Lizenzstatus

## Kurzfassung

Dieses Projekt begann als Fork von **[dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner)**,
dessen Repository keine Lizenz führt. **Seit dem 18.09.2026 ist kein Code aus dem Upstream mehr
enthalten.** Die vier zuletzt verbliebenen Dateien wurden neu geschrieben, ihre Tests ebenso.

Die Historie des Upstreams steckt weiterhin in diesem Git-Repository — als Vorgeschichte, nicht
als Code. Was daraus folgt, steht unter [Was noch offen ist](#was-noch-offen-ist).

## Ursprung

| | |
|---|---|
| Upstream-Repository | https://github.com/dgaida/tt_hsv_planner |
| Übernommener Stand | Commit `f8ec2a50cfeab2980a01d638e43b9785641fcb72` (Tag-Stand v1.2.5) |
| Übernommen am | 17.09.2026 |
| Art der Übernahme | Git-Merge mit `--allow-unrelated-histories`, Historie vollständig erhalten |
| Letzter Upstream-Code ersetzt am | 18.09.2026 |

Das Upstream-Repository ist als Remote `upstream` eingetragen:

```bash
git remote add upstream https://github.com/dgaida/tt_hsv_planner.git
git fetch upstream
git log --oneline upstream/main   # Änderungen im Ursprungsprojekt ansehen
```

`git merge upstream/main` steht hier bewusst **nicht** mehr: Ein Merge holte genau das zurück,
was gerade ausgeräumt wurde.

## Warum die Lizenz ein Problem war

Das Upstream-Repository enthält **kein LICENSE-File**. Ohne Lizenz gilt nach Urheberrecht: alle
Rechte verbleiben beim Autor. Die GitHub-Nutzungsbedingungen (Abschnitt D) räumen für öffentliche
Repositories lediglich das Recht ein, den Code **anzusehen und auf GitHub zu forken** — sie
erlauben ausdrücklich **keine** darüber hinausgehende Nutzung, Veränderung oder Verbreitung.

Das betraf zuletzt vier Dateien mit zusammen 410 Zeilen. Wenige genug, um sie neu zu schreiben,
und zu viele, um sie zu übersehen.

## Was ersetzt wurde

Am 18.09.2026, jeweils Implementierung **und** Tests:

| Datei | Was sie tut |
|---|---|
| `supabase/functions/_shared/ics.ts` | iCalendar lesen und schreiben |
| `supabase/functions/_shared/homeAway.ts` | Heim oder auswärts aus dem Termintitel |
| `supabase/functions/_shared/lineupOrder.ts` | Reihenfolge der Aufstellungsvorschläge |
| `src/lib/names.ts` | Namen kürzen und vergleichen |
| `tests/shared/{ics,icsBuild,homeAway,lineupOrder,realCalendar}.test.ts` | die Fälle dazu |
| `tests/lib/names.test.ts` | dito |

Die Schnittstellen sind dieselben geblieben, weil das Projekt an ihnen hängt. Neu sind der Aufbau,
die Zerlegung, die Begründungen und die Testfälle. Drei Dinge fielen dabei ab, die vorher nicht
stimmten:

1. **Semikolons wurden in ICS nicht maskiert.** `'\;'` ist in JavaScript dasselbe wie `';'` — die
   Maskierung stand da, tat aber nichts. Ein Ort wie „Vereinsheim; Nebenraum" brach damit die Zeile.
2. **Zeilen wurden nach Zeichen gefaltet statt nach Oktett.** RFC 5545 zählt Oktett. Mit Umlauten
   im Hallennamen liefen die Zeilen über die Grenze.
3. **Ein unlesbares DTSTART wurde zu „jetzt".** Daraus entstand ein Termin, der wie ein echter
   aussah. Jetzt wird der Eintrag übergangen.

Die Testdaten aus realen Kalendern eines fremden Vereins sind dabei durch erfundene ersetzt worden.

## Was noch offen ist

**Die Anfrage an den Autor ist weiterhin nicht gestellt.** Sie ist nach dem Neuschreiben nicht
mehr nötig, aber angemessen: Der Code war der Ausgangspunkt dieses Projekts, und das gehört gesagt.
Textvorschlag:

> Hallo, wir sind eine Tischtennisabteilung und haben auf Basis deines `tt_hsv_planner` eine eigene
> Anwendung gebaut. Weil im Repository keine Lizenz hinterlegt ist, haben wir die letzten
> übernommenen Dateien inzwischen neu geschrieben — es steckt also kein Code von dir mehr darin.
> Falls du magst, ergänze gern eine Open-Source-Lizenz (z. B. MIT oder Apache-2.0); dann könnten
> andere Vereine deinen Stand direkt nutzen, statt denselben Umweg zu gehen.

**Stand der Anfrage:** offen — noch nicht gestellt.

**Eine eigene Lizenz fehlt ebenfalls.** Ohne `LICENSE` erbt der nächste Vorstand dieselbe
Unklarheit, die hier gerade aufgeräumt wurde. Die Entscheidung — und die Frage, ob das Repository
öffentlich wird — steht mit Checkliste in
[docs/abschluss.md §3](docs/abschluss.md#3-die-lizenzfrage).

## Eigene Beiträge

Alles in diesem Repository stammt vom Verein. Die Git-Historie ab dem Merge-Commit weist es nach;
die Commits vom 18.09.2026 weisen nach, wann der letzte Rest ersetzt wurde.
