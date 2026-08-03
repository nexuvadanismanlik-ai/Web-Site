'use client';

import { useState } from 'react';
import type { ContactContent } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { TextField, LocalizedField, Panel, EditorHeader, useSaver } from '../fields';

export function ContactEditor({ initial }: { initial: ContactContent }) {
  const [contact, setContact] = useState<ContactContent>(initial);
  const { saving, saved, run } = useSaver();

  const set = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) =>
    setContact((c) => ({ ...c, [k]: v }));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="İletişim"
        subtitle="İletişim bölümü içeriği ve bilgileri"
        saving={saving}
        saved={saved}
        onSave={() => run(() => saveSection('contact', contact))}
      />
      <div className="space-y-6">
        <Panel title="Metinler">
          <div className="space-y-4">
            <LocalizedField label="Rozet" value={contact.badge} onChange={(v) => set('badge', v)} />
            <LocalizedField label="Başlık" value={contact.title} onChange={(v) => set('title', v)} />
            <LocalizedField label="Açıklama" value={contact.description} onChange={(v) => set('description', v)} multiline rows={2} />
          </div>
        </Panel>
        <Panel title="Bilgiler">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="E-posta" value={contact.email} onChange={(v) => set('email', v)} />
            <TextField label="Telefon" value={contact.phone} onChange={(v) => set('phone', v)} />
          </div>
          <div className="mt-4">
            <LocalizedField label="Adres" value={contact.address} onChange={(v) => set('address', v)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
