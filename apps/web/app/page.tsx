import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
import { getSiteContent } from '../lib/content';
import { getUi, t } from '../lib/i18n';
import { Hero } from '../components/sections/hero';
import { LogosMarquee } from '../components/sections/logos';
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
  const ui = getUi();

  return (
    <>
      <Hero hero={content.hero} />
      <LogosMarquee logos={content.logos} label={ui.trustedBy} />
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
      />
    </>
  );
}
