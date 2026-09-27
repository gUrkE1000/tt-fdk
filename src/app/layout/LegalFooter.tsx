import { usePublicClubInfo, type PublicClubInfo } from '../../features/auth/api';

export interface LegalFooterProps {
  className?: string;
  /**
   * Vereinsdaten abfragen? Die Registrierung wartet damit, bis der Code geprüft ist —
   * zwei gleichzeitige Aufrufe vor der Anmeldung haben dort die Seite hängen lassen.
   * Bis dahin gelten die mitgelieferten Seiten.
   */
  enabled?: boolean;
}

/**
 * Wohin „Datenschutz" und „Impressum" führen.
 *
 * Was der Verein unter *Einstellungen → Rechtliches* einträgt, hat Vorrang — die
 * meisten Vereine haben beides längst auf ihrer Website, und zwei Fassungen desselben
 * Textes laufen unweigerlich auseinander. Ohne Eintrag gelten die Seiten, die die
 * Anwendung selbst mitbringt (`public/datenschutz.html`, `public/impressum.html`):
 * Eine Anmeldeseite ohne beides verschweigt, wer dahintersteht und was mit den Daten
 * passiert.
 */
export function legalLinks(info: PublicClubInfo | undefined): { privacy: string; imprint: string } {
  const base = import.meta.env.BASE_URL;
  return {
    privacy: info?.privacy_url?.trim() || `${base}datenschutz.html`,
    imprint: info?.imprint_url?.trim() || `${base}impressum.html`,
  };
}

/**
 * Datenschutzhinweis und Impressum (Aufgabe 10.1) — auf jeder Seite, auch vor der
 * Anmeldung.
 *
 * Art. 13 DSGVO verlangt, dass die Betroffenen den Hinweis **bekommen** — nicht, dass er
 * irgendwo existiert. Deshalb steht er in der Fußzeile, auf der Anmeldeseite und
 * zusätzlich auf der Registrierungsseite: Dort werden die ersten Daten erhoben.
 */
export default function LegalFooter({ className, enabled = true }: LegalFooterProps) {
  const info = usePublicClubInfo(enabled);
  const { privacy, imprint } = legalLinks(info.data);

  return (
    <footer className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-gray-500">
        <li>
          <a
            href={privacy}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-2 hover:text-gray-700 hover:underline"
          >
            Datenschutz
          </a>
        </li>
        <li>
          <a
            href={imprint}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-2 hover:text-gray-700 hover:underline"
          >
            Impressum
          </a>
        </li>
      </ul>
    </footer>
  );
}
