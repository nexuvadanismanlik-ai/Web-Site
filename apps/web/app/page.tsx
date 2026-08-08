import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
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
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
      />
      <Process meta={content.processMeta} steps={content.process} />
      <Cta cta={content.cta} />
      <Contact
        contact={content.contact}
        services={content.services.map((s) => t(s.title))}
        budgets={[...LEAD_BUDGET_BANDS]}
        uiText={content.uiText}
        integrations={content.integrations}
      />
    </>
  );
}
