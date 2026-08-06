'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  Mail,
  Send,
  ServerCog,
  X,
} from 'lucide-react';
import { SelectField, useToast } from '@nexuva/ui';
import {
  getMailPreview,
  saveMailSettings,
  saveMailTemplate,
  sendTestMail,
} from '../../app/actions';
import {
  MAIL_PROVIDERS,
  type MailLogEntry,
  type MailSettings,
  type MailTemplate,
  type MailVariable,
} from '../../lib/model';
import { TextField, Panel, EditorHeader, useSaver } from '../fields';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Everything about sending mail, in one place.
 *
 * Configuration used to live in environment variables, which meant the person
 * who needed to change a sender address had to find somebody with access to the
 * hosting dashboard and trigger a redeploy. And there was no way to find out
 * whether any of it worked short of submitting the contact form and waiting.
 */
export function MailCenter({
  settings: initialSettings,
  templates: initialTemplates,
  variables,
  logs,
  failedCount,
}: {
  settings: MailSettings | null;
  templates: MailTemplate[];
  variables: MailVariable[];
  logs: MailLogEntry[];
  failedCount: number;
}) {
  const toast = useToast();
  const { saving, saved, error, run } = useSaver();

  const [settings, setSettings] = useState<MailSettings>(
    initialSettings ?? {
      provider: 'resend',
      fromEmail: '',
      fromName: 'Nexuva',
      replyTo: '',
      notifyTo: '',
      hasApiKey: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      hasSmtpPassword: false,
      smtpSecure: false,
      fromDatabase: false,
      lastTestAt: null,
      lastTestOk: null,
      lastTestMessage: null,
    },
  );
  // Held separately and never read back from the server: a secret that returns
  // to the screen is a secret anyone at the screen can read.
  const [apiKey, setApiKey] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Mail"
        subtitle="Gönderim ayarları, şablonlar ve gönderim kayıtları"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() =>
          run(async () => {
            const result = await saveMailSettings({
              provider: settings.provider,
              fromEmail: settings.fromEmail,
              fromName: settings.fromName,
              replyTo: settings.replyTo,
              notifyTo: settings.notifyTo,
              smtpHost: settings.smtpHost,
              smtpPort: settings.smtpPort,
              smtpUser: settings.smtpUser,
              smtpSecure: settings.smtpSecure,
              // Empty means "keep the stored one" — the panel cannot show the
              // current value, so it cannot send it back.
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
              ...(smtpPassword.trim() ? { smtpPassword: smtpPassword.trim() } : {}),
            });
            if (result.ok && result.settings) {
              setSettings(result.settings);
              setApiKey('');
              setSmtpPassword('');
            }
            return result;
          })
        }
      />

      <div className="space-y-6">
        {!settings.fromDatabase && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            <ServerCog className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ayarlar hâlâ sunucu ortamından okunuyor. Buradan kaydettiğin an panelde
              yönetilmeye başlar ve değiştirmek için sunucuya dokunman gerekmez.
            </span>
          </p>
        )}

        {/* ── Provider ───────────────────────────────────────────────────── */}
        <Panel title="Gönderim">
          <div className="space-y-4">
            <SelectField
              label="Sağlayıcı"
              value={settings.provider}
              onChange={(v) => set('provider', v)}
              options={MAIL_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Gönderen adresi"
                value={settings.fromEmail}
                onChange={(v) => set('fromEmail', v)}
                placeholder="noreply@sirketiniz.com"
              />
              <TextField
                label="Gönderen adı"
                value={settings.fromName}
                onChange={(v) => set('fromName', v)}
                placeholder="Nexuva"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Yanıt adresi (Reply-To)"
                value={settings.replyTo}
                onChange={(v) => set('replyTo', v)}
                placeholder="info@sirketiniz.com"
              />
              <TextField
                label="Yeni talep bildirimi gidecek adresler"
                value={settings.notifyTo}
                onChange={(v) => set('notifyTo', v)}
                placeholder="satis@sirketiniz.com, info@sirketiniz.com"
              />
            </div>

            {settings.provider === 'smtp' ? (
              <div className="space-y-4 rounded-xl border border-overlay/10 bg-overlay/[0.02] p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="SMTP sunucusu"
                    value={settings.smtpHost}
                    onChange={(v) => set('smtpHost', v)}
                    placeholder="smtp.gmail.com"
                  />
                  <div>
                    <label className="field-label">Port</label>
                    <input
                      type="number"
                      value={settings.smtpPort}
                      onChange={(e) => set('smtpPort', Number(e.target.value) || 587)}
                      className="field-input"
                    />
                    <p className="mt-1 text-xs text-faint">
                      587 (STARTTLS) veya 465 (SSL). Doğru şifreyle bile en sık buradan
                      hata alınır.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Kullanıcı adı"
                    value={settings.smtpUser}
                    onChange={(v) => set('smtpUser', v)}
                    placeholder="hesap@gmail.com"
                  />
                  <div>
                    <label className="field-label">
                      Şifre {settings.hasSmtpPassword && <SecretSet />}
                    </label>
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={settings.hasSmtpPassword ? '•••••••• (kayıtlı)' : ''}
                      className="field-input"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={settings.smtpSecure}
                    onChange={(e) => set('smtpSecure', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Doğrudan SSL kullan (genellikle yalnızca 465 portunda)
                </label>
                <p className="text-xs text-faint">
                  Gmail için normal şifre değil, <strong>uygulama şifresi</strong> gerekir.
                  Microsoft 365 için sunucu: smtp.office365.com, port 587.
                </p>
              </div>
            ) : (
              <div>
                <label className="field-label">
                  API anahtarı {settings.hasApiKey && <SecretSet />}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings.hasApiKey ? '•••••••• (kayıtlı)' : 're_...'}
                  className="field-input"
                />
                <p className="mt-1 text-xs text-faint">
                  Kaydedildikten sonra bir daha gösterilmez. Değiştirmek için yenisini yaz,
                  aynı kalsın istiyorsan boş bırak.
                </p>
              </div>
            )}
          </div>
        </Panel>

        <TestSender lastTestAt={settings.lastTestAt} lastTestOk={settings.lastTestOk} lastTestMessage={settings.lastTestMessage} />

        <TemplateList templates={initialTemplates} variables={variables} toast={toast} />

        <MailLogs logs={logs} failedCount={failedCount} />
      </div>
    </div>
  );
}

function SecretSet() {
  return (
    <span className="ml-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">
      kayıtlı
    </span>
  );
}

/**
 * Sends a real message to a real address.
 *
 * The only check that means anything: a provider can accept the credentials
 * and still refuse to send, and an unverified sender domain — the usual reason
 * — shows up nowhere else.
 */
function TestSender({
  lastTestAt,
  lastTestOk,
  lastTestMessage,
}: {
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}) {
  const [to, setTo] = useState('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  return (
    <Panel title="Test Gönderimi">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <TextField
            label="Test maili gönderilecek adres"
            value={to}
            onChange={setTo}
            type="email"
            placeholder="kendi@adresiniz.com"
          />
        </div>
        <button
          onClick={() =>
            startTransition(async () => {
              setResult(await sendTestMail(to.trim()));
            })
          }
          disabled={pending || to.trim().length < 5}
          className="ui-button-primary disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {pending ? 'Gönderiliyor...' : 'Test Gönder'}
        </button>
      </div>

      {result && (
        <p
          className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            result.ok
              ? 'border-green-500/30 bg-green-500/10 text-green-600'
              : 'border-red-500/30 bg-red-500/10 text-red-500'
          }`}
        >
          {result.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {result.ok
              ? 'Gönderildi. Gelen kutunu ve spam klasörünü kontrol et.'
              : result.detail}
          </span>
        </p>
      )}

      {!result && lastTestAt && (
        <p className="mt-4 text-xs text-faint">
          Son test: {formatWhen(lastTestAt)} ·{' '}
          <span className={lastTestOk ? 'text-green-600' : 'text-red-500'}>
            {lastTestOk ? 'başarılı' : 'başarısız'}
          </span>
          {lastTestMessage && !lastTestOk ? ` — ${lastTestMessage}` : ''}
        </p>
      )}
    </Panel>
  );
}

/** The messages the platform sends, and their words. */
function TemplateList({
  templates,
  variables,
  toast,
}: {
  templates: MailTemplate[];
  variables: MailVariable[];
  toast: ReturnType<typeof useToast>;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <Panel title="Mail Şablonları">
      {templates.length === 0 ? (
        <p className="text-sm text-faint">
          Şablonlar API&apos;den okunamadı. Bağlantı kurulduğunda varsayılanlar otomatik
          oluşturulur.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <TemplateRow
              key={template.key}
              template={template}
              variables={variables}
              open={openKey === template.key}
              onToggle={() => setOpenKey(openKey === template.key ? null : template.key)}
              toast={toast}
            />
          ))}
        </div>
      )}

      {variables.length > 0 && (
        <div className="mt-4 rounded-xl border border-overlay/10 bg-overlay/[0.02] p-3">
          <p className="text-xs font-semibold text-muted">Kullanabileceğin değişkenler</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variables.map((variable) => (
              <span
                key={variable.key}
                title={variable.label}
                className="rounded border border-overlay/15 bg-overlay/5 px-2 py-0.5 font-mono text-[11px] text-fg"
              >
                {`{{${variable.key}}}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function TemplateRow({
  template,
  variables,
  open,
  onToggle,
  toast,
}: {
  template: MailTemplate;
  variables: MailVariable[];
  open: boolean;
  onToggle: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  return (
    <div className="rounded-xl border border-overlay/10 bg-overlay/[0.02]">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="block text-sm font-medium text-fg">{template.name}</span>
          <span className="block text-xs text-faint">{template.description}</span>
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const next = e.target.checked;
              setEnabled(next);
              startTransition(async () => {
                const result = await saveMailTemplate(template.key, { enabled: next });
                if (!result.ok) {
                  setEnabled(!next);
                  toast.error(result.error ?? 'Kaydedilemedi.');
                }
              });
            }}
            className="h-4 w-4"
          />
          Aktif
        </label>
      </div>

      {open && (
        <div className="space-y-3 border-t border-overlay/10 p-4">
          <TextField label="Konu" value={subject} onChange={setSubject} />
          <div>
            <label className="field-label">İçerik</label>
            <textarea
              value={body}
              rows={10}
              onChange={(e) => setBody(e.target.value)}
              className="field-input resize-y font-mono text-xs"
            />
            <p className="mt-1 text-xs text-faint">
              Boş satır yeni paragraf açar. **kalın** yazmak için iki yıldız kullan.
              Değişkenler {variables.length > 0 ? `(${variables.length} tane)` : ''} aşağıda
              listeli.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                startTransition(async () => {
                  const result = await saveMailTemplate(template.key, { subject, body });
                  if (result.ok) toast.success('Şablon kaydedildi.');
                  else toast.error(result.error ?? 'Kaydedilemedi.');
                })
              }
              disabled={pending}
              className="ui-button-primary text-xs"
            >
              Kaydet
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  // Previewed from the server so that what is shown is rendered
                  // by the same code that sends — a preview built separately is
                  // a preview of nothing.
                  setPreview(await getMailPreview(template.key));
                })
              }
              disabled={pending}
              className="ui-button text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              Önizle
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <div className="ui-panel flex max-h-[85vh] w-full max-w-2xl flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-overlay/10 px-5 py-3">
              <div className="min-w-0">
                <div className="text-xs text-faint">Konu</div>
                <div className="truncate text-sm font-medium text-fg">{preview.subject}</div>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label="Kapat"
                className="shrink-0 text-faint hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Rendered in an iframe: the message carries its own styling and
                must not inherit — or leak into — the panel's. */}
            <iframe
              title="Mail önizleme"
              srcDoc={preview.html}
              className="h-[60vh] w-full rounded-b-2xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Was it sent, and if not, what did the provider say? */
function MailLogs({ logs, failedCount }: { logs: MailLogEntry[]; failedCount: number }) {
  return (
    <Panel title="Gönderim Kayıtları">
      {logs.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Mail className="h-4 w-4" />
          Henüz mail gönderilmedi.
        </p>
      ) : (
        <>
          {failedCount > 0 && (
            <p className="mb-3 text-sm text-red-500">{failedCount} gönderim başarısız oldu.</p>
          )}
          <div className="divide-y divide-overlay/5">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start gap-2 py-2.5">
                <span
                  className={`mt-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    log.status === 'SENT'
                      ? 'border-green-500/30 bg-green-500/10 text-green-600'
                      : 'border-red-500/30 bg-red-500/10 text-red-500'
                  }`}
                >
                  {log.status === 'SENT' ? 'Gönderildi' : 'Başarısız'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{log.subject}</span>
                  <span className="block truncate text-xs text-faint">
                    {log.to} · {formatWhen(log.createdAt)} · {log.provider}
                  </span>
                  {log.error && (
                    <span className="mt-1 block break-words text-xs text-red-500">{log.error}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
