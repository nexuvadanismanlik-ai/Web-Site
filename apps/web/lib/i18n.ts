import type { Localized } from '@nexuva/types';

/**
 * The site is Turkish.
 *
 * It used to be served under /tr and /en, with the root detecting the browser
 * language and forwarding — which meant a visitor with an English browser was
 * sent to an English site nobody maintains. There is one site now, at the root.
 *
 * The `Localized { tr, en }` shape stays in the content model. Removing it would
 * be a migration, and keeping it costs nothing: an English edition later is a
 * matter of reading the other field, not of restructuring the data.
 */
export type Locale = 'tr';

export const DEFAULT_LOCALE: Locale = 'tr';

/** Reads the Turkish text out of a localized value. */
export function t(value: Localized | undefined | null): string {
  if (!value) return '';
  return value.tr ?? value.en ?? '';
}

/** Static UI micro-copy that is not part of the editable content store. */
const copy = {
    menu: 'Menü',
    close: 'Kapat',
    getStarted: 'Hemen Başla',
    // contact form
    formName: 'Ad Soyad',
    formEmail: 'E-posta',
    formPhone: 'Telefon',
    formSubject: 'Konu',
    formCompany: 'Firma',
    formService: 'İlgilendiğiniz hizmet',
    formBudget: 'Bütçe aralığı',
    companyPlaceholder: 'Firma adı',
    consentLabel:
      'Kişisel verilerimin, talebimi değerlendirmek ve benimle iletişime geçmek amacıyla işlenmesini kabul ediyorum.',
    formMessage: 'Mesajınız',
    formSubmit: 'Mesajı Gönder',
    formSending: 'Gönderiliyor...',
    formSuccess: 'Teşekkürler! Mesajınız alındı, en kısa sürede dönüş yapacağız.',
    formError: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    formInvalid: 'Lütfen alanları kontrol edip tekrar deneyin.',
    formRateLimit:
      'Kısa sürede çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar deneyin veya doğrudan e-posta yazın.',
    namePlaceholder: 'Adınız ve soyadınız',
    emailPlaceholder: 'ornek@sirket.com',
    phonePlaceholder: '+90 5xx xxx xx xx',
    subjectPlaceholder: 'Size nasıl yardımcı olabiliriz?',
    messagePlaceholder: 'Projeniz hakkında birkaç cümle...',
    trustedBy: 'Bize güvenen markalar',
    backHome: 'Anasayfaya dön',
} as const;

/** Static UI micro-copy that is not part of the editable content store. */
export function getUi() {
  return copy;
}
