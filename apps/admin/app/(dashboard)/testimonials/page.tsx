import { readSiteContent } from '../../../lib/content';
import { TestimonialsEditor } from '../../../components/editors/testimonials-editor';

export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  const content = await readSiteContent();
  return <TestimonialsEditor meta={content.testimonialsMeta} testimonials={content.testimonials} />;
}
