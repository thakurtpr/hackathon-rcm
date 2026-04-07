import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SessionProvider } from '@/components/SessionProvider';
import MainLayoutWrapper from '@/components/MainLayoutWrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ScholarFlow AI - The Elite Path for India\'s Brightest',
  description: 'AI-driven funding for master dreams. Tailored loans and scholarships for India\'s top students.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased scroll-smooth`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-full bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <MainLayoutWrapper>
              {children}
            </MainLayoutWrapper>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
