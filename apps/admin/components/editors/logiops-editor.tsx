'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import type { LogiOpsContent, LinkItem, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { adminPath } from '../../lib/routes';
import { EditorHeader, LocalizedField, Panel, TextField, useSaver } from '../fields';
import { ImageField, type PickableImage } from '@nexuva/ui';

/**
 * The LogiOps product page's panel-managed parts.
 *
 * This screen did not exist. The `logiops` section has been in the content
 * model since the page was built, and the only way to change any of it was the
 * click-to-edit overlay — which works, and which nobody finds when they are
 * looking for "the LogiOps page" in a sidebar.
 *
 * It deliberately exposes only the fields the page actually reads. The type
 * carries `problems`, `approach` and `flow` arrays that the page ignores: its
 * body copy is a set of careful claims about what the software does and does
 * not do today, and that line is not left to whoever edits a field next. A
 * panel offering boxes that change nothing is worse than one that omits them —
 * it teaches the operator that saving does not work.
 */
const EMPTY_LINK: LinkItem = { label: { tr: '', en: '' }, href: '' };

function localized(value: Localized | undefined): Localized {
  return value ?? { tr: '', en: '' };
}

export function LogiOpsEditor({
  initial,
  images,
}: {
  initial: Partial<LogiOpsContent>;
  images: PickableImage[];
}) {
  const [content, setContent] = useState<Partial<LogiOpsContent>>(initial ?? {});
  const { saving, saved, error, run } = useSaver();

  const set = <K extends keyof LogiOpsContent>(key: K, value: LogiOpsContent[K]) =>
    setContent((current) => ({ ...current, [key]: value }));

  const setCta = (key: 'primaryCta' | 'secondaryCta', patch: Partial<LinkItem>) =>
    setContent((current) => ({
      ...current,
      [key]: { ...EMPTY_LINK, ...(current[key] ?? {}), ...patch },
    }));

  const primary = { ...EMPTY_LINK, ...(content.primaryCta ?? {}) };
  const secondary = { ...EMPTY_LINK, ...(content.secondaryCta ?? {}) };

  return (
    <div className="mx-auto max-w-3xl">
      <EditorHeader
        title="LogiOps Sayfası"
        subtitle="Ürün sayfasının başlığı, butonları ve kapanışı"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('logiops', content as never))}
      />

      <div className="space-y-6">
        <p className="flex items-start gap-2 rounded-xl border border-overlay/15 bg-overlay/[0.03] px-4 py-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <span>
            Sayfanın gövde metinleri — bugün hazır olan özellikler ve uzun vadeli vizyon —
            bilerek kod içinde tutulur. Bunlar yazılımın bugün ne yaptığına dair kesin
            ifadelerdir ve ikisinin arasındaki sınır tek bir alan düzenlemesiyle
            bulanıklaşmamalıdır. Giriş ve başvuru adresleri için{' '}
            <Link href={adminPath('/links')} className="font-medium text-brand-dyn hover:opacity-75">
              Bağlantılar
            </Link>{' '}
            ekranına bak.
          </span>
        </p>

        <Panel title="Sayfa başlığı">
          <div className="space-y-4">
            <LocalizedField
              label="Rozet"
              value={localized(content.badge)}
              onChange={(v) => set('badge', v)}
              placeholder="Nexuva Ürünü"
            />
            <LocalizedField
              label="Başlık — ilk bölüm"
              value={localized(content.titleLead)}
              onChange={(v) => set('titleLead', v)}
              placeholder="Dış ticaret operasyonlarınızı"
            />
            <LocalizedField
              label="Başlık — vurgulu bölüm"
              value={localized(content.titleHighlight)}
              onChange={(v) => set('titleHighlight', v)}
              placeholder="tek dosyada yönetin"
            />
            <p className="text-xs text-faint">
              Vurgulu bölüm sayfada altın renkli italik olarak çıkar.
            </p>
            <LocalizedField
              label="Alt başlık"
              value={localized(content.subtitle)}
              onChange={(v) => set('subtitle', v)}
              multiline
            />
          </div>
        </Panel>

        <Panel title="Hero butonları">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField
                label="Birincil buton yazısı"
                value={localized(primary.label)}
                onChange={(v) => setCta('primaryCta', { label: v })}
                placeholder="LogiOps’u Keşfedin"
              />
              <div>
                <label className="field-label">Birincil buton adresi</label>
                <input
                  type="text"
                  value="#bugun"
                  disabled
                  className="field-input opacity-60"
                  aria-describedby="primary-cta-note"
                />
                <p id="primary-cta-note" className="mt-1.5 text-xs text-faint">
                  Sayfanın kendi “Bugün Hazır” bölümüne iner — adresi sabittir.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField
                label="İkincil buton yazısı"
                value={localized(secondary.label)}
                onChange={(v) => setCta('secondaryCta', { label: v })}
                placeholder="Demo Talep Et"
              />
              <TextField
                label="İkincil buton adresi"
                value={secondary.href ?? ''}
                onChange={(v) => setCta('secondaryCta', { href: v })}
                placeholder="/contact"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Ekran görseli">
          <ImageField
            label="Hero görseli"
            value={content.image ?? ''}
            onChange={(url) => set('image', url)}
            images={images}
            hint="Ürünün gerçek ekran görüntüsü. Boş bırakılırsa sayfa çizilmiş operasyon şemasını gösterir — uydurma bir arayüz görseli koymaz."
          />
          <div className="mt-4">
            <TextField
              label="Görsel açıklaması"
              value={content.imageAlt ?? ''}
              onChange={(v) => set('imageAlt', v)}
              placeholder="LogiOps operasyon ekranı"
            />
            <p className="mt-1.5 text-xs text-faint">
              Görsel yüklenmezse sayfada çizilmiş operasyon dosyası şeması gösterilir.
            </p>
          </div>
        </Panel>

        <Panel title="Kapanış">
          <div className="space-y-4">
            <LocalizedField
              label="Kapanış başlığı"
              value={localized(content.closingTitle)}
              onChange={(v) => set('closingTitle', v)}
            />
            <LocalizedField
              label="Kapanış metni"
              value={localized(content.closingBody)}
              onChange={(v) => set('closingBody', v)}
              multiline
            />
          </div>
        </Panel>

        <a
          href="/logiops"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dyn hover:opacity-75"
        >
          Sayfayı sitede aç
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
