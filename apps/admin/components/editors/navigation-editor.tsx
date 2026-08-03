'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { NavItem, FooterContent, FooterColumn, Localized } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import { TextField, LocalizedField, Panel, EditorHeader, useSaver, IconButton, AddButton } from '../fields';

const empty: Localized = { tr: '', en: '' };

export function NavigationEditor({
  nav: n0,
  logos: l0,
  footer: f0,
}: {
  nav: NavItem[];
  logos: string[];
  footer: FooterContent;
}) {
  const [nav, setNav] = useState<NavItem[]>(n0);
  const [logos, setLogos] = useState<string[]>(l0);
  const [footer, setFooter] = useState<FooterContent>(f0);
  const { saving, saved, run } = useSaver();

  const patchNav = (i: number, p: Partial<NavItem>) =>
    setNav((l) => l.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  const setCol = (ci: number, p: Partial<FooterColumn>) =>
    setFooter((f) => ({ ...f, columns: f.columns.map((c, idx) => (idx === ci ? { ...c, ...p } : c)) }));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Menü & Footer"
        subtitle="Navigasyon, logo şeridi ve alt bilgi"
        saving={saving}
        saved={saved}
        onSave={() =>
          run(async () => {
            await saveSection('nav', nav);
            await saveSection('logos', logos);
            await saveSection('footer', footer);
          })
        }
      />

      <div className="space-y-6">
        <Panel title="Üst Menü">
          <div className="space-y-3">
            {nav.map((item, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="min-w-[14rem] flex-1">
                  <LocalizedField label="Etiket" value={item.label} onChange={(v) => patchNav(i, { label: v })} />
                </div>
                <div className="w-40">
                  <label className="field-label">Bağlantı</label>
                  <input value={item.href} onChange={(e) => patchNav(i, { href: e.target.value })} className="field-input" />
                </div>
                <IconButton variant="danger" onClick={() => setNav((l) => l.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Menü öğesi ekle" onClick={() => setNav((l) => [...l, { label: { ...empty }, href: '/' }])} />
          </div>
        </Panel>

        <Panel title="Logo Şeridi (akan markalar)">
          <div className="flex flex-wrap gap-2">
            {logos.map((logo, i) => (
              <div key={i} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] py-1 pl-3 pr-1">
                <input
                  value={logo}
                  onChange={(e) => setLogos((l) => l.map((x, idx) => (idx === i ? e.target.value : x)))}
                  className="w-32 bg-transparent text-sm text-white focus:outline-none"
                />
                <button
                  onClick={() => setLogos((l) => l.filter((_, idx) => idx !== i))}
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLogos((l) => [...l, 'Yeni Marka'])}
            className="mt-3 rounded-lg border border-dashed border-white/15 px-4 py-2 text-sm text-ink-300 hover:border-brand-400/50 hover:text-white"
          >
            + Logo ekle
          </button>
        </Panel>

        <Panel title="Footer">
          <div className="space-y-4">
            <LocalizedField label="Hakkında Metni" value={footer.about} onChange={(v) => setFooter((f) => ({ ...f, about: v }))} multiline rows={3} />
            <LocalizedField label="Telif Metni" value={footer.copyright} onChange={(v) => setFooter((f) => ({ ...f, copyright: v }))} />
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Bağlantı Sütunları</p>
            {footer.columns.map((col, ci) => (
              <div key={ci} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <LocalizedField label="Sütun Başlığı" value={col.title} onChange={(v) => setCol(ci, { title: v })} />
                  </div>
                  <IconButton variant="danger" onClick={() => setFooter((f) => ({ ...f, columns: f.columns.filter((_, idx) => idx !== ci) }))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="space-y-2">
                  {col.links.map((link, li) => (
                    <div key={li} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[12rem] flex-1">
                        <LocalizedField label="" value={link.label} onChange={(v) => setCol(ci, { links: col.links.map((x, idx) => (idx === li ? { ...x, label: v } : x)) })} />
                      </div>
                      <div className="w-36">
                        <input
                          value={link.href}
                          placeholder="/hedef"
                          onChange={(e) => setCol(ci, { links: col.links.map((x, idx) => (idx === li ? { ...x, href: e.target.value } : x)) })}
                          className="field-input"
                        />
                      </div>
                      <IconButton variant="danger" onClick={() => setCol(ci, { links: col.links.filter((_, idx) => idx !== li) })}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                  <AddButton label="Bağlantı ekle" onClick={() => setCol(ci, { links: [...col.links, { label: { ...empty }, href: '/' }] })} />
                </div>
              </div>
            ))}
            <AddButton
              label="Sütun ekle"
              onClick={() => setFooter((f) => ({ ...f, columns: [...f.columns, { title: { ...empty }, links: [] }] }))}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
