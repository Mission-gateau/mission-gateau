import { graineValide } from "../engine/alea";
import { schemaConfiguration } from "../engine/configuration";
import { VERSION_KIT } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { marqueRetenue } from "./examen";
import { delaiExpire, dernierJourDuDelai, finDuDelai, type Jour } from "./delai";
import { CLES, estUneCommande, lireCommande, lireConfiguration, lireSuivi, type Commande, type Suivi } from "./metadonnees";
import { referenceValide, sessionValide } from "./reference";
import { etatDuRemboursement, rembourseEnTotalite, type EtatDuRemboursement } from "./remboursement";
import type { ClientStripe, PaiementLu, SessionLue } from "./stripe";

/** Le lien de téléchargement vaut 30 jours après le paiement ; la configuration est effacée ensuite. */
export const DUREE_DE_VALIDITE_MS = 30 * 24 * 60 * 60 * 1000;

/** Le délai de rétractation d'une commande payée. */
export interface DelaiDeRetractation {
  /** Dernier jour du délai, à Paris (voir src/vente/delai.ts). */
  dernierJour: Jour;
  /** L'instant où le délai est dépassé partout sur Terre. */
  fin: Date;
  /** Vrai une fois cet instant passé. */
  expire: boolean;
}

export type EtatCommande =
  | {
      etat: "payee";
      reference: string;
      configuration: Configuration;
      graine: string;
      commande: Commande;
      /** Le paiement tel que Stripe le rend, lu à jour. */
      paiement: PaiementLu;
      /** La session Checkout, quand la page y a accès (retour de Stripe) : elle porte l'e-mail de l'acheteur. */
      session: SessionLue | null;
      payeeLe: Date;
      expireLe: Date;
      suivi: Suivi;
      delai: DelaiDeRetractation;
    }
  | {
      etat: "retractee";
      retracteeLe: Date;
      /** Lu sur les remboursements du paiement : effectué, demandé, ou à venir. */
      remboursement: EtatDuRemboursement;
      /** Vrai si le paiement fait l'objet d'une contestation auprès de la banque. */
      litige: boolean;
      montant: number;
    }
  /** Premier téléchargement et rétractation croisés, sans `course` : le vendeur tranche. */
  | { etat: "a_examiner" }
  | { etat: "litige" }
  | { etat: "non_aboutie" }
  | { etat: "introuvable" }
  | { etat: "expiree" }
  | { etat: "remboursee" }
  /** Remboursé hors rétractation, remboursement demandé mais pas encore réglé chez Stripe. */
  | { etat: "remboursement_demande" }
  | { etat: "autre_version" }
  | { etat: "illisible" }
  | { etat: "indisponible" };

export type NomEtat = EtatCommande["etat"];

export type CommandePayee = Extract<EtatCommande, { etat: "payee" }>;

/**
 * Ce que Stripe dit d'une commande, vérifié côté serveur, jamais sur la foi
 * du navigateur.
 *
 * Avec `sessionId` (retour de Stripe juste après le paiement), la session est
 * lue directement : la recherche de Stripe met jusqu'à une minute à voir un
 * paiement neuf. Sans elle (lien de l'e-mail), le paiement est cherché par sa
 * référence, puis relu par son identifiant. Dans les deux cas, la référence
 * est revérifiée à l'identique, et le paiement doit porter `boutique` =
 * `mission-gateau` (la session ne la porte pas : c'est le paiement qui
 * compte) ; un paiement d'un autre produit est « introuvable ».
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
    let session: SessionLue | null = null;
    if (sessionValide(sessionId)) {
      const lue = await client.lireSession(sessionId);
      if (lue && lue.metadonnees[CLES.reference] === reference) {
        if (lue.paiement && !estUneCommande(lue.paiement.metadonnees, reference)) return { etat: "introuvable" };
        if (!lue.payee) return { etat: "non_aboutie" };
        session = lue;
        paiement = lue.paiement;
      }
    }
    paiement ??= await client.paiementParReference(reference);
    if (!paiement || !estUneCommande(paiement.metadonnees, reference)) return { etat: "introuvable" };
    return etatDuPaiement(paiement, reference, cleStripe, maintenant, session);
  } catch {
    return { etat: "indisponible" };
  }
}

/**
 * L'état d'une commande, lu sur son paiement. L'ordre compte : un paiement
 * rétracté l'est avant tout le reste, un litige bloque la livraison avant
 * même le remboursement, et seul un paiement abouti, confirmé ou non, peut
 * mener au jeu. Quand premier téléchargement et rétractation se sont croisés,
 * la marque gagnante décide (voir src/vente/course.ts) : une rétractation qui
 * a perdu ne bloque rien, un croisement sans `course` est « à examiner ».
 */
export function etatDuPaiement(
  paiement: PaiementLu,
  reference: string,
  cleStripe: string,
  maintenant: Date,
  session: SessionLue | null = null,
): EtatCommande {
  if (paiement.statut !== "succeeded") return { etat: "non_aboutie" };
  // Une heure illisible ne compte pas comme absente : à examiner (src/vente/examen.ts).
  const gagnante = marqueRetenue(paiement.metadonnees);
  const suivi = lireSuivi(paiement.metadonnees);
  if (gagnante === "a_examiner") return { etat: "a_examiner" };
  if (gagnante === "retractation" && suivi.retractation) {
    return {
      etat: "retractee",
      retracteeLe: suivi.retractation,
      remboursement: etatDuRemboursement(paiement),
      litige: paiement.litige,
      montant: paiement.montant,
    };
  }
  if (paiement.litige) return { etat: "litige" };
  // Remboursé hors rétractation (depuis le tableau de bord de Stripe), fait ou seulement demandé : plus rien n'est livré ;
  // seul l'affichage distingue les deux.
  if (rembourseEnTotalite(paiement)) {
    return { etat: etatDuRemboursement(paiement) === "effectue" ? "remboursee" : "remboursement_demande" };
  }

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
    commande,
    paiement,
    session,
    payeeLe,
    expireLe,
    suivi,
    delai: {
      dernierJour: dernierJourDuDelai(payeeLe),
      fin: finDuDelai(payeeLe),
      expire: delaiExpire(payeeLe, maintenant),
    },
  };
}

/**
 * L'adresse e-mail de l'acheteur, par un seul chemin, le même pour la page,
 * la tâche quotidienne et la fonction de rétractation : celle qu'il a saisie
 * sur la page de paiement (customer_details.email de la session Checkout,
 * retrouvée par le paiement), à défaut l'e-mail de facturation du dernier
 * débit. Une nouvelle tentative envoie ainsi exactement la même requête à
 * Resend. Null si Stripe n'en connaît aucune.
 */
export async function emailDeLAcheteur(client: ClientStripe, paiement: PaiementLu): Promise<string | null> {
  const session = await client.sessionDuPaiement(paiement.id);
  return session?.email || paiement.emailDuDebit;
}
