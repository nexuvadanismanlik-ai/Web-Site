import Link from 'next/link';
import type { SiteContent } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { Icon } from '../icon';

function localized(href: string, locale: Locale) {
  if (href.startsWith('http')) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function Footer({ content, locale }: { content: SiteContent; locale: Locale }) {
  const { brand, footer } = content;
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-10 border-t border-overlay/10">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-overlay/25 to-transparent" />
      <div className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div>
            <Link href={localized('/', locale)} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient-bg text-sm font-bold text-white">
                {brand.logoText.charAt(0)}
              </span>
              <span className="font-heading text-xl font-bold text-fg">{brand.logoText}</span>
            </Link>
            <p data-edit="footer.about" className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              {t(footer.about, locale)}
            </p>
            <div className="mt-6 flex gap-3">
              {brand.social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-overlay/10 bg-overlay/5 text-muted transition-all hover:-translate-y-0.5 hover:border-overlay/25 hover:text-fg"
                >
                  <Icon name={s.icon} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footer.columns.map((col, ci) => (
            <div key={t(col.title, locale)}>
              <h4 data-edit={`footer.columns.${ci}.title`} className="font-heading text-sm font-semibold uppercase tracking-wider text-fg">
                {t(col.title, locale)}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((link, i) => (
                  <li key={`${link.href}-${i}`}>
                    <Link
                      href={localized(link.href, locale)}
                      data-edit={`footer.columns.${ci}.links.${i}.label`}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {t(link.label, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-fg">
              {locale === 'tr' ? 'İletişim' : 'Contact'}
            </h4>
            <ul className="mt-5 space-y-4 text-sm text-muted">
              <li className="flex items-start gap-3">
                <Icon name="mail" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <a href={`mailto:${brand.email}`} data-edit="brand.email" className="hover:text-fg">{brand.email}</a>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="phone" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <a href={`tel:${brand.phone.replace(/\s/g, '')}`} data-edit="brand.phone" className="hover:text-fg">{brand.phone}</a>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="map-pin" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <span data-edit="brand.address">{t(brand.address, locale)}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-overlay/10 pt-8 text-sm text-faint sm:flex-row">
          <p>
            © {year} {brand.siteName}. {t(footer.copyright, locale)}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            {locale === 'tr' ? 'Sistemler çalışıyor' : 'All systems operational'}
          </p>
        </div>
      </div>
    </footer>
  );
}
