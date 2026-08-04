'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ProcessStep, SectionMeta, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { LocalizedField, Panel, MetaFields, EditorHeader, useSaver, IconButton, AddButton } from '../fields';

const empty: Localized = { tr: '', en: '' };

export function ProcessEditor({
  meta: m0,
  steps: p0,
}: {
  meta: SectionMeta;
  steps: ProcessStep[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [steps, setSteps] = useState<ProcessStep[]>(p0);
  const { saving, saved, error, run } = useSaver();

  const patch = (id: string, p: Partial<ProcessStep>) =>
    setSteps((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Süreç Adımları"
        subtitle="Nasıl çalışıyoruz bölümü"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() =>
          run(async () => {
            await saveSection('processMeta', meta);
            await saveSection('process', steps);
          })
        }
      />
      <div className="space-y-6">
        <MetaFields meta={meta} onChange={setMeta} />
        <div className="space-y-3">
          {steps.map((s, i) => (
            <Panel key={s.id}>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg brand-gradient-bg text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  {s.title.tr || 'Yeni adım'}
                </span>
                <IconButton variant="danger" onClick={() => setSteps((l) => l.filter((x) => x.id !== s.id))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="space-y-4">
                <LocalizedField label="Başlık" value={s.title} onChange={(v) => patch(s.id, { title: v })} />
                <LocalizedField label="Açıklama" value={s.description} onChange={(v) => patch(s.id, { description: v })} multiline rows={2} />
              </div>
            </Panel>
          ))}
        </div>
        <AddButton
          label="Adım ekle"
          onClick={() => setSteps((l) => [...l, { id: crypto.randomUUID(), title: { ...empty }, description: { ...empty } }])}
        />
      </div>
    </div>
  );
}
