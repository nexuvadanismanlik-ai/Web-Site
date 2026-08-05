import type { SectionMeta } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Reveal } from '../motion';

export function SectionHeading({
  meta,
  align = 'center',
  basePath,
}: {
  meta: SectionMeta;
  align?: 'center' | 'left';
  basePath?: string;
}) {
  return (
    <div
      className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : 'text-left'}`}
    >
      <Reveal>
        <span className="eyebrow" data-edit={basePath ? `${basePath}.badge` : undefined}>
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          {t(meta.badge)}
        </span>
      </Reveal>
      <Reveal delay={0.05}>
        <h2
          className="mt-5 font-heading text-3xl font-bold text-fg text-balance sm:text-4xl md:text-5xl"
          data-edit={basePath ? `${basePath}.title` : undefined}
        >
          {t(meta.title)}
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p
          className="mt-4 text-base leading-relaxed text-muted sm:text-lg"
          data-edit={basePath ? `${basePath}.subtitle` : undefined}
        >
          {t(meta.subtitle)}
        </p>
      </Reveal>
    </div>
  );
}
