# Fehler aus dem Betrieb

Was im laufenden Betrieb aufgefallen ist, woran es lag und was dagegen getan wurde. Ein
Eintrag pro Fehlerbild, neueste zuerst. Zweck: nicht denselben Fehler zweimal suchen — und
nachlesen können, warum eine Stelle im Code so aussieht, wie sie aussieht.

Gemeldete, noch offene Fehler stehen unter [Offen](#offen).

---

## F-5 · Registrierungsseite lädt endlos

**Gemeldet** 19.09.2026, beim Öffnen von `/register/<code>` und beim QR-Code.
**Schwere** hoch — niemand kann sich registrieren.
**Behoben** 19.09.2026 (das Symptom; zur Ursache siehe unten).

### Bild

Der Ladekringel dreht sich, ohne je zu einem Ende zu kommen. Keine Fehlermeldung.

### Ursache

Die Seite hatte nur **zwei** Zustände: „lädt" und „Code ungültig". Alles, was dazwischen
schiefgehen kann, fiel durch:

```tsx
if (codeCheck.isLoading) return <Spinner />;
if (codeCheck.data !== true) return <„gilt nicht mehr" />;
```

Und der Aufruf dahinter hatte **keine zeitliche Begrenzung**. Antwortet der Server nicht —
Projekt pausiert, Netz weg, DNS hängt —, wartet `fetch` so lange, wie das Betriebssystem
es zulässt. Das sind Minuten, in denen die Seite nichts anderes anzuzeigen hat als den
Kringel.

Dazu kam die zweite Falle: Eine über `enabled: false` abgeschaltete react-query-Abfrage
bleibt dauerhaft `isPending`. Wer den Spinner vor den Sonderfall stellt, baut sich damit
einen unentrinnbaren Ladezustand.

Geprüft und **ausgeschlossen** wurde: die RPC selbst (ein einzeiliges `EXISTS`, `anon` hat
`EXECUTE`), der Service Worker (`index.html` liegt im Precache, Supabase läuft über
`NetworkOnly`), der SPA-Fallback (`404.html` wird gebaut und war ausgerollt) und die
Wiederholungen von react-query (`retry: 1`).

### Behebung

1. **Zeitliche Begrenzung** (`withTimeout`, 12 Sekunden) um das Prüfen des Codes **und**
   um das Laden des Profils — die zweite Stelle, an der sich sonst derselbe Kringel
   festfressen konnte, nämlich in `RequireAuth`. Bewusst als Wettlauf und nicht über
   `abortSignal()` des Clients: hängt an keiner Aufrufkette und ist damit prüfbar.
2. **Ein eigener Zustand für „ging schief"** mit der Meldung im Klartext und einem
   Knopf *Erneut versuchen*. Ein Netzfehler schickt niemanden mehr mit einem völlig
   richtigen Link zum Vorstand.
3. **Klartext statt Fehlercode** (`readableError`): „Keine Verbindung zum Server",
   „Der Server hat nicht geantwortet", und bei `PGRST202` der Hinweis, dass die
   Einrichtung unvollständig ist — das kann kein Mitglied lösen.
4. **Fehlender Code im Pfad** (Route `/register` ohne `:code`) bekommt eine eigene
   Anzeige, vor jeder Abfrage der Query-Zustände.

Fünf neue Tests in `tests/features/auth.test.tsx`, darunter der nie beantwortete Aufruf
gegen die Uhr.

### Was das nicht behebt

**Warum** der Server nicht antwortete, sagt erst die neue Meldung. Der Fix macht aus einem
stummen Kringel eine Aussage — die eigentliche Ursache steht danach auf dem Bildschirm.

---

## F-4 · „Supabase ausrollen" scheitert an `required flag(s) "project-ref" not set`

**Gemeldet** 19.09.2026, beim ersten Lauf des Workflows.
**Schwere** mittel — kein Ausrollen von Migrationen und Edge Functions über GitHub.
**Behoben** 19.09.2026.

### Bild

Der Workflow bricht nach zehn Sekunden ab. Im Protokoll:

```
supabase link --project-ref "" --password "***"
required flag(s) "project-ref" not set
```

Das leere `--project-ref` bei gleichzeitig maskiertem `--password` ist der Hinweis: ein
Secret war da, das andere nicht.

### Ursache

**Ein Namensdreher in der eigenen Anleitung.** `docs/go-live.md §1.4` verlangte
`SUPABASE_PROJECT_REF`, der Workflow las `SUPABASE_PROJECT_ID`. Wer die Anleitung befolgt
hat, hat das Secret unter dem Namen angelegt, den der Workflow nicht kennt.

`${{ secrets.X }}` ist für ein nicht vorhandenes Secret einfach leer — kein Fehler, keine
Warnung. Der leere Wert wanderte durch bis in den CLI-Aufruf.

### Behebung

1. Anleitung auf `SUPABASE_PROJECT_ID` korrigiert, mit der Fundstelle
   (`https://supabase.com/dashboard/project/<das hier>`).
2. Der Workflow akzeptiert **beide** Namen. Ein Ausrollen, das an einem Namensdreher
   scheitert, hilft niemandem.
3. Neuer erster Schritt **Secrets prüfen**: Fehlt etwas, nennt das Protokoll jeden
   fehlenden Namen samt Fundstelle, statt die CLI raten zu lassen.

---

## F-3 · Import legt bei jedem Klick dieselben Spiele neu an

**Gemeldet** 19.09.2026, nach dem ersten Import für „Erwachsene IV".
**Schwere** hoch — unbrauchbare Spielterminliste.
**Behoben** 19.09.2026.

### Bild

Nach mehreren Klicks auf *Import starten* stand jede Begegnung mehrfach in der Liste:
eine aktiv, die übrigen mit dem Merker **entfällt**. Bei drei Klicks drei Zeilen.

### Ursache

Der Abgleich erkannte ein bereits bekanntes Spiel ausschließlich an der `UID` aus dem
ICS-Feed (`external_uid`). **myTischtennis vergibt diese UID bei jedem Export neu.**

Damit war jeder Abruf für den Abgleich ein Neuanfang:

1. Die UID aus dem Feed war unbekannt → `insert`, das Spiel wurde neu angelegt.
2. Die UID der vorhandenen Zeile kam im Feed nicht mehr vor → `deactivate`, die alte Zeile
   wurde als „entfällt" markiert.

Beides pro Lauf, pro Spiel. Die Sicherheitssperre gegen den leeren Kalender griff nicht,
weil der Kalender ja nicht leer war.

Der eindeutige Index `matches_external_uid_unique` auf `(team_id, external_uid)` hat das
nicht verhindert — er verhindert nur zweimal dieselbe UID, und genau die kam nie zweimal.

### Behebung

**Zweitschlüssel statt UID allein** (`supabase/functions/_shared/syncPlanner.ts`). Der
Abgleich läuft jetzt in zwei Durchgängen:

1. Über die UID, wie bisher. Bei einem Feed mit stabilen UIDs ist danach nichts mehr offen.
2. Für alles ohne UID-Treffer über `matchFingerprint`: **Seite und Gegner**. Innerhalb
   einer Runde spielt eine Mannschaft jeden Gegner einmal daheim und einmal auswärts —
   damit ist das Paar so eindeutig wie eine UID, nur eben stabil. Der Spieltag bleibt
   draußen, weil er in manchen Feeds fehlt und dann kein Schlüssel wäre, sondern Zufall.

Geraten wird nicht: Zugeordnet wird nur bei genau **einem aktiven** Kandidaten. Gibt es
mehrere, legt der Abgleich lieber neu an, als eine fremde Aufstellung zu überschreiben.
Gibt es einen aktiven und daneben Leichen aus früheren Fehlläufen, gewinnt der aktive —
das ist genau die Lage, in der dieser Fehler hinterlässt.

Jede Aktion auf einer vorhandenen Zeile schreibt zusätzlich die **neue UID** mit
(`sync-calendars/index.ts`), auch `touch` und `clear_override`. Sonst liefe der nächste
Abgleich wieder über den Zweitschlüssel statt über den schnellen Weg.

### Absicherung

Sieben neue Fälle in `tests/shared/syncPlanner.test.ts`, darunter die genaue Ausgangslage
des Fehlers (ein aktives Spiel, zwei abgesagte) und die beiden Fälle, in denen nicht
zugeordnet werden darf.

### Was noch zu tun ist

Der Altbestand räumt sich nicht von selbst auf: Die bereits angelegten „entfällt"-Zeilen
bleiben stehen. Dafür gibt es → **F-1**.

---

## F-2 · Import gibt keine Rückmeldung, die Liste bleibt alt

**Gemeldet** 19.09.2026. **Behoben** 19.09.2026.

### Bild

Nach *Import starten* passierte sichtbar nichts. Die Spieltermine erschienen erst nach
einem Neuladen der Seite.

### Ursache

`ImportDialog` rief die Edge Function auf und setzte das Ergebnis in den eigenen Zustand,
machte aber die react-query-Abfrage `queryKeys.matches.all` nicht ungültig. Die Liste
dahinter zeigte weiter den Stand von vor dem Import. Die Erfolgsmeldung ging im offenen
Dialog unter, weil der Dialog stehen blieb und den Blick auf die Liste verdeckte.

### Behebung

`ImportDialog` macht die Spielterminabfragen nach dem Lauf ungültig und schließt sich bei
einem sauberen Lauf selbst. Die Zahlen stehen dann in der Meldung
(„Spielplan abgeglichen — 3 neu, 1 verlegt"), statt im Dialog.

Bei **Warnung oder Fehler** bleibt der Dialog offen: Dort ist der Text die eigentliche
Auskunft, und ein Dialog, der sich mit einer Fehlermeldung darin wegklappt, hat noch
niemandem geholfen. Dasselbe gilt für einen Lauf, der null Mannschaften zurückmeldet —
meist eine Adresse, die auf nichts zeigt.

---

## F-1 · Kein Weg, entfallene Spiele loszuwerden

**Gemeldet** 19.09.2026. **Behoben** 19.09.2026.

### Bild

Als „entfällt" markierte Spiele blieben dauerhaft in der Liste. Einzeln löschen ging,
aber bei den Mengen aus **F-3** war das keine Option.

### Behebung

*Spieltermine* zeigt einen Hinweisstreifen, sobald abgesagte Termine vorhanden sind, mit
der Schaltfläche **Entfallene aufräumen**. Sie löscht alle inaktiven Spieltermine samt
ihren Rückmeldungen, nach Rückfrage und mit Nennung der Anzahl. Aktive Termine bleiben
unangetastet.

Die Auswahl richtet sich **nicht** nach der eingestellten Filterleiste: Was aufgeräumt
wird, soll nicht davon abhängen, welcher Filter gerade zufällig aktiv ist.

Steht ein Spiel später wieder im Verbandskalender, legt der nächste Abgleich es neu an.

---

## Offen

*(nichts)*
