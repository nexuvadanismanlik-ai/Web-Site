import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface IEmailProvider {
  send(params: SendEmailParams): Promise<void>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('email.provider', 'resend');
    this.from = `${config.get<string>('email.fromName', 'Nexuva OS')} <${config.get<string>('email.from', 'noreply@nexuva.com')}>`;
  }

  async send(params: SendEmailParams): Promise<void> {
    const to = Array.isArray(params.to) ? params.to : [params.to];
    const from = params.from ?? this.from;

    this.logger.log(`[${this.provider}] Sending email to ${to.join(', ')}: ${params.subject}`);

    switch (this.provider) {
      case 'resend':
        await this.sendViaResend({ ...params, to, from });
        break;
      case 'sendgrid':
        await this.sendViaSendGrid({ ...params, to, from });
        break;
      case 'smtp':
        await this.sendViaSMTP({ ...params, to, from });
        break;
      default:
        throw new NotImplementedException(`Email provider "${this.provider}" not implemented`);
    }
  }

  private async sendViaResend(params: SendEmailParams & { to: string[]; from: string }) {
    const apiKey = this.config.get<string>('email.resendApiKey');
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }
  }

  private async sendViaSendGrid(_params: SendEmailParams & { to: string[]; from: string }) {
    throw new NotImplementedException('SendGrid provider not yet implemented');
  }

  private async sendViaSMTP(_params: SendEmailParams & { to: string[]; from: string }) {
    throw new NotImplementedException('SMTP provider not yet implemented');
  }
}
