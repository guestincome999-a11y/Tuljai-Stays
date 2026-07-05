import type { PropsWithChildren } from 'react';

import { AdminShell } from '../../src/layout/AdminShell';

export default function AdminSectionLayout({ children }: PropsWithChildren) {
  return <AdminShell>{children}</AdminShell>;
}
