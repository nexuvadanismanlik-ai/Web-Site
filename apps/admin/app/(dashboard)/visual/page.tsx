import { readSiteContent } from '../../../lib/content';
import { VisualEditor } from '../../../components/visual-editor';

export const dynamic = 'force-dynamic';

export default async function VisualPage() {
  const content = await readSiteContent();
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
  return <VisualEditor content={content} siteUrl={siteUrl} />;
}
