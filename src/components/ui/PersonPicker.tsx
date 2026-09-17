import MultiSelect, { type MultiSelectOption } from './MultiSelect';

export interface Person {
  id: string;
  name: string;
  /** Zweite Zeile, z. B. „1.2 · 1540 QTTR". */
  detail?: string;
}

export interface PersonPickerProps {
  id?: string;
  people: Person[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}

/**
 * Personenauswahl. Dünne Hülle um MultiSelect, damit Aufrufer mit Mitgliedern statt mit
 * generischen Optionen arbeiten und die Darstellung überall gleich bleibt.
 */
export default function PersonPicker({
  id,
  people,
  value,
  onChange,
  placeholder = 'Mitglieder auswählen',
  max,
  disabled,
}: PersonPickerProps) {
  const options: MultiSelectOption[] = people.map((person) => ({
    value: person.id,
    label: person.name,
    sublabel: person.detail,
  }));

  return (
    <MultiSelect
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      max={max}
      disabled={disabled}
    />
  );
}
