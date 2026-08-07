import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { readMessages } from '../../lib/content';
import { getNotifications } from '../actions';
import { adminPath } from '../../lib/routes';
import { AdminShell } from '../../components/admin-shell';
import { RootShell } from '../../components/root-shell';
import { KeepAwake } from '../../components/keep-awake';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect(adminPath('/login'));

  // The unread badge is decoration; it must not be able to take the whole panel
  // down with it if the API is briefly unreachable. The page inside this layout
  // still surfaces a real failure through error.tsx.
  let unread = 0;
  let unreadNotifications = 0;
  try {
    const [inbox, notifications] = await Promise.all([
      readMessages(),
      getNotifications(true).catch(() => []),
    ]);
    unread = inbox.unread;
    unreadNotifications = notifications.length;
  } catch {
    unread = 0;
  }

  return (
    <RootShell>
      {/* While somebody is working here, the API does not get to fall asleep
          between two clicks of the same session. See the component. */}
      <KeepAwake />
      <AdminShell
        userName={session.user?.name ?? 'Admin'}
        unreadCount={unread}
        unreadNotifications={unreadNotifications}
      >
        {children}
      </AdminShell>
    </RootShell>
  );
}
