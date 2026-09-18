import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ParsedMember } from './excel';

/**
 * Den Importplan ausführen (Aufgabe 9.5).
 *
 * Bewusst Zeile für Zeile statt als eine große Anweisung: Ein Import bricht sonst
 * mittendrin ab und niemand weiß, wie viele Mitglieder schon angelegt sind. So bekommt
 * jede Zeile ein eigenes Ergebnis, und der Bericht am Ende sagt genau, welche nicht
 * durchging und warum.
 */

export interface ImportOutcome {
  name: string;
  action: 'created' | 'updated' | 'failed';
  /** Wurde eine Einladung verschickt? */
  invited?: boolean;
  detail?: string;
}

export interface ImportInput {
  create: ParsedMember[];
  update: { id: string; values: ParsedMember }[];
  /** Name → Kennung, für Gruppen und Trainings. */
  groupIds: Map<string, string>;
  trainingIds: Map<string, string>;
  /** Neue Mitglieder mit E-Mail einladen? */
  invite: boolean;
}

function profileRow(values: ParsedMember) {
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    email: values.email,
    role: values.role,
    gender: values.gender ?? 'unspecified',
    birthday: values.birthday,
    phone: values.phone,
    mobile_phone: values.mobile_phone,
    member_number: values.member_number,
    qttr: values.qttr,
    no_games: values.no_games,
  };
}

/**
 * Rang, Gruppen und Trainings eines Mitglieds.
 *
 * Nur, was in der Datei stand: Eine leere Zelle heißt „nicht angegeben", nicht „lösche,
 * was da ist". Wer beim Update die Spalte Gruppen leert, hätte sonst die Zuordnung aller
 * Mitglieder verloren, ohne es zu wollen.
 */
async function applyRelations(
  profileId: string,
  values: ParsedMember,
  input: ImportInput,
): Promise<void> {
  if (values.ranking) {
    // Ohne Geschlechtsangabe fällt der Rang in die Erwachsenenklasse — dieselbe
    // Voreinstellung wie im Dialog „Ränge bearbeiten".
    const type = values.gender === 'female' ? 'women' : 'men';

    await supabase.from('member_rankings').upsert(
      {
        profile_id: profileId,
        ranking_type: type,
        team_number: values.ranking.team,
        position_number: values.ranking.position,
      },
      { onConflict: 'profile_id,ranking_type' },
    );
  }

  for (const name of values.groups) {
    const groupId = input.groupIds.get(name.toLowerCase());
    if (!groupId) continue;
    await supabase
      .from('group_members')
      .upsert({ group_id: groupId, profile_id: profileId }, { onConflict: 'group_id,profile_id' });
  }

  for (const name of values.trainings) {
    const trainingId = input.trainingIds.get(name.toLowerCase());
    if (!trainingId) continue;
    await supabase
      .from('training_members')
      .upsert(
        { training_id: trainingId, profile_id: profileId },
        { onConflict: 'training_id,profile_id' },
      );
  }
}

export function useRunImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportInput): Promise<ImportOutcome[]> => {
      const outcomes: ImportOutcome[] = [];

      for (const values of input.create) {
        const name = `${values.first_name} ${values.last_name}`.trim();

        try {
          const { data, error } = await supabase
            .from('profiles')
            .insert({ ...profileRow(values), status: 'unconfirmed' })
            .select('id')
            .single();
          if (error) throw error;

          await applyRelations(data.id, values, input);

          let invited = false;
          if (input.invite && values.email) {
            const { error: inviteError } = await supabase.functions.invoke('invite-member', {
              body: { profileId: data.id },
            });
            // Eine fehlgeschlagene Einladung ist kein fehlgeschlagener Import: Das
            // Mitglied steht in der Datenbank und lässt sich einzeln neu einladen.
            invited = !inviteError;
          }

          outcomes.push({ name, action: 'created', invited });
        } catch (error) {
          outcomes.push({
            name,
            action: 'failed',
            detail: error instanceof Error ? error.message : 'unbekannter Fehler',
          });
        }
      }

      for (const entry of input.update) {
        const name = `${entry.values.first_name} ${entry.values.last_name}`.trim();

        try {
          const { error } = await supabase
            .from('profiles')
            .update(profileRow(entry.values))
            .eq('id', entry.id);
          if (error) throw error;

          await applyRelations(entry.id, entry.values, input);
          outcomes.push({ name, action: 'updated' });
        } catch (error) {
          outcomes.push({
            name,
            action: 'failed',
            detail: error instanceof Error ? error.message : 'unbekannter Fehler',
          });
        }
      }

      return outcomes;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainings.all });
    },
  });
}

/** Wie der Bericht nach dem Lauf zusammengefasst wird. */
export function summarizeImport(outcomes: ImportOutcome[]): {
  created: number;
  updated: number;
  failed: number;
  invited: number;
} {
  return {
    created: outcomes.filter((entry) => entry.action === 'created').length,
    updated: outcomes.filter((entry) => entry.action === 'updated').length,
    failed: outcomes.filter((entry) => entry.action === 'failed').length,
    invited: outcomes.filter((entry) => entry.invited).length,
  };
}
