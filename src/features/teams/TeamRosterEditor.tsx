import { X } from 'lucide-react';
import { FormField, IconButton, PersonPicker, SortableList } from '../../components/ui';
import type { Member } from '../members/api';

export interface TeamRosterEditorProps {
  members: Member[];
  size: number;
  regularIds: string[];
  substituteIds: string[];
  onRegularsChange: (ids: string[]) => void;
  onSubstitutesChange: (ids: string[]) => void;
  regularError?: string;
  substituteError?: string;
}

/**
 * Stammspieler und Ersatzspieler einer Mannschaft.
 *
 * Der Unterschied in der Bedienung ist Absicht: Stammspieler sind eine Menge, ihre
 * Reihenfolge ergibt sich aus den Rängen. Ersatzspieler sind eine Reihenfolge — sie
 * bestimmt, wer bei einer Absage zuerst gefragt wird. Deshalb dort eine sortierbare
 * Liste statt einer Mehrfachauswahl.
 */
export default function TeamRosterEditor({
  members,
  size,
  regularIds,
  substituteIds,
  onRegularsChange,
  onSubstitutesChange,
  regularError,
  substituteError,
}: TeamRosterEditorProps) {
  const people = members.map((member) => ({
    id: member.id,
    name: member.full_name ?? '',
    detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
  }));

  const byId = new Map(members.map((member) => [member.id, member]));

  // Wer schon Stammspieler ist, steht nicht mehr zur Auswahl als Ersatz — und umgekehrt.
  const freeForSubstitutes = people.filter((person) => !regularIds.includes(person.id));
  const freeForRegulars = people.filter((person) => !substituteIds.includes(person.id));

  return (
    <div className="space-y-4">
      <FormField
        label="Stammspieler"
        hint={`Maximal ${size} Stammspieler.`}
        error={regularError}
      >
        {(p) => (
          <PersonPicker
            {...p}
            people={freeForRegulars}
            value={regularIds}
            onChange={onRegularsChange}
            max={size}
            placeholder="Spieler auswählen"
          />
        )}
      </FormField>

      <FormField
        label="Ersatzspieler"
        hint="Reihenfolge entspricht der Priorität für Ersatzanfragen. Die Reihenfolge kann per Drag & Drop geändert werden."
        error={substituteError}
      >
        {(p) => (
          <PersonPicker
            {...p}
            people={freeForSubstitutes}
            value={substituteIds}
            onChange={onSubstitutesChange}
            placeholder="Ersatzspieler auswählen"
          />
        )}
      </FormField>

      {substituteIds.length > 1 && (
        <SortableList
          numbered
          items={substituteIds.map((id) => ({
            id,
            content: (
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-gray-900">
                  {byId.get(id)?.full_name ?? 'Unbekannt'}
                </span>
                <IconButton
                  icon={X}
                  label={`${byId.get(id)?.full_name ?? 'Spieler'} aus der Ersatzliste entfernen`}
                  onClick={() => onSubstitutesChange(substituteIds.filter((other) => other !== id))}
                />
              </div>
            ),
          }))}
          onReorder={onSubstitutesChange}
        />
      )}
    </div>
  );
}
