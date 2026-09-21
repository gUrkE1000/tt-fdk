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

## Erledigt

*(noch nichts)*
