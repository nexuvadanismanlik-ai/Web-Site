'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Copy,
  Download,
  HardDrive,
  Image as ImageIcon,
  Link2,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmDialog, EmptyState, SearchBar, SelectField, useToast } from '@nexuva/ui';
import { uploadMedia, deleteMedia } from '../../app/actions';
import { MEDIA_FOLDERS, type MediaFile, type MediaFolder, type MediaList } from '../../lib/model';

/** What each folder is for, so the choice is not a guess. */
const FOLDER_LABELS: Record<MediaFolder, string> = {
  images: 'Görseller',
  logos: 'Logolar',
  documents: 'Belgeler',
  attachments: 'Ekler',
  uploads: 'Diğer',
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function MediaLibrary({ initial }: { initial: MediaList }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [folder, setFolder] = useState<MediaFolder>('images');
  const [filterFolder, setFilterFolder] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<'selection' | MediaFile | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr');
    return initial.files.filter((file) => {
      if (filterFolder && file.folder !== filterFolder) return false;
      if (!needle) return true;
      return file.filename.toLocaleLowerCase('tr').includes(needle);
    });
  }, [initial.files, filterFolder, search]);

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;

    const tooBig = Array.from(files).filter((f) => f.size > MAX_BYTES);
    if (tooBig.length > 0) {
      toast.error(`${tooBig.length} dosya 10 MB sınırını aşıyor ve atlandı.`);
    }
    const accepted = Array.from(files).filter((f) => f.size <= MAX_BYTES);
    if (accepted.length === 0) return;

    startTransition(async () => {
      let ok = 0;
      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        form.append('folder', folder);
        const result = await uploadMedia(form);
        if (result.ok) ok++;
        else toast.error(`${file.name}: ${result.error ?? 'yüklenemedi'}`);
      }
      if (ok > 0) {
        toast.success(ok === 1 ? 'Dosya yüklendi.' : `${ok} dosya yüklendi.`);
        router.refresh();
      }
      if (fileInput.current) fileInput.current.value = '';
    });
  }

  /** The files the open dialog is about, so it can name where they are used. */
  const doomed: MediaFile[] =
    confirming === 'selection'
      ? initial.files.filter((file) => selected.has(file.id))
      : confirming
        ? [confirming]
        : [];

  // force: the API refuses to delete a file that is still on the site. By the
  // time this runs, the dialog has listed every page it will vanish from and
  // somebody said yes anyway — which is the only thing force means.
  function removeMany(ids: string[]) {
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const result = await deleteMedia(id, true);
        if (result.ok) ok++;
        else toast.error(result.error ?? 'Silinemedi.');
      }
      if (ok > 0) {
        toast.success(ok === 1 ? 'Dosya silindi.' : `${ok} dosya silindi.`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Adres kopyalandı.');
    } catch {
      toast.error('Kopyalanamadı. Adresi elle seçebilirsin.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-fg">Medya Kütüphanesi</h1>
          <p className="mt-0.5 text-sm text-muted">
            {initial.total} dosya · {formatSize(initial.usedBytes)} kullanılıyor
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="w-40">
            <SelectField
              label="Klasör"
              value={folder}
              onChange={(v) => setFolder(v as MediaFolder)}
              options={MEDIA_FOLDERS.map((f) => ({ value: f, label: FOLDER_LABELS[f] }))}
            />
          </div>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={pending}
            className="ui-button-primary"
          >
            <Upload className="h-4 w-4" />
            {pending ? 'Yükleniyor...' : 'Dosya Yükle'}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Dosya adında ara..." />
        <div className="w-44">
          <SelectField
            label="Klasöre göre"
            value={filterFolder}
            onChange={setFilterFolder}
            options={[
              { value: '', label: 'Tümü' },
              ...MEDIA_FOLDERS.map((f) => ({ value: f, label: FOLDER_LABELS[f] })),
            ]}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-overlay/15 bg-overlay/5 px-4 py-3">
          <span className="text-sm text-fg">{selected.size} dosya seçildi</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())} className="ui-button text-xs">
              Seçimi bırak
            </button>
            <button
              onClick={() => setConfirming('selection')}
              disabled={pending}
              className="ui-button-danger text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Seçilenleri sil
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="ui-panel">
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title={
              initial.files.length === 0 ? 'Henüz dosya yok' : 'Bu filtreye uyan dosya yok'
            }
            hint={
              initial.files.length === 0
                ? 'Logo, referans görselleri ve belgeler burada saklanır.'
                : 'Aramayı veya klasör filtresini değiştir.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((file) => {
            const picked = selected.has(file.id);
            return (
              <div
                key={file.id}
                className={`ui-panel group overflow-hidden transition-colors ${
                  picked ? 'ring-2 ring-brand-400' : ''
                }`}
              >
                <button
                  onClick={() => toggle(file.id)}
                  aria-pressed={picked}
                  aria-label={`${file.filename} seç`}
                  className="flex h-32 w-full items-center justify-center bg-overlay/5"
                >
                  {isImage(file.mimeType) ? (
                    // Deliberately not next/image: these are user uploads on a
                    // CDN and the panel has optimisation disabled anyway.
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs font-semibold uppercase text-muted">
                      {file.mimeType.split('/')[1] ?? 'dosya'}
                    </span>
                  )}
                </button>

                <div className="border-t border-overlay/10 p-3">
                  <div className="truncate text-xs font-medium text-fg" title={file.filename}>
                    {file.filename}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {FOLDER_LABELS[file.folder as MediaFolder] ?? file.folder} ·{' '}
                    {formatSize(file.size)}
                  </div>

                  {/* Visible on the card, not only in the delete dialog: knowing
                      which files are live is what stops the tidy-up starting. */}
                  {(file.usedAt?.length ?? 0) > 0 && (
                    <div
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-brand-dyn"
                      title={(file.usedAt ?? [])
                        .map((use) => use.label + (use.detail ? ` → ${use.detail}` : ''))
                        .join('\n')}
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {(file.usedAt ?? []).map((use) => use.label).join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => void copyUrl(file.url)}
                      title="Adresi kopyala"
                      aria-label={`${file.filename} adresini kopyala`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-overlay/10 text-muted hover:text-fg"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Aç"
                      aria-label={`${file.filename} dosyasını aç`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-overlay/10 text-muted hover:text-fg"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => setConfirming(file)}
                      disabled={pending}
                      title="Sil"
                      aria-label={`${file.filename} dosyasını sil`}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-faint">
        <HardDrive className="h-3.5 w-3.5" />
        En fazla 10 MB · JPEG, PNG, WebP, GIF, SVG ve PDF
      </p>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'selection' ? 'Seçilen dosyaları sil' : 'Dosyayı sil'}
        confirmLabel={doomed.some((file) => (file.usedAt?.length ?? 0) > 0) ? 'Yine de sil' : 'Sil'}
        body={
          confirming === null ? undefined : (
            <div className="space-y-3">
              <p>
                {confirming === 'selection'
                  ? `${selected.size} dosya kalıcı olarak silinecek.`
                  : `${confirming.filename} kalıcı olarak silinecek.`}
              </p>

              {/* Naming the pages is the whole point. "May be in use somewhere"
                  is a warning nobody can act on, so it gets ignored — and then
                  the header logo disappears with nothing to connect it to. */}
              {doomed.some((file) => (file.usedAt?.length ?? 0) > 0) ? (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Şu anda sitede kullanılıyor — silersen oradan kaybolur:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {doomed.flatMap((file) =>
                      (file.usedAt ?? []).map((use) => (
                        <li key={`${file.id}-${use.href}-${use.detail ?? ''}`}>
                          • {use.label}
                          {use.detail ? ` → ${use.detail}` : ''}
                          {confirming === 'selection' ? ` (${file.filename})` : ''}
                        </li>
                      )),
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-faint">Sitede hiçbir yerde kullanılmıyor.</p>
              )}
            </div>
          )
        }
        busy={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const target = confirming;
          setConfirming(null);
          if (target === 'selection') removeMany([...selected]);
          else if (target) removeMany([target.id]);
        }}
      />
    </div>
  );
}
