'use server';

import { randomUUID } from 'crypto';
import type { ContactMessage } from '@nexuva/types';
import { addMessage } from '../../lib/messages';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContact(input: ContactInput): Promise<{ ok: boolean; error?: string }> {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim();
  const message = (input.message ?? '').trim();

  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 5) {
    return { ok: false, error: 'invalid' };
  }

  const msg: ContactMessage = {
    id: randomUUID(),
    name: name.slice(0, 120),
    email: email.slice(0, 160),
    phone: (input.phone ?? '').trim().slice(0, 60),
    subject: (input.subject ?? '').trim().slice(0, 160),
    message: message.slice(0, 4000),
    createdAt: new Date().toISOString(),
    read: false,
  };

  try {
    await addMessage(msg);
    return { ok: true };
  } catch {
    return { ok: false, error: 'server' };
  }
}
