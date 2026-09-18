-- Antwortadresse für Benachrichtigungen.
--
-- Bis hierher trugen alle Benachrichtigungen als Absender die Adresse, über die versendet
-- wird — typisch `planer@mail.verein.de`. Hinter dieser Adresse steht kein Postfach, und
-- sie muss auch keines haben: Sie dient der Zustellbarkeit (SPF, DKIM, DMARC), nicht der
-- Korrespondenz.
--
-- Nur: Es antwortet trotzdem jemand. Auf jede Erinnerung, jede Ersatzanfrage, jede
-- Aufstellung. Bisher fiel diese Antwort lautlos aus der Welt — der Schreibende hielt sie
-- für zugestellt, der Mannschaftsführer wartete auf eine Rückmeldung, die längst
-- geschrieben war.
--
-- Mit `notification_reply_to` landet sie stattdessen in einem Postfach, das der Verein
-- ohnehin hat. Das erspart ein eigenes Postfach für die Absenderdomain, das sonst nur
-- deshalb eingerichtet würde.

INSERT INTO public.club_settings (key, value)
VALUES ('notification_reply_to', '')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.club_settings IS
    'Vereinsweite Einstellungen als Schlüssel-Wert-Paare. '
    'notification_sender_email ist die Adresse, über die versendet wird (muss zur '
    'verifizierten Domain gehören); notification_reply_to ist die Adresse, an die '
    'Antworten gehen (ein echtes Postfach, irgendwo beim Verein).';
