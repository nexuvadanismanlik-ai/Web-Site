import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';
import { Services } from '../../components/sections/services';
import { Process } from '../../components/sections/process';
import { Cta } from '../../components/sections/cta';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const names = content.services.map((s) => t(s.title));
  return pageMetadata({
    path: '/services',
    title: 'Hizmetler: Dijital Pazarlama, Web ve Otomasyon',
    description: names.length
      ? `Nexuva hizmetleri: ${names.join(', ')}.`
      : t(content.servicesMeta.subtitle),
  });
}

export default async function ServicesPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Hizmetler', href: '/services' }]}
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
