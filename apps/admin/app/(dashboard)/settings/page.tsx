import { getSession } from '../../../lib/session';
import { getSitePreferences, getSystemStatus } from '../../actions';
import { SettingsClient } from '../../../components/editors/settings-client';
import { SettingsHub } from '../../../components/editors/settings-hub';

export const dynamic = 'force-dynamic';

/** The public site, so somebody can check what they just published. */
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function SettingsPage() {
  const session = (await getSession()) as
    | { user?: { name?: string | null; email?: string | null }; role?: string }
    | null;

  // Together: the hub needs the live connection states to say whether anything
  // is broken, and waiting for them one after the other would double the cost
  // of a screen whose whole job is to be an overview.
  const [status, preferences] = await Promise.all([
    getSystemStatus(),
    getSitePreferences(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted">
          Sitenin neyle yapılandırıldığı, neyin çalıştığı ve neyin eksik olduğu.
        </p>
      </div>

      <SettingsHub
        connections={status.connections}
        preferences={preferences}
        siteUrl={SITE_URL}
      />

      {/* Account and panel appearance keep their own section: they are about
          the person using the panel, not about the site it manages. */}
      <SettingsClient
        name={session?.user?.name ?? 'Admin'}
        email={session?.user?.email ?? ''}
        role={session?.role ?? 'ADMIN'}
      />
    </div>
  );
}
