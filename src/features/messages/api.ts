import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { Enums, ViewRow } from '../../lib/database.types';

/**
 * Nachrichten am Termin (Aufgabe 9.2).
 *
 * **Kein Chat.** Ein Faden hängt an genau einem Spiel, Trainingstermin oder
 * Vereinstermin, ist für dessen Beteiligte sichtbar und verschwindet mit ihm. Es gibt
 * keine Unterhaltung zwischen zwei Personen und keine Kanäle — der Chat des TT-Planers
 * ist gestrichen und bleibt es.
 */

export type MessageObject = Enums<'message_object'>;
export type ObjectMessage = ViewRow<'v_object_messages'>;
export type MessageCount = ViewRow<'v_object_message_counts'>;

export const messageKeys = {
  all: ['object-messages'] as const,
  thread: (type: MessageObject, id: string) => ['object-messages', type, id] as const,
  counts: (type: MessageObject) => ['object-messages', 'counts', type] as const,
};

export function useMessages(type: MessageObject, objectId: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(type, objectId ?? ''),
    enabled: objectId !== null,
    queryFn: async (): Promise<ObjectMessage[]> => {
      const { data, error } = await supabase
        .from('v_object_messages')
        .select('*')
        .eq('object_type', type)
        .eq('object_id', objectId!)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Die Zähler aller Termine einer Art auf einmal.
 *
 * Eine Abfrage für die ganze Seite statt einer je Karte: Bei zwanzig Spielterminen wären
 * das sonst zwanzig Anfragen, nur um „Nachrichten (0)" zu schreiben.
 */
export function useMessageCounts(type: MessageObject) {
  return useQuery({
    queryKey: messageKeys.counts(type),
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('v_object_message_counts')
        .select('*')
        .eq('object_type', type);
      if (error) throw error;

      return new Map(
        (data ?? []).map((row) => [row.object_id ?? '', row.message_count ?? 0]),
      );
    },
  });
}

export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      type: MessageObject;
      objectId: string;
      authorId: string;
      body: string;
    }) => {
      // `author_id` steht hier, weil die Policy es verlangt (`author_id = auth.uid()`).
      // Mitschicken heißt nicht vertrauen: Wer etwas anderes einträgt, kommt nicht durch.
      const { error } = await supabase.from('object_messages').insert({
        object_type: input.type,
        object_id: input.objectId,
        author_id: input.authorId,
        body: input.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: messageKeys.all }),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('object_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: messageKeys.all }),
  });
}

/** Länger nimmt die Datenbank nicht an (CHECK-Constraint). */
export const MESSAGE_MAX_LENGTH = 2000;

export function messageProblem(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed === '') return 'Schreib etwas, bevor du abschickst';
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `Höchstens ${MESSAGE_MAX_LENGTH} Zeichen — das sind ${trimmed.length}`;
  }
  return null;
}
