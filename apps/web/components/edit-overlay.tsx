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
/**
 * The only window allowed to receive edit messages.
 *
 * Messages used to go to '*', so any page that framed the site with ?edit=1
 * received the content paths a visitor clicked. They now go only to the admin
 * panel: NEXT_PUBLIC_ADMIN_ORIGIN when it is configured, otherwise the origin
 * of the page that opened this frame (the panel's visual editor). With
 * neither, edit mode stays off.
 */
function editorOrigin(): string | null {
  const configured = process.env['NEXT_PUBLIC_ADMIN_ORIGIN'];
  try {
    if (configured) return new URL(configured).origin;
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {
    return null;
  }
  return null;
}

export function EditOverlay() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return;
    // Edit mode only makes sense inside the panel's frame.
    if (window.parent === window) return;
    const target = editorOrigin();
    if (!target) return;

    document.documentElement.classList.add('nx-edit');

    const onClick = (e: MouseEvent) => {
      const clicked = e.target as HTMLElement | null;
      const editEl = clicked?.closest?.('[data-edit]') as HTMLElement | null;
      const link = clicked?.closest?.('a');

      if (editEl) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage(
          { type: 'nexuva:edit', path: editEl.getAttribute('data-edit') },
          target,
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
    window.parent.postMessage({ type: 'nexuva:ready' }, target);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.documentElement.classList.remove('nx-edit');
    };
  }, []);

  return null;
}
