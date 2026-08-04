import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';
export const NO_ENVELOPE_KEY = 'noEnvelope';

/**
 * Note carried in the envelope's `message` for the caller to display.
 * Without it the field is an empty string, which most reads want.
 */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

/**
 * Sends the handler's return value as-is, outside the standard envelope.
 *
 * For the few responses that cannot carry one: a 204 has no body at all, and a
 * file download is bytes rather than JSON. Everything else is enveloped, so
 * reaching for this should be rare and deliberate.
 */
export const NoEnvelope = () => SetMetadata(NO_ENVELOPE_KEY, true);
