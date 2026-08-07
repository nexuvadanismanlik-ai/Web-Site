import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { NavigationEditor } from '../../../components/editors/navigation-editor';

export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return (
    <NavigationEditor
      nav={content.nav}
      logos={content.logos}
      footer={content.footer}
      images={media.files}
    />
  );
}
