'use client';

import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useToast } from '@nexuva/ui';

/**
 * Reordering and safe deletion for the panel's content lists.
 *
 * Every editor could add, every editor could delete, and no editor could put a
 * row anywhere but at the end — so the order of services on the website was
 * whatever order they happened to be typed in, permanently. This is the piece
 * that was missing, in one place, because ten lists needed the same thing.
 *
 * Drag and drop is the browser's own, matching the CRM board. A library would
 * be nicer to write against and is not worth a dependency for a list of six.
 * The handle is a real button as well as a drag source: dragging is unavailable
 * with a keyboard, and "move this up" must not require a mouse.
 */

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

/** Drag state shared by the rows of one list. */
export function useSortable<T>(list: T[], onChange: (next: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function rowProps(index: number) {
    return {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        setOver(index);
      },
      onDragLeave: () => setOver((current) => (current === index ? null : current)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        setOver(null);
        setDragging(null);
        if (Number.isInteger(from)) onChange(move(list, from, index));
      },
      // The row itself is not draggable — only the handle is, so that text in
      // the row stays selectable.
      className: over === index && dragging !== index ? 'ring-2 ring-brand-400/60' : '',
    };
  }

  function handleProps(index: number) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
        setDragging(index);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    };
  }

  return { rowProps, handleProps, dragging, moveUp: (i: number) => onChange(move(list, i, i - 1)), moveDown: (i: number) => onChange(move(list, i, i + 1)) };
}

/**
 * The grip. Draggable with a mouse, and a pair of arrows for everyone else.
 */
export function DragHandle({
  index,
  count,
  handleProps,
  onMoveUp,
  onMoveDown,
  label,
}: {
  index: number;
  count: number;
  handleProps: Record<string, unknown>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Named in the button's label so a screen reader says what is moving. */
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <span
        {...handleProps}
        title="Sürükleyerek sırala"
        className="cursor-grab text-faint transition-colors hover:text-fg active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`${label} yukarı taşı`}
          className="text-faint hover:text-fg disabled:opacity-25"
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === count - 1}
          aria-label={`${label} aşağı taşı`}
          className="text-faint hover:text-fg disabled:opacity-25"
        >
          <ChevronDownIcon />
        </button>
      </span>
    </div>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
      <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Removes one row and offers it back.
 *
 * The editors hold their list in local state and persist on save, so an undo is
 * genuinely free — putting the row back where it was costs one array splice.
 * Before this, a mis-click deleted a service and the only recovery was to
 * leave without saving and lose the rest of the session's work too.
 */
export function useRemoveWithUndo<T>(setList: Dispatch<SetStateAction<T[]>>) {
  const toast = useToast();

  return function remove(index: number, item: T, describe: string) {
    setList((current) => current.filter((_, i) => i !== index));
    // Both halves go through the updater form rather than closing over the list
    // as it was. Ten seconds is long enough to edit something else first, and
    // an undo that also reverted that edit would be a worse surprise than the
    // deletion it was meant to fix.
    toast.undo(`${describe} silindi.`, () => {
      setList((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
    });
  };
}

/**
 * A state setter for one field of a larger object.
 *
 * Several editors hold a whole section in one piece of state — About owns its
 * paragraphs and its highlights, Navigation owns the menu, the logo strip and
 * every footer column. The sorting and undo helpers want a setter for the list
 * itself, and this makes one without the caller flattening its state.
 *
 * Written in the updater form throughout, so two edits in the same tick, or an
 * undo taken ten seconds later, both see the current object rather than the one
 * captured when the handler was created.
 */
export function fieldSetter<O, K extends keyof O>(
  setOwner: Dispatch<SetStateAction<O>>,
  key: K,
): Dispatch<SetStateAction<O[K]>> {
  return (updater) =>
    setOwner((owner) => ({
      ...owner,
      [key]:
        typeof updater === 'function'
          ? (updater as (current: O[K]) => O[K])(owner[key])
          : updater,
    }));
}

/** A delete button that reads the same everywhere. */
export function DeleteButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
    >
      {children ?? <Trash2 className="h-4 w-4" />}
    </button>
  );
}
