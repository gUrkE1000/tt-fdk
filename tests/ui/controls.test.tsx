import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil } from 'lucide-react';
import Button from '../../src/components/ui/Button';
import IconButton from '../../src/components/ui/IconButton';
import Badge from '../../src/components/ui/Badge';
import Avatar, { initials } from '../../src/components/ui/Avatar';
import ProgressBar from '../../src/components/ui/ProgressBar';
import Tabs from '../../src/components/ui/Tabs';

describe('Button', () => {
  it('rendert und löst onClick aus', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ist im Ladezustand deaktiviert und meldet das', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ist standardmäßig type=button, damit er kein Formular abschickt', () => {
    render(<Button>Aktion</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('IconButton', () => {
  it('hat eine Beschriftung für Screenreader', () => {
    render(<IconButton icon={Pencil} label="Bearbeiten" />);
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('rendert den Inhalt', () => {
    render(<Badge tone="yes">Zusage</Badge>);
    expect(screen.getByText('Zusage')).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('bildet Initialen aus Vor- und Nachname', () => {
    expect(initials('Max Mustermann')).toBe('MM');
    expect(initials('Max')).toBe('MA');
    expect(initials('Anna Maria Beispiel')).toBe('AB');
    expect(initials('   ')).toBe('?');
  });

  it('nennt den vollen Namen als Beschriftung', () => {
    render(<Avatar name="Anna Beispiel" />);
    expect(screen.getByLabelText('Anna Beispiel')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('meldet Werte an Hilfstechnologie', () => {
    render(<ProgressBar value={3} max={4} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByText('3/4')).toBeInTheDocument();
  });

  it('kommt mit max=0 zurecht, ohne durch null zu teilen', () => {
    render(<ProgressBar value={0} max={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('zeigt den ersten Tab und wechselt auf Klick', async () => {
    function Harness() {
      const [value, setValue] = useState('a');
      return (
        <Tabs
          value={value}
          onValueChange={setValue}
          tabs={[
            { value: 'a', label: 'Offene Termine', count: 16, content: <p>Inhalt A</p> },
            { value: 'b', label: 'Beendete Termine', count: 0, content: <p>Inhalt B</p> },
          ]}
        />
      );
    }
    render(<Harness />);

    expect(screen.getByText('Inhalt A')).toBeInTheDocument();
    expect(screen.getByText('(16)')).toBeInTheDocument();

    // userEvent statt fireEvent.click: Radix aktiviert den Tab auf mousedown, und nur
    // userEvent bildet die vollstaendige Ereignisfolge eines echten Klicks ab.
    await userEvent.click(screen.getByRole('tab', { name: /Beendete Termine/ }));

    expect(screen.getByText('Inhalt B')).toBeInTheDocument();
    expect(screen.queryByText('Inhalt A')).toBeNull();
  });
});
