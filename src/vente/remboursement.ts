import type { PaiementLu } from "./stripe";

/**
 * L'état réel du remboursement d'un paiement, lu sur les remboursements
 * eux-mêmes (ceux du débit réussi, que chaque lecture développe), jamais sur
 * le drapeau `refunded` du débit :
 *
 * - `succeeded` : remboursement effectué ;
 * - `pending` ou `requires_action` : remboursement demandé, pas encore
 *   réglé. Au lancement, c'est un cas normal : Stripe met en attente un
 *   remboursement demandé juste après le paiement (paiement pas encore
 *   réglé, ou solde disponible insuffisant) ;
 * - aucun, `failed` ou `canceled` : remboursement à venir.
 *
 * Les accusés de réception, la page de la commande et la tâche quotidienne
 * lisent tous cet état ici.
 */

export type EtatDuRemboursement = "effectue" | "demande" | "a_venir";

/** Un remboursement fait, ou demandé et pas encore réglé. */
const FAIT_OU_DEMANDE = new Set(["pending", "requires_action", "succeeded"]);

type Remboursements = Pick<PaiementLu, "remboursements">;

export function etatDuRemboursement(paiement: Remboursements): EtatDuRemboursement {
  if (paiement.remboursements.some((remboursement) => remboursement.statut === "succeeded")) return "effectue";
  if (paiement.remboursements.some((remboursement) => FAIT_OU_DEMANDE.has(remboursement.statut))) return "demande";
  return "a_venir";
}

/**
 * Un remboursement existe déjà, fait ou demandé : la tâche quotidienne n'en
 * crée pas d'autre. Un remboursement `failed` ou `canceled` ne compte pas : la
 * tâche le retente.
 */
export function remboursementExistant(paiement: Remboursements): boolean {
  return paiement.remboursements.some((remboursement) => FAIT_OU_DEMANDE.has(remboursement.statut));
}

/**
 * Le paiement est remboursé en totalité, fait ou demandé : ses remboursements
 * `pending`, `requires_action` ou `succeeded` couvrent le montant payé. Un tel
 * paiement, remboursé hors rétractation, n'est plus livré ni confirmé ; seul
 * l'affichage distingue « demandé » et « effectué ».
 */
export function rembourseEnTotalite(paiement: Pick<PaiementLu, "remboursements" | "montant">): boolean {
  const couvert = paiement.remboursements
    .filter((remboursement) => FAIT_OU_DEMANDE.has(remboursement.statut))
    .reduce((total, remboursement) => total + remboursement.montant, 0);
  return paiement.montant > 0 && couvert >= paiement.montant;
}

/**
 * L'état d'un remboursement que Stripe vient d'accepter : `succeeded` →
 * effectué ; `pending`, `requires_action`, ou un paiement déjà remboursé en
 * totalité (fait ou demandé : Stripe ne dit pas lequel) → demandé ; `failed`
 * ou `canceled` → à venir.
 */
export function etatDUnRemboursementCree(statut: string): EtatDuRemboursement {
  if (statut === "succeeded") return "effectue";
  if (statut === "pending" || statut === "requires_action" || statut === "deja_rembourse") return "demande";
  return "a_venir";
}
