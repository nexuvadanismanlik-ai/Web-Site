/**
 * Facts about Nexuva that machines are allowed to repeat.
 *
 * Structured data is read automatically and repeated with confidence: a phone
 * number in JSON-LD ends up in a knowledge panel, an address in an assistant's
 * answer. The panel's contact fields were seeded with values that have not been
 * confirmed (the phone number is in the 555 range used for examples), so they
 * are kept out of structured data and llms.txt until somebody who knows says
 * they are right.
 *
 * The visible page still shows whatever the panel holds — that is editorial and
 * fixed in the panel. This list governs only what is asserted to machines.
 *
 * To confirm a value: add it here exactly as it appears in the panel, in a
 * reviewed commit. To withdraw one: remove it.
 */
const CONFIRMED_PHONES: readonly string[] = [];
const CONFIRMED_ADDRESSES: readonly string[] = [];

/** Example and test ranges that must never be published as real. */
const PLACEHOLDER_PHONE = /\b555\s?0[01]\d\d\b/;

export function confirmedPhone(value: string | undefined): string | undefined {
  const phone = value?.trim();
  if (!phone || PLACEHOLDER_PHONE.test(phone)) return undefined;
  return CONFIRMED_PHONES.includes(phone) ? phone : undefined;
}

export function confirmedAddress(value: string | undefined): string | undefined {
  const address = value?.trim();
  if (!address) return undefined;
  return CONFIRMED_ADDRESSES.includes(address) ? address : undefined;
}
