import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The messages the platform sends on its own.
 *
 * Seeded rather than hardcoded: the words are the company's, and the
 * acknowledgement a customer receives is its first written reply. Editing that
 * should not need a developer, and the defaults exist so nothing is blank on
 * the first day.
 */
export const DEFAULT_TEMPLATES = [
  {
    key: 'lead_received',
    name: 'Talebiniz alındı',
    description: 'Siteden talep gönderen kişiye otomatik gider.',
    subject: 'Talebiniz alındı — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Talebiniz bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.',
      '',
      'Talep numaranız: **{{talep_no}}**',
      'Konu: {{hizmet}}',
      '',
      'İyi çalışmalar dileriz.',
      '{{firma_adi}}',
    ].join('\n'),
  },
  {
    key: 'lead_notify',
    name: 'Yeni talep bildirimi (ekibe)',
    description: 'Yeni bir talep geldiğinde ekibe gider.',
    subject: 'Yeni talep: {{ad}} — {{hizmet}}',
    body: [
      'Yeni bir talep geldi.',
      '',
      'Ad Soyad: {{ad}}',
      'Firma: {{firma}}',
      'E-posta: {{eposta}}',
      'Telefon: {{telefon}}',
      'Hizmet: {{hizmet}}',
      'Bütçe: {{butce}}',
      'Talep no: {{talep_no}}',
      '',
      'Mesaj:',
      '{{mesaj}}',
    ].join('\n'),
  },
  {
    key: 'proposal_preparing',
    name: 'Teklif hazırlanıyor',
    description: 'Talep incelemeye alındığında elle gönderilir.',
    subject: 'Teklifiniz hazırlanıyor — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Talebinizi inceledik ve teklifinizi hazırlamaya başladık.',
      'Hazır olduğunda size ileteceğiz.',
      '',
      '{{firma_adi}}',
    ].join('\n'),
  },
  {
    key: 'meeting_scheduled',
    name: 'Toplantı planlandı',
    description: 'Görüşme tarihi belirlendiğinde gönderilir.',
    subject: 'Görüşmemiz planlandı — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Görüşmemiz planlandı. Detayları aşağıda bulabilirsiniz.',
      '',
      '{{mesaj}}',
      '',
      'Görüşmek üzere.',
      '{{firma_adi}}',
    ].join('\n'),
  },
  {
    key: 'proposal_sent',
    name: 'Teklif gönderildi',
    description: 'Teklif iletildiğinde gönderilir.',
    subject: 'Teklifiniz hazır — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Teklifimizi hazırladık. Ekte / aşağıda bulabilirsiniz.',
      '',
      '{{mesaj}}',
      '',
      'Sorularınız için bize yazabilirsiniz.',
      '{{firma_adi}}',
    ].join('\n'),
  },
  {
    key: 'status_changed',
    name: 'Talep durumu değişti',
    description: 'Bir talebin durumu değiştiğinde müşteriye gönderilebilir. Varsayılan olarak kapalı.',
    subject: 'Talebinizde gelişme var — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Talebinizin durumu **{{durum}}** olarak güncellendi.',
      '',
      'Sorularınız için bu maili yanıtlayabilirsiniz.',
      '{{firma_adi}}',
    ].join('\n'),
    // Off until somebody decides they want it. A customer who hears from the
    // system every time an internal column changes learns to ignore it.
    enabled: false,
  },
  {
    key: 'lead_assigned',
    name: 'Talep atandı (ekibe)',
    description: 'Bir talep bir kullanıcıya atandığında o kişiye gönderilir.',
    subject: 'Sana bir talep atandı — {{talep_no}}',
    body: [
      '{{ad}} adına gelen talep sana atandı.',
      '',
      'Firma: {{firma}}',
      'Hizmet: {{hizmet}}',
      'Durum: {{durum}}',
      '',
      'Mesaj:',
      '{{mesaj}}',
    ].join('\n'),
  },
  {
    key: 'deal_won',
    name: 'Anlaşma sağlandı',
    description: 'Talep "Kazanıldı" olarak işaretlendiğinde müşteriye gönderilir.',
    subject: 'Birlikte çalışıyoruz — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Anlaştığımız için teşekkür ederiz. {{hizmet}} çalışmasına başlıyoruz.',
      '',
      // Says what happens next rather than only thanking them. The first
      // message after a yes is where a customer decides whether they made the
      // right call, and "we will be in touch" is not an answer.
      'Bundan sonraki adımlar:',
      '',
      '1. Süreci yürütecek ekip arkadaşımız sizinle iletişime geçecek.',
      '2. İhtiyaçlarınızı ve önceliklerinizi birlikte netleştireceğiz.',
      '3. Çalışma planını ve zaman aralığını sizinle paylaşacağız.',
      '',
      'Bu arada aklınıza takılan her şey için bu maili yanıtlayabilirsiniz.',
      '',
      'Talep numaranız: **{{talep_no}}**',
      '',
      '{{firma_adi}}',
    ].join('\n'),
  },
  {
    key: 'deal_lost',
    name: 'Bu kez olmadı',
    description:
      'Talep "Kaybedildi" olarak işaretlendiğinde gönderilebilir. Varsayılan olarak kapalı.',
    subject: 'Görüşmemiz için teşekkürler — {{talep_no}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Bu çalışmada birlikte ilerlemeyeceğimizi anlıyoruz. Ayırdığınız zaman ve',
      'bize gösterdiğiniz ilgi için teşekkür ederiz.',
      '',
      'İleride {{hizmet}} ya da başka bir konuda yardımcı olabileceğimiz bir şey',
      'olursa kapımız açık — bu maili yanıtlamanız yeterli.',
      '',
      'İşlerinizde başarılar dileriz.',
      '',
      '{{firma_adi}}',
    ].join('\n'),
    // Off by default. A closing note is the right gesture when a person decides
    // to send it; sent automatically to everybody who went quiet, it reads as a
    // system giving up on them.
    enabled: false,
  },
  {
    key: 'thank_you',
    name: 'Teşekkür',
    description: 'İş tamamlandığında gönderilir.',
    subject: 'Teşekkür ederiz — {{firma}}',
    body: [
      'Merhaba {{ad}},',
      '',
      'Bizi tercih ettiğiniz için teşekkür ederiz. Birlikte çalışmak keyifliydi.',
      '',
      '{{firma_adi}}',
    ].join('\n'),
  },
] as const;

/** Every placeholder a template may use, with what it means. */
export const TEMPLATE_VARIABLES = [
  { key: 'ad', label: 'Talebi gönderen kişinin adı' },
  { key: 'firma', label: 'Talebi gönderen firma' },
  { key: 'eposta', label: 'E-posta adresi' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'hizmet', label: 'İlgilendiği hizmet' },
  { key: 'butce', label: 'Belirttiği bütçe' },
  { key: 'talep_no', label: 'Talep numarası' },
  { key: 'mesaj', label: 'Talep metni' },
  { key: 'durum', label: 'Talebin bulunduğu aşama' },
  { key: 'firma_adi', label: 'Sizin firma adınız' },
  { key: 'site_adresi', label: 'Web sitenizin adresi' },
] as const;

@Injectable()
export class MailTemplateService {
  private readonly logger = new Logger(MailTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Templates for a tenant, creating the defaults the first time.
   *
   * Seeded on read rather than by a migration, so a tenant that appears later
   * still gets them and nobody has to remember a separate step.
   */
  async list(tenantId: string) {
    const existing = await this.prisma.mailTemplate.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });

    const missing = DEFAULT_TEMPLATES.filter(
      (template) => !existing.some((row) => row.key === template.key),
    );

    if (missing.length > 0) {
      await this.prisma.mailTemplate.createMany({
        data: missing.map((template) => ({ tenantId, ...template })),
        skipDuplicates: true,
      });
      this.logger.log(`${missing.length} varsayılan mail şablonu oluşturuldu (${tenantId}).`);
      return this.prisma.mailTemplate.findMany({ where: { tenantId }, orderBy: { key: 'asc' } });
    }

    return existing;
  }

  async findByKey(tenantId: string, key: string) {
    await this.list(tenantId);
    const template = await this.prisma.mailTemplate.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!template) throw new NotFoundException(`Şablon "${key}" bulunamadı`);
    return template;
  }

  async update(
    tenantId: string,
    key: string,
    input: { subject?: string; body?: string; enabled?: boolean },
  ) {
    await this.findByKey(tenantId, key);
    return this.prisma.mailTemplate.update({
      where: { tenantId_key: { tenantId, key } },
      data: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }
}

/**
 * Substitutes {{placeholders}}.
 *
 * A placeholder with no value becomes an empty string rather than staying on
 * screen: a customer receiving "Merhaba {{ad}}" is worse than one receiving
 * "Merhaba".
 */
export function fillTemplate(text: string, values: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, name: string) => values[name] ?? '');
}

/**
 * Wraps a plain-text body in the company's colours.
 *
 * Deliberately simple HTML with inline styles and a table: mail clients have
 * no modern CSS, and anything cleverer arrives broken in Outlook. Bold
 * (**text**) and paragraph breaks are honoured because those are what the
 * templates actually use.
 */
export function renderEmailHtml(params: {
  body: string;
  brandName: string;
  brandColor: string;
  logoUrl?: string | null;
  siteUrl?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
}): string {
  const paragraphs = params.body
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');

      // A block whose every line is numbered becomes a real list. Written as
      // "1. …" in the editor because that is how somebody types steps; left as
      // one run-on paragraph it reads as a wall, which is exactly the moment a
      // customer stops reading — the step list is what they wanted.
      if (lines.length > 1 && lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
        const items = lines
          .map(
            (line) =>
              `<li style="margin:0 0 8px;line-height:1.6;">${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`,
          )
          .join('');
        return `<ol style="margin:0 0 16px;padding-left:20px;color:#1f2937;font-size:15px;">${items}</ol>`;
      }

      return `<p style="margin:0 0 16px;line-height:1.6;color:#1f2937;font-size:15px;">${inline(block)}</p>`;
    })
    .join('');

  // The line a phone shows next to the subject. Without it clients pull the
  // first thing they find, which is usually the logo's alt text.
  const preheader = escapeHtml(
    params.body.replace(/\*\*/g, '').split('\n').find((line) => line.trim().length > 0)?.slice(0, 120) ??
      '',
  );

  const button =
    params.buttonLabel && params.buttonUrl
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(params.buttonUrl)}" style="display:inline-block;background:${escapeHtml(params.brandColor)};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(params.buttonLabel)}</a></p>`
      : '';

  const header = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="${escapeHtml(params.brandName)}" style="max-height:40px;" />`
    : `<span style="font-size:20px;font-weight:700;color:${escapeHtml(params.brandColor)};">${escapeHtml(params.brandName)}</span>`;

  // Light only, declared. Without color-scheme some clients invert the whole
  // message in dark mode and the white card turns dark grey with black text on
  // it — which is worse than either theme done deliberately.
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(params.brandName)}</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 28px;border-bottom:4px solid ${escapeHtml(params.brandColor)};">${header}</td></tr>
    <tr><td style="padding:28px;">${paragraphs}${button}</td></tr>
    <tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;">
      ${escapeHtml(params.brandName)}${params.siteUrl ? ` · <a href="${escapeHtml(params.siteUrl)}" style="color:#6b7280;">${escapeHtml(params.siteUrl.replace(/^https?:\/\//, ''))}</a>` : ''}
      <br />
      Bu e-postayı ${escapeHtml(params.brandName)} ile iletişime geçtiğiniz için aldınız.
    </td></tr>
  </table>
</body></html>`;
}

/** Bold and single line breaks inside one block of text. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
