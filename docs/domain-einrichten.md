# Domain einrichten

Zwei Subdomains, eine Handvoll DNS-Einträge, zweimal warten. Danach ist die Anwendung unter
einer eigenen Adresse erreichbar und Resend darf in ihrem Namen E-Mails verschicken.

Ausgeliefert wird über **Cloudflare Pages**, das DNS liegt am einfachsten ebenfalls bei
Cloudflare. GitHub Pages scheidet aus, weil das Repository privat ist (die Sicherung legt
dort Mitgliederdaten ab) und Pages für private Repositories einen bezahlten Plan verlangt.

> **Das lässt sich jetzt erledigen, unabhängig von Supabase.** DNS und die
> Domain-Prüfung bei Resend brauchen Minuten bis Stunden — nutz die Wartezeit für
> [Teil 2 von `go-live.md`](go-live.md#teil-2--technische-einrichtung).

> ⚠️ **Wenn das eine Übergangsdomain ist**, lies vorher
> [`go-live.md` §1.1a](go-live.md#11a-der-stichtag-für-die-domain). Kurzfassung: Der Wechsel
> auf die endgültige Domain muss **vor der ersten Einladung** passieren, sonst verlieren
> alle Mitglieder Push-Anmeldung, installierte App und Kalender-Abo.

---

## 1. Die zwei Subdomains

Am Beispiel von `beispiel.de`:

| Subdomain | Wofür | Warum getrennt |
|---|---|---|
| `tt.beispiel.de` | die Anwendung | — |
| `mail.beispiel.de` | Absenderdomain für Resend | Hält SPF/DKIM/DMARC von der Hauptdomain fern |

**Warum die Mail-Subdomain wichtig ist:** Resend verlangt Einträge, die festlegen, wer in
deinem Namen E-Mails verschicken darf. Setzt du die auf die Hauptdomain und hast dort ein
privates Postfach, kann eine zu strenge DMARC-Regel deine eigene Post ins Nichts schicken.
Eine Sende-Subdomain isoliert das vollständig — und lässt sich später ersatzlos wegwerfen.

☐ Anwendung: `tt.` ____________________
☐ Absender: `mail.` ____________________

---

## 2. Das DNS zu Cloudflare holen

Du brauchst **drei Eintragstypen**: `CNAME`, `TXT` und `MX`. Cloudflare kann alle, ist
kostenlos, und die eigene Domain für Pages ist dann ein Klick (Abschnitt 4), weil
Cloudflare den Eintrag selbst anlegt.

> **Es geht auch ohne Umzug**, wenn du nur eine Subdomain brauchst und der bisherige
> Anbieter `CNAME`, `TXT` und `MX` erlaubt: Dann trägst du dort `tt` → `CNAME` auf
> `<projekt>.pages.dev` ein (Abschnitt 4, Fall „DNS woanders"). Für die Hauptdomain
> (`beispiel.de` ohne Subdomain) muss das DNS bei Cloudflare liegen.

⚠️ **Der Umzug ist kein risikoloser Schritt:** Dabei werden die *Nameserver* der Domain
umgestellt. Alles, was bisher unter der Domain lief — eine Website, vorhandene
E-Mail-Postfächer — läuft nur weiter, wenn die zugehörigen Einträge vorher bei Cloudflare
nachgebaut wurden.

### 2.1 Domain hinzufügen und Einträge prüfen

Cloudflare → *Add a domain* → Domain eingeben → Plan **Free**. Cloudflare durchsucht dann
das bisherige DNS und zeigt „Review your DNS records".

**Prüf die Liste Zeile für Zeile** gegen die Anzeige beim bisherigen Anbieter — beide
nebeneinander offen. Der Scan rät die Namen nur; typischerweise fehlen:

- **DKIM-Einträge eines vorhandenen Postfachs** (`google._domainkey`, `titan1._domainkey`,
  `selector1._domainkey` …) — der Teil vor `._domainkey` ist frei gewählt und nicht zu
  erraten.
- `_dmarc` der Hauptdomain, `SRV`-Einträge (`_autodiscover._tcp` u. ä.).
- Selbst angelegte Subdomains, etwa schon eingetragene Resend-Einträge aus Abschnitt 5.

Was fehlt, von Hand ergänzen. Die **`MX`-Einträge** besonders genau: Fehlen die, kommt
keine E-Mail mehr an.

### 2.2 Proxy-Status der übernommenen Einträge

Cloudflare will `A`- und `CNAME`-Einträge standardmäßig *proxied* (orange Wolke) schalten.
Für **übernommene Einträge einer bestehenden Website** (etwa WordPress.com) auf
**DNS only** (graue Wolke) stellen: Hinter dem Proxy scheitert bei solchen Anbietern oft
die Erneuerung des eigenen Zertifikats, und die Seite ist Wochen später plötzlich
„nicht sicher". Mit grauer Wolke ändert sich für die Website nichts.

Der Eintrag für die Anwendung (`tt`) ist die Ausnahme: Den legt Cloudflare Pages in
Abschnitt 4 selbst an, **proxied** — so muss er bleiben.

### 2.3 DNSSEC aus, dann Nameserver umstellen

1. Beim bisherigen Anbieter **DNSSEC ausschalten**, falls aktiv. Sonst ist die Domain nach
   dem Umstellen für viele Resolver unerreichbar. (Bei Cloudflare lässt es sich später
   wieder einschalten: *DNS → Settings → DNSSEC*.)
2. Beim Registrar die beiden **Nameserver** eintragen, die Cloudflare anzeigt.
3. Warten, bis Cloudflare die Domain als **Active** meldet — Minuten bis 24 Stunden.

Wenn du an der Hauptdomain eine laufende Website hast und dir unsicher bist: nimm lieber
gleich eine separate Domain für den Verein, statt an einer funktionierenden herumzustellen.

☐ Einträge verglichen am: ________ ☐ Domain bei Cloudflare *Active* am: ________

---

## 3. Der häufigste Stolperstein: relative Namen

**Das kostet fast jeden eine Stunde**, deshalb steht es vor den eigentlichen Schritten.

Resend nennt dir **vollständige** Namen:

```
resend._domainkey.mail.beispiel.de
```

Die meisten DNS-Oberflächen — WordPress.com eingeschlossen — wollen im Feld *Name* oder
*Host* aber nur den Teil **vor** deiner Domain:

```
resend._domainkey.mail
```

| Der Anbieter sagt | Du trägst ein | (die Domain hängt die Oberfläche selbst an) |
|---|---|---|
| `tt.beispiel.de` | `tt` | |
| `mail.beispiel.de` | `mail` | |
| `send.mail.beispiel.de` | `send.mail` | |
| `resend._domainkey.mail.beispiel.de` | `resend._domainkey.mail` | |
| `_dmarc.mail.beispiel.de` | `_dmarc.mail` | |

**Woran du merkst, dass du es falsch gemacht hast:** Der Eintrag heißt hinterher
`tt.beispiel.de.beispiel.de`. Manche Oberflächen zeigen den vollständigen Namen nach dem
Speichern an — sieh dort nach.

**Wenn du unsicher bist:** Trag den ersten Eintrag ein, speichere, und prüf mit
Abschnitt 6, was tatsächlich dasteht. Lieber einmal nachsehen als sechs Einträge falsch.

---

## 4. Die Anwendung: Cloudflare Pages

### 4.1 Zugang für den Deploy-Workflow

Gebaut wird in GitHub Actions (`.github/workflows/deploy.yml`), Cloudflare bekommt nur das
fertige Ergebnis. Dafür braucht GitHub zwei Secrets
(*Settings → Secrets and variables → Actions*):

| Secret | Woher |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → *My Profile → API Tokens → Create Token → Custom token*. Berechtigung: **Account → Cloudflare Pages → Edit**. Sonst nichts — der Token darf weder DNS noch andere Dienste anfassen |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → *Workers & Pages* → rechte Spalte **Account ID** |

Den Token sofort ins Passwortdepot; Cloudflare zeigt ihn nur einmal.

### 4.2 Erstes Deployment

GitHub → *Actions* → **Deploy to Cloudflare Pages** → *Run workflow* (Branch `main`).

Der erste Lauf legt das Pages-Projekt `vereinsplaner` an (anderer Name: Repository-Variable
`CLOUDFLARE_PAGES_PROJECT`). Danach läuft die Anwendung unter
`https://vereinsplaner.pages.dev` — ist der Name vergeben, hängt Cloudflare ein Kürzel an;
die tatsächliche Adresse steht am Ende des Laufs im Log.

> Ein Lauf von einem anderen Branch als `main` erzeugt nur eine **Vorschau** unter
> `<branch>.vereinsplaner.pages.dev`. Die eigene Domain zeigt immer auf `main`.

### 4.3 Eigene Domain eintragen

Cloudflare → *Workers & Pages* → `vereinsplaner` → *Custom domains* →
*Set up a custom domain* → `tt.beispiel.de` → *Continue* → *Activate domain*.

**Liegt das DNS bei Cloudflare** (Abschnitt 2), legt Cloudflare den Eintrag selbst an:

| Typ | Name | Wert | Proxy |
|---|---|---|---|
| `CNAME` | `tt` | `vereinsplaner.pages.dev` | **proxied** (orange) |

Nichts von Hand anlegen und die Wolke **nicht** auf grau stellen — Pages braucht den Proxy
für Zertifikat und Auslieferung. Gibt es unter `tt` schon einen alten Eintrag, vorher
löschen; ein Name kann nicht zwei Ziele haben.

**Liegt das DNS woanders** (nur bei einer Subdomain möglich): beim Anbieter selbst
eintragen, mit relativem Namen (Abschnitt 3):

| Typ | Name | Wert |
|---|---|---|
| `CNAME` | `tt` | `vereinsplaner.pages.dev` |

**Hauptdomain statt Subdomain** (`beispiel.de`): geht nur mit DNS bei Cloudflare, dann
genauso wie oben — Cloudflare löst den `CNAME` auf der Wurzel selbst auf. Alte `A`-Einträge
auf `@` vorher löschen. Für `www` zusätzlich `www.beispiel.de` als zweite Custom domain
eintragen.

### 4.4 Warten, bis die Domain aktiv ist

In *Custom domains* steht zunächst *Verifying* bzw. *Initializing*. Sobald dort **Active**
steht (meist Minuten, selten bis zu einer Stunde), ist das Zertifikat ausgestellt. HTTPS
ist bei Pages immer an; ein Kästchen zum Erzwingen gibt es nicht.

> ⚠️ **Ohne HTTPS gibt es keinen Service Worker, kein Push und keine Installation als App.**
> Das ist eine Browser-Regel, keine Einstellung. Solange die Domain nicht *Active* ist, ist
> die Einrichtung an dieser Stelle nicht fertig.

☐ Custom domain eingetragen am: ________ ☐ *Active* am: ________

### 4.5 Was du **nicht** tun musst

- **`VITE_BASE_PATH` setzen.** Bei einer eigenen Domain liegt die Anwendung in der Wurzel;
  die Voreinstellung `/` ist richtig. Setzt du einen Unterpfad, sucht der Service Worker
  an der falschen Stelle und Push funktioniert nicht.
- **Umleitungen für tiefe Links anlegen.** Pages behandelt das Projekt als Single-Page-App,
  solange es keine `404.html` enthält; der Deploy-Workflow prüft das.
- **Sicherheits-Header konfigurieren.** Die stehen in `public/_headers` und werden mit
  ausgeliefert.

Die Anwendung bleibt zusätzlich unter `vereinsplaner.pages.dev` erreichbar. Anmelden kann
man sich dort nicht (die Adresse steht nicht in den Redirect-URLs von Supabase) — Links
gehören immer auf die eigene Domain.

---

## 5. Der Versand: Resend

### 5.1 Domain hinzufügen

[resend.com](https://resend.com) → *Domains* → *Add Domain*.

- **Domain**: `mail.beispiel.de` — die Subdomain, nicht die Hauptdomain.
- **Region**: **Europa (Ireland)**, wenn die Auswahl angeboten wird. Der Datenschutzhinweis
  und `datenschutz/av-resend.md` behandeln den Versand als US-Verarbeitung; eine
  EU-Region macht die Aussage nur besser, nie schlechter.

### 5.2 Die Einträge übernehmen

Resend zeigt dir danach drei bis vier Einträge. **Die genauen Werte sind für deine Domain
erzeugt — kopier sie von dort, tipp sie nicht ab.** Die Form sieht so aus:

| Typ | Name (vollständig) | Was drinsteht |
|---|---|---|
| `MX` | `send.mail.beispiel.de` | ein Amazon-SES-Host, Priorität `10` |
| `TXT` | `send.mail.beispiel.de` | `v=spf1 include:amazonses.com ~all` |
| `TXT` | `resend._domainkey.mail.beispiel.de` | ein sehr langer Schlüssel (`p=MIGf…`) |
| `TXT` | `_dmarc.mail.beispiel.de` | `v=DMARC1; p=none;` — oft optional |

Beim Eintragen: **Abschnitt 3 beachten**, die Namen sind relativ.

Drei Fallen beim DKIM-Eintrag (dem langen):

1. **Vollständig kopieren.** Der Schlüssel ist ~200 Zeichen lang und wird in der Anzeige
   oft umgebrochen. Nimm den Kopieren-Knopf, nicht die Maus.
2. **Keine Anführungszeichen hinzufügen.** Manche Oberflächen setzen sie selbst. Wenn
   hinterher `"v=spf1…"` mit Anführungszeichen dasteht, ist das in Ordnung — doppelte
   (`""v=spf1…""`) sind es nicht.
3. **Keine Leerzeichen oder Zeilenumbrüche** im Wert.

### 5.3 Verifizieren

Zurück bei Resend: *Verify DNS Records*. Läuft meist in Minuten durch, kann aber Stunden
dauern.

> Solange die Domain nicht auf **verified** steht, lehnt Resend **jeden** Versand ab. In
> der Anwendung äußert sich das später als Benachrichtigungen, die auf `failed` stehen
> bleiben — unter *Verein → Betrieb → Benachrichtigungen*.

### 5.4 API-Schlüssel

*API Keys* → *Create API Key* → Rechte **Sending access** genügen.

Sofort ins Passwortdepot. Resend zeigt ihn genau einmal.

☐ Domain verified am: ________ ☐ API-Schlüssel abgelegt am: ________

### Was du beim Domainkauf **nicht** brauchst

Registrare bieten im Bestellvorgang gern Pakete an. Für diese Anwendung gilt:

| Angebot | Brauchst du? | Warum |
|---|---|---|
| **Domain allein** | ✅ **ja** | Mehr ist es nicht |
| E-Mail-Paket / Postfächer | ❌ nein | Der Versand läuft über Resend. Ein Postfach macht die Zustellung **nicht** zuverlässiger — siehe unten. Für Antworten reicht die Antwortadresse (5.5) |
| Webhosting | ❌ nein | Die Anwendung liegt auf Cloudflare Pages, kostenlos |
| Website-Baukasten | ❌ nein | — |
| SSL-Zertifikat | ❌ nein | Cloudflare stellt es selbst aus, kostenlos |

**Der verbreitete Irrtum:** *„Mit einem richtigen Postfach wird die E-Mail zuverlässiger
zugestellt."* Das stimmt nicht. Ob eine Nachricht im Posteingang oder im Spam landet,
entscheiden **SPF, DKIM und DMARC** — also genau die DNS-Einträge aus Abschnitt 5.2 — plus
der Ruf des versendenden Systems. Ein Postfach beim Registrar ändert an beidem nichts,
weil die Anwendung gar nicht darüber versendet.

Umgekehrt wäre der Versand über ein normales Registrar-Postfach **schlechter**: Solche
Postfächer haben enge Sendelimits, Massenversand verstößt oft gegen deren Bedingungen, und
es gibt keine Protokolle. Die Frage „ich habe nie eine Mail bekommen" wäre dann nicht mehr
zu beantworten — mit Resend steht sie unter *Verein → Betrieb → Benachrichtigungen*.

⚠️ **Auf den Verlängerungspreis achten.** Einstiegspreise gelten meist 12 Monate. Was
danach fällig wird, steht klein daneben — bei Domains oft das Zehnfache, bei
E-Mail-Paketen das Zweieinhalbfache.

### 5.5 Absenderadresse und Antwortadresse

Das sind **zwei verschiedene Dinge**, und wer sie verwechselt, kauft ein Postfach, das er
nicht braucht.

| | Absenderadresse | Antwortadresse |
|---|---|---|
| Beispiel | `planer@mail.beispiel.de` | `vorstand@verein.de` |
| Muss auf der verifizierten Domain liegen | **ja** | nein |
| Braucht ein echtes Postfach | **nein** | **ja** |
| Wofür | Zustellbarkeit (SPF, DKIM, DMARC) | damit Antworten ankommen |
| In der Anwendung | *Verein → Betrieb → Einstellungen → Absenderadresse* | *… → Antwortadresse* |

Die Absenderadresse ist eine technische Kennung. Hinter ihr muss nichts stehen.

Die Antwortadresse ist das, was zählt: **Auf jede Erinnerung, jede Ersatzanfrage und jede
Aufstellung antwortet irgendwann jemand.** Trag hier ein Postfach ein, das der Verein
**ohnehin hat** — die Adresse des Vorstands, des Abteilungsleiters, eines
Mannschaftsführers. Dann brauchst du beim Domainkauf kein E-Mail-Paket dazuzubuchen.

> Bleibt die Antwortadresse leer, geht die Antwort an die Absenderadresse — und fällt dort
> lautlos aus der Welt. Der Schreibende hält seine Rückmeldung für zugestellt, der
> Mannschaftsführer wartet auf eine, die längst geschrieben wurde.

---

## 6. Prüfen, bevor du weitergehst

Im Terminal. `dig` gibt es auf macOS und Linux; unter Windows tut `nslookup -type=TXT …`
denselben Dienst.

```bash
# Liefert die Domain die Anwendung aus?
curl -sI https://tt.beispiel.de/trainings | grep -iE '^HTTP|x-frame-options'
# erwartet: HTTP/2 200 und x-frame-options: SAMEORIGIN (kommt aus public/_headers —
# steht es da, antwortet wirklich dieses Pages-Projekt)

# Findet man den SPF-Eintrag?
dig +short send.mail.beispiel.de TXT
# erwartet: "v=spf1 include:amazonses.com ~all"

# Und den DKIM-Schlüssel?
dig +short resend._domainkey.mail.beispiel.de TXT
# erwartet: ein langer Wert mit p=MIGf...

# Nimmt der Bounce-Weg Post an?
dig +short send.mail.beispiel.de MX
# erwartet: 10 feedback-smtp.<region>.amazonses.com.
```

**Kommt nichts zurück**, sind es fast immer diese drei Ursachen, in dieser Reihenfolge:

1. **Noch nicht propagiert.** Warte. Bis zu einer Stunde ist normal, bei ungünstiger TTL
   auch länger. Gegenprobe mit einem fremden Resolver:
   `dig +short @1.1.1.1 send.mail.beispiel.de TXT`
2. **Name doppelt.** Sieh nach, ob der Eintrag `tt.beispiel.de.beispiel.de` heißt →
   [Abschnitt 3](#3-der-häufigste-stolperstein-relative-namen).
3. **Falscher Typ.** `CNAME` statt `TXT` oder umgekehrt.

Für `tt` liefert `dig` bei DNS über Cloudflare **keinen** `CNAME`, sondern Cloudflare-IPs —
das ist bei einem proxied Eintrag richtig so. Antwortet `curl` nicht, sieh zuerst in
*Workers & Pages → vereinsplaner → Custom domains* nach, ob dort *Active* steht.

Ein sehr praktischer Gegencheck ohne Terminal: [dnschecker.org](https://dnschecker.org)
zeigt denselben Eintrag aus vielen Ländern gleichzeitig.

☐ Alle vier Abfragen liefern das Erwartete am: ________

---

## 7. Was jetzt in die Secrets gehört

Sobald die Domain steht, GitHub → *Settings → Secrets and variables → Actions*:

| Secret | Wert |
|---|---|
| `VITE_APP_URL` | `https://tt.beispiel.de` — **mit `https://`, ohne Schrägstrich am Ende** |

Und später, bei Supabase ([`go-live.md` Teil 2.5](go-live.md#25-secrets-setzen-und-functions-ausrollen)):

```bash
npx supabase secrets set APP_URL="https://tt.beispiel.de"
npx supabase secrets set RESEND_API_KEY="re_..."
```

> **`APP_URL` ist die Basis jedes Links in jeder Benachrichtigung.** Ist sie falsch oder
> leer, kommen die E-Mails an und keiner ihrer Knöpfe führt irgendwohin. Das ist ein
> Fehler, der erst auffällt, wenn ein Mitglied sich beschwert.

Dieselbe Adresse gehört außerdem in Supabase unter *Authentication → URL Configuration* als
**Site URL** und in die **Redirect URLs** — sonst schlägt die Anmeldung per Magic Link fehl.

☐ Secrets gesetzt am: ________

---

## 8. Beim späteren Domainwechsel

Diese Liste ist der Grund, warum dieses Dokument existiert. Zu ändern sind:

| Wo | Was |
|---|---|
| DNS der neuen Domain | Abschnitte 2 und 5.2 komplett neu |
| Cloudflare → Workers & Pages → Custom domains | neue Domain hinzufügen, warten auf *Active* |
| GitHub → Secrets | `VITE_APP_URL` |
| Supabase → Secrets | `APP_URL` |
| Supabase → Auth → URL Configuration | Site URL **und** Redirect URLs |
| Resend | neue Domain hinzufügen und verifizieren |
| Anwendung → *Verein → Betrieb* | Adresse der Anwendung, Absenderadresse |
| Danach | Deploy-Workflow einmal laufen lassen |

Und was du den Mitgliedern sagen musst, wenn zu dem Zeitpunkt schon jemand drauf ist:

> Die Adresse hat sich geändert. Bitte die App neu zum Home-Bildschirm hinzufügen, die
> Glocke erneut drücken und den Kalender neu abonnieren.

Genau diese drei Sätze sind der Grund, die endgültige Domain vor der ersten Einladung zu
haben.
