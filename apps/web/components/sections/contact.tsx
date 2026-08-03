'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Mail, Phone, MapPin, Send } from 'lucide-react';
import type { ContactContent } from '@nexuva/types';
import { t, getUi, type Locale } from '../../lib/i18n';
import { submitContact } from '../../lib/contact-api';

export function Contact({
  contact,
  locale,
  hideHeading = false,
}: {
  contact: ContactContent;
  locale: Locale;
  hideHeading?: boolean;
}) {
  const ui = getUi(locale);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus('sending');
    const res = await submitContact({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      subject: String(data.get('subject') ?? ''),
      message: String(data.get('message') ?? ''),
    });
    if (res.ok) {
      setStatus('success');
      form.reset();
    } else {
      setStatus('error');
    }
  }

  const infoItems = [
    { icon: Mail, label: contact.email, href: `mailto:${contact.email}` },
    { icon: Phone, label: contact.phone, href: `tel:${contact.phone.replace(/\s/g, '')}` },
    { icon: MapPin, label: t(contact.address, locale), href: undefined },
  ];

  return (
    <section id="contact" className="section">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Info */}
          <div>
            {!hideHeading && (
              <>
                <span className="eyebrow" data-edit="contact.badge">
                  <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
                  {t(contact.badge, locale)}
                </span>
                <h2
                  className="mt-5 font-heading text-3xl font-bold text-fg text-balance sm:text-4xl md:text-[2.6rem] md:leading-[1.1]"
                  data-edit="contact.title"
                >
                  {t(contact.title, locale)}
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-muted" data-edit="contact.description">
                  {t(contact.description, locale)}
                </p>
              </>
            )}

            <div className={hideHeading ? 'space-y-3' : 'mt-9 space-y-3'}>
              {infoItems.map((item, i) => {
                const paths = ['contact.email', 'contact.phone', 'contact.address'];
                const Inner = (
                  <div className="flex items-center gap-4 rounded-2xl border border-overlay/10 bg-card px-5 py-4 shadow-card transition-colors hover:border-overlay/25">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl brand-gradient-bg">
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-sm text-fg" data-edit={paths[i]}>{item.label}</span>
                  </div>
                );
                return item.href ? (
                  <a key={i} href={item.href} className="block">
                    {Inner}
                  </a>
                ) : (
                  <div key={i}>{Inner}</div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="glass rounded-4xl p-6 shadow-card sm:p-9">
            {status === 'success' ? (
              <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <p className="mt-6 max-w-sm text-lg text-fg">{ui.formSuccess}</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="btn-ghost mt-8"
                  type="button"
                >
                  {locale === 'tr' ? 'Yeni mesaj gönder' : 'Send another message'}
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field name="name" label={ui.formName} placeholder={ui.namePlaceholder} required />
                  <Field
                    name="email"
                    label={ui.formEmail}
                    placeholder={ui.emailPlaceholder}
                    type="email"
                    required
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field name="phone" label={ui.formPhone} placeholder={ui.phonePlaceholder} />
                  <Field name="subject" label={ui.formSubject} placeholder={ui.subjectPlaceholder} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted">
                    {ui.formMessage}
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder={ui.messagePlaceholder}
                    className="w-full resize-none rounded-2xl border border-overlay/10 bg-overlay/[0.04] px-4 py-3 text-sm text-fg placeholder:text-faint transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                {status === 'error' && (
                  <p className="text-sm text-red-400">{ui.formError}</p>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {ui.formSending}
                    </>
                  ) : (
                    <>
                      {ui.formSubmit}
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
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
      <label className="mb-2 block text-sm font-medium text-muted">
        {label}
        {required && <span className="text-brand-dyn"> *</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-overlay/10 bg-overlay/[0.04] px-4 py-3 text-sm text-fg placeholder:text-faint transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
    </div>
  );
}
