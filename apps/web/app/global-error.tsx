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

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    recover(error);
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '6rem 1rem' }}>
        <h1>Sayfa yüklenemedi</h1>
        <p>Sayfayı yenileyin. Sorun sürerse 0535 529 5700 numarasından bize ulaşabilirsiniz.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '0.75rem 1.5rem' }}>
          Yenile
        </button>
      </body>
    </html>
  );
}
