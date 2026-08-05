'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { EmptyState, useToast } from '@nexuva/ui';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../app/actions';
import { adminPath } from '../lib/routes';
import type { AppNotification } from '../lib/model';

function shortWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

/**
 * What happened while nobody was looking.
 *
 * Loads on open rather than on every page render: a badge that is a few minutes
 * stale costs nothing, and polling the API from a panel that already wakes a
 * sleeping instance on each navigation does.
 */
export function NotificationCenter({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let alive = true;
    void getNotifications(unreadOnly).then((result) => {
      if (!alive) return;
      setItems(result);
      setUnread(result.filter((n) => !n.isRead).length);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [open, unreadOnly]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function readOne(item: AppNotification) {
    if (item.isRead) return;
    startTransition(async () => {
      const result = await markNotificationRead(item.id);
      if (!result.ok) {
        toast.error(result.error ?? 'İşaretlenemedi.');
        return;
      }
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
    });
  }

  function readAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        toast.error(result.error ?? 'İşaretlenemedi.');
        return;
      }
      setItems((current) => current.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    });
  }

  return (
    <div className="relative" ref={panel}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-overlay/10 bg-overlay/5 text-muted transition-colors hover:text-fg"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient-bg px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="ui-panel absolute right-0 top-11 z-50 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-overlay/10 px-4 py-3">
            <span className="text-sm font-semibold text-fg">Bildirimler</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnreadOnly((v) => !v)}
                className={`text-xs ${unreadOnly ? 'text-brand-dyn' : 'text-faint hover:text-fg'}`}
              >
                {unreadOnly ? 'Tümü' : 'Okunmamış'}
              </button>
              {unread > 0 && (
                <button
                  onClick={readAll}
                  disabled={pending}
                  aria-label="Tümünü okundu işaretle"
                  className="text-faint hover:text-fg disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-faint">Yükleniyor...</p>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title={unreadOnly ? 'Okunmamış bildirim yok' : 'Bildirim yok'}
                hint="Yeni talep, atama ve durum değişiklikleri burada görünür."
              />
            ) : (
              <ul className="divide-y divide-overlay/5">
                {items.map((item) => {
                  const leadId = item.metadata?.leadId;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          readOne(item);
                          if (leadId) {
                            setOpen(false);
                            router.push(adminPath('/crm'));
                          }
                        }}
                        className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-overlay/[0.04] ${
                          item.isRead ? '' : 'bg-overlay/[0.03]'
                        }`}
                      >
                        {item.isRead ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                        ) : (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-fg">{item.title}</span>
                          {item.body && (
                            <span className="mt-0.5 block text-xs text-muted">{item.body}</span>
                          )}
                          <span className="mt-1 block text-[11px] text-faint">
                            {shortWhen(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
