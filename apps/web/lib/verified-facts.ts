/**
 * Facts about Nexuva that the site may state, on the page and to machines.
 *
 * Confirmed by the owner on 21.11.2026. These replace whatever the panel's
 * contact fields hold: the panel was seeded with an example phone number
 * (+90 212 555 0100) and an address in Levent that were never Nexuva's, and
 * the database is not edited from here. Change a value only in a reviewed
 * commit, after the owner confirms it.
 */
export const COMPANY = {
  phone: '0535 529 5700',
  /** E.164, for tel: links and structured data. */
  phoneE164: '+905355295700',
  locality: 'Beylikdüzü',
  region: 'İstanbul',
  address: 'Beylikdüzü, İstanbul',
  foundingYear: 2022,
  since: '2022’den beri',
} as const;

/** A tel: link for a displayed number. */
export function telHref(): string {
  return `tel:${COMPANY.phoneE164}`;
}

/** The confirmed phone number, whatever the panel holds. */
export function confirmedPhone(_value?: string): string {
  return COMPANY.phone;
}

/** The confirmed address, whatever the panel holds. */
export function confirmedAddress(_value?: string): string {
  return COMPANY.address;
}

/**
 * The contact block as it may be sent to the browser: the confirmed phone and
 * address in place of the panel's.
 */
export function publicContact<T extends { phone: string; address: { tr?: string; en?: string } }>(
  contact: T,
): T {
  return { ...contact, phone: COMPANY.phone, address: { tr: COMPANY.address, en: 'Beylikdüzü, Istanbul' } };
}
