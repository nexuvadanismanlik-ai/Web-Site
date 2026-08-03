import { readSiteContent } from '../../../lib/content';
import { ContactEditor } from '../../../components/editors/contact-editor';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const content = await readSiteContent();
  return <ContactEditor initial={content.contact} />;
}
