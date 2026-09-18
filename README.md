# Vereinsplaner

Vereinseigene Alternative zum [TT-Planer](https://www.tt-planer.de/) für Tischtennisvereine:
Mitglieder, Mannschaften, Spieltermine aus click-TT, Rückmeldungen, Ersatzsuche, Training,
Vereinstermine, Umfragen, Kalender und Benachrichtigungen.

**Stand:** Die Phasen 0–8 sind umgesetzt — Mitglieder, Mannschaften und Spielpläne aus
click-TT, Rückmeldungen und Ersatzsuche, Training, Vereinstermine, Umfragen, Kalender mit
ICS-Abo, Benachrichtigungen per E-Mail und Push, Übersicht, PWA und Betriebssicht. Offen ist
Phase 9 (Komfortmodule) und Phase 10 (Go-live); die verbliebenen Platzhalterseiten nennen die
Aufgabe aus dem [Umsetzungsplan](docs/umsetzungsplan.md), die sie füllt.

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
| [docs/einrichtung.md](docs/einrichtung.md) | **Einrichtung von null**: Supabase, Resend, VAPID, Secrets, Cron, erster Administrator |
| [docs/betrieb.md](docs/betrieb.md) | Laufender Betrieb: Reiter „Betrieb", Cron, Fehlerbilder, Sicherung |
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

Es gibt noch kein Supabase-Projekt. Die Entwicklung läuft vollständig gegen die lokale
Testdatenbank (`scripts/local-db.sh`). Die Workflows `Deploy to GitHub Pages` und
`Supabase ausrollen` sind deshalb nur manuell startbar; sie bekommen ihren Auslöser zurück,
sobald Projekt und Secrets eingerichtet sind (Aufgabe 0.3 im Umsetzungsplan).

Die CI (`ci.yml`) läuft bei jedem Push auf `main` und bei Pull Requests: Typprüfung, Tests,
Build sowie ein zweiter Job, der die Migrationen gegen einen Postgres-Dienst einspielt, die
pgTAP-Tests ausführt und prüft, ob die generierten Typen noch zum Schema passen.

## Herkunft und Lizenz

Das Repository ging aus [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner)
hervor (Übernahme bei Commit `f8ec2a5`, Historie erhalten). Übernommen sind heute nur noch
der ICS-Parser, die Heim/Auswärts-Erkennung, die Aufstellungssortierung und einige
Namensfunktionen — unter `supabase/functions/_shared/` und `src/lib/`.

> ⚠️ **Lizenzstatus ungeklärt.** Das Ursprungsprojekt hat kein LICENSE-File. Vor einem
> produktiven Einsatz oder einer Veröffentlichung ist die Lizenzfrage zu klären; Details und
> ein fertiger Anfragetext stehen in [NOTICE.md](NOTICE.md). Bis dahin bleibt das Repository
> privat.
