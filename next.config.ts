import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer tourne côté Node : on le laisse hors du bundle.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Les polices et les icônes sont lues sur le disque au moment de produire un
  // PDF. Sans cette ligne, le traceur de fichiers ne les verrait pas et la
  // fonction déployée partirait sans elles.
  outputFileTracingIncludes: {
    "/api/apercu": ["./public/fonts/**/*", "./public/icones/**/*"],
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
