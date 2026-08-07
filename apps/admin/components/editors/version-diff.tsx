'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Loader2, Minus, PenLine, Plus } from 'lucide-react';
import { getDiff } from '../../app/actions';
import type { ContentDiff } from '../../lib/model';

/**
 * What one version changed.
 *
 * Loaded on demand rather than with the history: comparing two full site
 * documents is real work, and a history screen that does it for twenty
 * versions on every open would be slow for a question nobody asked.
 */
export function VersionDiff({ from, to }: { from: number; to?: number }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<ContentDiff | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (diff || pending) return;

    startTransition(async () => {
      const result = await getDiff(from, to);
      if (result) setDiff(result);
      else setFailed(true);
    });
  }

  return (
    <div className="w-full">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        Ne değişti?
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-overlay/10 bg-overlay/[0.02] p-3">
          {pending && (
            <p className="flex items-center gap-2 text-xs text-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Karşılaştırılıyor…
            </p>
          )}

          {failed && (
            <p className="text-xs text-faint">Karşılaştırma alınamadı.</p>
          )}

          {diff && diff.changes.length === 0 && (
            <p className="text-xs text-faint">
              {to === undefined
                ? 'Bu sürümden bu yana bir değişiklik yok — yayınlanacak bir şey yok.'
                : 'İki sürüm arasında bir fark yok.'}
            </p>
          )}

          {diff && diff.changes.length > 0 && (
            <>
              <ul className="space-y-2">
                {diff.changes.map((change, index) => (
                  <li key={`${change.path.join('.')}-${index}`} className="text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-fg">
                      {change.kind === 'added' && (
                        <Plus className="h-3 w-3 shrink-0 text-green-500" />
                      )}
                      {change.kind === 'removed' && (
                        <Minus className="h-3 w-3 shrink-0 text-red-500" />
                      )}
                      {change.kind === 'changed' && (
                        <PenLine className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                      <span className="min-w-0 break-words">{change.label}</span>
                    </div>

                    {/* Both sides, because "changed" on its own is not an answer
                        — the reason to read a diff before rolling back is to
                        see what you would be bringing back. */}
                    <div className="mt-0.5 space-y-0.5 pl-[18px] text-faint">
                      {change.before !== null && (
                        <div className="break-words line-through decoration-red-500/40">
                          {change.before}
                        </div>
                      )}
                      {change.after !== null && (
                        <div className="break-words text-muted">{change.after}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {diff.truncated && (
                <p className="mt-2.5 border-t border-overlay/10 pt-2 text-[11px] text-faint">
                  Toplam {diff.total} değişiklikten ilk {diff.changes.length} tanesi
                  gösteriliyor.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
