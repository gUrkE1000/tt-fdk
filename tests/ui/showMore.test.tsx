import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PagedList } from '../../src/components/ui/ShowMore';
import Table from '../../src/components/ui/Table';

const items = Array.from({ length: 75 }, (_, index) => `Eintrag ${index + 1}`);

function List({ rows, resetKey }: { rows: string[]; resetKey?: unknown }) {
  return (
    <PagedList items={rows} resetKey={resetKey}>
      {(item) => <p key={item}>{item}</p>}
    </PagedList>
  );
}

describe('PagedList', () => {
  it('zeigt zuerst 30 Einträge und darunter, wie viele noch kommen', () => {
    render(<List rows={items} />);
    expect(screen.getAllByText(/^Eintrag /)).toHaveLength(30);
    expect(screen.getByRole('button', { name: /Weitere 30 anzeigen \(noch 45\)/ })).toBeInTheDocument();
  });

  it('holt auf Knopfdruck die nächsten 30, zuletzt den Rest', () => {
    render(<List rows={items} />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere 30/ }));
    expect(screen.getAllByText(/^Eintrag /)).toHaveLength(60);

    fireEvent.click(screen.getByRole('button', { name: /Weitere 15 anzeigen/ }));
    expect(screen.getAllByText(/^Eintrag /)).toHaveLength(75);
    expect(screen.queryByRole('button', { name: /Weitere/ })).toBeNull();
  });

  it('zeigt keinen Knopf, wenn alles auf eine Seite passt', () => {
    render(<List rows={items.slice(0, 30)} />);
    expect(screen.queryByRole('button', { name: /Weitere/ })).toBeNull();
  });

  it('beginnt nach einem Filterwechsel wieder bei der ersten Seite', () => {
    function Filtered() {
      const [filter, setFilter] = useState('alle');
      return (
        <>
          <button type="button" onClick={() => setFilter('neu')}>
            Filter
          </button>
          <List rows={items} resetKey={filter} />
        </>
      );
    }
    render(<Filtered />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere 30/ }));
    expect(screen.getAllByText(/^Eintrag /)).toHaveLength(60);

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getAllByText(/^Eintrag /)).toHaveLength(30);
  });
});

describe('Table', () => {
  it('blättert genauso in Portionen zu 30', () => {
    render(
      <Table
        columns={[{ key: 'name', header: 'Name', cell: (row: string) => row }]}
        rows={items}
        rowKey={(row) => row}
        mobileCard={(row) => <span>{row}</span>}
      />,
    );
    // Tabelle und Kartenansicht stehen beide im DOM (per CSS umgeschaltet).
    expect(screen.getAllByRole('row')).toHaveLength(31);
    fireEvent.click(screen.getByRole('button', { name: /Weitere 30/ }));
    expect(screen.getAllByRole('row')).toHaveLength(61);
  });
});
