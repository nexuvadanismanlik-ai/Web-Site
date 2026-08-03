import { readSiteContent } from '../../../lib/content';
import { NavigationEditor } from '../../../components/editors/navigation-editor';

export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  const content = await readSiteContent();
  return <NavigationEditor nav={content.nav} logos={content.logos} footer={content.footer} />;
}
