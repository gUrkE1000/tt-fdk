import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Users } from 'lucide-react';
import Card, { CardBody, CardFooter, CardHeader } from '../../src/components/ui/Card';
import PageHeader from '../../src/components/ui/PageHeader';
import EmptyState from '../../src/components/ui/EmptyState';
import StatTile from '../../src/components/ui/StatTile';
import Dialog from '../../src/components/ui/Dialog';
import Drawer from '../../src/components/ui/Drawer';
import Table from '../../src/components/ui/Table';
import FilterBar from '../../src/components/ui/FilterBar';
import SortableList from '../../src/components/ui/SortableList';
import { ToastProvider, useToast } from '../../src/components/ui/Toast';

describe('Card', () => {
  it('rendert Kopf, Körper und Fuß', () => {
    render(
      <Card accentColor="#0d9488">
        <CardHeader>Kopf</CardHeader>
        <CardBody>Körper</CardBody>
        <CardFooter>Fuß</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Kopf')).toBeInTheDocument();
    expect(screen.getByText('Körper')).toBeInTheDocument();
    expect(screen.getByText('Fuß')).toBeInTheDocument();
  });
});

describe('PageHeader, EmptyState, StatTile', () => {
  it('PageHeader zeigt Titel, Beschreibung und Aktion', () => {
    render(<PageHeader title="Mannschaften" description="Kader pflegen" actions={<button>Neu</button>} />);
    expect(screen.getByRole('heading', { name: 'Mannschaften' })).toBeInTheDocument();
    expect(screen.getByText('Kader pflegen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu' })).toBeInTheDocument();
  });

  it('EmptyState zeigt Titel, Text und Aktion', () => {
    render(
      <EmptyState
        icon={Users}
        title="Noch keine Mitglieder"
        description="Lade jemanden ein."
        action={<button>Einladen</button>}
      />,
    );
    expect(screen.getByText('Noch keine Mitglieder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einladen' })).toBeInTheDocument();
  });

  it('StatTile zeigt Wert und Zusatz', () => {
    render(<StatTile label="Offene Rückmeldungen" value={7} hint="bei 3 Spielen" tone="warning" />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('bei 3 Spielen')).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Öffnen</button>
        <Dialog open={open} onOpenChange={setOpen} title="Spieler verwalten" description="Erwachsene I">
          <p>Inhalt</p>
        </Dialog>
      </>
    );
  }

  it('öffnet und schließt', async () => {
    render(<Harness />);
    expect(screen.queryByText('Inhalt')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Spieler verwalten')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Schließen'));
    await waitFor(() => expect(screen.queryByText('Inhalt')).toBeNull());
  });
});

describe('Drawer', () => {
  it('rendert Titel und Inhalt, wenn offen', () => {
    render(
      <Drawer open onOpenChange={vi.fn()} title="Filter">
        <p>Drawer-Inhalt</p>
      </Drawer>,
    );
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Drawer-Inhalt')).toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('zeigt eine Meldung an und meldet sie höflich an Screenreader', () => {
    function Harness() {
      const { toast } = useToast();
      return <button onClick={() => toast('Aufstellung kopiert', 'success')}>Kopieren</button>;
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    expect(screen.getByText('Aufstellung kopiert')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('wirft, wenn useToast ohne Provider genutzt wird', () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('Table', () => {
  interface Row {
    id: string;
    name: string;
  }
  const rows: Row[] = [
    { id: '1', name: 'Anna' },
    { id: '2', name: 'Bernd' },
  ];

  it('rendert Kopfzeile und Zeilen', () => {
    render(
      <Table
        columns={[{ key: 'name', header: 'Name', cell: (r: Row) => r.name }]}
        rows={rows}
        rowKey={(r) => r.id}
        mobileCard={(r) => <div>{r.name} (mobil)</div>}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    // Jede Zeile erscheint zweimal: als Tabellenzeile und als Karte fürs Smartphone.
    expect(screen.getAllByText('Anna').length).toBe(1);
    expect(screen.getByText('Anna (mobil)')).toBeInTheDocument();
  });

  it('zeigt den leeren Zustand statt einer leeren Tabelle', () => {
    render(
      <Table
        columns={[{ key: 'name', header: 'Name', cell: (r: Row) => r.name }]}
        rows={[]}
        rowKey={(r) => r.id}
        mobileCard={(r) => <div>{r.name}</div>}
        empty={<p>Nichts gefunden</p>}
      />,
    );
    expect(screen.getByText('Nichts gefunden')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('FilterBar', () => {
  it('meldet Suchtext und Zurücksetzen', () => {
    const onSearchChange = vi.fn();
    const onReset = vi.fn();
    render(<FilterBar search="" onSearchChange={onSearchChange} onReset={onReset} />);

    fireEvent.change(screen.getByLabelText('Suchen'), { target: { value: 'anna' } });
    expect(onSearchChange).toHaveBeenCalledWith('anna');

    fireEvent.click(screen.getByRole('button', { name: /Zurücksetzen/ }));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('SortableList', () => {
  it('rendert nummerierte Einträge mit Greifpunkt', () => {
    render(
      <SortableList
        numbered
        items={[
          { id: 'a', content: <span>Anna</span> },
          { id: 'b', content: <span>Bernd</span> },
        ]}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByLabelText('Position 1 verschieben')).toBeInTheDocument();
    expect(screen.getByLabelText('Position 2 verschieben')).toBeInTheDocument();
  });
});
