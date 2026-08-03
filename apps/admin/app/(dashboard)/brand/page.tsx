import { readSiteContent } from '../../../lib/content';
import { BrandEditor } from '../../../components/editors/brand-editor';

export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  const content = await readSiteContent();
  return <BrandEditor initial={content.brand} />;
}
