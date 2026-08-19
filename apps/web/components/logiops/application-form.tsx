'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { submitContact, type ContactError } from '../../lib/contact-api';
import { readAttribution, trackFormSubmit } from '../analytics';

/**
 * The LogiOps membership application.
 *
 * LogiOps has no self-service sign-up — its only auth routes are a sign-in and
 * a first-login OTP, and new companies are set up by a person. So the honest
 * front door for a firm that wants access is a form here, not a login screen
 * they cannot complete.
 *
 * It posts through the ordinary contact endpoint, which means the application
 * arrives in the CRM alongside every other enquiry, with the same attribution,
 * the same notification and the same audit trail. A separate pipeline for this
 * one form would have meant a second inbox nobody remembers to check.
 *
 * The operational questions are folded into the message body rather than added
 * as fields. The API validates with `forbidNonWhitelisted`, so a property the
 * DTO does not list is not ignored — the whole submission is rejected. That
 * has already cost this project every enquiry for a period, silently, and the
 * lesson is worth more than four tidy columns in the database.
 */

const MODES = [
  'Hava kargo',
  'Deniz taşımacılığı',
  'Kara taşımacılığı',
  'Birden fazla mod',
] as const;

const SCALES = [
  '1–5 kullanıcı',
  '6–20 kullanıcı',
  '21–50 kullanıcı',
  '50+ kullanıcı',
] as const;

/** How the enquiry is labelled in the CRM, so applications are filterable. */
const SERVICE_LABEL = 'LogiOps Üyelik Başvurusu';

export function LogiOpsApplicationForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [failure, setFailure] = useState<ContactError | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? '').trim();

    // The operational profile, written into the message so a person reading
    // the lead sees it without opening anything else.
    const profile = [
      `Faaliyet alanı: ${value('mode') || 'belirtilmedi'}`,
      `Ekip büyüklüğü: ${value('scale') || 'belirtilmedi'}`,
      value('iata') ? `IATA acente kodu: ${value('iata')}` : null,
      '',
      value('message') || 'Ek not girilmedi.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    setStatus('sending');
    const result = await submitContact({
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      company: value('company'),
      subject: `LogiOps başvurusu — ${value('company') || value('name')}`,
      service: SERVICE_LABEL,
      message: profile,
      consent: data.get('consent') === 'on',
      website: value('website'),
      ...readAttribution(),
    });

    if (result.ok) {
      setFailure(null);
      setStatus('success');
      trackFormSubmit(window.location.pathname);
      form.reset();
    } else {
      setFailure(result.error ?? 'server');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center rounded-[var(--r-lg)] border border-overlay/12 bg-card p-10 text-center sm:p-14">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </span>
        <h2 className="mt-6 font-heading text-2xl text-fg">Başvurunuz bize ulaştı</h2>
        <p className="prose-measure mx-auto mt-3 text-sm">
          Ekibimiz başvurunuzu inceleyip firmanız için erişim tanımlaması hakkında sizinle
          iletişime geçecek. Bu sırada LogiOps’un bugün neler yaptığını sayfanın üst
          bölümünden inceleyebilirsiniz.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-8">
          Yeni başvuru gönder
        </button>
      </div>
    );
  }

  const failureMessage =
    failure === 'rate-limit'
      ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
      : failure === 'invalid'
        ? 'Bazı alanlar eksik veya hatalı görünüyor. Lütfen kontrol edip tekrar deneyin.'
        : 'Başvuru gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.';

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[var(--r-lg)] border border-overlay/12 bg-card p-6 sm:p-9"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="company" label="Firma adı" placeholder="Örn. Anadolu Lojistik A.Ş." required />
        <Field name="name" label="Yetkili adı soyadı" placeholder="Ad Soyad" required />
        <Field name="email" label="Kurumsal e-posta" type="email" placeholder="ad@firma.com" required />
        <Field name="phone" label="Telefon" type="tel" placeholder="+90 5xx xxx xx xx" />
        <Choice name="mode" label="Faaliyet alanı" options={[...MODES]} />
        <Choice name="scale" label="Sisteme girecek ekip" options={[...SCALES]} />
      </div>

      <div className="mt-5">
        <Field
          name="iata"
          label="IATA acente kodu"
          placeholder="Varsa — hava kargo acentesiyseniz"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="logiops-message" className="nx-label">
          Eklemek istedikleriniz
        </label>
        <textarea
          id="logiops-message"
          name="message"
          rows={5}
          placeholder="Bugün hangi araçları kullanıyorsunuz, en çok nerede zaman kaybediyorsunuz?"
          className="nx-field resize-none"
        />
      </div>

      {/* Hidden from people, not from bots — which is the point. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="logiops-website">Web sitesi</label>
        <input id="logiops-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-muted">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-overlay/30"
          style={{ accentColor: 'var(--gold)' }}
        />
        <span>
          Başvurumun değerlendirilmesi ve benimle iletişime geçilmesi amacıyla paylaştığım
          bilgilerin işlenmesini kabul ediyorum.
        </span>
      </label>

      {status === 'error' && (
        <p role="alert" className="mt-5 text-sm text-red-500">
          {failureMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="btn-primary mt-7 w-full justify-center disabled:opacity-60"
      >
        {status === 'sending' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gönderiliyor…
          </>
        ) : (
          <>
            Başvuruyu Gönder
            <Send className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`logiops-${name}`} className="nx-label">
        {label}
        {required && <span className="nx-required"> *</span>}
      </label>
      <input
        id={`logiops-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="nx-field"
      />
    </div>
  );
}

function Choice({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <div>
      <label htmlFor={`logiops-${name}`} className="nx-label">
        {label}
      </label>
      <select id={`logiops-${name}`} name={name} defaultValue="" className="nx-field nx-select">
        <option value="">Seçiniz</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
