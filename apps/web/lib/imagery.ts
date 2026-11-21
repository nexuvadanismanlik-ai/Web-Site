/**
 * The site's own photographs.
 *
 * All from Unsplash, served from Unsplash's CDN (their API terms ask for
 * hotlinking, and each download was registered through the API). A photo
 * uploaded in the panel for the same slot always wins over these.
 */
export interface Photo {
  /** Base CDN address, without size parameters. */
  src: string;
  alt: string;
  credit: string;
}

/** A sized, auto-format address for a photo. */
export function photoUrl(photo: Photo, width: number): string {
  return `${photo.src}?auto=format&fit=crop&q=72&w=${width}`;
}

/** A srcset for responsive images. */
export function photoSrcSet(photo: Photo, widths: number[] = [640, 1080, 1600, 2400]): string {
  return widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(', ');
}

export const PHOTOS = {
  istanbul: {
    src: 'https://images.unsplash.com/photo-1696711551721-458511adcd86',
    alt: 'Gece ışıklarıyla İstanbul ve Boğaz köprüsü',
    credit: 'Joshua Kettle / Unsplash',
  },
  office: {
    src: 'https://images.unsplash.com/photo-1770777843445-2a1621b1201d',
    alt: 'Modern bir ofiste bilgisayar başında çalışan ekip',
    credit: 'Beatriz Cattel / Unsplash',
  },
  dashboard: {
    src: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74',
    alt: 'Dizüstü bilgisayar ekranında raporlama paneli',
    credit: 'Stephen Dawson / Unsplash',
  },
  plane: {
    src: 'https://images.unsplash.com/photo-1698594691277-62dba3f51eda',
    alt: 'Apronda bekleyen geniş gövdeli uçak',
    credit: 'Toni Pomar / Unsplash',
  },
  ship: {
    src: 'https://images.unsplash.com/photo-1769144256207-bc4bb75b29db',
    alt: 'Limanda konteyner yüklü gemi, kuşbakışı',
    credit: 'Daniel Miksha / Unsplash',
  },
  truck: {
    src: 'https://images.unsplash.com/photo-1766785368863-f2188a8c8b32',
    alt: 'Otoyolda ilerleyen iki tır',
    credit: 'Bhargav Panchal / Unsplash',
  },
  port: {
    src: 'https://images.unsplash.com/photo-1782398138808-694776d26c4c',
    alt: 'Konteyner limanı ve vinçler, kuşbakışı',
    credit: 'Cosmin Andrei Buzamat / Unsplash',
  },
} satisfies Record<string, Photo>;
