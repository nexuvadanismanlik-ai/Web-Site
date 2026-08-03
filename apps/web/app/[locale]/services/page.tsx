import type { Metadata } from 'next';
import { getSiteContent } from '../../../lib/content';
import { normalizeLocale, t } from '../../../lib/i18n';
import { PageHero } from '../../../components/sections/page-hero';
import { Services } from '../../../components/sections/services';
import { Process } from '../../../components/sections/process';
import { Cta } from '../../../components/sections/cta';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = normalizeLocale(params.locale);
  return { title: locale === 'tr' ? 'Hizmetler' : 'Services' };
}

export default async function ServicesPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.servicesMeta.badge, locale)}
        title={t(content.servicesMeta.title, locale)}
        subtitle={t(content.servicesMeta.subtitle, locale)}
      />
      <Services
        meta={content.servicesMeta}
        services={content.services}
        locale={locale}
        showAll
        hideHeading
      />
      <Process meta={content.processMeta} steps={content.process} locale={locale} />
      <Cta cta={content.cta} locale={locale} />
    </>
  );
}
