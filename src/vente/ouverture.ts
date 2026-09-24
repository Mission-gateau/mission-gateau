import { VENDEUR, type FicheVendeur } from "../contenu/vendeur";
import { cleConforme, lireEnvironnement, natureCle, type Environnement } from "./environnement";
import { ficheComplete } from "./fiche";

/**
 * La vente n'est ouverte que si deux conditions sont réunies : une clé Stripe
 * de la bonne nature pour l'environnement, et une fiche du vendeur complète,
 * médiateur compris. Tant qu'il manque quelque chose, aucun prix n'est
 * affiché, aucun bouton d'achat n'apparaît, et la route de commande répond 503.
 */
export function venteOuverte(env: Environnement, fiche: FicheVendeur = VENDEUR): boolean {
  return cleConforme(env) && ficheComplete(fiche);
}

/**
 * La livraison des commandes déjà payées ne dépend pas de l'ouverture de la
 * vente : elle n'a besoin que d'une clé, quelle que soit sa nature.
 */
export function livraisonPossible(env: Environnement): boolean {
  return natureCle(env.cleStripe) !== null;
}

/**
 * État de la vente pour la requête en cours. Appelé pendant le rendu d'une
 * page ou d'une route, jamais au build : toutes les pages sont dynamiques
 * (voir src/app/layout.tsx).
 */
export function venteOuverteMaintenant(): boolean {
  return venteOuverte(lireEnvironnement());
}
