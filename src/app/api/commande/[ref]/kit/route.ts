import { dependancesReelles } from "@/vente/dependances";
import { refusDeRequete } from "@/vente/garde";
import { livrerKit, methodeRefusee } from "@/vente/serveur";

/** Le rendu PDF lit des fichiers et utilise fontkit : runtime Node, jamais Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Téléchargement du kit complet d'une commande payée. Appelée par le bouton
 * de la page de commande, en POST : un robot qui suit le lien de l'e-mail
 * n'arrive que sur la page, qui ne génère rien.
 */
export async function POST(requete: Request, contexte: { params: Promise<{ ref: string }> }): Promise<Response> {
  const refus = refusDeRequete(requete);
  if (refus) return refus;
  const { ref } = await contexte.params;
  return livrerKit(requete, ref, dependancesReelles());
}

/** Une simple visite ne livre rien. */
export function GET(): Response {
  return methodeRefusee();
}
