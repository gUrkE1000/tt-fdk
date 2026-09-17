import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  /** Aufgabe aus docs/umsetzungsplan.md, die diese Seite baut. */
  task: string;
}

/**
 * Platzhalter für Routen, deren Aufgabe im Umsetzungsplan noch offen ist.
 * Nennt bewusst die Aufgabennummer, damit beim Durchklicken sofort klar ist,
 * was hier noch kommt und wo es im Plan steht.
 */
export default function Placeholder({ title, task }: PlaceholderProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <Construction className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Diese Seite entsteht in Aufgabe <span className="font-semibold text-gray-700">{task}</span>{' '}
        des Umsetzungsplans.
      </p>
    </div>
  );
}
