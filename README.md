# Vereinsplaner

Vereinseigene Alternative zum [TT-Planer](https://www.tt-planer.de/) für Tischtennisvereine:
Mitglieder, Mannschaften, Spieltermine aus click-TT, Rückmeldungen, Ersatzsuche, Training,
Vereinstermine, Umfragen, Kalender und Benachrichtigungen.

**Stand (19.09.2026):** Die Anwendung ist gebaut und läuft gegen ein eingerichtetes
Supabase-Projekt — Mitglieder, Mannschaften und Spielpläne aus click-TT, Rückmeldungen und
Ersatzsuche, Training, Vereinstermine, Umfragen, Kalender mit ICS-Abo, Benachrichtigungen
per E-Mail und Push, Übersicht, PWA und Betriebssicht. 1012 Vitest-Tests, 469
pgTAP-Assertions.

**Nachtrag (23.09.2026) — aus Mitgliedersicht verbessert:** „Offen für dich" (Übersicht,
Meine Termine, Zähler im Menü), Trainings-Rückmeldung per Link ohne Anmeldung, Bemerkung
beim Training, Meldung neuer Umfragen und Neuigkeiten, Verlauf der Mitteilungen,
Spielkarte mit Rückmeldungen nach Namen, nuScore-Code/PIN und Route, vergangene Spiele,
Klick im Kalender führt zur Karte. Dazu: Lade- und Fehlerzustände statt falscher
Leerlisten, sofortige Antworten, Offline-Stand auf dem Gerät, Daten ab 30 Tagen zurück,
Seiten und große Bibliotheken werden nachgeladen (Hauptpaket 1,87 MB → 816 KB).

Noch nicht eingeladen ist jemand: Was davor zu erledigen ist, steht in
[docs/vor-der-ersten-einladung.md](docs/vor-der-ersten-einladung.md). Nicht gebaut sind
9.4 (Dateien), 9.7 (NuScore-PDF) und 9.10 („Anmelden als"); keines davon blockiert.

## Loslegen

```bash
npm install
cp .env.example .env.local     # ausfüllen, siehe docs/entwicklung.md
npm run db:reset               # lokale Testdatenbank aufbauen
npm run dev                    # http://localhost:5173
```

| Skript | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Vitest |
| `npx tsc --noEmit` | Typprüfung |
| `npm run lint` | ESLint (vor allem Regeln der React-Hooks) |
| `cd supabase/functions && deno check --node-modules-dir=none */index.ts` | Typprüfung der Edge Functions |
| `npm run build` | Produktionsbuild |
| `npm run db:reset` | Testdatenbank neu aufbauen (Migrationen + Seed) |
| `npm run db:test` | pgTAP-Tests für RLS, Trigger und RPCs |
| `npm run db:psql` | Datenbankkonsole |
| `npm run gen:types` | `src/lib/database.types.ts` neu erzeugen |
| `npm run make:icons` | App-Symbole aus `scripts/icon.svg` erzeugen |
| `npm run import:holidays` | Feiertage und Schulferien als Migration erzeugen |

Im Entwicklungsmodus zeigt `/_design` alle Komponenten des Design-Systems.

## Stack

React 18 · TypeScript · Vite · Tailwind · react-router · TanStack Query · react-hook-form +
zod · Radix UI · FullCalendar · tiptap · @dnd-kit · exceljs · vite-plugin-pwa · Vitest ·
Supabase (Postgres, Auth, RLS, Edge Functions) · pgTAP.

## Ordnerstruktur

```
src/
  app/            Router, Layout (Sidebar, Header, Bottom-Bar), Navigationsstruktur
  components/ui/  Design-System — Features importieren nur von hier
  features/       je Fachbereich: api.ts (react-query), Komponenten, Schemas
  lib/            Supabase-Client, generierte Typen, Datum, Beschriftungen, Textbausteine
supabase/
  migrations/     Schema (Baseline v2 + Folgemigrationen)
  tests/          pgTAP: jede Policy mit positivem und negativem Fall
  functions/      Edge Functions; _shared/ enthält reine, testbare Logik
scripts/          Lokale Testdatenbank, Supabase-Kompatibilitätsschicht, Typgenerator
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/zielbild.md](docs/zielbild.md) | **Was gebaut wird und wie**: Zieldefinition mit Abnahmekriterien, Scope, Domänenmodell, Zustandsautomaten, Rechte, UI-Design, Architektur |
| [docs/umsetzungsplan.md](docs/umsetzungsplan.md) | **Arbeitsanweisung**: Phasen 0–10 als Einzelaufgaben mit Endzustand, Vorgehen, Verifikation |
| [docs/entwicklung.md](docs/entwicklung.md) | Entwicklungsumgebung, Testdatenbank, pgTAP-Konventionen |
| [docs/datenbank.md](docs/datenbank.md) | Schema-Referenz und die Begründungen dahinter |
| [docs/go-live.md](docs/go-live.md) | **Der Faden von heute bis zur Kündigung**: alle manuellen Schritte, Checklisten, Fehlerbehandlung, fertige KI-Prompts |
| [docs/domain-einrichten.md](docs/domain-einrichten.md) | DNS für Anwendung und Versand: GitHub Pages, Resend, Prüfbefehle, Domainwechsel |
| [docs/einrichtung.md](docs/einrichtung.md) | **Einrichtung von null**: Supabase, Resend, VAPID, Secrets, Cron, erster Administrator |
| [docs/betrieb.md](docs/betrieb.md) | Laufender Betrieb: Reiter „Betrieb", Cron, Fehlerbilder, Sicherung |
| [docs/code-review.md](docs/code-review.md) | **Code-Review** vom 23.09.2026: Befunde, Nachweise, Stand der Behebung |
| [docs/sicherung.md](docs/sicherung.md) | **Datensicherung**: verschlüsselt nach GitHub und Google Drive, Schritt für Schritt |
| [docs/fehler.md](docs/fehler.md) | **Fehler aus dem Betrieb**: Bild, Ursache, Behebung — neueste zuerst |
| [docs/offene-entscheidungen.md](docs/offene-entscheidungen.md) | **Was der Verein entscheiden muss**, mit Möglichkeiten und Aufwand |
| [docs/vor-der-ersten-einladung.md](docs/vor-der-ersten-einladung.md) | **Check vor dem ersten Mitglied**: SMTP, Vereinsdaten, Rechtliches, Probelauf |
| [docs/migration.md](docs/migration.md) | **Datenübernahme aus dem TT-Planer**: Reihenfolge, Spalten-Mapping, Checkliste |
| [docs/parallelbetrieb.md](docs/parallelbetrieb.md) | **Abnahme**: vier Wochen beide Systeme, Nachweise zu Z1–Z11, Feedback der Mitglieder |
| [docs/abschluss.md](docs/abschluss.md) | **Go-live**: retten, kündigen, Lizenzfrage, Release v1.0.0 |
| [docs/tt-planer-bestandsaufnahme.md](docs/tt-planer-bestandsaufnahme.md) | Erhebung des TT-Planers auf Feldebene (Referenzprodukt) |
| [docs/funktionsvergleich.md](docs/funktionsvergleich.md) | Vergleich TT-Planer gegen den übernommenen Basisstand (historisch) |
| [docs/recherche-tt-planer.md](docs/recherche-tt-planer.md) | Marktrecherche, Datenwege aus click-TT, Kostenvergleich |
| [docs/erhebung-prompt-browser.md](docs/erhebung-prompt-browser.md) | Prompt für die Bestandsaufnahme im Browser |
| [docs/datenschutz/](docs/datenschutz/) | Verarbeitungsverzeichnis, Datenschutzhinweis, Löschkonzept, Auftragsverarbeitung |
| [NOTICE.md](NOTICE.md) | Herkunft und Lizenzstatus |

## Schema-Baseline

`supabase/migrations/20261001000000_schema_v2.sql` ist die **eingefrorene Baseline**. Jede
weitere Schemaänderung ist eine neue Migrationsdatei — die Baseline wird nicht mehr angefasst.

## Betrieb

Das Supabase-Projekt ist eingerichtet (Region Frankfurt), die sieben Edge Functions sind
ausgerollt, die sechs Cron-Jobs laufen. Die Entwicklung läuft weiterhin vollständig gegen
die lokale Testdatenbank (`scripts/local-db.sh`) — dieselben Migrationen, dieselben Tests.

Die Workflows `Deploy to GitHub Pages` und `Supabase ausrollen` sind noch manuell startbar;
ihr `push`-Auslöser ist auskommentiert und kann jetzt aktiviert werden.

⚠️ **Ein Reset entfernt Erweiterungen.** `supabase db reset --linked` nimmt `pg_cron` und
`pg_net` mit — und die Migrationen überspringen das Einplanen der Jobs dann stillschweigend.
Der Ausweg steht in [docs/einrichtung.md §2](docs/einrichtung.md#2-erweiterungen-einschalten).

Die CI (`ci.yml`) läuft bei jedem Push auf `main` und bei Pull Requests: Typprüfung, Tests,
Build sowie ein zweiter Job, der die Migrationen gegen einen Postgres-Dienst einspielt, die
pgTAP-Tests ausführt und prüft, ob die generierten Typen noch zum Schema passen.

## Herkunft und Lizenz

Das Repository ging aus [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner)
hervor (Übernahme bei Commit `f8ec2a5`, Historie erhalten). Das Ursprungsprojekt hat kein
LICENSE-File, weshalb dort alle Rechte beim Autor liegen. **Seit dem 18.09.2026 ist kein
Code von dort mehr enthalten**: Die vier zuletzt verbliebenen Dateien — ICS, Heim/Auswärts,
Aufstellungssortierung, Namensfunktionen — wurden samt ihren Tests neu geschrieben.

> **Eine eigene Lizenz fehlt noch.** Ohne `LICENSE` ist auch für dieses Projekt nicht
> geregelt, was ein künftiger Vorstand damit tun darf. Stand und Checkliste stehen in
> [NOTICE.md](NOTICE.md) und [docs/abschluss.md](docs/abschluss.md#3-die-lizenzfrage).
