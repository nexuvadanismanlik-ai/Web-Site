import type { Photo } from '../../lib/imagery';
import { photoSrcSet, photoUrl } from '../../lib/imagery';

/**
 * A full-width photograph with one sentence over it, used to break up the
 * page between sections. The picture drifts slightly larger while the pointer
 * is over it; nothing moves on its own.
 */
export function ImageBand({
  photo,
  title,
  text,
  align = 'left',
}: {
  photo: Photo;
  title: string;
  text?: string;
  align?: 'left' | 'right';
}) {
  return (
    <section className="group relative isolate overflow-hidden bg-[#0d1420] text-white">
      <img
        src={photoUrl(photo, 1600)}
        srcSet={photoSrcSet(photo)}
        sizes="100vw"
        alt={photo.alt}
        loading="lazy"
        className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 ${
          align === 'left'
            ? 'bg-[linear-gradient(90deg,rgba(8,12,20,0.85)_0%,rgba(8,12,20,0.45)_55%,rgba(8,12,20,0.1)_100%)]'
            : 'bg-[linear-gradient(270deg,rgba(8,12,20,0.85)_0%,rgba(8,12,20,0.45)_55%,rgba(8,12,20,0.1)_100%)]'
        }`}
      />
      <div className="container-x flex min-h-[300px] items-center py-12 sm:min-h-[380px]">
        <div className={`max-w-xl ${align === 'right' ? 'ml-auto text-right' : ''}`}>
          <h2 className="font-heading text-3xl leading-tight sm:text-5xl">{title}</h2>
          {text ? <p className="mt-5 text-lg leading-relaxed text-white/80">{text}</p> : null}
        </div>
      </div>
      <p className="absolute bottom-3 right-4 text-[11px] text-white/50">Fotoğraf: {photo.credit}</p>
    </section>
  );
}
