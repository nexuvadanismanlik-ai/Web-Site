'use client';

import { useId, useState } from 'react';
import { ImageOff, Trash2, X } from 'lucide-react';

export interface PickableImage {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
}

/**
 * Picks an image that has already been uploaded.
 *
 * Deliberately a picker and not an uploader: uploading belongs in one place —
 * the media library — so that every file lands in a known folder, counts
 * against the same quota and can be found again. A field that uploads on the
 * side produces files nobody can locate afterwards.
 *
 * The address can also be typed, because an image hosted elsewhere is a
 * legitimate answer and refusing it would send someone to a workaround.
 */
export function ImageField({
  label,
  value,
  onChange,
  images,
  hint,
  emptyHint = 'Önce Medya Kütüphanesi\'ne görsel yükleyin.',
}: {
  label: string;
  /** Current image address, or empty. */
  value: string;
  onChange: (url: string) => void;
  /** What the media library holds. Non-images are filtered out. */
  images: PickableImage[];
  hint?: string;
  emptyHint?: string;
}) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const usable = images.filter((image) => image.mimeType.startsWith('image/'));

  return (
    <div>
      <label htmlFor={id} className="ui-label">
        {label}
      </label>

      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-overlay/10 bg-overlay/5">
          {value ? (
            // user upload on a CDN
            <img src={value} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <ImageOff className="h-5 w-5 text-faint" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="url"
            value={value}
            placeholder="https://..."
            onChange={(e) => onChange(e.target.value)}
            className="ui-input"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPicking(true)} className="ui-button text-xs">
              Kütüphaneden seç
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="ui-button text-xs"
                aria-label={`${label} görselini kaldır`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Kaldır
              </button>
            )}
          </div>
          {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
        </div>
      </div>

      {picking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} için görsel seç`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
        >
          <div className="ui-panel flex max-h-[80vh] w-full max-w-2xl flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-fg">Görsel seç</h2>
              <button
                onClick={() => setPicking(false)}
                aria-label="Kapat"
                className="text-faint hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {usable.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{emptyHint}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                {usable.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => {
                      onChange(image.url);
                      setPicking(false);
                    }}
                    title={image.filename}
                    className={`flex h-24 items-center justify-center overflow-hidden rounded-xl border bg-overlay/5 p-1 transition-colors ${
                      value === image.url
                        ? 'border-brand-400'
                        : 'border-overlay/10 hover:border-overlay/30'
                    }`}
                  >
                    {/* user upload on a CDN */}
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
