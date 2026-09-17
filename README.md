# tt-fdk — Spielbereitschafts-Planer des Vereins

Vereinseigene Alternative zum [TT-Planer](https://www.tt-planer.de/): Spieltermine kommen per
Webcal/ICS aus click-TT bzw. myTischtennis, Spieler melden sich zu oder ab, Mannschaftsführer
planen daraus die Aufstellung.

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

Für Supabase-Setup, Edge Function und Deployment siehe
[docs/einrichtung.md](docs/einrichtung.md).

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
| [NOTICE.md](NOTICE.md) | Herkunft, Lizenzstatus, Upstream-Abgleich |
