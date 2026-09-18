# Der Weg zum Go-live

Alles, was ab jetzt von Hand zu tun ist — von heute bis zu dem Tag, an dem der TT-Planer
gekündigt ist. In der Reihenfolge, in der es zu tun ist, mit dem Grund dahinter und mit
dem, was zu tun ist, wenn es klemmt.

> **Diese Datei ist der Faden.** Sie ersetzt die anderen Dokumente nicht, sie führt durch
> sie hindurch. Wo es ins Detail geht, steht ein Verweis — folge ihm, komm zurück, hak ab.

| Dokument | Wofür |
|---|---|
| [`einrichtung.md`](einrichtung.md) | Die technische Einrichtung im Detail |
| [`migration.md`](migration.md) | Datenübernahme aus dem TT-Planer |
| [`parallelbetrieb.md`](parallelbetrieb.md) | Die vier Wochen Abnahme |
| [`abschluss.md`](abschluss.md) | Kündigung, Lizenz, Release |
| [`betrieb.md`](betrieb.md) | Fehlerbilder im laufenden Betrieb |
| [`datenschutz/`](datenschutz/) | Die Unterlagen zum Veröffentlichen |

**Zeitbedarf:** etwa **zwei bis drei Arbeitstage**, verteilt über **sechs Wochen**. Der
Löwenanteil der Kalenderzeit sind vier Wochen Parallelbetrieb, die sich nicht abkürzen
lassen, und ein paar Tage Wartezeit auf DNS und Verträge.

---

## Inhalt

- [Teil 0 — Heute, vor allem anderen](#teil-0--heute-vor-allem-anderen)
- [Teil 1 — Konten und Zugänge](#teil-1--konten-und-zugänge)
  - [Der Stichtag für die Domain](#11a-der-stichtag-für-die-domain)
- [Teil 2 — Technische Einrichtung](#teil-2--technische-einrichtung)
- [Teil 3 — Erster Start](#teil-3--erster-start)
- [Teil 4 — Daten hineinbekommen](#teil-4--daten-hineinbekommen)
- [Teil 5 — Rechtliches](#teil-5--rechtliches)
- [Teil 6 — Menschen dazuholen](#teil-6--menschen-dazuholen)
- [Teil 7 — Abschluss](#teil-7--abschluss)
- [Anhang A — Wenn du eine KI um Hilfe bittest](#anhang-a--wenn-du-eine-ki-um-hilfe-bittest)
- [Anhang B — Fertige Prompts](#anhang-b--fertige-prompts)
- [Anhang C — Was niemals in einen Prompt gehört](#anhang-c--was-niemals-in-einen-prompt-gehört)
- [Anhang D — Zettel zum Ausfüllen](#anhang-d--zettel-zum-ausfüllen)

---

# Teil 0 — Heute, vor allem anderen

## 0.1 Die Kündigungsfrist des TT-Planers nachsehen

**Das ist der einzige Schritt mit einer Uhr daran.** Alles andere kann warten; eine
versäumte Jahresfrist kostet 180 € und zwölf Monate.

Der TT-Planer läuft auf Jahresvertrag. Wo die Frist steht:

1. Die **Auftragsbestätigung** aus dem E-Mail-Postfach des Vereins (Suche nach
   „TT-Planer", „Rechnung", „Buchung").
2. Die **AGB**, verlinkt im Buchungsformular unter *Verwalten → Verein → Kundenbereich*.
3. Die **Rechnung** — sie nennt in der Regel den Abrechnungszeitraum, und daraus folgt das
   Vertragsende.

Trag es in [Anhang D](#anhang-d--zettel-zum-ausfüllen) ein, und schreib dir den **letzten
möglichen Kündigungstag in den Kalender**, mit vier Wochen Vorwarnung.

> **Wenn die Frist in weniger als zehn Wochen abläuft:** Der Parallelbetrieb passt nicht
> mehr davor. Dann entweder dieses Jahr noch verlängern lassen und in Ruhe umziehen, oder
> den Parallelbetrieb auf zwei Wochen kürzen und in [`parallelbetrieb.md`](parallelbetrieb.md)
> §7 vermerken, dass die Abnahme unvollständig ist. Nicht heimlich kürzen.

☐ Erledigt am: ________

## 0.2 Entscheiden, wer das macht

Nicht formal — praktisch. Drei Rollen, die dieselbe Person sein dürfen:

| Rolle | Tut |
|---|---|
| **Betreiber** | Supabase, Resend, Domain, Deployments. Braucht ein Terminal |
| **Administrator** | Mitglieder, Mannschaften, Trainings in der Anwendung. Braucht keine Technik |
| **Vorstand** | Verträge, Datenschutzhinweis, Kündigung |

Wichtig ist nur eines: **Der Betreiber darf nicht der einzige sein, der an die Zugänge
kommt.** Leg ein gemeinsames Passwortdepot an (Bitwarden, KeePass in der Vereinscloud) und
trag Supabase, Resend, Domain und GitHub dort ein. Vereins-IT stirbt fast immer daran, dass
einer wegzieht.

☐ Erledigt am: ________

---

# Teil 1 — Konten und Zugänge

Alles in diesem Teil kann parallel laufen. DNS und Vertragsprüfungen brauchen Zeit — fang
früh an.

## 1.1 Domain

Eine Domain oder Subdomain, unter der die Anwendung erreichbar ist. Beispiele:
`planer.tt-musterstadt.de`, `tt-planer.verein.de`.

- Hat der Verein schon eine Website, reicht eine **Subdomain** davon
  (`planer.tsv-musterstadt.de`). Kostet nichts extra und ist der einfachste Weg.
- Sonst: ~5–15 €/Jahr bei einem Registrar mit vollständiger DNS-Verwaltung — du brauchst
  `CNAME`, `TXT` und ggf. `MX`.

**Diese Domain wird an drei Stellen gebraucht:** als Adresse der Anwendung, als Absenderdomain
der E-Mails, und als Basis jedes Links in einer Benachrichtigung.

⚠️ **Inhaber ist der Verein**, mit Vereinsanschrift, bezahlt vom Vereinskonto. Nicht privat
„bis wir das mal umschreiben" — genau das passiert nie. Läuft die Anwendung auf der
Privatdomain des Betreibers, hängen Adresse, E-Mail-Absender und alle Kalender-Abos des
Vereins an einer Person. Der Datenschutzhinweis behauptet zudem, der Verein betreibe die
Anwendung; eine Domain im Privatnamen sagt etwas anderes.

## 1.1a Der Stichtag für die Domain

**Eine Übergangsdomain ist in Ordnung — aber nur bis zur ersten Einladung.**

Für Einrichtung, Probelauf und Datenübernahme kannst du nehmen, was gerade da ist. Ein
Wechsel danach ist jedoch kein DNS-Eintrag, sondern ein Bruch: Die Anwendung ist eine PWA,
und eine neue Domain ist ein neuer **Origin**.

| Was | Was beim Wechsel passiert |
|---|---|
| Service Worker | Neue Registrierung; die alte bleibt als Leiche auf den Geräten |
| **Push-Anmeldungen** | **Alle weg.** Jeder muss die Glocke neu drücken — und niemand sagt ihm, warum nichts mehr kommt |
| „Zum Home-Bildschirm" | Zeigt auf die alte Adresse, muss neu installiert werden |
| **Kalender-Abos (ICS)** | Die volle URL steckt im Kalenderprogramm jedes Mitglieds. Tot |
| Links in alten Benachrichtigungen | Tot |
| Redirect-URLs der Anmeldung | Müssen nachgezogen werden (harmlos) |

Mit dir und zwei Mannschaftsführern: zehn Minuten Arbeit. Mit 80 Mitgliedern, die die App
installiert und Push aktiviert haben: ein Ärgernis in genau der Woche, in der du es am
wenigsten gebrauchen kannst.

**→ Die endgültige Domain muss vor [Teil 6.1](#61-einladen--in-dieser-reihenfolge) stehen.**

### Wenn du übergangsweise eine fremde oder private Domain nutzt

- **Subdomain nehmen**, nicht die Hauptdomain: `tt.beispiel.de` → `CNAME` auf
  `<konto>.github.io`.
- ⚠️ **Für Resend eine eigene Sende-Subdomain** (`mail.beispiel.de`), nicht die Hauptdomain.
  Resend verlangt SPF-, DKIM- und DMARC-Einträge; liegt auf der Hauptdomain privates
  E-Mail-Konto, kann eine zu strenge DMARC-Regel die eigene Post ins Nichts schicken. Eine
  Sende-Subdomain isoliert das und lässt sich später wegwerfen.
- Prüf vorher, ob der Anbieter **beliebige DNS-Einträge** erlaubt. Manche Baukasten-Hoster
  (WordPress.com, Wix, Jimdo) geben nur eine Auswahl vorgegebener Typen frei. Dann lohnt der
  Zwischenschritt nicht — kauf gleich die Vereinsdomain.

☐ Übergangsdomain: ____________________
☐ Endgültige Domain: ____________________ ☐ steht seit: ________

## 1.2 Supabase-Projekt

1. [supabase.com](https://supabase.com) → Konto anlegen, am besten mit einer
   **Vereinsadresse**, nicht privat.
2. Neues Projekt, **Region: Frankfurt (eu-central-1)**.
   Das ist keine Kosmetik — der Datenschutzhinweis und `docs/datenschutz/av-supabase.md`
   behaupten beide, die Daten lägen in der EU. Eine andere Region macht diese Aussage falsch.
3. Datenbank-Passwort erzeugen lassen und **sofort ins Passwortdepot**. Es lässt sich
   zurücksetzen, aber nie wieder anzeigen.
4. Unter *Project Settings → API* die drei Werte notieren:

| Wert | Wohin | Geheim? |
|---|---|---|
| **Project URL** | `VITE_SUPABASE_URL` | nein |
| **anon public** | `VITE_SUPABASE_ANON_KEY` | nein — der darf ins Browser-Bundle |
| **service_role** | nur Edge-Function-Secrets | **ja, absolut** |

> ⚠️ **Der `service_role`-Schlüssel umgeht jede Sicherheitsregel.** Wer ihn hat, liest und
> ändert alle Mitgliederdaten, inklusive der Abwesenheitsgründe, die sonst niemand sieht.
> Er gehört nicht in eine Chat-Nachricht, nicht in ein Ticket, nicht ins Repository und
> **nicht in einen KI-Prompt** (siehe [Anhang C](#anhang-c--was-niemals-in-einen-prompt-gehört)).

☐ Projekt-ID: ____________________

## 1.3 Resend-Konto

1. [resend.com](https://resend.com) → Konto anlegen.
2. Domain hinzufügen, die genannten **DNS-Einträge setzen** (SPF, DKIM, DMARC).
3. **Warten**, bis Resend die Domain als *verified* führt. Minuten bis Stunden, je nach
   Anbieter. Vorher wird jeder Versand abgelehnt.
4. API-Schlüssel erzeugen → Passwortdepot.

Eine Absenderadresse wie `planer@verein.de` genügt. Ein Postfach dahinter braucht es nicht,
solange niemand auf Benachrichtigungen antwortet — aber **richte trotzdem eine
Weiterleitung ein**. Es antwortet immer jemand.

**Kostenlos bis 3.000 E-Mails/Monat und 100/Tag.** Bei 80 Mitgliedern kommt ihr dem
Tageslimit an einem Spieltag mit Sammelhinweis nahe. Behalte es im Blick; Push entlastet
es, weil Push-Nachrichten nicht über Resend laufen.

☐ Domain verifiziert am: ________

## 1.4 GitHub

Das Repository existiert. Zu tun:

1. *Settings → Pages* → Source: **GitHub Actions**.
2. *Settings → Secrets and variables → Actions* → diese Secrets anlegen:

| Secret | Woher |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account Settings → Access Tokens |
| `SUPABASE_PROJECT_REF` | die Projekt-ID |
| `SUPABASE_DB_PASSWORD` | das Datenbank-Passwort aus 1.2 |
| `VITE_SUPABASE_URL` | die Project URL |
| `VITE_SUPABASE_ANON_KEY` | der anon-Schlüssel |
| `VITE_APP_URL` | `https://<deine Domain>` |
| `VITE_VAPID_PUBLIC_KEY` | kommt in [2.3](#23-vapid-schlüsselpaar-erzeugen) |

3. *Settings → Secrets and variables → Actions → Variables* → `BACKUP_ENABLED` = `true`
   (schaltet die wöchentliche Sicherung scharf; ohne die Variable läuft sie ins Leere).

> **Das Repository bleibt privat.** Die wöchentliche Sicherung legt einen vollständigen
> Datenbankauszug als Artefakt ab — mit allen Mitgliederdaten. Siehe
> [`abschluss.md`](abschluss.md#3-die-lizenzfrage) für die Frage, wann und wie das anders
> werden könnte.

☐ Erledigt am: ________

---

# Teil 2 — Technische Einrichtung

Ab hier brauchst du ein Terminal und das Repository lokal.

```bash
git clone <repo-url> tt-fdk && cd tt-fdk
npm ci
```

## 2.1 Supabase CLI verbinden

```bash
npx supabase login          # öffnet den Browser
npx supabase link --project-ref <projekt-id>
```

`link` legt beim ersten Mal `supabase/config.toml` an. **Danach diesen Block ergänzen:**

```toml
[functions.calendar-feed]
verify_jwt = false
```

> **Warum das wichtig ist:** `calendar-feed` liefert den Kalender aus, den Mitglieder in
> Apple Kalender oder Google Kalender abonnieren. Ein Kalenderprogramm kann sich nicht
> anmelden — es hat nur den Abo-Token in der URL. Bleibt die JWT-Prüfung an, funktioniert
> das Abo nicht, und der Fehler äußert sich als „Kalender kann nicht geladen werden" ohne
> weiteren Hinweis. Ohne `config.toml` musst du es nach jedem Deploy im Dashboard klicken
> (*Edge Functions → calendar-feed → Verify JWT: aus*) — mit `config.toml` passiert es von
> selbst.

☐ Erledigt am: ________

## 2.2 Erweiterungen einschalten

Supabase-Dashboard → *Database → Extensions* → einschalten:

- **`pg_cron`** — die zeitgesteuerten Jobs
- **`pg_net`** — damit die Jobs die Edge Functions aufrufen können

> **Unbedingt vor Schritt 2.4.** Die Migrationen sind so gebaut, dass sie ohne diese beiden
> Erweiterungen **nicht scheitern, sondern stillschweigend keine Jobs anlegen**. Das ist
> Absicht (sonst liefe die Testdatenbank nicht), führt hier aber zu einer Anwendung, die
> aussieht wie fertig und in der nie etwas von selbst passiert: keine Erinnerungen, kein
> Kalenderabgleich, keine Trainingstermine.
>
> Wenn du es vergisst: Erweiterungen einschalten, dann die betroffenen Migrationen erneut
> ausführen (`npx supabase db push` ist idempotent) und mit der Prüfung in
> [2.6](#26-cron-konfiguration-eintragen) nachsehen, ob sechs Jobs dastehen.

☐ Erledigt am: ________

## 2.3 VAPID-Schlüsselpaar erzeugen

```bash
npx web-push generate-vapid-keys
```

Ausgabe sind zwei Schlüssel. Beide ins Passwortdepot.

> ⚠️ **Einmal erzeugen, nie wieder ändern.** Ein neuer Schlüssel macht jede bestehende
> Push-Anmeldung wertlos. Alle Mitglieder müssten die Glocke erneut drücken — und niemand
> würde ihnen sagen, warum plötzlich nichts mehr kommt. Sie merken es schlicht daran, dass
> sie einen Spieltag verpassen.

Den **öffentlichen** Schlüssel jetzt als GitHub-Secret `VITE_VAPID_PUBLIC_KEY` nachtragen
(Schritt 1.4).

☐ Erledigt am: ________

## 2.4 Schema einspielen

```bash
npx supabase db push
```

Spielt die 31 Migrationen in `supabase/migrations/` der Reihe nach ein. Die Dateien sind so
geschrieben, dass ein zweiter Lauf nichts kaputt macht.

**Prüfen, dass es geklappt hat** — im SQL-Editor des Dashboards:

```sql
SELECT count(*) AS tabellen
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

Es sollten rund 40 Tabellen dastehen. Und:

```sql
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public' AND rowsecurity = false;
```

**Diese Abfrage muss leer sein.** Jede Tabelle in `public` hat Row Level Security. Steht
dort etwas, ist eine Migration nicht durchgelaufen — nicht weitermachen, sondern
nachsehen.

> **`supabase/seed.sql` bleibt draußen.** Das sind erfundene Mitglieder für die
> Entwicklung. `db push` spielt sie nicht ein; führ sie auch nicht von Hand aus.

☐ Erledigt am: ________

## 2.5 Secrets setzen und Functions ausrollen

```bash
npx supabase secrets set APP_URL="https://planer.verein.de"
npx supabase secrets set RESEND_API_KEY="re_..."
npx supabase secrets set VAPID_PUBLIC_KEY="B..."
npx supabase secrets set VAPID_PRIVATE_KEY="..."

npx supabase functions deploy
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase den
Functions selbst bereit — die musst du **nicht** setzen.

Sieben Funktionen sollten erscheinen: `invite-member`, `sync-calendars`,
`process-notifications`, `enqueue-reminders`, `substitute-engine`,
`generate-training-sessions`, `calendar-feed`.

☐ Erledigt am: ________

## 2.6 Cron-Konfiguration eintragen

Die Jobs brauchen zwei Werte in der Datenbank. Im SQL-Editor:

```sql
UPDATE private.cron_config
   SET value = 'https://<projekt-id>.supabase.co/functions/v1'
 WHERE key = 'functions_base_url';

UPDATE private.cron_config
   SET value = encode(gen_random_bytes(32), 'hex')
 WHERE key = 'cron_secret';
```

> **Warum das Secret in der Datenbank steht und nicht in der Umgebung:** Der Job schickt es
> beim Aufruf mit, die Function liest es zum Vergleich. Beide kommen an dieselbe Tabelle,
> sonst niemand — das Schema `private` veröffentlicht PostgREST nicht. Es ist der Beweis,
> dass ein Aufruf wirklich vom Cron kommt und nicht von außen.

**Prüfen:**

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Es müssen **sechs** Jobs dastehen:

| Job | Läuft |
|---|---|
| `retention` | `0 2 * * *` — Löschfristen |
| `generate-training-sessions` | `0 3 * * *` — Trainingstermine |
| `sync-calendars` | `0 4 * * *` — Spielplanabgleich |
| `process-notifications` | `*/5 * * * *` — Versand |
| `enqueue-reminders` | `*/10 * * * *` — Erinnerungen einreihen |
| `substitute-engine` | `*/10 * * * *` — Ersatzkette |

Stehen dort **null** Jobs: `pg_cron` ist nicht eingeschaltet → zurück zu
[2.2](#22-erweiterungen-einschalten).

☐ Sechs Jobs bestätigt am: ________

## 2.7 Anmeldung konfigurieren

Dashboard → *Authentication → URL Configuration*:

- **Site URL**: `https://planer.verein.de`
- **Redirect URLs**: dieselbe Adresse, zusätzlich `http://localhost:5173`

Dashboard → *Authentication → Providers*: **Email** genügt. Alles andere aus.

> Die Anwendung meldet mit Magic Link an und setzt dabei `shouldCreateUser: false`: Wer
> kein Profil hat, bekommt keinen Link — auch dann nicht, wenn er die richtige Adresse
> errät. Neue Mitglieder kommen ausschließlich über eine Einladung oder den Vereinscode
> herein. Das ist die Hintertür, die es bewusst nicht gibt.

**E-Mail-Vorlagen:** Unter *Authentication → Email Templates* stehen die Standardtexte von
Supabase, auf Englisch. Die Anmelde-Mail ist die erste, die ein Mitglied je sieht — es
lohnt, sie einmal auf Deutsch zu bringen.

☐ Erledigt am: ________

## 2.8 Anwendung ausliefern

GitHub → *Actions* → **Deploy to GitHub Pages** → *Run workflow*.

Danach die Domain auf GitHub Pages zeigen lassen (*Settings → Pages → Custom domain*) und
**HTTPS erzwingen** abhaken.

> **Ohne HTTPS gibt es keinen Service Worker, kein Push und keine Installation als App.**
> Das ist keine Empfehlung, das ist eine Browser-Regel.

Wenn alles läuft, in `.github/workflows/deploy.yml` und `deploy-supabase.yml` den
auskommentierten `push`-Auslöser aktivieren. Der Kommentar in den Dateien erklärt, warum er
bisher aus war.

☐ Anwendung erreichbar unter: ____________________

---

# Teil 3 — Erster Start

## 3.1 Ersten Administrator anlegen

Es gibt keine Hintertür und keinen automatischen ersten Benutzer. Im SQL-Editor:

```sql
INSERT INTO public.profiles (first_name, last_name, email, role, status)
VALUES ('Vorname', 'Nachname', 'admin@verein.de', 'admin', 'unconfirmed');
```

Dann auf der Anmeldeseite genau diese Adresse eingeben. Der Trigger `handle_new_user()`
verknüpft beim ersten Login das vorhandene Profil und setzt es auf `active`.

**Kommt keine Mail:** Das ist der erste echte Test der ganzen Kette. Siehe
[Anhang B, Prompt 3](#prompt-3--keine-e-mail-kommt-an).

☐ Angemeldet am: ________

## 3.2 Vereinsdaten ausfüllen

Angemeldet als Administrator, unter **Verein → Daten**:

| Feld | Achtung |
|---|---|
| Name, Kurzname | — |
| **Weitere Schreibweisen** | ⚠️ **Daran erkennt der Spielimport eure Heimspiele.** Trag jede Form ein, in der click-TT euren Verein schreibt. Fehlt sie, stehen halbe Spielpläne auf auswärts |
| **Bundesland** | ⚠️ Steuert Feiertage und Ferien. Fehlt es, fällt kein Training an einem Feiertag aus |
| Standardort | erst nach Teil 4 setzbar |
| Vereinscode | für die Selbstregistrierung per QR-Code |

Unter **Verein → Betrieb → Einstellungen**:

- Absendername und -adresse (muss zur Resend-Domain passen)
- **Adresse der Anwendung** — ohne sie führt kein Link aus einer Benachrichtigung irgendwohin
- Vorlauf der Erinnerungen
- Datenschutzhinweis und Impressum — siehe [Teil 5](#teil-5--rechtliches)

☐ Erledigt am: ________

## 3.3 Der Probelauf

**Nicht überspringen.** Bis hierher ist nichts davon je in echt gelaufen — die Anwendung ist
gegen eine nachgebaute Testdatenbank geprüft, nicht gegen Supabase.

Der Reihe nach, jeweils mit Blick auf **Verein → Betrieb**:

| # | Was | Erwartung | Wenn nicht |
|---|---|---|---|
| 1 | Zweites Mitglied anlegen und einladen | E-Mail kommt an; unter *Benachrichtigungen* steht `sent` | [Prompt 3](#prompt-3--keine-e-mail-kommt-an) |
| 2 | Mannschaft anlegen, **Spieltermine → Spiele importieren** mit einer echten click-TT-Adresse | Unter *Kalenderabgleich* ein Lauf mit „n neu"; Heim/Auswärts stimmt | [Prompt 4](#prompt-4--spielplan-kommt-nicht-an-oder-heimauswärts-stimmt-nicht) |
| 3 | Training anlegen | Termine für die nächsten Wochen erscheinen sofort | [Prompt 5](#prompt-5--trainingstermine-erscheinen-nicht-oder-auf-falschen-tagen) |
| 4 | Auf dem Handy die Glocke drücken | Glocke wird grün, Testnachricht kommt an | [Prompt 6](#prompt-6--push-funktioniert-nicht) |
| 5 | Kalender abonnieren (*Kalender → Abonnieren*) | Termine erscheinen im eigenen Kalenderprogramm | meist `verify_jwt`, siehe [2.1](#21-supabase-cli-verbinden) |
| 6 | **Am nächsten Morgen** nachsehen | Unter *Jobs* hat jeder der sechs einen Lauf der Nacht | [Prompt 7](#prompt-7--ein-cron-job-läuft-nicht) |

Punkt 6 lässt sich nicht beschleunigen. Plane den Probelauf so, dass ein Tag dazwischen
liegt.

☐ Alle sechs Punkte grün am: ________

---

# Teil 4 — Daten hineinbekommen

## 4.1 Schulferien nachladen

Die gesetzlichen Feiertage 2026–2028 für alle sechzehn Länder sind eingebaut — die lassen
sich rechnen. **Die Schulferien fehlen**, sie müssen von einer Schnittstelle kommen:

```bash
npm run import:holidays          # erzeugt eine neue Migration
git add supabase/migrations/ && git commit -m "Schulferien nachgeladen"
npx supabase db push
```

Braucht Netzzugang zu `ferien-api.de`. Nur nötig, wenn ein Training *„Schulferien
überspringen"* nutzen soll — was praktisch jedes Jugendtraining will.

☐ Erledigt am: ________

## 4.2 Die Reihenfolge, die nicht beliebig ist

→ **Vollständig in [`migration.md`](migration.md).** Hier nur der Grund, warum die
Reihenfolge zählt:

```
Orte  →  Gruppen  →  Trainings  →  MITGLIEDER-IMPORT  →  Mannschaften  →  Kader
```

Der Mitglieder-Import ordnet Gruppen und Trainings **über ihren Namen** zu. Was er nicht
findet, überspringt er — **ohne Fehlermeldung**. Wer zuerst importiert und danach die
Gruppen anlegt, hat 80 Mitglieder ohne jede Zuordnung und merkt es erst, wenn sich jemand
wundert.

Rechne mit etwa 2,5 Stunden. Die Checkliste in `migration.md` hat 25 Punkte.

☐ Datenübernahme abgeschlossen am: ________

---

# Teil 5 — Rechtliches

**Das läuft parallel zu Teil 2–4 und muss vor der ersten Einladung fertig sein.** Nicht,
weil eine Behörde es prüft, sondern weil die Registrierungsseite den Datenschutzhinweis
verlinkt und ohne ihn verschweigt, was mit den Daten passiert.

| # | Was | Wer | Dauer |
|---|---|---|---|
| 5.1 | **AV-Vertrag mit Supabase** abschließen (Rechtsdokumente im Konto) | Vorstand | 1 Tag |
| 5.2 | **AV-Vertrag mit Resend** abschließen; vorher Data-Privacy-Framework-Status prüfen | Vorstand | 1 Tag |
| 5.3 | **Datenschutzhinweis** fertigstellen: Platzhalter in `docs/datenschutz/datenschutzhinweis.md` füllen, veröffentlichen | Vorstand | 1 Woche |
| 5.4 | Die **URL** unter *Verein → Betrieb → Einstellungen* eintragen | Administrator | 2 min |
| 5.5 | **Impressum** verlinken | Vorstand | 5 min |
| 5.6 | `docs/datenschutz/verarbeitungsverzeichnis.md` in die Vereinsunterlagen | Vorstand | — |
| 5.7 | Unterlagen **prüfen lassen** | Vorstand | variabel |

> Die Entwürfe in `docs/datenschutz/` sind sorgfältig und decken die tatsächliche
> Verarbeitung ab — aber sie sind keine Rechtsberatung. Bei Mitgliedern unter 16 ist die
> Einwilligung der Erziehungsberechtigten für die freiwilligen Angaben einzuholen; das steht
> im Hinweis, muss aber auch wirklich passieren.

☐ Datenschutzhinweis veröffentlicht unter: ____________________

---

# Teil 6 — Menschen dazuholen

## 6.1 Einladen — in dieser Reihenfolge

*Mitglieder → Mitglieder hinzufügen → Per E-Mail einladen*

1. **Administratoren und Mannschaftsführer.** Sie prüfen Mannschaften, Kader, Spielpläne.
   Warte, bis sie nichts mehr melden.
2. **Trainer.** Sie prüfen Trainings und Termine.
3. **Alle übrigen.**

Nicht alle auf einmal. Eine halb gefüllte Anwendung, auf die 80 Leute gleichzeitig treffen,
erzeugt 80 identische Rückfragen an denselben Menschen.

## 6.2 Was du vorher ankündigen musst

Eine Woche vorher, in dem Kanal, den ohnehin alle lesen. Drei Sätze reichen:

> Ab dem **[Datum]** zählt nur noch, was im Vereinsplaner steht. Der TT-Planer läuft noch
> als Rückfallebene, wird aber nicht mehr gepflegt.
> **Der Chat kommt nicht mit** — wer dort etwas Wichtiges stehen hat, holt es jetzt heraus.
> Auch nicht mitkommen: vergangene Spiele und Rückmeldungen, Trainingsstatistik-Historie,
> Arbeitszeiten, Bekleidung, Profilfotos.

Die vollständige Liste steht in [`migration.md`](migration.md) §6.

☐ Angekündigt am: ________

## 6.3 Parallelbetrieb

→ **[`parallelbetrieb.md`](parallelbetrieb.md).** Vier Wochen, Z1–Z11 als Nachweistabellen,
wöchentlich fünfzehn Minuten Kontrolle, Feedback-Umfrage in Woche 3.

Die eine Regel, die den Unterschied macht: **Der Vereinsplaner ist das führende System, der
TT-Planer ist das Netz.** Beide zu pflegen ist doppelte Arbeit, und daran scheitern die
meisten Parallelbetriebe.

☐ Start: ________ ☐ Ende: ________ ☐ Entscheidung: ________

---

# Teil 7 — Abschluss

→ **[`abschluss.md`](abschluss.md).** Kurzfassung der Reihenfolge:

1. **Retten, was nur im TT-Planer liegt** — vor der Kündigung. Danach ist der Zugang weg.
   Besonders: die Spalte *Anmelden als* (wird für Aufgabe 9.10 gebraucht und existiert sonst
   nirgends), Arbeitszeiten, Bekleidung, Trainingsstatistik-Historie.
2. **Kündigen**, in der geforderten Form, mit Bitte um Löschbestätigung nach Art. 17 DSGVO.
3. **Eingangsbestätigung abwarten.** Ohne sie ist eine Kündigung im Streitfall nicht zugegangen.
4. **Eigene `LICENSE`** festlegen — fällig unabhängig von allem anderen.
5. **Release `v1.0.0`** taggen.

☐ Gekündigt am: ________ ☐ Bestätigung erhalten am: ________

---
---

# Anhang A — Wenn du eine KI um Hilfe bittest

Bei fast jedem Schritt oben kann etwas schiefgehen, das hier nicht steht. Eine KI ist dafür
ein gutes Werkzeug — **wenn du sie richtig fütterst.** Die meisten nutzlosen Antworten
entstehen nicht, weil das Modell schlecht ist, sondern weil es raten muss.

## A.1 Der Steckbrief — einmal kopieren, immer voranstellen

Leg dir diesen Block irgendwo ab und setz ihn **vor jede Frage**. Er beantwortet
vorweg, was sonst zurückgefragt oder falsch geraten wird:

```
KONTEXT — Vereinsplaner (Tischtennisverein, ~80 Mitglieder)

Stack:
- Frontend: React 18 + TypeScript (strict) + Vite 5 + Tailwind, ausgeliefert
  über GitHub Pages als PWA (vite-plugin-pwa, injectManifest)
- Backend: Supabase Cloud, Region Frankfurt
  - PostgreSQL 15/16, 31 Migrationen, Row Level Security auf JEDER Tabelle
    in `public`, ~84 Policies mit auth.uid()
  - Auth: Supabase GoTrue, ausschließlich Magic Link (Email),
    shouldCreateUser: false
  - 7 Edge Functions (Deno): invite-member, sync-calendars,
    process-notifications, enqueue-reminders, substitute-engine,
    generate-training-sessions, calendar-feed
  - pg_cron + pg_net für 6 zeitgesteuerte Jobs
  - KEIN Realtime, KEIN Storage
- E-Mail: Resend (eigene verifizierte Domain)
- Push: Web Push mit VAPID, eigene Implementierung (npm:web-push in Deno)
- Datenzugriff im Frontend ausschließlich über supabase-js (PostgREST),
  TanStack Query v5

Besonderheiten, die oft relevant sind:
- Alle Zeiten werden in Europe/Berlin gerechnet (date-fns-tz), in der DB
  als timestamptz gespeichert
- Ein Schema `private` existiert und wird von PostgREST NICHT veröffentlicht
  (dort liegt u.a. cron_config)
- Die Rolle service_role umgeht RLS und wird nur in Edge Functions benutzt
- Die Anwendung ist einsprachig deutsch
```

## A.2 Die fünf Dinge, die in jede Frage gehören

Eine brauchbare Frage hat immer diese fünf Teile. Fehlt einer, rät das Modell:

| # | Teil | Beispiel für „schlecht" → „gut" |
|---|---|---|
| 1 | **Was ich getan habe** | „Ich hab deployed" → „`npx supabase functions deploy sync-calendars` auf macOS, CLI-Version 2.x" |
| 2 | **Was ich erwartet habe** | „Es sollte gehen" → „Unter *Verein → Betrieb → Kalenderabgleich* sollte ein Lauf mit ‚n neu' erscheinen" |
| 3 | **Was tatsächlich passiert ist — wörtlich** | „Fehler" → die **vollständige Fehlermeldung**, kopiert, nicht abgetippt, nicht gekürzt |
| 4 | **Was ich schon probiert habe** | — → „Erweiterungen sind an, `SELECT * FROM cron.job` zeigt 6 Zeilen, der manuelle Aufruf der Function per curl gibt 401" |
| 5 | **Was ich *nicht* tun will** | — → „Bitte keine Lösung, die RLS abschaltet oder eine Policy auf `true` setzt" |

Punkt 5 ist der wichtigste und wird fast immer vergessen. Ohne ihn bekommst du mit hoher
Wahrscheinlichkeit die schnellste Lösung, nicht die richtige — und die schnellste Lösung
für ein RLS-Problem ist immer, RLS auszuschalten.

## A.3 Wie du eine Antwort prüfst, bevor du sie ausführst

Eine KI schreibt überzeugend formulierten Unsinn genauso flüssig wie eine richtige Antwort.
**Diese Prüfung kostet zwei Minuten und kann euch die Mitgliederdaten retten.**

### 🚩 Rote Flaggen — ausführen: nein, nachfragen: ja

| Vorschlag | Warum das ein Problem ist |
|---|---|
| `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` | Macht die Tabelle für **jeden angemeldeten Benutzer** vollständig lesbar. Das ist nie die Lösung |
| `CREATE POLICY ... USING (true)` | Dasselbe mit mehr Schritten |
| `GRANT ... TO anon` | `anon` ist **jeder im Internet ohne Anmeldung** |
| Der `service_role`-Schlüssel im Frontend / in `.env` mit `VITE_`-Präfix | Alles, was `VITE_` heißt, landet im Browser-Bundle und ist damit öffentlich |
| `DROP TABLE`, `TRUNCATE`, `DELETE FROM ... ` ohne `WHERE` | Wenn du das nicht ausdrücklich wolltest: nein |
| „Lösch einfach die Migration und mach eine neue" | Migrationen, die schon gelaufen sind, werden **ergänzt**, nicht geändert |
| Ein neues VAPID-Schlüsselpaar als Lösung für ein Push-Problem | Macht alle bestehenden Anmeldungen kaputt. Fast nie nötig |

### ✅ Vor dem Ausführen von SQL

1. **Lass es dir erklären.** *„Erklär mir Zeile für Zeile, was diese Anweisung tut und was
   passiert, wenn ich sie zweimal ausführe."* Wer nicht erklären kann, hat geraten.
2. **Frag nach dem Rückweg.** *„Wie mache ich das rückgängig?"* Gibt es keinen, ist es keine
   Sache für die Produktivdatenbank.
3. **Erst lesen, dann schreiben.** Jedes `UPDATE` und `DELETE` lässt sich vorher als
   `SELECT` mit demselben `WHERE` ausführen. Sieh dir an, was betroffen wäre:

   ```sql
   -- statt sofort:  DELETE FROM notifications WHERE status = 'failed';
   SELECT count(*) FROM notifications WHERE status = 'failed';
   ```
4. **Bei allem, was Daten ändert: vorher sichern.** GitHub → *Actions* →
   *Wöchentliche Datenbanksicherung* → *Run workflow*. Dauert eine Minute.

### ✅ Vor dem Übernehmen von Code

- Läuft `npx tsc --noEmit` noch sauber durch?
- Läuft `npx vitest run` noch grün? (933 Tests — wenn danach 932 grün sind, hat der
  Vorschlag etwas kaputt gemacht)
- Passt der Stil zum Rest? Diese Codebasis erklärt in Kommentaren das **Warum**, nicht das
  **Was**. Ein Vorschlag mit `// increment counter` gehört umgeschrieben.

## A.4 Welche Dateien du mitgeben solltest

Bei Fragen zu … | … gib mit
---|---
Datenbank, RLS, Policies | die betroffene Datei aus `supabase/migrations/`, plus `docs/datenbank.md`
einer Edge Function | `supabase/functions/<name>/index.ts` und alles aus `_shared/`, was sie importiert
Benachrichtigungen | `supabase/migrations/20261006000000_notifications.sql` und `supabase/functions/process-notifications/index.ts`
Cron / Jobs | `docs/betrieb.md` §2–6 und die Ausgabe von `SELECT * FROM cron.job`
Frontend-Verhalten | die Komponente plus die zugehörige `api.ts` im selben Ordner
Einrichtung | diese Datei und `docs/einrichtung.md`

**Ein Hinweis zur Größe:** Lieber die eine richtige Datei vollständig als zehn Dateien
angerissen. Ein abgeschnittener Ausschnitt führt zuverlässig zu einer Antwort, die auf den
fehlenden Teil nicht passt.

---

# Anhang B — Fertige Prompts

Jeder Prompt setzt den **Steckbrief aus A.1** voraus — stell ihn voran. Die eckigen Klammern
sind auszufüllen.

## Prompt 1 — `supabase db push` schlägt fehl

```
[STECKBRIEF]

PROBLEM
`npx supabase db push` bricht ab.

Vollständige Ausgabe:
[HIER DIE KOMPLETTE AUSGABE EINFÜGEN, NICHT GEKÜRZT]

Die betroffene Migration:
[INHALT DER GENANNTEN DATEI AUS supabase/migrations/]

Was ich schon geprüft habe:
- pg_cron und pg_net sind eingeschaltet: [ja/nein]
- Es ist der erste Lauf gegen eine leere Datenbank: [ja/nein]
- Frühere Migrationen liefen durch: [ja/nein, welche als letzte]

FRAGE
Woran liegt der Abbruch, und wie bekomme ich die Migration durch, OHNE
bereits eingespielte Migrationen zu verändern? Die Dateien sind idempotent
geschrieben (CREATE ... IF NOT EXISTS, DO $$-Blöcke mit Existenzprüfung) —
falls das an einer Stelle nicht stimmt, sag mir welche.

WAS ICH NICHT WILL
Keine Lösung, die eine bereits gelaufene Migration nachträglich ändert oder
die Datenbank zurücksetzt. Falls das der einzige Weg ist, sag es deutlich
und begründe es.
```

## Prompt 2 — Eine RLS-Policy blockiert etwas, das erlaubt sein sollte

```
[STECKBRIEF]

PROBLEM
Ein Benutzer mit der Rolle [admin/team_leader/trainer/organizer/member/guest]
kann [WAS ER TUN WOLLTE] nicht. Erwartet hätte ich, dass es geht.

Fehlermeldung in der Browser-Konsole / im Netzwerk-Tab:
[WÖRTLICH]

Die betroffene Tabelle und ihre Policies:
[AUSGABE VON:]
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_ausdruck
  FROM pg_policy
 WHERE polrelid = 'public.[TABELLE]'::regclass;

Die Migration, in der die Tabelle definiert ist:
[DATEIINHALT]

FRAGE
Welche Policy greift hier, und warum lässt sie den Fall nicht durch?
Erklär mir zuerst die Auswertung Schritt für Schritt, bevor du eine
Änderung vorschlägst.

WAS ICH NICHT WILL
Keine Lösung, die RLS abschaltet, eine Policy auf `USING (true)` setzt oder
Rechte an `anon` vergibt. In dieser Datenbank liegen Daten von Minderjährigen.
Die Policy soll GENAU den beschriebenen Fall zulassen und sonst nichts.
```

## Prompt 3 — Keine E-Mail kommt an

```
[STECKBRIEF]

PROBLEM
Ich habe [ein Mitglied eingeladen / mich anzumelden versucht], es kommt
keine E-Mail an. Auch nicht im Spam.

Was die Anwendung sagt (Verein → Betrieb → Benachrichtigungen, Filter
„Nur Probleme"):
[ZEILE(N) MIT status, attempts UND last_error]

Was Resend sagt (Dashboard → Logs):
[EINTRAG ODER "kein Eintrag vorhanden"]

Geprüft:
- Resend-Domain steht auf verified: [ja/nein]
- Absenderadresse unter Verein → Betrieb → Einstellungen: [ADRESSE]
- Diese Adresse liegt auf der verifizierten Domain: [ja/nein]
- RESEND_API_KEY ist als Supabase-Secret gesetzt: [ja/nein]
- Es geht um: [eine Anmelde-Mail von Supabase Auth] / [eine Benachrichtigung
  aus process-notifications]

FRAGE
An welcher Stelle der Kette bleibt es hängen? Gib mir eine
Eingrenzungsreihenfolge vom Billigsten zum Teuersten, nicht sofort eine
Vermutung.

HINWEIS
Anmelde-Mails und Benachrichtigungen nehmen VERSCHIEDENE Wege:
Anmelde-Mails verschickt Supabase Auth selbst, Benachrichtigungen die Edge
Function process-notifications über Resend. Wenn nur eines von beidem
betroffen ist, ist das die wichtigste Information.
```

## Prompt 4 — Spielplan kommt nicht an, oder Heim/Auswärts stimmt nicht

```
[STECKBRIEF]

PROBLEM
[Es erscheinen keine Spieltermine / Spiele stehen auf auswärts, obwohl sie
Heimspiele sind / einzelne Spiele fehlen]

Die Webcal-URL der Mannschaft:
[URL — die ist nicht geheim]

Was der Abgleich sagt (Verein → Betrieb → Kalenderabgleich):
[LETZTER LAUF MIT ALLEN ZAHLEN UND FEHLERTEXT]

Vereinsdaten:
- Vereinsname: [NAME]
- Weitere Schreibweisen (club_aliases): [INHALT DES FELDES]
- Mannschaftsname in der Anwendung: [NAME]
- So schreibt click-TT die Mannschaft im Kalendertitel: [TITEL EINES SPIELS]

Die Logik steckt in supabase/functions/_shared/homeAway.ts:
[DATEIINHALT]

FRAGE
[Warum kommt nichts an? / Warum ordnet determineHomeAway das falsch zu, und
welche Aliase müsste ich eintragen, damit es stimmt?]

HINWEIS
Heim/Auswärts wird ausschließlich daran erkannt, ob einer der Aliase im
linken oder rechten Teil des Titels „X vs Y" vorkommt. Passt keine Seite,
nimmt die Funktion bewusst ein Heimspiel an. Der Fix ist deshalb fast immer
ein Eintrag im Feld „Weitere Schreibweisen", keine Codeänderung.
```

## Prompt 5 — Trainingstermine erscheinen nicht oder auf falschen Tagen

```
[STECKBRIEF]

PROBLEM
[Nach dem Anlegen eines Trainings erscheinen keine Termine /
die Termine stehen auf den falschen Tagen /
ein Feiertag oder Ferientag wurde nicht übersprungen]

Das Training:
- Wochentag: [X], Beginn: [X], Rhythmus: [wöchentlich/zweiwöchentlich/monatlich]
- Startdatum: [X]
- Ort: [X]
- Schulferien überspringen: [ja/nein]

Bundesland unter Verein → Daten: [X]

Was in der Datenbank steht:
SELECT date, status FROM training_sessions
 WHERE training_id = '[ID]' ORDER BY date LIMIT 20;
[AUSGABE]

Sind Ferien überhaupt vorhanden?
SELECT kind, count(*) FROM holidays WHERE bundesland = '[X]' GROUP BY kind;
[AUSGABE]

FRAGE
Warum [erscheinen keine / stehen sie falsch]?

HINWEIS
Zwei bekannte Ursachen zuerst prüfen:
1. Das Startdatum legt bei zweiwöchentlichem Rhythmus fest, welche Woche die
   „gerade" ist. Ein falsches Startdatum verschiebt alles um eine Woche.
2. Die Schulferien sind NICHT eingebaut — sie müssen mit
   `npm run import:holidays` nachgeladen werden. Wenn die zweite Abfrage oben
   keine Zeile mit kind='school' liefert, ist das die Ursache.
```

## Prompt 6 — Push funktioniert nicht

```
[STECKBRIEF]

PROBLEM
[Die Glocke wird nicht grün / sie ist grün, aber es kommt nichts an]

Gerät und Browser: [iPhone 14, iOS 17, Safari / Android, Chrome 120 / ...]
Ist die App zum Home-Bildschirm hinzugefügt: [ja/nein]
Die Anwendung läuft über HTTPS: [ja/nein]

Browser-Konsole beim Drücken der Glocke:
[WÖRTLICH]

Was die Anwendung sagt (Verein → Betrieb → Benachrichtigungen, Kanal „push"):
[ZEILEN MIT status UND last_error]

VAPID:
- VITE_VAPID_PUBLIC_KEY ist beim Bauen gesetzt gewesen: [ja/nein]
- VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY sind als Supabase-Secrets gesetzt: [ja/nein]
- Der öffentliche Schlüssel ist an beiden Stellen IDENTISCH: [ja/nein]

FRAGE
Woran liegt es?

HINWEIS
Auf iOS funktioniert Web Push NUR, wenn die Anwendung vorher über
„Teilen → Zum Home-Bildschirm" installiert wurde. Im normalen Safari-Tab
gibt es kein Push — das ist eine Einschränkung von Apple, kein Fehler
der Anwendung.

WAS ICH NICHT WILL
Keine Lösung, die ein neues VAPID-Schlüsselpaar erzeugt. Das würde alle
bestehenden Anmeldungen der anderen Mitglieder unbrauchbar machen.
```

## Prompt 7 — Ein Cron-Job läuft nicht

```
[STECKBRIEF]

PROBLEM
Der Job [NAME] hat [keinen Lauf / nur fehlgeschlagene Läufe].

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
[AUSGABE — ES SOLLTEN 6 ZEILEN SEIN]

SELECT j.jobname, d.status, d.start_time, d.return_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
 ORDER BY d.start_time DESC LIMIT 20;
[AUSGABE]

SELECT key, CASE WHEN key = 'cron_secret' THEN '(gesetzt: ' ||
       (value <> '')::text || ')' ELSE value END
  FROM private.cron_config;
[AUSGABE — DEN SECRET-WERT NICHT ZEIGEN]

FRAGE
Warum läuft der Job nicht durch?

HINWEIS
Der Weg ist: pg_cron ruft eine Funktion in `private` auf, diese ruft über
pg_net die Edge Function auf und schickt dabei das cron_secret mit. Die
Function vergleicht es. Häufigste Ursachen in dieser Reihenfolge:
1. pg_cron oder pg_net nicht eingeschaltet (dann stehen 0 Jobs da)
2. functions_base_url in private.cron_config falsch oder leer
3. cron_secret leer
4. Die Edge Function ist gar nicht ausgerollt
```

## Prompt 8 — Der Excel-Import macht nicht, was er soll

```
[STECKBRIEF]

PROBLEM
Beim Import über Mitglieder → Excel Import & Update
[bleiben Gruppen/Trainings leer / stehen Zeilen unter „Mehrdeutig" /
 gibt es Probleme in Spalte X / wird jemand doppelt angelegt]

Die Vorschau zeigt:
Anlegen: [N] | Aktualisieren: [N] | Mehrdeutig: [N] | Probleme: [N]

Die gemeldeten Probleme:
[ZEILE, SPALTE, TEXT — WÖRTLICH]

Eine betroffene Zeile aus der Datei (Namen geändert):
[SPALTENÜBERSCHRIFTEN UND WERTE]

Die Import-Logik: src/features/members/excel.ts
[BEI BEDARF DATEIINHALT]

FRAGE
Warum verhält sich der Import so, und wie muss ich die Datei ändern?

HINWEIS
- Gruppen und Trainings werden über den NAMEN zugeordnet. Was nicht existiert,
  wird STILLSCHWEIGEND übersprungen — sie müssen vor dem Import angelegt sein.
- Zugeordnet wird in der Reihenfolge: E-Mail → Mitgliedsnummer → voller Name.
- „Mehrdeutig" heißt: Die Zeile passt auf mehrere vorhandene Mitglieder.
  Die wird bewusst nicht angefasst.

WAS ICH NICHT WILL
Keine Änderung am Import-Code, bevor nicht klar ist, dass es wirklich ein
Fehler ist und nicht meine Datei.
```

## Prompt 9 — Etwas läuft lokal, aber nicht in Supabase

```
[STECKBRIEF]

PROBLEM
[BESCHREIBUNG] funktioniert gegen die lokale Testdatenbank, aber nicht gegen
Supabase.

Lokal: PostgreSQL 16 nativ + scripts/supabase-compat.sql
Dort: Supabase Cloud, Frankfurt

Fehlermeldung in Supabase:
[WÖRTLICH]

FRAGE
Was unterscheidet die beiden Umgebungen an dieser Stelle?

HINWEIS
scripts/supabase-compat.sql bildet nur nach, was die Migrationen brauchen:
die Rollen anon/authenticated/service_role, das Schema auth mit auth.users
und auth.uid()/auth.role()/auth.email(), pgcrypto und pgtap.

NICHT nachgebildet sind unter anderem:
- echtes GoTrue-Verhalten (Trigger auf auth.users, JWT-Inhalte)
- PostgREST (lokal wird direkt per psql zugegriffen, dort über die API)
- pg_cron und pg_net
- Storage, Realtime
- Supabase-eigene Rollen wie supabase_admin, authenticator

Die Ursache liegt mit hoher Wahrscheinlichkeit in einem dieser Punkte.
```

## Prompt 10 — Der Universalfall

Wenn nichts oben passt:

```
[STECKBRIEF]

WAS ICH ERREICHEN WILL
[Ziel in einem Satz — nicht die vermutete Lösung, sondern das Ziel]

WAS ICH GETAN HABE
[Schritt für Schritt, mit den genauen Befehlen oder Klicks]

WAS ICH ERWARTET HABE
[konkret]

WAS PASSIERT IST
[wörtlich — Fehlermeldung, Screenshot-Beschreibung, Datenbankausgabe]

WAS ICH SCHON AUSGESCHLOSSEN HABE
[Liste]

RELEVANTE DATEIEN
[Inhalte, nicht nur Namen]

FRAGE
Nenn mir zuerst die drei wahrscheinlichsten Ursachen mit je einem Satz,
wie ich sie in unter fünf Minuten prüfe. Erst wenn ich dir sage, welche
zutrifft, schlag eine Lösung vor.

WAS ICH NICHT WILL
- Keine Änderung an Row Level Security
- Keine Lösung, die ich nicht rückgängig machen kann
- Keine Vermutung, die als Tatsache formuliert ist — sag mir, wenn du rätst
```

> Der Schluss von Prompt 10 — *„erst die drei wahrscheinlichsten Ursachen, dann prüfen,
> dann Lösung"* — ist die wirksamste einzelne Zeile in diesem ganzen Anhang. Sie verhindert,
> dass du die erste plausible Vermutung umsetzt und dabei etwas anderes kaputt machst.

---

# Anhang C — Was niemals in einen Prompt gehört

Ein Prompt geht an einen fremden Dienst. Er wird übertragen, möglicherweise gespeichert,
möglicherweise ausgewertet. Behandle ihn wie eine öffentliche Postkarte.

## 🔴 Niemals

| Was | Warum |
|---|---|
| **`service_role`-Schlüssel** | Vollzugriff auf alle Mitgliederdaten unter Umgehung jeder Regel |
| **Datenbank-Passwort** | dito, plus Schreibrechte auf das Schema |
| **`RESEND_API_KEY`** | Fremde können in eurem Namen E-Mails an eure Mitglieder schicken |
| **`VAPID_PRIVATE_KEY`** | Fremde können Push-Nachrichten an eure Mitglieder schicken |
| **`SUPABASE_ACCESS_TOKEN`** | Vollzugriff auf das Supabase-Konto |
| **Der Vereinscode** | Damit registriert sich jeder selbst |
| **Echte Mitgliederdaten** | Namen, Adressen, Geburtsdaten, Telefonnummern, E-Mail-Adressen |
| **Abwesenheitsgründe** | Die sieht in der Anwendung bewusst niemand außer der Person selbst — auch kein Administrator. Sie gehören erst recht nicht in einen Prompt |

## 🟡 Nur anonymisiert

Wenn du eine Fehlermeldung mit echten Daten hast, ersetze sie **konsequent**, nicht
teilweise:

```
Erika Mustermann, erika.m@gmail.com, 06.05.1988, 0170 1234567
→
Vorname1 Nachname1, person1@example.org, 01.01.1990, 0000 0000000
```

⚠️ **„Nur der Vorname ist doch harmlos"** stimmt in einem Verein mit 80 Leuten nicht.
Vorname plus Mannschaft plus Geburtsjahr identifiziert eine Person eindeutig.

## 🟢 Unbedenklich

- Der **anon**-Schlüssel und die **Project URL** (stehen ohnehin im Browser-Bundle)
- **Webcal-URLs** von click-TT (öffentliche Spielpläne)
- Jeder **Quelltext** aus diesem Repository
- **Schema, Policies, Migrationen**
- **Fehlermeldungen ohne personenbezogene Daten**
- Diese Dokumentation

## Wenn doch etwas rausgerutscht ist

Nicht hoffen, sondern drehen. Sofort:

| Was | Wo |
|---|---|
| `service_role` / `anon` | Supabase → *Project Settings → API → Rotate* |
| DB-Passwort | Supabase → *Project Settings → Database → Reset password* |
| Resend-Key | Resend → *API Keys* → alten löschen, neuen erzeugen |
| Access Token | Supabase → *Account → Access Tokens* → widerrufen |
| Vereinscode | in der Anwendung unter *Verein → Daten* neu setzen |
| **VAPID** | ⚠️ Rotation macht alle Push-Anmeldungen unbrauchbar. Abwägen — und wenn doch, den Mitgliedern **vorher sagen**, dass sie die Glocke neu drücken müssen |

Danach die neuen Werte überall nachziehen: Supabase-Secrets, GitHub-Secrets, und einmal neu
bauen und ausliefern.

---

# Anhang D — Zettel zum Ausfüllen

Ausdrucken oder ins Passwortdepot. **Die Geheimnisse gehören nicht hierher** — hier steht
nur, *wo* sie liegen.

## Fristen

| | Wert |
|---|---|
| TT-Planer, Vertragsbeginn | |
| TT-Planer, Vertragsende | |
| Kündigungsfrist | |
| **Letzter möglicher Kündigungstag** | |
| Form der Kündigung | |
| Im Kalender eingetragen am | |

## Zugänge

| | Wert | Geheimnis liegt in |
|---|---|---|
| Domain | | |
| Supabase-Projekt-ID | | |
| Supabase Project URL | | |
| Supabase anon key | | |
| Supabase service_role | *(geheim)* | |
| DB-Passwort | *(geheim)* | |
| Resend-Absenderadresse | | |
| Resend API Key | *(geheim)* | |
| VAPID public | | |
| VAPID private | *(geheim)* | |
| Adresse der Anwendung | | |

## Wer macht was

| Rolle | Name | Erreichbar |
|---|---|---|
| Betreiber | | |
| Administrator | | |
| Administrator (Vertretung) | | |
| Vorstand / Verträge | | |

## Fortschritt

| Teil | Erledigt am |
|---|---|
| 0 — Frist geprüft | |
| 1 — Konten | |
| 2 — Technik | |
| 3 — Probelauf (alle 6 Punkte) | |
| 4 — Daten übernommen | |
| 5 — Datenschutzhinweis veröffentlicht | |
| 6 — Alle eingeladen | |
| 6 — Parallelbetrieb Start | |
| 6 — Parallelbetrieb Ende | |
| 7 — Gekündigt | |
| 7 — Bestätigung erhalten | |
| 7 — `v1.0.0` getaggt | |

---

*Wenn etwas in dieser Anleitung nicht stimmt, gehört es korrigiert — nicht umgangen. Der
nächste Mensch, der das hier liest, ist vermutlich du in zwei Jahren.*
