import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, RefreshCw } from 'lucide-react';
import { Button, Dialog, FormField, Input, useToast } from '../../components/ui';
import { APP_URL } from '../../lib/supabaseClient';
import { generateRegistrationCode, useClubSettings, useUpdateClubSettings } from '../club/api';

export interface RegistrationLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Der zweite Weg in den Verein: ein Link mit Vereinscode, den man in die WhatsApp-Gruppe
 * stellt oder als QR-Code in die Halle hängt. Wer sich darüber registriert, landet auf
 * `pending_approval` und muss vom Admin freigeschaltet werden — der Code allein öffnet
 * also niemandem die Tür.
 */
export default function RegistrationLinkDialog({
  open,
  onOpenChange,
}: RegistrationLinkDialogProps) {
  const { toast } = useToast();
  const settings = useClubSettings();
  const updateSettings = useUpdateClubSettings();
  const [qr, setQr] = useState<string | null>(null);

  const code = settings.data?.registration_code ?? '';
  const link = code ? `${APP_URL}/register/${encodeURIComponent(code)}` : '';

  useEffect(() => {
    if (!open || !link) {
      setQr(null);
      return;
    }

    let active = true;
    QRCode.toDataURL(link, { width: 320, margin: 1 })
      .then((dataUrl) => {
        if (active) setQr(dataUrl);
      })
      .catch(() => {
        if (active) setQr(null);
      });

    return () => {
      active = false;
    };
  }, [open, link]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link kopiert', 'success');
    } catch {
      toast('Kopieren hat nicht geklappt — bitte den Link von Hand markieren', 'error');
    }
  }

  async function onRegenerate() {
    try {
      await updateSettings.mutateAsync({ registration_code: generateRegistrationCode() });
      toast('Neuer Code erzeugt — der alte gilt nicht mehr', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrierungslink"
      description="Wer sich darüber registriert, wartet anschließend auf deine Freischaltung."
      footer={<Button onClick={() => onOpenChange(false)}>Schließen</Button>}
    >
      <div className="space-y-4">
        {!code ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Für diesen Verein ist noch kein Code hinterlegt. Ohne Code ist die
              Selbstregistrierung ausgeschaltet.
            </p>
            <Button variant="primary" onClick={() => void onRegenerate()}>
              Code erzeugen
            </Button>
          </div>
        ) : (
          <>
            <FormField label="Link" hint="Weitergeben per Nachricht, E-Mail oder Aushang.">
              {(p) => <Input {...p} readOnly value={link} onFocus={(e) => e.target.select()} />}
            </FormField>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void onCopy()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Link kopieren
              </Button>
              <Button onClick={() => void onRegenerate()} loading={updateSettings.isPending}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Neuen Code erzeugen
              </Button>
            </div>

            {qr && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-4">
                <img src={qr} alt={`QR-Code für den Registrierungslink mit dem Code ${code}`} className="h-48 w-48" />
                <p className="text-sm text-gray-500">Code: {code}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
