import Link from 'next/link';
import { absoluteUrl } from '../lib/origin';
import { serializeJsonLd } from '../lib/seo';

export interface Crumb {
  label: string;
  /** Site path. The last crumb is the current page. */
  href: string;
}

/**
 * Where this page sits, for a reader and for a search engine.
 *
 * The visible trail and the BreadcrumbList come from one array, so they agree.
 * Rendered as an ordered list inside a labelled <nav> with aria-current on the
 * last item — the pattern screen readers announce as a breadcrumb.
 *
 * Rendered inside an inner page's hero, above the eyebrow, so it adds no
 * padding to layouts that were designed without it.
 */
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  const trail: Crumb[] = [{ label: 'Ana Sayfa', href: '/' }, ...items];
  const withUrls = trail.map((crumb) => ({ ...crumb, url: absoluteUrl(crumb.href) }));
  const canMarkUp = withUrls.every((crumb) => crumb.url);

  const schema = canMarkUp
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: withUrls.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.label,
          item: crumb.url,
        })),
      }
    : null;

  return (
    <>
      <nav aria-label="Konum" className={className}>
        <ol className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className="text-fg">
                    {crumb.label}
                  </span>
                ) : (
                  <>
                    <Link
                      href={crumb.href}
                      className="hover:text-fg underline-offset-4 hover:underline"
                    >
                      {crumb.label}
                    </Link>
                    <span aria-hidden>/</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      )}
    </>
  );
}
