import { readSiteContent } from '../../../lib/content';
import { IntegrationsEditor } from '../../../components/editors/integrations-editor';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const content = await readSiteContent();
  return <IntegrationsEditor initial={content.integrations ?? {}} />;
}
