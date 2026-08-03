import { getSiteContent } from '../../lib/content';
import { normalizeLocale, getUi } from '../../lib/i18n';
import { Hero } from '../../components/sections/hero';
import { LogosMarquee } from '../../components/sections/logos';
import { Services } from '../../components/sections/services';
import { Stats } from '../../components/sections/stats';
import { About } from '../../components/sections/about';
import { References } from '../../components/sections/references';
import { Testimonials } from '../../components/sections/testimonials';
import { Process } from '../../components/sections/process';
import { Cta } from '../../components/sections/cta';
import { Contact } from '../../components/sections/contact';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  const ui = getUi(locale);

  return (
    <>
      <Hero hero={content.hero} locale={locale} />
      <LogosMarquee logos={content.logos} label={ui.trustedBy} />
      <Services meta={content.servicesMeta} services={content.services} locale={locale} />
      <Stats stats={content.stats} locale={locale} />
      <About about={content.about} locale={locale} />
      <References meta={content.referencesMeta} references={content.references} locale={locale} />
      <Testimonials
        meta={content.testimonialsMeta}
        testimonials={content.testimonials}
        locale={locale}
      />
      <Process meta={content.processMeta} steps={content.process} locale={locale} />
      <Cta cta={content.cta} locale={locale} />
      <Contact contact={content.contact} locale={locale} />
    </>
  );
}
