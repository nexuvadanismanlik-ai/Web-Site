import type { Metadata } from 'next';
import { getSiteContent } from '../../../lib/content';
import { normalizeLocale, t } from '../../../lib/i18n';
import { PageHero } from '../../../components/sections/page-hero';
import { About } from '../../../components/sections/about';
import { Stats } from '../../../components/sections/stats';
import { Process } from '../../../components/sections/process';
import { Testimonials } from '../../../components/sections/testimonials';
import { Cta } from '../../../components/sections/cta';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = normalizeLocale(params.locale);
  return { title: locale === 'tr' ? 'Hakkımızda' : 'About' };
}

export default async function AboutPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.about.badge, locale)}
        title={t(content.about.title, locale)}
        subtitle={t(content.about.paragraphs[0] ?? content.about.title, locale)}
      />
      <Stats stats={content.stats} locale={locale} />
      <About about={content.about} locale={locale} hideHeading />
      <Process meta={content.processMeta} steps={content.process} locale={locale} />
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
        locale={locale}
      />
      <Cta cta={content.cta} locale={locale} />
    </>
  );
}
