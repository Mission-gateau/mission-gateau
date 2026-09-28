import { VENDEUR, type FicheVendeur } from "../contenu/vendeur";
import { creerClientEmail, type ClientEmail } from "./envoi";
import { lireEnvironnement, type Environnement } from "./environnement";
import { stripePermis } from "./ouverture";
import { creerClientStripe, type ClientStripe } from "./stripe";

/**
 * Ce dont les routes de la vente ont besoin, réuni en un seul point : les
 * tests remplacent Stripe et Resend par de faux clients, l'environnement par
 * le leur, et l'horloge par une date fixe.
 */
export interface Dependances {
  env: Environnement;
  fiche: FicheVendeur;
  client: ClientStripe | null;
  email: ClientEmail | null;
  maintenant: () => Date;
}

/**
 * Lu à chaque requête, jamais au build. En production, sans clé Stripe réelle,
 * aucun client Stripe n'est créé : rien ne peut alors toucher un paiement de
 * test, ni hors production avec une clé réelle (voir stripePermis).
 */
export function dependancesReelles(): Dependances {
  const env = lireEnvironnement();
  return {
    env,
    fiche: VENDEUR,
    client: stripePermis(env) ? creerClientStripe(env) : null,
    email: creerClientEmail(env),
    maintenant: () => new Date(),
  };
}
