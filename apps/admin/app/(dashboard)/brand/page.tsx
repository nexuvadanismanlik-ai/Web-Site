import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { BrandEditor } from '../../../components/editors/brand-editor';

export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  // Together: two sequential reads are two cold starts back to back when the
  // API has been idle.
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return <BrandEditor initial={content.brand} images={media.files} />;
}
