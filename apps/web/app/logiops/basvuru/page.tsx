import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';
import { getSiteContent } from '../../../lib/content';
import { siteOrigin } from '../../../lib/origin';
import { resolveLink, siteLinks } from '../../../lib/links';
import { Reveal } from '../../../components/motion';
import { LogiOpsApplicationForm } from '../../../components/logiops/application-form';

/**
 * Where a company asks for LogiOps access.
 *
 * A page rather than a modal on the product page: an application is a
 * considered act, it has its own address somebody can be sent, and it is the
 * one thing on this site a sales conversation will link to directly.
 *
 * The sign-in sits at the top as an escape hatch. A meaningful share of the
 * people who land here already have an account and simply followed the wrong
 * button — making them go back to find it is a small cruelty that costs a
 * customer their patience for no reason.
 */

const TITLE = 'LogiOps Üyelik Başvurusu';
const DESCRIPTION =
  'Firmanız için LogiOps erişim başvurusu oluşturun. Operasyon, taşıma belgeleri, ' +
  'doküman ve muhasebe süreçlerini tek platformda yönetin.';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const url = `${siteOrigin(content)}/logiops/basvuru`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    // An application form is not a page anybody should reach from a search
    // result — it is reached from the product page, having read the argument.
    // Indexing it competes with /logiops for the same query and answers it
    // worse.
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      url,
      title: TITLE,
      description: DESCRIPTION,
      siteName: content.brand?.siteName ?? 'Nexuva',
      images: [{ url: '/og.png' }],
    },
  };
}

export default async function LogiOpsApplicationPage() {
  const content = await getSiteContent();
  const login = resolveLink(siteLinks(content), 'logiopsLogin');

  return (
    <section className="section pt-32 sm:pt-40">
      <div className="container-x">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <Link
              href="/logiops"
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              LogiOps’a dön
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <span className="eyebrow mt-8">Üyelik Başvurusu</span>
            <h1 className="display-2 mt-5 text-fg">Firmanız için LogiOps erişimi</h1>
            <p className="lede mt-5">
              LogiOps kapalı bir sistemdir ve erişim firma bazında tanımlanır. Başvurunuzu
              bırakın; operasyonunuzu konuşup kurulum için sizinle iletişime geçelim.
            </p>
          </Reveal>

          {login && (
            <Reveal delay={0.1}>
              <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
                <LogIn className="h-4 w-4" style={{ color: 'var(--gold)' }} />
                Hesabınız zaten var mı?
                <a
                  href={login.href}
                  {...(login.target ? { target: login.target, rel: login.rel } : {})}
                  data-cta="logiops-login-apply-page"
                  className="font-semibold text-fg underline decoration-[color:var(--gold)] underline-offset-4"
                >
                  {login.label}
                </a>
              </p>
            </Reveal>
          )}

          <Reveal delay={0.15}>
            <div className="mt-10">
              <LogiOpsApplicationForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
