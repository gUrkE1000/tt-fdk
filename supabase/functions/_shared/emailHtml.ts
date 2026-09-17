/**
 * Aus dem reinen Text einer Benachrichtigung eine schlichte HTML-Fassung machen.
 *
 * Bewusst minimal: keine Bilder, keine Tabellen, keine eingebetteten Schriften. E-Mail-
 * Programme rendern alles davon unterschiedlich, und eine Vereinsmail muss vor allem
 * lesbar sein — auf dem Telefon, im Dunkelmodus, in Outlook.
 *
 * Der Text bleibt maßgeblich; das HTML ist die Zugabe.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Erkennt http(s)-Adressen und macht sie klickbar. */
export function linkify(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#1D4ED8">${url}</a>`,
  );
}

export interface EmailHtmlInput {
  subject: string;
  bodyText: string;
  clubName: string;
  /** Fußzeile mit dem Hinweis, wo man die Benachrichtigungen abstellt. */
  settingsUrl?: string;
}

export function buildEmailHtml(input: EmailHtmlInput): string {
  const paragraphs = input.bodyText
    .split(/\n{2,}/)
    .map((block) => linkify(escapeHtml(block)).replace(/\n/g, '<br>'))
    .map((block) => `<p style="margin:0 0 14px 0">${block}</p>`)
    .join('\n');

  const footer = input.settingsUrl
    ? `<p style="margin:0;color:#6B7280;font-size:12px">
         Welche Nachrichten du bekommst, stellst du unter
         <a href="${input.settingsUrl}" style="color:#6B7280">Mein Profil</a> ein.
       </p>`
    : '';

  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:24px">
    <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6B7280">
      ${escapeHtml(input.clubName)}
    </p>
    <h1 style="margin:0 0 16px 0;font-size:18px;line-height:1.3">${escapeHtml(input.subject)}</h1>
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0">
    ${footer}
  </div>
</body>
</html>`;
}
