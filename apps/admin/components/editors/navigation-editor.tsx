'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { Trash2 } from 'lucide-react';
import type {
  NavItem,
  FooterContent,
  FooterColumn,
  LinkItem,
  Localized,
  LogoItem,
} from '@nexuva/types';
import { ImageField, type PickableImage } from '@nexuva/ui';
import { saveSection } from '../../app/actions';
import { LocalizedField, Panel, EditorHeader, useSaver, IconButton, AddButton } from '../fields';
import { DragHandle, fieldSetter, useRemoveWithUndo, useSortable } from './list-controls';

const empty: Localized = { tr: '', en: '' };

export function NavigationEditor({
  nav: n0,
  logos: l0,
  footer: f0,
  images,
}: {
  nav: NavItem[];
  logos: LogoItem[];
  footer: FooterContent;
  images: PickableImage[];
}) {
  const [nav, setNav] = useState<NavItem[]>(n0);
  const [logos, setLogos] = useState<LogoItem[]>(l0);
  const [footer, setFooter] = useState<FooterContent>(f0);
  const { saving, saved, error, run } = useSaver();

  // Menu order is the site's information architecture — it used to be whatever
  // order the items happened to be created in, permanently.
  const sortNav = useSortable(nav, setNav);
  const removeNav = useRemoveWithUndo(setNav);
  const sortLogos = useSortable(logos, setLogos);
  const removeLogo = useRemoveWithUndo(setLogos);

  const setColumns = fieldSetter(setFooter, 'columns');
  const sortColumns = useSortable(footer.columns, setColumns);
  const removeColumn = useRemoveWithUndo(setColumns);

  const patchNav = (i: number, p: Partial<NavItem>) =>
    setNav((l) => l.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Menü & Footer"
        subtitle="Navigasyon, logo şeridi ve alt bilgi — sürükleyerek sırala"
        saving={saving}
        saved={saved}
        error={error}
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
            {nav.map((item, i) => {
              const rowProps = sortNav.rowProps(i);
              return (
                <div
                  key={i}
                  {...rowProps}
                  className={`flex flex-wrap items-end gap-3 rounded-xl border border-overlay/10 bg-overlay/[0.02] p-3 ${rowProps.className}`}
                >
                  <div className="pb-1">
                    <DragHandle
                      index={i}
                      count={nav.length}
                      handleProps={sortNav.handleProps(i)}
                      onMoveUp={() => sortNav.moveUp(i)}
                      onMoveDown={() => sortNav.moveDown(i)}
                      label={item.label.tr || 'Menü öğesi'}
                    />
                  </div>
                  <div className="min-w-0 flex-1 sm:min-w-[14rem]">
                    <LocalizedField label="Etiket" value={item.label} onChange={(v) => patchNav(i, { label: v })} />
                  </div>
                  <div className="w-40">
                    <label className="field-label">Bağlantı</label>
                    <input value={item.href} onChange={(e) => patchNav(i, { href: e.target.value })} className="field-input" />
                  </div>
                  <IconButton
                    variant="danger"
                    title="Menü öğesini sil"
                    onClick={() => removeNav(i, item, item.label.tr || 'Menü öğesi')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <AddButton label="Menü öğesi ekle" onClick={() => setNav((l) => [...l, { label: { ...empty }, href: '/' }])} />
          </div>
        </Panel>

        <Panel title="Logo Şeridi (akan markalar)">
          <p className="mb-3 text-xs text-faint">
            Logo yüklenmemişse markanın adı yazıyla görünür — böylece bir müşteri, logosu
            elinize geçmeden de listeye girebilir.
          </p>
          <div className="space-y-3">
            {logos.map((logo, i) => {
              const rowProps = sortLogos.rowProps(i);
              const patch = (p: Partial<LogoItem>) =>
                setLogos((l) => l.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
              return (
                <div
                  key={i}
                  {...rowProps}
                  className={`flex flex-wrap items-end gap-3 rounded-xl border border-overlay/10 bg-overlay/[0.02] p-3 ${rowProps.className}`}
                >
                  <div className="pb-1">
                    <DragHandle
                      index={i}
                      count={logos.length}
                      handleProps={sortLogos.handleProps(i)}
                      onMoveUp={() => sortLogos.moveUp(i)}
                      onMoveDown={() => sortLogos.moveDown(i)}
                      label={logo.name || 'Marka'}
                    />
                  </div>
                  <div className="min-w-[10rem] flex-1">
                    <label className="field-label">Marka Adı</label>
                    <input
                      value={logo.name}
                      onChange={(e) => patch({ name: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="min-w-0 flex-[2] sm:min-w-[16rem]">
                    <ImageField
                      label="Logo"
                      value={logo.imageUrl ?? ''}
                      onChange={(url) => patch({ imageUrl: url })}
                      images={images}
                    />
                  </div>
                  <IconButton
                    variant="danger"
                    title="Markayı sil"
                    onClick={() => removeLogo(i, logo, logo.name || 'Marka')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <AddButton
              label="Marka ekle"
              onClick={() => setLogos((l) => [...l, { name: 'Yeni Marka' }])}
            />
          </div>
        </Panel>

        <Panel title="Footer">
          <div className="space-y-4">
            <LocalizedField label="Hakkında Metni" value={footer.about} onChange={(v) => setFooter((f) => ({ ...f, about: v }))} multiline rows={3} />
            <LocalizedField label="Telif Metni" value={footer.copyright} onChange={(v) => setFooter((f) => ({ ...f, copyright: v }))} />
            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField
                label="Footer Buton Metni"
                value={footer.cta?.label ?? { ...empty }}
                onChange={(v) => setFooter((f) => ({ ...f, cta: { label: v, href: f.cta?.href ?? '/contact' } }))}
                placeholder="Boş bırakılırsa buton görünmez"
              />
              <div>
                <label className="field-label">Footer Buton Bağlantısı</label>
                <input
                  value={footer.cta?.href ?? ''}
                  onChange={(e) => setFooter((f) => ({ ...f, cta: { label: f.cta?.label ?? { ...empty }, href: e.target.value } }))}
                  placeholder="/contact"
                  className="field-input"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bağlantı Sütunları</p>
            {footer.columns.map((col, ci) => (
              <FooterColumnCard
                key={ci}
                column={col}
                index={ci}
                count={footer.columns.length}
                rowProps={sortColumns.rowProps(ci)}
                handleProps={sortColumns.handleProps(ci)}
                onMoveUp={() => sortColumns.moveUp(ci)}
                onMoveDown={() => sortColumns.moveDown(ci)}
                onRemove={() => removeColumn(ci, col, col.title.tr || 'Sütun')}
                onChange={(next) =>
                  setColumns((current) => current.map((c, idx) => (idx === ci ? next : c)))
                }
              />
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

/**
 * One footer column and its links.
 *
 * Its own component because the links inside it are sortable too, and a hook
 * cannot be called inside the loop that renders the columns.
 */
function FooterColumnCard({
  column,
  index,
  count,
  rowProps,
  handleProps,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
}: {
  column: FooterColumn;
  index: number;
  count: number;
  rowProps: { className: string } & Record<string, unknown>;
  handleProps: Record<string, unknown>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (next: FooterColumn) => void;
}) {
  const setLinks: Dispatch<SetStateAction<LinkItem[]>> = (updater) =>
    onChange({
      ...column,
      links: typeof updater === 'function' ? updater(column.links) : updater,
    });
  const sortLinks = useSortable(column.links, setLinks);
  const removeLink = useRemoveWithUndo(setLinks);

  return (
    <div
      {...rowProps}
      className={`rounded-xl border border-overlay/10 bg-overlay/[0.02] p-4 ${rowProps.className}`}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="pb-1">
          <DragHandle
            index={index}
            count={count}
            handleProps={handleProps}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            label={column.title.tr || 'Sütun'}
          />
        </div>
        <div className="flex-1">
          <LocalizedField
            label="Sütun Başlığı"
            value={column.title}
            onChange={(v) => onChange({ ...column, title: v })}
          />
        </div>
        <IconButton variant="danger" title="Sütunu sil" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-2">
        {column.links.map((link, li) => {
          const linkRow = sortLinks.rowProps(li);
          return (
            <div
              key={li}
              {...linkRow}
              className={`flex flex-wrap items-end gap-2 rounded-lg ${linkRow.className}`}
            >
              <div className="pb-1">
                <DragHandle
                  index={li}
                  count={column.links.length}
                  handleProps={sortLinks.handleProps(li)}
                  onMoveUp={() => sortLinks.moveUp(li)}
                  onMoveDown={() => sortLinks.moveDown(li)}
                  label={link.label.tr || 'Bağlantı'}
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <LocalizedField
                  label=""
                  value={link.label}
                  onChange={(v) =>
                    setLinks((current) => current.map((x, idx) => (idx === li ? { ...x, label: v } : x)))
                  }
                />
              </div>
              <div className="w-36">
                <input
                  value={link.href}
                  placeholder="/hedef"
                  onChange={(e) =>
                    setLinks((current) =>
                      current.map((x, idx) => (idx === li ? { ...x, href: e.target.value } : x)),
                    )
                  }
                  className="field-input"
                />
              </div>
              <IconButton
                variant="danger"
                title="Bağlantıyı sil"
                onClick={() => removeLink(li, link, link.label.tr || 'Bağlantı')}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          );
        })}
        <AddButton
          label="Bağlantı ekle"
          onClick={() => setLinks((current) => [...current, { label: { ...empty }, href: '/' }])}
        />
      </div>
    </div>
  );
}
