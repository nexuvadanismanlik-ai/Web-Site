import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t, getUi } from '../../lib/i18n';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';
import { References } from '../../components/sections/references';
import { LogosMarquee } from '../../components/sections/logos';
import { Testimonials } from '../../components/sections/testimonials';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  // Built from the reference list itself rather than the section subtitle,
  // which carries a client-count figure that has not been confirmed.
  const names = content.references.map((r) => r.name.trim()).filter(Boolean);
  return pageMetadata({
    path: '/references',
    title: 'Referanslar',
    description: names.length
      ? `Nexuva'nın birlikte çalıştığı markalardan bazıları: ${names.join(', ')}.`
      : 'Nexuva’nın birlikte çalıştığı markalar ve projeler.',
  });
}

export default async function ReferencesPage() {
  const content = await getSiteContent();
  const ui = getUi(content.uiText);
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Referanslar', href: '/references' }]}
        badge={t(content.referencesMeta.badge)}
        title={t(content.referencesMeta.title)}
        subtitle={t(content.referencesMeta.subtitle)}
      />
      <References
        meta={content.referencesMeta}
        references={content.references}
        hideHeading
      />
      <LogosMarquee logos={content.logos} label={ui.trustedBy} />
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
      />
      <Cta cta={content.cta} />
    </>
  );
}
