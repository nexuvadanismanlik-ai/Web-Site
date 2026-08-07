import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { ProcessEditor } from '../../../components/editors/process-editor';

export const dynamic = 'force-dynamic';

export default async function ProcessPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return (
    <ProcessEditor meta={content.processMeta} steps={content.process} images={media.files} />
  );
}
