import type { Metadata, Viewport } from "next";
import { MesureDAudience } from "@/composants/MesureDAudience";
import { productionMaintenant } from "@/site/referencement";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mission Gâteau — le jeu d'anniversaire personnalisé, prêt à imprimer",
    template: "%s — Mission Gâteau",
  },
  description:
    "Choisissez un thème, l'âge et les cachettes de votre maison : Mission Gâteau compose aussitôt un kit de jeu d'anniversaire complet, à imprimer en A4.",
  // Par défaut, invisible des moteurs : seules les pages publiques, en
  // production, demandent l'indexation (src/site/referencement.ts).
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Toutes les pages sont rendues à chaque requête : le pied de page, l'accueil
 * et /creer dépendent de l'ouverture de la vente, donc de STRIPE_SECRET_KEY,
 * qui n'est lue qu'à l'exécution, jamais au build.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#fdf8f0",
  width: "device-width",
  initialScale: 1,
};

/**
 * Les props sont écrites à la main plutôt que reprises du type `LayoutProps`
 * généré par Next : ce type n'existe qu'après un build, et la vérification des
 * types tourne avant le build en intégration continue.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {/* La mesure d'audience, en production seulement : lue à chaque requête, jamais au build. */}
        {productionMaintenant() ? <MesureDAudience /> : null}
      </body>
    </html>
  );
}
