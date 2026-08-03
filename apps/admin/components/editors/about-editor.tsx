'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { AboutContent, AboutHighlight, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { LocalizedField, Panel, EditorHeader, useSaver, IconButton, AddButton } from '../fields';

const empty: Localized = { tr: '', en: '' };
const HL_ICONS = ['target', 'users', 'zap', 'shield', 'rocket', 'sparkles', 'layers', 'bar-chart', 'compass', 'cloud'];

export function AboutEditor({ initial }: { initial: AboutContent }) {
  const [about, setAbout] = useState<AboutContent>(initial);
  const { saving, saved, run } = useSaver();

  const set = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) =>
    setAbout((a) => ({ ...a, [k]: v }));
  const patchHl = (i: number, p: Partial<AboutHighlight>) =>
    set('highlights', about.highlights.map((h, idx) => (idx === i ? { ...h, ...p } : h)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Hakkımızda"
        subtitle="Kurumsal tanıtım bölümü"
        saving={saving}
        saved={saved}
        onSave={() => run(() => saveSection('about', about))}
      />
      <div className="space-y-6">
        <Panel title="Başlık">
          <div className="space-y-4">
            <LocalizedField label="Rozet" value={about.badge} onChange={(v) => set('badge', v)} />
            <LocalizedField label="Başlık" value={about.title} onChange={(v) => set('title', v)} />
          </div>
        </Panel>

        <Panel title="Paragraflar">
          <div className="space-y-3">
            {about.paragraphs.map((p, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <LocalizedField
                    label={`Paragraf ${i + 1}`}
                    value={p}
                    onChange={(v) => set('paragraphs', about.paragraphs.map((x, xi) => (xi === i ? v : x)))}
                    multiline
                    rows={3}
                  />
                </div>
                <IconButton variant="danger" onClick={() => set('paragraphs', about.paragraphs.filter((_, xi) => xi !== i))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Paragraf ekle" onClick={() => set('paragraphs', [...about.paragraphs, { ...empty }])} />
          </div>
        </Panel>

        <Panel title="Öne Çıkanlar">
          <div className="space-y-3">
            {about.highlights.map((h, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="w-40">
                    <label className="field-label">İkon</label>
                    <select value={h.icon} onChange={(e) => patchHl(i, { icon: e.target.value })} className="field-input">
                      {HL_ICONS.map((ic) => (
                        <option key={ic} value={ic} className="bg-ink-900">{ic}</option>
                      ))}
                    </select>
                  </div>
                  <IconButton variant="danger" onClick={() => set('highlights', about.highlights.filter((_, xi) => xi !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="space-y-3">
                  <LocalizedField label="Başlık" value={h.title} onChange={(v) => patchHl(i, { title: v })} />
                  <LocalizedField label="Metin" value={h.text} onChange={(v) => patchHl(i, { text: v })} multiline rows={2} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddButton
              label="Öne çıkan ekle"
              onClick={() => set('highlights', [...about.highlights, { icon: 'sparkles', title: { ...empty }, text: { ...empty } }])}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
