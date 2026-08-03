import type { Metadata } from 'next';
import { getSiteContent } from '../../../lib/content';
import { normalizeLocale, t, getUi } from '../../../lib/i18n';
import { PageHero } from '../../../components/sections/page-hero';
import { References } from '../../../components/sections/references';
import { LogosMarquee } from '../../../components/sections/logos';
import { Testimonials } from '../../../components/sections/testimonials';
import { Cta } from '../../../components/sections/cta';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = normalizeLocale(params.locale);
  return { title: locale === 'tr' ? 'Referanslar' : 'References' };
}

export default async function ReferencesPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  const ui = getUi(locale);
  return (
    <>
      <PageHero
        badge={t(content.referencesMeta.badge, locale)}
        title={t(content.referencesMeta.title, locale)}
        subtitle={t(content.referencesMeta.subtitle, locale)}
      />
      <References
        meta={content.referencesMeta}
        references={content.references}
        locale={locale}
        hideHeading
      />
      <LogosMarquee logos={content.logos} label={ui.trustedBy} />
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
        locale={locale}
      />
      <Cta cta={content.cta} locale={locale} />
    </>
  );
}
