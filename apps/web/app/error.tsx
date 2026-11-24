'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'nx-reloaded';

/**
 * A page opened from a cached copy (a search result, a shared link, a tab left
 * open across a deploy) can ask for script files that no longer exist, and the
 * result is a blank or half-styled page. One reload fetches the current files.
 * Done once per tab, so a real fault shows the message instead of looping.
 */
function recover(error: Error): boolean {
  const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported|Importing a module script failed|Hydration|hydrat/i.test(
    `${error.name} ${error.message}`,
  );
  if (!stale) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    recover(error);
  }, [error]);

  return (
    <div className="container-x py-32 text-center">
      <h1 className="display-3 text-fg">Sayfa yüklenemedi</h1>
      <p className="text-muted mx-auto mt-4 max-w-md">
        Bir şeyler ters gitti. Sayfayı yenilemeyi deneyin; sorun sürerse bize 0535 529 5700 numarasından ulaşabilirsiniz.
      </p>
      <button type="button" onClick={() => reset()} className="btn-primary mt-8 inline-flex">
        Yeniden dene
      </button>
    </div>
  );
}
