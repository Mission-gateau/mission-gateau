import { randomBytes } from "node:crypto";

/**
 * Référence d'une commande : 128 bits tirés au hasard, écrits en base64url
 * (22 caractères). Elle figure dans le lien de téléchargement et suffit à
 * retrouver la commande chez Stripe ; elle ne dit rien de son contenu.
 */
export function creerReference(): string {
  return randomBytes(16).toString("base64url");
}

const MOTIF_REFERENCE = /^[A-Za-z0-9_-]{22}$/;

export function referenceValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && MOTIF_REFERENCE.test(valeur);
}

/** Identifiant de session Stripe Checkout, tel que Stripe le renvoie au retour. */
const MOTIF_SESSION = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;

export function sessionValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && MOTIF_SESSION.test(valeur);
}
