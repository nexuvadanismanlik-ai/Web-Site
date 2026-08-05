'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { StatItem, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { LocalizedField, EditorHeader, useSaver, IconButton, AddButton } from '../fields';
import { DragHandle, useRemoveWithUndo, useSortable } from './list-controls';

const empty: Localized = { tr: '', en: '' };

export function StatsEditor({ stats: s0 }: { stats: StatItem[] }) {
  const [stats, setStats] = useState<StatItem[]>(s0);
  const { saving, saved, error, run } = useSaver();

  const sort = useSortable(stats, setStats);
  const remove = useRemoveWithUndo(setStats);

  const patch = (id: string, p: Partial<StatItem>) =>
    setStats((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="İstatistikler"
        subtitle="Sayaçlı rakamlar — sürükleyerek sırala"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('stats', stats))}
      />
      <div className="space-y-3">
        {stats.map((s, index) => {
          const rowProps = sort.rowProps(index);
          return (
          <div key={s.id} {...rowProps} className={`panel flex flex-wrap items-end gap-3 p-4 ${rowProps.className}`}>
            <div className="self-center pb-1">
              <DragHandle
                index={index}
                count={stats.length}
                handleProps={sort.handleProps(index)}
                onMoveUp={() => sort.moveUp(index)}
                onMoveDown={() => sort.moveDown(index)}
                label={s.label.tr || 'İstatistik'}
              />
            </div>
            <div className="w-24">
              <label className="field-label">Değer</label>
              <input
                type="number"
                value={s.value}
                onChange={(e) => patch(s.id, { value: Number(e.target.value) || 0 })}
                className="field-input"
              />
            </div>
            <div className="w-20">
              <label className="field-label">Önek</label>
              <input value={s.prefix ?? ''} onChange={(e) => patch(s.id, { prefix: e.target.value })} className="field-input" />
            </div>
            <div className="w-20">
              <label className="field-label">Sonek</label>
              <input value={s.suffix} onChange={(e) => patch(s.id, { suffix: e.target.value })} className="field-input" />
            </div>
            <div className="min-w-[14rem] flex-1">
              <LocalizedField label="Etiket" value={s.label} onChange={(v) => patch(s.id, { label: v })} />
            </div>
            <IconButton
              variant="danger"
              title="İstatistiği sil"
              onClick={() => remove(index, s, s.label.tr || 'İstatistik')}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
          );
        })}
      </div>
      <div className="mt-4">
        <AddButton
          label="İstatistik ekle"
          onClick={() => setStats((l) => [...l, { id: crypto.randomUUID(), value: 0, suffix: '', prefix: '', label: { ...empty } }])}
        />
      </div>
    </div>
  );
}
