'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';

/**
 * The panel's shared feedback surfaces: what it says while it works, what it
 * says when it finishes, and what it asks before it destroys something.
 *
 * These exist as a kit rather than per screen because every module still to be
 * built needs them, and the version each screen would otherwise invent would
 * differ in the ways that matter — whether a failure is announced at all,
 * whether a delete is confirmed, whether a busy state is distinguishable from a
 * broken one.
 */

// ─── Toast ──────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Offered inside the toast; dismisses it when taken. */
  action?: { label: string; run: () => void };
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
  /**
   * Announces something destructive and offers to take it back.
   *
   * A confirmation dialog asks before, an undo asks after. Deleting one row of
   * a list is the case where after is better: it costs nothing when the answer
   * is yes, which it almost always is, and still costs nothing when it is no.
   */
  undo(message: string, onUndo: () => void): void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Long enough to read a sentence; errors stay until dismissed. */
const TOAST_MS = 4000;
/** Long enough to notice the mistake and reach for the button. */
const UNDO_MS = 10000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback(
    (kind: ToastKind, message: string, action?: { label: string; run: () => void }) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, kind, message, ...(action ? { action } : {}) }]);
      // An error is the one thing a person may need to copy, re-read, or act on,
      // so it does not disappear on its own. An undo lingers too — four seconds
      // is not long enough to notice a mistake, read the message and decide.
      if (kind !== 'error' && !action) {
        setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), TOAST_MS);
      }
      if (action) {
        setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), UNDO_MS);
      }
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      undo: (m, onUndo) => push('info', m, { label: 'Geri al', run: onUndo }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((c) => c.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const TOAST_STYLE: Record<ToastKind, { border: string; icon: ReactNode }> = {
  success: {
    border: 'border-green-500/30 bg-green-500/10 text-green-600',
    icon: <Check className="h-4 w-4 shrink-0" />,
  },
  error: {
    border: 'border-red-500/30 bg-red-500/10 text-red-500',
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  info: {
    border: 'border-overlay/20 bg-card text-fg',
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = TOAST_STYLE[toast.kind];
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm shadow-lg ${style.border}`}
    >
      {style.icon}
      <span className="flex-1 break-words">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.run();
            onDismiss();
          }}
          className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Kapat" className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

/**
 * What a list shows when it has nothing in it.
 *
 * Always says what would put something there, because "no records" alone leaves
 * someone unsure whether the screen is broken, filtered, or simply new.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-overlay/5 text-muted">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

/**
 * A placeholder with the shape of the thing being loaded.
 *
 * The API suspends when idle, so a first page load can take a minute; a blank
 * screen for that long is indistinguishable from a broken one.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-overlay/10 ${className}`}
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Yükleniyor">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────

/**
 * Asks before something irreversible.
 *
 * Deliberately modal and deliberately naming the thing: a confirm that says
 * "Are you sure?" is answered yes reflexively, and a delete confirmed by reflex
 * is a delete that was not confirmed.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Escape closes; a dialog that traps someone is worse than no dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
    >
      <div className="ui-panel w-full max-w-md p-6">
        <h2 className="font-heading text-lg font-semibold text-fg">{title}</h2>
        {body && <div className="mt-2 text-sm text-muted">{body}</div>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} disabled={busy} className="ui-button">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 ${
              destructive
                ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                : 'ui-button-primary'
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
