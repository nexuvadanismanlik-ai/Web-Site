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

  // The unread badge is decoration; it must not be able to take the whole panel
  // down with it if the API is briefly unreachable. The page inside this layout
  // still surfaces a real failure through error.tsx.
  let unread = 0;
  try {
    unread = (await readMessages()).unread;
  } catch {
    unread = 0;
  }

  return (
    <RootShell>
      <AdminShell userName={session.user?.name ?? 'Admin'} unreadCount={unread}>
        {children}
      </AdminShell>
    </RootShell>
  );
}
