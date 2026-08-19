import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { LogiOpsEditor } from '../../../components/editors/logiops-editor';

export const dynamic = 'force-dynamic';

export default async function LogiOpsPage() {
  // Together: two sequential reads are two cold starts back to back.
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return <LogiOpsEditor initial={content.logiops ?? {}} images={media.files} />;
}
