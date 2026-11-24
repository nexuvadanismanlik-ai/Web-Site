import { WHATSAPP_HREF } from '../../lib/verified-facts';
import { Icon } from '../icon';

/**
 * One-tap WhatsApp. Opens a chat with the company number and the opening line
 * already typed, so the visitor only presses send.
 */
export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp ile yazın"
      data-cta="whatsapp"
      className="wa-float fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
    >
      <Icon name="whatsapp" className="h-7 w-7" />
    </a>
  );
}
