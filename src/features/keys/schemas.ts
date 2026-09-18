import { z } from 'zod';

/**
 * Felder des Schlüssel-Dialogs, exakt nach Bestandsaufnahme F.
 *
 * `venue_id` darf leer bleiben („nicht definiert"): Ein Schlüssel zum
 * Gerätewart-Schrank gehört zu keiner Halle. `responsible_id` darf es nicht —
 * ein Schlüssel ohne Verantwortlichen ist ein verlorener Schlüssel mit
 * Extraschritten.
 */
export const keySchema = z.object({
  name: z.string().trim().min(1, 'Der Schlüssel braucht einen Namen'),
  venue_id: z.string(),
  responsible_id: z.string().min(1, 'Bitte einen Verantwortlichen wählen'),
  no_forwarding: z.boolean(),
  active: z.boolean(),
});

export type KeyValues = z.infer<typeof keySchema>;

export const EMPTY_KEY: KeyValues = {
  name: '',
  venue_id: '',
  responsible_id: '',
  no_forwarding: false,
  active: true,
};

/** Leere Auswahlfelder sind in der Datenbank NULL, nicht der leere String. */
export function toKeyRow(values: KeyValues) {
  return {
    name: values.name.trim(),
    venue_id: values.venue_id || null,
    responsible_id: values.responsible_id,
    no_forwarding: values.no_forwarding,
    active: values.active,
  };
}

export const HANDOVER_MESSAGES: Record<string, string> = {
  ok: 'Der Schlüssel ist übergeben',
  gone: 'Diesen Schlüssel gibt es nicht mehr',
  not_allowed: 'Du darfst diesen Schlüssel nicht weitergeben',
  unknown_member: 'Dieses Mitglied gibt es nicht (mehr)',
  unchanged: 'Da liegt der Schlüssel schon',
};

/**
 * Wo ein Schlüssel gerade ist, in einem Satz.
 *
 * „Beim Verantwortlichen" ist nicht dasselbe wie „bei niemandem": Ein Schlüssel
 * ohne eingetragenen Inhaber liegt per Definition dort, wo er hingehört. Die
 * Unterscheidung spart die Rückfrage „wer hat ihn denn nun?".
 */
export function holderText(row: {
  holder_name?: string | null;
  responsible_name?: string | null;
}): string {
  if (row.holder_name) return row.holder_name;
  return row.responsible_name ? `${row.responsible_name} (verantwortlich)` : 'niemand eingetragen';
}
