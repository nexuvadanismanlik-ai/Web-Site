'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ProcessStep, SectionMeta, Localized } from '@nexuva/types';
import { ImageField, SelectField, type PickableImage } from '@nexuva/ui';
import { saveSection } from '../../app/actions';
import { LocalizedField, Panel, MetaFields, EditorHeader, useSaver, IconButton, AddButton } from '../fields';
import { DragHandle, useRemoveWithUndo, useSortable } from './list-controls';

const empty: Localized = { tr: '', en: '' };

/** Icons that suit a process step. Same set the site can render. */
const STEP_ICONS = ['compass', 'search', 'pen-tool', 'code', 'rocket', 'check', 'users', 'target', 'layers', 'zap'];

export function ProcessEditor({
  meta: m0,
  steps: p0,
  images,
}: {
  meta: SectionMeta;
  steps: ProcessStep[];
  images: PickableImage[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [steps, setSteps] = useState<ProcessStep[]>(p0);
  const { saving, saved, error, run } = useSaver();

  const sort = useSortable(steps, setSteps);
  const remove = useRemoveWithUndo(setSteps);

  const patch = (id: string, p: Partial<ProcessStep>) =>
    setSteps((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Süreç Adımları"
        subtitle="Nasıl çalışıyoruz — sürükleyerek sırala"
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
          {steps.map((s, i) => {
            const rowProps = sort.rowProps(i);
            return (
            <Panel key={s.id} className={`p-5 sm:p-6 ${rowProps.className}`}>
              <div {...rowProps} className="mb-3 flex items-center gap-2">
                <DragHandle index={i} count={steps.length} handleProps={sort.handleProps(i)} onMoveUp={() => sort.moveUp(i)} onMoveDown={() => sort.moveDown(i)} label={s.title.tr || 'Adım'} />
                <span className="flex flex-1 items-center gap-2 text-sm font-medium text-fg">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg brand-gradient-bg text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  {s.title.tr || 'Yeni adım'}
                </span>
                <IconButton variant="danger" title="Adımı sil" onClick={() => remove(i, s, s.title.tr || 'Adım')}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="space-y-4">
                <SelectField
                  label="İkon"
                  value={s.icon ?? ''}
                  onChange={(v) => patch(s.id, { icon: v })}
                  options={[{ value: '', label: 'Adım numarası göster' }, ...STEP_ICONS.map((i) => ({ value: i, label: i }))]}
                />
                <ImageField
                  label="Görsel"
                  value={s.imageUrl ?? ''}
                  onChange={(url) => patch(s.id, { imageUrl: url })}
                  images={images}
                  hint="Seçilirse ikonun ve numaranın yerine geçer."
                />
                <LocalizedField label="Başlık" value={s.title} onChange={(v) => patch(s.id, { title: v })} />
                <LocalizedField label="Açıklama" value={s.description} onChange={(v) => patch(s.id, { description: v })} multiline rows={2} />
              </div>
            </Panel>
            );
          })}
        </div>
        <AddButton
          label="Adım ekle"
          onClick={() => setSteps((l) => [...l, { id: crypto.randomUUID(), title: { ...empty }, description: { ...empty } }])}
        />
      </div>
    </div>
  );
}
