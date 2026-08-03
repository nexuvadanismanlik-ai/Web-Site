'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MailOpen, Trash2, Check, Phone, Clock, CheckCheck, Inbox } from 'lucide-react';
import type { ContactMessage } from '@nexuva/types';
import { setMessageRead, deleteMessage, markAllMessagesRead } from '../../app/actions';

export function MessagesClient({ messages }: { messages: ContactMessage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const unread = messages.filter((m) => !m.read).length;

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
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
          <h1 className="font-heading text-2xl font-bold text-white">Mesajlar</h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {messages.length} mesaj · {unread} okunmamış
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => act(() => markAllMessagesRead())}
            disabled={pending}
            className="btn-ghost"
          >
            <CheckCheck className="h-4 w-4" /> Tümünü okundu işaretle
          </button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-ink-400">
            <Inbox className="h-7 w-7" />
          </div>
          <p className="text-ink-400">Henüz mesaj yok. İletişim formundan gelen mesajlar burada listelenir.</p>
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
                      m.read ? 'bg-white/5 text-ink-300' : 'brand-gradient-bg text-white'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>

                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : m.id)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-white">{m.name}</span>
                      {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-ink-300">
                      {m.subject || '(konu yok)'}
                    </div>
                    {!open && (
                      <div className="mt-1 truncate text-xs text-ink-500">{m.message}</div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-500">
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
                      onClick={() => act(() => setMessageRead(m.id, !m.read))}
                      disabled={pending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ink-300 hover:text-white"
                    >
                      {m.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                    </button>
                    <button
                      title="Sil"
                      onClick={() => act(() => deleteMessage(m.id))}
                      disabled={pending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-white/10 bg-white/[0.02] p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{m.message}</p>
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
    </div>
  );
}
