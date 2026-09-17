# tt-fdk — Spielbereitschafts-Planer des Vereins

Vereinseigene Alternative zum [TT-Planer](https://www.tt-planer.de/). Ziel ist der Funktionsumfang des
Champion-Pakets für den Vereinsalltag (Mitglieder, Mannschaften, Spieltermine aus click-TT, Rückmeldungen,
Ersatzsuche, Training, Termine, Umfragen, Kalender, Benachrichtigungen) — siehe [docs/zielbild.md](docs/zielbild.md).

![Version](https://img.shields.io/badge/version-1.2.6-blue)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://gUrkE1000.github.io/tt-fdk/)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/gUrkE1000/tt-fdk/graphs/commit-activity)
![Last commit](https://img.shields.io/github/last-commit/gUrkE1000/tt-fdk)


**Status:** Planungsphase abgeschlossen, Umsetzung nach [docs/umsetzungsplan.md](docs/umsetzungsplan.md) noch nicht begonnen.
Der aktuelle Code ist der unveränderte Übernahmestand des Basisprojekts.

## Herkunft

Dieses Repository basiert auf [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner),
übernommen bei Commit `f8ec2a50cfeab2980a01d638e43b9785641fcb72`. Die Git-Historie des
Ursprungsprojekts ist bewusst mit übernommen, damit die Urheberschaft der einzelnen Commits
nachvollziehbar bleibt.

> ⚠️ **Lizenzstatus ungeklärt.** Das Ursprungsprojekt enthält kein LICENSE-File; damit sind formal
> alle Rechte beim Autor. Vor einem produktiven Einsatz oder einer Veröffentlichung muss eine
> Lizenz vom Autor eingeholt werden. Details und der Stand der Anfrage: [NOTICE.md](NOTICE.md).

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Vitest · Supabase (Postgres, Auth, RLS,
Edge Functions) · Deployment über GitHub Actions.

## Loslegen

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build
```

`.env.example` nach `.env.local` kopieren und ausfüllen. Für Supabase-Setup, Edge Function und
Deployment siehe [docs/einrichtung.md](docs/einrichtung.md).

## Vor dem ersten Deploy

Die aus dem Ursprungsprojekt übernommenen GitHub-Workflows laufen nur bei Pushes auf
`main`/`master` (Ausnahme: der tägliche Sync-Cronjob). Sie schlagen fehl, solange sie nicht auf
unseren Verein umgestellt sind:

- **Repository-Secrets setzen**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SYNC_SECRET`,  
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` (siehe [docs/einrichtung.md](docs/einrichtung.md)).  
- **Supabase-Projekt anlegen** und die Migration `supabase/migrations/20260808000000_init.sql`  
  einspielen; Region EU wählen (DSGVO).  
- **`deploy.yml`** (GitHub Pages) prüfen: Pages im Repository aktivieren, sonst deaktivieren.  
- **`auto-version-badges.yml`** nutzt eine Action aus dem Ursprungs-Account  
  (`dgaida/auto-version-action`) und schreibt Badges auf das Upstream-Repo — vor Aktivierung
  anpassen oder entfernen.  
- **`sync-calendars.yml`** (Cron 04:00 UTC) erst aktivieren, wenn die Edge Function deployt ist.  

Bis die Lizenzfrage geklärt ist (siehe [NOTICE.md](NOTICE.md)): Repository privat lassen.

## Dokumentation

Aus dem Ursprungsprojekt übernommen:

| Dokument | Inhalt |
|---|---|
| [docs/einrichtung.md](docs/einrichtung.md) | Lokale Entwicklung, Supabase-Setup, Edge Function, CI/CD |
| [docs/nutzung.md](docs/nutzung.md) | Benutzerhandbuch je Rolle (Spieler, Mannschaftsführer, Sportwart, Admin) |
| [docs/architektur.md](docs/architektur.md) | Technologiestack, Datenmodell, Sync-Engine, Ersatzspieler-Logik |
| [docs/datenbank.md](docs/datenbank.md) | Spaltenreferenz aller Tabellen, Lifecycle bei Spielverlegungen |
| [docs/faq.md](docs/faq.md) | Fehlerbehebung |
| [docs/upstream-README.md](docs/upstream-README.md) | Original-README des Ursprungsprojekts (Feature-Überblick) |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Anforderungen des Ursprungsprojekts |

Eigene Dokumente:

| Dokument | Inhalt |
|---|---|
| [docs/recherche-tt-planer.md](docs/recherche-tt-planer.md) | Recherche zu TT-Planer, click-TT/nuLiga-Datenwegen, Alternativen, Kostenvergleich |
| [docs/funktionsvergleich.md](docs/funktionsvergleich.md) | Vollständiger Funktionsvergleich TT-Planer vs. Repo-Stand: Schnittmenge, Lücken, Vorsprung, Baustellen, Roadmap |
| [docs/zielbild.md](docs/zielbild.md) | **Zielbild** — Zieldefinition mit Abnahmekriterien, Scope-Stufen, Informationsarchitektur, Domänenmodell, Zustandsautomaten, Rechte, UI-Design, technische Architektur |
| [docs/umsetzungsplan.md](docs/umsetzungsplan.md) | **Umsetzungsplan v2** — Regeln für den ausführenden Agenten, Phasen 0–10 als Einzelaufgaben mit Endzustand, Vorgehen und Verifikation, Releases, Status |
| [docs/tt-planer-bestandsaufnahme.md](docs/tt-planer-bestandsaufnahme.md) | Bestandsaufnahme des TT-Planers aus der eingeloggten Anwendung (Feldebene, pseudonymisiert) |
| [docs/erhebung-prompt-browser.md](docs/erhebung-prompt-browser.md) | Prompt für Claude im Browser: Bestandsaufnahme des TT-Planers in der eingeloggten Session |
| [NOTICE.md](NOTICE.md) | Herkunft, Lizenzstatus, Upstream-Abgleich |
