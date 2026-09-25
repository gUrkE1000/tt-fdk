# Selbst hosten statt Supabase Cloud

**Stand** 25.09.2026 — Einschätzung, noch nicht umgesetzt.

Frage: Wie groß ist der Aufwand, die Datenbank von Supabase Cloud auf das Open-Source-Supabase
umzuziehen, selbst gehostet auf dem Proxmox-Mini-PC? Und was geht dann nicht mehr?

**Kurz:** Wer Docker kennt, braucht **ein bis zwei Tage**. Am Code der Anwendung ändert sich
fast nichts. Die Arbeit steckt in Infrastruktur, Konfiguration und Betrieb. Die spürbarsten
Folgen: Kalender-Abos müssen neu eingerichtet werden, Backups und Verfügbarkeit liegen danach
beim Verein, und der Anschluss zu Hause muss von außen erreichbar sein.

---

## Was die Anwendung von Supabase nutzt

| Baustein | Genutzt? | Selbst gehostet |
|---|---|---|
| Postgres + PostgREST | ja | problemlos |
| Auth: Magic Link, Passwort, Registrierung, Einladung, Passwort-Reset | ja | geht, braucht aber eigenes SMTP |
| 7 Edge Functions (`supabase/functions/`) | ja | über den Container `edge-runtime`, anderer Ausrollweg |
| `pg_cron` + `pg_net` (6 Jobs) | ja | im Image `supabase/postgres` enthalten |
| Storage, Realtime | **nein** | in `docker-compose` abschaltbar, spart RAM |

Dass Storage und Realtime fehlen, macht den Umzug deutlich leichter.

## Aufwand

| Schritt | Zeit (grob) |
|---|---|
| VM auf Proxmox (Docker, ~4 GB RAM, 2 vCPU, 30 GB), Supabase-`docker-compose` aufsetzen | 1–2 h |
| Von außen erreichbar machen: Domain, TLS, Reverse Proxy oder Cloudflare Tunnel | 1–3 h |
| Auth-Einstellungen aus dem Dashboard (`einrichtung.md` Abschnitt 10) als Umgebungsvariablen in `.env` | 1–2 h |
| Daten umziehen: `pg_dump`/Restore **samt Schema `auth`**, `private.cron_config` anpassen | 1–2 h |
| Functions und Secrets ausrollen | 1 h |
| Frontend neu bauen | 0,5 h |
| CI umbauen (Ausrollen, Sicherung) | 2–3 h |
| Probelauf: Magic Link, Einladung, Push, Cron, Kalender | 1–2 h |

Danach laufend: etwa **eine Stunde im Monat** für Updates und Kontrolle.

## Die Schritte im Einzelnen

### Auth

Was bisher im Dashboard unter *Authentication* steht, wird zu Umgebungsvariablen des
Containers `auth` (GoTrue). Jede Änderung heißt: `.env` bearbeiten, Container neu starten.

- `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`
- **Confirm email** an: `ENABLE_EMAIL_AUTOCONFIRM=false`
- **Secure email change** an (`GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true`)
- Captcha (`GOTRUE_SECURITY_CAPTCHA_*`)
- **SMTP**: Die Cloud hat einen eingebauten, gedrosselten Versand. Selbst gehostet gibt es
  keinen. Resend bietet SMTP an, die vorhandene Domain lässt sich weiterverwenden.
- E-Mail-Vorlagen für Magic Link, Einladung und Reset ebenfalls über `.env`.

### Daten

Den Dump mit `pg_dump` ziehen, **einschließlich des Schemas `auth`**. Sonst sind alle Konten
weg. Passwort-Hashes (bcrypt) lassen sich übertragen.

Die **Postgres-Hauptversion** muss gleich bleiben. `backup.yml` nutzt `pg_dump` 17, also
auch selbst gehostet ein Image mit Postgres 17 wählen.

Danach die Cron-Konfiguration auf die interne Adresse umstellen. `pg_net` ruft aus dem
Datenbank-Container, nicht aus dem Internet:

```sql
UPDATE private.cron_config
   SET value = 'http://kong:8000/functions/v1'
 WHERE key = 'functions_base_url';
```

Ob `pg_cron` eingeschaltet ist und sechs Jobs dastehen, prüft man wie in
`einrichtung.md` Abschnitt 8.

### Edge Functions

- Die Dateien aus `supabase/functions/` kommen in `volumes/functions/` des Compose-Aufbaus,
  danach wird der Container `functions` neu gestartet. `supabase functions deploy` gibt es
  hier nicht.
- Secrets (`RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `APP_URL`, `CRON_SECRET`) kommen in die
  Umgebung des Containers statt über `supabase secrets set`.
- ⚠️ **`verify_jwt` pro Function aus `supabase/config.toml` wirkt selbst gehostet nicht.**
  Der Einstieg `functions/main/index.ts` der Edge-Runtime prüft das JWT global über
  `VERIFY_JWT`. Bleibt es an, scheitern die Cron-Aufrufe und `calendar-feed` mit `401`.
  Entweder `VERIFY_JWT=false` und `invite-member` prüft das JWT selbst, oder die Liste der
  offenen Functions in `main/index.ts` nachbauen.

### Frontend

Neu bauen mit der neuen `VITE_SUPABASE_URL` und dem neuen `VITE_SUPABASE_ANON_KEY`. Das
neue JWT-Secret erzeugt neue Schlüssel.

`src/sw.ts` erkennt Supabase-Aufrufe an `.supabase.co`. Liegt die API auf einer anderen Domain
als die Anwendung, bleibt das richtig. Liegt sie auf **derselben** Domain, müssen `/rest/v1`
und `/auth/v1` dort ebenfalls auf `NetworkOnly`.

### CI

- **`deploy-supabase.yml`**: `supabase link --project-ref` und `supabase functions deploy`
  funktionieren nicht. Migrationen weiter über `supabase db push --db-url …`. Die Functions
  per rsync/scp kopieren und den Container neu starten. GitHub muss den Server erreichen,
  am einfachsten über einen Self-hosted Runner auf dem Proxmox.
- **`backup.yml`** holt den Dump über den Supabase-Pooler. Ersatz: ein `pg_dump`-Cronjob auf
  dem Server, dazu Proxmox-Backups (vzdump / Proxmox Backup Server) **und** eine Kopie außer
  Haus. Die Anleitung `sicherung.md` gilt dann nicht mehr.

### Doku

`einrichtung.md`, `betrieb.md` und `sicherung.md` sind durchgehend auf das Cloud-Dashboard
geschrieben und müssten eine selbst gehostete Fassung bekommen.

## Einschränkungen

1. **Kalender-Abos brechen.** Die Links lauten
   `https://<id>.supabase.co/functions/v1/calendar-feed?token=…`. Diese Adresse lässt sich
   nicht umleiten. Alle müssen den Kalender einmal neu abonnieren.
2. **Alle werden abgemeldet.** Neues JWT-Secret heißt: Jede Sitzung wird ungültig. Push-Abos
   bleiben erhalten, wenn dieselben VAPID-Schlüssel weiterverwendet werden.
3. **Erreichbarkeit von außen ist Pflicht.** Magic Links, die App der Mitglieder und die
   Kalender-Server von Google und Apple brauchen öffentliches HTTPS. Probleme machen
   DS-Lite/CGNAT (Abhilfe: Cloudflare Tunnel), dynamische IP, geringer Upload sowie Strom-
   oder Internetausfall zu Hause.
4. **Kein Point-in-Time-Recovery, keine automatischen Backups.** Beides liegt komplett beim
   Verein.
5. **Studio kann weniger.** Auth-Einstellungen gehen nicht per Klick, nur über `.env` mit
   Neustart. Logs und Advisors nur eingeschränkt. Schaltet man Analytics (Logflare + Vector)
   ab, um RAM zu sparen, fehlt die Log-Ansicht ganz.
6. **Sicherheit.** Updates für Supabase-Images, das Betriebssystem und Proxmox. Studio darf
   **nicht** öffentlich erreichbar sein, es ist nur mit Basic-Auth geschützt.
7. **Datenschutz, eher ein Vorteil.** Der AV-Vertrag mit Supabase entfällt. Dafür müssen die
   eigenen technischen und organisatorischen Maßnahmen dokumentiert werden (Verschlüsselung,
   Zugang, Backups), siehe `datenschutz/`.

## Einschätzung

Technisch gut machbar, weil die Anwendung nur Datenbank, Auth, Functions und Cron nutzt.
Entscheidend ist weniger der einmalige Aufwand als zwei Fragen: Ist der Anschluss zu Hause
zuverlässig von außen erreichbar? Und will jemand Backups und Updates **dauerhaft** selbst
übernehmen?

Geht es vor allem um Kosten: Für einen Verein reicht oft der Free- oder Pro-Tarif. Die
Pausierung im Free-Tarif greift nicht, solange die Cron-Jobs laufen.
