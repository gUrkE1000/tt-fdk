import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowRight, Clock, Loader2, Search, WifiOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOpenDetail } from '../../app/detail/useDetail';
import { useCloseOnBack } from '../../components/ui';
import { cn } from '../../lib/cn';
import { searchable } from '../../lib/search';
import { useSession } from '../auth/session';
import { groupHits, useDebounced, useSearch } from './api';
import HitRow from './HitRow';
import { loadRecent, rememberSearch } from './recent';
import { KINDS, type SearchHit } from './types';

type Option =
  | { type: 'hit'; hit: SearchHit }
  | { type: 'recent'; query: string }
  | { type: 'all' };

/** Kürzel für die Anzeige: ⌘ auf dem Mac, sonst Strg. */
function shortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Strg K';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Strg K';
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="dialog"]') !== null
  );
}

/**
 * Knopf in der Kopfzeile plus die Sofortsuche als Schicht darüber (docs/suche.md, 2.2).
 * Ab `sm` ein breites Feld mit Tastenkürzel, auf dem Telefon eine Lupe; die Schicht ist
 * dort bildschirmfüllend und öffnet mit Tastatur.
 */
export default function SearchLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Suchen"
        aria-keyshortcuts="Control+K Meta+K /"
        className={cn(
          'flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-xl text-gray-600 hover:bg-gray-50',
          'md:w-64 md:justify-start md:border md:border-gray-200 md:bg-gray-50 md:px-3 md:text-sm md:text-gray-500 md:hover:bg-gray-100',
        )}
      >
        <Search className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />
        <span className="hidden flex-1 text-left md:inline">Suchen …</span>
        <kbd className="hidden rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-xs text-gray-500 md:inline">
          {shortcutLabel()}
        </kbd>
      </button>
      {open && <SearchDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function SearchDialog({ open, onOpenChange, initialQuery = '' }: SearchDialogProps) {
  const navigate = useNavigate();
  // Termine öffnen als Blatt über der Seite, auf der man gesucht hat.
  const openDetail = useOpenDetail();
  const { profile, role } = useSession();
  const userId = profile?.id ?? null;
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(() => loadRecent(userId));
  const debounced = useDebounced(query);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Zurückwischen schließt die Suche. Wer einen Treffer öffnet, ersetzt ihren Eintrag im
  // Verlauf — sonst stünde die Seite, auf der gesucht wurde, danach zweimal da.
  const onTop = useCloseOnBack(open, () => onOpenChange(false));

  const search = useSearch(
    { query: debounced, limit: 5 },
    role ?? null,
    open,
    profile?.key_service === true,
  );
  const trimmed = query.trim();
  const settled = debounced.trim() === trimmed;
  const groups = useMemo(
    () => (trimmed === '' ? [] : groupHits(search.data?.hits ?? [])),
    [search.data, trimmed],
  );

  const options = useMemo<Option[]>(() => {
    if (trimmed === '') return recent.map((q) => ({ type: 'recent', query: q }));
    const hits: Option[] = groups.flatMap((group) =>
      group.hits.map((hit): Option => ({ type: 'hit', hit })),
    );
    return [...hits, { type: 'all' }];
  }, [groups, recent, trimmed]);

  useEffect(() => setActive(0), [debounced]);

  const choose = useCallback(
    (option: Option) => {
      if (option.type === 'recent') {
        setQuery(option.query);
        inputRef.current?.focus();
        return;
      }
      setRecent(rememberSearch(userId, trimmed));
      onOpenChange(false);
      if (option.type === 'all') {
        navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: onTop });
      } else if (option.hit.external) {
        window.open(option.hit.target, '_blank', 'noopener,noreferrer');
      } else {
        openDetail(option.hit.target, { replace: onTop });
      }
    },
    [navigate, openDetail, onOpenChange, onTop, trimmed, userId],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === 'Home' && event.ctrlKey) {
      setActive(0);
    } else if (event.key === 'End' && event.ctrlKey) {
      setActive(options.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[Math.min(active, options.length - 1)];
      if (option) choose(option);
    }
  }

  // Die aktive Zeile bleibt beim Blättern mit den Pfeiltasten sichtbar.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);

  const hitCount = options.filter((o) => o.type === 'hit').length;
  const optionId = (i: number) => `${listId}-${i}`;
  const indexOfHit = useMemo(() => {
    const map = new Map<SearchHit, number>();
    options.forEach((option, i) => {
      if (option.type === 'hit') map.set(option.hit, i);
    });
    return map;
  }, [options]);

  function renderOption(option: Option, i: number, label: React.ReactNode) {
    return (
      <li
        key={i}
        id={optionId(i)}
        role="option"
        aria-selected={i === active}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(option)}
        className="cursor-pointer"
      >
        {label}
      </li>
    );
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-900/40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-white',
            'sm:inset-auto sm:left-1/2 sm:top-[10vh] sm:max-h-[75vh] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl',
          )}
        >
          <RadixDialog.Title className="sr-only">Suche</RadixDialog.Title>

          <div className="flex items-center gap-2 border-b border-gray-100 px-3">
            <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label="Suchbegriff"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Mitglied, Spiel, Training, Termin, Seite …"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              // Das Kreuz des Browsers weg: Schließen gibt es rechts daneben.
              className="min-h-[3.25rem] flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search.isFetching && trimmed !== '' && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Suche läuft" />
            )}
            <RadixDialog.Close
              aria-label="Suche schließen"
              className="flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </RadixDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {search.data?.offline && trimmed !== '' && (
              <p className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-status-late-soft px-3 py-2 text-xs text-status-late">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                Offline — Suche im gespeicherten Stand auf diesem Gerät.
              </p>
            )}
            {search.data?.range && trimmed !== '' && (
              <p className="mx-3 mb-2 text-xs text-gray-500">
                Zeitraum erkannt: <strong>{search.data.range.label}</strong>
              </p>
            )}
            {search.isError && trimmed !== '' && (
              <p className="mx-3 mb-2 text-sm text-status-no">
                Die Suche hat gerade nicht geklappt. Bitte noch einmal versuchen.
              </p>
            )}

            <ul id={listId} role="listbox" aria-label="Suchergebnisse" className="outline-none">
              {trimmed === '' && recent.length > 0 && (
                <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Zuletzt gesucht
                </li>
              )}
              {trimmed === '' &&
                options.map((option, i) =>
                  option.type === 'recent'
                    ? renderOption(
                        option,
                        i,
                        <div
                          className={cn(
                            'flex min-h-touch items-center gap-3 px-3 text-sm text-gray-700',
                            i === active && 'bg-primary-soft',
                          )}
                        >
                          <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                          {option.query}
                        </div>,
                      )
                    : null,
                )}

              {groups.map((group) => (
                <li key={group.kind} role="presentation">
                  <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {KINDS[group.kind].label}
                  </div>
                  <ul role="group" aria-label={KINDS[group.kind].label}>
                    {group.hits.map((hit) => {
                      const i = indexOfHit.get(hit) ?? -1;
                      return renderOption(
                        { type: 'hit', hit },
                        i,
                        <HitRow hit={hit} query={debounced} active={i === active} />,
                      );
                    })}
                  </ul>
                </li>
              ))}

              {trimmed !== '' &&
                renderOption(
                  { type: 'all' },
                  options.length - 1,
                  <div
                    className={cn(
                      'mt-1 flex min-h-touch items-center gap-2 border-t border-gray-100 px-3 text-sm font-semibold text-primary',
                      options.length - 1 === active && 'bg-primary-soft',
                    )}
                  >
                    Alle Treffer für „{trimmed}“ anzeigen
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </div>,
                )}
            </ul>

            {trimmed !== '' && !searchable(trimmed) && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Die Suche beginnt ab zwei Buchstaben oder Ziffern.
              </p>
            )}

            {searchable(trimmed) && settled && search.isSuccess && hitCount === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                <p className="font-semibold text-gray-700">Nichts gefunden für „{trimmed}“.</p>
                <p className="mt-1">
                  Tipp: nur den Nachnamen oder den Gegner eingeben, oder eine Zeit wie
                  „Samstag“ oder „12.10.“.
                </p>
              </div>
            )}

            {trimmed === '' && recent.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">
                <p>Suche nach Mitgliedern, Spielen, Trainings, Terminen, Umfragen und Seiten.</p>
                <p className="mt-1">
                  Beispiele: „Müller“, „H2 heim“, „Samstag“, „Urlaub“, „Kalender abonnieren“.
                </p>
              </div>
            )}
          </div>

          <div className="hidden items-center gap-4 border-t border-gray-100 px-4 py-2 text-xs text-gray-500 sm:flex">
            <span>
              <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> wählen
            </span>
            <span>
              <kbd className="font-sans">Enter</kbd> öffnen
            </span>
            <span>
              <kbd className="font-sans">Esc</kbd> schließen
            </span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
