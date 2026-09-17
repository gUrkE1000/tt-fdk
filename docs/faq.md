# ❓ FAQ & Fehlerbehebung (TTV Spielplaner)

Dieses Dokument enthält Antworten auf häufig gestellte Fragen (FAQs) und konkrete Lösungswege bei technischen Problemen.

---

## ❓ 1. Häufig gestellte Fragen (FAQs)

### Q1: Wie greife ich direkt auf den Spielplaner zu, ohne jedes Mal das Passwort eingeben zu müssen?
**Antwort:** Du kannst das Passwort als URL-Parameter mitsenden. Speichere dir den Link einfach als Lesezeichen im Browser deines Handys ab:
`https://deinverein.github.io/spielplaner/?pw=DasVereinsPasswort` oder `?password=DasVereinsPasswort`.

### Q2: Warum kann ich mich nicht als Mannschaftsführer/Sportwart/Admin einloggen, wenn ich mich passwortlos anmelde?
**Antwort:** Die passwortlose Anmeldung über die Dropdown-Namensliste dient dem schnellen Zugriff für reguläre Spieler. Aus Sicherheitsgründen weist das Frontend bei diesem Login-Weg grundsätzlich nur die Standardrolle `player` (Spieler) zu.
Um deine erweiterten administrativen Rechte zu nutzen, musst du dich zwingend über das klassische Login-Formular mit deiner **E-Mail-Adresse und deinem persönlichen Passwort** anmelden.

### Q3: Was passiert mit meinen Rückmeldungen, wenn ein Spiel verschoben wird?
**Antwort:** Deine alte Rückmeldung geht nicht verloren, sondern wird in der Datenbank archiviert. Da das Spiel nun aber an einem anderen Tag oder zu einer anderen Uhrzeit stattfindet, fordert das System dich im Frontend mit einem Warnsymbol (⚠️) dazu auf, deine Verfügbarkeit für den neuen Termin zu bestätigen.

### Q4: Warum wird der Spieltitel in der Übersicht rot dargestellt?
**Antwort:** Wenn ein Spiel weniger als **4 positive Zusagen ('yes')** aufweist, färbt das System den Spieltitel rot ein und zeigt ein Warndreieck (`AlertTriangle`) an. Dies dient als visuelle Warnung für die Mannschaftsführer und den Sportwart, dass für dieses Spiel noch nicht genügend Spieler zur Verfügung stehen.

### Q5: Wie unterscheidet das System Stamm- und Ersatzspieler im Aufstellungs-Kader?
**Antwort:** Das System stellt automatisch einen 5er-Kader zusammen (4 Stammspieler + 1 Ersatzspieler). Der 5. Spieler wird als Ersatzspieler mit einem deutlichen amberfarbenen Hintergrund und einem `"Ersatz"`-Badge gekennzeichnet.

---

## 🛠️ 2. Technische Fehlerbehebung

### Fehler A: "Could not find column or table in the schema cache" (PostgREST-Fehler)
Dieser Fehler tritt meistens nach dem Ausführen einer Datenbank-Migration auf. Supabase (bzw. die API-Schnittstelle PostgREST) hat dann seinen internen Cache für das Tabellenschema noch nicht aktualisiert.

#### Lösungswege (der Reihe nach ausprobieren):

1. **Cache-Neuaufbau erzwingen (SQL Editor):**  
   Führe folgenden Befehl im **SQL Editor** in Supabase aus:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
2. **Benachrichtigungswarteschlange leeren:**  
   Sollte Schritt 1 blockiert sein, hilft dieser Befehl:
   ```sql
   SELECT pg_notification_queue_usage();
   ```
3. **API-Einstellung im Dashboard toggeln:**  
   Gehe im Supabase-Dashboard auf **Project Settings** > **Data API**, ändere kurz eine Einstellung (oder speichere sie erneut ab), um den Cache-Rebuild zu erzwingen.  
4. **Projekt pausieren & fortsetzen (Harter Neustart):**  
   Pausiere das Projekt in Supabase und starte es nach 2 Minuten neu.

---

### Fehler B: PostgREST-Fehler `UPDATE requires a WHERE clause` bei Blanket-Updates
Tritt auf, wenn eine Supabase-Abfrage alle Zeilen einer Tabelle auf einmal aktualisieren oder zurücksetzen möchte (z. B. beim Zurücksetzen von Mannschaftszuordnungen).

#### Lösung:
Ergänze in der Query stets eine explizite Dummy-Bedingung wie:
```typescript
.neq('id', '00000000-0000-0000-0000-000000000000')
```
Dadurch wird die PostgREST-Sicherheitsregel für unbedingte Updates erfüllt.

---

### Fehler C: PostgreSQL `ERROR 55P04 (unsafe use of new enum value)`
Tritt auf, wenn in derselben Transaktion ein neuer Wert zu einer Enum hinzugefügt und direkt im folgenden Befehl verwendet wird.

#### Lösung:
Setze nach der Befehlszeile `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sportwart';` ein explizites `COMMIT;`, um die Transaktion abzuschließen, bevor nachfolgende Anweisungen die neue Enum verwenden.

---

### Fehler D: Ich erhalte keine Bestätigungs-E-Mail nach der Registrierung
Supabase verwendet für neue Projekte eine eingebaute E-Mail-Schnittstelle mit sehr strikten Limits.

#### Lösungswege:  
* **E-Mail-Bestätigung deaktivieren (Empfohlen):**  
  Gehe in Supabase zu **Authentication** > **Providers** > **Email**, deaktiviere **"Confirm email"** und klicke auf **Save**.  
* **Eigenen SMTP-Server hinterlegen:**  
  Trage unter **Project Settings** > **Auth** > **SMTP Settings** Zugangsdaten eines E-Mail-Providers (z. B. Resend, Mailgun) ein.

---

### Fehler E: HTML-Kader-Import bricht ab oder schlägt fehl  
* **Automatischer Proxy-Fetch blockiert:** Wenn Adblocker oder CORS-Proxies den automatischen HTML-Abruf von myTischtennis.de verhindern, verwende die eingebaute Option **"HTML manuell einfügen"** (Kopieren des Quelltextes der Mannschaftsmeldung auf myTischtennis.de und Einfügen in das Textfeld).  
* **Namensänderungen:** Das System klassifiziert Eingaben transparent in *„Bereits aktuell“*, *„Nur aktualisiert“* oder *„Ersetzt“*, damit Vor- und Nachnamen vor dem Speichern geprüft werden können.  
