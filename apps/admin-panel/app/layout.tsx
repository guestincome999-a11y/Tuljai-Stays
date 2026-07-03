import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Tuljai Stays Admin',
  description: 'Administration foundation for Tuljai Stays.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
