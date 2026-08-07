'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MousePointerClick,
  Monitor,
  Smartphone,
  Loader2,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  PencilLine,
} from 'lucide-react';
import type { SiteContent } from '@nexuva/types';
import { saveAtPath } from '../app/actions';

type Localized = { tr: string; en: string };
type LeafValue = Localized | string | number;

const PAGES = [
  { label: 'Anasayfa', path: '' },
  { label: 'Hizmetler', path: '/services' },
  { label: 'Hakkımızda', path: '/about' },
  { label: 'Referanslar', path: '/references' },
  { label: 'İletişim', path: '/contact' },
];

/** Maps a content root key to the dedicated admin editor page. */
const ROOT_TO_EDITOR: Record<string, string> = {
  brand: '/brand',
  nav: '/navigation',
  logos: '/navigation',
  footer: '/navigation',
  hero: '/hero',
  cta: '/hero',
  servicesMeta: '/services',
  services: '/services',
  stats: '/stats',
  about: '/about',
  referencesMeta: '/references',
  references: '/references',
  testimonialsMeta: '/testimonials',
  testimonials: '/testimonials',
  processMeta: '/process',
  process: '/process',
  contact: '/contact',
};

/** Human labels for path segments shown in the drawer. */
const PATH_LABELS: Record<string, string> = {
  brand: 'Marka', nav: 'Menü', hero: 'Hero', logos: 'Logo Şeridi',
  servicesMeta: 'Hizmetler Başlığı', services: 'Hizmetler', stats: 'İstatistikler',
  about: 'Hakkımızda', referencesMeta: 'Referanslar Başlığı', references: 'Referanslar',
  testimonialsMeta: 'Görüşler Başlığı', testimonials: 'Görüşler', processMeta: 'Süreç Başlığı',
  process: 'Süreç', cta: 'Çağrı Bandı', contact: 'İletişim', footer: 'Footer',
  badge: 'Rozet', title: 'Başlık', subtitle: 'Alt Metin', titleLead: 'Başlık (1. satır)',
  titleHighlight: 'Başlık (vurgulu)', description: 'Açıklama', label: 'Etiket',
  quote: 'Alıntı', author: 'Kişi', role: 'Ünvan', company: 'Şirket', name: 'Ad',
  category: 'Kategori', value: 'Değer', text: 'Metin', paragraphs: 'Paragraf',
  features: 'Özellik', highlights: 'Öne Çıkan', metrics: 'Metrik', email: 'E-posta',
  phone: 'Telefon', address: 'Adres', about_: 'Hakkında',
};

function resolvePath(content: SiteContent, path: string): LeafValue | undefined {
  let cur: unknown = content;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (
    typeof cur === 'string' ||
    typeof cur === 'number' ||
    (cur != null &&
      typeof cur === 'object' &&
      typeof (cur as Localized).tr === 'string' &&
      typeof (cur as Localized).en === 'string')
  ) {
    return cur as LeafValue;
  }
  return undefined;
}

function pathTitle(path: string): string {
  return path
    .split('.')
    .map((seg) => (/^\d+$/.test(seg) ? `#${Number(seg) + 1}` : (PATH_LABELS[seg] ?? seg)))
    .join(' → ');
}

export function VisualEditor({
  content: initialContent,
  siteUrl,
}: {
  content: SiteContent;
  siteUrl: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [page, setPage] = useState('');
  const [locale, setLocale] = useState<'tr' | 'en'>('tr');
  const [mobile, setMobile] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<LeafValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const iframeSrc = useMemo(
    () => `${siteUrl}/${locale}${page}?edit=1&v=${version}`,
    [siteUrl, locale, page, version],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; path?: string } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'nexuva:ready') setFrameReady(true);
      if (data.type === 'nexuva:edit' && typeof data.path === 'string') {
        const value = resolvePath(content, data.path);
        if (value !== undefined) {
          setSelected(data.path);
          setDraft(typeof value === 'object' ? { ...value } : value);
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [content]);

  const applyLocal = useCallback((path: string, value: LeafValue) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as SiteContent;
      const segs = path.split('.');
      let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < segs.length - 1; i++) {
        cur = cur[segs[i] as string] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1] as string] = value;
      return next;
    });
  }, []);

  async function onSave() {
    if (!selected || draft == null) return;
    setSaving(true);
    const res = await saveAtPath(selected, draft);
    setSaving(false);
    if (res.ok) {
      applyLocal(selected, draft);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      setSelected(null);
      setFrameReady(false);
      setVersion((v) => v + 1); // reload iframe with fresh content
      router.refresh();
    }
  }

  const rootKey = selected?.split('.')[0] ?? '';
  const editorHref = ROOT_TO_EDITOR[rootKey];

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[34rem] flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-fg">
            <MousePointerClick className="h-5 w-5 text-brand-dyn" />
            Canlı Düzenleme
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Sitede düzenlemek istediğin yazıya tıkla, sağda düzenle, kaydet.
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={page}
            onChange={(e) => { setPage(e.target.value); setFrameReady(false); }}
            className="field-input !w-auto"
          >
            {PAGES.map((p) => (
              <option key={p.path} value={p.path} className="bg-card">{p.label}</option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-xl border border-overlay/10">
            {(['tr', 'en'] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => { setLocale(loc); setFrameReady(false); }}
                className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${
                  locale === loc ? 'brand-gradient-bg text-white' : 'bg-overlay/5 text-muted hover:text-fg'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          <div className="flex overflow-hidden rounded-xl border border-overlay/10">
            <button
              onClick={() => setMobile(false)}
              title="Masaüstü"
              className={`px-3 py-2 ${!mobile ? 'bg-overlay/10 text-fg' : 'bg-overlay/5 text-muted'}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobile(true)}
              title="Mobil"
              className={`px-3 py-2 ${mobile ? 'bg-overlay/10 text-fg' : 'bg-overlay/5 text-muted'}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => { setFrameReady(false); setVersion((v) => v + 1); }}
            title="Yenile"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-overlay/10 bg-overlay/5 text-muted hover:text-fg"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <a
            href={`${siteUrl}/${locale}${page}`}
            target="_blank"
            rel="noreferrer"
            title="Yeni sekmede aç"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-overlay/10 bg-overlay/5 text-muted hover:text-fg"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {savedFlash && (
            <span className="flex items-center gap-1.5 rounded-xl bg-green-500/15 px-3 py-2 text-xs font-semibold text-green-300">
              <Check className="h-3.5 w-3.5" /> Kaydedildi
            </span>
          )}
        </div>
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Site preview */}
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-overlay/10 bg-white">
          {!frameReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-page/60">
              <Loader2 className="h-6 w-6 animate-spin text-brand-dyn" />
            </div>
          )}
          <div className={`h-full ${mobile ? 'mx-auto w-full max-w-[390px] border-x border-overlay/10' : 'w-full'}`}>
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title="Site önizleme"
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Edit drawer */}
        <aside
          className={`panel w-full shrink-0 overflow-y-auto p-5 transition-opacity lg:w-96 ${
            selected ? 'opacity-100' : 'opacity-70'
          }`}
        >
          {!selected || draft == null ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-overlay/5">
                <MousePointerClick className="h-7 w-7 text-brand-dyn" />
              </div>
              <p className="max-w-[16rem] text-sm text-muted">
                Soldaki önizlemede kesikli çerçeveli herhangi bir yazıya tıkla —
                burada düzenleyip anında kaydet.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-brand-dyn">
                    Seçili alan
                  </p>
                  <h2 className="mt-1 font-heading text-sm font-semibold text-fg">
                    {pathTitle(selected)}
                  </h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-overlay/10 bg-overlay/5 text-muted hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {typeof draft === 'object' ? (
                  (['tr', 'en'] as const).map((loc) => (
                    <div key={loc}>
                      <label className="field-label">{loc === 'tr' ? 'Türkçe' : 'English'}</label>
                      <textarea
                        value={(draft as Localized)[loc]}
                        rows={Math.min(8, Math.max(2, Math.ceil(((draft as Localized)[loc]?.length ?? 0) / 45)))}
                        onChange={(e) => setDraft({ ...(draft as Localized), [loc]: e.target.value })}
                        className="field-input resize-none"
                      />
                    </div>
                  ))
                ) : typeof draft === 'number' ? (
                  <div>
                    <label className="field-label">Değer</label>
                    <input
                      type="number"
                      value={draft}
                      onChange={(e) => setDraft(Number(e.target.value))}
                      className="field-input"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="field-label">Metin</label>
                    <textarea
                      value={draft}
                      rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 45)))}
                      onChange={(e) => setDraft(e.target.value)}
                      className="field-input resize-none"
                    />
                  </div>
                )}

                <button onClick={onSave} disabled={saving} className="btn-primary w-full">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Kaydet
                    </>
                  )}
                </button>

                {editorHref && (
                  <a
                    href={editorHref}
                    className="flex items-center justify-center gap-2 rounded-xl border border-overlay/10 bg-overlay/5 px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Bu bölümün tüm ayarları (ekle/sil/sırala)
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
