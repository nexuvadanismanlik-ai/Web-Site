import type { Localized } from '@nexuva/types';

export type Locale = 'tr' | 'en';

export const LOCALES: Locale[] = ['tr', 'en'];
export const DEFAULT_LOCALE: Locale = 'tr';

export function isLocale(value: string): value is Locale {
  return value === 'tr' || value === 'en';
}

export function normalizeLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Resolve a localized string for the active locale, falling back to Turkish. */
export function t(value: Localized | undefined | null, locale: string): string {
  if (!value) return '';
  const loc = normalizeLocale(locale);
  return value[loc] ?? value.tr ?? '';
}

/** Static UI micro-copy that is not part of the editable content store. */
export const ui = {
  tr: {
    menu: 'Menü',
    close: 'Kapat',
    getStarted: 'Hemen Başla',
    langLabel: 'Dil',
    // contact form
    formName: 'Ad Soyad',
    formEmail: 'E-posta',
    formPhone: 'Telefon',
    formSubject: 'Konu',
    formMessage: 'Mesajınız',
    formSubmit: 'Mesajı Gönder',
    formSending: 'Gönderiliyor...',
    formSuccess: 'Teşekkürler! Mesajınız alındı, en kısa sürede dönüş yapacağız.',
    formError: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    namePlaceholder: 'Adınız ve soyadınız',
    emailPlaceholder: 'ornek@sirket.com',
    phonePlaceholder: '+90 5xx xxx xx xx',
    subjectPlaceholder: 'Size nasıl yardımcı olabiliriz?',
    messagePlaceholder: 'Projeniz hakkında birkaç cümle...',
    trustedBy: 'Bize güvenen markalar',
    backHome: 'Anasayfaya dön',
  },
  en: {
    menu: 'Menu',
    close: 'Close',
    getStarted: 'Get Started',
    langLabel: 'Language',
    formName: 'Full Name',
    formEmail: 'Email',
    formPhone: 'Phone',
    formSubject: 'Subject',
    formMessage: 'Your Message',
    formSubmit: 'Send Message',
    formSending: 'Sending...',
    formSuccess: 'Thank you! Your message has been received, we will get back to you shortly.',
    formError: 'Something went wrong. Please try again.',
    namePlaceholder: 'Your full name',
    emailPlaceholder: 'you@company.com',
    phonePlaceholder: '+90 5xx xxx xx xx',
    subjectPlaceholder: 'How can we help you?',
    messagePlaceholder: 'A few sentences about your project...',
    trustedBy: 'Trusted by leading brands',
    backHome: 'Back to home',
  },
} as const;

export function getUi(locale: string) {
  return ui[normalizeLocale(locale)];
}
