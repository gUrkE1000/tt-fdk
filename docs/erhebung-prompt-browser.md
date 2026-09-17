# Erhebungs-Prompt für Claude im Browser (TT-Planer)

Zweck: In einem Durchgang durch den eingeloggten TT-Planer alles erfassen, was für den
Funktionsvergleich (`funktionsvergleich.md`) und den Nachbau fehlt. Ergebnis ist eine
Markdown-Datei, die zurück in die Entwicklungs-Session gespielt wird.

Anwendung: Im TT-Planer einloggen (möglichst mit Admin-Rechten), dann den Prompt unten
vollständig an Claude im Browser übergeben.

Hinweise vorab:  
- Der Browser-Claude handelt in deiner Session mit deinen Rechten. Der Prompt ist deshalb  
  strikt lesend formuliert. Wenn er trotzdem etwas ändern will: ablehnen.  
- Der TT-Planer enthält echte Mitgliederdaten. Der Prompt fordert Pseudonymisierung —  
  bitte beim Zurückspielen trotzdem kurz drüberschauen.  
- Realistisch sind 30–60 Minuten. Der Prompt ist so gebaut, dass Claude auch dann ein  
  verwertbares Ergebnis liefert, wenn er nur einen Teil schafft.

---

## Der Prompt

````text
Du arbeitest in meiner eingeloggten Session des TT-Planers (https://www.tt-planer.de), einer
SaaS-Anwendung für die Organisation von Tischtennisvereinen. Ich bin Mitglied im Verein und
habe dort Zugriff.

AUFGABE
Erstelle eine vollständige, strukturierte Bestandsaufnahme des Funktionsumfangs. Ich baue für
meinen Verein eine eigene, schlankere Lösung für den Spieltagsbetrieb und brauche eine präzise
Beschreibung dessen, was der TT-Planer kann — auf Feldebene, nicht als Marketingtext. Das
Ergebnis gebe ich an eine andere Claude-Session weiter, die daraus die Entwicklung ableitet.

HARTE REGELN — BITTE STRIKT EINHALTEN
1. NUR LESEN. Du darfst navigieren, Ansichten öffnen, Tabs wechseln, Filter setzen und
   Formulare ANSEHEN. Du darfst NICHTS speichern, anlegen, ändern, löschen oder absenden.
2. Insbesondere verboten: Benachrichtigungen, Erinnerungen, Ersatzanfragen, Einladungen,
   Umfragen oder E-Mails auslösen; Zu-/Absagen setzen oder ändern; Termine, Trainings,
   Mitglieder oder Mannschaften anlegen oder löschen; Einstellungen speichern; Paket wechseln,
   Zahlungsdaten eingeben, kündigen oder Testphase beenden.
3. Formulare darfst du öffnen, um die Felder zu dokumentieren — aber NICHT abschicken. Wenn
   ein Dialog nur mit Speichern verlassen werden kann, brich ab und notiere das.
4. DATENSCHUTZ: Keine echten Personendaten in den Bericht. Ersetze Namen durch "Mitglied A",
   "Mitglied B", E-Mails durch "name@example.com", Telefonnummern durch "01xx xxxxxxx".
   Strukturen und Feldnamen sind gefragt, keine Inhalte. Keine Screenshots von Mitgliederlisten.
5. Wenn dir etwas den Zugriff verweigert (fehlende Rechte, Paketgrenze, Fehlermeldung):
   notiere es als Lücke und mach weiter. Rate nicht.
6. Erfinde nichts. Wenn du etwas nicht sicher gesehen hast, markiere es als "unsicher".

ERHEBUNGSPLAN
Arbeite die folgenden Bereiche der Reihe nach ab. Dokumentiere pro Bereich: wo er im Menü
liegt, welche Objekte es gibt, welche Felder diese Objekte haben (Feldname, Typ,
Pflichtfeld ja/nein, Auswahlmöglichkeiten, Defaultwert), welche Aktionen möglich sind, und
welche Rollen darauf zugreifen dürfen.

A) NAVIGATION UND GESAMTSTRUKTUR
   - Vollständige Menüstruktur inklusive Unterpunkte, genau so benannt wie in der Oberfläche.
   - Welche Punkte sind ausgegraut, mit "Upgrade"/Schloss markiert oder nicht verfügbar?
     (Das zeigt den Unterschied Starter- vs. Vollpaket.)
   - Gibt es eine Startseite/Dashboard? Welche Kacheln/Widgets zeigt sie?

B) BENACHRICHTIGUNGEN UND ERINNERUNGEN  -- für mich der wichtigste Punkt
   - Wo werden sie konfiguriert (vereinsweit, pro Mannschaft, pro Training, pro Mitglied)?
   - Welche Kanäle gibt es (Push, E-Mail, In-App)? Wie wird Push eingerichtet?
   - Welche Auslöser/Ereignisse lösen eine Benachrichtigung aus? Liste sie vollständig auf.
   - Welche Vorlaufzeit ist einstellbar (Default 5 Stunden?), in welchen Schritten?
   - Werden nur Mitglieder ohne Rückmeldung erinnert oder alle?
   - Kann ein Mitglied eigene Benachrichtigungen ein-/ausschalten? Welche Optionen genau?

C) MANNSCHAFTEN UND MANNSCHAFTSSPIELE  -- zweitwichtigster Punkt
   - Felder einer Mannschaft (Name, Liga, Spielklasse, Spieltag, Halle, Mannschaftsführer …).
   - Kaderpflege: Stammspieler mit Positionen? Ersatzspieler mit Reihenfolge? Wie wird sortiert?
   - Die Einstellung "feste Stammspieler" vs. "offene Spieler": wo steht sie, was genau
     bewirkt sie, welche weiteren Modi gibt es?
   - ERSATZSPIELER-AUTOMATIK, bitte besonders genau:
     * Welche Modi sind wählbar (z. B. "einzeln nach Reihenfolge", "alle gleichzeitig", …)?
     * Nach welcher Zeit rückt die Anfrage weiter, wenn niemand antwortet? Einstellbar?
     * Was passiert, wenn die Kette leer läuft — wer wird wie informiert?
     * Kann der Mannschaftsführer die Kette manuell übersteuern?
     * Wie sieht die Anfrage beim Ersatzspieler aus (Screenshot-Beschreibung reicht)?
   - Felder eines Spieltermins (Datum, Zeit, Gegner, Heim/Auswärts, Halle, Treffpunkt,
     Fahrgemeinschaft, Bemerkung …). Was kommt aus click-TT, was pflegt man selbst?
   - Welche Rückmelde-Optionen haben Spieler (Zusage/Absage/unsicher/…)? Bemerkung möglich?
   - Wie wird die Aufstellung dargestellt und festgelegt? Automatisch oder manuell?
   - Gibt es eine Funktion "Mail an die Mannschaft" (Treffpunkt + Aufstellung)? Wie sieht sie aus?

D) CLICK-TT-ANBINDUNG  -- entscheidet, ob wir das nachbauen können
   - Wo genau sitzt der Import aus click-TT? Was wird importiert (Spielplan, Kader, beides)?
   - Was muss ich dafür eingeben (Vereinsnummer, Login, Verband, URL, Datei)?
   - Und der Rückweg: Wie kommen die Daten "bequem in click-TT"? Ist das ein Datei-Export,
     ein Copy-Paste-Text, eine echte Schnittstelle, ein Browser-Plugin? Bitte so konkret wie
     möglich — Formatname, Dateiendung, Beschriftung des Buttons.
   - Gibt es einen Kalender-Export/ICS-Abo aus dem TT-Planer heraus?

E) TRAINING
   - Felder eines Trainings (Wochentag, Zeit, Rhythmus/Turnus, Halle, Trainer, Zielgruppe,
     max. Teilnehmer …).
   - Wie funktioniert die Teilnahmeabfrage? Ab wann sichtbar, wie lange möglich?
   - Trainingsausfälle: einzeln und als Zeitraum? Gibt es eine Automatik für Feiertage und
     Schulferien — wo wird das Bundesland gewählt?
   - Gibt es Trainingsgruppen getrennt von Mannschaften?
   - Wird angezeigt, wer einen Hallenschlüssel hat? Wo wird das gepflegt?
   - Gibt es eine Auswertung/Statistik der Trainingsbeteiligung?

F) HALLE UND TISCHBELEGUNG
   - Was lässt sich anlegen (Halle, Tische, Zeitfenster)? Welche Felder?
   - Wie bucht ein Mitglied? Gibt es Kapazitätsgrenzen, Regeln, Freitextregeln?

G) MITGLIEDER UND ROLLEN
   - Welche Felder hat ein Mitgliedsdatensatz? Bitte vollständig, inklusive optionaler Felder.
     (Feldnamen genügen — KEINE echten Werte.)
   - Wie werden Mitglieder eingeladen/angelegt? Gibt es einen Import (CSV/Excel)?
   - Welche Benutzerrollen gibt es (Admin, Trainer, Mannschaftsführer, Mitglied, weitere)?
     Erstelle eine Matrix Rolle × Berechtigung, soweit erkennbar.
   - "Vereinsrollen"/Ämter: wie unterscheiden die sich von Benutzerrollen?
   - Gibt es Gruppen, Abteilungen oder eine Trennung zwischen Mannschaftsspielern und reinen
     Trainingsteilnehmern?

H) WEITERE MODULE
   - Vereinskalender: welche Termintypen laufen dort zusammen, welche Ansichten gibt es?
   - Umfragen: welche Typen (Einfach-/Mehrfachauswahl, persönliche Anfrage), an wen
     adressierbar, wie werden Ergebnisse dargestellt? Wie funktioniert die Umfrage zur
     Spielverlegung?
   - Arbeitsstunden: welche Felder, wer erfasst, wie wird ausgewertet?
   - News/Mitteilungen: Reichweite, Formatierung, Benachrichtigung?
   - Abwesenheiten: wie erfassen Mitglieder sie, wer sieht sie?
   - Alles Weitere, was du findest und was oben nicht vorkommt — bitte unbedingt aufnehmen,
     auch Kleinigkeiten.

I) EINSTELLUNGEN, PAKETE, DATEN
   - Alle vereinsweiten Einstellungen mit Feldnamen und Defaultwerten.
   - Wo steht, welches Paket aktiv ist? Welche Funktionen sind laut Oberfläche im Starter-
     Paket nicht enthalten? (NICHTS umbuchen!)
   - Gibt es Datenexport oder Datenlöschung für den Verein? Welche Formate?
   - Wo stehen Datenschutzerklärung, AV-Vertrag, Auftragsverarbeitung? Kurz zusammenfassen:
     Wer ist Betreiber, wo wird gehostet, welche Daten werden verarbeitet?

J) TECHNISCHES
   - Ist es eine PWA? Wie wird sie installiert, wie wird Push aktiviert?
   - Gibt es sichtbare URL-Muster, die auf eine API hindeuten? (Nur beschreiben, nichts aufrufen.)
   - Wie verhält sich die Oberfläche auf dem Smartphone (falls beurteilbar)?

AUSGABEFORMAT
Gib mir am Ende EINE zusammenhängende Markdown-Datei mit genau dieser Struktur:

# TT-Planer — Bestandsaufnahme
Datum, verwendete Rolle/Rechte, aktives Paket, wie lange du gebraucht hast.

## 0. Zusammenfassung
Max. 10 Stichpunkte: was der TT-Planer im Kern leistet.

## 1. Menüstruktur
Als verschachtelte Liste, Beschriftungen wortgetreu. Nicht verfügbare Punkte mit (gesperrt).

## 2. Module
Pro Bereich A–J ein Abschnitt. Je Modul:
### <Modulname>
- **Pfad im Menü:**
- **Zweck:**
- **Objekte und Felder:** Tabelle mit Spalten: Feld | Typ | Pflicht | Optionen/Default
- **Aktionen:** was man tun kann, wer es darf
- **Automatismen:** was das System von selbst tut, mit welchen Auslösern und Fristen
- **Beobachtungen:** alles, was auffällt

## 3. Rollen-Berechtigungs-Matrix
Tabelle: Rolle × Funktion, mit ja/nein/unklar.

## 4. Automatismen im Überblick
Eine Tabelle aller automatischen Abläufe: Auslöser | Was passiert | Empfänger | Einstellbar?

## 5. Offene Punkte
Was du nicht sehen konntest und warum (Rechte, Paket, Risiko einer Änderung).

## 6. Unsicherheiten
Alles, was du vermutest, aber nicht verifiziert hast — klar als Vermutung markiert.

WICHTIG ZUM SCHLUSS
- Lieber ehrlich "nicht gesehen" als plausibel geraten. Die Lücken sind für mich wertvoller
  als eine glatte, aber teilweise erfundene Liste.
- Wenn du merkst, dass du nicht alles schaffst: arbeite A–D vollständig ab, das ist mir am
  wichtigsten, und notiere den Rest als offen.
- Gib die Datei am Stück aus, damit ich sie in einem Rutsch kopieren kann.
````

---

## Nach dem Durchlauf

Die erzeugte Markdown-Datei als `docs/tt-planer-bestandsaufnahme.md` ins Repo legen oder in die
Entwicklungs-Session einfügen. Daraus werden dann aktualisiert:

- `funktionsvergleich.md` — Teil 1 und 2 auf verifizierte Fakten umstellen, Vermutungen entfernen  
- `recherche-tt-planer.md` — Preise und Paketgrenzen bestätigen oder korrigieren  
- die Roadmap — insbesondere Ersatzspieler-Automatik (Fristen, Modi) und Benachrichtigungen  
  (Auslöser, Kanäle) lassen sich erst nach Punkt B und C sauber spezifizieren
