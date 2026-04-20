import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ClaudeShop',
    template: '%s · ClaudeShop',
  },
  description: 'The modern commerce CMS — PrestaShop v150 under steroids for 2026.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body data-density="spacious" className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
