import { dependancesReelles } from "@/vente/dependances";
import { methodeRefusee, renoncer } from "@/vente/serveur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La fonction « Renoncer au contrat ici » : reçoit une déclaration de
 * rétractation, en POST, la traite et en accuse réception par e-mail.
 */
export function POST(requete: Request): Promise<Response> {
  return renoncer(requete, dependancesReelles());
}

export function GET(): Response {
  return methodeRefusee();
}
