import { dependancesReelles } from "@/vente/dependances";
import { refusDeRequete } from "@/vente/garde";
import { confirmerCommande, methodeRefusee } from "@/vente/serveur";

/** Stripe, Resend et le rendu du PDF des CGV demandent Node : jamais Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envoi de la confirmation de commande par e-mail, avant tout téléchargement.
 * Appelée en POST par la page de la commande, à son chargement : la page
 * elle-même ne génère rien. Un seul envoi par commande, même en cas d'appels
 * simultanés.
 */
export async function POST(requete: Request, contexte: { params: Promise<{ ref: string }> }): Promise<Response> {
  const refus = refusDeRequete(requete);
  if (refus) return refus;
  const { ref } = await contexte.params;
  return confirmerCommande(requete, ref, dependancesReelles());
}

/** Une simple visite n'envoie rien. */
export function GET(): Response {
  return methodeRefusee();
}
