import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { ServicesEditor } from '../../../components/editors/services-editor';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return (
    <ServicesEditor
      meta={content.servicesMeta}
      services={content.services}
      images={media.files}
    />
  );
}
