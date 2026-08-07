import { getMedia } from '../../actions';
import { MediaLibrary } from '../../../components/editors/media-library';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  // The library is the one place that shows where a file is used.
  const initial = await getMedia(true);
  return <MediaLibrary initial={initial} />;
}
