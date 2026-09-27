import { dependancesReelles } from "@/vente/dependances";
import { refusDeRequete } from "@/vente/garde";
import { creerCommande, methodeRefusee } from "@/vente/serveur";

/** Stripe et le chiffrement demandent Node : jamais Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Création d'une commande. Les données arrivent en POST, jamais dans
 * l'adresse ; la route revérifie tout, puis renvoie l'adresse de la page de
 * paiement hébergée par Stripe. Tant que la vente est fermée : 503.
 */
export async function POST(requete: Request): Promise<Response> {
  return refusDeRequete(requete) ?? creerCommande(requete, dependancesReelles());
}

export function GET(): Response {
  return methodeRefusee();
}
