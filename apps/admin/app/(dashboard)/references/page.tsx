import { readSiteContent } from '../../../lib/content';
import { ReferencesEditor } from '../../../components/editors/references-editor';

export const dynamic = 'force-dynamic';

export default async function ReferencesPage() {
  const content = await readSiteContent();
  return <ReferencesEditor meta={content.referencesMeta} references={content.references} />;
}
