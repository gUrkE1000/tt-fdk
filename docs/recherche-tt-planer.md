# Recherche: TT-Planer und Alternativen

Stand: 17.09.2026 · Zweck: Entscheidungsgrundlage für eine kostengünstige Eigenlösung für den Verein.

Hinweis zur Quellenlage: Die Hersteller-Websites (tt-planer.de, smart-tt.de, mytischtennis.de)
sind aus der Recherche-Umgebung nur indirekt (über Suchmaschinen-Snapshots) erreichbar gewesen.
Preise und Vertragskonditionen sind vor einer Entscheidung auf der Herstellerseite zu verifizieren.

---

## 1. Kurzfassung

- **TT-Planer** ist eine Web-App (PWA, keine native App) speziell für Tischtennisvereine:  
  Vereinskalender, Trainings-An-/Abmeldung, Hallen-/Tischbelegung, Mannschaftsspiel-Organisation
  mit automatischer Ersatzspieler-Kette, Umfragen (z. B. Spielverlegung), Arbeitsstunden-Erfassung.  
- **Kosten**: 3 Monate kostenlos, danach Starter 5 €/Monat, Vollpaket 15 €/Monat.  
  Laufzeit 12 Monate, Verlängerung um 12 Monate, Kündigungsfrist 3 Monate.
  → Vollpaket ≈ **180 €/Jahr**, Starter ≈ **60 €/Jahr**.  
- **Der teuerste Teil eines Nachbaus ist nicht das Hosting, sondern die Pflege.** Hosting einer  
  eigenen Lösung liegt bei 0–60 €/Jahr (Supabase-Free/Hetzner-VPS + Domain). Die Ersparnis
  gegenüber dem Vollpaket beträgt also grob 120–180 €/Jahr — das ist ungefähr der Gegenwert von
  2–4 Entwicklerstunden pro Jahr. Der Bau lohnt sich, wenn man ihn ohnehin machen will
  (Lernprojekt, exakter Zuschnitt auf den Verein), nicht als reine Sparmaßnahme.  
- **Schlanker Einstieg**: Nur die Funktionen bauen, die der Verein wirklich nutzt — erfahrungsgemäß  
  sind das Spieltermine + Zu-/Absagen + Aufstellung + Erinnerung. Das ist ein überschaubares MVP
  (siehe Abschnitt 7), weil die Termindaten **kostenlos als ICS/Webcal aus click-TT** kommen.

---

## 2. Das Produkt: TT-Planer

### 2.1 Einordnung

| Punkt | Wert |
|---|---|
| Anbieter | TT-Planer, [tt-planer.de](https://www.tt-planer.de/) |
| Zielgruppe | Tischtennisvereine und -abteilungen (D) |
| Technik | Browser-Anwendung, **installierbar als PWA inkl. Push-Benachrichtigungen**; keine native iOS/Android-App |
| Positionierung | Von Tischtennisspielern für Tischtennisvereine; offiziell von myTischtennis.de empfohlen ([Partner-Artikel](https://www.mytischtennis.de/news/partner/tt-planer-eine-app-fur-die-ganze-orga)) |
| Test | 3 Monate kostenlos, keine Zahlungsdaten bei Registrierung nötig |

### 2.2 Preise und Vertrag

| Paket | Preis | Anmerkung |
|---|---|---|
| Test | 0 € | 3 Monate, unverbindlich |
| Starter | 5 €/Monat (≈ 60 €/Jahr) | eingeschränkter Funktionsumfang |
| Vollpaket | 15 €/Monat (≈ 180 €/Jahr) | alle Funktionen |

Vertragsbedingungen laut AGB/FAQ: **Laufzeit 12 Monate**, automatische Verlängerung um weitere
12 Monate, **Kündigungsfrist 3 Monate** zum Laufzeitende. Upgrade jederzeit möglich — startet
dann eine neue 12-Monats-Laufzeit, bereits gezahlte Beträge werden angerechnet.

> Für die Verhandlung im Verein relevant: Die 180 €/Jahr sind kein Abo, das man monatlich kündigen
> kann. Wer wechseln will, muss die Kündigungsfrist beachten und hat faktisch ein Jahr Vorlauf,
> um eine Eigenlösung produktiv zu bekommen. Das ist eher ein Vorteil: genug Zeit für einen
> Parallelbetrieb.

### 2.3 Funktionsumfang

Recherchierte Funktionen (Quelle: Herstellerseite/Hilfe, myTischtennis-Partnerartikel,
Vereinsberichte wie [TTC Holzwickede](https://ttc-holzwickede.de/tt-planer/)):

| Bereich | Funktion | Für Eigenbau |
|---|---|---|
| **Vereinskalender** | Zentrale Ansicht aller Termine: Training, Mannschaftsspiele, Geburtstage, Vereinsevents; mehrere Kalenderansichten | Muss |
| **Training** | Einbuchen in Trainingszeiten, Sichtbarkeit wer sonst dabei ist, automatische Abfrage vor dem Termin | Muss |
| **Erinnerungen** | Automatische Benachrichtigung x Stunden (einstellbar, Default 5 h) vor dem Termin an alle, die noch nicht geantwortet haben | Muss |
| **Hallen-/Tischbelegung** | Hallen, Trainingszeiten, Tischanzahl und -belegung planen | Kann (oft schon über click-TT-Tool gelöst, s. u.) |
| **Mannschaftsplanung** | Kader je Mannschaft definieren; Modus "feste Stammspieler" vs. "offene Spieler" | Muss |
| **Ersatzspieler-Automatik** | Bei Absage eines Stammspielers werden definierte Ersatzspieler automatisch angefragt — Modus "einzeln nach Reihenfolge": sagt einer ab, wird automatisch der nächste gefragt | Soll (größter Zeitgewinn für Mannschaftsführer) |
| **Spielverlegung** | Umfrage an die Stammspieler zur Findung eines Ersatztermins | Soll |
| **click-TT-Anbindung** | Mannschaftsspiele verwalten und "bequem in click-TT importieren" | Kann (einseitig: Termine **aus** click-TT holen reicht meist) |
| **Umfragen** | Für ganzen Verein, einzelne Mannschaften oder Gruppen; Einfach-/Mehrfachauswahl oder persönliche Anfragen ("Wer kann bei X helfen?") | Kann |
| **Arbeitsstunden** | Erfassung und Auswertung geleisteter Arbeitsstunden | Kann |
| **Rollen** | Admin (sieht alle Abwesenheiten des Vereins im Kalender), Mannschaftsführer (verwaltet Mannschaft und Spieltermine, wird über Absagen und fehlgeschlagene Ersatzanfragen informiert), Spieler | Muss |
| **News** | Vereinsnachrichten an alle Mitglieder | Kann |

### 2.4 Funktionsweise (rekonstruiertes Modell)

Aus der Hilfe-Dokumentation lässt sich das Domänenmodell gut ableiten — es ist praktisch die
Blaupause für einen Nachbau:

```
Verein
 ├── Mitglieder (Rollen: Admin, Mannschaftsführer, Spieler, Trainer)
 ├── Hallen ──> Trainingszeiten ──> Tische/Kapazität
 ├── Mannschaften
 │    ├── Kader: Stammspieler (Position 1..n) + Ersatzspieler (geordnete Liste)
 │    ├── Modus: "feste Stammspieler" | "offene Spieler"
 │    └── Spieltermine (aus click-TT), je Termin:
 │          ├── Rückmeldungen (zu / ab / als Ersatz)
 │          ├── Ersatzanfragen-Kette (sequentiell oder parallel)
 │          └── Aufstellung (final, exportierbar)
 ├── Termine (Training, Event, Sitzung) mit Teilnehmerabfrage
 └── Umfragen / News / Arbeitsstunden
```

Der zentrale Automatismus ist die **Ersatzkette**: Absage eines Stammspielers → System fragt
Ersatzspieler 1 an → Timeout oder Absage → Ersatzspieler 2 → … → wenn die Kette leer läuft, wird
der Mannschaftsführer aktiv benachrichtigt. Genau dieser Ablauf ersetzt die WhatsApp-Rundrufe und
ist der Grund, warum Vereine die App schätzen. Wer nachbaut, sollte das nicht weglassen.

---

## 3. Das Umfeld: click-TT, nuLiga, myTischtennis

Das ist entscheidend für den Eigenbau, weil hier die Daten herkommen.

- **click-TT / nuLiga** (Betreiber: [nu Datenautomaten GmbH](https://www.nu-gmbh.com/sportarten/tischtennis))  
  ist das Verbandssystem für Spielbetrieb, Mannschaftsmeldung, Spielberechtigungen, Ergebnisse.
  Jeder Landesverband hat eine eigene Instanz (z. B. `wttv.click-tt.de`, `ttvn.click-tt.de`).  
- **myTischtennis.de** ist das Portal, in das click-TT seit 2017 integriert ist (TTR/QTTR-Werte,  
  Profile, Ergebnisse).  
- **nuScore** ist seit Saison 2023/24 der digitale Spielbericht, der den Papier-Spielblock  
  ersetzt; er lädt die aktuelle Mannschaftsmeldung per Spielcode aus click-TT.

### 3.1 Legale, offizielle Datenwege (empfohlen)

| Weg | Was man bekommt | Aufwand |
|---|---|---|
| **Webcal/ICS-Abo pro Mannschaft** | Spieltermine inkl. Verlegungen, automatisch aktuell. In click-TT/myTT unter jedem Mannschaftsspielplan bzw. in der Mannschaftsübersicht der Vereinsseite als Download oder Webcal-Link. | Sehr gering — **der Königsweg für ein MVP** |
| **CSV-Download im Vereinsbereich** | Datei mit allen Spielterminen des Vereins (click-TT → Verein → Downloads), außerdem diverse Listen als PDF/CSV | Gering, aber manuell |
| **nuLiga-/Verbands-Widgets** | Tabellen und Spielpläne zum Einbetten auf der Vereinsseite | Gering, aber nur Anzeige |

Der ICS-Weg ist ausdrücklich vom System angeboten, stabil (Termine tragen eine UID, über die sich
Verlegungen erkennen lassen) und erfordert keinerlei Scraping. Ein fertiges Beispiel:
[jolinux/Click-TT-ICS-Kalender-Konverter](https://github.com/jolinux/Click-TT-ICS-Kalender-Konverter)
(CSV→ICS via Bash/AWK).

### 3.2 Inoffizielle Wege (mit Vorsicht)

- [notMYcupofTeeTee/mytt-api](https://github.com/notMYcupofTeeTee/mytt-api) — inoffizielle  
  Dokumentation der myTischtennis-Endpunkte (Suche, Spieler/TTR, Ligen/Gruppen, Mannschaften,
  Vereine, Spiele), erstellt durch Beobachtung des Netzwerk-Tabs. MIT-lizenzierte Doku, aber:
  **keine Verbindung zum DTTB**, teils Cookie-Auth nötig, Rate Limit ca. 90 Requests/Stunde,
  Nutzung unterliegt den AGB von myTischtennis.  
- [legout/mytt-scraper](https://github.com/legout/mytt-scraper) — Playwright-Scraper für  
  TTR-Werte und Profile, explizit "for personal use only", keine Open-Source-Lizenz.

**Bewertung:** Für eine Vereinslösung, die dauerhaft laufen soll, sollte man sich nicht auf
inoffizielle Endpunkte stützen. Sie können sich jederzeit ändern, und ein automatisierter
Dauerabruf ist AGB-seitig heikel. QTTR-Werte, falls gebraucht, lieber manuell einmal pro
Halbserie pflegen — sie ändern sich ohnehin nur zu den Stichtagen.

---

## 4. Alternativen zum TT-Planer

### 4.1 Tischtennis-spezifisch (kommerziell)

| Produkt | Fokus | Kosten |
|---|---|---|
| [TT-Planer](https://www.tt-planer.de/) | Komplette Vereinsorga | 5 / 15 € pro Monat |
| [smart-tt](https://smart-tt.de/) | Spieltagsmanagement | Preise auf Anfrage/Website |
| [TT-Coach Vereinsverwaltung](https://tt-coach.de/tt-vereinsverwaltung) | Hallen-/Tischbelegung, Trainingsstand, Druckfunktion | Kostenlos testbar, Preise nicht öffentlich gelistet |
| [Henke Software / web4sport, TischtennisLive](https://www.web4sport.de/) | Vereins- und Verbandsverwaltung + Ergebnisdienst, Schnittstellen-Export nach click-TT; dazu TT-Turnier 11 für Turniere | Vereinspakete, Preise auf Anfrage; TT-Turnier mit kostenloser Testversion |

### 4.2 Sportartübergreifend

| Produkt | Kosten | Passung für TT |
|---|---|---|
| [SpielerPlus](https://www.spielerplus.de/) | Standard kostenlos (mit Werbung), Premium/Vereinspakete kostenpflichtig | Sehr verbreitet (>2 Mio. Nutzer), hat An-/Abmeldung, Aufstellungseditor, Kalender, Mitglieder, Beiträge — aber keine TT-Spezifika (keine click-TT-Anbindung, keine TT-Ersatzkette, kein QTTR) |
| [SportEasy](https://www.sporteasy.net/de/teams/sports/ping_pong/) | Free + Premium | Hat eine Tischtennis-Kategorie, sonst generisch |
| [Vereinsplaner](https://vereinsplaner.de/) | kostenpflichtig | All-in-One Vereinssoftware, eher Verwaltung als Spieltag |
| [Sportdeutschland Vereins-App (DOSB/vmapit)](https://vereinsapp.sportdeutschland.de/) | teils gefördert | Kommunikation/News, keine Spieltagslogik |

**Fazit:** SpielerPlus in der kostenlosen Version ist die realistischste "0-€-Alternative von der
Stange". Was fehlt, ist genau das TT-Spezifische: automatischer Import der click-TT-Termine,
Ersatzspieler-Kette nach Reihenfolge, Aufstellung nach Stammspieler-Positionen.

### 4.3 Kostenlose Bausteine, die es schon gibt

- **Hallenbuchungstool des DTTB** — in click-TT/myTT integriert, **kostenlos** für alle Vereine:  
  Admin legt Tische, Trainingstage und Zeiten fest, Spieler buchen Tische (ohne eigene
  Registrierung), Freitextfeld für Regeln, Trainingspartner kann eingetragen werden.
  ([Info-PDF](https://www.tischtennis.de/fileadmin/documents/01_Verbaende/Hallenbelegungstool/Info_Vereine_Hallenbelegungstool.pdf),
  [News](https://www.tischtennis.de/news/vereinsservice-kostenloses-online-hallenbuchungstool-jetzt-nutzbar.html))
  → **Das Modul "Hallenbelegung" muss man nicht nachbauen.**  
- **click-TT-Kalenderabo** — Spieltermine im Telefonkalender, kostenlos.  
- **Kostenlose Clubmodule von myTischtennis** für die Vereinsseite (Tabellen, Spielpläne).  

### 4.4 Open Source (die interessanteste Fundstelle)

| Projekt | Was es ist | Bewertung |
|---|---|---|
| [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner) | "Spielbereitschafts-Planer": React + TypeScript + Tailwind + Vite, Supabase (Postgres, Edge Functions, RLS), Deployment auf GitHub Pages mit Actions. Liest Spieltermine **automatisch aus den Webcal-Kalendern von myTischtennis**, RSVP mit Rollen (Spieler / Mannschaftsführer / Sportwart), Aufstellungsplanung Stamm (Pos. 1–4) vs. Ersatz (Pos. 5–6), "Ja als Ersatz"-Option, Abwesenheitskalender, Verlegungserkennung über stabile Event-UID, WhatsApp-Textgenerator, passwortloser Login, täglicher Sync per GitHub Action | **Deckt ca. 70 % des TT-Planer-Kerns ab und ist fachlich exakt der richtige Zuschnitt.** ⚠️ **Kein LICENSE-File im Repo** → rechtlich "alle Rechte vorbehalten". Vor Fork/Übernahme den Autor um eine Lizenz (z. B. MIT) bitten. |
| [dominik-lueke/ttr-mannschafts-planer-2.0](https://github.com/dominik-lueke/ttr-mannschafts-planer-2.0) | Desktop-Tool für die **Mannschaftsmeldung**: Drag & Drop, Import der Vorsaison-Aufstellungen und Bilanzen aus click-TT, QTTR aus myTischtennis, prüft Regeln der WTTV-Wettspielordnung Abschnitt H (Sollstärke/Toleranz, RES/SBE), Export PDF/XLSX | Löst ein anderes Problem (Meldung, nicht Spieltag) — ergänzend nützlich, einmal pro Halbserie |
| [jolinux/Click-TT-ICS-Kalender-Konverter](https://github.com/jolinux/Click-TT-ICS-Kalender-Konverter) | CSV aus click-TT → ICS (Bash/AWK) | Referenz für das CSV-Format |
| [harald-herberth/nutab](https://github.com/harald-herberth/nutab) | nuLiga-Tabellen auf der Vereinsseite anzeigen | Für die Homepage |
| [notMYcupofTeeTee/mytt-api](https://github.com/notMYcupofTeeTee/mytt-api) | inoffizielle API-Doku (MIT) | Nachschlagewerk, s. 3.2 |

---

## 5. Kostenvergleich Eigenbau vs. TT-Planer

| Posten | TT-Planer Vollpaket | Eigenbau (Supabase Free + Vercel/Pages) | Eigenbau (kleiner VPS) |
|---|---|---|---|
| Lizenz/Abo | 180 €/Jahr | 0 € | 0 € |
| Hosting | inkl. | 0 € (Free-Tier) | ~60 €/Jahr (Hetzner CX22 o. ä.) |
| Domain | inkl. | ~12 €/Jahr | ~12 €/Jahr |
| Push-Benachrichtigungen | inkl. | 0 € (Web Push/VAPID) | 0 € |
| E-Mail-Versand | inkl. | 0 € im Free-Tier (Resend/Brevo, ~100–300 Mails/Tag) | dito |
| **Summe Sachkosten** | **~180 €/Jahr** | **~12 €/Jahr** | **~72 €/Jahr** |
| Entwicklung | 0 h | ~40–80 h MVP | dito |
| Wartung/Betrieb | 0 h | ~1–2 h/Monat + Bereitschaft | dito |

**Ehrliche Einordnung:** Die Sachkostenersparnis liegt bei rund **110–170 €/Jahr**. Wenn die
Motivation ausschließlich Kostenersparnis ist, ist das Verhältnis von Aufwand zu Nutzen schlecht —
in dem Fall wäre der bessere Zug: Starter-Paket für 60 €/Jahr, oder SpielerPlus kostenlos, oder
die kostenlosen click-TT-Bausteine (Kalenderabo + Hallenbuchungstool) plus eine WhatsApp-Gruppe.

Der Eigenbau lohnt sich, wenn zusätzlich mindestens einer dieser Punkte gilt:

- Es soll genau auf die Abläufe **unseres** Vereins passen (z. B. eigene Ersatzregeln, Fahrdienst,  
  Schlüsselverwaltung, Arbeitsstunden nach unserer Satzung).  
- Datenhoheit ist ein Argument (DSGVO, eigenes Hosting in der EU, keine Mitgliederdaten bei Dritten).  
- Es gibt jemanden im Verein, der das dauerhaft betreut — **Bus-Faktor 1 ist das echte Risiko**,  
  nicht die Technik.  
- Der Bau macht Spaß / ist ein Lernprojekt. Das ist ein legitimer Grund, sollte aber im Vorstand  
  ehrlich so benannt werden.

---

## 6. Empfohlener Weg

1. **Vorher klären, was wirklich gebraucht wird.** Im Verein abfragen, welche TT-Planer-Module  
   tatsächlich genutzt werden. Erfahrungsgemäß sind das Spieltermine + Rückmeldungen +
   Aufstellung + Erinnerung; Arbeitsstunden und Umfragen werden oft nie angefasst.  
2. **Kostenlose Bausteine nutzen statt nachbauen**: Hallenbelegung über das DTTB-Tool,  
   Spieltermine über das click-TT-ICS-Abo.  
3. **`dgaida/tt_hsv_planner` ansehen und den Autor kontaktieren.** Das Projekt macht fachlich  
   genau das Richtige. Eine Lizenz-Anfrage kostet eine E-Mail und spart im Erfolgsfall den
   Großteil der 40–80 Stunden. Ohne Lizenz darf man es nicht übernehmen, sich aber davon
   inspirieren lassen (Konzepte sind nicht geschützt, Code schon).  
4. **Parallelbetrieb planen.** Kündigungsfrist von 3 Monaten beachten: Die Eigenlösung muss eine  
   volle Halbserie stabil gelaufen sein, bevor der TT-Planer gekündigt wird.

---

## 7. Architekturvorschlag für die Eigenlösung

### 7.1 MVP-Scope (Phase 1)

Alles andere ist Phase 2+.

- Mannschaften anlegen, Kader mit Stammspielern (Position 1..n) und geordneter Ersatzliste  
- Spieltermine automatisch aus dem click-TT-Webcal je Mannschaft synchronisieren (täglich),  
  Verlegungen über die Event-UID erkennen und betroffene Rückmeldungen als "veraltet" markieren  
- Rückmeldung je Termin: **zu / ab / nur als Ersatz**, mit Kommentar  
- Automatische Erinnerung an alle ohne Rückmeldung (X Stunden vorher, konfigurierbar)  
- Ersatzkette: Bei Absage eines Stammspielers sequentielle Anfrage der Ersatzspieler mit Timeout,  
  Eskalation an den Mannschaftsführer wenn die Kette leer läuft  
- Aufstellung ansehen/festlegen + Textexport für WhatsApp  
- Rollen: Spieler, Mannschaftsführer, Admin  
- Passwortloser Login (Magic Link) — Vereinsmitglieder installieren keine App und merken sich  
  keine Passwörter

### 7.2 Stack-Empfehlung

| Schicht | Empfehlung | Warum |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, als **PWA** | Wie TT-Planer: installierbar, Push, keine App-Stores, kein Apple-Developer-Account (99 $/Jahr) |
| Backend/DB | Supabase (Postgres + Auth + Row Level Security + Edge Functions) oder schlank: SvelteKit/Next auf einem VPS mit Postgres | Free-Tier deckt einen Verein locker ab; RLS erzwingt "Spieler sieht nur seinen Verein" auf DB-Ebene |
| Sync | Cronjob (GitHub Action oder Supabase Scheduled Function) zieht die ICS-Feeds | Kein Scraping, robust |
| Push | Web Push (VAPID) | Kostenlos, funktioniert auf Android und seit iOS 16.4 auch auf iPhone (Voraussetzung: zum Homescreen hinzugefügt) |
| E-Mail | Resend/Brevo Free-Tier als Fallback für Push | Nicht jeder installiert die PWA |
| Hosting | Vercel/Netlify/GitHub Pages (Frontend) + Supabase; alternativ ein Hetzner-VPS mit Docker | 0–60 €/Jahr |

### 7.3 Datenmodell (Skizze)

```sql
clubs(id, name)
members(id, club_id, first_name, last_name, email, phone, qttr, active)
roles(member_id, club_id, role)            -- admin | captain | player
teams(id, club_id, name, league, calendar_url, lineup_mode)
team_members(team_id, member_id, position, kind)   -- kind: regular | substitute, position = Reihenfolge
fixtures(id, team_id, external_uid, starts_at, opponent, home_away, venue, status, updated_at)
availabilities(fixture_id, member_id, state, comment, responded_at, stale)
                                            -- state: yes | no | as_substitute | pending
substitute_requests(fixture_id, member_id, position, sent_at, answered_at, state)
lineups(fixture_id, positions jsonb, confirmed_by, confirmed_at)
notifications(id, member_id, channel, payload, sent_at, read_at)
```

Der `external_uid` aus dem ICS ist der Schlüssel für die Verlegungserkennung: Ändert sich
`starts_at` bei gleicher UID, ist es eine Verlegung (Rückmeldungen entwerten), taucht eine UID
nicht mehr auf, ist das Spiel entfallen.

### 7.4 Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Bus-Faktor 1 — nur eine Person kann das System warten | Code im Vereins-GitHub, Doku im Repo, zweite Person als Admin einarbeiten, Exportfunktion für alle Daten |
| ICS-Feed ändert Format/URL (Saisonwechsel) | Sync-Fehler aktiv an den Admin melden, nicht still scheitern lassen; manuelle Termineingabe als Fallback |
| DSGVO | Verarbeitungsverzeichnis, AV-Vertrag mit dem Hoster (Supabase: EU-Region wählen!), Datensparsamkeit (kein Geburtsdatum, wenn nicht nötig), Löschkonzept für ausgetretene Mitglieder |
| Akzeptanz | Der TT-Planer ist ausgereift. Eine halbfertige Eigenlösung wird von den Spielern nicht angenommen und der Verein fällt auf WhatsApp zurück. Deshalb: klein anfangen, aber das Kleine vollständig. |
| Free-Tier-Änderungen bei Supabase/Vercel | Migrationspfad auf einen VPS von Anfang an mitdenken (Docker, Postgres, keine proprietären Features außer Auth) |

---

## 8. Offene Punkte vor der Entscheidung

- [ ] Preise und AGB auf tt-planer.de verifizieren (Recherche basiert teils auf Snapshots).  
- [ ] Im Verein erheben: Welche Module werden heute tatsächlich genutzt?  
- [ ] Wer betreut die Lösung in 3 Jahren?  
- [ ] Autor von `tt_hsv_planner` wegen Lizenz anschreiben.  
- [ ] Prüfen, ob unser Landesverband beim click-TT-Kalenderabo je Mannschaft Webcal-Links anbietet  
      (in der Mannschaftsübersicht der click-TT-Vereinsseite unterhalb des Spielplans).  
- [ ] Testen, ob SpielerPlus (kostenlos) mit einem ICS-Import als 80-%-Lösung reicht.  

---

## 9. Quellen

- [TT-Planer — Startseite](https://www.tt-planer.de/), [Preise & Pakete](https://www.tt-planer.de/preise/), [FAQ](https://www.tt-planer.de/faq/), [AGB](https://www.tt-planer.de/agb/), [Hilfe](https://www.tt-planer.de/hilfe/), [Einstieg](https://www.tt-planer.de/hilfe/einstieg-in-den-tt-planer/)  
- [myTischtennis: TT-Planer — Eine App für die ganze Orga](https://www.mytischtennis.de/news/partner/tt-planer-eine-app-fur-die-ganze-orga)  
- [TTC Holzwickede über den TT-Planer](https://ttc-holzwickede.de/tt-planer/)  
- [smart-tt — Funktionen](https://smart-tt.de/funktionen.html)  
- [TT-Coach Vereinsverwaltung](https://tt-coach.de/tt-vereinsverwaltung)  
- [Henke Software / web4sport](https://www.web4sport.de/), [TT-Turnier](https://www.htts.de/?Page=TTTurnier)  
- [SpielerPlus](https://www.spielerplus.de/lp/premium), [SportEasy Tischtennis](https://www.sporteasy.net/de/teams/sports/ping_pong/), [Vereinsplaner](https://vereinsplaner.de/toolset-fuer-vereine), [Sportdeutschland Vereinsapp](https://vereinsapp.sportdeutschland.de/)  
- [DTTB: Kostenloses Online-Hallenbuchungstool](https://www.tischtennis.de/news/vereinsservice-kostenloses-online-hallenbuchungstool-jetzt-nutzbar.html), [Info-PDF für Vereine](https://www.tischtennis.de/fileadmin/documents/01_Verbaende/Hallenbelegungstool/Info_Vereine_Hallenbelegungstool.pdf)  
- [nu Datenautomaten GmbH — Tischtennis](https://www.nu-gmbh.com/sportarten/tischtennis), [click-TT Deutschland](https://dttb.click-tt.de/)  
- [BTTV: Downloads in click-TT](https://www.bttv.de/service/click-tt/click-tt-fuer-vereine/downloads-in-click-tt), [BTTV: nuScore](https://www.bttv.de/service/click-tt/click-tt-fuer-vereine/nuscore-der-digitale-spielbericht)  
- [HTTV: Mannschaftsmeldung in click-TT (PDF)](https://www.httv.de/media/000/click-TT/Anleitungen/Mannschaftsmeldung.pdf)  
- [myTischtennis: Update Kalender-Integration](https://www.mytischtennis.de/news/mytischtennis-news/update-kalender-integration-und-neue-mobile-darstellung)  
- GitHub: [dgaida/tt_hsv_planner](https://github.com/dgaida/tt_hsv_planner), [dominik-lueke/ttr-mannschafts-planer-2.0](https://github.com/dominik-lueke/ttr-mannschafts-planer-2.0), [jolinux/Click-TT-ICS-Kalender-Konverter](https://github.com/jolinux/Click-TT-ICS-Kalender-Konverter), [harald-herberth/nutab](https://github.com/harald-herberth/nutab), [notMYcupofTeeTee/mytt-api](https://github.com/notMYcupofTeeTee/mytt-api), [legout/mytt-scraper](https://github.com/legout/mytt-scraper)  
