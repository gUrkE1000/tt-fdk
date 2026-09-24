# Offene Entscheidungen

Fragen, die nicht der Code beantwortet, sondern der Verein. Jede mit dem Stand, den
Möglichkeiten und dem, was jeweils zu bauen wäre — damit die Antwort direkt umsetzbar ist
und niemand die Herleitung zweimal führen muss.

---

## E-1 · Wer darf Spieltermine sehen und sich eintragen?

**Aufgefallen** 21.09.2026 beim Probelauf mit einem zweiten Konto.
**Stand** offen — Jan fragt im Verein nach. Tendenz: **Möglichkeit 1**.

### Wie es heute ist

Die Grenze verläuft bei „Gast oder nicht", nicht bei „im Kader oder nicht":

| | Spiele sehen | zusagen |
|---|---|---|
| Gast | nein | nein |
| jedes andere aktive Mitglied | **alle Mannschaften** | **bei allen** |

Das ist kein Versehen. `supabase/migrations/20261019000000_guest_scope.sql` zieht die Linie
bewusst dort: `matches_select` prüft `is_playing_member()`, und
`rpc_set_match_response` verlangt nur `is_active_member()`.

Der Gedanke dahinter ist die **Ersatzsuche**: Wer einspringen könnte, muss sehen, wo
jemand fehlt. Ein Mitglied der Dritten, das eine Lücke in der Vierten sieht und zusagt,
ist der Normalfall in einem Verein und kein Übergriff.

Beim Ausprobieren wirkt es trotzdem falsch: Ein Konto, das in keiner Mannschaft steht,
bekommt bei jedem Spiel „Zusage / Unsicher / Absage" angeboten, als gehörte es dazu.

### Möglichkeit 1 — sehen alle, zusagen nur der Kader *(Tendenz)*

Sichtbarkeit bleibt. Zusagen darf, wer im Kader steht (Stamm oder Ersatz) oder wer über
die Ersatzkette gefragt wurde.

**Zu bauen:**
- `rpc_set_match_response` um eine Prüfung gegen `team_members` erweitern, plus die
  offene Ersatzanfrage als zweiten erlaubten Weg.
- In der Oberfläche die drei Knöpfe durch einen Hinweis ersetzen, wo sie nicht gelten —
  eine Schaltfläche, die eine Fehlermeldung auslöst, ist schlechter als keine.
- pgTAP: je ein positiver und ein negativer Fall (Kadermitglied, Fremder, Angefragter).

**Aufwand:** überschaubar, eine Migration und eine Stelle in der Oberfläche.

### Möglichkeit 2 — nur die eigene Mannschaft sehen

`matches_select` zusätzlich auf Kaderzugehörigkeit einschränken.

**Folge:** Spontanes Einspringen entfällt vollständig. Die Ersatzkette muss jeden einzeln
anfragen, und wer nicht gefragt wurde, erfährt von der Lücke nichts. Betrifft außerdem
den Kalender und „Meine Spiele", die dieselben Policies erben.

### Möglichkeit 3 — so lassen, deutlicher beschriften

Rechte unverändert, aber bei einer fremden Mannschaft ein Satz wie „Du bist nicht im
Kader — eine Zusage gilt als Angebot einzuspringen."

**Aufwand:** klein, kein Eingriff in die Datenbank. Löst das Befremden, nicht die Frage.

### Was zu klären ist

1. Soll jemand aus der Dritten bei der Vierten **von sich aus** zusagen können, oder erst
   nach einer Anfrage?
2. Soll er die Spiele der Vierten überhaupt **sehen**?
3. Gilt dieselbe Antwort für Jugend und Erwachsene?

---

## E-2 · Wohin führen die Links in Benachrichtigungen?

**Aufgefallen** 24.09.2026, nachdem Spiele, Trainingstermine und Vereinstermine eigene
Seiten bekommen haben (`/match/…`, `/training/…`, `/event/…`).
**Stand** offen — zurückgestellt, erst sollen sich die neuen Seiten im Alltag bewähren.

### Wie es heute ist

| Benachrichtigung | Link in E-Mail | Tippen auf die Push-Nachricht |
|---|---|---|
| Spiel (Erinnerung, neu, geändert, aufgestellt …) | Antwort-Link `/r/…` | dieselbe Antwortseite |
| Vereinstermin (Einladung, Erinnerung) | Antwort-Link `/r/…` | dieselbe Antwortseite |
| Trainings-Erinnerung | Antwort-Link `/r/…` | dieselbe Antwortseite |
| Ersatzanfrage, Terminumfrage | Antwort-Link `/r/…` | dieselbe Antwortseite |
| alles andere (Trainingsausfall, Nachricht am Termin, Ersatz gefunden, neue Umfrage …) | Startseite bzw. `/votes`, `/my-club?tab=news` | dieselbe Seite |

Der Antwort-Link speichert **ohne Anmeldung** (Zielbild Z2) und gilt **einmal**. Wer nach
der Antwort noch einmal tippt, etwa um nachzusehen, wer fährt, liest „Über diesen Link
wurde schon geantwortet“ und muss das Spiel selbst suchen.

### Möglichkeit 1 — beides: Antwort-Link und Link zur Seite *(Vorschlag)*

- E-Mail: Der Antwort-Link bleibt; darunter eine zweite Zeile „Ansehen: …/match/<id>“.
- Push: Tippen öffnet die **Seite** des Termins. Dort lässt sich ebenfalls antworten,
  vorausgesetzt man ist angemeldet — in der installierten App ist man das fast immer.
- Benachrichtigungen ohne Antwort (Ausfall, Nachricht, Ersatz gefunden) führen auf
  die Seite ihres Termins statt auf die Startseite.

**Zu bauen:** eine Migration — die Nutzlast-Funktionen (`match_payload`,
`event_payload`, `training_payload`) geben zusätzlich `page` mit, die Vorlagen in
`notification_templates` bekommen die zweite Zeile; `supabase/functions/_shared/pushMessage.ts`
nimmt für das Tippen `page` statt `link`. pgTAP für die Nutzlast, Vitest für
`pushMessage`. **Ausrollen:** „Supabase ausrollen“ mit Migrationen **und** Edge
Functions (der Versand liegt in `process-notifications`).
**Aufwand:** klein bis mittel.

### Möglichkeit 2 — nur noch die Seite

Antwort-Link entfällt, alles führt auf die Seite. Einfacher, aber Z2 („ein Klick ohne
weiteren Login“) wäre für E-Mail-Leser ohne gespeicherte Anmeldung verloren —
vermutlich genau die, die ohnehin am seltensten antworten. **Nicht empfohlen.**

### Möglichkeit 3 — so lassen

Kein Aufwand. Der Nachteil bleibt: nach der Antwort führt der Link ins Leere.

### Was zu klären ist

1. Soll das Tippen auf eine **Push-Nachricht** die Terminseite öffnen (Überblick) oder
   die Schnellantwort (ein Tipp weniger)?
2. Reicht in der **E-Mail** eine zweite Zeile, oder lieber zwei Knöpfe
   („Zusagen“ / „Ansehen“)? Knöpfe brauchen HTML-Vorlagen statt reinem Text
   (`_shared/emailHtml.ts` macht Adressen bisher nur anklickbar).
3. Gilt das für **alle** Benachrichtigungstypen oder nur für Spiele?

---

## Erledigt

*(noch nichts)*
