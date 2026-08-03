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
}

export interface ContactResult {
  ok: boolean;
  error?: 'invalid' | 'network' | 'server';
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
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.slice(0, 120),
        email: email.slice(0, 160),
        phone: (input.phone ?? '').trim().slice(0, 60),
        subject: (input.subject ?? '').trim().slice(0, 160),
        message: message.slice(0, 4000),
      }),
    });

    if (!res.ok) return { ok: false, error: 'server' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
