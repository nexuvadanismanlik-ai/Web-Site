import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * The page for an address that does not exist.
 *
 * It was Next's default: English, and inheriting the site's metadata, so it
 * carried the home page's canonical and two contradictory robots tags. This one
 * is Turkish, carries the single noindex Next adds, declares no canonical, and offers the routes a
 * lost visitor most likely wanted.
 *
 * Next serves it with HTTP 404, which is what tells a crawler to drop the URL.
 */
export const metadata: Metadata = {
  // No robots tag here: Next already emits noindex with the 404 status, and a
  // second one is what this page used to get wrong.
  title: 'Sayfa bulunamadı',
};

const ROUTES = [
  { href: '/', label: 'Ana sayfa' },
  { href: '/services/', label: 'Hizmetler' },
  { href: '/logiops/', label: 'LogiOps' },
  { href: '/contact/', label: 'İletişim' },
];

export default function NotFound() {
  return (
    <section className="section pt-36 sm:pt-44">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="eyebrow">404</span>
          <h1 className="display-1 text-fg mt-6">Aradığınız sayfa bulunamadı</h1>
          <div className="rule-gold mt-8 w-28" />
          <p className="prose-measure mt-6 text-base sm:text-lg">
            Adres değişmiş ya da yanlış yazılmış olabilir. Aşağıdaki sayfalardan devam
            edebilirsiniz.
          </p>
          <ul className="mt-10 flex flex-wrap gap-3">
            {ROUTES.map((route) => (
              <li key={route.href}>
                <Link href={route.href} className="btn-ghost">
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
