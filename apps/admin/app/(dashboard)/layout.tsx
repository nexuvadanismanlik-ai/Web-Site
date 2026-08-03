import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { readMessages } from '../../lib/content';
import { fontVars } from '../../lib/fonts';
import { AdminShell } from '../../components/admin-shell';
import '../globals.css';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const messages = await readMessages();
  const unread = messages.filter((m) => !m.read).length;

  return (
    <html lang="tr" className={fontVars} suppressHydrationWarning>
      <body>
        <AdminShell userName={session.user?.name ?? 'Admin'} unreadCount={unread}>
          {children}
        </AdminShell>
      </body>
    </html>
  );
}
