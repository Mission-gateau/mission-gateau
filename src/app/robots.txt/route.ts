import { productionMaintenant, robotsTxt } from "@/site/referencement";

export const dynamic = "force-dynamic";

/** robots.txt, selon l'environnement lu à chaque requête (voir src/site/referencement.ts). */
export function GET(): Response {
  return new Response(robotsTxt(productionMaintenant()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
