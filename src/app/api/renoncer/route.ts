import { dependancesReelles } from "@/vente/dependances";
import { refusDeRequete } from "@/vente/garde";
import { methodeRefusee, renoncer } from "@/vente/serveur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La fonction « Renoncer au contrat ici » : reçoit une déclaration de
 * rétractation, en POST, en JSON et depuis une page du site seulement ; ne la
 * traite, et n'en accuse réception par e-mail, que si elle désigne une
 * commande payée retrouvée chez Stripe.
 */
export async function POST(requete: Request): Promise<Response> {
  return refusDeRequete(requete) ?? renoncer(requete, dependancesReelles());
}

export function GET(): Response {
  return methodeRefusee();
}
