import { usePublicClubInfo } from '../../features/auth/api';

export interface LegalFooterProps {
  className?: string;
}

/**
 * Datenschutzhinweis und Impressum (Aufgabe 10.1).
 *
 * Art. 13 DSGVO verlangt, dass die Betroffenen den Hinweis **bekommen** — nicht, dass er
 * irgendwo existiert. Deshalb steht er in der Fußzeile und zusätzlich auf der
 * Registrierungsseite: Dort werden die ersten Daten erhoben.
 *
 * Verlinkt statt eingebaut, weil die meisten Vereine beides längst auf ihrer Website
 * haben. Zwei Fassungen desselben Textes laufen unweigerlich auseinander, und dann steht
 * in der Anwendung eine, die nicht mehr gilt.
 */
export default function LegalFooter({ className }: LegalFooterProps) {
  const info = usePublicClubInfo();

  const privacy = info.data?.privacy_url?.trim() ?? '';
  const imprint = info.data?.imprint_url?.trim() ?? '';

  // Solange nichts hinterlegt ist, keine toten Links anbieten. Dass der Verein hier
  // etwas eintragen muss, steht im Einrichtungsleitfaden und in den Einstellungen.
  if (privacy === '' && imprint === '') return null;

  return (
    <footer className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-gray-500">
        {privacy !== '' && (
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
        )}
        {imprint !== '' && (
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
        )}
      </ul>
    </footer>
  );
}
