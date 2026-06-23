import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  provider: (process.env.EMAIL_PROVIDER ?? 'resend') as 'resend' | 'sendgrid' | 'smtp',
  from: process.env.EMAIL_FROM ?? 'noreply@nexuva.com',
  fromName: process.env.EMAIL_FROM_NAME ?? 'Nexuva OS',
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE === 'true',
  },
}));
