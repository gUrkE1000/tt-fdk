import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { saveRoster } from './api';
import type { MeldungPlan } from './meldung';

export interface ApplyMeldungInput {
  plan: MeldungPlan;
  /** QTTR-Werte aus der Meldung übernehmen. */
  updateQttr: boolean;
  /** Ränge desselben Rangtyps entfernen, die die Meldung nicht mehr nennt. */
  removeStaleRankings: boolean;
}

export interface MeldungOutcome {
  team: string;
  action: 'created' | 'updated' | 'failed';
  detail?: string;
}

export interface ApplyMeldungResult {
  teams: MeldungOutcome[];
  rankings: number;
  qttr: number;
  removedRankings: number;
}

/**
 * Die Mannschaftsmeldung übernehmen.
 *
 * Je Mannschaft ein eigener Schritt mit eigenem Ergebnis: Scheitert eine, stehen die
 * anderen trotzdem, und der Bericht sagt, welche und warum. Die Reihenfolge je
 * Mannschaft ist fest — erst Größe, dann Kader —, weil die Datenbank nicht mehr
 * Stammspieler zulässt, als die Mannschaft groß ist.
 */
export function useApplyMeldung() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyMeldungInput): Promise<ApplyMeldungResult> => {
      const result: ApplyMeldungResult = { teams: [], rankings: 0, qttr: 0, removedRankings: 0 };

      for (const planned of input.plan.teams) {
        const { meldung, existing } = planned;
        const name = existing?.name ?? meldung.name;

        try {
          const values = {
            size: meldung.size,
            ranking_type: meldung.rankingType,
            ranking: meldung.number,
            leagues: meldung.league ? [meldung.league] : (existing?.leagues ?? []),
          };

          let teamId: string;
          if (existing) {
            const { error } = await supabase.from('teams').update(values).eq('id', existing.id);
            if (error) throw error;
            teamId = existing.id;
          } else {
            const { data, error } = await supabase
              .from('teams')
              .insert({ ...values, name: meldung.name })
              .select('id')
              .single();
            if (error) throw error;
            teamId = data.id;
          }

          const matched = planned.players.filter((player) => player.profileId !== null);
          // Kennt der Verein niemanden aus der Meldung (etwa weil die Mitglieder noch
          // fehlen), bliebe sonst ein leerer Kader übrig — der bisherige bleibt dann stehen.
          if (matched.length === 0) {
            result.teams.push({
              team: name,
              action: existing ? 'updated' : 'created',
              detail: 'Kader unverändert — kein Spieler als Mitglied gefunden',
            });
            continue;
          }

          await saveRoster({
            teamId,
            // Nennt die Meldung niemanden, den wir kennen, bleibt die bisherige Führung.
            leaderIds: planned.leaderId ? [planned.leaderId] : (existing?.leaderIds ?? []),
            regularIds: matched
              .filter((player) => player.kind === 'regular')
              .map((player) => player.profileId!),
            substituteIds: matched
              .filter((player) => player.kind === 'substitute')
              .map((player) => player.profileId!),
          });

          const { error: rankingError } = await supabase.from('member_rankings').upsert(
            matched.map((player) => ({
              profile_id: player.profileId!,
              ranking_type: meldung.rankingType,
              team_number: player.team,
              position_number: player.position,
            })),
            { onConflict: 'profile_id,ranking_type' },
          );
          if (rankingError) throw rankingError;
          result.rankings += matched.length;

          result.teams.push({ team: name, action: existing ? 'updated' : 'created' });
        } catch (error) {
          result.teams.push({
            team: name,
            action: 'failed',
            detail: error instanceof Error ? error.message : 'unbekannter Fehler',
          });
        }
      }

      if (input.removeStaleRankings) {
        for (const ranking of input.plan.staleRankings) {
          const { error } = await supabase
            .from('member_rankings')
            .delete()
            .eq('profile_id', ranking.profile_id)
            .eq('ranking_type', ranking.ranking_type);
          if (!error) result.removedRankings += 1;
        }
      }

      if (input.updateQttr) {
        const changes = input.plan.teams.flatMap((team) =>
          team.players.flatMap((player) =>
            player.profileId && player.qttrChange
              ? [{ id: player.profileId, qttr: player.qttrChange.to }]
              : [],
          ),
        );
        if (changes.length > 0) {
          const { data, error } = await supabase.rpc('rpc_update_qttr_bulk', {
            p_values: changes,
          });
          if (error) throw error;
          result.qttr = (data as number | null) ?? 0;
        }
      }

      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
    },
  });
}
