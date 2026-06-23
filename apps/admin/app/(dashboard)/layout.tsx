import type { ReactNode } from 'react';
import '../globals.css';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Companies', href: '/companies' },
  { label: 'Products', href: '/products' },
  { label: 'Domains', href: '/domains' },
  { label: 'Pages', href: '/pages' },
  { label: 'SEO', href: '/seo' },
  { label: 'Branding', href: '/branding' },
  { label: 'Users', href: '/users' },
  { label: 'Settings', href: '/settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900">
          <div className="flex h-16 items-center border-b border-zinc-800 px-6">
            <span className="font-heading text-lg font-bold text-white">Nexuva OS</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-zinc-800 p-4">
            <p className="text-xs text-zinc-600">Nexuva OS v0.1.0</p>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
