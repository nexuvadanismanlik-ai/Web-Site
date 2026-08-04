'use client';

import { useState } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';
import type { ServiceItem, SectionMeta, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import {
  LocalizedField,
  MetaFields,
  EditorHeader,
  useSaver,
  IconButton,
  AddButton,
} from '../fields';

const SERVICE_ICONS = [
  'compass', 'code', 'cloud', 'trending-up', 'shield', 'palette',
  'target', 'users', 'zap', 'rocket', 'layers', 'bar-chart',
];

const empty: Localized = { tr: '', en: '' };

export function ServicesEditor({
  meta: m0,
  services: s0,
}: {
  meta: SectionMeta;
  services: ServiceItem[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [services, setServices] = useState<ServiceItem[]>(s0);
  const [openId, setOpenId] = useState<string | null>(s0[0]?.id ?? null);
  const { saving, saved, error, run } = useSaver();

  const patch = (id: string, p: Partial<ServiceItem>) =>
    setServices((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const add = () =>
    setServices((list) => [
      ...list,
      { id: crypto.randomUUID(), icon: 'sparkles', title: { ...empty }, description: { ...empty }, features: [] },
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Hizmetler"
        subtitle="Sunulan hizmetleri düzenle"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() =>
          run(async () => {
            await saveSection('servicesMeta', meta);
            await saveSection('services', services);
          })
        }
      />

      <div className="space-y-6">
        <MetaFields meta={meta} onChange={setMeta} />

        <div className="space-y-3">
          {services.map((svc) => {
            const open = openId === svc.id;
            return (
              <div key={svc.id} className="panel overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setOpenId(open ? null : svc.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown className={`h-4 w-4 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                    <span className="font-medium text-fg">
                      {svc.title.tr || 'Yeni hizmet'}
                    </span>
                    <span className="rounded bg-overlay/5 px-2 py-0.5 text-xs text-muted">{svc.icon}</span>
                  </button>
                  <IconButton variant="danger" onClick={() => setServices((l) => l.filter((s) => s.id !== svc.id))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-overlay/10 p-4">
                    <div>
                      <label className="field-label">İkon</label>
                      <select
                        value={svc.icon}
                        onChange={(e) => patch(svc.id, { icon: e.target.value })}
                        className="field-input"
                      >
                        {SERVICE_ICONS.map((ic) => (
                          <option key={ic} value={ic} className="bg-card">{ic}</option>
                        ))}
                      </select>
                    </div>
                    <LocalizedField label="Başlık" value={svc.title} onChange={(v) => patch(svc.id, { title: v })} />
                    <LocalizedField label="Açıklama" value={svc.description} onChange={(v) => patch(svc.id, { description: v })} multiline rows={2} />

                    <div>
                      <label className="field-label">Özellikler</label>
                      <div className="space-y-2">
                        {svc.features.map((f, fi) => (
                          <div key={fi} className="flex items-end gap-2">
                            <div className="flex-1">
                              <LocalizedField
                                label=""
                                value={f}
                                onChange={(v) => patch(svc.id, { features: svc.features.map((x, xi) => (xi === fi ? v : x)) })}
                              />
                            </div>
                            <IconButton variant="danger" onClick={() => patch(svc.id, { features: svc.features.filter((_, xi) => xi !== fi) })}>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2">
                        <AddButton label="Özellik ekle" onClick={() => patch(svc.id, { features: [...svc.features, { ...empty }] })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AddButton label="Hizmet ekle" onClick={add} />
      </div>
    </div>
  );
}
