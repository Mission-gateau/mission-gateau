import { lireSuivi, type Marque } from "./metadonnees";
import { erreurDIdempotence, type ClientStripe, type PaiementLu } from "./stripe";

/**
 * Premier téléchargement et rétractation qui se croisent.
 *
 * La route du kit et la fonction de rétractation peuvent traiter la même
 * commande au même instant (deux onglets suffisent). Comparer les heures ne
 * suffit pas : l'heure de réception d'une déclaration est prise à son
 * arrivée, bien avant son écriture. La règle, écrite ici une seule fois et
 * suivie par la route du kit, la page de la commande, la fonction de
 * rétractation, la tâche quotidienne et les accusés de réception :
 *
 * - l'emporte la première des deux marques (`telechargement`,
 *   `retractation`) écrite chez Stripe ;
 * - chaque marque ne s'écrit qu'une fois : l'écriture porte une clé
 *   d'idempotence tirée de la marque et de la référence (ecrireLaMarque), si
 *   bien que Stripe n'exécute que la première requête ; une seconde, venue
 *   d'un autre onglet ou d'une autre déclaration, est refusée et relit
 *   l'état au lieu d'écraser la première marque ;
 * - chaque route qui a écrit sa marque décide sur le paiement que Stripe lui
 *   renvoie en réponse : si la marque de l'autre y figure déjà, l'autre
 *   l'emporte ; sinon, elle l'emporte. Stripe applique les mises à jour d'un
 *   même paiement l'une après l'autre : des deux écritures, seule la seconde
 *   voit la marque de la première ;
 * - la route qui perd écrit `course` = le nom de la marque gagnante. Quand
 *   les deux marques existent, c'est `course` qui dit laquelle l'emporte ;
 *   sans `course` (son écriture a échoué), la commande est « à examiner » :
 *   ni livraison ni remboursement automatiques, le vendeur répond sous 7
 *   jours ;
 * - seule exception : quand l'écriture de `retractation` échoue alors
 *   qu'elle s'est appliquée (réponse perdue), la fonction de rétractation
 *   décide sur une relecture du paiement, qui remplace cette réponse (voir
 *   src/vente/retractation.ts).
 *
 * Deux hypothèses sur Stripe, que le faux Stripe des tests (qui applique
 * chaque mise à jour d'un bloc) ne peut pas éprouver : la réponse de Stripe
 * à une mise à jour d'un paiement contient les écritures concurrentes déjà
 * appliquées ; une relecture par identifiant montre toutes les écritures
 * déjà appliquées.
 */

/** La marque qui l'emporte, « a_examiner » sans `course`, ou null si aucune n'est écrite. */
export type Gagnante = Marque | "a_examiner" | null;

export function marqueGagnante(metadonnees: Record<string, string>): Gagnante {
  const suivi = lireSuivi(metadonnees);
  const telechargement = suivi.telechargement !== null;
  const retractation = suivi.retractation !== null;
  if (telechargement && retractation) return suivi.course ?? "a_examiner";
  if (telechargement) return "telechargement";
  if (retractation) return "retractation";
  return null;
}

export function autreMarque(marque: Marque): Marque {
  return marque === "telechargement" ? "retractation" : "telechargement";
}

/**
 * La décision d'une route qui vient d'écrire sa marque, prise sur les
 * métadonnées du paiement que Stripe lui a renvoyé en réponse à cette
 * écriture, et sur rien d'autre.
 */
export function issueDeLEcriture(marque: Marque, apres: Record<string, string>): "gagne" | "perd" {
  return lireSuivi(apres)[autreMarque(marque)] !== null ? "perd" : "gagne";
}

/**
 * Une rétractation battue par le premier téléchargement, qu'elle ait écrit sa
 * marque après lui ou trouvé la sienne déjà écrite : si la déclaration avait
 * été reçue avant le début de ce téléchargement, les deux sont arrivés
 * presque en même temps et le vendeur tranche (« simultanee ») ; sinon, le
 * droit avait déjà pris fin (« telechargee »).
 */
export function issueDUneRetractationBattue(recueLe: Date, telechargeLe: Date): "simultanee" | "telechargee" {
  return recueLe.getTime() < telechargeLe.getTime() ? "simultanee" : "telechargee";
}

/**
 * Nombre de clés d'idempotence essayées pour une marque, au cas où Stripe
 * aurait gardé l'échec d'une tentative : il faudrait dix réponses 500 gardées
 * par Stripe sur une même commande pour bloquer l'écriture d'une marque
 * pendant 24 heures.
 */
export const ESSAIS_DE_MARQUE = 10;

/** Les clés d'une marque ont toutes servi à des tentatives restées sans effet : elle ne peut pas s'écrire avant que Stripe les oublie. */
export class ClesDeMarqueEpuisees extends Error {
  constructor() {
    super("La marque n'a pas pu être écrite : toutes ses clés d'idempotence ont servi.");
    this.name = "ClesDeMarqueEpuisees";
  }
}

/** La clé d'idempotence de l'écriture d'une marque : la même pour toutes les requêtes qui l'écrivent. */
export function cleDeMarque(marque: Marque, reference: string, essai: number): string {
  return `marque-${marque}-${reference}-${essai}`;
}

export type EcritureDeMarque =
  /** Cette requête a écrit la marque, la première : `apres` est la réponse de Stripe à son écriture. */
  | { issue: "ecrite"; apres: PaiementLu }
  /** Une autre requête l'avait déjà écrite : `apres` est le paiement relu, à jour. */
  | { issue: "deja_ecrite"; apres: PaiementLu }
  /** Une autre requête l'écrit en ce moment même. */
  | { issue: "en_cours" };

/**
 * Écrit une marque une seule fois. Stripe n'exécute que la première requête
 * de même clé : une autre, aux paramètres forcément différents (l'heure),
 * est refusée, et on relit alors le paiement. Si la marque n'y est pas, la
 * clé a servi à une tentative qui n'a rien écrit (Stripe garde aussi les
 * échecs) : on passe à la clé suivante. Une panne de Stripe se propage à
 * l'appelant ; quand toutes les clés ont servi, ClesDeMarqueEpuisees.
 */
export async function ecrireLaMarque(
  client: ClientStripe,
  paiement: PaiementLu,
  reference: string,
  marque: Marque,
  valeurs: Record<string, string>,
): Promise<EcritureDeMarque> {
  for (let essai = 1; essai <= ESSAIS_DE_MARQUE; essai += 1) {
    try {
      return { issue: "ecrite", apres: await client.modifierMetadonnees(paiement.id, valeurs, cleDeMarque(marque, reference, essai)) };
    } catch (erreur) {
      const conflit = erreurDIdempotence(erreur);
      if (conflit === null) throw erreur;
      if (conflit === "en_cours") return { issue: "en_cours" };
      const frais = await client.lirePaiement(paiement.id);
      if (!frais) throw new Error("Paiement introuvable à la relecture.");
      if (lireSuivi(frais.metadonnees)[marque] !== null) return { issue: "deja_ecrite", apres: frais };
    }
  }
  throw new ClesDeMarqueEpuisees();
}
