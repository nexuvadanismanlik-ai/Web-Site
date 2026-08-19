import Link from 'next/link';
import { ArrowUpRight, LogIn, UserPlus } from 'lucide-react';
import type { LinksContent } from '@nexuva/types';
import { resolveLink, type ResolvedLink } from '../../lib/links';
import { Reveal } from '../motion';

/**
 * The two ways into LogiOps.
 *
 * A product page that argues well and then offers nothing to do is a brochure.
 * These are the two things a reader can actually want by the time they reach
 * the bottom: they already have an account, or they want one.
 *
 * They are deliberately not the same control. LogiOps has no self-service
 * sign-up — the application's only auth routes are a sign-in and a first-login
 * OTP, and new customers arrive through a request a person reviews. So sending
 * an interested forwarder to the login screen would hand them a form they
 * cannot complete, which is the most expensive kind of dead end: it looks like
 * the product rejecting them.
 *
 * Members get the application. Everybody else gets a form on this site that
 * lands in the CRM as an enquiry, next to every other lead.
 *
 * Both addresses come from the panel (Bağlantılar). Nothing here hard-codes a
 * URL, so when LogiOps grows a public sign-up page it is a field, not a
 * deploy. A destination that has not been set renders nothing rather than a
 * button that goes nowhere.
 */

/** One route in, as a card. */
function Route({
  link,
  icon: Icon,
  eyebrow,
  primary = false,
}: {
  link: ResolvedLink;
  icon: typeof LogIn;
  eyebrow: string;
  primary?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={
          primary
            ? { background: 'var(--gold)', color: '#14161f' }
            : { border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)', color: 'var(--gold)' }
        }
      >
        <Icon className="h-5 w-5" />
      </span>

      <span className="mt-5 block text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-faint">
        {eyebrow}
      </span>
      <span className="mt-2 block font-heading text-xl text-fg">{link.label}</span>
      {link.description && (
        <span className="mt-2 block text-sm leading-relaxed text-muted">{link.description}</span>
      )}

      <span
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: primary ? 'var(--gold)' : 'rgb(var(--c-fg))' }}
      >
        {link.label}
        <ArrowUpRight className="h-4 w-4 transition-transform duration-[--t-fast] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </>
  );

  const className = [
    'group flex h-full flex-col rounded-[var(--r-lg)] p-7 transition-all duration-[--t-fast]',
    'hover:-translate-y-0.5',
    primary
      ? 'border shadow-[var(--shadow-raise)]'
      : 'border border-overlay/12 bg-card hover:border-overlay/25',
  ].join(' ');

  const style = primary
    ? {
        borderColor: 'color-mix(in srgb, var(--gold) 55%, transparent)',
        background: 'color-mix(in srgb, var(--gold) 6%, rgb(var(--c-card)))',
      }
    : undefined;

  // next/link for a path on this site, a plain anchor for another system.
  // Handing an absolute URL to the client-side router asks it to prefetch a
  // host it does not own.
  return link.target === '_blank' ? (
    <a
      href={link.href}
      target={link.target}
      rel={link.rel}
      data-cta={`logiops-${primary ? 'login' : 'apply'}`}
      className={className}
      style={style}
    >
      {body}
    </a>
  ) : (
    <Link
      href={link.href}
      data-cta={`logiops-${primary ? 'login' : 'apply'}`}
      className={className}
      style={style}
    >
      {body}
    </Link>
  );
}

export function LogiOpsAccess({ links }: { links: Partial<LinksContent> }) {
  const login = resolveLink(links, 'logiopsLogin');
  const register = resolveLink(links, 'logiopsRegister');

  // Neither configured: the section removes itself rather than leaving a
  // heading over an empty box.
  if (!login && !register) return null;

  return (
    <section id="erisim" className="section">
      <div className="container-x">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow justify-center">LogiOps’a Erişim</span>
            <h2 className="display-3 mt-5 text-fg">Panelinize girin ya da başvurunuzu oluşturun</h2>
            <p className="lede mx-auto mt-5">
              LogiOps kapalı bir sistemdir; erişim firma bazında tanımlanır. Hesabınız varsa
              doğrudan giriş yapabilir, yoksa firmanız için başvuru bırakabilirsiniz.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
          {login && (
            <Reveal delay={0.05}>
              <Route link={login} icon={LogIn} eyebrow="Üyelerimiz için" primary />
            </Reveal>
          )}
          {register && (
            <Reveal delay={0.1}>
              <Route link={register} icon={UserPlus} eyebrow="Yeni başvuru" />
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The compact form, for the hero.
 *
 * Above the fold the reader has not been told what the product is yet, so this
 * is one control rather than a choice between two — the sign-in, for somebody
 * who came here to get to work rather than to be convinced. The full pair sits
 * where the argument ends.
 */
export function LogiOpsAccessInline({ links }: { links: Partial<LinksContent> }) {
  const login = resolveLink(links, 'logiopsLogin');
  if (!login) return null;

  const inner = (
    <>
      <LogIn className="h-4 w-4" />
      {login.label}
      <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </>
  );

  const className =
    'group inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold text-fg transition-colors duration-[--t-fast]';
  const style = {
    borderColor: 'color-mix(in srgb, var(--gold) 45%, transparent)',
  };

  return login.target === '_blank' ? (
    <a
      href={login.href}
      target={login.target}
      rel={login.rel}
      data-cta="logiops-login-hero"
      className={className}
      style={style}
    >
      {inner}
    </a>
  ) : (
    <Link href={login.href} data-cta="logiops-login-hero" className={className} style={style}>
      {inner}
    </Link>
  );
}
