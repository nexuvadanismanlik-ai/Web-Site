import { Skeleton } from '@nexuva/ui';

/**
 * What a screen looks like while its data is on the way.
 *
 * The panel had none of this. Every route was server-rendered with no
 * `loading.tsx` anywhere, which in the App Router means a navigation shows the
 * *previous* screen until the next one is completely ready. Click a tab, and
 * nothing happens — no spinner, no dimming, no movement — for however long the
 * fetch takes. On a warm service that is half a second and nobody notices. On a
 * cold start it is a minute of a frozen panel with no evidence the click
 * registered, which is why waiting for this panel felt so much worse than the
 * measurements said it should.
 *
 * These are shaped like the screens they stand in for, not generic boxes: a
 * skeleton whose layout matches what arrives makes the page appear to settle,
 * while a spinner in the middle of an empty page makes it appear to restart.
 */

/** The title block every screen opens with. */
function Header({ wide = false }: { wide?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className={`h-8 ${wide ? 'w-64' : 'w-48'}`} />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-32 shrink-0" />
    </div>
  );
}

/** A panel of form fields — the shape of most content editors. */
function FieldPanel({ fields = 4 }: { fields?: number }) {
  return (
    <div className="panel space-y-5 p-5">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Marka, Hero, Hakkımızda, İletişim, SEO, Metinler, Entegrasyonlar, Ayarlar. */
export function EditorSkeleton({ panels = 2, fields = 4 }: { panels?: number; fields?: number }) {
  return (
    <div className="mx-auto max-w-4xl" role="status" aria-label="Yükleniyor">
      <Header />
      <div className="space-y-6">
        {Array.from({ length: panels }).map((_, i) => (
          <FieldPanel key={i} fields={fields} />
        ))}
      </div>
    </div>
  );
}

/** Hizmetler, Referanslar, Görüşler, Süreç, Menü — repeated editable rows. */
export function ListEditorSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-4xl" role="status" aria-label="Yükleniyor">
      <Header />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="panel flex items-center gap-4 p-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The overview: tiles, then a couple of wider blocks. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Yükleniyor">
      <Header wide />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Medya — a grid of thumbnails. */
export function GridSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Yükleniyor">
      <Header wide />
      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="panel overflow-hidden">
            <Skeleton className="h-28 w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mesajlar, Yayın, Mail — a stack of rows. */
export function RowsSkeleton({ rows = 6, wide = false }: { rows?: number; wide?: boolean }) {
  return (
    <div className={wide ? 'mx-auto max-w-6xl' : 'mx-auto max-w-4xl'} role="status" aria-label="Yükleniyor">
      <Header wide={wide} />
      <div className="panel divide-y divide-overlay/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** CRM — a pipeline of columns. */
export function BoardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Yükleniyor">
      <Header wide />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mt-6 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, column) => (
          <div key={column} className="w-64 shrink-0 space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-24 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ziyaretçiler — tiles, a chart, then tables. */
export function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" role="status" aria-label="Yükleniyor">
      <Header wide />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="panel mt-6 p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
