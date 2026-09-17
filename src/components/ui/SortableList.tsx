import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SortableItem {
  id: string;
  content: ReactNode;
}

export interface SortableListProps {
  items: SortableItem[];
  onReorder: (ids: string[]) => void;
  /** Zeigt die Position als Zahl vor jedem Eintrag — die Reihenfolge ist hier die Aussage. */
  numbered?: boolean;
  className?: string;
}

function Row({ item, index, numbered }: { item: SortableItem; index: number; numbered?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-2',
        isDragging && 'opacity-60 shadow-md',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Position ${index + 1} verschieben`}
        className="flex min-h-touch min-w-touch cursor-grab items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {numbered && (
        <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-gray-400">
          {index + 1}
        </span>
      )}

      <div className="min-w-0 flex-1">{item.content}</div>
    </li>
  );
}

/**
 * Liste mit Drag & Drop und Tastaturbedienung. Wird für die Ersatzspieler-Reihenfolge und
 * die Aufstellung gebraucht — dort ist die Reihenfolge fachlich bedeutsam, deshalb muss sie
 * auch ohne Maus änderbar sein.
 */
export default function SortableList({
  items,
  onReorder,
  numbered,
  className,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex).map((item) => item.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn('space-y-1.5', className)}>
          {items.map((item, index) => (
            <Row key={item.id} item={item} index={index} numbered={numbered} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
