/**
 * Client-side contact submission. The static site has no server of its own —
 * the form posts to the Nexuva backend (Render Web Service), which owns
 * persistence. Configure NEXT_PUBLIC_API_URL at build time.
 */
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  company?: string;
  service?: string;
  budget?: string;
  /** The privacy notice checkbox. Recorded with a timestamp on the server. */
  consent?: boolean;
  /** Honeypot. A real visitor never sees the field that fills this. */
  website?: string;

  /** Attribution, filled by the tracker from the visitor's own session. */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  referrer?: string;
}

/**
 * Why the submission failed, so the form can say something true rather than a
 * generic apology. `rate-limit` in particular is not a fault the visitor can
 * fix by retrying immediately.
 */
export type ContactError = 'invalid' | 'network' | 'server' | 'rate-limit';

export interface ContactResult {
  ok: boolean;
  error?: ContactError;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContact(input: ContactInput): Promise<ContactResult> {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim();
  const message = (input.message ?? '').trim();

  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 5) {
    return { ok: false, error: 'invalid' };
  }

  try {
    // The controller is @Controller('website/contact'). Posting to /contact
    // returned 404 on every submission and silently lost the lead.
    const res = await fetch(`${API_BASE}/website/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.slice(0, 120),
        email: email.slice(0, 160),
        phone: (input.phone ?? '').trim().slice(0, 60),
        subject: (input.subject ?? '').trim().slice(0, 160),
        message: message.slice(0, 4000),
        company: (input.company ?? '').trim().slice(0, 160),
        service: (input.service ?? '').trim().slice(0, 120),
        budget: (input.budget ?? '').trim().slice(0, 60),
        consent: input.consent === true,
        website: (input.website ?? '').slice(0, 200),
        // Only sent when there is something to send: the API rejects unknown
        // keys but not absent ones, and an empty string is a value that would
        // be stored as an answer of "".
        ...(input.utmSource ? { utmSource: input.utmSource.slice(0, 120) } : {}),
        ...(input.utmMedium ? { utmMedium: input.utmMedium.slice(0, 120) } : {}),
        ...(input.utmCampaign ? { utmCampaign: input.utmCampaign.slice(0, 160) } : {}),
        ...(input.landingPath ? { landingPath: input.landingPath.slice(0, 200) } : {}),
        ...(input.referrer ? { referrer: input.referrer.slice(0, 300) } : {}),
      }),
    });

    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, error: 'rate-limit' };
    // 4xx means this submission will not succeed on retry either; only 5xx is
    // worth presenting as a transient server problem.
    if (res.status >= 400 && res.status < 500) return { ok: false, error: 'invalid' };
    return { ok: false, error: 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
