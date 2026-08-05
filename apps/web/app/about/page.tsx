import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { PageHero } from '../../components/sections/page-hero';
import { About } from '../../components/sections/about';
import { Stats } from '../../components/sections/stats';
import { Process } from '../../components/sections/process';
import { Testimonials } from '../../components/sections/testimonials';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Hakkımızda' };
}

export default async function AboutPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.about.badge)}
        title={t(content.about.title)}
        subtitle={t(content.about.paragraphs[0] ?? content.about.title)}
      />
      <Stats stats={content.stats} />
      <About about={content.about} hideHeading />
      <Process meta={content.processMeta} steps={content.process} />
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
      />
      <Cta cta={content.cta} />
    </>
  );
}
