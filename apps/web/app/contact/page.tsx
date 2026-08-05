import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { PageHero } from '../../components/sections/page-hero';
import { Contact } from '../../components/sections/contact';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'İletişim' };
}

export default async function ContactPage() {
  const content = await getSiteContent();
  return (
    <>
      <PageHero
        badge={t(content.contact.badge)}
        title={t(content.contact.title)}
        subtitle={t(content.contact.description)}
      />
      <Contact
        contact={content.contact}
        services={content.services.map((s) => t(s.title))}
        budgets={[...LEAD_BUDGET_BANDS]}
        hideHeading
      />
    </>
  );
}
