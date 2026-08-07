import { readSiteContent } from '../../../lib/content';
import { getMedia } from '../../actions';
import { TestimonialsEditor } from '../../../components/editors/testimonials-editor';

export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  const [content, media] = await Promise.all([readSiteContent(), getMedia()]);
  return (
    <TestimonialsEditor
      meta={content.testimonialsMeta}
      testimonials={content.testimonials}
      images={media.files}
    />
  );
}
