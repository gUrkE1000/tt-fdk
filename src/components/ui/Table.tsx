import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import ShowMore, { usePaged } from './ShowMore';

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Rechtsbündig für Zahlen, zentriert für Symbole. */
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /**
   * Darstellung unter 768 px. Tabellen mit sechs Spalten sind auf dem Smartphone unlesbar,
   * deshalb rendert jede Zeile dort als Karte.
   */
  mobileCard: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
  /** Beginnt die Liste bei der ersten Seite, sobald sich der Wert ändert (etwa ein Filter). */
  resetKey?: unknown;
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export default function Table<T>({
  columns,
  rows,
  rowKey,
  mobileCard,
  empty,
  className,
  resetKey,
}: TableProps<T>) {
  // 30 Zeilen, dann „Weitere anzeigen" — wie jede Liste der App.
  const { shown, rest, more } = usePaged(rows, resetKey);

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-500',
                    ALIGN[column.align ?? 'left'],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowKey(row)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-3 py-2.5 text-gray-800', ALIGN[column.align ?? 'left'], column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Smartphone */}
      <div className="space-y-2 md:hidden">
        {shown.map((row) => (
          <div key={rowKey(row)}>{mobileCard(row)}</div>
        ))}
      </div>

      <ShowMore rest={rest} onMore={more} />
    </div>
  );
}
