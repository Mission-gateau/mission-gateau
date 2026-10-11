import type { PaiementLu } from "./stripe";

/**
 * L'état réel du remboursement d'un paiement, lu sur les remboursements
 * eux-mêmes (ceux du débit réussi, que chaque lecture développe), jamais sur
 * le drapeau `refunded` du débit, et toujours sur la couverture du montant
 * payé — un remboursement partiel (5,00 € depuis le tableau de bord, par
 * exemple) ne suffit pas :
 *
 * - `effectue` : les remboursements `succeeded` couvrent le montant payé ;
 * - `demande` : les remboursements `succeeded`, `pending` et
 *   `requires_action` couvrent le montant, sans que `succeeded` seul le
 *   couvre. Au lancement, c'est un cas normal : Stripe met en attente un
 *   remboursement demandé juste après le paiement (paiement pas encore
 *   réglé, ou solde disponible insuffisant) ;
 * - `a_venir` : sinon (aucun remboursement, `failed`, `canceled`, ou un
 *   remboursement partiel qui ne couvre pas le montant).
 *
 * Les accusés de réception, la page de la commande, la tâche quotidienne et
 * la liste des commandes à traiter lisent tous cet état ici.
 */

export type EtatDuRemboursement = "effectue" | "demande" | "a_venir";

/** Un remboursement fait, ou demandé et pas encore réglé. */
const FAIT_OU_DEMANDE = new Set(["pending", "requires_action", "succeeded"]);
const FAIT = new Set(["succeeded"]);
/** Un remboursement qui n'a rien rendu : la tâche quotidienne le retente. */
const ECHOUE = new Set(["failed", "canceled"]);

type Remboursements = Pick<PaiementLu, "remboursements" | "montant">;

/** Le total, en centimes, des remboursements dont l'état est dans `statuts`. */
function total(paiement: Pick<PaiementLu, "remboursements">, statuts: ReadonlySet<string>): number {
  return paiement.remboursements
    .filter((remboursement) => statuts.has(remboursement.statut))
    .reduce((somme, remboursement) => somme + remboursement.montant, 0);
}

function couvre(paiement: Remboursements, statuts: ReadonlySet<string>): boolean {
  return paiement.montant > 0 && total(paiement, statuts) >= paiement.montant;
}

export function etatDuRemboursement(paiement: Remboursements): EtatDuRemboursement {
  if (couvre(paiement, FAIT)) return "effectue";
  if (couvre(paiement, FAIT_OU_DEMANDE)) return "demande";
  return "a_venir";
}

/**
 * Le paiement est remboursé en totalité, fait ou demandé : ses remboursements
 * `pending`, `requires_action` ou `succeeded` couvrent le montant payé. Un tel
 * paiement, remboursé hors rétractation, n'est plus livré ni confirmé ; seul
 * l'affichage distingue « demandé » et « effectué ». Tant qu'il ne l'est pas,
 * une rétractation gagnante rembourse le reste (Stripe rembourse par défaut
 * le montant qui n'est pas encore remboursé).
 */
export function rembourseEnTotalite(paiement: Remboursements): boolean {
  return couvre(paiement, FAIT_OU_DEMANDE);
}

/** Ce qui reste à rembourser, en centimes : le montant payé moins les remboursements faits ou demandés. */
export function resteARembourser(paiement: Remboursements): number {
  return Math.max(0, paiement.montant - total(paiement, FAIT_OU_DEMANDE));
}

/** Un remboursement a échoué ou a été annulé : la route le laisse à la tâche quotidienne, qui le retente sous une autre clé. */
export function remboursementEchoue(paiement: Pick<PaiementLu, "remboursements">): boolean {
  return paiement.remboursements.some((remboursement) => ECHOUE.has(remboursement.statut));
}

/**
 * L'état du paiement juste après que Stripe a accepté un remboursement du
 * reste : le nouveau remboursement (`statut`, pour le montant qui restait)
 * s'ajoute à ceux qui existaient. Un paiement déjà remboursé en totalité
 * (fait ou demandé : Stripe ne dit pas lequel) → demandé.
 */
export function etatApresUnRemboursement(paiement: Remboursements, cree: { id: string; statut: string }): EtatDuRemboursement {
  if (cree.statut === "deja_rembourse") return "demande";
  return etatDuRemboursement({
    montant: paiement.montant,
    remboursements: [...paiement.remboursements, { id: cree.id, statut: cree.statut, montant: resteARembourser(paiement) }],
  });
}
