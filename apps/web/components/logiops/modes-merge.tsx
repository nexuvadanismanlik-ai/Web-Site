'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { PHOTOS, photoSrcSet, photoUrl, type Photo } from '../../lib/imagery';

interface Mode {
  photo: Photo;
  name: string;
  documents: string;
}

const MODES: Mode[] = [
  { photo: PHOTOS.plane, name: 'Havayolu', documents: 'AWB, Master AWB, manifest' },
  { photo: PHOTOS.ship, name: 'Denizyolu', documents: 'Bill of Lading, konteyner bilgisi' },
  { photo: PHOTOS.truck, name: 'Karayolu', documents: 'CMR, araç ve sefer bilgisi' },
];

const FILE_ROWS = ['Müşteri ve taşıma bilgisi', 'AWB / B/L / CMR', 'Manifest', 'Satış ve alış faturası', 'Dokümanlar ve mailler'];

/**
 * Air, sea and road arrive as three photographs and leave as one operation
 * file. The connecting lines draw once when the section scrolls into view;
 * each photograph grows a little under the pointer.
 */
export function ModesMerge() {
  const still = useReducedMotion();

  return (
    <div className="relative">
      <div className="grid gap-5 md:grid-cols-3">
        {MODES.map((m, i) => (
          <motion.figure
            key={m.name}
            initial={{ opacity: 0, y: still ? 0 : 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="zoom-frame group relative aspect-[4/3] rounded-[var(--r-lg)] bg-[#0d1420] text-white shadow-[var(--shadow-raise)]"
          >
            <img
              src={photoUrl(m.photo, 900)}
              srcSet={photoSrcSet(m.photo, [480, 900, 1400])}
              sizes="(min-width: 768px) 33vw, 100vw"
              alt={m.photo.alt}
              loading="lazy"
              className="h-full w-full rounded-[var(--r-lg)] object-cover"
            />
            <div className="absolute inset-0 rounded-[var(--r-lg)] bg-gradient-to-t from-[rgba(8,12,20,0.85)] via-[rgba(8,12,20,0.2)] to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 p-6">
              <p className="font-heading text-2xl">{m.name}</p>
              <p className="mt-1 text-sm text-white/75">{m.documents}</p>
            </figcaption>
          </motion.figure>
        ))}
      </div>

      {/* Three lines converge on the file. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        className="mx-auto hidden h-20 w-full md:block"
      >
        {[50, 150, 250].map((x, i) => (
          <motion.path
            key={x}
            d={`M ${x} 0 C ${x} 45, 150 35, 150 80`}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: still ? 1 : 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.4 + i * 0.12, ease: 'easeInOut' }}
          />
        ))}
      </svg>
      <div aria-hidden="true" className="mx-auto h-10 w-px bg-[color:var(--gold)] md:hidden" />

      <motion.div
        initial={{ opacity: 0, scale: still ? 1 : 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-md rounded-[var(--r-lg)] border border-[color:var(--gold)] bg-card p-7 shadow-[var(--shadow-float)] transition-transform duration-500 hover:scale-[1.03] motion-reduce:hover:scale-100"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'color-mix(in srgb, var(--gold) 18%, transparent)' }}
          >
            <FileText className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          </span>
          <div>
            <p className="font-heading text-xl text-fg">Tek operasyon dosyası</p>
            <p className="text-sm text-muted">Bilgi bir kez girilir, her yerde kullanılır.</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2 border-t border-overlay/10 pt-5 text-sm text-fg">
          {FILE_ROWS.map((row) => (
            <li key={row} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
              {row}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
