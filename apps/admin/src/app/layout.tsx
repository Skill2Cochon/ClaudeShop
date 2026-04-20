import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ClaudeShop Admin',
    template: '%s · ClaudeShop Admin',
  },
  description: 'ClaudeShop administration dashboard',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body data-density="compact" className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
