import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { HeroEditor } from '../../../components/editors/hero-editor';

export const dynamic = 'force-dynamic';

export default async function HeroPage() {
  // Together: two sequential reads are two cold starts back to back.
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return <HeroEditor hero={content.hero} cta={content.cta} images={media.files} />;
}
