import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { isFrankTheme, isRafaTheme, isTelecambiosVeTheme, CLIENT_NAME } from "../lib/theme";

const inter      = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains  = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: CLIENT_NAME,
  description: "Sistema Inteligente de Gestión de Equipo P2P",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={
        isFrankTheme
          ? `${inter.variable} ${jetbrains.variable} bg-[#0a0a0a] text-slate-50 min-h-screen font-[var(--font-inter)] antialiased selection:bg-orange-500/30`
          : isRafaTheme
          ? `${inter.variable} ${jetbrains.variable} bg-[#022c22] text-slate-50 min-h-screen font-[var(--font-inter)] antialiased selection:bg-emerald-500/30`
          : isTelecambiosVeTheme
          ? `${inter.variable} ${jetbrains.variable} bg-[#07090f] text-slate-50 min-h-screen font-[var(--font-inter)] antialiased selection:bg-violet-500/30`
          : `${inter.variable} ${jetbrains.variable} bg-slate-950 text-slate-50 min-h-screen font-[var(--font-inter)] antialiased`
      }>
        {children}
      </body>
    </html>
  );
}
