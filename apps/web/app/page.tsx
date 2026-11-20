import { publicContact } from '../lib/verified-facts';
import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
import type { Metadata } from 'next';
import { pageMetadata } from '../lib/seo';
import { absoluteUrl } from '../lib/origin';
import { HOME_FAQ } from '../lib/service-details';
import { Faq } from '../components/faq';
import { getSiteContent } from '../lib/content';
import { getUi, t } from '../lib/i18n';
import { Hero } from '../components/sections/hero';
import { LogosMarquee } from '../components/sections/logos';
import { CapabilityStrip } from '../components/sections/capability-strip';
import { Services } from '../components/sections/services';
import { Stats } from '../components/sections/stats';
import { About } from '../components/sections/about';
import { References } from '../components/sections/references';
import { Testimonials } from '../components/sections/testimonials';
import { Process } from '../components/sections/process';
import { Cta } from '../components/sections/cta';
import { Contact } from '../components/sections/contact';

/**
 * The home page's own metadata. Title and description stay in the panel's SEO
 * screen; the canonical is the deployment's origin.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const seo = content.seo;
  return pageMetadata({
    path: '/',
    absoluteTitle: true,
    title: seo?.title?.trim() || `${content.brand.siteName} — ${t(content.brand.tagline)}`,
    description: seo?.description?.trim() || t(content.hero.subtitle),
    socialTitle: seo?.ogTitle?.trim() || undefined,
    image: seo?.ogImage?.trim() || undefined,
  });
}

export default async function HomePage() {
  const content = await getSiteContent();
  const ui = getUi(content.uiText);

  return (
    <>
      <Hero hero={content.hero} />
      {/* The slot under the hero. Client marks when there are any, and what we
          actually do when there are not — never both, and never empty. */}
      {content.logos.length > 0 ? (
        <LogosMarquee logos={content.logos} label={ui.trustedBy} />
      ) : (
        <CapabilityStrip items={content.services.map((s) => t(s.title))} />
      )}
      <Services meta={content.servicesMeta} services={content.services} />
      <Stats stats={content.stats} />
      <About about={content.about} />
      <References meta={content.referencesMeta} references={content.references} />
      <Testimonials meta={content.testimonialsMeta} testimonials={content.testimonials} />
      <Process meta={content.processMeta} steps={content.process} />
      <Faq items={HOME_FAQ} pageUrl={absoluteUrl('/') || undefined} />
      <Cta cta={content.cta} />
      <Contact
        contact={publicContact(content.contact)}
        services={content.services.map((s) => t(s.title))}
        budgets={[...LEAD_BUDGET_BANDS]}
        uiText={content.uiText}
        integrations={content.integrations}
      />
    </>
  );
}
