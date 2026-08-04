import type { ReactNode } from 'react';
import { RootShell } from '../../components/root-shell';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
