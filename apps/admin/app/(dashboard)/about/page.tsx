import { readSiteContent } from '../../../lib/content';
import { AboutEditor } from '../../../components/editors/about-editor';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const content = await readSiteContent();
  return <AboutEditor initial={content.about} />;
}
