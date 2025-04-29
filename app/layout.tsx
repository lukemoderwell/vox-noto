import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vox Noto',
  description: 'Speak Notes onto a canvas',
  generator: 'v0.dev',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
