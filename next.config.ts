import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les icônes sont des PNG de 128 pixels, servis tels quels : les faire
  // passer par l'optimiseur d'images ne gagnerait rien et consommerait le
  // quota de l'offre Hobby.
  images: { unoptimized: true },

  // @react-pdf/renderer tourne côté Node : on le laisse hors du bundle.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Les polices et les icônes sont lues sur le disque au moment de produire un
  // PDF (le kit, l'aperçu, et les CGV jointes à la confirmation). Sans ces
  // lignes, le traceur de fichiers ne les verrait pas et les fonctions
  // déployées partiraient sans elles. Les crochets d'une route dynamique
  // s'échappent : la clé est un motif picomatch.
  // `npm run verifier:tracage` le vérifie sur le build.
  outputFileTracingIncludes: {
    "/api/apercu": ["./public/fonts/**/*", "./public/icones/**/*"],
    "/api/commande/\\[ref\\]/kit": ["./public/fonts/**/*", "./public/icones/**/*"],
    // Le PDF des CGV, joint à la confirmation de commande : envoyé par la
    // page de la commande et par la tâche quotidienne. Des polices, aucune icône.
    "/api/commande/\\[ref\\]/confirmation": ["./public/fonts/**/*"],
    "/api/effacement": ["./public/fonts/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          // `X-Robots-Tag` dépend de l'environnement, lu à l'exécution : src/proxy.ts le pose.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
