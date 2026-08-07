import Link from 'next/link';
import type { SiteContent } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';

export function Footer({ content }: { content: SiteContent }) {
  const { brand, footer } = content;
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-10 border-t border-overlay/10">
      <div className="rule-gold pointer-events-none absolute inset-x-0 -top-px" aria-hidden />
      <div className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr] lg:gap-16">
          {/* Brand */}
          <div>
            <Link href={'/'} className="flex items-center gap-2.5">
              {brand.logoUrl ? (
                // uploaded asset on a CDN, next/image is off for static export
                <img
                  src={brand.logoUrl}
                  alt={brand.logoText}
                  className="h-9 w-auto max-w-[11rem] object-contain"
                />
              ) : (
                <>
                  <span
                    className="relative flex h-10 w-10 items-center justify-center rounded-full font-heading text-base"
                    style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
                    aria-hidden
                  >
                    <span
                      className="absolute inset-[3px] rounded-full"
                      style={{ border: '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' }}
                    />
                    <span className="relative">{brand.logoText.charAt(0)}</span>
                  </span>
                  <span className="font-heading text-xl tracking-wide text-fg">{brand.logoText}</span>
                </>
              )}
            </Link>
            <p data-edit="footer.about" className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-muted">
              {t(footer.about)}
            </p>
            {/* The footer is where a reader lands after everything else has
                failed to convince them. One clear way forward beats none. */}
            {footer.cta?.label?.tr && (
              <Link
                href={footer.cta.href || '/contact'}
                data-cta="footer"
                data-edit="footer.cta.label"
                className="btn-primary mt-6 inline-flex"
              >
                {t(footer.cta.label)}
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            )}

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
            <div key={t(col.title)}>
              <h4 data-edit={`footer.columns.${ci}.title`} className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-faint">
                {t(col.title)}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((link, i) => (
                  <li key={`${link.href}-${i}`}>
                    <Link
                      href={link.href}
                      data-edit={`footer.columns.${ci}.links.${i}.label`}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {t(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-faint">
              {'İletişim'}
            </h4>
            <ul className="mt-5 space-y-4 text-sm text-muted">
              <li className="flex items-start gap-3">
                <Icon name="mail" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <a
                  href={`mailto:${brand.email}`}
                  data-edit="brand.email"
                  className="min-w-0 break-all hover:text-fg"
                >
                  {brand.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="phone" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <a href={`tel:${brand.phone.replace(/\s/g, '')}`} data-edit="brand.phone" className="hover:text-fg">{brand.phone}</a>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="map-pin" className="mt-0.5 h-4 w-4 text-brand-dyn" />
                <span data-edit="brand.address">{t(brand.address)}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-overlay/10 pt-8 text-sm text-faint sm:flex-row">
          <p>
            © {year} {brand.siteName}. {t(footer.copyright)}
          </p>
          {/* There used to be a green dot here reading "Sistemler çalışıyor".
              It measured nothing — it was a claim printed unconditionally,
              including while the site was down. The tagline is at least true. */}
          <p data-edit="brand.tagline">{t(brand.tagline)}</p>
        </div>
      </div>
    </footer>
  );
}
