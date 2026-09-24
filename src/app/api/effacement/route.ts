import { dependancesReelles } from "@/vente/dependances";
import { lancerEffacement } from "@/vente/serveur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche quotidienne (cron Vercel, déclaré dans vercel.json) : efface la
 * configuration chiffrée des paiements de plus de 30 jours. Elle peut être
 * appelée par n'importe qui sans dégât : elle ne fait rien d'autre, et ne
 * renvoie que des compteurs.
 */
export function GET(): Promise<Response> {
  return lancerEffacement(dependancesReelles());
}
