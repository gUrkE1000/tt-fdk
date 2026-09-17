# Funktionsvergleich: TT-Planer vs. aktueller Repo-Stand

Stand: 17.09.2026 · Repo-Stand: Merge von `dgaida/tt_hsv_planner` @ `f8ec2a5` (v1.2.5)

**Methodik und Belastbarkeit der Angaben**

- **Repo-Spalte:** vollständig verifiziert am Code — `src/`, `supabase/migrations/20260808000000_init.sql`,
  `supabase/functions/sync-calendars/index.ts`, `REQUIREMENTS.md`, `docs/nutzung.md`,
  `docs/architektur.md`, `docs/datenbank.md`. Wo Doku und Code auseinandergehen, gilt der Code;
  solche Fälle sind markiert.
- **TT-Planer-Spalte:** aus öffentlich zugänglichen Quellen rekonstruiert (Herstellerseite, Hilfe-
  und FAQ-Seiten, myTischtennis-Partnerartikel, Vereinsberichte). Die Hilfeseiten sind teilweise
  bot-geschützt, ein vollständiger Durchlauf durch die Anwendung selbst war nicht möglich.
  **Die Liste ist daher als „mindestens dieser Umfang" zu lesen, nicht als garantiert erschöpfend.**
  Verifizieren lässt sich das endgültig nur im 3-Monats-Test.

> **Nachtrag 17.09.2026 — durch die [Bestandsaufnahme](tt-planer-bestandsaufnahme.md) überholt.**
> Die TT-Planer-Spalte dieses Dokuments beruht auf öffentlichen Quellen. Die Erhebung in der eingeloggten
> Anwendung hat drei Annahmen korrigiert: (1) Es gibt **keinen Rückweg nach click-TT** — Teil 2 Zeile 17
> entfällt; „bequem in click-TT" meint die Ablage von NuScore-Code/PIN. (2) **Halle ist keine Tischbelegung**,
> nur ein Ort mit Kapazität — Teil 2 Zeile 8 ist damit klein. (3) Die Ersatzkette hat **drei Modi**
> (einzeln / alle gleichzeitig / manuell) und **keine sichtbare Frist**; die Spiel-Erinnerung ist **pro
> Mitglied** in Stunden, die Trainings-Erinnerung **pro Training**. Außerdem ist der Gesamtumfang deutlich
> größer als hier erfasst (Vereinstermine, Kalender mit ICS-Abo, Orte & Schlüssel, Gruppen, Fahrdienst,
> 15 Benachrichtigungstypen). Verbindlich sind jetzt [zielbild.md](zielbild.md) und
> [umsetzungsplan.md](umsetzungsplan.md); dieses Dokument bleibt als Analyse des Repo-Stands stehen.

Legende: ✅ vorhanden · 🟡 teilweise · ❌ nicht vorhanden

---

## Teil 1 — Was beide können

Gemeinsame Schnittmenge, sortiert nach Wichtigkeit für den Spieltagsbetrieb.

| # | Funktion | TT-Planer | Repo | Anmerkung zum Repo-Stand |
|---|---|---|---|---|
| 1 | **Spieltermine aus click-TT/myTischtennis übernehmen** | ✅ Import aus click-TT | ✅ Webcal/ICS-Abo je Mannschaft | Automatisch täglich 04:00 UTC per GitHub Action → Supabase Edge Function; manueller Sync im Frontend |
| 2 | **Spielverlegungen erkennen** | ✅ | ✅ | Über stabile ICS-`UID`; `version` wird hochgezählt, Änderung in `match_changes` protokolliert |
| 3 | **Veraltete Rückmeldungen nach Verlegung entwerten** | ✅ (implizit über Neuabfrage) | ✅ | `version_responded` ≠ `version` → ⚠️ im Frontend, erneute Antwort nötig |
| 4 | **Zu-/Absage je Spieltermin (RSVP)** | ✅ | ✅ | `yes` / `no` / `maybe` / keine Antwort (= kein DB-Eintrag) |
| 5 | **Bemerkung zur Rückmeldung** | ✅ | ✅ | Freitext je Rückmeldung, z. B. „komme erst 19:30" |
| 6 | **Mannschaftskader pflegen** | ✅ Stammspieler + Ersatzspieler | ✅ | `team_players` + `team_number`/`position_number` als vereinsweite Rangfolge |
| 7 | **Stammspieler vs. Ersatzspieler unterscheiden** | ✅ | ✅ | Positionen 1–4 = Stamm, Position 5 = Ersatz (amber markiert) |
| 8 | **Automatische Aufstellung berechnen** | ✅ | ✅ | 5-stufige Sortierung: `yes` > `yes_sub` > keine Antwort > `maybe` > `no`, Tie-Break Team-Nr. → Positions-Nr. → Name |
| 9 | **Mannschaftsübergreifender Ersatz** | ✅ | ✅ | Spieler tragen sich bei fremden Mannschaften ein; Nachrücker-Hierarchie nach Vereinsrangliste |
| 10 | **Rollen- und Rechtekonzept** | ✅ Admin, Trainer, Mannschaftsführer, Mitglied | ✅ `player`, `team_manager`, `sportwart`, `club_admin` | Sportwart-Rolle ist eine TT-Eigenheit, die der TT-Planer so nicht getrennt führt |
| 11 | **Mannschaftsführer sieht alle Rückmeldungen im Überblick** | ✅ | ✅ | Team-Matrix: Spieler × Spiele als Tabelle, Änderung direkt in der Zelle |
| 12 | **Mannschaftsführer wird über Absagen informiert** | ✅ Push/Mail bei Absage und gescheiterter Ersatzanfrage | 🟡 | Repo: blaues Banner mit allen Änderungen **seit dem letzten Login** — nur beim Einloggen, kein aktiver Versand |
| 13 | **Abwesenheiten/Urlaub pflegen** | ✅ | ✅ | „Mein Kalender": Zeitraum + Grund; Admin-Sicht über alle Abwesenheiten |
| 14 | **Abwesenheitsübersicht für Verantwortliche** | ✅ Admin sieht alle Abwesenheiten im Kalender | ✅ | 4-Monats-Matrix (2×2-Grid), Klick auf Tag → wer fehlt warum |
| 15 | **Warnung bei zu wenigen Zusagen** | ✅ (über Ersatzanfragen-Automatik) | ✅ | < 4 Zusagen → roter Spieltitel + Warndreieck |
| 16 | **Gesamtübersicht über alle Mannschaften** | ✅ Vereinskalender | 🟡 | Repo: chronologische Liste aller Spiele + Terminkonflikt-Erkennung; kein Kalender mit Monats-/Wochenansicht |
| 17 | **Mobilnutzung** | ✅ PWA, installierbar | 🟡 | Repo: mobile-first responsive Weboberfläche, aber **keine PWA** (kein Manifest, kein Service Worker) → nicht installierbar, kein Offline, kein Push |
| 18 | **Zugang ohne Registrierungszwang für Spieler** | ✅ Einladung per Mail/Link | ✅ | Repo: Namensauswahl im Dropdown, Profile ohne Auth-Account möglich |
| 19 | **Integrierte Anleitung** | ✅ Hilfe-Portal (extern) | ✅ | Repo: `GuideView.tsx`, rollenspezifisch, direkt in der App |
| 20 | **Protokoll/Nachvollziehbarkeit der Termin-Importe** | ✅ (Anbieterseitig) | ✅ | `sync_runs` mit Status, Zeitstempel, Zusammenfassung; einsehbar im Admin-Dashboard |

**Teilabdeckungen im Detail** (Zeilen 12, 16, 17 oben):

- **Benachrichtigung (12):** Der TT-Planer stößt Kommunikation aktiv an (Push/E-Mail), das Repo
  zeigt Informationen nur an, wenn jemand die Seite öffnet. Funktional dieselbe Information,
  operativ ein großer Unterschied — siehe Teil 2, Punkt 1.
- **Kalender (16):** Der TT-Planer bündelt Training, Spiele, Geburtstage und Vereinsevents in
  einem Kalender mit mehreren Ansichten. Das Repo kennt ausschließlich Mannschaftsspiele.
- **PWA (17):** Beide sind Webanwendungen ohne App-Store. Der TT-Planer ist als PWA installierbar
  inkl. Push; im Repo fehlt die PWA-Hülle komplett.

---

## Teil 2 — Was nur der TT-Planer kann (Lücken im Repo)

Sortiert nach Schmerz im Alltag. Die Aufwandsschätzung ist grob und meint Entwicklungszeit
inklusive Test, nicht Kalenderzeit.

### A. Kritisch — ohne das ist die Eigenlösung im Betrieb schwächer

| # | Funktion | TT-Planer | Repo | Aufwand |
|---|---|---|---|---|
| 1 | **Aktive Erinnerungen** — automatische Benachrichtigung X Stunden (Default 5, einstellbar) vor dem Termin an alle ohne Rückmeldung | ✅ | ❌ keinerlei ausgehende Kommunikation: kein Push, kein E-Mail-Versand, kein Cron dafür | 8–16 h (Web Push + VAPID + Scheduler) |
| 2 | **Ersatzspieler-Automatik** — bei Absage werden definierte Ersatzspieler automatisch der Reihe nach angefragt; sagt einer ab, rückt die Anfrage weiter; läuft die Kette leer, wird der Mannschaftsführer informiert | ✅ (Modus „einzeln nach Reihenfolge") | ❌ Das Repo **berechnet** nur, wer nachrücken würde — **angefragt wird niemand.** Der Mannschaftsführer muss weiterhin selbst anrufen/schreiben | 16–24 h (setzt Punkt 1 voraus) |
| 3 | **Push-Benachrichtigungen** | ✅ über installierte PWA | ❌ | in Punkt 1 enthalten |
| 4 | **E-Mail an die Mannschaft** (Treffpunkt + Aufstellung vor dem Spieltag versenden) | ✅ | ❌ nur WhatsApp-Text zum Kopieren | 4–8 h |
| 5 | **Mitglieder einladen / Onboarding** — Einladung per Mail, Admin bekommt Mail bei jeder Neuregistrierung | ✅ | ❌ Registrierung nur selbstständig; niemand wird informiert | 4–8 h |

### B. Ganze Module, die im Repo fehlen

| # | Modul | TT-Planer | Repo | Aufwand |
|---|---|---|---|---|
| 6 | **Trainingsplanung** — Trainingszeiten anlegen, Rhythmus (z. B. 14-tägig), Zuordnung von Trainern, Teilnahmeabfrage per Klick, Übersicht „wer kommt heute", Anzeige wer einen Hallenschlüssel hat | ✅ | ❌ kein Trainingsbegriff im Datenmodell | 24–40 h |
| 7 | **Trainingsausfälle** — einzelne Termine oder Zeiträume absagen; automatischer Ausfall an Feiertagen und in den Schulferien; keine Erinnerungen für ausgefallene Termine | ✅ | ❌ | 8–16 h (Feiertags-/Ferienkalender je Bundesland) |
| 8 | **Hallen- und Tischbelegung** — Hallen anlegen, Tischanzahl, Belegung planen und buchen | ✅ | ❌ | 24–40 h — **aber:** der DTTB stellt ein kostenloses Hallenbuchungstool in click-TT bereit, das diesen Bedarf abdeckt. Nicht nachbauen. |
| 9 | **Vereinskalender** — alle Termine in einem Kalender: Training, Spiele, Geburtstage, Vereinsevents, mehrere Ansichten | ✅ | 🟡 nur Spieleliste | 16–24 h |
| 10 | **Umfragen** — für Verein, Mannschaft oder Gruppe; Einfach-/Mehrfachauswahl; persönliche Anfragen („Wer hilft bei X?") | ✅ | ❌ | 12–20 h |
| 11 | **Spielverlegung abstimmen** — Umfrage an die Stammspieler zur Findung eines Ersatztermins | ✅ | ❌ Repo erkennt Verlegungen nur passiv, nachdem sie in click-TT stehen | 8–12 h (setzt Punkt 10 voraus) |
| 12 | **Arbeitsstunden** — Erfassung und Auswertung geleisteter Stunden | ✅ | ❌ | 12–20 h |
| 13 | **Vereinsnachrichten / News** — Mitteilungen an alle Mitglieder | ✅ | ❌ | 8–12 h |
| 14 | **Vereinsrollen / Ämter** — Ämter anlegen, Mitglieder zuordnen, für alle transparent sichtbar | ✅ | ❌ (`role` ist nur ein technisches Rechte-Enum) | 4–8 h |
| 15 | **Mitgliederverwaltung mit Kontaktdaten** — Telefon, Adresse, Gruppen, Abteilungen | ✅ | ❌ `profiles` kennt nur Name, Rolle, TTR, Team-Nr., Positions-Nr. — **keine E-Mail, keine Telefonnummer** | 8–16 h |
| 16 | **Trennung Mannschaftsspieler / reine Trainingsteilnehmer** | ✅ | ❌ jedes Profil ist implizit Spieler | 4–8 h |
| 17 | **Rückschreiben nach click-TT** — verwaltete Mannschaftsspiele bequem nach click-TT importieren | ✅ | ❌ Datenfluss ist reine Einbahnstraße click-TT → App | 16–24 h, abhängig vom Format |

### C. Betrieb, Support, Recht — keine Features, aber entscheidend

| # | Punkt | TT-Planer | Repo |
|---|---|---|---|
| 18 | **Support und Weiterentwicklung** | Anbieter, regelmäßige Updates, offiziell von myTischtennis empfohlen | Wir selbst. Bus-Faktor derzeit 1 |
| 19 | **Auftragsverarbeitung / DSGVO-Unterlagen** | Anbieter stellt AV-Vertrag und Datenschutzerklärung | Müssen wir selbst erstellen (AV mit Supabase, Verarbeitungsverzeichnis, Löschkonzept) |
| 20 | **Rechtssicherheit der Nutzung** | klare AGB | **Upstream ohne Lizenz** — siehe [NOTICE.md](../NOTICE.md) |
| 21 | **Betriebsverantwortung** | Anbieter | Wir: Supabase-Projekt, Secrets, Migrationen, Monitoring der Sync-Läufe |
| 22 | **Ausfallsicherheit des Termin-Imports** | Anbieterseitig | Client-Fallback nutzt **fremde öffentliche CORS-Proxies** (`api.allorigins.win`, `api.codetabs.com`) — Fremdabhängigkeit ohne Zusage |

---

## Teil 3 — Was nur das Repo kann (Vorsprung gegenüber TT-Planer)

Diese Punkte sind der eigentliche Grund, warum sich der Eigenbau überhaupt lohnt — sie sind
tischtennis-fachlich tiefer als das kommerzielle Produkt.

| # | Funktion | Details |
|---|---|---|
| 1 | **Taktischer Status „Ja als Ersatz" (`yes_sub`)** | Fünfter Rückmeldestatus, den nur erweiterte Rollen setzen können: Spieler bleibt eine positive Zusage, wird aber hinter alle regulären „Ja" auf Position 5/6 sortiert. Erlaubt Kaderpflege, ohne jemanden auf „Nein" zu setzen. Im TT-Planer nicht bekannt. |
| 2 | **WhatsApp-Textgenerator mit zwei Vorlagen** | ≥ 4 Zusagen → fertige Aufstellungsmeldung inkl. Backup-Spieler; < 4 Zusagen → Dringlichkeitsaufruf mit Anzahl fehlender Spieler (korrekter Singular/Plural), bisherigen Zusagen und automatischer Frist (1 Woche vor Spiel). Trifft den realen Vereinsalltag, in dem WhatsApp der Kanal bleibt. |
| 3 | **Parallelspiel-Erkennung** | Erkennt zeitgleiche Spiele anderer Vereinsmannschaften am selben Ort und ergänzt den Hinweis automatisch im generierten Text. |
| 4 | **Automatische Ankunftszeit** | Bei ≥ 4 Zusagen: Heimspiel 1 h vor Spielbeginn in der Halle, Auswärtsspiel 30 min vor Beginn am Spielort — automatisch im Text. |
| 5 | **Terminkonflikt-Erkennung über Mannschaften hinweg** | Sagt ein Spieler am selben Tag zur selben Zeit bei zwei Mannschaften zu, warnt die Gesamtübersicht optisch. |
| 6 | **Q-TTR-Punkte im Profil + HTML-Kader-Import** | Import der Mannschaftsmeldung von myTischtennis inkl. Q-TTR; Abgleich klassifiziert transparent in „bereits aktuell" / „nur aktualisiert" / „ersetzt". Fallback: HTML manuell einfügen. |
| 7 | **Sicherheitssperre beim Kalender-Sync** | Liefert ein ICS-Feed 0 Termine, obwohl aktive Spiele existieren, wird **nichts** gelöscht oder deaktiviert; der Lauf wird als Warnung protokolliert. Schützt vor Datenverlust bei Ausfällen der Gegenstelle. |
| 8 | **Zweistufiger Sync mit Client-Fallback** | Fällt die Edge Function aus, synchronisiert der Browser über CORS-Proxies weiter — mit Retries (bis 3) und gestaffelten Pausen (1500 ms). |
| 9 | **Automatische Profil-Verknüpfung bei Registrierung** | Registriert sich jemand mit seinem vollen Namen, wird ein bereits importiertes Profil per Namensabgleich übernommen — inkl. Cascade auf RSVPs, Abwesenheiten, Teamzuordnungen und JSONB-Lineups. Kein Admin-Eingriff nötig. |
| 10 | **Datenschutzfreundliche Namensanzeige** | Anzeige gekürzt als „Max M". |
| 11 | **Anzeige abgesagter/inaktiver Spiele** | Eigener Bereich „🚫 Abgesagte / Inaktive Spiele" statt stillem Verschwinden. |
| 12 | **Volle Datenhoheit und Erweiterbarkeit** | Eigenes Supabase-Projekt (EU-Region wählbar), eigener Code, SQL-Zugriff, beliebige Auswertungen, kein Vendor-Lock-in, keine Vertragslaufzeit. |
| 13 | **87 automatisierte Tests, 85 % Coverage, CI/CD** | Vitest + GitHub Actions; `icsParser` und `syncEngine` sind testabgedeckt. Für ein Vereinsprojekt ungewöhnlich solide. |

---

## Teil 4 — Baustellen im übernommenen Stand

Keine Featurelücken gegenüber dem TT-Planer, sondern Dinge, die vor einem Produktivbetrieb bei
uns zwingend angefasst werden müssen.

| # | Befund | Fundstelle | Bewertung |
|---|---|---|---|
| 1 | **RLS-Policies sind faktisch offen.** Für jede der 9 Tabellen existiert eine Policy `FOR ALL USING (true) WITH CHECK (true)`. Jeder, der den Anon-Key hat (er steht im ausgelieferten JS-Bundle), kann sämtliche Daten lesen **und schreiben** — Rollen inklusive. Die Rollenprüfung findet ausschließlich im Frontend statt. | `supabase/migrations/20260808000000_init.sql:302–405`; `src/App.tsx:179,338,340` | **Kritisch.** Widerspricht den eigenen Anforderungen NFA-2.2.1 und FA-1.3.4. Vor Produktivbetrieb mit echten Mitgliederdaten zu beheben. |
| 2 | **Passwortloser Login ist eine reine Namensauswahl.** Wer das Vereinspasswort kennt, kann sich als beliebiger Spieler ausgeben und in dessen Namen zu- oder absagen. | `src/components/AuthScreen.tsx:66–67` | Für ein Vereinstool vertretbar, aber bewusst zu entscheiden. Magic-Link per E-Mail wäre der saubere Ersatz. |
| 3 | **Vereinsname ist hart verdrahtet.** Die Heim/Auswärts-Erkennung prüft auf die Zeichenketten `heiligenhaus`/`heiligenhauser`; der Kader-Import baut eine feste WTTV-URL mit `Heiligenhauser_SV`. | `src/lib/icsParser.ts:169–170`; `src/components/SportwartView.tsx:255` | **Blocker für uns** — muss auf unseren Verein und unseren Landesverband parametrisiert werden. Gehört in `club_settings`. |
| 4 | **Kadergröße ist auf 4er-Mannschaften fixiert.** Aufstellung = `slice(0, 5)`, Warnschwelle `< 4` Zusagen, Beschriftung „Stamm 1-4 / Ersatz". | `src/components/TeamTabView.tsx:484,740,866,876`; `src/lib/whatsappUtils.ts:229` | Spielt unser Verein irgendwo 6er, muss die Kadergröße pro Mannschaft konfigurierbar werden. |
| 5 | **Drei Beispielmannschaften und Testspieler werden mit angelegt.** | `supabase/migrations/…_init.sql:78–90` und folgende | Vor dem ersten Echteinsatz bereinigen; Default-Vereinspasswort `Tischtennis2026` ändern. |
| 6 | **Keine E-Mail-Adresse im Profil.** `profiles` hat keine Kontaktspalten; E-Mails liegen nur in `auth.users` für registrierte Accounts. | `supabase/migrations/…_init.sql:39–48` | Blockiert jede Form von Mail-Versand (Teil 2, A4/A5) und ist damit Voraussetzung für die Erinnerungs-Funktion. |
| 7 | **Abhängigkeit von fremden CORS-Proxies.** | `src/lib/syncEngine.ts` | Fällt der Proxy aus, funktioniert nur noch der Server-Sync. Akzeptabel als Fallback, nicht als Hauptweg. |
| 8 | **Doku und Schema weichen ab.** `docs/architektur.md` nennt Spalten `uid`, `date`, `match_version`, `profile_id`, `status`; im Schema heißen sie `external_uid`, `dtstart`, `version`, `player_id`, `response`. Auch der Status `yes_sub` fehlt in der Aufzählung der Architektur-Doku. | `docs/architektur.md` vs. `…_init.sql` | Kosmetisch, aber beim Weiterbauen irreführend. |

---

## Teil 5 — Abdeckungsbilanz

Gemessen an den in Teil 1 und 2 gelisteten TT-Planer-Funktionen:

| Bereich | Abdeckung durch den Repo-Stand |
|---|---|
| Spieltag: Termine, Rückmeldungen, Aufstellung, Ersatz-Ermittlung | **~90 %** — hier ist das Repo sogar tiefer als der TT-Planer (Teil 3) |
| Aktive Kommunikation: Erinnerungen, Ersatzanfragen, Mails, Push | **0 %** |
| Training und Halle | **0 %** (Halle über das kostenlose DTTB-Tool abgedeckt) |
| Allgemeine Vereinsorga: Kalender, Umfragen, News, Ämter, Arbeitsstunden, Mitgliederdaten | **~5 %** |
| **Gesamt gegenüber dem Vollpaket** | **grob 35–40 %** |
| **Gegenüber dem Starter-Paket / dem real genutzten Umfang vieler Vereine** | deutlich höher — der Spieltagsteil ist der Teil, den ein Verein täglich braucht |

---

## Teil 6 — Vorgeschlagene Reihenfolge

1. **Vereinsspezifika parametrisieren** (Teil 4, #3 + #5) — ohne das läuft bei uns gar nichts.
   Vereinsname, Verband, Webcal-Links, Kadergröße nach `club_settings`; Demodaten und
   Default-Passwort raus. *~8 h*
2. **RLS scharf stellen** (Teil 4, #1) — rollenbasierte Policies, Rollenprüfung serverseitig.
   Muss vor dem ersten echten Mitgliederdatensatz stehen. *~12 h*
3. **E-Mail im Profil + Erinnerungen** (Teil 2, A1/A4/A5) — der größte spürbare Gewinn gegenüber
   dem heutigen Stand und Voraussetzung für alles Weitere. *~16 h*
4. **Ersatzspieler-Automatik** (Teil 2, A2) — die Funktion, für die Vereine den TT-Planer loben.
   Baut auf Schritt 3 auf. *~20 h*
5. **PWA-Hülle + Web Push** (Teil 1, #17) — installierbar auf dem Homescreen, Erinnerungen
   erreichen die Leute wirklich. *~12 h*
6. Erst danach abwägen: Trainingsmodul, Vereinskalender, Umfragen. Vorher im Verein prüfen, ob
   diese Module überhaupt genutzt werden — im Zweifel bleibt der TT-Planer für die Vereinsorga
   und die Eigenlösung macht den Spieltag.

Nach Schritt 5 deckt die Eigenlösung den Spieltagsbetrieb vollständig und teilweise besser ab als
der TT-Planer. Die Vereinsorga (Training, Halle, Umfragen, Arbeitsstunden) bleibt offen — das ist
die ehrliche Entscheidungsfrage an den Vorstand: brauchen wir die, oder brauchen wir den Spieltag.
