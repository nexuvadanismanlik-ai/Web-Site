import type { LinkTarget, LinksContent, SiteContent } from '@nexuva/types';
import { t } from './i18n';

/**
 * Reading a panel-managed destination, safely.
 *
 * Every consumer needs the same three answers — is it on, where does it go,
 * what does it say — and needs them to be wrong in the same way when the
 * section has never been filled in. Doing that at each call site is how one
 * button ends up rendering with an empty href while its neighbour hides.
 */

/** A destination resolved down to what a link element actually needs. */
export interface ResolvedLink {
  href: string;
  label: string;
  description: string;
  /** Set on the anchor only when the destination leaves this site. */
  target?: '_blank';
  rel?: string;
}

/**
 * The words, when the panel has none.
 *
 * Labels fall back and addresses deliberately do not. A button with no label
 * is a blank rectangle; a button with no address is a button that lies. So a
 * missing label is repaired here and a missing address hides the control.
 */
const DEFAULT_LABELS: Record<keyof LinksContent, { label: string; description: string }> = {
  logiopsApp: { label: 'LogiOps’a Git', description: '' },
  logiopsLogin: {
    label: 'Giriş Yap',
    description: 'Hesabınız varsa operasyon panelinize buradan girin.',
  },
  logiopsRegister: {
    label: 'Üyelik Başvurusu Oluştur',
    description: 'Firmanız için erişim talebi bırakın, size dönelim.',
  },
};

/** True when following this takes the visitor off this site. */
export function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * One destination, or null when it should not be rendered.
 *
 * Null rather than a disabled control: a greyed-out button still has to be
 * explained, and there is nothing to explain — the address simply has not been
 * set yet, which is a fact about the panel and not about the visitor.
 */
export function resolveLink(
  links: Partial<LinksContent> | undefined,
  key: keyof LinksContent,
): ResolvedLink | null {
  const target: Partial<LinkTarget> | undefined = links?.[key];
  const href = (target?.url ?? '').trim();
  // `enabled` defaults to true when the field has never been written: a
  // destination that was seeded with an address and no flag should work.
  if (!href || target?.enabled === false) return null;

  // Coalesced rather than asserted non-null: noUncheckedIndexedAccess is on
  // for a reason, and a key added to LinksContent without a default here
  // should degrade to a working link with no words rather than crash a page.
  const fallback = DEFAULT_LABELS[key] ?? { label: '', description: '' };
  const label = (target?.label ? t(target.label) : '').trim() || fallback.label;
  const description =
    (target?.description ? t(target.description) : '').trim() || fallback.description;

  const external = isExternal(href);
  // Honour the panel's choice, but never open an internal page in a new tab by
  // accident — a second tab of the same site is a navigation bug, not a
  // preference.
  const newTab = external && target?.newTab !== false;

  return {
    href,
    label,
    description,
    // noreferrer alongside noopener: the first closes the reverse-tabnabbing
    // hole, the second stops this site's URL being handed to the destination.
    ...(newTab ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {}),
  };
}

/** Convenience for a page that already holds the whole document. */
export function siteLinks(content: SiteContent): Partial<LinksContent> {
  return (content.links ?? {}) as Partial<LinksContent>;
}
