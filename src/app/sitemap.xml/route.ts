import { planDuSite, productionMaintenant } from "@/site/referencement";

export const dynamic = "force-dynamic";

/** Le plan du site, en production seulement ; ailleurs, 404. */
export function GET(): Response {
  if (!productionMaintenant()) return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(planDuSite(), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
