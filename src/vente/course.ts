import { lireSuivi, type Marque } from "./metadonnees";

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
 * - chaque route décide sur le paiement que Stripe lui renvoie en réponse à
 *   sa propre écriture : si la marque de l'autre y figure déjà, l'autre
 *   l'emporte ; sinon, elle l'emporte. Stripe applique les mises à jour d'un
 *   même paiement l'une après l'autre : des deux écritures, seule la seconde
 *   voit la marque de la première ;
 * - la route qui perd écrit `course` = le nom de la marque gagnante. Quand
 *   les deux marques existent, c'est `course` qui dit laquelle l'emporte ;
 *   sans `course` (son écriture a échoué), la commande est « à examiner » :
 *   ni livraison ni remboursement automatiques, le vendeur répond sous 7
 *   jours.
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
