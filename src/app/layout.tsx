import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dingers Only — Fantasy HR League',
  description: 'A fantasy baseball league that only tracks home runs. Live stats from Baseball Savant.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="noise-bg grid-bg min-h-screen antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
