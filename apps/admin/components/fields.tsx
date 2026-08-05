'use client';

import { useState, type ReactNode } from 'react';
import { AlertCircle, Check, Loader2, Save, Trash2, Plus } from 'lucide-react';
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

/**
 * One text field for one piece of site text.
 *
 * The site is Turkish. The data model still carries a Turkish and an English
 * string per field, because dropping the English half would be a migration and
 * bringing the language back later would be another one — but the panel used to
 * show both boxes, so every heading, every button and every paragraph was asked
 * for twice. People either typed everything twice or left the second box empty
 * and had no way to know which one the site would use.
 *
 * So: one box, and English is kept in step with it. If English ever ships, this
 * component grows a language switch and the stored values are already there.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const set = (next: string) => onChange({ tr: next, en: next });

  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      {multiline ? (
        <textarea
          value={value.tr}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          className="field-input resize-none"
        />
      ) : (
        <input
          value={value.tr}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          className="field-input"
        />
      )}
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
          className="h-11 w-14 cursor-pointer rounded-lg border border-overlay/10 bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input font-mono"
        />
        <span
          className="h-11 w-11 shrink-0 rounded-lg border border-overlay/10"
          style={{ background: value }}
        />
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  /** Replaces the default padding when a panel needs its own layout. */
  className?: string;
}) {
  return (
    <div className={className ? `panel ${className}` : 'panel p-5 sm:p-6'}>
      {title && (
        <h3 className="mb-5 font-heading text-base font-semibold text-fg">{title}</h3>
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
          : 'border-overlay/10 bg-overlay/5 text-muted hover:bg-overlay/10 hover:text-fg'
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
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-overlay/15 py-3 text-sm font-medium text-muted transition-colors hover:border-brand-400/50 hover:text-fg"
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
  error,
}: {
  title: string;
  subtitle?: string;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  /** Set when the last save failed. Shown in place of any success signal. */
  error?: string | null;
}) {
  return (
    <div className="chrome sticky top-16 z-20 -mx-5 mb-6 border-b px-5 py-4 sm:-mx-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        {/* min-w-0 so a long title truncates instead of pushing the save button
            off a narrow screen. Without it the flex child refuses to shrink
            below its content width. */}
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-bold text-fg sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
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
      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * What every save action in app/actions.ts resolves to. They report failure by
 * returning rather than throwing, because a server action that throws loses its
 * message in production — the client would only see a generic render error.
 */
export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Save state for an editor.
 *
 * This used to call setSaved(true) as soon as the action resolved, without
 * looking at what it resolved to. Since the actions signal failure in their
 * return value, a rejected save still reported "Kaydedildi" and the operator
 * walked away believing the edit had landed.
 */
export function useSaver() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<SaveResult | void>) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await fn();
      if (result && !result.ok) {
        setError(result.error?.trim() || 'Kaydedilemedi.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      // An expired session throws out of requireAuth() before the action's own
      // error handling runs, so this path is reachable in normal use.
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return { saving, saved, error, run };
}
