import type { Metadata } from 'next';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TB Guard',
  description: 'Dashboard pemantauan batuk TB berbasis perangkat mic array + kamera.',
  icons: {
    icon: [
      { url: '/logo-tbguard.png', sizes: 'any', type: 'image/png' },
      { url: '/logo-tbguard.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/logo-tbguard.png',
    apple: '/logo-tbguard.png',
  },
};

// set kelas dark sebelum hydrate supaya tidak berkedip
const themeScript = `try{if(localStorage.getItem('tbv_dark')==='1')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo-tbguard.png" type="image/png" />
        <link rel="shortcut icon" href="/logo-tbguard.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-tbguard.png" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
