'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TestimonialItem, SectionMeta, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { TextField, LocalizedField, Panel, MetaFields, EditorHeader, useSaver, IconButton, AddButton } from '../fields';

const empty: Localized = { tr: '', en: '' };

export function TestimonialsEditor({
  meta: m0,
  testimonials: t0,
}: {
  meta: SectionMeta;
  testimonials: TestimonialItem[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [items, setItems] = useState<TestimonialItem[]>(t0);
  const { saving, saved, error, run } = useSaver();

  const patch = (id: string, p: Partial<TestimonialItem>) =>
    setItems((l) => l.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Müşteri Görüşleri"
        subtitle="Testimonials bölümü"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() =>
          run(async () => {
            await saveSection('testimonialsMeta', meta);
            await saveSection('testimonials', items);
          })
        }
      />
      <div className="space-y-6">
        <MetaFields meta={meta} onChange={setMeta} />
        <div className="space-y-3">
          {items.map((t) => (
            <Panel key={t.id}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-fg">{t.author || 'Yeni görüş'}</span>
                <IconButton variant="danger" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="space-y-4">
                <LocalizedField label="Alıntı" value={t.quote} onChange={(v) => patch(t.id, { quote: v })} multiline rows={3} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Kişi" value={t.author} onChange={(v) => patch(t.id, { author: v })} />
                  <TextField label="Şirket" value={t.company} onChange={(v) => patch(t.id, { company: v })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LocalizedField label="Ünvan" value={t.role} onChange={(v) => patch(t.id, { role: v })} />
                  <div>
                    <label className="field-label">Puan (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={t.rating}
                      onChange={(e) => patch(t.id, { rating: Math.max(1, Math.min(5, Number(e.target.value) || 5)) })}
                      className="field-input"
                    />
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
        <AddButton
          label="Görüş ekle"
          onClick={() =>
            setItems((l) => [
              ...l,
              { id: crypto.randomUUID(), quote: { ...empty }, author: '', role: { ...empty }, company: '', rating: 5 },
            ])
          }
        />
      </div>
    </div>
  );
}
