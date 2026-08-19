'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { adminPath } from '../lib/routes';

/**
 * Go anywhere by typing.
 *
 * Twenty-two screens is past the point where a sidebar is the fastest way to
 * reach one. Somebody who knows they want the mail templates should not have to
 * find "Mail" in a list, click it, and then find the tab — they should type
 * three letters and press enter. This is the single thing that most separates a
 * tool people use all day from one they click around.
 *
 * Opens on Ctrl/Cmd-K, and on "/" when the focus is not already in a field —
 * that shortcut is free in a panel with no global text entry, and it is the one
 * people try first.
 */

interface Entry {
  label: string;
  href: string;
  /** Where it lives, shown on the right so two similar names stay distinct. */
  group: string;
  /** Extra words that should find this entry without cluttering the label. */
  keywords?: string;
}

const ENTRIES: Entry[] = [
  { label: 'Genel Bakış', href: '/', group: 'Genel', keywords: 'dashboard anasayfa özet' },
  { label: 'Yayın Merkezi', href: '/publish', group: 'Genel', keywords: 'publish deploy sürüm versiyon geri al' },
  { label: 'Medya Kütüphanesi', href: '/media', group: 'Genel', keywords: 'görsel resim dosya upload yükle logo' },

  { label: 'Marka & Tema', href: '/brand', group: 'İçerik', keywords: 'logo renk favicon site adı' },
  { label: 'Hero', href: '/hero', group: 'İçerik', keywords: 'başlık ana ekran cta' },
  { label: 'Hizmetler', href: '/services', group: 'İçerik', keywords: 'servis hizmet kart' },
  { label: 'İstatistikler', href: '/stats', group: 'İçerik', keywords: 'sayı rakam metrik' },
  { label: 'Referanslar', href: '/references', group: 'İçerik', keywords: 'müşteri firma logo case' },
  { label: 'Görüşler', href: '/testimonials', group: 'İçerik', keywords: 'yorum testimonial müşteri' },
  { label: 'Süreç', href: '/process', group: 'İçerik', keywords: 'adım aşama nasıl çalışıyoruz' },
  { label: 'Hakkımızda', href: '/about', group: 'İçerik', keywords: 'about şirket biz' },
  { label: 'İletişim Bilgileri', href: '/contact', group: 'İçerik', keywords: 'telefon adres eposta' },
  { label: 'Menü & Footer', href: '/navigation', group: 'İçerik', keywords: 'header navigasyon alt bilgi link' },
  { label: 'Site Metinleri', href: '/texts', group: 'İçerik', keywords: 'buton etiket arayüz ui text' },
  { label: 'Canlı Düzenleme', href: '/visual', group: 'İçerik', keywords: 'visual editör önizleme tıkla düzenle' },

  { label: 'Talepler', href: '/crm', group: 'İş', keywords: 'crm lead pipeline başvuru müşteri' },
  { label: 'Mesajlar', href: '/messages', group: 'İş', keywords: 'form gelen kutusu inbox' },
  { label: 'Ziyaretçiler', href: '/analytics', group: 'İş', keywords: 'analytics trafik kampanya dönüşüm istatistik' },

  { label: 'SEO', href: '/seo', group: 'Sistem', keywords: 'title description og robots sitemap arama' },
  { label: 'Mail', href: '/mail', group: 'Sistem', keywords: 'eposta smtp resend şablon template log' },
  { label: 'Entegrasyonlar', href: '/integrations', group: 'Sistem', keywords: 'google meta pixel ga4 ads tag' },
  { label: 'Bağlantılar', href: '/links', group: 'Sistem', keywords: 'link url logiops giris login basvuru uyelik yonlendirme adres' },
  { label: 'Sistem & Bağlantılar', href: '/system', group: 'Sistem', keywords: 'durum health ssl dns domain veritabanı' },
  { label: 'Ayarlar', href: '/settings', group: 'Sistem', keywords: 'şifre hesap parola' },
];

/**
 * Turkish-aware, accent-forgiving match.
 *
 * Somebody typing "gorusler" on a keyboard they have not switched, or "ISTATISTIK"
 * in caps, means the same screen. A search that only matches exact Turkish
 * characters is a search that fails the moment somebody is in a hurry.
 */
function normalise(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = normalise(query.trim());
    if (!needle) return ENTRIES;
    return ENTRIES.filter((entry) =>
      normalise(`${entry.label} ${entry.group} ${entry.keywords ?? ''}`).includes(needle),
    );
  }, [query]);

  // Open/close shortcuts, bound at the document so they work from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" is only a shortcut when it is not a character somebody is typing.
      if (event.key === '/' && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCursor(0);
      return;
    }
    // Focus after paint, or the browser puts the caret nowhere.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    router.push(adminPath(entry.href));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(results[cursor]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Ara ve git"
    >
      <button
        aria-label="Kapat"
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="chrome relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center gap-3 border-b border-overlay/10 px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ekran ara — hizmet, mail, kampanya…"
            className="w-full bg-transparent py-4 text-sm text-fg outline-none placeholder:text-faint"
          />
          <kbd className="hidden shrink-0 rounded border border-overlay/15 px-1.5 py-0.5 text-[10px] text-faint sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-faint">Eşleşen ekran yok.</p>
          ) : (
            results.map((entry, index) => (
              <button
                key={entry.href}
                onClick={() => go(entry)}
                onMouseEnter={() => setCursor(index)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  index === cursor ? 'bg-overlay/10 text-fg' : 'text-muted'
                }`}
              >
                <span className="min-w-0 truncate font-medium">{entry.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-faint">{entry.group}</span>
                  {index === cursor && <CornerDownLeft className="h-3.5 w-3.5 text-faint" />}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** The bar in the header that opens the palette. */
export function CommandTrigger() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <button
      onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
      className="flex items-center gap-2 rounded-xl border border-overlay/10 bg-overlay/[0.04] px-3 py-2 text-sm text-faint transition-colors hover:border-overlay/20 hover:text-muted"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Ara…</span>
      <kbd className="ml-2 hidden rounded border border-overlay/15 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        {mac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  );
}
