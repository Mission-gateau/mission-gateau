import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les icônes sont des PNG de 128 pixels, servis tels quels : les faire
  // passer par l'optimiseur d'images ne gagnerait rien et consommerait le
  // quota de l'offre Hobby.
  images: { unoptimized: true },

  // @react-pdf/renderer tourne côté Node : on le laisse hors du bundle.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Les polices et les icônes sont lues sur le disque au moment de produire un
  // PDF. Sans ces lignes, le traceur de fichiers ne les verrait pas et les
  // fonctions déployées partiraient sans elles. Les crochets d'une route
  // dynamique s'échappent : la clé est un motif picomatch.
  // `npm run verifier:tracage` le vérifie sur le build.
  outputFileTracingIncludes: {
    "/api/apercu": ["./public/fonts/**/*", "./public/icones/**/*"],
    "/api/commande/\\[ref\\]/kit": ["./public/fonts/**/*", "./public/icones/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          // Le site reste invisible des moteurs pendant ce lot.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
