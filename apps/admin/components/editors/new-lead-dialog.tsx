'use client';

import { useEffect, useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { SelectField, useToast } from '@nexuva/ui';
import { createLead } from '../../app/actions';
import { LEAD_STATUSES, personName, type LeadPerson, type LeadStatus } from '../../lib/model';
import { STATUS_LABELS } from './pipeline-status';

/** Where a lead that did not come through the website came from. */
const SOURCES = ['Telefon', 'E-posta', 'Yüz yüze görüşme', 'Referans', 'Sosyal medya', 'Diğer'];

/**
 * A lead taken down by hand.
 *
 * Only name, email and the note are required. A phone call arrives with less
 * information than a form does, and a dialog that refuses to save until every
 * field is filled is a dialog people abandon in favour of a sticky note.
 */
export function NewLeadDialog({
  assignees,
  services,
  budgets,
  onClose,
  onCreated,
}: {
  assignees: LeadPerson[];
  /** The services the company actually offers, from the site's own content. */
  services: string[];
  /**
   * Budget bands, passed in from the server. Importing them here would drag the
   * whole shared package — zod included — into the browser for five strings.
   */
  budgets: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [service, setService] = useState('');
  const [budget, setBudget] = useState('');
  const [source, setSource] = useState('Telefon');
  const [status, setStatus] = useState<LeadStatus>('NEW');
  const [assignedToId, setAssignedToId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const ready = name.trim().length >= 2 && email.trim().length > 3 && message.trim().length > 0;

  function submit() {
    if (!ready) return;
    startTransition(async () => {
      const result = await createLead({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        service,
        budget,
        message: message.trim(),
        status,
        assignedToId,
        source,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Talep eklenemedi.');
        return;
      }
      toast.success(`${name.trim()} eklendi.`);
      onCreated();
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yeni talep"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="ui-panel w-full max-w-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-overlay/10 px-5 py-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-fg">Yeni Talep</h2>
            <p className="mt-0.5 text-xs text-muted">
              Telefonla, e-postayla veya görüşmede gelen bir talebi kaydet.
            </p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="shrink-0 text-faint hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Text label="Ad Soyad" value={name} onChange={setName} required autoFocus />
          <Text label="E-posta" value={email} onChange={setEmail} type="email" required />
          <Text label="Telefon" value={phone} onChange={setPhone} type="tel" />
          <Text label="Firma" value={company} onChange={setCompany} />

          <SelectField
            label="Hizmet"
            value={service}
            onChange={setService}
            options={[
              { value: '', label: 'Belirtilmedi' },
              ...services.map((s) => ({ value: s, label: s })),
            ]}
          />
          <SelectField
            label="Bütçe"
            value={budget}
            onChange={setBudget}
            options={[
              { value: '', label: 'Belirtilmedi' },
              ...budgets.map((b) => ({ value: b, label: b })),
            ]}
          />
          <SelectField
            label="Geliş kanalı"
            value={source}
            onChange={setSource}
            options={SOURCES.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            label="Durum"
            value={status}
            onChange={(v) => setStatus(v as LeadStatus)}
            options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <div className="sm:col-span-2">
            <SelectField
              label="Atanan"
              value={assignedToId}
              onChange={setAssignedToId}
              options={[
                { value: '', label: 'Atanmadı' },
                ...assignees.map((p) => ({ value: p.id, label: personName(p) })),
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="new-lead-message" className="mb-1.5 block text-xs font-medium text-muted">
              Talep / not <span className="text-red-500">*</span>
            </label>
            <textarea
              id="new-lead-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Görüşmede konuşulanlar, ihtiyaç, aciliyet..."
              className="ui-input resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-overlay/10 px-5 py-4">
          <button onClick={onClose} disabled={pending} className="ui-button text-xs">
            Vazgeç
          </button>
          <button
            onClick={submit}
            disabled={!ready || pending}
            className="ui-button-primary text-xs disabled:opacity-50"
          >
            {pending ? 'Ekleniyor...' : 'Talebi Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A labelled text input. Local to this dialog on purpose — the shared kit has
 * no text field, and the frozen architecture is explicit that this is not the
 * moment to grow one.
 */
function Text({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = `new-lead-${label.toLocaleLowerCase('tr').replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="ui-input"
      />
    </div>
  );
}
