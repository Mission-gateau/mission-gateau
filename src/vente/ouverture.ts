import { VENDEUR, type FicheVendeur } from "../contenu/vendeur";
import { cleConforme, enProduction, lireEnvironnement, natureCle, type Environnement } from "./environnement";
import { ficheComplete, ficheCompleteHorsConvention } from "./fiche";

/**
 * La vente n'est ouverte que si tout ce qu'il faut pour vendre, confirmer la
 * commande par e-mail et livrer est réuni :
 *
 * - en production : une clé Stripe réelle, la fiche du vendeur complète,
 *   convention avec le médiateur comprise, et la clé de Resend ;
 * - partout ailleurs (préversions, local) : une clé Stripe de test, la fiche
 *   complète sauf la convention, et la clé de Resend.
 *
 * Tant qu'il manque quelque chose, aucun prix n'est affiché, aucun bouton
 * d'achat n'apparaît, et la route de commande répond 503.
 */
export function venteOuverte(env: Environnement, fiche: FicheVendeur = VENDEUR): boolean {
  if (!cleConforme(env) || !env.cleResend) return false;
  return enProduction(env) ? ficheComplete(fiche) : ficheCompleteHorsConvention(fiche);
}

/**
 * La livraison des commandes déjà payées ne dépend pas de l'ouverture de la
 * vente : elle n'a besoin que d'une clé Stripe, quelle que soit sa nature. La
 * confirmation par e-mail, qui doit partir avant, a besoin de la clé de Resend.
 */
export function livraisonPossible(env: Environnement): boolean {
  return natureCle(env.cleStripe) !== null;
}

/**
 * Hors production, le kit livré porte sur chaque page la mention « Exemplaire
 * d'essai » ; en production, jamais.
 */
export function exemplaireDEssai(env: Environnement): boolean {
  return !enProduction(env);
}

/**
 * État de la vente pour la requête en cours. Appelé pendant le rendu d'une
 * page ou d'une route, jamais au build : toutes les pages sont dynamiques
 * (voir src/app/layout.tsx).
 */
export function venteOuverteMaintenant(): boolean {
  return venteOuverte(lireEnvironnement());
}
