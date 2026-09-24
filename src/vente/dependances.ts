import { VENDEUR, type FicheVendeur } from "../contenu/vendeur";
import { lireEnvironnement, type Environnement } from "./environnement";
import { creerClientStripe, type ClientStripe } from "./stripe";

/**
 * Ce dont les routes de la vente ont besoin, réuni en un seul point : les
 * tests remplacent Stripe par un faux client, l'environnement par le leur,
 * et l'horloge par une date fixe.
 */
export interface Dependances {
  env: Environnement;
  fiche: FicheVendeur;
  client: ClientStripe | null;
  maintenant: () => Date;
}

/** Lu à chaque requête, jamais au build. */
export function dependancesReelles(): Dependances {
  const env = lireEnvironnement();
  return { env, fiche: VENDEUR, client: creerClientStripe(env), maintenant: () => new Date() };
}
