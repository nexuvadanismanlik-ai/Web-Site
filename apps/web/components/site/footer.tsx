import { COMPANY, confirmedAddress, confirmedPhone, telHref } from '../../lib/verified-facts';
import Link from 'next/link';
import type { SiteContent } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';

export function Footer({ content }: { content: SiteContent }) {
  const phone = confirmedPhone(content.brand.phone);
  const address = confirmedAddress(t(content.brand.address));
  const { brand, footer } = content;
  const services = content.services ?? [];
  const year = new Date().getFullYear();

  /**
   * The panel's own columns, minus any that was a hand-written services list.
   *
   * Recognised by its links all pointing at the services page. Dropped rather
   * than left in place, because two "Hizmetler" columns side by side — one
   * real, one stale — is worse than the stale one alone. Everything else the
   * panel defines is rendered untouched.
   */
  const panelColumns = footer.columns.filter((column) => {
    const links = column.links ?? [];
    if (links.length === 0) return true;
    return !links.every((link) => link.href === '/services');
  });

  return (
    <footer className="border-overlay/10 relative mt-10 border-t">
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
                    className="font-heading relative flex h-10 w-10 items-center justify-center rounded-full text-base"
                    style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
                    aria-hidden
                  >
                    <span
                      className="absolute inset-[3px] rounded-full"
                      style={{
                        border: '1px solid color-mix(in srgb, var(--gold) 55%, transparent)',
                      }}
                    />
                    <span className="relative">{brand.logoText.charAt(0)}</span>
                  </span>
                  <span className="font-heading text-fg text-xl tracking-wide">
                    {brand.logoText}
                  </span>
                </>
              )}
            </Link>
            <p
              data-edit="footer.about"
              className="text-muted mt-6 max-w-sm text-[0.95rem] leading-relaxed"
            >
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
                    className="border-overlay/10 bg-overlay/5 text-muted hover:border-overlay/25 hover:text-fg flex h-10 w-10 items-center justify-center rounded-full border transition-all hover:-translate-y-0.5"
                  >
                    <Icon name={s.icon} className="h-4 w-4" />
                  </a>
              ))}
            </div>
          </div>

          {/* Services, from the services themselves.
              This column used to be three hand-typed links — "Dijital
              Strateji", "Yazılım Geliştirme", "Bulut & DevOps" — none of which
              Nexuva offers. A list of services maintained separately from the
              services will drift, and it had: the footer was advertising work
              the company does not do. It now reads the same records the
              services page does, so adding one in the panel puts it here too. */}
          {services.length > 0 && (
            <div>
              <h4 className="text-faint text-[0.7rem] font-semibold uppercase tracking-[0.18em]">
                Hizmetler
              </h4>
              <ul className="mt-5 space-y-3">
                {services.slice(0, 6).map((service) => (
                  <li key={service.id}>
                    <Link
                      href="/services"
                      className="text-muted hover:text-fg text-sm transition-colors"
                    >
                      {t(service.title)}
                    </Link>
                  </li>
                ))}
                {services.length > 6 && (
                  <li>
                    <Link
                      href="/services"
                      className="text-brand-dyn text-sm font-medium transition-opacity hover:opacity-75"
                    >
                      Tüm hizmetler
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Link columns */}
          {panelColumns.map((col, ci) => (
            <div key={t(col.title)}>
              <h4
                data-edit={`footer.columns.${ci}.title`}
                className="text-faint text-[0.7rem] font-semibold uppercase tracking-[0.18em]"
              >
                {t(col.title)}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((link, i) => (
                  <li key={`${link.href}-${i}`}>
                    <Link
                      href={link.href}
                      data-edit={`footer.columns.${ci}.links.${i}.label`}
                      className="text-muted hover:text-fg text-sm transition-colors"
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
            <h4 className="text-faint text-[0.7rem] font-semibold uppercase tracking-[0.18em]">
              {'İletişim'}
            </h4>
            <ul className="text-muted mt-5 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <Icon name="mail" className="text-brand-dyn mt-0.5 h-4 w-4" />
                <a
                  href={`mailto:${brand.email}`}
                  data-edit="brand.email"
                  className="hover:text-fg min-w-0 break-all"
                >
                  {brand.email}
                </a>
              </li>
              {/* Shown only once confirmed (lib/verified-facts.ts). */}
              {phone && (
                <li className="flex items-start gap-3">
                  <Icon name="phone" className="text-brand-dyn mt-0.5 h-4 w-4" />
                  <a
                    href={telHref()}
                    data-edit="brand.phone"
                    className="hover:text-fg"
                  >
                    {phone}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-3">
                  <Icon name="map-pin" className="text-brand-dyn mt-0.5 h-4 w-4" />
                  <span data-edit="brand.address">{address}</span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Icon name="calendar" className="text-brand-dyn mt-0.5 h-4 w-4" />
                <span>{COMPANY.since}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-overlay/10 text-faint mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm sm:flex-row">
          <p>
            © {year} {brand.siteName}. {t(footer.copyright)}
          </p>
          {/* There used to be a green dot here reading "Sistemler çalışıyor".
              It measured nothing — it was a claim printed unconditionally,
              including while the site was down. The tagline is at least true. */}
          <nav aria-label="Yasal" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/kvkk" className="hover:text-fg transition-colors">
              KVKK Aydınlatma Metni
            </Link>
            <Link href="/gizlilik" className="hover:text-fg transition-colors">
              Gizlilik ve Çerez Politikası
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
