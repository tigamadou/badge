import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/ui/AppToaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// La favicon vient de la convention de fichier Next.js : src/app/icon.jpeg est
// detecte automatiquement et la balise <link rel="icon"> est generee, avec une
// URL versionnee par un hash. Ne pas la redeclarer dans `icons` : le chemin
// "/icon.jpeg" designerait public/icon.jpeg, qui n'existe pas.
export const metadata: Metadata = {
  title: "Badge Bénin",
  description: "Badge Bénin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
