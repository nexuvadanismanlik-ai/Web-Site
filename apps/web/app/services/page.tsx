import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { PageHero } from '../../components/sections/page-hero';
import { Services } from '../../components/sections/services';
import { Process } from '../../components/sections/process';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Hizmetler' };
}

export default async function ServicesPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.servicesMeta.badge)}
        title={t(content.servicesMeta.title)}
        subtitle={t(content.servicesMeta.subtitle)}
      />
      <Services
        meta={content.servicesMeta}
        services={content.services}
        showAll
        hideHeading
      />
      <Process meta={content.processMeta} steps={content.process} />
      <Cta cta={content.cta} />
    </>
  );
}
