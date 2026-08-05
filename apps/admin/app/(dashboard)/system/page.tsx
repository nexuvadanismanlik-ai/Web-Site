import { getSystemStatus } from '../../actions';
import { SystemStatusScreen } from '../../../components/editors/system-status';

export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  // Never throws: the one screen that must render when everything else cannot.
  const status = await getSystemStatus();
  return <SystemStatusScreen status={status} />;
}
