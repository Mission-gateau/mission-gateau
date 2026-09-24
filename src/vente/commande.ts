import { graineValide } from "../engine/alea";
import { schemaConfiguration } from "../engine/configuration";
import { VERSION_KIT } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { CLES, lireCommande, lireConfiguration } from "./metadonnees";
import { referenceValide, sessionValide } from "./reference";
import type { ClientStripe, PaiementLu } from "./stripe";

/** Le lien de téléchargement vaut 30 jours après le paiement ; la configuration est effacée ensuite. */
export const DUREE_DE_VALIDITE_MS = 30 * 24 * 60 * 60 * 1000;

export type EtatCommande =
  | {
      etat: "payee";
      reference: string;
      configuration: Configuration;
      graine: string;
      payeeLe: Date;
      expireLe: Date;
    }
  | { etat: "non_aboutie" }
  | { etat: "introuvable" }
  | { etat: "expiree" }
  | { etat: "remboursee" }
  | { etat: "autre_version" }
  | { etat: "illisible" }
  | { etat: "indisponible" };

export type NomEtat = EtatCommande["etat"];

/**
 * Ce que Stripe dit d'une commande, vérifié côté serveur, jamais sur la foi
 * du navigateur.
 *
 * Avec `sessionId` (retour de Stripe juste après le paiement), la session est
 * lue directement : la recherche de Stripe met jusqu'à une minute à voir un
 * paiement neuf. Sans elle (lien de l'e-mail), le paiement est cherché par sa
 * référence. Dans les deux cas, la référence est revérifiée à l'identique.
 *
 * La configuration est déchiffrée et revalidée pour s'assurer que le jeu peut
 * être produit, mais rien n'est généré ici.
 */
export async function etatDeLaCommande(entree: {
  reference: string;
  sessionId?: string | null;
  client: ClientStripe | null;
  cleStripe: string | undefined;
  maintenant: Date;
}): Promise<EtatCommande> {
  const { reference, sessionId, client, cleStripe, maintenant } = entree;
  if (!referenceValide(reference)) return { etat: "introuvable" };
  // Sans clé, ce déploiement n'a jamais pu vendre : aucune commande ne peut y
  // être trouvée. « Indisponible » reste réservé aux pannes de Stripe.
  if (!client || !cleStripe) return { etat: "introuvable" };

  try {
    let paiement: PaiementLu | null = null;
    if (sessionValide(sessionId)) {
      const session = await client.lireSession(sessionId);
      if (session && session.metadonnees[CLES.reference] === reference) {
        if (!session.payee) return { etat: "non_aboutie" };
        paiement = session.paiement;
      }
    }
    paiement ??= await client.paiementParReference(reference);
    if (!paiement || paiement.metadonnees[CLES.reference] !== reference) return { etat: "introuvable" };
    return etatDuPaiement(paiement, reference, cleStripe, maintenant);
  } catch {
    return { etat: "indisponible" };
  }
}

export function etatDuPaiement(
  paiement: PaiementLu,
  reference: string,
  cleStripe: string,
  maintenant: Date,
): EtatCommande {
  if (paiement.statut !== "succeeded") return { etat: "non_aboutie" };
  if (paiement.rembourseEnTotalite) return { etat: "remboursee" };

  // Les 30 jours courent à partir du débit réussi, pas de la première tentative.
  const payeeLe = new Date(paiement.payeLe * 1000);
  const expireLe = new Date(payeeLe.getTime() + DUREE_DE_VALIDITE_MS);
  if (maintenant.getTime() > expireLe.getTime()) return { etat: "expiree" };

  const commande = lireCommande(paiement.metadonnees);
  if (!commande) return { etat: "illisible" };
  // Le kit livré est celui de l'aperçu : même configuration, même graine,
  // même version. Une autre version n'est jamais livrée à la place.
  if (commande.versionKit !== VERSION_KIT) return { etat: "autre_version" };
  if (!graineValide(commande.graine)) return { etat: "illisible" };

  const lecture = lireConfiguration(paiement.metadonnees, cleStripe);
  if (lecture.etat === "effacee") return { etat: "expiree" };
  if (lecture.etat === "illisible") return { etat: "illisible" };
  const analyse = schemaConfiguration.safeParse(lecture.configuration);
  if (!analyse.success) return { etat: "illisible" };

  return {
    etat: "payee",
    reference,
    configuration: analyse.data as Configuration,
    graine: commande.graine,
    payeeLe,
    expireLe,
  };
}
