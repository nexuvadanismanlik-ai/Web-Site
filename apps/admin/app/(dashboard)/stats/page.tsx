import { readSiteContent } from '../../../lib/content';
import { StatsEditor } from '../../../components/editors/stats-editor';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const content = await readSiteContent();
  return <StatsEditor stats={content.stats} />;
}
