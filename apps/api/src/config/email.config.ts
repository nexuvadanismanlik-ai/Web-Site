import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  provider: (process.env.EMAIL_PROVIDER ?? 'resend') as 'resend' | 'sendgrid' | 'smtp',
  from: process.env.EMAIL_FROM ?? 'noreply@nexuva.com',
  fromName: process.env.EMAIL_FROM_NAME ?? 'Nexuva OS',
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  // Where new website enquiries are announced. Comma-separated. When unset the
  // notification is skipped — the enquiry is still stored and visible in the
  // admin panel, so a missing address never costs a lead.
  contactNotifyTo: (process.env.CONTACT_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE === 'true',
  },
}));
