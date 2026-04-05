import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import AuthProvider from "@/components/auth-provider";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "KNGO SEO Platform",
  description: "Multi-client SEO management platform by KangoMedia",
  icons: { icon: "/brand/mark-default.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${montserrat.variable}`}>
      <body className={`${montserrat.className} min-h-full`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

