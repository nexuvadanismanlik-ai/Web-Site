import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { ReferencesEditor } from '../../../components/editors/references-editor';

export const dynamic = 'force-dynamic';

export default async function ReferencesPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return (
    <ReferencesEditor
      meta={content.referencesMeta}
      references={content.references}
      images={media.files}
    />
  );
}
