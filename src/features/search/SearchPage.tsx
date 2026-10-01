import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DetailLink from '../../app/detail/DetailLink';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Search, SearchX, WifiOff } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Segmented,
  buttonClasses,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { searchable } from '../../lib/search';
import { useSession } from '../auth/session';
import { useSetResponse } from '../matches/api';
import { groupHits, useDebounced, useSearch, type TimeFilter } from './api';
import HitRow from './HitRow';
import { rememberSearch } from './recent';
import { KINDS, kindsForRole, type SearchHit, type SearchKind } from './types';

const TIME_OPTIONS = [
  ['all', 'Alle'],
  ['upcoming', 'Kommend'],
  ['past', 'Vergangen'],
] as const satisfies readonly (readonly [TimeFilter, string])[];

/**
 * Die volle Ergebnisseite (docs/suche.md, 2.2 Punkt 2). Suche und Filter stehen in der
 * Adresse — teilbar und mit „Zurück" wieder erreichbar.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { profile, role } = useSession();
  const [input, setInput] = useState(params.get('q') ?? '');
  const debounced = useDebounced(input, 250);
  const kind = (params.get('kind') as SearchKind | null) ?? null;
  const time = (params.get('time') as TimeFilter | null) ?? 'all';
  const kinds = kindsForRole(role);

  // Eingabe → Adresse, gebündelt, ohne für jeden Buchstaben einen Verlaufseintrag.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set('q', debounced.trim());
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  // Adresse → Eingabe, wenn jemand aus der Sofortsuche erneut hierher springt.
  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    setInput((current) => (current.trim() === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  // „Zuletzt gesucht" merkt sich, womit jemand etwas angefangen hat — nicht jeden
  // Zwischenstand beim Tippen.
  const remember = () => rememberSearch(profile?.id ?? null, urlQuery);

  const search = useSearch(
    { query: urlQuery, kinds: kind ? [kind] : [], time, limit: kind ? 50 : 20 },
    role ?? null,
    true,
    profile?.key_service === true,
  );
  const groups = useMemo(() => groupHits(search.data?.hits ?? []), [search.data]);

  function setFilter(key: 'kind' | 'time', value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  return (
    <div>
      <PageHeader title="Suche" description="Alles, was du im Verein sehen darfst." />

      <form
        role="search"
        className="relative mb-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(params);
          next.set('q', input.trim());
          setParams(next, { replace: true });
          rememberSearch(profile?.id ?? null, input);
        }}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Suchbegriff"
          placeholder="Mitglied, Spiel, Training, Termin, Seite …"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="pl-9"
          autoFocus
          enterKeyHint="search"
        />
      </form>

      <div className="mb-4 space-y-2">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip pressed={kind === null} onClick={() => setFilter('kind', null)}>
            Alles
          </Chip>
          {kinds.map((value) => (
            <Chip key={value} pressed={kind === value} onClick={() => setFilter('kind', value)}>
              {KINDS[value].chip}
            </Chip>
          ))}
        </div>
        <Segmented
          label="Zeitraum"
          value={time}
          onChange={(value) => setFilter('time', value)}
          options={TIME_OPTIONS}
        />
      </div>

      {search.data?.offline && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-status-late-soft px-3 py-2 text-sm text-status-late">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Offline — gesucht wird im gespeicherten Stand auf diesem Gerät.
        </p>
      )}
      {search.data?.range && (
        <p className="mb-3 text-sm text-gray-600">
          Zeitraum erkannt: <strong>{search.data.range.label}</strong>
        </p>
      )}

      <Results
        query={urlQuery}
        loading={search.isLoading}
        error={search.isError}
        onRetry={() => void search.refetch()}
        groups={groups}
        profileId={profile?.id ?? null}
        onOpen={remember}
      />
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-9 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors',
        pressed
          ? 'border-primary bg-primary text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {children}
    </button>
  );
}

function Results({
  query,
  loading,
  error,
  onRetry,
  groups,
  profileId,
  onOpen,
}: {
  query: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  groups: ReturnType<typeof groupHits>;
  profileId: string | null;
  onOpen: () => void;
}) {
  if (query.trim() === '') {
    return (
      <EmptyState
        icon={Search}
        title="Wonach suchst du?"
        description="Namen, Gegner, Mannschaften („H2“), Zeiten („Samstag“, „12.10.“) oder Seiten („Urlaub“, „Kalender abonnieren“)."
      />
    );
  }
  if (!searchable(query)) {
    return (
      <EmptyState
        icon={Search}
        title="Bitte etwas mehr eingeben"
        description="Die Suche beginnt ab zwei Buchstaben oder Ziffern."
      />
    );
  }
  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (groups.length === 0) {
    // Dieselbe Antwort für „gibt es nicht" und „darfst du nicht sehen" (docs/suche.md, 4.4).
    return (
      <EmptyState
        icon={SearchX}
        title={`Nichts gefunden für „${query.trim()}“`}
        description="Tipp: nur den Nachnamen oder den Gegner eingeben, oder den Filter auf „Alles“ stellen."
      />
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.kind} aria-labelledby={`search-group-${group.kind}`}>
          <h2
            id={`search-group-${group.kind}`}
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600"
          >
            {KINDS[group.kind].label}
          </h2>
          <Card>
            <ul className="divide-y divide-gray-100">
              {group.hits.map((hit) => (
                <li key={`${hit.kind}:${hit.id}`}>
                  <ResultItem hit={hit} query={query} profileId={profileId} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function ResultItem({
  hit,
  query,
  profileId,
  onOpen,
}: {
  hit: SearchHit;
  query: string;
  profileId: string | null;
  onOpen: () => void;
}) {
  const actions = <HitActions hit={hit} profileId={profileId} />;
  const row = <HitRow hit={hit} query={query} />;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center">
      {hit.external ? (
        <a
          href={hit.target}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 hover:bg-gray-50"
          onClick={onOpen}
        >
          {row}
        </a>
      ) : (
        // Termine öffnen als Blatt über den Treffern; zurück steht wieder die Trefferliste.
        <DetailLink to={hit.target} className="min-w-0 flex-1 hover:bg-gray-50" onClick={onOpen}>
          {row}
        </DetailLink>
      )}
      {actions}
    </div>
  );
}

/**
 * Schnellaktionen neben dem Treffer — nur, wenn die Rolle sie hergibt (docs/suche.md,
 * 4.5). Das ist Bequemlichkeit: Die Datenbank prüft jede Aktion ohnehin selbst.
 */
function HitActions({ hit, profileId }: { hit: SearchHit; profileId: string | null }) {
  const queryClient = useQueryClient();
  const setResponse = useSetResponse();
  const links: { to: string; label: string }[] = [];
  // Nur, was die Datenbank schon herausgegeben hat: ohne Freigabe steht hier nichts.
  const phone =
    hit.kind === 'member'
      ? ((hit.meta.mobile_phone as string | undefined) ?? (hit.meta.phone as string | undefined))
      : undefined;

  if (hit.canManage) {
    if (hit.kind === 'member') {
      links.push({ to: `/players?q=${encodeURIComponent(hit.title)}`, label: 'Bearbeiten' });
    }
    if (hit.kind === 'team') links.push({ to: '/teams', label: 'Kader bearbeiten' });
    if (hit.kind === 'match') links.push({ to: hit.target, label: 'Spieler verwalten' });
    if (hit.kind === 'event') links.push({ to: '/dates', label: 'Bearbeiten' });
    if (hit.kind === 'venue') links.push({ to: '/venues', label: 'Bearbeiten' });
  }

  // Zu- und Absage direkt in der Liste, wenn man angefragt ist und das Spiel noch kommt.
  const canRespond =
    hit.kind === 'match' &&
    hit.myStatus !== null &&
    hit.meta.active !== false &&
    hit.startsAt !== null &&
    new Date(hit.startsAt) > new Date();

  if (links.length === 0 && !canRespond && !phone) return null;

  function respond(response: 'yes' | 'no') {
    setResponse.mutate(
      { matchId: hit.id, response, profileId },
      { onSettled: () => void queryClient.invalidateQueries({ queryKey: ['search'] }) },
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2 px-3 pb-2 sm:pb-0">
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          className={buttonClasses({ variant: 'ghost', size: 'sm' })}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {phone}
        </a>
      )}
      {canRespond && (
        <>
          <Button
            size="sm"
            variant={hit.myStatus === 'yes' ? 'primary' : 'secondary'}
            onClick={() => respond('yes')}
            disabled={setResponse.isPending}
            aria-pressed={hit.myStatus === 'yes'}
          >
            Zusage
          </Button>
          <Button
            size="sm"
            variant={hit.myStatus === 'no' ? 'danger' : 'secondary'}
            onClick={() => respond('no')}
            disabled={setResponse.isPending}
            aria-pressed={hit.myStatus === 'no'}
          >
            Absage
          </Button>
        </>
      )}
      {links.map((link) => (
        <Link
          key={link.label}
          to={link.to}
          className={buttonClasses({ variant: 'ghost', size: 'sm' })}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
