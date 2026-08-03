'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ReferenceItem, SectionMeta, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { LocalizedField, MetaFields, EditorHeader, useSaver, IconButton, AddButton } from '../fields';

const empty: Localized = { tr: '', en: '' };

export function ReferencesEditor({
  meta: m0,
  references: r0,
}: {
  meta: SectionMeta;
  references: ReferenceItem[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [refs, setRefs] = useState<ReferenceItem[]>(r0);
  const { saving, saved, run } = useSaver();

  const patch = (id: string, p: Partial<ReferenceItem>) =>
    setRefs((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Referanslar"
        subtitle="Akan referans slider'ındaki markalar"
        saving={saving}
        saved={saved}
        onSave={() =>
          run(async () => {
            await saveSection('referencesMeta', meta);
            await saveSection('references', refs);
          })
        }
      />
      <div className="space-y-6">
        <MetaFields meta={meta} onChange={setMeta} />
        <div className="space-y-3">
          {refs.map((r) => (
            <div key={r.id} className="panel flex flex-wrap items-end gap-3 p-4">
              <div className="w-48">
                <label className="field-label">Marka Adı</label>
                <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} className="field-input" />
              </div>
              <div className="min-w-[14rem] flex-1">
                <LocalizedField label="Kategori" value={r.category} onChange={(v) => patch(r.id, { category: v })} />
              </div>
              <IconButton variant="danger" onClick={() => setRefs((l) => l.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
        <AddButton
          label="Referans ekle"
          onClick={() => setRefs((l) => [...l, { id: crypto.randomUUID(), name: '', category: { ...empty } }])}
        />
      </div>
    </div>
  );
}
