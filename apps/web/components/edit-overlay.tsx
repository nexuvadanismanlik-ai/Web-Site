'use client';

import { useEffect } from 'react';

/**
 * Activates click-to-edit mode when the site is opened with ?edit=1
 * (i.e. inside the admin panel's visual editor iframe).
 *
 * - Adds the `nx-edit` class to <html> so [data-edit] targets highlight.
 * - Captures clicks: a click on any [data-edit] element posts its content
 *   path to the parent window (the admin), which opens an edit drawer.
 * - All link navigation is suppressed in edit mode so the admin's page
 *   selector stays the single source of navigation.
 */
export function EditOverlay() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return;

    document.documentElement.classList.add('nx-edit');

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const editEl = target?.closest?.('[data-edit]') as HTMLElement | null;
      const link = target?.closest?.('a');

      if (editEl) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage(
          { type: 'nexuva:edit', path: editEl.getAttribute('data-edit') },
          '*',
        );
        return;
      }
      // Keep the iframe on the current page; navigation happens in the admin.
      if (link) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', onClick, true);
    window.parent.postMessage({ type: 'nexuva:ready' }, '*');

    return () => {
      document.removeEventListener('click', onClick, true);
      document.documentElement.classList.remove('nx-edit');
    };
  }, []);

  return null;
}
