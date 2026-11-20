import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';
import { About } from '../../components/sections/about';
import { Stats } from '../../components/sections/stats';
import { Process } from '../../components/sections/process';
import { Testimonials } from '../../components/sections/testimonials';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  // The second paragraph is the one that describes how Nexuva works; the
  // first makes a claim about client scale that is awaiting confirmation.
  const description =
    t(content.about.paragraphs[1]) ||
    'Nexuva hakkında: strateji, tasarım, yazılım ve büyüme disiplinlerini tek ekipte birleştiren dijital dönüşüm ve danışmanlık ekibi.';
  return pageMetadata({ path: '/about', title: 'Hakkımızda', description });
}

export default async function AboutPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Hakkımızda', href: '/about' }]}
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
