'use client';

import { useState, type ReactNode } from 'react';
import { Check, Loader2, Save, Trash2, Plus } from 'lucide-react';
import type { Localized, SectionMeta } from '@nexuva/types';

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input resize-none"
      />
    </div>
  );
}

/** Bilingual (tr/en) field with two inputs. */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 2,
}: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['tr', 'en'] as const).map((loc) => (
          <div key={loc} className="relative">
            <span className="absolute left-2.5 top-2.5 rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-ink-300">
              {loc}
            </span>
            {multiline ? (
              <textarea
                value={value[loc]}
                rows={rows}
                onChange={(e) => onChange({ ...value, [loc]: e.target.value })}
                className="field-input resize-none pt-8"
              />
            ) : (
              <input
                value={value[loc]}
                onChange={(e) => onChange({ ...value, [loc]: e.target.value })}
                className="field-input pl-12"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input font-mono"
        />
        <span
          className="h-11 w-11 shrink-0 rounded-lg border border-white/10"
          style={{ background: value }}
        />
      </div>
    </div>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="panel p-5 sm:p-6">
      {title && (
        <h3 className="mb-5 font-heading text-base font-semibold text-white">{title}</h3>
      )}
      {children}
    </div>
  );
}

export function MetaFields({
  meta,
  onChange,
}: {
  meta: SectionMeta;
  onChange: (m: SectionMeta) => void;
}) {
  return (
    <Panel title="Bölüm Başlığı">
      <div className="space-y-4">
        <LocalizedField label="Rozet" value={meta.badge} onChange={(v) => onChange({ ...meta, badge: v })} />
        <LocalizedField label="Başlık" value={meta.title} onChange={(v) => onChange({ ...meta, title: v })} />
        <LocalizedField
          label="Alt Metin"
          value={meta.subtitle}
          onChange={(v) => onChange({ ...meta, subtitle: v })}
          multiline
          rows={2}
        />
      </div>
    </Panel>
  );
}

export function IconButton({
  onClick,
  children,
  variant = 'ghost',
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: 'ghost' | 'danger';
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        variant === 'danger'
          ? 'border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/15'
          : 'border-white/10 bg-white/5 text-ink-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-medium text-ink-300 transition-colors hover:border-brand-400/50 hover:text-white"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

export { Trash2, Plus };

/** Header row for an editor page with a sticky Save action. */
export function EditorHeader({
  title,
  subtitle,
  onSave,
  saving,
  saved,
}: {
  title: string;
  subtitle?: string;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="sticky top-16 z-20 -mx-5 mb-6 flex items-center justify-between gap-4 border-b border-white/10 bg-ink-950/80 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      </div>
      <button onClick={onSave} disabled={saving} className="btn-primary shrink-0">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor
          </>
        ) : saved ? (
          <>
            <Check className="h-4 w-4" /> Kaydedildi
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Kaydet
          </>
        )}
      </button>
    </div>
  );
}

/** Small hook wrapper to manage save state for an editor. */
export function useSaver() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return { saving, saved, run };
}
