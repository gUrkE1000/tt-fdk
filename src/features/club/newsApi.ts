import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { ViewRow } from '../../lib/database.types';

/**
 * Vereinsneuigkeiten (Aufgabe 9.3).
 *
 * Es geht bewusst **keine Benachrichtigung** raus — wie im TT-Planer. Eine Neuigkeit ist
 * eine Mitteilung an alle, keine Aufforderung an einen Einzelnen. Alles, was den
 * Posteingang erreicht, verlangt eine Handlung; sonst gewöhnen sich die Mitglieder daran,
 * Mails aus der Anwendung wegzuklicken, und dann geht auch die Ersatzanfrage unter.
 */

export type NewsItem = ViewRow<'v_news'>;

export const newsKeys = {
  all: ['news'] as const,
  list: () => ['news', 'list'] as const,
};

export function useNews() {
  return useQuery({
    queryKey: newsKeys.list(),
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from('v_news')
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface NewsInput {
  title: string;
  body_html: string;
  published_at: string;
  pinned: boolean;
  /**
   * Alle aktiven Mitglieder auf die neue Neuigkeit hinweisen. Nur beim Anlegen; eine
   * vordatierte Neuigkeit wird zum Veröffentlichungstermin gemeldet.
   */
  announce?: boolean;
}

export function useSaveNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: NewsInput }) => {
      const row = {
        title: values.title.trim(),
        body_html: values.body_html,
        published_at: values.published_at,
        pinned: values.pinned,
      };

      // `author_id` steht bewusst nicht dabei: Den setzt ein Trigger aus der Sitzung,
      // damit niemand im Namen eines anderen schreibt.
      if (id) {
        const { error } = await supabase.from('news').update(row).eq('id', id);
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase.from('news').insert(row).select('id').single();
      if (error) throw error;

      if (values.announce) {
        const announced = await supabase.rpc('rpc_announce_news', { p_news_id: data.id });
        if (announced.error) throw announced.error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: newsKeys.all }),
  });
}

export function useDeleteNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: newsKeys.all }),
  });
}

/** Noch nicht veröffentlicht — sichtbar nur für die, die es anlegen dürfen. */
export function isScheduled(item: { published_at?: string | null }, now: Date = new Date()): boolean {
  return item.published_at ? new Date(item.published_at).getTime() > now.getTime() : false;
}
