'use client';

import { useState, type FormEvent } from 'react';
import { confirmedAddress, confirmedPhone } from '../../lib/verified-facts';
import { CheckCircle2, Loader2, Mail, Phone, MapPin, Send } from 'lucide-react';
import type { ContactContent, IntegrationsContent, UiText } from '@nexuva/types';
import { t, getUi } from '../../lib/i18n';
import { submitContact, type ContactError } from '../../lib/contact-api';
import { readAttribution, trackFormSubmit } from '../analytics';
import { reportConversion } from '../integrations';

export function Contact({
  contact,
  services = [],
  budgets = [],
  uiText,
  integrations,
  hideHeading = false,
}: {
  contact: ContactContent;
  /** Service names, so an enquiry says which one it is about. */
  services?: string[];
  /**
   * Budget bands. Passed in from the server rather than imported here: this is
   * a client component, and importing the shared package pulls its whole barrel
   * — zod included — into the browser for the sake of five strings.
   */
  budgets?: string[];
  /** Panel-managed labels. Falls back to the built-in wording when absent. */
  uiText?: UiText;
  /** Ad platform ids, so a submission can be reported as a conversion. */
  integrations?: IntegrationsContent;
  hideHeading?: boolean;
}) {
  const ui = getUi(uiText);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [failure, setFailure] = useState<ContactError | null>(null);

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
      company: String(data.get('company') ?? ''),
      service: String(data.get('service') ?? ''),
      budget: String(data.get('budget') ?? ''),
      consent: data.get('consent') === 'on',
      website: String(data.get('website') ?? ''),
      // How this visitor found us, from their own session. Without it a
      // campaign report stops at the visit and never reaches the enquiry.
      ...readAttribution(),
    });
    if (res.ok) {
      setFailure(null);
      setStatus('success');
      // Counted here rather than on the server so that the conversion belongs
      // to the page the visitor was actually on.
      trackFormSubmit(window.location.pathname);
      // Ad platforms need their own event to attribute the conversion to the
      // click that caused it. Guarded internally; a blocked tag cannot throw.
      reportConversion(integrations);
      form.reset();
    } else {
      setFailure(res.error ?? 'server');
      setStatus('error');
    }
  }

  /** Being told to wait is different from being told it broke. */
  const failureMessage =
    failure === 'rate-limit'
      ? ui.formRateLimit
      : failure === 'invalid'
        ? ui.formInvalid
        : ui.formError;

  // Phone and address are shown only once confirmed (lib/verified-facts.ts);
  // until then the panel's values stay out of the page entirely.
  const phone = confirmedPhone(contact.phone);
  const address = confirmedAddress(t(contact.address));
  const infoItems = [
    { icon: Mail, label: contact.email, href: `mailto:${contact.email}`, path: 'contact.email' },
    ...(phone
      ? [
          {
            icon: Phone,
            label: phone,
            href: `tel:${phone.replace(/\s/g, '')}`,
            path: 'contact.phone',
          },
        ]
      : []),
    ...(address
      ? [{ icon: MapPin, label: address, href: undefined, path: 'contact.address' }]
      : []),
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
                  <span className="brand-gradient-bg h-1.5 w-1.5 rounded-full" />
                  {t(contact.badge)}
                </span>
                <h2
                  className="font-heading text-fg mt-5 text-balance text-3xl font-bold sm:text-4xl md:text-[2.6rem] md:leading-[1.1]"
                  data-edit="contact.title"
                >
                  {t(contact.title)}
                </h2>
                <p
                  className="text-muted mt-5 max-w-md text-base leading-relaxed"
                  data-edit="contact.description"
                >
                  {t(contact.description)}
                </p>
              </>
            )}

            <div className={hideHeading ? 'space-y-3' : 'mt-9 space-y-3'}>
              {infoItems.map((item) => {
                const Inner = (
                  <div className="border-overlay/10 bg-card shadow-card hover:border-overlay/25 flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors">
                    <div className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl">
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-fg min-w-0 break-all text-sm" data-edit={item.path}>
                      {item.label}
                    </span>
                  </div>
                );
                return item.href ? (
                  <a key={item.path} href={item.href} className="block">
                    {Inner}
                  </a>
                ) : (
                  <div key={item.path}>{Inner}</div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="glass rounded-4xl shadow-card p-6 sm:p-9">
            {status === 'success' ? (
              <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <p className="text-fg mt-6 max-w-sm text-lg">{ui.formSuccess}</p>
                <button onClick={() => setStatus('idle')} className="btn-ghost mt-8" type="button">
                  {'Yeni mesaj gönder'}
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    name="name"
                    label={ui.formName}
                    placeholder={ui.namePlaceholder}
                    required
                  />
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
                  <Field
                    name="company"
                    label={ui.formCompany}
                    placeholder={ui.companyPlaceholder}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Choice name="service" label={ui.formService} options={services} />
                  <Choice name="budget" label={ui.formBudget} options={budgets} />
                </div>
                <Field name="subject" label={ui.formSubject} placeholder={ui.subjectPlaceholder} />
                <div>
                  <label htmlFor="contact-message" className="nx-label">
                    {ui.formMessage}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder={ui.messagePlaceholder}
                    className="nx-field resize-none"
                  />
                </div>

                {/* Honeypot. Hidden from people, not from bots — which is the
                    point. aria-hidden and tabIndex keep it out of the way of
                    anyone using a screen reader or the keyboard. */}
                <div className="absolute left-[-9999px]" aria-hidden="true">
                  <label htmlFor="contact-website">Web sitesi</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <label className="text-muted flex items-start gap-2.5 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    className="border-overlay/30 mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--brand)]"
                  />
                  <span>
                    {ui.consentLabel}{' '}
                    <a
                      href="/kvkk/"
                      target="_blank"
                      rel="noopener"
                      className="underline underline-offset-2"
                    >
                      KVKK Aydınlatma Metni
                    </a>
                  </span>
                </label>

                {status === 'error' && (
                  <p role="alert" className="text-sm text-red-400">
                    {failureMessage}
                  </p>
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

/** A dropdown that stays optional: "not sure yet" is a real answer. */
function Choice({ name, label, options }: { name: string; label: string; options: string[] }) {
  if (options.length === 0) return null;
  return (
    <div>
      <label htmlFor={`contact-${name}`} className="nx-label">
        {label}
      </label>
      <select id={`contact-${name}`} name={name} defaultValue="" className="nx-field nx-select">
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
      <label htmlFor={`contact-${name}`} className="nx-label">
        {label}
        {required && <span className="nx-required"> *</span>}
      </label>
      <input
        id={`contact-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="nx-field"
      />
    </div>
  );
}
