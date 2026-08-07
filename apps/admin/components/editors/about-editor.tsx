'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { AboutContent, AboutHighlight, Localized } from '@nexuva/types';
import { ImageField, type PickableImage } from '@nexuva/ui';
import { saveSection } from '../../app/actions';
import { LocalizedField, Panel, EditorHeader, useSaver, IconButton, AddButton } from '../fields';
import { DragHandle, fieldSetter, useRemoveWithUndo, useSortable } from './list-controls';

const empty: Localized = { tr: '', en: '' };
const HL_ICONS = ['target', 'users', 'zap', 'shield', 'rocket', 'sparkles', 'layers', 'bar-chart', 'compass', 'cloud'];

export function AboutEditor({
  initial,
  images,
}: {
  initial: AboutContent;
  images: PickableImage[];
}) {
  const [about, setAbout] = useState<AboutContent>(initial);
  const { saving, saved, error, run } = useSaver();

  const set = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) =>
    setAbout((a) => ({ ...a, [k]: v }));
  const patchHl = (i: number, p: Partial<AboutHighlight>) =>
    set('highlights', about.highlights.map((h, idx) => (idx === i ? { ...h, ...p } : h)));

  // Paragraph order is the argument the section makes; highlight order is what
  // a reader sees first. Both were fixed at whatever order they were typed in.
  const setParagraphs = fieldSetter(setAbout, 'paragraphs');
  const setHighlights = fieldSetter(setAbout, 'highlights');
  const sortParagraphs = useSortable(about.paragraphs, setParagraphs);
  const sortHighlights = useSortable(about.highlights, setHighlights);
  const removeParagraph = useRemoveWithUndo(setParagraphs);
  const removeHighlight = useRemoveWithUndo(setHighlights);

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Hakkımızda"
        subtitle="Kurumsal tanıtım bölümü"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('about', about))}
      />
      <div className="space-y-6">
        <Panel title="Başlık">
          <div className="space-y-4">
            <LocalizedField label="Rozet" value={about.badge} onChange={(v) => set('badge', v)} />
            <LocalizedField label="Başlık" value={about.title} onChange={(v) => set('title', v)} />
          </div>
        </Panel>

        <Panel title="Görsel">
          <ImageField
            label="Bölüm Görseli"
            value={about.image ?? ''}
            onChange={(url) => set('image', url)}
            images={images}
            hint="Ekip, ofis ya da çalışma anından bir kare. Metnin yanında durur; boşsa bölüm sadece metin kalır."
          />
        </Panel>

        <Panel title="Paragraflar">
          <div className="space-y-3">
            {about.paragraphs.map((p, i) => {
              const rowProps = sortParagraphs.rowProps(i);
              return (
              <div key={i} {...rowProps} className={`flex items-end gap-2 rounded-lg ${rowProps.className}`}>
                <div className="pb-1">
                  <DragHandle index={i} count={about.paragraphs.length} handleProps={sortParagraphs.handleProps(i)} onMoveUp={() => sortParagraphs.moveUp(i)} onMoveDown={() => sortParagraphs.moveDown(i)} label={`Paragraf ${i + 1}`} />
                </div>
                <div className="flex-1">
                  <LocalizedField
                    label={`Paragraf ${i + 1}`}
                    value={p}
                    onChange={(v) => set('paragraphs', about.paragraphs.map((x, xi) => (xi === i ? v : x)))}
                    multiline
                    rows={3}
                  />
                </div>
                <IconButton variant="danger" title="Paragrafı sil" onClick={() => removeParagraph(i, p, `Paragraf ${i + 1}`)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              );
            })}
          </div>
          <div className="mt-3">
            <AddButton label="Paragraf ekle" onClick={() => set('paragraphs', [...about.paragraphs, { ...empty }])} />
          </div>
        </Panel>

        <Panel title="Öne Çıkanlar">
          <div className="space-y-3">
            {about.highlights.map((h, i) => {
              const rowProps = sortHighlights.rowProps(i);
              return (
              <div key={i} {...rowProps} className={`rounded-xl border border-overlay/10 bg-overlay/[0.02] p-4 ${rowProps.className}`}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="pb-1">
                    <DragHandle index={i} count={about.highlights.length} handleProps={sortHighlights.handleProps(i)} onMoveUp={() => sortHighlights.moveUp(i)} onMoveDown={() => sortHighlights.moveDown(i)} label={h.title.tr || 'Öne çıkan'} />
                  </div>
                  <div className="w-40 flex-1">
                    <label className="field-label">İkon</label>
                    <select value={h.icon} onChange={(e) => patchHl(i, { icon: e.target.value })} className="field-input">
                      {HL_ICONS.map((ic) => (
                        <option key={ic} value={ic} className="bg-card">{ic}</option>
                      ))}
                    </select>
                  </div>
                  <IconButton variant="danger" title="Öne çıkanı sil" onClick={() => removeHighlight(i, h, h.title.tr || 'Öne çıkan')}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="space-y-3">
                  <LocalizedField label="Başlık" value={h.title} onChange={(v) => patchHl(i, { title: v })} />
                  <LocalizedField label="Metin" value={h.text} onChange={(v) => patchHl(i, { text: v })} multiline rows={2} />
                </div>
              </div>
              );
            })}
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
