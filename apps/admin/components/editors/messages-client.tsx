'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MailOpen, Trash2, Check, Phone, Clock, CheckCheck, Inbox } from 'lucide-react';
import type { ContactMessage } from '@nexuva/types';
import { setMessageRead, deleteMessage, markAllMessagesRead } from '../../app/actions';
import { ConfirmDialog, EmptyState, useToast } from '../ui';

export function MessagesClient({
  messages,
  total,
  unread,
}: {
  messages: ContactMessage[];
  /** Enquiries in the database, which may exceed what this page holds. */
  total: number;
  /** Counted by the database, not derived from the rows on screen. */
  unread: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ContactMessage | null>(null);

  /**
   * Runs a server action and says what happened.
   *
   * This used to await and refresh without looking at the result, so an action
   * that failed left the screen unchanged and silent — indistinguishable from
   * one that had nothing to do.
   */
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, failure: string) =>
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          toast.error(result.error?.trim() || failure);
          return;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : failure);
        return;
      }
      router.refresh();
    });

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-fg">Mesajlar</h1>
          <p className="mt-0.5 text-sm text-muted">
            {total} mesaj · {unread} okunmamış
            {messages.length < total && ` · en yeni ${messages.length} tanesi gösteriliyor`}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => act(() => markAllMessagesRead(), 'İşaretlenemedi.')}
            disabled={pending}
            className="btn-ghost"
          >
            <CheckCheck className="h-4 w-4" /> Tümünü okundu işaretle
          </button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Henüz mesaj yok"
            hint="İletişim formundan gelen talepler burada listelenir."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const open = openId === m.id;
            return (
              <div
                key={m.id}
                className={`panel overflow-hidden transition-colors ${!m.read ? 'border-brand-500/30' : ''}`}
              >
                <div className="flex items-start gap-4 p-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      m.read ? 'bg-overlay/5 text-muted' : 'brand-gradient-bg text-white'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>

                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : m.id)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-fg">{m.name}</span>
                      {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted">
                      {m.subject || '(konu yok)'}
                    </div>
                    {!open && (
                      <div className="mt-1 truncate text-xs text-faint">{m.message}</div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-faint">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {m.email}
                      </span>
                      {m.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {m.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmt(m.createdAt)}
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      title={m.read ? 'Okunmadı işaretle' : 'Okundu işaretle'}
                      onClick={() =>
                        act(() => setMessageRead(m.id, !m.read), 'İşaretlenemedi.')
                      }
                      disabled={pending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-overlay/10 bg-overlay/5 text-muted hover:text-fg"
                    >
                      {m.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                    </button>
                    <button
                      title="Sil"
                      aria-label={`${m.name} adlı kişinin mesajını sil`}
                      // Asked for, not done on the click. This deleted a
                      // customer enquiry outright, with no way back.
                      onClick={() => setConfirming(m)}
                      disabled={pending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-overlay/10 bg-overlay/[0.02] p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{m.message}</p>
                    <div className="mt-4 flex gap-2">
                      <a href={`mailto:${m.email}`} className="btn-primary !py-2 text-xs">
                        <Check className="h-3.5 w-3.5" /> Yanıtla
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Mesajı sil"
        body={
          confirming && (
            <>
              <strong className="text-fg">{confirming.name}</strong> adlı kişiden gelen mesaj
              silinecek. Bu talep bir müşteri isteği olabilir; silmeden önce yanıtladığından emin ol.
            </>
          )
        }
        busy={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const target = confirming;
          setConfirming(null);
          if (target) act(() => deleteMessage(target.id), 'Mesaj silinemedi.');
        }}
      />
    </div>
  );
}
