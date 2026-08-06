import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { SeoEditor } from '../../../components/editors/seo-editor';

export const dynamic = 'force-dynamic';

/** Where the published site lives, for the canonical placeholder and previews. */
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function SeoPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);

  return (
    <SeoEditor
      initial={content.seo ?? {}}
      content={content}
      images={media.files}
      siteUrl={SITE_URL}
    />
  );
}
