import { useEffect, useState } from 'react';
import { Newspaper, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Dialog,
  EmptyState,
  FormField,
  IconButton,
  Input,
  RichText,
  RichTextEditor,
  useToast,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import {
  isScheduled,
  useDeleteNews,
  useNews,
  useSaveNews,
  type NewsItem,
} from './newsApi';

export interface NewsTabProps {
  /** Anlegen und Bearbeiten — nur unter „Verein", nicht unter „Mein Verein". */
  canEdit?: boolean;
}

/** Aus einem Zeitpunkt den Wert für `<input type="datetime-local">` machen. */
function toLocalInput(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Das schwarze Brett des Vereins (Aufgabe 9.3).
 *
 * Dieselbe Komponente unter „Verein" (mit Knöpfen) und unter „Mein Verein" (ohne). Zwei
 * Fassungen wären zwei Stellen, an denen künftig entschieden wird, wie eine Neuigkeit
 * aussieht.
 */
export default function NewsTab({ canEdit = false }: NewsTabProps) {
  const { toast } = useToast();
  const news = useNews();
  const saveNews = useSaveNews();
  const deleteNews = useDeleteNews();

  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishedAt, setPublishedAt] = useState(toLocalInput(null));
  const [pinned, setPinned] = useState(false);
  const [announce, setAnnounce] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setBody(editing?.body_html ?? '');
    setPublishedAt(toLocalInput(editing?.published_at));
    setPinned(editing?.pinned ?? false);
    setAnnounce(true);
    setError(null);
  }, [open, editing]);

  async function submit() {
    if (title.trim() === '') {
      setError('Die Neuigkeit braucht eine Überschrift');
      return;
    }

    try {
      await saveNews.mutateAsync({
        id: editing?.id ?? null,
        values: {
          title,
          body_html: body,
          published_at: new Date(publishedAt).toISOString(),
          pinned,
          announce: !editing && announce,
        },
      });
      toast(editing ? 'Neuigkeit gespeichert' : 'Neuigkeit veröffentlicht', 'success');
      setOpen(false);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  async function remove(item: NewsItem) {
    if (!item.id) return;
    if (!window.confirm(`„${item.title}" wirklich löschen?`)) return;

    try {
      await deleteNews.mutateAsync(item.id);
      toast('Neuigkeit gelöscht', 'success');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  const items = news.data ?? [];

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600">
            Neuigkeiten stehen unter „Mein Verein“ für alle — es geht bewusst keine
            Benachrichtigung raus.
          </p>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Neuigkeit schreiben
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Noch keine Neuigkeiten"
          description={
            canEdit
              ? 'Termine, Anschaffungen, Ergebnisse — was den Verein angeht, steht hier.'
              : 'Sobald es etwas Neues gibt, steht es hier.'
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id ?? ''}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.pinned && (
                        <Pin className="h-4 w-4 shrink-0 text-primary" aria-label="angeheftet" />
                      )}
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      {isScheduled(item) && <Badge tone="late">geplant</Badge>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.published_at ? formatDateTime(item.published_at) : ''}
                      {item.author_name ? ` · ${item.author_name}` : ''}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex gap-1">
                      <IconButton
                        label="Bearbeiten"
                        icon={Pencil}
                        onClick={() => {
                          setEditing(item);
                          setOpen(true);
                        }}
                      />
                      <IconButton
                        label="Löschen"
                        icon={Trash2}
                        tone="danger"
                        onClick={() => void remove(item)}
                      />
                    </div>
                  )}
                </div>

                {item.body_html && <RichText html={item.body_html} />}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Neuigkeit bearbeiten' : 'Neuigkeit schreiben'}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button variant="primary" loading={saveNews.isPending} onClick={() => void submit()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Überschrift" required error={error ?? undefined}>
            {(p) => (
              <Input {...p} value={title} onChange={(event) => setTitle(event.target.value)} />
            )}
          </FormField>

          <FormField label="Text">
            {(p) => <RichTextEditor {...p} value={body} onChange={setBody} />}
          </FormField>

          <FormField
            label="Veröffentlichen am"
            hint="Ein Zeitpunkt in der Zukunft hält die Neuigkeit zurück, bis er da ist."
          >
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
              />
            )}
          </FormField>

          <Checkbox
            checked={pinned}
            onCheckedChange={setPinned}
            label="Oben anheften"
            hint="Bleibt über den anderen stehen, unabhängig vom Datum."
          />

          {!editing && (
            <Checkbox
              checked={announce}
              onCheckedChange={setAnnounce}
              label="Mitglieder benachrichtigen"
              hint="Alle aktiven Mitglieder bekommen einen Hinweis per App bzw. E-Mail. Beim Abschreiben alter Neuigkeiten abwählen."
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
