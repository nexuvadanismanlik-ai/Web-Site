import { publicContact } from '../../lib/verified-facts';
import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';
import { Contact } from '../../components/sections/contact';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: '/contact',
    title: 'İletişim',
    description:
      'Nexuva ile iletişime geçin: dijital pazarlama, web sitesi, otomasyon veya LogiOps için proje talebinizi formdan ya da e-posta ile iletin.',
  });
}

export default async function ContactPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'İletişim', href: '/contact' }]}
        badge={t(content.contact.badge)}
        title={t(content.contact.title)}
        subtitle={t(content.contact.description)}
      />
      <Contact
        contact={publicContact(content.contact)}
        services={content.services.map((s) => t(s.title))}
        budgets={[...LEAD_BUDGET_BANDS]}
        uiText={content.uiText}
        integrations={content.integrations}
        hideHeading
      />
    </>
  );
}
