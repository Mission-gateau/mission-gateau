import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mission Gâteau — le jeu d'anniversaire personnalisé, prêt à imprimer",
    template: "%s — Mission Gâteau",
  },
  description:
    "Choisissez un thème, l'âge et les cachettes de votre maison : Mission Gâteau compose aussitôt un kit de jeu d'anniversaire complet, à imprimer en A4.",
  // Le site reste invisible des moteurs pendant ce lot.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#fdf8f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
