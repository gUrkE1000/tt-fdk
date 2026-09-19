# Domain einrichten

Zwei Subdomains, sieben DNS-Einträge, zweimal warten. Danach ist die Anwendung unter einer
eigenen Adresse erreichbar und Resend darf in ihrem Namen E-Mails verschicken.

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

## 2. Vorab prüfen: lässt der Anbieter dich?

Du brauchst **drei Eintragstypen**: `CNAME`, `TXT` und `MX`. Bei Baukasten-Anbietern
(WordPress.com, Wix, Jimdo, Squarespace) ist die DNS-Verwaltung manchmal auf eine Auswahl
beschränkt.

**WordPress.com:** *Upgrades → Domains* (bzw. *Domains* in der Seitenleiste) → die Domain
anklicken → **DNS-Einträge** / *DNS records*. Dort gibt es „Eintrag hinzufügen" mit einer
Typ-Auswahl.

Prüf einmal, ob `CNAME`, `TXT` **und** `MX` in der Liste stehen. Wenn ja: weiter mit
Abschnitt 3.

### Falls nicht — oder falls es zu umständlich wird

Dann verwaltest du das DNS woanders, ohne die Domain umzuziehen: **Cloudflare DNS** ist
kostenlos, kann jeden Eintragstyp und ist schnell.

⚠️ **Aber Vorsicht, das ist kein risikoloser Schritt:** Dabei werden die *Nameserver* der
Domain umgestellt. Alles, was bisher unter der Domain lief — deine WordPress-Website,
vorhandene E-Mail-Postfächer — läuft nur weiter, wenn die zugehörigen Einträge vorher bei
Cloudflare nachgebaut wurden. Cloudflare importiert beim Einrichten die gefundenen Einträge
automatisch; **prüf die Liste trotzdem Zeile für Zeile**, bevor du die Nameserver
umstellst. Besonders `MX`-Einträge: Fehlen die, kommt keine E-Mail mehr an.

Wenn du an der Hauptdomain eine laufende Website hast und dir unsicher bist: nimm lieber
gleich eine separate Domain für den Verein, statt an einer funktionierenden herumzustellen.

☐ DNS-Verwaltung erlaubt CNAME, TXT, MX: ☐ ja ☐ nein → Cloudflare

---

## 3. Der häufigste Stolperstein: relative Namen

**Das kostet fast jeden eine Stunde**, deshalb steht es vor den eigentlichen Schritten.

Resend und GitHub nennen dir **vollständige** Namen:

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

## 4. Die Anwendung: GitHub Pages

### 4.1 Pages einschalten

GitHub → Repository → *Settings* → *Pages*:

- **Source**: `GitHub Actions`

### 4.2 Eigene Domain eintragen

Auf derselben Seite unter **Custom domain**: `tt.beispiel.de` → *Save*.

GitHub prüft daraufhin das DNS und meldet zunächst einen Fehler — der Eintrag existiert ja
noch nicht. Das ist erwartet.

### 4.3 Den DNS-Eintrag setzen

**Welche Einträge du brauchst, hängt davon ab, ob du eine Subdomain oder die Hauptdomain
nutzt.** Das ist der Punkt, an dem die meisten Anleitungen aneinander vorbeireden.

### Fall A — Subdomain (`tt.beispiel.de`)

Ein einziger Eintrag:

| Typ | Name | Wert | TTL |
|---|---|---|---|
| `CNAME` | `tt` | `<dein-github-konto>.github.io` | Standard |

Manche Oberflächen wollen den Wert mit Punkt am Ende (`konto.github.io.`). Beides ist
richtig; wenn einer nicht angenommen wird, nimm den anderen.

### Fall B — Hauptdomain (`beispiel.de`)

Ein `CNAME` geht hier **nicht** — auf der Wurzel einer Domain verbietet der DNS-Standard
das. Stattdessen vier `A`-Einträge, alle mit leerem Namen bzw. `@`:

| Typ | Name | Wert |
|---|---|---|
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |

Optional dieselben vier noch einmal als `AAAA` für IPv6:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

⚠️ **Vorhandene `A`-Einträge auf `@` vorher löschen.** Registrare legen ab Werk einen
Eintrag an, der auf ihre eigene Platzhalterseite zeigt. Bleibt der stehen, landet etwa
jeder fünfte Aufruf dort statt bei euch — ein Fehler, der sich anfühlt wie „manchmal geht's
nicht".

### 4.4 Warten, dann HTTPS erzwingen

Zurück auf *Settings → Pages*. Sobald die DNS-Prüfung durchläuft (Minuten bis ~1 Stunde),
stellt GitHub automatisch ein Zertifikat aus. **Dann** wird das Kästchen **Enforce HTTPS**
anklickbar — ankreuzen.

> ⚠️ **Ohne HTTPS gibt es keinen Service Worker, kein Push und keine Installation als App.**
> Das ist eine Browser-Regel, keine Einstellung. Solange das Kästchen ausgegraut ist, ist
> die Einrichtung an dieser Stelle nicht fertig.

Das Kästchen bleibt manchmal eine halbe Stunde ausgegraut, obwohl das DNS stimmt. Erst nach
zwei Stunden anfangen, einen Fehler zu vermuten.

☐ `CNAME` gesetzt am: ________ ☐ Enforce HTTPS aktiv am: ________

### 4.5 Was du **nicht** tun musst

- **`VITE_BASE_PATH` setzen.** Bei einer eigenen Domain liegt die Anwendung in der Wurzel;
  die Voreinstellung `/` ist richtig. Setzt du sie auf `/tt-fdk/`, sucht der Service Worker
  an der falschen Stelle und Push funktioniert nicht.
- **Eine `CNAME`-Datei anlegen.** Der Deploy-Workflow schreibt sie beim Bauen aus dem
  Secret `VITE_APP_URL` — es gibt also genau eine Stelle, an der die Domain gepflegt wird.

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
| Webhosting | ❌ nein | Die Anwendung liegt auf GitHub Pages, kostenlos |
| Website-Baukasten | ❌ nein | — |
| SSL-Zertifikat | ❌ nein | GitHub Pages stellt es selbst aus, kostenlos |

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
# Zeigt die Anwendung auf GitHub?
dig +short tt.beispiel.de CNAME
# erwartet: konto.github.io.

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
   `dig +short @1.1.1.1 tt.beispiel.de CNAME`
2. **Name doppelt.** Sieh nach, ob der Eintrag `tt.beispiel.de.beispiel.de` heißt →
   [Abschnitt 3](#3-der-häufigste-stolperstein-relative-namen).
3. **Falscher Typ.** `CNAME` statt `TXT` oder umgekehrt.

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
| DNS der neuen Domain | Abschnitte 4.3 und 5.2 komplett neu |
| GitHub → Settings → Pages | Custom domain, danach erneut *Enforce HTTPS* |
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
