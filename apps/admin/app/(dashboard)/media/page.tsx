import { getMedia } from '../../actions';
import { MediaLibrary } from '../../../components/editors/media-library';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const initial = await getMedia();
  return <MediaLibrary initial={initial} />;
}
