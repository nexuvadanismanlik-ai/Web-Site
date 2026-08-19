import { readSiteContent } from '../../../lib/content';
import { auditLinks } from '../../../lib/link-audit';
import { LinksEditor } from '../../../components/editors/links-editor';

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
  const content = await readSiteContent();
  // Audited on the server: this walks the whole content document, and shipping
  // that walk to the browser would mean shipping the document with it.
  return <LinksEditor initial={content.links ?? {}} audit={auditLinks(content)} />;
}
