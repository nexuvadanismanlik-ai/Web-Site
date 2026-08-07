'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import type { UiText } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { Panel, EditorHeader, useSaver } from '../fields';

/**
 * Every field, with the wording the site uses when it is left empty.
 *
 * The placeholder is not decoration here — it is the live value. Showing it
 * means an operator can see what the site says today without having to open
 * the site, and can tell at a glance which of these anybody has changed.
 */
const GROUPS: {
  title: string;
  hint?: string;
  fields: { key: keyof UiText; label: string; fallback: string; multiline?: boolean }[];
}[] = [
  {
    title: 'Genel',
    fields: [
      { key: 'getStarted', label: 'Header butonu', fallback: 'Hemen Başla' },
      { key: 'trustedBy', label: 'Logo şeridi başlığı', fallback: 'Bize güvenen markalar' },
      { key: 'allServices', label: 'Tüm hizmetler bağlantısı', fallback: 'Tüm hizmetleri gör' },
      { key: 'menu', label: 'Mobil menü', fallback: 'Menü' },
      { key: 'close', label: 'Kapat', fallback: 'Kapat' },
      { key: 'backHome', label: '404 sayfası bağlantısı', fallback: 'Anasayfaya dön' },
    ],
  },
  {
    title: 'Form Alanları',
    hint: 'İletişim formundaki etiketler.',
    fields: [
      { key: 'formName', label: 'Ad Soyad', fallback: 'Ad Soyad' },
      { key: 'formEmail', label: 'E-posta', fallback: 'E-posta' },
      { key: 'formPhone', label: 'Telefon', fallback: 'Telefon' },
      { key: 'formCompany', label: 'Firma', fallback: 'Firma' },
      { key: 'formService', label: 'Hizmet', fallback: 'İlgilendiğiniz hizmet' },
      { key: 'formBudget', label: 'Bütçe', fallback: 'Bütçe aralığı' },
      { key: 'formSubject', label: 'Konu', fallback: 'Konu' },
      { key: 'formMessage', label: 'Mesaj', fallback: 'Mesajınız' },
      { key: 'formSubmit', label: 'Gönder butonu', fallback: 'Mesajı Gönder' },
      { key: 'formSending', label: 'Gönderilirken', fallback: 'Gönderiliyor...' },
    ],
  },
  {
    title: 'Form Yardım Metinleri',
    hint: 'Kutuların içinde soluk görünen örnek yazılar.',
    fields: [
      { key: 'namePlaceholder', label: 'Ad Soyad', fallback: 'Adınız ve soyadınız' },
      { key: 'emailPlaceholder', label: 'E-posta', fallback: 'ornek@sirket.com' },
      { key: 'phonePlaceholder', label: 'Telefon', fallback: '+90 5xx xxx xx xx' },
      { key: 'companyPlaceholder', label: 'Firma', fallback: 'Firma adı' },
      { key: 'subjectPlaceholder', label: 'Konu', fallback: 'Size nasıl yardımcı olabiliriz?' },
      {
        key: 'messagePlaceholder',
        label: 'Mesaj',
        fallback: 'Projeniz hakkında birkaç cümle...',
      },
    ],
  },
  {
    title: 'Form Sonuç Mesajları',
    hint: 'Ziyaretçi formu gönderdiğinde gördüğü cümleler. Bunlar müşteriyle ilk temasınız.',
    fields: [
      {
        key: 'formSuccess',
        label: 'Başarılı',
        fallback: 'Teşekkürler! Mesajınız alındı, en kısa sürede dönüş yapacağız.',
        multiline: true,
      },
      {
        key: 'formError',
        label: 'Hata',
        fallback: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        multiline: true,
      },
      {
        key: 'formInvalid',
        label: 'Eksik alan',
        fallback: 'Lütfen alanları kontrol edip tekrar deneyin.',
        multiline: true,
      },
      {
        key: 'formRateLimit',
        label: 'Çok fazla deneme',
        fallback:
          'Kısa sürede çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar deneyin veya doğrudan e-posta yazın.',
        multiline: true,
      },
    ],
  },
];

/**
 * The site's own words that belong to no section.
 *
 * These were written into the code, which meant the sentence a visitor reads
 * when their message fails to send could only be changed by a developer. They
 * are here rather than duplicated into each section that uses them, because
 * the same words appear on several pages and two copies would drift.
 */
export function UiTextEditor({ initial }: { initial: Partial<UiText> }) {
  const [text, setText] = useState<Partial<UiText>>(initial ?? {});
  const { saving, saved, error, run } = useSaver();

  const set = (key: keyof UiText, value: string) =>
    setText((current) => ({ ...current, [key]: value }));

  const changed = GROUPS.flatMap((g) => g.fields).filter(
    (f) => (text[f.key] ?? '').toString().trim().length > 0,
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Site Metinleri"
        subtitle="Buton, form ve durum yazıları"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('uiText', text as never))}
      />

      <p className="mb-6 flex items-start gap-2 rounded-xl border border-overlay/15 bg-overlay/[0.03] px-4 py-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-dyn" />
        <span>
          Her kutunun soluk yazısı, sitenin <strong>şu an kullandığı</strong> metindir. Boş
          bıraktığın alan olduğu gibi kalır — değiştirmek istediğini yaz, gerisine dokunma.
          {changed > 0 && ` Şu an ${changed} metin özelleştirilmiş.`}
        </span>
      </p>

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <Panel key={group.title} title={group.title}>
            {group.hint && <p className="mb-4 text-xs text-faint">{group.hint}</p>}
            <div className={group.fields.some((f) => f.multiline) ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label className="field-label">{field.label}</label>
                  {field.multiline ? (
                    <textarea
                      value={(text[field.key] as string) ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      placeholder={field.fallback}
                      rows={2}
                      className="field-input resize-none"
                    />
                  ) : (
                    <input
                      value={(text[field.key] as string) ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      placeholder={field.fallback}
                      className="field-input"
                    />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
