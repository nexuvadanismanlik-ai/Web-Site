import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { AboutEditor } from '../../../components/editors/about-editor';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return <AboutEditor initial={content.about} images={media.files} />;
}
