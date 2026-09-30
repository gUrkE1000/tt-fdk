import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FormField from '../../src/components/ui/FormField';
import Input from '../../src/components/ui/Input';
import Textarea from '../../src/components/ui/Textarea';
import Select from '../../src/components/ui/Select';
import Checkbox from '../../src/components/ui/Checkbox';
import ColorInput, { TEAM_COLORS } from '../../src/components/ui/ColorInput';
import MultiSelect from '../../src/components/ui/MultiSelect';
import PersonPicker from '../../src/components/ui/PersonPicker';
import DateInput from '../../src/components/ui/DateInput';
import TimeInput from '../../src/components/ui/TimeInput';

describe('FormField', () => {
  it('verbindet Beschriftung und Eingabefeld', () => {
    render(<FormField label="Name">{(p) => <Input {...p} />}</FormField>);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('zeigt den Hilfetext und verweist darauf', () => {
    render(
      <FormField label="Name" hint="Wie im Spielplan">
        {(p) => <Input {...p} />}
      </FormField>,
    );
    const input = screen.getByLabelText('Name');
    const hint = screen.getByText('Wie im Spielplan');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('markiert das Feld bei einem Fehler als ungültig und verdrängt den Hilfetext', () => {
    render(
      <FormField label="E-Mail" hint="Optional" error="Adresse ist vergeben">
        {(p) => <Input {...p} />}
      </FormField>,
    );
    const input = screen.getByLabelText('E-Mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Adresse ist vergeben')).toBeInTheDocument();
    expect(screen.queryByText('Optional')).toBeNull();
  });

  it('kennzeichnet Pflichtfelder', () => {
    render(<FormField label="Name" required>{(p) => <Input {...p} />}</FormField>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});

describe('Eingabefelder', () => {
  it('Input meldet Änderungen', () => {
    const onChange = vi.fn();
    render(<Input aria-label="Suche" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('Textarea rendert mit Zeilenanzahl', () => {
    render(<Textarea aria-label="Hinweis" rows={5} />);
    expect(screen.getByLabelText('Hinweis')).toHaveAttribute('rows', '5');
  });

  it('DateInput und TimeInput nutzen die nativen Typen', () => {
    render(
      <>
        <DateInput aria-label="Datum" />
        <TimeInput aria-label="Uhrzeit" />
      </>,
    );
    expect(screen.getByLabelText('Datum')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Uhrzeit')).toHaveAttribute('type', 'time');
  });

  it('Select zeigt Platzhalter und Optionen', () => {
    render(
      <Select
        aria-label="Rhythmus"
        placeholder="Bitte auswählen"
        defaultValue=""
        options={[
          { value: 'weekly', label: 'wöchentlich' },
          { value: 'monthly', label: 'monatlich' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Rhythmus');
    expect(within(select).getByText('Bitte auswählen')).toBeInTheDocument();
    expect(within(select).getByText('wöchentlich')).toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  it('schaltet um', () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <Checkbox checked={checked} onCheckedChange={setChecked} label="Kein Training an Feiertagen" />;
    }
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: /Feiertagen/ });
    expect(box).toHaveAttribute('data-state', 'unchecked');
    fireEvent.click(box);
    expect(box).toHaveAttribute('data-state', 'checked');
  });
});

describe('ColorInput', () => {
  it('wählt eine Farbe aus den Farbfeldern', () => {
    const onChange = vi.fn();
    render(<ColorInput value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Grün' }));
    expect(onChange).toHaveBeenCalledWith('#15803d');
  });

  it('markiert die gewählte Farbe', () => {
    render(<ColorInput value="#2563EB" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Blau' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Rot' })).toHaveAttribute('aria-checked', 'false');
  });

  it('lässt die Farbe entfernen', () => {
    const onChange = vi.fn();
    render(<ColorInput value="#15803d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keine Farbe' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('zeigt eine eigene Farbe außerhalb der Auswahl als gewählt an', () => {
    render(<ColorInput value="#0d9488" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Eigene Farbe' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });

  it('bietet ohne clearable kein „Keine Farbe" an', () => {
    render(<ColorInput value="#15803d" onChange={vi.fn()} clearable={false} />);
    expect(screen.queryByRole('button', { name: 'Keine Farbe' })).toBeNull();
  });

  it('hebt sich mit jeder Farbe deutlich vom weißen Hintergrund ab', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const color of TEAM_COLORS) {
      expect(1.05 / (luminance(color.value) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('MultiSelect', () => {
  const options = [
    { value: 'a', label: 'Bezirksklasse' },
    { value: 'b', label: 'Kreisliga' },
    { value: 'c', label: 'Kreisklasse A' },
  ];

  function Harness({ max, initial = [] as string[] }: { max?: number; initial?: string[] }) {
    const [value, setValue] = useState<string[]>(initial);
    return <MultiSelect options={options} value={value} onChange={setValue} max={max} />;
  }

  it('wählt aus und zeigt die Auswahl als Chip', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Bitte auswählen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kreisliga' }));
    expect(screen.getByLabelText('Kreisliga entfernen')).toBeInTheDocument();
  });

  it('entfernt eine Auswahl wieder über den Chip', () => {
    render(<Harness initial={['b']} />);
    fireEvent.click(screen.getByLabelText('Kreisliga entfernen'));
    expect(screen.queryByLabelText('Kreisliga entfernen')).toBeNull();
  });

  it('begrenzt die Auswahl und sagt das auch', () => {
    render(<Harness max={1} initial={['a']} />);
    // Genauer Name: der Chip daneben heisst "Bezirksklasse entfernen" und wuerde sonst
    // ebenfalls passen.
    fireEvent.click(screen.getByRole('button', { name: 'Bezirksklasse' }));
    expect(screen.getByText('Maximal 1 auswählbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kreisliga' })).toBeDisabled();
  });
});

describe('PersonPicker', () => {
  it('zeigt Namen mit Zusatzangabe', () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <PersonPicker
          people={[{ id: 'p1', name: 'Anna Beispiel', detail: '1.1 · 1620 QTTR' }]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Mitglieder auswählen/ }));
    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument();
    expect(screen.getByText('1.1 · 1620 QTTR')).toBeInTheDocument();
  });
});
