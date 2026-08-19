import type { SiteContent } from '@nexuva/types';

/**
 * Every address the site sends a visitor to, gathered from the content itself.
 *
 * The point of this file is that it derives rather than duplicates. Each link
 * already has exactly one owner — a nav item belongs to the navigation
 * section, a service button to that service — and the panel screen that owns
 * it is where it must be edited. Copying these into a second editable list
 * would create two writers for one value, which is the fastest way to make a
 * button disagree with itself.
 *
 * So this is a reading. It answers "where does everything point, and what
 * looks wrong" in one screen, and hands the operator a link to the screen that
 * can actually change it.
 */

export type LinkHealth = 'ok' | 'empty' | 'placeholder' | 'insecure' | 'external';

export interface AuditedLink {
  /** Human label for the thing that carries this address. */
  label: string;
  /** Where it points today. */
  href: string;
  /** Which part of the site it appears in. */
  area: string;
  /** The panel route that owns it. */
  owner: string;
  ownerLabel: string;
  health: LinkHealth;
  /** Why it is flagged, when it is. */
  note?: string;
}

/**
 * Addresses that are technically valid and practically wrong.
 *
 * These are the shapes a seeded placeholder takes: the platform's own home
 * page where a company profile belongs, and the reserved 555 telephone range.
 * They resolve, they look plausible in a table, and they are the reason a
 * visitor clicks "LinkedIn" and lands on LinkedIn's marketing page.
 */
const PLACEHOLDER_HOSTS = new Set([
  'linkedin.com',
  'www.linkedin.com',
  'x.com',
  'www.x.com',
  'twitter.com',
  'instagram.com',
  'www.instagram.com',
  'github.com',
  'www.github.com',
  'facebook.com',
  'www.facebook.com',
  'youtube.com',
  'www.youtube.com',
]);

function judge(href: string): { health: LinkHealth; note?: string } {
  const value = (href ?? '').trim();
  if (!value) return { health: 'empty', note: 'Adres girilmemiş — bağlantı hiçbir yere gitmiyor.' };

  if (value.startsWith('mailto:') || value.startsWith('tel:')) {
    if (/555\s?\d{4}|555-\d{4}/.test(value)) {
      return { health: 'placeholder', note: '555 numarası ayrılmış örnek aralıktır.' };
    }
    return { health: 'ok' };
  }

  if (value.startsWith('/') || value.startsWith('#')) return { health: 'ok' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { health: 'empty', note: 'Geçerli bir adres değil.' };
  }

  if (url.protocol === 'http:') {
    return { health: 'insecure', note: 'http:// — tarayıcılar güvensiz olarak işaretler.' };
  }
  // A bare platform home page in a social slot is a placeholder that survived
  // seeding, not a profile.
  if (PLACEHOLDER_HOSTS.has(url.hostname) && url.pathname.replace(/\/+$/, '') === '') {
    return {
      health: 'placeholder',
      note: 'Platformun ana sayfası — firma profili değil.',
    };
  }
  return { health: 'external' };
}

function entry(
  label: string,
  href: string,
  area: string,
  owner: string,
  ownerLabel: string,
): AuditedLink {
  return { label, href: (href ?? '').trim(), area, owner, ownerLabel, ...judge(href ?? '') };
}

/**
 * Reads the whole content document and returns every outbound address in it.
 *
 * Written defensively throughout: this runs against live content, a section
 * that has never been created arrives as `{}`, and a screen whose job is to
 * find broken links is the worst possible screen to crash on one.
 */
export function auditLinks(content: Partial<SiteContent>): AuditedLink[] {
  const found: AuditedLink[] = [];

  for (const [index, item] of (content.nav ?? []).entries()) {
    found.push(
      entry(
        item?.label?.tr || `Menü ${index + 1}`,
        item?.href ?? '',
        'Üst menü',
        '/navigation',
        'Menü & Footer',
      ),
    );
  }

  const hero = content.hero;
  if (hero?.primaryCta) {
    found.push(
      entry(hero.primaryCta.label?.tr || 'Birincil buton', hero.primaryCta.href ?? '', 'Hero', '/hero', 'Hero'),
    );
  }
  if (hero?.secondaryCta) {
    found.push(
      entry(
        hero.secondaryCta.label?.tr || 'İkincil buton',
        hero.secondaryCta.href ?? '',
        'Hero',
        '/hero',
        'Hero',
      ),
    );
  }

  const cta = content.cta;
  if (cta?.button) {
    found.push(
      entry(cta.button.label?.tr || 'CTA butonu', cta.button.href ?? '', 'CTA bandı', '/hero', 'Hero'),
    );
  }

  for (const [index, service] of (content.services ?? []).entries()) {
    if (!service?.cta?.href && !service?.cta?.label?.tr) continue;
    found.push(
      entry(
        service.cta?.label?.tr || service.title?.tr || `Hizmet ${index + 1}`,
        service.cta?.href ?? '',
        'Hizmet kartı',
        '/services',
        'Hizmetler',
      ),
    );
  }

  for (const [index, reference] of (content.references ?? []).entries()) {
    if (!reference?.website) continue;
    found.push(
      entry(
        reference.name || `Referans ${index + 1}`,
        reference.website,
        'Referans',
        '/references',
        'Referanslar',
      ),
    );
  }

  for (const [index, social] of (content.brand?.social ?? []).entries()) {
    found.push(
      entry(social?.label || `Sosyal ${index + 1}`, social?.href ?? '', 'Sosyal medya', '/brand', 'Marka & Tema'),
    );
  }

  for (const column of content.footer?.columns ?? []) {
    for (const [index, link] of (column?.links ?? []).entries()) {
      found.push(
        entry(
          link?.label?.tr || `Footer ${index + 1}`,
          link?.href ?? '',
          `Footer — ${column?.title?.tr ?? 'sütun'}`,
          '/navigation',
          'Menü & Footer',
        ),
      );
    }
  }

  const logiops = content.logiops;
  if (logiops?.secondaryCta) {
    found.push(
      entry(
        logiops.secondaryCta.label?.tr || 'LogiOps ikincil buton',
        logiops.secondaryCta.href ?? '',
        'LogiOps sayfası',
        '/visual',
        'Canlı Düzenleme',
      ),
    );
  }

  const contact = content.contact;
  if (contact?.email) {
    found.push(entry('E-posta', `mailto:${contact.email}`, 'İletişim', '/contact', 'İletişim'));
  }
  if (contact?.phone) {
    found.push(
      entry('Telefon', `tel:${contact.phone.replace(/\s/g, '')}`, 'İletişim', '/contact', 'İletişim'),
    );
  }

  return found;
}

/** How many need attention, for the screen's summary line. */
export function countProblems(links: AuditedLink[]): number {
  return links.filter((link) => link.health === 'empty' || link.health === 'placeholder' || link.health === 'insecure')
    .length;
}
