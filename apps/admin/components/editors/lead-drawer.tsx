'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Building2,
  Clock,
  FileText,
  Mail,
  MessageSquarePlus,
  MousePointerClick,
  Phone,
  Tag,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { SelectField, useToast } from '@nexuva/ui';
import {
  addLeadNote,
  assignLead,
  getLead,
  removeLeadNote,
  setLeadStatus,
  setLeadTags,
} from '../../app/actions';
import {
  LEAD_STATUSES,
  personName,
  type LeadDetail,
  type LeadPerson,
  type LeadStatus,
} from '../../lib/model';
import { STATUS_LABELS } from './pipeline-status';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Everything known about one enquiry, and everything that can be done to it.
 *
 * Holds its own copy of the lead and replaces it from each action's response,
 * so the timeline and the fields stay in step without a round trip through the
 * page. The list behind it is refreshed by the parent.
 */
export function LeadDrawer({
  leadId,
  assignees,
  onClose,
  onChanged,
}: {
  leadId: string;
  assignees: LeadPerson[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getLead(leadId).then((result) => {
      if (!alive) return;
      setLead(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [leadId]);

  // Escape closes. A drawer that traps someone is worse than no drawer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  function run(
    action: () => Promise<{ ok: boolean; error?: string; lead?: LeadDetail }>,
    success?: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? 'İşlem tamamlanamadı.');
        return;
      }
      if (result.lead) setLead(result.lead);
      if (success) toast.success(success);
      onChanged();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Talep detayı"
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="chrome flex h-full w-full max-w-xl flex-col overflow-y-auto border-l">
        {loading || !lead ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted">
            {loading ? 'Yükleniyor...' : 'Talep bulunamadı.'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-overlay/10 bg-card/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-faint">Talep #{lead.requestNo}</div>
                  <h2 className="truncate font-heading text-lg font-bold text-fg">{lead.name}</h2>
                  {lead.company && (
                    <div className="truncate text-sm text-muted">{lead.company}</div>
                  )}
                </div>
                <button onClick={onClose} aria-label="Kapat" className="shrink-0 text-faint hover:text-fg">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Durum"
                  value={lead.status}
                  disabled={pending}
                  onChange={(v) =>
                    run(() => setLeadStatus(lead.id, v as LeadStatus), 'Durum güncellendi.')
                  }
                  options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                />
                <SelectField
                  label="Atanan"
                  value={lead.assignedTo?.id ?? ''}
                  disabled={pending}
                  onChange={(v) => run(() => assignLead(lead.id, v || null), 'Atama güncellendi.')}
                  options={[
                    { value: '', label: 'Atanmadı' },
                    ...assignees.map((p) => ({ value: p.id, label: personName(p) })),
                  ]}
                />
              </div>
            </div>

            <div className="space-y-6 p-5">
              {/* Contact facts */}
              <section className="ui-panel p-4">
                <dl className="space-y-2.5 text-sm">
                  <Fact icon={<User className="h-3.5 w-3.5" />} label="Yetkili" value={lead.name} />
                  <Fact
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Firma"
                    value={lead.company}
                  />
                  <Fact
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="E-posta"
                    value={lead.email}
                    href={`mailto:${lead.email}`}
                  />
                  <Fact
                    icon={<Phone className="h-3.5 w-3.5" />}
                    label="Telefon"
                    value={lead.phone}
                    href={lead.phone ? `tel:${lead.phone.replace(/\s/g, '')}` : undefined}
                  />
                  <Fact
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Hizmet"
                    value={lead.service}
                  />
                  <Fact
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label="Bütçe"
                    value={lead.budget}
                  />
                  <Fact
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Geldiği tarih"
                    value={formatWhen(lead.createdAt)}
                  />
                  {lead.consentAt && (
                    <Fact
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="KVKK onayı"
                      value={formatWhen(lead.consentAt)}
                    />
                  )}
                </dl>
              </section>

              {/* Where the enquiry came from. Only drawn when the visit carried
                  something: a panel of five dashes tells nobody anything. */}
              {(lead.utmSource || lead.utmCampaign || lead.source || lead.referrer) && (
                <section className="ui-panel p-4">
                  <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-fg">
                    <MousePointerClick className="h-3.5 w-3.5" /> Nereden geldi
                  </h3>
                  <dl className="space-y-2.5 text-sm">
                    <Fact
                      icon={<MousePointerClick className="h-3.5 w-3.5" />}
                      label="Kaynak"
                      value={lead.utmSource || lead.source}
                    />
                    <Fact
                      icon={<Tag className="h-3.5 w-3.5" />}
                      label="Kampanya"
                      value={lead.utmCampaign}
                    />
                    <Fact
                      icon={<Tag className="h-3.5 w-3.5" />}
                      label="Ortam"
                      value={lead.utmMedium}
                    />
                    <Fact
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label="Giriş sayfası"
                      value={lead.landingPath}
                    />
                    <Fact
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label="Yönlendiren"
                      value={lead.referrer}
                    />
                    <Fact
                      icon={<User className="h-3.5 w-3.5" />}
                      label="Cihaz"
                      value={
                        lead.device
                          ? { desktop: 'Masaüstü', mobile: 'Telefon', tablet: 'Tablet' }[
                              lead.device
                            ] ?? lead.device
                          : null
                      }
                    />
                  </dl>
                </section>
              )}

              {/* Message */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-fg">Mesaj</h3>
                <p className="ui-panel whitespace-pre-wrap p-4 text-sm leading-relaxed text-fg">
                  {lead.message}
                </p>
              </section>

              {/* Tags */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                  <Tag className="h-3.5 w-3.5" /> Etiketler
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 rounded-full bg-overlay/10 px-3 py-1 text-xs text-fg"
                    >
                      {tag}
                      <button
                        onClick={() =>
                          run(() => setLeadTags(lead.id, lead.tags.filter((t) => t !== tag)))
                        }
                        disabled={pending}
                        aria-label={`${tag} etiketini kaldır`}
                        className="text-faint hover:text-fg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = tagInput.trim();
                      if (!value || lead.tags.includes(value)) return;
                      setTagInput('');
                      run(() => setLeadTags(lead.id, [...lead.tags, value]));
                    }}
                  >
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Etiket ekle"
                      aria-label="Etiket ekle"
                      className="ui-input !w-36 !py-1.5 text-xs"
                    />
                  </form>
                </div>
              </section>

              {/* Notes */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Notlar
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = note.trim();
                    if (!body) return;
                    setNote('');
                    run(() => addLeadNote(lead.id, body), 'Not eklendi.');
                  }}
                  className="mb-3"
                >
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Görüşme notu, teklif detayı, hatırlatma..."
                    aria-label="Yeni not"
                    className="ui-input resize-none"
                  />
                  <button
                    type="submit"
                    disabled={pending || note.trim().length === 0}
                    className="ui-button-primary mt-2 text-xs"
                  >
                    Not ekle
                  </button>
                </form>

                {lead.notes.length === 0 ? (
                  <p className="text-sm text-faint">Henüz not yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {lead.notes.map((item) => (
                      <li key={item.id} className="ui-panel p-3">
                        <p className="whitespace-pre-wrap text-sm text-fg">{item.body}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
                          <span>
                            {personName(item.author)} · {formatWhen(item.createdAt)}
                          </span>
                          <button
                            onClick={() => run(() => removeLeadNote(item.id), 'Not silindi.')}
                            disabled={pending}
                            aria-label="Notu sil"
                            className="text-faint hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Files */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-fg">Dosyalar</h3>
                {lead.files.length === 0 ? (
                  <p className="text-sm text-faint">Bu talebe bağlı dosya yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {lead.files.map((file) => (
                      <li key={file.id} className="ui-panel flex items-center gap-3 p-3">
                        <FileText className="h-4 w-4 shrink-0 text-muted" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
                        >
                          {file.filename}
                        </a>
                        <span className="shrink-0 text-[11px] text-faint">
                          {formatSize(file.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Timeline */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-fg">Aktivite</h3>
                <ol className="space-y-3 border-l border-overlay/15 pl-4">
                  {lead.activities.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-overlay/30" />
                      <p className="text-sm text-fg">{item.description}</p>
                      <p className="text-[11px] text-faint">
                        {item.actor ? `${personName(item.actor)} · ` : ''}
                        {formatWhen(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-faint">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-fg">
        {href ? (
          <a href={href} className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
