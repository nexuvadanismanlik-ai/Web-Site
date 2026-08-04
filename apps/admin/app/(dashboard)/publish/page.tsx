import { getPublishStatus, getVersions } from '../../actions';
import { PublishCenter } from '../../../components/editors/publish-center';

export const dynamic = 'force-dynamic';

export default async function PublishPage() {
  // Together, so a cold API is woken once rather than twice.
  const [status, versions] = await Promise.all([getPublishStatus(), getVersions()]);
  return <PublishCenter status={status} versions={versions} />;
}
