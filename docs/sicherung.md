# Datensicherung einrichten — Schritt für Schritt

**Was am Ende läuft:** Jeden Sonntag um 04:30 UTC (06:30 Uhr im Sommer) sichert GitHub die
ganze Datenbank, verschlüsselt sie und legt sie an **zwei** Orten ab:

1. als Artefakt im GitHub-Repository (90 Tage),
2. in deinem **Google Drive** im Ordner `Vereinsplaner-Sicherungen` (90 Tage, einstellbar).

Verschlüsselt wird mit [age](https://age-encryption.org), bevor die Datei den Runner
verlässt. Weder GitHub noch Google können sie lesen — nur wer den **privaten Schlüssel**
hat, und der liegt ausschließlich bei dir.

Supabase selbst sichert im Free-Tarif nichts, was man zurückspielen könnte. Diese
Sicherung ist deshalb die einzige.

Dauer der Einrichtung: etwa 20 Minuten. Du brauchst einen Rechner (Windows oder macOS),
Zugang zu GitHub, Supabase und Google.

---

## Schritt 1 — Programme installieren (einmalig)

**Windows** — PowerShell öffnen (Startmenü → „PowerShell"):

```powershell
winget install FiloSottile.age
winget install Rclone.Rclone
```

Danach PowerShell **schließen und neu öffnen**, sonst findet sie die Programme nicht.

**macOS** — Terminal öffnen:

```bash
brew install age rclone
```

(Ohne Homebrew: <https://brew.sh> — die eine Zeile von dort ausführen, dann obiges.)

---

## Schritt 2 — Schlüsselpaar erzeugen

Im selben Fenster:

```
age-keygen -o vereinsplaner-sicherung.key
```

Ausgabe:

```
Public key: age1qz…(lange Zeichenkette)
```

- Die Zeile **`age1…`** ist der **öffentliche** Schlüssel. Den brauchst du gleich in GitHub.
  Er darf überall stehen.
- Die Datei **`vereinsplaner-sicherung.key`** ist der **private** Schlüssel. Er öffnet
  jede Sicherung.

> ⚠️ **Den privaten Schlüssel an zwei sicheren Orten aufbewahren** — zum Beispiel im
> Passwortmanager (Datei öffnen, Inhalt als Notiz speichern) und ausgedruckt im
> Vereinsordner. **Nicht** in GitHub, **nicht** in Google Drive neben die Sicherungen.
> Wer ihn verliert, hat keine Sicherung mehr, nur noch unlesbare Dateien.

Die Datei liegt im Ordner, in dem das Fenster gerade steht (Windows meist
`C:\Users\<Name>`, macOS `~`).

---

## Schritt 3 — Öffentlichen Schlüssel in GitHub eintragen

1. <https://github.com/gUrkE1000/tt-fdk> öffnen.
2. Oben **Settings** (Zahnrad).
3. Links **Secrets and variables** → **Actions**.
4. Reiter **Variables** → **New repository variable**.
5. Name: `BACKUP_AGE_RECIPIENT`
   Value: die Zeile `age1…` aus Schritt 2 (ohne „Public key:").
6. **Add variable**.

---

## Schritt 4 — Datenbank-Verbindung aus Supabase holen

1. <https://supabase.com/dashboard> → dein Projekt.
2. Oben in der Leiste auf **Connect** klicken.
3. Reiter **Connection String**, Typ **URI**.
4. Bei **Method** den Eintrag **Session pooler** wählen.
   (Nicht „Direct connection" — die ist nur über IPv6 erreichbar, und GitHub hat kein IPv6.)
5. Die Adresse kopieren. Sie sieht so aus:

   ```
   postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

6. `[YOUR-PASSWORD]` (samt Klammern) durch das **Datenbank-Passwort** ersetzen. Es ist
   dasselbe wie im GitHub-Secret `SUPABASE_DB_PASSWORD`, das „Supabase ausrollen" benutzt.

   Passwort nicht mehr zur Hand? *Project Settings → Database → Reset database password*.
   **Dann aber auch** das Secret `SUPABASE_DB_PASSWORD` in GitHub auf das neue Passwort
   ändern, sonst scheitert das nächste Ausrollen.

   Enthält das Passwort Sonderzeichen wie `@ : / ? #`, müssen sie in der Adresse kodiert
   werden (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`). Einfacher: ein
   Passwort nur aus Buchstaben und Ziffern vergeben.

---

## Schritt 5 — Verbindung als Secret in GitHub eintragen

1. GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Reiter **Secrets** → **New repository secret**.
3. Name: `SUPABASE_DB_URL`
   Secret: die fertige Adresse aus Schritt 4.
4. **Add secret**.

---

## Schritt 6 — Google Drive freigeben

Im Fenster aus Schritt 1:

```
rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ=="
```

(Die Zeichenkette am Ende heißt `{"scope":"drive.file"}`: rclone bekommt nur Zugriff auf
Dateien, die es **selbst** anlegt — nicht auf den Rest deines Drives.)

1. Ein Browserfenster öffnet sich. Mit dem Google-Konto anmelden, in dessen Drive die
   Sicherungen sollen.
2. Die Nachfrage „rclone möchte auf Ihr Google-Konto zugreifen" mit **Zulassen**
   bestätigen.
3. Der Browser zeigt „Success". Zurück ins Fenster: Dort steht jetzt

   ```
   Paste the following into your remote machine --->
   {"access_token":"ya29…","token_type":"Bearer","refresh_token":"1//0…","expiry":"…"}
   <---End paste
   ```

4. **Nur die Zeile mit den geschweiften Klammern** kopieren — von `{` bis `}`, ohne die
   Pfeile.

Dann in GitHub:

1. **Settings** → **Secrets and variables** → **Actions** → Reiter **Secrets** →
   **New repository secret**.
2. Name: `GDRIVE_TOKEN`
   Secret: die kopierte Zeile `{…}`.
3. **Add secret**.

> Der Token erlaubt nur das Anlegen und Verwalten der eigenen Sicherungsdateien. Zurückziehen
> lässt er sich jederzeit unter <https://myaccount.google.com/permissions> → „rclone" →
> Zugriff entfernen.

---

## Schritt 7 — Wöchentlichen Lauf einschalten

1. GitHub → **Settings** → **Secrets and variables** → **Actions** → Reiter **Variables**.
2. **New repository variable**: Name `BACKUP_ENABLED`, Value `true`.

Optional, ebenfalls als Variable:

| Name | Wirkung | Voreinstellung |
|---|---|---|
| `BACKUP_DRIVE_FOLDER` | Ordnername in Google Drive | `Vereinsplaner-Sicherungen` |
| `BACKUP_DRIVE_KEEP_DAYS` | Nach wie vielen Tagen alte Sicherungen im Drive gelöscht werden | `90` |

Wer länger als 90 Tage aufbewahrt, trägt das in `docs/datenschutz/loeschkonzept.md` ein —
es sind personenbezogene Daten.

---

## Schritt 8 — Jetzt einmal von Hand testen

1. GitHub → Reiter **Actions**.
2. Links **Wöchentliche Datenbanksicherung**.
3. Rechts **Run workflow** → **Run workflow**.
4. Nach etwa einer Minute sollte der Lauf **grün** sein. Hineinklicken:
   - Unten unter **Artifacts** steht `datenbank-sicherung`.
   - Im Schritt „Nach Google Drive kopieren" steht `Liegt in Google Drive unter: …`.
5. In Google Drive nachsehen: Ordner `Vereinsplaner-Sicherungen` mit einer Datei
   `vereinsplaner-JJJJ-MM-TT.dump.age`.

**Rot?** Den roten Schritt öffnen:

| Meldung | Ursache |
|---|---|
| `SUPABASE_DB_URL ist nicht gesetzt` | Schritt 5 fehlt |
| `password authentication failed` | Passwort in der Adresse falsch (Schritt 4) |
| `Network is unreachable` / `could not translate host name` | „Direct connection" statt „Session pooler" kopiert |
| `BACKUP_AGE_RECIPIENT fehlt` | Schritt 3 fehlt |
| `couldn't fetch token` / `invalid_grant` | Token in Schritt 6 unvollständig kopiert oder in Google widerrufen — Schritt 6 wiederholen |

---

## Schritt 9 — Probe-Wiederherstellung (einmal jetzt, dann einmal im Jahr)

Eine Sicherung, die nie geöffnet wurde, ist eine Vermutung.

1. Die Datei aus Google Drive auf den Rechner laden (neben `vereinsplaner-sicherung.key`).
2. Entschlüsseln:

   ```
   age --decrypt -i vereinsplaner-sicherung.key -o sicherung.dump vereinsplaner-JJJJ-MM-TT.dump.age
   ```

3. Prüfen, ob sie vollständig ist. Dafür reicht das Inhaltsverzeichnis — ohne Datenbank:

   ```
   pg_restore --list sicherung.dump
   ```

   (Windows: `winget install PostgreSQL.PostgreSQL.17`, dann liegt `pg_restore` unter
   `C:\Program Files\PostgreSQL\17\bin\`. macOS: `brew install libpq`.)

   Es sollte eine lange Liste mit Tabellen wie `public profiles`, `public matches` erscheinen.

4. `sicherung.dump` danach **löschen** — sie ist unverschlüsselt.

**Im Ernstfall zurückspielen** — in ein neues, leeres Supabase-Projekt:

```
pg_restore --no-owner --no-privileges --dbname "<SUPABASE_DB_URL des neuen Projekts>" sicherung.dump
```

---

## Wo die Sicherungen liegen — Übersicht

| Ort | Wie lange | Wer kommt ran |
|---|---|---|
| GitHub-Artefakt | 90 Tage | Jeder mit Lesezugriff aufs Repository — aber nur verschlüsselt |
| Google Drive | 90 Tage (einstellbar) | Du — nur verschlüsselt |
| Privater Schlüssel | dauerhaft | Nur du (Passwortmanager + Ausdruck) |

Hinweis: Ein Supabase-Projekt im Free-Tarif pausiert nach einer Woche ohne Nutzung. Solange
es pausiert, scheitert auch die Sicherung. Im laufenden Vereinsbetrieb kommt das nicht vor.
