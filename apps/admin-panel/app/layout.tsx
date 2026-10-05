import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import { AdminAuthProvider } from '../src/auth/AdminAuthProvider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Tuljai Stays Admin',
  description: 'Administration foundation for Tuljai Stays.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
