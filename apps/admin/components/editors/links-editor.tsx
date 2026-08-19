'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Link2,
  LogIn,
  MinusCircle,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type { LinksContent, LinkTarget, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { adminPath } from '../../lib/routes';
import { EditorHeader, Panel, useSaver } from '../fields';
import type { AuditedLink } from '../../lib/link-audit';

/**
 * Where every destination outside this site is set, and where every other
 * address in the system can be checked.
 *
 * Two halves, and the split is deliberate. The top half is editable because
 * these destinations have no other home — the LogiOps application, its sign-in,
 * the membership application. The bottom half is a reading of the content
 * document and is not editable here, because each of those links already has
 * exactly one owner. Making them editable in two places would be the fastest
 * way to have a button whose label and address disagree.
 *
 * So: change what belongs here, see everything, and click through to the screen
 * that owns anything else. That is control without a second source of truth.
 */

interface Slot {
  key: keyof LinksContent;
  title: string;
  hint: string;
  icon: typeof LogIn;
  /** What the site does with this, in one sentence. */
  usedBy: string;
  placeholder: string;
}

const SLOTS: Slot[] = [
  {
    key: 'logiopsLogin',
    title: 'LogiOps — Giriş',
    hint: 'Hesabı olan firmaların operasyon paneline girdiği adres.',
    icon: LogIn,
    usedBy: 'LogiOps sayfasının hero bölümü ve erişim kartları; başvuru sayfasının üst satırı.',
    placeholder: 'https://logiops-frontend.onrender.com/login',
  },
  {
    key: 'logiopsRegister',
    title: 'LogiOps — Üyelik Başvurusu',
    hint:
      'Hesabı olmayan firmaların başvuru bıraktığı adres. Varsayılan olarak bu sitedeki ' +
      'başvuru formuna gider ve talep CRM’e düşer.',
    icon: UserPlus,
    usedBy: 'LogiOps sayfasının erişim kartları.',
    placeholder: '/logiops/basvuru',
  },
  {
    key: 'logiopsApp',
    title: 'LogiOps — Uygulama',
    hint: 'Uygulamanın ana adresi. Şu an sitede bir butona bağlı değil; ileride kullanılmak üzere burada tutulur.',
    icon: ExternalLink,
    usedBy: 'Henüz kullanılmıyor.',
    placeholder: 'https://logiops-frontend.onrender.com/',
  },
];

const EMPTY: LinkTarget = {
  url: '',
  label: { tr: '', en: '' },
  description: { tr: '', en: '' },
  newTab: true,
  enabled: true,
};

/** Turkish is the site's only language; English is written alongside it. */
function localized(value: string): Localized {
  return { tr: value, en: value };
}

function readLocalized(value: Localized | undefined): string {
  return value?.tr ?? '';
}

export function LinksEditor({
  initial,
  audit,
}: {
  initial: Partial<LinksContent>;
  audit: AuditedLink[];
}) {
  const [links, setLinks] = useState<Partial<LinksContent>>(initial ?? {});
  const { saving, saved, error, run } = useSaver();

  const target = (key: keyof LinksContent): LinkTarget => ({ ...EMPTY, ...(links[key] ?? {}) });

  const set = (key: keyof LinksContent, patch: Partial<LinkTarget>) =>
    setLinks((current) => ({ ...current, [key]: { ...EMPTY, ...(current[key] ?? {}), ...patch } }));

  const problems = audit.filter(
    (link) => link.health === 'empty' || link.health === 'placeholder' || link.health === 'insecure',
  );

  return (
    <div className="mx-auto max-w-5xl">
      <EditorHeader
        title="Bağlantılar"
        subtitle="LogiOps erişimi ve sitedeki tüm yönlendirmeler"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('links', links as never))}
      />

      <div className="space-y-6">
        <p className="flex items-start gap-2 rounded-xl border border-overlay/15 bg-overlay/[0.03] px-4 py-3 text-sm text-muted">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <span>
            Buradaki adresler siteye yayınlandığında geçerli olur. Adresi boş bırakırsan
            ilgili buton sitede <strong className="text-fg">hiç görünmez</strong> — hiçbir yere
            gitmeyen bir buton göstermek yerine gizlenir.
          </span>
        </p>

        {SLOTS.map((slot) => {
          const value = target(slot.key);
          const Icon = slot.icon;
          const external = /^https?:\/\//i.test(value.url.trim());
          return (
            <Panel key={slot.key} title={slot.title}>
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-overlay/5 text-faint">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-muted">{slot.hint}</p>
                  <p className="mt-1 text-xs text-faint">Kullanıldığı yer: {slot.usedBy}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="field-label">Adres</label>
                  <input
                    type="text"
                    value={value.url}
                    onChange={(e) => set(slot.key, { url: e.target.value })}
                    placeholder={slot.placeholder}
                    className="field-input"
                    spellCheck={false}
                  />
                  <p className="mt-1.5 text-xs text-faint">
                    Başka bir sistem için tam adres (https://…), bu sitedeki bir sayfa için
                    eğik çizgiyle başlayan yol (/logiops/basvuru).
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label">Buton yazısı</label>
                    <input
                      type="text"
                      value={readLocalized(value.label)}
                      onChange={(e) => set(slot.key, { label: localized(e.target.value) })}
                      placeholder="Giriş Yap"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Açıklama</label>
                    <input
                      type="text"
                      value={readLocalized(value.description)}
                      onChange={(e) => set(slot.key, { description: localized(e.target.value) })}
                      placeholder="Hesabınız varsa buradan girin."
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={value.enabled !== false}
                      onChange={(e) => set(slot.key, { enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Sitede göster
                  </label>
                  <label
                    className={`flex items-center gap-2 text-sm ${
                      external ? 'cursor-pointer text-muted' : 'cursor-not-allowed text-faint'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={external && value.newTab !== false}
                      disabled={!external}
                      onChange={(e) => set(slot.key, { newTab: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Yeni sekmede aç
                  </label>
                  {!external && value.url.trim() && (
                    <span className="text-xs text-faint">
                      Bu sitedeki bir sayfa — yeni sekme kapalı tutulur.
                    </span>
                  )}
                </div>

                {value.url.trim() && (
                  <a
                    href={value.url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dyn hover:opacity-75"
                  >
                    Adresi test et
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </Panel>
          );
        })}

        {/* ── The reading ───────────────────────────────────────────── */}
        <Panel title="Sistemdeki tüm bağlantılar">
          <div
            className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              problems.length > 0
                ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-600'
                : 'border-green-500/30 bg-green-500/[0.06] text-green-600'
            }`}
          >
            {problems.length > 0 ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {audit.length} bağlantı tarandı.{' '}
              {problems.length > 0
                ? `${problems.length} tanesi dikkat istiyor.`
                : 'Hepsi geçerli görünüyor.'}
            </span>
          </div>

          <p className="mb-4 text-sm text-muted">
            Bu liste içeriğin kendisinden okunur; buradan düzenlenmez. Her bağlantının tek bir
            sahibi var ve doğru yer orası — aynı adresi iki ekrandan düzenlemek, butonun yazısı
            ile gittiği yerin birbirinden ayrılmasının en hızlı yoludur.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-overlay/10 text-xs uppercase tracking-wide text-faint">
                  <th className="pb-2 pr-4 font-medium">Bağlantı</th>
                  <th className="pb-2 pr-4 font-medium">Adres</th>
                  <th className="pb-2 pr-4 font-medium">Bulunduğu yer</th>
                  <th className="pb-2 font-medium">Düzenle</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((link, index) => (
                  <tr key={`${link.owner}-${link.label}-${index}`} className="border-b border-overlay/[0.06]">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2">
                        <HealthDot health={link.health} />
                        <span className="font-medium text-fg">{link.label}</span>
                      </span>
                      {link.note && <p className="mt-1 pl-4 text-xs text-amber-600">{link.note}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      <code className="break-all text-xs text-muted">{link.href || '—'}</code>
                    </td>
                    <td className="py-3 pr-4 text-xs text-faint">{link.area}</td>
                    <td className="py-3">
                      <Link
                        href={adminPath(link.owner)}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-dyn hover:opacity-75"
                      >
                        {link.ownerLabel}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** A colour is faster to scan than a word, and the word is in the note. */
function HealthDot({ health }: { health: AuditedLink['health'] }) {
  if (health === 'empty') {
    return <MinusCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="Adres yok" />;
  }
  if (health === 'placeholder') {
    return (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Yer tutucu" />
    );
  }
  if (health === 'insecure') {
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Güvensiz" />;
  }
  if (health === 'external') {
    return (
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-faint" aria-label="Dış bağlantı" />
    );
  }
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" aria-label="Geçerli" />;
}
