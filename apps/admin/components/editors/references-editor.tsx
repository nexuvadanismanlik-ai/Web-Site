'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, Trash2 } from 'lucide-react';
import type { ReferenceItem, SectionMeta, Localized } from '@nexuva/types';
import { ImageField, type PickableImage } from '@nexuva/ui';
import { saveSection } from '../../app/actions';
import {
  TextField,
  LocalizedField,
  MetaFields,
  EditorHeader,
  useSaver,
  IconButton,
  AddButton,
} from '../fields';
import { DragHandle, useRemoveWithUndo, useSortable } from './list-controls';

const empty: Localized = { tr: '', en: '' };

/**
 * References, with enough substance to be worth reading.
 *
 * This screen used to collect a name and a category, which produces a logo wall
 * — a row of marks that proves nothing and that any site can fake. What makes a
 * reference persuasive is what was done, for whom, and a link that lets the
 * reader check. All of it optional: a client who will not be named still
 * belongs on the list.
 */
export function ReferencesEditor({
  meta: m0,
  references: r0,
  images,
}: {
  meta: SectionMeta;
  references: ReferenceItem[];
  images: PickableImage[];
}) {
  const [meta, setMeta] = useState<SectionMeta>(m0);
  const [refs, setRefs] = useState<ReferenceItem[]>(r0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { saving, saved, error, run } = useSaver();

  const sort = useSortable(refs, setRefs);
  const remove = useRemoveWithUndo(setRefs);

  const patch = (id: string, p: Partial<ReferenceItem>) =>
    setRefs((l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Referanslar"
        subtitle="Çalıştığın markalar — sürükleyerek sırala"
        saving={saving}
        saved={saved}
        error={error}
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
          {refs.map((r, index) => {
            const open = openId === r.id;
            const rowProps = sort.rowProps(index);
            return (
              <div key={r.id} {...rowProps} className={`panel overflow-hidden ${rowProps.className}`}>
                <div className="flex items-center gap-2 p-4">
                  <DragHandle
                    index={index}
                    count={refs.length}
                    handleProps={sort.handleProps(index)}
                    onMoveUp={() => sort.moveUp(index)}
                    onMoveDown={() => sort.moveDown(index)}
                    label={r.name || 'Referans'}
                  />

                  {/* The mark itself, so the list is scannable by logo. */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-overlay/10 bg-overlay/5">
                    {r.logoUrl ? (
                      // A user upload on this platform's own storage.
                      <img src={r.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs font-bold text-faint">
                        {(r.name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <button
                    onClick={() => setOpenId(open ? null : r.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={`h-4 w-4 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">
                        {r.name || 'Yeni referans'}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {r.category.tr || 'Sektör belirtilmedi'}
                      </span>
                    </span>
                  </button>

                  {r.website && (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer"
                      title="Siteyi aç"
                      className="shrink-0 text-faint hover:text-fg"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  <IconButton
                    variant="danger"
                    title="Referansı sil"
                    onClick={() => remove(index, r, r.name || 'Referans')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-overlay/10 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Marka Adı"
                        value={r.name}
                        onChange={(v) => patch(r.id, { name: v })}
                      />
                      <TextField
                        label="Web Sitesi"
                        value={r.website ?? ''}
                        onChange={(v) => patch(r.id, { website: v })}
                        placeholder="https://ornek.com"
                      />
                    </div>

                    <LocalizedField
                      label="Sektör"
                      value={r.category}
                      onChange={(v) => patch(r.id, { category: v })}
                    />

                    <LocalizedField
                      label="Ne yaptık"
                      value={r.description ?? { ...empty }}
                      onChange={(v) => patch(r.id, { description: v })}
                      multiline
                      rows={3}
                      placeholder="Bir iki cümle. Logo duvarı hiçbir şey kanıtlamaz; bu kanıtlar."
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ImageField
                        label="Logo"
                        value={r.logoUrl ?? ''}
                        onChange={(url) => patch(r.id, { logoUrl: url })}
                        images={images}
                        hint="Şeffaf PNG en iyi sonucu verir."
                      />
                      <ImageField
                        label="Proje Görseli"
                        value={r.imageUrl ?? ''}
                        onChange={(url) => patch(r.id, { imageUrl: url })}
                        images={images}
                        hint="Ekran görüntüsü ya da işin fotoğrafı."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AddButton
          label="Referans ekle"
          onClick={() =>
            setRefs((l) => [
              ...l,
              { id: crypto.randomUUID(), name: '', category: { ...empty } },
            ])
          }
        />
      </div>
    </div>
  );
}
