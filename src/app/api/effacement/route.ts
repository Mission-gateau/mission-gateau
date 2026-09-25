import { dependancesReelles } from "@/vente/dependances";
import { lancerTacheQuotidienne } from "@/vente/serveur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Le plafond de l'offre Hobby : la tâche envoie aussi des confirmations. */
export const maxDuration = 300;

/**
 * La tâche quotidienne (cron Vercel, déclaré dans vercel.json) : efface la
 * configuration chiffrée des paiements de plus de 30 jours, envoie les
 * confirmations manquantes et retente les remboursements des rétractations.
 * Vercel l'appelle avec le secret de CRON_SECRET ; sans lui, 401 et rien
 * d'autre.
 */
export function GET(requete: Request): Promise<Response> {
  return lancerTacheQuotidienne(requete, dependancesReelles());
}
