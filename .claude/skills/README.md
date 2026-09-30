# Claude-Code-Skills für Frontend und Design

Projekt-Skills, die Claude Code in diesem Repository automatisch lädt. Sie sind aus fremden
Repositories übernommen, vor der Übernahme vollständig gelesen und auf einen festen Stand
gepinnt. Aktualisieren heißt: neuen Stand holen, lesen, Commit hier eintragen.

| Skill | Wofür | Quelle | Stand | Lizenz |
|---|---|---|---|---|
| `design-taste-frontend` | Regeln gegen „KI-Einheitslook“: Design-Read, Dials, Verbote, Pre-Flight-Check | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/taste-skill` ([tasteskill.dev](https://www.tasteskill.dev/)) | `ce26fc2` | MIT |
| `image-to-code` | Erst Design-Bilder erzeugen, dann analysieren, dann nachbauen | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/image-to-code-skill` | `ce26fc2` | MIT |
| `web-design-guidelines` | UI-Review gegen Vercels Web Interface Guidelines, Ausgabe als `datei:zeile` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` + Regeln aus [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | `063bee9` / `e3d624b` | MIT |
| `playwright-cli` | Browser steuern, Seiten prüfen, Screenshots, Playwright-Tests | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) `skills/playwright-cli` | `b85c7a7` | Apache-2.0 |
| `ian-xiaohei-illustrations` | Handgezeichnete, beschriftete 16:9-Erklärbilder mit der Figur „Xiaohei“ für Artikel oder Projekte | [tojileon/ian-xiaohei-illustrations-en](https://github.com/tojileon/ian-xiaohei-illustrations-en) (englische Fassung von [helloianneo/ian-xiaohei-illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations), Autor Ian, [@ianneo_ai](https://x.com/ianneo_ai)) | `18280fc` | MIT |

Die Lizenztexte liegen jeweils als `LICENSE` im Skill-Ordner.

## Abweichungen vom Original

- **`web-design-guidelines`**: Das Original lädt seine Regeln bei jedem Aufruf per WebFetch
  von GitHub nach. Hier liegen sie als `guidelines.md` im Ordner, damit keine ungeprüften
  Anweisungen zur Laufzeit hereinkommen. Sonst unverändert.
- **`ian-xiaohei-illustrations`**: Die Beispielbilder (`assets/examples/`, rund 8 MB PNG) sind
  nicht übernommen, der Skill verweist stattdessen auf GitHub. Neu ist ein Abschnitt „Image
  Generation in Claude Code“: Das Original ruft das Codex-Tool `image_gen` auf, das Claude Code
  nicht hat. Ohne Bild-Tool liefert der Skill jetzt Shot-List plus fertige Prompts zum
  Einfügen in einen externen Generator (z. B. Higgsfield, ChatGPT). Außerdem darf er statt
  eines Artikels ein Code-Projekt als Vorlage nehmen. `NOTICE.md` (Namensnennung) liegt bei.
- Alle anderen Dateien sind 1:1 kopiert.

## Hinweise zur Nutzung in diesem Projekt

- **`design-taste-frontend` ist für Landingpages, Portfolios und Redesigns gebaut**, nicht für
  App-Oberflächen wie den Vereinsplaner (Abschnitt 13 „Out of Scope“ im Skill sagt das selbst).
  Einige Defaults passen nicht zum Projekt: Der Skill rät von `lucide-react` ab und setzt
  Tailwind v4 voraus; hier sind `lucide-react` und Tailwind v3 im Einsatz. Die bestehende
  Wahl des Projekts hat Vorrang, der Skill erlaubt das ausdrücklich.
- **`image-to-code` setzt ein Bildgenerierungs-Tool voraus** (geschrieben für Codex). Claude
  Code hat keins eingebaut; ohne ein entsprechendes MCP-Tool greift nur der
  „Screenshot/Bild vorhanden → analysieren → nachbauen“-Teil.
- **`playwright-cli` braucht das Kommando `playwright-cli`**, das nicht in `package.json` steht:

  ```bash
  npm install -g @playwright/cli@latest
  ```

  In der Claude-Code-Cloud-Umgebung passt die Chromium-Version der CLI nicht zum
  vorinstallierten Browser. Dort eine Konfiguration anlegen (nicht einchecken, der Pfad gilt
  nur im Container):

  ```bash
  mkdir -p .playwright && cat > .playwright/cli.config.json <<'JSON'
  { "browser": { "browserName": "chromium",
      "launchOptions": { "executablePath": "/opt/pw-browsers/chromium", "headless": true } } }
  JSON
  ```

  Ausgaben der CLI landen in `.playwright-cli/` (per `.gitignore` ausgeschlossen).

## Bewusst nicht übernommen

- **[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)** ist kein
  Skill, sondern eine Sammlung von `DESIGN.md`-Dateien, die den Stil bekannter Marken
  (Linear, Stripe, Vercel, …) beschreiben, rund 3,7 MB. Bei Bedarf eine einzelne Datei
  holen, z. B.
  `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/linear.app/DESIGN.md`,
  und Claude als Referenz geben.
- **threeui.com, 21st.dev, gsap.com** sind Websites bzw. Bibliotheken (Three.js-Komponenten,
  React-Komponentenkatalog, Animationsbibliothek), keine Skills. GSAP wäre bei Bedarf eine
  normale npm-Abhängigkeit (`gsap`).
