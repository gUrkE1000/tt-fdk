# Herkunft und Lizenzstatus

## Ursprung

Der Code in diesem Repository stammt ursprünglich aus dem Projekt
**[dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner)** ("Tischtennis-Spielbereitschafts-Planer").

| | |
|---|---|
| Upstream-Repository | https://github.com/dgaida/tt_hsv_planner |
| Übernommener Stand | Commit `f8ec2a50cfeab2980a01d638e43b9785641fcb72` (Tag-Stand v1.2.5) |
| Übernommen am | 17.09.2026 |
| Art der Übernahme | Git-Merge mit `--allow-unrelated-histories`, Historie vollständig erhalten |

Das Upstream-Repository ist als Remote `upstream` eingetragen:

```bash
git remote add upstream https://github.com/dgaida/tt_hsv_planner.git
git fetch upstream
git log --oneline upstream/main   # Änderungen im Ursprungsprojekt ansehen
git merge upstream/main           # Änderungen übernehmen
```

## Lizenzstatus — ungeklärt

Das Upstream-Repository enthält **kein LICENSE-File**. Ohne Lizenz gilt nach Urheberrecht:
alle Rechte verbleiben beim Autor. Die GitHub-Nutzungsbedingungen (Abschnitt D) räumen für
öffentliche Repositories lediglich das Recht ein, den Code **anzusehen und auf GitHub zu forken** —
sie erlauben ausdrücklich **keine** darüber hinausgehende Nutzung, Veränderung oder Verbreitung.

Daraus folgt für dieses Projekt:

- Interne Weiterentwicklung und Erprobung im Verein: vertretbares Risiko, aber nicht sauber.
- Produktivbetrieb mit Mitgliederdaten oder Veröffentlichung: **erst nach geklärter Lizenz.**
- Dieses Repository sollte bis dahin **privat** bleiben.

## Nächster Schritt: Lizenz anfragen

Der Autor ist über GitHub erreichbar (Issue im Upstream-Repository oder Profilkontakt). Sinnvoll
ist eine kurze, konkrete Anfrage — die meisten Hobbyprojekte haben schlicht vergessen, eine Lizenz
zu setzen. Textvorschlag:

> Hallo, wir sind eine Tischtennisabteilung und suchen eine Alternative zum TT-Planer. Dein
> `tt_hsv_planner` trifft genau unseren Bedarf. Im Repository ist allerdings keine Lizenz
> hinterlegt, sodass wir ihn formal nicht nutzen oder weiterentwickeln dürften. Würdest du eine
> Open-Source-Lizenz (z. B. MIT oder Apache-2.0) ergänzen? Änderungen und Fehlerbehebungen, die
> bei uns entstehen, geben wir gerne als Pull Requests zurück.

**Stand der Anfrage:** offen — noch nicht gestellt.

Sobald eine Lizenz vorliegt: Lizenztext als `LICENSE` ins Repository aufnehmen, diesen Abschnitt
aktualisieren und die Warnung in der [README](README.md) entfernen.

**Der zweite Weg** — die verbliebenen vier Dateien neu schreiben und die Frage damit erledigen —
ist mit Aufwand, Fallstricken und Checkliste in [docs/abschluss.md §3](docs/abschluss.md#3-die-lizenzfrage)
beschrieben. Er hat den Vorteil, dass er ein Datum hat: Auf eine Anfrage muss niemand antworten.

## Was noch aus dem Upstream stammt

Stand 18.09.2026, nach dem vollständigen Umbau des Projekts:

| Datei | Zeilen |
|---|---|
| `supabase/functions/_shared/ics.ts` | 258 |
| `supabase/functions/_shared/homeAway.ts` | 54 |
| `supabase/functions/_shared/lineupOrder.ts` | 53 |
| `src/lib/names.ts` | 45 |
| **Summe** | **410** |

Dazu die zugehörigen Testdateien `tests/shared/{ics,homeAway,lineupOrder}.test.ts` und
`tests/lib/names.test.ts`, deren Fälle aus dem Upstream übernommen und angepasst wurden.

Alles andere in diesem Repository — Datenbankschema, Oberfläche, Benachrichtigungen, Ersatzkette,
Training, Termine, Umfragen, Kalender — ist hier entstanden.

## Eigene Beiträge

Alle Änderungen, die nach dem oben genannten Commit in diesem Repository entstehen, stammen vom
Verein. Sie sind über die Git-Historie ab dem Merge-Commit von den übernommenen Teilen
unterscheidbar.
