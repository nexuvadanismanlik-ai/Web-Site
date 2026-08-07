'use client';

import { useState } from 'react';
import { AlertTriangle, Check, MinusCircle, Power } from 'lucide-react';
import type { IntegrationsContent } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { Panel, EditorHeader, useSaver } from '../fields';

/**
 * One connection, with what a correct value looks like.
 *
 * The pattern is checked in the browser and shown as a state, because the
 * failure these have in practice is a value pasted from the wrong box in the
 * provider's dashboard — a container id where a measurement id belongs. That
 * mistake is silent: the tag loads, reports nothing, and looks connected.
 */
interface Field {
  key: keyof IntegrationsContent;
  label: string;
  placeholder: string;
  hint: string;
  /** What a valid identifier looks like. */
  pattern?: RegExp;
  patternHint?: string;
}

const GROUPS: { title: string; description: string; fields: Field[] }[] = [
  {
    title: 'Google',
    description: 'Ölçüm ve reklam etiketleri. Google Analytics ve Ads aynı script ile yüklenir.',
    fields: [
      {
        key: 'ga4MeasurementId',
        label: 'Google Analytics 4 — Ölçüm Kimliği',
        placeholder: 'G-XXXXXXXXXX',
        hint: 'Analytics → Yönetici → Veri Akışları → Ölçüm Kimliği',
        pattern: /^G-[A-Z0-9]{6,}$/i,
        patternHint: 'G- ile başlamalı',
      },
      {
        key: 'gtmContainerId',
        label: 'Google Tag Manager — Kapsayıcı Kimliği',
        placeholder: 'GTM-XXXXXXX',
        hint: 'Tag Manager kullanıyorsan GA4 kimliğini oraya da girme; ikisi birlikte olayları iki kez sayar.',
        pattern: /^GTM-[A-Z0-9]{5,}$/i,
        patternHint: 'GTM- ile başlamalı',
      },
      {
        key: 'googleAdsId',
        label: 'Google Ads — Dönüşüm Kimliği',
        placeholder: 'AW-XXXXXXXXX',
        hint: 'Ads → Araçlar → Dönüşümler → Etiket kurulumu',
        pattern: /^AW-[0-9]{6,}$/i,
        patternHint: 'AW- ile başlamalı',
      },
      {
        key: 'googleAdsConversionLabel',
        label: 'Google Ads — Dönüşüm Etiketi',
        placeholder: 'AW-XXXXXXXXX/AbC-D_efGh',
        hint: 'Form gönderimi bu etiketle dönüşüm olarak bildirilir.',
      },
      {
        key: 'googleSiteVerification',
        label: 'Search Console Doğrulama',
        placeholder: 'abc123...',
        hint: 'HTML etiketi yöntemindeki content değeri. Etiketin tamamını değil, yalnız değeri yapıştır.',
      },
    ],
  },
  {
    title: 'Meta',
    description: 'Facebook ve Instagram reklamları için piksel.',
    fields: [
      {
        key: 'metaPixelId',
        label: 'Meta Pixel Kimliği',
        placeholder: '1234567890123456',
        hint: 'Events Manager → Veri Kaynakları → Pixel',
        pattern: /^[0-9]{10,20}$/,
        patternHint: 'Yalnızca rakam',
      },
    ],
  },
  {
    title: 'Diğer',
    description: 'Arama motoru doğrulamaları ve davranış analizi.',
    fields: [
      {
        key: 'bingSiteVerification',
        label: 'Bing Webmaster Doğrulama',
        placeholder: 'ABCD1234...',
        hint: 'Bing Webmaster Tools → Sitenizi doğrulayın → Meta etiketi',
      },
      {
        key: 'yandexVerification',
        label: 'Yandex Webmaster Doğrulama',
        placeholder: 'abc123...',
        hint: 'Yandex Webmaster → Site hakları → Meta etiketi',
      },
      {
        key: 'clarityProjectId',
        label: 'Microsoft Clarity Proje Kimliği',
        placeholder: 'abcdefghij',
        hint: 'Isı haritası ve oturum kaydı. Ziyaretçi davranışını görmek için.',
      },
    ],
  },
];

/**
 * Where advertising and measurement platforms are connected.
 *
 * These identifiers are public — they are printed into the page for every
 * visitor to read, which is what they are for. Nothing here is a secret, and
 * anything that would be (a Conversions API token) does not belong on this
 * screen.
 *
 * Nothing loads while the master switch is off, so a half-entered configuration
 * never reaches a visitor and turning everything off is one toggle rather than
 * eight deletions.
 */
export function IntegrationsEditor({ initial }: { initial: Partial<IntegrationsContent> }) {
  const [config, setConfig] = useState<Partial<IntegrationsContent>>(initial ?? {});
  const { saving, saved, error, run } = useSaver();

  const set = (key: keyof IntegrationsContent, value: string | boolean) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const connected = GROUPS.flatMap((g) => g.fields).filter((f) =>
    ((config[f.key] as string) ?? '').trim(),
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Entegrasyonlar"
        subtitle="Google, Meta ve ölçüm araçları"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('integrations', config as never))}
      />

      <div className="space-y-6">
        {/* Master switch */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
            config.enabled
              ? 'border-green-500/30 bg-green-500/[0.06]'
              : 'border-overlay/15 bg-overlay/[0.03]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                config.enabled ? 'bg-green-500/15 text-green-600' : 'bg-overlay/5 text-faint'
              }`}
            >
              <Power className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-fg">
                {config.enabled ? 'Etiketler yayında' : 'Etiketler kapalı'}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {config.enabled
                  ? `${connected} bağlantı tanımlı. Kapatırsan hiçbir üçüncü taraf script'i yüklenmez.`
                  : 'Hiçbir üçüncü taraf script’i yüklenmiyor. Bilgileri girip buradan açabilirsin.'}
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={config.enabled ?? false}
              onChange={(e) => set('enabled', e.target.checked)}
              className="h-5 w-5"
            />
            Etkin
          </label>
        </div>

        <p className="flex items-start gap-2 rounded-xl border border-overlay/15 bg-overlay/[0.03] px-4 py-3 text-sm text-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Buradaki kimlikler herkese açıktır — sayfanın kaynağında her ziyaretçi görebilir,
            zaten öyle çalışırlar. Gizli kalması gereken hiçbir anahtarı bu ekrana girme.
          </span>
        </p>

        {GROUPS.map((group) => (
          <Panel key={group.title} title={group.title}>
            <p className="mb-4 text-xs text-faint">{group.description}</p>
            <div className="space-y-4">
              {group.fields.map((field) => {
                const value = ((config[field.key] as string) ?? '').trim();
                const valid = !value || !field.pattern || field.pattern.test(value);
                return (
                  <div key={field.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <label className="field-label">{field.label}</label>
                      <State ok={Boolean(value)} valid={valid} hint={field.patternHint} />
                    </div>
                    <input
                      value={(config[field.key] as string) ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`field-input font-mono text-sm ${
                        valid ? '' : 'border-amber-500/50'
                      }`}
                    />
                    <p className="mt-1 text-xs text-faint">{field.hint}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}

        <p className="text-xs text-faint">
          Değişiklikler yayınlandıktan sonra geçerli olur — kaydettikten sonra Yayınla&apos;ya
          basmayı unutma. Bağlantının gerçekten çalıştığını, ilgili panelde (Analytics
          Gerçek Zamanlı, Meta Events Manager) ilk ziyaretinden sonra göreceksin.
        </p>
      </div>
    </div>
  );
}

/** Set / not set / looks wrong — the three states that matter here. */
function State({ ok, valid, hint }: { ok: boolean; valid: boolean; hint?: string | undefined }) {
  if (!ok) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-faint">
        <MinusCircle className="h-3 w-3" />
        Tanımlı değil
      </span>
    );
  }
  if (!valid) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-500">
        <AlertTriangle className="h-3 w-3" />
        {hint ?? 'Biçim beklenenden farklı'}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-green-600">
      <Check className="h-3 w-3" />
      Tanımlı
    </span>
  );
}
