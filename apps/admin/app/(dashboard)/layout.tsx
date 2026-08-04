import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { readMessages } from '../../lib/content';
import { adminPath } from '../../lib/routes';
import { AdminShell } from '../../components/admin-shell';
import { RootShell } from '../../components/root-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(adminPath('/login'));

  const messages = await readMessages();
  const unread = messages.filter((m) => !m.read).length;

  return (
    <RootShell>
      <AdminShell userName={session.user?.name ?? 'Admin'} unreadCount={unread}>
        {children}
      </AdminShell>
    </RootShell>
  );
}
