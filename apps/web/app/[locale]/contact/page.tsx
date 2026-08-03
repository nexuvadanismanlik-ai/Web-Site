import type { Metadata } from 'next';
import { getSiteContent } from '../../../lib/content';
import { normalizeLocale, t } from '../../../lib/i18n';
import { PageHero } from '../../../components/sections/page-hero';
import { Contact } from '../../../components/sections/contact';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = normalizeLocale(params.locale);
  return { title: locale === 'tr' ? 'İletişim' : 'Contact' };
}

export default async function ContactPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.contact.badge, locale)}
        title={t(content.contact.title, locale)}
        subtitle={t(content.contact.description, locale)}
      />
      <Contact contact={content.contact} locale={locale} hideHeading />
    </>
  );
}
