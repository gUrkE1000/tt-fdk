# Konzept: Suche

Stand: 29.09.2026 · Status: **gebaut** (alle Stufen aus Abschnitt 6.3) · Grundlage: Rechte
aus [zielbild.md](zielbild.md) Abschnitt 5 und der Stand der Migrationen bis
`20261115000000_search.sql`.

Vorher gab es nur Filterfelder auf einzelnen Seiten (Mitglieder in *Mein Verein*,
Spieltermine, Vereinstermine), jede mit eigenem `includes()` im Browser. Dieses Dokument
beschreibt die **eine** Suche über die ganze App: was sie findet, wie sie die Rechte des
Mitglieds einhält und mit welcher Technik sie die besten Treffer liefert. Wo die
Umsetzung vom ersten Entwurf abweicht, steht es in Abschnitt 8.

---

## 1. Kurzfassung

| Frage | Entscheidung |
|---|---|
| Wo? | Ein Suchfeld in der Kopfzeile (Desktop), Lupe in der Kopfzeile (Mobil), Tastatur `Strg/⌘ K` und `/`. Sofortliste beim Tippen, volle Ergebnisseite unter `/search?q=…`. |
| Was? | Seiten & Aktionen, Mitglieder, Mannschaften, Spiele, Trainings und Trainingstermine, Vereinstermine, Umfragen, Neuigkeiten, Orte, Ämter. Später: Nachrichten am Termin, eigene Mitteilungen. |
| Rechte? | **Keine eigene Rechtelogik.** Die Suche läuft als `SECURITY INVOKER`-Funktion `rpc_search` in Postgres und liest dieselben Tabellen und Views wie die Seiten — RLS und Spaltenmaskierung greifen von selbst. Gesucht wird nur in Feldern, die das Mitglied auch *sehen* darf. |
| Technik? | Postgres-Volltext ohne Zusatzdienst: **Normalisierung** (Umlaute, ß, Groß/klein) → **Präfixsuche** je Wort → **Trigramm-Ähnlichkeit** (`pg_trgm`) für Tippfehler → **deutsche Volltextsuche** (`tsvector 'german'`) nur für Fließtext. Dazu **Datums- und Mannschaftserkennung** in der Eingabe und eine **persönliche Gewichtung** (eigene Mannschaft, bald stattfindend). |
| Nicht? | Keine KI-/Vektorsuche, kein externer Suchdienst (Algolia, Meilisearch), kein eigener Suchindex mit kopierten Rechten. Begründung in Abschnitt 5.4. |

---

## 2. Was die Suche können muss

### 2.1 Was gefunden wird

Je Art: in welchen Feldern gesucht wird, was die Trefferzeile zeigt, wohin der Klick führt.

| Art | Gesucht in | Trefferzeile | Ziel |
|---|---|---|---|
| **Seiten & Aktionen** | Menüname, Reitername, Synonyme (Abschnitt 2.3) | „Abwesenheit eintragen · Mein Profil" | Route, ggf. mit Reiter (`/profile?tab=absences`) |
| **Mitglieder** | Vor- und Nachname, Amt; Admin zusätzlich E-Mail, Mitgliedsnummer | Name · Rolle · Mannschaften · Kontakt (nur bei Freigabe) | Mitgliedskarte in *Mein Verein*; Admin: Mitgliederverwaltung |
| **Mannschaften** | Name, Kürzel („H2", „2. Herren"), Liga, Mannschaftsführer | Name · Liga · MF | `/my-club` Reiter Mannschaften bzw. `/teams` für Admin/MF |
| **Spiele** | Gegner, Mannschaft, Liga, Ort, Spieltag, Datum, Heim/Auswärts | Datum · Uhrzeit · Mannschaft vs. Gegner · HEIM/AUSWÄRTS · eigener Status | `/match/:id` |
| **Trainings** | Name, Wochentag, Ort, Trainer | „Erwachsene · Di 19:30 · Halle Süd" | nächster Termin `/training/:sessionId` |
| **Trainingstermine** | wie Trainings + Datum, Ausfallgrund | Datum · Name · „fällt aus" | `/training/:sessionId` |
| **Vereinstermine** | Name, Adresse, Beschreibung (Text aus HTML) | Datum · Name · Anmeldefrist | `/event/:id` |
| **Umfragen** | Titel, Details, Antwortoptionen | Titel · läuft bis · „abgestimmt" | `/votes` (Umfrage aufgeklappt) |
| **Neuigkeiten** | Titel, Text | Titel · Datum · „Entwurf" (nur Organisator/Admin) | `/my-club` Reiter Neuigkeiten |
| **Orte** | Name, Straße, PLZ, Ort | Name · Adresse · „Route" | Ort mit Kartenlink |
| **Ämter** | Amtsname, Beschreibung, Tätigkeiten | „Kassenwart: Erika Muster" | Rollen & Kontaktdaten |
| *Stufe 2:* **Nachrichten am Termin** | Text | Auszug · Verfasser · an welchem Termin | Termin, Nachricht angesprungen |
| *Stufe 2:* **Eigene Mitteilungen** | Betreff, Text | Betreff · Datum | `/notifications` |

**Bewusst nicht in der globalen Suche**, auch nicht für den Admin: Benachrichtigungs-
protokoll, Sync-Läufe, Prüfprotokoll (`match_changes`). Die haben eigene Seiten mit
eigenen Filtern; in der Mitgliedersuche wären sie Rauschen.

### 2.2 Wie gesucht wird

1. **Sofortliste beim Tippen** ab 2 Zeichen, 150 ms Entprellung, je Art höchstens 5
   Treffer, gruppiert (Seiten zuerst, dann nach Relevanz). „Alle Treffer anzeigen" führt
   auf `/search?q=…`.
2. **Ergebnisseite** `/search` mit Filterchips: *Art* (Personen, Spiele, …) und *Zeit*
   (kommend / vergangen / alle). Die URL enthält Suche und Filter — teilbar und mit
   „Zurück" erreichbar.
3. **Tippfehler- und Schreibweisen-tolerant**: „Müller" = „Mueller" = „muller";
   „Meier" findet „Mayer" und „Maier" (weiter unten gerankt); „Straße" = „Strasse".
4. **Wortanfänge statt Wortmitte**: „mei" findet „Meister**schaft**" und „**Mei**er",
   aber nicht „Ge**mei**nde" — das ist, was Menschen bei Namen erwarten. Wortmitte nur
   über die Tippfehlerstufe und dann weit unten.
5. **Mehrere Wörter = alle müssen passen**, in beliebiger Reihenfolge und über Felder
   hinweg: „H2 Borussia" findet das Spiel der 2. Herren gegen Borussia; „Erika Kasse"
   findet die Kassenwartin.
6. **Datum und Zeit verstehen** (Abschnitt 5.3): „12.10.", „12.10.2026", „Samstag",
   „morgen", „nächste Woche", „Oktober" werden zu einem Zeitraumfilter, der Rest des
   Textes bleibt Suchtext. „Samstag Borussia" = Spiel gegen Borussia an einem Samstag.
7. **Kürzel verstehen**: „H2", „D1", „J1" usw. = Mannschaft; „heim"/„auswärts" = Filter.
8. **Treffer hervorheben** (fett), und zwar nur im angezeigten Feld.
9. **Zuletzt gesucht / zuletzt geöffnet**, solange das Feld leer ist — nur auf dem Gerät,
   je Benutzer, beim Abmelden gelöscht (wie `queryPersist`).
10. **Leer-Zustand mit Hilfe**: „Nichts gefunden für ‚Xyz'. Tipp: nur den Nachnamen
    eingeben." — ohne Hinweis darauf, dass es Treffer gäbe, die man nicht sehen darf
    (Abschnitt 4.4).
11. **Offline**: Ohne Netz sucht die App im gespeicherten Stand auf dem Gerät (Mitglieder,
    Mannschaften, eigene Termine) und sagt das über der Liste („Offline — Suche im Stand
    von 18:42").
12. **Bedienbarkeit**: Combobox-Muster nach WAI-ARIA (Pfeiltasten, Enter, Esc), Fokus
    zurück ins Feld nach Schließen, Treffer mit Art-Symbol *und* Text (nicht nur Farbe),
    Touchziele ≥ 44 px, auf dem Handy Vollbild-Overlay mit Tastatur sofort offen.

### 2.3 Synonyme für Seiten und Aktionen

Kleine, feste Liste im Frontend (`src/features/search/synonyms.ts`), weil Mitglieder in
ihren Worten suchen, nicht in unseren Menünamen:

| Eingabe | findet |
|---|---|
| Urlaub, Verreist, nicht da, krank | Abwesenheit eintragen |
| Push, Mail, Benachrichtigung, Erinnerung | Mein Profil → Benachrichtigungen |
| Kalender Handy, ICS, abonnieren, Outlook, Google | Kalender abonnieren |
| Schlüssel, aufschließen | Orte & Schlüsseldienst (Admin) bzw. Trainingstermin |
| Aufstellung, Ersatz, Spieler anfragen | Spieltermine / Meine Spiele (je nach Rolle) |
| Konto löschen, Datenschutz, Export | Mein Profil → Datenschutz |
| Code, PIN, nuScore | Spieltermine → Codes & PINs (Admin/MF) |

Welche Einträge ein Mitglied sieht, entscheidet `visibleNav(role)` aus
[`src/app/nav.ts`](../src/app/nav.ts) — dieselbe Liste wie das Menü.

### 2.4 Treffer mit Kontext statt nackter Titel

Die Trefferzeile beantwortet die häufigste Folgefrage gleich mit:

- **Spiel**: eigener Status als Badge (zugesagt / offen / abgesagt), Aufstellung „3/4".
- **Mitglied**: Mannschaften; bei Freigabe Telefon als tippbarer Link.
- **Training**: nächster Termin und eigene Rückmeldung.
- **Umfrage**: „noch nicht abgestimmt".

Schnellaktionen direkt in der Zeile (nur, wenn die Rolle sie hergibt, Abschnitt 4.5):
Zusage/Absage beim Spiel, „Spieler verwalten" für den Mannschaftsführer.

---

## 3. Wie die Suche aufgebaut ist

```
Kopfzeile: <SearchBox>  ──tippt──►  useSearch(q)  ──rpc──►  public.rpc_search(q, kinds, …)
   │                                    │                         │  SECURITY INVOKER
   │                                    │                         │  liest Tabellen/Views
   │                                    │                         ▼  → RLS greift
   │                                    ├── lokale Treffer: Seiten & Aktionen (nav.ts + Synonyme)
   │                                    └── offline: gespeicherter react-query-Stand
   ▼
Sofortliste (gruppiert)  ──Enter/„Alle"──►  /search?q=…&kind=…&time=…
```

- **Frontend**: Feature `src/features/search/` mit `api.ts` (react-query, Schlüssel
  `['search', …]`, *nicht* persistiert, Mischen und Offline-Rückfall), `SearchDialog.tsx`,
  `SearchPage.tsx`, `parseQuery.ts` (Zeitangaben, rein und testbar), `pages.ts`
  (Seiten, Aktionen, Synonyme), `HitRow.tsx`, `recent.ts`.
- **Datenbank**: eine Migration `…_search.sql` mit Erweiterungen, Normalisierungs-
  funktion, Phonetik, Bewertung, zwei Trigramm-Indizes und der Funktion `public.rpc_search`.
- **Keine Edge Function**, kein neuer Dienst, keine Kosten.

---

## 4. Rechte: wie die Suche sie widerspiegelt

### 4.1 Der Grundsatz

> **Die Suche findet genau das, was das Mitglied auf den Seiten auch sehen würde — nicht
> mehr und nicht weniger. Sie hat dafür keine eigene Regel.**

Das folgt dem Grundsatz aus [datenbank.md](datenbank.md): *„Die Datenbank erzwingt die
Rechte, nicht das Frontend."* und der Begründung bei `object_messages`: *„Eine eigene
Regel wäre eine zweite Wahrheit, die irgendwann von der ersten abweicht."*

Deshalb ist `public.rpc_search` **`SECURITY INVOKER`**: Sie läuft mit den Rechten des
Aufrufers, jede Abfrage darin geht durch dieselben Policies und Views wie die Seiten.
Ändert sich eine Policy (wie zuletzt `can_see_match` ↔ `is_playing_member`), ändert sich
die Suche mit — ohne dass jemand an sie denken muss.

### 4.2 Drei Ebenen, an denen Rechte greifen

**1. Zeilen — wer welchen Datensatz sieht (RLS).** Ergibt sich automatisch:

| Art | Regel, die greift | Folge für die Suche |
|---|---|---|
| Mitglieder | `v_members_directory` (Gast: nur Admins/Trainer; Gelöschte nie) | Gast findet keine Mitspieler; niemand findet gelöschte Konten |
| Mannschaften, Spiele | `is_playing_member()` | Gäste finden weder Mannschaften noch Spiele |
| Trainings, Termine | `trainings_select`, `can_see_training()` | Gast findet nur offene und eigene Trainings |
| Umfragen | `is_organizer_or_admin() OR is_poll_target()` | Nur Umfragen an die eigene Mannschaft/Gruppe/den Verein |
| Neuigkeiten | `published_at <= now() OR is_organizer_or_admin()` | Entwürfe nur für Organisator/Admin, mit Badge „Entwurf" |
| Nachrichten am Termin | `can_see_message_object()` | Nur an Terminen, die man sieht |
| Mitteilungen | `profile_id = auth.uid()` | Nur die eigenen (auch der Admin sucht hier nur seine) |

**2. Spalten — in welchem Feld gesucht wird.** Das ist die Stelle, an der Suchen
gefährlicher ist als Anzeigen. Eine Suche, die in einem verborgenen Feld sucht, aber es
nicht anzeigt, verrät es trotzdem: Wer „0171 23" eingibt und *Max Muster* als Treffer
bekommt, kennt jetzt Max' Handynummer, obwohl Max sie nicht freigegeben hat. Regeln:

- Gesucht wird **nur in Feldern, die der Aufrufer lesen darf**. Für Mitglieder heißt das:
  Vor- und Nachname, Amt. E-Mail und Telefon sind für Nicht-Admins **kein Suchfeld**,
  auch bei Freigabe nicht — sie werden angezeigt (aus `v_members_directory`, dort
  maskiert), aber nicht rückwärts durchsucht (Abschnitt 7, Punkt 4). Der Admin sucht
  zusätzlich in E-Mail und Mitgliedsnummer.
- **Nie durchsucht**, für niemanden außer dem Mitglied selbst: `absences.comment_private`.
  Für alle anderen gar nicht: Geburtstag bei `hide_birthday`, `emails_copies`,
  Benachrichtigungseinstellungen, `action_tokens`, `club_settings` mit `secret_`.
- **Mitgliedsnummer** ist zwar spaltenweise für alle lesbar, als Suchfeld aber nur für
  den Admin — niemand außer der Verwaltung sucht danach (Datensparsamkeit,
  [datenschutz/](datenschutz/)).
- **QTTR** ist kein Suchfeld (Zahlen im Suchtext würden bei Datumseingaben dazwischenfunken).

**3. Ableitungen — was man aus Treffern schließen könnte.** Die subtilste Ebene:

- **Inkognito-Trainings**: Eine Personensuche darf nie „Max ist im Training X"
  ergeben. Beziehungen Person → Training kommen nur aus Tabellen, die
  `may_see_training_roster()` schon filtern (`training_members`,
  `training_attendance`) — also nur dort, wo auch die Teilnehmerliste sichtbar ist.
- **Umfragen mit `hide_results`**: Suche nach einer Person liefert nie „hat für Option B
  gestimmt". Stimmen werden überhaupt nicht durchsucht.
- **Ersatzanfragen und Angebote** (`substitute_requests`, `match_offers`) sind nicht
  durchsuchbar; sie sind nur an der Spielkarte für Beteiligte sichtbar.
- **Abwesenheiten** sind kein Suchziel. Wer „Urlaub" sucht, landet auf *Abwesenheit
  eintragen*, nicht bei fremden Zeiträumen.

### 4.3 Umsetzung im SQL

- `public.rpc_search` ist `LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public,
  pg_temp`, `GRANT EXECUTE … TO authenticated`, `REVOKE … FROM anon`.
- Sie liest **Views statt Tabellen**, wo es Views mit Maskierung gibt
  (`v_members_directory`, `v_news`). Die E-Mail für die Admin-Suche kommt nur aus einem
  Zweig, der mit `is_admin()` beginnt.
- Die Suchbedingungen (`ILIKE`, `%`, `@@`) sind nicht `LEAKPROOF`; Postgres wertet sie
  deshalb *nach* den RLS-Bedingungen aus. Eine Zeile, die man nicht sehen darf, kommt
  also gar nicht erst beim Vergleich an.
- Generierte Suchspalten (`search_text`) enthalten **nur Felder, die für jeden, der die
  Zeile sieht, auch lesbar sind** — bei `profiles` also nur Vor- und Nachname. Kontakt-
  felder werden zur Laufzeit aus der maskierten View angehängt, nicht vorab in eine
  Spalte gepackt.
- **Kein Zusatzindex mit kopierten Rechten** (etwa eine Tabelle `search_documents` mit
  Spalte `visible_to_roles`). Genau das wäre die zweite Wahrheit.

### 4.4 Nichts verraten, auch nicht indirekt

- **Keine Zähler über Verborgenes** („3 weitere Treffer, für die dir die Rechte fehlen").
- **Gleiche Antwort** für „gibt es nicht" und „darfst du nicht sehen": leere Liste.
- **Ranking nur aus sichtbaren Daten**: Die persönliche Gewichtung (Abschnitt 5.2) nutzt
  eigene Beziehungen (eigene Mannschaft, eigene Zusage) — nie Daten anderer.
- **Kein Suchprotokoll auf dem Server.** Suchbegriffe sind personenbezogene Daten und
  können viel verraten („Abmeldung", ein Name). Nur „zuletzt gesucht" lokal auf dem
  Gerät, beim Abmelden gelöscht. Wenn später Auswertung gewünscht ist: nur Zähler
  „Suche ohne Treffer" ohne Benutzer und ohne Begriff.

### 4.5 Rechte in der Oberfläche (Bequemlichkeit, nicht Grenze)

Was die Trefferzeile *anbietet*, richtet sich nach der Rolle — damit niemand auf einen
Knopf tippt, der dann mit „keine Berechtigung" scheitert. Die Grenze bleibt die Datenbank:

| Treffer | für alle, die ihn sehen | zusätzlich |
|---|---|---|
| Spiel | Öffnen; Zusage/Absage, wenn angefragt | MF der Mannschaft / Admin: „Spieler verwalten", „Aufstellung teilen" |
| Mannschaft | Öffnen (Mein Verein) | MF / Admin: „Kader bearbeiten" |
| Training | Öffnen; dabei/später/nicht | Trainer / Admin: „Ausfall eintragen" |
| Mitglied | Karte öffnen, Kontakt bei Freigabe | Admin: „Bearbeiten", „Einladung erneut senden", Status (z. B. „wartet auf Freischaltung") |
| Vereinstermin, Umfrage, Neuigkeit | Öffnen; zu-/absagen, abstimmen | Organisator / Admin: „Bearbeiten" |
| Seite | Öffnen | — (nur Seiten aus `visibleNav(role)`) |

Die Entscheidung „ist MF dieser Mannschaft" kommt aus den schon geladenen
`team_leaders`-Daten; wo sie fehlen, liefert `search` ein Feld `can_manage` mit, das
über die vorhandenen Helfer (`leads_team`, `trains`, `is_organizer_or_admin`) berechnet
wird — wieder keine eigene Regel.

### 4.6 Verhalten je Rolle (Beispiele für Abnahme und Tests)

| Rolle | sucht „Borussia" | sucht „Meier" | sucht „Jugendtraining" |
|---|---|---|---|
| Gast | nichts | nur, wenn Meier Admin oder Trainer ist | nur, wenn offen oder zugeordnet |
| Mitglied | alle Spiele gegen Borussia | Meier mit Mannschaften; Telefon nur bei Freigabe | findet Training, Teilnehmer nur wenn nicht inkognito |
| Mannschaftsführer | wie Mitglied + „Spieler verwalten" bei eigenen Teams | wie Mitglied | wie Mitglied |
| Trainer | wie Mitglied | wie Mitglied | + Teilnehmer auch bei Inkognito, wenn eigenes Training |
| Organisator | wie Mitglied | wie Mitglied | wie Mitglied; findet zusätzlich Entwürfe von Neuigkeiten |
| Admin | alles | alles, inkl. E-Mail, Mitgliedsnummer, Status | alles |

---

## 5. Welche Art der Suche die besten Ergebnisse liefert

### 5.1 Was hier gesucht wird — und was daraus folgt

Die Daten eines Vereins sind **klein** (einige hundert Mitglieder, ein paar hundert Spiele
je Saison, Trainingstermine für acht Wochen, eine Handvoll Neuigkeiten und Umfragen) und
**kurz** (Namen, Gegner, Ligen, Orte, Titel). Gesucht wird fast immer nach:

1. **Namen** — Personen, Gegner, Mannschaften, Orte. Hier zählen Wortanfänge,
   Umlaute und Tippfehler, *nicht* Grammatik.
2. **Terminen** — „wann spielen wir gegen X", „was ist Samstag". Hier zählt das Datum.
3. **Seltener Fließtext** — Neuigkeiten, Beschreibung eines Vereinstermins. Hier hilft
   Wortstammbildung („Meisterschaften" ↔ „Meisterschaft").

Daraus folgt: **mehrere einfache Verfahren kombiniert** schlagen jedes einzelne.

### 5.2 Das Verfahren: vier Stufen und eine Gewichtung

**Stufe 0 — Normalisierung** (auf Suchtext *und* Daten gleich):
Kleinschreibung → `ä→ae, ö→oe, ü→ue, ß→ss` → übrige Akzente weg (`unaccent`) →
Satzzeichen zu Leerzeichen. So treffen sich „Müller", „Mueller" und „MÜLLER". Eine
`IMMUTABLE`-Funktion `search_norm(text)`, damit sie in generierten Spalten und Indizes
stehen darf.

**Stufe 1 — Exakt und Wortanfang** (stärkstes Signal):
Jedes Suchwort muss Anfang eines Wortes im Suchtext sein
(`search_text ~ ('(^| )' || wort)`, über einen `pg_trgm`-GIN-Index beschleunigt).
Ganzer Name exakt > Nachname beginnt so > irgendein Wort beginnt so.

**Stufe 2 — Tippfehler und Klang** (nur wenn Stufe 1 nicht greift):
`strict_word_similarity` aus `pg_trgm` ab 0,45 (ganze Wörter, hält kurze Eingaben knapp:
„kasse" ≠ „Turnstrasse"), für Wörter ab acht Zeichen zusätzlich `word_similarity` ab 0,65
(Teile von Komposita: „meisterschaften" → „Clubmeisterschaft", aber „spieler" ≠
„Spieltag"). Bei Namen (Mitglieder, Mannschaften, Gegner, Orte, Ämter) danach die
**Kölner Phonetik** mit gleichem Anfangsbuchstaben: Meier = Mayer = Maier, Schmidt =
Schmitt. Die Schwellen sind an echten Wortpaaren eingestellt (Test `240_search`).
Dazwischen eine Stammstufe: die Eingabe ohne letzten Buchstaben als Wortanfang
(„trainings" → „Training", „kasse" → „Kassier").

**Stufe 3 — Volltext für Fließtext** (nur Neuigkeiten, Vereinstermine, Umfragen,
später Nachrichten):
`to_tsvector('german', …)` mit `websearch_to_tsquery('german', q)` und `ts_rank`.
Nur hier, denn die deutsche Stammformbildung macht Namen kaputt („Meiers" → „meier",
„Hansen" → „hans").

**Stufe 4 — Struktur aus der Eingabe** (`parseQuery.ts`, im Browser, rein und testbar):

| Eingabe | wird zu |
|---|---|
| `12.10.`, `12.10.26`, `12.10.2026` | Tagesfilter |
| `morgen`, `übermorgen`, `heute`, `Samstag`, `nächsten Samstag` | Tagesfilter (nächstes Vorkommen) |
| `diese Woche`, `nächste Woche`, `Oktober` | Zeitraumfilter |
| `H2`, `2. Herren`, `Herren 2`, `D1`, `J1` | Mannschaftsfilter (über Mannschaftsnamen aufgelöst) |
| `heim`, `auswärts` | `is_home`-Filter |
| alles andere | Suchtext |

Erkennt der Parser nichts sicher, bleibt die Eingabe Suchtext — lieber ein Treffer zu
viel als ein richtiger zu wenig.

**Gewichtung** (Summe, je Treffer):

```
score = text_score                           -- Stufe 1: 1,0 exakt · 0,8 Nachname · 0,6 Wortanfang
                                             -- Stufe 2: 0,3 × Ähnlichkeit · Stufe 3: 0,5 × ts_rank
      + 0,25  wenn eigene Beziehung          -- eigene Mannschaft, angefragt, zugeordnet, Trainer, Zielgruppe
      + 0,20  wenn in den nächsten 14 Tagen  -- linear abnehmend bis 0 bei 60 Tagen
      − 0,20  wenn vergangen (> 1 Tag)       -- außer Zeitfilter „vergangen" gesetzt
      + 0,10  wenn offen für mich            -- keine Antwort, Umfrage nicht abgestimmt
      × Artgewicht                           -- Ämter 1,05 · Seiten/Personen/Spiele 1,0 ·
                                             -- Mannschaften/Trainings/Termine 0,95 · Rest 0,8–0,9
Nebenfelder (Beschreibung, Tätigkeiten, Text) zählen nur 0,6 — Titel und Namen voll.
Gleichstand: kommende Termine nach Datum aufsteigend, sonst alphabetisch.
```

Die Zahlen sind ein Startwert. Sie werden mit echten Suchen aus dem Parallelbetrieb
nachjustiert (Abschnitt 7), nicht am Schreibtisch.

### 5.3 Beispiele, an denen man die Qualität misst

| Eingabe | erwarteter erster Treffer |
|---|---|
| `mül` | Mitglied Müller (bzw. alle Müllers, eigene Mannschaftskameraden zuerst) |
| `mueller` | dieselben |
| `borrusia` | nächstes Spiel gegen Borussia |
| `samstag` | Spiel(e) und Termine am kommenden Samstag |
| `h2 heim` | nächstes Heimspiel der 2. Herren |
| `kasse` | Amt Kassenwart mit Inhaber |
| `urlaub` | Seite „Abwesenheit eintragen" |
| `meisterschaften` | Vereinstermin „Vereinsmeisterschaft 2026" |
| `ics` | „Kalender abonnieren" |
| `jugend di` | Jugendtraining dienstags, nächster Termin |

Diese Tabelle wird zum Test (Abschnitt 6).

### 5.4 Warum nicht anders

| Alternative | Warum nicht |
|---|---|
| **Nur im Browser** (Fuse.js, MiniSearch über geladene Daten) | Würde alles Durchsuchbare vorab laden müssen — auch Vergangenes, Neuigkeiten, Beschreibungen, später Nachrichten. Der gespeicherte Stand reicht nur 30 Tage zurück und ist auf 3 MB begrenzt. Bleibt aber als **Offline-Rückfall** für das, was ohnehin geladen ist. |
| **Externer Suchdienst** (Algolia, Meilisearch, Typesense) | Daten verlassen Supabase → neuer Auftragsverarbeiter, Kosten, und vor allem: die Rechte müssten dort **nachgebaut** werden. Genau die zweite Wahrheit. |
| **KI-/Vektorsuche** (Embeddings, pgvector) | Schwach bei Namen, Kürzeln und Datumsangaben — also bei 90 % der Suchen hier. Jede Änderung bräuchte einen Aufruf bei einem KI-Anbieter (Datenschutz, Kosten > 80 €/Jahr-Rahmen), und die Treffer sind schwer erklärbar („warum kommt das?"). Bei ein paar hundert kurzen Datensätzen ohne Nutzen. |
| **Nur `ILIKE '%…%'`** (wie heute) | Keine Umlaute, keine Tippfehler, kein Ranking, Wortmitte-Treffer als Rauschen. Reicht für eine Liste, nicht für eine globale Suche. |
| **Nur Postgres-Volltext** | Stammformen zerstören Namen, keine Tippfehlertoleranz, kein Präfix beim Tippen ohne Zusatzaufwand. Gut für Fließtext, schlecht für den Rest — deshalb nur Stufe 3. |

---

## 6. Umsetzungsplan (Entwurf)

So war es geplant; was tatsächlich gebaut ist, steht in Abschnitt 8.

### 6.1 Datenbank (eine Migration)

```sql
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;

-- IMMUTABLE-Hülle, damit generierte Spalten und Indizes sie nutzen dürfen.
CREATE FUNCTION public.search_norm(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
           extensions.unaccent('extensions.unaccent',
             replace(replace(replace(replace(lower(coalesce(p, '')),
               'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss')),
           '[^a-z0-9]+', ' ', 'g');
$$;

-- Je Quelle eine generierte Spalte + Trigramm-Index, z. B.:
ALTER TABLE public.matches ADD COLUMN search_text text GENERATED ALWAYS AS
  (public.search_norm(coalesce(opponent,'') || ' ' || coalesce(league,'') || ' ' ||
                      coalesce(location_text,'') || ' ' || coalesce(summary,''))) STORED;
CREATE INDEX matches_search_trgm ON public.matches USING gin (search_text extensions.gin_trgm_ops);
-- analog: profiles (nur Vor-/Nachname), teams, trainings, club_events, polls,
-- news, venues, club_roles; tsvector-Spalten zusätzlich für news/club_events/polls.

CREATE FUNCTION public.search(
  p_q      text,
  p_kinds  text[]      DEFAULT NULL,   -- NULL = alle
  p_from   timestamptz DEFAULT NULL,   -- aus parseQuery
  p_to     timestamptz DEFAULT NULL,
  p_team   uuid        DEFAULT NULL,
  p_home   boolean     DEFAULT NULL,
  p_limit  int         DEFAULT 5       -- je Art
) RETURNS TABLE (kind text, id uuid, title text, subtitle text,
                 starts_at timestamptz, target text, score real,
                 my_status text, can_manage boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions, pg_temp
AS $$ … UNION ALL je Art, jeweils ORDER BY score DESC LIMIT p_limit … $$;
```

Schutz: Eingabe auf 100 Zeichen und 8 Wörter kürzen, unter 2 Zeichen leere Antwort,
`SET statement_timeout = '2s'` in der Funktion.

Die Erweiterungen `unaccent` und `pg_trgm` gibt es auf Supabase; für die lokale
Testdatenbank kommen sie in `scripts/supabase-compat.sql` bzw. `local-db.sh`.

### 6.2 Tests

- **pgTAP, je Rolle** (Konvention: positiver *und* negativer Fall):
  Gast findet keine Mannschaft/kein Spiel · Mitglied findet Telefonnummer nur bei
  `contact_visible` · niemand findet `comment_private` · Personensuche verrät keine
  Teilnahme an Inkognito-Trainings · Entwurf einer Neuigkeit nur für Organisator/Admin ·
  Umfrage nur für Zielgruppe · gelöschte Mitglieder nie · `anon` darf `search` nicht
  aufrufen.
- **Eigenschaftstest**: Für jede Rolle der Testdaten ist jede von `search` gelieferte
  `id` auch über ein normales `SELECT` auf die Quelle sichtbar (Treffer ⊆ Sichtbares).
- **Vitest**: `parseQuery` (Datumsangaben, Kürzel, Grenzfälle wie „12.10" vs. Uhrzeit
  „12:10"), `search_norm`-Gegenstück im Browser für Hervorhebung, Mischen und Ranking
  lokaler Treffer, Synonyme gegen `visibleNav(role)`.
- **Qualitätstest**: Tabelle 5.3 gegen die Testdaten, erster Treffer muss stimmen.

### 6.3 Stufen

| Stufe | Inhalt | Aufwand (grob) |
|---|---|---|
| **1** | Migration (Normalisierung, Suchspalten, Indizes, `search` für Mitglieder, Mannschaften, Spiele, Trainings, Vereinstermine, Orte), Seiten & Synonyme, SearchBox mit Sofortliste, pgTAP je Rolle | 16–22 h |
| **2** | Ergebnisseite `/search` mit Filtern, `parseQuery` (Datum, Kürzel, heim/auswärts), persönliche Gewichtung, Schnellaktionen | 10–14 h |
| **3** | Umfragen, Neuigkeiten, Ämter, Volltext für Fließtext, Offline-Rückfall | 8–12 h |
| **4** (optional) | Nachrichten am Termin, eigene Mitteilungen, bestehende Seitenfilter auf `search_norm` umstellen | 6–8 h |

Stufe 1 ist für sich nutzbar.

---

## 7. Entscheidungen

Umgesetzt nach den Empfehlungen des Konzepts:

1. **Seitenfilter** (Mitglieder, Spieltermine, Vereinstermine, Mehrfachauswahl) nutzen
   dieselbe Normalisierung (`src/lib/search.ts`, `matchesSearch`): „mueller" findet
   „Müller" überall, mehrere Wörter in beliebiger Reihenfolge.
2. **Vergangene Spiele** erscheinen, aber abgewertet; der Zeitfilter „Kommend /
   Vergangen" auf der Ergebnisseite grenzt ein.
3. **Keine Zählung** von Suchen, auch nicht anonym.
4. **Kontaktdaten sind kein Suchfeld**, auch bei Freigabe nicht (nur der Admin sucht in
   E-Mail und Mitgliedsnummer).

## 8. Umsetzung

| Teil | Ort |
|---|---|
| Normalisierung, Phonetik, Bewertung, `rpc_search` | `supabase/migrations/20261115000000_search.sql` |
| Rechte- und Qualitätstests (44 Assertions) | `supabase/tests/240_search.test.sql` |
| Normalisierung und Hervorhebung im Browser | `src/lib/search.ts` (Gleichlauf mit SQL per Test) |
| Datums- und Zeiterkennung | `src/features/search/parseQuery.ts` |
| Seiten, Aktionen, Synonyme | `src/features/search/pages.ts` |
| Abfrage, Mischen, Offline-Rückfall | `src/features/search/api.ts` |
| Sofortsuche (Kopfzeile, `Strg/⌘ K`, `/`) | `src/features/search/SearchDialog.tsx` |
| Ergebnisseite `/search` mit Filtern und Schnellaktionen | `src/features/search/SearchPage.tsx` |
| „Zuletzt gesucht" (nur Gerät, beim Abmelden gelöscht) | `src/features/search/recent.ts` |

Abweichungen vom Entwurf:

- **Keine generierten Suchspalten.** Die Suchtexte entstehen zur Laufzeit; nur Mitglieder
  und Spiele haben einen Trigramm-Index auf den Ausdruck. Spalten hätten jedes
  `select('*')` und den Offline-Speicher aufgebläht, bei ein paar hundert Zeilen ohne
  messbaren Gewinn.
- **Kein `unaccent`.** Die Normalisierung nutzt `translate`, damit sie auf jeder
  Datenbank gleich arbeitet und im Browser 1:1 nachgebaut werden kann.
- **Kürzel und Heim/Auswärts** stecken im Suchtext der Datenbank (`search_team_aliases`,
  „heim"/„auswaerts"), nicht im Parser des Browsers — so wirken sie auch ohne geladene
  Mannschaftsliste.
- **Nachrichten am Spiel** sieht nur, wer das Spiel über `can_see_match` sieht
  (Mannschaft, Anfrage, Admin) — enger als die Spielliste selbst. Die Suche folgt dem.
- **Trainingstermine** erscheinen einzeln nur bei einer Zeitangabe; sonst steht das
  Training einmal da, mit seinem nächsten Termin.
