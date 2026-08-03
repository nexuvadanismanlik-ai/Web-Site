import { readSiteContent } from '../../../lib/content';
import { HeroEditor } from '../../../components/editors/hero-editor';

export const dynamic = 'force-dynamic';

export default async function HeroPage() {
  const content = await readSiteContent();
  return <HeroEditor hero={content.hero} cta={content.cta} />;
}
