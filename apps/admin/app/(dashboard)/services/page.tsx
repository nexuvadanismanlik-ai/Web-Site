import { readSiteContent } from '../../../lib/content';
import { ServicesEditor } from '../../../components/editors/services-editor';

export const dynamic = 'force-dynamic';

export default async function ServicesAdminPage() {
  const content = await readSiteContent();
  return <ServicesEditor meta={content.servicesMeta} services={content.services} />;
}
