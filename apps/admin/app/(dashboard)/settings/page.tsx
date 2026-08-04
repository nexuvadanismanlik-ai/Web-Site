import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { SettingsClient } from '../../../components/editors/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = (await getServerSession(authOptions)) as
    | { user?: { name?: string | null; email?: string | null }; role?: string }
    | null;

  return (
    <SettingsClient
      name={session?.user?.name ?? 'Admin'}
      email={session?.user?.email ?? ''}
      role={session?.role ?? 'ADMIN'}
    />
  );
}
