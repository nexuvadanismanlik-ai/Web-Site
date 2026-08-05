import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t, getUi } from '../../lib/i18n';
import { PageHero } from '../../components/sections/page-hero';
import { References } from '../../components/sections/references';
import { LogosMarquee } from '../../components/sections/logos';
import { Testimonials } from '../../components/sections/testimonials';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Referanslar' };
}

export default async function ReferencesPage() {
  const content = await getSiteContent();
  const ui = getUi();
  return (
    <>
      <PageHero
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
