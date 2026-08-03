import { readSiteContent } from '../../../lib/content';
import { ProcessEditor } from '../../../components/editors/process-editor';

export const dynamic = 'force-dynamic';

export default async function ProcessPage() {
  const content = await readSiteContent();
  return <ProcessEditor meta={content.processMeta} steps={content.process} />;
}
