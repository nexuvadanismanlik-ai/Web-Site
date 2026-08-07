import { readSiteContent } from '../../../lib/content';
import { UiTextEditor } from '../../../components/editors/ui-text-editor';

export const dynamic = 'force-dynamic';

export default async function TextsPage() {
  const content = await readSiteContent();
  return <UiTextEditor initial={content.uiText ?? {}} />;
}
